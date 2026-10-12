import { API_BASE, DODO_API_BASE } from '../config/api';
import { getAuthToken } from '../context/authToken';

export interface IslandDropResponse {
    success: boolean;
    island?: string;
    message?: string;
    error?: string;
    sysbot_response?: any;
}

export interface IslandInjectResponse {
    success: boolean;
    island?: string;
    villager?: string;
    plot?: number | null;
    message?: string;
    error?: string;
    sysbot_response?: any;
}

export interface IslandDodoRevealResponse {
    success: boolean;
    dodoCode?: string;
    error?: string;
    isRefreshing?: boolean;
}

const getHeaders = (token?: string | null): Record<string, string> => {
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
 * Submit item drop directly to the chosen island via SysBot HTTP API.
 */
export const submitIslandDrop = async (
    islandName: string,
    items: string | string[],
    type: 'items' | 'diy' = 'items',
    username?: string,
    token?: string | null
): Promise<IslandDropResponse> => {
    if (!islandName) {
        return { success: false, error: 'Destination island is required.' };
    }
    if (!items || (Array.isArray(items) && items.length === 0)) {
        return { success: false, error: 'No items selected to drop.' };
    }

    try {
        const res = await fetch(
            `${API_BASE}/api/islands/${encodeURIComponent(islandName)}/drop`,
            {
                method: 'POST',
                headers: getHeaders(token),
                credentials: 'include',
                body: JSON.stringify({
                    items,
                    type,
                    username,
                }),
            }
        );

        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success !== false) {
            return {
                success: true,
                island: data.island || islandName,
                message: data.message || `Items dropped on ${islandName}!`,
                sysbot_response: data.sysbot_response,
            };
        }

        return {
            success: false,
            error: data.error || data.message || 'Drop request failed on the destination island.',
            sysbot_response: data.sysbot_response,
        };
    } catch (err: any) {
        return {
            success: false,
            error: err?.message || 'Network error communicating with island SysBot.',
        };
    }
};

/**
 * Inject a villager into a specific house plot (0–9) on the chosen island via SysBot HTTP API.
 */
export const injectIslandVillager = async (
    islandName: string,
    villagerName: string,
    plotNumber?: number | null,
    token?: string | null
): Promise<IslandInjectResponse> => {
    if (!islandName) {
        return { success: false, error: 'Destination island is required.' };
    }
    if (!villagerName) {
        return { success: false, error: 'Villager name is required.' };
    }

    try {
        const res = await fetch(
            `${API_BASE}/api/islands/${encodeURIComponent(islandName)}/villagers/inject`,
            {
                method: 'POST',
                headers: getHeaders(token),
                credentials: 'include',
                body: JSON.stringify({
                    villager: villagerName,
                    plot: plotNumber ?? undefined,
                }),
            }
        );

        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success !== false) {
            return {
                success: true,
                island: data.island || islandName,
                villager: villagerName,
                plot: plotNumber,
                message: data.message || `${villagerName} injected into Plot #${plotNumber ?? 0} on ${islandName}!`,
                sysbot_response: data.sysbot_response,
            };
        }

        return {
            success: false,
            error: data.error || data.message || 'Failed to inject villager on the island.',
            sysbot_response: data.sysbot_response,
        };
    } catch (err: any) {
        return {
            success: false,
            error: err?.message || 'Network error during villager injection.',
        };
    }
};

/**
 * Batch inject multiple villagers (or execute !mvi) on the chosen island.
 */
export const batchInjectIslandVillagers = async (
    islandName: string,
    command: string,
    token?: string | null
): Promise<IslandInjectResponse> => {
    if (!islandName) {
        return { success: false, error: 'Destination island is required.' };
    }
    if (!command.trim()) {
        return { success: false, error: 'Injection command is empty.' };
    }

    try {
        const res = await fetch(
            `${API_BASE}/api/islands/${encodeURIComponent(islandName)}/villagers/inject`,
            {
                method: 'POST',
                headers: getHeaders(token),
                credentials: 'include',
                body: JSON.stringify({ command }),
            }
        );

        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success !== false) {
            return {
                success: true,
                island: data.island || islandName,
                message: data.message || `Villager batch injected on ${islandName}!`,
                sysbot_response: data.sysbot_response,
            };
        }

        return {
            success: false,
            error: data.error || data.message || 'Failed to batch inject villagers.',
            sysbot_response: data.sysbot_response,
        };
    } catch (err: any) {
        return {
            success: false,
            error: err?.message || 'Network error during batch injection.',
        };
    }
};

/**
 * Reveal the Dodo code for any island (Sub Member or Free Island).
 */
export const revealIslandDodoCode = async (
    islandName: string,
    token?: string | null
): Promise<IslandDodoRevealResponse> => {
    if (!islandName) {
        return { success: false, error: 'Island name is required.' };
    }

    try {
        const res = await fetch(
            `${DODO_API_BASE}/api/islands/${encodeURIComponent(islandName)}/dodo`,
            {
                method: 'POST',
                headers: getHeaders(token),
                credentials: 'include',
            }
        );

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            if (res.status === 401) {
                return { success: false, error: 'Please log in to reveal island Dodo codes.' };
            }
            if (res.status === 403) {
                return {
                    success: false,
                    error: err.error || 'Access to this island requires a Sub Member tier.',
                };
            }
            return {
                success: false,
                error: err.error || 'Could not retrieve Dodo code for this island.',
            };
        }

        const data = await res.json();
        const rawCode = String(data.dodo_code || '');
        const code = rawCode.split(': ').pop() || rawCode;
        return {
            success: true,
            dodoCode: code,
        };
    } catch (err: any) {
        return {
            success: false,
            error: err?.message || 'Network error fetching Dodo code.',
        };
    }
};
