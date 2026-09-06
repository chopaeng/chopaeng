/**
 * Browser Notifications, Background Tab Alert & Audio Chime helper for Order Bot & Drop Bot
 */
import { playOrderAlertChime } from './kkAudioSynthesizer';

const LS_NOTIFICATION_PREF = 'chopaeng_order_notifications_enabled';
const LS_NOTIF_BANNER_DISMISSED = 'chopaeng_order_notif_banner_dismissed';

export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

export const isNotificationSupported = (): boolean => {
    return typeof window !== 'undefined' && 'Notification' in window;
};

export const getNotificationPermission = (): NotificationPermissionState => {
    if (!isNotificationSupported()) return 'unsupported';
    return Notification.permission as NotificationPermissionState;
};

export const areNotificationsEnabled = (): boolean => {
    try {
        const pref = localStorage.getItem(LS_NOTIFICATION_PREF);
        return pref !== null ? pref === 'true' : true;
    } catch {
        return true;
    }
};

export const setNotificationsEnabled = (enabled: boolean): void => {
    try {
        localStorage.setItem(LS_NOTIFICATION_PREF, String(enabled));
    } catch {
        // ignore
    }
};

export const isNotificationBannerDismissed = (): boolean => {
    try {
        return localStorage.getItem(LS_NOTIF_BANNER_DISMISSED) === 'true';
    } catch {
        return false;
    }
};

export const setNotificationBannerDismissed = (dismissed: boolean): void => {
    try {
        localStorage.setItem(LS_NOTIF_BANNER_DISMISSED, String(dismissed));
    } catch {
        // ignore
    }
};

export interface PermissionResult {
    granted: boolean;
    state: NotificationPermissionState;
    reason?: string;
}

export const requestNotificationPermissionDetailed = async (): Promise<PermissionResult> => {
    if (!isNotificationSupported()) {
        return {
            granted: false,
            state: 'unsupported',
            reason: 'Desktop notifications are not supported in your current browser or mode.',
        };
    }

    if (Notification.permission === 'granted') {
        setNotificationsEnabled(true);
        return { granted: true, state: 'granted' };
    }

    if (Notification.permission === 'denied') {
        setNotificationsEnabled(false);
        return {
            granted: false,
            state: 'denied',
            reason: 'Notifications are blocked in your browser site settings.',
        };
    }

    try {
        let result: NotificationPermission;
        if (typeof Notification.requestPermission === 'function') {
            try {
                result = await Notification.requestPermission();
            } catch {
                // Older WebKit / Safari callback fallback
                result = await new Promise((resolve) => Notification.requestPermission(resolve));
            }
        } else {
            result = 'default';
        }

        const granted = result === 'granted';
        setNotificationsEnabled(granted);

        let reason: string | undefined;
        if (!granted) {
            if (result === 'denied') {
                reason = 'Notification permission was denied.';
            } else {
                reason = 'Notification prompt was closed or suppressed by your browser.';
            }
        }

        return {
            granted,
            state: result as NotificationPermissionState,
            reason,
        };
    } catch (err: any) {
        return {
            granted: false,
            state: 'default',
            reason: err?.message || 'Failed to request notification permission.',
        };
    }
};

/**
 * Backward-compatible boolean-returning requestNotificationPermission
 */
export const requestNotificationPermission = async (): Promise<boolean> => {
    const res = await requestNotificationPermissionDetailed();
    return res.granted;
};

// ─── Background Tab Alert (Document Title Flasher) ───────────────────────────
let titleFlashTimer: ReturnType<typeof setInterval> | null = null;
let originalDocTitle = '';

export const startTabAlertFlashing = (alertMessage: string) => {
    if (typeof document === 'undefined') return;
    if (titleFlashTimer) clearInterval(titleFlashTimer);

    if (!originalDocTitle) {
        originalDocTitle = document.title || 'ChoPaeng · Order Bot';
    }

    let toggle = false;
    titleFlashTimer = setInterval(() => {
        document.title = toggle ? `🚨 ${alertMessage}` : originalDocTitle;
        toggle = !toggle;
    }, 1000);

    const onVisibleOrFocus = () => {
        if (!document.hidden) {
            stopTabAlertFlashing();
            document.removeEventListener('visibilitychange', onVisibleOrFocus);
            window.removeEventListener('focus', onVisibleOrFocus);
        }
    };

    document.addEventListener('visibilitychange', onVisibleOrFocus);
    window.addEventListener('focus', onVisibleOrFocus);
};

export const stopTabAlertFlashing = () => {
    if (titleFlashTimer) {
        clearInterval(titleFlashTimer);
        titleFlashTimer = null;
    }
    if (originalDocTitle && typeof document !== 'undefined') {
        document.title = originalDocTitle;
        originalDocTitle = '';
    }
};

/**
 * Fires an order notification (desktop push banner + audio chime + background tab flashing).
 */
export const notifyOrderStatusChange = (
    title: string,
    body: string,
    type: 'preparing' | 'ready' | 'alert' = 'ready'
) => {
    // 1. Play Audio Chime
    playOrderAlertChime(type);

    // 2. Background Tab Alert (instant notification even if user browses other tabs or blocked notifications)
    if (type === 'ready' && typeof document !== 'undefined' && (document.hidden || !document.hasFocus())) {
        startTabAlertFlashing('DODO CODE READY!');
    }

    // 3. Desktop Push Notification (if permitted & enabled)
    if (isNotificationSupported() && Notification.permission === 'granted' && areNotificationsEnabled()) {
        try {
            const notification = new Notification(title, {
                body,
                icon: 'https://dodo.ac/np/images/2/26/Gold_Nugget_NH_Inv_Icon.png',
                badge: '/icons/favicon-32x32.png',
                tag: 'chopaeng-order-status',
                requireInteraction: type === 'ready',
            });

            notification.onclick = () => {
                window.focus();
                stopTabAlertFlashing();
                if (window.location.pathname !== '/order') {
                    window.location.href = '/order';
                }
                notification.close();
            };
        } catch {
            // Mobile Chrome or ServiceWorker-only fallback
            if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && navigator.serviceWorker.ready) {
                navigator.serviceWorker.ready
                    .then((registration) => {
                        registration.showNotification(title, {
                            body,
                            icon: 'https://dodo.ac/np/images/2/26/Gold_Nugget_NH_Inv_Icon.png',
                            badge: '/icons/favicon-32x32.png',
                            tag: 'chopaeng-order-status',
                        });
                    })
                    .catch(() => {});
            }
        }
    }
};
