import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useFavorites } from '../hooks/useFavorites';
import { useCatalogData } from '../hooks/useCatalogData';
import { useCommandBuilderPockets } from '../hooks/useCommandBuilderPockets';
import { playChimeClick } from '../utils/kkAudioSynthesizer';
import type { CatalogEntity } from '../data/commandBuilderData';

const FALLBACK_IMAGE = "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23f1f3f5'/%3E%3Cpath d='M30 65 L45 45 L58 58 L68 42 L75 65 Z' fill='%23ced4da'/%3E%3Ccircle cx='38' cy='35' r='7' fill='%23ced4da'/%3E%3C/svg%3E";

const Wishlist: React.FC = () => {
    const { favorites, favoriteCount, toggleFavorite, clearFavorites, setFavorites } = useFavorites();
    const { data: catalogData, isLoading: catalogLoading } = useCatalogData();
    const { addItemToOrderPockets } = useCommandBuilderPockets();
    const [searchQuery, setSearchQuery] = useState('');
    const [copiedLink, setCopiedLink] = useState(false);
    const [addedAll, setAddedAll] = useState(false);
    const [sharedLoadedNotice, setSharedLoadedNotice] = useState<string | null>(null);

    // ── Parse ?data= share param on mount and restore wishlist ──
    useEffect(() => {
        try {
            const params = new URLSearchParams(window.location.search);
            const encoded = params.get('data');
            if (!encoded) return;

            const json = decodeURIComponent(atob(encoded));
            const ids: unknown = JSON.parse(json);
            if (Array.isArray(ids) && ids.every(id => typeof id === 'string')) {
                setFavorites(ids as string[]);
                setSharedLoadedNotice(`Shared wishlist loaded with ${ids.length} item${ids.length !== 1 ? 's' : ''}.`);
                // Clean URL without triggering a navigation
                window.history.replaceState({}, document.title, window.location.pathname);
                setTimeout(() => setSharedLoadedNotice(null), 4000);
            }
        } catch {
            // Malformed ?data= param — silently ignore
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Resolve favorite IDs to actual items
    const allItems = useMemo<CatalogEntity[]>(() => {
        if (!catalogData) return [];
        return [...(catalogData.items || []), ...(catalogData.villagers || [])];
    }, [catalogData]);

    const wishlistItems = useMemo<CatalogEntity[]>(() => {
        if (!allItems.length) return [];
        return favorites
            .map(id => allItems.find(item => item.id === id))
            .filter((item): item is CatalogEntity => !!item);
    }, [favorites, allItems]);

    // Filtered wishlist
    const filteredItems = useMemo(() => {
        if (!searchQuery.trim()) return wishlistItems;
        const q = searchQuery.toLowerCase();
        return wishlistItems.filter(item =>
            item.name.toLowerCase().includes(q) ||
            item.category?.toLowerCase().includes(q)
        );
    }, [wishlistItems, searchQuery]);

    // Total value calculation
    const totalBuyValue = useMemo(() =>
        wishlistItems.reduce((sum, item) => sum + (item.buy || 0), 0),
        [wishlistItems]
    );

    const totalSellValue = useMemo(() =>
        wishlistItems.reduce((sum, item) => sum + (item.sell || 0), 0),
        [wishlistItems]
    );

    // Generate share link — uses encodeURIComponent(btoa()) to handle multi-byte names
    const generateShareLink = () => {
        try {
            const encoded = btoa(encodeURIComponent(JSON.stringify(favorites)));
            const url = `${window.location.origin}/wishlist?data=${encodeURIComponent(encoded)}`;
            navigator.clipboard.writeText(url);
            setCopiedLink(true);
            setTimeout(() => setCopiedLink(false), 2000);
        } catch {
            // Clipboard or encoding fallback
        }
    };

    // Bulk add all orderable items to command builder
    const handleOrderAll = () => {
        const orderableItems = wishlistItems.filter(item => !item.unorderable && item.entityType === 'item');
        orderableItems.forEach(item => {
            addItemToOrderPockets(item);
        });
        setAddedAll(true);
        setTimeout(() => setAddedAll(false), 2000);
    };

    const site = typeof window !== 'undefined' ? window.location.origin : 'https://www.chopaeng.com';

    return (
        <>
            <Helmet>
                <title>My Wishlist | Chopaeng</title>
                <meta name="description" content="Your personal ACNH item wishlist. Share your wishlist, calculate total value, and bulk-add items to the command builder." />
                <link rel="canonical" href={`${site}/wishlist`} />
            </Helmet>

            <div className="min-vh-100 nook-bg py-5">
                <div className="container py-4">
                    {/* Header */}
                    <div className="text-center mb-5 animate-up">
                        <span className="badge bg-danger-subtle text-danger border border-danger-subtle rounded-pill px-3 py-2 fw-bold text-uppercase tracking-wider mb-2">
                            <i className="fa-solid fa-heart me-1" aria-hidden="true" /> Favorites
                        </span>
                        <h1 className="display-5 fw-black text-dark ac-font mb-2">
                            My Wishlist
                        </h1>
                        <p className="lead text-muted mx-auto fw-bold" style={{ maxWidth: '640px' }}>
                            Your favorited items in one place. Share your wishlist, see total values, or add them all to the command builder.
                        </p>
                    </div>

                    {/* Shared wishlist loaded notice */}
                    {sharedLoadedNotice && (
                        <div className="alert alert-success border border-success-subtle rounded-4 d-flex align-items-center gap-3 mb-4 animate-fade-in shadow-2xs" role="status">
                            <i className="fa-solid fa-circle-check fs-5 flex-shrink-0" aria-hidden="true" />
                            <span className="fw-bold small">{sharedLoadedNotice}</span>
                        </div>
                    )}

                    {/* Stats Cards */}
                    {!catalogLoading && favoriteCount > 0 && (
                        <div className="row g-3 mb-4 animate-up">
                            <div className="col-6 col-md-3">
                                <div className="card rounded-4 border shadow-2xs p-3 text-center bg-white h-100">
                                    <i className="fa-solid fa-heart text-danger fs-3 mb-1" aria-hidden="true" />
                                    <div className="fs-3 fw-black text-dark">{favoriteCount}</div>
                                    <div className="tiny-text fw-bold text-muted text-uppercase">Items</div>
                                </div>
                            </div>
                            <div className="col-6 col-md-3">
                                <div className="card rounded-4 border shadow-2xs p-3 text-center bg-white h-100">
                                    <i className="fa-solid fa-coins text-warning fs-3 mb-1" aria-hidden="true" />
                                    <div className="fs-3 fw-black text-dark">{totalBuyValue.toLocaleString()}</div>
                                    <div className="tiny-text fw-bold text-muted text-uppercase">Buy Value</div>
                                </div>
                            </div>
                            <div className="col-6 col-md-3">
                                <div className="card rounded-4 border shadow-2xs p-3 text-center bg-white h-100">
                                    <i className="fa-solid fa-sack-dollar text-success fs-3 mb-1" aria-hidden="true" />
                                    <div className="fs-3 fw-black text-dark">{totalSellValue.toLocaleString()}</div>
                                    <div className="tiny-text fw-bold text-muted text-uppercase">Sell Value</div>
                                </div>
                            </div>
                            <div className="col-6 col-md-3">
                                <div className="card rounded-4 border shadow-2xs p-3 text-center bg-white h-100">
                                    <i className="fa-solid fa-box-open text-info fs-3 mb-1" aria-hidden="true" />
                                    <div className="fs-3 fw-black text-dark">
                                        {wishlistItems.filter(i => !i.unorderable).length}
                                    </div>
                                    <div className="tiny-text fw-bold text-muted text-uppercase">Orderable</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Actions Bar */}
                    {favoriteCount > 0 && (
                        <div className="bg-white p-3 rounded-4 border shadow-2xs mb-4">
                            <div className="d-flex flex-wrap gap-2 align-items-center justify-content-between">
                                <div className="d-flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-nook text-white rounded-pill px-3 fw-bold"
                                        onClick={() => { playChimeClick(); handleOrderAll(); }}
                                    >
                                        <i className={`fa-solid ${addedAll ? 'fa-check' : 'fa-cubes-stacked'} me-1`} aria-hidden="true" />
                                        {addedAll ? 'Added!' : 'Order All'}
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-primary rounded-pill px-3 fw-bold"
                                        onClick={() => { playChimeClick(); generateShareLink(); }}
                                    >
                                        <i className={`fa-solid ${copiedLink ? 'fa-check' : 'fa-share-nodes'} me-1`} aria-hidden="true" />
                                        {copiedLink ? 'Link Copied!' : 'Share Wishlist'}
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger rounded-pill px-3 fw-bold"
                                    onClick={() => {
                                        if (confirm('Clear your entire wishlist?')) {
                                            clearFavorites();
                                        }
                                    }}
                                >
                                    <i className="fa-solid fa-trash me-1" aria-hidden="true" /> Clear All
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Search */}
                    {favoriteCount > 0 && (
                        <div className="bg-white p-3 rounded-4 border shadow-2xs mb-4">
                            <div className="input-group">
                                <span className="input-group-text bg-light border-end-0 rounded-start-pill" aria-hidden="true">
                                    <i className="fa-solid fa-magnifying-glass text-muted" />
                                </span>
                                <input
                                    type="text"
                                    className="form-control border-start-0 rounded-end-pill"
                                    placeholder="Search your wishlist..."
                                    value={searchQuery}
                                    aria-label="Search wishlist"
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>
                    )}

                    {/* Wishlist Items */}
                    {catalogLoading ? (
                        <div className="text-center py-5" role="status" aria-live="polite">
                            <div className="spinner-border text-success mb-2" aria-hidden="true" />
                            <div className="fw-bold text-muted">Loading wishlist...</div>
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="text-center py-5 text-muted animate-fade-in">
                            <i className="fa-solid fa-heart-crack fs-1 mb-2 opacity-50" aria-hidden="true" />
                            <p className="fw-bold">
                                {favoriteCount === 0
                                    ? 'Your wishlist is empty. Browse the catalogue and favorite items you want!'
                                    : 'No wishlist items match your search.'}
                            </p>
                            {favoriteCount === 0 && (
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
                        <div className="row g-3 animate-fade-in">
                            {filteredItems.map((item) => (
                                <div key={item.id} className="col-6 col-md-4 col-lg-3">
                                    <div className="card h-100 rounded-4 border bg-white shadow-2xs hover-shadow-sm p-3 transition-all">
                                        <div className="d-flex align-items-start justify-content-between mb-2">
                                            <img
                                                src={item.image || FALLBACK_IMAGE}
                                                alt={item.name}
                                                className="rounded-3"
                                                style={{ width: 48, height: 48, objectFit: 'contain' }}
                                                onError={(e) => { (e.currentTarget as HTMLImageElement).src = FALLBACK_IMAGE; }}
                                            />
                                            <button
                                                type="button"
                                                className="btn btn-xs text-danger p-0 border-0"
                                                onClick={(e) => { playChimeClick(); toggleFavorite(item.id, e); }}
                                                title="Remove from wishlist"
                                            >
                                                <i className="fa-solid fa-heart" aria-hidden="true" />
                                            </button>
                                        </div>

                                        <h3 className="fw-bold text-dark small mb-1 text-truncate" title={item.name} style={{ fontSize: '0.85rem' }}>
                                            {item.name}
                                        </h3>

                                        <span className="badge bg-light text-muted border rounded-pill x-small mb-2">
                                            {item.category || 'General'}
                                        </span>

                                        {(item.buy || item.sell) ? (
                                            <div className="tiny-text text-muted mb-2">
                                                {item.buy ? (
                                                    <span className="me-2">
                                                        <i className="fa-solid fa-coins text-warning me-1" aria-hidden="true" />
                                                        {item.buy.toLocaleString()}
                                                    </span>
                                                ) : null}
                                                {item.sell ? (
                                                    <span>
                                                        <i className="fa-solid fa-sack-dollar text-success me-1" aria-hidden="true" />
                                                        {item.sell.toLocaleString()}
                                                    </span>
                                                ) : null}
                                            </div>
                                        ) : null}

                                        <Link
                                            to={item.entityType === 'villager' ? `/villager/${item.id}` : `/item/${item.id}`}
                                            className="btn btn-xs btn-outline-success rounded-pill fw-bold mt-auto"
                                            onClick={() => playChimeClick()}
                                        >
                                            View Details
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Bottom Links */}
                    <div className="text-center mt-5">
                        <Link
                            to="/catalog"
                            className="btn btn-outline-success rounded-pill px-4 py-2 fw-bold me-2"
                            onClick={() => playChimeClick()}
                        >
                            <i className="fa-solid fa-boxes-stacked me-2" aria-hidden="true" />
                            Browse Catalogue
                        </Link>
                        <Link
                            to="/my-collection"
                            className="btn btn-outline-primary rounded-pill px-4 py-2 fw-bold"
                            onClick={() => playChimeClick()}
                        >
                            <i className="fa-solid fa-clipboard-check me-2" aria-hidden="true" />
                            My Collection
                        </Link>
                    </div>
                </div>
            </div>
        </>
    );
};

export default Wishlist;
