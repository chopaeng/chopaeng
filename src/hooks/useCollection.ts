import { useState, useEffect, useCallback } from 'react';
import { getUserScopedItem, setUserScopedItem, getActiveUserId } from '../utils/accountStorage';
import { getAuthToken } from '../context/authToken';
import { API_BASE } from '../config/api';

const COLLECTION_STORAGE_KEY = 'chopaeng_collection';

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

export const getStoredCollection = (): string[] => {
    try {
        const saved = getUserScopedItem(COLLECTION_STORAGE_KEY);
        if (!saved) return [];
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

export const saveStoredCollection = (collection: string[]): void => {
    try {
        setUserScopedItem(COLLECTION_STORAGE_KEY, JSON.stringify(collection));
    } catch {
        // Storage write failed
    }
    window.dispatchEvent(new CustomEvent('chopaeng_collection_updated', { detail: { collection } }));
};

/**
 * Fetch collection from ChoBot database for the authenticated user
 */
export const fetchCollectionFromDb = async (token?: string | null): Promise<string[] | null> => {
    const authToken = token ?? getAuthToken();
    if (!authToken) return null;

    try {
        const res = await fetch(`${API_BASE}/api/user/collection`, {
            headers: getAuthHeaders(authToken),
            credentials: 'include',
        });
        if (res.ok) {
            const data = await res.json();
            const list = data.collection || data.items;
            if (Array.isArray(list)) {
                return list;
            }
        }
    } catch {
        // Fallback to local storage on network errors
    }
    return null;
};

/**
 * Save collection batch to ChoBot database
 */
export const saveCollectionToDb = async (
    collection: string[],
    token?: string | null
): Promise<boolean> => {
    const authToken = token ?? getAuthToken();
    if (!authToken) return false;

    try {
        const res = await fetch(`${API_BASE}/api/user/collection`, {
            method: 'POST',
            headers: getAuthHeaders(authToken),
            credentials: 'include',
            body: JSON.stringify({ collection }),
        });
        return res.ok;
    } catch {
        return false;
    }
};

/**
 * Toggle single item in ChoBot database
 */
export const toggleCollectionItemInDb = async (
    itemId: string,
    collected: boolean,
    token?: string | null
): Promise<boolean> => {
    const authToken = token ?? getAuthToken();
    if (!authToken) return false;

    try {
        const res = await fetch(`${API_BASE}/api/user/collection`, {
            method: 'POST',
            headers: getAuthHeaders(authToken),
            credentials: 'include',
            body: JSON.stringify({ itemId, collected }),
        });
        return res.ok;
    } catch {
        return false;
    }
};

export const useCollection = () => {
    const [collection, setCollection] = useState<string[]>(getStoredCollection);
    const [isSyncingDb, setIsSyncingDb] = useState(false);

    const refresh = useCallback(() => {
        setCollection(getStoredCollection());
    }, []);

    const syncWithChoBot = useCallback((tokenOverride?: string | null) => {
        const token = tokenOverride !== undefined ? tokenOverride : getAuthToken();
        if (!token) {
            setCollection(getStoredCollection());
            setIsSyncingDb(false);
            return;
        }
        setIsSyncingDb(true);
        fetchCollectionFromDb(token)
            .then((dbItems) => {
                if (!dbItems) return;
                const local = getStoredCollection();
                const merged = Array.from(new Set([...local, ...dbItems]));
                saveStoredCollection(merged);
                setCollection(merged);
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
            setCollection(getStoredCollection());
            if (token) {
                syncWithChoBot(token);
            } else {
                setIsSyncingDb(false);
            }
        };

        window.addEventListener('chopaeng_collection_updated', refresh);
        window.addEventListener('chopaeng_account_switched', handleAuthOrAccountChange);
        window.addEventListener('chopaeng_auth_change', handleAuthOrAccountChange);
        window.addEventListener('storage', refresh);
        return () => {
            window.removeEventListener('chopaeng_collection_updated', refresh);
            window.removeEventListener('chopaeng_account_switched', handleAuthOrAccountChange);
            window.removeEventListener('chopaeng_auth_change', handleAuthOrAccountChange);
            window.removeEventListener('storage', refresh);
        };
    }, [refresh, syncWithChoBot]);

    const isCollected = useCallback((id: string): boolean => {
        if (!id) return false;
        return collection.includes(id);
    }, [collection]);

    const toggleCollected = useCallback((id: string, e?: React.MouseEvent): boolean => {
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
                        action: 'Collection',
                        message: 'You must log in with Discord to add items to your collection and save them to your ChoBot account.',
                        returnPath: window.location.pathname + window.location.search,
                    },
                })
            );
            return false;
        }

        const current = getStoredCollection();
        let updated: string[];
        let added = false;

        if (current.includes(id)) {
            updated = current.filter((cid) => cid !== id);
            added = false;
        } else {
            updated = [id, ...current];
            added = true;
        }

        // 1. Save locally
        saveStoredCollection(updated);
        setCollection(updated);

        // 2. Persist to ChoBot database
        toggleCollectionItemInDb(id, added, token).catch(() => {});

        return added;
    }, []);

    const clearCollection = useCallback(() => {
        const token = getAuthToken();
        saveStoredCollection([]);
        setCollection([]);
        if (token) {
            saveCollectionToDb([], token).catch(() => {});
        }
    }, []);

    const exportCollection = useCallback((): string => {
        return JSON.stringify(getStoredCollection());
    }, []);

    const importCollection = useCallback((json: string): boolean => {
        try {
            const parsed = JSON.parse(json);
            if (!Array.isArray(parsed)) return false;
            const validIds = parsed.filter((id: unknown) => typeof id === 'string');
            saveStoredCollection(validIds);
            setCollection(validIds);
            const token = getAuthToken();
            if (token) {
                saveCollectionToDb(validIds, token).catch(() => {});
            }
            return true;
        } catch {
            return false;
        }
    }, []);

    return {
        collection,
        collectedCount: collection.length,
        isCollected,
        toggleCollected,
        clearCollection,
        exportCollection,
        importCollection,
        isSyncingDb,
    };
};
