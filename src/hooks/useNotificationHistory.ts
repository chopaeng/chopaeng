/**
 * useNotificationHistory — tracks in-app order/alert notifications in localStorage and ChoBot database.
 * The Navbar bell icon reads from this hook to show a history panel.
 */
import { useState, useCallback, useEffect } from 'react';
import { getUserScopedItem, setUserScopedItem } from '../utils/accountStorage';
import { getAuthToken } from '../context/authToken';
import { API_BASE } from '../config/api';

export interface AppNotification {
    id: string;
    title: string;
    body: string;
    type: 'preparing' | 'ready' | 'alert' | 'info';
    timestamp: number;
    read: boolean;
}

const STORAGE_KEY = 'chopaeng_notification_history_v1';
const MAX_HISTORY = 30;

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

/** Read persisted notifications from user-scoped storage */
const readStored = (): AppNotification[] => {
    try {
        const raw = getUserScopedItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

/** Write notifications to user-scoped storage */
const writeStored = (notifications: AppNotification[]) => {
    try {
        setUserScopedItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, MAX_HISTORY)));
    } catch {
        /* ignore storage errors */
    }
};

/** Global CustomEvent name for pushing new notifications */
export const NOTIFICATION_HISTORY_EVENT = 'chopaeng_app_notification';

/**
 * Fetch notifications from ChoBot database for authenticated user
 */
export const fetchNotificationsFromDb = async (token?: string | null): Promise<AppNotification[] | null> => {
    const authToken = token ?? getAuthToken();
    if (!authToken) return null;

    try {
        const res = await fetch(`${API_BASE}/api/user/notifications`, {
            headers: getAuthHeaders(authToken),
            credentials: 'include',
        });
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.notifications)) {
                return data.notifications;
            }
        }
    } catch {
        // Fallback to local storage
    }
    return null;
};

/**
 * Push notification to ChoBot database
 */
export const pushNotificationToDb = async (
    entry: AppNotification,
    token?: string | null
): Promise<boolean> => {
    const authToken = token ?? getAuthToken();
    if (!authToken) return false;

    try {
        const res = await fetch(`${API_BASE}/api/user/notifications`, {
            method: 'POST',
            headers: getAuthHeaders(authToken),
            credentials: 'include',
            body: JSON.stringify(entry),
        });
        return res.ok;
    } catch {
        return false;
    }
};

/**
 * Mark notifications as read in ChoBot database
 */
export const markNotificationsReadInDb = async (token?: string | null): Promise<boolean> => {
    const authToken = token ?? getAuthToken();
    if (!authToken) return false;

    try {
        const res = await fetch(`${API_BASE}/api/user/notifications/read`, {
            method: 'POST',
            headers: getAuthHeaders(authToken),
            credentials: 'include',
        });
        return res.ok;
    } catch {
        return false;
    }
};

/**
 * Clear notifications in ChoBot database
 */
export const clearNotificationsInDb = async (token?: string | null): Promise<boolean> => {
    const authToken = token ?? getAuthToken();
    if (!authToken) return false;

    try {
        const res = await fetch(`${API_BASE}/api/user/notifications`, {
            method: 'DELETE',
            headers: getAuthHeaders(authToken),
            credentials: 'include',
        });
        return res.ok;
    } catch {
        return false;
    }
};

/**
 * Push a notification into the in-app history from anywhere in the codebase:
 *
 *   pushAppNotification({ title: 'Dodo Code Ready!', body: '...', type: 'ready' });
 */
export const pushAppNotification = (
    notification: Omit<AppNotification, 'id' | 'timestamp' | 'read'>
) => {
    const entry: AppNotification = {
        ...notification,
        id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        timestamp: Date.now(),
        read: false,
    };
    const existing = readStored();
    const updated = [entry, ...existing].slice(0, MAX_HISTORY);
    writeStored(updated);
    window.dispatchEvent(new CustomEvent(NOTIFICATION_HISTORY_EVENT, { detail: entry }));

    const token = getAuthToken();
    if (token) {
        pushNotificationToDb(entry, token).catch(() => {});
    }
};

export const useNotificationHistory = () => {
    const [notifications, setNotifications] = useState<AppNotification[]>(readStored);
    const [isSyncingDb, setIsSyncingDb] = useState(false);

    const refresh = useCallback(() => {
        setNotifications(readStored());
    }, []);

    const syncWithChoBot = useCallback((tokenOverride?: string | null) => {
        const token = tokenOverride !== undefined ? tokenOverride : getAuthToken();
        if (!token) {
            setNotifications(readStored());
            setIsSyncingDb(false);
            return;
        }
        setIsSyncingDb(true);
        fetchNotificationsFromDb(token)
            .then((remote) => {
                if (!remote) return;
                // Merge remote with local by ID
                const notifMap = new Map<string, AppNotification>();
                for (const n of remote) notifMap.set(n.id, n);
                for (const n of readStored()) {
                    if (!notifMap.has(n.id)) notifMap.set(n.id, n);
                }
                const merged = Array.from(notifMap.values())
                    .sort((a, b) => b.timestamp - a.timestamp)
                    .slice(0, MAX_HISTORY);
                writeStored(merged);
                setNotifications(merged);
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
            setNotifications(readStored());
            if (token) {
                syncWithChoBot(token);
            } else {
                setIsSyncingDb(false);
            }
        };

        window.addEventListener(NOTIFICATION_HISTORY_EVENT, refresh);
        window.addEventListener('chopaeng_account_switched', handleAuthOrAccountChange);
        window.addEventListener('chopaeng_auth_change', handleAuthOrAccountChange);
        window.addEventListener('storage', refresh);
        return () => {
            window.removeEventListener(NOTIFICATION_HISTORY_EVENT, refresh);
            window.removeEventListener('chopaeng_account_switched', handleAuthOrAccountChange);
            window.removeEventListener('chopaeng_auth_change', handleAuthOrAccountChange);
            window.removeEventListener('storage', refresh);
        };
    }, [refresh, syncWithChoBot]);

    const markAllRead = useCallback(() => {
        const updated = readStored().map((n) => ({ ...n, read: true }));
        writeStored(updated);
        setNotifications(updated);
        const token = getAuthToken();
        if (token) {
            markNotificationsReadInDb(token).catch(() => {});
        }
    }, []);

    const clearAll = useCallback(() => {
        writeStored([]);
        setNotifications([]);
        const token = getAuthToken();
        if (token) {
            clearNotificationsInDb(token).catch(() => {});
        }
    }, []);

    const unreadCount = notifications.filter((n) => !n.read).length;

    return { notifications, unreadCount, markAllRead, clearAll, isSyncingDb };
};
