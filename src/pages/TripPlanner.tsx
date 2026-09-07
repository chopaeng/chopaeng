import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useSearchParams } from 'react-router-dom';
import { useIslandData } from '../context/useIslandData';
import { useAuth } from '../context/useAuth';
import { useCatalogData } from '../hooks/useCatalogData';
import { useFavorites } from '../hooks/useFavorites';
import { type IslandData } from '../data/islands';
import { playChimeClick } from '../utils/kkAudioSynthesizer';
import { DODO_API_BASE } from '../config/api';
import { getAuthToken } from '../context/authToken';
import { HowItWorksExplainer, TRIP_PLANNER_EXPLAINER_CONFIG } from '../components/HowItWorksExplainer';

interface SelectedPlanItem {
    id: string;
    name: string;
    category?: string;
    image?: string;
    type: 'item' | 'villager' | 'recipe';
}

interface IslandStop {
    island: IslandData;
    itemsToCollect: SelectedPlanItem[];
    coverageScore: number;
}

const FALLBACK_IMAGE =
    "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23f1f3f5'/%3E%3C/svg%3E";

const POPULAR_SEARCH_PRESETS = [
    { name: 'Ironwood DIY Set', icon: 'fa-couch', tags: ['Ironwood', 'Kitchenette', 'Bed', 'Clock'] },
    { name: 'Golden Tools DIYs', icon: 'fa-hammer', tags: ['Golden Axe', 'Golden Shovel', 'Golden Net', 'Golden Rod'] },
    { name: 'Sanrio Collection', icon: 'fa-heart', tags: ['Cinnamoroll', 'Pompompurin', 'Keroppi', 'My Melody'] },
    { name: 'Popular Villagers', icon: 'fa-paw', tags: ['Raymond', 'Shino', 'Sasha', 'Marshal', 'Ankha'] },
    { name: 'Island Essentials', icon: 'fa-gem', tags: ['Nook Miles Ticket', 'Gold Nugget', '99,000 Bells', 'Crown'] },
];

