import { useState, useEffect, useRef, useCallback } from "react";
import type { FlightRecord, ControlPanelStats, ReviewStatus } from "../types/controlPanel";
import { fetchControlPanelFeed, fetchControlPanelStats } from "../utils/controlPanelApi";
import { playCockpitSound } from "../utils/controlPanelAudio";

export interface UseControlPanelFeedOptions {
    initialInterval?: number; // ms
    defaultStatus?: string;
    islandFilter?: string;
}

export const useControlPanelFeed = (options: UseControlPanelFeedOptions = {}) => {
    const [flights, setFlights] = useState<FlightRecord[]>([]);
    const [incomingBuffer, setIncomingBuffer] = useState<FlightRecord[]>([]);
    const [stats, setStats] = useState<ControlPanelStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [isLive, setIsLive] = useState(true);
    const [pollInterval, setPollInterval] = useState(options.initialInterval || 4000);
    const [statusFilter, setStatusFilter] = useState(options.defaultStatus || "pending");
    const [islandFilter, setIslandFilter] = useState(options.islandFilter || "");
    const [searchQuery, setSearchQuery] = useState("");
    const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem("cp_sound") !== "0");
    const [countdown, setCountdown] = useState(Math.round(pollInterval / 1000));

    const pollTimerRef = useRef<number | null>(null);
    const countdownTimerRef = useRef<number | null>(null);
    const lastKnownIdRef = useRef<number>(0);
    const isTabActiveRef = useRef<boolean>(true);

    const updateSoundPreference = useCallback((enabled: boolean) => {
        setSoundEnabled(enabled);
        localStorage.setItem("cp_sound", enabled ? "1" : "0");
    }, []);

    // Perform query
    const loadFeed = useCallback(async (isManualRefresh = false) => {
        if (isManualRefresh) setRefreshing(true);
        try {
            const [feedRes, statsRes] = await Promise.all([
                fetchControlPanelFeed({
                    limit: 50,
                    island: islandFilter || undefined,
                    status: statusFilter,
                    search: searchQuery || undefined,
                }),
                fetchControlPanelStats().catch(() => null),
            ]);

            if (statsRes) setStats(statsRes);

            const fetchedFlights = feedRes.flights || [];

            // Detect new flights
            if (lastKnownIdRef.current > 0 && fetchedFlights.length > 0) {
                const newestId = Math.max(...fetchedFlights.map(f => f.id));
                const newItems = fetchedFlights.filter(f => f.id > lastKnownIdRef.current);

                if (newItems.length > 0) {
                    if (soundEnabled) {
                        const hasAlert = newItems.some(f => f.match_status === "mismatch" || f.match_status === "unregistered");
                        playCockpitSound(hasAlert ? "alert" : "arrival");
                    }
                    // Put in incoming buffer if user is viewing current list
                    setIncomingBuffer(prev => {
                        const existingIds = new Set(prev.map(p => p.id));
                        const additions = newItems.filter(item => !existingIds.has(item.id));
                        return [...additions, ...prev];
                    });
                }
                lastKnownIdRef.current = Math.max(lastKnownIdRef.current, newestId);
            } else if (fetchedFlights.length > 0) {
                lastKnownIdRef.current = Math.max(...fetchedFlights.map(f => f.id));
                setFlights(fetchedFlights);
            } else {
                setFlights([]);
            }

            setError(null);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Error loading control panel data");
        } finally {
            setLoading(false);
            if (isManualRefresh) setRefreshing(false);
            setCountdown(Math.round(pollInterval / 1000));
        }
    }, [islandFilter, statusFilter, searchQuery, soundEnabled, pollInterval]);

    // Apply incoming buffer to active flights
    const applyIncomingBuffer = useCallback(() => {
        if (incomingBuffer.length === 0) return;
        setFlights(prev => {
            const newMap = new Map<number, FlightRecord>();
            incomingBuffer.forEach(f => newMap.set(f.id, f));
            prev.forEach(f => {
                if (!newMap.has(f.id)) newMap.set(f.id, f);
            });
            return Array.from(newMap.values()).sort((a, b) => b.id - a.id);
        });
        setIncomingBuffer([]);
    }, [incomingBuffer]);

    // Optimistic local flight update
    const updateFlightLocal = useCallback((visitId: number, status: ReviewStatus, handledBy: string) => {
        setFlights(prev =>
            prev.map(f => {
                if (f.id === visitId) {
                    return {
                        ...f,
                        review_status: status,
                        handled_by: handledBy,
                        handled_at: Math.floor(Date.now() / 1000),
                    };
                }
                return f;
            })
        );
        setIncomingBuffer(prev => prev.filter(f => f.id !== visitId));
    }, []);

    // Tab visibility handling
    useEffect(() => {
        const handleVisibilityChange = () => {
            isTabActiveRef.current = !document.hidden;
            if (!document.hidden && isLive) {
                // Immediate refresh upon refocusing tab
                loadFeed(false);
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
    }, [isLive, loadFeed]);

    // Setup polling interval and countdown
    useEffect(() => {
        loadFeed(false);

        if (!isLive || pollInterval <= 0) return;

        countdownTimerRef.current = window.setInterval(() => {
            if (!isTabActiveRef.current) return;
            setCountdown(prev => (prev <= 1 ? Math.round(pollInterval / 1000) : prev - 1));
        }, 1000);

        pollTimerRef.current = window.setInterval(() => {
            if (!isTabActiveRef.current) return;
            loadFeed(false);
        }, pollInterval);

        return () => {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        };
    }, [isLive, pollInterval, islandFilter, statusFilter, searchQuery, loadFeed]);

    return {
        flights,
        incomingBuffer,
        stats,
        loading,
        refreshing,
        error,
        isLive,
        setIsLive,
        pollInterval,
        setPollInterval,
        countdown,
        islandFilter,
        setIslandFilter,
        statusFilter,
        setStatusFilter,
        searchQuery,
        setSearchQuery,
        soundEnabled,
        setSoundEnabled: updateSoundPreference,
        loadFeed,
        applyIncomingBuffer,
        updateFlightLocal,
    };
};
