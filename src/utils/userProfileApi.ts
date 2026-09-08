import { getAuthToken } from '../context/authToken';
import { DODO_API_BASE } from '../config/api';
import { getUserScopedItem, setUserScopedItem } from './accountStorage';

export interface PublicPassportData {
    username: string;
    isPublic: boolean;
    showCharacterAndIsland: boolean;
    pronouns: string;
    birthDay: string; // '1' - '31'
    birthMonth: string; // 'January' - 'December'
    nativeFruit: 'Apple' | 'Cherry' | 'Orange' | 'Peach' | 'Pear' | 'Coconut';
    favouriteColour: string;
    favouriteSong: string;
    country: string;
    language: string;
    personality: 'Lazy' | 'Jock' | 'Cranky' | 'Smug' | 'Normal' | 'Peppy' | 'Snooty' | 'Big Sister';
    hobbies: string;
    favouriteShowsFilms: string;
    aboutYou: string; // Max 160 chars
    favouriteVillagers: string[]; // up to 10 villager names
    passportSkin?: string; // 'nook' | 'celeste' | 'sakura' | 'sunset' | 'ocean' | 'midnight' | 'golden'
    passportPattern?: string; // 'dots' | 'leaves' | 'stars' | 'waves' | 'grid' | 'none'
    featuredItems?: string[]; // up to 3 catalog item names
    primaryIgn?: string;
    primaryIsland?: string;
    avatarUrl?: string;
    updatedAt?: number;
}

const STORAGE_KEY = 'chopaeng_public_profile_v1';

export const DEFAULT_PASSPORT_DATA: PublicPassportData = {
    username: '',
    isPublic: false,
    showCharacterAndIsland: true,
    pronouns: '',
    birthDay: '1',
    birthMonth: 'January',
    nativeFruit: 'Apple',
    favouriteColour: '#37b06d',
    favouriteSong: 'K.K. Cruisin\'',
    country: 'Island Paradise',
    language: 'English',
    personality: 'Normal',
    hobbies: 'Fashion, Gardening & Stargazing',
    favouriteShowsFilms: '',
    aboutYou: 'Living my best island life in Animal Crossing: New Horizons!',
    favouriteVillagers: ['Raymond', 'Shino', 'Marshal'],
    passportSkin: 'nook',
    passportPattern: 'dots',
    featuredItems: [],
    updatedAt: Date.now(),
};

export const cleanPassportUsername = (raw?: string | null, fallback = ''): string => {
    if (!raw) return fallback;
    const trimmed = String(raw).trim();
    // If it contains characters typical of Discord server nicknames (e.g. slashes, pipes, backslashes, spaces)
    if (/[/|\\ ]/.test(trimmed)) {
        return fallback;
    }
    // Clean to valid URL handle characters: lowercase alphanumeric, hyphens, underscores
    const sanitized = trimmed.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32);
    return sanitized || fallback;
};

export const parsePassportVibeMeta = (rawStr?: string) => {
    if (!rawStr) return null;
    const match = rawStr.match(/\[vibe:([^\]]+)\]/);
    if (!match) return null;
    try {
        const params = new URLSearchParams(match[1].replace(/;/g, '&'));
        const skin = params.get('skin') || undefined;
        const pattern = params.get('pat') || undefined;
        const itemsStr = params.get('items');
        const featuredItems = itemsStr ? itemsStr.split(',').filter(Boolean) : undefined;
        return { skin, pattern, featuredItems };
    } catch {
        return null;
    }
};

export const stripPassportVibeMeta = (rawStr?: string): string => {
    if (!rawStr) return '';
    return rawStr.replace(/\s*\[vibe:[^\]]+\]\s*/g, '').trim();
};

export const injectPassportVibeMeta = (
    baseStr: string,
    skin?: string,
    pattern?: string,
    featuredItems?: string[]
): string => {
    const clean = stripPassportVibeMeta(baseStr);
    const params = new URLSearchParams();
    if (skin && skin !== 'nook') params.set('skin', skin);
    if (pattern && pattern !== 'dots') params.set('pat', pattern);
    if (featuredItems && featuredItems.length > 0) params.set('items', featuredItems.join(','));
    const paramStr = params.toString().replace(/&/g, ';');
    if (!paramStr) return clean;
    const tag = `[vibe:${paramStr}]`;
    return clean ? `${clean} ${tag}` : tag;
};