export const TripPlanner: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const { islands, villagersMap } = useIslandData();
    const { user, canAccessIsland } = useAuth();
    const { data: catalogData, isLoading: catalogLoading } = useCatalogData();
    const { favorites } = useFavorites();

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedItems, setSelectedItems] = useState<SelectedPlanItem[]>([]);
    const [filterAccess, setFilterAccess] = useState<'all' | 'unlocked'>('all');
    const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
    const [shareCopied, setShareCopied] = useState(false);
    const [dodoReveals, setDodoReveals] = useState<Record<string, { code: string; loading: boolean; error?: string }>>({});

    // Parse URL on mount
    useEffect(() => {
        const itemParam = searchParams.get('items');
        if (itemParam && catalogData?.all) {
            const ids = itemParam.split(',').filter(Boolean);
            const found: SelectedPlanItem[] = [];
            for (const id of ids) {
                const match = catalogData.all.find((i) => String(i.id).toLowerCase() === id.toLowerCase() || i.name.toLowerCase() === id.toLowerCase());
                if (match) {
                    found.push({
                        id: String(match.id),
                        name: match.name,
                        category: match.category,
                        image: match.image,
                        type: match.entityType === 'villager' ? 'villager' : 'item',
                    });
                }
            }
            if (found.length > 0) {
                setSelectedItems(found);
            }
        }
    }, [searchParams, catalogData?.all]);

    // Update URL when items change
    const updateUrlParams = useCallback((items: SelectedPlanItem[]) => {
        if (items.length === 0) {
            setSearchParams({});
        } else {
            setSearchParams({ items: items.map((i) => i.name).join(',') });
        }
    }, [setSearchParams]);

    // Live search filtered results
    const searchResults = useMemo(() => {
        if (!searchQuery.trim() || !catalogData?.all) return [];
        const q = searchQuery.toLowerCase().trim();
        return catalogData.all
            .filter((item) =>
                item.name.toLowerCase().includes(q) ||
                (item.category && item.category.toLowerCase().includes(q))
            )
            .slice(0, 12);
    }, [searchQuery, catalogData?.all]);

    // Toggle item selection
    const handleAddItem = (item: { id: string | number; name: string; category?: string; image?: string; entityType?: string }) => {
        playChimeClick();
        if (selectedItems.some((i) => i.name.toLowerCase() === item.name.toLowerCase())) return;

        const newItem: SelectedPlanItem = {
            id: String(item.id),
            name: item.name,
            category: item.category,
            image: item.image,
            type: item.entityType === 'villager' ? 'villager' : 'item',
        };

        const updated = [...selectedItems, newItem];
        setSelectedItems(updated);
        updateUrlParams(updated);
        setSearchQuery('');
    };

    const handleRemoveItem = (id: string) => {
        playChimeClick();
        const updated = selectedItems.filter((i) => i.id !== id);
        setSelectedItems(updated);
        updateUrlParams(updated);
    };

    const handleClearAll = () => {
        playChimeClick();
        setSelectedItems([]);
        setCheckedItems({});
        updateUrlParams([]);
    };

    const handleImportWishlist = () => {
        playChimeClick();
        if (!favorites || favorites.length === 0 || !catalogData?.all) return;
        const wishlist = favorites
            .map((favId) => catalogData.all.find((it) => String(it.id) === favId))
            .filter((it): it is NonNullable<typeof it> => Boolean(it))
            .map((it) => ({
                id: String(it.id),
                name: it.name,
                category: it.category,
                image: it.image,
                type: it.entityType === 'villager' ? ('villager' as const) : ('item' as const),
            }));

        const combined = [...selectedItems];
        for (const item of wishlist) {
            if (!combined.some((c) => c.name.toLowerCase() === item.name.toLowerCase())) {
                combined.push(item);
            }
        }
        setSelectedItems(combined);
        updateUrlParams(combined);
    };

    // Extract alphabetical letter range from island name or description (e.g. "A-M", "N-Z", "A to C")
    const getLetterRange = (text: string): [string, string] | null => {
        const match = text.match(/\b([a-z])\s*(?:-|–|—|to)\s*([a-z])\b/i);
        if (match) {
            return [match[1].toUpperCase(), match[2].toUpperCase()];
        }
        return null;
    };

    // Calculate match score between a requested item and an island
    const calculateItemIslandScore = useCallback((
        item: SelectedPlanItem,
        isl: IslandData,
        vMap: Record<string, string[]>
    ): number => {
        const queryLower = item.name.toLowerCase().trim();
        const catLower = (item.category || '').toLowerCase().trim();
        const islName = isl.name.toLowerCase().trim();
        const islDesc = (isl.description || '').toLowerCase().trim();
        const islType = (isl.type || '').toLowerCase().trim();
        const islItems = (isl.items || []).map((i) => i.toLowerCase().trim());
        const islSeasonal = (isl.seasonal || '').toLowerCase().trim();

        const islVillagers = [
            ...(vMap[isl.name] || []),
            ...(vMap[isl.canonicalName || ''] || []),
            ...(vMap[isl.id] || []),
        ].map((v) => v.toLowerCase().trim());

        let score = 0;

        // 1. Villager Matching
        if (item.type === 'villager') {
            if (islVillagers.includes(queryLower)) return 200;
            if (islVillagers.some((v) => v.includes(queryLower) || queryLower.includes(v))) return 160;
            if (islName.includes('villager') || islType.includes('villager') || islDesc.includes('villager')) {
                return 80;
            }
            return 0; // Avoid non-villager islands for villagers when villager islands exist
        }

        // 2. Direct Item / Tag Match in Island Items list
        if (islItems.includes(queryLower)) score += 150;
        else if (islItems.some((it) => it.length > 2 && (queryLower.includes(it) || it.includes(queryLower)))) {
            score += 110;
        }

        // 3. Exact name in Island Description or Name
        if (islDesc.includes(queryLower)) score += 100;
        if (islName.includes(queryLower)) score += 90;

        // 4. Sanrio & Collabs
        const isSanrioItem = ['cinnamoroll', 'pompompurin', 'keroppi', 'my melody', 'hello kitty', 'toby', 'chai', 'chelsea', 'etoile', 'marty', 'rilla', 'sanrio', 'mario'].some(s => queryLower.includes(s));
        if (isSanrioItem) {
            if (islName.includes('sanrio') || islDesc.includes('sanrio') || islType.includes('sanrio') || islItems.some(i => i.includes('sanrio'))) {
                score += 140;
            }
        }

        // 5. DIY & Recipe Matching
        const isDIY = catLower.includes('diy') || catLower.includes('recipe') || queryLower.includes('diy') || queryLower.includes('recipe');
        if (isDIY) {
            if (islType.includes('diy') || islName.includes('diy') || islDesc.includes('diy') || islName.includes('recipe') || islDesc.includes('recipe')) {
                score += 100;
            }
        }

        // 6. Materials / Resources / Currency / NMT / Bells
        const isMaterial = catLower.includes('material') || ['nugget', 'wood', 'stone', 'iron', 'clay', 'fragment', 'nook miles', 'ticket', 'nmt', 'bell', 'pearl', 'star fragment', 'crown'].some(m => queryLower.includes(m));
        if (isMaterial) {
            if (islType.includes('material') || islDesc.includes('material') || islName.includes('material') || islName.includes('resource') || islName.includes('nmt') || islName.includes('bell') || islName.includes('treasure')) {
                score += 100;
            }
        }

        // 7. Clothing / Wearables / Outfits
        const isClothing = ['clothing', 'dress', 'hat', 'shoes', 'accessories', 'bottoms', 'tops', 'socks', 'headwear', 'bags'].some(c => catLower.includes(c));
        if (isClothing) {
            if (islType.includes('clothing') || islDesc.includes('clothing') || islName.includes('clothing') || islName.includes('fashion') || islName.includes('apparel')) {
                score += 90;
            }
        }

        // 8. Furniture / Housewares / Interior
        const isFurniture = ['furniture', 'housewares', 'miscellaneous', 'ceiling', 'wall-mounted', 'wallpaper', 'flooring', 'rugs'].some(f => catLower.includes(f));
        if (isFurniture) {
            if (islType.includes('furniture') || islDesc.includes('furniture') || islName.includes('furniture') || islName.includes('catalog') || islType.includes('catalog')) {
                score += 80;
            }
        }

        // 9. Alphabetical Catalog Letter Range Matching (e.g. Catalog A-M vs N-Z)
        const letterRange = getLetterRange(islName) || getLetterRange(islDesc);
        if (letterRange) {
            const firstLetter = item.name.charAt(0).toUpperCase();
            if (firstLetter >= letterRange[0] && firstLetter <= letterRange[1]) {
                score += 70;
            } else if (firstLetter.match(/[A-Z]/)) {
                score -= 50; // Penalize wrong alphabetical catalog island
            }
        }

        // 10. Seasonal Matching (e.g. Cherry Blossom, Spooky, Festive, Winter, Summer)
        const isSeasonal = ['cherry blossom', 'spooky', 'festive', 'illuminated', 'frozen', 'mush', 'autumn', 'summer', 'winter', 'spring', 'easter', 'bunny day'].some(s => queryLower.includes(s) || catLower.includes(s));
        if (isSeasonal) {
            if (['cherry', 'spooky', 'festive', 'mush', 'winter', 'summer', 'spring', 'seasonal'].some(s => islName.includes(s) || islDesc.includes(s) || islSeasonal.includes(s))) {
                score += 60;
            }
        }

        // 11. General / All-Item Treasure Island Base Match
        if (islType.includes('all') || islDesc.includes('all items') || islName.includes('mega') || islName.includes('treasure') || islType.includes('general')) {
            score += 20;
        }

        return Math.max(0, score);
    }, []);

    // Calculate optimal island itinerary
    const itinerary = useMemo<IslandStop[]>(() => {
        if (selectedItems.length === 0 || islands.length === 0) return [];

        let availableIslands = islands;
        if (filterAccess === 'unlocked') {
            availableIslands = islands.filter((isl) => isl.cat === 'public' || (!!user && canAccessIsland(isl.requiredRoles)));
        }

        if (availableIslands.length === 0) return [];

        // Precompute (item, island) match scores
        const itemCandidateMap = new Map<string, { island: IslandData; score: number }[]>();

        for (const item of selectedItems) {
            const candidates: { island: IslandData; score: number }[] = [];
            for (const isl of availableIslands) {
                const score = calculateItemIslandScore(item, isl, villagersMap || {});
                if (score > 0) {
                    candidates.push({ island: isl, score });
                }
            }

            // Sort candidate islands by score descending
            candidates.sort((a, b) => b.score - a.score);

            // If no specialized match, fallback to general islands
            if (candidates.length === 0) {
                candidates.push(
                    ...availableIslands.map((isl, idx) => ({
                        island: isl,
                        score: 10 + (idx === 0 ? 1 : 0),
                    }))
                );
            }

            itemCandidateMap.set(item.id, candidates);
        }

        // Multi-island Greedy Set-Cover Optimizer
        const stops: IslandStop[] = [];
        let remainingItems = [...selectedItems];
        const visitedIslandIds = new Set<string>();

        while (remainingItems.length > 0) {
            let bestIsland: IslandData | null = null;
            let bestCoveredItems: SelectedPlanItem[] = [];
            let bestTotalScore = -1;

            for (const isl of availableIslands) {
                // Find remaining items this island can cover
                const covered = remainingItems.filter((it) => {
                    const candidates = itemCandidateMap.get(it.id) || [];
                    return candidates.some((c) => c.island.id === isl.id && c.score > 0);
                });

                if (covered.length === 0) continue;

                // Cumulative score
                let totalScore = covered.reduce((sum, it) => {
                    const c = (itemCandidateMap.get(it.id) || []).find((cand) => cand.island.id === isl.id);
                    return sum + (c ? c.score : 0);
                }, 0);

                // Online & low queue bonus
                if (isl.status === 'ONLINE') totalScore += 15;
                totalScore += Math.max(0, 7 - (isl.visitors || 0));

                // Prefer non-duplicate stops if scores are comparable
                if (visitedIslandIds.has(isl.id)) {
                    totalScore -= 20;
                }

                if (covered.length > bestCoveredItems.length || (covered.length === bestCoveredItems.length && totalScore > bestTotalScore)) {
                    bestCoveredItems = covered;
                    bestIsland = isl;
                    bestTotalScore = totalScore;
                }
            }

            if (!bestIsland || bestCoveredItems.length === 0) {
                // Fallback for any leftover items
                const fallback = availableIslands.find((i) => !visitedIslandIds.has(i.id)) || availableIslands[0];
                if (fallback) {
                    stops.push({
                        island: fallback,
                        itemsToCollect: remainingItems,
                        coverageScore: remainingItems.length,
                    });
                    visitedIslandIds.add(fallback.id);
                }
                break;
            }

            stops.push({
                island: bestIsland,
                itemsToCollect: bestCoveredItems,
                coverageScore: bestCoveredItems.length,
            });
            visitedIslandIds.add(bestIsland.id);

            // Remove covered items
            remainingItems = remainingItems.filter((it) => !bestCoveredItems.some((c) => c.id === it.id));
        }

        return stops;
    }, [selectedItems, islands, filterAccess, user, canAccessIsland, villagersMap, calculateItemIslandScore]);

    // Handle Reveal Dodo for an Island
    const handleRevealDodo = async (island: IslandData) => {
        playChimeClick();
        if (island.dodoCode) {
            return;
        }

        setDodoReveals((prev) => ({ ...prev, [island.id]: { code: '', loading: true } }));
        try {
            const token = getAuthToken();
            const resp = await fetch(`${DODO_API_BASE}/api/islands/${encodeURIComponent(island.name)}/dodo`, {
                method: 'POST',
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                credentials: 'include',
            });

            if (resp.ok) {
                const data = await resp.json();
                const code = String(data.dodo_code || '').split(': ').pop() || String(data.dodo_code || '');
                setDodoReveals((prev) => ({ ...prev, [island.id]: { code, loading: false } }));
            } else {
                const err = await resp.json().catch(() => ({}));
                setDodoReveals((prev) => ({
                    ...prev,
                    [island.id]: { code: '', loading: false, error: err.error || 'Dodo code unavailable.' },
                }));
            }
        } catch {
            setDodoReveals((prev) => ({
                ...prev,
                [island.id]: { code: '', loading: false, error: 'Network error retrieving Dodo code.' },
            }));
        }
    };

    const handleShareTrip = () => {
        playChimeClick();
        navigator.clipboard.writeText(window.location.href).catch(() => {});
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2500);
    };

    const toggleItemChecked = (itemId: string) => {
        playChimeClick();
        setCheckedItems((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
    };

    return (
        <div className="nook-bg min-vh-100 py-4 font-nunito">
            <Helmet>
                <title>ACNH Island Trip Planner · Chopaeng</title>
                <meta
                    name="description"
                    content="Plan the most efficient island trip to collect your dream items, DIY recipes, materials, and villagers in Animal Crossing: New Horizons."
                />
            </Helmet>

            <div className="container py-2">
                {/* ════ HERO HEADER ════ */}
                <div className="text-center mb-4">
                    <div className="d-inline-flex align-items-center gap-2 px-3 py-1 rounded-pill bg-light border mb-2">
                        <i className="fa-solid fa-map-location-dot text-success" />
                        <span className="tiny-text fw-bold text-dark text-uppercase tracking-wider">
                            Intelligent Route Optimizer
                        </span>
                    </div>
                    <h1 className="ac-font h2 fw-black text-dark mb-1 d-flex align-items-center justify-content-center gap-2">
                        <i className="fa-solid fa-compass text-success"></i>
                        Island Trip Planner
                    </h1>
                    <p className="text-muted small fw-bold mb-3" style={{ maxWidth: 620, margin: '0 auto' }}>
                        Search for items, DIYs, materials, or villagers. We'll map the optimal flight route to get 100% of your list in the fewest stops!
                    </p>

                    <div className="d-flex justify-content-center gap-2 flex-wrap">
                        <button
                            type="button"
                            className="btn btn-sm btn-outline-success rounded-pill px-3 fw-bold d-inline-flex align-items-center gap-1 shadow-2xs"
                            onClick={handleImportWishlist}
                            disabled={!favorites || favorites.length === 0}
                        >
                            <i className="fa-solid fa-star text-warning" />
                            <span>Import Wishlist ({favorites?.length || 0})</span>
                        </button>
                        {selectedItems.length > 0 && (
                            <>
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-primary rounded-pill px-3 fw-bold d-inline-flex align-items-center gap-1 shadow-2xs"
                                    onClick={handleShareTrip}
                                >
                                    <i className={`fa-solid ${shareCopied ? 'fa-check text-success' : 'fa-share-nodes'}`} />
                                    <span>{shareCopied ? 'Trip Link Copied!' : 'Share Itinerary'}</span>
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-sm btn-link text-danger fw-bold tiny-text text-decoration-none"
                                    onClick={handleClearAll}
                                >
                                    <i className="fa-solid fa-trash-can me-1" /> Clear List
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* ── REUSABLE HOW IT WORKS EXPLAINER ── */}
                <HowItWorksExplainer {...TRIP_PLANNER_EXPLAINER_CONFIG} className="mb-4" defaultExpanded={false} />

                <div className="row g-4">
                    {/* ════ LEFT COLUMN: ITEM SEARCH & SELECTION ════ */}
                    <div className="col-12 col-lg-5">
                        <div className="card rounded-4 p-4 border shadow-sm bg-white mb-4">
                            <h2 className="h6 fw-black text-dark mb-3 ac-font d-flex align-items-center justify-content-between">
                                <span>1. Select Items to Find</span>
                                <span className="badge bg-success bg-opacity-10 text-success rounded-pill x-small fw-bold">
                                    {selectedItems.length} Selected
                                </span>
                            </h2>

                            {/* Search Input */}
                            <div className="position-relative mb-3">
                                <i className="fa-solid fa-magnifying-glass position-absolute top-50 start-0 translate-middle-y ms-3 text-muted" />
                                <input
                                    type="text"
                                    className="form-control rounded-pill ps-5 pe-4 py-2 border-2 shadow-2xs"
                                    placeholder="Search item, DIY, material, or villager..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        className="btn btn-link position-absolute top-50 end-0 translate-middle-y me-2 p-0 text-muted"
                                        onClick={() => setSearchQuery('')}
                                    >
                                        <i className="fa-solid fa-xmark" />
                                    </button>
                                )}
                            </div>

                            {/* Live Search Suggestions Dropdown */}
                            {searchQuery.trim() && (
                                <div className="card rounded-3 p-2 border mb-3 shadow-sm bg-light">
                                    {catalogLoading ? (
                                        <div className="text-center py-2 text-muted small">Searching catalog…</div>
                                    ) : searchResults.length === 0 ? (
                                        <div className="text-center py-2 text-muted small">No matches found for "{searchQuery}"</div>
                                    ) : (
                                        <div className="d-flex flex-column gap-1">
                                            {searchResults.map((item) => {
                                                const isAlreadySelected = selectedItems.some(
                                                    (i) => i.name.toLowerCase() === item.name.toLowerCase()
                                                );
                                                return (
                                                    <button
                                                        key={item.id}
                                                        type="button"
                                                        className={`btn btn-sm text-start rounded-3 d-flex align-items-center justify-content-between p-2 transition-all ${
                                                            isAlreadySelected ? 'bg-success-subtle text-success' : 'btn-white hover-bg-white border'
                                                        }`}
                                                        onClick={() => handleAddItem(item)}
                                                        disabled={isAlreadySelected}
                                                    >
                                                        <div className="d-flex align-items-center gap-2 min-w-0">
                                                            <img
                                                                src={item.image || FALLBACK_IMAGE}
                                                                alt=""
                                                                style={{ width: 26, height: 26, objectFit: 'contain' }}
                                                            />
                                                            <div className="min-w-0">
                                                                <div className="fw-bold small text-truncate">{item.name}</div>
                                                                <span className="tiny-text text-muted">{item.category || item.entityType}</span>
                                                            </div>
                                                        </div>
                                                        <span className="badge bg-light text-dark border rounded-pill x-small">
                                                            {isAlreadySelected ? 'Added' : '+ Add'}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Popular Quick Presets */}
                            <div className="mb-3">
                                <span className="tiny-text fw-bold text-muted text-uppercase tracking-wider d-block mb-2">
                                    <i className="fa-solid fa-wand-magic-sparkles text-warning me-1" /> Quick Presets:
                                </span>
                                <div className="d-flex flex-wrap gap-1">
                                    {POPULAR_SEARCH_PRESETS.map((preset) => (
                                        <button
                                            key={preset.name}
                                            type="button"
                                            className="btn btn-xs rounded-pill bg-light border text-dark fw-bold px-2 py-1 tiny-text d-inline-flex align-items-center gap-1 shadow-2xs hover-bg-light"
                                            onClick={() => {
                                                playChimeClick();
                                                if (!catalogData?.all) return;
                                                for (const tag of preset.tags) {
                                                    const match = catalogData.all.find((i) => i.name.toLowerCase().includes(tag.toLowerCase()));
                                                    if (match) handleAddItem(match);
                                                }
                                            }}
                                        >
                                            <i className={`fa-solid ${preset.icon} text-success`} />
                                            <span>{preset.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Selected Items Basket */}
                            <div>
                                <span className="tiny-text fw-bold text-muted text-uppercase tracking-wider d-block mb-2">
                                    Your Target Checklist ({selectedItems.length}):
                                </span>
                                {selectedItems.length === 0 ? (
                                    <div className="text-center py-4 bg-light rounded-4 border text-muted">
                                        <i className="fa-solid fa-bag-shopping fs-3 mb-2 d-block opacity-40" />
                                        <span className="small fw-bold d-block">No items added yet</span>
                                        <span className="tiny-text">Search items above or pick a quick preset to start planning!</span>
                                    </div>
                                ) : (
                                    <div className="d-flex flex-column gap-2" style={{ maxHeight: 320, overflowY: 'auto' }}>
                                        {selectedItems.map((item) => (
                                            <div
                                                key={item.id}
                                                className="d-flex align-items-center justify-content-between p-2 rounded-3 bg-light border shadow-2xs"
                                            >
                                                <div className="d-flex align-items-center gap-2 min-w-0">
                                                    <img
                                                        src={item.image || FALLBACK_IMAGE}
                                                        alt=""
                                                        style={{ width: 28, height: 28, objectFit: 'contain' }}
                                                    />
                                                    <div className="min-w-0">
                                                        <div className="fw-bold small text-dark text-truncate">{item.name}</div>
                                                        <span className="tiny-text text-muted">{item.category || item.type}</span>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-link text-muted hover-text-danger p-1"
                                                    onClick={() => handleRemoveItem(item.id)}
                                                    title="Remove item"
                                                >
                                                    <i className="fa-solid fa-xmark" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ════ RIGHT COLUMN: OPTIMAL FLIGHT ITINERARY ════ */}
                    <div className="col-12 col-lg-7">
                        <div className="card rounded-4 p-4 border shadow-sm bg-white mb-4">
                            {/* Itinerary Header */}
                            <div className="d-flex align-items-center justify-content-between mb-3 pb-3 border-bottom flex-wrap gap-2">
                                <div>
                                    <h2 className="h5 fw-black text-dark mb-0 ac-font d-flex align-items-center gap-2">
                                        <i className="fa-solid fa-route text-primary" />
                                        2. Optimized Flight Itinerary
                                    </h2>
                                    <span className="tiny-text text-muted">
                                        {itinerary.length > 0
                                            ? `Complete your list in ${itinerary.length} Island Stop${itinerary.length === 1 ? '' : 's'}`
                                            : 'Add items on the left to compute route'}
                                    </span>
                                </div>

                                {/* Access Filter */}
                                <div className="d-flex gap-1 bg-light p-1 rounded-pill border">
                                    <button
                                        type="button"
                                        className={`btn btn-xs rounded-pill fw-bold px-3 py-1 ${
                                            filterAccess === 'all' ? 'btn-dark text-white' : 'text-muted border-0 bg-transparent'
                                        }`}
                                        style={{ fontSize: '0.72rem' }}
                                        onClick={() => {
                                            playChimeClick();
                                            setFilterAccess('all');
                                        }}
                                    >
                                        All Islands
                                    </button>
                                    <button
                                        type="button"
                                        className={`btn btn-xs rounded-pill fw-bold px-3 py-1 ${
                                            filterAccess === 'unlocked' ? 'btn-dark text-white' : 'text-muted border-0 bg-transparent'
                                        }`}
                                        style={{ fontSize: '0.72rem' }}
                                        onClick={() => {
                                            playChimeClick();
                                            setFilterAccess('unlocked');
                                        }}
                                    >
                                        <i className="fa-solid fa-crown text-warning me-1" /> My Unlocked
                                    </button>
                                </div>
                            </div>

                            {/* Itinerary Stops List */}
                            {selectedItems.length === 0 ? (
                                <div className="text-center py-5 text-muted">
                                    <i className="fa-solid fa-plane-departure fs-2 mb-2 opacity-40 text-primary" />
                                    <h3 className="h6 fw-bold text-dark mb-1">Your Trip Itinerary is Empty</h3>
                                    <p className="tiny-text text-muted mb-0" style={{ maxWidth: 360, margin: '0 auto' }}>
                                        Add items or villagers on the left and the route engine will automatically group your stops with maps and Dodo codes.
                                    </p>
                                </div>
                            ) : itinerary.length === 0 ? (
                                <div className="text-center py-5 text-muted">
                                    <i className="fa-solid fa-triangle-exclamation fs-3 mb-2 text-warning" />
                                    <h3 className="h6 fw-bold text-dark mb-1">No Matching Islands for Current Filter</h3>
                                    <p className="tiny-text text-muted mb-0">
                                        Try switching to "All Islands" to see destinations across all member tiers.
                                    </p>
                                </div>
                            ) : (
                                <div className="d-flex flex-column gap-4">
                                    {itinerary.map((stop, index) => {
                                        const { island, itemsToCollect } = stop;
                                        const reveal = dodoReveals[island.id];
                                        const hasDirectDodo = Boolean(island.dodoCode || reveal?.code);
                                        const activeDodo = reveal?.code || island.dodoCode || '';

                                        return (
                                            <div key={island.id} className="card rounded-4 border-2 shadow-sm overflow-hidden bg-white">
                                                {/* Stop Header Banner */}
                                                <div className="bg-dark text-white p-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
                                                    <div className="d-flex align-items-center gap-3">
                                                        <div
                                                            className="rounded-circle bg-success text-white fw-black d-flex align-items-center justify-content-center"
                                                            style={{ width: 36, height: 36, fontSize: '1rem' }}
                                                        >
                                                            #{index + 1}
                                                        </div>
                                                        <div>
                                                            <div className="d-flex align-items-center gap-2 flex-wrap">
                                                                <h3 className="h6 fw-black text-white mb-0 ac-font">{island.name}</h3>
                                                                <span className="badge bg-light text-dark rounded-pill x-small fw-bold">
                                                                    {island.type || 'Treasure Island'}
                                                                </span>
                                                                {island.cat === 'member' && (
                                                                    <span className="badge bg-warning text-dark rounded-pill x-small fw-bold">
                                                                        <i className="fa-solid fa-crown me-1" /> Sub Member
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className="tiny-text text-white-50">
                                                                {itemsToCollect.length} Item{itemsToCollect.length === 1 ? '' : 's'} on this island
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Live Island Status Badge */}
                                                    <div className="d-flex align-items-center gap-2">
                                                        <span className="badge bg-dark bg-opacity-75 text-white border border-secondary rounded-pill x-small">
                                                            <i className="fa-solid fa-users me-1 text-success" />
                                                            {island.visitors ?? 0}/7 Visitors
                                                        </span>
                                                        <Link
                                                            to={`/island/${encodeURIComponent(island.id)}`}
                                                            className="btn btn-xs btn-outline-light rounded-pill px-3 py-1 fw-bold"
                                                        >
                                                            Island Page →
                                                        </Link>
                                                    </div>
                                                </div>

                                                {/* Map Thumbnail & Checklist Row */}
                                                <div className="p-3">
                                                    <div className="row g-3 align-items-center">
                                                        {/* Map Preview Thumbnail */}
                                                        <div className="col-12 col-md-4 text-center">
                                                            <div
                                                                className="rounded-3 border overflow-hidden position-relative shadow-2xs"
                                                                style={{ maxHeight: 150, backgroundColor: '#0f172a' }}
                                                            >
                                                                <img
                                                                    src={
                                                                        island.mapUrl ||
                                                                        `https://cdn.chopaeng.com/maps/${island.name.toLowerCase()}.png`
                                                                    }
                                                                    alt={island.name}
                                                                    className="w-100 h-100 object-fit-cover"
                                                                    onError={(e) => {
                                                                        (e.currentTarget as HTMLImageElement).src =
                                                                            "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='%230f172a'/><text x='50%' y='65%' font-size='30' text-anchor='middle' fill='%2352b788'>MAP</text></svg>";
                                                                    }}
                                                                />
                                                                <span className="badge bg-dark bg-opacity-75 text-white position-absolute bottom-0 start-0 m-1 x-small">
                                                                    <i className="fa-solid fa-map me-1" /> Landing Zone
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Checklist of Items on this Island */}
                                                        <div className="col-12 col-md-8">
                                                            <span className="tiny-text fw-bold text-muted text-uppercase tracking-wider d-block mb-2">
                                                                Items to Collect at Stop #{index + 1}:
                                                            </span>
                                                            <div className="d-flex flex-wrap gap-2">
                                                                {itemsToCollect.map((it) => {
                                                                    const isChecked = !!checkedItems[it.id];
                                                                    return (
                                                                        <button
                                                                            key={it.id}
                                                                            type="button"
                                                                            onClick={() => toggleItemChecked(it.id)}
                                                                            className={`btn btn-xs rounded-pill px-3 py-1 border d-inline-flex align-items-center gap-1 transition-all ${
                                                                                isChecked
                                                                                    ? 'bg-success text-white border-success'
                                                                                    : 'bg-light text-dark hover-bg-white shadow-2xs'
                                                                            }`}
                                                                        >
                                                                            <i
                                                                                className={`fa-solid ${
                                                                                    isChecked ? 'fa-circle-check' : 'fa-circle-dot text-muted'
                                                                                }`}
                                                                            />
                                                                            {it.image && (
                                                                                <img
                                                                                    src={it.image}
                                                                                    alt=""
                                                                                    style={{ width: 16, height: 16, objectFit: 'contain' }}
                                                                                />
                                                                            )}
                                                                            <span className={isChecked ? 'text-decoration-line-through' : 'fw-bold'}>
                                                                                {it.name}
                                                                            </span>
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Dodo Airport Dispatch Strip */}
                                                    <div className="bg-light rounded-3 p-3 border mt-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
                                                        <div className="d-flex align-items-center gap-2">
                                                            <i className="fa-solid fa-plane-departure text-success fs-5" />
                                                            <div>
                                                                <span className="tiny-text fw-bold text-muted text-uppercase d-block">
                                                                    Dodo Airlines Flight Code
                                                                </span>
                                                                {hasDirectDodo ? (
                                                                    <strong className="text-dark font-monospace h6 mb-0">
                                                                        {activeDodo}
                                                                    </strong>
                                                                ) : reveal?.error ? (
                                                                    <span className="text-danger tiny-text fw-bold">{reveal.error}</span>
                                                                ) : (
                                                                    <span className="text-muted tiny-text">Click reveal to fetch Dodo code</span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div className="d-flex align-items-center gap-2">
                                                            {hasDirectDodo ? (
                                                                <div
                                                                    className="badge bg-warning text-dark rounded-pill fw-black px-3 py-1.5 shadow-2xs d-inline-flex align-items-center gap-1.5 font-monospace"
                                                                    style={{ fontSize: '0.85rem' }}
                                                                >
                                                                    <i className="fa-solid fa-plane-departure" />
                                                                    <span>{activeDodo}</span>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-sm btn-dark rounded-pill fw-bold px-3 py-1 shadow-2xs d-inline-flex align-items-center gap-1"
                                                                    onClick={() => handleRevealDodo(island)}
                                                                    disabled={reveal?.loading}
                                                                >
                                                                    {reveal?.loading ? (
                                                                        <span className="spinner-border spinner-border-sm" />
                                                                    ) : (
                                                                        <>
                                                                            <i className="fa-solid fa-key" />
                                                                            <span>Get Dodo Code</span>
                                                                        </>
                                                                    )}
                                                                </button>
                                                            )}
                                                            <Link
                                                                to={`/order`}
                                                                className="btn btn-sm btn-outline-success rounded-pill fw-bold px-3 py-1 shadow-2xs"
                                                            >
                                                                <i className="fa-solid fa-box-open me-1" /> Order Bot
                                                            </Link>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TripPlanner;
