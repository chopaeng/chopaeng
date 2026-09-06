import { useMemo, useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { type IslandData, type IslandCategory, type IslandStatus } from "../data/islands";
import { useIslandData } from "../context/useIslandData";
import { useAuth } from "../context/useAuth";
import { getAuthToken } from "../context/authToken";
import { useFavoriteIslands } from "../hooks/useFavoriteIslands";
import { ACNH_FINDER_API_BASE, DODO_API_BASE } from "../config/api";
import RevealErrorPopup from "../components/RevealErrorPopup";
import DisclaimerBanner from "../components/DisclaimerBanner";
import { HowItWorksExplainer, TREASURE_ISLANDS_EXPLAINER_CONFIG } from "../components/HowItWorksExplainer";
import { playChimeClick } from "../utils/kkAudioSynthesizer";
import { openCommunityModal } from "../utils/communityPresenceApi";

type SearchMode = "FILTER" | "ITEM" | "VILLAGER";
type FilterKey = "ALL" | IslandCategory | "favorites";
type SortOption = "DEFAULT" | "VISITORS_ASC" | "VISITORS_DESC" | "NAME_ASC";

interface FinderResponse {
    found: boolean;
    query: string;
    results?: {
        free: string[];
        sub: string[];
        order?: string[];
    };
}

interface FilterTab {
    key: FilterKey;
    label: string;
    icon: string;
}

interface StatusMeta {
    dotClass: string;
    textClass: string;
    badgeClass: string;
    btn: {
        className: string;
        text: string;
        icon: string | null;
        disabled: boolean;
    };
    cardClass: string;
    aria: string;
}

const FILTERS: FilterTab[] = [
    { key: "ALL", label: "All Islands", icon: "fa-globe" },
    { key: "favorites", label: "Favorites", icon: "fa-star text-warning" },
    { key: "public", label: "Public", icon: "fa-lock-open" },
    { key: "member", label: "Sub Member", icon: "fa-crown text-warning" },
    { key: "order", label: "Order Bot", icon: "fa-box-open text-info" },
];

const STATUS_CONFIG: Record<IslandStatus, StatusMeta> = {
    ONLINE: {
        dotClass: "bg-success pulse-ring",
        textClass: "text-success",
        badgeClass: "bg-success-subtle text-success border-success-subtle",
        btn: { className: "btn-nook", text: "REVEAL CODE", icon: "fa-eye", disabled: false },
        cardClass: "border-success-subtle shadow-sm",
        aria: "Online",
    },
    "SUB ONLY": {
        dotClass: "bg-warning",
        textClass: "text-warning",
        badgeClass: "bg-warning-subtle text-warning-emphasis border-warning-subtle",
        btn: { className: "btn-sub", text: "SUB ONLY", icon: "fa-lock", disabled: false },
        cardClass: "border-warning-subtle shadow-sm",
        aria: "Subscriber only",
    },
    REFRESHING: {
        dotClass: "bg-secondary",
        textClass: "text-muted",
        badgeClass: "bg-secondary-subtle text-secondary border-secondary-subtle",
        btn: { className: "btn-disabled", text: "REFRESHING...", icon: "fa-arrows-rotate", disabled: true },
        cardClass: "opacity-75 grayscale-sm border-light",
        aria: "Refreshing",
    },
    OFFLINE: {
        dotClass: "bg-danger",
        textClass: "text-danger",
        badgeClass: "bg-danger-subtle text-danger border-danger-subtle",
        btn: { className: "btn-disabled", text: "OFFLINE", icon: "fa-power-off", disabled: true },
        cardClass: "opacity-60 grayscale border-light",
        aria: "Offline",
    },
};

const isPublicIsland = (island: IslandData) =>
    island.cat === "public" && (island.requiredRoles?.length ?? 0) === 0;

const isOrderIsland = (island: IslandData) => island.cat === "order";

const TreasureIslands = () => {
    const navigate = useNavigate();
    const { islands, loading } = useIslandData();
    const { user, login, canAccessIsland } = useAuth();
    const { isFavoriteIsland, toggleFavoriteIsland } = useFavoriteIslands();

    const [filter, setFilter] = useState<FilterKey>("ALL");
    const [sortBy, setSortBy] = useState<SortOption>("DEFAULT");
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [revealedCodes, setRevealedCodes] = useState<Record<string, string>>({});
    const [revealingId, setRevealingId] = useState<string | null>(null);
    const [revealError, setRevealError] = useState<string | null>(null);
    const [selectedMap, setSelectedMap] = useState<IslandData | null>(null);
    const revealingIdsRef = useRef<Set<string>>(new Set());
    const lastRevealTimestamps = useRef<Map<string, number>>(new Map());

    const [search, setSearch] = useState<string>("");
    const [searchMode, setSearchMode] = useState<SearchMode>("FILTER");
    const [isFinderLoading, setIsFinderLoading] = useState(false);
    const [finderResults, setFinderResults] = useState<string[] | null>(null);
    const [lastQuery, setLastQuery] = useState("");

    // Telemetry stats
    const stats = useMemo(() => {
        const total = islands.length;
        const online = islands.filter(i => i.status === "ONLINE" || !i.status).length;
        const publicCount = islands.filter(isPublicIsland).length;
        const memberCount = islands.filter(i => i.cat === "member").length;
        const totalVisitors = islands.reduce((acc, curr) => acc + (curr.visitors || 0), 0);
        return { total, online, publicCount, memberCount, totalVisitors };
    }, [islands]);

    // Count map for filter tabs
    const filterCounts = useMemo(() => {
        const counts: Record<FilterKey, number> = {
            ALL: islands.length,
            favorites: islands.filter(i => isFavoriteIsland(i.id) || isFavoriteIsland(i.name)).length,
            public: islands.filter(isPublicIsland).length,
            member: islands.filter(i => i.cat === "member").length,
            order: islands.filter(isOrderIsland).length,
        };
        return counts;
    }, [islands, isFavoriteIsland]);

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") setSelectedMap(null);
        };
        window.addEventListener("keydown", handleEsc);
        return () => window.removeEventListener("keydown", handleEsc);
    }, []);

    const executeFinderSearch = async () => {
        if (!search.trim()) return;

        setIsFinderLoading(true);
        setLastQuery(search);
        setFinderResults(null);

        try {
            const endpoint = searchMode === 'ITEM' ? 'find' : 'villager';
            const response = await fetch(`${ACNH_FINDER_API_BASE}/api/${endpoint}?q=${encodeURIComponent(search)}`);
            if (!response.ok) throw new Error("Search failed");

            const data: FinderResponse = await response.json();

            if (data.found && data.results) {
                const allFound = [...(data.results.free || []), ...(data.results.sub || []), ...(data.results.order || [])].map(n => n.toUpperCase());
                setFinderResults(allFound);
            } else {
                setFinderResults([]);
            }
        } catch (error) {
            console.error(error);
            setFinderResults([]);
        } finally {
            setIsFinderLoading(false);
        }
    };

    const filteredData = useMemo(() => {
        let data = [...islands];

        if (filter === "favorites") {
            data = data.filter((island) => isFavoriteIsland(island.id) || isFavoriteIsland(island.name));
        } else if (filter !== "ALL") {
            data = data.filter((island) => island.cat === filter.toLowerCase());
        }

        if (searchMode === "FILTER") {
            const q = search.trim().toLowerCase();
            if (q) {
                data = data.filter((island) =>
                    island.name.toLowerCase().includes(q) ||
                    island.type.toLowerCase().includes(q) ||
                    island.items.some(item => item.toLowerCase().includes(q))
                );
            }
        } else if (finderResults !== null) {
            data = data.filter(island => finderResults.includes(island.name.toUpperCase()));
        }

        // De-duplicate
        const seen = new Set();
        data = data.filter(island => {
            const duplicate = seen.has(island.id);
            seen.add(island.id);
            return !duplicate;
        });

        // Sorting
        if (sortBy === "VISITORS_ASC") {
            data.sort((a, b) => (a.visitors ?? 0) - (b.visitors ?? 0));
        } else if (sortBy === "VISITORS_DESC") {
            data.sort((a, b) => (b.visitors ?? 0) - (a.visitors ?? 0));
        } else if (sortBy === "NAME_ASC") {
            data.sort((a, b) => a.name.localeCompare(b.name));
        }

        return data;
    }, [filter, search, islands, searchMode, finderResults, sortBy, isFavoriteIsland]);

    const onCopyCode = (island: IslandData, code: string) => {
        if (code === "GETTIN'" || code === "....." || code === "SUB ONLY") return;
        navigator.clipboard.writeText(code).catch(() => {});
        playChimeClick();
        setCopiedId(island.name);
        setTimeout(() => setCopiedId(null), 2500);
    };

    const onRevealCode = async (island: IslandData) => {
        setRevealError(null);
        // Free islands do not require reveal/auth; copy the live code directly.
        if (isPublicIsland(island)) {
            if (island.dodoCode) onCopyCode(island, island.dodoCode);
            else setRevealError("No live dodo code available right now.");
            return;
        }
        // Already revealed — just copy
        if (revealedCodes[island.id]) {
            onCopyCode(island, revealedCodes[island.id]);
            return;
        }
        // Not logged in — send to Discord OAuth
        if (!user) {
            login();
            return;
        }
        // Debounce: ignore rapid re-reveals within 2 seconds per island
        const now = Date.now();
        const lastReveal = lastRevealTimestamps.current.get(island.id) ?? 0;
        if (now - lastReveal < 2000) return;
        if (revealingIdsRef.current.has(island.id)) return;

        // Fetch dodo code from backend
        lastRevealTimestamps.current.set(island.id, now);
        revealingIdsRef.current.add(island.id);
        setRevealingId(island.id);
        try {
            const token = getAuthToken();
            const resp = await fetch(`${DODO_API_BASE}/api/islands/${encodeURIComponent(island.name)}/dodo`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                credentials: "include",
            });
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                if (resp.status === 401) {
                    setRevealError("Your login expired. Please login again.");
                    return;
                }
                if (resp.status === 403) {
                    const backendMessage = String(err.error || "");
                    setRevealError(backendMessage || "You do not have access to this island's dodo code.");
                    return;
                }
                if (resp.status === 404) {
                    setRevealError("Dodo code is not available right now. Please try again shortly.");
                    return;
                }
                setRevealError(err.error || "Unable to reveal dodo code right now.");
                console.error("Dodo reveal failed:", err);
                return;
            }
            const data = await resp.json();
            const rawCode = String(data.dodo_code || "");
            const code = rawCode.split(": ").pop() || rawCode;
            setRevealedCodes(prev => ({ ...prev, [island.id]: code }));
            navigator.clipboard.writeText(code).catch(() => {});
            playChimeClick();
            setCopiedId(island.name);
            setTimeout(() => setCopiedId(null), 2500);
            setRevealError(null);
        } catch (e) {
            console.error(e);
            setRevealError("Network error while revealing dodo code. Please try again.");
        } finally {
            revealingIdsRef.current.delete(island.id);
            setRevealingId(prev => prev === island.id ? null : prev);
        }
    };

    const handleModeSwitch = (mode: SearchMode) => {
        setSearchMode(mode);
        setSearch("");
        setFinderResults(null);
        setLastQuery("");
        playChimeClick();
    };

    useEffect(() => {
        if (search === "" && searchMode !== "FILTER") {
            setFinderResults(null);
        }
    }, [search, searchMode]);

    useEffect(() => {
        const site = window.location.origin;
        const url = `${site}/islands`;
        const img = `${site}/banner.png`;

        const title =
            filter === "ALL"
                ? "ACNH Treasure Islands - Live Dodo Codes & Free Maps | Chopaeng"
                : filter === "public"
                    ? "Free ACNH Treasure Islands - Live Dodo Codes & Maps | Chopaeng"
                    : "VIP ACNH Treasure Islands - Private Islands & Priority Access | Chopaeng";

        const desc =
            filter === "ALL"
                ? "Browse all live Animal Crossing: New Horizons treasure islands on Chopaeng. Get real-time Dodo codes, free & premium island access, items, DIYs, and more."
                : filter === "public"
                    ? "Browse free Animal Crossing: New Horizons treasure islands on Chopaeng. Get live Dodo codes, free island access, items, DIYs, Bells, and materials."
                    : "Access VIP Animal Crossing: New Horizons treasure islands on Chopaeng. Unlock priority Dodo codes, private islands, exclusive items, and member perks.";

        document.title = title;

        const setMeta = (attr: string, key: string, value: string) => {
            let el = document.querySelector(`meta[${attr}="${key}"]`);
            if (!el) {
                el = document.createElement("meta");
                el.setAttribute(attr, key);
                document.head.appendChild(el);
            }
            el.setAttribute("content", value);
        };

        const setLink = (rel: string, href: string) => {
            let el = document.querySelector(`link[rel="${rel}"]`);
            if (!el) {
                el = document.createElement("link");
                el.setAttribute("rel", rel);
                document.head.appendChild(el);
            }
            el.setAttribute("href", href);
        };

        setMeta("name", "description", desc);
        setMeta("name", "keywords", "ACNH treasure islands, Animal Crossing New Horizons treasure island, treasure island ACNH, ACNH dodo codes, community ACNH items, Animal Crossing treasure island dodo code, ACNH bells, ACNH villagers, ACNH DIYs, Animal Crossing cataloging");
        setLink("canonical", url);

        setMeta("property", "og:type", "website");
        setMeta("property", "og:site_name", "Chopaeng");
        setMeta("property", "og:url", url);
        setMeta("property", "og:title", title);
        setMeta("property", "og:description", desc);
        setMeta("property", "og:image", img);

        setMeta("name", "twitter:card", "summary_large_image");
        setMeta("name", "twitter:title", title);
        setMeta("name", "twitter:description", desc);
        setMeta("name", "twitter:image", img);
    }, [filter]);

    return (
        <div className="nook-bg min-vh-100 font-nunito pb-5">
            <script type="application/ld+json" dangerouslySetInnerHTML={{
                __html: JSON.stringify({
                    "@context": "https://schema.org",
                    "@type": "ItemList",
                    "name": "ACNH Treasure Islands on Chopaeng",
                    "description": "Browse all Animal Crossing: New Horizons treasure islands on Chopaeng with live Dodo codes, items, DIYs, Bells, and villagers.",
                    "url": "https://www.chopaeng.com/islands",
                    "numberOfItems": islands.length,
                    "itemListElement": islands.map((island, index) => ({
                        "@type": "ListItem",
                        "position": index + 1,
                        "name": `${island.name} ACNH Treasure Island`,
                        "url": `https://www.chopaeng.com/island/${island.id}`
                    }))
                })
            }} />

            {/* ════════════════ AIRPORT TERMINAL LIVE MONITOR HEADER ════════════════ */}
            <div className="bg-white shadow-sm border-bottom position-relative z-3">
                <div className="container py-4">
                    <div className="row align-items-center gy-4">
                        
                        {/* Title & Live Status */}
                        <div className="col-lg-5 text-center text-lg-start">
                            <div className="d-inline-flex align-items-center gap-2 mb-2 px-3 py-1 rounded-pill bg-light border">
                                <span className="live-dot bg-success rounded-circle" style={{ width: '8px', height: '8px' }}></span>
                                <span className="text-success fw-bold x-small text-uppercase tracking-wider">
                                    Dodo Airlines Live Radar
                                </span>
                            </div>
                            <h1 className="ac-font h2 text-dark mb-1 d-flex align-items-center justify-content-center justify-content-lg-start gap-2">
                                <i className="fa-solid fa-plane-departure text-nook"></i>
                                Island Monitor
                            </h1>
                            <p className="text-muted small fw-bold mb-0">
                                Real-time Dodo Codes, interactive island maps, and live inventory finder.
                            </p>
                        </div>

                        {/* Search & Mode Switcher */}
                        <div className="col-lg-7">
                            <div className="d-flex flex-column flex-sm-row gap-2 justify-content-lg-end">
                                
                                {/* Search Mode Tabs */}
                                <div className="bg-light rounded-pill p-1 d-flex border shadow-2xs">
                                    {(['FILTER', 'ITEM', 'VILLAGER'] as SearchMode[]).map((m) => (
                                        <button
                                            key={m}
                                            type="button"
                                            onClick={() => handleModeSwitch(m)}
                                            className={`btn btn-sm rounded-pill fw-bold px-3 transition-all d-flex align-items-center gap-1 ${
                                                searchMode === m ? "btn-dark text-white shadow-2xs" : "text-muted border-0"
                                            }`}
                                            style={{ fontSize: '0.78rem' }}
                                        >
                                            {m === 'FILTER' ? (
                                                <><i className="fa-solid fa-magnifying-glass small"></i> Name</>
                                            ) : m === 'ITEM' ? (
                                                <><i className="fa-solid fa-leaf text-success small"></i> Item</>
                                            ) : (
                                                <><i className="fa-solid fa-cat text-info small"></i> Villager</>
                                            )}
                                        </button>
                                    ))}
                                </div>

                                {/* Search Input Bar */}
                                <div className="input-group rounded-pill overflow-hidden border shadow-2xs focus-within-green flex-grow-1" style={{ maxWidth: '420px' }}>
                                    <span className="input-group-text bg-white border-0 ps-3">
                                        {isFinderLoading ? (
                                            <i className="fa-solid fa-circle-notch fa-spin text-success" />
                                        ) : (
                                            <i className={`fa-solid ${
                                                searchMode === 'VILLAGER' ? 'fa-user-tag text-info' : 
                                                searchMode === 'ITEM' ? 'fa-leaf text-success' : 
                                                'fa-magnifying-glass text-muted'
                                            }`} />
                                        )}
                                    </span>
                                    <input
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter' && searchMode !== 'FILTER') executeFinderSearch(); }}
                                        className="form-control border-0 shadow-none fw-bold"
                                        style={{ fontSize: '0.9rem' }}
                                        placeholder={
                                            searchMode === "FILTER" ? "Filter by island name or tag..." : 
                                            searchMode === "ITEM" ? "Search 15,000+ items (e.g. Moon, Crown)..." : 
                                            "Search dreamie villagers (e.g. Raymond, Sasha)..."
                                        }
                                    />
                                    {(searchMode !== "FILTER" && search) && (
                                        <button className="btn btn-nook fw-bold px-3 border-start" onClick={executeFinderSearch}>
                                            Find
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Telemetry Stats Strip */}
                    <div className="row g-2 mt-3 pt-3 border-top text-muted small fw-bold">
                        <div className="col-6 col-md d-flex align-items-center gap-2">
                            <span className="badge bg-success-subtle text-success rounded-circle p-2">
                                <i className="fa-solid fa-tower-broadcast"></i>
                            </span>
                            <div>
                                <span className="d-block text-dark fw-black fs-6 lh-1">{stats.online}/{stats.total}</span>
                                <span className="x-small text-muted">Islands Online</span>
                            </div>
                        </div>

                        <div
                            className="col-6 col-md d-flex align-items-center gap-2 cursor-pointer"
                            onClick={() => {
                                playChimeClick();
                                openCommunityModal('islands');
                            }}
                            role="button"
                            tabIndex={0}
                            title="Click to view full island occupancy radar"
                        >
                            <span className="badge bg-primary-subtle text-primary rounded-circle p-2">
                                <i className="fa-solid fa-plane-arrival"></i>
                            </span>
                            <div>
                                <div className="d-flex align-items-center gap-1">
                                    <span className="text-primary fw-black fs-6 lh-1">{stats.totalVisitors}</span>
                                    <span className="badge bg-primary text-white rounded-pill px-1.5 py-0" style={{ fontSize: '0.6rem' }}>Radar</span>
                                </div>
                                <span className="x-small text-muted">In The Islands</span>
                            </div>
                        </div>

                        <div className="col-6 col-md d-flex align-items-center gap-2">
                            <span className="badge bg-info-subtle text-info rounded-circle p-2">
                                <i className="fa-solid fa-plane"></i>
                            </span>
                            <div>
                                <span className="d-block text-dark fw-black fs-6 lh-1">{stats.publicCount}</span>
                                <span className="x-small text-muted">Public Gates</span>
                            </div>
                        </div>

                        <div className="col-6 col-md d-flex align-items-center gap-2">
                            <span className="badge bg-warning-subtle text-warning rounded-circle p-2">
                                <i className="fa-solid fa-crown"></i>
                            </span>
                            <div>
                                <span className="d-block text-dark fw-black fs-6 lh-1">{stats.memberCount}</span>
                                <span className="x-small text-muted">Sub Member Islands</span>
                            </div>
                        </div>

                        <div
                            className="col-6 col-md d-flex align-items-center gap-2 cursor-pointer"
                            onClick={() => {
                                playChimeClick();
                                openCommunityModal('visits');
                            }}
                            role="button"
                            tabIndex={0}
                            title="Click to view all-time website visits telemetry"
                        >
                            <span className="badge bg-success-subtle text-success rounded-circle p-2">
                                <i className="fa-solid fa-chart-line"></i>
                            </span>
                            <div>
                                <span className="d-block text-dark fw-black fs-6 lh-1">2.8M+</span>
                                <span className="x-small text-muted">Lifetime Visits</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ════════════════ MAIN CONTENT & FILTER BAR ════════════════ */}
            <div className="container py-4">

                {/* ── REUSABLE HOW IT WORKS EXPLAINER ── */}
                <HowItWorksExplainer {...TREASURE_ISLANDS_EXPLAINER_CONFIG} className="mb-4" defaultExpanded={false} />

                {/* Filter Tabs & Sort Controls */}
                <div className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3 mb-4">
                    
                    {/* Category Filter Tabs */}
                    <div className="d-flex align-items-center gap-2 overflow-x-auto pb-2 pb-lg-0 no-scrollbar">
                        {FILTERS.map((t) => {
                            const count = filterCounts[t.key] ?? 0;
                            const isActive = filter === t.key;
                            return (
                                <button
                                    key={t.key}
                                    type="button"
                                    onClick={() => { setFilter(t.key); playChimeClick(); }}
                                    className={`btn rounded-pill px-3 py-2 fw-bold d-flex align-items-center gap-2 border flex-shrink-0 transition-all ${
                                        isActive ? "btn-dark text-white border-dark shadow-sm" : "bg-white text-muted border-white shadow-2xs hover-shadow"
                                    }`}
                                    style={{ fontSize: '0.82rem' }}
                                >
                                    <i className={`fa-solid ${t.icon}`}></i> 
                                    <span>{t.label}</span>
                                    <span className={`badge rounded-pill x-small ${isActive ? 'bg-white text-dark' : 'bg-light text-muted'}`}>
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Sorting Controls */}
                    <div className="d-flex align-items-center gap-2 justify-content-end flex-shrink-0">
                        <label className="text-muted small fw-bold d-none d-sm-inline">Sort by:</label>
                        <select
                            value={sortBy}
                            onChange={(e) => { setSortBy(e.target.value as SortOption); playChimeClick(); }}
                            className="form-select form-select-sm rounded-pill border bg-white shadow-2xs fw-bold px-3 py-1 text-dark"
                            style={{ width: 'auto', fontSize: '0.8rem' }}
                        >
                            <option value="DEFAULT">Default Order</option>
                            <option value="VISITORS_ASC">Least Busy (Lowest Queue)</option>
                            <option value="VISITORS_DESC">Most Active (High Traffic)</option>
                            <option value="NAME_ASC">Alphabetical (A-Z)</option>
                        </select>
                    </div>
                </div>

                {/* Item / Villager Finder Feedback Banner */}
                {searchMode !== "FILTER" && finderResults !== null && (
                    <div className="mb-4 animate-up">
                        {finderResults.length > 0 ? (
                            <div className="alert alert-success border-success d-flex align-items-center justify-content-between gap-3 shadow-sm rounded-4" role="alert">
                                <div className="d-flex align-items-center gap-3">
                                    <i className="fa-solid fa-circle-check fs-4 text-success"></i>
                                    <div>
                                        Found <strong>"{lastQuery}"</strong> on <strong>{finderResults.length}</strong> active islands! 
                                        Cards with items are highlighted below.
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleModeSwitch('FILTER')}
                                    className="btn btn-sm btn-outline-success rounded-pill fw-bold"
                                >
                                    Clear Search
                                </button>
                            </div>
                        ) : (
                            <div className="alert alert-danger border-danger d-flex align-items-center justify-content-between gap-3 shadow-sm rounded-4" role="alert">
                                <div className="d-flex align-items-center gap-3">
                                    <i className="fa-solid fa-circle-xmark fs-4 text-danger"></i>
                                    <div>
                                        Sorry, <strong>"{lastQuery}"</strong> is not on any active treasure island right now. You can order it directly via Order Bot!
                                    </div>
                                </div>
                                <Link to="/order" className="btn btn-sm btn-nook-primary rounded-pill fw-bold">
                                    Use Order Bot
                                </Link>
                            </div>
                        )}
                    </div>
                )}

                {/* Empty State */}
                {!loading && filteredData.length === 0 && (
                    <div className="text-center py-5 bg-white rounded-5 shadow-sm border my-4">
                        <div className="fs-1 mb-3 text-success">
                            <i className="fa-solid fa-map-location-dot"></i>
                        </div>
                        <h3 className="h5 text-dark fw-black ac-font">No islands matching your criteria</h3>
                        <p className="text-muted small fw-bold mb-3">Try adjusting your filters or resetting your search term.</p>
                        <button
                            type="button"
                            onClick={() => { setFilter('ALL'); setSearch(''); setFinderResults(null); }}
                            className="btn btn-nook-primary rounded-pill fw-bold px-4 py-2"
                        >
                            Reset All Filters
                        </button>
                    </div>
                )}

                {/* ════════════════ ISLANDS GRID ════════════════ */}
                <div className="row g-4">
                    {filteredData.map((island) => {
                        const statusMeta = STATUS_CONFIG[island.status] || STATUS_CONFIG["OFFLINE"];
                        const isMatch = finderResults && finderResults.includes(island.name.toUpperCase());
                        const revealedCode = revealedCodes[island.id];
                        const liveCode = island.status === "ONLINE" && island.dodoCode && island.dodoCode.length === 5
                            ? island.dodoCode
                            : null;
                        const isOrder = isOrderIsland(island);
                        const isFreeIsland = isPublicIsland(island);
                        const hasMemberAccess = isFreeIsland
                            ? true
                            : island.accessible ?? island.viewerHasAccess ?? (
                                (island.requiredRoles?.length ?? 0) > 0 && canAccessIsland(island.requiredRoles)
                            );
                        const isRevealableStatus = island.status === "ONLINE" || island.status === "SUB ONLY";
                        const hasInstantCode = isFreeIsland && !!liveCode;
                        const isRevealing = revealingId === island.id;
                        const needsAuth = !isFreeIsland && !user;
                        const lacksAccess = !isFreeIsland && !!user && !hasMemberAccess;

                        // Button state
                        let btnText: string;
                        let btnClass: string;
                        let btnDisabled: boolean;
                        let btnIcon: string | null = statusMeta.btn.icon;

                        if (isOrder) {
                            btnText = island.status === "ONLINE" ? "Order Bot" : statusMeta.btn.text;
                            btnClass = island.status === "ONLINE" ? "btn-sub" : statusMeta.btn.className;
                            btnDisabled = true;
                            btnIcon = island.status === "ONLINE" ? "fa-box-open" : statusMeta.btn.icon;
                        } else if (revealedCode) {
                            btnText = revealedCode;
                            btnClass = "btn-nook";
                            btnDisabled = false;
                            btnIcon = "fa-copy";
                        } else if (hasInstantCode) {
                            btnText = liveCode as string;
                            btnClass = "btn-nook";
                            btnDisabled = false;
                            btnIcon = "fa-copy";
                        } else if (isRevealableStatus && needsAuth) {
                            btnText = "Sub Only";
                            btnClass = "btn-sub";
                            btnDisabled = false;
                            btnIcon = "fa-lock";
                        } else if (isRevealableStatus && lacksAccess) {
                            btnText = "Members Only";
                            btnClass = "btn-sub";
                            btnDisabled = false;
                            btnIcon = "fa-lock";
                        } else if (isRevealableStatus) {
                            btnText = isRevealing ? "LOADING..." : "Show Dodo";
                            btnClass = "btn-nook";
                            btnDisabled = isRevealing;
                            btnIcon = "fa-eye";
                        } else {
                            btnText = statusMeta.btn.text;
                            btnClass = statusMeta.btn.className;
                            btnDisabled = statusMeta.btn.disabled;
                            btnIcon = statusMeta.btn.icon;
                        }

                        const isCopied = copiedId === island.name;
                        const visitors = Math.max(0, Math.min(7, island.visitors ?? 0));
                        const pct = (visitors / 7) * 100;
                        const isFull = visitors >= 7;
                        const mapSrc = island.mapUrl || `https://cdn.chopaeng.com/maps/${island.name.toLowerCase()}.png`;

                        return (
                            <div key={`${island.id}-${island.cat}`} className="col-xl-3 col-lg-4 col-md-6">
                                <div
                                    className={`card h-100 border bg-white rounded-5 transition-all hover-shadow-lg overflow-hidden position-relative ${
                                        isMatch ? "ring-2 ring-warning" : ""
                                    }`}
                                    style={{ cursor: 'pointer' }}
                                    onClick={(e) => {
                                        if ((e.target as HTMLElement).closest("button, a")) return;
                                        navigate(`/island/${island.id}`);
                                    }}
                                >
                                    {isMatch && (
                                        <div className="bg-warning text-dark text-center fw-black small py-1 tracking-wider">
                                            <i className="fa-solid fa-star me-1"></i> MATCH FOUND
                                        </div>
                                    )}

                                    {/* ── CARD MAP BANNER HEADER ── */}
                                    <div className="position-relative bg-dark" style={{ height: '120px', overflow: 'hidden' }}>
                                        <img
                                            src={mapSrc}
                                            alt={`${island.name} Map`}
                                            className="w-100 h-100 object-fit-cover opacity-85 transition-scale"
                                            onError={(e) => {
                                                e.currentTarget.onerror = null;
                                                e.currentTarget.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='%231b2d24'/><text x='50%' y='65%' font-size='40' text-anchor='middle' fill='%2352b788'>MAP</text></svg>";
                                            }}
                                        />
                                        <div className="position-absolute top-0 start-0 w-100 h-100" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.65) 100%)' }}></div>

                                        {/* Floating Status Badge (Top-Left) */}
                                        <div className="position-absolute top-0 start-0 m-3">
                                            <span className={`badge rounded-pill border px-2 py-1 d-inline-flex align-items-center gap-1 shadow-sm ${
                                                island.discordBotOnline ? 'bg-success text-white border-success' : 'bg-danger text-white border-danger'
                                            }`} style={{ fontSize: '0.7rem' }}>
                                                <span className="live-dot bg-white rounded-circle" style={{ width: '6px', height: '6px' }}></span>
                                                {island.discordBotOnline ? "ONLINE" : "OFFLINE"}
                                            </span>
                                        </div>

                                        {/* Floating Action Buttons (Top-Right: Favorite + Map Zoom) */}
                                        <div className="position-absolute top-0 end-0 m-3 d-flex gap-1">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleFavoriteIsland(island.id, e);
                                                    playChimeClick();
                                                }}
                                                className={`btn btn-sm rounded-circle shadow-sm d-flex align-items-center justify-content-center ${
                                                    isFavoriteIsland(island.id) ? "btn-warning text-dark" : "btn-white bg-white text-muted"
                                                }`}
                                                title={isFavoriteIsland(island.id) ? "Remove from Favorites" : "Add to Favorites"}
                                                style={{ width: 30, height: 30 }}
                                            >
                                                <i className={`${isFavoriteIsland(island.id) ? "fa-solid" : "fa-regular"} fa-star small`}></i>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedMap(island);
                                                    playChimeClick();
                                                }}
                                                className="btn btn-sm btn-white bg-white text-muted rounded-circle shadow-sm d-flex align-items-center justify-content-center"
                                                title="View Full High-Res Map"
                                                style={{ width: 30, height: 30 }}
                                            >
                                                <i className="fa-regular fa-map small"></i>
                                            </button>
                                        </div>

                                        {/* Floating Island Theme & Name at Bottom of Banner */}
                                        <div className="position-absolute bottom-0 start-0 w-100 p-3 text-white">
                                            <div className="d-flex align-items-center justify-content-between">
                                                <h3 className="ac-font h4 mb-0 text-white text-truncate shadow-text">{island.name}</h3>
                                                <span className="badge bg-white bg-opacity-25 backdrop-blur rounded-pill x-small fw-bold px-2 py-1 text-white border border-white border-opacity-25">
                                                    {island.seasonal}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* ── CARD BODY ── */}
                                    <div className="card-body p-3 d-flex flex-column h-100">
                                        
                                        {/* Category Pill */}
                                        <div className="d-flex align-items-center justify-content-between mb-2">
                                            <span className={`badge rounded-pill fw-bold x-small px-2 py-1 d-inline-flex align-items-center gap-1 ${
                                                island.cat === 'member' ? 'bg-warning-subtle text-warning-emphasis border border-warning' :
                                                island.cat === 'order' ? 'bg-info-subtle text-info border border-info' :
                                                'bg-success-subtle text-success border border-success'
                                            }`} style={{ fontSize: '0.68rem' }}>
                                                {island.cat === 'member' ? (
                                                    <><i className="fa-solid fa-crown text-warning"></i> SUB MEMBER</>
                                                ) : island.cat === 'order' ? (
                                                    <><i className="fa-solid fa-robot text-info"></i> ORDER BOT</>
                                                ) : (
                                                    <><i className="fa-solid fa-lock-open text-success"></i> PUBLIC</>
                                                )}
                                            </span>

                                            <span className="tiny-text text-muted fw-bold text-truncate" style={{ maxWidth: '120px' }}>
                                                {island.type || 'Treasure Island'}
                                            </span>
                                        </div>

                                        {/* Item Tags Preview */}
                                        <div className="d-flex flex-wrap gap-1 mb-3">
                                            {island.items.slice(0, 3).map((item) => (
                                                <span
                                                    key={item}
                                                    className="badge bg-light text-dark fw-bold border border-light-subtle rounded-pill px-2 py-1 x-small"
                                                    style={{ fontSize: '0.7rem' }}
                                                >
                                                    {item}
                                                </span>
                                            ))}
                                            {island.items.length > 3 && (
                                                <span className="badge bg-light text-muted fw-bold border border-light-subtle rounded-pill px-2 py-1 x-small" style={{ fontSize: '0.7rem' }}>
                                                    +{island.items.length - 3} more
                                                </span>
                                            )}
                                        </div>

                                        {/* Spacer */}
                                        <div className="mt-auto">
                                            
                                            {/* Airport Gate Visitor Meter */}
                                            <div className="mb-3 p-2 bg-light rounded-4 border">
                                                <div className="d-flex justify-content-between align-items-center mb-1">
                                                    <span className="x-small fw-bold text-muted text-uppercase" style={{ fontSize: '0.65rem' }}>
                                                        <i className="fa-solid fa-users me-1 text-muted"></i> Gate Traffic
                                                    </span>
                                                    <span className={`x-small fw-black ${isFull ? 'text-danger' : visitors >= 5 ? 'text-warning' : 'text-success'}`} style={{ fontSize: '0.75rem' }}>
                                                        {isFull ? (
                                                            <><i className="fa-solid fa-circle-exclamation me-1"></i> FULL (7/7)</>
                                                        ) : (
                                                            <><i className="fa-solid fa-plane me-1"></i> {visitors}/7 Flying</>
                                                        )}
                                                    </span>
                                                </div>
                                                <div className="progress rounded-pill bg-white border" style={{ height: '6px' }}>
                                                    <div
                                                        className={`progress-bar rounded-pill ${
                                                            isFull ? 'bg-danger' : visitors >= 5 ? 'bg-warning' : 'bg-success'
                                                        }`}
                                                        style={{ width: `${pct}%`, transition: 'width 0.4s ease' }}
                                                    ></div>
                                                </div>
                                            </div>

                                            {/* Action Button / Order Panel */}
                                            {isOrder ? (
                                                <div
                                                    className="direct-order-box rounded-4 p-3 mb-2"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <div className="d-flex align-items-center gap-2 mb-2">
                                                        <span
                                                            className="direct-order-icon rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                                                        >
                                                            <i className="fa-solid fa-box-open"></i>
                                                        </span>
                                                        <span className="direct-order-label fw-black x-small text-uppercase">Direct Order Required</span>
                                                    </div>
                                                    <Link
                                                        to="/order"
                                                        className="btn btn-sm btn-nook-primary w-100 rounded-pill fw-bold d-flex align-items-center justify-content-center gap-2"
                                                        style={{ fontSize: '0.78rem' }}
                                                    >
                                                        <i className="fa-solid fa-robot"></i> Open Order Bot
                                                    </Link>
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (isRevealableStatus) {
                                                            if (hasInstantCode) onCopyCode(island, liveCode as string);
                                                            else onRevealCode(island);
                                                        }
                                                    }}
                                                    disabled={btnDisabled}
                                                    className={`btn w-100 rounded-pill fw-black py-2 position-relative overflow-hidden transition-all shadow-2xs ${
                                                        isCopied ? 'btn-success text-white' : btnClass
                                                    }`}
                                                    style={{ fontSize: '0.85rem' }}
                                                >
                                                    <div className="d-flex align-items-center justify-content-center gap-2">
                                                        {isCopied ? (
                                                            <>
                                                                <i className="fa-solid fa-check"></i> COPIED!
                                                            </>
                                                        ) : isRevealing ? (
                                                            <><i className="fa-solid fa-circle-notch fa-spin"></i> LOADING...</>
                                                        ) : revealedCode ? (
                                                            <><i className="fa-solid fa-plane-departure opacity-75"></i><span className="font-monospace">{revealedCode}</span></>
                                                        ) : hasInstantCode ? (
                                                            <><i className="fa-solid fa-plane-departure opacity-75"></i><span className="font-monospace">{liveCode}</span></>
                                                        ) : isRevealableStatus && !needsAuth ? (
                                                            <><i className="fa-solid fa-eye opacity-75"></i> REVEAL DODO</>
                                                        ) : (
                                                            <>
                                                                {btnIcon && <i className={`fa-solid ${btnIcon}`}></i>}
                                                                <span>{btnText}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </button>
                                            )}

                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Unofficial Fan-Site Disclaimer Banner */}
                <DisclaimerBanner />
            </div>

            {/* ════════════════ HIGH-RES MAP MODAL ════════════════ */}
            {selectedMap && (
                <div className="modal-overlay d-flex align-items-center justify-content-center p-3" onClick={() => setSelectedMap(null)} style={{ backdropFilter: 'blur(6px)', zIndex: 1050 }}>
                    <div
                        className="modal-content bg-white rounded-5 shadow-2xl overflow-hidden border-0 animate-up"
                        onClick={(e) => e.stopPropagation()}
                        style={{ maxWidth: '750px', width: '100%' }}
                    >
                        <div className="p-3 bg-light border-bottom d-flex justify-content-between align-items-center">
                            <div className="d-flex align-items-center gap-2">
                                <i className="fa-solid fa-map text-success fs-5"></i>
                                <h5 className="ac-font m-0 text-dark">{selectedMap.name} Layout Map</h5>
                            </div>
                            <button className="btn btn-sm btn-white border shadow-sm rounded-circle" onClick={() => setSelectedMap(null)}>
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                        <div className="p-0 bg-dark position-relative d-flex justify-content-center align-items-center" style={{ minHeight: '350px' }}>
                            <img
                                src={selectedMap.mapUrl || `https://cdn.chopaeng.com/maps/${selectedMap.name.toLowerCase()}.png`}
                                alt={`${selectedMap.name} Map`}
                                className="img-fluid"
                                style={{ maxHeight: '72vh', objectFit: 'contain' }}
                                onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    if (target.src.includes('.png')) target.src = target.src.replace('.png', '.jpg');
                                    else if (target.src.endsWith('.jpg')) target.src = target.src.replace('.jpg', '.jpeg');
                                    else target.src = 'https://www.chopaeng.com/banner.png';
                                }}
                            />
                        </div>
                        <div className="p-3 bg-white d-flex justify-content-between align-items-center flex-wrap gap-2">
                            <div className="d-flex gap-2">
                                <span className="badge bg-light text-dark border">{selectedMap.seasonal} Season</span>
                                <span className="badge bg-success-subtle text-success border-success-subtle">{selectedMap.type}</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    const mapUrl = selectedMap.mapUrl || `https://cdn.chopaeng.com/maps/${selectedMap.name.toLowerCase()}.png`;
                                    window.open(mapUrl, '_blank');
                                }}
                                className="btn btn-sm btn-outline-dark rounded-pill fw-bold px-3"
                            >
                                <i className="fa-solid fa-arrow-up-right-from-square me-1"></i> Open Full Image
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {revealError && (
                <RevealErrorPopup message={revealError} onClose={() => setRevealError(null)} />
            )}
        </div>
    );
};

export default TreasureIslands;
