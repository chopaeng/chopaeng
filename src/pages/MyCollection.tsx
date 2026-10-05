import React, { useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useCollection } from '../hooks/useCollection';
import { useCatalogData } from '../hooks/useCatalogData';
import { useCaughtCritters, type CreatureItem } from '../hooks/useCaughtCritters';
import { useAuth } from '../context/useAuth';
import { RequireAuthView } from '../components/RequireAuthView';
import { playChimeClick } from '../utils/kkAudioSynthesizer';
import type { CatalogEntity } from '../data/commandBuilderData';

const FALLBACK_IMAGE = "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23f1f3f5'/%3E%3Cpath d='M30 65 L45 45 L58 58 L68 42 L75 65 Z' fill='%23ced4da'/%3E%3Ccircle cx='38' cy='35' r='7' fill='%23ced4da'/%3E%3C/svg%3E";

interface CategoryProgress {
    name: string;
    collected: number;
    total: number;
    percentage: number;
}

const ProgressRing: React.FC<{ percentage: number; size?: number; strokeWidth?: number; color?: string }> = ({
    percentage, size = 80, strokeWidth = 6, color = '#16a34a'
}) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="d-block mx-auto">
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={strokeWidth} />
            <circle
                cx={size / 2} cy={size / 2} r={radius} fill="none"
                stroke={color} strokeWidth={strokeWidth}
                strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                style={{ transition: 'stroke-dashoffset 0.5s ease' }}
            />
            <text x="50%" y="50%" textAnchor="middle" dy="0.35em" className="fw-black" style={{ fontSize: size * 0.22, fill: 'var(--text-dark, #1e293b)' }}>
                {Math.round(percentage)}%
            </text>
        </svg>
    );
};

const getCritterBadgeClass = (category: string) => {
    switch (category) {
        case 'Fish':
            return 'bg-info-subtle text-info border border-info-subtle';
        case 'Bugs':
            return 'bg-success-subtle text-success border border-success-subtle';
        case 'Sea Creatures':
            return 'bg-primary-subtle text-primary border border-primary-subtle';
        default:
            return 'bg-secondary-subtle text-secondary border border-secondary-subtle';
    }
};

const getCritterIcon = (category: string) => {
    switch (category) {
        case 'Fish':
            return 'fa-fish';
        case 'Bugs':
            return 'fa-bug';
        case 'Sea Creatures':
            return 'fa-shrimp';
        default:
            return 'fa-paw';
    }
};

