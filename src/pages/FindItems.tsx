import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ACNH_FINDER_API_BASE } from "../config/api";
import DisclaimerBanner from "../components/DisclaimerBanner";
import { HowItWorksExplainer, FIND_ITEMS_EXPLAINER_CONFIG } from "../components/HowItWorksExplainer";
import { buildTranslationIndex, searchAllTranslations } from "../utils/translationSearch";

interface SearchResult {
    found: boolean;
    query: string;
    results?: {
        free: string[];
        sub: string[];
    };
    suggestions?: string[];
    message: string;
}

// ── Item Availability Tracker ──────────────────────────────────────────────

interface TrackedItem {
    query: string;
    mode: 'item' | 'villager';
    lastChecked: number | null;
    result: SearchResult | null;
    isRefreshing: boolean;
}

const TRACKER_STORAGE_KEY = 'chopaeng_tracked_items';
const MAX_TRACKED = 10;
const AUTO_REFRESH_MS = 60_000;

function loadTracked(): TrackedItem[] {
    try {
        const raw = localStorage.getItem(TRACKER_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as Array<Omit<TrackedItem, 'isRefreshing'>>;
        return parsed.map(item => ({ ...item, isRefreshing: false }));
    } catch {
        return [];
    }
}

function saveTracked(items: TrackedItem[]): void {
    try {
        // Strip isRefreshing (runtime-only) before persisting
        const toStore = items.map(({ isRefreshing: _r, ...rest }) => rest);
        localStorage.setItem(TRACKER_STORAGE_KEY, JSON.stringify(toStore));
    } catch {}
}

function getStatusDots(result: SearchResult | null) {
    if (!result || !result.found || !result.results) {
        return { freeCount: 0, subCount: 0, found: false };
    }
    return {
        freeCount: result.results.free.length,
        subCount: result.results.sub.length,
        found: true,
    };
}

function timeAgo(ts: number | null): string {
    if (!ts) return 'Never';
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 5) return 'Just now';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
}

// ──────────────────────────────────────────────────────────────────────────

