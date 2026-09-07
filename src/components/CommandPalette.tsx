import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCatalogData } from '../hooks/useCatalogData';
import { useIslandData } from '../context/useIslandData';
import { useTranslationSearch } from '../hooks/useTranslationSearch';
import { playChimeClick } from '../utils/kkAudioSynthesizer';
import LanguageSelectorPill from './LanguageSelectorPill';
import '../assets/css/command-palette.css';

interface NavItem {
    id: string;
    title: string;
    subtitle: string;
    icon: string;
    color: string;
    path: string;
    category: 'Pages & Tools';
}

const STATIC_NAV_ITEMS: NavItem[] = [
    { id: 'nav-home', title: 'Home', subtitle: 'Live departure board, streams, and latest updates', icon: 'fa-house', color: '#16a34a', path: '/', category: 'Pages & Tools' },
    { id: 'nav-order', title: 'Order Bot', subtitle: 'Interactive 3-step in-island drop bot & live flight pass', icon: 'fa-paper-plane', color: '#3b82f6', path: '/order', category: 'Pages & Tools' },
    { id: 'nav-islands', title: 'Treasure Islands', subtitle: 'Live server gate statuses, Dodo codes, and visitor counts', icon: 'fa-umbrella-beach', color: '#059669', path: '/islands', category: 'Pages & Tools' },
    { id: 'nav-builder', title: 'Command Builder', subtitle: 'Visual 40-slot pocket loadout builder and $order generator', icon: 'fa-terminal', color: '#10b981', path: '/command-builder', category: 'Pages & Tools' },
    { id: 'nav-planner', title: 'Island Trip Planner', subtitle: 'Multi-island flight route optimization engine', icon: 'fa-route', color: '#8b5cf6', path: '/trip-planner', category: 'Pages & Tools' },
    { id: 'nav-catalog', title: 'ACNH Catalogue', subtitle: 'Search 4,000+ items, variations, recipes, and villagers', icon: 'fa-boxes-stacked', color: '#f59e0b', path: '/catalog', category: 'Pages & Tools' },
    { id: 'nav-critters', title: 'Critterpedia', subtitle: 'Live fish, bugs, and sea creatures available right now', icon: 'fa-bug', color: '#06b6d4', path: '/critters', category: 'Pages & Tools' },
    { id: 'nav-pockets', title: 'Pocket Inventory', subtitle: 'Visual 40-pocket grid loadouts and share links', icon: 'fa-bag-shopping', color: '#6366f1', path: '/pockets', category: 'Pages & Tools' },
    { id: 'nav-collection', title: 'My Collection', subtitle: 'Track your collected items and view missing items', icon: 'fa-clipboard-check', color: '#10b981', path: '/my-collection', category: 'Pages & Tools' },
    { id: 'nav-wishlist', title: 'Wishlist', subtitle: 'Favorited items and bulk order exporter', icon: 'fa-heart', color: '#ef4444', path: '/wishlist', category: 'Pages & Tools' },
    { id: 'nav-events', title: 'Events Calendar', subtitle: 'In-game seasonal events and villager birthdays', icon: 'fa-calendar-days', color: '#ec4899', path: '/events', category: 'Pages & Tools' },
    { id: 'nav-npcs', title: 'Villagers & Special NPCs', subtitle: 'Villager directory, gift tastes, and visitor schedules', icon: 'fa-paw', color: '#d97706', path: '/npcs', category: 'Pages & Tools' },
    { id: 'nav-dodo', title: 'Dodo Decryptor', subtitle: 'Decrypt hashed Dodo codes from Discord', icon: 'fa-key', color: '#64748b', path: '/dodo', category: 'Pages & Tools' },
    { id: 'nav-guides', title: 'Flight Guides & Rules', subtitle: 'How to fly, airport rules, and treasure island FAQs', icon: 'fa-book-open', color: '#0284c7', path: '/guides', category: 'Pages & Tools' },
    { id: 'nav-profile', title: 'Resident Passport', subtitle: 'Your custom island passport, dream address, and badges', icon: 'fa-passport', color: '#7c3aed', path: '/profile', category: 'Pages & Tools' },
];

