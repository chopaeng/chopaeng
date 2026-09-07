import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { useMemo, useState, useEffect, useRef } from "react";
import { loadExplorerItems } from "../data/explorerDataLoader";
import { loadVillagers } from "../data/villagerDataLoader";
import type { CatalogEntity } from "../data/commandBuilderData";
import { getVariantCommandParts, getVariantKey, getVariantLabel } from "../utils/commandBuilderHex";
import { useCommandBuilderPockets } from "../hooks/useCommandBuilderPockets";
import { useFavorites } from "../hooks/useFavorites";
import { useCollection } from "../hooks/useCollection";
import { findBestGifts, PERSONALITY_COMPATIBILITY } from "../utils/giftMatcher";
import CommandBuilderSummary from "../components/CommandBuilderSummary";
import CatalogAvailability from "../components/CatalogAvailability";
import { FINDER_API_BASE } from "../config/api";

type NookipediaNhDetails = {
    catchphrase?: string;
    clothing?: string;
    clothing_variation?: string;
    fav_colors?: string[];
    fav_styles?: string[];
    hobby?: string;
    house_exterior_url?: string;
    house_flooring?: string;
    house_interior_url?: string;
    house_music?: string;
    house_music_note?: string;
    house_wallpaper?: string;
    icon_url?: string;
    image_url?: string;
    photo_url?: string;
    quote?: string;
    "sub-personality"?: string;
    umbrella?: string;
};

type NookipediaVillager = {
    alt_name?: string;
    appearances?: string[];
    birthday_day?: string;
    birthday_month?: string;
    clothing?: string;
    debut?: string;
    gender?: string;
    id: string;
    image_url?: string;
    islander?: boolean;
    name: string;
    nh_details?: NookipediaNhDetails;
    personality?: string;
    phrase?: string;
    prev_phrases?: string[];
    quote?: string;
    sign?: string;
    species?: string;
    text_color?: string;
    title_color?: string;
    url?: string;
};

