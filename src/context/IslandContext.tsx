import React, { useState, useEffect, useCallback } from "react";
import { type IslandData, type IslandStatus } from "../data/islands";
import { ACNH_FINDER_API_BASE, DODO_API_BASE } from "../config/api";
import { IslandContext } from "./islandContextShared";
import { getAuthToken } from "./authToken";

interface ApiIsland {
    id: string;
    name: string;
    canonical_name?: string;
    cat: string;
    description: string;
    dodo_code: string;
    discord_bot_online: boolean;
    visitors: number;
    items: string[];
    map_url: string;
    seasonal: string;
    status: string;
    theme: string;
    type: string;
    updated_at: string;
    required_roles: string[];
    accessible?: boolean;
    viewer_has_access?: boolean;
    channel_id?: string;
    channelId?: string;
}

interface ApiIslandsResponse {
    data: ApiIsland[];
}

interface VillagerApiResponse {
    timestamp: string;
    total_islands: number;
    islands: Record<string, string[]>;
}

const STORAGE_KEY_ISLANDS = "chopaeng_islands_cache";
const STORAGE_KEY_VILLAGERS = "chopaeng_villagers_cache";
const STORAGE_KEY_TIMESTAMP = "chopaeng_cache_timestamp";
const STORAGE_KEY_AUTH_SCOPE = "chopaeng_cache_auth_scope";

const getIslandMap = (islandName: string) => `https://cdn.chopaeng.com/maps/${islandName.toLowerCase()}.png`;

const VALID_CATS = ["public", "member", "order"] as const;
const VALID_THEMES = ["pink", "teal", "purple", "gold"] as const;

const toIslandCat = (value: string, fallback: IslandData["cat"]): IslandData["cat"] =>
    (VALID_CATS as readonly string[]).includes(value) ? (value as IslandData["cat"]) : fallback;

const toIslandTheme = (value: string, fallback: IslandData["theme"]): IslandData["theme"] =>
    (VALID_THEMES as readonly string[]).includes(value) ? (value as IslandData["theme"]) : fallback;

const getCacheAuthScope = () => getAuthToken() || "anon";

const isCurrentCacheScope = () => (sessionStorage.getItem(STORAGE_KEY_AUTH_SCOPE) || localStorage.getItem(STORAGE_KEY_AUTH_SCOPE)) === getCacheAuthScope();

