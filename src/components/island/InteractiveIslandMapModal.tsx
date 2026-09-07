import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
    fetchIslandMap,
    searchIslandMapItems,
    type IslandMapResponse,
    type IslandMapItem,
} from '../../utils/islandMapApi';
import './InteractiveIslandMap.css';

interface InteractiveIslandMapModalProps {
    isOpen: boolean;
    onClose: () => void;
    islandName: string;
    mapImageSrc: string;
}

const SECTOR_COLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const SECTOR_ROWS = [1, 2, 3, 4, 5, 6];

export const InteractiveIslandMapModal: React.FC<InteractiveIslandMapModalProps> = ({
    isOpen,
    onClose,
    islandName,
    mapImageSrc,
}) => {
    const [mapData, setMapData] = useState<IslandMapResponse | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [searchResults, setSearchResults] = useState<IslandMapItem[]>([]);
    const [searching, setSearching] = useState<boolean>(false);
    const [selectedSector, setSelectedSector] = useState<string | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [showGrid, setShowGrid] = useState<boolean>(true);
    const [showPins, setShowPins] = useState<boolean>(true);
    const [copiedFeedback, setCopiedFeedback] = useState<string | null>(null);
    const [activeHoveredPin, setActiveHoveredPin] = useState<IslandMapItem | null>(null);

    // Zoom & Pan state
    const [zoomLevel, setZoomLevel] = useState<number>(1.0);
    const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

    // Mobile view tab state ('map' | 'drawer')
    const [mobileTab, setMobileTab] = useState<'map' | 'drawer'>('map');

    // Desktop drawer toggle
    const [isDrawerCollapsed, setIsDrawerCollapsed] = useState<boolean>(false);

    // Feature: Live Acre inspection state
    const [hoveredSector, setHoveredSector] = useState<string | null>(null);

    // Feature: Item Detail Inspector
    const [inspectingItem, setInspectingItem] = useState<IslandMapItem | null>(null);

    // Feature: Map wrapper DOM ref for Mini-Radar HUD
    const mapWrapperRef = useRef<HTMLDivElement | null>(null);

    // Fetch live map data on modal open
    useEffect(() => {
        if (!isOpen) {
            setMapData(null);
            setSearchQuery('');
            setSearchResults([]);
            setSelectedSector(null);
            setSelectedCategory('all');
            setZoomLevel(1.0);
            setPanOffset({ x: 0, y: 0 });
            setMobileTab('map');
            return;
        }

        let isMounted = true;
        setLoading(true);

        fetchIslandMap(islandName)
            .then((data) => {
                if (isMounted) {
                    setMapData(data);
                    // Default select first populated sector if available
                    if (data.sectors) {
                        const populated = Object.keys(data.sectors);
                        if (populated.length > 0) {
                            setSelectedSector(populated[0]);
                        }
                    }
                }
            })
            .catch((err) => {
                console.error('[InteractiveIslandMapModal] Failed to fetch map:', err);
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [isOpen, islandName]);

    // Handle ESC key to close
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Debounced search query against live endpoint
    useEffect(() => {
        const query = searchQuery.trim();
        if (!query) {
            setSearchResults([]);
            setSearching(false);
            return;
        }

        setSearching(true);
        const timer = setTimeout(() => {
            searchIslandMapItems(islandName, query)
                .then((res) => {
                    const matches = res.matches || [];
                    setSearchResults(matches);
                    // Highlight first matching sector if exists
                    if (matches.length > 0 && matches[0].sector) {
                        setSelectedSector(matches[0].sector);
                    }
                })
                .catch((err) => {
                    console.error('[InteractiveIslandMapModal] Search error:', err);
                    setSearchResults([]);
                })
                .finally(() => {
                    setSearching(false);
                });
        }, 280);

        return () => clearTimeout(timer);
    }, [searchQuery, islandName]);

    // Extract top categories from mapData
    const topCategories = useMemo(() => {
        if (!mapData?.stats?.category_counts) return [];
        const entries = Object.entries(mapData.stats.category_counts)
            .filter(([cat]) => !cat.toLowerCase().includes('miscellaneous'))
            .sort((a, b) => b[1] - a[1]);
        return entries.slice(0, 8);
    }, [mapData]);

    // Set of sectors that contain search matches
    const sectorsWithMatches = useMemo(() => {
        const set = new Set<string>();
        searchResults.forEach((item) => {
            if (item.sector) set.add(item.sector.toUpperCase());
        });
        return set;
    }, [searchResults]);

    // Items to display in the drawer (filtered by search and selected category)
    const drawerItems = useMemo(() => {
        const isCleanItem = (i: IslandMapItem) =>
            !i.name.startsWith('Item #65533') &&
            !i.name.startsWith('Item #65534') &&
            !i.name.startsWith('Item #65535');

        let list: IslandMapItem[] = [];

        if (searchQuery.trim()) {
            list = searchResults.filter(isCleanItem);
        } else if (selectedSector && mapData?.sectors?.[selectedSector]) {
            list = mapData.sectors[selectedSector].filter(isCleanItem);
        } else {
            list = (mapData?.items || []).filter(isCleanItem);
        }

        if (selectedCategory !== 'all') {
            list = list.filter((i) => i.category.toLowerCase() === selectedCategory.toLowerCase());
        }

        return list;
    }, [searchQuery, searchResults, selectedSector, selectedCategory, mapData]);

    // Copy helper with feedback banner
    const handleCopy = useCallback((text: string, label: string) => {
        navigator.clipboard.writeText(text);
        setCopiedFeedback(`Copied ${label}: "${text}"`);
        setTimeout(() => setCopiedFeedback(null), 2000);
    }, []);

    // Zoom Handlers
    const handleZoomIn = () => {
        setZoomLevel((prev) => Math.min(2.5, Math.round((prev + 0.25) * 100) / 100));
    };

    const handleZoomOut = () => {
        setZoomLevel((prev) => {
            const next = Math.max(0.5, Math.round((prev - 0.25) * 100) / 100);
            if (next === 1.0) setPanOffset({ x: 0, y: 0 });
            return next;
        });
    };

    const handleResetZoom = () => {
        setZoomLevel(1.0);
        setPanOffset({ x: 0, y: 0 });
    };

    // Pan (drag) handlers
    const handleMouseDown = (e: React.MouseEvent) => {
        if (zoomLevel <= 1.0 && panOffset.x === 0 && panOffset.y === 0) return;
        setIsDragging(true);
        dragStartRef.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        setPanOffset({
            x: e.clientX - dragStartRef.current.x,
            y: e.clientY - dragStartRef.current.y,
        });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    // Focus on an item: select its sector and center/zoom if needed
    const handleFocusItem = (item: IslandMapItem) => {
        if (item.sector) {
            setSelectedSector(item.sector);
        }
        setActiveHoveredPin(item);
        if (mobileTab === 'drawer') {
            setMobileTab('map');
        }
    };

    // Live Acre inspection data
    const hoveredSectorData = useMemo(() => {
        if (!hoveredSector || !mapData) return null;
        const secItems = (mapData.sectors?.[hoveredSector] || mapData.items?.filter((i) => i.sector === hoveredSector) || []);
        const secSummary = mapData.sector_summary?.[hoveredSector];
        const topCats = secSummary?.top_categories || [];
        const preview = secItems.slice(0, 5);
        return {
            sector: hoveredSector,
            totalItems: secItems.length,
            topCategories: topCats,
            previewItems: preview,
        };
    }, [hoveredSector, mapData]);

    // Mini-Radar HUD viewport box calculations
    const minimapBox = useMemo(() => {
        if (zoomLevel <= 1.0) return { width: 100, height: 100, left: 0, top: 0 };
        const wrapperW = mapWrapperRef.current?.offsetWidth || 700;
        const wrapperH = mapWrapperRef.current?.offsetHeight || 600;
        const boxW = Math.min(100, 100 / zoomLevel);
        const boxH = Math.min(100, 100 / zoomLevel);
        const left = Math.max(0, Math.min(100 - boxW, (0.5 - panOffset.x / (wrapperW * zoomLevel)) * 100 - boxW / 2));
        const top = Math.max(0, Math.min(100 - boxH, (0.5 - panOffset.y / (wrapperH * zoomLevel)) * 100 - boxH / 2));
        return { width: boxW, height: boxH, left, top };
    }, [zoomLevel, panOffset]);

    const handleMinimapClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const clickNormX = (e.clientX - rect.left) / rect.width;
        const clickNormY = (e.clientY - rect.top) / rect.height;
        const wrapperW = mapWrapperRef.current?.offsetWidth || 700;
        const wrapperH = mapWrapperRef.current?.offsetHeight || 600;
        const newPanX = (0.5 - clickNormX) * wrapperW * zoomLevel;
        const newPanY = (0.5 - clickNormY) * wrapperH * zoomLevel;
        setPanOffset({ x: newPanX, y: newPanY });
    };

    if (!isOpen) return null;

    const totalItemsCount = mapData?.stats?.total_items ?? mapData?.items?.length ?? 0;
    const isLive = mapData?.status === 'live_nhl' || mapData?.status === 'live_nhl_v2';
    const isV2 = mapData?.status === 'live_nhl_v2';

    return (
        <div
            className="island-radar-modal-backdrop"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label={`${islandName} Interactive Ground Radar`}
        >
            <div className="island-radar-modal-dialog" onClick={(e) => e.stopPropagation()}>
                {/* ─── HEADER ─── */}
                <div className="island-radar-header">
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                        <h4 className="island-radar-header-title">
                            <i className="fa-solid fa-satellite-dish text-info"></i>
                            <span>{islandName.toUpperCase()} Ground Radar</span>
                        </h4>

                        <div className="island-radar-header-meta">


                            {totalItemsCount > 0 && (
                                <span className="badge bg-white bg-opacity-20 text-white rounded-pill px-2.5 py-1 small fw-bold">
                                    {totalItemsCount.toLocaleString()} items
                                </span>
                            )}
                        </div>
                    </div>

                    <button
                        type="button"
                        className="island-radar-close-btn"
                        onClick={onClose}
                        aria-label="Close modal"
                    >
                        <i className="fa-solid fa-xmark"></i>
                    </button>
                </div>

                {/* ─── TOOLBAR CONTROLS ─── */}
                <div className="island-radar-toolbar">
                    <div className="island-radar-search-box">
                        <i className="fa-solid fa-magnifying-glass search-ico"></i>
                        <input
                            type="text"
                            placeholder={`Search ${totalItemsCount > 0 ? totalItemsCount.toLocaleString() : ''} items (e.g. ranch, DIY, crown)...`}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                className="island-radar-search-clear"
                                onClick={() => setSearchQuery('')}
                                aria-label="Clear search"
                            >
                                <i className="fa-solid fa-circle-xmark"></i>
                            </button>
                        )}
                    </div>

                    <div className="island-radar-toggles">
                        <button
                            type="button"
                            className={`island-radar-toggle-btn ${showGrid ? 'active' : ''}`}
                            onClick={() => setShowGrid(!showGrid)}
                            title="Toggle Sector Grid (A1 through G6)"
                        >
                            <i className="fa-solid fa-border-all"></i>
                            <span>Grid (A1–G6)</span>
                        </button>

                        <button
                            type="button"
                            className={`island-radar-toggle-btn ${showPins ? 'active' : ''}`}
                            onClick={() => setShowPins(!showPins)}
                            title="Toggle Item Pins"
                        >
                            <i className="fa-solid fa-location-dot"></i>
                            <span>Pins</span>
                        </button>

                        {selectedSector && (
                            <button
                                type="button"
                                className="island-radar-toggle-btn text-danger border-danger"
                                onClick={() => setSelectedSector(null)}
                                title="Clear selected sector"
                            >
                                <i className="fa-solid fa-xmark"></i>
                                <span>Clear Sector</span>
                            </button>
                        )}

                        <button
                            type="button"
                            className="island-radar-toggle-btn d-none d-lg-inline-flex"
                            onClick={() => setIsDrawerCollapsed(!isDrawerCollapsed)}
                            title={isDrawerCollapsed ? 'Expand Item List' : 'Collapse Item List'}
                        >
                            <i className={`fa-solid ${isDrawerCollapsed ? 'fa-angles-left' : 'fa-angles-right'}`}></i>
                            <span>{isDrawerCollapsed ? 'Manifest' : 'Full Map'}</span>
                        </button>
                    </div>

                    {/* Mobile Segmented Tab Switcher */}
                    <div className="island-radar-mobile-tabs">
                        <button
                            type="button"
                            className={`island-radar-mobile-tab-btn ${mobileTab === 'map' ? 'active' : ''}`}
                            onClick={() => setMobileTab('map')}
                        >
                            <i className="fa-solid fa-map"></i>
                            <span>Island Map</span>
                        </button>
                        <button
                            type="button"
                            className={`island-radar-mobile-tab-btn ${mobileTab === 'drawer' ? 'active' : ''}`}
                            onClick={() => setMobileTab('drawer')}
                        >
                            <i className="fa-solid fa-list-ul"></i>
                            <span>
                                Items {drawerItems.length > 0 ? `(${drawerItems.length})` : ''}
                            </span>
                        </button>
                    </div>
                </div>

                {/* ─── CATEGORY FILTER CHIPS SCROLLBAR ─── */}
                <div className="island-radar-category-scroll">
                    <button
                        type="button"
                        className={`island-radar-cat-chip ${selectedCategory === 'all' ? 'active' : ''}`}
                        onClick={() => setSelectedCategory('all')}
                    >
                        <span>All Categories</span>
                        {totalItemsCount > 0 && (
                            <span className="island-radar-cat-count">{totalItemsCount.toLocaleString()}</span>
                        )}
                    </button>

                    {topCategories.map(([cat, count]) => (
                        <button
                            key={cat}
                            type="button"
                            className={`island-radar-cat-chip ${selectedCategory === cat ? 'active' : ''}`}
                            onClick={() => setSelectedCategory(selectedCategory === cat ? 'all' : cat)}
                        >
                            <span>{cat}</span>
                            <span className="island-radar-cat-count">{count}</span>
                        </button>
                    ))}
                </div>

                {/* ─── MODAL BODY: MAP + DRAWER ─── */}
                <div
                    className={`island-radar-body ${mobileTab === 'map' ? 'mobile-show-map' : 'mobile-show-drawer'
                        }`}
                >
                    {/* Map Viewport Area */}
                    <div
                        className="island-radar-viewport-container"
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                    >
                        {/* Zoom Controls */}
                        <div className="island-radar-zoom-controls">
                            <button
                                type="button"
                                className="island-radar-zoom-btn"
                                onClick={handleZoomIn}
                                title="Zoom in"
                                disabled={zoomLevel >= 2.5}
                            >
                                <i className="fa-solid fa-plus"></i>
                            </button>
                            <span className="island-radar-zoom-level-text">{Math.round(zoomLevel * 100)}%</span>
                            <button
                                type="button"
                                className="island-radar-zoom-btn"
                                onClick={handleZoomOut}
                                title="Zoom out"
                                disabled={zoomLevel <= 0.5}
                            >
                                <i className="fa-solid fa-minus"></i>
                            </button>
                            {(zoomLevel !== 1.0 || panOffset.x !== 0 || panOffset.y !== 0) && (
                                <button
                                    type="button"
                                    className="island-radar-zoom-btn text-warning"
                                    onClick={handleResetZoom}
                                    title="Reset view (100%)"
                                >
                                    <i className="fa-solid fa-rotate-left"></i>
                                </button>
                            )}
                        </div>

                        {/* Scalable & Pannable Map Wrapper */}
                        <div
                            ref={mapWrapperRef}
                            className={`island-radar-map-wrapper ${isDragging ? 'is-dragging' : ''} ${zoomLevel > 1.0 ? 'can-drag' : ''
                                }`}
                            style={{
                                transform: `scale(${zoomLevel}) translate(${panOffset.x / zoomLevel}px, ${panOffset.y / zoomLevel
                                    }px)`,
                            }}
                        >
                            {/* Base Satellite / Overhead Map Image */}
                            <img
                                src={mapImageSrc}
                                alt={`${islandName} aerial map`}
                                className="island-radar-base-img"
                                onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    if (target.src.includes('.png')) target.src = target.src.replace('.png', '.jpg');
                                    else if (target.src.endsWith('.jpg')) target.src = target.src.replace('.jpg', '.jpeg');
                                    else target.src = 'https://www.chopaeng.com/banner.png';
                                }}
                            />

                            {/* Sector Overlay Grid (7x6) */}
                            {showGrid && (
                                <div className="island-radar-grid-overlay">
                                    {SECTOR_ROWS.map((row) =>
                                        SECTOR_COLS.map((col) => {
                                            const secKey = `${col}${row}`;
                                            const isSelected = selectedSector === secKey;
                                            const hasMatches = sectorsWithMatches.has(secKey);
                                            const sectorItemsCount = mapData?.sectors?.[secKey]?.length ?? 0;

                                            return (
                                                <div
                                                    key={secKey}
                                                    className={`island-radar-sector-cell ${isSelected ? 'active-sector' : ''
                                                        } ${hasMatches ? 'has-search-match' : ''}`}
                                                    onClick={() => setSelectedSector(secKey)}
                                                    onMouseEnter={() => setHoveredSector(secKey)}
                                                    onMouseLeave={() => setHoveredSector(null)}
                                                    title={`Sector ${secKey} (${sectorItemsCount.toLocaleString()} items) - Click to inspect`}
                                                >
                                                    <span className="island-radar-sector-badge">{secKey}</span>
                                                    {sectorItemsCount > 0 && (
                                                        <span className="island-radar-sector-item-count">
                                                            {sectorItemsCount.toLocaleString()}
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            )}

                            {/* Item Pins Layer */}
                            {showPins && searchResults.length > 0 && mapData?.grid && (
                                <div className="island-radar-pins-layer">
                                    {searchResults
                                        .filter((item): item is IslandMapItem & { x: number; y: number } => item.x !== undefined && item.y !== undefined)
                                        .slice(0, 150)
                                        .map((item, idx) => {
                                            const gridW = mapData.grid?.width || 224;
                                            const gridH = mapData.grid?.height || 192;
                                            const leftPercent = Math.max(2, Math.min(98, (item.x / gridW) * 100));
                                            const topPercent = Math.max(2, Math.min(98, (item.y / gridH) * 100));
                                            const isHovered = activeHoveredPin === item;

                                            return (
                                                <div
                                                    key={`pin-${idx}-${item.x}-${item.y}`}
                                                    className={`island-radar-pin-container ${isHovered ? 'active-pin' : ''}`}
                                                    style={{ left: `${leftPercent}%`, top: `${topPercent}%` }}
                                                >
                                                    <div
                                                        className="island-radar-pin"
                                                        onClick={() => {
                                                            if (item.sector) setSelectedSector(item.sector);
                                                            setInspectingItem(item);
                                                        }}
                                                    />
                                                    <div className="island-radar-pin-tooltip">
                                                        <span className="d-block">{item.name}</span>
                                                        <small className="opacity-75">
                                                            {item.sector ? `${item.sector} ` : ''}({item.x}, {item.y})
                                                        </small>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            )}
                        </div>

                        {/* Live Acre Hover Popover */}
                        {hoveredSectorData && hoveredSectorData.totalItems > 0 && (
                            <div className="island-radar-acre-popover animate-up">
                                <div className="island-radar-acre-popover-header">
                                    <div className="island-radar-acre-popover-title">
                                        <i className="fa-solid fa-vector-square text-info"></i>
                                        <span>Sector {hoveredSectorData.sector}</span>
                                    </div>
                                    <span className="island-radar-acre-popover-count">
                                        {hoveredSectorData.totalItems.toLocaleString()} items
                                    </span>
                                </div>
                                <div className="island-radar-acre-categories">
                                    {hoveredSectorData.topCategories.map(([cat, count]) => (
                                        <span key={cat} className="island-radar-acre-cat-pill">
                                            {cat} <span className="opacity-75">({count})</span>
                                        </span>
                                    ))}
                                </div>
                                <div className="island-radar-acre-preview-list">
                                    {hoveredSectorData.previewItems.map((item, idx) => (
                                        <div
                                            key={idx}
                                            className="island-radar-acre-preview-thumb"
                                            title={`${item.name} (${item.category}) - Click to inspect`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setInspectingItem(item);
                                            }}
                                        >
                                            {item.imageUrl ? (
                                                <img src={item.imageUrl} alt={item.name} />
                                            ) : (
                                                <i className="fa-solid fa-gift text-white-50"></i>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <div className="island-radar-acre-popover-actions">
                                    <button
                                        type="button"
                                        className="island-radar-acre-btn primary"
                                        onClick={() => setSelectedSector(hoveredSectorData.sector)}
                                    >
                                        <i className="fa-solid fa-arrow-right me-1"></i> View Sector In Drawer
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Mini-Radar HUD (Zoom Navigator) */}
                        {zoomLevel > 1.0 && (
                            <div
                                className="island-radar-minimap-hud"
                                onClick={handleMinimapClick}
                                title="Click mini-map to pan viewport"
                            >
                                <span className="island-radar-minimap-label">Radar HUD</span>
                                <img
                                    src={mapImageSrc}
                                    alt="Mini Radar"
                                    className="island-radar-minimap-img"
                                />
                                <div
                                    className="island-radar-minimap-viewport-box"
                                    style={{
                                        left: `${minimapBox.left}%`,
                                        top: `${minimapBox.top}%`,
                                        width: `${minimapBox.width}%`,
                                        height: `${minimapBox.height}%`,
                                    }}
                                />
                            </div>
                        )}
                    </div>

                    {/* Right Drawer: Manifest / Search Results */}
                    <div className={`island-radar-drawer ${isDrawerCollapsed ? 'collapsed' : ''}`}>
                        <div className="island-radar-drawer-header">
                            <h5 className="island-radar-drawer-title">
                                {searchQuery ? (
                                    <>
                                        <i className="fa-solid fa-magnifying-glass text-warning"></i>
                                        Search: "{searchQuery}" ({drawerItems.length})
                                    </>
                                ) : selectedSector ? (
                                    <>
                                        <i className="fa-solid fa-vector-square text-info"></i>
                                        Sector {selectedSector} ({drawerItems.length})
                                    </>
                                ) : (
                                    <>
                                        <i className="fa-solid fa-cubes text-primary"></i>
                                        All Island Items ({drawerItems.length})
                                    </>
                                )}
                            </h5>

                            {drawerItems.length > 0 && (
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-secondary py-0.5 px-2 small rounded-pill"
                                    onClick={() => {
                                        const names = drawerItems.slice(0, 40).map((i) => i.name).join(', ');
                                        handleCopy(names, 'First 40 items');
                                    }}
                                    title="Copy list of visible items"
                                >
                                    <i className="fa-solid fa-copy me-1"></i> Copy 40
                                </button>
                            )}
                        </div>

                        <div className="island-radar-drawer-body">
                            {copiedFeedback && (
                                <div className="alert alert-success py-1.5 px-3 mb-2 small text-center fw-bold rounded-pill shadow-xs animate-up">
                                    <i className="fa-solid fa-circle-check me-1.5"></i>
                                    {copiedFeedback}
                                </div>
                            )}

                            {mapData?.status === 'live_nhl_v2' && (
                                <div className="island-radar-v2-pill mb-2">
                                    <i className="fa-solid fa-microchip text-info me-1"></i>
                                    <span>Confirmed 32-bit item catalog</span>
                                    {mapData?.stats?.empty_slots !== undefined && (
                                        <span className="opacity-75 ms-1">
                                            ({mapData.stats.empty_slots.toLocaleString()} empty filtered)
                                        </span>
                                    )}
                                </div>
                            )}

                            {loading ? (
                                <div className="island-radar-empty">
                                    <div className="spinner-border text-primary mb-3" role="status"></div>
                                    <p className="fw-bold mb-0">Scanning Ground Layer...</p>
                                    <small className="text-muted">Loading item manifest</small>
                                </div>
                            ) : searching ? (
                                <div className="island-radar-empty">
                                    <div className="spinner-border text-warning mb-3" role="status"></div>
                                    <p className="fw-bold mb-0">Searching island items...</p>
                                </div>
                            ) : drawerItems.length === 0 ? (
                                <div className="island-radar-empty">
                                    <i className="fa-solid fa-box-open"></i>
                                    <p className="fw-bold mb-1">
                                        {searchQuery ? 'No matching items found' : 'No Items In This Sector'}
                                    </p>
                                    <small className="text-muted">
                                        {searchQuery
                                            ? `No items matching "${searchQuery}" on ${islandName}.`
                                            : 'Click on any highlighted sector (e.g. B2, C3) or clear category filter.'}
                                    </small>
                                </div>
                            ) : (
                                <div>
                                    {drawerItems.slice(0, 150).map((item, idx) => {
                                        const isSelected = activeHoveredPin === item;
                                        return (
                                            <div
                                                key={`${item.name}-${item.sector || ''}-${item.record_index ?? idx}-${idx}`}
                                                className={`island-radar-item-row ${isSelected ? 'active-item' : ''}`}
                                                onClick={() => handleFocusItem(item)}
                                                onMouseEnter={() => setActiveHoveredPin(item)}
                                                onMouseLeave={() => setActiveHoveredPin(null)}
                                            >
                                                <div className="island-radar-item-info">
                                                    <div className="island-radar-item-thumb">
                                                        {item.imageUrl ? (
                                                            <img
                                                                src={item.imageUrl}
                                                                alt={item.name}
                                                                onError={(e) => {
                                                                    (e.target as HTMLElement).style.display = 'none';
                                                                }}
                                                            />
                                                        ) : (
                                                            <i className="fa-solid fa-gift text-primary opacity-75"></i>
                                                        )}
                                                    </div>

                                                    <div className="island-radar-item-text">
                                                        <span className="island-radar-item-name">{item.name}</span>
                                                        <div className="island-radar-item-sub">
                                                            <span>{item.category}</span>
                                                            {item.x !== undefined && item.y !== undefined ? (
                                                                <>
                                                                    <span>•</span>
                                                                    <span>
                                                                        ({item.x}, {item.y})
                                                                    </span>
                                                                </>
                                                            ) : item.record_index !== undefined ? (
                                                                <>
                                                                    <span>•</span>
                                                                    <span>Slot #{item.record_index}</span>
                                                                </>
                                                            ) : (item.itemIdHex || item.internalId) ? (
                                                                <>
                                                                    <span>•</span>
                                                                    <span>0x{(item.itemIdHex || item.internalId || '').slice(-4).toUpperCase()}</span>
                                                                </>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="island-radar-actions-group">
                                                    {item.sector ? (
                                                        <span className="island-radar-sector-pill">{item.sector}</span>
                                                    ) : item.record_index !== undefined ? (
                                                        <span className="island-radar-sector-pill">#{item.record_index}</span>
                                                    ) : null}

                                                    <button
                                                        type="button"
                                                        className="island-radar-icon-btn"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setInspectingItem(item);
                                                        }}
                                                        title={`Inspect "${item.name}"`}
                                                    >
                                                        <i className="fa-solid fa-circle-info"></i>
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {drawerItems.length > 150 && (
                                        <div className="text-center py-2 text-muted small">
                                            Showing first 150 of {drawerItems.length.toLocaleString()} matching items
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Item Detail Inspector Modal Dialog */}
                {inspectingItem && (
                    <div className="island-radar-inspect-backdrop" onClick={() => setInspectingItem(null)}>
                        <div className="island-radar-inspect-card animate-up" onClick={(e) => e.stopPropagation()}>
                            <div className="island-radar-inspect-header">
                                <div className="d-flex align-items-center gap-2">
                                    <h5 className="island-radar-inspect-title mb-0 text-white text-truncate" style={{ maxWidth: '300px' }}>
                                        {inspectingItem.name}
                                    </h5>
                                </div>
                                <button
                                    type="button"
                                    className="btn-close btn-close-white"
                                    onClick={() => setInspectingItem(null)}
                                    aria-label="Close"
                                />
                            </div>

                            <div className="island-radar-inspect-body">
                                <div className="island-radar-inspect-img-box">
                                    {inspectingItem.imageUrl ? (
                                        <img src={inspectingItem.imageUrl} alt={inspectingItem.name} />
                                    ) : (
                                        <i className="fa-solid fa-gift fa-3x text-primary opacity-50"></i>
                                    )}
                                </div>

                                <div className="island-radar-inspect-badges">
                                    <span className="badge bg-primary px-2.5 py-1">
                                        {inspectingItem.category || 'Item'}
                                    </span>
                                    {inspectingItem.sector && (
                                        <span className="badge bg-info-subtle text-info-emphasis border border-info-subtle px-2 py-1">
                                            Sector {inspectingItem.sector}
                                        </span>
                                    )}
                                    {inspectingItem.record_index !== undefined && (
                                        <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle px-2 py-1">
                                            Slot #{inspectingItem.record_index}
                                        </span>
                                    )}
                                </div>

                                <div className="island-radar-inspect-grid-info">
                                    <div className="island-radar-inspect-grid-cell">
                                        <span className="island-radar-inspect-grid-label">Acre Sector</span>
                                        <span className="island-radar-inspect-grid-value text-info">
                                            {inspectingItem.sector || 'N/A'}
                                        </span>
                                    </div>
                                    <div className="island-radar-inspect-grid-cell">
                                        <span className="island-radar-inspect-grid-label">Coordinates (X, Y)</span>
                                        <span className="island-radar-inspect-grid-value">
                                            {inspectingItem.x !== undefined && inspectingItem.y !== undefined
                                                ? `(${inspectingItem.x}, ${inspectingItem.y})`
                                                : 'N/A'}
                                        </span>
                                    </div>
                                    <div className="island-radar-inspect-grid-cell">
                                        <span className="island-radar-inspect-grid-label">Catalog Slot</span>
                                        <span className="island-radar-inspect-grid-value text-warning">
                                            {inspectingItem.record_index !== undefined ? `#${inspectingItem.record_index}` : 'N/A'}
                                        </span>
                                    </div>
                                    <div className="island-radar-inspect-grid-cell">
                                        <span className="island-radar-inspect-grid-label">Item ID (Hex)</span>
                                        <span className="island-radar-inspect-grid-value font-monospace text-primary">
                                            {inspectingItem.itemIdHex
                                                ? inspectingItem.itemIdHex
                                                : inspectingItem.internalId
                                                    ? `0x${inspectingItem.internalId.toUpperCase()}`
                                                    : 'N/A'}
                                        </span>
                                    </div>
                                    {(inspectingItem.raw_A !== undefined || inspectingItem.raw_B !== undefined) && (
                                        <div className="island-radar-inspect-grid-cell" style={{ gridColumn: 'span 2' }}>
                                            <span className="island-radar-inspect-grid-label">Raw 32-bit Words</span>
                                            <span className="island-radar-inspect-grid-value font-monospace small">
                                                A: {inspectingItem.raw_A !== undefined ? `0x${inspectingItem.raw_A.toString(16).toUpperCase()}` : '--'},
                                                B: {inspectingItem.raw_B !== undefined ? `0x${inspectingItem.raw_B.toString(16).toUpperCase()}` : '--'}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div className="island-radar-inspect-actions">
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-secondary w-100 py-2 fw-bold"
                                        onClick={() => setInspectingItem(null)}
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