export const getStoredPassport = (username?: string): PublicPassportData => {
    const cleanUser = cleanPassportUsername(username);
    try {
        if (cleanUser) {
            const saved = localStorage.getItem(`${STORAGE_KEY}_${cleanUser.toLowerCase()}`);
            if (saved) {
                const parsed = JSON.parse(saved);
                return {
                    ...DEFAULT_PASSPORT_DATA,
                    ...parsed,
                    favouriteShowsFilms: stripPassportVibeMeta(parsed.favouriteShowsFilms),
                    username: cleanPassportUsername(parsed.username, cleanUser),
                };
            }
        }
        const scopedSaved = getUserScopedItem(STORAGE_KEY);
        if (scopedSaved) {
            const parsed = JSON.parse(scopedSaved);
            return {
                ...DEFAULT_PASSPORT_DATA,
                ...parsed,
                favouriteShowsFilms: stripPassportVibeMeta(parsed.favouriteShowsFilms),
                username: cleanPassportUsername(parsed.username, cleanUser),
            };
        }
    } catch {
        // Storage inaccessible
    }
    return { ...DEFAULT_PASSPORT_DATA, username: cleanUser || '' };
};

export const saveStoredPassport = (data: PublicPassportData): void => {
    try {
        const cleanUser = cleanPassportUsername(data.username);
        const payload = { ...data, username: cleanUser, updatedAt: Date.now() };
        setUserScopedItem(STORAGE_KEY, JSON.stringify(payload));
        if (cleanUser) {
            localStorage.setItem(`${STORAGE_KEY}_${cleanUser.toLowerCase()}`, JSON.stringify(payload));
        }
        window.dispatchEvent(new CustomEvent('chopaeng_passport_updated', { detail: payload }));
    } catch {
        // Ignore
    }
};

export interface SavePassportResult {
    success: boolean;
    savedToDb: boolean;
    message: string;
    endpoint?: string;
    passport?: PublicPassportData;
}

/**
 * Returns list of candidate backend URLs to ensure reliable connectivity
 * across production domains, console API, and local dev server.
 */
export const getBackendBaseUrls = (): string[] => {
    return Array.from(
        new Set([
            DODO_API_BASE,
            'https://console.chopaeng.com',
            'https://chopaeng.com',
        ].filter(Boolean))
    );
};

export const savePassportToDb = async (
    data: PublicPassportData,
    token?: string | null
): Promise<SavePassportResult> => {
    const authToken = token || getAuthToken();
    const cleanUser = cleanPassportUsername(data.username);
    const now = Date.now();
    const cleanedData: PublicPassportData = {
        ...data,
        username: cleanUser,
        updatedAt: now,
    };

    // 1. Instant local persistence and reactive notification
    saveStoredPassport(cleanedData);

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }

    const encodedShowsFilms = injectPassportVibeMeta(
        cleanedData.favouriteShowsFilms || '',
        cleanedData.passportSkin,
        cleanedData.passportPattern,
        cleanedData.featuredItems
    );

    const payload = {
        ...cleanedData,
        favouriteShowsFilms: encodedShowsFilms,
        passport: { ...cleanedData, favouriteShowsFilms: encodedShowsFilms },
        public_passport: { ...cleanedData, favouriteShowsFilms: encodedShowsFilms },
        preferences: { passport: cleanedData },
        username: cleanUser,
        custom_username: cleanUser,
        public_username: cleanUser,
    };

    const candidateBases = getBackendBaseUrls();
    const candidatePaths = ['/api/user/passport', '/api/profile/passport'];

    for (const base of candidateBases) {
        for (const path of candidatePaths) {
            const ep = `${base}${path}`;
            try {
                const resp = await fetch(ep, {
                    method: 'POST',
                    headers,
                    credentials: 'include',
                    body: JSON.stringify(payload),
                });

                if (resp.ok) {
                    const resJson = await resp.json().catch(() => null);
                    if (resJson && resJson.ok !== false && resJson.success !== false) {
                        const savedPassport: PublicPassportData = {
                            ...cleanedData,
                            ...(resJson.passport || {}),
                            favouriteShowsFilms: stripPassportVibeMeta(cleanedData.favouriteShowsFilms),
                            passportSkin: cleanedData.passportSkin,
                            passportPattern: cleanedData.passportPattern,
                            featuredItems: cleanedData.featuredItems,
                            username: cleanUser,
                        };
                        saveStoredPassport(savedPassport);
                        console.info(`[ChoBot DB] Successfully persisted passport to database (${ep})`);
                        return {
                            success: true,
                            savedToDb: true,
                            message: 'Your Resident Passport has been saved to the ChoBot database!',
                            endpoint: ep,
                            passport: savedPassport,
                        };
                    }
                }
            } catch {
                // Try next endpoint or base URL
            }
        }
    }

    console.warn('[ChoBot DB] Backend database could not be reached; saved locally in browser.');
    return {
        success: true,
        savedToDb: false,
        message: 'Passport saved locally (ChoBot server sync pending).',
        passport: cleanedData,
    };
};

