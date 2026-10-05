import { useState, useEffect, useCallback } from 'react';
import { parseDiscordNicknameToCharacters } from '../utils/characterParser';
import { API_BASE } from '../config/api';
import { getAuthToken } from '../context/authToken';
import { getActiveUserId, getUserScopedItem, setUserScopedItem } from '../utils/accountStorage';

export interface SavedCharacter {
    id: string;
    ign: string; // In-Game Name
    islandName: string; // Island Name
    title?: string; // e.g. "Island Representative", "Island Resident"
    icon?: string; // Icon identifier e.g. "fa-user", "fa-crown", "fa-leaf"
    isDefault?: boolean;
    createdAt?: string;
    source?: 'discord' | 'custom';
}

const STORAGE_KEY = 'chopaeng_saved_characters_v1';
export const MAX_CHARACTER_SLOTS = 3;

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

export const getStoredCharacters = (userId?: string | null): SavedCharacter[] => {
    try {
        const saved = getUserScopedItem(STORAGE_KEY, userId);
        if (!saved) return [];
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
        }
        return [];
    } catch {
        return [];
    }
};

/**
 * Persists characters to local storage and updates reactive listeners.
 */
export const saveStoredCharacters = (characters: SavedCharacter[], userId?: string | null): void => {
    try {
        setUserScopedItem(STORAGE_KEY, JSON.stringify(characters), userId);
    } catch {
        // Storage write error ignored
    }
    window.dispatchEvent(
        new CustomEvent('chopaeng_characters_updated', {
            detail: { characters, userId: userId || getActiveUserId() },
        })
    );
};

/**
 * Sync characters to database backend.
 */
export const saveCharactersToDb = async (
    characters: SavedCharacter[],
    token?: string | null
): Promise<boolean> => {
    const authToken = token ?? getAuthToken();
    if (!authToken) return false;

    try {
        const res = await fetch(`${API_BASE}/api/user/characters`, {
            method: 'POST',
            headers: getAuthHeaders(authToken),
            credentials: 'include',
            body: JSON.stringify({ characters }),
        });

        if (!res.ok) {
            // Also try profile fallback endpoint if /api/user/characters is mapped there
            await fetch(`${API_BASE}/api/profile/characters`, {
                method: 'POST',
                headers: getAuthHeaders(authToken),
                credentials: 'include',
                body: JSON.stringify({ characters }),
            }).catch(() => {});
        }

        return res.ok;
    } catch {
        return false;
    }
};

/**
 * Fetch characters from backend database.
 */
export const fetchCharactersFromDb = async (token?: string | null): Promise<SavedCharacter[] | null> => {
    const authToken = token ?? getAuthToken();
    if (!authToken) return null;

    try {
        const res = await fetch(`${API_BASE}/api/user/characters`, {
            headers: getAuthHeaders(authToken),
            credentials: 'include',
        });

        if (res.ok) {
            const data = await res.json();
            const list = Array.isArray(data.characters) ? data.characters : (Array.isArray(data) ? data : null);
            if (list && list.length > 0) {
                return list;
            }
        }
    } catch {
        // Fallback to local storage on network errors
    }

    return null;
};

