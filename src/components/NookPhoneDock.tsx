import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    THEME_OPTIONS,
    getStoredTheme,
    setStoredTheme,
    type ThemeMode,
} from '../utils/theme';
import { playChimeClick } from '../utils/kkAudioSynthesizer';
import { pollOrderStatus, type OrderStatusResponse } from '../utils/orderBotApi';
import { getAuthToken } from '../context/authToken';
import { hourlyBgm, type HourlyBgmState, type BgmWeather } from '../utils/hourlyBgmEngine';
import {
    notifyOrderStatusChange,
    requestNotificationPermission,
    getNotificationPermission,
    areNotificationsEnabled,
    setNotificationsEnabled,
} from '../utils/orderNotifications';
import { openSuggestionModal } from '../utils/suggestionsApi';
import { useIslandData } from '../context/useIslandData';
import {
    openCommunityModal,
    calculateIslandOccupancy,
    getTrafficStats,
    type TrafficStats,
} from '../utils/communityPresenceApi';

const LS_ORDER_KEY = 'chopaeng_active_order';
const POLL_INTERVAL = 3_500; // Fast 3.5s real-time AJAX polling

const THEME_CASE_STYLES: Record<ThemeMode, {
    caseBg: string;
    bezelBorder: string;
    screenBg: string;
    isDark: boolean;
    headerBadgeBg: string;
    headerBadgeText: string;
    accentGlow: string;
    accentColor: string;
}> = {
    nook: {
        caseBg: 'linear-gradient(150deg, #38b26e, #237b4b)',
        bezelBorder: '#1d603a',
        screenBg: '#fffdfa',
        isDark: false,
        headerBadgeBg: '#dcfce7',
        headerBadgeText: '#15803d',
        accentGlow: 'rgba(56, 178, 110, 0.4)',
        accentColor: '#16a34a',
    },
    celeste: {
        caseBg: 'linear-gradient(150deg, #3730a3, #1e1b4b)',
        bezelBorder: '#4f46e5',
        screenBg: '#0f172a',
        isDark: true,
        headerBadgeBg: '#ede9fe',
        headerBadgeText: '#6d28d9',
        accentGlow: 'rgba(139, 92, 246, 0.45)',
        accentColor: '#8b5cf6',
    },
    roost: {
        caseBg: 'linear-gradient(150deg, #5e351d, #381e11)',
        bezelBorder: '#78350f',
        screenBg: '#1c1917',
        isDark: true,
        headerBadgeBg: '#fef3c7',
        headerBadgeText: '#b45309',
        accentGlow: 'rgba(217, 119, 6, 0.4)',
        accentColor: '#b45309',
    },
    sakura: {
        caseBg: 'linear-gradient(150deg, #f472b6, #db2777)',
        bezelBorder: '#be185d',
        screenBg: '#fdf2f8',
        isDark: false,
        headerBadgeBg: '#fce7f3',
        headerBadgeText: '#be185d',
        accentGlow: 'rgba(244, 114, 182, 0.45)',
        accentColor: '#ec4899',
    },
    dal: {
        caseBg: 'linear-gradient(150deg, #0284c7, #0f172a)',
        bezelBorder: '#38bdf8',
        screenBg: '#0f172a',
        isDark: true,
        headerBadgeBg: '#e0f2fe',
        headerBadgeText: '#0369a1',
        accentGlow: 'rgba(56, 189, 248, 0.45)',
        accentColor: '#0284c7',
    },
    nooklink: {
        caseBg: 'linear-gradient(150deg, #111827, #030712)',
        bezelBorder: '#10b981',
        screenBg: '#090d16',
        isDark: true,
        headerBadgeBg: '#d1fae5',
        headerBadgeText: '#047857',
        accentGlow: 'rgba(16, 185, 129, 0.45)',
        accentColor: '#10b981',
    },
};

