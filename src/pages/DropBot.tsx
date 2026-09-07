import React, { useState, useMemo, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { getAuthToken } from '../context/authToken';
import { useIslandData } from '../context/useIslandData';
import { type IslandData } from '../data/islands';
import { useCommandBuilderPockets, type PocketItem } from '../hooks/useCommandBuilderPockets';
import { useCatalogData } from '../hooks/useCatalogData';
import { useFavorites } from '../hooks/useFavorites';
import { DROP_MAX } from '../constants/limits';
import { playChimeClick } from '../utils/kkAudioSynthesizer';
import { DODO_API_BASE } from '../config/api';
import { CommandBuilderVariantModal } from '../components/command-builder/CommandBuilderVariantModal';
import { DropBotHouseGrid } from '../components/drop/DropBotHouseGrid';
import type { CatalogEntity } from '../data/commandBuilderData';
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
    const { user, login } = useAuth();
    const { islands, loading: islandsLoading } = useIslandData();
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
        addItemToOrderPockets,
        decreaseOrderQuantity,
        increaseOrderQuantity,
        totalOrderCount,
        canIncreaseOrder,
        getOrderPocketQuantity,
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

    // ── Quick Variant Modal State ──
    const [variantModalItem, setVariantModalItem] = useState<PocketItem | null>(null);

    // ── Destination Sub Island State ──
    const [dropFilter, setDropFilter] = useState<'all' | 'unlocked'>('all');
    const [selectedDropIsland, setSelectedDropIsland] = useState<IslandData | null>(null);
    const [dropDodoCode, setDropDodoCode] = useState<string | null>(null);
    const [dropDodoLoading, setDropDodoLoading] = useState(false);
    const [dropDodoError, setDropDodoError] = useState<string | null>(null);
    const [alreadyOnIsland, setAlreadyOnIsland] = useState(false);

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

    // Filter Sub Member Islands
    const subMemberIslands = useMemo(() => {
        return islands.filter(
            (i) => i.cat === 'member' || i.type?.toLowerCase().includes('sub')
        );
    }, [islands]);

    // Check if user has permission for an island
    const canAccessIsland = (requiredRoles?: string[]) => {
        if (!requiredRoles || requiredRoles.length === 0) return true;
        if (!user || !user.roles) return false;
        return requiredRoles.some((role) => user.roles.includes(role));
    };

    const availableDropIslands = useMemo(() => {
        if (dropFilter === 'unlocked' && user) {
            return subMemberIslands.filter((i) => canAccessIsland(i.requiredRoles));
        }
        return subMemberIslands;
    }, [subMemberIslands, dropFilter, user]);

    // Auto-select first accessible island
    useEffect(() => {
        if (!selectedDropIsland && subMemberIslands.length > 0) {
            const firstAccessible =
                subMemberIslands.find((i) => !!user && canAccessIsland(i.requiredRoles)) ||
                subMemberIslands[0];
            setSelectedDropIsland(firstAccessible);
        }
    }, [subMemberIslands, user, selectedDropIsland]);

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
        setDropDodoLoading(true);
        setDropDodoError(null);
        playSound();

        try {
            const token = getAuthToken();
            const resp = await fetch(
                `${DODO_API_BASE}/api/islands/${encodeURIComponent(island.name)}/dodo`,
                {
                    method: 'POST',
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                    credentials: 'include',
                }
            );

            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                if (resp.status === 401) {
                    setDropDodoError('Your login session expired. Please log in again.');
                    return;
                }
                if (resp.status === 403) {
                    setDropDodoError(
                        err.error || "You do not have access to this Sub Member island's Dodo code."
                    );
                    return;
                }
                setDropDodoError(err.error || 'Unable to retrieve Dodo code.');
                return;
            }

            const data = await resp.json();
            const rawCode = String(data.dodo_code || '');
            const code = rawCode.split(': ').pop() || rawCode;
            setDropDodoCode(code);
        } catch (e) {
            console.error(e);
            setDropDodoError('Network error while retrieving Dodo code. Please try again.');
        } finally {
            setDropDodoLoading(false);
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

    const getDiscordTargetUrl = (island?: IslandData | null) => {
        return (island as any)?.channel_id
            ? `https://discord.com/channels/729590421478703135/${(island as any).channel_id}`
            : 'https://discord.gg/chopaeng';
    };

    const handleCopyCommand = (command: string, label = 'command') => {
        if (!command) return;
        navigator.clipboard.writeText(command).catch(() => {});
        playSound();
        setSubmissionNotice({
            type: 'success',
            message: `Copied ${label} to clipboard! Paste it into the Discord bot channel.`,
        });
    };

    const handleCopyDiscordDrop = (command?: string, label = '!drop') => {
        const cmd = command || dropCommandText;
        if (!cmd) return;
        navigator.clipboard.writeText(cmd).catch(() => {});
        playSound();
        const targetIsland = selectedDropIsland?.name || 'ChoPaeng';
        setSubmissionNotice({
            type: 'info',
            message: `Copied ${label} for ${targetIsland}! Opening Discord...`,
        });
        setTimeout(() => {
            window.open(getDiscordTargetUrl(selectedDropIsland), '_blank');
        }, 400);
    };

    return (
        <div className="ob-page">
            <Helmet>
                <title>Treasure Island Drop Bot &amp; Villager Injector | ChoPaeng</title>
                <meta
                    name="description"
                    content="Drop up to 9 custom items or inject villagers into House Plots 0–9 instantly on ChoPaeng Sub Member Treasure Islands."
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
                                    Max {DROP_MAX} Slots · House Plots 0–9
                                </span>
                            </div>
                            <h1 className="h3 fw-black text-dark mb-1" style={{ fontFamily: 'var(--font-heading, "Nunito", sans-serif)' }}>
                                Treasure Island Drop Bot
                            </h1>
                            <p className="text-muted mb-0" style={{ fontSize: '0.88rem' }}>
                                Choose up to 9 items or assign villagers to island plots (0 to 9) for live delivery on your Sub Island.
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
                                className={`fa-solid ${
                                    submissionNotice.type === 'success'
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
                                    className={`btn rounded-pill fw-black px-3 py-2 transition-all d-flex align-items-center gap-2 ${
                                        activeTab === 'items'
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
                                    className={`btn rounded-pill fw-black px-3 py-2 transition-all d-flex align-items-center gap-2 ${
                                        activeTab === 'favorites'
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
                                    className={`btn rounded-pill fw-black px-3 py-2 transition-all d-flex align-items-center gap-2 ${
                                        activeTab === 'villagers'
                                            ? 'btn-success text-white shadow-2xs'
                                            : 'btn-light text-muted border-0'
                                    }`}
                                    style={{ fontSize: '0.82rem' }}
                                >
                                    <i className="fa-solid fa-house-chimney text-info" />
                                    <span>Villagers (Plots 0–9)</span>
                                </button>
                            </div>

                            {/* ── TAB 1: ITEMS ── */}
                            {activeTab === 'items' && (
                                <div>
                                    {/* Search & Category Filter */}
                                    <div className="row g-2 mb-3">
                                        <div className="col-12 col-sm-7">
                                            <div className="position-relative">
                                                <i className="fa-solid fa-magnifying-glass position-absolute top-50 start-0 translate-middle-y ms-3 text-muted" />
                                                <input
                                                    type="text"
                                                    value={itemSearch}
                                                    onChange={(e) => {
                                                        setItemSearch(e.target.value);
                                                        setItemPage(1);
                                                    }}
                                                    placeholder="Search drop items…"
                                                    className="form-control form-control-sm rounded-pill ps-5 py-2 border shadow-2xs"
                                                    style={{ fontSize: '0.85rem' }}
                                                />
                                            </div>
                                        </div>
                                        <div className="col-12 col-sm-5">
                                            <select
                                                value={selectedCategory}
                                                onChange={(e) => {
                                                    setSelectedCategory(e.target.value);
                                                    setItemPage(1);
                                                }}
                                                className="form-select form-select-sm rounded-pill py-2 border shadow-2xs fw-bold"
                                                style={{ fontSize: '0.82rem' }}
                                            >
                                                {itemCategories.map((cat) => (
                                                    <option key={cat} value={cat}>
                                                        {cat}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Item Cards Grid */}
                                    {catalogLoading ? (
                                        <div className="text-center py-5 text-muted">
                                            <span className="spinner-border spinner-border-sm text-success me-2" />
                                            <span>Loading items…</span>
                                        </div>
                                    ) : paginatedItems.length === 0 ? (
                                        <div className="text-center py-5 text-muted">
                                            <i className="fa-solid fa-box-open fs-2 mb-2 d-block text-secondary" />
                                            <span>No items match your search.</span>
                                        </div>
                                    ) : (
                                        <div className="row g-2">
                                            {paginatedItems.map((item) => {
                                                const inDrop = getDropPocketQuantity(item.id);
                                                const hasVariants =
                                                    Array.isArray(item.variations) &&
                                                    item.variations.length > 0;

                                                return (
                                                    <div key={item.id} className="col-6 col-sm-4 col-md-3">
                                                        <div
                                                            className={`h-100 p-2 rounded-4 text-center border position-relative transition-all d-flex flex-column justify-content-between ${
                                                                inDrop > 0
                                                                    ? 'bg-success-subtle border-success shadow-2xs'
                                                                    : 'bg-white hover-shadow'
                                                            }`}
                                                            style={{ minHeight: 140 }}
                                                        >
                                                            {/* Favorite button */}
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    playSound();
                                                                    toggleFavorite(item.id);
                                                                }}
                                                                className="btn btn-link p-0 position-absolute top-0 end-0 m-2 text-decoration-none"
                                                                style={{ fontSize: '0.85rem' }}
                                                                title="Toggle favorite"
                                                            >
                                                                <i
                                                                    className={`fa-solid fa-star ${
                                                                        isFavorite(item.id)
                                                                            ? 'text-warning'
                                                                            : 'text-black-50 opacity-25'
                                                                    }`}
                                                                />
                                                            </button>

                                                            {/* Item Visual */}
                                                            <div className="pt-2">
                                                                <img
                                                                    src={item.image || FALLBACK_IMG}
                                                                    alt={item.name}
                                                                    style={{
                                                                        width: 48,
                                                                        height: 48,
                                                                        objectFit: 'contain',
                                                                    }}
                                                                    onError={(e) => {
                                                                        (e.currentTarget as HTMLImageElement).src =
                                                                            FALLBACK_IMG;
                                                                    }}
                                                                />
                                                                <span
                                                                    className="fw-bold text-dark text-truncate d-block mt-1"
                                                                    style={{ fontSize: '0.78rem' }}
                                                                    title={item.name}
                                                                >
                                                                    {item.name}
                                                                </span>
                                                                <span
                                                                    className="badge bg-light text-muted rounded-pill px-2"
                                                                    style={{ fontSize: '0.65rem' }}
                                                                >
                                                                    {item.category || 'Item'}
                                                                </span>
                                                            </div>

                                                            {/* Add / Quantity Button */}
                                                            <div className="mt-2 pt-1 border-top">
                                                                {hasVariants ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            playSound();
                                                                            setVariantModalItem(item);
                                                                        }}
                                                                        className="btn btn-xs btn-outline-success rounded-pill w-100 fw-bold py-1"
                                                                        style={{ fontSize: '0.72rem' }}
                                                                    >
                                                                        Variants {inDrop > 0 && `(${inDrop})`}
                                                                    </button>
                                                                ) : inDrop > 0 ? (
                                                                    <div className="d-flex align-items-center justify-content-between px-1">
                                                                        <button
                                                                            type="button"
                                                                            className="btn btn-xs btn-light border rounded-circle"
                                                                            style={{ width: 20, height: 20, padding: 0 }}
                                                                            onClick={() => {
                                                                                playSound();
                                                                                decreaseDropQuantity(item.id);
                                                                            }}
                                                                        >
                                                                            -
                                                                        </button>
                                                                        <span className="fw-black text-success small">
                                                                            ×{inDrop}
                                                                        </span>
                                                                        <button
                                                                            type="button"
                                                                            disabled={!canIncreaseDrop}
                                                                            className="btn btn-xs btn-light border rounded-circle"
                                                                            style={{ width: 20, height: 20, padding: 0 }}
                                                                            onClick={() => {
                                                                                playSound();
                                                                                increaseDropQuantity(item.id);
                                                                            }}
                                                                        >
                                                                            +
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <button
                                                                        type="button"
                                                                        disabled={totalDropCount >= DROP_MAX}
                                                                        onClick={() => {
                                                                            playSound();
                                                                            addItemToDropPockets(item);
                                                                        }}
                                                                        className="btn btn-xs btn-light border rounded-pill w-100 fw-bold py-1 hover-bg-success"
                                                                        style={{ fontSize: '0.72rem' }}
                                                                    >
                                                                        + Drop
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Pagination */}
                                    {totalItemPages > 1 && (
                                        <div className="d-flex align-items-center justify-content-between mt-3 pt-3 border-top">
                                            <button
                                                type="button"
                                                disabled={itemPage <= 1}
                                                onClick={() => {
                                                    playSound();
                                                    setItemPage((p) => Math.max(1, p - 1));
                                                }}
                                                className="btn btn-sm btn-light rounded-pill px-3 fw-bold"
                                                style={{ fontSize: '0.78rem' }}
                                            >
                                                Previous
                                            </button>
                                            <span className="text-muted small fw-bold">
                                                Page {itemPage} of {totalItemPages}
                                            </span>
                                            <button
                                                type="button"
                                                disabled={itemPage >= totalItemPages}
                                                onClick={() => {
                                                    playSound();
                                                    setItemPage((p) => Math.min(totalItemPages, p + 1));
                                                }}
                                                className="btn btn-sm btn-light rounded-pill px-3 fw-bold"
                                                style={{ fontSize: '0.78rem' }}
                                            >
                                                Next
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── TAB 2: FAVORITES & WISHLIST ── */}
                            {activeTab === 'favorites' && (
                                <div>
                                    <div className="d-flex align-items-center justify-content-between mb-3">
                                        <span className="text-muted small fw-bold">
                                            {favoriteItems.length} Wishlist Items Saved
                                        </span>
                                        {favoriteItems.length > 0 && (
                                            <button
                                                type="button"
                                                disabled={totalDropCount >= DROP_MAX}
                                                onClick={() => {
                                                    playSound();
                                                    let added = 0;
                                                    favoriteItems.forEach((it) => {
                                                        if (totalDropCount + added < DROP_MAX) {
                                                            addItemToDropPockets(it);
                                                            added++;
                                                        }
                                                    });
                                                }}
                                                className="btn btn-sm btn-outline-success rounded-pill fw-bold px-3"
                                                style={{ fontSize: '0.78rem' }}
                                            >
                                                <i className="fa-solid fa-plus me-1" /> Add All to Drop (up to {DROP_MAX})
                                            </button>
                                        )}
                                    </div>

                                    {favoriteItems.length === 0 ? (
                                        <div className="text-center py-5 text-muted">
                                            <i className="fa-solid fa-star fs-1 text-warning mb-2 d-block opacity-50" />
                                            <h3 className="h6 fw-bold text-dark">Your Wishlist is Empty</h3>
                                            <p className="small mb-3">
                                                Click the star icon on any catalog item to save it here for fast 1-click drops.
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    playSound();
                                                    setActiveTab('items');
                                                }}
                                                className="btn btn-sm btn-success rounded-pill px-4 fw-bold shadow-2xs"
                                            >
                                                Browse Catalog
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="row g-2">
                                            {favoriteItems.map((item) => {
                                                const inDrop = getDropPocketQuantity(item.id);
                                                return (
                                                    <div key={item.id} className="col-6 col-sm-4 col-md-3">
                                                        <div className="p-2 rounded-4 text-center border bg-white h-100 d-flex flex-column justify-content-between">
                                                            <div className="pt-2">
                                                                <img
                                                                    src={item.image || FALLBACK_IMG}
                                                                    alt={item.name}
                                                                    style={{
                                                                        width: 48,
                                                                        height: 48,
                                                                        objectFit: 'contain',
                                                                    }}
                                                                />
                                                                <span
                                                                    className="fw-bold text-dark text-truncate d-block mt-1"
                                                                    style={{ fontSize: '0.78rem' }}
                                                                >
                                                                    {item.name}
                                                                </span>
                                                            </div>
                                                            <div className="mt-2 pt-1 border-top">
                                                                <button
                                                                    type="button"
                                                                    disabled={totalDropCount >= DROP_MAX}
                                                                    onClick={() => {
                                                                        playSound();
                                                                        addItemToDropPockets(item);
                                                                    }}
                                                                    className="btn btn-xs btn-light border rounded-pill w-100 fw-bold py-1"
                                                                    style={{ fontSize: '0.72rem' }}
                                                                >
                                                                    {inDrop > 0 ? `In Drop (${inDrop})` : '+ Add to Drop'}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── TAB 3: VILLAGERS ── */}
                            {activeTab === 'villagers' && (
                                <div>
                                    {/* Villager Search */}
                                    <div className="mb-3">
                                        <div className="position-relative">
                                            <i className="fa-solid fa-magnifying-glass position-absolute top-50 start-0 translate-middle-y ms-3 text-muted" />
                                            <input
                                                type="text"
                                                value={villagerSearch}
                                                onChange={(e) => {
                                                    setVillagerSearch(e.target.value);
                                                    setVillagerPage(1);
                                                }}
                                                placeholder="Search villagers by name or personality…"
                                                className="form-control form-control-sm rounded-pill ps-5 py-2 border shadow-2xs"
                                                style={{ fontSize: '0.85rem' }}
                                            />
                                        </div>
                                    </div>

                                    {/* Villagers Cards Grid */}
                                    {catalogLoading ? (
                                        <div className="text-center py-5 text-muted">
                                            <span className="spinner-border spinner-border-sm text-success me-2" />
                                            <span>Loading villagers…</span>
                                        </div>
                                    ) : paginatedVillagers.length === 0 ? (
                                        <div className="text-center py-5 text-muted">
                                            <i className="fa-solid fa-paw fs-2 mb-2 d-block text-secondary" />
                                            <span>No villagers found matching your search.</span>
                                        </div>
                                    ) : (
                                        <div className="row g-2">
                                            {paginatedVillagers.map((v) => {
                                                const isSelected = selectedVillager?.id === v.id;
                                                const isAssigned = Object.values(injectedHouses).some(
                                                    (h) => h?.id === v.id
                                                );

                                                return (
                                                    <div key={v.id} className="col-4 col-sm-3 col-md-3">
                                                        <div
                                                            onClick={() => {
                                                                playSound();
                                                                setSelectedVillager(v);
                                                            }}
                                                            className={`p-2 rounded-4 text-center cursor-pointer transition-all border ${
                                                                isSelected
                                                                    ? 'bg-success-subtle border-2 border-success shadow-sm'
                                                                    : isAssigned
                                                                    ? 'bg-light border-primary-subtle'
                                                                    : 'bg-white hover-shadow'
                                                            }`}
                                                            style={{ cursor: 'pointer', minHeight: 120 }}
                                                        >
                                                            <img
                                                                src={v.image}
                                                                alt={v.name}
                                                                className="rounded-circle border mb-1 bg-white shadow-2xs"
                                                                style={{ width: 44, height: 44, objectFit: 'contain' }}
                                                                onError={(e) => {
                                                                    (e.currentTarget as HTMLImageElement).src =
                                                                        FALLBACK_IMG;
                                                                }}
                                                            />
                                                            <strong
                                                                className="d-block text-dark text-truncate"
                                                                style={{ fontSize: '0.78rem' }}
                                                            >
                                                                {v.name}
                                                            </strong>
                                                            <span
                                                                className="badge bg-light text-muted border rounded-pill"
                                                                style={{ fontSize: '0.62rem' }}
                                                            >
                                                                {v.category || 'Villager'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Pagination */}
                                    {totalVillagerPages > 1 && (
                                        <div className="d-flex align-items-center justify-content-between mt-3 pt-3 border-top">
                                            <button
                                                type="button"
                                                disabled={villagerPage <= 1}
                                                onClick={() => {
                                                    playSound();
                                                    setVillagerPage((p) => Math.max(1, p - 1));
                                                }}
                                                className="btn btn-sm btn-light rounded-pill px-3 fw-bold"
                                                style={{ fontSize: '0.78rem' }}
                                            >
                                                Previous
                                            </button>
                                            <span className="text-muted small fw-bold">
                                                Page {villagerPage} of {totalVillagerPages}
                                            </span>
                                            <button
                                                type="button"
                                                disabled={villagerPage >= totalVillagerPages}
                                                onClick={() => {
                                                    playSound();
                                                    setVillagerPage((p) => Math.min(totalVillagerPages, p + 1));
                                                }}
                                                className="btn btn-sm btn-light rounded-pill px-3 fw-bold"
                                                style={{ fontSize: '0.78rem' }}
                                            >
                                                Next
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ══════════════════════════════════════════
                        RIGHT COLUMN: 9-SLOT DROP GRID OR HOUSE PLOTS (0-9)
                    ══════════════════════════════════════════ */}
                    <div className="col-12 col-lg-5">
                        {/* ── STEP 1: DESTINATION SUB ISLAND SELECTOR (ALWAYS VISIBLE) ── */}
                        <div className="bg-white rounded-4 border border-light p-3 p-md-4 shadow-sm mb-4">
                            <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom flex-wrap gap-2">
                                <div className="d-flex align-items-center gap-2">
                                    <div
                                        className="rounded-circle d-flex align-items-center justify-content-center text-white"
                                        style={{ width: 34, height: 34, background: '#f59e0b', fontSize: '0.95rem' }}
                                    >
                                        <i className="fa-solid fa-crown" />
                                    </div>
                                    <div>
                                        <h3 className="h6 fw-bold mb-0 text-dark">Destination Sub Island</h3>
                                        <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                                            Select where to drop items or inject villagers
                                        </span>
                                    </div>
                                </div>

                                <div className="d-flex gap-1 bg-light p-1 rounded-pill border">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            playSound();
                                            setDropFilter('all');
                                        }}
                                        className={`btn btn-xs rounded-pill fw-bold px-2 py-1 ${
                                            dropFilter === 'all'
                                                ? 'btn-dark text-white'
                                                : 'text-muted border-0 bg-transparent'
                                        }`}
                                        style={{ fontSize: '0.72rem' }}
                                    >
                                        All ({subMemberIslands.length})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            playSound();
                                            setDropFilter('unlocked');
                                        }}
                                        className={`btn btn-xs rounded-pill fw-bold px-2 py-1 ${
                                            dropFilter === 'unlocked'
                                                ? 'btn-dark text-white'
                                                : 'text-muted border-0 bg-transparent'
                                        }`}
                                        style={{ fontSize: '0.72rem' }}
                                    >
                                        My Islands
                                    </button>
                                </div>
                            </div>

                            {/* Non-subscriber Notice */}
                            {(!user ||
                                subMemberIslands.every((i) => !user || !canAccessIsland(i.requiredRoles))) && (
                                <div className="alert alert-warning rounded-4 border-0 p-3 mb-3 d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-2 shadow-2xs">
                                    <span className="small fw-bold text-dark">
                                        {user
                                            ? 'Sub Member pass required for in-island drops.'
                                            : 'Log in with Discord to access Sub Islands.'}
                                    </span>
                                    {user ? (
                                        <Link
                                            to="/membership"
                                            className="btn btn-xs btn-dark rounded-pill fw-bold px-3 py-1 text-nowrap"
                                        >
                                            View Tiers
                                        </Link>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={login}
                                            className="btn btn-xs btn-dark rounded-pill fw-bold px-3 py-1 text-nowrap"
                                        >
                                            <i className="fa-brands fa-discord me-1" /> Log In
                                        </button>
                                    )}
                                </div>
                            )}

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
                                            setDropDodoCode(null);
                                            setDropDodoError(null);
                                            setAlreadyOnIsland(false);
                                            playSound();
                                        }}
                                    >
                                        <option value="">-- Choose Sub Island --</option>
                                        {availableDropIslands.map((isl) => (
                                            <option key={isl.id} value={isl.id}>
                                                {isl.name} · {isl.type || 'Treasure Island'}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Dodo / Presence Actions */}
                            {selectedDropIsland && (
                                <div className="d-flex align-items-center gap-2 flex-wrap">
                                    {dropDodoCode || (selectedDropIsland.dodoCode && selectedDropIsland.dodoCode !== "SUB ONLY" && selectedDropIsland.dodoCode !== "GETTIN'") ? (
                                        <div
                                            className="badge bg-success text-white rounded-pill fw-bold px-3 py-1.5 shadow-2xs d-inline-flex align-items-center gap-1.5 font-monospace"
                                            style={{ fontSize: '0.82rem' }}
                                        >
                                            <i className="fa-solid fa-plane-departure" />
                                            <span>Dodo: {dropDodoCode || selectedDropIsland.dodoCode}</span>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            disabled={dropDodoLoading}
                                            onClick={() => handleGetDodo(selectedDropIsland)}
                                            className="btn btn-sm btn-warning text-dark rounded-pill fw-bold px-3 py-1 shadow-2xs"
                                            style={{ fontSize: '0.78rem' }}
                                        >
                                            {dropDodoLoading ? (
                                                <>
                                                    <span className="spinner-border spinner-border-sm me-1" /> Fetching Dodo…
                                                </>
                                            ) : (
                                                <>
                                                    <i className="fa-solid fa-eye me-1" /> Reveal Dodo Code
                                                </>
                                            )}
                                        </button>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => {
                                            playSound();
                                            setAlreadyOnIsland(true);
                                        }}
                                        className={`btn btn-sm rounded-pill fw-bold px-3 py-1 transition-all ${
                                            alreadyOnIsland
                                                ? 'btn-success text-white'
                                                : 'btn-outline-dark'
                                        }`}
                                        style={{ fontSize: '0.78rem' }}
                                    >
                                        <i className="fa-solid fa-location-dot me-1" />
                                        <span>{alreadyOnIsland ? 'On Island (Confirmed)' : "I'm on the Island"}</span>
                                    </button>
                                </div>
                            )}

                            {dropDodoError && (
                                <div className="text-danger small mt-2 fw-semibold">
                                    <i className="fa-solid fa-circle-exclamation me-1" />
                                    {dropDodoError}
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
                                onCopyAndOpenDiscord={handleCopyDiscordDrop}
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
                                            In-Game Drop Command
                                        </span>
                                        {dropCommandText && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(dropCommandText).catch(() => {});
                                                    playSound();
                                                }}
                                                className="btn btn-link p-0 text-success fw-bold text-decoration-none"
                                                style={{ fontSize: '0.72rem' }}
                                            >
                                                <i className="fa-solid fa-copy me-1" /> Copy
                                            </button>
                                        )}
                                    </div>
                                    <div className="font-monospace text-dark text-truncate" style={{ fontSize: '0.8rem' }}>
                                        {dropCommandText || '!drop <select items>'}
                                    </div>
                                </div>

                                {/* Dispatch Actions */}
                                <div className="d-flex flex-column gap-2">
                                    <button
                                        type="button"
                                        disabled={totalDropCount === 0}
                                        onClick={() => handleCopyDiscordDrop(dropCommandText, '!drop')}
                                        className="btn btn-success text-white rounded-pill fw-bold py-2.5 shadow-2xs d-flex align-items-center justify-content-center gap-2"
                                        style={{ fontSize: '0.88rem' }}
                                    >
                                        <i className="fa-brands fa-discord" /> Copy !drop &amp; Open Discord
                                    </button>

                                    <button
                                        type="button"
                                        disabled={totalDropCount === 0}
                                        onClick={() => handleCopyCommand(dropCommandText, '!drop command')}
                                        className="btn btn-outline-dark rounded-pill fw-bold py-2 d-flex align-items-center justify-content-center gap-2"
                                        style={{ fontSize: '0.82rem' }}
                                    >
                                        <i className="fa-solid fa-copy" /> Copy Command Only
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
                    onOpenFullDetail={() => {}}
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
                    getOrderPocketQuantity={getOrderPocketQuantity}
                    getDropPocketQuantity={getDropPocketQuantity}
                    isFavorite={isFavorite(variantModalItem.id)}
                    onToggleFavorite={(id) => toggleFavorite(id)}
                />
            )}
        </div>
    );
};

export default DropBot;
