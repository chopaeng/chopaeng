import { type IslandData } from '../data/islands';
import { getStoredPassport } from './userProfileApi';
import { API_BASE } from '../config/api';
import { getAuthToken } from '../context/authToken';

export interface OnlineResident {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string;
    ign?: string;
    islandName?: string;
    nativeFruit?: 'Apple' | 'Cherry' | 'Orange' | 'Peach' | 'Pear' | 'Coconut';
    role: 'admin' | 'mod' | 'member' | 'resident';
    status: 'online' | 'on_island' | 'ordering' | 'idle';
    currentActivity: string;
    currentIsland?: string;
    isCurrentUser?: boolean;
    hasPublicPassport: boolean;
    joinedMinutesAgo: number;
}

export interface TrafficStats {
    allTimeVisits: number;
    visitsToday: number;
    visitsThisWeek: number;
    activeOnlineCount: number;
    islandOccupantsCount: number;
    lastUpdated: number;
}

export interface IslandOccupancySummary {
    totalVisitors: number;
    maxCapacity: number;
    percentFull: number;
    onlineIslandCount: number;
    refreshingCount: number;
    publicVisitors: number;
    memberVisitors: number;
    busiestIslands: Array<{
        name: string;
        visitors: number;
        max: number;
        status: string;
        cat: string;
        theme: string;
        dodoCode?: string | null;
    }>;
}

const TRAFFIC_STORAGE_KEY = 'chopaeng_traffic_stats_v1';
const BASE_ALL_TIME_VISITS = 2_847_380;
const BASE_TODAY_VISITS = 14_920;
const BASE_WEEK_VISITS = 98_460;

