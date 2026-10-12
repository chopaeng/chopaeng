import React, { useState, useMemo, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { useIslandData } from '../context/useIslandData';
import { type IslandData } from '../data/islands';
import { useCommandBuilderPockets, type PocketItem } from '../hooks/useCommandBuilderPockets';
import { useCatalogData } from '../hooks/useCatalogData';
import { useFavorites } from '../hooks/useFavorites';
import { DROP_MAX } from '../constants/limits';
import { playChimeClick } from '../utils/kkAudioSynthesizer';
import { triggerConfetti } from '../utils/confetti';
import { CommandBuilderVariantModal } from '../components/command-builder/CommandBuilderVariantModal';
import { DropBotHouseGrid } from '../components/drop/DropBotHouseGrid';
import {
    submitIslandDrop,
    injectIslandVillager,
    batchInjectIslandVillagers,
    revealIslandDodoCode,
} from '../utils/dropBotApi';
import type { CatalogEntity } from '../data/commandBuilderData';
import { useSavedCharacters } from '../hooks/useSavedCharacters';
import SubRulesModal from '../components/sub/SubRulesModal';
import { isSubRulesAccepted } from '../utils/subRulesStorage';
import RevealErrorPopup from '../components/RevealErrorPopup';
import './OrderBot.css';

const FALLBACK_IMG =
    "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23f1f3f5'/%3E%3Cpath d='M30 65 L45 45 L58 58 L68 42 L75 65 Z' fill='%23ced4da'/%3E%3Ccircle cx='38' cy='35' r='7' fill='%23ced4da'/%3E%3C/svg%3E";

const DROP_PRESETS = [
    {
        id: 'tickets',
        name: 'NMTs',
        fillType: 'tickets',
        icon: 'https://dodo.ac/np/images/4/43/Nook_Miles_Ticket_NH_Inv_Icon.png',
    },
    {
        id: 'crowns',
        name: 'Crowns',
        fillType: 'crowns',
        icon: 'https://dodo.ac/np/images/c/c7/Royal_Crown_NH_Storage_Icon.png',
    },
    {
        id: 'bells',
        name: '99k Bells',
        fillType: 'bells',
        icon: 'https://dodo.ac/np/images/1/1e/99k_Bells_NH_Inv_Icon.png',
    },
    {
        id: 'gold',
        name: 'Gold',
        fillType: 'gold',
        icon: 'https://dodo.ac/np/images/2/26/Gold_Nugget_NH_Inv_Icon.png',
    },
];

export const DropBot: React.FC = () => {
    const [searchParams] = useSearchParams();
    const urlIsland = searchParams.get('island');
    const urlTab = searchParams.get('tab');

    const { user, loading: authLoading, login } = useAuth();
    const { islands, loading: islandsLoading } = useIslandData();
    const { hasSavedCharacters } = useSavedCharacters();
    const [showSubRulesModal, setShowSubRulesModal] = useState(false);
    const [pendingDodoIsland, setPendingDodoIsland] = useState<IslandData | null>(null);
    const [revealPopupError, setRevealPopupError] = useState<string | null>(null);
    const { data: catalogData, isLoading: catalogLoading } = useCatalogData();
    const { favorites, isFavorite, toggleFavorite } = useFavorites();

    const {
        dropItems,
        setDropItems,
        totalDropCount,
        canIncreaseDrop,
        decreaseDropQuantity,
        increaseDropQuantity,
        removeDropItem,
        addItemToDropPockets,
        dropCommandText,
        getDropPocketQuantity,
    } = useCommandBuilderPockets();

    // ── Left Column Navigation Tab ──
    const [activeTab, setActiveTab] = useState<'items' | 'favorites' | 'villagers'>('items');

    // ── Search & Filter State ──
    const [itemSearch, setItemSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [itemPage, setItemPage] = useState(1);
    const ITEMS_PER_PAGE = 24;

    const [villagerSearch, setVillagerSearch] = useState('');
    const [villagerPage, setVillagerPage] = useState(1);
    const VILLAGERS_PER_PAGE = 24;

    // ── Villager Injection State ──
    const [selectedVillager, setSelectedVillager] = useState<CatalogEntity | null>(null);
    const [activePlot, setActivePlot] = useState<number>(0);
    const [injectedHouses, setInjectedHouses] = useState<Record<number, CatalogEntity | null>>({
        0: null,
        1: null,
        2: null,
        3: null,
        4: null,
        5: null,
        6: null,
        7: null,
        8: null,
        9: null,
    });
    const [injectingPlot, setInjectingPlot] = useState<number | null>(null);
    const [isBatchInjecting, setIsBatchInjecting] = useState(false);

    // ── Quick Variant Modal State ──
    const [variantModalItem, setVariantModalItem] = useState<PocketItem | null>(null);

    // ── Destination Island State ──
    const [dropFilter, setDropFilter] = useState<'all' | 'unlocked'>('all');
    const [selectedDropIsland, setSelectedDropIsland] = useState<IslandData | null>(null);
    const [dropDodoCode, setDropDodoCode] = useState<string | null>(null);
    const [dropDodoLoading, setDropDodoLoading] = useState(false);
    const [dropDodoError, setDropDodoError] = useState<string | null>(null);
    const [alreadyOnIsland, setAlreadyOnIsland] = useState(false);
    const [isDropping, setIsDropping] = useState(false);
    const [dodoCopied, setDodoCopied] = useState(false);

    // ── Notice State ──
    const [submissionNotice, setSubmissionNotice] = useState<{
        type: 'success' | 'danger' | 'info';
        message: string;
    } | null>(null);

    const playSound = () => {
        try {
            playChimeClick();
        } catch {
            // Audio synthesizer fallback
        }
    };

    // Drop bot is exclusively for VIP Sub Member islands
    const subMemberIslands = useMemo(() => {
        return islands.filter(
            (i) => i.cat === 'member' || i.type?.toLowerCase().includes('sub') || i.type === 'VIP'
        );
    }, [islands]);

    // Check if user has permission for an island
    const canAccessIsland = (island?: IslandData | null) => {
        if (!island) return false;
        if (user?.is_admin || user?.is_mod) return true;
        if (!island.requiredRoles || island.requiredRoles.length === 0) {
            return Boolean(user?.is_subscriber || user?.sub_tier);
        }
        if (!user || !user.roles) return false;
        return island.requiredRoles.some((role) => user.roles.includes(role));
    };

    const unlockedIslands = useMemo(() => {
        return subMemberIslands.filter((i) => canAccessIsland(i));
    }, [subMemberIslands, user]);

    const availableDropIslands = useMemo(() => {
        if (dropFilter === 'unlocked') return unlockedIslands;
        return subMemberIslands;
    }, [subMemberIslands, unlockedIslands, dropFilter]);

    // Handle URL query parameters (?island=...&tab=...)
    useEffect(() => {
        if (urlTab === 'villagers' || urlTab === 'items' || urlTab === 'favorites') {
            setActiveTab(urlTab);
        }
    }, [urlTab]);

    useEffect(() => {
        if (urlIsland && subMemberIslands.length > 0) {
            const clean = urlIsland.trim().toLowerCase();
            const matched = subMemberIslands.find(
                (i) =>
                    i.name.toLowerCase() === clean ||
                    i.id.toLowerCase() === clean ||
                    (i.canonicalName && i.canonicalName.toLowerCase() === clean)
            );
            if (matched) {
                setSelectedDropIsland(matched);
                if (matched.dodoCode && matched.dodoCode !== 'SUB ONLY' && matched.dodoCode !== '.....') {
                    setDropDodoCode(matched.dodoCode);
                }
            }
        }
    }, [urlIsland, subMemberIslands]);

    // Auto-select first accessible island
    useEffect(() => {
        if (!selectedDropIsland && subMemberIslands.length > 0) {
            const firstAccessible =
                subMemberIslands.find((i) => canAccessIsland(i)) ||
                subMemberIslands[0];
            setSelectedDropIsland(firstAccessible);
            if (firstAccessible?.dodoCode && firstAccessible.dodoCode !== 'SUB ONLY' && firstAccessible.dodoCode !== '.....') {
                setDropDodoCode(firstAccessible.dodoCode);
            }
        }
    }, [subMemberIslands, selectedDropIsland]);

    // Update Dodo if island has explicit public dodo
    useEffect(() => {
        if (selectedDropIsland) {
            if (selectedDropIsland.dodoCode && selectedDropIsland.dodoCode !== 'SUB ONLY' && selectedDropIsland.dodoCode !== '.....') {
                setDropDodoCode(selectedDropIsland.dodoCode);
            } else {
                setDropDodoCode(null);
            }
            setDropDodoError(null);
        }
    }, [selectedDropIsland]);

    // ── Catalog Data Extraction ──
    const allItems = useMemo(
        () => (catalogData?.items || []).filter((it) => !it.unorderable),
        [catalogData?.items]
    );
    const allVillagers = useMemo(
        () => (catalogData?.villagers || []).filter((v) => !v.unorderable),
        [catalogData?.villagers]
    );

    // Item Categories
    const itemCategories = useMemo(() => {
        const cats = new Set<string>();
        allItems.forEach((it) => {
            if (it.category) cats.add(it.category);
        });
        return ['All', ...Array.from(cats).sort()];
    }, [allItems]);

    // Filtered Items
    const filteredItems = useMemo(() => {
        let list = allItems;
        if (selectedCategory !== 'All') {
            list = list.filter((it) => it.category === selectedCategory);
        }
        if (itemSearch.trim()) {
            const q = itemSearch.toLowerCase().trim();
            list = list.filter((it) => it.name.toLowerCase().includes(q));
        }
        return list;
    }, [allItems, selectedCategory, itemSearch]);

    // Filtered Villagers
    const filteredVillagers = useMemo(() => {
        if (!villagerSearch.trim()) return allVillagers;
        const q = villagerSearch.toLowerCase().trim();
        return allVillagers.filter(
            (v) =>
                v.name.toLowerCase().includes(q) ||
                (v.category && v.category.toLowerCase().includes(q))
        );
    }, [allVillagers, villagerSearch]);

    // Filtered Favorites
    const favoriteItems = useMemo(() => {
        if (!favorites || favorites.length === 0) return [];
        const favSet = new Set(favorites);
        return (catalogData?.all || []).filter((it) => favSet.has(it.id));
    }, [favorites, catalogData?.all]);

    // Paginated Items
    const totalItemPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE) || 1;
    const paginatedItems = useMemo(() => {
        const start = (itemPage - 1) * ITEMS_PER_PAGE;
        return filteredItems.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredItems, itemPage]);

    // Paginated Villagers
    const totalVillagerPages = Math.ceil(filteredVillagers.length / VILLAGERS_PER_PAGE) || 1;
    const paginatedVillagers = useMemo(() => {
        const start = (villagerPage - 1) * VILLAGERS_PER_PAGE;
        return filteredVillagers.slice(start, start + VILLAGERS_PER_PAGE);
    }, [filteredVillagers, villagerPage]);

    // ── Handlers ──
    const handleGetDodo = async (island: IslandData | null) => {
        if (!island) return;

        // Require saved in-game character before revealing Dodo codes
        if (!hasSavedCharacters) {
            setRevealPopupError('You must save your In-Game Character (IGN & Island Name) first before you can reveal Dodo codes. Please add your character in Profile Settings.');
            return;
        }

        // Require one-time Sub Rules acknowledgment for Sub members / Sub islands
        const isSubMember = Boolean(user?.is_subscriber || user?.sub_tier || island.cat === 'member');
        if (isSubMember && !isSubRulesAccepted(user?.user_id)) {
            setPendingDodoIsland(island);
            setShowSubRulesModal(true);
            return;
        }

        setDropDodoLoading(true);
        setDropDodoError(null);
        playSound();

        try {
            const res = await revealIslandDodoCode(island.name);
            if (res.success && res.dodoCode) {
                setDropDodoCode(res.dodoCode);
                triggerConfetti({ theme: 'gold', particleCount: 70 });
                setSubmissionNotice({
                    type: 'success',
                    message: `Dodo code revealed for ${island.name}: ${res.dodoCode}! Head to the airport to fly.`,
                });
            } else {
                const errMsg = res.error || 'Unable to retrieve Dodo code.';
                setDropDodoError(errMsg);
                if ((res as any).requires_character || /character|ign|island name/i.test(errMsg)) {
                    setRevealPopupError(errMsg);
                }
            }
        } catch (e: any) {
            console.error(e);
            setDropDodoError('Network error while retrieving Dodo code. Please try again.');
        } finally {
            setDropDodoLoading(false);
        }
    };

    const handleSubRulesAccepted = () => {
        setShowSubRulesModal(false);
        if (pendingDodoIsland) {
            const target = pendingDodoIsland;
            setPendingDodoIsland(null);
            handleGetDodo(target);
        }
    };

    const handleCopyDodoCode = () => {
        if (!dropDodoCode) return;
        navigator.clipboard.writeText(dropDodoCode).catch(() => { });
        playSound();
        setDodoCopied(true);
        setTimeout(() => setDodoCopied(false), 2000);
        setSubmissionNotice({
            type: 'info',
            message: `Copied Dodo code ${dropDodoCode} to clipboard!`,
        });
    };

    // ── Direct Drop Items via SysBot HTTP API ──
    const handleDirectDrop = async () => {
        if (!selectedDropIsland) {
            setSubmissionNotice({
                type: 'danger',
                message: 'Please select a destination sub island above first.',
            });
            return;
        }

        if (totalDropCount === 0 || !dropCommandText) {
            setSubmissionNotice({
                type: 'danger',
                message: 'Your drop pocket is empty. Choose up to 9 items first.',
            });
            return;
        }

        playSound();
        setIsDropping(true);
        setSubmissionNotice(null);

        // Strip !drop command prefix
        const itemsClean = dropCommandText.replace(/^!drop\s*/i, '').trim();

        try {
            const res = await submitIslandDrop(
                selectedDropIsland.name,
                itemsClean,
                'items',
                user?.username || 'WebUser'
            );

            if (res.success) {
                triggerConfetti({ theme: 'rainbow', particleCount: 85 });
                playSound();
                setSubmissionNotice({
                    type: 'success',
                    message: `🚀 Success! Dispatched drop of ${totalDropCount} item(s) to ${selectedDropIsland.name}! SysBot is placing them at the airport zone.`,
                });
            } else {
                setSubmissionNotice({
                    type: 'danger',
                    message: `SysBot Notice: ${res.error || 'Failed to dispatch drop'}.`,
                });
            }
        } catch (err: any) {
            setSubmissionNotice({
                type: 'danger',
                message: `Connection error: ${err?.message || 'Failed to communicate with island SysBot'}.`,
            });
        } finally {
            setIsDropping(false);
        }
    };

    // ── Direct Inject Single Villager ──
    const handleDirectInjectVillager = async (plot: number, villager: CatalogEntity) => {
        if (!selectedDropIsland) {
            setSubmissionNotice({
                type: 'danger',
                message: 'Please select a destination sub island first.',
            });
            return;
        }


        playSound();
        setInjectingPlot(plot);

        try {
            const res = await injectIslandVillager(selectedDropIsland.name, villager.name, plot);
            if (res.success) {
                triggerConfetti({ theme: 'gold', particleCount: 60 });
                playSound();
                setInjectedHouses((prev) => ({ ...prev, [plot]: villager }));
                setSubmissionNotice({
                    type: 'success',
                    message: `✨ ${villager.name} is now moving into House Plot #${plot} on ${selectedDropIsland.name}!`,
                });
            } else {
                setSubmissionNotice({
                    type: 'danger',
                    message: `SysBot Notice: ${res.error || 'Villager injection failed'}.`,
                });
            }
        } catch (err: any) {
            setSubmissionNotice({
                type: 'danger',
                message: `Error: ${err?.message || 'Failed to inject villager'}.`,
            });
        } finally {
            setInjectingPlot(null);
        }
    };

    // ── Direct Batch Inject Villagers ──
    const handleDirectBatchInject = async (command: string) => {
        if (!selectedDropIsland) {
            setSubmissionNotice({
                type: 'danger',
                message: 'Please select a destination sub island first.',
            });
            return;
        }


        playSound();
        setIsBatchInjecting(true);

        try {
            const res = await batchInjectIslandVillagers(selectedDropIsland.name, command);
            if (res.success) {
                triggerConfetti({ theme: 'rainbow', particleCount: 90 });
                playSound();
                setSubmissionNotice({
                    type: 'success',
                    message: `🎉 Batch villagers dispatched! Plots assigned on ${selectedDropIsland.name}.`,
                });
            } else {
                setSubmissionNotice({
                    type: 'danger',
                    message: `SysBot Notice: ${res.error || 'Batch injection failed'}.`,
                });
            }
        } catch (err: any) {
            setSubmissionNotice({
                type: 'danger',
                message: `Error: ${err?.message || 'Failed to batch inject villagers'}.`,
            });
        } finally {
            setIsBatchInjecting(false);
        }
    };

    const handleApplyPreset = (fillType: string) => {
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
    };

    const handleCopyCommand = (command: string, label = 'command') => {
        if (!command) return;
        navigator.clipboard.writeText(command).catch(() => { });
        playSound();
        setSubmissionNotice({
            type: 'success',
            message: `Copied ${label} to clipboard!`,
        });
    };

    // ── Auth loading skeleton ──
    if (authLoading) {
        return (
            <div className="nook-bg min-vh-100 d-flex align-items-center justify-content-center p-4">
                <div className="text-center bg-white rounded-4 shadow-sm border p-5">
                    <div className="spinner-border text-success mb-3" role="status" />
                    <p className="fw-bold text-muted mb-0">Connecting to ChoPaeng…</p>
                </div>
            </div>
        );
    }

    // ── Resident Sign In Wall ──
    if (!user) {
        return (
            <>
                <Helmet>
                    <title>Treasure Island Drop Bot · ChoPaeng</title>
                    <meta
                        name="description"
                        content="Sign in with ChoPaeng to access the Treasure Island Drop Bot and Villager Injector."
                    />
                </Helmet>
                <div className="nook-bg min-vh-100 py-5 px-3 d-flex align-items-center justify-content-center font-nunito">
                    <div className="container" style={{ maxWidth: 640 }}>
                        <div className="bg-white rounded-5 shadow-sm border p-4 p-md-5 text-center mb-4 animate-fade">
                            <div
                                className="d-inline-flex align-items-center justify-content-center rounded-circle text-white mb-4 shadow-sm"
                                style={{ width: 76, height: 76, backgroundColor: '#37b06d' }}
                            >
                                <i className="fa-solid fa-parachute-box fa-2x" />
                            </div>

                            <h1 className="ac-font h2 text-dark mb-2 fw-black">
                                Treasure Island Drop Bot
                            </h1>
                            <p className="text-muted fw-bold mb-4" style={{ fontSize: '0.95rem', lineHeight: 1.6 }}>
                                Sign in to your ChoPaeng account to select any island, reveal live Dodo codes, drop custom items on the ground, and inject villagers into House Plots 0–9.
                            </p>

                            <div className="d-flex gap-2 flex-wrap justify-content-center mb-4">
                                <span className="badge bg-light text-dark border rounded-pill px-3 py-2 fw-bold d-inline-flex align-items-center gap-1">
                                    <i className="fa-solid fa-parachute-box text-success me-1" /> Max 9 Drop Slots
                                </span>
                                <span className="badge bg-light text-dark border rounded-pill px-3 py-2 fw-bold d-inline-flex align-items-center gap-1">
                                    <i className="fa-solid fa-house-user text-warning me-1" /> House Plots 0–9 Injector
                                </span>
                                <span className="badge bg-light text-dark border rounded-pill px-3 py-2 fw-bold d-inline-flex align-items-center gap-1">
                                    <i className="fa-solid fa-plane-departure text-primary me-1" /> Live Dodo Reveal
                                </span>
                                <span className="badge bg-light text-dark border rounded-pill px-3 py-2 fw-bold d-inline-flex align-items-center gap-1">
                                    <i className="fa-solid fa-bolt text-info me-1" /> Instant In-Browser Dispatch
                                </span>
                            </div>

                            <div className="mb-3">
                                <button
                                    id="dropbot-resident-login-btn"
                                    type="button"
                                    onClick={() => {
                                        playSound();
                                        login();
                                    }}
                                    className="btn btn-success rounded-pill fw-black px-5 py-3 shadow-sm d-inline-flex align-items-center gap-2 hover-scale transition-all"
                                    style={{ fontSize: '1.05rem', backgroundColor: '#37b06d', borderColor: '#37b06d' }}
                                >
                                    <i className="fa-solid fa-passport me-1" />
                                    <span>Resident Sign In</span>
                                </button>
                            </div>

                            <div className="d-flex align-items-center justify-content-center gap-3 mt-3 flex-wrap">
                                <Link
                                    to="/order"
                                    className="text-decoration-none small fw-bold text-muted d-inline-flex align-items-center gap-1 hover-text-dark"
                                >
                                    <i className="fa-solid fa-paper-plane text-primary" />
                                    <span>Switch to 40-Slot Order Bot</span>
                                </Link>
                                <span className="text-muted small">•</span>
                                <Link
                                    to="/membership"
                                    className="text-decoration-none small fw-bold text-muted d-inline-flex align-items-center gap-1 hover-text-dark"
                                >
                                    <i className="fa-solid fa-crown text-warning" />
                                    <span>Sub Member Benefits</span>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    const isCurrentIslandAccessible = canAccessIsland(selectedDropIsland);

    return (
        <div className="ob-page">
            <Helmet>
                <title>Treasure Island Drop Bot &amp; Villager Injector | ChoPaeng</title>
                <meta
                    name="description"
                    content="Drop up to 9 custom items or inject villagers into House Plots 0–9 instantly on ChoPaeng Treasure Islands."
                />
            </Helmet>

            {/* ════ HERO HEADER ════ */}
            <header className="ob-hero">
                <div className="container">
                    <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
                        <div>
                            <div className="d-flex align-items-center gap-2 mb-1">
                                <span className="badge rounded-pill bg-success-subtle text-success border border-success-subtle px-3 py-1 fw-bold" style={{ fontSize: '0.75rem' }}>
                                    <i className="fa-solid fa-parachute-box me-1" />
                                    IN-ISLAND DROP BOT
                                </span>
                                <span className="badge rounded-pill bg-light text-muted border px-2 py-1 fw-semibold" style={{ fontSize: '0.72rem' }}>
                                    Max {DROP_MAX} Slots · House Plots 0–9 · Live Dodo
                                </span>
                            </div>
                            <h1 className="h3 fw-black text-dark mb-1" style={{ fontFamily: 'var(--font-heading, "Nunito", sans-serif)' }}>
                                Treasure Island Drop Bot
                            </h1>
                            <p className="text-muted mb-0" style={{ fontSize: '0.88rem' }}>
                                Select any island, reveal your Dodo code, drop items onto the airport zone, and inject villagers directly from your browser!
                            </p>
                        </div>

                        {/* Quick switch to Order Bot */}
                        <div className="d-flex align-items-center gap-2">
                            <Link
                                to="/order"
                                className="btn btn-outline-dark rounded-pill fw-bold px-3 py-2 d-flex align-items-center gap-2 shadow-2xs"
                                style={{ fontSize: '0.82rem' }}
                            >
                                <i className="fa-solid fa-paper-plane text-primary" />
                                <span>Switch to 40-Slot Order Bot</span>
                            </Link>
                        </div>
                    </div>
                </div>
            </header>

            {/* ════ MAIN CONTAINER ════ */}
            <main className="container py-4">
                {/* Notice Alert */}
                {submissionNotice && (
                    <div
                        className={`alert alert-${submissionNotice.type} rounded-4 border-0 p-3 mb-4 d-flex align-items-center justify-content-between gap-3 shadow-2xs animate-fade`}
                    >
                        <div className="d-flex align-items-center gap-2">
                            <i
                                className={`fa-solid ${submissionNotice.type === 'success'
                                    ? 'fa-circle-check text-success'
                                    : submissionNotice.type === 'danger'
                                        ? 'fa-triangle-exclamation text-danger'
                                        : 'fa-circle-info text-primary'
                                    } fs-5`}
                            />
                            <span className="fw-bold text-dark small">{submissionNotice.message}</span>
                        </div>
                        <button
                            type="button"
                            className="btn btn-sm btn-link p-0 text-muted"
                            onClick={() => setSubmissionNotice(null)}
                        >
                            <i className="fa-solid fa-xmark" />
                        </button>
                    </div>
                )}

                <div className="row g-4">
                    {/* ══════════════════════════════════════════
                        LEFT COLUMN: CATALOG / FAVORITES / VILLAGERS
                    ══════════════════════════════════════════ */}
                    <div className="col-12 col-lg-7">
                        <div className="bg-white rounded-4 border border-light p-3 p-md-4 shadow-sm mb-4">
                            {/* Navigation Tabs */}
                            <div className="d-flex align-items-center gap-2 mb-3 pb-3 border-bottom flex-wrap">
                                <button
                                    type="button"
                                    onClick={() => {
                                        playSound();
                                        setActiveTab('items');
                                    }}
                                    className={`btn rounded-pill fw-black px-3 py-2 transition-all d-flex align-items-center gap-2 ${activeTab === 'items'
                                        ? 'btn-success text-white shadow-2xs'
                                        : 'btn-light text-muted border-0'
                                        }`}
                                    style={{ fontSize: '0.82rem' }}
                                >
                                    <i className="fa-solid fa-boxes-stacked" />
                                    <span>Items (Max {DROP_MAX})</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        playSound();
                                        setActiveTab('favorites');
                                    }}
                                    className={`btn rounded-pill fw-black px-3 py-2 transition-all d-flex align-items-center gap-2 ${activeTab === 'favorites'
                                        ? 'btn-success text-white shadow-2xs'
                                        : 'btn-light text-muted border-0'
                                        }`}
                                    style={{ fontSize: '0.82rem' }}
                                >
                                    <i className="fa-solid fa-star text-warning" />
                                    <span>Wishlist &amp; Favorites ({favorites.length})</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        playSound();
                                        setActiveTab('villagers');
                                    }}
                                    className={`btn rounded-pill fw-black px-3 py-2 transition-all d-flex align-items-center gap-2 ${activeTab === 'villagers'
                                        ? 'btn-success text-white shadow-2xs'
                                        : 'btn-light text-muted border-0'
                                        }`}
                                    style={{ fontSize: '0.82rem' }}
                                >
                                    <i className="fa-solid fa-house-chimney text-info" />
                                    <span>Villagers (Plots 0–9)</span>
                                </button>
                            </div>

                            {/* ── ITEMS TAB ── */}
                            {activeTab === 'items' && (
                                <>
                                    <div className="row g-2 mb-3">
                                        <div className="col-12 col-md-7">
                                            <div className="input-group">
                                                <span className="input-group-text bg-light border-end-0 rounded-start-pill text-muted">
                                                    <i className="fa-solid fa-magnifying-glass" />
                                                </span>
                                                <input
                                                    type="text"
                                                    value={itemSearch}
                                                    onChange={(e) => {
                                                        setItemSearch(e.target.value);
                                                        setItemPage(1);
                                                    }}
                                                    placeholder="Search furniture, materials, DIYs, clothes…"
                                                    className="form-control bg-light border-start-0 rounded-end-pill shadow-none"
                                                    style={{ fontSize: '0.85rem' }}
                                                />
                                            </div>
                                        </div>

                                        <div className="col-12 col-md-5">
                                            <select
                                                value={selectedCategory}
                                                onChange={(e) => {
                                                    setSelectedCategory(e.target.value);
                                                    setItemPage(1);
                                                }}
                                                className="form-select rounded-pill bg-light border text-muted shadow-none"
                                                style={{ fontSize: '0.85rem' }}
                                            >
                                                {itemCategories.map((c) => (
                                                    <option key={c} value={c}>
                                                        {c}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Item Grid */}
                                    {catalogLoading ? (
                                        <div className="text-center py-5">
                                            <div className="spinner-border text-success mb-2" role="status" />
                                            <p className="text-muted small fw-bold">Loading Nook Catalog…</p>
                                        </div>
                                    ) : paginatedItems.length === 0 ? (
                                        <div className="text-center py-5 text-muted">
                                            <i className="fa-solid fa-box-open fs-2 mb-2 d-block text-secondary" />
                                            <span className="small fw-bold">No items found matching "{itemSearch}".</span>
                                        </div>
                                    ) : (
                                        <div className="row g-2 mb-3">
                                            {paginatedItems.map((it) => {
                                                const quantity = getDropPocketQuantity(it.id);
                                                return (
                                                    <div key={it.id} className="col-6 col-sm-4 col-md-3">
                                                        <div
                                                            className="p-2 rounded-4 text-center border h-100 bg-white transition-all position-relative shadow-2xs hover-shadow"
                                                            style={{ cursor: 'pointer' }}
                                                            onClick={() => {
                                                                playSound();
                                                                addItemToDropPockets(it);
                                                            }}
                                                        >
                                                            {/* Favorite button */}
                                                            <button
                                                                type="button"
                                                                className="btn btn-link p-0 position-absolute top-0 end-0 m-1 border-0"
                                                                style={{ fontSize: '0.75rem', zIndex: 2 }}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    playSound();
                                                                    toggleFavorite(it.id);
                                                                }}
                                                            >
                                                                <i className={`fa-star ${isFavorite(it.id) ? 'fa-solid text-warning' : 'fa-regular text-muted'}`} />
                                                            </button>

                                                            <img
                                                                src={it.image || FALLBACK_IMG}
                                                                alt={it.name}
                                                                className="mb-1"
                                                                style={{ width: 44, height: 44, objectFit: 'contain' }}
                                                                onError={(e) => {
                                                                    (e.currentTarget as HTMLImageElement).src = FALLBACK_IMG;
                                                                }}
                                                            />
                                                            <span className="d-block fw-bold text-dark text-truncate" style={{ fontSize: '0.75rem' }} title={it.name}>
                                                                {it.name}
                                                            </span>

                                                            {quantity > 0 && (
                                                                <span className="badge bg-success rounded-pill px-2 py-0.5 mt-1" style={{ fontSize: '0.68rem' }}>
                                                                    ×{quantity} in Drop
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Pagination */}
                                    {totalItemPages > 1 && (
                                        <div className="d-flex align-items-center justify-content-between pt-2 border-top">
                                            <button
                                                type="button"
                                                disabled={itemPage === 1}
                                                onClick={() => setItemPage((p) => Math.max(1, p - 1))}
                                                className="btn btn-sm btn-outline-secondary rounded-pill px-3"
                                                style={{ fontSize: '0.75rem' }}
                                            >
                                                Previous
                                            </button>
                                            <span className="text-muted small fw-bold">
                                                Page {itemPage} of {totalItemPages}
                                            </span>
                                            <button
                                                type="button"
                                                disabled={itemPage === totalItemPages}
                                                onClick={() => setItemPage((p) => Math.min(totalItemPages, p + 1))}
                                                className="btn btn-sm btn-outline-secondary rounded-pill px-3"
                                                style={{ fontSize: '0.75rem' }}
                                            >
                                                Next
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* ── FAVORITES TAB ── */}
                            {activeTab === 'favorites' && (
                                <div>
                                    {favoriteItems.length === 0 ? (
                                        <div className="text-center py-5 text-muted">
                                            <i className="fa-solid fa-star fs-2 mb-2 d-block text-warning opacity-50" />
                                            <p className="fw-bold mb-1">Your Wishlist is Empty</p>
                                            <span className="small text-muted">
                                                Star items or villagers from the catalog to quickly drop or inject them anytime.
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="row g-2 mb-3">
                                            {favoriteItems.map((it) => {
                                                const quantity = getDropPocketQuantity(it.id);
                                                return (
                                                    <div key={it.id} className="col-6 col-sm-4 col-md-3">
                                                        <div
                                                            className="p-2 rounded-4 text-center border h-100 bg-white transition-all position-relative shadow-2xs hover-shadow"
                                                            style={{ cursor: 'pointer' }}
                                                            onClick={() => {
                                                                playSound();
                                                                addItemToDropPockets(it);
                                                            }}
                                                        >
                                                            <button
                                                                type="button"
                                                                className="btn btn-link p-0 position-absolute top-0 end-0 m-1 border-0"
                                                                style={{ fontSize: '0.75rem', zIndex: 2 }}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    playSound();
                                                                    toggleFavorite(it.id);
                                                                }}
                                                            >
                                                                <i className="fa-solid fa-star text-warning" />
                                                            </button>

                                                            <img
                                                                src={it.image || FALLBACK_IMG}
                                                                alt={it.name}
                                                                className="mb-1"
                                                                style={{ width: 44, height: 44, objectFit: 'contain' }}
                                                            />
                                                            <span className="d-block fw-bold text-dark text-truncate" style={{ fontSize: '0.75rem' }} title={it.name}>
                                                                {it.name}
                                                            </span>

                                                            {quantity > 0 && (
                                                                <span className="badge bg-success rounded-pill px-2 py-0.5 mt-1" style={{ fontSize: '0.68rem' }}>
                                                                    ×{quantity} in Drop
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── VILLAGERS TAB ── */}
                            {activeTab === 'villagers' && (
                                <>
                                    <div className="mb-3">
                                        <div className="input-group">
                                            <span className="input-group-text bg-light border-end-0 rounded-start-pill text-muted">
                                                <i className="fa-solid fa-magnifying-glass" />
                                            </span>
                                            <input
                                                type="text"
                                                value={villagerSearch}
                                                onChange={(e) => {
                                                    setVillagerSearch(e.target.value);
                                                    setVillagerPage(1);
                                                }}
                                                placeholder="Search villagers by name or personality (e.g. Raymond, Sasha, Judy)…"
                                                className="form-control bg-light border-start-0 rounded-end-pill shadow-none"
                                                style={{ fontSize: '0.85rem' }}
                                            />
                                        </div>
                                    </div>

                                    {/* Villager Grid */}
                                    {paginatedVillagers.length === 0 ? (
                                        <div className="text-center py-5 text-muted">
                                            <i className="fa-solid fa-user-ninja fs-2 mb-2 d-block text-secondary" />
                                            <span className="small fw-bold">No villagers found matching "{villagerSearch}".</span>
                                        </div>
                                    ) : (
                                        <div className="row g-2 mb-3">
                                            {paginatedVillagers.map((v) => {
                                                const isChosen = selectedVillager?.id === v.id;
                                                return (
                                                    <div key={v.id} className="col-6 col-sm-4 col-md-3">
                                                        <div
                                                            className={`p-2 rounded-4 text-center border h-100 transition-all position-relative shadow-2xs hover-shadow ${isChosen
                                                                    ? 'bg-success-subtle border-2 border-success'
                                                                    : 'bg-white'
                                                                }`}
                                                            style={{ cursor: 'pointer' }}
                                                            onClick={() => {
                                                                playSound();
                                                                setSelectedVillager(v);
                                                            }}
                                                        >
                                                            <img
                                                                src={v.image || FALLBACK_IMG}
                                                                alt={v.name}
                                                                className="rounded-circle border mb-1 bg-white"
                                                                style={{ width: 44, height: 44, objectFit: 'contain' }}
                                                            />
                                                            <span className="d-block fw-bold text-dark text-truncate" style={{ fontSize: '0.75rem' }}>
                                                                {v.name}
                                                            </span>
                                                            {v.category && (
                                                                <span className="text-muted d-block tiny-text">
                                                                    {v.category}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Pagination */}
                                    {totalVillagerPages > 1 && (
                                        <div className="d-flex align-items-center justify-content-between pt-2 border-top">
                                            <button
                                                type="button"
                                                disabled={villagerPage === 1}
                                                onClick={() => setVillagerPage((p) => Math.max(1, p - 1))}
                                                className="btn btn-sm btn-outline-secondary rounded-pill px-3"
                                                style={{ fontSize: '0.75rem' }}
                                            >
                                                Previous
                                            </button>
                                            <span className="text-muted small fw-bold">
                                                Page {villagerPage} of {totalVillagerPages}
                                            </span>
                                            <button
                                                type="button"
                                                disabled={villagerPage === totalVillagerPages}
                                                onClick={() => setVillagerPage((p) => Math.min(totalVillagerPages, p + 1))}
                                                className="btn btn-sm btn-outline-secondary rounded-pill px-3"
                                                style={{ fontSize: '0.75rem' }}
                                            >
                                                Next
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* ══════════════════════════════════════════
                        RIGHT COLUMN: DESTINATION ISLAND & DROP GRID
                    ══════════════════════════════════════════ */}
                    <div className="col-12 col-lg-5">
                        {/* ── STEP 1: DESTINATION ISLAND SELECTOR & DODO BOARDING PASS ── */}
                        <div className="bg-white rounded-4 border border-light p-3 p-md-4 shadow-sm mb-4">
                            <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom flex-wrap gap-2">
                                <div className="d-flex align-items-center gap-2">
                                    <div
                                        className="rounded-circle d-flex align-items-center justify-content-center text-white"
                                        style={{ width: 34, height: 34, background: 'linear-gradient(135deg, #f59e0b, #d97706)', fontSize: '0.95rem' }}
                                    >
                                        <i className="fa-solid fa-location-dot" />
                                    </div>
                                    <div>
                                        <h3 className="h6 fw-bold mb-0 text-dark">Destination Island</h3>
                                        <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                                            Select any island to reveal live Dodo boarding pass, drop items, or inject villagers
                                        </span>
                                    </div>
                                </div>

                                {/* Filter categories */}
                                <div className="d-flex gap-1 bg-light p-1 rounded-pill border flex-wrap">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            playSound();
                                            setDropFilter('all');
                                        }}
                                        className={`btn btn-xs rounded-pill fw-bold px-2.5 py-1 ${dropFilter === 'all'
                                            ? 'btn-dark text-white'
                                            : 'text-muted border-0 bg-transparent'
                                            }`}
                                        style={{ fontSize: '0.72rem' }}
                                    >
                                        VIP Sub ({subMemberIslands.length})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            playSound();
                                            setDropFilter('unlocked');
                                        }}
                                        className={`btn btn-xs rounded-pill fw-bold px-2.5 py-1 ${dropFilter === 'unlocked'
                                            ? 'btn-dark text-white'
                                            : 'text-muted border-0 bg-transparent'
                                            }`}
                                        style={{ fontSize: '0.72rem' }}
                                    >
                                        My Pass ({unlockedIslands.length})
                                    </button>
                                </div>
                            </div>

                            {/* Island Dropdown */}
                            {islandsLoading ? (
                                <div className="text-center py-2 text-muted small">Loading islands…</div>
                            ) : (
                                <div className="mb-3">
                                    <select
                                        className="form-select rounded-4 border shadow-2xs fw-bold text-dark"
                                        style={{ fontSize: '0.88rem' }}
                                        value={selectedDropIsland?.id || ''}
                                        onChange={(e) => {
                                            const found = subMemberIslands.find((i) => i.id === e.target.value);
                                            setSelectedDropIsland(found || null);
                                            setAlreadyOnIsland(false);
                                            playSound();
                                        }}
                                    >
                                        <option value="">-- Choose VIP Sub Island ({availableDropIslands.length} Available) --</option>
                                        {availableDropIslands.map((isl) => (
                                            <option key={isl.id} value={isl.id}>
                                                ⭐ {isl.name} · VIP Sub Island
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Selected Island Info & Dodo Boarding Pass */}
                            {selectedDropIsland && (
                                <div className="mb-2">
                                    {/* Island Header Card */}
                                    <div
                                        className="p-3 rounded-4 border mb-3 transition-all"
                                        style={{
                                            background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
                                            borderColor: '#fde68a',
                                        }}
                                    >
                                        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                                            <div className="d-flex align-items-center gap-2">
                                                <div
                                                    className="rounded-circle d-flex align-items-center justify-content-center text-white"
                                                    style={{
                                                        width: 32,
                                                        height: 32,
                                                        background: '#f59e0b',
                                                        fontSize: '0.85rem',
                                                    }}
                                                >
                                                    <i className="fa-solid fa-crown" />
                                                </div>
                                                <div>
                                                    <h4 className="fw-black text-dark mb-0" style={{ fontSize: '1rem' }}>
                                                        {selectedDropIsland.name}
                                                    </h4>
                                                    <span className="text-muted tiny-text">
                                                        ⭐ VIP Sub Member Island
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="d-flex align-items-center gap-1.5 flex-wrap">
                                                <span
                                                    className={`badge rounded-pill fw-bold px-2.5 py-1 ${isCurrentIslandAccessible
                                                            ? 'bg-success text-white'
                                                            : 'bg-warning text-dark'
                                                        }`}
                                                    style={{ fontSize: '0.7rem' }}
                                                >
                                                    {isCurrentIslandAccessible ? 'Access Granted' : 'Sub Pass Needed'}
                                                </span>
                                                <span className="badge bg-light text-dark border rounded-pill px-2 py-1 fw-bold tiny-text">
                                                    🟢 Online
                                                </span>
                                            </div>
                                        </div>

                                        {/* Boarding Pass Ticket */}
                                        <div className="bg-white rounded-3 p-3 border shadow-2xs mt-2">
                                            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                                                <div>
                                                    <span className="text-muted fw-bold text-uppercase d-block" style={{ fontSize: '0.65rem', letterSpacing: '0.05em' }}>
                                                        DAL AIRLINE BOARDING PASS
                                                    </span>
                                                    {dropDodoCode ? (
                                                        <div className="d-flex align-items-center gap-2 mt-0.5">
                                                            <span className="font-monospace fw-black text-success" style={{ fontSize: '1.45rem', letterSpacing: '0.08em' }}>
                                                                {dropDodoCode}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={handleCopyDodoCode}
                                                                className={`btn btn-xs rounded-pill fw-bold px-2.5 py-1 ${dodoCopied ? 'btn-success text-white' : 'btn-outline-success'}`}
                                                                style={{ fontSize: '0.72rem' }}
                                                                title="Copy Dodo Code"
                                                            >
                                                                <i className={`fa-solid ${dodoCopied ? 'fa-check' : 'fa-copy'} me-1`} />
                                                                {dodoCopied ? 'Copied!' : 'Copy'}
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted fw-bold small">
                                                            Dodo code hidden for subscriber security
                                                        </span>
                                                    )}
                                                </div>

                                                <div>
                                                    {!dropDodoCode ? (
                                                        <button
                                                            type="button"
                                                            disabled={dropDodoLoading}
                                                            onClick={() => handleGetDodo(selectedDropIsland)}
                                                            className="btn btn-sm btn-warning text-dark rounded-pill fw-black px-3.5 py-1.5 shadow-2xs hover-scale transition-all"
                                                            style={{ fontSize: '0.8rem', background: 'linear-gradient(135deg, #f59e0b, #d97706)', border: 'none', color: '#fff' }}
                                                        >
                                                            {dropDodoLoading ? (
                                                                <>
                                                                    <span className="spinner-border spinner-border-sm me-1" /> Revealing…
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <i className="fa-solid fa-eye me-1.5" /> Reveal Dodo Code
                                                                </>
                                                            )}
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleGetDodo(selectedDropIsland)}
                                                            disabled={dropDodoLoading}
                                                            className="btn btn-xs btn-outline-secondary rounded-pill px-2.5 py-1"
                                                            style={{ fontSize: '0.72rem' }}
                                                            title="Refresh Dodo Code"
                                                        >
                                                            <i className="fa-solid fa-arrows-rotate me-1" /> Refresh
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Airport hint */}
                                            <div className="d-flex align-items-center justify-content-between mt-2 pt-2 border-top flex-wrap gap-1">
                                                <span className="text-muted tiny-text">
                                                    <i className="fa-solid fa-plane-departure text-primary me-1" />
                                                    Fly via Dodo Airlines at Orville's airport counter
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        playSound();
                                                        setAlreadyOnIsland(!alreadyOnIsland);
                                                    }}
                                                    className={`btn btn-xs rounded-pill fw-bold px-2 py-0.5 border-0 ${alreadyOnIsland ? 'text-success' : 'text-muted'}`}
                                                    style={{ fontSize: '0.72rem' }}
                                                >
                                                    <i className={`fa-solid ${alreadyOnIsland ? 'fa-circle-check text-success' : 'fa-circle-dot'} me-1`} />
                                                    {alreadyOnIsland ? "I'm on Island" : "Mark as on Island"}
                                                </button>
                                            </div>
                                        </div>

                                        {dropDodoError && (
                                            <div className="alert alert-danger rounded-3 p-2 mt-2 mb-0 tiny-text fw-bold d-flex align-items-center justify-content-between">
                                                <span>
                                                    <i className="fa-solid fa-circle-exclamation me-1" />
                                                    {dropDodoError}
                                                </span>
                                                {dropDodoError.includes('Sub Member') && (
                                                    <Link to="/membership" className="btn btn-xs btn-dark rounded-pill px-2 py-0.5 text-nowrap">
                                                        Unlock
                                                    </Link>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ── RIGHT VIEW CONDITIONAL: VILLAGER HOUSE PLOTS OR 9-SLOT DROP GRID ── */}
                        {activeTab === 'villagers' ? (
                            <DropBotHouseGrid
                                selectedVillager={selectedVillager}
                                activePlot={activePlot}
                                onSelectPlot={(p) => setActivePlot(p)}
                                injectedHouses={injectedHouses}
                                onAssignVillagerToPlot={(p, v) => {
                                    setInjectedHouses((prev) => ({ ...prev, [p]: v }));
                                }}
                                onClearPlot={(p) => {
                                    setInjectedHouses((prev) => ({ ...prev, [p]: null }));
                                }}
                                onClearAllPlots={() => {
                                    setInjectedHouses({
                                        0: null,
                                        1: null,
                                        2: null,
                                        3: null,
                                        4: null,
                                        5: null,
                                        6: null,
                                        7: null,
                                        8: null,
                                        9: null,
                                    });
                                }}
                                onCopyCommand={handleCopyCommand}
                                targetIsland={selectedDropIsland}
                                onInjectVillagerNow={handleDirectInjectVillager}
                                onBatchInjectNow={handleDirectBatchInject}
                                injectingPlot={injectingPlot}
                                isBatchInjecting={isBatchInjecting}
                            />
                        ) : (
                            /* ── 9-SLOT DROP POCKET TRACKER & DISPATCH ── */
                            <div className="bg-white rounded-4 border border-light p-3 p-md-4 shadow-sm">
                                {/* Header */}
                                <div className="d-flex align-items-center justify-content-between mb-3 pb-3 border-bottom flex-wrap gap-2">
                                    <div className="d-flex align-items-center gap-2">
                                        <div
                                            className="rounded-circle d-flex align-items-center justify-content-center text-white"
                                            style={{
                                                width: 38,
                                                height: 38,
                                                background: 'linear-gradient(135deg, #10b981, #059669)',
                                                fontSize: '1rem',
                                            }}
                                        >
                                            <i className="fa-solid fa-parachute-box" />
                                        </div>
                                        <div>
                                            <h3 className="h6 fw-bold mb-0 text-dark">Drop Pocket</h3>
                                            <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                                                {totalDropCount} / {DROP_MAX} slots filled
                                            </span>
                                        </div>
                                    </div>

                                    {totalDropCount > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                playSound();
                                                setDropItems([]);
                                            }}
                                            className="btn btn-sm btn-link p-0 text-danger text-decoration-none fw-bold"
                                            style={{ fontSize: '0.75rem' }}
                                        >
                                            <i className="fa-solid fa-trash-can me-1" /> Clear
                                        </button>
                                    )}
                                </div>

                                {/* Quick Presets Bar */}
                                <div className="mb-3">
                                    <span className="text-muted fw-bold text-uppercase d-block mb-2" style={{ fontSize: '0.68rem', letterSpacing: '0.04em' }}>
                                        Quick 9-Slot Presets
                                    </span>
                                    <div className="d-flex gap-2 flex-wrap">
                                        {DROP_PRESETS.map((preset) => (
                                            <button
                                                key={preset.id}
                                                type="button"
                                                onClick={() => handleApplyPreset(preset.fillType)}
                                                className="btn btn-sm btn-light rounded-pill border px-3 py-1 d-flex align-items-center gap-2 hover-shadow shadow-2xs"
                                                style={{ fontSize: '0.75rem' }}
                                            >
                                                <img
                                                    src={preset.icon}
                                                    alt=""
                                                    style={{ width: 16, height: 16, objectFit: 'contain' }}
                                                />
                                                <span className="fw-bold">{preset.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* 9 Slots Visual Grid */}
                                {dropItems.length === 0 ? (
                                    <div className="text-center py-4 bg-light rounded-4 border mb-3">
                                        <i className="fa-solid fa-box-open fs-2 text-secondary mb-2 d-block" />
                                        <span className="text-muted small fw-semibold">
                                            Drop pocket is empty. Pick items from the left or click a preset above.
                                        </span>
                                    </div>
                                ) : (
                                    <div className="row g-2 mb-3">
                                        {dropItems.map((entry) => (
                                            <div key={entry.item.id} className="col-4 col-sm-4">
                                                <div className="p-2 rounded-4 text-center border bg-white position-relative shadow-2xs">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            playSound();
                                                            removeDropItem(entry.item.id);
                                                        }}
                                                        className="btn btn-link p-0 position-absolute top-0 end-0 m-1 text-muted hover-text-danger border-0"
                                                        style={{ fontSize: '0.72rem' }}
                                                        title="Remove"
                                                    >
                                                        <i className="fa-solid fa-xmark" />
                                                    </button>
                                                    <img
                                                        src={entry.item.image || FALLBACK_IMG}
                                                        alt={entry.item.name}
                                                        style={{ width: 40, height: 40, objectFit: 'contain' }}
                                                    />
                                                    <span
                                                        className="d-block fw-bold text-dark text-truncate mt-1"
                                                        style={{ fontSize: '0.72rem' }}
                                                        title={entry.item.name}
                                                    >
                                                        {entry.item.name}
                                                    </span>
                                                    <div className="d-flex align-items-center justify-content-center gap-1 mt-1">
                                                        <button
                                                            type="button"
                                                            className="btn btn-xs btn-light border rounded-circle"
                                                            style={{ width: 18, height: 18, padding: 0 }}
                                                            onClick={() => {
                                                                playSound();
                                                                decreaseDropQuantity(entry.item.id);
                                                            }}
                                                        >
                                                            -
                                                        </button>
                                                        <span className="fw-black text-success" style={{ fontSize: '0.75rem' }}>
                                                            ×{entry.quantity}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            disabled={!canIncreaseDrop}
                                                            className="btn btn-xs btn-light border rounded-circle"
                                                            style={{ width: 18, height: 18, padding: 0 }}
                                                            onClick={() => {
                                                                playSound();
                                                                increaseDropQuantity(entry.item.id);
                                                            }}
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Live Command Box */}
                                <div className="bg-light rounded-4 p-3 border mb-3">
                                    <div className="d-flex align-items-center justify-content-between mb-1">
                                        <span className="text-muted fw-bold text-uppercase" style={{ fontSize: '0.68rem' }}>
                                            In-Game Drop Command Preview
                                        </span>
                                        {dropCommandText && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(dropCommandText).catch(() => { });
                                                    playSound();
                                                }}
                                                className="btn btn-link p-0 text-success fw-bold text-decoration-none"
                                                style={{ fontSize: '0.72rem' }}
                                            >
                                                <i className="fa-solid fa-copy me-1" /> Copy
                                            </button>
                                        )}
                                    </div>

                                    {/* Capacity bar */}
                                    <div className="progress mb-2 rounded-pill" style={{ height: 6 }}>
                                        <div
                                            className={`progress-bar ${totalDropCount >= DROP_MAX ? 'bg-danger' : totalDropCount >= DROP_MAX * 0.8 ? 'bg-warning' : 'bg-success'}`}
                                            style={{ width: `${Math.min(100, (totalDropCount / DROP_MAX) * 100)}%`, transition: 'width 0.3s ease' }}
                                            role="progressbar"
                                            aria-valuenow={totalDropCount}
                                            aria-valuemin={0}
                                            aria-valuemax={DROP_MAX}
                                        />
                                    </div>

                                    {/* Overflow warning */}
                                    {totalDropCount > DROP_MAX && (
                                        <div className="alert alert-warning py-1 px-2 mb-2 rounded-3 d-flex align-items-center gap-2" role="alert" style={{ fontSize: '0.72rem' }}>
                                            <i className="fa-solid fa-triangle-exclamation flex-shrink-0" aria-hidden="true" />
                                            <span className="fw-bold">Too many items! Drop limit is {DROP_MAX} slots — remove {totalDropCount - DROP_MAX} item{totalDropCount - DROP_MAX !== 1 ? 's' : ''}.</span>
                                        </div>
                                    )}

                                    <div className="font-monospace text-dark text-truncate" style={{ fontSize: '0.8rem' }}>
                                        {dropCommandText || '!drop <select items>'}
                                    </div>
                                </div>

                                {/* Dispatch Actions */}
                                <div className="d-flex flex-column gap-2">
                                    {/* PRIMARY DIRECT DROP BUTTON */}
                                    <button
                                        type="button"
                                        disabled={totalDropCount === 0 || isDropping || !selectedDropIsland}
                                        onClick={handleDirectDrop}
                                        className="btn btn-success text-white rounded-pill fw-black py-3 shadow-sm d-flex align-items-center justify-content-center gap-2 hover-scale transition-all"
                                        style={{
                                            fontSize: '0.96rem',
                                            background: 'linear-gradient(135deg, #10b981, #059669)',
                                            border: 'none',
                                        }}
                                    >
                                        {isDropping ? (
                                            <>
                                                <span className="spinner-border spinner-border-sm me-1" />
                                                <span>Dropping to {selectedDropIsland?.name || 'Island'}…</span>
                                            </>
                                        ) : (
                                            <>
                                                <i className="fa-solid fa-parachute-box fa-lg text-warning" />
                                                <span>
                                                    Drop {totalDropCount} Item{totalDropCount !== 1 ? 's' : ''} to {selectedDropIsland?.name || 'Island'} Now
                                                </span>
                                            </>
                                        )}
                                    </button>

                                    <button
                                        type="button"
                                        disabled={totalDropCount === 0}
                                        onClick={() => handleCopyCommand(dropCommandText, '!drop command')}
                                        className="btn btn-outline-secondary rounded-pill fw-bold py-1.5 d-flex align-items-center justify-content-center gap-2 border"
                                        style={{ fontSize: '0.8rem' }}
                                    >
                                        <i className="fa-solid fa-copy" /> Copy Command
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Quick Variant Modal */}
            {variantModalItem && (
                <CommandBuilderVariantModal
                    item={variantModalItem}
                    isOpen={!!variantModalItem}
                    onClose={() => setVariantModalItem(null)}
                    onOpenFullDetail={() => { }}
                    showOrder={false}
                    mode="drop-only"
                    addItemToDropPockets={addItemToDropPockets}
                    decreaseDropQuantity={decreaseDropQuantity}
                    increaseDropQuantity={increaseDropQuantity}
                    totalDropCount={totalDropCount}
                    canIncreaseDrop={canIncreaseDrop}
                    getDropPocketQuantity={getDropPocketQuantity}
                    isFavorite={isFavorite(variantModalItem.id)}
                    onToggleFavorite={(id) => toggleFavorite(id)}
                />
            )}

            {/* Sub Rules Modal (One-time only for Sub members) */}
            {showSubRulesModal && (
                <SubRulesModal
                    isOpen={showSubRulesModal}
                    onClose={() => {
                        setShowSubRulesModal(false);
                        setPendingDodoIsland(null);
                    }}
                    onAccept={handleSubRulesAccepted}
                />
            )}

            {/* Error Popup with direct Profile link if character is missing */}
            {revealPopupError && (
                <RevealErrorPopup
                    message={revealPopupError}
                    onClose={() => setRevealPopupError(null)}
                />
            )}
        </div>
    );
};

export default DropBot;
