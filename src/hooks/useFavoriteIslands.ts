import { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../config/api';
import { getAuthToken } from '../context/authToken';
import { getUserScopedItem, setUserScopedItem } from '../utils/accountStorage';

const FAVORITE_ISLANDS_STORAGE_KEY = 'chopaeng_favorite_islands';

export const getStoredFavoriteIslands = (): string[] => {
    try {
        const saved = getUserScopedItem(FAVORITE_ISLANDS_STORAGE_KEY);
        if (!saved) return [];
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

export const saveStoredFavoriteIslands = (favorites: string[]): void => {
    try {
        setUserScopedItem(FAVORITE_ISLANDS_STORAGE_KEY, JSON.stringify(favorites));
    } catch {
        // Storage write error ignored
    }
    window.dispatchEvent(
        new CustomEvent('chopaeng_favorite_islands_updated', {
            detail: { favorites },
        })
    );
};

const getAuthHeaders = (token?: string | null): Record<string, string> => {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    const authToken = token ?? getAuthToken();
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }
    return headers;
};

/**
 * Fetch favorite islands saved in the database for the authenticated user.
 */
export const fetchFavoriteIslandsFromDb = async (token?: string | null): Promise<string[] | null> => {
    const authToken = token ?? getAuthToken();
    if (!authToken) return null;

    try {
        const res = await fetch(`${API_BASE}/api/profile/favorites`, {
            headers: getAuthHeaders(authToken),
            credentials: 'include',
        });

        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.favorite_islands)) {
                return data.favorite_islands;
            }
            if (Array.isArray(data)) {
                return data;
            }
        }
    } catch {
        // Silent fallback to local storage on network errors
    }

    return null;
};

/**
 * Save favorite island status to the backend database.
 */
export const saveFavoriteIslandToDb = async (
    islandId: string,
    isFavorite: boolean,
    token?: string | null
): Promise<boolean> => {
    const authToken = token ?? getAuthToken();
    if (!authToken) return false;

    try {
        const res = await fetch(`${API_BASE}/api/profile/favorites`, {
            method: 'POST',
            headers: getAuthHeaders(authToken),
            credentials: 'include',
            body: JSON.stringify({
                island_id: islandId.trim().toLowerCase(),
                is_favorite: isFavorite,
            }),
        });

        return res.ok;
    } catch {
        return false;
    }
};

export const useFavoriteIslands = () => {
    const [favoriteIslands, setFavoriteIslands] = useState<string[]>(getStoredFavoriteIslands);
    const [isSyncingDb, setIsSyncingDb] = useState(false);

    const refresh = useCallback(() => {
        setFavoriteIslands(getStoredFavoriteIslands());
    }, []);

    const syncWithChoBot = useCallback((tokenOverride?: string | null) => {
        const token = tokenOverride !== undefined ? tokenOverride : getAuthToken();
        if (!token) {
            setFavoriteIslands(getStoredFavoriteIslands());
            setIsSyncingDb(false);
            return;
        }

        setIsSyncingDb(true);
        fetchFavoriteIslandsFromDb(token).then((dbFavorites) => {
            if (!dbFavorites) return;
            const local = getStoredFavoriteIslands();
            const merged = Array.from(
                new Set([...local, ...dbFavorites.map((id) => id.trim().toLowerCase())])
            );
            saveStoredFavoriteIslands(merged);
            setFavoriteIslands(merged);
        }).finally(() => {
            setIsSyncingDb(false);
        });
    }, []);

    // Initial sync
    useEffect(() => {
        syncWithChoBot();
    }, [syncWithChoBot]);

    useEffect(() => {
        const handleAuthOrAccountChange = () => {
            const token = getAuthToken();
            setFavoriteIslands(getStoredFavoriteIslands());
            if (token) {
                syncWithChoBot(token);
            } else {
                setIsSyncingDb(false);
            }
        };

        window.addEventListener('chopaeng_favorite_islands_updated', refresh);
        window.addEventListener('chopaeng_account_switched', handleAuthOrAccountChange);
        window.addEventListener('chopaeng_auth_change', handleAuthOrAccountChange);
        window.addEventListener('storage', refresh);
        return () => {
            window.removeEventListener('chopaeng_favorite_islands_updated', refresh);
            window.removeEventListener('chopaeng_account_switched', handleAuthOrAccountChange);
            window.removeEventListener('chopaeng_auth_change', handleAuthOrAccountChange);
            window.removeEventListener('storage', refresh);
        };
    }, [refresh, syncWithChoBot]);

    const isFavoriteIsland = useCallback(
        (islandIdOrName: string): boolean => {
            if (!islandIdOrName) return false;
            const normalized = islandIdOrName.trim().toLowerCase();
            return favoriteIslands.some((fav) => fav.trim().toLowerCase() === normalized);
        },
        [favoriteIslands]
    );

    const toggleFavoriteIsland = useCallback(
        (islandIdOrName: string, e?: React.MouseEvent): boolean => {
            if (e) {
                e.stopPropagation();
                e.preventDefault();
            }
            if (!islandIdOrName) return false;

            const current = getStoredFavoriteIslands();
            const normalized = islandIdOrName.trim().toLowerCase();
            const exists = current.some((fav) => fav.trim().toLowerCase() === normalized);

            let updated: string[];
            let added = false;

            if (exists) {
                updated = current.filter((fav) => fav.trim().toLowerCase() !== normalized);
                added = false;
            } else {
                updated = [...current, normalized];
                added = true;
            }

            // 1. Optimistically save to local storage & dispatch event
            saveStoredFavoriteIslands(updated);
            setFavoriteIslands(updated);

            // 2. Persist to backend database if logged in
            const authToken = getAuthToken();
            if (authToken) {
                saveFavoriteIslandToDb(normalized, added, authToken);
            }

            return added;
        },
        []
    );

    return {
        favoriteIslands,
        isFavoriteIsland,
        toggleFavoriteIsland,
        favoriteCount: favoriteIslands.length,
        isSyncingDb,
    };
};