export const NookPhoneDock: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [currentTheme, setCurrentTheme] = useState<ThemeMode>(getStoredTheme);
    const [currentTimeStr, setCurrentTimeStr] = useState<string>('');

    // Order Tracking State inside NookPhone
    const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
    const [orderStatus, setOrderStatus] = useState<OrderStatusResponse | null>(null);
    const [notificationsOn, setNotificationsOn] = useState<boolean>(() => areNotificationsEnabled() && getNotificationPermission() === 'granted');

    // Audio & Island BGM / KK Slider State
    const [hourlyState, setHourlyState] = useState<HourlyBgmState>(() => hourlyBgm.getState());
    const { islands } = useIslandData();
    const [trafficStats, setTrafficStats] = useState<TrafficStats>(getTrafficStats);

    const occupancy = useMemo(() => calculateIslandOccupancy(islands), [islands]);

    const previousStatusRef = useRef<string | null>(null);
    const previousDodoRef = useRef<string | null>(null);
    const phoneRef = useRef<HTMLDivElement | null>(null);
    const navigate = useNavigate();
    const location = useLocation();
    const token = getAuthToken();

    // Subscribe to real-time Island BGM updates
    useEffect(() => {
        const unsubscribe = hourlyBgm.subscribe((newState) => {
            setHourlyState(newState);
        });
        return unsubscribe;
    }, []);

    // Keep live clock updated
    useEffect(() => {
        const updateTime = () => {
            const now = new Date();
            setCurrentTimeStr(
                now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            );
        };
        updateTime();
        const timer = setInterval(updateTime, 10000);
        return () => clearInterval(timer);
    }, []);

    // Sync theme updates
    useEffect(() => {
        const handleThemeUpdate = (e: any) => {
            if (e.detail?.theme) {
                setCurrentTheme(e.detail.theme);
            }
        };
        window.addEventListener('chopaeng_theme_updated', handleThemeUpdate);
        const handleTraffic = (e: any) => { if (e.detail) setTrafficStats(e.detail); };
        window.addEventListener('chopaeng_traffic_updated', handleTraffic);
        return () => {
            window.removeEventListener('chopaeng_theme_updated', handleThemeUpdate);
            window.removeEventListener('chopaeng_traffic_updated', handleTraffic);
        };
    }, []);

    // Read active order from localStorage
    const checkActiveOrder = useCallback(() => {
        try {
            const raw = localStorage.getItem(LS_ORDER_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed?.orderId && typeof parsed.orderId === 'string' && parsed.orderId.trim()) {
                    setActiveOrderId(parsed.orderId.trim());
                    return parsed.orderId.trim();
                }
            }
        } catch {
            // ignore
        }
        localStorage.removeItem(LS_ORDER_KEY);
        setActiveOrderId(null);
        setOrderStatus(null);
        return null;
    }, []);

    const pollStatus = useCallback(async (orderId: string) => {
        try {
            const status = await pollOrderStatus(orderId, token);

            // If order is completed, cancelled, error, or not found, clean up immediately
            if (!status || ['completed', 'cancelled', 'error'].includes(status.status)) {
                localStorage.removeItem(LS_ORDER_KEY);
                setActiveOrderId(null);
                setOrderStatus(null);
                return;
            }

            setOrderStatus(status);

            // Check for state transitions and alert the user
            const prev = previousStatusRef.current;
            const current = status.status;
            const currentDodo = status.dodoCode;

            if (prev && prev !== current) {
                if (current === 'preparing' && prev === 'queued') {
                    notifyOrderStatusChange(
                        'Order Preparing!',
                        'Your items are now being spawned on the island...',
                        'preparing'
                    );
                } else if (current === 'ready' || (currentDodo && currentDodo !== previousDodoRef.current)) {
                    notifyOrderStatusChange(
                        'Dodo Flight Pass Ready!',
                        `Dodo Code: ${currentDodo || 'ACTIVE'}. Click to view your boarding pass!`,
                        'ready'
                    );
                }
            } else if (!prev && (current === 'ready' || currentDodo)) {
                if (currentDodo && currentDodo !== previousDodoRef.current) {
                    notifyOrderStatusChange(
                        'Dodo Flight Pass Ready!',
                        `Dodo Code: ${currentDodo}. Click to view your boarding pass!`,
                        'ready'
                    );
                }
            }

            previousStatusRef.current = current;
            if (currentDodo) previousDodoRef.current = currentDodo;
        } catch {
            // On network error or 404, don't invent a false active queue
            setOrderStatus(null);
        }
    }, [token]);

    useEffect(() => {
        const id = checkActiveOrder();
        if (id) {
            pollStatus(id);
        }

        const handleStorage = () => {
            const currentId = checkActiveOrder();
            if (currentId) pollStatus(currentId);
        };

        const handleOrderCreated = (e: any) => {
            const newId = e.detail?.orderId || checkActiveOrder();
            if (newId) {
                setActiveOrderId(newId);
                pollStatus(newId);
            }
        };

        const handleOrderCleared = () => {
            setActiveOrderId(null);
            setOrderStatus(null);
        };

        window.addEventListener('storage', handleStorage);
        window.addEventListener('chopaeng_order_created', handleOrderCreated);
        window.addEventListener('chopaeng_order_cleared', handleOrderCleared);

        const timer = setInterval(() => {
            const currentId = checkActiveOrder();
            if (currentId) pollStatus(currentId);
        }, POLL_INTERVAL);

        return () => {
            window.removeEventListener('storage', handleStorage);
            window.removeEventListener('chopaeng_order_created', handleOrderCreated);
            window.removeEventListener('chopaeng_order_cleared', handleOrderCleared);
            clearInterval(timer);
        };
    }, [checkActiveOrder, pollStatus]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (phoneRef.current && !phoneRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const togglePhone = () => {
        playChimeClick();
        setIsOpen(!isOpen);
    };

    const handleAppClick = (action: () => void) => {
        playChimeClick();
        action();
        setIsOpen(false);
    };

    const handleToggleNotifications = async () => {
        playChimeClick();
        if (!notificationsOn) {
            const granted = await requestNotificationPermission();
            setNotificationsOn(granted);
            if (granted) {
                notifyOrderStatusChange('ChoPaeng Flight Alerts', 'You will be notified when your Dodo flight is ready!', 'preparing');
            }
        } else {
            setNotificationsEnabled(false);
            setNotificationsOn(false);
        }
    };

    const handleToggleBgmPlay = () => {
        playChimeClick();
        hourlyBgm.togglePlay();
    };

    const handleWeatherChange = (weather: BgmWeather) => {
        playChimeClick();
        hourlyBgm.setWeather(weather);
        if (!hourlyState.isPlaying) {
            hourlyBgm.play();
        }
    };

    const handleOpenKKJukebox = () => {
        playChimeClick();
        window.dispatchEvent(new CustomEvent('chopaeng_open_jukebox'));
        setIsOpen(false);
    };

    const currentStyle = THEME_CASE_STYLES[currentTheme] || THEME_CASE_STYLES.nook;

    const orderStateStatus = orderStatus?.status;
    const isOrderReady = orderStateStatus === 'ready' || Boolean(orderStatus?.dodoCode);
    const isOrderPreparing = orderStateStatus === 'preparing';
    const queuePos = typeof orderStatus?.queuePosition === 'number' && orderStatus.queuePosition > 0 ? orderStatus.queuePosition : undefined;
    const dodoCode = orderStatus?.dodoCode;

    const hasActiveOrder = Boolean(
        activeOrderId &&
        orderStatus &&
        ['queued', 'preparing', 'ready'].includes(orderStateStatus || '') &&
        (isOrderReady || isOrderPreparing || queuePos !== undefined)
    );

    const apps = [
        {
            name: 'Order Bot',
            icon: 'fa-paper-plane',
            bg: 'linear-gradient(135deg, #0284c7, #0369a1)',
            action: () => navigate('/order'),
            badge: hasActiveOrder,
        },
        {
            name: 'Find Items',
            icon: 'fa-magnifying-glass',
            bg: 'linear-gradient(135deg, #10b981, #059669)',
            action: () => navigate('/find'),
        },
        {
            name: 'Trip Planner',
            icon: 'fa-route',
            bg: 'linear-gradient(135deg, #6366f1, #4f46e5)',
            action: () => navigate('/planner'),
        },
        {
            name: 'Passport',
            icon: 'fa-id-card',
            bg: 'linear-gradient(135deg, #16a34a, #15803d)',
            action: () => navigate('/profile'),
        },
        {
            name: 'Pockets',
            icon: 'fa-box-archive',
            bg: 'linear-gradient(135deg, #eab308, #ca8a04)',
            action: () => navigate('/pockets'),
        },
        {
            name: 'Catalogue',
            icon: 'fa-boxes-stacked',
            bg: 'linear-gradient(135deg, #0d9488, #0f766e)',
            action: () => navigate('/catalog'),
        },
        {
            name: 'Destinations',
            icon: 'fa-plane-departure',
            bg: 'linear-gradient(135deg, #06b6d4, #0891b2)',
            action: () => navigate('/islands'),
        },
        {
            name: 'Island Radar',
            icon: 'fa-satellite-dish',
            bg: 'linear-gradient(135deg, #059669, #047857)',
            action: () => openCommunityModal('online'),
            badge: occupancy.totalVisitors > 0,
        },
        {
            name: 'K.K. Jukebox',
            icon: 'fa-guitar',
            bg: 'linear-gradient(135deg, #f59e0b, #d97706)',
            action: () => {
                window.dispatchEvent(new CustomEvent('chopaeng_open_jukebox'));
            },
        },
        {
            name: 'Voice Studio',
            icon: 'fa-comment-dots',
            bg: 'linear-gradient(135deg, #ec4899, #db2777)',
            action: () => {
                window.dispatchEvent(new CustomEvent('chopaeng_open_animalese_modal'));
            },
        },
        {
            name: 'Wishlist',
            icon: 'fa-heart',
            bg: 'linear-gradient(135deg, #ef4444, #dc2626)',
            action: () => navigate('/wishlist'),
        },
        {
            name: 'Suggest',
            icon: 'fa-lightbulb',
            bg: 'linear-gradient(135deg, #e11d48, #be123c)',
            action: () => openSuggestionModal(),
        },
    ];

    return (
        <div ref={phoneRef}>
            <style>{`
                .nookphone-screen-body {
                    -webkit-overflow-scrolling: touch;
                    overscroll-behavior: contain;
                    scrollbar-width: thin;
                }
                @keyframes eqPulse {
                    0%, 100% { height: 3px; }
                    50% { height: 11px; }
                }
                .nookphone-eq-bar {
                    width: 2.5px;
                    background-color: var(--ac-primary, #16a34a);
                    border-radius: 1px;
                    display: inline-block;
                    animation: eqPulse 0.8s ease-in-out infinite;
                }
                .nookphone-eq-bar.bar-1 { animation-delay: 0s; }
                .nookphone-eq-bar.bar-2 { animation-delay: 0.25s; }
                .nookphone-eq-bar.bar-3 { animation-delay: 0.5s; }

                /* NookPhone Squircle App Icon Aesthetics */
                .nook-app-icon-squircle {
                    position: relative;
                    width: 52px;
                    height: 52px;
                    border-radius: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15), inset 0 1px 1px rgba(255, 255, 255, 0.35);
                    border: 1px solid rgba(255, 255, 255, 0.22);
                    transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
                }
                .nook-app-icon-squircle:hover {
                    transform: translateY(-3px) scale(1.06);
                    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.24), inset 0 1px 1px rgba(255, 255, 255, 0.45);
                }
                .nook-app-icon-squircle:active {
                    transform: scale(0.94);
                }

                @media (max-width: 575px) {
                    .nookphone-container {
                        right: 12px !important;
                        left: 12px !important;
                        margin: 0 auto !important;
                        bottom: 84px !important;
                    }
                }
            `}</style>

            {/* Floating NookPhone Button with Live Order Notification Badge */}
            <div
                className="position-fixed"
                style={{
                    bottom: '24px',
                    right: '24px',
                    zIndex: 1050,
                }}
            >
                <button
                    type="button"
                    onClick={togglePhone}
                    className="btn rounded-circle shadow-lg d-flex align-items-center justify-content-center p-0 transition-all position-relative"
                    style={{
                        width: '56px',
                        height: '56px',
                        backgroundColor: '#fffdfa',
                        border: `3px solid ${currentStyle.bezelBorder}`,
                        boxShadow: `0 10px 28px ${currentStyle.accentGlow}, 0 2px 8px rgba(0,0,0,0.12)`,
                        transform: isOpen ? 'scale(0.92)' : 'scale(1)',
                    }}
                    title={isOpen ? 'Close NookPhone' : 'Open NookPhone Apps'}
                    aria-label="Toggle NookPhone"
                >
                    <div
                        className="rounded-circle d-flex align-items-center justify-content-center text-white"
                        style={{
                            width: '44px',
                            height: '44px',
                            background: currentStyle.caseBg,
                        }}
                    >
                        <i className={`fa-solid ${isOpen ? 'fa-xmark' : 'fa-mobile-screen'}`} style={{ fontSize: '1.25rem' }} />
                    </div>

                    {/* Active Order Radar Beacon / Badge */}
                    {hasActiveOrder && location.pathname !== '/order' && (
                        <span
                            className="position-absolute top-0 start-100 translate-middle badge rounded-pill border border-white shadow-sm d-inline-flex align-items-center"
                            style={{
                                backgroundColor: isOrderReady ? '#22c55e' : isOrderPreparing ? '#f59e0b' : '#3b82f6',
                                fontSize: '0.68rem',
                                padding: '0.35rem 0.5rem',
                                animation: isOrderReady ? 'pulse 1.5s infinite' : 'none',
                            }}
                        >
                            {isOrderReady ? (
                                <>
                                    <i className="fa-solid fa-plane-departure me-1" aria-hidden="true" />
                                    DODO
                                </>
                            ) : isOrderPreparing ? (
                                <>
                                    <i className="fa-solid fa-bolt me-1" aria-hidden="true" />
                                    PREP
                                </>
                            ) : (
                                `#${queuePos || 1}`
                            )}
                        </span>
                    )}
                </button>
            </div>

            {/* NookPhone Modal / Slide-out UI — header (grill + status + title) stays put,
                only the body (tracker/apps/theme) scrolls. maxHeight is bounded to the
                viewport so there's always a scrollable region instead of the panel
                silently growing past the top of the screen. */}
            {isOpen && (
                <div
                    className="nookphone-container position-fixed shadow-2xl animate-up d-flex flex-column"
                    style={{
                        bottom: '90px',
                        right: '24px',
                        zIndex: 1055,
                        width: '350px',
                        maxWidth: 'calc(100vw - 24px)',
                        maxHeight: 'min(620px, calc(100dvh - 110px))',
                        background: currentStyle.caseBg,
                        borderRadius: '42px',
                        padding: '14px 12px 14px 12px',
                        border: `4px solid ${currentStyle.bezelBorder}`,
                        boxShadow: `0 24px 50px rgba(0,0,0,0.4), 0 0 24px ${currentStyle.accentGlow}`,
                    }}
                >
                    {/* Top Speaker Grill */}
                    <div className="d-flex align-items-center justify-content-center gap-2 mb-2 flex-shrink-0">
                        <div className="rounded-circle bg-dark opacity-40" style={{ width: '6px', height: '6px' }} />
                        <div className="rounded-pill bg-dark opacity-40" style={{ width: '42px', height: '4px' }} />
                    </div>

                    {/* Phone Bezel Inner Screen — flex column so the header can stay fixed
                        and only the body scrolls */}
                    <div
                        className="rounded-4 overflow-hidden position-relative d-flex flex-column flex-grow-1"
                        style={{
                            backgroundColor: currentStyle.screenBg,
                            color: currentStyle.isDark ? '#f8fafc' : '#1e293b',
                            minHeight: 0,
                            border: `1.5px solid ${currentStyle.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                            boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.06)',
                        }}
                    >
                        {/* Authentic Animal Crossing Status Bar */}
                        <div className="flex-shrink-0 px-3 pt-2.5 pb-2">
                            <div
                                className="d-flex align-items-center justify-content-between pb-2 mb-2 border-bottom font-monospace"
                                style={{
                                    borderColor: currentStyle.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                                    fontSize: '0.72rem',
                                }}
                            >
                                {/* Left: Signal & WiFi */}
                                <div className="d-flex align-items-center gap-1.5 opacity-75">
                                    <i className="fa-solid fa-signal" style={{ fontSize: '0.62rem' }} title="NookLink Signal 5G" />
                                    <i className="fa-solid fa-wifi" style={{ fontSize: '0.62rem' }} title="Island Wi-Fi Connected" />
                                </div>

                                {/* Center: Leaf Brand */}
                                <div className="d-flex align-items-center gap-1 fw-black ac-font" style={{ fontSize: '0.78rem' }}>
                                    <i className="fa-solid fa-leaf" style={{ color: currentStyle.accentColor }} />
                                    <span style={{ letterSpacing: '0.02em' }}>NookPhone</span>
                                </div>

                                {/* Right: Clock, Notification Toggle, Battery */}
                                <div className="d-flex align-items-center gap-1.5">
                                    <span className="fw-bold opacity-80" style={{ fontSize: '0.72rem' }}>
                                        {currentTimeStr || '12:00 PM'}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={handleToggleNotifications}
                                        className="btn btn-link p-0 border-0 text-decoration-none lh-1"
                                        style={{ color: notificationsOn ? '#22c55e' : (currentStyle.isDark ? '#94a3b8' : '#64748b'), fontSize: '0.68rem' }}
                                        title={notificationsOn ? 'Flight Alerts Active' : 'Enable Flight Alerts'}
                                    >
                                        <i className={`fa-solid ${notificationsOn ? 'fa-bell' : 'fa-bell-slash'}`} />
                                    </button>
                                    <i className="fa-solid fa-battery-full text-success" style={{ fontSize: '0.75rem' }} title="Battery 100%" />
                                </div>
                            </div>
                        </div>

                        {/* Scrollable body */}
                        <div className="nookphone-screen-body flex-grow-1 overflow-y-auto px-3 pb-3" style={{ minHeight: 0 }}>
                            {/* ── LIVE ISLAND TRAFFIC & COMMUNITY RADAR BANNER ── */}
                            <div
                                className="p-2.5 rounded-3 mb-3 border shadow-xs animate-up"
                                style={{
                                    backgroundColor: currentStyle.isDark ? 'rgba(34, 197, 94, 0.12)' : '#f0fdf4',
                                    borderColor: currentStyle.isDark ? 'rgba(34, 197, 94, 0.3)' : '#86efac',
                                    cursor: 'pointer',
                                }}
                                onClick={() => {
                                    playChimeClick();
                                    openCommunityModal('online');
                                    setIsOpen(false);
                                }}
                                role="button"
                                tabIndex={0}
                            >
                                <div className="d-flex align-items-center justify-content-between mb-1">
                                    <div className="d-flex align-items-center gap-1.5">
                                        <span className="spinner-grow spinner-grow-sm text-success" style={{ width: 8, height: 8 }} />
                                        <span className="fw-black text-uppercase" style={{ fontSize: '0.72rem', color: '#16a34a' }}>
                                            Island Radar &amp; Traffic
                                        </span>
                                    </div>
                                    <span className="tiny-text fw-bold text-success d-inline-flex align-items-center gap-1">
                                        Live <i className="fa-solid fa-arrow-right" style={{ fontSize: '0.65rem' }} aria-hidden="true" />
                                    </span>
                                </div>
                                <div className="d-flex align-items-center justify-content-between text-muted" style={{ fontSize: '0.74rem' }}>
                                    <span className="d-inline-flex align-items-center gap-1">
                                        <i className="fa-solid fa-umbrella-beach text-success" aria-hidden="true" />
                                        <span><strong>{occupancy.totalVisitors}</strong> on Islands</span>
                                    </span>
                                    <span className="d-inline-flex align-items-center gap-1">
                                        <i className="fa-solid fa-users text-primary" aria-hidden="true" />
                                        <span><strong>{trafficStats.activeOnlineCount}</strong> Online</span>
                                    </span>
                                    <span className="d-inline-flex align-items-center gap-1">
                                        <i className="fa-solid fa-plane-departure text-info" aria-hidden="true" />
                                        <span><strong>2.8M</strong> Visits</span>
                                    </span>
                                </div>
                            </div>

                            {/* ── LIVE ORDER TRACKER PILL ── */}
                            {hasActiveOrder && (
                                <div
                                    className="p-2.5 rounded-3 mb-3 border shadow-xs animate-up"
                                    style={{
                                        backgroundColor: isOrderReady
                                            ? (currentStyle.isDark ? 'rgba(34, 197, 94, 0.15)' : '#f0fdf4')
                                            : isOrderPreparing
                                                ? (currentStyle.isDark ? 'rgba(245, 158, 11, 0.15)' : '#fffbeb')
                                                : (currentStyle.isDark ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff'),
                                        borderColor: isOrderReady
                                            ? '#86efac'
                                            : isOrderPreparing
                                                ? '#fcd34d'
                                                : '#93c5fd',
                                    }}
                                >
                                    <div className="d-flex align-items-center justify-content-between mb-1.5">
                                        <div className="d-flex align-items-center gap-1.5">
                                            <span
                                                className={`spinner-grow spinner-grow-sm ${isOrderReady ? 'text-success' : isOrderPreparing ? 'text-warning' : 'text-primary'
                                                    }`}
                                                role="status"
                                                style={{ width: '10px', height: '10px' }}
                                            />
                                            <span className="fw-black x-small text-uppercase tracking-wider d-inline-flex align-items-center gap-1">
                                                {isOrderReady ? (
                                                    <>
                                                        <i className="fa-solid fa-plane-departure text-success" aria-hidden="true" />
                                                        Flight Ready
                                                    </>
                                                ) : isOrderPreparing ? (
                                                    <>
                                                        <i className="fa-solid fa-hammer text-warning" aria-hidden="true" />
                                                        Preparing Items
                                                    </>
                                                ) : (
                                                    <>
                                                        <i className="fa-solid fa-hourglass-half text-primary" aria-hidden="true" />
                                                        Queue #{queuePos || 1}
                                                    </>
                                                )}
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleAppClick(() => navigate('/order'))}
                                            className="btn btn-xs btn-outline-secondary py-0 px-2 rounded-pill x-small fw-bold"
                                            style={{ fontSize: '0.68rem' }}
                                        >
                                            View Radar <i className="fa-solid fa-arrow-right ms-1" />
                                        </button>
                                    </div>

                                    {dodoCode ? (
                                        <div className="d-flex align-items-center justify-content-between bg-white bg-opacity-75 p-1.5 px-2 rounded-2 border">
                                            <span className="fw-black text-success font-monospace" style={{ fontSize: '0.95rem', letterSpacing: '1px' }}>
                                                DODO: {dodoCode}
                                            </span>
                                            <span className="badge bg-success bg-opacity-10 text-success rounded-pill px-2 py-1 tiny-text fw-bold d-inline-flex align-items-center gap-1">
                                                <i className="fa-solid fa-plane-departure" /> Ready
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="x-small text-muted fw-bold">
                                            {isOrderPreparing
                                                ? 'Generating Dodo flight code now...'
                                                : `Estimated flight wait: ~${(queuePos || 1) * 2} mins`}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── ISLAND BGM & K.K. SLIDER STATION ── */}
                            <div
                                className="p-2.5 rounded-3 mb-3 border shadow-xs animate-up"
                                style={{
                                    backgroundColor: currentStyle.isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                                    borderColor: currentStyle.isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                                }}
                            >
                                <div className="d-flex align-items-center justify-content-between mb-2">
                                    <div className="d-flex align-items-center gap-2 overflow-hidden">
                                        <div
                                            className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                                            style={{
                                                width: '32px',
                                                height: '32px',
                                                background: hourlyState.isPlaying
                                                    ? 'linear-gradient(135deg, #10b981, #059669)'
                                                    : 'linear-gradient(135deg, #64748b, #475569)',
                                                color: '#ffffff',
                                                fontSize: '0.85rem',
                                            }}
                                        >
                                            <i className={`fa-solid ${hourlyState.isPlaying ? 'fa-compact-disc fa-spin' : 'fa-music'}`} />
                                        </div>
                                        <div className="overflow-hidden">
                                            <div className="d-flex align-items-center gap-1.5">
                                                <span className="fw-black text-truncate d-inline-flex align-items-center gap-1" style={{ fontSize: '0.78rem' }}>
                                                    <span>{hourlyState.currentTrack.period} •</span>
                                                    {hourlyState.weather === 'snowy' ? (
                                                        <>
                                                            <span>Snow</span>
                                                            <i className="fa-solid fa-snowflake text-info ms-0.5" style={{ fontSize: '0.72rem' }} aria-hidden="true" />
                                                        </>
                                                    ) : hourlyState.weather === 'rainy' ? (
                                                        <>
                                                            <span>Rain</span>
                                                            <i className="fa-solid fa-cloud-showers-heavy text-primary ms-0.5" style={{ fontSize: '0.72rem' }} aria-hidden="true" />
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span>Sunny</span>
                                                            <i className="fa-solid fa-sun text-warning ms-0.5" style={{ fontSize: '0.72rem' }} aria-hidden="true" />
                                                        </>
                                                    )}
                                                </span>
                                                {hourlyState.isPlaying && (
                                                    <div className="d-flex align-items-end gap-0.5" style={{ height: '10px' }}>
                                                        <span className="nookphone-eq-bar bar-1" />
                                                        <span className="nookphone-eq-bar bar-2" />
                                                        <span className="nookphone-eq-bar bar-3" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="text-muted text-truncate" style={{ fontSize: '0.65rem' }}>
                                                {hourlyState.isPlaying ? 'Live Island BGM Playing' : 'Tap to start 24h Island BGM'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Play / Pause button */}
                                    <button
                                        type="button"
                                        onClick={handleToggleBgmPlay}
                                        className="btn btn-sm rounded-circle d-flex align-items-center justify-content-center shadow-xs flex-shrink-0"
                                        style={{
                                            width: '32px',
                                            height: '32px',
                                            backgroundColor: hourlyState.isPlaying ? '#ef4444' : currentStyle.accentColor,
                                            color: '#ffffff',
                                            border: 'none',
                                        }}
                                        title={hourlyState.isPlaying ? 'Pause Island BGM' : 'Play Island BGM'}
                                    >
                                        <i className={`fa-solid ${hourlyState.isPlaying ? 'fa-pause' : 'fa-play'}`} style={{ fontSize: '0.8rem', marginLeft: hourlyState.isPlaying ? '0' : '2px' }} />
                                    </button>
                                </div>

                                {/* Weather & Jukebox Quick Actions */}
                                <div className="d-flex align-items-center justify-content-between pt-1 border-top" style={{ borderColor: currentStyle.isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)' }}>
                                    <div className="d-flex align-items-center gap-1">
                                        <span className="opacity-60 me-1" style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase' }}>
                                            Weather
                                        </span>
                                        {([
                                            { key: 'sunny' as const, icon: 'fa-sun', color: '#eab308', label: 'Sunny' },
                                            { key: 'rainy' as const, icon: 'fa-cloud-showers-heavy', color: '#38bdf8', label: 'Rainy' },
                                            { key: 'snowy' as const, icon: 'fa-snowflake', color: '#a5f3fc', label: 'Snowy' },
                                        ]).map(({ key, icon, color, label }) => {
                                            const isActive = hourlyState.weather === key;
                                            return (
                                                <button
                                                    key={key}
                                                    type="button"
                                                    onClick={() => handleWeatherChange(key)}
                                                    className={`btn btn-xs py-0 px-2 rounded-pill fw-bold border-0 transition-all d-inline-flex align-items-center justify-content-center ${
                                                        isActive ? 'shadow-xs' : 'opacity-60 hover-opacity-100'
                                                    }`}
                                                    style={{
                                                        height: '22px',
                                                        fontSize: '0.72rem',
                                                        backgroundColor: isActive ? (currentStyle.isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.08)') : 'transparent',
                                                        color: isActive ? color : (currentStyle.isDark ? '#e2e8f0' : '#475569'),
                                                    }}
                                                    title={label}
                                                    aria-label={label}
                                                >
                                                    <i className={`fa-solid ${icon}`} aria-hidden="true" />
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={handleOpenKKJukebox}
                                        className="btn btn-xs btn-link p-0 text-decoration-none fw-bold d-flex align-items-center gap-1"
                                        style={{ fontSize: '0.68rem', color: currentStyle.accentColor }}
                                    >
                                        <i className="fa-solid fa-guitar" />
                                        <span>K.K. Slider</span>
                                    </button>
                                </div>
                            </div>

                            {/* Apps Grid (3x4) */}
                            <div className="row g-2 mb-3">
                                {apps.map((app, idx) => (
                                    <div className="col-4 text-center" key={idx}>
                                        <button
                                            type="button"
                                            onClick={() => handleAppClick(app.action)}
                                            className="btn p-0 border-0 d-flex flex-column align-items-center gap-1 w-100"
                                        >
                                            <div
                                                className="nook-app-icon-squircle text-white"
                                                style={{
                                                    background: app.bg,
                                                    fontSize: '1.25rem',
                                                }}
                                            >
                                                <i className={`fa-solid ${app.icon}`} />
                                                {app.badge && (
                                                    <span
                                                        className="position-absolute top-0 start-100 translate-middle p-1 bg-danger border border-light rounded-circle shadow-xs"
                                                        style={{ width: '10px', height: '10px' }}
                                                    >
                                                        <span className="visually-hidden">Notification</span>
                                                    </span>
                                                )}
                                            </div>
                                            <span
                                                className="fw-bold text-truncate"
                                                style={{
                                                    fontSize: '0.68rem',
                                                    maxWidth: '72px',
                                                    color: currentStyle.isDark ? '#e2e8f0' : '#334155',
                                                }}
                                            >
                                                {app.name}
                                            </span>
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {/* ── RESIDENT SUGGESTION BOX BANNER ── */}
                            <div
                                className="p-2.5 rounded-3 mb-3 border shadow-xs d-flex align-items-center justify-content-between transition-all hover-lift cursor-pointer"
                                style={{
                                    backgroundColor: currentStyle.isDark ? 'rgba(245, 158, 11, 0.12)' : '#fffbeb',
                                    borderColor: currentStyle.isDark ? 'rgba(245, 158, 11, 0.3)' : '#fef3c7',
                                }}
                                onClick={() => handleAppClick(openSuggestionModal)}
                                role="button"
                                tabIndex={0}
                                title="Open Resident Suggestion Box"
                            >
                                <div className="d-flex align-items-center gap-2 overflow-hidden">
                                    <div
                                        className="rounded-circle d-flex align-items-center justify-content-center text-white flex-shrink-0 shadow-2xs"
                                        style={{
                                            width: '30px',
                                            height: '30px',
                                            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                                            fontSize: '0.85rem',
                                        }}
                                    >
                                        <i className="fa-solid fa-lightbulb" />
                                    </div>
                                    <div className="overflow-hidden">
                                        <div className="fw-black x-small text-truncate" style={{ color: currentStyle.isDark ? '#fef3c7' : '#92400e' }}>
                                            Suggest a Feature
                                        </div>
                                        <div className="tiny-text opacity-75 text-truncate" style={{ color: currentStyle.isDark ? '#d1d5db' : '#b45309', fontSize: '0.65rem' }}>
                                            Send ideas & feedback to our Discord team
                                        </div>
                                    </div>
                                </div>
                                <i className="fa-solid fa-arrow-right tiny-text opacity-60 flex-shrink-0 ms-1" style={{ color: currentStyle.isDark ? '#fef3c7' : '#92400e' }} />
                            </div>

                            {/* ── NOOKPHONE CASE SKINS (CUSTOMIZER WORKSHOP) ── */}
                            <div
                                className="pt-3 border-top"
                                style={{ borderColor: currentStyle.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}
                            >
                                <div className="d-flex align-items-center justify-content-between mb-2">
                                    <div className="d-flex align-items-center gap-1.5">
                                        <i className="fa-solid fa-palette opacity-75" style={{ fontSize: '0.72rem', color: currentStyle.accentColor }} />
                                        <span className="fw-black text-uppercase tracking-wider opacity-80" style={{ fontSize: '0.64rem' }}>
                                            Phone Case Skins
                                        </span>
                                    </div>
                                    <span
                                        className="badge rounded-pill fw-bold"
                                        style={{
                                            fontSize: '0.65rem',
                                            backgroundColor: currentStyle.headerBadgeBg,
                                            color: currentStyle.headerBadgeText,
                                        }}
                                    >
                                        {THEME_OPTIONS.find((t) => t.id === currentTheme)?.name || 'Classic'}
                                    </span>
                                </div>

                                {/* 3x2 Grid of Tactile Case Skin Swatches */}
                                <div className="row g-1.5">
                                    {THEME_OPTIONS.map((opt) => {
                                        const isSelected = currentTheme === opt.id;
                                        const caseStyle = THEME_CASE_STYLES[opt.id] || THEME_CASE_STYLES.nook;
                                        return (
                                            <div className="col-4" key={opt.id}>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        playChimeClick();
                                                        setStoredTheme(opt.id);
                                                        setCurrentTheme(opt.id);
                                                    }}
                                                    className={`btn p-1.5 w-100 rounded-3 text-start position-relative d-flex flex-column gap-1 transition-all border ${
                                                        isSelected ? 'shadow-sm' : 'opacity-85 hover-opacity-100'
                                                    }`}
                                                    style={{
                                                        backgroundColor: currentStyle.isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
                                                        borderColor: isSelected ? opt.accentColor : currentStyle.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                                                        boxShadow: isSelected ? `0 0 0 2px ${opt.accentColor}40, 0 4px 12px rgba(0,0,0,0.08)` : 'none',
                                                        transform: isSelected ? 'scale(1.02)' : 'none',
                                                    }}
                                                    title={opt.description}
                                                >
                                                    {/* Mini Case Silhouette Preview */}
                                                    <div
                                                        className="rounded-2 d-flex align-items-center justify-content-between px-2 py-1.5 text-white shadow-2xs position-relative overflow-hidden w-100"
                                                        style={{
                                                            background: caseStyle.caseBg,
                                                            border: `1px solid ${caseStyle.bezelBorder}`,
                                                            height: '28px',
                                                        }}
                                                    >
                                                        <i className={`fa-solid ${opt.icon}`} style={{ fontSize: '0.72rem' }} />
                                                        {isSelected && (
                                                            <span
                                                                className="rounded-circle d-flex align-items-center justify-content-center bg-white text-dark shadow-xs"
                                                                style={{ width: '13px', height: '13px' }}
                                                            >
                                                                <i className="fa-solid fa-check" style={{ fontSize: '0.52rem', color: '#0f172a' }} aria-hidden="true" />
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Skin Name */}
                                                    <div className="d-flex align-items-center justify-content-between px-0.5">
                                                        <span
                                                            className="fw-black text-truncate"
                                                            style={{
                                                                fontSize: '0.62rem',
                                                                color: isSelected ? opt.accentColor : currentStyle.isDark ? '#cbd5e1' : '#475569',
                                                            }}
                                                        >
                                                            {opt.name.split(' ')[0]}
                                                        </span>
                                                        <span
                                                            className="rounded-circle"
                                                            style={{
                                                                width: '6px',
                                                                height: '6px',
                                                                backgroundColor: opt.accentColor,
                                                            }}
                                                        />
                                                    </div>
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Bottom Home Indicator Bar */}
                        <div className="d-flex align-items-center justify-content-center pt-2 pb-1 flex-shrink-0">
                            <div
                                className="rounded-pill"
                                style={{
                                    width: '84px',
                                    height: '4px',
                                    backgroundColor: currentStyle.isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.22)',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NookPhoneDock;   