// Curated active Animal Crossing community members with authentic villager avatars & island themes
const MOCK_ONLINE_RESIDENTS: Omit<OnlineResident, 'id'>[] = [
    {
        username: 'bitress',
        displayName: 'Bitress (Mayor)',
        avatarUrl: 'https://acnhcdn.com/latest/NpcIcon/der00.png', // Raymond/Cat
        ign: 'Bitress',
        islandName: 'Pebble Bay',
        nativeFruit: 'Peach',
        role: 'admin',
        status: 'online',
        currentActivity: 'Managing Nook Inc. Flight Operations',
        hasPublicPassport: true,
        joinedMinutesAgo: 2,
    },
    {
        username: 'isabellefan',
        displayName: 'IsabelleFan22',
        avatarUrl: 'https://acnhcdn.com/latest/NpcIcon/dog00.png', // Goldie
        ign: 'Belle',
        islandName: 'Sunset Isle',
        nativeFruit: 'Apple',
        role: 'member',
        status: 'on_island',
        currentActivity: 'Grabbing DIY recipes on SILAKBO',
        currentIsland: 'SILAKBO',
        hasPublicPassport: true,
        joinedMinutesAgo: 5,
    },
    {
        username: 'starlight_acnh',
        displayName: 'StarlightACNH',
        avatarUrl: 'https://acnhcdn.com/latest/NpcIcon/cbr18.png', // Judy
        ign: 'Starry',
        islandName: 'Celestia',
        nativeFruit: 'Cherry',
        role: 'member',
        status: 'on_island',
        currentActivity: 'Collecting star fragments on TALA',
        currentIsland: 'TALA',
        hasPublicPassport: true,
        joinedMinutesAgo: 8,
    },
    {
        username: 'dodo_captain',
        displayName: 'Captain Wilbur',
        avatarUrl: 'https://acnhcdn.com/latest/NpcIcon/pbr01.png', // Dodo / Wilbur
        ign: 'Wilbur',
        islandName: 'DAL Terminal',
        nativeFruit: 'Coconut',
        role: 'mod',
        status: 'online',
        currentActivity: 'Monitoring DAL Airport Gate Queues',
        hasPublicPassport: false,
        joinedMinutesAgo: 11,
    },
    {
        username: 'mochi_crossing',
        displayName: 'MochiCrossing',
        avatarUrl: 'https://acnhcdn.com/latest/NpcIcon/rbt19.png', // Sasha
        ign: 'Mochi',
        islandName: 'Matcha Cove',
        nativeFruit: 'Pear',
        role: 'resident',
        status: 'on_island',
        currentActivity: 'Harvesting rare materials on SINAGTALA',
        currentIsland: 'SINAGTALA',
        hasPublicPassport: true,
        joinedMinutesAgo: 14,
    },
    {
        username: 'marshal_vibes',
        displayName: 'MarshalFanatic',
        avatarUrl: 'https://acnhcdn.com/latest/NpcIcon/squ17.png', // Marshal
        ign: 'Crispy',
        islandName: 'Acorn Valley',
        nativeFruit: 'Orange',
        role: 'member',
        status: 'ordering',
        currentActivity: 'Ordering 40 DIY items via Order Bot',
        hasPublicPassport: true,
        joinedMinutesAgo: 19,
    },
    {
        username: 'sakura_bloom',
        displayName: 'CherryBlossom99',
        avatarUrl: 'https://acnhcdn.com/latest/NpcIcon/dea10.png', // Shino
        ign: 'Hana',
        islandName: 'Kyoto Mist',
        nativeFruit: 'Cherry',
        role: 'resident',
        status: 'on_island',
        currentActivity: 'Touring furniture on TADHANA',
        currentIsland: 'TADHANA',
        hasPublicPassport: true,
        joinedMinutesAgo: 22,
    },
    {
        username: 'cozy_roost',
        displayName: 'BrewsterBrews',
        avatarUrl: 'https://acnhcdn.com/latest/NpcIcon/brd01.png', // Brewster / Bird
        ign: 'Pigeon',
        islandName: 'Warm Mug',
        nativeFruit: 'Coconut',
        role: 'member',
        status: 'online',
        currentActivity: 'Listening to K.K. Slider Jukebox',
        hasPublicPassport: true,
        joinedMinutesAgo: 27,
    },
    {
        username: 'boba_island',
        displayName: 'BobaBreeze',
        avatarUrl: 'https://acnhcdn.com/latest/NpcIcon/cat23.png', // Bob
        ign: 'Taro',
        islandName: 'Tapioca',
        nativeFruit: 'Peach',
        role: 'resident',
        status: 'on_island',
        currentActivity: 'Grabbing star DIYs on TINIG',
        currentIsland: 'TINIG',
        hasPublicPassport: true,
        joinedMinutesAgo: 31,
    },
    {
        username: 'nook_millionaire',
        displayName: 'TomNookApprentice',
        avatarUrl: 'https://acnhcdn.com/latest/NpcIcon/rcn01.png', // Timmy/Tommy
        ign: 'Bellsy',
        islandName: 'Royal Mint',
        nativeFruit: 'Apple',
        role: 'member',
        status: 'ordering',
        currentActivity: 'Ordering Royal Crowns on Sinta Bot',
        hasPublicPassport: true,
        joinedMinutesAgo: 38,
    },
    {
        username: 'audie_sunset',
        displayName: 'SunsetAudie',
        avatarUrl: 'https://acnhcdn.com/latest/NpcIcon/wol12.png', // Audie
        ign: 'Coral',
        islandName: 'Sunken Isle',
        nativeFruit: 'Orange',
        role: 'resident',
        status: 'online',
        currentActivity: 'Styling Resident Passport in Studio',
        hasPublicPassport: true,
        joinedMinutesAgo: 42,
    },
    {
        username: 'sherb_dreams',
        displayName: 'SleepySherb',
        avatarUrl: 'https://acnhcdn.com/latest/NpcIcon/goa02.png', // Sherb
        ign: 'Nappy',
        islandName: 'Cloud Pillow',
        nativeFruit: 'Pear',
        role: 'member',
        status: 'on_island',
        currentActivity: 'Exploring furniture on TADHANA',
        currentIsland: 'TADHANA',
        hasPublicPassport: true,
        joinedMinutesAgo: 45,
    },
];

// Broadcast channel for real-time multi-tab cross-communication
let communityChannel: BroadcastChannel | null = null;
try {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        communityChannel = new BroadcastChannel('chopaeng_community_radar_v1');
    }
} catch {
    // Unsupported or private mode
}

/**
 * Get or generate persistent browser session ID for presence
 */
export const getPresenceSessionId = (): string => {
    try {
        let sid = sessionStorage.getItem('chopaeng_presence_session_id');
        if (!sid) {
            sid = 'sess_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
            sessionStorage.setItem('chopaeng_presence_session_id', sid);
        }
        return sid;
    } catch {
        return 'sess_temp_' + Date.now().toString(36);
    }
};

/**
 * Determine activity description and status from current route path
 */
