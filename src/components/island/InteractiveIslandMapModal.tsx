import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
    fetchIslandMap,
    searchIslandMapItems,
    type IslandMapResponse,
    type IslandMapItem,
    type IslandSectorSummary,
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

const CATEGORY_ICONS: Record<string, string> = {
    all: 'fa-solid fa-layer-group',
    insects: 'fa-solid fa-bug',
    fish: 'fa-solid fa-fish',
    'sea creatures': 'fa-solid fa-shrimp',
    fossils: 'fa-solid fa-bone',
    artwork: 'fa-solid fa-palette',
    housewares: 'fa-solid fa-couch',
    photos: 'fa-solid fa-camera',
    posters: 'fa-solid fa-image',
    music: 'fa-solid fa-music',
    'tools/goods': 'fa-solid fa-wrench',
    fencing: 'fa-solid fa-bars',
    rugs: 'fa-solid fa-rug',
    wallpaper: 'fa-solid fa-paint-roller',
    floors: 'fa-solid fa-border-all',
    bags: 'fa-solid fa-bag-shopping',
    shoes: 'fa-solid fa-shoe-prints',
    'dress-up': 'fa-solid fa-shirt',
    tops: 'fa-solid fa-shirt',
    headwear: 'fa-solid fa-hat-wizard',
    socks: 'fa-solid fa-socks',
    'wall-mounted': 'fa-solid fa-tv',
    miscellaneous: 'fa-solid fa-box-open',
    other: 'fa-solid fa-cubes',
};

const getCategoryIcon = (cat: string): string => {
    return CATEGORY_ICONS[cat.toLowerCase()] || 'fa-solid fa-tag';
};

const getPinColorClass = (cat?: string): string => {
    if (!cat) return 'pin-default';
    const c = cat.toLowerCase();
    if (c.includes('insect')) return 'pin-insect';
    if (c.includes('fish') || c.includes('sea')) return 'pin-fish';
    if (c.includes('fossil')) return 'pin-fossil';
    if (c.includes('art')) return 'pin-art';
    if (c.includes('photo') || c.includes('poster')) return 'pin-photo';
    if (c.includes('house') || c.includes('furni')) return 'pin-furniture';
    if (c.includes('music')) return 'pin-music';
    if (c.includes('tool')) return 'pin-tool';
    if (c.includes('fenc')) return 'pin-fence';
    return 'pin-default';
};

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
    const [enableRadarSweep, setEnableRadarSweep] = useState<boolean>(true);
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

    // Feature: Cursor coordinate HUD tracking
    const [hoverCoords, setHoverCoords] = useState<{ x: number; y: number; sector: string } | null>(null);

    // Feature: Item Detail Inspector
    const [inspectingItem, setInspectingItem] = useState<IslandMapItem | null>(null);

    // Feature: Map wrapper DOM ref for Mini-Radar HUD
    const mapWrapperRef = useRef<HTMLDivElement | null>(null);

// Helper to correct item coordinates from column-major ACNH memory layout.
// In ACNH, the 43,008 item grid is 224 tiles wide (7 acres x 32) and 192 tiles high (6 acres x 32).
// The raw memory is column-major: record_index = x * 192 + y (stride of 192 per column).
// The backend mistakenly interpreted the array as row-major (x = idx % 224, y = idx / 224),
// causing items along columns (like critters on the vertical acres) to rotate onto the top row.
const normalizeItemCoordinates = (item: IslandMapItem): IslandMapItem => {
    let recordIndex = item.record_index;
    if (recordIndex === undefined && item.x !== undefined && item.y !== undefined) {
        // Recover original record_index from backend row-major decoding
        recordIndex = item.y * 224 + item.x;
    }

    if (recordIndex !== undefined && recordIndex >= 0 && recordIndex < 43008) {
        const x = Math.floor(recordIndex / 192);
        const y = recordIndex % 192;
        const colIdx = Math.floor(x / 32);
        const rowIdx = Math.floor(y / 32);
        const sector = (colIdx >= 0 && colIdx < 7 && rowIdx >= 0 && rowIdx < 6)
            ? `${SECTOR_COLS[colIdx]}${SECTOR_ROWS[rowIdx]}`
            : item.sector;
        return {
            ...item,
            record_index: recordIndex,
            x,
            y,
            sector,
        };
    }
    return item;
};