const CatalogDetail = () => {
    const { entityType, id } = useParams<{ entityType?: string; id?: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const variantIdParam = searchParams.get('variantId') || '';

    const [items, setItems] = useState<CatalogEntity[]>([]);
    const [villagers, setVillagers] = useState<CatalogEntity[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(true);

    useEffect(() => {
        let mounted = true;
        const loadData = async () => {
            setIsLoadingData(true);
            try {
                const [loadedItems, loadedVillagers] = await Promise.all([
                    loadExplorerItems(),
                    loadVillagers()
                ]);
                if (mounted) {
                    setItems(loadedItems);
                    setVillagers(loadedVillagers);
                }
            } catch (err) {
                console.error("Failed to load catalog data", err);
            } finally {
                if (mounted) setIsLoadingData(false);
            }
        };
        loadData();
        return () => { mounted = false; };
    }, []);
    const type = entityType
        ? (entityType === 'villager' ? 'villager' : 'item')
        : (location.pathname.startsWith('/villager') ? 'villager' : 'item');

    const entry = useMemo<CatalogEntity | null>(() => {
        if (!id) return null;
        const lowerId = id.toLowerCase();
        const primaryList = type === 'villager' ? villagers : items;
        const fallbackList = type === 'villager' ? items : villagers;
        const matcher = (entity: CatalogEntity) =>
            entity.id.toLowerCase() === lowerId ||
            entity.name.toLowerCase() === lowerId ||
            entity.name.toLowerCase().replace(/[^a-z0-9]/g, '') === lowerId;

        return primaryList.find(matcher) || fallbackList.find(matcher) || null;
    }, [id, type, items, villagers]);

    const [detailStatus, setDetailStatus] = useState('');
    const [selectedVariantKey, setSelectedVariantKey] = useState<string | null>(null);
    const [linkCopied, setLinkCopied] = useState(false);
    const [villagerData, setVillagerData] = useState<NookipediaVillager | null>(null);
    const [loadingVillager, setLoadingVillager] = useState(false);
    const [activeHouseTab, setActiveHouseTab] = useState<'interior' | 'exterior' | 'photo'>('interior');
    const detailStatusRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!entry || entry.entityType !== 'villager') {
            setVillagerData(null);
            setLoadingVillager(false);
            return;
        }

        let isMounted = true;
        setLoadingVillager(true);

        const fetchVillagerInfo = async () => {
            try {
                const response = await fetch(`${FINDER_API_BASE}/api/v1/villager/${encodeURIComponent(entry.name)}`);
                if (!response.ok) throw new Error("Failed to fetch villager details");
                const data = await response.json();
                if (isMounted) {
                    if (data.success && data.villager) {
                        setVillagerData(data.villager);
                    } else if (data.name) {
                        setVillagerData(data);
                    }
                }
            } catch (error) {
                console.error("Villager API Error:", error);
            } finally {
                if (isMounted) setLoadingVillager(false);
            }
        };

        fetchVillagerInfo();

        return () => {
            isMounted = false;
        };
    }, [entry]);

    const {
        orderItems,
        setOrderItems,
        dropItems,
        setDropItems,
        totalOrderCount,
        totalDropCount,
        canIncreaseOrder,
        canIncreaseDrop,
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
        decreaseOrderQuantity,
        increaseOrderQuantity,
        removeOrderItem,
        decreaseDropQuantity,
        increaseDropQuantity,
        removeDropItem,
    } = useCommandBuilderPockets();



    const { isFavorite, toggleFavorite } = useFavorites();
    const isItemFavorited = entry ? (isFavorite(entry.id) || isFavorite(entry.id.split(':')[0])) : false;

    const { isCollected, toggleCollected } = useCollection();
    const isItemCollected = entry ? isCollected(entry.id) : false;

    const bestGifts = useMemo(() => {
        if (!entry || entry.entityType !== 'villager') return [];
        const vStyles = entry.styles || villagerData?.nh_details?.fav_styles || [];
        const vColors = entry.favoriteColors || villagerData?.nh_details?.fav_colors || [];
        return findBestGifts(items, vStyles, vColors, 8);
    }, [entry, items, villagerData]);

    const compatibility = useMemo(() => {
        if (!entry) return null;
        const pers = entry.personality || villagerData?.personality || entry.category || '';
        return PERSONALITY_COMPATIBILITY[pers] || null;
    }, [entry, villagerData]);

    // K.K. Jukebox: find villagers whose favorite song matches this item
    const songFans = useMemo(() => {
        if (!entry || entry.entityType !== 'item') return [];
        const songName = entry.name?.toLowerCase();
        if (!songName) return [];
        return villagers.filter(v =>
            v.favoriteSong?.toLowerCase() === songName
        ).slice(0, 20);
    }, [entry, villagers]);

    useEffect(() => {
        if (entry?.entityType !== 'item') {
            setSelectedVariantKey(null);
            return;
        }

        const validKeys = entry.variations?.map((variant) => getVariantKey(variant)) || [];
        if (variantIdParam && validKeys.includes(variantIdParam)) {
            setSelectedVariantKey(variantIdParam);
            return;
        }

        setSelectedVariantKey(validKeys[0] || null);
    }, [entry, variantIdParam]);

    // Scroll to top whenever a different catalog entry is opened
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [id]);

    // Keep the browser tab title in sync with the entry being viewed
    useEffect(() => {
        if (entry) {
            document.title = `${entry.name} · Command Builder`;
        }
        return () => {
            document.title = 'Command Builder';
        };
    }, [entry]);

    if (isLoadingData) {
        return (
            <div className="min-vh-100 d-flex align-items-center justify-content-center bg-pattern font-nunito py-5">
                <div className="text-center">
                    <div className="spinner-border text-success mb-3" role="status"></div>
                    <h3 className="h5 fw-bold text-muted">Loading Entry...</h3>
                </div>
            </div>
        );
    }

    if (!entry) {
        return (
            <div className="min-vh-100 d-flex align-items-center justify-content-center bg-pattern font-nunito py-5">
                <div className="bg-white rounded-5 shadow-sm border p-5 text-center" style={{ maxWidth: '560px' }}>
                    <h1 className="h3 fw-black mb-3">Entry not found</h1>
                    <p className="text-muted mb-4">This item or villager could not be found. Return to the command builder and try again.</p>
                    <Link to="/command-builder" className="btn btn-nook-primary rounded-pill px-4 py-3 fw-black">Back to Command Builder</Link>
                </div>
            </div>
        );
    }

    const selectedVariant = entry.entityType === 'item'
        ? entry.variations?.find((variant) => getVariantKey(variant) === selectedVariantKey) || null
        : null;

    const variantLabel = getVariantLabel(selectedVariant);
    const detailImage = selectedVariant?.imageUrl || entry.image;
    const detailTitle = entry.entityType === 'item' && variantLabel ? `${entry.name} (${variantLabel})` : entry.name;
    const selectedVariantCommandParts = entry.entityType === 'item'
        ? getVariantCommandParts(entry.id, selectedVariant)
        : null;
    const selectedVariantPocketKey = selectedVariant ? getVariantKey(selectedVariant) : 'NA';

    const pocketItemId = entry.entityType === 'item'
        ? (selectedVariant ? `${entry.id}:${selectedVariantPocketKey}` : entry.id)
        : entry.id;
    const inOrderQty = getOrderPocketQuantity(pocketItemId);
    const inDropQty = getDropPocketQuantity(pocketItemId);

    const handleVariantSelect = (variantKey: string) => {
        setSelectedVariantKey(variantKey);
        const basePath = `/${entry.entityType}/${entry.id}`;
        const query = variantKey && variantKey !== 'NA' ? `?variantId=${encodeURIComponent(variantKey)}` : '';
        navigate(`${basePath}${query}`, { replace: true });
    };

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 2000);
        } catch {
            setLinkCopied(false);
        }
    };

    const addToOrder = () => {
        const itemToSave = {
            ...entry,
            id: pocketItemId,
            baseId: selectedVariantCommandParts?.baseId || entry.id,
            variantId: selectedVariantCommandParts?.variantId || 'NA',
            variantLabel,
            image: detailImage,
        };
        const result = addItemToOrderPockets(itemToSave as any);
        setDetailStatus(result.message);
        setTimeout(() => {
            detailStatusRef.current?.focus();
        }, 50);
        setTimeout(() => setDetailStatus(''), 2800);
    };

    const addToDrop = () => {
        const itemToSave = {
            ...entry,
            id: pocketItemId,
            baseId: selectedVariantCommandParts?.baseId || entry.id,
            variantId: selectedVariantCommandParts?.variantId || 'NA',
            variantLabel,
            image: detailImage,
        };
        const result = addItemToDropPockets(itemToSave as any);
        setDetailStatus(result.message);
        setTimeout(() => {
            detailStatusRef.current?.focus();
        }, 50);
        setTimeout(() => setDetailStatus(''), 2800);
    };

    const handleBackToCatalog = () => {
        if (window.history.length > 1) {
            navigate(-1);
        } else {
            navigate(entry.entityType === 'villager' ? '/catalog?tab=villagers' : '/catalog');
        }
    };

    return (
        <div className="bg-pattern font-nunito min-vh-100 pb-5">
            <section className="container py-5">
                <div className="d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between gap-3 mb-4 mb-md-5">
                    <nav aria-label="breadcrumb" className="w-100 w-md-auto">
                        <ol className="breadcrumb mb-0 small fw-bold align-items-center">
                            <li className="breadcrumb-item">
                                <button
                                    type="button"
                                    onClick={handleBackToCatalog}
                                    className="btn btn-link text-decoration-none text-nook transition-all p-0 fw-bold d-inline-flex align-items-center"
                                    title="Return to catalogue"
                                >
                                    <i className="fa-solid fa-arrow-left me-2"></i>Catalogue
                                </button>
                            </li>
                            <li className="breadcrumb-item text-muted" aria-current="page">
                                {entry.entityType === 'item' ? entry.category : 'Villagers'}
                            </li>
                            <li className="breadcrumb-item active text-truncate text-dark" style={{ maxWidth: '220px' }} aria-current="page">
                                {entry.name}
                            </li>
                        </ol>
                    </nav>
                    <div className="d-flex align-items-center flex-wrap gap-2 w-100 w-md-auto justify-content-start justify-content-md-end">
                        <button
                            type="button"
                            onClick={(e) => toggleFavorite(entry.id, e)}
                            className={`btn btn-sm rounded-pill fw-bold px-3 shadow-sm transition-all d-inline-flex align-items-center gap-1.5 ${isItemFavorited
                                ? 'btn-danger text-white'
                                : 'btn-white bg-white text-muted border'
                                }`}
                            title={isItemFavorited ? 'Remove from Wishlist' : 'Add to Wishlist'}
                            aria-label={isItemFavorited ? `Remove ${entry.name} from wishlist` : `Add ${entry.name} to wishlist`}
                        >
                            <i className={`fa-${isItemFavorited ? 'solid' : 'regular'} fa-heart ${isItemFavorited ? 'text-white' : 'text-danger'}`} />
                            <span>{isItemFavorited ? 'Wishlisted' : 'Add to Wishlist'}</span>
                        </button>
                        <button
                            type="button"
                            onClick={(e) => toggleCollected(entry.id, e)}
                            className={`btn btn-sm rounded-pill fw-bold px-3 shadow-sm transition-all d-inline-flex align-items-center gap-1.5 ${isItemCollected
                                ? 'btn-success text-white'
                                : 'btn-white bg-white text-muted border'
                                }`}
                            title={isItemCollected ? 'Remove from Collection' : 'Mark as Collected'}
                            aria-label={isItemCollected ? `Remove ${entry.name} from collection` : `Mark ${entry.name} as collected`}
                        >
                            <i className={`fa-solid ${isItemCollected ? 'fa-check' : 'fa-plus'}`} />
                            <span>{isItemCollected ? 'Collected' : 'Collect'}</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleBackToCatalog}
                            className="btn btn-sm btn-outline-success bg-white rounded-pill fw-bold px-3 shadow-sm transition-all d-inline-flex align-items-center gap-1.5"
                            title="Return to catalog (saves your spot)"
                        >
                            <i className="fa-solid fa-arrow-left"></i>
                            <span className="d-none d-sm-inline">Back to Catalog</span>
                            <span className="d-inline d-sm-none">Catalog</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleCopyLink}
                            className="btn btn-sm btn-white border rounded-pill fw-bold px-3 shadow-sm transition-all d-inline-flex align-items-center gap-1.5 flex-shrink-0"
                            title="Copy link to share"
                        >
                            <i className={`fa-solid ${linkCopied ? 'fa-check text-success' : 'fa-link'}`}></i>
                            <span>{linkCopied ? 'Copied!' : 'Copy link'}</span>
                        </button>
                    </div>
                </div>

                <div className="row gy-4">
                    <div className="col-lg-7">
                        <div className="bg-cream rounded-4 border-0 shadow-sm overflow-hidden mb-4" style={{ borderTop: '4px solid var(--nook-green)' }}>
                            <div className="row g-0 align-items-stretch">
                                <div className="col-12 col-md-5 col-lg-4 bg-light p-4 position-relative d-flex align-items-center justify-content-center border-end">
                                    <div className="ratio ratio-1x1 w-100" style={{ maxWidth: '280px' }}>
                                        <img
                                            src={entry.entityType === 'villager' ? (villagerData?.nh_details?.image_url || villagerData?.image_url || entry.image) : detailImage}
                                            alt={detailTitle}
                                            className="w-100 h-100 object-fit-contain"
                                            style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.08))' }}
                                        />
                                    </div>
                                    {entry.entityType === 'villager' && villagerData?.nh_details?.icon_url && (
                                        <div className="position-absolute bottom-0 end-0 p-3">
                                            <div className="bg-white rounded-circle p-2 shadow-sm border" style={{ width: '56px', height: '56px' }}>
                                                <img src={villagerData.nh_details.icon_url} alt={`${entry.name} Icon`} className="w-100 h-100 object-fit-contain" />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="col-12 col-md-7 col-lg-8 p-4 p-sm-5 d-flex flex-column justify-content-center bg-white">
                                    <div className="mb-4">
                                        <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
                                            <span className="badge bg-nook-green text-white rounded-pill px-3 py-2 fw-black x-small shadow-sm">
                                                <i className={`fa-solid ${entry.entityType === 'villager' ? 'fa-user' : 'fa-box'} me-1`}></i>
                                                {entry.entityType === 'item' ? 'Item Details' : 'Villager Details'}
                                            </span>
                                            {entry.entityType === 'villager' && loadingVillager && (
                                                <span className="badge bg-light text-muted border rounded-pill px-3 py-2 fw-bold x-small">
                                                    <i className="fa-solid fa-spinner fa-spin me-1 text-nook"></i> Loading details...
                                                </span>
                                            )}
                                        </div>

                                        <h1 className="ac-font fw-black mb-2 text-nook" style={{ fontSize: '2.2rem', letterSpacing: '0.5px' }}>{detailTitle}</h1>

                                        {entry.entityType === 'item' ? (
                                            <p className="text-muted mb-0" style={{ fontSize: '0.95rem', lineHeight: '1.6' }}>
                                                {(entry.description && entry.description !== 'NA') ? entry.description : 'Choose a variation and add this item to your pockets.'}
                                            </p>
                                        ) : (
                                            <p className="text-muted small mb-0" style={{ fontSize: '0.95rem' }}>
                                                Explore {entry.name}'s personality, profile, and house details.
                                            </p>
                                        )}
                                    </div>

                                    {entry.entityType === 'villager' && (villagerData?.quote || villagerData?.nh_details?.quote) && (
                                        <div className="p-3 rounded-4 bg-cream border-2 border-success border-opacity-25 shadow-sm mb-4">
                                            <div className="d-flex align-items-center gap-2 mb-1">
                                                <i className="fa-solid fa-quote-left text-nook opacity-75"></i>
                                                <span className="x-small fw-black text-nook tracking-wide text-uppercase" style={{ fontSize: '0.65rem' }}>Quote</span>
                                            </div>
                                            <p className="fst-italic fw-bold text-dark mb-0 ms-4" style={{ fontFamily: 'var(--font-accent)', fontSize: '0.9rem' }}>
                                                "{villagerData?.quote || villagerData?.nh_details?.quote}"
                                            </p>
                                        </div>
                                    )}
                                    {(inOrderQty > 0 || inDropQty > 0) && (
                                        <div className="alert rounded-4 py-3 px-4 mb-4 small border-2" style={{ background: '#f0fdf4', borderColor: '#88e0a0', color: '#1e7e34' }} role="status">
                                            <i className="fa-solid fa-basket-shopping me-2 fw-black"></i>
                                            {inOrderQty > 0 && <span>Order: <strong>{entry.entityType === 'villager' ? entry.name : `${inOrderQty} × ${entry.name}`}</strong>{inDropQty > 0 ? '  ·  ' : ''}</span>}
                                            {inDropQty > 0 && <span>Drop: <strong>{entry.entityType === 'villager' ? entry.name : `${inDropQty} × ${entry.name}`}</strong></span>}
                                        </div>
                                    )}

                                    {entry.unorderable ? (
                                        <div className="p-3 rounded-4 bg-light border text-center text-muted mb-2 shadow-2xs">
                                            <i className="fa-solid fa-circle-info me-2 text-info"></i>
                                            <span className="small fw-bold">This {entry.entityType === 'villager' ? 'character' : 'item'} is for reference and cannot be ordered into pockets.</span>
                                        </div>
                                    ) : (
                                        <div className="d-flex flex-column flex-sm-row gap-2 mb-2">
                                            {/* Add to Order */}
                                            <button
                                                type="button"
                                                onClick={addToOrder}
                                                className="btn rounded-pill px-4 py-2 fw-black flex-grow-1 transition-all"
                                                disabled={totalOrderCount >= 40}
                                                style={{
                                                    backgroundColor: totalOrderCount >= 40 ? '#f8f9fa' : 'var(--nook-green, #37b06d)',
                                                    color: totalOrderCount >= 40 ? '#adb5bd' : '#ffffff',
                                                    border: 'none',
                                                    boxShadow: totalOrderCount >= 40 ? 'none' : '0 3px 10px rgba(55,176,109,0.3)',
                                                    cursor: totalOrderCount >= 40 ? 'not-allowed' : 'pointer',
                                                    fontSize: '0.95rem'
                                                }}
                                                onMouseEnter={(e) => { if (totalOrderCount < 40) { e.currentTarget.style.transform = 'translateY(-2px)'; } }}
                                                onMouseLeave={(e) => { if (totalOrderCount < 40) { e.currentTarget.style.transform = 'translateY(0)'; } }}
                                            >
                                                <i className="fa-solid fa-basket-shopping me-2"></i>
                                                {totalOrderCount >= 40 ? 'Order Full (40/40)' : `Add to Order${inOrderQty > 0 && entry.entityType !== 'villager' ? ` (${inOrderQty})` : ''}`}
                                            </button>
                                            {/* Add to Drop */}
                                            <button
                                                type="button"
                                                onClick={addToDrop}
                                                className="btn rounded-pill px-4 py-2 fw-black flex-grow-1 transition-all"
                                                disabled={totalDropCount >= 9}
                                                style={{
                                                    backgroundColor: totalDropCount >= 9 ? '#f8f9fa' : '#0ea5e9',
                                                    color: totalDropCount >= 9 ? '#adb5bd' : '#ffffff',
                                                    border: 'none',
                                                    boxShadow: totalDropCount >= 9 ? 'none' : '0 3px 10px rgba(14,165,233,0.3)',
                                                    cursor: totalDropCount >= 9 ? 'not-allowed' : 'pointer',
                                                    fontSize: '0.95rem'
                                                }}
                                                onMouseEnter={(e) => { if (totalDropCount < 9) { e.currentTarget.style.transform = 'translateY(-2px)'; } }}
                                                onMouseLeave={(e) => { if (totalDropCount < 9) { e.currentTarget.style.transform = 'translateY(0)'; } }}
                                            >
                                                <i className="fa-solid fa-box-open me-2"></i>
                                                {totalDropCount >= 9 ? 'Drop Full (9/9)' : `Add to Drop${inDropQty > 0 && entry.entityType !== 'villager' ? ` (${inDropQty})` : ''}`}
                                            </button>
                                        </div>
                                    )}

                                    <div className="text-center mt-2">
                                        <button
                                            type="button"
                                            onClick={handleBackToCatalog}
                                            className="btn btn-link text-muted p-0 x-small fw-bold text-decoration-none"
                                            title="Return to your saved spot in the catalog"
                                        >
                                            <i className="fa-solid fa-arrow-left me-1 text-nook"></i> Return to Catalog (Spot Saved)
                                        </button>
                                    </div>

                                    {detailStatus && (
                                        <div ref={detailStatusRef} tabIndex={-1} aria-live="polite" className="alert rounded-4 py-3 px-4 mt-4 mb-0 small border-2" style={{ background: '#f0fdf4', borderColor: '#88e0a0', color: '#1e7e34' }} role="alert">
                                            <i className="fa-solid fa-circle-check me-2 fw-black"></i>{detailStatus}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="p-0">
                            {entry.entityType === 'item' ? (
                                <>

                                    {entry.variations && entry.variations.length > 0 && (
                                        <div className="mb-3 p-4 rounded-4 bg-light-green border-2" style={{ borderColor: '#88e0a0' }}>
                                            <label className="fw-black small text-nook mb-3 d-block" style={{ fontSize: '0.95rem' }}>
                                                <i className="fa-solid fa-palette me-2"></i>Choose a variation
                                            </label>
                                            <div className="d-flex flex-wrap gap-3">
                                                {(entry.variations || []).map((variant) => {
                                                    const variantKey = getVariantKey(variant);
                                                    const variantText = getVariantLabel(variant) || 'Default';
                                                    const isSelected = variantKey === selectedVariantKey;
                                                    const thumbUrl = variant.imageUrl || entry.image;

                                                    if (thumbUrl) {
                                                        return (
                                                            <button
                                                                key={variantKey}
                                                                type="button"
                                                                onClick={() => handleVariantSelect(variantKey)}
                                                                className={`variant-thumb-btn btn p-2 rounded-3 d-flex flex-column align-items-center gap-1 ${isSelected ? 'variant-thumb-btn--selected' : 'btn-outline-secondary'}`}
                                                                title={variantText}
                                                                aria-pressed={isSelected}
                                                                aria-label={`Select variation ${variantText}`}
                                                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleVariantSelect(variantKey); } }}
                                                            >
                                                                <div className="ratio ratio-1x1" style={{ width: '48px' }}>
                                                                    <img src={thumbUrl} alt={variantText} className="w-100 h-100 object-fit-contain rounded-3" />
                                                                </div>
                                                                <span className="x-small fw-bold text-truncate" style={{ maxWidth: '72px' }}>{variantText}</span>
                                                            </button>
                                                        );
                                                    }

                                                    return (
                                                        <button
                                                            key={variantKey}
                                                            type="button"
                                                            onClick={() => handleVariantSelect(variantKey)}
                                                            className={`btn btn-sm rounded-pill px-3 fw-bold transition-all ${isSelected ? 'bg-nook-green text-white border-0' : 'btn-outline-secondary text-dark border-2'}`}
                                                            aria-pressed={isSelected}
                                                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleVariantSelect(variantKey); } }}
                                                            style={isSelected ? { boxShadow: '0 3px 8px rgba(40, 167, 69, 0.3)' } : {}}
                                                        >
                                                            {variantText}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    <div className="bg-white rounded-4 p-4 mb-3 border shadow-sm">
                                        <h3 className="h6 fw-black text-nook mb-3 text-uppercase tracking-wide" style={{ fontSize: '0.8rem' }}>
                                            <i className="fa-solid fa-list-ul me-2 opacity-75"></i>Item Properties & Details
                                        </h3>
                                        <div className="row g-3">
                                            <div className="col-6 col-md-3">
                                                <span className="x-small fw-bold text-muted d-flex align-items-center gap-1 mb-1" style={{ fontSize: '0.65rem', letterSpacing: '0.5px' }}>
                                                    <i className="fa-solid fa-tag opacity-50"></i>Category
                                                </span>
                                                <div className="fw-black text-nook text-truncate" style={{ fontSize: '0.95rem' }} title={entry.category}>{entry.category || 'None'}</div>
                                            </div>
                                            <div className="col-6 col-md-3">
                                                <span className="x-small fw-bold text-muted d-flex align-items-center gap-1 mb-1" style={{ fontSize: '0.65rem', letterSpacing: '0.5px' }}>
                                                    <i className="fa-solid fa-palette opacity-50"></i>Theme
                                                </span>
                                                <div className="fw-black text-nook text-truncate" style={{ fontSize: '0.95rem' }} title={entry.theme}>{entry.theme || 'None'}</div>
                                            </div>
                                            <div className="col-6 col-md-3">
                                                <span className="x-small fw-bold text-muted d-flex align-items-center gap-1 mb-1" style={{ fontSize: '0.65rem', letterSpacing: '0.5px' }}>
                                                    <i className="fa-solid fa-layer-group opacity-50"></i>Series
                                                </span>
                                                <div className="fw-black text-nook text-truncate" style={{ fontSize: '0.95rem' }} title={entry.series}>{entry.series || 'None'}</div>
                                            </div>
                                            <div className="col-6 col-md-3">
                                                <span className="x-small fw-bold text-muted d-flex align-items-center gap-1 mb-1" style={{ fontSize: '0.65rem', letterSpacing: '0.5px' }}>
                                                    <i className="fa-solid fa-swatchbook opacity-50"></i>Colour
                                                </span>
                                                <div className="fw-black text-nook text-truncate" style={{ fontSize: '0.95rem' }} title={entry.colour}>{entry.colour || 'None'}</div>
                                            </div>

                                            {/* Buy & Sell Pricing */}
                                            {(entry.buy != null || entry.sell != null) && (
                                                <>
                                                    {entry.buy != null && entry.buy > 0 && (
                                                        <div className="col-6 col-md-3">
                                                            <span className="x-small fw-bold text-muted d-flex align-items-center gap-1 mb-1" style={{ fontSize: '0.65rem', letterSpacing: '0.5px' }}>
                                                                <i className="fa-solid fa-coins text-warning opacity-75"></i>Buy Price
                                                            </span>
                                                            <div className="fw-black text-dark" style={{ fontSize: '0.95rem' }}>{entry.buy.toLocaleString()} Bells</div>
                                                        </div>
                                                    )}
                                                    {entry.sell != null && entry.sell > 0 && (
                                                        <div className="col-6 col-md-3">
                                                            <span className="x-small fw-bold text-muted d-flex align-items-center gap-1 mb-1" style={{ fontSize: '0.65rem', letterSpacing: '0.5px' }}>
                                                                <i className="fa-solid fa-sack-dollar text-success opacity-75"></i>Sell Price
                                                            </span>
                                                            <div className="fw-black text-dark" style={{ fontSize: '0.95rem' }}>{entry.sell.toLocaleString()} Bells</div>
                                                        </div>
                                                    )}
                                                </>
                                            )}

                                            {/* Size, Surface & Tag */}
                                            {entry.size && (
                                                <div className="col-6 col-md-3">
                                                    <span className="x-small fw-bold text-muted d-flex align-items-center gap-1 mb-1" style={{ fontSize: '0.65rem', letterSpacing: '0.5px' }}>
                                                        <i className="fa-solid fa-ruler-combined opacity-50"></i>Size
                                                    </span>
                                                    <div className="fw-black text-dark" style={{ fontSize: '0.95rem' }}>{entry.size}{entry.surface ? ' (Surface)' : ''}</div>
                                                </div>
                                            )}

                                            {/* Source / How to Obtain */}
                                            {entry.source && entry.source.length > 0 && (
                                                <div className="col-12 col-md-6">
                                                    <span className="x-small fw-bold text-muted d-flex align-items-center gap-1 mb-1" style={{ fontSize: '0.65rem', letterSpacing: '0.5px' }}>
                                                        <i className="fa-solid fa-map-location-dot opacity-50"></i>Source / How to Obtain
                                                    </span>
                                                    <div className="fw-black text-nook text-truncate" style={{ fontSize: '0.95rem' }}>{entry.source.join(', ')}</div>
                                                </div>
                                            )}

                                            {/* Creature details: Shadow, Movement, Catchphrase */}
                                            {entry.shadow && (
                                                <div className="col-6 col-md-3">
                                                    <span className="x-small fw-bold text-muted d-flex align-items-center gap-1 mb-1" style={{ fontSize: '0.65rem', letterSpacing: '0.5px' }}>
                                                        <i className="fa-solid fa-fish opacity-50"></i>Shadow Size
                                                    </span>
                                                    <div className="fw-black text-dark" style={{ fontSize: '0.95rem' }}>{entry.shadow}</div>
                                                </div>
                                            )}
                                            {entry.movementSpeed && (
                                                <div className="col-6 col-md-3">
                                                    <span className="x-small fw-bold text-muted d-flex align-items-center gap-1 mb-1" style={{ fontSize: '0.65rem', letterSpacing: '0.5px' }}>
                                                        <i className="fa-solid fa-gauge-high opacity-50"></i>Movement Speed
                                                    </span>
                                                    <div className="fw-black text-dark" style={{ fontSize: '0.95rem' }}>{entry.movementSpeed}</div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Crafting Recipe Materials Breakdown */}
                                    {entry.materials && Object.keys(entry.materials).length > 0 && (
                                        <div className="bg-white rounded-4 p-4 mb-3 border shadow-sm">
                                            <div className="d-flex align-items-center justify-content-between mb-3">
                                                <h3 className="h6 fw-black text-nook mb-0 text-uppercase tracking-wide" style={{ fontSize: '0.8rem' }}>
                                                    <i className="fa-solid fa-hammer me-2 opacity-75"></i>Required Crafting Materials
                                                </h3>
                                                <span className="badge rounded-pill bg-nook-green text-white px-3 py-1 fw-bold">
                                                    {Object.keys(entry.materials).length} Ingredients
                                                </span>
                                            </div>
                                            <div className="d-flex flex-wrap gap-2">
                                                {Object.entries(entry.materials).map(([mat, qty]) => (
                                                    <div key={mat} className="d-flex align-items-center gap-2 bg-light px-3 py-2 rounded-pill border">
                                                        <span className="badge rounded-circle bg-success text-white fw-black" style={{ width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>
                                                            {qty}
                                                        </span>
                                                        <span className="fw-bold small text-dark">{mat}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* K.K. Jukebox: Villagers who love this song */}
                                    {songFans.length > 0 && (
                                        <div className="bg-white rounded-4 p-4 mb-4 border shadow-sm">
                                            <span className="fw-black small text-nook text-uppercase tracking-wide d-block mb-3">
                                                <i className="fa-solid fa-music me-2"></i>Villagers Who Love This Song ({songFans.length})
                                            </span>
                                            <p className="x-small text-muted mb-3">
                                                These villagers have this track as their favorite K.K. song and will play it in their home.
                                            </p>
                                            <div className="d-flex flex-wrap gap-2">
                                                {songFans.map(v => (
                                                    <Link key={v.id} to={`/villager/${v.id}`} className="text-decoration-none">
                                                        <div className="d-flex align-items-center gap-2 bg-light rounded-pill border px-3 py-2 hover-shadow-sm transition-all">
                                                            <img
                                                                src={v.image || ''}
                                                                alt={v.name}
                                                                style={{ width: 28, height: 28, objectFit: 'contain' }}
                                                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                                                            />
                                                            <span className="fw-bold small text-dark">{v.name}</span>
                                                            {v.personality && (
                                                                <span className="badge bg-primary-subtle text-primary rounded-pill" style={{ fontSize: '0.6rem' }}>{v.personality}</span>
                                                            )}
                                                        </div>
                                                    </Link>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <>
                                    {/* Structured Villager Info */}
                                    <div className="bg-white rounded-4 p-4 mb-4 border shadow-sm">
                                        <div className="row g-4">
                                            {/* Column 1: Core Info & Personality */}
                                            <div className="col-12 col-md-6">
                                                <h3 className="h6 fw-black text-nook mb-3 text-uppercase tracking-wide" style={{ fontSize: '0.8rem' }}><i className="fa-solid fa-address-card me-2 opacity-75"></i>Profile & Gifting</h3>
                                                <ul className="list-unstyled mb-0 d-flex flex-column gap-2 small">
                                                    <li className="d-flex justify-content-between border-bottom pb-2">
                                                        <span className="text-muted fw-semibold">Species</span>
                                                        <span className="fw-black text-dark">{entry.species || villagerData?.species || entry.theme || 'Unknown'}</span>
                                                    </li>
                                                    <li className="d-flex justify-content-between border-bottom pb-2">
                                                        <span className="text-muted fw-semibold">Personality</span>
                                                        <span className="fw-black text-dark">
                                                            {entry.personality || villagerData?.personality || entry.category}
                                                            {entry.subtype ? ` (Subtype ${entry.subtype})` : villagerData?.nh_details?.['sub-personality'] ? ` (Sub ${villagerData.nh_details['sub-personality']})` : ''}
                                                        </span>
                                                    </li>
                                                    <li className="d-flex justify-content-between border-bottom pb-2">
                                                        <span className="text-muted fw-semibold">Gender</span>
                                                        <span className="fw-black text-dark">{entry.gender || villagerData?.gender || entry.interactivity || 'Unknown'}</span>
                                                    </li>
                                                    <li className="d-flex justify-content-between border-bottom pb-2">
                                                        <span className="text-muted fw-semibold">Catchphrase</span>
                                                        <span className="fw-black text-nook">"{villagerData?.phrase || villagerData?.nh_details?.catchphrase || 'hello'}"</span>
                                                    </li>
                                                    {(entry.birthday || villagerData?.birthday_month) && (
                                                        <li className="d-flex justify-content-between border-bottom pb-2">
                                                            <span className="text-muted fw-semibold">Birthday</span>
                                                            <span className="fw-black text-dark">{entry.birthday || `${villagerData?.birthday_month} ${villagerData?.birthday_day}`}</span>
                                                        </li>
                                                    )}
                                                    {(entry.styles && entry.styles.length > 0) && (
                                                        <li className="d-flex justify-content-between border-bottom pb-2">
                                                            <span className="text-muted fw-semibold">Favorite Styles</span>
                                                            <span className="fw-black text-success">{entry.styles.join(', ')}</span>
                                                        </li>
                                                    )}
                                                    {(entry.favoriteColors && entry.favoriteColors.length > 0) && (
                                                        <li className="d-flex justify-content-between pb-1">
                                                            <span className="text-muted fw-semibold">Favorite Colors</span>
                                                            <span className="fw-black text-primary">{entry.favoriteColors.join(', ')}</span>
                                                        </li>
                                                    )}
                                                </ul>
                                            </div>

                                            {/* Column 2: House & Details */}
                                            <div className="col-12 col-md-6">
                                                <h3 className="h6 fw-black text-nook mb-3 text-uppercase tracking-wide" style={{ fontSize: '0.8rem' }}><i className="fa-solid fa-house me-2 opacity-75"></i>Details & House</h3>
                                                <ul className="list-unstyled mb-0 d-flex flex-column gap-2 small">
                                                    {(entry.hobby || villagerData?.nh_details?.hobby) && (
                                                        <li className="d-flex justify-content-between border-bottom pb-2">
                                                            <span className="text-muted fw-semibold">Hobby</span>
                                                            <span className="fw-black text-dark">{entry.hobby || villagerData?.nh_details?.hobby}</span>
                                                        </li>
                                                    )}
                                                    {(entry.favoriteSong || villagerData?.nh_details?.house_music) && (
                                                        <li className="d-flex justify-content-between border-bottom pb-2">
                                                            <span className="text-muted fw-semibold">Favorite Song</span>
                                                            <span className="fw-black text-dark">
                                                                <i className="fa-solid fa-music me-1 text-primary"></i>
                                                                {entry.favoriteSong || villagerData?.nh_details?.house_music}
                                                            </span>
                                                        </li>
                                                    )}
                                                    {(entry.flooring || villagerData?.nh_details?.house_flooring) && (
                                                        <li className="d-flex justify-content-between border-bottom pb-2">
                                                            <span className="text-muted fw-semibold">Flooring</span>
                                                            <span className="fw-black text-dark">{entry.flooring || villagerData?.nh_details?.house_flooring}</span>
                                                        </li>
                                                    )}
                                                    {(entry.wallpaper || villagerData?.nh_details?.house_wallpaper) && (
                                                        <li className="d-flex justify-content-between border-bottom pb-2">
                                                            <span className="text-muted fw-semibold">Wallpaper</span>
                                                            <span className="fw-black text-dark">{entry.wallpaper || villagerData?.nh_details?.house_wallpaper}</span>
                                                        </li>
                                                    )}
                                                    {entry.defaultClothing && (
                                                        <li className="d-flex justify-content-between pb-1">
                                                            <span className="text-muted fw-semibold">Default Clothing</span>
                                                            <span className="fw-black text-dark">{entry.defaultClothing}</span>
                                                        </li>
                                                    )}
                                                </ul>
                                            </div>
                                        </div>

                                        {/* House Furniture Checklist */}
                                        {entry.furnitureNameList && entry.furnitureNameList.length > 0 && (
                                            <div className="mt-4 pt-3 border-top">
                                                <span className="x-small fw-black text-nook text-uppercase tracking-wide d-block mb-2">
                                                    <i className="fa-solid fa-couch me-2"></i>House Interior Furniture ({entry.furnitureNameList.length})
                                                </span>
                                                <div className="d-flex flex-wrap gap-1">
                                                    {entry.furnitureNameList.map((fName, idx) => (
                                                        <span key={`${fName}-${idx}`} className="badge rounded-pill bg-light text-dark border px-3 py-1 fw-bold" style={{ fontSize: '0.75rem' }}>
                                                            {fName}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Best Gift Recommendations */}
                                    {bestGifts.length > 0 && (
                                        <div className="mb-4 p-4 rounded-4 bg-white border shadow-sm">
                                            <span className="fw-black small text-nook text-uppercase tracking-wide d-block mb-3">
                                                <i className="fa-solid fa-gift me-2"></i>Best Gift Recommendations
                                            </span>
                                            <p className="x-small text-muted mb-3">Items matching {entry.name}'s preferred styles and colors, ranked by compatibility score.</p>
                                            <div className="row g-2">
                                                {bestGifts.map((gs, idx) => (
                                                    <div key={gs.item.id + idx} className="col-6 col-md-3">
                                                        <Link to={`/item/${gs.item.id}`} className="text-decoration-none">
                                                            <div className="bg-light rounded-3 border p-2 text-center h-100 hover-shadow-sm transition-all">
                                                                <img
                                                                    src={gs.item.image || ''}
                                                                    alt={gs.item.name}
                                                                    className="mb-1"
                                                                    style={{ width: 40, height: 40, objectFit: 'contain' }}
                                                                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                                                                />
                                                                <div className="tiny-text fw-bold text-dark text-truncate" title={gs.item.name}>{gs.item.name}</div>
                                                                <div className="d-flex justify-content-center gap-1 mt-1 flex-wrap">
                                                                    {gs.matchedStyles.map(s => (
                                                                        <span key={s} className="badge bg-primary-subtle text-primary rounded-pill" style={{ fontSize: '0.6rem' }}>{s}</span>
                                                                    ))}
                                                                    {gs.matchedColors.map(c => (
                                                                        <span key={c} className="badge bg-warning-subtle text-warning rounded-pill" style={{ fontSize: '0.6rem' }}>{c}</span>
                                                                    ))}
                                                                </div>
                                                                <span className="tiny-text text-success fw-bold">Score: {gs.score}</span>
                                                            </div>
                                                        </Link>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Personality Compatibility */}
                                    {compatibility && (
                                        <div className="mb-4 p-4 rounded-4 bg-white border shadow-sm">
                                            <span className="fw-black small text-nook text-uppercase tracking-wide d-block mb-3">
                                                <i className="fa-solid fa-people-arrows me-2"></i>Personality Compatibility
                                            </span>
                                            <div className="row g-3">
                                                <div className="col-6">
                                                    <span className="x-small fw-bold text-success d-block mb-2">
                                                        <i className="fa-solid fa-heart me-1"></i>Gets Along With
                                                    </span>
                                                    <div className="d-flex flex-wrap gap-1">
                                                        {compatibility.friends.map(f => (
                                                            <span key={f} className="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-2 py-1 fw-bold" style={{ fontSize: '0.7rem' }}>{f}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                                {compatibility.conflicts.length > 0 && (
                                                    <div className="col-6">
                                                        <span className="x-small fw-bold text-danger d-block mb-2">
                                                            <i className="fa-solid fa-bolt me-1"></i>May Clash With
                                                        </span>
                                                        <div className="d-flex flex-wrap gap-1">
                                                            {compatibility.conflicts.map(c => (
                                                                <span key={c} className="badge bg-danger-subtle text-danger border border-danger-subtle rounded-pill px-2 py-1 fw-bold" style={{ fontSize: '0.7rem' }}>{c}</span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Sleep Schedule Tool */}
                                    {(() => {
                                        const personality = entry.personality || villagerData?.personality || '';
                                        if (!personality) return null;

                                        // Sleep schedule by personality (ACNH community-documented)
                                        // Hours > 24 = next-day AM (e.g. 27 = 3:00 AM next day)
                                        const SLEEP_SCHEDULE: Record<string, { wake: number; sleep: number; label: string; emoji: string }> = {
                                            'Lazy':       { wake: 8,  sleep: 23, label: 'Lazy',       emoji: '😴' },
                                            'Jock':       { wake: 6,  sleep: 24, label: 'Jock',       emoji: '💪' },
                                            'Cranky':     { wake: 9,  sleep: 27, label: 'Cranky',     emoji: '😤' },
                                            'Smug':       { wake: 8,  sleep: 26, label: 'Smug',       emoji: '😏' },
                                            'Normal':     { wake: 6,  sleep: 24, label: 'Normal',     emoji: '😊' },
                                            'Peppy':      { wake: 7,  sleep: 25, label: 'Peppy',      emoji: '✨' },
                                            'Snooty':     { wake: 9,  sleep: 26, label: 'Snooty',     emoji: '💅' },
                                            'Big Sister': { wake: 11, sleep: 27, label: 'Big Sister', emoji: '🤜' },
                                            'Uchi':       { wake: 11, sleep: 27, label: 'Big Sister', emoji: '🤜' },
                                        };

                                        const schedule = SLEEP_SCHEDULE[personality];
                                        if (!schedule) return null;

                                        const now = new Date();
                                        const currentHour = now.getHours();
                                        const currentMin = now.getMinutes();
                                        const currentDecimal = currentHour + currentMin / 60; // e.g. 14.5 = 2:30 PM

                                        // Normalize current time relative to 24h+ scale
                                        // If current time is early AM (0-8) and sleep > 24, treat as 24+
                                        const normalizedHour = currentDecimal < schedule.wake && schedule.sleep > 24
                                            ? currentDecimal + 24
                                            : currentDecimal;

                                        const isAwake = normalizedHour >= schedule.wake && normalizedHour < schedule.sleep;

                                        const fmtHour = (h: number) => {
                                            const real = h % 24;
                                            const ampm = real < 12 ? 'AM' : 'PM';
                                            const display = real === 0 ? 12 : real > 12 ? real - 12 : real;
                                            return `${display}:00 ${ampm}`;
                                        };

                                        // For the visual bar: map 0..24h window, clamped
                                        const barStart = schedule.wake;
                                        const barEnd = Math.min(schedule.sleep, 24);
                                        const wakePercent = (barStart / 24) * 100;
                                        const sleepPercent = (barEnd / 24) * 100;
                                        const nowPercent = Math.min((currentDecimal / 24) * 100, 100);

                                        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                                        return (
                                            <div className="mb-4 p-4 rounded-4 bg-white border shadow-sm">
                                                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
                                                    <span className="fw-black small text-nook text-uppercase tracking-wide">
                                                        <i className="fa-solid fa-moon me-2 opacity-75"></i>Sleep Schedule
                                                    </span>
                                                    <span className={`badge rounded-pill px-3 py-2 fw-bold d-flex align-items-center gap-1 ${isAwake ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-secondary-subtle text-secondary border border-secondary-subtle'}`} style={{ fontSize: '0.75rem' }}>
                                                        <span style={{ fontSize: '0.6rem' }}>{isAwake ? '🟢' : '💤'}</span>
                                                        {isAwake ? `Awake now` : `Asleep now`}
                                                        <span className="opacity-75 fw-normal">· {timeStr}</span>
                                                    </span>
                                                </div>

                                                {!isAwake && (
                                                    <div className="alert alert-warning border-0 rounded-3 py-2 px-3 mb-3 small fw-semibold d-flex align-items-center gap-2" role="alert">
                                                        <i className="fa-solid fa-triangle-exclamation text-warning"></i>
                                                        <span>{entry.name} may be asleep on the island right now. Visit during their awake hours to find them in-game.</span>
                                                    </div>
                                                )}

                                                {/* 24h Timeline Bar */}
                                                <div className="mb-3">
                                                    <div className="position-relative rounded-pill overflow-hidden" style={{ height: '10px', background: '#e9ecef' }}>
                                                        {/* Awake band */}
                                                        <div
                                                            className="position-absolute h-100 rounded-pill"
                                                            style={{
                                                                left: `${wakePercent}%`,
                                                                width: `${sleepPercent - wakePercent}%`,
                                                                background: 'linear-gradient(90deg, #52c41a, #73d13d)',
                                                            }}
                                                        />
                                                        {/* Current time marker */}
                                                        <div
                                                            className="position-absolute"
                                                            style={{
                                                                left: `calc(${nowPercent}% - 5px)`,
                                                                top: '-3px',
                                                                width: '10px',
                                                                height: '16px',
                                                                background: isAwake ? '#1890ff' : '#adb5bd',
                                                                borderRadius: '3px',
                                                                border: '2px solid white',
                                                                boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                                                                zIndex: 2,
                                                            }}
                                                        />
                                                    </div>
                                                    {/* Hour labels */}
                                                    <div className="d-flex justify-content-between mt-1" style={{ fontSize: '0.6rem', color: '#adb5bd', fontWeight: 700 }}>
                                                        <span>12 AM</span>
                                                        <span>6 AM</span>
                                                        <span>12 PM</span>
                                                        <span>6 PM</span>
                                                        <span>12 AM</span>
                                                    </div>
                                                </div>

                                                <div className="d-flex flex-wrap gap-3 small">
                                                    <div className="d-flex align-items-center gap-2">
                                                        <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-2 py-1 fw-bold" style={{ fontSize: '0.7rem' }}>
                                                            <i className="fa-solid fa-sun me-1"></i>Wakes
                                                        </span>
                                                        <span className="fw-black text-dark">{fmtHour(schedule.wake)}</span>
                                                    </div>
                                                    <div className="d-flex align-items-center gap-2">
                                                        <span className="badge bg-secondary-subtle text-secondary border border-secondary-subtle rounded-pill px-2 py-1 fw-bold" style={{ fontSize: '0.7rem' }}>
                                                            <i className="fa-solid fa-moon me-1"></i>Sleeps
                                                        </span>
                                                        <span className="fw-black text-dark">{fmtHour(schedule.sleep)}</span>
                                                    </div>
                                                    <div className="d-flex align-items-center gap-2">
                                                        <span className="badge bg-light text-muted border rounded-pill px-2 py-1 fw-bold" style={{ fontSize: '0.7rem' }}>
                                                            {schedule.emoji} {schedule.label}
                                                        </span>
                                                    </div>
                                                </div>
                                                <p className="x-small text-muted mb-0 mt-2" style={{ fontSize: '0.7rem' }}>
                                                    Based on your local time. ACNH game time is synced to real-world time unless the island host has time-traveled.
                                                </p>
                                            </div>
                                        );
                                    })()}

                                    {/* Image Previews Tabs (Interior / Exterior / Photo) */}
                                    {(entry.houseImage || entry.photoImage || villagerData?.nh_details?.house_interior_url || villagerData?.nh_details?.house_exterior_url || villagerData?.nh_details?.photo_url) && (
                                        <div className="mb-4 p-4 rounded-4 bg-white border shadow-sm">
                                            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
                                                <span className="fw-black small text-nook text-uppercase tracking-wide">
                                                    <i className="fa-solid fa-images me-2"></i>Image Previews & Photos
                                                </span>
                                                <div className="btn-group btn-group-sm rounded-pill p-1 bg-light border" role="group" aria-label="House image previews">
                                                    {(entry.houseImage || villagerData?.nh_details?.house_exterior_url) && (
                                                        <button
                                                            type="button"
                                                            className={`btn rounded-pill px-3 fw-bold ${activeHouseTab === 'exterior' ? 'bg-nook-green text-white border-0 shadow-sm' : 'btn-light text-muted border-0'}`}
                                                            onClick={() => setActiveHouseTab('exterior')}
                                                        >
                                                            House Exterior
                                                        </button>
                                                    )}
                                                    {villagerData?.nh_details?.house_interior_url && (
                                                        <button
                                                            type="button"
                                                            className={`btn rounded-pill px-3 fw-bold ${activeHouseTab === 'interior' ? 'bg-nook-green text-white border-0 shadow-sm' : 'btn-light text-muted border-0'}`}
                                                            onClick={() => setActiveHouseTab('interior')}
                                                        >
                                                            Interior
                                                        </button>
                                                    )}
                                                    {(entry.photoImage || villagerData?.nh_details?.photo_url) && (
                                                        <button
                                                            type="button"
                                                            className={`btn rounded-pill px-3 fw-bold ${activeHouseTab === 'photo' ? 'bg-nook-green text-white border-0 shadow-sm' : 'btn-light text-muted border-0'}`}
                                                            onClick={() => setActiveHouseTab('photo')}
                                                        >
                                                            Framed Photo
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="ratio ratio-16x9 bg-light rounded-4 overflow-hidden border">
                                                <img
                                                    src={
                                                        activeHouseTab === 'interior'
                                                            ? (villagerData?.nh_details?.house_interior_url || entry.image)
                                                            : activeHouseTab === 'exterior'
                                                                ? (entry.houseImage || villagerData?.nh_details?.house_exterior_url || entry.image)
                                                                : (entry.photoImage || villagerData?.nh_details?.photo_url || entry.image)
                                                    }
                                                    alt={`${entry.name} ${activeHouseTab}`}
                                                    className="w-100 h-100 object-fit-contain p-2"
                                                    style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.06))' }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                        </div>

                        <div className="mt-4">
                            <CatalogAvailability
                                mode={entry.entityType === 'villager' ? 'villager' : 'item'}
                                query={entry.name}
                            />
                        </div>
                    </div>

                    <aside className="col-lg-5">
                        <div className="sticky-top" style={{ top: '90px' }}>
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
                                showTerminal={true}
                            />
                        </div>
                    </aside>
                </div>
            </section>
        </div>
    );
};

export default CatalogDetail;