const FindItems = () => {
    // ── Existing state ────────────────────────────────────────────────────
    const [searchTerm, setSearchTerm] = useState('');
    const [searchMode, setSearchMode] = useState<'item' | 'villager'>('item');
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<SearchResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [resolvedEnglishTerm, setResolvedEnglishTerm] = useState<string | null>(null);

    // ── Tracker state ─────────────────────────────────────────────────────
    const [trackedItems, setTrackedItems] = useState<TrackedItem[]>(() => loadTracked());
    const [trackerOpen, setTrackerOpen] = useState(false);
    const [, forceRefreshTick] = useState(0); // ticks to keep timeAgo labels live
    const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── Existing search handler ───────────────────────────────────────────
    const handleSearch = async (term: string = searchTerm) => {
        if (!term.trim()) return;

        setLoading(true);
        setData(null);
        setError(null);
        setResolvedEnglishTerm(null);
        setSearchTerm(term);

        try {
            let finalQuery = term.trim();

            // Try resolving foreign language search query to English item name
            if (searchMode === 'item') {
                try {
                    const idxMap = await buildTranslationIndex();
                    const matches = searchAllTranslations(idxMap, finalQuery);
                    if (matches.length > 0) {
                        finalQuery = matches[0].name;
                        if (finalQuery.toLowerCase() !== term.trim().toLowerCase()) {
                            setResolvedEnglishTerm(`${matches[0].translatedName} → ${finalQuery}`);
                        }
                    }
                } catch {
                    // ignore and use original query
                }
            }

            const endpoint = searchMode === 'item' ? 'find' : 'villager';
            const response = await fetch(`${ACNH_FINDER_API_BASE}/api/${endpoint}?q=${encodeURIComponent(finalQuery)}`);

            if (!response.ok) throw new Error("Server error");

            const result: SearchResult = await response.json();
            setData(result);
        } catch (err) {
            console.error(err);
            setError("Could not reach NookNet services. Is the bot online?");
        } finally {
            setLoading(false);
        }
    };

    // ── Tracker: low-level fetch for one item ─────────────────────────────
    const fetchTrackedResult = useCallback(
        async (query: string, mode: 'item' | 'villager'): Promise<SearchResult | null> => {
            try {
                const endpoint = mode === 'item' ? 'find' : 'villager';
                const res = await fetch(
                    `${ACNH_FINDER_API_BASE}/api/${endpoint}?q=${encodeURIComponent(query)}`
                );
                if (!res.ok) return null;
                return await res.json();
            } catch {
                return null;
            }
        },
        []
    );

    // ── Tracker: refresh one tracked item ────────────────────────────────
    const refreshTrackedItem = useCallback(
        async (query: string, mode: 'item' | 'villager') => {
            setTrackedItems(prev =>
                prev.map(t =>
                    t.query === query && t.mode === mode ? { ...t, isRefreshing: true } : t
                )
            );

            const result = await fetchTrackedResult(query, mode);

            setTrackedItems(prev => {
                const next = prev.map(t =>
                    t.query === query && t.mode === mode
                        ? { ...t, isRefreshing: false, result, lastChecked: Date.now() }
                        : t
                );
                saveTracked(next);
                return next;
            });
        },
        [fetchTrackedResult]
    );

    // ── Tracker: refresh all tracked items sequentially ───────────────────
    const refreshAllTracked = useCallback(async () => {
        // Mark all as refreshing
        setTrackedItems(prev => prev.map(t => ({ ...t, isRefreshing: true })));

        // Take a snapshot of current queries to iterate
        const snapshot = loadTracked();
        for (const item of snapshot) {
            const result = await fetchTrackedResult(item.query, item.mode);
            setTrackedItems(prev => {
                const next = prev.map(t =>
                    t.query === item.query && t.mode === item.mode
                        ? { ...t, isRefreshing: false, result, lastChecked: Date.now() }
                        : t
                );
                saveTracked(next);
                return next;
            });
        }
    }, [fetchTrackedResult]);

    // ── Tracker: add current search result to the watchlist ───────────────
    const trackCurrentItem = useCallback(() => {
        if (!data?.found) return;
        const query = data.query;
        const mode = searchMode;

        setTrackedItems(prev => {
            const alreadyExists = prev.some(
                t => t.query.toLowerCase() === query.toLowerCase() && t.mode === mode
            );
            if (alreadyExists) {
                setTrackerOpen(true);
                return prev;
            }
            if (prev.length >= MAX_TRACKED) return prev;

            const next: TrackedItem[] = [
                ...prev,
                { query, mode, lastChecked: Date.now(), result: data, isRefreshing: false },
            ];
            saveTracked(next);
            setTrackerOpen(true);
            return next;
        });
    }, [data, searchMode]);

    // ── Tracker: remove one tracked item ─────────────────────────────────
    const removeTrackedItem = useCallback((query: string, mode: 'item' | 'villager') => {
        setTrackedItems(prev => {
            const next = prev.filter(t => !(t.query === query && t.mode === mode));
            saveTracked(next);
            return next;
        });
    }, []);

    // ── Listen for NookPhone "open tracker" event ───────────────────────
    useEffect(() => {
        const handler = () => setTrackerOpen(true);
        window.addEventListener('chopaeng_open_item_tracker', handler);
        return () => window.removeEventListener('chopaeng_open_item_tracker', handler);
    }, []);

    // ── Auto-refresh every 60s + timeAgo tick every 10s ──────────────────
    useEffect(() => {
        autoRefreshRef.current = setInterval(() => {
            // Read current items without triggering a re-render here
            const snapshot = loadTracked();
            if (snapshot.length === 0) return;
            snapshot.forEach(item => {
                refreshTrackedItem(item.query, item.mode);
            });
        }, AUTO_REFRESH_MS);

        const tickInterval = setInterval(() => {
            forceRefreshTick(n => n + 1);
        }, 10_000);

        return () => {
            if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
            clearInterval(tickInterval);
        };
    }, [refreshTrackedItem]);

    // ── Derived ───────────────────────────────────────────────────────────
    const isAlreadyTracked =
        data?.found
            ? trackedItems.some(
                  t => t.query.toLowerCase() === data.query.toLowerCase() && t.mode === searchMode
              )
            : false;

    const title =
        searchMode === "item"
            ? "Find Items on ACNH Fan Islands | Chopaeng Community"
            : "Find Villager Matching on ACNH Fan Islands | Chopaeng Community";

    const desc =
        searchMode === "item"
            ? "Search which live community-hosted ACNH islands on Chopaeng currently feature the item you want. Real-time item lookup across free and supporter islands."
            : "Search which live community-hosted ACNH islands on Chopaeng currently offer villager matching for your favorite villager. Real-time villager request lookup across free and supporter islands.";

    return (
        <div className="nook-catalog min-vh-100 font-nunito bg-pattern d-flex flex-column align-items-center">
            <Helmet>
                <title>{title}</title>
                <meta name="description" content={desc} />
                <link rel="canonical" href="https://www.chopaeng.com/find" />
                <meta property="og:type" content="website" />
                <meta property="og:site_name" content="Chopaeng" />
                <meta property="og:url" content="https://www.chopaeng.com/find" />
                <meta property="og:title" content={title} />
                <meta property="og:description" content={desc} />
                <meta property="og:image" content="https://www.chopaeng.com/banner.png" />
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content={title} />
                <meta name="twitter:description" content={desc} />
                <meta name="twitter:image" content="https://www.chopaeng.com/banner.png" />
            </Helmet>

            {/* 1. HEADER & SEARCH */}
            <header
                className="w-100 pt-4 pb-4 py-sm-5 position-relative shadow-sm rounded-bottom-5 mb-5 overflow-hidden"
                style={{ background: 'var(--nook-green, #37b06d)' }}
            >
                <div className="container position-relative z-1 text-center">
                    <span className="badge bg-white text-nook-green rounded-pill mb-3 px-3 py-2 fw-black text-uppercase tracking-wide shadow-sm">
                        <i className="fa-solid fa-wifi me-2"></i> Connected to ChoBot Community Assistant
                    </span>
                    <h1 className="display-4 fw-black text-white ac-font mb-4">
                        {searchMode === 'item' ? 'Item Directory Search' : 'Villager Matching Finder'}
                    </h1>

                    {/* MODE TOGGLE */}
                    <div className="d-flex flex-wrap justify-content-center gap-2 gap-sm-3 mb-4">
                        <button
                            onClick={() => setSearchMode('item')}
                            className={`btn rounded-pill px-3 px-sm-4 py-2 fw-bold transition-all ${searchMode === 'item' ? 'bg-white text-nook-green shadow' : 'bg-dark bg-opacity-25 text-white'}`}
                            aria-pressed={searchMode === 'item'}
                        >
                            <i className="fa-solid fa-couch me-2"></i> Items
                        </button>
                        <button
                            onClick={() => setSearchMode('villager')}
                            className={`btn rounded-pill px-3 px-sm-4 py-2 fw-bold transition-all ${searchMode === 'villager' ? 'bg-white text-nook-green shadow' : 'bg-dark bg-opacity-25 text-white'}`}
                            aria-pressed={searchMode === 'villager'}
                        >
                            <i className="fa-solid fa-user-tag me-2"></i> Villagers
                        </button>
                    </div>

                    {/* SEARCH INPUT */}
                    <div className="row justify-content-center">
                        <div className="col-12 col-lg-6 col-md-8">
                            <div className="input-group input-group-lg shadow-lg rounded-pill bg-white p-2">
                                <input
                                    type="text"
                                    className="form-control border-0 bg-transparent fw-bold shadow-none ps-4"
                                    placeholder={searchMode === 'item' ? "Search 'Ironwood Dresser'..." : "Search 'Raymond'..."}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    aria-label={searchMode === 'item' ? 'Search for an item' : 'Search for a villager'}
                                />
                                <button
                                    className="btn btn-nook-primary rounded-pill px-4 fw-bold m-1"
                                    onClick={() => handleSearch()}
                                    disabled={loading}
                                    aria-label="Search"
                                >
                                    {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-magnifying-glass"></i>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Decoration */}
                <div className="position-absolute bottom-0 start-0 opacity-10 ms-n5 mb-n5 text-white d-none d-sm-block" aria-hidden="true">
                    <i className="fa-solid fa-leaf" style={{ fontSize: '15rem', transform: 'rotate(-20deg)' }}></i>
                </div>
            </header>

            {/* 2. RESULTS SECTION */}
            <section className="container px-3 mb-5" style={{ maxWidth: '800px' }}>
                {/* ── REUSABLE HOW IT WORKS EXPLAINER ── */}
                <HowItWorksExplainer {...FIND_ITEMS_EXPLAINER_CONFIG} className="mb-4" defaultExpanded={false} />

                {/* TRANSLATION BADGE */}
                {resolvedEnglishTerm && (
                    <div className="alert alert-info rounded-4 border-0 shadow-sm d-flex align-items-center gap-2 mb-3 py-2 px-3">
                        <i className="fa-solid fa-language text-info fs-5" aria-hidden="true" />
                        <div className="small fw-bold">
                            Auto-translated: <span className="badge bg-white text-dark border px-2 py-1 ms-1">{resolvedEnglishTerm}</span>
                        </div>
                    </div>
                )}

                {/* ERROR STATE */}
                {error && (
                    <div className="alert alert-danger rounded-4 border-0 shadow-sm text-center fw-bold" role="alert">
                        <i className="fa-solid fa-triangle-exclamation me-2"></i> {error}
                    </div>
                )}

                {/* SUGGESTIONS STATE (Did you mean?) */}
                {data && !data.found && data.suggestions && data.suggestions.length > 0 && (
                    <div className="text-center py-4 px-3 bg-white rounded-5 shadow-sm border border-warning">
                        <h3 className="h5 fw-bold text-muted mb-3">
                            <i className="fa-solid fa-circle-question text-warning me-2"></i>
                            Not found. Did you mean?
                        </h3>
                        <div className="d-flex justify-content-center flex-wrap gap-2">
                            {data.suggestions.map((sugg, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleSearch(sugg)}
                                    className="btn btn-outline-warning text-dark fw-bold rounded-pill px-4"
                                >
                                    {sugg}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* NOT FOUND (No suggestions) */}
                {data && !data.found && (!data.suggestions || data.suggestions.length === 0) && (
                    <div className="text-center py-5 opacity-50">
                        <i className="fa-solid fa-box-open fs-1 mb-3"></i>
                        <h3 className="fw-black">No matching items or villagers found.</h3>
                        <p>Check your spelling or try searching for another term!</p>
                    </div>
                )}

                {/* SUCCESS STATE */}
                {data && data.found && data.results && (
                    <div className="card border-0 rounded-5 overflow-hidden mb-5 bg-white shadow-lg animate-up">
                        {/* Result Header */}
                        <div className="card-header bg-cream border-bottom border-light p-3 p-sm-4 text-center">
                            <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-3 py-1 mb-2 fw-bold text-uppercase x-small">
                                {searchMode === 'item' ? 'Item Listed' : 'Villager Matching Available'}
                            </span>
                            <h2 className="display-6 fw-black text-dark m-0 text-capitalize text-break">
                                {data.query}
                            </h2>
                            <p className="text-muted small fw-bold mt-2 mb-0">
                                Listed across {data.results.free.length + data.results.sub.length} community island{(data.results.free.length + data.results.sub.length) === 1 ? '' : 's'} below.
                            </p>

                            {/* ── TRACK AVAILABILITY BUTTON ── */}
                            <div className="mt-3">
                                <button
                                    id="track-item-btn"
                                    className={`btn btn-sm rounded-pill px-4 fw-bold shadow-sm transition-all ${isAlreadyTracked ? 'btn-success' : 'btn-outline-success'}`}
                                    onClick={trackCurrentItem}
                                    disabled={isAlreadyTracked || trackedItems.length >= MAX_TRACKED}
                                    title={
                                        isAlreadyTracked
                                            ? 'Already tracking this item'
                                            : trackedItems.length >= MAX_TRACKED
                                            ? `Tracker is full (max ${MAX_TRACKED} items)`
                                            : 'Watch this item for live availability changes'
                                    }
                                >
                                    <i className={`fa-solid ${isAlreadyTracked ? 'fa-check' : 'fa-satellite-dish'} me-2`}></i>
                                    {isAlreadyTracked
                                        ? 'Tracking'
                                        : trackedItems.length >= MAX_TRACKED
                                        ? 'Tracker Full'
                                        : 'Track Availability'}
                                </button>
                                {isAlreadyTracked && (
                                    <button
                                        className="btn btn-sm btn-link text-muted fw-bold ms-1"
                                        onClick={() => setTrackerOpen(true)}
                                        style={{ fontSize: '0.78rem' }}
                                    >
                                        View in Tracker →
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="card-body p-0">
                            <div className="row g-0">
                                {/* FREE ISLANDS COL */}
                                <div className="col-12 col-md-6 border-bottom border-md-bottom-0 border-end-0 border-md-end border-light">
                                    <div className="p-3 p-sm-4 h-100">
                                        <div className="d-flex align-items-center gap-2 mb-4 text-success">
                                            <div className="bg-success-subtle p-2 rounded-circle">
                                                <i className="fa-solid fa-unlock"></i>
                                            </div>
                                            <h5 className="fw-black m-0">Public Islands</h5>
                                        </div>

                                        {data.results.free.length > 0 ? (
                                            <div className="d-flex flex-wrap gap-2">
                                                {data.results.free.map((island, i) => (
                                                    <Link
                                                        key={i}
                                                        to={`/island/${island.toLowerCase()}`}
                                                        className="badge bg-success text-white rounded-pill px-3 py-2 fw-bold shadow-sm text-decoration-none hover-scale"
                                                    >
                                                        <i className="fa-solid fa-plane me-1"></i> {island}
                                                    </Link>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-muted small fst-italic border rounded-3 p-3 bg-light text-center">
                                                Not currently available on Public Islands.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* MEMBER ISLANDS COL */}
                                <div className="col-12 col-md-6">
                                    <div className="p-3 p-sm-4 h-100 bg-sub-pattern">
                                        <div className="d-flex align-items-center gap-2 mb-4 text-warning-emphasis">
                                            <div className="bg-warning-subtle p-2 rounded-circle">
                                                <i className="fa-solid fa-crown"></i>
                                            </div>
                                            <h5 className="fw-black m-0">Sub Islands</h5>
                                        </div>

                                        {data.results.sub.length > 0 ? (
                                            <div className="d-flex flex-wrap gap-2">
                                                {data.results.sub.map((island, i) => (
                                                    <Link
                                                        key={i}
                                                        to={`/island/${island.toLowerCase()}`}
                                                        className="badge bg-warning text-dark rounded-pill px-3 py-2 fw-bold shadow-sm border border-white text-decoration-none hover-scale"
                                                    >
                                                        <i className="fa-solid fa-star me-1"></i> {island}
                                                    </Link>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-muted small fst-italic border rounded-3 p-3 bg-white text-center">
                                                Not currently available on Sub Islands.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="card-footer bg-white border-top border-light p-3 p-sm-4 text-center">
                            <Link
                                to="/command-builder"
                                className="btn btn-nook-primary rounded-pill px-4 py-2 fw-bold hover-nook"
                            >
                                <i className="fa-solid fa-list-check me-2"></i>
                                Build a Custom Item Request in Command Builder
                            </Link>
                        </div>
                    </div>
                )}

                {/* FAN SITE DISCLAIMER */}
                <DisclaimerBanner variant="alert" className="mt-4 mb-2" />
            </section>

            {/* ── TRACKER FAB ───────────────────────────────────────────────────────── */}
            <button
                id="tracker-fab-btn"
                aria-label="Open Item Availability Tracker"
                title={`Item Tracker${trackedItems.length > 0 ? ` · ${trackedItems.length} watching` : ''}`}
                onClick={() => setTrackerOpen(o => !o)}
                style={{
                    position: 'fixed', bottom: '6rem', right: '1.25rem', zIndex: 1050,
                    width: 52, height: 52, borderRadius: '50%', border: 'none',
                    background: trackerOpen ? 'linear-gradient(135deg,#1f8c56,#15803d)' : 'linear-gradient(135deg,#37b06d,#22c55e)',
                    color: '#fff', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 6px 24px rgba(55,176,109,0.5)',
                    transition: 'all 0.2s cubic-bezier(0.34,1.56,0.64,1)',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
                <i className="fa-solid fa-satellite-dish" style={{ fontSize: '1.15rem' }}></i>
                {trackedItems.length > 0 && (
                    <span style={{
                        position: 'absolute', top: -4, right: -4,
                        minWidth: 20, height: 20, borderRadius: '999px',
                        background: '#ef4444', color: '#fff',
                        fontSize: '0.65rem', fontWeight: 900,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '0 5px', border: '2px solid #fff',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.2)', lineHeight: 1,
                    }} aria-label={`${trackedItems.length} items tracked`}>
                        {trackedItems.length}
                    </span>
                )}
            </button>

            {/* Backdrop */}
            <div
                aria-hidden="true"
                onClick={() => setTrackerOpen(false)}
                style={{
                    position: 'fixed', inset: 0, zIndex: 1060,
                    background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)',
                    opacity: trackerOpen ? 1 : 0, pointerEvents: trackerOpen ? 'auto' : 'none',
                    transition: 'opacity 0.28s ease',
                }}
            />

            {/* Drawer */}
            <div
                id="tracker-panel" role="dialog"
                aria-label="Item Availability Tracker" aria-modal="true"
                style={{
                    position: 'fixed', top: 0, right: 0,
                    height: '100dvh', width: 'min(420px,100vw)',
                    zIndex: 1070, background: '#fff',
                    boxShadow: '-8px 0 48px rgba(0,0,0,0.18)',
                    display: 'flex', flexDirection: 'column',
                    transform: trackerOpen ? 'translateX(0)' : 'translateX(110%)',
                    transition: 'transform 0.32s cubic-bezier(0.4,0,0.2,1)',
                }}
            >
                {/* Header */}
                <div style={{ background: 'linear-gradient(135deg,#166534 0%,#15803d 60%,#16a34a 100%)', color: '#fff', padding: '1.1rem 1.25rem 0', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            <div style={{ position: 'relative', width: 10, height: 10, flexShrink: 0 }}>
                                <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#4ade80', animation: 'trackerPulseRing 2s ease-out infinite' }}></span>
                                <span style={{ position: 'absolute', inset: 2, borderRadius: '50%', background: '#22c55e' }}></span>
                            </div>
                            <div>
                                <div style={{ fontWeight: 900, fontSize: '1rem', letterSpacing: '-0.01em', lineHeight: 1.2 }}>Item Tracker</div>
                                <div style={{ fontSize: '0.67rem', opacity: 0.8, marginTop: '0.1rem' }}>Live availability · auto-refreshes every 60s</div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                            {trackedItems.length > 0 && (
                                <button onClick={refreshAllTracked} title="Refresh all" aria-label="Refresh all tracked items"
                                    style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '999px', color: '#fff', fontWeight: 800, fontSize: '0.7rem', padding: '0.22rem 0.65rem', cursor: 'pointer', letterSpacing: '0.01em' }}>
                                    <i className="fa-solid fa-arrows-rotate me-1"></i>All
                                </button>
                            )}
                            <button onClick={() => setTrackerOpen(false)} aria-label="Close tracker"
                                style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                    </div>
                    <div style={{ marginBottom: '0.9rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.63rem', opacity: 0.75, marginBottom: '0.28rem' }}>
                            <span>{trackedItems.length} of {MAX_TRACKED} slots used</span>
                            {trackedItems.length >= MAX_TRACKED && <span style={{ color: '#fde68a', fontWeight: 700 }}>Tracker full</span>}
                        </div>
                        <div style={{ height: 4, borderRadius: '999px', background: 'rgba(255,255,255,0.2)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: '999px', width: `${(trackedItems.length / MAX_TRACKED) * 100}%`, background: trackedItems.length >= MAX_TRACKED ? 'linear-gradient(90deg,#fde68a,#fbbf24)' : 'linear-gradient(90deg,#86efac,#4ade80)', transition: 'width 0.4s ease' }}></div>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '0.85rem', background: '#f1f5f9', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    <style>{`@keyframes trackerPulseRing { 0% { transform:scale(1);opacity:.85; } 70% { transform:scale(2.4);opacity:0; } 100% { transform:scale(2.4);opacity:0; } }`}</style>

                    {trackedItems.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
                            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg,#dcfce7,#bbf7d0)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', boxShadow: '0 4px 16px rgba(34,197,94,0.2)' }}>
                                <i className="fa-solid fa-satellite-dish" style={{ fontSize: '1.8rem', color: '#16a34a' }}></i>
                            </div>
                            <div style={{ fontWeight: 900, fontSize: '0.95rem', color: '#0f172a', marginBottom: '0.4rem' }}>Nothing tracked yet</div>
                            <div style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.7 }}>
                                Search for an item or villager, then click{' '}
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: '#dcfce7', color: '#15803d', fontWeight: 800, borderRadius: '999px', padding: '0.1rem 0.55rem', fontSize: '0.72rem', margin: '0 0.2rem', verticalAlign: 'middle' }}>
                                    <i className="fa-solid fa-satellite-dish" style={{ fontSize: '0.62rem' }}></i>Track Availability
                                </span>
                                to watch it live.
                            </div>
                        </div>
                    ) : (
                        trackedItems.map((item) => {
                            const { freeCount, subCount, found } = getStatusDots(item.result);
                            const hasResult = item.result !== null;
                            const accentColor = !hasResult ? '#cbd5e1' : found ? (freeCount > 0 ? '#22c55e' : '#f59e0b') : '#f87171';
                            return (
                                <div key={`${item.mode}-${item.query}`} style={{ background: '#fff', borderRadius: '0.75rem', border: '1px solid #e2e8f0', borderLeft: `4px solid ${accentColor}`, boxShadow: '0 1px 6px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                                    <div style={{ padding: '0.7rem 0.8rem 0.45rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                                        <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: !hasResult ? '#f1f5f9' : found ? '#dcfce7' : '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <i className={`fa-solid ${item.isRefreshing ? 'fa-spinner fa-spin' : found ? 'fa-check' : hasResult ? 'fa-xmark' : 'fa-clock'}`} style={{ fontSize: '0.78rem', color: !hasResult ? '#94a3b8' : found ? '#16a34a' : '#ef4444' }}></i>
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 900, fontSize: '0.88rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.query}>{item.query}</div>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.22rem', marginTop: '0.15rem', fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '0.05em', borderRadius: '999px', padding: '0.1rem 0.45rem', background: item.mode === 'item' ? '#dcfce7' : '#ede9fe', color: item.mode === 'item' ? '#166534' : '#5b21b6' }}>
                                                <i className={`fa-solid ${item.mode === 'item' ? 'fa-couch' : 'fa-user-tag'}`}></i>{item.mode}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                                            <button onClick={() => refreshTrackedItem(item.query, item.mode)} disabled={item.isRefreshing} title="Refresh" aria-label={`Refresh ${item.query}`}
                                                style={{ width: 26, height: 26, borderRadius: '50%', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b', fontSize: '0.68rem', cursor: item.isRefreshing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: item.isRefreshing ? 0.5 : 1, transition: 'all 0.15s' }}>
                                                <i className={`fa-solid fa-arrows-rotate ${item.isRefreshing ? 'fa-spin' : ''}`}></i>
                                            </button>
                                            <button onClick={() => removeTrackedItem(item.query, item.mode)} title={`Stop tracking "${item.query}"`} aria-label={`Remove ${item.query}`}
                                                style={{ width: 26, height: 26, borderRadius: '50%', border: '1px solid #fecaca', background: '#fff5f5', color: '#f87171', fontSize: '0.68rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                                                <i className="fa-solid fa-xmark"></i>
                                            </button>
                                        </div>
                                    </div>
                                    <div style={{ padding: '0 0.8rem 0.65rem', display: 'flex', flexWrap: 'wrap' as const, gap: '0.35rem', alignItems: 'center' }}>
                                        {item.isRefreshing && !hasResult ? (
                                            <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.35rem' }}><i className="fa-solid fa-spinner fa-spin" style={{ color: '#22c55e', fontSize: '0.68rem' }}></i>Scanning islands…</span>
                                        ) : hasResult ? (
                                            found ? (
                                                <>
                                                    {freeCount > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.28rem', fontSize: '0.71rem', fontWeight: 700, borderRadius: '999px', padding: '0.22rem 0.6rem', background: '#dcfce7', color: '#15803d' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }}></span>{freeCount} Public island{freeCount !== 1 ? 's' : ''}</span>}
                                                    {subCount > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.28rem', fontSize: '0.71rem', fontWeight: 700, borderRadius: '999px', padding: '0.22rem 0.6rem', background: '#fef9c3', color: '#92400e' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }}></span>{subCount} Sub island{subCount !== 1 ? 's' : ''}</span>}
                                                </>
                                            ) : (
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.28rem', fontSize: '0.71rem', fontWeight: 700, borderRadius: '999px', padding: '0.22rem 0.6rem', background: '#fee2e2', color: '#991b1b' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }}></span>Not available</span>
                                            )
                                        ) : (
                                            <span style={{ fontSize: '0.71rem', color: '#94a3b8', fontStyle: 'italic' }}>Not yet checked</span>
                                        )}
                                        <span style={{ marginLeft: 'auto', fontSize: '0.63rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.22rem', flexShrink: 0 }}>
                                            <i className="fa-regular fa-clock"></i>{timeAgo(item.lastChecked)}{item.isRefreshing && <span style={{ color: '#16a34a', fontWeight: 800 }}>· live</span>}
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                {data?.found && (
                    <div style={{ padding: '0.75rem 0.85rem', borderTop: '1px solid #e2e8f0', background: '#fff', flexShrink: 0 }}>
                        <button
                            className={`btn w-100 fw-bold rounded-pill ${isAlreadyTracked ? 'btn-success' : 'btn-outline-success'}`}
                            onClick={trackCurrentItem}
                            disabled={isAlreadyTracked || trackedItems.length >= MAX_TRACKED}
                            style={{ fontSize: '0.83rem', padding: '0.55rem 1rem' }}
                        >
                            <i className={`fa-solid ${isAlreadyTracked ? 'fa-check' : 'fa-satellite-dish'} me-2`}></i>
                            {isAlreadyTracked ? `Watching "${data.query}"` : trackedItems.length >= MAX_TRACKED ? `Tracker Full (${MAX_TRACKED}/${MAX_TRACKED})` : `Watch "${data.query}"`}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FindItems;