export const IslandProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [islands, setIslands] = useState<IslandData[]>(() => {
        if (!isCurrentCacheScope()) return [];
        const cached = sessionStorage.getItem(STORAGE_KEY_ISLANDS);
        if (cached) {
            try {
                return JSON.parse(cached);
            } catch (e) {
                console.error("Failed to parse cached islands", e);
            }
        }
        return [];
    });

    const [villagersMap, setVillagersMap] = useState<Record<string, string[]>>(() => {
        if (!isCurrentCacheScope()) return {};
        const cached = sessionStorage.getItem(STORAGE_KEY_VILLAGERS);
        if (cached) {
            try {
                return JSON.parse(cached);
            } catch (e) {
                console.error("Failed to parse cached villagers", e);
            }
        }
        return {};
    });

    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<number | null>(() => {
        if (!isCurrentCacheScope()) return null;
        const cached = sessionStorage.getItem(STORAGE_KEY_TIMESTAMP);
        return cached ? parseInt(cached, 10) : null;
    });

    const refreshData = useCallback(async () => {
        try {
            // 1. Fetch Island Status
            const token = getAuthToken();
            const islandHeaders: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
            const islandRes = await fetch(`${DODO_API_BASE}/api/islands`, {
                headers: islandHeaders,
                credentials: "include",
            });
            if (!islandRes.ok) throw new Error("Island API error");
            const islandJson: ApiIslandsResponse = await islandRes.json();
            const apiData: ApiIsland[] = islandJson.data;

            // 2. Fetch Villagers List
            const villagerRes = await fetch(`${ACNH_FINDER_API_BASE}/api/villagers/list`);
            const villagerData: VillagerApiResponse = villagerRes.ok ? await villagerRes.json() : { islands: {} };

            // Process Island Data
            const updatedIslands: IslandData[] = apiData.map((liveData, index) => {
                let computedStatus: IslandStatus = "OFFLINE";
                const rawStatus = liveData.status ? liveData.status.toUpperCase() : "";
                const requiredRoles = liveData.required_roles || [];
                const accessible = liveData.accessible ?? liveData.viewer_has_access ?? (requiredRoles.length === 0);
                const botOnline = liveData.discord_bot_online ?? rawStatus.includes("ONLINE");

                if (["SUB ONLY", "PATREON"].some(k => rawStatus.includes(k))) computedStatus = "SUB ONLY";
                else if (liveData.dodo_code === "GETTIN'" || rawStatus.includes("REFRESH")) computedStatus = "REFRESHING";
                else if (botOnline) computedStatus = "ONLINE";

                return {
                    id: liveData.id || `island-${index}`,
                    name: liveData.name,
                    canonicalName: liveData.canonical_name,
                    type: liveData.type,
                    items: liveData.items || [],
                    theme: toIslandTheme(liveData.theme, "teal"),
                    cat: toIslandCat(liveData.cat, "public"),
                    description: liveData.description || "",
                    seasonal: liveData.seasonal || "Year-Round",
                    status: computedStatus,
                    discordBotOnline: botOnline,
                    dodoCode: liveData.dodo_code,
                    visitors: Math.max(0, Math.min(7, liveData.visitors ?? 0)),
                    mapUrl: liveData.map_url || getIslandMap(liveData.canonical_name || liveData.name),
                    updatedAt: liveData.updated_at,
                    requiredRoles,
                    accessible,
                    viewerHasAccess: accessible,
                    channel_id: liveData.channel_id || liveData.channelId || undefined,
                };
            });


            const now = Date.now();
            setIslands(updatedIslands);
            setVillagersMap(villagerData.islands);
            setLastUpdated(now);
            setLoading(false);

            // Persist to session storage
            sessionStorage.setItem(STORAGE_KEY_ISLANDS, JSON.stringify(updatedIslands));
            sessionStorage.setItem(STORAGE_KEY_VILLAGERS, JSON.stringify(villagerData.islands));
            sessionStorage.setItem(STORAGE_KEY_TIMESTAMP, now.toString());
            sessionStorage.setItem(STORAGE_KEY_AUTH_SCOPE, getCacheAuthScope());

        } catch (error) {
            console.error("Failed to refresh island data:", error);
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refreshData();

        const handleAuthChange = () => {
            // Clear cached scope to force live re-fetch with new token/permissions
            sessionStorage.removeItem(STORAGE_KEY_ISLANDS);
            sessionStorage.removeItem(STORAGE_KEY_TIMESTAMP);
            sessionStorage.removeItem(STORAGE_KEY_AUTH_SCOPE);
            refreshData();
        };

        window.addEventListener("chopaeng_auth_change", handleAuthChange);

        let intervalId: number;

        const startPolling = () => {
            intervalId = window.setInterval(() => {
                if (document.visibilityState === "visible") {
                    refreshData();
                }
            }, 30000); // 30s poll
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                // Fetch immediately when coming back to tab if it's been a while
                const cachedTimestamp = sessionStorage.getItem(STORAGE_KEY_TIMESTAMP);
                const parsedTimestamp = cachedTimestamp ? parseInt(cachedTimestamp, 10) : null;
                const timeSinceLastUpdate = parsedTimestamp && !isNaN(parsedTimestamp)
                    ? Date.now() - parsedTimestamp
                    : Infinity;
                if (timeSinceLastUpdate > 25000) {
                    refreshData();
                }
                startPolling();
            } else {
                clearInterval(intervalId);
            }
        };

        startPolling();
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            clearInterval(intervalId);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            window.removeEventListener("chopaeng_auth_change", handleAuthChange);
        };
    }, [refreshData]);

    return (
        <IslandContext.Provider value={{ islands, villagersMap, loading, lastUpdated, refreshData }}>
            {children}
        </IslandContext.Provider>
    );
};