export const CommandPalette: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);

    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    const { data: catalogData } = useCatalogData();
    const { islands } = useIslandData();
    const { searchLang, setSearchLang, getMatchingEnglishNames, isLoadingTranslations } = useTranslationSearch();

    // Toggle modal via custom events or global keyboard shortcut
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Check for Ctrl+K or Cmd+K
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setIsOpen((prev) => !prev);
                playChimeClick();
                return;
            }

            // Check for '/' key when not in an active input or textarea
            const target = e.target as HTMLElement | null;
            const isTyping =
                target?.tagName === 'INPUT' ||
                target?.tagName === 'TEXTAREA' ||
                target?.isContentEditable;

            if (e.key === '/' && !isTyping && !isOpen) {
                e.preventDefault();
                setIsOpen(true);
                playChimeClick();
                return;
            }

            // Escape key closes modal
            if (e.key === 'Escape' && isOpen) {
                e.preventDefault();
                setIsOpen(false);
            }
        };

        const handleOpenEvent = () => {
            setIsOpen(true);
            playChimeClick();
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('chopaeng_open_search', handleOpenEvent);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('chopaeng_open_search', handleOpenEvent);
        };
    }, [isOpen]);

    // Auto-focus search input when opened
    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    // Search matching results
    const matchingResults = useMemo(() => {
        const cleanQuery = query.trim().toLowerCase();

        // 1. Navigation Pages
        const navMatches = STATIC_NAV_ITEMS.filter((item) => {
            if (!cleanQuery) return true;
            return (
                item.title.toLowerCase().includes(cleanQuery) ||
                item.subtitle.toLowerCase().includes(cleanQuery)
            );
        }).slice(0, cleanQuery ? 5 : 6);

        // 2. Live Islands
        const islandMatches = (islands || []).filter((isl) => {
            if (!cleanQuery) return false;
            return (
                isl.name.toLowerCase().includes(cleanQuery) ||
                isl.cat.toLowerCase().includes(cleanQuery) ||
                (isl.description && isl.description.toLowerCase().includes(cleanQuery))
            );
        }).slice(0, 4);

        // 3. Catalog Items & Villagers
        const matchingEnNames = cleanQuery ? getMatchingEnglishNames(cleanQuery) : null;
        let itemMatches: any[] = [];
        let villagerMatches: any[] = [];

        if (cleanQuery && catalogData?.all) {
            const matchedEntities = catalogData.all.filter((entity) => {
                if (matchingEnNames !== null) {
                    return matchingEnNames.has(entity.name.toLowerCase());
                }
                return entity.name.toLowerCase().includes(cleanQuery);
            });

            itemMatches = matchedEntities
                .filter((e) => e.entityType === 'item')
                .slice(0, 6);

            villagerMatches = matchedEntities
                .filter((e) => e.entityType === 'villager')
                .slice(0, 4);
        }

        return {
            nav: navMatches,
            islands: islandMatches,
            items: itemMatches,
            villagers: villagerMatches,
            totalCount: navMatches.length + islandMatches.length + itemMatches.length + villagerMatches.length,
        };
    }, [query, islands, catalogData, getMatchingEnglishNames]);

    // Flat array of navigable items for keyboard indexing
    const flattenedItems = useMemo(() => {
        const list: Array<{ type: 'nav' | 'island' | 'item' | 'villager'; data: any }> = [];

        matchingResults.nav.forEach((n) => list.push({ type: 'nav', data: n }));
        matchingResults.islands.forEach((i) => list.push({ type: 'island', data: i }));
        matchingResults.items.forEach((it) => list.push({ type: 'item', data: it }));
        matchingResults.villagers.forEach((v) => list.push({ type: 'villager', data: v }));

        return list;
    }, [matchingResults]);

    // Keyboard navigation (Arrow keys & Enter)
    const handleSelectIndex = useCallback((index: number) => {
        if (!flattenedItems[index]) return;
        const item = flattenedItems[index];

        playChimeClick();
        setIsOpen(false);

        if (item.type === 'nav') {
            navigate(item.data.path);
        } else if (item.type === 'island') {
            navigate(`/island/${item.data.id || item.data.name}`);
        } else if (item.type === 'item') {
            navigate(`/item/${item.data.id}`);
        } else if (item.type === 'villager') {
            navigate(`/villager/${item.data.id}`);
        }
    }, [flattenedItems, navigate]);

    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex((prev) => (prev + 1) % Math.max(1, flattenedItems.length));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex((prev) => (prev - 1 + flattenedItems.length) % Math.max(1, flattenedItems.length));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            handleSelectIndex(selectedIndex);
        }
    };

    if (!isOpen) return null;

    let currentIndexCounter = -1;

    return (
        <div
            className="command-palette-backdrop"
            onClick={(e) => {
                if (e.target === e.currentTarget) setIsOpen(false);
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Command Palette Quick Search"
        >
            <div className="command-palette-container" onClick={(e) => e.stopPropagation()}>
                {/* Search Header */}
                <div className="command-palette-header">
                    <i className="fa-solid fa-magnifying-glass text-muted fs-5" aria-hidden="true" />
                    <input
                        ref={inputRef}
                        type="text"
                        className="command-palette-input"
                        placeholder={searchLang !== 'en' ? `Search Chopaeng in ${searchLang}...` : "Search pages, items, villagers, islands (e.g. Order Bot, Raymond)..."}
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setSelectedIndex(0);
                        }}
                        onKeyDown={handleInputKeyDown}
                        aria-label="Universal Search Input"
                    />
                    <LanguageSelectorPill
                        searchLang={searchLang}
                        onChangeLang={setSearchLang}
                        isLoading={isLoadingTranslations}
                        compact={true}
                    />
                    <button
                        type="button"
                        className="btn btn-sm btn-link text-muted p-0 ms-1"
                        onClick={() => setIsOpen(false)}
                        aria-label="Close search"
                    >
                        <i className="fa-solid fa-xmark fs-5" />
                    </button>
                </div>

                {/* Results List */}
                <div className="command-palette-body" ref={listRef}>
                    {flattenedItems.length === 0 ? (
                        <div className="text-center py-5 text-muted">
                            <i className="fa-solid fa-magnifying-glass fs-3 mb-2 opacity-40 d-block" />
                            <p className="fw-bold mb-1">No matching results found</p>
                            <span className="small">Try searching for an item name, island name, or tool</span>
                        </div>
                    ) : (
                        <>
                            {/* Pages & Tools Section */}
                            {matchingResults.nav.length > 0 && (
                                <div className="mb-2">
                                    <div className="command-palette-section-title">Navigation & Tools</div>
                                    {matchingResults.nav.map((navItem) => {
                                        currentIndexCounter++;
                                        const idx = currentIndexCounter;
                                        const isActive = selectedIndex === idx;
                                        return (
                                            <div
                                                key={navItem.id}
                                                className={`command-palette-item ${isActive ? 'active' : ''}`}
                                                onClick={() => handleSelectIndex(idx)}
                                                onMouseEnter={() => setSelectedIndex(idx)}
                                            >
                                                <div className="d-flex align-items-center gap-3">
                                                    <div
                                                        className="command-palette-item-icon text-white"
                                                        style={{ backgroundColor: navItem.color }}
                                                    >
                                                        <i className={`fa-solid ${navItem.icon}`} />
                                                    </div>
                                                    <div>
                                                        <div className="fw-bold small">{navItem.title}</div>
                                                        <div className="tiny-text text-muted">{navItem.subtitle}</div>
                                                    </div>
                                                </div>
                                                <i className="fa-solid fa-arrow-right text-muted small opacity-50" />
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Live Islands Section */}
                            {matchingResults.islands.length > 0 && (
                                <div className="mb-2">
                                    <div className="command-palette-section-title">Live Treasure Islands</div>
                                    {matchingResults.islands.map((isl) => {
                                        currentIndexCounter++;
                                        const idx = currentIndexCounter;
                                        const isActive = selectedIndex === idx;
                                        return (
                                            <div
                                                key={isl.id || isl.name}
                                                className={`command-palette-item ${isActive ? 'active' : ''}`}
                                                onClick={() => handleSelectIndex(idx)}
                                                onMouseEnter={() => setSelectedIndex(idx)}
                                            >
                                                <div className="d-flex align-items-center gap-3">
                                                    <div
                                                        className="command-palette-item-icon text-white"
                                                        style={{ backgroundColor: isl.cat === 'member' ? '#8b5cf6' : '#10b981' }}
                                                    >
                                                        <i className="fa-solid fa-umbrella-beach" />
                                                    </div>
                                                    <div>
                                                        <div className="fw-bold small d-flex align-items-center gap-2">
                                                            <span>{isl.name}</span>
                                                            <span className={`badge rounded-pill ${isl.cat === 'member' ? 'bg-purple-subtle text-purple' : 'bg-success-subtle text-success'}`} style={{ fontSize: '0.65rem' }}>
                                                                {isl.cat === 'member' ? 'Sub Only' : 'Free Island'}
                                                            </span>
                                                        </div>
                                                        <div className="tiny-text text-muted">
                                                            {isl.description || 'ACNH Treasure Island'}
                                                        </div>
                                                    </div>
                                                </div>
                                                <span className="badge bg-light text-dark border">
                                                    {isl.status === 'ONLINE' ? 'Online' : (isl.status || 'Active')}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Catalog Items Section */}
                            {matchingResults.items.length > 0 && (
                                <div className="mb-2">
                                    <div className="command-palette-section-title">Catalog Items & Recipes</div>
                                    {matchingResults.items.map((item) => {
                                        currentIndexCounter++;
                                        const idx = currentIndexCounter;
                                        const isActive = selectedIndex === idx;
                                        return (
                                            <div
                                                key={item.id}
                                                className={`command-palette-item ${isActive ? 'active' : ''}`}
                                                onClick={() => handleSelectIndex(idx)}
                                                onMouseEnter={() => setSelectedIndex(idx)}
                                            >
                                                <div className="d-flex align-items-center gap-3">
                                                    <img
                                                        src={item.image || 'https://acnhcdn.com/latest/FtrIcon/FtrLeaf.png'}
                                                        alt={item.name}
                                                        width={32}
                                                        height={32}
                                                        className="rounded-circle object-fit-contain bg-light p-1"
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).src = 'https://acnhcdn.com/latest/FtrIcon/FtrLeaf.png';
                                                        }}
                                                    />
                                                    <div>
                                                        <div className="fw-bold small">{item.name}</div>
                                                        <div className="tiny-text text-muted">
                                                            {item.category} • {item.buy ? `${item.buy.toLocaleString()} Bells` : 'Catalog Item'}
                                                        </div>
                                                    </div>
                                                </div>
                                                <span className="badge bg-light text-dark border small font-monospace">
                                                    #{item.id}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Villagers Section */}
                            {matchingResults.villagers.length > 0 && (
                                <div className="mb-2">
                                    <div className="command-palette-section-title">Villagers</div>
                                    {matchingResults.villagers.map((v) => {
                                        currentIndexCounter++;
                                        const idx = currentIndexCounter;
                                        const isActive = selectedIndex === idx;
                                        return (
                                            <div
                                                key={v.id}
                                                className={`command-palette-item ${isActive ? 'active' : ''}`}
                                                onClick={() => handleSelectIndex(idx)}
                                                onMouseEnter={() => setSelectedIndex(idx)}
                                            >
                                                <div className="d-flex align-items-center gap-3">
                                                    <img
                                                        src={v.image || v.photoImage || 'https://acnhcdn.com/latest/FtrIcon/FtrLeaf.png'}
                                                        alt={v.name}
                                                        width={32}
                                                        height={32}
                                                        className="rounded-circle object-fit-cover bg-light"
                                                    />
                                                    <div>
                                                        <div className="fw-bold small">{v.name}</div>
                                                        <div className="tiny-text text-muted">
                                                            {v.species || 'Villager'} • {v.personality || 'Resident'}
                                                        </div>
                                                    </div>
                                                </div>
                                                <span className="badge bg-warning-subtle text-warning-emphasis border rounded-pill">
                                                    <i className="fa-solid fa-paw me-1" /> Villager
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer Keyboard Hints */}
                <div className="command-palette-footer">
                    <div className="d-flex align-items-center gap-2">
                        <span><kbd className="command-palette-kbd">↑</kbd> <kbd className="command-palette-kbd">↓</kbd> to navigate</span>
                        <span>•</span>
                        <span><kbd className="command-palette-kbd">↵</kbd> to select</span>
                    </div>
                    <div>
                        <span><kbd className="command-palette-kbd">esc</kbd> to close</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CommandPalette;
