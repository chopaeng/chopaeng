import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useHemisphere } from '../hooks/useHemisphere';
import { playChimeClick } from '../utils/kkAudioSynthesizer';
import { getUserScopedItem, setUserScopedItem, getActiveUserId } from '../utils/accountStorage';
import { getAuthToken } from '../context/authToken';
import { useAuth } from '../context/useAuth';
import { API_BASE } from '../config/api';

interface CreatureEntry {
    name: string;
    icon: string;
    sell: number;
    whereHow: string;
    weather: string;
    size: string;
    shadow?: string;
    category: string;
    catchPhrase: string;
    months: number[];
    hours: number[];
    monthsLabel: string[];
    timeLabel: string[];
}

type CritterTab = 'now' | 'leaving' | 'coming' | 'calendar';

const CATEGORY_ICONS: Record<string, string> = {
    'Fish': 'fa-fish',
    'Bugs': 'fa-bug',
    'Sea Creatures': 'fa-shrimp',
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const FALLBACK_IMAGE = 'https://acnhcdn.com/latest/FtrIcon/FtrLeaf.png';

const toTitleCase = (str: string): string =>
    str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

const Critters: React.FC = () => {
    const { hemisphere, isNorth, setHemisphere } = useHemisphere();
    const { user } = useAuth();
    const [creatures, setCreatures] = useState<CreatureEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<CritterTab>('now');
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [statusFilter, setStatusFilter] = useState<'all' | 'uncaught' | 'caught'>('all');
    const [sortBy, setSortBy] = useState<'name' | 'sell'>('sell');
    const [calendarMonth] = useState(new Date().getMonth());
    const [dbSyncing, setDbSyncing] = useState(false);
    const [dbSynced, setDbSynced] = useState(false);

    // ── Caught critter tracker (account-scoped localStorage + ChoBot DB) ──────────────
    const CAUGHT_KEY = `chopaeng_caught_critters_${hemisphere}`;

    const getLocalCaught = useCallback((hemi?: string) => {
        const targetHemi = hemi || hemisphere;
        const key = `chopaeng_caught_critters_${targetHemi}`;
        try {
            const raw = getUserScopedItem(key);
            return raw ? new Set<string>(JSON.parse(raw)) : new Set<string>();
        } catch {
            return new Set<string>();
        }
    }, [hemisphere]);

    const [caughtNames, setCaughtNames] = useState<Set<string>>(() => getLocalCaught());
    const abortRef = useRef<AbortController | null>(null);

    const syncCrittersWithChoBot = useCallback((targetHemi: string, tokenOverride?: string | null) => {
        if (abortRef.current) {
            abortRef.current.abort();
        }

        const currentKey = `chopaeng_caught_critters_${targetHemi}`;
        // Immediately synchronize state with local cached values for target hemisphere (zero flicker)
        const local = getLocalCaught(targetHemi);
        setCaughtNames(local);

        const token = tokenOverride !== undefined ? tokenOverride : getAuthToken();
        const userId = getActiveUserId();
        if (!token || !userId) {
            setDbSyncing(false);
            setDbSynced(false);
            return;
        }

        const controller = new AbortController();
        abortRef.current = controller;
        setDbSyncing(true);

        fetch(`${API_BASE}/api/user/critters?hemisphere=${encodeURIComponent(targetHemi)}`, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            signal: controller.signal
        })
            .then(res => res.json())
            .then(data => {
                if (controller.signal.aborted) return;
                if (data && data.ok && Array.isArray(data.critters)) {
                    const serverSet = new Set<string>(data.critters.map((c: any) => c.critter_name));
                    setCaughtNames(prev => {
                        const merged = new Set<string>([...prev, ...serverSet]);
                        try {
                            setUserScopedItem(currentKey, JSON.stringify([...merged]));
                        } catch { /* ignore */ }
                        return merged;
                    });
                    setDbSynced(true);
                }
            })
            .catch(err => {
                if (err.name !== 'AbortError') {
                    console.warn('Failed to load critters from ChoBot DB:', err);
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) {
                    setDbSyncing(false);
                }
            });
    }, [getLocalCaught]);

    // Sync when hemisphere changes or on mount
    useEffect(() => {
        syncCrittersWithChoBot(hemisphere);
        return () => {
            if (abortRef.current) {
                abortRef.current.abort();
            }
        };
    }, [hemisphere, syncCrittersWithChoBot]);

    // Re-sync on auth change or account switch
    useEffect(() => {
        const handleAuthChange = () => {
            syncCrittersWithChoBot(hemisphere);
        };
        const handleExternalUpdate = (e: any) => {
            if (e.detail?.hemisphere === hemisphere && e.detail?.caught) {
                setCaughtNames(new Set(e.detail.caught));
            } else {
                setCaughtNames(getLocalCaught(hemisphere));
            }
        };

        window.addEventListener('chopaeng_auth_change', handleAuthChange);
        window.addEventListener('chopaeng_account_switched', handleAuthChange);
        window.addEventListener('chopaeng_caught_critters_updated', handleExternalUpdate);
        return () => {
            window.removeEventListener('chopaeng_auth_change', handleAuthChange);
            window.removeEventListener('chopaeng_account_switched', handleAuthChange);
            window.removeEventListener('chopaeng_caught_critters_updated', handleExternalUpdate);
        };
    }, [hemisphere, syncCrittersWithChoBot, getLocalCaught]);

    const toggleCaught = (name: string) => {
        const token = getAuthToken();
        const userId = getActiveUserId();
        if (!token || !userId) {
            window.dispatchEvent(new CustomEvent('chopaeng_auth_required', {
                detail: {
                    action: 'Critterpedia',
                    message: 'You must log in with Discord to mark critters as caught and sync your progress to your ChoBot account.'
                }
            }));
            return;
        }

        const isCurrentlyCaught = caughtNames.has(name);
        const willBeCaught = !isCurrentlyCaught;

        const next = new Set(caughtNames);
        if (willBeCaught) next.add(name);
        else next.delete(name);

        setCaughtNames(next);
        try {
            setUserScopedItem(CAUGHT_KEY, JSON.stringify([...next]));
        } catch { /* ignore */ }

        window.dispatchEvent(new CustomEvent('chopaeng_caught_critters_updated', {
            detail: { hemisphere, caught: [...next] }
        }));

        // Sync with ChoBot DB
        fetch(`${API_BASE}/api/user/critters`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                critter_name: name,
                hemisphere: hemisphere,
                caught: willBeCaught
            })
        }).then(res => res.json())
            .then(data => {
                if (data && data.ok) {
                    setDbSynced(true);
                }
            })
            .catch(err => {
                console.error('Failed to update critter in ChoBot DB:', err);
            });
    };

    const caughtCount = caughtNames.size;
    const caughtPercentage = creatures.length > 0 ? Math.round((caughtCount / creatures.length) * 100) : 0;

    const now = useMemo(() => new Date(), []);
    const currentMonth = now.getMonth() + 1; // 1-indexed
    const currentHour = now.getHours();
    const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;

    // Load creature data from the animal-crossing package
    useEffect(() => {
        let mounted = true;
        const load = async () => {
            setLoading(true);
            try {
                const creaturesMod = await import('@bitress/animal-crossing/lib/data/Creatures.json');
                const rawCreatures = (creaturesMod.default || creaturesMod) as any[];
                if (!mounted || !Array.isArray(rawCreatures)) return;

                const mapped: CreatureEntry[] = (rawCreatures as any[]).map((c: any) => {
                    const hemiData = hemisphere === 'north' ? c.hemispheres?.north : c.hemispheres?.south;

                    return {
                        name: toTitleCase(c.name),
                        icon: c.iconImage || c.critterpediaImage || c.furnitureImage || FALLBACK_IMAGE,
                        sell: c.sell ?? 0,
                        whereHow: c.whereHow || 'Unknown',
                        weather: c.weather || 'Any',
                        size: c.size || '',
                        shadow: c.shadow || undefined,
                        category: c.sourceSheet || 'Creatures',
                        catchPhrase: c.catchPhrase?.[0] || '',
                        months: hemiData?.monthsArray || [],
                        hours: hemiData?.timeArray || [],
                        monthsLabel: hemiData?.months || [],
                        timeLabel: hemiData?.time || [],
                    };
                });

                setCreatures(mapped);
            } catch (err) {
                console.error('Failed to load creature data:', err);
            } finally {
                if (mounted) setLoading(false);
            }
        };
        load();
        return () => { mounted = false; };
    }, [hemisphere]);

    // Derived creature lists
    const availableNow = useMemo(() =>
        creatures.filter(c => c.months.includes(currentMonth) && c.hours.includes(currentHour)),
        [creatures, currentMonth, currentHour]
    );

    const leavingThisMonth = useMemo(() =>
        creatures.filter(c =>
            c.months.includes(currentMonth) &&
            !c.months.includes(nextMonth)
        ),
        [creatures, currentMonth, nextMonth]
    );

    const comingNextMonth = useMemo(() =>
        creatures.filter(c =>
            !c.months.includes(currentMonth) &&
            c.months.includes(nextMonth)
        ),
        [creatures, currentMonth, nextMonth]
    );

    const calendarCreatures = useMemo(() =>
        creatures.filter(c => c.months.includes(calendarMonth + 1)),
        [creatures, calendarMonth]
    );

    // Category list
    const categories = useMemo(() => {
        const cats = new Set<string>();
        creatures.forEach(c => cats.add(c.category));
        return ['All', ...Array.from(cats).sort()];
    }, [creatures]);

    // Active list based on tab
    const activeList = useMemo(() => {
        let list: CreatureEntry[];
        switch (activeTab) {
            case 'now': list = availableNow; break;
            case 'leaving': list = leavingThisMonth; break;
            case 'coming': list = comingNextMonth; break;
            case 'calendar': list = calendarCreatures; break;
            default: list = availableNow;
        }

        // Apply search filter
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(c =>
                c.name.toLowerCase().includes(q) ||
                c.whereHow.toLowerCase().includes(q) ||
                c.category.toLowerCase().includes(q)
            );
        }

        // Apply category filter
        if (categoryFilter !== 'All') {
            list = list.filter(c => c.category === categoryFilter);
        }

        // Apply caught status filter
        if (statusFilter === 'uncaught') {
            list = list.filter(c => !caughtNames.has(c.name));
        } else if (statusFilter === 'caught') {
            list = list.filter(c => caughtNames.has(c.name));
        }

        // Sort
        if (sortBy === 'sell') {
            list = [...list].sort((a, b) => b.sell - a.sell);
        } else {
            list = [...list].sort((a, b) => a.name.localeCompare(b.name));
        }

        return list;
    }, [activeTab, availableNow, leavingThisMonth, comingNextMonth, calendarCreatures, searchQuery, categoryFilter, statusFilter, sortBy, caughtNames]);

    const site = typeof window !== 'undefined' ? window.location.origin : 'https://www.chopaeng.com';
    const pageTitle = 'ACNH Critter Availability Calendar — What Can I Catch Now? | Chopaeng';
    const pageDesc = `Real-time Animal Crossing critter availability for the ${isNorth ? 'Northern' : 'Southern'} Hemisphere. See which bugs, fish, and sea creatures are available right now, leaving soon, or coming next month.`;

    return (
        <>
            <Helmet>
                <title>{pageTitle}</title>
                <meta name="description" content={pageDesc} />
                <link rel="canonical" href={`${site}/critters`} />
                <meta property="og:title" content={pageTitle} />
                <meta property="og:description" content={pageDesc} />
                <meta property="og:image" content={`${site}/banner.png`} />
                <meta property="og:url" content={`${site}/critters`} />
                <meta property="og:type" content="website" />
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content={pageTitle} />
                <meta name="twitter:description" content={pageDesc} />
                <meta name="twitter:image" content={`${site}/banner.png`} />
            </Helmet>

            <div className="min-vh-100 nook-bg py-5">
                <div className="container py-4">
                    {/* Header */}
                    <div className="text-center mb-5 animate-up">
                        <span className="badge bg-info-subtle text-info border border-info-subtle rounded-pill px-3 py-2 fw-bold text-uppercase tracking-wider mb-2">
                            <i className="fa-solid fa-fish me-1" aria-hidden="true" /> Real-Time Critter Guide
                        </span>
                        <h1 className="display-5 fw-black text-dark ac-font mb-2">
                            What Can I Catch Now?
                        </h1>
                        <p className="lead text-muted mx-auto fw-bold mb-3" style={{ maxWidth: '640px' }}>
                            Track bugs, fish, and sea creatures available right now based on your active hemisphere and clock.
                        </p>

                        {/* Hemisphere Toggle */}
                        <div className="ac-nav-tabs-pill d-inline-flex">
                            <button
                                type="button"
                                className={`ac-tab-btn ${isNorth ? 'active' : ''}`}
                                onClick={() => { playChimeClick(); setHemisphere('north'); }}
                            >
                                <i className="fa-solid fa-snowflake me-1" aria-hidden="true" /> Northern
                            </button>
                            <button
                                type="button"
                                className={`ac-tab-btn ${!isNorth ? 'active' : ''}`}
                                onClick={() => { playChimeClick(); setHemisphere('south'); }}
                            >
                                <i className="fa-solid fa-sun me-1" aria-hidden="true" /> Southern
                            </button>
                        </div>
                    </div>

                    {/* Quick Stats */}
                    {!loading && (
                        <div className="row g-3 mb-4 animate-up">
                            <div className="col-6 col-md-4 col-lg">
                                <div className="ac-stat-card h-100">
                                    <div className="ac-stat-icon-wrapper ac-stat-icon-wrapper--green">
                                        <i className="fa-solid fa-clock" aria-hidden="true" />
                                    </div>
                                    <div className="ac-stat-number">{availableNow.length}</div>
                                    <div className="ac-stat-label">Available Now</div>
                                </div>
                            </div>
                            <div className="col-6 col-md-4 col-lg">
                                <div className="ac-stat-card h-100">
                                    <div className="ac-stat-icon-wrapper ac-stat-icon-wrapper--yellow">
                                        <i className="fa-solid fa-hourglass-end" aria-hidden="true" />
                                    </div>
                                    <div className="ac-stat-number">{leavingThisMonth.length}</div>
                                    <div className="ac-stat-label">Leaving Soon</div>
                                </div>
                            </div>
                            <div className="col-6 col-md-4 col-lg">
                                <div className="ac-stat-card h-100">
                                    <div className="ac-stat-icon-wrapper ac-stat-icon-wrapper--blue">
                                        <i className="fa-solid fa-arrow-right" aria-hidden="true" />
                                    </div>
                                    <div className="ac-stat-number">{comingNextMonth.length}</div>
                                    <div className="ac-stat-label">Coming {MONTH_NAMES[nextMonth - 1]}</div>
                                </div>
                            </div>
                            <div className="col-6 col-md-4 col-lg">
                                <div className="ac-stat-card h-100">
                                    <div className="ac-stat-icon-wrapper ac-stat-icon-wrapper--purple">
                                        <i className="fa-solid fa-paw" aria-hidden="true" />
                                    </div>
                                    <div className="ac-stat-number">{creatures.length}</div>
                                    <div className="ac-stat-label">Total Critters</div>
                                </div>
                            </div>
                            <div className="col-12 col-md-4 col-lg">
                                <div className="ac-stat-card h-100">
                                    <div className="d-flex align-items-center justify-content-between mb-1">
                                        <div className="ac-stat-icon-wrapper ac-stat-icon-wrapper--green">
                                            <i className="fa-solid fa-circle-check" aria-hidden="true" />
                                        </div>
                                        {user ? (
                                            <span
                                                className={`badge ${dbSynced ? 'bg-success-subtle text-success border border-success-subtle' : dbSyncing ? 'bg-warning-subtle text-warning border border-warning-subtle' : 'bg-light text-muted border'} rounded-pill`}
                                                style={{ fontSize: '0.62rem' }}
                                                title="Synced with ChoBot"
                                            >
                                                <i className={`fa-solid ${dbSyncing ? 'fa-spinner fa-spin' : 'fa-cloud-arrow-up'} me-1`} />
                                                {dbSyncing ? 'Syncing...' : 'ChoBot Cloud'}
                                            </span>
                                        ) : (
                                            <button
                                                type="button"
                                                className="badge bg-warning-subtle text-warning border border-warning-subtle rounded-pill text-decoration-none"
                                                style={{ fontSize: '0.62rem', cursor: 'pointer' }}
                                                onClick={() => {
                                                    window.dispatchEvent(new CustomEvent('chopaeng_auth_required', {
                                                        detail: {
                                                            action: 'Critterpedia',
                                                            message: 'Sign in with Discord to track your caught bugs, fish, and sea creatures across devices.'
                                                        }
                                                    }));
                                                }}
                                            >
                                                <i className="fa-solid fa-lock me-1" /> Auth Required
                                            </button>
                                        )}
                                    </div>
                                    <div className="ac-stat-number">{caughtCount} / {creatures.length}</div>
                                    <div className="ac-stat-label">Caught ({caughtPercentage}%)</div>
                                    <div className="progress mt-2" style={{ height: '5px', backgroundColor: '#e2e8f0', borderRadius: '4px' }}>
                                        <div
                                            className="progress-bar bg-success rounded"
                                            role="progressbar"
                                            style={{ width: `${caughtPercentage}%` }}
                                            aria-valuenow={caughtPercentage}
                                            aria-valuemin={0}
                                            aria-valuemax={100}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tab Navigation */}
                    <div className="text-center mb-4">
                        <div className="ac-nav-tabs-pill d-inline-flex flex-wrap justify-content-center" role="tablist">
                            {([
                                { id: 'now' as CritterTab, label: 'Available Now', icon: 'fa-clock', count: availableNow.length },
                                { id: 'leaving' as CritterTab, label: 'Leaving Soon', icon: 'fa-hourglass-end', count: leavingThisMonth.length },
                                { id: 'coming' as CritterTab, label: `Coming ${MONTH_NAMES[nextMonth - 1]}`, icon: 'fa-arrow-right', count: comingNextMonth.length },
                                { id: 'calendar' as CritterTab, label: 'Calendar', icon: 'fa-calendar', count: calendarCreatures.length },
                            ]).map((tab) => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    className={`ac-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                                    role="tab"
                                    aria-selected={activeTab === tab.id}
                                    onClick={() => { playChimeClick(); setActiveTab(tab.id); }}
                                >
                                    <i className={`fa-solid ${tab.icon}`} aria-hidden="true" />
                                    <span>{tab.label}</span>
                                    <span className="badge rounded-pill bg-white text-dark ms-1" style={{ fontSize: '0.65rem' }}>
                                        {loading ? '…' : tab.count}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>


                    {/* Filter Bar */}
                    <div className="ac-filter-bar mb-4">
                        <div className="row g-2 align-items-center">
                            <div className="col-12 col-md-4">
                                <div className="ac-search-input-group">
                                    <i className="fa-solid fa-magnifying-glass text-muted" aria-hidden="true" />
                                    <input
                                        type="text"
                                        className="ac-search-input"
                                        placeholder="Search critter name, location, weather..."
                                        value={searchQuery}
                                        aria-label="Search critters"
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                    {searchQuery && (
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-link text-muted p-0"
                                            onClick={() => setSearchQuery('')}
                                        >
                                            <i className="fa-solid fa-xmark" />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="col-6 col-md-3">
                                <select
                                    className="ac-select-pill"
                                    value={categoryFilter}
                                    aria-label="Filter by type"
                                    onChange={(e) => setCategoryFilter(e.target.value)}
                                >
                                    {categories.map(c => (
                                        <option key={c} value={c}>Type: {c}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-6 col-md-3">
                                <select
                                    className="ac-select-pill"
                                    value={statusFilter}
                                    aria-label="Filter by caught status"
                                    onChange={(e) => setStatusFilter(e.target.value as 'all' | 'uncaught' | 'caught')}
                                >
                                    <option value="all">Status: All Critters</option>
                                    <option value="uncaught">Status: Uncaught Only</option>
                                    <option value="caught">Status: Caught Only</option>
                                </select>
                            </div>
                            <div className="col-12 col-md-2">
                                <select
                                    className="ac-select-pill"
                                    value={sortBy}
                                    aria-label="Sort critters"
                                    onChange={(e) => setSortBy(e.target.value as 'name' | 'sell')}
                                >
                                    <option value="sell">Sort: Sell Price</option>
                                    <option value="name">Sort: Name A-Z</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    {loading ? (
                        <div className="text-center py-5" role="status" aria-live="polite">
                            <div className="spinner-border text-success mb-2" aria-hidden="true" />
                            <div className="fw-bold text-muted">Loading critter data...</div>
                        </div>
                    ) : activeTab === 'calendar' ? (
                        /* ── CALENDAR GRID VIEW ── */
                        <div className="critter-cal-wrapper animate-fade-in">
                            <div className="critter-cal-legend">
                                <span className="critter-cal-legend-item">
                                    <span className="critter-cal-dot critter-cal-dot--active" /> Available
                                </span>
                                <span className="critter-cal-legend-item">
                                    <span className="critter-cal-dot critter-cal-dot--current" /> This Month
                                </span>
                                <span className="critter-cal-legend-item">
                                    <span className="critter-cal-dot critter-cal-dot--leaving" /> Leaving Next Month
                                </span>
                                <span className="critter-cal-legend-item">
                                    <span className="critter-cal-dot critter-cal-dot--none" /> Unavailable
                                </span>
                                <span className="ms-auto tiny-text text-muted fw-bold">
                                    {creatures.filter(c => categoryFilter === 'All' || c.category === categoryFilter).length} critters &bull; {isNorth ? 'Northern' : 'Southern'} Hemisphere
                                </span>
                            </div>
                            <div className="critter-cal-table-wrap">
                                <table className="critter-cal-table">
                                    <thead>
                                        <tr>
                                            <th className="critter-cal-th-name">Critter</th>
                                            {MONTH_NAMES.map((m, mi) => (
                                                <th key={m} className={`critter-cal-th-month ${mi + 1 === currentMonth ? 'critter-cal-th-current' : ''}`}>
                                                    {m}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {creatures
                                            .filter(c => {
                                                if (categoryFilter !== 'All' && c.category !== categoryFilter) return false;
                                                if (statusFilter === 'uncaught' && caughtNames.has(c.name)) return false;
                                                if (statusFilter === 'caught' && !caughtNames.has(c.name)) return false;
                                                if (searchQuery.trim()) {
                                                    const q = searchQuery.toLowerCase();
                                                    return c.name.toLowerCase().includes(q) || c.whereHow.toLowerCase().includes(q) || c.category.toLowerCase().includes(q);
                                                }
                                                return true;
                                            })
                                            .sort((a, b) => sortBy === 'name' ? a.name.localeCompare(b.name) : b.sell - a.sell)
                                            .map((creature, idx) => (
                                                <tr key={`${creature.name}-${idx}`} className="critter-cal-row">
                                                    <td className="critter-cal-td-name">
                                                        <button
                                                            type="button"
                                                            className={`btn btn-link p-0 me-2 border-0 text-decoration-none ${caughtNames.has(creature.name) ? 'text-success' : 'text-muted opacity-50'}`}
                                                            style={{ fontSize: '1rem', lineHeight: 1 }}
                                                            title={!user ? 'Sign in with Discord to mark as caught' : caughtNames.has(creature.name) ? `${creature.name} caught! Click to unmark` : `Click to mark ${creature.name} as caught`}
                                                            onClick={() => { playChimeClick(); toggleCaught(creature.name); }}
                                                            aria-label={caughtNames.has(creature.name) ? `Unmark ${creature.name}` : `Mark ${creature.name} caught`}
                                                        >
                                                            <i className={`fa-solid ${caughtNames.has(creature.name) ? 'fa-circle-check' : !user ? 'fa-circle-dot' : 'fa-circle'}`} />
                                                        </button>
                                                        <img
                                                            src={creature.icon}
                                                            alt={creature.name}
                                                            className="critter-cal-icon"
                                                            onError={(e) => { (e.currentTarget as HTMLImageElement).src = FALLBACK_IMAGE; }}
                                                        />
                                                        <div className="critter-cal-name-info">
                                                            <span className="critter-cal-name">{creature.name}</span>
                                                            <span className="critter-cal-category">
                                                                <i className={`fa-solid ${CATEGORY_ICONS[creature.category] || 'fa-paw'} me-1`} aria-hidden="true" />
                                                                {creature.category}
                                                            </span>
                                                        </div>
                                                        <span className="critter-cal-price">
                                                            <i className="fa-solid fa-coins me-1" aria-hidden="true" />
                                                            {creature.sell.toLocaleString()}
                                                        </span>
                                                    </td>
                                                    {MONTH_NAMES.map((m, mi) => {
                                                        const avail = creature.months.includes(mi + 1);
                                                        const isCur = mi + 1 === currentMonth;
                                                        const isLeaving = avail && !creature.months.includes(mi + 2 > 12 ? 1 : mi + 2);
                                                        let cls = 'critter-cal-cell';
                                                        if (avail && isCur) cls += ' critter-cal-cell--current';
                                                        else if (avail && isLeaving) cls += ' critter-cal-cell--leaving';
                                                        else if (avail) cls += ' critter-cal-cell--active';
                                                        else cls += ' critter-cal-cell--none';
                                                        return (
                                                            <td key={m} className={cls} title={avail ? `${creature.name} available in ${m}` : undefined}>
                                                                {avail && <span className="critter-cal-pip" />}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))
                                        }
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : activeList.length === 0 ? (
                        <div className="ac-filter-bar text-center py-5 text-muted animate-fade-in" role="status" aria-live="polite">
                            <i className="fa-solid fa-fish-fins fs-1 mb-2 opacity-50 text-info" aria-hidden="true" />
                            <p className="fw-bold mb-0">
                                {activeTab === 'now' ? 'No critters available right now at this hour.' :
                                    activeTab === 'leaving' ? 'No critters are leaving after this month.' :
                                        `No new critters arriving in ${MONTH_NAMES[nextMonth - 1]}.`}
                            </p>
                        </div>
                    ) : (
                        <div className="row g-3 animate-fade-in">
                            {activeList.map((creature, idx) => (
                                <div key={`${creature.name}-${idx}`} className="col-6 col-md-4 col-lg-3">
                                    <div className={`ac-grid-card position-relative ${caughtNames.has(creature.name) ? 'opacity-75' : ''}`}>
                                        {/* Caught badge */}
                                        {caughtNames.has(creature.name) && (
                                            <span
                                                className="position-absolute top-0 start-0 badge bg-success text-white rounded-pill"
                                                style={{ fontSize: '0.6rem', margin: '6px', zIndex: 1 }}
                                                aria-label="Marked as caught"
                                            >
                                                <i className="fa-solid fa-check me-1" aria-hidden="true" /> Caught!
                                            </span>
                                        )}
                                        <div className="d-flex align-items-start justify-content-between mb-2">
                                            <div className="ac-card-img-frame m-0">
                                                <img
                                                    src={creature.icon}
                                                    alt={creature.name}
                                                    className="w-100 h-100 object-fit-contain"
                                                    onError={(e) => { (e.currentTarget as HTMLImageElement).src = FALLBACK_IMAGE; }}
                                                />
                                            </div>
                                            <span className="ac-card-price-badge">
                                                <i className="fa-solid fa-coins" aria-hidden="true" />
                                                {creature.sell.toLocaleString()}
                                            </span>
                                        </div>

                                        <h3 className="fw-black text-dark mb-1 text-truncate" title={creature.name} style={{ fontSize: '0.92rem' }}>
                                            {creature.name}
                                        </h3>

                                        <div className="d-flex flex-wrap gap-1 mb-2">
                                            <span className="badge bg-light text-muted border rounded-pill" style={{ fontSize: '0.68rem' }}>
                                                {creature.category}
                                            </span>
                                            <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill" style={{ fontSize: '0.68rem' }}>
                                                <i className="fa-solid fa-location-dot me-1" aria-hidden="true" />
                                                {creature.whereHow}
                                            </span>
                                        </div>

                                        <div className="tiny-text text-muted mb-2">
                                            <div className="mb-1">
                                                <i className="fa-solid fa-clock me-1 text-info" aria-hidden="true" />
                                                {creature.timeLabel.join(', ') || 'All day'}
                                            </div>
                                            <div>
                                                <i className="fa-solid fa-calendar-days me-1 text-success" aria-hidden="true" />
                                                {creature.monthsLabel.join(', ') || 'Year-round'}
                                            </div>
                                            {creature.weather !== 'Any' && (
                                                <div className="mt-1">
                                                    <i className="fa-solid fa-cloud-sun me-1 text-warning" aria-hidden="true" />
                                                    {creature.weather}
                                                </div>
                                            )}
                                            {creature.shadow && (
                                                <div className="mt-1">
                                                    <i className="fa-solid fa-water me-1 text-primary" aria-hidden="true" />
                                                    Shadow: {creature.shadow}
                                                </div>
                                            )}
                                        </div>

                                        {creature.catchPhrase && (
                                            <div className="border-top pt-2 mt-auto">
                                                <p className="text-muted fst-italic mb-0" style={{ fontSize: '0.72rem', lineHeight: 1.4 }}>
                                                    "{creature.catchPhrase}"
                                                </p>
                                            </div>
                                        )}

                                        <div className="ac-heatmap-track" title="Monthly availability">
                                            {MONTH_NAMES.map((m, mIdx) => {
                                                const isAvail = creature.months.includes(mIdx + 1);
                                                const isCurrent = mIdx + 1 === currentMonth;
                                                const className = isAvail
                                                    ? (isCurrent ? 'ac-heatmap-segment--current' : 'ac-heatmap-segment--active')
                                                    : 'ac-heatmap-segment--inactive';
                                                return (
                                                    <div
                                                        key={m}
                                                        className={`ac-heatmap-segment ${className}`}
                                                        title={`${m}: ${isAvail ? 'Available' : 'Not available'}`}
                                                    />
                                                );
                                            })}
                                        </div>

                                        {/* Mark as Caught button */}
                                        <button
                                            type="button"
                                            className={`btn btn-xs rounded-pill fw-bold w-100 mt-2 ${caughtNames.has(creature.name)
                                                    ? 'btn-success text-white'
                                                    : !user
                                                        ? 'btn-outline-secondary'
                                                        : 'btn-outline-success'
                                                }`}
                                            style={{ fontSize: '0.72rem', padding: '3px 10px' }}
                                            onClick={() => { playChimeClick(); toggleCaught(creature.name); }}
                                            aria-pressed={caughtNames.has(creature.name)}
                                            aria-label={caughtNames.has(creature.name) ? `Unmark ${creature.name} as caught` : `Mark ${creature.name} as caught`}
                                            title={!user ? 'Sign in with Discord to mark as caught' : undefined}
                                        >
                                            <i className={`fa-solid ${caughtNames.has(creature.name) ? 'fa-check' : !user ? 'fa-lock' : 'fa-net-wired'} me-1`} aria-hidden="true" />
                                            {caughtNames.has(creature.name) ? 'Caught!' : !user ? 'Sign In to Catch' : 'Mark Caught'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Legend */}
                    {!loading && activeList.length > 0 && (
                        <div className="mt-4 text-center">
                            <div className="ac-nav-tabs-pill d-inline-flex align-items-center gap-3 px-4 py-2">
                                <span className="tiny-text text-muted fw-bold">
                                    <span className="d-inline-block rounded me-1" style={{ width: 10, height: 10, backgroundColor: '#16a34a' }} />
                                    Current Month
                                </span>
                                <span className="tiny-text text-muted fw-bold">
                                    <span className="d-inline-block rounded me-1" style={{ width: 10, height: 10, backgroundColor: '#86efac' }} />
                                    Available
                                </span>
                                <span className="tiny-text text-muted fw-bold">
                                    <span className="d-inline-block rounded me-1" style={{ width: 10, height: 10, backgroundColor: '#e2e8f0' }} />
                                    Unavailable
                                </span>
                            </div>
                            <div className="mt-2 tiny-text text-muted fw-bold">
                                Showing {activeList.length} critters for {isNorth ? 'Northern' : 'Southern'} Hemisphere
                            </div>
                        </div>
                    )}

                    {/* Back to Catalogue Link */}
                    <div className="text-center mt-5">
                        <Link
                            to="/catalog"
                            className="btn btn-nook text-white rounded-pill px-4 py-2 fw-bold shadow-2xs"
                            onClick={() => playChimeClick()}
                        >
                            <i className="fa-solid fa-boxes-stacked me-2" aria-hidden="true" />
                            Browse Full Catalogue
                        </Link>
                    </div>
                </div>
            </div>
        </>
    );
};

export default Critters;
