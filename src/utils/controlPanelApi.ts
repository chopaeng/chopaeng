import { DODO_API_BASE } from "../config/api";
import { getAuthToken } from "../context/authToken";
import type {
    FlightRecord,
    ControlPanelStats,
    ModActionPayload,
    ActionResponse,
    UserInspectResult,
    ActionHistoryItem,
} from "../types/controlPanel";

const getHeaders = (extra: Record<string, string> = {}): HeadersInit => {
    const token = getAuthToken();
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...extra,
    };
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
};

export const fetchControlPanelFeed = async (options: {
    limit?: number;
    since_id?: number;
    island?: string;
    status?: string;
    search?: string;
} = {}): Promise<{ flights: FlightRecord[]; count: number; server_time: number }> => {
    const params = new URLSearchParams();
    if (options.limit) params.set("limit", options.limit.toString());
    if (options.since_id) params.set("since_id", options.since_id.toString());
    if (options.island) params.set("island", options.island);
    if (options.status) params.set("status", options.status);
    if (options.search) params.set("search", options.search);

    const res = await fetch(`${DODO_API_BASE}/api/control-panel/live-feed?${params.toString()}`, {
        headers: getHeaders(),
        credentials: "include",
    });

    if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Failed to fetch live feed (Status: ${res.status})`);
    }

    return res.json();
};

export const fetchControlPanelStats = async (): Promise<ControlPanelStats> => {
    const res = await fetch(`${DODO_API_BASE}/api/control-panel/stats`, {
        headers: getHeaders(),
        credentials: "include",
    });

    if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Failed to fetch stats (Status: ${res.status})`);
    }

    return res.json();
};

export const executeModAction = async (payload: ModActionPayload): Promise<ActionResponse> => {
    const idempotencyKey = payload.idempotency_key || `cp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const res = await fetch(`${DODO_API_BASE}/api/control-panel/action`, {
        method: "POST",
        headers: getHeaders({ "X-Idempotency-Key": idempotencyKey }),
        credentials: "include",
        body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const error = new Error(data.error || "Action execution failed");
        (error as unknown as { code?: string; handled_by?: string }).code = data.code;
        (error as unknown as { code?: string; handled_by?: string }).handled_by = data.handled_by;
        throw error;
    }

    return data;
};

export const undoModAction = async (visitId: number): Promise<{ success: boolean; visit_id: number; review_status: string; message: string }> => {
    const res = await fetch(`${DODO_API_BASE}/api/control-panel/action/undo`, {
        method: "POST",
        headers: getHeaders(),
        credentials: "include",
        body: JSON.stringify({ visit_id: visitId }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data.error || "Undo failed");
    }

    return data;
};

export const bulkAuthoriseVerified = async (island?: string): Promise<{ success: boolean; authorised_count: number; message: string }> => {
    const res = await fetch(`${DODO_API_BASE}/api/control-panel/bulk-authorise`, {
        method: "POST",
        headers: getHeaders(),
        credentials: "include",
        body: JSON.stringify({ island: island || undefined, min_score: 90 }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data.error || "Bulk authorise failed");
    }

    return data;
};

export const fetchActionHistory = async (limit = 40): Promise<{ history: ActionHistoryItem[] }> => {
    const res = await fetch(`${DODO_API_BASE}/api/control-panel/history?limit=${limit}`, {
        headers: getHeaders(),
        credentials: "include",
    });

    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to fetch history");
    }

    return res.json();
};

export const inspectUser = async (params: { user_id?: string; ign?: string }): Promise<UserInspectResult> => {
    const qs = new URLSearchParams();
    if (params.user_id) qs.set("user_id", params.user_id);
    if (params.ign) qs.set("ign", params.ign);

    const res = await fetch(`${DODO_API_BASE}/api/control-panel/user-inspect?${qs.toString()}`, {
        headers: getHeaders(),
        credentials: "include",
    });

    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "User inspection failed");
    }

    return res.json();
};
