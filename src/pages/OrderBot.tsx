import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { getAuthToken } from '../context/authToken';
import { useIslandData } from '../context/useIslandData';
import { type IslandData } from '../data/islands';
import { useCommandBuilderPockets, type PocketItem } from '../hooks/useCommandBuilderPockets';
import { useCatalogData } from '../hooks/useCatalogData';
import { useSavedCharacters, type SavedCharacter } from '../hooks/useSavedCharacters';
import { useFavorites } from '../hooks/useFavorites';
import { ORDER_MAX, DROP_MAX } from '../constants/limits';
import { parseItemCodes } from '../utils/itemCodeParser';
import { playChimeClick } from '../utils/kkAudioSynthesizer';
import { DODO_API_BASE } from '../config/api';
import { QuickAddItemModal } from '../components/command-builder/QuickAddItemModal';
import { CommandBuilderPocketBundlesModal } from '../components/command-builder/CommandBuilderPocketBundlesModal';
import { CommandBuilderShareModal } from '../components/command-builder/CommandBuilderShareModal';
import { HowItWorksExplainer, ORDER_BOT_EXPLAINER_CONFIG } from '../components/HowItWorksExplainer';
import { DiscordNicknameModal } from '../components/DiscordNicknameModal';
import { isValidAcnhNickname, parseDiscordNicknameToCharacters, formatCharactersToNickname } from '../utils/characterParser';
import { updateDiscordNickname } from '../utils/userProfileApi';
import { type PocketBundleItem } from '../data/pocketBundles';
import {
    getActiveUserId,
    getUserScopedItem,
    setUserScopedItem,
    removeUserScopedItem,
} from '../utils/accountStorage';
import {
    fetchBotStatus,
    submitOrderToBot,
    pollOrderStatus,
    cancelOrder,
    fetchOrderQueue,
    fetchUserOrderHistory,
    saveLocalOrderBackup,
    type BotStatusResponse,
    type OrderStatusResponse,
    type QueueEntry,
    type OrderHistoryItem,
} from '../utils/orderBotApi';
import {
    isNotificationSupported,
    getNotificationPermission,
    areNotificationsEnabled,
    setNotificationsEnabled,
    isNotificationBannerDismissed,
    setNotificationBannerDismissed,
    requestNotificationPermissionDetailed,
    notifyOrderStatusChange,
    type NotificationPermissionState,
} from '../utils/orderNotifications';
import './OrderBot.css';

// ─── Constants ─────────────────────────────────────────────────────────────
const POLL_MS = 3_000;      // Fast 3s active order status AJAX polling
const STATUS_MS = 10_000;   // 10s bot online/mode status refresh
const QUEUE_MS = 3_500;     // Fast 3.5s real-time queue live update
const LS_ORDER_KEY = 'chopaeng_active_order';
const LS_PROFILE_KEY = 'chopaeng_order_profile_v1';
const LS_LOADOUTS_KEY = 'chopaeng_saved_order_loadouts';
const LS_SOUND_KEY = 'chopaeng_sound_enabled';
const FALLBACK_IMG =
    "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23f0fdf4'/%3E%3C/svg%3E";

const QUICK_PRESETS = [
    {
        id: 'nmt-40',
        name: '40× NMTs',
        icon: 'https://dodo.ac/np/images/4/43/Nook_Miles_Ticket_NH_Inv_Icon.png',
        desc: '400 Nook Miles Tickets',
        fillType: 'tickets',
    },
    {
        id: 'crowns-40',
        name: '40× Royal Crowns',
        icon: 'https://dodo.ac/np/images/c/c7/Royal_Crown_NH_Storage_Icon.png',
        desc: '12 Million Bells value',
        fillType: 'crowns',
    },
    {
        id: 'bells-40',
        name: '40× 99k Bells',
        icon: 'https://dodo.ac/np/images/1/1e/99k_Bells_NH_Inv_Icon.png',
        desc: '3.96 Million Bells in cash',
        fillType: 'bells',
    },
    {
        id: 'gold-40',
        name: '40× Gold Nuggets',
        icon: 'https://dodo.ac/np/images/2/26/Gold_Nugget_NH_Inv_Icon.png',
        desc: '1,200 Crafting Gold Nuggets',
        fillType: 'gold',
    },
];

const DROP_QUICK_PRESETS = [
    {
        id: 'crowns-9',
        name: '9× Royal Crowns',
        icon: 'https://dodo.ac/np/images/c/c7/Royal_Crown_NH_Storage_Icon.png',
        desc: 'Max value in Bells',
        fillType: 'crowns',
    },
    {
        id: 'nmt-9',
        name: '9× NMTs',
        icon: 'https://dodo.ac/np/images/4/43/Nook_Miles_Ticket_NH_Inv_Icon.png',
        desc: '90 Nook Miles Tickets',
        fillType: 'tickets',
    },
    {
        id: 'bells-9',
        name: '9× 99k Bells',
        icon: 'https://dodo.ac/np/images/1/1e/99k_Bells_NH_Inv_Icon.png',
        desc: 'Instant cash in bags',
        fillType: 'bells',
    },
    {
        id: 'gold-9',
        name: '9× Gold Nuggets',
        icon: 'https://dodo.ac/np/images/2/26/Gold_Nugget_NH_Inv_Icon.png',
        desc: 'Top-tier crafting resource',
        fillType: 'gold',
    },
];

type Stage = 'submit' | 'tracker';
type SetupStep = 'username' | 'select-character';
interface SavedOrder {
    orderId: string;
    submittedAt: number;
    userId?: string | null;
}
interface OrderProfile {
    displayName: string;
    islandName: string;
    orderFor: string;
    characterId: string | null;
    orderForSelf: boolean;
}