export const fetchPublicPassportFromDb = async (
    username: string,
    token?: string | null
): Promise<PublicPassportData | null> => {
    const cleanUser = cleanPassportUsername(username);
    if (!cleanUser) return null;

    const localExisting = getStoredPassport(cleanUser);
    const authToken = token || getAuthToken();
    const headers: Record<string, string> = {};
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const candidateBases = getBackendBaseUrls();

    for (const base of candidateBases) {
        const endpoints = [
            `${base}/api/public/passport/${encodeURIComponent(cleanUser)}`,
            `${base}/api/user/passport/${encodeURIComponent(cleanUser)}`,
            `${base}/api/profile/passport?username=${encodeURIComponent(cleanUser)}`,
        ];

        for (const ep of endpoints) {
            try {
                const resp = await fetch(ep, {
                    headers,
                    credentials: 'include',
                });
                if (resp.ok) {
                    const data = await resp.json().catch(() => null);
                    if (data && !data.error && (data.passport || data.public_passport || data.data)) {
                        const passport = data.passport || data.public_passport || data.data;
                        const meta = parsePassportVibeMeta(passport.favouriteShowsFilms) ||
                                     parsePassportVibeMeta(passport.hobbies) ||
                                     parsePassportVibeMeta(passport.aboutYou);
                        const skin = passport.passportSkin ||
                                     passport.preferences?.passport?.passportSkin ||
                                     data.preferences?.passport?.passportSkin ||
                                     meta?.skin ||
                                     localExisting.passportSkin ||
                                     DEFAULT_PASSPORT_DATA.passportSkin;
                        const pattern = passport.passportPattern ||
                                        passport.preferences?.passport?.passportPattern ||
                                        data.preferences?.passport?.passportPattern ||
                                        meta?.pattern ||
                                        localExisting.passportPattern ||
                                        DEFAULT_PASSPORT_DATA.passportPattern;
                        const items = passport.featuredItems ||
                                      passport.preferences?.passport?.featuredItems ||
                                      data.preferences?.passport?.featuredItems ||
                                      meta?.featuredItems ||
                                      localExisting.featuredItems ||
                                      DEFAULT_PASSPORT_DATA.featuredItems;

                        const sanitized: PublicPassportData = {
                            ...DEFAULT_PASSPORT_DATA,
                            ...localExisting,
                            ...passport,
                            favouriteShowsFilms: stripPassportVibeMeta(passport.favouriteShowsFilms || localExisting.favouriteShowsFilms),
                            passportSkin: skin,
                            passportPattern: pattern,
                            featuredItems: items,
                            username: cleanPassportUsername(passport.username, cleanUser),
                        };
                        saveStoredPassport(sanitized);
                        return sanitized;
                    }
                }
            } catch {
                // continue to next endpoint
            }
        }
    }

    // Check local storage fallback
    if (localExisting && (localExisting.isPublic || (cleanUser && localExisting.username.toLowerCase() === cleanUser.toLowerCase()))) {
        return localExisting;
    }

    return null;
};

/**
 * Fetch the authenticated user's saved passport directly from ChoBot database
 */