export const useSavedCharacters = (rawDiscordName?: string | null) => {
    const [characters, setCharacters] = useState<SavedCharacter[]>(() => getStoredCharacters(getActiveUserId()));
    const [isSyncingDb, setIsSyncingDb] = useState(false);
    const maxSlots = MAX_CHARACTER_SLOTS;

    const refresh = useCallback(() => {
        setCharacters(getStoredCharacters(getActiveUserId()));
    }, []);

    useEffect(() => {
        refresh();
    }, [rawDiscordName, refresh]);

    const syncCharactersWithDb = useCallback((tokenOverride?: string | null) => {
        const token = tokenOverride !== undefined ? tokenOverride : getAuthToken();
        const currentUid = getActiveUserId();
        if (!token || !currentUid) {
            setCharacters(getStoredCharacters(currentUid));
            setIsSyncingDb(false);
            return;
        }

        setIsSyncingDb(true);
        fetchCharactersFromDb(token).then((dbChars) => {
            const uid = getActiveUserId();
            if (dbChars && dbChars.length > 0) {
                saveStoredCharacters(dbChars, uid);
                setCharacters(dbChars);
            } else {
                const current = getStoredCharacters(uid);
                if (current.length === 0 && rawDiscordName) {
                    const parsed = parseDiscordNicknameToCharacters(rawDiscordName);
                    if (parsed.length > 0) {
                        const initialChars: SavedCharacter[] = parsed.slice(0, maxSlots).map((p, idx) => ({
                            id: `char_dc_${Date.now()}_${idx}`,
                            ign: p.ign,
                            islandName: p.islandName,
                            icon: idx === 0 ? 'fa-crown' : 'fa-leaf',
                            isDefault: idx === 0,
                            createdAt: new Date().toISOString(),
                            source: 'discord',
                        }));
                        saveStoredCharacters(initialChars, uid);
                        setCharacters(initialChars);
                        saveCharactersToDb(initialChars, token).catch(() => {});
                    }
                }
            }
        }).finally(() => {
            setIsSyncingDb(false);
        });
    }, [rawDiscordName, maxSlots]);

    // Initial load and sync
    useEffect(() => {
        syncCharactersWithDb();
    }, [syncCharactersWithDb]);

    useEffect(() => {
        const handleAuthOrAccountChange = () => {
            const token = getAuthToken();
            setCharacters(getStoredCharacters(getActiveUserId()));
            if (token) {
                syncCharactersWithDb(token);
            } else {
                setIsSyncingDb(false);
            }
        };

        window.addEventListener('chopaeng_characters_updated', refresh);
        window.addEventListener('chopaeng_account_switched', handleAuthOrAccountChange);
        window.addEventListener('chopaeng_auth_change', handleAuthOrAccountChange);
        window.addEventListener('storage', refresh);
        return () => {
            window.removeEventListener('chopaeng_characters_updated', refresh);
            window.removeEventListener('chopaeng_account_switched', handleAuthOrAccountChange);
            window.removeEventListener('chopaeng_auth_change', handleAuthOrAccountChange);
            window.removeEventListener('storage', refresh);
        };
    }, [refresh, syncCharactersWithDb]);

    // Automatically sync from Discord Nickname on first load if no custom characters exist for this user
    useEffect(() => {
        if (!rawDiscordName) return;
        const currentUid = getActiveUserId();
        const current = getStoredCharacters(currentUid);
        // If empty or never set for this user, parse from Discord Nickname
        if (current.length === 0) {
            const parsed = parseDiscordNicknameToCharacters(rawDiscordName);
            if (parsed.length > 0) {
                const initialChars: SavedCharacter[] = parsed.slice(0, maxSlots).map((p, idx) => ({
                    id: `char_dc_${Date.now()}_${idx}`,
                    ign: p.ign,
                    islandName: p.islandName,
                    icon: idx === 0 ? 'fa-crown' : 'fa-leaf',
                    isDefault: idx === 0,
                    createdAt: new Date().toISOString(),
                    source: 'discord',
                }));
                saveStoredCharacters(initialChars, currentUid);
                setCharacters(initialChars);
                saveCharactersToDb(initialChars).catch(() => {});
            }
        }
    }, [rawDiscordName, maxSlots]);

    // Active character fallback
    const activeCharacter: SavedCharacter = characters.find((c) => c.isDefault) ||
        characters[0] || {
            id: 'char_default',
            ign: rawDiscordName ? parseDiscordNicknameToCharacters(rawDiscordName)[0]?.ign || rawDiscordName : 'Resident',
            islandName: rawDiscordName ? parseDiscordNicknameToCharacters(rawDiscordName)[0]?.islandName || 'Island' : 'Island',
            icon: 'fa-leaf',
            isDefault: true,
        };

    const addCharacter = useCallback(
        (ign: string, islandName: string, icon = 'fa-leaf'): boolean => {
            const uid = getActiveUserId();
            const current = getStoredCharacters(uid);
            if (current.length >= maxSlots) {
                return false;
            }

            const newChar: SavedCharacter = {
                id: `char_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                ign: ign.trim(),
                islandName: islandName.trim(),
                icon,
                isDefault: current.length === 0,
                createdAt: new Date().toISOString(),
                source: 'custom',
            };

            const updated = [...current, newChar];
            saveStoredCharacters(updated, uid);
            setCharacters(updated);
            setIsSyncingDb(true);
            saveCharactersToDb(updated)
                .catch(() => {})
                .finally(() => setIsSyncingDb(false));
            return true;
        },
        [maxSlots]
    );

    const updateCharacter = useCallback(
        (id: string, updates: Partial<Omit<SavedCharacter, 'id'>>): boolean => {
            const uid = getActiveUserId();
            const current = getStoredCharacters(uid);
            const index = current.findIndex((c) => c.id === id);
            if (index === -1) return false;

            const updated = [...current];
            updated[index] = { ...updated[index], ...updates };
            saveStoredCharacters(updated, uid);
            setCharacters(updated);
            setIsSyncingDb(true);
            saveCharactersToDb(updated)
                .catch(() => {})
                .finally(() => setIsSyncingDb(false));
            return true;
        },
        []
    );

    const deleteCharacter = useCallback((id: string): boolean => {
        const uid = getActiveUserId();
        const current = getStoredCharacters(uid);
        if (current.length <= 1) {
            return false; // Keep at least one character
        }

        const filtered = current.filter((c) => c.id !== id);
        if (!filtered.some((c) => c.isDefault)) {
            filtered[0].isDefault = true;
        }

        saveStoredCharacters(filtered, uid);
        setCharacters(filtered);
        setIsSyncingDb(true);
        saveCharactersToDb(filtered)
            .catch(() => {})
            .finally(() => setIsSyncingDb(false));
        return true;
    }, []);

    const setDefaultCharacter = useCallback((id: string): boolean => {
        const uid = getActiveUserId();
        const current = getStoredCharacters(uid);
        const updated = current.map((c) => ({
            ...c,
            isDefault: c.id === id,
        }));
        saveStoredCharacters(updated, uid);
        setCharacters(updated);
        setIsSyncingDb(true);
        saveCharactersToDb(updated)
            .catch(() => {})
            .finally(() => setIsSyncingDb(false));
        return true;
    }, []);

    /**
     * 1-Click Sync from Discord server nickname (e.g. "bitress/cheurnice | bitress")
     */
    const syncFromDiscordNickname = useCallback(
        (nameToParse: string): number => {
            if (!nameToParse || !nameToParse.trim()) return 0;
            const parsed = parseDiscordNicknameToCharacters(nameToParse);
            if (parsed.length === 0) return 0;

            const uid = getActiveUserId();
            const synced: SavedCharacter[] = parsed.slice(0, maxSlots).map((p, idx) => ({
                id: `char_sync_${Date.now()}_${idx}`,
                ign: p.ign,
                islandName: p.islandName,
                icon: idx === 0 ? 'fa-crown' : 'fa-leaf',
                isDefault: idx === 0,
                createdAt: new Date().toISOString(),
                source: 'discord',
            }));

            saveStoredCharacters(synced, uid);
            setCharacters(synced);
            return synced.length;
        },
        [maxSlots]
    );

    return {
        characters,
        activeCharacter,
        maxSlots,
        remainingSlots: Math.max(0, maxSlots - characters.length),
        isSyncingDb,
        addCharacter,
        updateCharacter,
        deleteCharacter,
        setDefaultCharacter,
        syncFromDiscordNickname,
        syncWithDb: async () => {
            setIsSyncingDb(true);
            try {
                const res = await saveCharactersToDb(characters);
                return res;
            } finally {
                setIsSyncingDb(false);
            }
        },
    };
};