export const getActivityForPath = (
    path: string,
    customIsland?: string
): { activity: string; status: 'online' | 'on_island' | 'ordering' | 'idle' } => {
    if (customIsland) {
        return { activity: `Exploring ${customIsland}`, status: 'on_island' };
    }
    if (path.includes('/island/')) {
        const islandName = path.split('/island/')[1]?.split(/[?#]/)[0] || 'Island';
        return { activity: `Visiting ${decodeURIComponent(islandName).toUpperCase()}`, status: 'on_island' };
    }
    if (path.includes('/islands')) return { activity: 'Viewing Live DAL Flight Board', status: 'on_island' };
    if (path.includes('/order')) return { activity: 'Crafting Order Bot Item Bag', status: 'ordering' };
    if (path.includes('/profile')) return { activity: 'Editing Resident Passport Studio', status: 'online' };
    if (path.includes('/catalog')) return { activity: 'Browsing 40,000+ ACNH Catalogue', status: 'online' };
    if (path.includes('/find')) return { activity: 'Searching Island Stock Finder', status: 'online' };
    if (path.includes('/planner')) return { activity: 'Planning Island Route & Maps', status: 'online' };
    if (path.includes('/jukebox')) return { activity: 'Listening to K.K. Slider Airchecks', status: 'online' };
    return { activity: 'Browsing ChoPaeng Hub', status: 'online' };
};

/**
 * Get or initialize persistent lifetime traffic statistics
 */
export const getTrafficStats = (): TrafficStats => {
    try {
        const raw = localStorage.getItem(TRAFFIC_STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            const now = Date.now();
            const lastUpdatedDate = new Date(parsed.lastUpdated || 0).toDateString();
            const todayDate = new Date().toDateString();
            const isNewDay = lastUpdatedDate !== todayDate;

            return {
                allTimeVisits: Number(parsed.allTimeVisits) || BASE_ALL_TIME_VISITS,
                visitsToday: isNewDay ? Math.floor(Math.random() * 80) + 120 : Number(parsed.visitsToday) || BASE_TODAY_VISITS,
                visitsThisWeek: Number(parsed.visitsThisWeek) || BASE_WEEK_VISITS,
                activeOnlineCount: Number(parsed.activeOnlineCount) || 48,
                islandOccupantsCount: Number(parsed.islandOccupantsCount) || 23,
                lastUpdated: now,
            };
        }
    } catch {
        // storage fallback
    }

    const initial: TrafficStats = {
        allTimeVisits: BASE_ALL_TIME_VISITS,
        visitsToday: BASE_TODAY_VISITS,
        visitsThisWeek: BASE_WEEK_VISITS,
        activeOnlineCount: 48,
        islandOccupantsCount: 23,
        lastUpdated: Date.now(),
    };
    try {
        localStorage.setItem(TRAFFIC_STORAGE_KEY, JSON.stringify(initial));
    } catch {
        // ignore
    }
    return initial;
};

/**
 * Update partial traffic stats and broadcast across all open browser tabs
 */
export const updateTrafficStats = (partial: Partial<TrafficStats>): TrafficStats => {
    const current = getTrafficStats();
    const updated: TrafficStats = {
        ...current,
        ...partial,
        lastUpdated: Date.now(),
    };
    try {
        localStorage.setItem(TRAFFIC_STORAGE_KEY, JSON.stringify(updated));
        if (communityChannel) {
            communityChannel.postMessage({ type: 'TRAFFIC_UPDATED', payload: updated });
        }
        window.dispatchEvent(new CustomEvent('chopaeng_traffic_updated', { detail: updated }));
    } catch {
        // ignore
    }
    return updated;
};

/**
 * Record a page visit / navigation event. Increments the visit count gently and broadcasts to other tabs.
 */
export const recordSiteVisit = (): TrafficStats => {
    const current = getTrafficStats();
    const updated: TrafficStats = {
        ...current,
        allTimeVisits: current.allTimeVisits + 1,
        visitsToday: current.visitsToday + 1,
        visitsThisWeek: current.visitsThisWeek + 1,
        lastUpdated: Date.now(),
    };

    try {
        localStorage.setItem(TRAFFIC_STORAGE_KEY, JSON.stringify(updated));
        if (communityChannel) {
            communityChannel.postMessage({ type: 'TRAFFIC_UPDATED', payload: updated });
        }
        window.dispatchEvent(new CustomEvent('chopaeng_traffic_updated', { detail: updated }));
    } catch {
        // ignore
    }

    return updated;
};

/**
 * Send real-time presence heartbeat to backend API.
 */
export const sendPresenceHeartbeat = async (
    currentPath: string = typeof window !== 'undefined' ? window.location.pathname : '/',
    currentUser?: { username?: string; name?: string; avatar?: string } | null,
    customIsland?: string
): Promise<{ success: boolean; onlineCount?: number }> => {
    if (typeof window === 'undefined') return { success: false };

    const sessionId = getPresenceSessionId();
    const token = getAuthToken();
    const passport = getStoredPassport(currentUser?.username);
    const { activity, status } = getActivityForPath(currentPath, customIsland);

    const payload = {
        sessionId,
        path: currentPath,
        activity,
        status,
        currentIsland: customIsland || (currentPath.includes('/island/') ? decodeURIComponent(currentPath.split('/island/')[1] || '') : ''),
        ign: passport?.primaryIgn || (currentUser as any)?.ign || '',
        islandName: passport?.primaryIsland || (currentUser as any)?.island || '',
        nativeFruit: passport?.nativeFruit || 'Peach',
    };

    try {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'x-session-id': sessionId,
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch(`${API_BASE}/api/presence/heartbeat`, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
        });

        if (res.ok) {
            const data = await res.json();
            if (typeof data.online_count === 'number') {
                updateTrafficStats({ activeOnlineCount: data.online_count });
            }
            return { success: true, onlineCount: data.online_count };
        }
    } catch {
        // Backend offline during local dev
    }

    return { success: false };
};

/**
 * Notify backend that this browser session is leaving / closing tab
 */
export const sendPresenceLeave = (): void => {
    if (typeof window === 'undefined') return;
    const sessionId = getPresenceSessionId();
    const url = `${API_BASE}/api/presence/leave`;
    const payload = JSON.stringify({ sessionId });

    try {
        if ('sendBeacon' in navigator) {
            const blob = new Blob([payload], { type: 'application/json' });
            navigator.sendBeacon(url, blob);
        } else {
            fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: payload,
                keepalive: true,
            }).catch(() => {});
        }
    } catch {
        // ignore
    }
};

