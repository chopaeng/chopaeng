import { API_BASE } from '../config/api';
import { getAuthToken } from '../context/authToken';
import { getUserScopedItem, setUserScopedItem, getActiveUserId } from './accountStorage';

// ─── Response Types ────────────────────────────────────────────────────────

export interface BotStatusResponse {
    success: boolean;
    is_running?: boolean;
    mode?: 'DropMode' | 'OrderMode';
    is_drop_mode?: boolean;
    is_order_mode?: boolean;
    island_name?: string;
    dodo_code?: string;
    layer?: string;
    visitors_count?: number;
    visitors?: string;
    visitor_list?: string[];
    is_dirty?: boolean;
    accepting_commands?: boolean;
    queue_count?: number;
    battery_charge?: number;
    last_dodo_fetch?: string;
    server_time?: string;
    error?: string;
}

export interface SubmitOrderResponse {
    success: boolean;
    orderId?: string;
    queuePosition?: number;
    estimatedMinutes?: number;
    dodoCode?: string;
    message?: string;
    error?: string;
}

export interface OrderStatusResponse {
    status: 'queued' | 'preparing' | 'ready' | 'completed' | 'cancelled' | 'error';
    queuePosition?: number;
    estimatedMinutes?: number;
    estimatedSeconds?: number;
    eta?: string;
    dodoCode?: string;
    islandName?: string;
    message?: string;
}

export interface QueueEntry {
    order_id: string;
    username: string;
    queue_position: number;
    position?: number;       // alias from Sinta
    estimated_minutes?: number;
    eta?: string;
    status: string;
    item_count?: number;
    villager?: string;
    created_at?: string;
}

export interface OrderQueueResponse {
    success: boolean;
    queue?: QueueEntry[];
    orders?: QueueEntry[];
    total?: number;
    count?: number;
    island_name?: string;
    current_active_user?: string;
    error?: string;
}

export interface SubmitDropResponse {
    success: boolean;
    islandName: string;
    message: string;
}

export interface OrderHistoryItem {
    id: string;
    user_id: string;
    username: string;
    command: string;
    order_type: string;
    status: 'queued' | 'preparing' | 'ready' | 'completed' | 'cancelled' | 'error' | string;
    queue_position?: number;
    estimated_minutes?: number;
    dodo_code?: string;
    island_name?: string;
    message?: string;
    created_at: number;
    updated_at: number;
}

