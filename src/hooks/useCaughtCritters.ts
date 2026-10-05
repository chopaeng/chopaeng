import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useHemisphere } from './useHemisphere';
import { getUserScopedItem, setUserScopedItem, getActiveUserId } from '../utils/accountStorage';
import { getAuthToken } from '../context/authToken';
import { API_BASE } from '../config/api';

export interface CreatureItem {
    id: string;
    name: string;
    icon: string;
    sell: number;
    whereHow: string;
    weather: string;
    size: string;
    shadow?: string;
    category: 'Fish' | 'Bugs' | 'Sea Creatures' | string;
    catchPhrase?: string;
    months: number[];
    hours: number[];
    monthsLabel?: string[];
    timeLabel?: string[];
}

const FALLBACK_IMAGE = 'https://acnhcdn.com/latest/FtrIcon/FtrLeaf.png';

const toTitleCase = (str: string): string =>
    str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

export const useCaughtCritters = () => {
    const { hemisphere, isNorth, isSouth, toggleHemisphere, setHemisphere } = useHemisphere();
    const [creatures, setCreatures] = useState<CreatureItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [dbSyncing, setDbSyncing] = useState(false);
    const [dbSynced, setDbSynced] = useState(false);
    const abortRef = useRef<AbortController | null>(null);

    const getLocalCaught = useCallback((targetHemi?: string): Set<string> => {
        const hemi = targetHemi || hemisphere;
        const key = `chopaeng_caught_critters_${hemi}`;
        try {
            const raw = getUserScopedItem(key);
            return raw ? new Set<string>(JSON.parse(raw)) : new Set<string>();
        } catch {
            return new Set<string>();
        }
    }, [hemisphere]);

    const [caughtNames, setCaughtNames] = useState<Set<string>>(() => getLocalCaught());

    // Load creatures dataset
    useEffect(() => {
        let mounted = true;
        const load = async () => {
            setLoading(true);
            try {
                const creaturesMod = await import('@bitress/animal-crossing/lib/data/Creatures.json');
                const rawCreatures = (creaturesMod.default || creaturesMod) as any[];
                if (!mounted || !Array.isArray(rawCreatures)) return;

                const mapped: CreatureItem[] = rawCreatures.map((c: any) => {
                    const hemiData = hemisphere === 'north' ? c.hemispheres?.north : c.hemispheres?.south;
                    const cat = c.sourceSheet === 'Insects' ? 'Bugs' : (c.sourceSheet || 'Creatures');
                    const title = toTitleCase(c.name);

                    return {
                        id: `critter_${c.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
                        name: title,
                        icon: c.iconImage || c.critterpediaImage || c.furnitureImage || FALLBACK_IMAGE,
                        sell: c.sell ?? 0,
                        whereHow: c.whereHow || 'Unknown',
                        weather: c.weather || 'Any',
                        size: c.size || '',
                        shadow: c.shadow || undefined,
                        category: cat,
                        catchPhrase: c.catchPhrase?.[0] || '',
                        months: hemiData?.monthsArray || [],
                        hours: hemiData?.timeArray || [],
                        monthsLabel: hemiData?.months || [],
                        timeLabel: hemiData?.time || [],
                    };
                });

                if (mounted) setCreatures(mapped);
            } catch (err) {
                console.error('Failed to load creature data:', err);
            } finally {
                if (mounted) setLoading(false);
            }
        };
        load();
        return () => { mounted = false; };
    }, [hemisphere]);

    // Sync from ChoBot backend
    const syncWithChoBot = useCallback((targetHemi: string, tokenOverride?: string | null) => {
        if (abortRef.current) {
            abortRef.current.abort();
        }

        const currentKey = `chopaeng_caught_critters_${targetHemi}`;
        const local = getLocalCaught(targetHemi);
        setCaughtNames(local);

        const token = tokenOverride !== undefined ? tokenOverride : getAuthToken();
        const userId = getActiveUserId();
        if (!token || !userId) {
            setDbSyncing(false);
            setDbSynced(false);
            return;
        }

        const controller = new AbortController();
        abortRef.current = controller;
        setDbSyncing(true);

        fetch(`${API_BASE}/api/user/critters?hemisphere=${encodeURIComponent(targetHemi)}`, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            signal: controller.signal
        })
            .then(res => res.json())
            .then(data => {
                if (controller.signal.aborted) return;
                if (data && data.ok && Array.isArray(data.critters)) {
                    const serverSet = new Set<string>(data.critters.map((c: any) => c.critter_name));
                    setCaughtNames(prev => {
                        const merged = new Set<string>([...prev, ...serverSet]);
                        try {
                            setUserScopedItem(currentKey, JSON.stringify([...merged]));
                        } catch { /* ignore */ }
                        return merged;
                    });
                    setDbSynced(true);
                }
            })
            .catch(err => {
                if (err.name !== 'AbortError') {
                    console.warn('Failed to sync critters from ChoBot:', err);
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) {
                    setDbSyncing(false);
                }
            });
    }, [getLocalCaught]);

    // Sync on hemisphere switch
    useEffect(() => {
        syncWithChoBot(hemisphere);
        return () => {
            if (abortRef.current) abortRef.current.abort();
        };
    }, [hemisphere, syncWithChoBot]);

    // Re-sync on auth change, account switch, or cross-tab/cross-component update
    useEffect(() => {
        const handleAuthOrAccountChange = () => {
            syncWithChoBot(hemisphere);
        };
        const handleExternalUpdate = (e: any) => {
            if (e.detail?.hemisphere === hemisphere && e.detail?.caught) {
                setCaughtNames(new Set(e.detail.caught));
            } else {
                setCaughtNames(getLocalCaught(hemisphere));
            }
        };

        window.addEventListener('chopaeng_auth_change', handleAuthOrAccountChange);
        window.addEventListener('chopaeng_account_switched', handleAuthOrAccountChange);
        window.addEventListener('chopaeng_caught_critters_updated', handleExternalUpdate);
        return () => {
            window.removeEventListener('chopaeng_auth_change', handleAuthOrAccountChange);
            window.removeEventListener('chopaeng_account_switched', handleAuthOrAccountChange);
            window.removeEventListener('chopaeng_caught_critters_updated', handleExternalUpdate);
        };
    }, [hemisphere, syncWithChoBot, getLocalCaught]);

    const isCaught = useCallback((name: string): boolean => {
        return caughtNames.has(name);
    }, [caughtNames]);

    const toggleCaught = useCallback((name: string): boolean => {
        const token = getAuthToken();
        const userId = getActiveUserId();
        if (!token || !userId) {
            window.dispatchEvent(new CustomEvent('chopaeng_auth_required', {
                detail: {
                    action: 'Critterpedia',
                    message: 'You must log in with Discord to mark critters as caught and sync your progress to your ChoBot account.',
                    returnPath: window.location.pathname + window.location.search
                }
            }));
            return false;
        }

        const isCurrentlyCaught = caughtNames.has(name);
        const willBeCaught = !isCurrentlyCaught;

        const next = new Set(caughtNames);
        if (willBeCaught) next.add(name);
        else next.delete(name);

        setCaughtNames(next);
        const currentKey = `chopaeng_caught_critters_${hemisphere}`;
        try {
            setUserScopedItem(currentKey, JSON.stringify([...next]));
        } catch { /* ignore */ }

        // Broadcast to other components
        window.dispatchEvent(new CustomEvent('chopaeng_caught_critters_updated', {
            detail: { hemisphere, caught: [...next] }
        }));

        // Persist to ChoBot
        fetch(`${API_BASE}/api/user/critters`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                critter_name: name,
                hemisphere,
                caught: willBeCaught
            })
        }).then(res => res.json())
            .then(data => {
                if (data && data.ok) {
                    setDbSynced(true);
                }
            })
            .catch(err => {
                console.error('Failed to update critter in ChoBot:', err);
            });

        return willBeCaught;
    }, [caughtNames, hemisphere]);

    // Breakdown stats
    const stats = useMemo(() => {
        const fishItems = creatures.filter(c => c.category === 'Fish');
        const bugItems = creatures.filter(c => c.category === 'Bugs' || c.category === 'Insects');
        const seaItems = creatures.filter(c => c.category === 'Sea Creatures');

        const fishCaught = fishItems.filter(c => caughtNames.has(c.name)).length;
        const bugsCaught = bugItems.filter(c => caughtNames.has(c.name)).length;
        const seaCaught = seaItems.filter(c => caughtNames.has(c.name)).length;

        const totalCaught = caughtNames.size;
        const totalCount = creatures.length || 200;
        const overallPercentage = totalCount > 0 ? (totalCaught / totalCount) * 100 : 0;

        const currentMonth = new Date().getMonth() + 1;
        const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
        const leavingThisMonth = creatures.filter(c =>
            !caughtNames.has(c.name) &&
            Array.isArray(c.months) &&
            c.months.includes(currentMonth) &&
            !c.months.includes(nextMonth)
        );

        return {
            overallPercentage,
            totalCaught,
            totalCount,
            leavingThisMonthCount: leavingThisMonth.length,
            leavingThisMonth,
            fish: {
                caught: fishCaught,
                total: fishItems.length || 80,
                percentage: fishItems.length > 0 ? (fishCaught / fishItems.length) * 100 : 0,
                items: fishItems,
            },
            bugs: {
                caught: bugsCaught,
                total: bugItems.length || 80,
                percentage: bugItems.length > 0 ? (bugsCaught / bugItems.length) * 100 : 0,
                items: bugItems,
            },
            sea: {
                caught: seaCaught,
                total: seaItems.length || 40,
                percentage: seaItems.length > 0 ? (seaCaught / seaItems.length) * 100 : 0,
                items: seaItems,
            },
        };
    }, [creatures, caughtNames]);

    return {
        creatures,
        loading,
        hemisphere,
        isNorth,
        isSouth,
        setHemisphere,
        toggleHemisphere,
        caughtNames,
        caughtCount: caughtNames.size,
        isCaught,
        toggleCaught,
        dbSyncing,
        dbSynced,
        stats,
    };
};