interface SavedCustomLoadout {
    id: string;
    name: string;
    createdAt: number;
    items: Array<{ item: PocketItem; quantity: number }>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────
const saveOrder = (id: string, userId?: string | null) => {
    try {
        const uid = userId || getActiveUserId();
        setUserScopedItem(
            LS_ORDER_KEY,
            JSON.stringify({ orderId: id, userId: uid || null, submittedAt: Date.now() }),
            uid
        );
    } catch {
        /**/
    }
};

const loadOrder = (currentUserId?: string | null): SavedOrder | null => {
    try {
        const uid = currentUserId || getActiveUserId();
        const v = getUserScopedItem(LS_ORDER_KEY, uid);
        if (!v) return null;
        const parsed = JSON.parse(v) as SavedOrder;
        if (uid && parsed.userId && parsed.userId !== uid) {
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
};

const clearOrder = (userId?: string | null) => {
    try {
        const uid = userId || getActiveUserId();
        removeUserScopedItem(LS_ORDER_KEY, uid);
    } catch {
        /**/
    }
};

const fmtEta = (m?: number) => (!m ? '--' : m < 1 ? '< 1 min' : `~${Math.round(m)} min`);


const formatDateTime = (value?: string | number | null) => {
    if (!value) return '';
    const date = typeof value === 'number' ? new Date(value < 1e12 ? value * 1000 : value) : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(date);
};

// ─── StatusPill ───────────────────────────────────────────────────────────────
const StatusPill: React.FC<{ s: BotStatusResponse | null; loading: boolean }> = ({ s, loading }) => {
    if (loading)
        return (
            <span className="ob-mode-pill offline" role="status" aria-live="polite">
                <span className="spinner-border spinner-border-sm" style={{ width: 9, height: 9 }} aria-hidden="true" />{' '}
                Connecting…
            </span>
        );
    if (!s?.success)
        return (
            <span className="ob-mode-pill offline" role="status" aria-live="polite">
                <span className="ob-pulse red" aria-hidden="true" /> Offline
            </span>
        );
    if (s.accepting_commands !== false) {
        const modeLabel = s.is_drop_mode ? 'Drop Mode' : s.is_order_mode ? 'Order Mode' : 'Online';
        return (
            <span className="ob-mode-pill order" role="status" aria-live="polite">
                <span className="ob-pulse green" aria-hidden="true" /> {modeLabel}
            </span>
        );
    }
    return (
        <span className="ob-mode-pill offline" role="status" aria-live="polite">
            <span className="ob-pulse red" aria-hidden="true" /> Offline
        </span>
    );
};

// ─── StepIndicator ───────────────────────────────────────────────────────────
const STEPS = [
    { key: 'submit', icon: 'fa-bag-shopping', label: '1. Build Pocket' },
    { key: 'tracker', icon: 'fa-satellite-dish', label: '2. Track & Fly In' },
];

const StepIndicator: React.FC<{ stage: Stage }> = ({ stage }) => {
    const idx = STEPS.findIndex((s) => s.key === stage);
    return (
        <div className="ob-steps" role="list" aria-label="Order progress">
            {STEPS.map((s, i) => (
                <div
                    key={s.key}
                    className={`ob-step ${i < idx ? 'done' : i === idx ? 'active' : ''}`}
                    role="listitem"
                    aria-current={i === idx ? 'step' : undefined}
                >
                    <div className="ob-step-dot" aria-hidden="true">
                        {i < idx ? (
                            <i className="fa-solid fa-check" />
                        ) : (
                            <i className={`fa-solid ${s.icon}`} style={{ fontSize: '.78rem' }} />
                        )}
                    </div>
                    <span className="ob-step-label">{s.label}</span>
                </div>
            ))}
        </div>
    );
};

// ─── QueueList ────────────────────────────────────────────────────────────────
const QueueList: React.FC<{ queue: QueueEntry[]; myOrderId?: string }> = ({ queue, myOrderId }) => {
    if (!queue.length) {
        return (
            <div className="text-center py-3 text-muted small">
                <i className="fa-solid fa-inbox fs-4 d-block mb-2 opacity-50" />
                <span>The queue is currently empty.</span>
            </div>
        );
    }
    return (
        <ul className="ob-queue-list" aria-label="Live order queue">
            {queue.slice(0, 20).map((e) => {
                const isMe = e.order_id === myOrderId;
                const etaDisplay = e.eta || fmtEta(e.estimated_minutes);
                const statusLabel = e.status === 'preparing' ? 'Preparing' : e.status;
                return (
                    <li key={e.order_id} className={`ob-queue-row${isMe ? ' is-me' : ''}`}>
                        <div className="ob-queue-badge" aria-hidden="true">
                            {e.status === 'preparing' ? (
                                <i className="fa-solid fa-bolt" />
                            ) : (
                                e.queue_position
                            )}
                        </div>
                        <div className="flex-grow-1 min-w-0">
                            <div className="fw-bold small text-truncate d-flex align-items-center gap-1">
                                {isMe ? (
                                    <>
                                        <span className="badge bg-success text-white rounded-pill px-2 py-0 x-small">
                                            YOU
                                        </span>
                                        <span className="text-success">{e.username}</span>
                                    </>
                                ) : (
                                    <span>{e.username}</span>
                                )}
                            </div>
                            <div className="text-muted tiny-text d-flex align-items-center gap-2">
                                <span>{e.status === 'preparing' ? 'Dropping items...' : etaDisplay}</span>
                                {typeof e.item_count === 'number' && (
                                    <span className="text-muted">· {e.item_count} items</span>
                                )}
                            </div>
                        </div>
                        <span
                            className={`badge rounded-pill fw-bold ${e.status === 'ready'
                                    ? 'bg-success text-white'
                                    : e.status === 'preparing'
                                        ? 'bg-warning text-dark border-0 d-inline-flex align-items-center gap-1'
                                        : 'bg-light text-secondary border'
                                }`}
                            style={{ fontSize: '.65rem' }}
                        >
                            {e.status === 'preparing' ? (
                                <>
                                    <i className="fa-solid fa-gears fa-spin" style={{ fontSize: '0.6rem' }} />
                                    <span>Preparing</span>
                                </>
                            ) : (
                                statusLabel
                            )}
                        </span>
                    </li>
                );
            })}
        </ul>
    );
};

// ─── Main Component ──────────────────────────────────────────────────────────
const OrderBot: React.FC = () => {
    const { user, canAccessIsland, loading: authLoading, login } = useAuth();
    const { islands, loading: islandsLoading } = useIslandData();
    const token = getAuthToken();
    const { data: catalogData } = useCatalogData();
    const { favorites } = useFavorites();
    const {
        orderCommandText,
        dropCommandText,
        dropItemsOnlyCommand,
        dropVillagerCommand,
        totalOrderCount,
        totalDropCount,
        totalOrderItemsCount,
        orderVillager,
        removeOrderVillager,
        orderItems,
        dropItems,
        setOrderItems,
        setDropItems,
        addItemToOrderPockets,
        addItemToDropPockets,
        increaseOrderQuantity,
        decreaseOrderQuantity,
        removeOrderItem,
        increaseDropQuantity,
        decreaseDropQuantity,
        removeDropItem,
        canIncreaseOrder,
        canIncreaseDrop,
        handleFillTickets,
        handleFillCrowns,
        handleFillBells,
        handleFillRemaining,
        handleMaximizeStacks,
        handleSortPockets,
        loadBundleIntoOrder,
        loadBundleIntoDrop,
    } = useCommandBuilderPockets();

    // ── Sound state ──
    const [soundEnabled, setSoundEnabled] = useState(() => {
        try {
            return localStorage.getItem(LS_SOUND_KEY) !== 'false';
        } catch {
            return true;
        }
    });

    const playSound = useCallback(() => {
        if (soundEnabled) playChimeClick();
    }, [soundEnabled]);

    const handleToggleSound = () => {
        const next = !soundEnabled;
        setSoundEnabled(next);
        try {
            localStorage.setItem(LS_SOUND_KEY, String(next));
        } catch {
            /**/
        }
        if (next) playChimeClick();
    };

    // ── Order Profile & Discord Nickname State ──
    const [serverNickname, setServerNickname] = useState<string>(() => {
        try {
            return user?.nickname || getUserScopedItem('chopaeng_discord_nickname', user?.user_id) || '';
        } catch {
            return '';
        }
    });
    const [showNicknameModal, setShowNicknameModal] = useState(false);
    const hasValidNickname = isValidAcnhNickname(serverNickname);

    const { characters, addCharacter, remainingSlots } = useSavedCharacters(
        serverNickname || user?.username || null
    );

    const loadProfile = (userId?: string | null): OrderProfile | null => {
        try {
            const uid = userId || user?.user_id || getActiveUserId();
            const raw = getUserScopedItem(LS_PROFILE_KEY, uid);
            if (!raw) return null;
            return JSON.parse(raw) as OrderProfile;
        } catch {
            return null;
        }
    };
    const saveProfile = (p: OrderProfile, userId?: string | null) => {
        try {
            const uid = userId || user?.user_id || getActiveUserId();
            setUserScopedItem(LS_PROFILE_KEY, JSON.stringify(p), uid);
        } catch {
            /**/
        }
    };

    const [showSetup, setShowSetup] = useState(false);
    const [setupStep, setSetupStep] = useState<SetupStep>('username');
    const [setupDisplayName, setSetupDisplayName] = useState('');
    const [setupSelectedCharId, setSetupSelectedCharId] = useState<string | null>(null);
    const [orderProfile, setOrderProfile] = useState<OrderProfile | null>(() => loadProfile(user?.user_id));
    // Inline add-character form state
    const [showAddChar, setShowAddChar] = useState(false);
    const [addCharIgn, setAddCharIgn] = useState('');
    const [addCharIsland, setAddCharIsland] = useState('');
    const [addCharError, setAddCharError] = useState('');

    // ── Modals State ──
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [showQuickAddModal, setShowQuickAddModal] = useState(false);
    const [showBundlesModal, setShowBundlesModal] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [showSavedLoadoutsModal, setShowSavedLoadoutsModal] = useState(false);
    const [newLoadoutName, setNewLoadoutName] = useState('');
    const [savedLoadouts, setSavedLoadouts] = useState<SavedCustomLoadout[]>(() => {
        try {
            const raw = getUserScopedItem(LS_LOADOUTS_KEY, user?.user_id);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    });

    const persistSavedLoadouts = (list: SavedCustomLoadout[], userId?: string | null) => {
        setSavedLoadouts(list);
        try {
            const uid = userId || user?.user_id || getActiveUserId();
            setUserScopedItem(LS_LOADOUTS_KEY, JSON.stringify(list), uid);
        } catch {
            /**/
        }
    };

    const handleSaveCurrentLoadout = () => {
        if (!newLoadoutName.trim() || orderItems.length === 0) return;
        const newEntry: SavedCustomLoadout = {
            id: Date.now().toString(),
            name: newLoadoutName.trim(),
            createdAt: Date.now(),
            items: JSON.parse(JSON.stringify(orderItems)),
        };
        const updated = [newEntry, ...savedLoadouts];
        persistSavedLoadouts(updated);
        setNewLoadoutName('');
        playSound();
        triggerInAppToast({
            type: 'success',
            title: 'Pocket Loadout Saved',
            message: `"${newEntry.name}" saved with ${totalOrderCount} items.`,
        });
    };

    const handleApplySavedLoadout = (loadout: SavedCustomLoadout) => {
        setOrderItems(JSON.parse(JSON.stringify(loadout.items)));
        setShowSavedLoadoutsModal(false);
        playSound();
        triggerInAppToast({
            type: 'info',
            title: 'Loadout Applied',
            message: `Loaded "${loadout.name}" into your pocket.`,
        });
    };

    const handleDeleteSavedLoadout = (id: string) => {
        const updated = savedLoadouts.filter((l) => l.id !== id);
        persistSavedLoadouts(updated);
        playSound();
    };

    // ── 1-Click Wishlist / Favorites Import ──
    const handleImportWishlist = () => {
        playSound();
        if (!favorites || favorites.length === 0) {
            triggerInAppToast({
                type: 'warning',
                title: 'Wishlist is Empty',
                message: 'You have no saved favorites. Click the star icon on any catalog item to add it to your Wishlist!',
            });
            return;
        }

        const allCatalog = catalogData?.all || [];
        const wishlistItems = favorites
            .map((favId) => allCatalog.find((item) => String(item.id) === favId))
            .filter((item): item is PocketItem => !!item);

        if (wishlistItems.length === 0) {
            triggerInAppToast({
                type: 'warning',
                title: 'No Matching Items Found',
                message: 'Your saved wishlist items could not be mapped to catalog entries.',
            });
            return;
        }

        let addedCount = 0;
        const newOrderItems = [...orderItems];
        let currentTotal = totalOrderCount;

        for (const item of wishlistItems) {
            if (currentTotal >= ORDER_MAX) break;
            const existing = newOrderItems.find((p) => p.item.id === item.id);
            if (!existing) {
                newOrderItems.push({ item, quantity: 1 });
                currentTotal += 1;
                addedCount += 1;
            }
        }

        setOrderItems(newOrderItems);

        if (addedCount > 0) {
            triggerInAppToast({
                type: 'success',
                title: 'Wishlist Imported!',
                message: `Added ${addedCount} items from your Wishlist into your 40-slot pocket.`,
            });
        } else {
            triggerInAppToast({
                type: 'info',
                title: 'Already in Pocket',
                message: 'All your wishlist items are already in your pocket or pocket is full.',
            });
        }
    };

    // Sync and fetch latest Discord server nickname from backend profile
    useEffect(() => {
        if (!token || !user) return;
        const controller = new AbortController();
        fetch(`${DODO_API_BASE}/api/profile`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
        })
            .then(async (resp) => {
                if (!resp.ok) return;
                const data = await resp.json().catch(() => null);
                if (data?.user?.nickname) {
                    setServerNickname(data.user.nickname);
                    setUserScopedItem('chopaeng_discord_nickname', data.user.nickname, user.user_id);
                }
            })
            .catch(() => {});
        return () => controller.abort();
    }, [token, user?.user_id]);

    // Listen to global nickname update events (e.g. from DiscordNicknameModal or Profile page)
    useEffect(() => {
        const handleNickUpdated = (e: any) => {
            const newNick = e.detail?.nickname;
            if (typeof newNick === 'string' && newNick.trim()) {
                setServerNickname(newNick.trim());
                setUserScopedItem('chopaeng_discord_nickname', newNick.trim(), user?.user_id);
            }
        };
        window.addEventListener('chopaeng_nickname_updated', handleNickUpdated);
        return () => window.removeEventListener('chopaeng_nickname_updated', handleNickUpdated);
    }, [user?.user_id]);

    // Open setup when user logs in and hasn't set a profile or nickname yet
    useEffect(() => {
        if (!user) {
            setOrderProfile(null);
            setServerNickname('');
            setSavedLoadouts([]);
            return;
        }

        const currentNick = user.nickname || getUserScopedItem('chopaeng_discord_nickname', user.user_id) || '';
        setServerNickname(currentNick);

        const saved = loadProfile(user.user_id);
        if (saved) {
            setOrderProfile(saved);
        } else {
            setOrderProfile(null);
            setSetupDisplayName(user.username || '');
            setSetupSelectedCharId(null);
            setSetupStep('username');
        }

        const rawLoadouts = getUserScopedItem(LS_LOADOUTS_KEY, user.user_id);
        setSavedLoadouts(rawLoadouts ? JSON.parse(rawLoadouts) : []);

        // Enforce requirement: Must setup Discord server nickname before ordering
        if (!isValidAcnhNickname(currentNick)) {
            setShowNicknameModal(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.user_id]);

    // Listen for cross-tab or in-app account switches to instantly refresh state
    useEffect(() => {
        const handleAccountSwitch = (e: any) => {
            const newUid = e.detail?.newUserId;
            if (!newUid) {
                setOrderProfile(null);
                setServerNickname('');
                setSavedLoadouts([]);
            } else {
                const nick = getUserScopedItem('chopaeng_discord_nickname', newUid) || '';
                setServerNickname(nick);
                setOrderProfile(loadProfile(newUid));
                const rawLoadouts = getUserScopedItem(LS_LOADOUTS_KEY, newUid);
                setSavedLoadouts(rawLoadouts ? JSON.parse(rawLoadouts) : []);
            }
        };
        window.addEventListener('chopaeng_account_switched', handleAccountSwitch);
        return () => window.removeEventListener('chopaeng_account_switched', handleAccountSwitch);
    }, []);

    useEffect(() => {
        if (!setupSelectedCharId && characters.length > 0) {
            setSetupSelectedCharId(characters.find((c) => c.isDefault)?.id || characters[0].id);
        }
    }, [characters, setupSelectedCharId]);

    const handleSetupSave = () => {
        const selectedChar = characters.find((c) => c.id === setupSelectedCharId) ?? characters[0];
        const profile: OrderProfile = {
            displayName: setupDisplayName.trim() || (user?.username ?? 'Player'),
            islandName: selectedChar?.islandName || '',
            orderFor: selectedChar?.ign || setupDisplayName.trim() || user?.username || 'Player',
            characterId: selectedChar?.id ?? null,
            orderForSelf: true,
        };
        saveProfile(profile);
        setOrderProfile(profile);
        setShowSetup(false);
        setShowAddChar(false);
    };

    const handleAddCharacter = () => {
        if (!addCharIgn.trim()) {
            setAddCharError('IGN is required.');
            return;
        }
        if (!addCharIsland.trim()) {
            setAddCharError('Island name is required.');
            return;
        }
        const ok = addCharacter(addCharIgn.trim(), addCharIsland.trim());
        if (!ok) {
            setAddCharError(`Max ${remainingSlots === 0 ? 'character slots reached' : 'error adding'}.`);
            return;
        }

        // Auto-sync Discord nickname across Slots 1, 2, and 3 using | and /
        const updatedSlots = [
            ...characters,
            { ign: addCharIgn.trim(), islandName: addCharIsland.trim(), isDefault: characters.length === 0 },
        ];
        const newNick =
            formatCharactersToNickname(updatedSlots) ||
            `${addCharIgn.trim()} | ${addCharIsland.trim()}`.slice(0, 32);
        if (token) {
            updateDiscordNickname(newNick, token)
                .then((res) => {
                    if (res.success) {
                        const updated = res.nickname || newNick;
                        setServerNickname(updated);
                        setUserScopedItem('chopaeng_discord_nickname', updated, user?.user_id);
                        window.dispatchEvent(
                            new CustomEvent('chopaeng_nickname_updated', {
                                detail: { nickname: updated },
                            })
                        );
                    }
                })
                .catch(() => {});
        }

        setAddCharIgn('');
        setAddCharIsland('');
        setAddCharError('');
        setShowAddChar(false);
        playSound();
    };

    const handleOpenSetup = () => {
        if (orderProfile) {
            setSetupDisplayName(orderProfile.displayName);
            setSetupSelectedCharId(orderProfile.characterId ?? (characters[0]?.id ?? null));
        } else if (user) {
            setSetupDisplayName(user.username || '');
            setSetupSelectedCharId(characters.find((c) => c.isDefault)?.id ?? characters[0]?.id ?? null);
        }
        setSetupStep('username');
        setShowSetup(true);
        setShowAddChar(false);
        playSound();
    };

    // ── Mode Switch & Drop State ──
    const [botMode, setBotMode] = useState<'order' | 'drop'>('order');
    const [modeOverridden, setModeOverridden] = useState(false);
    const [selectedDropIsland, setSelectedDropIsland] = useState<IslandData | null>(null);
    const [dropFilter, setDropFilter] = useState<'all' | 'unlocked'>('all');
    const [dropDodoCode, setDropDodoCode] = useState<string | null>(null);
    const [dropDodoLoading, setDropDodoLoading] = useState(false);
    const [dropDodoError, setDropDodoError] = useState<string | null>(null);
    const [alreadyOnIsland, setAlreadyOnIsland] = useState(false);
    const [dropDodoCopied, setDropDodoCopied] = useState(false);

    // ── State ──
    const [botStatus, setBotStatus] = useState<BotStatusResponse | null>(null);
    const [statusLoading, setStatusLoading] = useState(true);
    const [stage, setStage] = useState<Stage>('submit');
    const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
    const [orderStatus, setOrderStatus] = useState<OrderStatusResponse | null>(null);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [cancelLoading, setCancelLoading] = useState(false);
    const [dodoCopied, setDodoCopied] = useState(false);
    const [commandCopied, setCommandCopied] = useState(false);
    const [showTerminal, setShowTerminal] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [historyOrders, setHistoryOrders] = useState<OrderHistoryItem[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [notifPermission, setNotifPermission] = useState<NotificationPermissionState>(() => getNotificationPermission());
    const [notifEnabled, setNotifEnabled] = useState<boolean>(() => areNotificationsEnabled());
    const [bannerDismissed, setBannerDismissed] = useState<boolean>(() => isNotificationBannerDismissed());
    const notifActive = notifPermission === 'granted' && notifEnabled;
    const showNotifBanner = !bannerDismissed && isNotificationSupported() && notifPermission === 'default';

    const handleAllowNotifications = async () => {
        playSound();
        const res = await requestNotificationPermissionDetailed();
        setNotifPermission(res.state);
        setBannerDismissed(true);
        setNotificationBannerDismissed(true);

        if (res.granted) {
            setNotifEnabled(true);
            setNotificationsEnabled(true);
            triggerInAppToast({
                type: 'success',
                title: 'Desktop Notifications Enabled!',
                message: 'You will receive alerts the second your Dodo code is ready, even if you browse other tabs.',
            });
            notifyOrderStatusChange(
                '🏝️ ChoPaeng Flight Alerts',
                'Desktop notifications are active! We will alert you when your Dodo flight is ready.',
                'ready'
            );
        } else if (res.state === 'denied') {
            setNotifEnabled(false);
            setNotificationsEnabled(false);
            triggerInAppToast({
                type: 'warning',
                title: 'Notifications Blocked',
                message: 'Notifications are blocked in browser settings. You will still hear audio chimes and see in-app alerts!',
            });
        } else {
            triggerInAppToast({
                type: 'info',
                title: 'Audio Alerts Active',
                message: 'Notification prompt was closed. Audio chimes and in-app alerts are active by default!',
            });
        }
    };

    const handleDismissNotifBanner = () => {
        playSound();
        setBannerDismissed(true);
        setNotificationBannerDismissed(true);
    };

    const handleToggleNotifications = async () => {
        playSound();
        if (notifActive) {
            setNotificationsEnabled(false);
            setNotifEnabled(false);
            triggerInAppToast({
                type: 'info',
                title: 'Flight Alerts Paused',
                message: 'Desktop flight notifications paused. Audio chimes and in-app alerts will still trigger.',
            });
        } else {
            const res = await requestNotificationPermissionDetailed();
            setNotifPermission(res.state);
            if (res.granted) {
                setNotificationsEnabled(true);
                setNotifEnabled(true);
                triggerInAppToast({
                    type: 'success',
                    title: 'Flight Alerts Active!',
                    message: 'Desktop notifications are active! We will alert you when your Dodo flight is ready.',
                });
                notifyOrderStatusChange(
                    '🏝️ ChoPaeng Flight Alerts',
                    'Desktop notifications are active! We will alert you when your Dodo flight is ready.',
                    'ready'
                );
            } else if (res.state === 'denied') {
                triggerInAppToast({
                    type: 'warning',
                    title: 'Notifications Blocked',
                    message: 'Notifications are blocked by your browser. Please allow notifications in your browser address bar site settings.',
                });
            } else {
                triggerInAppToast({
                    type: 'info',
                    title: 'Alerts Status',
                    message: 'Desktop notification prompt was not granted. Audio chimes and tab alerts will notify you.',
                });
            }
        }
    };
    const [queue, setQueue] = useState<QueueEntry[]>([]);
    const [queueLoading, setQueueLoading] = useState(false);
    const [queueLoaded, setQueueLoaded] = useState(false);
    const [queueOpen, setQueueOpen] = useState(false);
    const [inAppToast, setInAppToast] = useState<{
        id: string;
        type: 'dodo' | 'success' | 'warning' | 'info';
        title: string;
        message: string;
        actionLabel?: string;
        onAction?: () => void;
    } | null>(null);

    // ── Timers / Refs ──
    const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const statusTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const queueTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const notifiedRef = useRef(false);
    const preparingNotifiedRef = useRef(false);

    const triggerInAppToast = useCallback(
        (notif: {
            type: 'dodo' | 'success' | 'warning' | 'info';
            title: string;
            message: string;
            actionLabel?: string;
            onAction?: () => void;
        }) => {
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
            const id = Date.now().toString();
            setInAppToast({ ...notif, id });
            playSound();
            toastTimerRef.current = setTimeout(() => {
                setInAppToast(null);
            }, 7500);
        },
        [playSound]
    );

    const dismissInAppToast = () => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setInAppToast(null);
    };

    // ── Restore active order on mount or user login sync ──
    useEffect(() => {
        const saved = loadOrder(user?.user_id);
        if (saved?.orderId) {
            setActiveOrderId(saved.orderId);
            setStage('tracker');
        } else if (user) {
            // Check if logged in user has an active order in remote DB (order_bot_queue)
            fetchUserOrderHistory(token).then((res) => {
                if (res.success && res.orders && res.orders.length > 0) {
                    const activeRemote = res.orders.find((o) =>
                        ['queued', 'preparing', 'ready'].includes(o.status)
                    );
                    if (activeRemote) {
                        saveOrder(activeRemote.id, user.user_id);
                        setActiveOrderId(activeRemote.id);
                        setStage('tracker');
                    }
                }
            }).catch(() => {});
        }
        const handleOrderCreated = (e: any) => {
            const newId = e.detail?.orderId;
            if (newId) {
                setActiveOrderId(newId);
                setStage('tracker');
                pollStatus();
            }
        };

        const handleOrderCleared = () => {
            setActiveOrderId(null);
            setOrderStatus(null);
            setStage('submit');
        };

        window.addEventListener('chopaeng_order_created', handleOrderCreated);
        window.addEventListener('chopaeng_order_cleared', handleOrderCleared);

        return () => {
            window.removeEventListener('chopaeng_order_created', handleOrderCreated);
            window.removeEventListener('chopaeng_order_cleared', handleOrderCleared);
        };
    }, [user?.user_id, token]);

    // ── Bot status polling ──
    const refreshStatus = useCallback(async () => {
        const d = await fetchBotStatus(token);
        setBotStatus(d);
        setStatusLoading(false);

        if (d.success && !modeOverridden) {
            if (d.is_drop_mode) setBotMode('drop');
            else if (d.is_order_mode) setBotMode('order');
        }
    }, [token, modeOverridden]);

    useEffect(() => {
        refreshStatus();
        statusTimerRef.current = setInterval(refreshStatus, STATUS_MS);
        return () => {
            if (statusTimerRef.current) clearInterval(statusTimerRef.current);
        };
    }, [refreshStatus]);

    // ── Copy Dodo ──
    const handleCopyDodo = useCallback(async () => {
        const code = orderStatus?.dodoCode;
        if (!code) return;
        try {
            await navigator.clipboard.writeText(code);
        } catch {
            /**/
        }
        playSound();
        setDodoCopied(true);
        setTimeout(() => setDodoCopied(false), 2500);
    }, [orderStatus?.dodoCode, playSound]);

    // ── Order status polling ──
    const pollStatus = useCallback(async () => {
        if (!activeOrderId) return;
        const d = await pollOrderStatus(activeOrderId, token);
        setOrderStatus(d);

        saveLocalOrderBackup({
            id: activeOrderId,
            command: orderCommandText,
            status: d.status,
            queue_position: d.queuePosition,
            estimated_minutes: d.estimatedMinutes,
            dodo_code: d.dodoCode,
            island_name: d.islandName,
            message: d.message,
            updated_at: Math.floor(Date.now() / 1000),
        });

        if (d.status === 'preparing' && !preparingNotifiedRef.current) {
            preparingNotifiedRef.current = true;
            playSound();
            triggerInAppToast({
                type: 'info',
                title: 'Preparing Items on Island',
                message: `Your order is up next! ChoBot is placing items on the island ground. Dodo code arriving shortly!`,
            });
        }

        if (d.status === 'ready' && !notifiedRef.current) {
            notifiedRef.current = true;
            playSound();
            notifyOrderStatusChange(
                '🏝️ Your Order Bot Dodo Code is Ready!',
                `Your flight to ${d.islandName || 'the island'} is ready! Dodo Code: ${d.dodoCode}`,
                'ready'
            );
            triggerInAppToast({
                type: 'dodo',
                title: 'Dodo Code Ready!',
                message: `Your flight to ${d.islandName || 'the island'} is ready! Dodo Code: ${d.dodoCode}`,
                actionLabel: 'Copy Dodo Code',
                onAction: handleCopyDodo,
            });
        }
        if (['completed', 'cancelled'].includes(d.status)) {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            if (d.status !== 'ready') clearOrder();
        } else if (d.status === 'error') {
            // Transient network error: pause polling loop but do NOT delete saved order on refresh
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        }
    }, [activeOrderId, orderCommandText, token, triggerInAppToast, handleCopyDodo, playSound]);

    useEffect(() => {
        if (stage !== 'tracker' || !activeOrderId) return;
        pollStatus();
        pollTimerRef.current = setInterval(pollStatus, POLL_MS);
        return () => {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        };
    }, [stage, activeOrderId, pollStatus]);

    // ── Queue polling ──
    const refreshQueue = useCallback(async () => {
        if (!queueOpen) return;
        setQueueLoading(true);
        try {
            const d = await fetchOrderQueue(token);
            if (d.success && Array.isArray(d.queue)) {
                setQueue(d.queue);
            } else {
                setQueue([]);
            }
        } catch {
            setQueue([]);
        } finally {
            setQueueLoading(false);
            setQueueLoaded(true);
        }
    }, [queueOpen, token]);

    useEffect(() => {
        if (!queueOpen) return;
        refreshQueue();
        queueTimerRef.current = setInterval(refreshQueue, QUEUE_MS);
        return () => {
            if (queueTimerRef.current) clearInterval(queueTimerRef.current);
        };
    }, [queueOpen, refreshQueue]);

    // ── Fetch history for quick reorder modal ──
    const loadHistory = useCallback(async () => {
        setHistoryLoading(true);
        const res = await fetchUserOrderHistory(token);
        if (res.success && res.orders) {
            setHistoryOrders(res.orders);
        }
        setHistoryLoading(false);
    }, [token]);

    const parsedHistoryOrdersMap = useMemo(() => {
        const map = new Map<string, ReturnType<typeof parseItemCodes>>();
        const catalog = catalogData?.all || [];
        for (const order of historyOrders) {
            map.set(order.id, parseItemCodes(order.command, catalog));
        }
        return map;
    }, [historyOrders, catalogData?.all]);

    const handleOpenHistoryModal = () => {
        setShowHistoryModal(true);
        loadHistory();
        playSound();
    };

    // ── Submit ──
    const handleSubmit = async () => {
        if (!orderCommandText.trim()) return;

        // Strict Requirement: User MUST have a valid server nickname before ordering
        if (!hasValidNickname) {
            setShowNicknameModal(true);
            playSound();
            triggerInAppToast({
                type: 'warning',
                title: 'Server Nickname Required',
                message: "Please set your server nickname to 'Character Name | Island Name' before ordering.",
                actionLabel: 'Set Up Nickname',
                onAction: () => setShowNicknameModal(true),
            });
            return;
        }

        setSubmitError(null);
        setSubmitLoading(true);
        playSound();

        const defaultChar = characters.find((c) => c.isDefault) || characters[0];
        const res = await submitOrderToBot(
            orderCommandText,
            token,
            orderProfile?.orderFor || defaultChar?.ign || user?.username || 'Player',
            serverNickname || orderProfile?.displayName || user?.username || 'Player',
            orderProfile?.islandName || defaultChar?.islandName || ''
        );
        setSubmitLoading(false);

        if (!res.success || !res.orderId) {
            setSubmitError(res.error || 'Submission failed. Please try again.');
            return;
        }

        notifiedRef.current = false;
        preparingNotifiedRef.current = false;
        saveOrder(res.orderId, user?.user_id);
        setActiveOrderId(res.orderId);

        saveLocalOrderBackup({
            id: res.orderId,
            command: orderCommandText,
            status: 'queued',
            queue_position: res.queuePosition,
            estimated_minutes: res.estimatedMinutes,
            dodo_code: res.dodoCode,
            message: res.message,
            created_at: Math.floor(Date.now() / 1000),
            updated_at: Math.floor(Date.now() / 1000),
        });

        setOrderStatus({
            status: 'queued',
            queuePosition: res.queuePosition,
            estimatedMinutes: res.estimatedMinutes,
            message: res.message,
        });
        setStage('tracker');

        // Broadcast to NookPhone Dock, Global Tracker, and all other active tabs/widgets
        window.dispatchEvent(new CustomEvent('chopaeng_order_created', { detail: { orderId: res.orderId } }));
        window.dispatchEvent(new Event('storage'));

        triggerInAppToast({
            type: 'success',
            title: 'Order Submitted!',
            message: `Your order is in queue at position #${res.queuePosition ?? 1}. Estimated wait: ~${res.estimatedMinutes ?? 2
                }m.`,
        });
    };

    // ── Cancel ──
    const handleCancel = async () => {
        if (!activeOrderId || cancelLoading) return;
        setCancelLoading(true);
        playSound();
        await cancelOrder(activeOrderId, token);
        setCancelLoading(false);
        setShowCancelModal(false);
        clearOrder();
        setActiveOrderId(null);
        setOrderStatus(null);
        setStage('submit');

        window.dispatchEvent(new CustomEvent('chopaeng_order_cleared'));
        window.dispatchEvent(new Event('storage'));

        triggerInAppToast({
            type: 'warning',
            title: 'Order Cancelled',
            message: 'Your order was removed from the active delivery queue.',
        });
    };

    // ── Reset ──
    const handleReset = () => {
        clearOrder();
        setActiveOrderId(null);
        setOrderStatus(null);
        notifiedRef.current = false;
        preparingNotifiedRef.current = false;
        setDodoCopied(false);
        setStage('submit');
        playSound();

        window.dispatchEvent(new CustomEvent('chopaeng_order_cleared'));
        window.dispatchEvent(new Event('storage'));
    };

    // ── Copy Command ──
    const handleCopyCommand = () => {
        if (!orderCommandText) return;
        navigator.clipboard.writeText(orderCommandText).catch(() => { });
        playSound();
        setCommandCopied(true);
        setTimeout(() => setCommandCopied(false), 2500);
        triggerInAppToast({
            type: 'success',
            title: 'Copied !order Command!',
            message: 'Redirecting to #chorder-bot in Discord... Paste command to queue your order!',
        });
        setTimeout(() => {
            window.open('https://discord.com/channels/729590421478703135/1175672083183829075', '_blank');
        }, 450);
    };

    const handleCopySpecific = (cmd: string, label: string) => {
        if (!cmd) return;
        navigator.clipboard.writeText(cmd).catch(() => { });
        playSound();
        triggerInAppToast({
            type: 'info',
            title: `${label} Copied!`,
            message: 'Redirecting to Discord... Paste command in the channel!',
        });
        setTimeout(() => {
            window.open('https://discord.com/channels/729590421478703135/1175672083183829075', '_blank');
        }, 450);
    };

    // ── Quick Fill Preset ──
    const handleApplyPreset = (fillType: string) => {
        playSound();
        if (fillType === 'tickets') handleFillTickets();
        else if (fillType === 'crowns') handleFillCrowns();
        else if (fillType === 'bells') handleFillBells();
        else if (fillType === 'gold') handleFillRemaining('gold');

        triggerInAppToast({
            type: 'info',
            title: 'Pocket Preset Applied',
            message: `Loaded ${fillType} bundle into your 40-slot pocket.`,
        });
    };

    // ── Drop Mode Helpers ──
    const handleGetDropIslandDodo = async (island: IslandData) => {
        if (!island) return;
        setDropDodoLoading(true);
        setDropDodoError(null);
        playSound();

        try {
            const token = getAuthToken();
            const resp = await fetch(`${DODO_API_BASE}/api/islands/${encodeURIComponent(island.name)}/dodo`, {
                method: 'POST',
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                credentials: 'include',
            });

            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                if (resp.status === 401) {
                    setDropDodoError('Your login session expired. Please log in again.');
                    return;
                }
                if (resp.status === 403) {
                    setDropDodoError(err.error || "You do not have access to this Sub Member island's Dodo code.");
                    return;
                }
                if (resp.status === 404) {
                    setDropDodoError('Dodo code is not available right now. Please try again shortly.');
                    return;
                }
                setDropDodoError(err.error || 'Unable to retrieve Dodo code.');
                return;
            }

            const data = await resp.json();
            const rawCode = String(data.dodo_code || '');
            const code = rawCode.split(': ').pop() || rawCode;
            setDropDodoCode(code);
            navigator.clipboard.writeText(code).catch(() => { });
            playSound();
            setDropDodoCopied(true);
            setTimeout(() => setDropDodoCopied(false), 2500);
            triggerInAppToast({
                type: 'dodo',
                title: 'Dodo Code Logged & Copied!',
                message: `Logged to Discord webhook & copied ${code} to clipboard. Fly in to drop!`,
            });
        } catch (e) {
            console.error(e);
            setDropDodoError('Network error while revealing Dodo code. Please try again.');
        } finally {
            setDropDodoLoading(false);
        }
    };

    const handleCopyDropIslandDodo = (code: string) => {
        if (!code) return;
        navigator.clipboard.writeText(code).catch(() => { });
        playSound();
        setDropDodoCopied(true);
        setTimeout(() => setDropDodoCopied(false), 2500);
        triggerInAppToast({
            type: 'dodo',
            title: 'Dodo Code Copied!',
            message: `Copied ${code} to clipboard. Enter this at Dodo Airlines!`,
        });
    };

    const handleApplyDropPreset = (fillType: string) => {
        playSound();
        if (fillType === 'tickets') {
            setDropItems([
                {
                    item: {
                        id: '16DB',
                        name: 'Nook Miles Ticket',
                        entityType: 'item',
                        category: 'Currency',
                        theme: 'Buffer',
                        series: 'Buffer',
                        interactivity: 'Consumable',
                        colour: 'Various',
                        image: 'https://dodo.ac/np/images/4/43/Nook_Miles_Ticket_NH_Inv_Icon.png',
                        description: 'Nook Miles Ticket',
                    },
                    quantity: 9,
                },
            ]);
        } else if (fillType === 'crowns') {
            setDropItems([
                {
                    item: {
                        id: '14BB',
                        name: 'Royal Crown',
                        entityType: 'item',
                        category: 'Currency',
                        theme: 'Buffer',
                        series: 'Buffer',
                        interactivity: 'Consumable',
                        colour: 'Various',
                        image: 'https://dodo.ac/np/images/c/c7/Royal_Crown_NH_Storage_Icon.png',
                        description: 'Royal Crown',
                    },
                    quantity: 9,
                },
            ]);
        } else if (fillType === 'bells') {
            setDropItems([
                {
                    item: {
                        id: '08A4',
                        name: '99,000 Bells',
                        entityType: 'item',
                        category: 'Currency',
                        theme: 'Buffer',
                        series: 'Buffer',
                        interactivity: 'Consumable',
                        colour: 'Various',
                        image: 'https://dodo.ac/np/images/1/1e/99k_Bells_NH_Inv_Icon.png',
                        description: '99k Bells',
                    },
                    quantity: 9,
                },
            ]);
        } else if (fillType === 'gold') {
            setDropItems([
                {
                    item: {
                        id: '0B07',
                        name: 'Gold nugget',
                        entityType: 'item',
                        category: 'Material',
                        theme: 'Buffer',
                        series: 'Buffer',
                        interactivity: 'Consumable',
                        colour: 'Gold',
                        image: 'https://dodo.ac/np/images/2/26/Gold_Nugget_NH_Inv_Icon.png',
                        description: 'Gold nugget',
                    },
                    quantity: 9,
                },
            ]);
        }

        triggerInAppToast({
            type: 'info',
            title: 'Drop Preset Applied',
            message: `Loaded 9× ${fillType} into your drop pocket.`,
        });
    };

    const handleCopyDropForDiscord = () => {
        if (!dropCommandText) return;
        navigator.clipboard.writeText(dropCommandText).catch(() => { });
        playSound();
        triggerInAppToast({
            type: 'success',
            title: 'Copied !drop for Discord!',
            message: `Redirecting to Discord ${selectedDropIsland?.name ? `(${selectedDropIsland.name})` : ''
                }... Paste command in the channel!`,
        });
        setTimeout(() => {
            const targetUrl = (selectedDropIsland as any)?.channel_id
                ? `https://discord.com/channels/729590421478703135/${(selectedDropIsland as any).channel_id}`
                : 'https://discord.gg/chopaeng';
            window.open(targetUrl, '_blank');
        }, 450);
    };

    // ── Reorder from modal ──
    const handleReorderHistoryItem = (order: OrderHistoryItem) => {
        const bundle = parseItemCodes(order.command, catalogData?.all || []);
        if (bundle.items.length > 0) {
            loadBundleIntoOrder(bundle.items, 'replace');
        }
        playSound();
        setShowHistoryModal(false);
        setStage('submit');

        triggerInAppToast({
            type: 'info',
            title: 'Order Loaded into Pocket',
            message: 'Past items loaded into your pocket grid. Ready to review and submit!',
        });
    };

    // ── Derived ──
    const botAvailable = !!botStatus?.success && botStatus.accepting_commands !== false;
    const botUnavailable = !statusLoading && !botStatus?.success;
    const statusStr = orderStatus?.status ?? 'queued';
    const isDone = ['completed', 'cancelled', 'error'].includes(statusStr);
    const isReady = statusStr === 'ready' || Boolean(orderStatus?.dodoCode && !isDone);
    const regularOrderItems = useMemo(
        () => orderItems.filter((p) => p.item.entityType !== 'villager'),
        [orderItems]
    );
    const capacityPct = Math.min(100, Math.round((totalOrderItemsCount / ORDER_MAX) * 100));
    const sintaIsDropMode = botStatus?.is_drop_mode === true;
    const canSubmitOrder = botAvailable && !sintaIsDropMode;
    const hasAnyOrderContent = totalOrderItemsCount > 0 || orderVillager !== null;

    const subMemberIslands = useMemo(() => {
        return islands.filter((isl) => isl.cat === 'member');
    }, [islands]);

    const availableDropIslands = useMemo(() => {
        if (dropFilter === 'unlocked') {
            return subMemberIslands.filter((isl) => !!user && canAccessIsland(isl.requiredRoles));
        }
        return subMemberIslands;
    }, [subMemberIslands, dropFilter, user, canAccessIsland]);

    // Compute empty slots to fill up to 40 regular item slots
    const emptySlotsCount = Math.max(0, ORDER_MAX - totalOrderItemsCount);

    // Calculate flight radar progress percentage
    const flightProgressPct = useMemo(() => {
        if (isReady || statusStr === 'completed') return 100;
        if (statusStr === 'preparing') return 75;
        if (statusStr === 'queued') {
            const pos = orderStatus?.queuePosition ?? 1;
            return Math.max(20, Math.min(65, 70 - pos * 8));
        }
        return 15;
    }, [isReady, statusStr, orderStatus?.queuePosition]);

    // ── Full-page login wall ──
    if (!authLoading && !user) {
        return (
            <>
                <Helmet>
                    <title>Order Bot · Chopaeng</title>
                    <meta name="description" content="Login with Discord to submit orders to the Chopaeng Order Bot." />
                </Helmet>
                <div className="nook-bg min-vh-100 py-5 px-3 d-flex align-items-center justify-content-center">
                    <div className="container" style={{ maxWidth: 640 }}>
                        <div className="bg-white rounded-5 shadow-sm border p-4 p-md-5 text-center mb-4 animate-fade">
                            <div
                                className="d-inline-flex align-items-center justify-content-center rounded-circle text-white mb-4 shadow-sm"
                                style={{ width: 76, height: 76, backgroundColor: '#5865F2' }}
                            >
                                <i className="fa-brands fa-discord fa-2x" />
                            </div>

                            <h1 className="ac-font h2 text-dark mb-2 fw-black">
                                Order Bot &amp; Pocket Delivery
                            </h1>
                            <p className="text-muted fw-bold mb-4" style={{ fontSize: '0.95rem', lineHeight: 1.6 }}>
                                Connect your Discord account to submit custom 40-slot item orders, track your personal Dodo code in real-time, and manage in-island item drops.
                            </p>

                            <div className="d-flex gap-2 flex-wrap justify-content-center mb-4">
                                <span className="badge bg-light text-dark border rounded-pill px-3 py-2 fw-bold d-inline-flex align-items-center gap-1">
                                    <i className="fa-solid fa-bag-shopping text-success me-1"></i> 40-Slot Pocket
                                </span>
                                <span className="badge bg-light text-dark border rounded-pill px-3 py-2 fw-bold d-inline-flex align-items-center gap-1">
                                    <i className="fa-solid fa-plane-departure text-primary me-1"></i> Live Dodo Tracker
                                </span>
                                <span className="badge bg-light text-dark border rounded-pill px-3 py-2 fw-bold d-inline-flex align-items-center gap-1">
                                    <i className="fa-solid fa-box-archive text-info me-1"></i> Order History
                                </span>
                                <span className="badge bg-light text-dark border rounded-pill px-3 py-2 fw-bold d-inline-flex align-items-center gap-1">
                                    <i className="fa-solid fa-bell text-warning me-1"></i> Real-time Alerts
                                </span>
                            </div>

                            <div className="mb-3">
                                <button
                                    id="ob-discord-login-wall-btn"
                                    type="button"
                                    onClick={login}
                                    className="btn btn-success rounded-pill fw-black px-5 py-3 shadow-sm d-inline-flex align-items-center gap-2 hover-scale transition-all"
                                    style={{ fontSize: '1.05rem', backgroundColor: '#37b06d', borderColor: '#37b06d' }}
                                >
                                    <i className="fa-brands fa-discord me-1" />
                                    <span>Login with Discord</span>
                                </button>
                            </div>

                            <p className="text-muted tiny-text mb-0">
                                We only read your public Discord identity and verified membership roles.
                            </p>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    // ── Auth loading skeleton ──
    if (authLoading) {
        return (
            <div className="nook-bg min-vh-100 d-flex align-items-center justify-content-center p-4">
                <div className="text-center bg-white rounded-4 shadow-sm border p-5">
                    <div className="spinner-border text-success mb-3" role="status" />
                    <p className="fw-bold text-muted mb-0">Connecting to Chopaeng...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="ob-page font-nunito">
            <Helmet>
                <title>Order Bot · Chopaeng</title>
                <meta
                    name="description"
                    content="Submit custom 40-slot item orders to the Chopaeng Order Bot and track your personal Dodo code in real-time."
                />
                <link rel="canonical" href={`${window.location.origin}/order`} />
            </Helmet>

            {/* ════════════════ AIRPORT / BOT LIVE DISPATCH HEADER ════════════════ */}
            <div className="ob-hero mb-4">
                <div className="container">
                    <div className="row align-items-center gy-3">
                        {/* Title & Live Status */}
                        <div className="col-lg-6 text-center text-lg-start">
                            <div className="d-inline-flex align-items-center gap-2 mb-2 px-3 py-1 rounded-pill bg-light border flex-wrap">
                                <StatusPill s={botStatus} loading={statusLoading} />
                                {!statusLoading && (
                                    <button
                                        className="btn btn-sm btn-link p-0 text-muted hover-text-dark"
                                        onClick={() => {
                                            playSound();
                                            refreshStatus();
                                        }}
                                        aria-label="Refresh bot status"
                                        title="Refresh live status"
                                        style={{ fontSize: '.78rem', lineHeight: 1 }}
                                    >
                                        <i className="fa-solid fa-arrows-rotate" aria-hidden="true" />
                                    </button>
                                )}
                                <button
                                    type="button"
                                    className={`ob-sound-btn ${!soundEnabled ? 'muted' : ''}`}
                                    onClick={handleToggleSound}
                                    title={soundEnabled ? 'Mute sound chimes' : 'Enable sound chimes'}
                                >
                                    <i className={`fa-solid ${soundEnabled ? 'fa-volume-high text-success' : 'fa-volume-xmark text-muted'}`} />
                                    <span>{soundEnabled ? 'Sound On' : 'Muted'}</span>
                                </button>
                                <button
                                    type="button"
                                    className={`ob-sound-btn ${!notifActive ? 'muted' : ''}`}
                                    onClick={handleToggleNotifications}
                                    title={notifActive ? 'Flight alerts enabled (click to pause)' : 'Enable flight notifications'}
                                >
                                    <i className={`fa-solid ${notifActive ? 'fa-bell text-warning' : 'fa-bell-slash text-muted'}`} />
                                    <span>{notifActive ? 'Alerts On' : 'Alerts Off'}</span>
                                </button>
                            </div>
                            <h1 className="ac-font h2 text-dark mb-1 d-flex align-items-center justify-content-center justify-content-lg-start gap-2">
                                <i className="fa-solid fa-box-open text-success"></i>
                                Order Bot
                            </h1>
                            <p className="text-muted small fw-bold mb-0">
                                Load your 40-slot pocket, submit an order, and receive your personal Dodo code right here.
                            </p>
                        </div>

                        {/* Top Action Bar & Live Stats */}
                        <div className="col-lg-6 d-flex align-items-center justify-content-center justify-content-lg-end gap-2 flex-wrap">
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-dark rounded-pill px-3 py-2 fw-bold d-flex align-items-center gap-2 shadow-2xs"
                                onClick={handleOpenHistoryModal}
                                title="View past orders & reorder"
                            >
                                <i className="fa-solid fa-clock-rotate-left text-success" aria-hidden="true" />
                                <span>Recent Orders</span>
                            </button>

                            {botStatus?.success && !statusLoading && (
                                <div className="d-flex gap-2 flex-wrap">
                                    {botStatus.island_name && (
                                        <div className="ob-hero-stat">
                                            <div className="ob-hero-stat-val">
                                                <i className="fa-solid fa-tree text-success me-1"></i>
                                                {botStatus.island_name}
                                            </div>
                                            <div className="ob-hero-stat-lbl">
                                                {botStatus.layer ? botStatus.layer.replace(/([A-Z])/g, ' $1').trim() : 'Order Island'}
                                            </div>
                                        </div>
                                    )}
                                    {typeof botStatus.queue_count === 'number' && (
                                        <div className="ob-hero-stat">
                                            <div className="ob-hero-stat-val">{botStatus.queue_count}</div>
                                            <div className="ob-hero-stat-lbl">In Queue</div>
                                        </div>
                                    )}
                                    {typeof botStatus.visitors_count === 'number' && (
                                        <div className="ob-hero-stat">
                                            <div className="ob-hero-stat-val">{botStatus.visitors_count}</div>
                                            <div className="ob-hero-stat-lbl">Visitors</div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ════════════════ MAIN BODY ════════════════ */}
            <div className="container py-2">
                {/* ── BOT MODE SELECTOR (Order Delivery vs In-Island Drop) ── */}
                <div className="d-flex align-items-center justify-content-center mb-4">
                    <div className="ob-mode-toggle-wrap">
                        <button
                            type="button"
                            onClick={() => {
                                setBotMode('order');
                                setModeOverridden(true);
                                playSound();
                            }}
                            className={`ob-mode-btn ${botMode === 'order' ? 'active order' : ''}`}
                        >
                            <i className="fa-solid fa-plane-departure"></i>
                            <span>Order Delivery (40 Slots)</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setBotMode('drop');
                                setModeOverridden(true);
                                playSound();
                            }}
                            className={`ob-mode-btn ${botMode === 'drop' ? 'active drop' : ''}`}
                        >
                            <i className="fa-solid fa-box-open"></i>
                            <span>In-Island Drop Bot (9 Slots)</span>
                        </button>
                    </div>
                </div>

                {/* ── REUSABLE HOW IT WORKS EXPLAINER ── */}
                <HowItWorksExplainer {...ORDER_BOT_EXPLAINER_CONFIG} className="mb-4" defaultExpanded={false} />

                {/* Drop Mode warning when user tries to order */}
                {botMode === 'order' && sintaIsDropMode && botAvailable && (
                    <div
                        className="alert alert-warning border-warning-subtle rounded-4 p-3 mb-4 d-flex align-items-center gap-2 shadow-2xs animate-fade"
                        role="alert"
                    >
                        <i className="fa-solid fa-triangle-exclamation text-warning fs-5" />
                        <div>
                            <strong>Drop Mode Active</strong>
                            <span className="text-muted ms-1 small">
                                — The bot is currently in Drop Mode. Order submissions are disabled until it switches to Order Mode.
                                {botStatus?.dodo_code && (
                                    <>
                                        {' '}
                                        Dodo Code: <strong className="text-success">{botStatus.dodo_code}</strong>
                                    </>
                                )}
                            </span>
                        </div>
                    </div>
                )}

                {botMode === 'order' ? (
                    <>
                        {/* Step indicator */}
                        <StepIndicator stage={stage} />

                        {/* Notification Permission Banner */}
                        {showNotifBanner && (
                            <div className="ob-notify-bar mb-4 shadow-2xs animate-fade d-flex align-items-center justify-content-between gap-3">
                                <div className="d-flex align-items-center gap-3 flex-grow-1 min-w-0">
                                    <i
                                        className="fa-solid fa-bell fs-5 flex-shrink-0"
                                        style={{ color: '#f59e0b' }}
                                        aria-hidden="true"
                                    />
                                    <div className="min-w-0">
                                        <span className="fw-bold text-dark">Enable Desktop Notifications</span>
                                        <span className="text-muted ms-1 d-none d-sm-inline">
                                            — get alerted the instant your Dodo code is ready, even if you browse other tabs.
                                        </span>
                                    </div>
                                </div>
                                <div className="d-flex align-items-center gap-2 flex-shrink-0">
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-warning text-dark fw-bold rounded-pill px-3 shadow-2xs"
                                        onClick={handleAllowNotifications}
                                    >
                                        Allow Notifications
                                    </button>
                                    <button
                                        type="button"
                                        className="ob-notify-close"
                                        onClick={handleDismissNotifBanner}
                                        title="Don't ask again"
                                        aria-label="Dismiss notification prompt"
                                    >
                                        <i className="fa-solid fa-xmark" />
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="row g-4">
                            {/* ════ MAIN COLUMN ════ */}
                            <div className="col-12 col-lg-8">
                                {/* ── OFFLINE BANNER ── */}
                                {botUnavailable && (
                                    <div className="ob-offline-banner mb-4 animate-fade" role="alert">
                                        <div className="d-flex align-items-center gap-3 flex-grow-1">
                                            <div className="ob-pulse red" aria-hidden="true" />
                                            <div>
                                                <span className="fw-bold text-dark me-2">Order Bot is Currently Offline</span>
                                                <span className="text-muted small">
                                                    You can still prepare your 40-slot pocket loadout below.
                                                </span>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-white bg-white border rounded-pill px-3 py-1 fw-bold text-dark shadow-2xs d-inline-flex align-items-center gap-1 flex-shrink-0"
                                            onClick={() => {
                                                playSound();
                                                refreshStatus();
                                            }}
                                            title="Refresh status"
                                        >
                                            <i
                                                className={`fa-solid fa-arrows-rotate ${statusLoading ? 'fa-spin text-success' : 'text-muted'
                                                    }`}
                                                aria-hidden="true"
                                            />
                                            <span>Refresh</span>
                                        </button>
                                    </div>
                                )}

                                {/* ══════════════════════════════════════
                                    STAGE: SUBMIT (BUILD & REVIEW)
                                ══════════════════════════════════════ */}
                                {stage === 'submit' && (
                                    <div className="ob-card accent-green shadow-sm mb-4">
                                        {/* Card Header */}
                                        <div className="d-flex align-items-center justify-content-between mb-3 pb-3 border-bottom flex-wrap gap-2">
                                            <div className="d-flex align-items-center gap-3">
                                                <div className="ob-card-icon" aria-hidden="true">
                                                    <i className="fa-solid fa-bag-shopping" />
                                                </div>
                                                <div>
                                                    <h2 className="h5 fw-bold mb-0 text-dark ac-font">
                                                        Your 40-Slot Pocket
                                                    </h2>
                                                    <p className="text-muted mb-0 tiny-text">
                                                        Synced with Command Builder &amp; Pocket Grid
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Quick toolbar chips */}
                                            <div className="d-flex gap-2 flex-wrap align-items-center">
                                                <button
                                                    type="button"
                                                    className="ob-action-chip"
                                                    onClick={() => {
                                                        playSound();
                                                        setShowQuickAddModal(true);
                                                    }}
                                                    title="Search catalog and add items directly"
                                                >
                                                    <i className="fa-solid fa-magnifying-glass text-success" />
                                                    <span>Search &amp; Add</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    className="ob-action-chip"
                                                    onClick={() => {
                                                        playSound();
                                                        setShowBundlesModal(true);
                                                    }}
                                                    title="Browse curated theme bundles"
                                                >
                                                    <i className="fa-solid fa-boxes-packing text-primary" />
                                                    <span>Bundles</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    className="ob-action-chip"
                                                    onClick={handleImportWishlist}
                                                    title="Import your favorited items from Wishlist"
                                                >
                                                    <i className="fa-solid fa-star text-warning" />
                                                    <span>Wishlist</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    className="ob-action-chip"
                                                    onClick={() => {
                                                        playSound();
                                                        setShowSavedLoadoutsModal(true);
                                                    }}
                                                    title="Manage saved custom pocket loadouts"
                                                >
                                                    <i className="fa-solid fa-floppy-disk text-info" />
                                                    <span>Saved ({savedLoadouts.length})</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    className="ob-action-chip"
                                                    onClick={() => {
                                                        playSound();
                                                        setShowShareModal(true);
                                                    }}
                                                    title="Share pocket via short link"
                                                >
                                                    <i className="fa-solid fa-share-nodes text-secondary" />
                                                    <span>Share</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Quick Fill Presets Bar */}
                                        <div className="ob-presets-container mb-3">
                                            <div className="d-flex align-items-center justify-content-between mb-2">
                                                <span className="tiny-text fw-bold text-muted text-uppercase tracking-wider">
                                                    <i className="fa-solid fa-wand-magic-sparkles text-warning me-1" />
                                                    Quick Presets &amp; Optimizers
                                                </span>
                                                {totalOrderCount > 0 && (
                                                    <button
                                                        type="button"
                                                        className="btn btn-link p-0 text-danger tiny-text fw-bold text-decoration-none"
                                                        onClick={() => {
                                                            playSound();
                                                            setOrderItems([]);
                                                        }}
                                                    >
                                                        <i className="fa-solid fa-trash-can me-1" /> Clear All
                                                    </button>
                                                )}
                                            </div>
                                            <div className="d-flex gap-2 flex-wrap align-items-center">
                                                {QUICK_PRESETS.map((preset) => (
                                                    <button
                                                        key={preset.id}
                                                        type="button"
                                                        className="ob-preset-chip"
                                                        onClick={() => handleApplyPreset(preset.fillType)}
                                                        title={`Fill pockets with ${preset.desc}`}
                                                    >
                                                        <img
                                                            src={preset.icon}
                                                            alt=""
                                                            style={{ width: 18, height: 18, objectFit: 'contain' }}
                                                        />
                                                        <span>{preset.name}</span>
                                                    </button>
                                                ))}
                                                {totalOrderCount > 0 && (
                                                    <button
                                                        type="button"
                                                        className="ob-preset-chip"
                                                        onClick={() => {
                                                            playSound();
                                                            handleMaximizeStacks();
                                                        }}
                                                        title="Maximize item stacks to full quantity"
                                                    >
                                                        <i className="fa-solid fa-layer-group text-success" />
                                                        <span>Max Stacks</span>
                                                    </button>
                                                )}
                                                {totalOrderCount > 0 && (
                                                    <button
                                                        type="button"
                                                        className="ob-preset-chip"
                                                        onClick={() => {
                                                            playSound();
                                                            handleSortPockets();
                                                        }}
                                                        title="Sort pockets alphabetically"
                                                    >
                                                        <i className="fa-solid fa-arrow-down-a-z text-primary" />
                                                        <span>Sort</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Capacity Progress Bar */}
                                        <div className="d-flex align-items-center justify-content-between mb-1 tiny-text fw-bold">
                                            <div className="d-flex align-items-center gap-2">
                                                <span className="text-dark">
                                                    {totalOrderItemsCount} / {ORDER_MAX} Item Slots Used
                                                </span>
                                                {orderVillager && (
                                                    <span className="badge bg-warning text-dark rounded-pill x-small fw-bold">
                                                        <i className="fa-solid fa-house-user me-1" />+ 1/1 Villager: {orderVillager.name}
                                                    </span>
                                                )}
                                            </div>
                                            <span className={capacityPct === 100 ? 'text-success fw-black' : 'text-muted'}>
                                                {capacityPct}% Full ({ORDER_MAX - totalOrderItemsCount} item slots remaining)
                                            </span>
                                        </div>
                                        <div
                                            className="progress mb-3"
                                            style={{ height: '8px', borderRadius: '10px', background: '#e2e8f0' }}
                                        >
                                            <div
                                                className="progress-bar transition-all bg-success"
                                                role="progressbar"
                                                style={{ width: `${capacityPct}%` }}
                                                aria-valuenow={totalOrderItemsCount}
                                                aria-valuemin={0}
                                                aria-valuemax={ORDER_MAX}
                                            />
                                        </div>

                                        {/* ── 40-SLOT POCKET GRID (Authentic ACNH Inventory Grid) ── */}
                                        {!hasAnyOrderContent ? (
                                            <div className="ob-empty-pocket my-4 text-center">
                                                <div className="text-success mb-2" style={{ fontSize: '3rem' }}>
                                                    <i className="fa-solid fa-bag-shopping" />
                                                </div>
                                                <h3 className="h5 fw-bold mb-1 text-dark ac-font">
                                                    Your pocket is empty
                                                </h3>
                                                <p
                                                    className="text-muted small mb-4"
                                                    style={{ maxWidth: 420, margin: '0 auto' }}
                                                >
                                                    Search items directly, choose one of the quick presets above, or load pre-made theme bundles. You can also add 1 moving-in villager to your order!
                                                </p>
                                                <div className="d-flex gap-2 justify-content-center flex-wrap">
                                                    <button
                                                        type="button"
                                                        className="btn btn-success text-white rounded-pill px-4 fw-bold shadow-2xs"
                                                        style={{ backgroundColor: '#37b06d', borderColor: '#37b06d' }}
                                                        onClick={() => {
                                                            playSound();
                                                            setShowQuickAddModal(true);
                                                        }}
                                                    >
                                                        <i className="fa-solid fa-magnifying-glass me-1" /> Search Catalog
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-primary rounded-pill px-4 fw-bold shadow-2xs"
                                                        onClick={() => {
                                                            playSound();
                                                            setShowBundlesModal(true);
                                                        }}
                                                    >
                                                        <i className="fa-solid fa-boxes-packing me-1" /> Theme Bundles
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-success rounded-pill px-4 fw-bold shadow-2xs"
                                                        onClick={() => handleApplyPreset('tickets')}
                                                    >
                                                        <i className="fa-solid fa-ticket me-1" /> Load 40× NMTs
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="ob-interactive-pocket-grid mb-3">
                                                    {/* Filled Regular Item Slots (0-40) */}
                                                    {regularOrderItems.map((entry) => (
                                                        <div
                                                            key={entry.item.id}
                                                            className="ob-interactive-tile"
                                                            title={entry.item.name}
                                                        >
                                                            <img
                                                                className="ob-tile-img"
                                                                src={entry.item.image || FALLBACK_IMG}
                                                                alt={entry.item.name}
                                                                onError={(ev) => {
                                                                    (ev.currentTarget as HTMLImageElement).src = FALLBACK_IMG;
                                                                }}
                                                            />
                                                            <span className="ob-tile-label">{entry.item.name}</span>
                                                            {entry.quantity > 1 && (
                                                                <span className="ob-tile-qty">×{entry.quantity}</span>
                                                            )}
                                                            {/* Hover overlay actions */}
                                                            <div className="ob-tile-actions">
                                                                <div className="ob-tile-hover-name">{entry.item.name}</div>
                                                                <div className="ob-tile-actions-row">
                                                                    <button
                                                                        type="button"
                                                                        className="ob-tile-btn dec"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            playSound();
                                                                            decreaseOrderQuantity(String(entry.item.id));
                                                                        }}
                                                                        title="Decrease quantity"
                                                                    >
                                                                        -
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        className="ob-tile-btn inc"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            playSound();
                                                                            increaseOrderQuantity(String(entry.item.id));
                                                                        }}
                                                                        disabled={totalOrderItemsCount >= ORDER_MAX}
                                                                        title="Increase quantity"
                                                                    >
                                                                        +
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        className="ob-tile-btn del"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            playSound();
                                                                            removeOrderItem(String(entry.item.id));
                                                                        }}
                                                                        title="Remove item"
                                                                    >
                                                                        <i className="fa-solid fa-xmark" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}

                                                    {/* Dashed Empty Slots up to 40 items */}
                                                    {Array.from({ length: emptySlotsCount }).map((_, i) => (
                                                        <button
                                                            key={`empty-${i}`}
                                                            type="button"
                                                            className="ob-interactive-tile empty text-decoration-none"
                                                            title="Empty slot — click to search and add items"
                                                            onClick={() => {
                                                                playSound();
                                                                setShowQuickAddModal(true);
                                                            }}
                                                        >
                                                            <i className="fa-solid fa-plus text-muted opacity-50 small" />
                                                        </button>
                                                    ))}
                                                </div>

                                                {/* ── DEDICATED 1/1 MOVING-IN VILLAGER IN BOXES CARD ── */}
                                                {orderVillager ? (
                                                    <div className="p-3 rounded-4 mb-3 border border-2 border-warning bg-warning bg-opacity-10 d-flex align-items-center justify-content-between flex-wrap gap-3 shadow-2xs">
                                                        <div className="d-flex align-items-center gap-3">
                                                            <div className="position-relative bg-white rounded-circle p-1 border border-warning shadow-2xs flex-shrink-0" style={{ width: 52, height: 52 }}>
                                                                <img
                                                                    src={orderVillager.image || FALLBACK_IMG}
                                                                    alt={orderVillager.name}
                                                                    className="w-100 h-100 rounded-circle object-fit-contain"
                                                                />
                                                                <span className="position-absolute bottom-0 end-0 badge rounded-pill bg-warning text-dark font-monospace" style={{ fontSize: '0.6rem' }}>
                                                                    1/1
                                                                </span>
                                                            </div>
                                                            <div>
                                                                <div className="d-flex align-items-center gap-2 flex-wrap">
                                                                    <strong className="text-dark ac-font fs-6 mb-0">{orderVillager.name}</strong>
                                                                    <span className="badge bg-warning text-dark rounded-pill x-small fw-bold">In Boxes (Moving In)</span>
                                                                    <span className="badge bg-dark text-white rounded-pill x-small font-monospace">villager:{orderVillager.id}</span>
                                                                </div>
                                                                <span className="tiny-text text-muted">
                                                                    {orderVillager.personality || 'Villager'} · Moving into your island's open plot with this order (does not use regular 40 item slots).
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="d-flex align-items-center gap-2">
                                                            <button
                                                                type="button"
                                                                className="btn btn-sm btn-outline-warning text-dark fw-bold rounded-pill px-3 py-1 shadow-2xs"
                                                                onClick={() => {
                                                                    playSound();
                                                                    setShowQuickAddModal(true);
                                                                }}
                                                                title="Replace moving-in villager"
                                                            >
                                                                <i className="fa-solid fa-arrows-rotate me-1" /> Replace
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="btn btn-sm btn-outline-danger fw-bold rounded-pill px-3 py-1 shadow-2xs"
                                                                onClick={() => {
                                                                    playSound();
                                                                    removeOrderVillager();
                                                                }}
                                                                title="Remove villager from order"
                                                            >
                                                                <i className="fa-solid fa-xmark me-1" /> Remove
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="p-2 px-3 rounded-4 mb-3 border border-2 border-dashed d-flex align-items-center justify-content-between flex-wrap gap-2" style={{ backgroundColor: 'rgba(254, 243, 199, 0.35)', borderColor: '#fcd34d' }}>
                                                        <div className="d-flex align-items-center gap-2">
                                                            <div className="rounded-circle d-flex align-items-center justify-content-center bg-warning bg-opacity-25" style={{ width: 34, height: 34 }}>
                                                                <i className="fa-solid fa-house-user text-warning" />
                                                            </div>
                                                            <div>
                                                                <span className="fw-bold text-dark small d-block">Moving-In Villager (Optional · 1/1)</span>
                                                                <span className="tiny-text text-muted">Include a villager in boxes alongside your 40 items without taking any item slots.</span>
                                                            </div>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            className="btn btn-xs btn-warning text-dark fw-bold rounded-pill px-3 py-1 shadow-2xs"
                                                            onClick={() => {
                                                                playSound();
                                                                setShowQuickAddModal(true);
                                                            }}
                                                        >
                                                            <i className="fa-solid fa-plus me-1" /> Add Villager (1/1)
                                                        </button>
                                                    </div>
                                                )}
                                            </>
                                        )}

                                        {/* Terminal Command Toggle Preview */}
                                        {hasAnyOrderContent && (
                                            <div className="mb-3">
                                                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                                                    <button
                                                        type="button"
                                                        className="btn btn-link p-0 text-muted tiny-text fw-bold text-decoration-none d-flex align-items-center gap-1"
                                                        onClick={() => setShowTerminal((s) => !s)}
                                                    >
                                                        <i
                                                            className={`fa-solid fa-chevron-${showTerminal ? 'down' : 'right'
                                                                }`}
                                                        />
                                                        <span>{showTerminal ? 'Hide' : 'View'} Raw Command Strings</span>
                                                    </button>

                                                    {/* Multi-Format Copy Chips */}
                                                    <div className="d-flex align-items-center gap-1 flex-wrap">
                                                        <button
                                                            type="button"
                                                            className="ob-copy-chip"
                                                            onClick={() =>
                                                                handleCopySpecific(
                                                                    orderCommandText,
                                                                    '!order command'
                                                                )
                                                            }
                                                            title="Copy !order command (Items + Villager)"
                                                        >
                                                            <i className="fa-solid fa-copy text-success" />
                                                            <span>!order</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="ob-copy-chip"
                                                            onClick={() =>
                                                                handleCopySpecific(
                                                                    dropItemsOnlyCommand || dropCommandText,
                                                                    '!drop items'
                                                                )
                                                            }
                                                            title="Copy !drop items command"
                                                        >
                                                            <i className="fa-solid fa-plane-arrival text-primary" />
                                                            <span>!drop</span>
                                                        </button>
                                                        {dropVillagerCommand && (
                                                            <button
                                                                type="button"
                                                                className="ob-copy-chip"
                                                                onClick={() =>
                                                                    handleCopySpecific(
                                                                        dropVillagerCommand,
                                                                        '!drop villager'
                                                                    )
                                                                }
                                                                title="Copy !drop <villager> command"
                                                            >
                                                                <i className="fa-solid fa-person-falling text-danger" />
                                                                <span>!drop villager</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                {showTerminal && (
                                                    <div className="ob-terminal-box mb-3 select-all position-relative">
                                                        <div className="text-break pe-5">{orderCommandText}</div>
                                                        <button
                                                            type="button"
                                                            className="btn btn-xs btn-light position-absolute top-0 end-0 m-2 rounded-pill px-2 py-1 tiny-text fw-bold border"
                                                            onClick={handleCopyCommand}
                                                        >
                                                            <i
                                                                className={`fa-solid ${commandCopied ? 'fa-check text-success' : 'fa-copy'
                                                                    } me-1`}
                                                            />
                                                            {commandCopied ? 'Copied' : 'Copy All'}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* ── SUBMIT BAR & PASSPORT ── */}
                                        <div className="border-top pt-3 mt-3">
                                            {/* Nickname Missing Warning Notice */}
                                            {!hasValidNickname && user && (
                                                <div className="alert alert-warning border border-warning border-opacity-40 p-3 rounded-4 mb-3 d-flex align-items-center justify-content-between flex-wrap gap-3 shadow-2xs animate-fade">
                                                    <div className="d-flex align-items-center gap-2">
                                                        <span
                                                            className="badge bg-warning text-dark rounded-circle p-2 d-flex align-items-center justify-content-center flex-shrink-0"
                                                            style={{ width: 36, height: 36, fontSize: '1rem' }}
                                                        >
                                                            <i className="fa-solid fa-triangle-exclamation" />
                                                        </span>
                                                        <div>
                                                            <strong className="d-block text-dark small">
                                                                Discord Server Nickname Required
                                                            </strong>
                                                            <span className="tiny-text text-muted">
                                                                ChoBot requires your server nickname to be in <code>Character Name | Island Name</code> format before you can order.
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm text-white fw-bold rounded-pill px-3 py-1.5 shadow-sm d-inline-flex align-items-center gap-2"
                                                        style={{ backgroundColor: '#5865F2' }}
                                                        onClick={() => {
                                                            setShowNicknameModal(true);
                                                            playChimeClick();
                                                        }}
                                                    >
                                                        <i className="fa-brands fa-discord" />
                                                        <span>Set Up Nickname</span>
                                                    </button>
                                                </div>
                                            )}

                                            {/* Profile & Active In-Game Character Strip */}
                                            <div className="ob-passport-card mb-3 flex-wrap">
                                                <div className="d-flex align-items-center gap-3 flex-wrap min-w-0">
                                                    <div
                                                        className="rounded-circle d-flex align-items-center justify-content-center bg-success text-white shadow-2xs flex-shrink-0"
                                                        style={{ width: 42, height: 42, fontSize: '1.1rem' }}
                                                    >
                                                        <i
                                                            className={`fa-solid ${characters.find((c) => c.id === orderProfile?.characterId)
                                                                    ?.icon || 'fa-leaf'
                                                                }`}
                                                        />
                                                    </div>
                                                    <div className="lh-sm min-w-0">
                                                        <div className="small fw-bold text-dark d-flex align-items-center gap-2 flex-wrap">
                                                            <span>Ordering For:</span>
                                                            <span className="badge bg-success text-white rounded-pill px-2 py-1 ac-font text-truncate" style={{ maxWidth: 200 }}>
                                                                {orderProfile?.orderFor || user?.username}
                                                            </span>
                                                            {orderProfile?.islandName && (
                                                                <span className="text-muted fw-bold tiny-text d-inline-flex align-items-center gap-1 text-truncate" style={{ maxWidth: 180 }}>
                                                                    <i className="fa-solid fa-mountain-sun text-success" />
                                                                    <span className="text-truncate">{orderProfile.islandName}</span>
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="tiny-text d-flex align-items-center gap-2 mt-1 flex-wrap">
                                                            <span className="d-inline-flex align-items-center gap-1 text-truncate">
                                                                <i className="fa-brands fa-discord text-primary flex-shrink-0" />
                                                                <span className="text-muted">Server Nick:</span>
                                                                {hasValidNickname ? (
                                                                    <strong className="text-primary font-monospace">{serverNickname}</strong>
                                                                ) : (
                                                                    <span className="text-danger fw-bold">Not Set (Required)</span>
                                                                )}
                                                            </span>
                                                            {hasValidNickname ? (
                                                                <span className="badge bg-success bg-opacity-15 text-success rounded-pill x-small fw-bold d-inline-flex align-items-center gap-1">
                                                                    <i className="fa-solid fa-circle-check" />
                                                                    <span>Verified</span>
                                                                </span>
                                                            ) : (
                                                                <span className="badge bg-warning bg-opacity-20 text-dark rounded-pill x-small fw-bold">
                                                                    Setup Required
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="d-flex align-items-center gap-2 flex-wrap">
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-primary rounded-pill fw-bold px-3 py-1 shadow-2xs d-inline-flex align-items-center gap-1"
                                                        onClick={() => {
                                                            setShowNicknameModal(true);
                                                            playChimeClick();
                                                        }}
                                                        title="Edit or Choose Discord Server Nickname"
                                                    >
                                                        <i className="fa-brands fa-discord" />
                                                        <span>{hasValidNickname ? 'Edit / Choose Nick' : 'Set Up Nickname'}</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-success rounded-pill fw-bold px-3 py-1 shadow-2xs d-inline-flex align-items-center gap-1"
                                                        onClick={handleOpenSetup}
                                                        title="Change In-Game Character"
                                                    >
                                                        <i className="fa-solid fa-address-card" />
                                                        <span>Switch Character</span>
                                                    </button>
                                                </div>
                                            </div>

                                            {submitError && (
                                                <div
                                                    className="alert alert-danger py-2 d-flex align-items-center gap-2 mb-3 rounded-3 small"
                                                    role="alert"
                                                >
                                                    <i
                                                        className="fa-solid fa-circle-exclamation flex-shrink-0 fs-5"
                                                        aria-hidden="true"
                                                    />
                                                    <span>{submitError}</span>
                                                </div>
                                            )}

                                            <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
                                                <button
                                                    id="ob-send-order-btn"
                                                    className={`btn rounded-pill fw-black px-4 py-3 shadow-sm d-inline-flex align-items-center gap-2 ${
                                                        !hasValidNickname ? 'btn-primary' : 'btn-success'
                                                    }`}
                                                    onClick={
                                                        !hasValidNickname
                                                            ? () => {
                                                                  setShowNicknameModal(true);
                                                                  playChimeClick();
                                                              }
                                                            : !orderProfile
                                                                ? handleOpenSetup
                                                                : handleSubmit
                                                    }
                                                    disabled={
                                                        !canSubmitOrder ||
                                                        !hasAnyOrderContent ||
                                                        submitLoading ||
                                                        stage !== 'submit'
                                                    }
                                                    aria-busy={submitLoading}
                                                    style={{
                                                        fontSize: '1.05rem',
                                                        minWidth: 200,
                                                        backgroundColor: !hasValidNickname ? '#5865F2' : '#37b06d',
                                                        borderColor: !hasValidNickname ? '#5865F2' : '#37b06d',
                                                    }}
                                                >
                                                    {submitLoading ? (
                                                        <>
                                                            <span
                                                                className="spinner-border spinner-border-sm"
                                                                aria-hidden="true"
                                                            />
                                                            <span>Submitting Order…</span>
                                                        </>
                                                    ) : !hasValidNickname ? (
                                                        <>
                                                            <i className="fa-brands fa-discord" aria-hidden="true" />
                                                            <span>Set Up Nickname to Order</span>
                                                        </>
                                                    ) : !orderProfile ? (
                                                        <>
                                                            <i className="fa-solid fa-user-gear" aria-hidden="true" />
                                                            <span>Set Up Profile &amp; Order</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <i
                                                                className="fa-solid fa-paper-plane"
                                                                aria-hidden="true"
                                                            />
                                                            <span>
                                                                Send Order ({totalOrderItemsCount > 0 ? `${totalOrderItemsCount} Item${totalOrderItemsCount === 1 ? '' : 's'}` : ''}{totalOrderItemsCount > 0 && orderVillager ? ' + ' : ''}{orderVillager ? `${orderVillager.name} (Villager)` : ''})
                                                            </span>
                                                        </>
                                                    )}
                                                </button>

                                                {!botAvailable && !statusLoading && (
                                                    <span className="text-dark small fw-bold bg-warning bg-opacity-10 px-3 py-1 rounded-pill border border-warning border-opacity-30">
                                                        <i
                                                            className="fa-solid fa-moon text-warning me-1"
                                                            aria-hidden="true"
                                                        />
                                                        Bot is resting • Copy !order command for Discord
                                                    </span>
                                                )}
                                                {!hasAnyOrderContent && user && (
                                                    <span className="text-muted small">
                                                        <i className="fa-solid fa-info-circle me-1" />
                                                        Add at least 1 item or villager to submit your order.
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* ══════════════════════════════════════
                                    STAGE: TRACKER (LIVE RADAR & DODO)
                                ══════════════════════════════════════ */}
                                {stage === 'tracker' && (
                                    <div className="ob-card accent-green shadow-sm mb-4 animate-fade">
                                        {/* Top status bar */}
                                        <div className="d-flex align-items-center justify-content-between mb-3 pb-3 border-bottom flex-wrap gap-2">
                                            <div className="d-flex align-items-center gap-3">
                                                <div className="ob-card-icon blue" aria-hidden="true">
                                                    <i className="fa-solid fa-satellite-dish" />
                                                </div>
                                                <div>
                                                    <h2 className="h5 fw-bold mb-0 text-dark ac-font">
                                                        Order Flight Tracker
                                                    </h2>
                                                    {activeOrderId && (
                                                        <p
                                                            className="text-muted mb-0 font-monospace"
                                                            style={{ fontSize: '.72rem' }}
                                                        >
                                                            Order #{activeOrderId}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            {!isDone && !isReady && (
                                                <button
                                                    id="ob-cancel-btn"
                                                    className="btn btn-sm btn-outline-danger rounded-pill fw-bold px-3 py-1 shadow-2xs d-inline-flex align-items-center gap-1"
                                                    onClick={() => {
                                                        playSound();
                                                        setShowCancelModal(true);
                                                    }}
                                                    disabled={cancelLoading}
                                                    aria-label="Cancel order"
                                                >
                                                    <i className="fa-solid fa-xmark" aria-hidden="true" />
                                                    <span>Cancel Order</span>
                                                </button>
                                            )}
                                        </div>

                                        {/* ── Flightpath Radar Telemetry Visualizer ── */}
                                        <div className="ob-flightpath-container mb-4">
                                            <div className="d-flex align-items-center justify-content-between">
                                                <div className="d-flex align-items-center gap-2">
                                                    <span className="badge bg-dark text-white rounded-pill x-small fw-bold">
                                                        DAL FLIGHT RADAR
                                                    </span>
                                                    <span className="tiny-text text-muted">
                                                        {statusStr === 'preparing'
                                                            ? 'Laying items on ground...'
                                                            : isReady
                                                                ? 'Landed at airport gate!'
                                                                : 'In transit to island...'}
                                                    </span>
                                                </div>
                                                <span className="tiny-text fw-black text-success">
                                                    {flightProgressPct}% Dispatched
                                                </span>
                                            </div>

                                            <div className="ob-flightpath-track">
                                                <div
                                                    className="ob-flightpath-fill"
                                                    style={{ width: `${flightProgressPct}%` }}
                                                />
                                                <div
                                                    className="ob-flightpath-plane"
                                                    style={{ left: `${flightProgressPct}%` }}
                                                >
                                                    <i className="fa-solid fa-plane" />
                                                </div>
                                            </div>

                                            <div className="d-flex justify-content-between tiny-text text-muted fw-bold">
                                                <span>
                                                    <i className="fa-solid fa-plane-departure text-primary me-1" />
                                                    Gate 1
                                                </span>
                                                <span>
                                                    <i className="fa-solid fa-bolt text-warning me-1" />
                                                    Queue Dispatch
                                                </span>
                                                <span>
                                                    <i className="fa-solid fa-tree text-success me-1" />
                                                    Island Touchdown
                                                </span>
                                            </div>
                                        </div>

                                        {/* Order State Progression Bar */}
                                        <div className="ob-order-progress-steps mb-4">
                                            <div className="ob-prog-step active">
                                                <div className="ob-prog-dot">
                                                    <i className="fa-solid fa-check" />
                                                </div>
                                                <span className="ob-prog-text">Submitted</span>
                                            </div>
                                            <div
                                                className={`ob-prog-step ${['queued', 'preparing', 'ready', 'completed'].includes(statusStr)
                                                        ? 'active'
                                                        : ''
                                                    }`}
                                            >
                                                <div className="ob-prog-dot">
                                                    {statusStr === 'queued' ? (
                                                        <span className="spinner-border spinner-border-sm" />
                                                    ) : (
                                                        <i className="fa-solid fa-check" />
                                                    )}
                                                </div>
                                                <span className="ob-prog-text">
                                                    {typeof orderStatus?.queuePosition === 'number'
                                                        ? orderStatus.queuePosition > 0
                                                            ? `In Queue (#${orderStatus.queuePosition})`
                                                            : 'In Queue (Next Up)'
                                                        : 'In Queue'}
                                                </span>
                                            </div>
                                            <div
                                                className={`ob-prog-step ${['preparing', 'ready', 'completed'].includes(statusStr)
                                                        ? 'active'
                                                        : ''
                                                    }`}
                                            >
                                                <div className="ob-prog-dot">
                                                    {statusStr === 'preparing' ? (
                                                        <i className="fa-solid fa-gears fa-spin" />
                                                    ) : isReady || statusStr === 'completed' ? (
                                                        <i className="fa-solid fa-check" />
                                                    ) : (
                                                        <i className="fa-solid fa-box" />
                                                    )}
                                                </div>
                                                <span className="ob-prog-text">Preparing Items</span>
                                            </div>
                                            <div
                                                className={`ob-prog-step ${isReady || statusStr === 'completed' ? 'active ready-step' : ''
                                                    }`}
                                            >
                                                <div className="ob-prog-dot">
                                                    {isReady ? (
                                                        <i className="fa-solid fa-plane-arrival" />
                                                    ) : (
                                                        <i className="fa-solid fa-ticket" />
                                                    )}
                                                </div>
                                                <span className="ob-prog-text">Dodo Ready</span>
                                            </div>
                                        </div>

                                        {/* Cancelled / Timed Out Banner */}
                                        {statusStr === 'cancelled' && (
                                            <div
                                                className="alert alert-danger border-danger-subtle rounded-4 p-3 mb-4 animate-fade shadow-2xs"
                                                role="alert"
                                            >
                                                <div className="d-flex align-items-center gap-2 mb-1">
                                                    <i className="fa-solid fa-circle-xmark fs-5 text-danger" />
                                                    <strong className="text-danger">Flight Gate Expired or Cancelled</strong>
                                                </div>
                                                <p className="tiny-text text-dark mb-3">
                                                    {orderStatus?.message ||
                                                        'The flight arrival window has ended or the order was cancelled. You can easily re-order your items anytime!'}
                                                </p>
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-danger rounded-pill px-3 fw-bold shadow-2xs"
                                                    onClick={handleReset}
                                                >
                                                    <i className="fa-solid fa-rotate-left me-1" /> Re-Order Items
                                                </button>
                                            </div>
                                        )}

                                        {/* Preparing Items on Island Banner */}
                                        {statusStr === 'preparing' && (
                                            <div
                                                className="alert alert-warning border-warning-subtle rounded-4 p-3 mb-4 animate-fade shadow-2xs text-start"
                                                role="status"
                                            >
                                                <div className="d-flex align-items-center gap-3">
                                                    <div
                                                        className="rounded-circle d-flex align-items-center justify-content-center text-white flex-shrink-0"
                                                        style={{ width: 44, height: 44, background: '#d97706' }}
                                                    >
                                                        <i className="fa-solid fa-gears fa-spin fs-5" />
                                                    </div>
                                                    <div>
                                                        <h3 className="h6 fw-black text-dark mb-1 ac-font">
                                                            Preparing Items on Island
                                                        </h3>
                                                        <p className="tiny-text text-muted mb-0">
                                                            ChoBot is currently placing your 40 pocket items on the ground
                                                            on {orderStatus?.islandName || 'the island'}. Your private
                                                            Dodo Code™ will arrive momentarily!
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Metrics strip */}
                                        {!isReady && !isDone && orderStatus && (
                                            <div className="row g-3 mb-4">
                                                {typeof orderStatus.queuePosition === 'number' && (
                                                    <div className="col-6">
                                                        <div className="bg-light rounded-4 p-3 border text-center">
                                                            <div className="tiny-text text-muted fw-bold text-uppercase">
                                                                Your Position
                                                            </div>
                                                            <div className="h2 fw-black text-success mb-0 ac-font">
                                                                {statusStr === 'preparing'
                                                                    ? 'Up Next'
                                                        : 'Next Up'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                                {orderStatus.estimatedMinutes !== undefined && (
                                                    <div className="col-6">
                                                        <div className="bg-light rounded-4 p-3 border text-center">
                                                            <div className="tiny-text text-muted fw-bold text-uppercase">
                                                                Estimated Wait
                                                            </div>
                                                            <div className="h2 fw-black text-dark mb-0 ac-font">
                                                                {statusStr === 'preparing'
                                                                    ? '< 1 min'
                                                                    : fmtEta(orderStatus.estimatedMinutes)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {showNotifBanner && !isDone && (
                                            <div className="alert alert-warning border-warning-subtle rounded-4 p-3 mb-4 d-flex align-items-center justify-content-between flex-wrap gap-2 shadow-2xs">
                                                <div className="d-flex align-items-center gap-2">
                                                    <i className="fa-solid fa-bell text-warning fs-5"></i>
                                                    <div>
                                                        <strong className="d-block text-dark small fw-bold">
                                                            Get notified when your Dodo is ready
                                                        </strong>
                                                        <span className="tiny-text text-muted">
                                                            We'll alert your browser so you don't miss your flight.
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="d-flex align-items-center gap-2">
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-warning text-dark rounded-pill fw-bold px-3 shadow-2xs"
                                                        onClick={handleAllowNotifications}
                                                    >
                                                        <i className="fa-solid fa-bell me-1"></i>Enable Alerts
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="ob-notify-close"
                                                        onClick={handleDismissNotifBanner}
                                                        title="Don't ask again"
                                                        aria-label="Dismiss notification prompt"
                                                    >
                                                        <i className="fa-solid fa-xmark" />
                                                    </button>
                                                </div>
                                            </div>
                                        )}



                                        {/* ── BOARDING PASS / DODO CODE REVEAL CARD ── */}
                                        {isReady && orderStatus?.dodoCode && (
                                            <div
                                                className="ob-boarding-pass-card mb-4 shadow-sm"
                                                role="status"
                                                aria-live="polite"
                                            >
                                                <div className="ob-pass-header d-flex align-items-center justify-content-between">
                                                    <div className="d-flex align-items-center gap-2">
                                                        <i className="fa-solid fa-plane-departure text-warning fs-4" />
                                                        <div>
                                                            <span className="ob-pass-badge">DODO AIRLINES EXPRESS</span>
                                                            <h3 className="h5 fw-black text-white mb-0">
                                                                <i className="fa-solid fa-plane-arrival text-warning me-2" />
                                                                Fly to {orderStatus.islandName || 'Order Island'}
                                                            </h3>
                                                        </div>
                                                    </div>
                                                    <span className="badge bg-white text-success rounded-pill fw-black px-3 py-1">
                                                        READY FOR PICKUP
                                                    </span>
                                                </div>

                                                <div className="ob-pass-body text-center">
                                                    <div className="tiny-text text-white-50 fw-bold text-uppercase tracking-wider mb-1">
                                                        Your Private Dodo Code™
                                                    </div>
                                                    <div className="ob-pass-dodo-display">{orderStatus.dodoCode}</div>

                                                    <div className="d-flex justify-content-center gap-2 mt-3">
                                                        <button
                                                            id="ob-copy-dodo-btn"
                                                            className={`btn btn-lg rounded-pill fw-black px-5 py-3 shadow-sm d-inline-flex align-items-center gap-2 ${dodoCopied
                                                                    ? 'btn-success text-white'
                                                                    : 'btn-warning text-dark'
                                                                }`}
                                                            onClick={handleCopyDodo}
                                                            aria-label={
                                                                dodoCopied
                                                                    ? 'Dodo code copied'
                                                                    : `Copy Dodo code ${orderStatus.dodoCode}`
                                                            }
                                                        >
                                                            <i
                                                                className={`fa-solid ${dodoCopied ? 'fa-check' : 'fa-copy'
                                                                    }`}
                                                                aria-hidden="true"
                                                            />
                                                            <span>
                                                                {dodoCopied
                                                                    ? 'Copied to Clipboard!'
                                                                    : 'Copy Dodo Code'}
                                                            </span>
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="ob-pass-footer d-flex align-items-center justify-content-between flex-wrap gap-2">
                                                    <div className="d-flex align-items-center gap-2 tiny-text text-white-50">
                                                        <i className="fa-solid fa-circle-info text-warning" />
                                                        <span>
                                                            Talk to Orville → "I wanna fly!" → "Via online play" →
                                                            "Dodo Code™"
                                                        </span>
                                                    </div>
                                                    <span className="font-monospace text-white-50 tiny-text">
                                                        Gate Pass: #{activeOrderId?.slice(0, 10)}
                                                    </span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Message alert if any */}
                                        {!isDone && orderStatus?.message && (
                                            <div className="alert alert-info py-2 small d-flex align-items-center gap-2 mb-3 rounded-3">
                                                <i className="fa-solid fa-circle-info text-primary flex-shrink-0" />
                                                <span>{orderStatus.message}</span>
                                            </div>
                                        )}

                                        {/* Polling live ticker */}
                                        {!isDone && !isReady && (
                                            <div className="ob-polling d-flex align-items-center gap-2 text-muted tiny-text mb-3">
                                                <span
                                                    className="spinner-border spinner-border-sm text-success"
                                                    style={{ width: 12, height: 12 }}
                                                />
                                                <span>
                                                    {statusStr === 'preparing'
                                                        ? 'Dropping items on island ground...'
                                                        : `Syncing live radar every ${POLL_MS / 1000}s…`}
                                                </span>
                                            </div>
                                        )}

                                        {/* Completion actions */}
                                        {(isDone || isReady) && (
                                            <div className="d-flex gap-2 flex-wrap pt-2 border-top">
                                                <button
                                                    id="ob-new-order-btn"
                                                    className="btn btn-success text-white rounded-pill px-4 py-2 fw-bold shadow-2xs"
                                                    style={{ backgroundColor: '#37b06d', borderColor: '#37b06d' }}
                                                    onClick={handleReset}
                                                >
                                                    <i className="fa-solid fa-rotate-left me-1" /> Place Another Order
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-outline-success rounded-pill px-4 py-2 fw-bold shadow-2xs"
                                                    onClick={() => {
                                                        playSound();
                                                        setShowQuickAddModal(true);
                                                    }}
                                                >
                                                    <i className="fa-solid fa-pencil me-1" /> Add More Items
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* ════ SIDEBAR ════ */}
                            <div className="col-12 col-lg-4">
                                {/* ── Quick Tools ── */}
                                <div className="ob-card shadow-sm mb-3">
                                    <div className="ob-card-head mb-3">
                                        <div className="ob-card-icon" aria-hidden="true">
                                            <i className="fa-solid fa-compass" />
                                        </div>
                                        <div>
                                            <h3 className="h6 fw-bold mb-0 text-dark ac-font">
                                                Order Tools &amp; Nav
                                            </h3>
                                            <p className="text-muted mb-0 tiny-text">Quick island &amp; pocket actions</p>
                                        </div>
                                    </div>
                                    <div className="d-flex flex-column gap-2">
                                        <button
                                            type="button"
                                            className="btn ob-tool-link text-start"
                                            onClick={handleOpenHistoryModal}
                                        >
                                            <div className="ob-tool-icon">
                                                <i className="fa-solid fa-clock-rotate-left" aria-hidden="true" />
                                            </div>
                                            <div>
                                                <div className="fw-bold small text-dark ac-font">
                                                    Order History
                                                </div>
                                                <div className="tiny-text text-muted">1-click reorder past pockets</div>
                                            </div>
                                        </button>

                                        <button
                                            type="button"
                                            className="btn ob-tool-link text-start"
                                            onClick={() => {
                                                playSound();
                                                setShowBundlesModal(true);
                                            }}
                                        >
                                            <div className="ob-tool-icon" style={{ background: '#e0f2fe', color: '#0284c7' }}>
                                                <i className="fa-solid fa-boxes-packing" aria-hidden="true" />
                                            </div>
                                            <div>
                                                <div className="fw-bold small text-dark ac-font">
                                                    Curated Bundles
                                                </div>
                                                <div className="tiny-text text-muted">Sanrio, Tools, DIYs, Real Art</div>
                                            </div>
                                        </button>

                                        <button
                                            type="button"
                                            className="btn ob-tool-link text-start"
                                            onClick={() => {
                                                playSound();
                                                setShowSavedLoadoutsModal(true);
                                            }}
                                        >
                                            <div className="ob-tool-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
                                                <i className="fa-solid fa-floppy-disk" aria-hidden="true" />
                                            </div>
                                            <div>
                                                <div className="fw-bold small text-dark ac-font">
                                                    Saved Loadouts
                                                </div>
                                                <div className="tiny-text text-muted">Save &amp; load custom 40-slots</div>
                                            </div>
                                        </button>

                                        <Link
                                            to="/command-builder"
                                            className="ob-tool-link"
                                            onClick={() => playSound()}
                                        >
                                            <div className="ob-tool-icon">
                                                <i className="fa-solid fa-cubes-stacked" aria-hidden="true" />
                                            </div>
                                            <div>
                                                <div className="fw-bold small text-dark ac-font">
                                                    Command Builder
                                                </div>
                                                <div className="tiny-text text-muted">Full catalog &amp; custom hex</div>
                                            </div>
                                        </Link>

                                        <Link
                                            to="/islands"
                                            className="ob-tool-link"
                                            onClick={() => playSound()}
                                        >
                                            <div className="ob-tool-icon">
                                                <i className="fa-solid fa-map-location-dot" aria-hidden="true" />
                                            </div>
                                            <div>
                                                <div className="fw-bold small text-dark ac-font">
                                                    Treasure Islands
                                                </div>
                                                <div className="tiny-text text-muted">Explore free public islands</div>
                                            </div>
                                        </Link>
                                    </div>
                                </div>

                                {/* ── Live Queue Drawer ── */}
                                <div className="ob-card shadow-sm mb-3">
                                    <button
                                        id="ob-queue-toggle"
                                        className="d-flex align-items-center justify-content-between w-100 bg-transparent border-0 p-0"
                                        onClick={() => {
                                            playSound();
                                            setQueueOpen((o) => !o);
                                        }}
                                        aria-expanded={queueOpen}
                                        aria-controls="ob-queue-panel"
                                    >
                                        <div className="d-flex align-items-center gap-2">
                                            <div
                                                className="ob-card-icon"
                                                style={{ width: 34, height: 34, borderRadius: 10, fontSize: '.85rem' }}
                                            >
                                                <i className="fa-solid fa-list-ol" />
                                            </div>
                                            <div className="text-start">
                                                <span className="fw-bold small d-block text-dark ac-font">
                                                    Live Order Queue
                                                </span>
                                                <span className="tiny-text text-muted">
                                                    {typeof botStatus?.queue_count === 'number'
                                                        ? botStatus.queue_count === 0
                                                            ? '0 players waiting (Empty)'
                                                            : `${botStatus.queue_count} player${botStatus.queue_count === 1 ? '' : 's'} waiting`
                                                        : `${queue.length} player${queue.length === 1 ? '' : 's'} waiting`}
                                                </span>
                                            </div>
                                        </div>
                                        <i
                                            className={`fa-solid fa-chevron-${queueOpen ? 'up' : 'down'} text-muted small`}
                                            aria-hidden="true"
                                        />
                                    </button>

                                    {queueOpen && (
                                        <div id="ob-queue-panel" className="mt-3 pt-3 border-top animate-fade">
                                            {queueLoading && !queueLoaded ? (
                                                <div className="text-center py-3 text-muted small">
                                                    <span
                                                        className="spinner-border spinner-border-sm text-success me-2"
                                                        aria-hidden="true"
                                                    />
                                                    <span>Checking live queue…</span>
                                                </div>
                                            ) : queue.length === 0 ? (
                                                <div className="text-center py-3 text-muted small">
                                                    <i className="fa-solid fa-inbox fs-4 d-block mb-2 opacity-50" />
                                                    <span>The queue is currently empty.</span>
                                                    <span className="d-block tiny-text text-muted mt-1">
                                                        Send your order to be #1 in line!
                                                    </span>
                                                </div>
                                            ) : (
                                                <QueueList queue={queue} myOrderId={activeOrderId ?? undefined} />
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* ── Flight Steps Guide ── */}
                                <div className="ob-card shadow-sm">
                                    <div className="ob-card-head mb-3">
                                        <div
                                            className="ob-card-icon"
                                            style={{ width: 34, height: 34, borderRadius: 10, fontSize: '.85rem' }}
                                        >
                                            <i className="fa-solid fa-circle-question" />
                                        </div>
                                        <span className="fw-bold small text-dark ac-font">
                                            How Ordering Works
                                        </span>
                                    </div>
                                    {[
                                        {
                                            icon: 'fa-cubes-stacked',
                                            title: '1. Build Pockets',
                                            text: 'Pick up to 40 items in Search, Bundles, or Presets.',
                                        },
                                        {
                                            icon: 'fa-paper-plane',
                                            title: '2. Send Order',
                                            text: 'Click Send Order to join the live bot dispatch queue.',
                                        },
                                        {
                                            icon: 'fa-satellite-dish',
                                            title: '3. Track Radar',
                                            text: 'Watch your queue position & estimated wait time.',
                                        },
                                        {
                                            icon: 'fa-plane',
                                            title: '4. Fly In',
                                            text: 'Enter your personal Dodo code at Dodo Airlines to collect.',
                                        },
                                    ].map((step, i) => (
                                        <div key={i} className="d-flex align-items-start gap-2 mb-2">
                                            <div className="ob-how-num" aria-hidden="true">
                                                {i + 1}
                                            </div>
                                            <div>
                                                <strong className="d-block tiny-text text-dark">{step.title}</strong>
                                                <span className="text-muted tiny-text">{step.text}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    /* ══════════════════════════════════════
                        IN-ISLAND DROP BOT (9 SLOTS)
                    ══════════════════════════════════════ */
                    <div className="row g-4 animate-fade">
                        {/* ════ MAIN DROP COLUMN ════ */}
                        <div className="col-12 col-lg-8">
                            {/* ── STEP 1: SELECT DESTINATION SUB MEMBER ISLAND ── */}
                            <div className="ob-card accent-green shadow-sm mb-4">
                                <div className="d-flex align-items-center justify-content-between mb-3 pb-3 border-bottom flex-wrap gap-2">
                                    <div className="d-flex align-items-center gap-3">
                                        <div className="ob-card-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
                                            <i className="fa-solid fa-crown" />
                                        </div>
                                        <div>
                                            <h2 className="h5 fw-bold mb-0 text-dark ac-font">
                                                1. Select Destination Sub Member Island
                                            </h2>
                                            <p className="text-muted mb-0 tiny-text">
                                                Select a Sub Member island to receive your in-game item drops
                                            </p>
                                        </div>
                                    </div>

                                    {/* Filter Pills */}
                                    <div className="d-flex gap-1 bg-light p-1 rounded-pill border flex-wrap">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setDropFilter('all');
                                                playSound();
                                            }}
                                            className={`btn btn-xs rounded-pill fw-bold px-3 py-1 transition-all ${dropFilter === 'all'
                                                    ? 'btn-dark text-white shadow-2xs'
                                                    : 'text-muted border-0 bg-transparent'
                                                }`}
                                            style={{ fontSize: '0.72rem' }}
                                        >
                                            All Sub Islands ({subMemberIslands.length})
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setDropFilter('unlocked');
                                                playSound();
                                            }}
                                            className={`btn btn-xs rounded-pill fw-bold px-3 py-1 transition-all ${dropFilter === 'unlocked'
                                                    ? 'btn-dark text-white shadow-2xs'
                                                    : 'text-muted border-0 bg-transparent'
                                                }`}
                                            style={{ fontSize: '0.72rem' }}
                                        >
                                            <i className="fa-solid fa-crown me-1 text-warning"></i>
                                            My Sub Islands (
                                            {
                                                subMemberIslands.filter(
                                                    (i) => !!user && canAccessIsland(i.requiredRoles)
                                                ).length
                                            }
                                            )
                                        </button>
                                    </div>
                                </div>

                                {/* Sub Requirement Notice for Guest / Non-Sub */}
                                {(!user ||
                                    subMemberIslands.every((i) => !user || !canAccessIsland(i.requiredRoles))) && (
                                        <div className="alert alert-warning rounded-4 border-0 p-3 mb-3 d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-2 shadow-2xs">
                                            <div className="d-flex align-items-center gap-2">
                                                <i className="fa-solid fa-crown text-warning fs-5 flex-shrink-0"></i>
                                                <span className="small fw-bold text-dark">
                                                    {user
                                                        ? 'You do not currently have an active Sub Member subscription tier.'
                                                        : 'Log in with your Discord account to access your Sub Islands.'}
                                                </span>
                                            </div>
                                            {user ? (
                                                <Link
                                                    to="/membership"
                                                    className="btn btn-sm btn-dark rounded-pill fw-bold px-3 text-nowrap"
                                                >
                                                    View Memberships
                                                </Link>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={login}
                                                    className="btn btn-sm btn-dark rounded-pill fw-bold px-3 text-nowrap"
                                                >
                                                    <i className="fa-brands fa-discord me-1"></i> Log In
                                                </button>
                                            )}
                                        </div>
                                    )}

                                {/* Island Dropdown Selector */}
                                {islandsLoading ? (
                                    <div className="text-center py-4 text-muted">
                                        <span className="spinner-border spinner-border-sm text-success me-2" />
                                        <span>Loading Sub Member islands…</span>
                                    </div>
                                ) : (
                                    <div className="mb-3">
                                        <label className="form-label small fw-bold text-muted text-uppercase tracking-wider d-flex align-items-center justify-content-between">
                                            <span>
                                                <i className="fa-solid fa-tree text-success me-1"></i> Choose Sub Island:
                                            </span>
                                            {selectedDropIsland && (
                                                <span className="text-success fw-bold tiny-text">
                                                    <i className="fa-solid fa-circle-check me-1"></i> Selected:{' '}
                                                    {selectedDropIsland.name}
                                                </span>
                                            )}
                                        </label>
                                        <select
                                            className="form-select form-select-lg rounded-4 border-2 shadow-2xs fw-bold text-dark"
                                            style={{
                                                fontSize: '0.95rem',
                                                borderColor: selectedDropIsland ? '#86efac' : '#e2e8f0',
                                            }}
                                            value={selectedDropIsland?.id || ''}
                                            onChange={(e) => {
                                                const found = subMemberIslands.find((isl) => isl.id === e.target.value);
                                                if (found) {
                                                    const hasAccess = !!user && canAccessIsland(found.requiredRoles);
                                                    if (!hasAccess) {
                                                        if (!user) {
                                                            login();
                                                        } else {
                                                            triggerInAppToast({
                                                                type: 'warning',
                                                                title: 'Sub Pass Required',
                                                                message: `You do not have access to ${found.name}. Requires an active Sub Member tier.`,
                                                            });
                                                        }
                                                        return;
                                                    }
                                                    setSelectedDropIsland(found);
                                                    setDropDodoCode(null);
                                                    setDropDodoError(null);
                                                    setAlreadyOnIsland(false);
                                                    playSound();
                                                } else {
                                                    setSelectedDropIsland(null);
                                                    setDropDodoCode(null);
                                                    setDropDodoError(null);
                                                    setAlreadyOnIsland(false);
                                                }
                                            }}
                                        >
                                            <option value="">-- Select a Sub Member Island --</option>
                                            {availableDropIslands.filter(
                                                (i) => !!user && canAccessIsland(i.requiredRoles)
                                            ).length > 0 && (
                                                    <optgroup label="My Sub Member Islands (Subscribed)">
                                                        {availableDropIslands
                                                            .filter((i) => !!user && canAccessIsland(i.requiredRoles))
                                                            .map((isl) => (
                                                                <option key={isl.id} value={isl.id}>
                                                                    {isl.name} · {isl.type || 'Treasure Island'} (
                                                                    {isl.visitors ?? 0}/7 Flying)
                                                                </option>
                                                            ))}
                                                    </optgroup>
                                                )}
                                            {dropFilter === 'all' &&
                                                availableDropIslands.filter(
                                                    (i) => !user || !canAccessIsland(i.requiredRoles)
                                                ).length > 0 && (
                                                    <optgroup label="Other Sub Member Islands (Requires Subscription)">
                                                        {availableDropIslands
                                                            .filter(
                                                                (i) => !user || !canAccessIsland(i.requiredRoles)
                                                            )
                                                            .map((isl) => (
                                                                <option key={isl.id} value={isl.id}>
                                                                    {isl.name} · {isl.type || 'Treasure Island'} (
                                                                    {isl.visitors ?? 0}/7 Flying)
                                                                </option>
                                                            ))}
                                                    </optgroup>
                                                )}
                                        </select>
                                    </div>
                                )}

                                {/* Selected Island Banner Preview */}
                                {selectedDropIsland && (
                                    <div className="animate-up mt-3">
                                        <div className="ob-island-sub-card selected p-0 overflow-hidden shadow-sm border-2">
                                            <div className="ob-island-card-banner position-relative">
                                                <img
                                                    src={
                                                        selectedDropIsland.mapUrl ||
                                                        `https://cdn.chopaeng.com/maps/${selectedDropIsland.name.toLowerCase()}.png`
                                                    }
                                                    alt={selectedDropIsland.name}
                                                    className="ob-island-card-img"
                                                    onError={(e) => {
                                                        e.currentTarget.onerror = null;
                                                        e.currentTarget.src =
                                                            "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='%230f172a'/><text x='50%' y='65%' font-size='40' text-anchor='middle' fill='%2352b788'>MAP</text></svg>";
                                                    }}
                                                />
                                                <div className="ob-island-banner-overlay" />

                                                <div className="position-absolute top-0 start-0 m-2 d-flex gap-1">
                                                    <span className="badge bg-dark bg-opacity-75 text-white rounded-pill x-small fw-bold border border-secondary border-opacity-50">
                                                        <i className="fa-solid fa-crown text-warning me-1"></i> SUB MEMBER
                                                    </span>
                                                </div>

                                                <div className="position-absolute top-0 end-0 m-2">
                                                    <span className="badge bg-success text-white rounded-pill px-2 py-1 shadow-2xs x-small fw-bold">
                                                        <i className="fa-solid fa-check me-1"></i> TARGET SET
                                                    </span>
                                                </div>

                                                <div className="position-absolute bottom-0 start-0 m-3">
                                                    <strong className="text-white h5 mb-0 fw-black text-truncate d-block">
                                                        {selectedDropIsland.name}
                                                    </strong>
                                                    <span className="tiny-text text-white-50">
                                                        {selectedDropIsland.type || 'Treasure Island'} ·{' '}
                                                        {selectedDropIsland.visitors ?? 0}/7 Flying
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="p-3 bg-white d-flex align-items-center justify-content-between">
                                                <div className="d-flex align-items-center gap-2">
                                                    <i className="fa-solid fa-circle-check text-success fs-5"></i>
                                                    <div>
                                                        <strong className="d-block text-dark small fw-bold">
                                                            Ready for Flight Pass
                                                        </strong>
                                                        <span className="tiny-text text-muted">
                                                            Proceed to Step 2 below to retrieve Dodo code
                                                        </span>
                                                    </div>
                                                </div>
                                                <span className="badge bg-success-subtle text-success rounded-pill px-3 py-1 fw-bold x-small border border-success">
                                                    ACCESS GRANTED
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* ── STEP 2: GET DODO FLIGHT PASS & LOG VIA WEBHOOK ── */}
                            {selectedDropIsland && (
                                <div className="ob-dodo-flight-pass mb-4 animate-up">
                                    <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
                                        <div className="d-flex align-items-center gap-2">
                                            <div
                                                className="rounded-circle bg-success bg-opacity-25 p-2 d-flex align-items-center justify-content-center"
                                                style={{ width: 36, height: 36 }}
                                            >
                                                <i className="fa-solid fa-plane-departure text-warning fs-6" />
                                            </div>
                                            <div>
                                                <h2 className="h6 fw-black mb-0 text-white ac-font">
                                                    2. Flight Pass &amp; On-Island Presence
                                                </h2>
                                                <span className="tiny-text text-white-50">
                                                    Fly in via Dodo Airlines or confirm you're already landed
                                                </span>
                                            </div>
                                        </div>
                                        <span
                                            className={`badge rounded-pill px-3 py-1 fw-black x-small ${alreadyOnIsland
                                                    ? 'bg-success text-white'
                                                    : dropDodoCode
                                                        ? 'bg-warning text-dark'
                                                        : 'bg-secondary text-white'
                                                }`}
                                        >
                                            <i
                                                className={`fa-solid ${alreadyOnIsland ? 'fa-circle-check' : 'fa-plane'
                                                    } me-1`}
                                            ></i>
                                            {alreadyOnIsland
                                                ? 'ON-SITE CONFIRMED'
                                                : dropDodoCode
                                                    ? 'FLIGHT PASS ACTIVE'
                                                    : 'LOGGING REQUIRED'}
                                        </span>
                                    </div>

                                    <div className="bg-black bg-opacity-30 rounded-4 p-3 border border-white border-opacity-10 d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 min-w-0">
                                        <div className="min-w-0">
                                            <span className="tiny-text text-uppercase text-white-50 fw-bold d-block mb-1 tracking-wider text-truncate">
                                                Destination · {selectedDropIsland.name}
                                            </span>
                                            {alreadyOnIsland ? (
                                                <div className="d-flex align-items-center gap-2 text-success fw-black py-1 text-truncate">
                                                    <i className="fa-solid fa-location-dot fs-5 text-success flex-shrink-0"></i>
                                                    <span className="text-truncate">Landed on {selectedDropIsland.name} (Ready to Drop)</span>
                                                </div>
                                            ) : dropDodoCode ? (
                                                <div className="ob-dodo-code-chip">
                                                    <i className="fa-solid fa-ticket text-warning fs-5 flex-shrink-0"></i>
                                                    <span>{dropDodoCode}</span>
                                                </div>
                                            ) : (
                                                <div className="text-white-50 small font-monospace py-1">
                                                    <i className="fa-solid fa-lock me-1"></i> Get code to fly in, or
                                                    click if already on island
                                                </div>
                                            )}
                                        </div>

                                        <div className="d-flex align-items-center gap-2 flex-wrap">
                                            {dropDodoCode ? (
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopyDropIslandDodo(dropDodoCode)}
                                                    className={`btn rounded-pill fw-black px-4 py-2 shadow-sm d-flex align-items-center gap-2 transition-all ${dropDodoCopied
                                                            ? 'btn-success text-white'
                                                            : 'btn-warning text-dark hover-scale'
                                                        }`}
                                                >
                                                    {dropDodoCopied ? (
                                                        <>
                                                            <i className="fa-solid fa-check"></i> Copied to Clipboard!
                                                        </>
                                                    ) : (
                                                        <>
                                                            <i className="fa-solid fa-copy"></i> Copy Flight Code
                                                        </>
                                                    )}
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    disabled={dropDodoLoading}
                                                    onClick={() => handleGetDropIslandDodo(selectedDropIsland)}
                                                    className="btn btn-warning text-dark rounded-pill fw-black px-3 py-2 shadow-sm d-flex align-items-center gap-2 hover-scale transition-all"
                                                >
                                                    {dropDodoLoading ? (
                                                        <>
                                                            <span className="spinner-border spinner-border-sm" />{' '}
                                                            Logging &amp; Retrieving…
                                                        </>
                                                    ) : (
                                                        <>
                                                            <i className="fa-solid fa-key"></i> Get Dodo Code
                                                        </>
                                                    )}
                                                </button>
                                            )}

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    playSound();
                                                    setAlreadyOnIsland(true);
                                                    if (!dropDodoCode) {
                                                        handleGetDropIslandDodo(selectedDropIsland);
                                                    }
                                                    triggerInAppToast({
                                                        type: 'success',
                                                        title: 'Island Presence Confirmed',
                                                        message: `Confirmed on ${selectedDropIsland.name}! Proceed to Step 3 to drop items.`,
                                                    });
                                                }}
                                                className={`btn rounded-pill fw-black px-3 py-2 shadow-sm d-flex align-items-center gap-2 transition-all ${alreadyOnIsland
                                                        ? 'btn-success text-white'
                                                        : 'btn-outline-light text-white hover-scale'
                                                    }`}
                                            >
                                                <i
                                                    className={`fa-solid ${alreadyOnIsland ? 'fa-check-double' : 'fa-location-dot'
                                                        }`}
                                                ></i>
                                                <span>
                                                    {alreadyOnIsland
                                                        ? 'Already On Island (Confirmed)'
                                                        : "I'm Already on the Island"}
                                                </span>
                                            </button>
                                        </div>
                                    </div>

                                    {dropDodoError && (
                                        <div className="alert alert-danger rounded-4 mt-3 mb-0 p-2 d-flex align-items-center justify-content-between gap-2 shadow-2xs">
                                            <div className="d-flex align-items-center gap-2 tiny-text fw-bold">
                                                <i className="fa-solid fa-triangle-exclamation"></i>
                                                <span>{dropDodoError}</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleGetDropIslandDodo(selectedDropIsland)}
                                                className="btn btn-xs btn-outline-danger rounded-pill fw-bold px-2 py-1"
                                            >
                                                Retry
                                            </button>
                                        </div>
                                    )}

                                    {(dropDodoCode || alreadyOnIsland) && (
                                        <div className="mt-2 tiny-text text-white-50 d-flex align-items-center gap-1">
                                            <i className="fa-solid fa-circle-check text-success"></i>
                                            <span>
                                                {alreadyOnIsland
                                                    ? `Island presence confirmed for ${selectedDropIsland.name}. Stand in front of airport gate to drop.`
                                                    : `Flight pass logged via Discord webhook. Fly to ${selectedDropIsland.name} before dropping!`}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── STEP 3: DROP ITEMS DESIGNER (9 SLOTS) ── */}
                            <div className="ob-card shadow-sm mb-4">
                                <div className="d-flex align-items-center justify-content-between mb-3 pb-3 border-bottom flex-wrap gap-2">
                                    <div className="d-flex align-items-center gap-3">
                                        <div
                                            className="ob-card-icon"
                                            style={{ background: '#e0e7ff', color: '#4338ca' }}
                                        >
                                            <i className="fa-solid fa-boxes-stacked" />
                                        </div>
                                        <div>
                                            <h2 className="h5 fw-bold mb-0 text-dark ac-font">
                                                3. Select Drop Items (Max {DROP_MAX} Slots)
                                            </h2>
                                            <p className="text-muted mb-0 tiny-text">
                                                Items dropped instantly at the island airport landing zone
                                            </p>
                                        </div>
                                    </div>

                                    {totalDropCount > 0 && (
                                        <button
                                            type="button"
                                            className="btn btn-link p-0 text-danger tiny-text fw-bold text-decoration-none"
                                            onClick={() => {
                                                playSound();
                                                setDropItems([]);
                                            }}
                                        >
                                            <i className="fa-solid fa-trash-can me-1" /> Clear Drop Pocket
                                        </button>
                                    )}
                                </div>

                                {selectedDropIsland && !dropDodoCode && !alreadyOnIsland && (
                                    <div className="alert alert-info rounded-4 border-0 p-3 mb-3 d-flex align-items-center gap-2 tiny-text fw-bold shadow-2xs">
                                        <i className="fa-solid fa-circle-info fs-6 flex-shrink-0 text-primary"></i>
                                        <span>
                                            Please click <strong>Get Dodo Code</strong> or{' '}
                                            <strong>I'm Already on the Island</strong> in Step 2 before dropping items.
                                        </span>
                                    </div>
                                )}

                                {/* Quick Fill Drop Presets Bar */}
                                <div className="ob-presets-container mb-3">
                                    <div className="d-flex align-items-center justify-content-between mb-2">
                                        <span className="tiny-text fw-bold text-muted text-uppercase tracking-wider">
                                            <i className="fa-solid fa-wand-magic-sparkles text-warning me-1" />
                                            Quick Drop Presets
                                        </span>
                                    </div>
                                    <div className="d-flex gap-2 flex-wrap">
                                        {DROP_QUICK_PRESETS.map((preset) => (
                                            <button
                                                key={preset.id}
                                                type="button"
                                                className="ob-preset-chip"
                                                onClick={() => handleApplyDropPreset(preset.fillType)}
                                                title={`Load 9× ${preset.name}`}
                                            >
                                                <img
                                                    src={preset.icon}
                                                    alt=""
                                                    style={{ width: 18, height: 18, objectFit: 'contain' }}
                                                />
                                                <span>{preset.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* 9-Slot Drop Grid */}
                                {dropItems.length === 0 ? (
                                    <div className="ob-empty-pocket my-4 text-center">
                                        <div className="text-secondary mb-2" style={{ fontSize: '3rem' }}>
                                            <i className="fa-solid fa-box-open" />
                                        </div>
                                        <h3 className="h6 fw-bold mb-1 text-dark">Your drop pocket is empty</h3>
                                        <p className="text-muted small mb-3" style={{ maxWidth: 380, margin: '0 auto' }}>
                                            Choose one of the quick drop presets above, or load items from Command Builder.
                                        </p>
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-outline-primary rounded-pill px-4 fw-bold shadow-2xs"
                                            onClick={() => {
                                                playSound();
                                                setShowQuickAddModal(true);
                                            }}
                                        >
                                            <i className="fa-solid fa-magnifying-glass me-1" /> Search Items to Drop
                                        </button>
                                    </div>
                                ) : (
                                    <div className="row g-2 mb-3">
                                        {dropItems.map((entry) => (
                                            <div key={entry.item.id} className="col-4 col-sm-3 col-md-4">
                                                <div className="ob-drop-slot-tile h-100">
                                                    <img
                                                        src={entry.item.image || FALLBACK_IMG}
                                                        alt={entry.item.name}
                                                        style={{ width: 44, height: 44, objectFit: 'contain' }}
                                                        onError={(ev) => {
                                                            (ev.currentTarget as HTMLImageElement).src = FALLBACK_IMG;
                                                        }}
                                                    />
                                                    <span
                                                        className="tiny-text fw-bold text-dark text-truncate w-100 mt-1"
                                                        title={entry.item.name}
                                                    >
                                                        {entry.item.name}
                                                    </span>
                                                    <div className="d-flex align-items-center gap-1 mt-1">
                                                        <button
                                                            type="button"
                                                            className="btn btn-xs btn-light border rounded-circle"
                                                            style={{ width: 22, height: 22, padding: 0 }}
                                                            onClick={() => {
                                                                playSound();
                                                                decreaseDropQuantity(entry.item.id);
                                                            }}
                                                        >
                                                            -
                                                        </button>
                                                        <span className="small fw-black text-primary px-1">
                                                            ×{entry.quantity}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            className="btn btn-xs btn-light border rounded-circle"
                                                            style={{ width: 22, height: 22, padding: 0 }}
                                                            onClick={() => {
                                                                playSound();
                                                                increaseDropQuantity(entry.item.id);
                                                            }}
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="btn btn-link p-0 text-muted hover-text-danger position-absolute top-0 end-0 m-1"
                                                        onClick={() => {
                                                            playSound();
                                                            removeDropItem(entry.item.id);
                                                        }}
                                                        title="Remove item"
                                                    >
                                                        <i className="fa-solid fa-xmark small" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Drop Bot Guidance Banner */}
                                <div className="alert alert-warning rounded-4 border-0 p-3 mt-3 d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-3 shadow-2xs">
                                    <div className="d-flex align-items-start gap-2">
                                        <i className="fa-solid fa-moon text-warning fs-5 flex-shrink-0 mt-1"></i>
                                        <div>
                                            <strong className="d-block text-dark small fw-bold">
                                                Drop Bot is Currently Offline
                                            </strong>
                                            <span className="tiny-text text-muted">
                                                SysBot direct web dispatch is not set up yet. Use Discord for now to drop items on your Sub Island.
                                            </span>
                                        </div>
                                    </div>
                                    {dropCommandText && (
                                        <button
                                            type="button"
                                            onClick={handleCopyDropForDiscord}
                                            className="btn btn-sm btn-dark rounded-pill fw-bold px-3 text-nowrap d-flex align-items-center gap-2 hover-scale"
                                        >
                                            <i className="fa-solid fa-copy"></i> Copy !drop for Discord
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* ════ SIDEBAR: DROP DISPATCH RADAR ════ */}
                        <div className="col-12 col-lg-4">
                            <div className="ob-radar-card sticky-top" style={{ top: '1.5rem' }}>
                                {/* Radar Header */}
                                <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
                                    <div className="d-flex align-items-center gap-2">
                                        <div
                                            className="ob-card-icon"
                                            style={{ width: 34, height: 34, background: '#fffbeb', color: '#d97706' }}
                                        >
                                            <i className="fa-solid fa-satellite-dish fa-spin-pulse" />
                                        </div>
                                        <div>
                                            <h3
                                                className="h6 fw-black mb-0 text-dark ac-font"
                                                style={{ letterSpacing: '0.04em' }}
                                            >
                                                DROP RADAR
                                            </h3>
                                            <span className="tiny-text text-muted">In-Game Telemetry</span>
                                        </div>
                                    </div>
                                    <span className="ob-radar-badge-pulse">
                                        <span className="ob-radar-dot" /> LIVE
                                    </span>
                                </div>

                                {/* Target Island HUD Screen */}
                                <div className={`ob-radar-hud-box mb-3 ${selectedDropIsland ? 'active' : ''}`}>
                                    <div className="d-flex align-items-center justify-content-between mb-1">
                                        <span className="tiny-text fw-bold text-uppercase text-muted tracking-wider">
                                            <i className="fa-solid fa-crosshairs me-1 text-primary"></i> Target
                                            Coordinates
                                        </span>
                                        {selectedDropIsland && (
                                            <span className="badge bg-light text-dark border rounded-pill x-small fw-bold">
                                                {selectedDropIsland.visitors ?? 0}/7 Flying
                                            </span>
                                        )}
                                    </div>

                                    {selectedDropIsland ? (
                                        <div>
                                            <div className="d-flex align-items-center justify-content-between mt-1">
                                                <strong className="text-dark fs-6 fw-black text-truncate d-block">
                                                    {selectedDropIsland.name}
                                                </strong>
                                                <span className="badge bg-warning-subtle text-warning-emphasis rounded-pill x-small fw-bold border border-warning-subtle">
                                                    {selectedDropIsland.type || 'Treasure Island'}
                                                </span>
                                            </div>

                                            <div className="mt-2 pt-2 border-top d-flex align-items-center justify-content-between tiny-text">
                                                <span className="text-muted">Presence:</span>
                                                {alreadyOnIsland ? (
                                                    <span className="text-success fw-bold d-inline-flex align-items-center gap-1">
                                                        <i className="fa-solid fa-circle-check"></i> On-Site Confirmed
                                                    </span>
                                                ) : dropDodoCode ? (
                                                    <span className="text-primary fw-bold d-inline-flex align-items-center gap-1">
                                                        <i className="fa-solid fa-ticket"></i> Pass Logged (
                                                        {dropDodoCode})
                                                    </span>
                                                ) : (
                                                    <span className="text-muted fw-bold d-inline-flex align-items-center gap-1">
                                                        <i className="fa-solid fa-clock"></i> Logging Required
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-muted small py-1">
                                            <i className="fa-solid fa-location-dot me-1 text-secondary"></i>
                                            No island locked. Select destination in Step 1.
                                        </div>
                                    )}
                                </div>

                                {/* Drop Slot Capacity Progress Bar */}
                                <div className="mb-3">
                                    <div className="d-flex align-items-center justify-content-between mb-1">
                                        <span className="tiny-text fw-bold text-uppercase text-muted tracking-wider">
                                            <i className="fa-solid fa-box me-1 text-success"></i> Slot Capacity
                                        </span>
                                        <span
                                            className={`tiny-text fw-black ${totalDropCount >= DROP_MAX ? 'text-success' : 'text-primary'
                                                }`}
                                        >
                                            {totalDropCount} / {DROP_MAX} Slots
                                        </span>
                                    </div>
                                    <div className="progress" style={{ height: 6, borderRadius: 99 }}>
                                        <div
                                            className={`progress-bar transition-all ${totalDropCount >= DROP_MAX ? 'bg-success' : 'bg-primary'
                                                }`}
                                            role="progressbar"
                                            style={{ width: `${(totalDropCount / DROP_MAX) * 100}%` }}
                                            aria-valuenow={totalDropCount}
                                            aria-valuemin={0}
                                            aria-valuemax={DROP_MAX}
                                        />
                                    </div>
                                </div>

                                {/* Payload Micro Preview Chips */}
                                {dropItems.length > 0 && (
                                    <div className="d-flex flex-wrap gap-1 mb-3">
                                        {dropItems.map((entry) => (
                                            <span key={entry.item.id} className="ob-radar-payload-pill">
                                                <img
                                                    src={entry.item.image || FALLBACK_IMG}
                                                    alt=""
                                                    style={{ width: 14, height: 14, objectFit: 'contain' }}
                                                />
                                                <span className="text-truncate" style={{ maxWidth: 80 }}>
                                                    {entry.item.name}
                                                </span>
                                                <span className="text-success fw-black">×{entry.quantity}</span>
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Live Monospace Command Injection Preview */}
                                <div className="ob-radar-terminal-box mb-3">
                                    <div className="d-flex align-items-center gap-2 text-truncate min-w-0 flex-grow-1">
                                        <span className="text-secondary flex-shrink-0">$</span>
                                        <span className="text-truncate font-monospace">{dropCommandText || '!drop <payload>'}</span>
                                    </div>
                                    {dropCommandText && (
                                        <button
                                            type="button"
                                            className="btn btn-link p-0 text-success opacity-75 hover-opacity-100 flex-shrink-0"
                                            title="Copy drop command & open Discord"
                                            onClick={handleCopyDropForDiscord}
                                        >
                                            <i className="fa-solid fa-copy"></i>
                                        </button>
                                    )}
                                </div>

                                {/* Copy Command for Discord CTA Button */}
                                <button
                                    type="button"
                                    disabled={!selectedDropIsland || totalDropCount === 0}
                                    onClick={handleCopyDropForDiscord}
                                    className="btn ob-radar-dispatch-cta w-100 d-flex align-items-center justify-content-center gap-2"
                                >
                                    {!selectedDropIsland ? (
                                        <>
                                            <i className="fa-solid fa-crosshairs"></i> 1. SELECT ISLAND FIRST
                                        </>
                                    ) : totalDropCount === 0 ? (
                                        <>
                                            <i className="fa-solid fa-boxes-stacked"></i> 3. LOAD DROP ITEMS
                                        </>
                                    ) : (
                                        <>
                                            <i className="fa-solid fa-copy"></i> COPY !DROP &amp; OPEN DISCORD
                                        </>
                                    )}
                                </button>

                                {/* Diagnostic Checklist */}
                                <div className="mt-3 pt-3 border-top d-flex flex-column gap-1">
                                    <span className="tiny-text fw-bold text-muted text-uppercase d-block mb-1 tracking-wider">
                                        Flight Pre-Check:
                                    </span>
                                    <div className={`ob-radar-diag-item ${selectedDropIsland ? 'done' : 'pending'}`}>
                                        <i
                                            className={`fa-solid ${selectedDropIsland
                                                    ? 'fa-check-circle text-success'
                                                    : 'fa-circle-dot text-muted'
                                                }`}
                                        />
                                        <span>1. Sub Island Target Set</span>
                                    </div>
                                    <div
                                        className={`ob-radar-diag-item ${alreadyOnIsland || dropDodoCode ? 'done' : 'pending'
                                            }`}
                                    >
                                        <i
                                            className={`fa-solid ${alreadyOnIsland || dropDodoCode
                                                    ? 'fa-check-circle text-success'
                                                    : 'fa-circle-dot text-muted'
                                                }`}
                                        />
                                        <span>2. Webhook &amp; On-Island Presence</span>
                                    </div>
                                    <div className={`ob-radar-diag-item ${totalDropCount > 0 ? 'done' : 'pending'}`}>
                                        <i
                                            className={`fa-solid ${totalDropCount > 0
                                                    ? 'fa-check-circle text-success'
                                                    : 'fa-circle-dot text-muted'
                                                }`}
                                        />
                                        <span>
                                            3. 9-Slot Payload Loaded ({totalDropCount}/{DROP_MAX})
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ════════════════ INLINE QUICK ADD ITEM MODAL ════════════════ */}
            {showQuickAddModal && (
                <QuickAddItemModal
                    isOpen={showQuickAddModal}
                    onClose={() => setShowQuickAddModal(false)}
                    catalog={catalogData?.all || []}
                    initialTarget={botMode}
                    addItemToOrderPockets={addItemToOrderPockets}
                    addItemToDropPockets={addItemToDropPockets}
                    decreaseOrderQuantity={decreaseOrderQuantity}
                    increaseOrderQuantity={increaseOrderQuantity}
                    decreaseDropQuantity={decreaseDropQuantity}
                    increaseDropQuantity={increaseDropQuantity}
                    totalOrderCount={totalOrderCount}
                    totalDropCount={totalDropCount}
                    canIncreaseOrder={canIncreaseOrder}
                    canIncreaseDrop={canIncreaseDrop}
                    orderItems={orderItems}
                    dropItems={dropItems}
                />
            )}

            {/* ════════════════ CURATED POCKET BUNDLES MODAL ════════════════ */}
            {showBundlesModal && (
                <CommandBuilderPocketBundlesModal
                    isOpen={showBundlesModal}
                    onClose={() => setShowBundlesModal(false)}
                    currentOrderPockets={orderItems}
                    currentDropPockets={dropItems}
                    onApplyBundleToOrder={(items: PocketBundleItem[], mode: 'replace' | 'merge') => {
                        loadBundleIntoOrder(items, mode);
                        setShowBundlesModal(false);
                        playSound();
                        triggerInAppToast({
                            type: 'info',
                            title: 'Bundle Loaded into Pocket',
                            message: `Loaded bundle (${items.length} item types) into your order pocket.`,
                        });
                    }}
                    onApplyBundleToDrop={(items: PocketBundleItem[], mode: 'replace' | 'merge') => {
                        loadBundleIntoDrop(items, mode);
                        setShowBundlesModal(false);
                        playSound();
                        triggerInAppToast({
                            type: 'info',
                            title: 'Drop Bundle Loaded',
                            message: `Loaded drop bundle into your 9-slot pocket.`,
                        });
                    }}
                />
            )}

            {/* ════════════════ SHARE POCKET MODAL ════════════════ */}
            {showShareModal && (
                <CommandBuilderShareModal
                    isOpen={showShareModal}
                    onClose={() => setShowShareModal(false)}
                    orderPockets={orderItems}
                    dropPockets={dropItems}
                />
            )}

            {/* ════════════════ SAVED CUSTOM LOADOUTS MODAL ════════════════ */}
            {showSavedLoadoutsModal && (
                <div
                    className="ob-modal-backdrop"
                    onClick={() => setShowSavedLoadoutsModal(false)}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Saved Custom Loadouts"
                >
                    <div className="ob-modal-card" onClick={(e) => e.stopPropagation()}>
                        <div className="ob-modal-header">
                            <div className="d-flex align-items-center gap-2">
                                <div className="ob-tool-icon" style={{ width: 34, height: 34, fontSize: '0.85rem' }}>
                                    <i className="fa-solid fa-floppy-disk" aria-hidden="true" />
                                </div>
                                <div>
                                    <h3 className="h6 fw-bold mb-0 text-dark ac-font">Saved Pocket Loadouts</h3>
                                    <div className="tiny-text text-muted">Save, name, and 1-click reload custom setups</div>
                                </div>
                            </div>
                            <button
                                type="button"
                                className="btn btn-sm btn-light rounded-circle border d-flex align-items-center justify-content-center"
                                onClick={() => setShowSavedLoadoutsModal(false)}
                                aria-label="Close modal"
                                style={{ width: 32, height: 32 }}
                            >
                                <i className="fa-solid fa-xmark" aria-hidden="true" />
                            </button>
                        </div>

                        <div className="ob-modal-body">
                            {/* Save Current Pocket Box */}
                            <div className="card rounded-4 p-3 bg-light border mb-3">
                                <span className="tiny-text fw-bold text-muted text-uppercase tracking-wider d-block mb-2">
                                    <i className="fa-solid fa-bookmark text-success me-1" /> Save Current Pocket ({totalOrderCount}/40 Slots)
                                </span>
                                <div className="input-group">
                                    <input
                                        type="text"
                                        className="form-control rounded-start-pill border-2"
                                        placeholder="e.g. Island Remodel Materials Pack"
                                        value={newLoadoutName}
                                        onChange={(e) => setNewLoadoutName(e.target.value)}
                                        maxLength={36}
                                    />
                                    <button
                                        type="button"
                                        className="btn btn-success rounded-end-pill px-4 fw-bold"
                                        style={{ backgroundColor: '#37b06d', borderColor: '#37b06d' }}
                                        disabled={!newLoadoutName.trim() || totalOrderCount === 0}
                                        onClick={handleSaveCurrentLoadout}
                                    >
                                        <i className="fa-solid fa-plus me-1" /> Save
                                    </button>
                                </div>
                                {totalOrderCount === 0 && (
                                    <span className="tiny-text text-muted mt-1 d-block">
                                        Add items to your pocket first before saving.
                                    </span>
                                )}
                            </div>

                            {/* List of Saved Loadouts */}
                            {savedLoadouts.length > 0 ? (
                                <div className="d-flex flex-column gap-2">
                                    {savedLoadouts.map((loadout) => {
                                        const count = loadout.items.reduce((s, p) => s + p.quantity, 0);
                                        return (
                                            <div key={loadout.id} className="ob-loadout-card">
                                                <div className="min-w-0 flex-grow-1">
                                                    <div className="fw-bold text-dark text-truncate">{loadout.name}</div>
                                                    <div className="tiny-text text-muted d-flex align-items-center gap-2">
                                                        <span>{count} Slots</span>
                                                        <span>· {formatDateTime(loadout.createdAt)}</span>
                                                    </div>
                                                </div>
                                                <div className="d-flex align-items-center gap-2 flex-shrink-0">
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-success rounded-pill fw-bold px-3 py-1"
                                                        style={{ backgroundColor: '#37b06d', borderColor: '#37b06d' }}
                                                        onClick={() => handleApplySavedLoadout(loadout)}
                                                    >
                                                        <i className="fa-solid fa-arrow-down-to-bracket me-1" /> Load
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-danger rounded-circle p-0 d-flex align-items-center justify-content-center"
                                                        style={{ width: 28, height: 28 }}
                                                        onClick={() => handleDeleteSavedLoadout(loadout.id)}
                                                        title="Delete loadout"
                                                    >
                                                        <i className="fa-solid fa-trash-can x-small" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-4 text-muted">
                                    <div className="text-muted mb-2" style={{ fontSize: '2.4rem' }}>
                                        <i className="fa-solid fa-floppy-disk" />
                                    </div>
                                    <h4 className="fw-bold mb-1 h6 text-dark ac-font">No Saved Loadouts Yet</h4>
                                    <p className="tiny-text text-muted mb-0">
                                        Type a name above and save your current 40-slot setup for fast 1-click loading anytime!
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ════════════════ RECENT ORDERS MODAL ════════════════ */}
            {showHistoryModal && (
                <div
                    className="ob-modal-backdrop"
                    onClick={() => setShowHistoryModal(false)}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Recent Orders"
                >
                    <div className="ob-modal-card" onClick={(e) => e.stopPropagation()}>
                        <div className="ob-modal-header">
                            <div className="d-flex align-items-center gap-2">
                                <div className="ob-tool-icon" style={{ width: 34, height: 34, fontSize: '0.85rem' }}>
                                    <i className="fa-solid fa-clock-rotate-left" aria-hidden="true" />
                                </div>
                                <div>
                                    <h3 className="h6 fw-bold mb-0 text-dark ac-font">Your Recent Orders</h3>
                                    <div className="tiny-text text-muted">1-click reorder past items</div>
                                </div>
                            </div>
                            <button
                                type="button"
                                className="btn btn-sm btn-light rounded-circle border d-flex align-items-center justify-content-center"
                                onClick={() => setShowHistoryModal(false)}
                                aria-label="Close modal"
                                style={{ width: 32, height: 32 }}
                            >
                                <i className="fa-solid fa-xmark" aria-hidden="true" />
                            </button>
                        </div>

                        <div className="ob-modal-body">
                            {historyLoading && historyOrders.length === 0 ? (
                                <div className="text-center py-5 text-muted">
                                    <span className="spinner-border spinner-border-sm text-success me-2" />
                                    <span>Loading order history…</span>
                                </div>
                            ) : historyOrders.length > 0 ? (
                                <div className="d-flex flex-column gap-3">
                                    {historyOrders.map((order) => {
                                        const parsed = parsedHistoryOrdersMap.get(order.id) || { items: [], totalSlots: 0, unrecognizedCodes: [] };
                                        return (
                                            <div key={order.id} className="card rounded-4 p-3 bg-light border shadow-2xs">
                                                <div className="d-flex align-items-center justify-content-between mb-2 flex-wrap gap-1">
                                                    <div className="d-flex align-items-center gap-2">
                                                        <span className="badge bg-dark text-white rounded-pill font-monospace x-small">
                                                            #{order.id.slice(0, 14)}
                                                        </span>
                                                        <span
                                                            className={`badge rounded-pill x-small fw-bold ${order.status === 'ready' ||
                                                                    order.status === 'completed'
                                                                    ? 'bg-success text-white'
                                                                    : order.status === 'preparing'
                                                                        ? 'bg-warning text-dark border-0'
                                                                        : 'bg-light text-dark border'
                                                                }`}
                                                        >
                                                            {order.status === 'preparing'
                                                                ? 'Preparing'
                                                                : order.status}
                                                        </span>
                                                    </div>
                                                    <span className="tiny-text text-muted">
                                                        {formatDateTime(order.created_at)}
                                                    </span>
                                                </div>

                                                {/* Preview sprites */}
                                                {parsed.items.length > 0 ? (
                                                    <div
                                                        className="d-flex flex-wrap gap-1 mb-2 py-1 bg-white p-2 rounded-3 border"
                                                        style={{ maxHeight: 70, overflowY: 'auto' }}
                                                    >
                                                        {parsed.items.map((item, idx) => (
                                                            <span
                                                                key={`${item.itemId}-${idx}`}
                                                                className="badge bg-light text-dark border rounded-pill px-2 py-1 tiny-text fw-normal d-inline-flex align-items-center gap-1"
                                                            >
                                                                {item.image && (
                                                                    <img
                                                                        src={item.image}
                                                                        alt=""
                                                                        style={{
                                                                            width: 14,
                                                                            height: 14,
                                                                            objectFit: 'contain',
                                                                        }}
                                                                    />
                                                                )}
                                                                <span>{item.name}</span>
                                                                <span className="text-success fw-bold">
                                                                    ×{item.quantity}
                                                                </span>
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="font-monospace text-muted tiny-text text-truncate mb-2">
                                                        {order.command}
                                                    </div>
                                                )}

                                                <div className="d-flex justify-content-end">
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-success text-white rounded-pill px-3 py-1 fw-bold d-inline-flex align-items-center gap-1 shadow-2xs"
                                                        style={{ backgroundColor: '#37b06d', borderColor: '#37b06d' }}
                                                        onClick={() => handleReorderHistoryItem(order)}
                                                    >
                                                        <i className="fa-solid fa-rotate-left" aria-hidden="true" />
                                                        <span>Load into Pocket &amp; Reorder</span>
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-5 text-muted">
                                    <div className="text-muted mb-2" style={{ fontSize: '2.8rem' }}>
                                        <i className="fa-solid fa-box-open" />
                                    </div>
                                    <h4 className="fw-bold mb-1 h6 text-dark ac-font">No Past Orders Found</h4>
                                    <p className="tiny-text text-muted mb-0">
                                        Your past order history will appear here for fast 1-click reordering.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ════════════════ CANCEL ORDER CONFIRMATION MODAL ════════════════ */}
            {showCancelModal && (
                <div
                    className="ob-modal-backdrop"
                    onClick={() => !cancelLoading && setShowCancelModal(false)}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Cancel Order Confirmation"
                >
                    <div
                        className="ob-modal-card text-center p-4 p-md-5"
                        style={{ maxWidth: 460 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div
                            className="rounded-circle d-flex align-items-center justify-content-center bg-danger bg-opacity-10 text-danger mx-auto mb-3"
                            style={{ width: 64, height: 64, fontSize: '1.8rem' }}
                        >
                            <i className="fa-solid fa-triangle-exclamation" />
                        </div>

                        <h3 className="h5 fw-black text-dark mb-2 ac-font">
                            Are you sure you want to cancel your order?
                        </h3>

                        <p className="text-muted small mb-4" style={{ lineHeight: 1.6 }}>
                            You will lose your active delivery queue position
                            {typeof orderStatus?.queuePosition === 'number' && orderStatus.queuePosition > 0 ? (
                                <> (currently <strong className="text-danger">#{orderStatus.queuePosition} in line</strong>)</>
                            ) : null}
                            . You will need to resubmit if you want to receive these items.
                        </p>

                        {activeOrderId && (
                            <div className="bg-light rounded-3 p-2 border mb-4 font-monospace tiny-text text-muted">
                                Order ID: #{activeOrderId.slice(0, 18)}
                            </div>
                        )}

                        <div className="d-flex gap-2 justify-content-center flex-wrap">
                            <button
                                type="button"
                                className="btn btn-light rounded-pill px-4 py-2 fw-bold text-dark border shadow-2xs flex-grow-1"
                                onClick={() => {
                                    playSound();
                                    setShowCancelModal(false);
                                }}
                                disabled={cancelLoading}
                            >
                                Keep My Order
                            </button>
                            <button
                                type="button"
                                id="ob-confirm-cancel-btn"
                                className="btn btn-danger rounded-pill px-4 py-2 fw-bold text-white shadow-2xs flex-grow-1 d-inline-flex align-items-center justify-content-center gap-2"
                                onClick={handleCancel}
                                disabled={cancelLoading}
                            >
                                {cancelLoading ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm" aria-hidden="true" />
                                        <span>Cancelling…</span>
                                    </>
                                ) : (
                                    <>
                                        <i className="fa-solid fa-trash-can" />
                                        <span>Yes, Cancel Order</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ════════════════ SETUP MODAL (SOLID CHOPAENG STYLE) ════════════════ */}
            {showSetup && user && (
                <div
                    className="ob-modal-backdrop"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Order Profile Setup"
                >
                    <div className="ob-modal-card p-4 p-md-5">
                        {orderProfile && (
                            <button
                                type="button"
                                className="btn-close position-absolute"
                                style={{ top: '1.25rem', right: '1.25rem' }}
                                aria-label="Close setup"
                                onClick={() => {
                                    setShowSetup(false);
                                    setShowAddChar(false);
                                }}
                            />
                        )}

                        {/* Step indicator */}
                        <div className="d-flex align-items-center gap-2 mb-4">
                            <div
                                style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: '50%',
                                    background: setupStep === 'username' ? '#37b06d' : '#e2e8f0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 700,
                                    fontSize: '.8rem',
                                    color: setupStep === 'username' ? '#fff' : '#94a3b8',
                                    transition: 'all .3s',
                                }}
                            >
                                1
                            </div>
                            <div
                                style={{
                                    flex: 1,
                                    height: 2,
                                    background: setupStep === 'select-character' ? '#37b06d' : '#e2e8f0',
                                    borderRadius: 2,
                                    transition: 'all .3s',
                                }}
                            />
                            <div
                                style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: '50%',
                                    background: setupStep === 'select-character' ? '#37b06d' : '#e2e8f0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 700,
                                    fontSize: '.8rem',
                                    color: setupStep === 'select-character' ? '#fff' : '#94a3b8',
                                    transition: 'all .3s',
                                }}
                            >
                                2
                            </div>
                        </div>

                        {/* ── STEP 1: Discord Username Confirm ── */}
                        {setupStep === 'username' && (
                            <>
                                <div className="text-center mb-4">
                                    {user.avatar ? (
                                        <img
                                            src={`${user.avatar}`}
                                            alt={user.username}
                                            style={{
                                                width: 64,
                                                height: 64,
                                                borderRadius: '50%',
                                                border: '3px solid #37b06d',
                                                marginBottom: '.75rem',
                                            }}
                                        />
                                    ) : (
                                        <div
                                            style={{
                                                width: 64,
                                                height: 64,
                                                borderRadius: '50%',
                                                background: '#37b06d',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                margin: '0 auto .75rem',
                                                fontSize: '1.8rem',
                                            }}
                                        >
                                            <i className="fa-brands fa-discord text-white" />
                                        </div>
                                    )}
                                    <h2 className="ac-font fw-black text-dark mb-1" style={{ fontSize: '1.3rem' }}>
                                        Welcome, {user.username}!
                                    </h2>
                                    <p className="text-muted small mb-0">
                                        Let's confirm your Discord identity before ordering.
                                    </p>
                                </div>

                                <div className="mb-4">
                                    <label
                                        className="form-label fw-bold small text-dark"
                                        htmlFor="setup-display-name"
                                    >
                                        <i className="fa-brands fa-discord text-primary me-1" /> Discord Display Name
                                        <span className="text-muted fw-normal ms-1">(auto-filled)</span>
                                    </label>
                                    <input
                                        id="setup-display-name"
                                        type="text"
                                        className="form-control rounded-3 border-2"
                                        placeholder="Your Discord username"
                                        value={setupDisplayName}
                                        onChange={(e) => setSetupDisplayName(e.target.value)}
                                        maxLength={32}
                                    />
                                    <div className="form-text">This identifies you in the order queue.</div>
                                </div>

                                <button
                                    type="button"
                                    className="btn btn-success text-white fw-bold rounded-pill px-4 py-2 w-100 d-flex align-items-center justify-content-center gap-2"
                                    style={{ backgroundColor: '#37b06d', borderColor: '#37b06d' }}
                                    onClick={() => {
                                        playSound();
                                        setSetupStep('select-character');
                                    }}
                                    disabled={!setupDisplayName.trim()}
                                >
                                    <span>Next: Select In-Game Character</span>
                                    <i className="fa-solid fa-arrow-right" />
                                </button>
                            </>
                        )}

                        {/* ── STEP 2: Select In-Game Character ── */}
                        {setupStep === 'select-character' && (
                            <>
                                <div className="mb-3">
                                    <div className="d-flex align-items-center justify-content-between mb-1">
                                        <h2
                                            className="ac-font fw-black text-dark mb-0"
                                            style={{ fontSize: '1.15rem' }}
                                        >
                                            <i className="fa-solid fa-address-card text-success me-2" />
                                            Select In-Game Character
                                        </h2>
                                        <span className="badge bg-success bg-opacity-10 text-success rounded-pill x-small fw-black">
                                            {characters.length} / 3 Slots
                                        </span>
                                    </div>
                                    <p className="text-muted small mb-0">
                                        Pick which character is ordering. IGN &amp; Island will be sent to the bot.
                                    </p>
                                </div>

                                {/* Character cards */}
                                <div className="d-flex flex-column gap-2 mb-3">
                                    {characters.length === 0 && (
                                        <div className="text-center py-3 text-muted small border rounded-4 bg-light">
                                            <i className="fa-solid fa-person-circle-question fs-3 mb-2 d-block text-muted opacity-50" />
                                            No saved characters yet.
                                            <br />
                                            <span className="tiny-text">
                                                Add one below or go to{' '}
                                                <Link to="/profile" className="text-success fw-bold">
                                                    Profile → Saved Characters
                                                </Link>
                                                .
                                            </span>
                                        </div>
                                    )}
                                    {characters.map((char: SavedCharacter) => {
                                        const isSelected = setupSelectedCharId === char.id;
                                        return (
                                            <button
                                                key={char.id}
                                                type="button"
                                                id={`setup-char-${char.id}`}
                                                className={`d-flex align-items-center gap-3 p-3 rounded-4 w-100 text-start border-2 ${isSelected
                                                        ? 'border-success bg-success bg-opacity-10'
                                                        : 'border-light-subtle bg-light'
                                                    }`}
                                                style={{ cursor: 'pointer', transition: 'all .2s' }}
                                                onClick={() => {
                                                    setSetupSelectedCharId(char.id);
                                                    playSound();
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        width: 44,
                                                        height: 44,
                                                        borderRadius: '50%',
                                                        flexShrink: 0,
                                                        background: isSelected ? '#dcfce7' : '#f1f5f9',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        border: isSelected ? '2px solid #37b06d' : '2px solid #e2e8f0',
                                                        transition: 'all .2s',
                                                        fontSize: '1.1rem',
                                                    }}
                                                >
                                                    <i
                                                        className={`fa-solid ${char.icon || 'fa-leaf'}`}
                                                        style={{ color: isSelected ? '#16a34a' : '#94a3b8' }}
                                                    />
                                                </div>
                                                <div className="flex-grow-1 min-w-0">
                                                    <div className="fw-black text-dark" style={{ fontSize: '.95rem' }}>
                                                        {char.ign}
                                                    </div>
                                                    <div className="tiny-text text-muted fw-bold d-inline-flex align-items-center gap-1">
                                                        <i className="fa-solid fa-mountain-sun text-success" />
                                                        <span>{char.islandName}</span>
                                                    </div>
                                                </div>
                                                <div className="d-flex flex-column align-items-end gap-1">
                                                    {char.isDefault && (
                                                        <span className="badge bg-success text-white rounded-pill x-small fw-bold">
                                                            Primary
                                                        </span>
                                                    )}
                                                    {isSelected && (
                                                        <i className="fa-solid fa-circle-check text-success fs-5" />
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Add Character inline form */}
                                {!showAddChar && remainingSlots > 0 && (
                                    <button
                                        type="button"
                                        id="setup-add-char-btn"
                                        className="btn btn-outline-success rounded-pill fw-bold w-100 mb-3 d-flex align-items-center justify-content-center gap-2 py-2"
                                        onClick={() => {
                                            setShowAddChar(true);
                                            setAddCharError('');
                                        }}
                                    >
                                        <i className="fa-solid fa-plus" />
                                        <span>
                                            Add New Character ({remainingSlots} slot{remainingSlots !== 1 ? 's' : ''}{' '}
                                            left)
                                        </span>
                                    </button>
                                )}

                                {showAddChar && (
                                    <div className="border rounded-4 p-3 bg-light mb-3 animate-fade">
                                        <div className="fw-bold small text-dark mb-2">
                                            <i className="fa-solid fa-user-plus text-success me-1" /> New In-Game
                                            Character
                                        </div>
                                        <div className="row g-2 mb-2">
                                            <div className="col">
                                                <input
                                                    type="text"
                                                    className="form-control form-control-sm rounded-3"
                                                    placeholder="IGN (e.g. Bitress)"
                                                    value={addCharIgn}
                                                    onChange={(e) => setAddCharIgn(e.target.value)}
                                                    maxLength={24}
                                                    autoFocus
                                                />
                                            </div>
                                            <div className="col">
                                                <input
                                                    type="text"
                                                    className="form-control form-control-sm rounded-3"
                                                    placeholder="Island Name (e.g. Nookville)"
                                                    value={addCharIsland}
                                                    onChange={(e) => setAddCharIsland(e.target.value)}
                                                    maxLength={24}
                                                />
                                            </div>
                                        </div>
                                        {addCharError && (
                                            <div className="text-danger tiny-text mb-2">
                                                <i className="fa-solid fa-triangle-exclamation me-1" />
                                                {addCharError}
                                            </div>
                                        )}
                                        <div className="d-flex gap-2">
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-success rounded-pill fw-bold px-3"
                                                style={{ backgroundColor: '#37b06d', borderColor: '#37b06d' }}
                                                onClick={handleAddCharacter}
                                            >
                                                <i className="fa-solid fa-check me-1" />
                                                Save Character
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-secondary rounded-pill"
                                                onClick={() => {
                                                    setShowAddChar(false);
                                                    setAddCharError('');
                                                    setAddCharIgn('');
                                                    setAddCharIsland('');
                                                }}
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className="text-center mb-3">
                                    <Link to="/profile" className="tiny-text text-muted text-decoration-none">
                                        <i className="fa-solid fa-sliders me-1" />
                                        Manage all characters in Profile
                                    </Link>
                                </div>

                                <div className="d-flex gap-2">
                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary rounded-pill fw-bold px-4 py-2 d-flex align-items-center gap-1"
                                        onClick={() => {
                                            setSetupStep('username');
                                            playSound();
                                        }}
                                    >
                                        <i className="fa-solid fa-arrow-left" />
                                        <span>Back</span>
                                    </button>
                                    <button
                                        id="setup-confirm-btn"
                                        type="button"
                                        className="btn btn-success text-white fw-bold rounded-pill px-4 py-2 flex-grow-1 d-flex align-items-center justify-content-center gap-2"
                                        style={{ backgroundColor: '#37b06d', borderColor: '#37b06d' }}
                                        onClick={handleSetupSave}
                                        disabled={characters.length === 0}
                                    >
                                        <i className="fa-solid fa-check" />
                                        <span>Confirm &amp; Start Ordering</span>
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* ════════════════ IN-APP NOTIFICATION TOAST ════════════════ */}
            {inAppToast && (
                <div className="ob-in-app-toast-container">
                    <div className={`ob-in-app-toast toast-${inAppToast.type}`} role="alert" aria-live="assertive">
                        <div className="ob-toast-icon" aria-hidden="true">
                            {inAppToast.type === 'dodo' && <i className="fa-solid fa-plane-departure" />}
                            {inAppToast.type === 'success' && <i className="fa-solid fa-circle-check" />}
                            {inAppToast.type === 'warning' && <i className="fa-solid fa-triangle-exclamation" />}
                            {inAppToast.type === 'info' && <i className="fa-solid fa-circle-info" />}
                        </div>
                        <div className="flex-grow-1">
                            <div className="fw-bold small mb-1 ac-font">{inAppToast.title}</div>
                            <div style={{ fontSize: '0.82rem', opacity: inAppToast.type === 'dodo' ? 0.95 : 0.85 }}>
                                {inAppToast.message}
                            </div>
                            {inAppToast.actionLabel && inAppToast.onAction && (
                                <div className="mt-2">
                                    <button
                                        type="button"
                                        className={`btn btn-xs rounded-pill fw-bold px-3 py-1 ${inAppToast.type === 'dodo' ? 'btn-light text-dark' : 'btn-success text-white'
                                            }`}
                                        style={inAppToast.type !== 'dodo' ? { backgroundColor: '#37b06d', borderColor: '#37b06d' } : {}}
                                        onClick={() => {
                                            inAppToast.onAction?.();
                                            dismissInAppToast();
                                        }}
                                    >
                                        {inAppToast.actionLabel}
                                    </button>
                                </div>
                            )}
                        </div>
                        <button
                            type="button"
                            className={`btn-close ${inAppToast.type === 'dodo' ? 'btn-close-white' : ''} x-small`}
                            aria-label="Dismiss notification"
                            onClick={dismissInAppToast}
                        />
                    </div>
                </div>
            )}

            {/* ════════════════ DISCORD SERVER NICKNAME MODAL ════════════════ */}
            <DiscordNicknameModal
                isOpen={showNicknameModal}
                onClose={() => setShowNicknameModal(false)}
                currentNickname={serverNickname}
                characters={characters}
                onCharacterAdded={(ign, islandName) => addCharacter(ign, islandName)}
                canDismiss={true}
                onSuccess={(newNick) => {
                    setServerNickname(newNick);
                    setUserScopedItem('chopaeng_discord_nickname', newNick, user?.user_id);
                    const parsed = parseDiscordNicknameToCharacters(newNick);
                    if (parsed.length > 0) {
                        const updatedProfile: OrderProfile = {
                            displayName: newNick,
                            orderFor: parsed[0].ign,
                            islandName: parsed[0].islandName,
                            characterId: characters[0]?.id ?? null,
                            orderForSelf: true,
                        };
                        saveProfile(updatedProfile, user?.user_id);
                        setOrderProfile(updatedProfile);
                    }
                    setShowNicknameModal(false);
                    triggerInAppToast({
                        type: 'success',
                        title: 'Server Nickname Set!',
                        message: `Updated to "${newNick}". You're all set to place orders!`,
                    });
                }}
            />
        </div>
    );
};

export default OrderBot;