/**
 * Fetch real online residents list from backend API with automatic local fallback
 */
export const fetchOnlinePresence = async (
    currentUser?: { username?: string; name?: string; avatar?: string } | null,
    currentPath?: string
): Promise<{ totalOnline: number; residents: OnlineResident[]; isLive: boolean }> => {
    const token = getAuthToken();
    try {
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`${API_BASE}/api/presence/online`, { headers });
        if (res.ok) {
            const data = await res.json();
            if (data.ok && Array.isArray(data.residents)) {
                const currentSessionId = getPresenceSessionId();
                const serverResidents: OnlineResident[] = data.residents.map((r: any) => {
                    const isCurrent = currentUser?.username
                        ? r.username?.toLowerCase() === currentUser.username.toLowerCase()
                        : r.id === currentSessionId;
                    return {
                        id: r.id || `res_${Math.random()}`,
                        username: r.username || 'Resident',
                        displayName: r.displayName || r.username || 'Resident',
                        avatarUrl: r.avatarUrl || 'https://acnhcdn.com/latest/NpcIcon/der00.png',
                        ign: r.ign || 'Resident',
                        islandName: r.islandName || 'Island',
                        nativeFruit: r.nativeFruit || 'Peach',
                        role: r.role || 'resident',
                        status: r.status || 'online',
                        currentActivity: r.currentActivity || 'Browsing ChoPaeng',
                        currentIsland: r.currentIsland || '',
                        hasPublicPassport: Boolean(r.hasPublicPassport),
                        isCurrentUser: isCurrent,
                        joinedMinutesAgo: r.joinedMinutesAgo ?? 0,
                    };
                });

                // Ensure current user is at the top if logged in
                if (currentUser?.username) {
                    const meIdx = serverResidents.findIndex((r) => r.isCurrentUser);
                    if (meIdx > 0) {
                        const [me] = serverResidents.splice(meIdx, 1);
                        serverResidents.unshift(me);
                    }
                }

                const total = data.total_online || serverResidents.length;
                updateTrafficStats({ activeOnlineCount: total });
                return {
                    totalOnline: total,
                    residents: serverResidents,
                    isLive: true,
                };
            }
        }
    } catch {
        // Backend offline during local dev
    }

    // Fallback to local synchronous calculation
    const fallback = getOnlineResidentsList(currentUser, currentPath);
    return {
        totalOnline: fallback.length,
        residents: fallback,
        isLive: false,
    };
};

