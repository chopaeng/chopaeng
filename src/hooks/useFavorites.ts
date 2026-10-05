import { useState, useEffect, useCallback } from 'react';
import { getUserScopedItem, setUserScopedItem, getActiveUserId } from '../utils/accountStorage';
import { getAuthToken } from '../context/authToken';
import { API_BASE } from '../config/api';

const FAVORITES_STORAGE_KEY = 'chopaeng_item_favorites';

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

export const getStoredFavorites = (): string[] => {
    try {
        const saved = getUserScopedItem(FAVORITES_STORAGE_KEY);
        if (!saved) return [];
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

export const saveStoredFavorites = (favorites: string[]): void => {
    try {
        setUserScopedItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
    } catch {
        // Storage write failed
    }
    window.dispatchEvent(new CustomEvent('chopaeng_favorites_updated', { detail: { favorites } }));
};

/**
 * Fetch wishlist from ChoBot database for the authenticated user
 */
export const fetchWishlistFromDb = async (token?: string | null): Promise<string[] | null> => {
    const authToken = token ?? getAuthToken();
    if (!authToken) return null;

    const endpoints = [
        `${API_BASE}/api/user/wishlist`,
        `${API_BASE}/api/user/item-favorites`,
        `${API_BASE}/api/profile/wishlist`,
    ];

    for (const ep of endpoints) {
        try {
            const res = await fetch(ep, {
                headers: getAuthHeaders(authToken),
                credentials: 'include',
            });
            if (res.ok) {
                const data = await res.json();
                const list = data.wishlist || data.favorites || data.items;
                if (Array.isArray(list)) {
                    return list;
                }
            }
        } catch {
            // try next endpoint
        }
    }
    return null;
};

/**
 * Save wishlist batch to ChoBot database
 */
export const saveWishlistToDb = async (
    wishlist: string[],
    token?: string | null
): Promise<boolean> => {
    const authToken = token ?? getAuthToken();
    if (!authToken) return false;

    try {
        const res = await fetch(`${API_BASE}/api/user/wishlist`, {
            method: 'POST',
            headers: getAuthHeaders(authToken),
            credentials: 'include',
            body: JSON.stringify({ wishlist }),
        });
        return res.ok;
    } catch {
        return false;
    }
};

/**
 * Toggle single item in ChoBot database
 */
export const toggleWishlistItemInDb = async (
    itemId: string,
    isFavorite: boolean,
    token?: string | null
): Promise<boolean> => {
    const authToken = token ?? getAuthToken();
    if (!authToken) return false;

    try {
        const res = await fetch(`${API_BASE}/api/user/wishlist`, {
            method: 'POST',
            headers: getAuthHeaders(authToken),
            credentials: 'include',
            body: JSON.stringify({ itemId, isFavorite }),
        });
        return res.ok;
    } catch {
        return false;
    }
};

export const useFavorites = () => {
    const [favorites, setFavoritesState] = useState<string[]>(getStoredFavorites);
    const [isSyncingDb, setIsSyncingDb] = useState(false);

    const refresh = useCallback(() => {
        setFavoritesState(getStoredFavorites());
    }, []);

    const syncWithChoBot = useCallback((tokenOverride?: string | null) => {
        const token = tokenOverride !== undefined ? tokenOverride : getAuthToken();
        if (!token) {
            setFavoritesState(getStoredFavorites());
            setIsSyncingDb(false);
            return;
        }
        setIsSyncingDb(true);
        fetchWishlistFromDb(token)
            .then((dbItems) => {
                if (!dbItems) return;
                const local = getStoredFavorites();
                const merged = Array.from(new Set([...local, ...dbItems]));
                saveStoredFavorites(merged);
                setFavoritesState(merged);
            })
            .finally(() => {
                setIsSyncingDb(false);
            });
    }, []);

    // Sync from ChoBot on mount
    useEffect(() => {
        syncWithChoBot();
    }, [syncWithChoBot]);

    useEffect(() => {
        const handleAuthOrAccountChange = () => {
            const token = getAuthToken();
            setFavoritesState(getStoredFavorites());
            if (token) {
                syncWithChoBot(token);
            } else {
                setIsSyncingDb(false);
            }
        };

        window.addEventListener('chopaeng_favorites_updated', refresh);
        window.addEventListener('chopaeng_account_switched', handleAuthOrAccountChange);
        window.addEventListener('chopaeng_auth_change', handleAuthOrAccountChange);
        window.addEventListener('storage', refresh);
        return () => {
            window.removeEventListener('chopaeng_favorites_updated', refresh);
            window.removeEventListener('chopaeng_account_switched', handleAuthOrAccountChange);
            window.removeEventListener('chopaeng_auth_change', handleAuthOrAccountChange);
            window.removeEventListener('storage', refresh);
        };
    }, [refresh, syncWithChoBot]);

    const isFavorite = useCallback((id: string): boolean => {
        if (!id) return false;
        return favorites.includes(id);
    }, [favorites]);

    const toggleFavorite = useCallback((id: string, e?: React.MouseEvent): boolean => {
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }
        if (!id) return false;

        const token = getAuthToken();
        const activeUid = getActiveUserId();

        // Authentication requirement check
        if (!token || !activeUid) {
            window.dispatchEvent(
                new CustomEvent('chopaeng_auth_required', {
                    detail: {
                        action: 'Wishlist',
                        message: 'You must log in with Discord to add items to your wishlist and save them to your ChoBot account.',
                        returnPath: window.location.pathname + window.location.search,
                    },
                })
            );
            return false;
        }

        const current = getStoredFavorites();
        let updated: string[];
        let added = false;

        if (current.includes(id)) {
            updated = current.filter((favId) => favId !== id);
            added = false;
        } else {
            updated = [id, ...current];
            added = true;
        }

        // 1. Save locally
        saveStoredFavorites(updated);
        setFavoritesState(updated);

        // 2. Persist to ChoBot database
        toggleWishlistItemInDb(id, added, token).catch(() => {});

        return added;
    }, []);

    const clearFavorites = useCallback(() => {
        const token = getAuthToken();
        saveStoredFavorites([]);
        setFavoritesState([]);
        if (token) {
            saveWishlistToDb([], token).catch(() => {});
        }
    }, []);

    const replaceFavorites = useCallback((ids: string[]) => {
        const valid = ids.filter(id => typeof id === 'string' && id.length > 0);
        saveStoredFavorites(valid);
        setFavoritesState(valid);
        const token = getAuthToken();
        if (token) {
            saveWishlistToDb(valid, token).catch(() => {});
        }
    }, []);

    return {
        favorites,
        favoriteCount: favorites.length,
        isFavorite,
        toggleFavorite,
        clearFavorites,
        setFavorites: replaceFavorites,
        isSyncingDb,
    };
};