export interface UserOrderHistoryResponse {
    success: boolean;
    orders?: OrderHistoryItem[];
    error?: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

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

/** Set of clearly-invalid Dodo codes the SysBot may return before the real code is ready. */
const INVALID_DODO_CODES = new Set(['00000', '-----', 'null', 'None', '']);

/** Returns true if the dodo_code is a real, usable code. */
const isValidDodo = (code: unknown): code is string =>
    typeof code === 'string' && code.trim().length > 0 && !INVALID_DODO_CODES.has(code.trim());

/**
 * Parse the Sinta `eta` string (e.g. "04m:00s") into estimated minutes.
 * Falls back to `estimated_seconds` if available.
 */
const parseEtaMinutes = (data: Record<string, unknown>): number | undefined => {
    // Prefer estimated_seconds (most precise)
    if (typeof data.estimated_seconds === 'number') {
        return Math.max(1, Math.round(data.estimated_seconds / 60));
    }
    // Parse "04m:00s" style strings
    if (typeof data.eta === 'string') {
        const match = data.eta.match(/(\d+)m/);
        if (match) return Math.max(1, parseInt(match[1], 10));
    }
    // Fallback to estimated_minutes from backend
    if (typeof data.estimated_minutes === 'number') {
        return data.estimated_minutes;
    }
    return undefined;
};

/**
 * Map SysBot / backend status values to the canonical set the frontend expects.
 * The backend already does most of the mapping (next → preparing), but we
 * handle edge cases here as a safety net.
 */
const normalizeStatus = (raw: string): OrderStatusResponse['status'] => {
    const s = (raw || 'queued').toLowerCase();
    const map: Record<string, OrderStatusResponse['status']> = {
        queued: 'queued',
        next: 'preparing',
        preparing: 'preparing',
        active: 'preparing',
        in_progress: 'preparing',
        ready: 'ready',
        completed: 'completed',
        cancelled: 'cancelled',
        not_found: 'error',
        error: 'error',
    };
    return map[s] ?? 'queued';
};

// ─── Bot Status ────────────────────────────────────────────────────────────

/**
 * Fetches the live bot status (mode, island, dodo, queue count, battery,
 * visitors, layer, etc.).
 */
export const fetchBotStatus = async (
    token?: string | null
): Promise<BotStatusResponse> => {
    try {
        const res = await fetch(`${API_BASE}/api/order/bot-status`, {
            headers: getHeaders(token),
            credentials: 'include',
        });
        if (res.ok) {
            const data = await res.json();
            return { success: true, ...data };
        }
        const err = await res.json().catch(() => ({}));
        return { success: false, error: err?.error || 'Failed to fetch bot status.' };
    } catch {
        return { success: false, error: 'Bot status unavailable.' };
    }
};

// ─── Submit Order ──────────────────────────────────────────────────────────

/**
 * Submits an order command to the Order Bot queue.
 */
export const submitOrderToBot = async (
    commandText: string,
    token?: string | null,
    orderFor?: string,
    displayName?: string,
    islandName?: string
): Promise<SubmitOrderResponse> => {
    const trimmed = commandText.trim();
    if (!trimmed) {
        return { success: false, error: 'Order pocket is empty.' };
    }

    try {
        const res = await fetch(`${API_BASE}/api/order/submit`, {
            method: 'POST',
            headers: getHeaders(token),
            credentials: 'include',
            body: JSON.stringify({
                command: trimmed,
                type: 'order',
                timestamp: Date.now(),
                ...(orderFor ? { order_for: orderFor } : {}),
                ...(displayName ? { display_name: displayName, username: displayName } : {}),
                ...(islandName ? { island_name: islandName } : {}),
            }),
        });

        if (res.ok) {
            const data = await res.json();
            const hasDodo = isValidDodo(data.dodo_code);
            const status = normalizeStatus(data.status);

            let queuePos = typeof data.queue_position === 'number' ? data.queue_position : 1;
            if (queuePos <= 0 && status !== 'ready' && status !== 'preparing') queuePos = 1;

            const estMin = parseEtaMinutes(data) ?? 2;

            return {
                success: true,
                orderId: data.order_id || data.id,
                queuePosition: queuePos,
                estimatedMinutes: estMin,
                dodoCode: hasDodo ? data.dodo_code : undefined,
                message: data.message || 'Order placed successfully!',
            };
        }

        const errData = await res.json().catch(() => ({}));
        return {
            success: false,
            error: errData?.error || 'Order submission failed.',
        };
    } catch {
        return {
            success: false,
            error: 'Could not reach the Order Bot. Please try again.',
        };
    }
};

/**
 * Transforms raw SysBot console messages into user-friendly Animal Crossing themed text.
 */
export const formatOrderMessage = (rawMessage?: string | null): string | undefined => {
    if (!rawMessage) return undefined;
    const msg = rawMessage.trim();
    if (!msg) return undefined;

    const lower = msg.toLowerCase();
    if (
        lower.includes('visitor failed to arrive') ||
        lower.includes('request has been removed') ||
        lower.includes('failed to arrive')
    ) {
        return 'Flight Gate Expired: The arrival window has ended. You can easily re-order your items anytime!';
    }
    if (lower.includes('order cancelled') || lower.includes('cancelled by user')) {
        return 'Your order was successfully cancelled.';
    }
    if (lower.includes('pickup completed') || lower.includes('order completed')) {
        return 'Order pickup completed! Thank you for flying with Dodo Airlines.';
    }
    if (lower.includes('timed out') || lower.includes('gate closed')) {
        return 'The flight gate has closed. Click Re-Order below to generate a new pickup request.';
    }
    return msg;
};

// ─── Poll Order Status ─────────────────────────────────────────────────────

/**
 * Polls the status of a submitted order.
 */
export const pollOrderStatus = async (
    orderId: string,
    token?: string | null
): Promise<OrderStatusResponse> => {
    try {
        const res = await fetch(
            `${API_BASE}/api/order/status?id=${encodeURIComponent(orderId)}`,
            {
                headers: getHeaders(token),
                credentials: 'include',
            }
        );

        if (res.ok) {
            const data = await res.json();
            const rawStatus = normalizeStatus(data.status);
            const isTerminal = rawStatus === 'cancelled' || rawStatus === 'completed' || rawStatus === 'error';
            const hasDodo = !isTerminal && isValidDodo(data.dodo_code);
            const status = isTerminal ? rawStatus : (hasDodo ? ('ready' as const) : rawStatus);

            let queuePos = typeof data.queue_position === 'number' ? data.queue_position : undefined;
            if (queuePos !== undefined && queuePos <= 0 && status !== 'ready' && status !== 'preparing') {
                queuePos = 1;
            }

            const estMin = parseEtaMinutes(data);
            const formattedMsg = formatOrderMessage(data.message);

            return {
                status,
                queuePosition: queuePos,
                estimatedMinutes: estMin,
                estimatedSeconds: typeof data.estimated_seconds === 'number' ? data.estimated_seconds : undefined,
                eta: typeof data.eta === 'string' ? data.eta : undefined,
                dodoCode: hasDodo ? data.dodo_code : undefined,
                islandName: data.island_name || 'Sinta',
                message: formattedMsg,
            };
        }
    } catch { /* network error — return error state */ }

    return { status: 'error', message: 'Could not poll order status.' };
};

// ─── Cancel Order ──────────────────────────────────────────────────────────

/**
 * Cancels an active order by order_id.
 */
export const cancelOrder = async (
    orderId: string,
    token?: string | null
): Promise<{ success: boolean; error?: string }> => {
    try {
        const res = await fetch(`${API_BASE}/api/order/cancel`, {
            method: 'POST',
            headers: getHeaders(token),
            credentials: 'include',
            body: JSON.stringify({ id: orderId }),
        });
        const data = await res.json().catch(() => ({}));
        return { success: res.ok, error: data?.error };
    } catch {
        return { success: false, error: 'Cancel request failed.' };
    }
};

// ─── Fetch Queue ───────────────────────────────────────────────────────────

/**
 * Fetches the full current order queue.
 * Normalizes the response from Sinta's format (orders[] with position)
 * to the frontend's expected format (queue[] with queue_position).
 */
export const fetchOrderQueue = async (
    token?: string | null
): Promise<OrderQueueResponse> => {
    try {
        const res = await fetch(`${API_BASE}/api/order/queue`, {
            headers: getHeaders(token),
            credentials: 'include',
        });
        if (res.ok) {
            const data = await res.json();
            // The backend normalizes orders[].position → queue_position and
            // copies orders into queue[], but we handle fallbacks here too.
            const rawEntries: QueueEntry[] = data.queue || data.orders || [];
            const entries = rawEntries.map((e) => ({
                ...e,
                queue_position: e.queue_position ?? e.position ?? 0,
                estimated_minutes: e.estimated_minutes ?? parseEtaMinutes(e as unknown as Record<string, unknown>),
                status: normalizeStatus(e.status),
            }));
            return {
                success: true,
                queue: entries,
                total: data.total ?? data.count ?? entries.length,
                island_name: data.island_name,
                current_active_user: data.current_active_user,
            };
        }
        const err = await res.json().catch(() => ({}));
        return { success: false, error: err?.error };
    } catch {
        return { success: false, error: 'Could not fetch queue.' };
    }
};

// ─── Sub Island Drop ───────────────────────────────────────────────────────

/**
 * Submits a drop command or villager injection to a specific Sub Island.
 */
export const submitSubIslandDrop = async (
    islandId: string,
    islandName: string,
    commandText: string,
    plotNumber?: number,
    token?: string | null
): Promise<SubmitDropResponse> => {
    try {
        const res = await fetch(`${API_BASE}/api/order/drop-sub`, {
            method: 'POST',
            headers: getHeaders(token),
            credentials: 'include',
            body: JSON.stringify({
                island_id: islandId,
                island_name: islandName,
                command: commandText,
                plot_number: plotNumber,
                timestamp: Date.now(),
            }),
        });

        if (res.ok) {
            const data = await res.json();
            return {
                success: true,
                islandName,
                message: data.message || `Items dropped on ${islandName}! Fly in now.`,
            };
        }

        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error || 'Drop request failed');
    } catch (err) {
        throw err;
    }
};