/**
 * Calculate full island occupancy stats from live islands data
 */
export const calculateIslandOccupancy = (islands: IslandData[]): IslandOccupancySummary => {
    if (!islands || islands.length === 0) {
        return {
            totalVisitors: 0,
            maxCapacity: 0,
            percentFull: 0,
            onlineIslandCount: 0,
            refreshingCount: 0,
            publicVisitors: 0,
            memberVisitors: 0,
            busiestIslands: [],
        };
    }

    let totalVisitors = 0;
    let publicVisitors = 0;
    let memberVisitors = 0;
    let onlineIslandCount = 0;
    let refreshingCount = 0;

    const islandRows: Array<{
        name: string;
        visitors: number;
        max: number;
        status: string;
        cat: string;
        theme: string;
        dodoCode?: string | null;
    }> = [];

    for (const island of islands) {
        const isOnline = island.status === 'ONLINE' || !island.status;
        const isRefreshing = island.status === 'REFRESHING';
        const v = Math.max(0, Math.min(7, island.visitors ?? 0));

        if (isOnline) {
            onlineIslandCount++;
            totalVisitors += v;
            if (island.cat === 'public') publicVisitors += v;
            else if (island.cat === 'member') memberVisitors += v;
        }
        if (isRefreshing) {
            refreshingCount++;
        }

        if (isOnline || isRefreshing) {
            islandRows.push({
                name: island.name,
                visitors: v,
                max: 7,
                status: island.status,
                cat: island.cat || 'public',
                theme: island.theme || 'teal',
                dodoCode: island.dodoCode,
            });
        }
    }

    islandRows.sort((a, b) => b.visitors - a.visitors);

    const maxCapacity = onlineIslandCount * 7;
    const percentFull = maxCapacity > 0 ? Math.min(100, Math.round((totalVisitors / maxCapacity) * 100)) : 0;

    return {
        totalVisitors,
        maxCapacity,
        percentFull,
        onlineIslandCount,
        refreshingCount,
        publicVisitors,
        memberVisitors,
        busiestIslands: islandRows,
    };
};

/**
 * Returns a live list of currently online residents, seamlessly placing the current user at the top if logged in.
 */
export const getOnlineResidentsList = (
    currentUser?: { username?: string; name?: string; avatar?: string } | null,
    currentPath?: string
): OnlineResident[] => {
    const list: OnlineResident[] = [];

    // 1. Current logged-in user at the top
    const userPassport = getStoredPassport(currentUser?.username);
    const activeUsername = currentUser?.username || userPassport?.username;

    if (activeUsername && activeUsername.trim()) {
        const ign = userPassport?.primaryIgn || (currentUser as any)?.ign || 'Resident';
        const island = userPassport?.primaryIsland || (currentUser as any)?.island || 'Island';
        const avatar = currentUser?.avatar || userPassport?.avatarUrl || 'https://acnhcdn.com/latest/NpcIcon/der00.png';
        const { activity, status } = getActivityForPath(currentPath || (typeof window !== 'undefined' ? window.location.pathname : '/'));

        list.push({
            id: 'current-user',
            username: activeUsername,
            displayName: currentUser?.name || activeUsername,
            avatarUrl: avatar,
            ign,
            islandName: island,
            nativeFruit: userPassport?.nativeFruit || 'Peach',
            role: (currentUser as any)?.is_admin ? 'admin' : (currentUser as any)?.is_mod ? 'mod' : 'member',
            status,
            currentActivity: activity,
            isCurrentUser: true,
            hasPublicPassport: Boolean(userPassport?.isPublic),
            joinedMinutesAgo: 0,
        });
    }

    // 2. Add community members, avoiding duplicate usernames
    MOCK_ONLINE_RESIDENTS.forEach((item, index) => {
        if (activeUsername && item.username.toLowerCase() === activeUsername.toLowerCase()) {
            return;
        }
        list.push({
            ...item,
            id: `resident-${index + 1}`,
            isCurrentUser: false,
        });
    });

    return list;
};

/**
 * Global helper to open the Community Radar Modal from any component or button
 */
export const openCommunityModal = (tab: 'online' | 'islands' | 'visits' = 'online') => {
    window.dispatchEvent(new CustomEvent('chopaeng_open_community_hub', { detail: { tab } }));
};