const MyCollection: React.FC = () => {
    const { user, loading: authLoading } = useAuth();
    const { collectedCount, isCollected, toggleCollected, clearCollection, exportCollection, importCollection, isSyncingDb } = useCollection();
    const { data: catalogData, isLoading: catalogLoading } = useCatalogData();
    const caughtCritters = useCaughtCritters();

    // Mode: Catalog items vs Caught Critters
    const [collectionMode, setCollectionMode] = useState<'catalog' | 'critters'>('catalog');
    const [showMissing, setShowMissing] = useState(false);

    // Catalog filters
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [importText, setImportText] = useState('');
    const [showImportModal, setShowImportModal] = useState(false);
    const [importStatus, setImportStatus] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Critters filters
    const [critterCategory, setCritterCategory] = useState<'All' | 'Fish' | 'Bugs' | 'Sea Creatures'>('All');
    const [critterSortBy, setCritterSortBy] = useState<'sell' | 'name'>('sell');

    // All items from catalogue
    const allItems = useMemo<CatalogEntity[]>(() => {
        if (!catalogData) return [];
        return [...(catalogData.items || []), ...(catalogData.villagers || [])];
    }, [catalogData]);

    // Category breakdown for catalog
    const categoryProgress = useMemo<CategoryProgress[]>(() => {
        const catMap = new Map<string, { collected: number; total: number }>();

        allItems.forEach(item => {
            const cat = item.category || 'Uncategorized';
            if (!catMap.has(cat)) catMap.set(cat, { collected: 0, total: 0 });
            const entry = catMap.get(cat)!;
            entry.total++;
            if (isCollected(item.id)) entry.collected++;
        });

        return Array.from(catMap.entries())
            .map(([name, data]) => ({
                name,
                collected: data.collected,
                total: data.total,
                percentage: data.total > 0 ? (data.collected / data.total) * 100 : 0,
            }))
            .sort((a, b) => b.percentage - a.percentage);
    }, [allItems, isCollected]);

    // Overall catalog progress
    const overallPercentage = allItems.length > 0 ? (collectedCount / allItems.length) * 100 : 0;

    // Categories for catalog filter
    const categories = useMemo(() => {
        const cats = new Set<string>();
        allItems.forEach(item => cats.add(item.category || 'Uncategorized'));
        return ['All', ...Array.from(cats).sort()];
    }, [allItems]);

    // Filtered displayed catalog items
    const displayedItems = useMemo(() => {
        let list = allItems;

        if (showMissing) {
            list = list.filter(item => !isCollected(item.id));
        } else {
            list = list.filter(item => isCollected(item.id));
        }

        if (selectedCategory !== 'All') {
            list = list.filter(item => (item.category || 'Uncategorized') === selectedCategory);
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(item => item.name.toLowerCase().includes(q));
        }

        return list;
    }, [allItems, showMissing, isCollected, selectedCategory, searchQuery]);

    // Filtered displayed critters
    const displayedCritters = useMemo(() => {
        let list = caughtCritters.creatures;

        if (showMissing) {
            list = list.filter(c => !caughtCritters.isCaught(c.name));
        } else {
            list = list.filter(c => caughtCritters.isCaught(c.name));
        }

        if (critterCategory !== 'All') {
            list = list.filter(c => c.category === critterCategory);
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(c =>
                c.name.toLowerCase().includes(q) ||
                (c.whereHow && c.whereHow.toLowerCase().includes(q)) ||
                (c.weather && c.weather.toLowerCase().includes(q))
            );
        }

        if (critterSortBy === 'sell') {
            list = [...list].sort((a, b) => b.sell - a.sell);
        } else {
            list = [...list].sort((a, b) => a.name.localeCompare(b.name));
        }

        return list;
    }, [caughtCritters.creatures, caughtCritters.isCaught, showMissing, critterCategory, searchQuery, critterSortBy]);

    const handleExport = () => {
        const json = exportCollection();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'chopaeng_collection.json';
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleImport = () => {
        const success = importCollection(importText);
        setImportStatus(success ? 'Collection imported successfully!' : 'Invalid JSON data. Please check the format.');
        if (success) {
            setShowImportModal(false);
            setImportText('');
        }
    };

    const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const text = ev.target?.result as string;
            const success = importCollection(text);
            setImportStatus(success ? 'Collection imported from file!' : 'Invalid file data.');
        };
        reader.readAsText(file);
    };

    const site = typeof window !== 'undefined' ? window.location.origin : 'https://www.chopaeng.com';

    if (!user && !authLoading) {
        return (
            <>
                <Helmet>
                    <title>My Collection Tracker | Chopaeng</title>
                    <meta name="description" content="Track your ACNH collection progress. Requires Discord login to save to ChoBot." />
                    <link rel="canonical" href={`${site}/my-collection`} />
                </Helmet>
                <div className="min-vh-100 nook-bg py-5">
                    <RequireAuthView
                        title="My Collection Tracker"
                        description="Sign in with your Discord account to view your catalog collection, track your caught critters, and automatically save your progress to ChoBot."
                        icon="fa-box-archive"
                        badge="ChoBot Cloud Collection"
                        returnPath="/my-collection"
                    />
                </div>
            </>
        );
    }

    const isGlobalSyncing = isSyncingDb || caughtCritters.dbSyncing;

    return (
        <>
            <Helmet>
                <title>My Collection Tracker | Chopaeng</title>
                <meta name="description" content="Track your ACNH collection progress across all catalog items, villagers, and caught fish, bugs, and sea creatures. See completion percentages and find missing items." />
                <link rel="canonical" href={`${site}/my-collection`} />
            </Helmet>

            <div className="min-vh-100 nook-bg py-5">
                <div className="container py-4">
                    {/* Header */}
                    <div className="text-center mb-4 animate-up">
                        <div className="d-flex align-items-center justify-content-center gap-2 mb-2 flex-wrap">
                            <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-3 py-2 fw-bold text-uppercase tracking-wider">
                                <i className="fa-solid fa-clipboard-check me-1" aria-hidden="true" /> Personal Tracker
                            </span>
                            <span className="badge bg-light text-success border border-success-subtle rounded-pill px-3 py-2 fw-bold d-inline-flex align-items-center gap-1.5 shadow-2xs">
                                <i className={isGlobalSyncing ? "fa-solid fa-spinner fa-spin text-primary" : "fa-solid fa-cloud-arrow-up text-success"} />
                                <span>{isGlobalSyncing ? "Syncing with ChoBot..." : "Saved to ChoBot"}</span>
                            </span>
                        </div>
                        <h1 className="display-5 fw-black text-dark ac-font mb-2">
                            My Collection
                        </h1>
                        <p className="lead text-muted mx-auto fw-bold mb-3" style={{ maxWidth: '640px' }}>
                            Track your ACNH collection progress. Mark items and critters as caught and see completion percentages across all categories.
                        </p>

                        {/* Top-Level Mode Selector Tabs: Catalog vs Caught Critters */}
                        <div className="d-inline-flex flex-wrap align-items-center justify-content-center gap-2 mb-3">
                            <div className="ac-nav-tabs-pill d-inline-flex">
                                <button
                                    type="button"
                                    className={`ac-tab-btn ${collectionMode === 'catalog' ? 'active' : ''}`}
                                    onClick={() => { playChimeClick(); setCollectionMode('catalog'); }}
                                >
                                    <i className="fa-solid fa-boxes-stacked me-1.5" />
                                    <span>Catalog & Items</span>
                                    <span className="badge rounded-pill bg-white text-dark ms-1.5" style={{ fontSize: '0.65rem' }}>
                                        {collectedCount}
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    className={`ac-tab-btn ${collectionMode === 'critters' ? 'active' : ''}`}
                                    onClick={() => { playChimeClick(); setCollectionMode('critters'); }}
                                >
                                    <i className="fa-solid fa-paw me-1.5 text-warning" />
                                    <span>Caught Critters</span>
                                    <span className="badge rounded-pill bg-white text-dark ms-1.5" style={{ fontSize: '0.65rem' }}>
                                        {caughtCritters.caughtCount}/200
                                    </span>
                                </button>
                            </div>

                            {collectionMode === 'catalog' && (
                                <div className="d-inline-flex align-items-center gap-2 ms-sm-2">
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-secondary bg-white rounded-pill px-3 py-2 fw-bold shadow-2xs"
                                        onClick={() => { playChimeClick(); handleExport(); }}
                                        title="Export collection to JSON"
                                    >
                                        <i className="fa-solid fa-download me-1" aria-hidden="true" /> Export
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-secondary bg-white rounded-pill px-3 py-2 fw-bold shadow-2xs"
                                        onClick={() => { playChimeClick(); setShowImportModal(true); }}
                                        title="Import collection from JSON"
                                    >
                                        <i className="fa-solid fa-upload me-1" aria-hidden="true" /> Import
                                    </button>
                                </div>
                            )}

                            {collectionMode === 'critters' && (
                                <div className="d-inline-flex align-items-center gap-2 ms-sm-2">
                                    <div className="ac-nav-tabs-pill d-inline-flex" title="Select your active island hemisphere">
                                        <button
                                            type="button"
                                            className={`ac-tab-btn ${caughtCritters.isNorth ? 'active' : ''}`}
                                            onClick={() => { playChimeClick(); caughtCritters.setHemisphere('north'); }}
                                        >
                                            <i className="fa-solid fa-snowflake me-1" /> North
                                        </button>
                                        <button
                                            type="button"
                                            className={`ac-tab-btn ${caughtCritters.isSouth ? 'active' : ''}`}
                                            onClick={() => { playChimeClick(); caughtCritters.setHemisphere('south'); }}
                                        >
                                            <i className="fa-solid fa-sun me-1" /> South
                                        </button>
                                    </div>
                                    <Link
                                        to="/critters"
                                        className="btn btn-sm btn-outline-success bg-white rounded-pill px-3 py-2 fw-bold shadow-2xs text-decoration-none"
                                        onClick={() => playChimeClick()}
                                    >
                                        <i className="fa-solid fa-calendar-days me-1" /> Spawn Times
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Mode 1: Catalog & Items Progress Bar ── */}
                    {collectionMode === 'catalog' && !catalogLoading && (
                        <div className="ac-filter-bar mb-4 p-4 text-center animate-up">
                            <div className="row align-items-center">
                                <div className="col-12 col-md-4 mb-4 mb-md-0 border-end-md">
                                    <ProgressRing percentage={overallPercentage} size={128} strokeWidth={9} color="#16a34a" />
                                    <div className="mt-2 fw-black text-dark" style={{ fontSize: '1.1rem' }}>Catalog Progress</div>
                                    <div className="tiny-text text-muted fw-bold">
                                        {collectedCount.toLocaleString()} / {allItems.length.toLocaleString()} items ({Math.round(overallPercentage)}%)
                                    </div>
                                </div>
                                <div className="col-12 col-md-8">
                                    <div className="row g-2">
                                        {/* Highlight card for Caught Critters */}
                                        <div className="col-6 col-lg-3">
                                            <div
                                                className="ac-stat-card p-2 text-center border-warning-subtle shadow-2xs hover-shadow-sm cursor-pointer transition-all"
                                                style={{ minHeight: '120px', cursor: 'pointer' }}
                                                onClick={() => { playChimeClick(); setCollectionMode('critters'); }}
                                                title="Click to view Caught Critters tracker"
                                            >
                                                <ProgressRing percentage={caughtCritters.stats.overallPercentage} size={50} strokeWidth={4} color="#f59e0b" />
                                                <div className="tiny-text fw-black text-dark text-truncate mt-1">
                                                    🐾 Critters
                                                </div>
                                                <div className="tiny-text text-warning fw-bold" style={{ fontSize: '0.65rem' }}>
                                                    {caughtCritters.caughtCount} / 200
                                                </div>
                                            </div>
                                        </div>

                                        {categoryProgress.slice(0, 7).map(cat => (
                                            <div key={cat.name} className="col-6 col-lg-3">
                                                <div className="ac-stat-card p-2 text-center" style={{ minHeight: '120px' }}>
                                                    <ProgressRing percentage={cat.percentage} size={50} strokeWidth={4} color="var(--nook-green)" />
                                                    <div className="tiny-text fw-black text-dark text-truncate mt-1" title={cat.name}>
                                                        {cat.name}
                                                    </div>
                                                    <div className="tiny-text text-muted fw-bold" style={{ fontSize: '0.65rem' }}>
                                                        {cat.collected}/{cat.total}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Mode 2: Caught Critters Progress Bar ── */}
                    {collectionMode === 'critters' && !caughtCritters.loading && (
                        <div className="ac-filter-bar mb-4 p-4 text-center animate-up">
                            <div className="row align-items-center">
                                <div className="col-12 col-md-4 mb-4 mb-md-0 border-end-md">
                                    <ProgressRing
                                        percentage={caughtCritters.stats.overallPercentage}
                                        size={128}
                                        strokeWidth={9}
                                        color="#f59e0b"
                                    />
                                    <div className="mt-2 fw-black text-dark" style={{ fontSize: '1.1rem' }}>Critterpedia Progress</div>
                                    <div className="tiny-text text-muted fw-bold">
                                        {caughtCritters.caughtCount} / {caughtCritters.stats.totalCount} caught ({Math.round(caughtCritters.stats.overallPercentage)}%)
                                    </div>
                                    <div className="badge bg-light text-muted border rounded-pill mt-2 px-2.5 py-1 x-small fw-bold">
                                        <i className="fa-solid fa-earth-americas me-1 text-primary" />
                                        {caughtCritters.isNorth ? 'Northern Hemisphere' : 'Southern Hemisphere'}
                                    </div>
                                </div>
                                <div className="col-12 col-md-8">
                                    <div className="row g-2">
                                        {/* Fish Breakdown */}
                                        <div className="col-12 col-sm-4">
                                            <div className="ac-stat-card p-3 text-center h-100">
                                                <div className="d-flex align-items-center justify-content-center gap-1.5 mb-2">
                                                    <span className="badge bg-info-subtle text-info border border-info-subtle rounded-pill px-2 py-0.5 x-small fw-bold">
                                                        <i className="fa-solid fa-fish me-1" /> Fish
                                                    </span>
                                                </div>
                                                <ProgressRing percentage={caughtCritters.stats.fish.percentage} size={54} strokeWidth={5} color="#0284c7" />
                                                <div className="fw-black text-dark mt-2" style={{ fontSize: '0.95rem' }}>
                                                    {caughtCritters.stats.fish.caught} / {caughtCritters.stats.fish.total}
                                                </div>
                                                <div className="tiny-text text-muted fw-bold">
                                                    {Math.round(caughtCritters.stats.fish.percentage)}% Completed
                                                </div>
                                            </div>
                                        </div>

                                        {/* Bugs Breakdown */}
                                        <div className="col-12 col-sm-4">
                                            <div className="ac-stat-card p-3 text-center h-100">
                                                <div className="d-flex align-items-center justify-content-center gap-1.5 mb-2">
                                                    <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-2 py-0.5 x-small fw-bold">
                                                        <i className="fa-solid fa-bug me-1" /> Bugs
                                                    </span>
                                                </div>
                                                <ProgressRing percentage={caughtCritters.stats.bugs.percentage} size={54} strokeWidth={5} color="#16a34a" />
                                                <div className="fw-black text-dark mt-2" style={{ fontSize: '0.95rem' }}>
                                                    {caughtCritters.stats.bugs.caught} / {caughtCritters.stats.bugs.total}
                                                </div>
                                                <div className="tiny-text text-muted fw-bold">
                                                    {Math.round(caughtCritters.stats.bugs.percentage)}% Completed
                                                </div>
                                            </div>
                                        </div>

                                        {/* Sea Creatures Breakdown */}
                                        <div className="col-12 col-sm-4">
                                            <div className="ac-stat-card p-3 text-center h-100">
                                                <div className="d-flex align-items-center justify-content-center gap-1.5 mb-2">
                                                    <span className="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill px-2 py-0.5 x-small fw-bold">
                                                        <i className="fa-solid fa-shrimp me-1" /> Sea Creatures
                                                    </span>
                                                </div>
                                                <ProgressRing percentage={caughtCritters.stats.sea.percentage} size={54} strokeWidth={5} color="#7c3aed" />
                                                <div className="fw-black text-dark mt-2" style={{ fontSize: '0.95rem' }}>
                                                    {caughtCritters.stats.sea.caught} / {caughtCritters.stats.sea.total}
                                                </div>
                                                <div className="tiny-text text-muted fw-bold">
                                                    {Math.round(caughtCritters.stats.sea.percentage)}% Completed
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Actions & Tab Switcher Bar */}
                    <div className="ac-filter-bar mb-4">
                        <div className="d-flex flex-wrap gap-2 align-items-center justify-content-between">
                            <div className="ac-nav-tabs-pill d-inline-flex">
                                <button
                                    type="button"
                                    className={`ac-tab-btn ${!showMissing ? 'active' : ''}`}
                                    onClick={() => { playChimeClick(); setShowMissing(false); }}
                                >
                                    <i className="fa-solid fa-circle-check" aria-hidden="true" />
                                    <span>{collectionMode === 'catalog' ? 'Collected' : 'Caught'}</span>
                                    <span className="badge rounded-pill bg-white text-dark ms-1" style={{ fontSize: '0.65rem' }}>
                                        {collectionMode === 'catalog' ? collectedCount : caughtCritters.caughtCount}
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    className={`ac-tab-btn ${showMissing ? 'active' : ''}`}
                                    onClick={() => { playChimeClick(); setShowMissing(true); }}
                                >
                                    <i className="fa-solid fa-circle-xmark" aria-hidden="true" />
                                    <span>{collectionMode === 'catalog' ? 'Missing' : 'Uncaught'}</span>
                                    <span className="badge rounded-pill bg-white text-dark ms-1" style={{ fontSize: '0.65rem' }}>
                                        {collectionMode === 'catalog'
                                            ? (allItems.length - collectedCount)
                                            : (caughtCritters.stats.totalCount - caughtCritters.caughtCount)}
                                    </span>
                                </button>
                            </div>

                            {collectionMode === 'catalog' && collectedCount > 0 && (
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger rounded-pill px-3 fw-bold"
                                    onClick={() => {
                                        if (confirm('Clear all collected items? This cannot be undone.')) {
                                            clearCollection();
                                        }
                                    }}
                                >
                                    <i className="fa-solid fa-trash me-1" aria-hidden="true" /> Clear All
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Filter & Search Bar */}
                    <div className="ac-filter-bar mb-4">
                        <div className="row g-2 align-items-center">
                            <div className="col-12 col-md-7">
                                <div className="ac-search-input-group">
                                    <i className="fa-solid fa-magnifying-glass text-muted" aria-hidden="true" />
                                    <input
                                        type="text"
                                        className="ac-search-input"
                                        placeholder={collectionMode === 'catalog' ? "Search your catalog collection..." : "Search critter name, location, weather..."}
                                        value={searchQuery}
                                        aria-label="Search collection"
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
                            <div className="col-12 col-md-5">
                                {collectionMode === 'catalog' ? (
                                    <select
                                        className="ac-select-pill"
                                        value={selectedCategory}
                                        aria-label="Filter by category"
                                        onChange={(e) => setSelectedCategory(e.target.value)}
                                    >
                                        {categories.map(c => (
                                            <option key={c} value={c}>Category: {c}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <div className="d-flex gap-2">
                                        <select
                                            className="ac-select-pill flex-grow-1"
                                            value={critterCategory}
                                            aria-label="Filter critter type"
                                            onChange={(e) => setCritterCategory(e.target.value as any)}
                                        >
                                            <option value="All">All Types (200)</option>
                                            <option value="Fish">Fish (80)</option>
                                            <option value="Bugs">Bugs (80)</option>
                                            <option value="Sea Creatures">Sea Creatures (40)</option>
                                        </select>
                                        <select
                                            className="ac-select-pill flex-shrink-0"
                                            style={{ width: '130px' }}
                                            value={critterSortBy}
                                            aria-label="Sort critters"
                                            onChange={(e) => setCritterSortBy(e.target.value as any)}
                                        >
                                            <option value="sell">Sort: Price</option>
                                            <option value="name">Sort: Name</option>
                                        </select>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── Content View 1: Catalog Items Grid ── */}
                    {collectionMode === 'catalog' && (
                        <>
                            {catalogLoading ? (
                                <div className="text-center py-5" role="status" aria-live="polite">
                                    <div className="spinner-border text-success mb-2" aria-hidden="true" />
                                    <div className="fw-bold text-muted">Loading collection items...</div>
                                </div>
                            ) : displayedItems.length === 0 ? (
                                <div className="ac-filter-bar text-center py-5 text-muted animate-fade-in">
                                    <i className={`fa-solid ${showMissing ? 'fa-trophy text-warning' : 'fa-box-open text-muted'} fs-1 mb-2 opacity-50`} aria-hidden="true" />
                                    <p className="fw-bold mb-3">
                                        {showMissing
                                            ? (collectedCount === allItems.length ? 'Congratulations! You have collected everything in the catalog!' : 'No missing items match your filter.')
                                            : (collectedCount === 0 ? 'You haven\'t collected any catalog items yet. Start by browsing the catalogue!' : 'No collected items match your filter.')}
                                    </p>
                                    {collectedCount === 0 && (
                                        <Link
                                            to="/catalog"
                                            className="btn btn-nook text-white rounded-pill px-4 py-2 fw-bold shadow-2xs"
                                            onClick={() => playChimeClick()}
                                        >
                                            <i className="fa-solid fa-boxes-stacked me-2" aria-hidden="true" />
                                            Browse Catalogue
                                        </Link>
                                    )}
                                </div>
                            ) : (
                                <>
                                    <div className="d-flex align-items-center justify-content-between mb-3 px-1">
                                        <span className="tiny-text fw-bold text-muted">
                                            Showing <strong>{displayedItems.length}</strong> {showMissing ? 'missing' : 'collected'} items
                                        </span>
                                    </div>
                                    <div className="row g-3 animate-fade-in">
                                        {displayedItems.slice(0, 48).map((item) => {
                                            const collected = isCollected(item.id);
                                            return (
                                                <div key={item.id} className="col-6 col-md-4 col-lg-3">
                                                    <div className={`ac-grid-card text-center ${collected ? 'ac-grid-card--collected' : ''}`}>
                                                        <div className="ac-card-img-frame">
                                                            <img
                                                                src={item.image || FALLBACK_IMAGE}
                                                                alt={item.name}
                                                                className="w-100 h-100 object-fit-contain"
                                                                onError={(e) => { (e.currentTarget as HTMLImageElement).src = FALLBACK_IMAGE; }}
                                                            />
                                                        </div>
                                                        <h3 className="fw-black text-dark mb-1 text-truncate" title={item.name} style={{ fontSize: '0.88rem' }}>
                                                            {item.name}
                                                        </h3>
                                                        <span className="badge bg-light text-muted border rounded-pill x-small mb-3">
                                                            {item.category || 'General'}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            className={`btn btn-xs rounded-pill fw-bold mt-auto ${collected ? 'btn-success text-white shadow-sm' : 'btn-outline-success'}`}
                                                            onClick={(e) => { playChimeClick(); toggleCollected(item.id, e); }}
                                                        >
                                                            <i className={`fa-solid ${collected ? 'fa-check' : 'fa-plus'} me-1`} aria-hidden="true" />
                                                            {collected ? 'Collected' : 'Mark Collected'}
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {displayedItems.length > 48 && (
                                        <div className="text-center mt-4">
                                            <span className="tiny-text fw-bold text-muted bg-white px-3 py-2 rounded-pill border shadow-2xs">
                                                Showing 48 of {displayedItems.length} items. Narrow with search or category filter.
                                            </span>
                                        </div>
                                    )}
                                </>
                            )}
                        </>
                    )}

                    {/* ── Content View 2: Caught Critters Grid ── */}
                    {collectionMode === 'critters' && (
                        <>
                            {caughtCritters.loading ? (
                                <div className="text-center py-5" role="status" aria-live="polite">
                                    <div className="spinner-border text-success mb-2" aria-hidden="true" />
                                    <div className="fw-bold text-muted">Loading Critterpedia records...</div>
                                </div>
                            ) : displayedCritters.length === 0 ? (
                                <div className="ac-filter-bar text-center py-5 text-muted animate-fade-in">
                                    <i className={`fa-solid ${showMissing ? 'fa-trophy text-warning' : 'fa-paw text-muted'} fs-1 mb-2 opacity-50`} aria-hidden="true" />
                                    <p className="fw-bold mb-3">
                                        {showMissing
                                            ? (caughtCritters.caughtCount === caughtCritters.stats.totalCount
                                                ? 'Incredible! You have caught every single critter in Animal Crossing!'
                                                : 'No uncaught critters match your current search/filter.')
                                            : (caughtCritters.caughtCount === 0
                                                ? 'You have not marked any critters as caught yet. Start tracking your museum catches!'
                                                : 'No caught critters match your current search/filter.')}
                                    </p>
                                    <Link
                                        to="/critters"
                                        className="btn btn-nook text-white rounded-pill px-4 py-2 fw-bold shadow-2xs"
                                        onClick={() => playChimeClick()}
                                    >
                                        <i className="fa-solid fa-clock me-2" aria-hidden="true" />
                                        What Can I Catch Right Now?
                                    </Link>
                                </div>
                            ) : (
                                <>
                                    <div className="d-flex align-items-center justify-content-between mb-3 px-1 flex-wrap gap-2">
                                        <span className="tiny-text fw-bold text-muted">
                                            Showing <strong>{displayedCritters.length}</strong> {showMissing ? 'uncaught' : 'caught'} critters ({critterCategory})
                                        </span>
                                        <span className="tiny-text fw-bold text-muted">
                                            Hemisphere: <strong className="text-dark">{caughtCritters.isNorth ? 'Northern' : 'Southern'}</strong>
                                        </span>
                                    </div>
                                    <div className="row g-3 animate-fade-in">
                                        {displayedCritters.map((critter: CreatureItem) => {
                                            const caught = caughtCritters.isCaught(critter.name);
                                            return (
                                                <div key={critter.id} className="col-6 col-md-4 col-lg-3">
                                                    <div className={`ac-grid-card text-center ${caught ? 'ac-grid-card--collected' : ''}`}>
                                                        <div className="ac-card-img-frame position-relative">
                                                            <img
                                                                src={critter.icon || FALLBACK_IMAGE}
                                                                alt={critter.name}
                                                                className="w-100 h-100 object-fit-contain"
                                                                onError={(e) => { (e.currentTarget as HTMLImageElement).src = FALLBACK_IMAGE; }}
                                                            />
                                                            {caught && (
                                                                <span
                                                                    className="position-absolute top-0 end-0 badge bg-success text-white rounded-circle p-1 shadow-2xs"
                                                                    title="Caught"
                                                                    style={{ width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem' }}
                                                                >
                                                                    <i className="fa-solid fa-check" />
                                                                </span>
                                                            )}
                                                        </div>
                                                        <h3 className="fw-black text-dark mb-1 text-truncate" title={critter.name} style={{ fontSize: '0.88rem' }}>
                                                            {critter.name}
                                                        </h3>
                                                        <div className="d-flex align-items-center justify-content-center gap-1 mb-2 flex-wrap">
                                                            <span className={`badge rounded-pill x-small ${getCritterBadgeClass(critter.category)}`}>
                                                                <i className={`fa-solid ${getCritterIcon(critter.category)} me-1`} />
                                                                {critter.category}
                                                            </span>
                                                            {critter.sell > 0 && (
                                                                <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle rounded-pill x-small fw-bold">
                                                                    💰 {critter.sell.toLocaleString()}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="tiny-text text-muted text-truncate mb-3 px-1" title={`${critter.whereHow} · ${critter.weather}`}>
                                                            {critter.whereHow}
                                                        </div>
                                                        <button
                                                            type="button"
                                                            className={`btn btn-xs rounded-pill fw-bold mt-auto ${caught ? 'btn-success text-white shadow-sm' : 'btn-outline-success'}`}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                playChimeClick();
                                                                caughtCritters.toggleCaught(critter.name);
                                                            }}
                                                        >
                                                            <i className={`fa-solid ${caught ? 'fa-check' : 'fa-plus'} me-1`} aria-hidden="true" />
                                                            {caught ? 'Caught' : 'Mark Caught'}
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                        </>
                    )}

                    {/* Import Modal */}
                    {showImportModal && (
                        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ zIndex: 1060, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
                            <div className="ac-filter-bar p-4 m-3 shadow-lg" style={{ maxWidth: 480, width: '100%' }}>
                                <div className="d-flex align-items-center justify-content-between mb-3">
                                    <h3 className="fw-black text-dark mb-0 ac-font" style={{ fontSize: '1.2rem' }}>
                                        <i className="fa-solid fa-upload text-success me-2" aria-hidden="true" />
                                        Import Collection
                                    </h3>
                                    <button type="button" className="btn-close" onClick={() => setShowImportModal(false)} />
                                </div>

                                <div className="mb-3">
                                    <label className="form-label tiny-text fw-bold text-muted">Paste JSON data:</label>
                                    <textarea
                                        className="form-control rounded-3"
                                        rows={4}
                                        value={importText}
                                        onChange={(e) => setImportText(e.target.value)}
                                        placeholder='["item_id_1", "item_id_2", ...]'
                                    />
                                </div>

                                <div className="mb-3">
                                    <label className="form-label tiny-text fw-bold text-muted">Or import from file:</label>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".json"
                                        className="form-control form-control-sm rounded-pill"
                                        onChange={handleFileImport}
                                    />
                                </div>

                                {importStatus && (
                                    <div className={`alert ${importStatus.includes('success') ? 'alert-success' : 'alert-danger'} py-2 mb-3`} role="alert">
                                        <small>{importStatus}</small>
                                    </div>
                                )}

                                <div className="d-flex gap-2">
                                    <button
                                        type="button"
                                        className="btn btn-nook text-white rounded-pill px-4 fw-bold flex-grow-1"
                                        onClick={handleImport}
                                        disabled={!importText.trim()}
                                    >
                                        Import JSON
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary rounded-pill px-3 fw-bold"
                                        onClick={() => setShowImportModal(false)}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default MyCollection;