// ─── Browser Notifications ─────────────────────────────────────────────────
export {
    requestNotificationPermission,
    requestNotificationPermissionDetailed,
    notifyOrderStatusChange as notifyOrderReady,
} from './orderNotifications';

// ─── Order History & Reorder ───────────────────────────────────────────────

const LOCAL_ORDER_HISTORY_KEY = 'chopaeng_order_history_v1';

export const getLocalOrderHistory = (userId?: string | null): OrderHistoryItem[] => {
    try {
        const uid = userId || getActiveUserId();
        const raw = getUserScopedItem(LOCAL_ORDER_HISTORY_KEY, uid);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

export const saveLocalOrderBackup = (order: Partial<OrderHistoryItem> & { id: string; command: string }, userId?: string | null): void => {
    try {
        const uid = userId || order.user_id || getActiveUserId();
        const existing = getLocalOrderHistory(uid);
        const updatedOrder: OrderHistoryItem = {
            id: order.id,
            user_id: order.user_id || uid || 'local_user',
            username: order.username || 'WebUser',
            command: order.command,
            order_type: order.order_type || 'order',
            status: order.status || 'queued',
            queue_position: order.queue_position,
            estimated_minutes: order.estimated_minutes,
            dodo_code: order.dodo_code,
            island_name: order.island_name || 'Sinta',
            message: order.message || '',
            created_at: order.created_at || Math.floor(Date.now() / 1000),
            updated_at: order.updated_at || Math.floor(Date.now() / 1000),
        };

        const filtered = existing.filter((o) => o.id !== order.id);
        const combined = [updatedOrder, ...filtered].slice(0, 50);
        setUserScopedItem(LOCAL_ORDER_HISTORY_KEY, JSON.stringify(combined), uid);
    } catch {
        /* Ignore storage errors */
    }
};

/**
 * Fetches the user's order history from the database (via backend API),
 * and falls back to local storage history if offline.
 */
export const fetchUserOrderHistory = async (
    token?: string | null
): Promise<UserOrderHistoryResponse> => {
    try {
        const res = await fetch(`${API_BASE}/api/order/user-history`, {
            headers: getHeaders(token),
            credentials: 'include',
        });

        if (res.ok) {
            const data: UserOrderHistoryResponse = await res.json();
            if (data.success && Array.isArray(data.orders)) {
                // Also merge with any unique local orders
                const localOrders = getLocalOrderHistory();
                const remoteIds = new Set(data.orders.map((o) => o.id));
                const uniqueLocals = localOrders.filter((o) => !remoteIds.has(o.id));
                const merged = [...data.orders, ...uniqueLocals].sort(
                    (a, b) => b.created_at - a.created_at
                );
                return { success: true, orders: merged };
            }
        }
    } catch {
        /* fallback to local storage */
    }

    const local = getLocalOrderHistory();
    return { success: true, orders: local };
};
