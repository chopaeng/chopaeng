/**
 * useNotificationHistory — tracks in-app order/alert notifications in localStorage.
 * The Navbar bell icon reads from this hook to show a history panel.
 */
import { useState, useCallback, useEffect } from 'react';

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

/** Read persisted notifications from localStorage */
const readStored = (): AppNotification[] => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

/** Write notifications to localStorage */
const writeStored = (notifications: AppNotification[]) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, MAX_HISTORY)));
    } catch { /* ignore storage errors */ }
};

/** Global CustomEvent name for pushing new notifications */
export const NOTIFICATION_HISTORY_EVENT = 'chopaeng_app_notification';

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
};

export const useNotificationHistory = () => {
    const [notifications, setNotifications] = useState<AppNotification[]>(readStored);

    const refresh = useCallback(() => {
        setNotifications(readStored());
    }, []);

    useEffect(() => {
        window.addEventListener(NOTIFICATION_HISTORY_EVENT, refresh);
        window.addEventListener('storage', refresh);
        return () => {
            window.removeEventListener(NOTIFICATION_HISTORY_EVENT, refresh);
            window.removeEventListener('storage', refresh);
        };
    }, [refresh]);

    const markAllRead = useCallback(() => {
        const updated = readStored().map(n => ({ ...n, read: true }));
        writeStored(updated);
        setNotifications(updated);
    }, []);

    const clearAll = useCallback(() => {
        writeStored([]);
        setNotifications([]);
    }, []);

    const unreadCount = notifications.filter(n => !n.read).length;

    return { notifications, unreadCount, markAllRead, clearAll };
};