export const fetchUserPassportFromDb = async (
    token?: string | null
): Promise<PublicPassportData | null> => {
    const authToken = token || getAuthToken();
    if (!authToken) return null;

    const localExisting = getStoredPassport();
    const headers: Record<string, string> = {
        Authorization: `Bearer ${authToken}`,
    };

    const candidateBases = getBackendBaseUrls();

    for (const base of candidateBases) {
        const endpoints = [
            `${base}/api/user/passport`,
            `${base}/api/profile/passport`,
        ];

        for (const ep of endpoints) {
            try {
                const resp = await fetch(ep, {
                    headers,
                    credentials: 'include',
                });
                if (resp.ok) {
                    const data = await resp.json().catch(() => null);
                    if (data && !data.error && (data.passport || data.public_passport || data.data)) {
                        const passport = data.passport || data.public_passport || data.data;
                        const meta = parsePassportVibeMeta(passport.favouriteShowsFilms) ||
                                     parsePassportVibeMeta(passport.hobbies) ||
                                     parsePassportVibeMeta(passport.aboutYou);
                        const skin = passport.passportSkin ||
                                     passport.preferences?.passport?.passportSkin ||
                                     data.preferences?.passport?.passportSkin ||
                                     meta?.skin ||
                                     localExisting.passportSkin ||
                                     DEFAULT_PASSPORT_DATA.passportSkin;
                        const pattern = passport.passportPattern ||
                                        passport.preferences?.passport?.passportPattern ||
                                        data.preferences?.passport?.passportPattern ||
                                        meta?.pattern ||
                                        localExisting.passportPattern ||
                                        DEFAULT_PASSPORT_DATA.passportPattern;
                        const items = passport.featuredItems ||
                                      passport.preferences?.passport?.featuredItems ||
                                      data.preferences?.passport?.featuredItems ||
                                      meta?.featuredItems ||
                                      localExisting.featuredItems ||
                                      DEFAULT_PASSPORT_DATA.featuredItems;

                        const sanitized: PublicPassportData = {
                            ...DEFAULT_PASSPORT_DATA,
                            ...localExisting,
                            ...passport,
                            favouriteShowsFilms: stripPassportVibeMeta(passport.favouriteShowsFilms || localExisting.favouriteShowsFilms),
                            passportSkin: skin,
                            passportPattern: pattern,
                            featuredItems: items,
                            username: cleanPassportUsername(passport.username, ''),
                        };
                        saveStoredPassport(sanitized);
                        return sanitized;
                    }
                }
            } catch {
                // continue
            }
        }
    }

    return localExisting.username ? localExisting : null;
};

export interface UpdateNicknameResult {
    success: boolean;
    nickname?: string;
    message?: string;
}

/**
 * Sends a request to ChoPaeng backend to update the user's Discord guild nickname.
 */
export const updateDiscordNickname = async (
    newNickname: string,
    token?: string | null
): Promise<UpdateNicknameResult> => {
    const authToken = token || getAuthToken();
    const cleanNick = newNickname.trim();

    if (!cleanNick) {
        return { success: false, message: 'Nickname cannot be empty.' };
    }

    if (cleanNick.length > 32) {
        return { success: false, message: 'Discord nicknames cannot exceed 32 characters.' };
    }

    if (!authToken) {
        return { success: false, message: 'You must be logged in to update your Discord nickname.' };
    }

    const candidateBases = getBackendBaseUrls();
    const candidatePaths = [
        '/api/user/nickname',
        '/api/profile/nickname',
        '/api/user/update-nickname',
        '/api/profile/update-nickname',
    ];

    let lastError = 'Unable to update nickname on Discord. Please check your backend bot connection.';

    for (const base of candidateBases) {
        for (const path of candidatePaths) {
            const ep = `${base}${path}`;
            try {
                const resp = await fetch(ep, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${authToken}`,
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        nickname: cleanNick,
                        nick: cleanNick,
                    }),
                });

                const data = await resp.json().catch(() => ({}));

                if (resp.ok && data.success !== false) {
                    return {
                        success: true,
                        nickname: data.nickname || data.nick || cleanNick,
                        message: data.message || `Successfully updated your Discord server nickname to "${cleanNick}"!`,
                    };
                }

                if (data.error || data.message) {
                    lastError = data.error || data.message;
                }
            } catch {
                // continue to next endpoint
            }
        }
    }

    return { success: false, message: lastError };
};



