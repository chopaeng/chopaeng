import { useMemo, useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import type { CatalogEntity } from "../data/commandBuilderData";
import { getVariantCommandParts, getVariantKey, getVariantLabel } from "../utils/commandBuilderHex";
import { useCommandBuilderPockets, type PocketItem } from "../hooks/useCommandBuilderPockets";
import { useCatalogData } from "../hooks/useCatalogData";
import { ORDER_MAX, DROP_MAX } from "../constants/limits";
import { playChimeClick } from "../utils/kkAudioSynthesizer";
import {
    getSavedCommandBuilderState,
    saveCommandBuilderState,
    clearCommandBuilderPosition,
    clearCommandBuilderState
} from "../utils/commandBuilderState";
import CommandBuilderSummary from "../components/CommandBuilderSummary";
import DisclaimerBanner from "../components/DisclaimerBanner";
import { CommandBuilderFilters } from "../components/command-builder/CommandBuilderFilters";
import { CommandBuilderItemCard } from "../components/command-builder/CommandBuilderItemCard";
import { CommandBuilderVariantModal } from "../components/command-builder/CommandBuilderVariantModal";
import { CommandBuilderPocketBundlesModal } from "../components/command-builder/CommandBuilderPocketBundlesModal";
import { CommandBuilderBatchImportModal } from "../components/command-builder/CommandBuilderBatchImportModal";
import { CommandBuilderShareModal } from "../components/command-builder/CommandBuilderShareModal";
import { CommunityLoadoutsModal } from "../components/command-builder/CommunityLoadoutsModal";
import { MobileCommandBar } from "../components/command-builder/MobileCommandBar";
import type { MobileTab } from "../components/command-builder/MobileCommandBar";
import { HowItWorksExplainer, COMMAND_BUILDER_EXPLAINER_CONFIG } from "../components/HowItWorksExplainer";
import { decodePocketShareData, fetchSharedPocket } from "../utils/pocketSharing";
import { fetchLoadoutByCode } from "../utils/communityLoadoutsApi";
import { useFavorites } from "../hooks/useFavorites";
import { useTranslationSearch } from "../hooks/useTranslationSearch";

type ItemData = PocketItem;

type CatalogStringKey = Exclude<keyof CatalogEntity, 'variations'>;

const uniqueValues = (items: CatalogEntity[], key: CatalogStringKey) => [
    "All",
    ...Array.from(new Set(items.map((item) => String(item[key])))).sort(),
];

const FALLBACK_IMAGE = "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23f1f3f5'/%3E%3Cpath d='M30 65 L45 45 L58 58 L68 42 L75 65 Z' fill='%23ced4da'/%3E%3Ccircle cx='38' cy='35' r='7' fill='%23ced4da'/%3E%3C/svg%3E";


// Data is now loaded asynchronously inside the component

const CommandBuilder = () => {
    const navigate = useNavigate();
    const catalogHeadingRef = useRef<HTMLDivElement | null>(null);

    // Initial state restored from session if available
    const savedState = useMemo(() => getSavedCommandBuilderState(), []);

    // --- Filters ---
    const [category, setCategory] = useState(savedState?.category || "All");
    const [theme, setTheme] = useState(savedState?.theme || "All");
    const [series, setSeries] = useState(savedState?.series || "All");
    const [interactivity, setInteractivity] = useState(savedState?.interactivity || "All");
    const [colour, setColour] = useState(savedState?.colour || "All");
    const [kindFilter, setKindFilter] = useState(savedState?.kindFilter || "All");
    const [villagerType, setVillagerType] = useState(savedState?.villagerType || "All");

    // --- UI State ---
    const [hideVariants, setHideVariants] = useState(savedState?.hideVariants !== undefined ? savedState.hideVariants : true);
    const [compactMode, setCompactMode] = useState(savedState?.compactMode !== undefined ? savedState.compactMode : true);
    const [showFiltersMobile, setShowFiltersMobile] = useState(false);
    const [onlyFavorites, setOnlyFavorites] = useState(false);
    const { isFavorite, toggleFavorite, favoriteCount } = useFavorites();

    // --- Mobile Tab State ---
    const [mobileTab, setMobileTab] = useState<MobileTab>('catalog');

    // --- Search & Pagination ---
    const { searchLang, setSearchLang, getMatchingEnglishNames, isLoadingTranslations } = useTranslationSearch();
    const [searchInput, setSearchInput] = useState(savedState?.searchInput || "");
    const [debouncedSearch, setDebouncedSearch] = useState(savedState?.debouncedSearch || savedState?.searchInput || "");
    const [currentPage, setCurrentPage] = useState(savedState?.currentPage || 1);

    // --- Highlighting spot restoration ---
    const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);

    // --- Quick Variant Modal State ---
    const [variantModalItem, setVariantModalItem] = useState<ItemData | null>(null);

    // --- Feature Modals State ---
    const [isBundlesModalOpen, setIsBundlesModalOpen] = useState(false);
    const [isCommunityModalOpen, setIsCommunityModalOpen] = useState(false);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [isBatchImportModalOpen, setIsBatchImportModalOpen] = useState(false);
    const [sharedNotice, setSharedNotice] = useState<string | null>(null);

    // --- Data State ---
    const { data, isLoading: isLoadingData } = useCatalogData();
    const catalogEntities = useMemo(() => (data?.all || []).filter(item => !item.unorderable), [data?.all]);
    const explorerItems = useMemo(() => (data?.items || []).filter(item => !item.unorderable), [data?.items]);
    const villagerEntities = useMemo(() => (data?.villagers || []).filter(item => !item.unorderable), [data?.villagers]);

    const {
        orderItems,
        setOrderItems,
        dropItems,
        setDropItems,
        totalOrderCount,
        totalDropCount,
        canIncreaseOrder,
        canIncreaseDrop,
        decreaseOrderQuantity,
        increaseOrderQuantity,
        removeOrderItem,
        decreaseDropQuantity,
        increaseDropQuantity,
        removeDropItem,
        handleFillTickets,
        handleFillCrowns,
        handleFillBells,
        handleMaximizeStacks,
        handleFillRemaining,
        handleSortPockets,
        handleFlipOrderAndDrop,
        handleLoadRecipeMaterials,
        loadBundleIntoOrder,
        loadBundleIntoDrop,
        loadSharedPocket,
        addItemToOrderPockets,
        addItemToDropPockets,
        orderCommandText,
        dropCommandText,
        copyOrderStatus,
        copyDropStatus,
        handleCopyOrder,
        handleCopyDrop,
        getOrderPocketQuantity,
        getDropPocketQuantity,
    } = useCommandBuilderPockets();

    // 0. Load shared pocket or community loadout from URL if ?p=, ?pocket=, ?loadout=, or ?code= is present
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const shortParam = urlParams.get('p');
        const legacyPocketParam = urlParams.get('pocket');
        const loadoutCodeParam = urlParams.get('loadout') || urlParams.get('code');

        if (loadoutCodeParam) {
            fetchLoadoutByCode(loadoutCodeParam).then((loadout) => {
                if (loadout) {
                    loadBundleIntoOrder(loadout.orderItems, 'replace');
                    setSharedNotice(`Community loadout loaded: "${loadout.name}" (${loadout.shortCode})`);
                    setTimeout(() => setSharedNotice(null), 6000);
                }
            });
            const cleanUrl = window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
        } else if (shortParam) {
            fetchSharedPocket(shortParam).then((sharedData) => {
                if (sharedData) {
                    loadSharedPocket(sharedData);
                    const count = (sharedData.orderItems?.length || 0) + (sharedData.dropItems?.length || 0);
                    setSharedNotice(`Shared pocket loaded: "${sharedData.name || 'ACNH Pocket'}" (${count} items)`);
                    setTimeout(() => setSharedNotice(null), 6000);
                }
            });
            const cleanUrl = window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
        } else if (legacyPocketParam) {
            if (legacyPocketParam.length <= 15) {
                fetchSharedPocket(legacyPocketParam).then((sharedData) => {
                    if (sharedData) {
                        loadSharedPocket(sharedData);
                        const count = (sharedData.orderItems?.length || 0) + (sharedData.dropItems?.length || 0);
                        setSharedNotice(`Shared pocket loaded: "${sharedData.name || 'ACNH Pocket'}" (${count} items)`);
                        setTimeout(() => setSharedNotice(null), 6000);
                    }
                });
            } else {
                const decoded = decodePocketShareData(legacyPocketParam);
                if (decoded) {
                    loadSharedPocket(decoded);
                    const count = (decoded.orderItems?.length || 0) + (decoded.dropItems?.length || 0);
                    setSharedNotice(`Shared pocket loaded: "${decoded.name || 'Custom'}" (${count} items)`);
                    setTimeout(() => setSharedNotice(null), 5000);
                }
            }
            const cleanUrl = window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
        }
    }, [loadSharedPocket]);


    // 1. Debounce Search (Saves UI threads from exploding)
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(searchInput);
        }, 300);
        return () => clearTimeout(handler);
    }, [searchInput]);

    // 2. Track whether this is the initial mount to prevent resetting the restored currentPage
    const isInitialMountRef = useRef(true);

    // 3. Reset Pagination when ANY filter changes, skipping initial mount
    useEffect(() => {
        if (isInitialMountRef.current) {
            isInitialMountRef.current = false;
            return;
        }
        setCurrentPage(1);
    }, [category, theme, series, interactivity, colour, kindFilter, villagerType, debouncedSearch, hideVariants]);

    // 4. Sync view state to sessionStorage whenever filters / page change
    useEffect(() => {
        saveCommandBuilderState({
            category,
            theme,
            series,
            interactivity,
            colour,
            kindFilter,
            villagerType,
            hideVariants,
            compactMode,
            searchInput,
            debouncedSearch,
            currentPage,
        });
    }, [category, theme, series, interactivity, colour, kindFilter, villagerType, hideVariants, compactMode, searchInput, debouncedSearch, currentPage]);

    const expandedCatalogItems = useMemo(() => {
        return catalogEntities.flatMap((item) => {
            if (item.entityType !== 'item' || !item.variations || hideVariants || item.variations.length === 0) {
                return [{ ...item, image: item.image || FALLBACK_IMAGE } as ItemData];
            }

            return item.variations.map((variant) => {
                const variantKey = getVariantKey(variant);
                const commandParts = getVariantCommandParts(item.id, variant);
                return {
                    ...item,
                    id: `${item.id}:${variantKey}`,
                    baseId: commandParts.baseId,
                    variantId: commandParts.variantId,
                    variantLabel: getVariantLabel(variant),
                    image: variant.imageUrl || item.image || FALLBACK_IMAGE,
                };
            });
        });
    }, [hideVariants, catalogEntities]);

    const itemCategories = useMemo(() => uniqueValues(explorerItems.filter(i => i.entityType === 'item'), 'category'), [explorerItems]);
    const villagerTypes = useMemo(() => uniqueValues(villagerEntities, 'category'), [villagerEntities]);
    const uniqueThemes = useMemo(() => uniqueValues(catalogEntities, 'theme'), [catalogEntities]);
    const uniqueSeries = useMemo(() => uniqueValues(catalogEntities, 'series'), [catalogEntities]);
    const uniqueInteractivity = useMemo(() => uniqueValues(catalogEntities, 'interactivity'), [catalogEntities]);
    const uniqueColours = useMemo(() => uniqueValues(catalogEntities, 'colour'), [catalogEntities]);

    const filteredItems = useMemo(() => {
        const matchingEnNames = debouncedSearch.trim() ? getMatchingEnglishNames(debouncedSearch) : null;

        return expandedCatalogItems.filter((item) => {
            let matchesSearch = true;
            if (debouncedSearch.trim()) {
                if (matchingEnNames !== null) {
                    matchesSearch = matchingEnNames.has(item.name.toLowerCase());
                } else {
                    const lowerName = `${item.name}${item.variantLabel ? ` ${item.variantLabel}` : ''}`.toLowerCase();
                    matchesSearch = lowerName.includes(debouncedSearch.toLowerCase());
                }
            }
            const matchesCategory = category === "All" || item.category === category;
            const matchesTheme = theme === "All" || item.theme === theme;
            const matchesSeries = series === "All" || item.series === series;
            const matchesInteractivity = interactivity === "All" || item.interactivity === interactivity;
            const matchesColour = colour === "All" || item.colour === colour;
            const matchesKind = kindFilter === 'All' ||
                (kindFilter === 'Items' && item.entityType === 'item' && item.category !== 'Recipes') ||
                (kindFilter === 'Recipes' && item.entityType === 'item' && item.category === 'Recipes') ||
                (kindFilter === 'Villagers' && item.entityType === 'villager');
            const matchesVillagerType = villagerType === 'All' || item.entityType !== 'villager' || item.category === villagerType;
            const matchesFavorites = !onlyFavorites || isFavorite(item.id) || isFavorite(item.id.split(':')[0]);

            return matchesSearch && matchesCategory && matchesTheme && matchesSeries && matchesInteractivity && matchesColour && matchesKind && matchesVillagerType && matchesFavorites;
        });
    }, [expandedCatalogItems, category, theme, series, interactivity, colour, debouncedSearch, kindFilter, villagerType, onlyFavorites, isFavorite, getMatchingEnglishNames]);

    // 5. Restore scroll & card focus when catalog data is ready
    const hasRestoredSpotRef = useRef(false);

    useEffect(() => {
        if (isLoadingData || hasRestoredSpotRef.current || filteredItems.length === 0) return;

        const state = getSavedCommandBuilderState();
        if (state?.lastViewedItemId || (state?.scrollY !== undefined && state.scrollY > 0)) {
            hasRestoredSpotRef.current = true;
            const targetId = state.lastViewedItemId;
            const targetScrollY = state.scrollY;

            const timer = setTimeout(() => {
                let foundElement = false;
                if (targetId) {
                    const el = document.getElementById(`item-card-${targetId}`);
                    if (el) {
                        foundElement = true;
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        setHighlightedItemId(targetId);
                        setTimeout(() => setHighlightedItemId(null), 2500);
                    }
                }

                if (!foundElement && targetScrollY !== undefined && targetScrollY > 0) {
                    window.scrollTo({ top: targetScrollY, behavior: 'smooth' });
                }

                // Clear the one-time scroll target so subsequent filtering won't jump back
                clearCommandBuilderPosition();
            }, 150);

            return () => clearTimeout(timer);
        }
    }, [isLoadingData, filteredItems.length]);

    const itemsPerPage = compactMode ? 50 : 26;
    const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
    const pagedItems = filteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const openDetail = (item: ItemData, variantKey?: string) => {
        const baseId = item.id.split(":")[0];
        saveCommandBuilderState({
            category,
            theme,
            series,
            interactivity,
            colour,
            kindFilter,
            villagerType,
            hideVariants,
            compactMode,
            searchInput,
            debouncedSearch,
            currentPage,
            scrollY: window.scrollY,
            lastViewedItemId: baseId,
        });

        const [, itemVariantId] = item.id.split(":");
        const effectiveVariant = variantKey || (itemVariantId && itemVariantId !== 'NA' ? itemVariantId : '');
        const query = effectiveVariant ? `?variantId=${encodeURIComponent(effectiveVariant)}` : '';
        navigate(`/${item.entityType}/${baseId}${query}`);
    };

    const goToPage = (page: number) => {
        setCurrentPage(page);
        catalogHeadingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const clearFilters = () => {
        setCategory("All");
        setTheme("All");
        setSeries("All");
        setInteractivity("All");
        setColour("All");
        setSearchInput("");
        setDebouncedSearch("");
        setKindFilter("All");
        setVillagerType("All");
        setCompactMode(true);
        setHideVariants(true);
        setCurrentPage(1);
        clearCommandBuilderState();
    };

    const activeFilterChips = [
        kindFilter !== 'All' && { key: 'kind', label: `Type: ${kindFilter}`, clear: () => setKindFilter('All') },
        category !== 'All' && { key: 'category', label: `Category: ${category}`, clear: () => setCategory('All') },
        villagerType !== 'All' && { key: 'villagerType', label: `Villager: ${villagerType}`, clear: () => setVillagerType('All') },
        theme !== 'All' && { key: 'theme', label: `Theme: ${theme}`, clear: () => setTheme('All') },
        series !== 'All' && { key: 'series', label: `Series: ${series}`, clear: () => setSeries('All') },
        interactivity !== 'All' && { key: 'interactivity', label: `Interact: ${interactivity}`, clear: () => setInteractivity('All') },
        colour !== 'All' && { key: 'colour', label: `Colour: ${colour}`, clear: () => setColour('All') },
        searchInput.trim() && { key: 'search', label: `"${searchInput.trim()}"`, clear: () => { setSearchInput(''); setDebouncedSearch(''); } },
    ].filter(Boolean) as Array<{ key: string; label: string; clear: () => void }>;

    const activeFilterCount = activeFilterChips.length;

    return (
        <>
            <Helmet>
                <title>Chopaeng | Command Builder</title>
                <meta name="description" content="Browse items by category, theme, series, interactivity, colour, or name. Add up to 40 items to your pockets and build your ACNH command with a villager option." />
                <link rel="canonical" href="https://www.chopaeng.com/command-builder" />
            </Helmet>

            <div className="bg-pattern font-nunito min-vh-100 pb-5">
                <section className="container mt-n5 position-relative" style={{ zIndex: 10 }}>
                    <CommandBuilderFilters
                        searchInput={searchInput}
                        setSearchInput={setSearchInput}
                        searchLang={searchLang}
                        setSearchLang={setSearchLang}
                        isLoadingTranslations={isLoadingTranslations}
                        showFiltersMobile={showFiltersMobile}
                        setShowFiltersMobile={setShowFiltersMobile}
                        activeFilterCount={activeFilterCount}
                        activeFilterChips={activeFilterChips}
                        hideVariants={hideVariants}
                        setHideVariants={setHideVariants}
                        compactMode={compactMode}
                        setCompactMode={setCompactMode}
                        kindFilter={kindFilter}
                        setKindFilter={setKindFilter}
                        category={category}
                        setCategory={setCategory}
                        villagerType={villagerType}
                        setVillagerType={setVillagerType}
                        theme={theme}
                        setTheme={setTheme}
                        series={series}
                        setSeries={setSeries}
                        interactivity={interactivity}
                        setInteractivity={setInteractivity}
                        colour={colour}
                        setColour={setColour}
                        itemCategories={itemCategories}
                        villagerTypes={villagerTypes}
                        uniqueThemes={uniqueThemes}
                        uniqueSeries={uniqueSeries}
                        uniqueInteractivity={uniqueInteractivity}
                        uniqueColours={uniqueColours}
                        onlyFavorites={onlyFavorites}
                        setOnlyFavorites={setOnlyFavorites}
                        favoriteCount={favoriteCount}
                        clearFilters={clearFilters}
                    />
                </section>

                <section className="container py-4">
                    {/* ── REUSABLE HOW IT WORKS EXPLAINER ── */}
                    <HowItWorksExplainer {...COMMAND_BUILDER_EXPLAINER_CONFIG} className="mb-4" defaultExpanded={false} />

                    <div className="row gy-4">
                        {/* MOBILE: Catalog tab panel — hidden when on pockets/command tab on mobile */}
                        <div className={`col-lg-7 ${mobileTab === 'catalog' ? 'd-block' : 'd-none d-lg-block'
                            }`}>
                            {/* Order Pocket Header Bridge Banner */}
                            {totalOrderCount > 0 && (
                                <div className="card rounded-4 p-3 bg-white border border-success border-opacity-30 shadow-2xs mb-3 animate-fade">
                                    <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                                        <div className="d-flex align-items-center gap-2">
                                            <span
                                                className="rounded-circle d-flex align-items-center justify-content-center bg-success bg-opacity-10 text-success flex-shrink-0"
                                                style={{ width: 36, height: 36 }}
                                                aria-hidden="true"
                                            >
                                                <i className="fa-solid fa-bag-shopping"></i>
                                            </span>
                                            <div>
                                                <div className="d-flex align-items-center gap-2">
                                                    <strong className="text-dark small fw-bold">Order Pocket: {totalOrderCount}/{ORDER_MAX} Slots</strong>
                                                    <span className="badge bg-success bg-opacity-10 text-success rounded-pill x-small fw-bold">
                                                        {Math.min(100, Math.round((totalOrderCount / ORDER_MAX) * 100))}% Full
                                                    </span>
                                                </div>
                                                <span className="tiny-text text-muted">Items loaded and ready for bot delivery or flight.</span>
                                            </div>
                                        </div>

                                        <div className="d-flex align-items-center gap-2">
                                            <Link
                                                to="/pockets"
                                                className="btn btn-xs btn-outline-secondary rounded-pill fw-bold px-3 py-1 shadow-2xs"
                                                onClick={() => playChimeClick()}
                                            >
                                                <i className="fa-solid fa-grip me-1" aria-hidden="true"></i>Pockets
                                            </Link>
                                            <Link
                                                to="/order"
                                                className="btn btn-xs btn-nook text-white rounded-pill fw-bold px-3 py-1 shadow-2xs d-inline-flex align-items-center gap-1"
                                                onClick={() => playChimeClick()}
                                            >
                                                <i className="fa-solid fa-paper-plane" aria-hidden="true"></i>
                                                <span>Send to Order Bot →</span>
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="d-flex align-items-center justify-content-between mb-3" ref={catalogHeadingRef} style={{ scrollMarginTop: '90px' }}>
                                <div>
                                    <h2 className="h4 fw-black mb-1">Catalog</h2>
                                    <p className="mb-0 text-muted small">Select items or a villager to build your command.</p>
                                </div>
                                <span className="badge bg-white text-dark rounded-pill px-3 py-2 border shadow-sm" aria-live="polite">
                                    {filteredItems.length} results
                                </span>
                            </div>

                            <div className="row g-3">
                                {isLoadingData ? (
                                    <div className="col-12 py-5 text-center">
                                        <div className="spinner-border text-success mb-3" role="status"></div>
                                        <h3 className="h5 fw-bold text-muted">Loading Catalog...</h3>
                                        <p className="small text-muted">Fetching items and villagers...</p>
                                    </div>
                                ) : filteredItems.length === 0 ? (
                                    <div className="col-12">
                                        <div className="bg-white rounded-5 border p-5 text-center text-muted shadow-sm">
                                            <div className="icon-circle bg-light mx-auto mb-3 text-secondary">
                                                <i className="fa-solid fa-magnifying-glass fs-4"></i>
                                            </div>
                                            <h3 className="h5 fw-bold mb-2">No items match those filters.</h3>
                                            <p className="mb-3">Try a different category, theme, or search term.</p>
                                            {activeFilterCount > 0 && (
                                                <button type="button" className="btn btn-nook rounded-pill fw-bold px-4" onClick={clearFilters}>
                                                    <i className="fa-solid fa-rotate-left me-2"></i>Reset filters
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    pagedItems.map((item) => {
                                        const orderEntry = orderItems.find((s) => s.item.id === item.id);
                                        const dropEntry = dropItems.find((s) => s.item.id === item.id);
                                        const orderQty = orderEntry?.quantity ?? 0;
                                        const dropQty = dropEntry?.quantity ?? 0;

                                        return (
                                            <CommandBuilderItemCard
                                                key={item.id}
                                                item={item}
                                                orderQty={orderQty}
                                                dropQty={dropQty}
                                                compactMode={compactMode}
                                                hideVariants={hideVariants}
                                                canIncreaseOrder={canIncreaseOrder}
                                                canIncreaseDrop={canIncreaseDrop}
                                                totalOrderCount={totalOrderCount}
                                                totalDropCount={totalDropCount}
                                                isHighlighted={highlightedItemId === item.id || highlightedItemId === item.id.split(':')[0]}
                                                openDetail={openDetail}
                                                openVariantPicker={(targetItem) => setVariantModalItem(targetItem)}
                                                decreaseOrderQuantity={decreaseOrderQuantity}
                                                increaseOrderQuantity={increaseOrderQuantity}
                                                addItemToOrderPockets={addItemToOrderPockets}
                                                decreaseDropQuantity={decreaseDropQuantity}
                                                increaseDropQuantity={increaseDropQuantity}
                                                addItemToDropPockets={addItemToDropPockets}
                                                isFavorite={isFavorite(item.id) || isFavorite(item.id.split(':')[0])}
                                                onToggleFavorite={toggleFavorite}
                                                onLoadRecipeMaterials={handleLoadRecipeMaterials}
                                            />
                                        );
                                    })
                                )}
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <nav className="d-flex align-items-center justify-content-between mt-4 bg-white p-3 rounded-pill shadow-sm border" aria-label="Catalog pagination">
                                    <div className="text-muted small ms-3 fw-bold">Page {currentPage} of {totalPages}</div>
                                    <ul className="pagination pagination-sm mb-0 me-2">
                                        <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                                            <button
                                                className="page-link rounded-pill border-0"
                                                onClick={() => goToPage(Math.max(1, currentPage - 1))}
                                                aria-label="Previous page"
                                                aria-disabled={currentPage === 1}
                                                tabIndex={currentPage === 1 ? -1 : undefined}
                                            >
                                                Prev
                                            </button>
                                        </li>
                                        {Array.from({ length: totalPages }).map((_, idx) => {
                                            if (totalPages > 7 && Math.abs(currentPage - (idx + 1)) > 2 && idx !== 0 && idx !== totalPages - 1) {
                                                if (idx === 1 || idx === totalPages - 2) return <li key={idx} className="page-item disabled"><span className="page-link border-0 bg-transparent">...</span></li>;
                                                return null;
                                            }
                                            const isActive = currentPage === idx + 1;
                                            return (
                                                <li key={idx} className={`page-item ${isActive ? 'active' : ''}`}>
                                                    <button
                                                        className={`page-link rounded-circle border-0 mx-1 ${isActive ? 'bg-dark text-white shadow-sm' : 'text-dark'}`}
                                                        style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                        onClick={() => goToPage(idx + 1)}
                                                        aria-label={`Go to page ${idx + 1}`}
                                                        aria-current={isActive ? 'page' : undefined}
                                                    >
                                                        {idx + 1}
                                                    </button>
                                                </li>
                                            );
                                        })}
                                        <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                                            <button
                                                className="page-link rounded-pill border-0"
                                                onClick={() => goToPage(Math.min(totalPages, currentPage + 1))}
                                                aria-label="Next page"
                                                aria-disabled={currentPage === totalPages}
                                                tabIndex={currentPage === totalPages ? -1 : undefined}
                                            >
                                                Next
                                            </button>
                                        </li>
                                    </ul>
                                </nav>
                            )}
                        </div>

                        {/* MOBILE: Pockets tab panel (full-width summary) */}
                        <aside className={`col-lg-5 ${mobileTab === 'pockets' || mobileTab === 'command' ? 'd-block' : 'd-none d-lg-block'
                            }`}>
                            <div className="sticky-top" style={{ top: '90px' }}>
                                {/* Mobile Command Tab — Minimal copy-focused view */}
                                {mobileTab === 'command' && (
                                    <div className="d-lg-none mb-3">
                                        <div className="card rounded-4 border shadow-sm p-3 bg-white">
                                            <h6 className="fw-black text-dark mb-2 d-flex align-items-center gap-2">
                                                <i className="fa-solid fa-terminal text-success"></i>
                                                Generated Command
                                            </h6>

                                            {/* Order Command */}
                                            {orderCommandText ? (
                                                <div className="mb-3">
                                                    <div className="d-flex align-items-center justify-content-between mb-1">
                                                        <span className="tiny-text fw-bold text-uppercase text-muted">Order Bot ({totalOrderCount}/{ORDER_MAX})</span>
                                                    </div>
                                                    <code
                                                        className="d-block bg-dark text-success rounded-3 p-2 small font-monospace text-break mb-2"
                                                        style={{ fontSize: '0.72rem', maxHeight: '120px', overflowY: 'auto' }}
                                                    >
                                                        {orderCommandText}
                                                    </code>
                                                    <div className="d-flex flex-column gap-2">
                                                        <Link
                                                            to="/order"
                                                            className="btn btn-nook text-white rounded-pill fw-bold w-100 py-2 d-flex align-items-center justify-content-center gap-2 shadow-2xs"
                                                            onClick={() => playChimeClick()}
                                                        >
                                                            <i className="fa-solid fa-paper-plane" aria-hidden="true"></i>
                                                            <span>Send to Order Bot & Fly In →</span>
                                                        </Link>
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline-success rounded-pill fw-bold w-100 py-2"
                                                            onClick={handleCopyOrder}
                                                        >
                                                            <i className="fa-solid fa-copy me-2" aria-hidden="true"></i>
                                                            {copyOrderStatus === 'Copied!' ? 'Copied!' : 'Copy !order Command'}
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-center text-muted py-3 small">
                                                    <i className="fa-solid fa-box-open fs-4 opacity-30 mb-2 d-block" aria-hidden="true"></i>
                                                    Add items from the Browse tab to generate a command.
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-success rounded-pill mt-2 fw-bold d-block mx-auto"
                                                        onClick={() => setMobileTab('catalog')}
                                                    >
                                                        <i className="fa-solid fa-magnifying-glass me-1" aria-hidden="true"></i>Go to Browse
                                                    </button>
                                                </div>
                                            )}

                                            {/* Drop Command */}
                                            {dropCommandText && (
                                                <div className="mt-2">
                                                    <div className="d-flex align-items-center justify-content-between mb-1">
                                                        <span className="tiny-text fw-bold text-uppercase text-muted">Drop Bot ({totalDropCount}/{DROP_MAX})</span>
                                                    </div>
                                                    <code
                                                        className="d-block rounded-3 p-2 small font-monospace text-break mb-2"
                                                        style={{ fontSize: '0.72rem', backgroundColor: '#0c1a2e', color: '#38bdf8', maxHeight: '80px', overflowY: 'auto' }}
                                                    >
                                                        {dropCommandText}
                                                    </code>
                                                    <button
                                                        type="button"
                                                        className="btn rounded-pill fw-bold w-100 py-2 text-white"
                                                        style={{ backgroundColor: '#0284c7' }}
                                                        onClick={handleCopyDrop}
                                                    >
                                                        <i className="fa-solid fa-copy me-2" aria-hidden="true"></i>
                                                        {copyDropStatus === 'Copied!' ? 'Copied!' : 'Copy !drop Command'}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <CommandBuilderSummary
                                    orderPockets={orderItems}
                                    dropPockets={dropItems}
                                    orderCommandText={orderCommandText}
                                    dropCommandText={dropCommandText}
                                    copyOrderStatus={copyOrderStatus}
                                    copyDropStatus={copyDropStatus}
                                    onCopyOrder={handleCopyOrder}
                                    onCopyDrop={handleCopyDrop}
                                    onDecreaseOrderQuantity={decreaseOrderQuantity}
                                    onIncreaseOrderQuantity={increaseOrderQuantity}
                                    onRemoveOrderItem={removeOrderItem}
                                    onDecreaseDropQuantity={decreaseDropQuantity}
                                    onIncreaseDropQuantity={increaseDropQuantity}
                                    onRemoveDropItem={removeDropItem}
                                    onClearOrderPockets={() => setOrderItems([])}
                                    onClearDropPockets={() => setDropItems([])}
                                    canIncreaseOrder={canIncreaseOrder}
                                    canIncreaseDrop={canIncreaseDrop}
                                    onFillTickets={handleFillTickets}
                                    onFillCrowns={handleFillCrowns}
                                    onFillBells={handleFillBells}
                                    onMaximizeStacks={handleMaximizeStacks}
                                    onFillRemaining={handleFillRemaining}
                                    onSortPockets={handleSortPockets}
                                    onFlipOrderAndDrop={handleFlipOrderAndDrop}
                                    showTerminal={true}
                                    onOpenBundlesModal={() => setIsBundlesModalOpen(true)}
                                    onOpenCommunityLoadoutsModal={() => setIsCommunityModalOpen(true)}
                                    onOpenBatchImportModal={() => setIsBatchImportModalOpen(true)}
                                    onOpenShareModal={() => setIsShareModalOpen(true)}
                                />
                            </div>
                        </aside>
                    </div>

                </section>
                <div className="container">
                    {sharedNotice && (
                        <div className="alert alert-success rounded-4 shadow-sm p-3 mb-3 d-flex align-items-center justify-content-between animate-fade" role="status" aria-live="polite">
                            <div>
                                <i className="fa-solid fa-circle-check fs-5 text-success me-2 align-middle" aria-hidden="true"></i>
                                <strong className="text-dark small">{sharedNotice}</strong>
                            </div>
                            <button type="button" className="btn-close" aria-label="Close notification" onClick={() => setSharedNotice(null)} />
                        </div>
                    )}
                    <DisclaimerBanner className="mb-3" />
                </div>

                {/* Mobile floating pocket count pill — visible on Browse tab only */}
                {mobileTab === 'catalog' && (totalOrderCount > 0 || totalDropCount > 0) && (
                    <div
                        className="d-lg-none position-fixed"
                        style={{ bottom: '74px', right: '16px', zIndex: 1045 }}
                    >
                        <div className="d-flex gap-2 align-items-center">
                            <button
                                type="button"
                                className="btn btn-nook text-white rounded-pill shadow-lg fw-bold d-flex align-items-center gap-2 px-3 py-2"
                                style={{ fontSize: '0.82rem', border: '2px solid rgba(255,255,255,0.4)' }}
                                aria-label={`View pockets, ${totalOrderCount} of ${ORDER_MAX} slots filled`}
                                onClick={() => {
                                    playChimeClick();
                                    setMobileTab('pockets');
                                }}
                            >
                                <i className="fa-solid fa-bag-shopping" aria-hidden="true"></i>
                                <span>{totalOrderCount}/{ORDER_MAX} Pockets</span>
                            </button>
                            {totalOrderCount > 0 && (
                                <Link
                                    to="/order"
                                    className="btn btn-dark text-white rounded-pill shadow-lg fw-bold d-flex align-items-center gap-1 px-3 py-2"
                                    style={{ fontSize: '0.82rem', border: '2px solid rgba(74, 222, 128, 0.4)' }}
                                    aria-label="Proceed to Order Bot dispatch"
                                    onClick={() => playChimeClick()}
                                >
                                    <i className="fa-solid fa-paper-plane text-success" aria-hidden="true"></i>
                                    <span>Order →</span>
                                </Link>
                            )}
                        </div>
                    </div>
                )}

                {/* Mobile Bottom Tab Bar */}
                <MobileCommandBar
                    activeTab={mobileTab}
                    onTabChange={setMobileTab}
                    orderCount={totalOrderCount}
                    dropCount={totalDropCount}
                    hasCommand={!!orderCommandText || !!dropCommandText}
                />
            </div>

            {/* Quick Variant Selection Modal */}
            <CommandBuilderVariantModal
                item={variantModalItem}
                isOpen={Boolean(variantModalItem)}
                onClose={() => setVariantModalItem(null)}
                onOpenFullDetail={(targetItem, vKey) => {
                    setVariantModalItem(null);
                    openDetail(targetItem as ItemData, vKey);
                }}
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
                isFavorite={variantModalItem ? (isFavorite(variantModalItem.id) || isFavorite(variantModalItem.id.split(':')[0])) : false}
                onToggleFavorite={toggleFavorite}
            />

            {/* Pocket Bundles Modal */}
            <CommandBuilderPocketBundlesModal
                isOpen={isBundlesModalOpen}
                onClose={() => setIsBundlesModalOpen(false)}
                currentOrderPockets={orderItems}
                currentDropPockets={dropItems}
                onApplyBundleToOrder={(items, mode) => loadBundleIntoOrder(items, mode)}
                onApplyBundleToDrop={(items, mode) => loadBundleIntoDrop(items, mode)}
            />

            {/* Batch Hex & SysBot Command Importer Modal */}
            <CommandBuilderBatchImportModal
                isOpen={isBatchImportModalOpen}
                onClose={() => setIsBatchImportModalOpen(false)}
                catalogItems={catalogEntities}
                onImportOrder={(items, mode) => loadBundleIntoOrder(items, mode === 'append' ? 'merge' : 'replace')}
                onImportDrop={(items, mode) => loadBundleIntoDrop(items, mode === 'append' ? 'merge' : 'replace')}
                currentOrderCount={totalOrderCount}
                currentDropCount={totalDropCount}
            />

            {/* Share Pocket Modal */}
            <CommandBuilderShareModal
                isOpen={isShareModalOpen}
                onClose={() => setIsShareModalOpen(false)}
                orderPockets={orderItems}
                dropPockets={dropItems}
            />

            {/* Community Loadouts & Cloud Sync Modal */}
            <CommunityLoadoutsModal
                isOpen={isCommunityModalOpen}
                onClose={() => setIsCommunityModalOpen(false)}
                onLoadItems={(items, mode) => loadBundleIntoOrder(items, mode)}
                currentOrderPockets={orderItems}
                currentDropPockets={dropItems}
            />

        </>
    );
};

export default CommandBuilder;