const normalizeMapData = (data: IslandMapResponse): IslandMapResponse => {
    const items = (data.items || []).map(normalizeItemCoordinates);
    const sectors: Record<string, IslandMapItem[]> = {};
    const sector_summary: Record<string, IslandSectorSummary> = {};

    for (const item of items) {
        if (item.sector) {
            if (!sectors[item.sector]) sectors[item.sector] = [];
            sectors[item.sector].push(item);
        }
    }

    for (const [sec, secItems] of Object.entries(sectors)) {
        const catCounts: Record<string, number> = {};
        for (const it of secItems) {
            const c = it.category || 'Other';
            catCounts[c] = (catCounts[c] || 0) + 1;
        }
        const top_categories = Object.entries(catCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([c]) => c);
        const sample_items = secItems.slice(0, 5).map((it) => it.name);
        sector_summary[sec] = {
            total_items: secItems.length,
            top_categories,
            sample_items,
        };
    }

    return {
        ...data,
        items,
        sectors,
        sector_summary,
    };
};

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
                    const normalized = normalizeMapData(data);
                    setMapData(normalized);
                    // Default select first populated sector if available
                    if (normalized.sectors) {
                        const populated = Object.keys(normalized.sectors);
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
                    const rawMatches = res.matches || [];
                    const matches = rawMatches.map(normalizeItemCoordinates);
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

    // Live cursor coordinate tracking over map
    const handleMapMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        handleMouseMove(e);
        if (!mapWrapperRef.current) return;
        const rect = mapWrapperRef.current.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        const normX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const normY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
        const gridW = mapData?.grid?.width || 224;
        const gridH = mapData?.grid?.height || 192;
        const x = Math.floor(normX * gridW);
        const y = Math.floor(normY * gridH);
        const colIdx = Math.max(0, Math.min(6, Math.floor(x / 32)));
        const rowIdx = Math.max(0, Math.min(5, Math.floor(y / 32)));
        const sector = `${SECTOR_COLS[colIdx]}${SECTOR_ROWS[rowIdx]}`;
        setHoverCoords({ x, y, sector });
    };

    const handleMapMouseLeave = () => {
        handleMouseUp();
        setHoverCoords(null);
    };

    if (!isOpen) return null;

    const totalItemsCount = mapData?.stats?.total_items ?? mapData?.items?.length ?? 0;

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
                            <i className="fa-solid fa-satellite-dish text-info island-radar-pulsing-icon"></i>
                            <span>{islandName.toUpperCase()} Ground Radar</span>
                        </h4>

                        <div className="island-radar-header-meta">
                            <span className="island-radar-tag live">
                                <span className="island-radar-live-dot"></span>
                                Live Scanner
                            </span>

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

                        <button
                            type="button"
                            className={`island-radar-toggle-btn ${enableRadarSweep ? 'active' : ''}`}
                            onClick={() => setEnableRadarSweep(!enableRadarSweep)}
                            title="Toggle Holographic Radar Sweep Beam"
                        >
                            <i className="fa-solid fa-radar"></i>
                            <span>Sweep</span>
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
                        <i className={getCategoryIcon('all')}></i>
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
                            <i className={getCategoryIcon(cat)}></i>
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
                        onMouseMove={handleMapMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMapMouseLeave}
                    >
                        {/* Live Coordinates HUD Bar */}
                        <div className="island-radar-hud-bar">
                            <div className="island-radar-coords-display">
                                <i className="fa-solid fa-crosshairs text-info me-1.5"></i>
                                {hoverCoords ? (
                                    <span>
                                        <span className="island-radar-hud-axis">X:</span> {hoverCoords.x}&nbsp;
                                        <span className="island-radar-hud-axis">Y:</span> {hoverCoords.y}
                                        <span className="island-radar-hud-sep">•</span>
                                        <span className="island-radar-hud-axis">Sector:</span> {hoverCoords.sector}
                                    </span>
                                ) : (
                                    <span className="text-secondary opacity-75">
                                        Hover map for live coordinates
                                    </span>
                                )}
                            </div>
                            {selectedSector && (
                                <div className="island-radar-active-sector-tag">
                                    <i className="fa-solid fa-vector-square text-warning me-1"></i>
                                    Sector {selectedSector}
                                </div>
                            )}
                        </div>

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

                            {/* Holographic Radar Sweep Beam */}
                            {enableRadarSweep && <div className="island-radar-sweep-beam" />}

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
                                            const pinColorClass = getPinColorClass(item.category);

                                            return (
                                                <div
                                                    key={`pin-${idx}-${item.x}-${item.y}`}
                                                    className={`island-radar-pin-container ${pinColorClass} ${isHovered ? 'active-pin' : ''}`}
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
                                                        {item.imageUrl && (
                                                            <div className="island-radar-pin-tooltip-thumb">
                                                                <img src={item.imageUrl} alt={item.name} />
                                                            </div>
                                                        )}
                                                        <div className="island-radar-pin-tooltip-info">
                                                            <span className="island-radar-pin-tooltip-name">{item.name}</span>
                                                            <div className="island-radar-pin-tooltip-meta">
                                                                <span className="island-radar-pin-cat-tag">{item.category}</span>
                                                                <span>{item.sector ? `${item.sector} ` : ''}({item.x}, {item.y})</span>
                                                            </div>
                                                        </div>
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
                                        <i className="fa-solid fa-cubes text-info"></i>
                                        All Island Items ({drawerItems.length})
                                    </>
                                )}
                            </h5>

                            {drawerItems.length > 0 && (
                                <button
                                    type="button"
                                    className="island-radar-drawer-copy-btn"
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
                                <div className="island-radar-feedback-toast animate-up">
                                    <i className="fa-solid fa-circle-check me-1.5 text-success"></i>
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
                                    <div className="spinner-border text-info mb-3" role="status"></div>
                                    <p className="fw-bold mb-0 text-light">Scanning Ground Layer...</p>
                                    <small className="text-secondary">Loading item manifest</small>
                                </div>
                            ) : searching ? (
                                <div className="island-radar-empty">
                                    <div className="spinner-border text-warning mb-3" role="status"></div>
                                    <p className="fw-bold mb-0 text-light">Searching island items...</p>
                                </div>
                            ) : drawerItems.length === 0 ? (
                                <div className="island-radar-empty">
                                    <i className="fa-solid fa-box-open"></i>
                                    <p className="fw-bold mb-1 text-light">
                                        {searchQuery ? 'No matching items found' : 'No Items In This Sector'}
                                    </p>
                                    <small className="text-secondary">
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
                                                            <i className="fa-solid fa-gift text-info opacity-75"></i>
                                                        )}
                                                    </div>

                                                    <div className="island-radar-item-text">
                                                        <span className="island-radar-item-name">{item.name}</span>
                                                        <div className="island-radar-item-sub">
                                                            <span className="island-radar-item-cat">{item.category}</span>
                                                            {item.x !== undefined && item.y !== undefined ? (
                                                                <>
                                                                    <span className="island-radar-dot-sep">•</span>
                                                                    <span className="island-radar-coord-tag">
                                                                        ({item.x}, {item.y})
                                                                    </span>
                                                                </>
                                                            ) : item.record_index !== undefined ? (
                                                                <>
                                                                    <span className="island-radar-dot-sep">•</span>
                                                                    <span>Slot #{item.record_index}</span>
                                                                </>
                                                            ) : (item.itemIdHex || item.internalId) ? (
                                                                <>
                                                                    <span className="island-radar-dot-sep">•</span>
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
                                        <div className="text-center py-2 text-secondary small">
                                            Showing first 150 of {drawerItems.length.toLocaleString()} matching items
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Holographic Item Detail Inspector Modal Dialog */}
                {inspectingItem && (
                    <div className="island-radar-inspect-backdrop" onClick={() => setInspectingItem(null)}>
                        <div className="island-radar-inspect-card animate-up" onClick={(e) => e.stopPropagation()}>
                            <div className="island-radar-inspect-header">
                                <div className="d-flex align-items-center gap-2">
                                    <i className="fa-solid fa-crosshairs text-info"></i>
                                    <h5 className="island-radar-inspect-title mb-0 text-truncate" style={{ maxWidth: '300px' }}>
                                        {inspectingItem.name}
                                    </h5>
                                </div>
                                <button
                                    type="button"
                                    className="island-radar-close-btn"
                                    onClick={() => setInspectingItem(null)}
                                    aria-label="Close"
                                >
                                    <i className="fa-solid fa-xmark"></i>
                                </button>
                            </div>

                            <div className="island-radar-inspect-body">
                                <div className="island-radar-inspect-img-box">
                                    {inspectingItem.imageUrl ? (
                                        <img src={inspectingItem.imageUrl} alt={inspectingItem.name} />
                                    ) : (
                                        <i className="fa-solid fa-gift fa-3x text-info opacity-75"></i>
                                    )}
                                </div>

                                <div className="island-radar-inspect-badges">
                                    <span className="badge bg-primary bg-opacity-30 text-info border border-info border-opacity-40 px-2.5 py-1">
                                        <i className={`${getCategoryIcon(inspectingItem.category)} me-1`}></i>
                                        {inspectingItem.category || 'Item'}
                                    </span>
                                    {inspectingItem.sector && (
                                        <span className="badge bg-info bg-opacity-20 text-info border border-info border-opacity-30 px-2 py-1">
                                            Sector {inspectingItem.sector}
                                        </span>
                                    )}
                                    {inspectingItem.record_index !== undefined && (
                                        <span className="badge bg-warning bg-opacity-20 text-warning border border-warning border-opacity-30 px-2 py-1">
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
                                        <span className="island-radar-inspect-grid-value text-light">
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
                                        <span className="island-radar-inspect-grid-value font-monospace text-info">
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
                                            <span className="island-radar-inspect-grid-value font-monospace small text-secondary">
                                                A: {inspectingItem.raw_A !== undefined ? `0x${inspectingItem.raw_A.toString(16).toUpperCase()}` : '--'},
                                                B: {inspectingItem.raw_B !== undefined ? `0x${inspectingItem.raw_B.toString(16).toUpperCase()}` : '--'}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div className="island-radar-inspect-actions">
                                    <div className="d-flex gap-2 w-100">
                                        <button
                                            type="button"
                                            className="island-radar-inspect-btn secondary"
                                            onClick={() => handleCopy(inspectingItem.name, 'Item Name')}
                                            title="Copy item name"
                                        >
                                            <i className="fa-solid fa-copy me-1"></i> Name
                                        </button>
                                        {inspectingItem.x !== undefined && inspectingItem.y !== undefined && (
                                            <button
                                                type="button"
                                                className="island-radar-inspect-btn secondary"
                                                onClick={() => handleCopy(`(${inspectingItem.x}, ${inspectingItem.y})`, 'Coordinates')}
                                                title="Copy coordinates"
                                            >
                                                <i className="fa-solid fa-location-crosshairs me-1"></i> Coords
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            className="island-radar-inspect-btn primary"
                                            onClick={() => {
                                                handleFocusItem(inspectingItem);
                                                setInspectingItem(null);
                                            }}
                                            title="Highlight on map"
                                        >
                                            <i className="fa-solid fa-crosshairs me-1"></i> Focus
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
