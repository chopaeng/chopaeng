import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useCommandBuilderPockets } from '../hooks/useCommandBuilderPockets';
import { useCatalogData } from '../hooks/useCatalogData';
import { VisualPocketGrid } from '../components/command-builder/VisualPocketGrid';
import { parseItemCodes } from '../utils/itemCodeParser';
import { playChimeClick } from '../utils/kkAudioSynthesizer';
import { CommunityLoadoutsModal } from '../components/command-builder/CommunityLoadoutsModal';
import { CommandBuilderShareModal } from '../components/command-builder/CommandBuilderShareModal';
import { QuickAddItemModal } from '../components/command-builder/QuickAddItemModal';
import { SmartFillDropdown } from '../components/command-builder/SmartFillDropdown';
import {
    getLocalPresets,
    saveLocalPreset,
    deleteLocalPreset,
    syncUserPresetsFromBackend,
    type LocalPreset,
} from '../utils/localPresetVault';
import { fetchPocketBundles } from '../utils/pocketBundleApi';
import type { PocketBundle, PocketBundleItem } from '../data/pocketBundles';
import { getAuthToken } from '../context/authToken';
import { useAuth } from '../context/useAuth';
import { RequireAuthView } from '../components/RequireAuthView';

export const PocketInventory: React.FC = () => {
    const { user, loading: authLoading } = useAuth();
    const {
        orderItems,
        setOrderItems,
        dropItems,
        setDropItems,
        addItemToOrderPockets,
        addItemToDropPockets,
        decreaseOrderQuantity,
        increaseOrderQuantity,
        removeOrderItem,
        decreaseDropQuantity,
        increaseDropQuantity,
        removeDropItem,
        canIncreaseOrder,
        canIncreaseDrop,
        totalOrderCount,
        totalDropCount,
        handleFillTickets,
        handleFillCrowns,
        handleFillBells,
        handleMaximizeStacks,
        handleSortPockets,
        handleFillRemaining,
        handleFlipOrderAndDrop,
        loadBundleIntoOrder,
        loadBundleIntoDrop,
        orderCommandText,
        dropCommandText,
        copyOrderStatus,
        copyDropStatus,
        handleCopyOrder,
        handleCopyDrop,
        reorderOrderPockets,
        reorderDropPockets,
        orderVillager,
        totalOrderItemsCount,
        isSyncingDb,
    } = useCommandBuilderPockets();

    const { data: catalogData } = useCatalogData();
    const token = getAuthToken();

    // Modals
    const [quickAddModalOpen, setQuickAddModalOpen] = useState(false);
    const [quickAddTarget, setQuickAddTarget] = useState<'order' | 'drop'>('order');
    const [bundlesModalOpen, setBundlesModalOpen] = useState(false);
    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [batchPasteModalOpen, setBatchPasteModalOpen] = useState(false);
    const [batchPasteText, setBatchPasteText] = useState('');
    const [copiedFlowType, setCopiedFlowType] = useState<'order' | 'drop' | null>(null);

    // Right Sidebar Selector State
    const [rightPanelTab, setRightPanelTab] = useState<'my-pockets' | 'community' | 'terminal'>('my-pockets');
    const [localPresets, setLocalPresets] = useState<LocalPreset[]>(getLocalPresets);
    const [communityBundles, setCommunityBundles] = useState<PocketBundle[]>([]);
    const [newPresetTitle, setNewPresetTitle] = useState('');
    const [newPresetDesc, setNewPresetDesc] = useState('');
    const [savingPreset, setSavingPreset] = useState(false);
    const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
    const [presetSearch, setPresetSearch] = useState('');

    // Load & sync presets on mount
    const refreshPresets = useCallback(async () => {
        const synced = await syncUserPresetsFromBackend(token);
        setLocalPresets(synced);
    }, [token]);

    useEffect(() => {
        refreshPresets();
        fetchPocketBundles(token)
            .then((res) => {
                if (Array.isArray(res)) setCommunityBundles(res);
            })
            .catch(() => {});
    }, [refreshPresets, token]);

    // Close modal on Escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && batchPasteModalOpen) {
                setBatchPasteModalOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [batchPasteModalOpen]);

    // Live parse batch input
    const parsedBatch = useMemo(() => {
        return parseItemCodes(batchPasteText, catalogData?.all || []);
    }, [batchPasteText, catalogData]);

    const handleCopyOrderWithFlow = useCallback(() => {
        handleCopyOrder();
        setCopiedFlowType('order');
        playChimeClick();
    }, [handleCopyOrder]);

    const handleCopyDropWithFlow = useCallback(() => {
        handleCopyDrop();
        setCopiedFlowType('drop');
        playChimeClick();
    }, [handleCopyDrop]);

    const handleApplyBatchPaste = (target: 'order' | 'drop', mode: 'replace' | 'append') => {
        if (parsedBatch.items.length === 0) return;
        const bundleItems: PocketBundleItem[] = parsedBatch.items.map((item) => ({
            itemId: item.itemId,
            name: item.name,
            quantity: item.quantity,
            category: item.category,
            image: item.image,
            entityType: item.entityType,
            variantId: item.variantId,
            variantLabel: item.variantLabel,
        }));

        if (target === 'order') {
            loadBundleIntoOrder(bundleItems, mode === 'replace' ? 'replace' : 'merge');
        } else {
            loadBundleIntoDrop(bundleItems, mode === 'replace' ? 'replace' : 'merge');
        }
        setBatchPasteModalOpen(false);
        setBatchPasteText('');
        playChimeClick();
    };

    // Private Pockets Handlers
    const handleSaveCurrentPocket = async () => {
        if (!newPresetTitle.trim()) return;
        if (totalOrderCount === 0 && totalDropCount === 0) return;
        setSavingPreset(true);
        try {
            const saved = await saveLocalPreset(
                newPresetTitle.trim(),
                orderItems,
                dropItems,
                newPresetDesc.trim(),
                'Custom Builds',
                ['my-pocket'],
                token
            );
            const updated = [saved, ...localPresets.filter((p) => p.id !== saved.id)];
            setLocalPresets(updated);
            setNewPresetTitle('');
            setNewPresetDesc('');
            setSaveFeedback(`Saved "${saved.title}"!`);
            setTimeout(() => setSaveFeedback(null), 3000);
            playChimeClick();
        } catch {
            // Handle error
        } finally {
            setSavingPreset(false);
        }
    };

    const handleLoadPrivatePreset = (preset: LocalPreset, mode: 'replace' | 'merge') => {
        if (preset.orderItems && preset.orderItems.length > 0) {
            loadBundleIntoOrder(preset.orderItems, mode);
        }
        if (preset.dropItems && preset.dropItems.length > 0) {
            loadBundleIntoDrop(preset.dropItems, mode);
        }
        playChimeClick();
    };

    const handleDeletePrivatePreset = async (id: string) => {
        await deleteLocalPreset(id, token);
        setLocalPresets((prev) => prev.filter((p) => p.id !== id));
        playChimeClick();
    };

    const handleLoadCommunityBundle = (bundle: PocketBundle, mode: 'replace' | 'merge') => {
        if (bundle.items && bundle.items.length > 0) {
            loadBundleIntoOrder(bundle.items, mode);
        }
        playChimeClick();
    };

    const filteredLocalPresets = useMemo(() => {
        if (!presetSearch.trim()) return localPresets;
        const q = presetSearch.toLowerCase();
        return localPresets.filter(
            (p) => p.title.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q)
        );
    }, [localPresets, presetSearch]);

    // Capacity calculations
    const orderCapPct = Math.min(100, Math.round((totalOrderCount / 40) * 100));
    const dropCapPct = Math.min(100, Math.round((totalDropCount / 9) * 100));

    const orderCapColor = totalOrderCount >= 40 ? 'bg-danger' : totalOrderCount >= 32 ? 'bg-warning' : 'bg-success';
    const orderBadgeColor =
        totalOrderCount >= 40
            ? 'bg-danger text-white'
            : totalOrderCount >= 32
            ? 'bg-warning text-dark'
            : 'bg-success text-white';

    const dropCapColor = totalDropCount >= 9 ? 'bg-warning' : 'bg-info';
    const dropBadgeColor = totalDropCount >= 9 ? 'bg-warning text-dark' : 'bg-info text-dark';

    if (!user && !authLoading) {
        return (
            <div className="pocket-inventory-page nook-bg py-5 px-3 min-vh-100">
                <Helmet>
                    <title>Pocket Inventory Manager | Chopaeng</title>
                    <meta name="description" content="Manage your ACNH pocket inventory. Requires Discord login to save to ChoBot." />
                </Helmet>
                <RequireAuthView
                    title="Pocket Inventory Manager"
                    description="Sign in with your Discord account to configure your 40-slot order pockets and 9-slot drop pockets, optimize stacks, and save custom pocket presets directly to ChoBot."
                    icon="fa-briefcase"
                    badge="ChoBot Cloud Pocket Inventory"
                    returnPath="/pockets"
                />
            </div>
        );
    }

    return (
        <div
            className="pocket-inventory-page nook-bg py-4 px-3 px-md-5 min-vh-100"
        >
            <Helmet>
                <title>Full Pocket Inventory &amp; Command Builder | Chopaeng</title>
                <meta
                    name="description"
                    content="Large in-game style Animal Crossing pocket inventory grid with 40-slot order bot, 9-slot drop radius, and villager adoption showcase."
                />
            </Helmet>

            <div className="container-fluid" style={{ maxWidth: '1400px' }}>
                {/* Breadcrumb & Header */}
                <header className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-4 pb-3 border-bottom">
                    <div>
                        <nav aria-label="Breadcrumb">
                            <ol className="breadcrumb mb-1 small">
                                <li className="breadcrumb-item">
                                    <Link to="/" className="text-decoration-none text-muted">
                                        <i className="fa-solid fa-house me-1" aria-hidden="true"></i>Home
                                    </Link>
                                </li>
                                <li className="breadcrumb-item">
                                    <Link to="/command-builder" className="text-decoration-none text-muted">
                                        Command Builder
                                    </Link>
                                </li>
                                <li className="breadcrumb-item active fw-bold text-success" aria-current="page">
                                    Pocket Inventory
                                </li>
                            </ol>
                        </nav>
                        <h1 className="h3 h2-md fw-black text-dark mb-1 ac-font d-flex align-items-center gap-2 flex-wrap">
                            <i className="fa-solid fa-boxes-packing text-success" aria-hidden="true"></i>
                            <span>Pocket Inventory Manager</span>
                            <span className="badge bg-light text-success border border-success-subtle rounded-pill px-2.5 py-1 fw-bold tiny-text d-inline-flex align-items-center gap-1 shadow-2xs">
                                <i className={isSyncingDb ? "fa-solid fa-spinner fa-spin text-primary" : "fa-solid fa-cloud-arrow-up text-success"} />
                                <span>{isSyncingDb ? "Syncing..." : "Saved to ChoBot"}</span>
                            </span>
                        </h1>
                        <p className="small text-muted mb-0">
                            Full visual Animal Crossing inventory grid. Manage your 40-slot Order Bot pockets, 9-slot Drop
                            Bot radius, and Villagers.
                        </p>
                    </div>

                    {/* Toolbar Actions */}
                    <div
                        className="pocket-toolbar-actions d-flex align-items-center gap-2 flex-wrap"
                        role="toolbar"
                        aria-label="Pocket Inventory Actions"
                    >
                        <button
                            type="button"
                            className="btn btn-nook text-white rounded-pill fw-bold btn-sm shadow-sm d-inline-flex align-items-center gap-1 px-3 text-nowrap"
                            style={{ minHeight: '36px' }}
                            onClick={() => {
                                setQuickAddTarget('order');
                                setQuickAddModalOpen(true);
                                playChimeClick();
                            }}
                            aria-label="Add items to pocket"
                        >
                            <i className="fa-solid fa-plus" aria-hidden="true"></i>
                            <span>Add Items</span>
                        </button>

                        <button
                            type="button"
                            className="btn btn-outline-success rounded-pill fw-bold btn-sm shadow-xs d-inline-flex align-items-center gap-1 px-3 text-nowrap"
                            style={{ minHeight: '36px' }}
                            onClick={() => setBatchPasteModalOpen(true)}
                            aria-label="Batch paste item codes"
                        >
                            <i className="fa-solid fa-paste" aria-hidden="true"></i>
                            <span>Batch Paste</span>
                        </button>

                        <button
                            type="button"
                            className="btn btn-outline-success rounded-pill fw-bold btn-sm shadow-2xs d-inline-flex align-items-center gap-1 px-3 text-nowrap"
                            style={{ minHeight: '36px' }}
                            onClick={() => {
                                setBundlesModalOpen(true);
                                playChimeClick();
                            }}
                            aria-label="Open community loadouts and bundles"
                        >
                            <i className="fa-solid fa-box-open text-warning" aria-hidden="true"></i>
                            <span>Loadouts</span>
                        </button>

                        <button
                            type="button"
                            className="btn btn-outline-primary rounded-pill fw-bold btn-sm shadow-xs d-inline-flex align-items-center gap-1 px-3 text-nowrap"
                            style={{ minHeight: '36px' }}
                            onClick={() => setShareModalOpen(true)}
                            aria-label="Share current pockets"
                        >
                            <i className="fa-solid fa-share-nodes" aria-hidden="true"></i>
                            <span>Share</span>
                        </button>

                        <Link
                            to="/command-builder"
                            className="btn btn-outline-dark rounded-pill fw-bold btn-sm d-inline-flex align-items-center gap-1 px-3 text-nowrap"
                            style={{ minHeight: '36px' }}
                            aria-label="Go to catalog command builder"
                        >
                            <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
                            <span>Catalog</span>
                        </Link>

                        <Link
                            to="/order"
                            className="btn rounded-pill fw-bold btn-sm d-inline-flex align-items-center gap-1 px-3 text-white text-nowrap"
                            style={{
                                background: '#37b06d',
                                boxShadow: '0 2px 8px rgba(55,176,109,.3)',
                                minHeight: '36px',
                            }}
                            title="Go to Order Bot to submit your order"
                            aria-label="Go to Order Bot"
                        >
                            <i className="fa-solid fa-paper-plane" aria-hidden="true"></i>
                            <span>Order Bot</span>
                        </Link>
                    </div>
                </header>

                {/* Main 2-Column Responsive Layout */}
                <div className="row g-4">
                    {/* LEFT COLUMN: Large In-Game Visual Grid & Tools */}
                    <div className="col-lg-8">
                        {/* Capacity Overview Banner */}
                        <section
                            className="card rounded-4 border-0 shadow-sm p-3 mb-4 bg-white"
                            aria-label="Pockets Capacity Overview"
                        >
                            <div className="row g-3 align-items-center">
                                {/* Order Bot Capacity */}
                                <div className="col-md-6 border-end-md">
                                    <div className="d-flex justify-content-between align-items-center mb-1">
                                        <span className="small fw-bold text-dark d-flex align-items-center gap-2">
                                            <span
                                                className="d-inline-flex align-items-center justify-content-center rounded-circle"
                                                style={{
                                                    width: 22,
                                                    height: 22,
                                                    backgroundColor: '#e8f7ec',
                                                    color: '#16a34a',
                                                }}
                                                aria-hidden="true"
                                            >
                                                <i className="fa-solid fa-cart-flatbed small"></i>
                                            </span>
                                            <span>Order Bot Capacity</span>
                                        </span>
                                        <span className={`badge rounded-pill fw-bold px-2 py-1 ${orderBadgeColor}`}>
                                            {totalOrderCount} / 40 Slots
                                        </span>
                                    </div>
                                    <div
                                        className="progress"
                                        style={{ height: '8px', borderRadius: '10px', backgroundColor: '#f1f5f2' }}
                                        role="progressbar"
                                        aria-label="Order Bot capacity"
                                        aria-valuenow={totalOrderCount}
                                        aria-valuemin={0}
                                        aria-valuemax={40}
                                    >
                                        <div
                                            className={`progress-bar transition-all ${orderCapColor}`}
                                            style={{ width: `${orderCapPct}%` }}
                                        />
                                    </div>
                                    <div className="d-flex justify-content-between align-items-center mt-1">
                                        <span className="tiny-text text-muted">
                                            {40 - totalOrderCount > 0
                                                ? `${40 - totalOrderCount} slots remaining`
                                                : 'Pocket full (max 40)'}
                                        </span>
                                        <span className="tiny-text fw-bold text-muted">{orderCapPct}%</span>
                                    </div>
                                </div>

                                {/* Drop Bot Ground Radius */}
                                <div className="col-md-6">
                                    <div className="d-flex justify-content-between align-items-center mb-1">
                                        <span className="small fw-bold text-dark d-flex align-items-center gap-2">
                                            <span
                                                className="d-inline-flex align-items-center justify-content-center rounded-circle"
                                                style={{
                                                    width: 22,
                                                    height: 22,
                                                    backgroundColor: '#e0f2fe',
                                                    color: '#0284c7',
                                                }}
                                                aria-hidden="true"
                                            >
                                                <i className="fa-solid fa-layer-group small"></i>
                                            </span>
                                            <span>Drop Bot Ground Radius</span>
                                        </span>
                                        <span className={`badge rounded-pill fw-bold px-2 py-1 ${dropBadgeColor}`}>
                                            {totalDropCount} / 9 Ground Spots
                                        </span>
                                    </div>
                                    <div
                                        className="progress"
                                        style={{ height: '8px', borderRadius: '10px', backgroundColor: '#f1f5f2' }}
                                        role="progressbar"
                                        aria-label="Drop Bot ground radius capacity"
                                        aria-valuenow={totalDropCount}
                                        aria-valuemin={0}
                                        aria-valuemax={9}
                                    >
                                        <div
                                            className={`progress-bar transition-all ${dropCapColor}`}
                                            style={{ width: `${dropCapPct}%` }}
                                        />
                                    </div>
                                    <div className="d-flex justify-content-between align-items-center mt-1">
                                        <span className="tiny-text text-muted">
                                            {9 - totalDropCount > 0
                                                ? `${9 - totalDropCount} spots remaining`
                                                : 'Ground radius full (3×3)'}
                                        </span>
                                        <span className="tiny-text fw-bold text-muted">{dropCapPct}%</span>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Interactive Visual Pocket Grid Component */}
                        <VisualPocketGrid
                            orderPockets={orderItems}
                            dropPockets={dropItems}
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
                            onSortPockets={handleSortPockets}
                            onReorderOrderPockets={reorderOrderPockets}
                            onReorderDropPockets={reorderDropPockets}
                            onOpenAddItem={(target) => {
                                setQuickAddTarget(target);
                                setQuickAddModalOpen(true);
                                playChimeClick();
                            }}
                        />

                        {/* Smart Tools & Presets Card */}
                        <div className="card rounded-4 border p-3 shadow-2xs bg-white mt-3">
                            <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
                                <div className="d-flex align-items-center gap-2 min-w-0">
                                    <span
                                        className="d-inline-flex align-items-center justify-content-center rounded-circle flex-shrink-0"
                                        style={{ width: 28, height: 28, backgroundColor: '#fef3c7', color: '#d97706' }}
                                        aria-hidden="true"
                                    >
                                        <i className="fa-solid fa-wand-magic-sparkles small"></i>
                                    </span>
                                    <div className="min-w-0">
                                        <strong className="d-block text-dark small fw-bold text-truncate">Smart Fill Tools</strong>
                                        <span className="tiny-text text-muted text-truncate d-block">Auto-optimize your inventory layout</span>
                                    </div>
                                </div>

                                <div className="smart-fill-actions d-flex align-items-center gap-2 flex-wrap min-w-0">
                                    <SmartFillDropdown
                                        onFillNmt={handleFillTickets}
                                        onFillCrowns={handleFillCrowns}
                                        onFillBells={handleFillBells}
                                        onFillGold={() => handleFillRemaining('gold')}
                                        onFillRepeat={() => handleFillRemaining('repeat')}
                                        onMaximizeStacks={handleMaximizeStacks}
                                        onSortPockets={handleSortPockets}
                                        isOrderFull={totalOrderCount >= 40}
                                        hasItems={totalOrderCount > 0}
                                    />
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-white border rounded-pill fw-bold text-dark shadow-2xs d-inline-flex align-items-center gap-1 px-3 text-nowrap"
                                        style={{ minHeight: '34px', fontSize: '0.8rem' }}
                                        onClick={() => {
                                            handleMaximizeStacks();
                                            playChimeClick();
                                        }}
                                        title="Maximize stack quantities for all items"
                                        aria-label="Maximize stack quantities"
                                    >
                                        <i
                                            className="fa-solid fa-layer-group text-success me-1"
                                            aria-hidden="true"
                                        ></i>
                                        <span>Max Stacks</span>
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-white border rounded-pill fw-bold text-dark shadow-2xs d-inline-flex align-items-center gap-1 px-3 text-nowrap"
                                        style={{ minHeight: '34px', fontSize: '0.8rem' }}
                                        onClick={() => {
                                            handleSortPockets();
                                            playChimeClick();
                                        }}
                                        title="Sort pocket items alphabetically"
                                        aria-label="Sort items A to Z"
                                    >
                                        <i
                                            className="fa-solid fa-arrow-down-a-z text-primary me-1"
                                            aria-hidden="true"
                                        ></i>
                                        <span>Sort A-Z</span>
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-white border rounded-pill fw-bold text-dark shadow-2xs d-inline-flex align-items-center gap-1 px-3 text-nowrap"
                                        style={{ minHeight: '34px', fontSize: '0.8rem' }}
                                        onClick={() => {
                                            handleFlipOrderAndDrop();
                                            playChimeClick();
                                        }}
                                        title="Swap or convert items between Order (40 slots) and Drop (9 radius spots)"
                                        aria-label="Flip order and drop pockets"
                                    >
                                        <i className="fa-solid fa-right-left text-info me-1" aria-hidden="true"></i>
                                        <span>Flip Order ⇄ Drop</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: My Pockets, Community Loadouts, & Bot Commands */}
                    <div className="col-lg-4">
                        {/* Selector Card */}
                        <div className="card rounded-4 border-0 shadow-sm p-3 mb-4 bg-white">
                            {/* Navigation Pill Switcher */}
                            <div className="d-flex align-items-center justify-content-between p-1 rounded-pill bg-light border mb-3 flex-wrap gap-1">
                                <button
                                    type="button"
                                    className={`btn btn-xs rounded-pill fw-bold px-3 py-1 flex-grow-1 transition-all ${
                                        rightPanelTab === 'my-pockets'
                                            ? 'btn-nook text-white shadow-2xs'
                                            : 'text-muted border-0 bg-transparent'
                                    }`}
                                    style={{ fontSize: '0.75rem' }}
                                    onClick={() => {
                                        setRightPanelTab('my-pockets');
                                        playChimeClick();
                                    }}
                                >
                                    <i className="fa-solid fa-folder-open me-1"></i>
                                    <span>My Pockets ({localPresets.length})</span>
                                </button>
                                <button
                                    type="button"
                                    className={`btn btn-xs rounded-pill fw-bold px-3 py-1 flex-grow-1 transition-all ${
                                        rightPanelTab === 'community'
                                            ? 'btn-nook text-white shadow-2xs'
                                            : 'text-muted border-0 bg-transparent'
                                    }`}
                                    style={{ fontSize: '0.75rem' }}
                                    onClick={() => {
                                        setRightPanelTab('community');
                                        playChimeClick();
                                    }}
                                >
                                    <i className="fa-solid fa-wand-magic-sparkles me-1 text-warning"></i>
                                    <span>Loadouts</span>
                                </button>
                                <button
                                    type="button"
                                    className={`btn btn-xs rounded-pill fw-bold px-2 py-1 flex-grow-1 transition-all ${
                                        rightPanelTab === 'terminal'
                                            ? 'btn-dark text-white shadow-2xs'
                                            : 'text-muted border-0 bg-transparent'
                                    }`}
                                    style={{ fontSize: '0.75rem' }}
                                    onClick={() => {
                                        setRightPanelTab('terminal');
                                        playChimeClick();
                                    }}
                                >
                                    <i className="fa-solid fa-terminal me-1"></i>
                                    <span>Terminal</span>
                                </button>
                            </div>

                            {/* ── TAB 1: MY PRIVATE POCKETS & SAVED VAULT ── */}
                            {rightPanelTab === 'my-pockets' && (
                                <div className="animate-fade">
                                    {/* Save Current Pocket Box */}
                                    <div className="card rounded-4 p-3 bg-light border mb-3">
                                        <div className="d-flex align-items-center justify-content-between mb-2">
                                            <span className="tiny-text fw-bold text-dark text-uppercase tracking-wider">
                                                <i className="fa-solid fa-bookmark text-success me-1"></i> Save Current
                                                Pocket
                                            </span>
                                            <span className="badge bg-success bg-opacity-10 text-success rounded-pill x-small fw-bold">
                                                {totalOrderCount}/40 Slots
                                            </span>
                                        </div>
                                        <div className="input-group mb-2">
                                            <input
                                                type="text"
                                                className="form-control form-control-sm rounded-start-pill border-2"
                                                placeholder="e.g. Island Remodel Materials Set"
                                                value={newPresetTitle}
                                                onChange={(e) => setNewPresetTitle(e.target.value)}
                                                maxLength={36}
                                            />
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-success rounded-end-pill px-3 fw-bold"
                                                style={{ backgroundColor: '#37b06d', borderColor: '#37b06d' }}
                                                disabled={
                                                    !newPresetTitle.trim() ||
                                                    (totalOrderCount === 0 && totalDropCount === 0) ||
                                                    savingPreset
                                                }
                                                onClick={handleSaveCurrentPocket}
                                            >
                                                {savingPreset ? (
                                                    <span className="spinner-border spinner-border-sm" />
                                                ) : (
                                                    <>
                                                        <i className="fa-solid fa-plus me-1"></i>Save
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                        {saveFeedback && (
                                            <div className="tiny-text text-success fw-bold animate-fade">
                                                <i className="fa-solid fa-circle-check me-1"></i>
                                                {saveFeedback}
                                            </div>
                                        )}
                                        {totalOrderCount === 0 && totalDropCount === 0 && (
                                            <span className="tiny-text text-muted">
                                                Add items to pockets on the left to save.
                                            </span>
                                        )}
                                    </div>

                                    {/* Filter Search */}
                                    {localPresets.length > 2 && (
                                        <div className="mb-2">
                                            <input
                                                type="text"
                                                className="form-control form-control-sm rounded-pill border"
                                                placeholder="Search my private pockets..."
                                                value={presetSearch}
                                                onChange={(e) => setPresetSearch(e.target.value)}
                                            />
                                        </div>
                                    )}

                                    {/* List of Saved Private Pockets */}
                                    <div
                                        className="d-flex flex-column gap-2"
                                        style={{ maxHeight: '420px', overflowY: 'auto' }}
                                    >
                                        {filteredLocalPresets.length > 0 ? (
                                            filteredLocalPresets.map((preset) => {
                                                const totalItemsInPreset = (preset.orderItems || []).reduce(
                                                    (s, p) => s + p.quantity,
                                                    0
                                                );
                                                return (
                                                    <div
                                                        key={preset.id}
                                                        className="p-3 rounded-4 border bg-white shadow-2xs hover-shadow-sm transition-all"
                                                    >
                                                        <div className="d-flex align-items-center justify-content-between mb-1">
                                                            <strong
                                                                className="text-dark small fw-black text-truncate"
                                                                style={{ maxWidth: '65%' }}
                                                            >
                                                                {preset.title}
                                                            </strong>
                                                            <span className="badge bg-success bg-opacity-10 text-success rounded-pill x-small fw-bold">
                                                                {totalItemsInPreset} Slots
                                                            </span>
                                                        </div>
                                                        {preset.description && (
                                                            <p className="tiny-text text-muted mb-2 text-truncate">
                                                                {preset.description}
                                                            </p>
                                                        )}

                                                        {/* Item sprites preview row */}
                                                        {preset.orderItems && preset.orderItems.length > 0 && (
                                                            <div className="d-flex gap-1 overflow-x-auto py-1 mb-2 bg-light p-1 rounded-3">
                                                                {preset.orderItems.slice(0, 10).map((it: PocketBundleItem, idx: number) => (
                                                                    <img
                                                                        key={`${it.itemId}-${idx}`}
                                                                        src={
                                                                            it.image ||
                                                                            "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23f1f5f9'/></svg>"
                                                                        }
                                                                        alt={it.name}
                                                                        title={`${it.name} (×${it.quantity})`}
                                                                        style={{
                                                                            width: 22,
                                                                            height: 22,
                                                                            objectFit: 'contain',
                                                                        }}
                                                                    />
                                                                ))}
                                                                {preset.orderItems.length > 10 && (
                                                                    <span className="tiny-text text-muted fw-bold d-flex align-items-center px-1">
                                                                        +{preset.orderItems.length - 10}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Action Buttons */}
                                                        <div className="d-flex align-items-center justify-content-between pt-1">
                                                            <span className="tiny-text text-muted">
                                                                {new Date(preset.createdAt).toLocaleDateString()}
                                                            </span>
                                                            <div className="d-flex align-items-center gap-1">
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-xs btn-outline-success rounded-pill fw-bold px-2 py-1"
                                                                    onClick={() =>
                                                                        handleLoadPrivatePreset(preset, 'merge')
                                                                    }
                                                                    title="Append into empty pocket slots"
                                                                >
                                                                    Merge (+)
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-xs btn-success text-white rounded-pill fw-bold px-3 py-1 shadow-2xs"
                                                                    style={{
                                                                        backgroundColor: '#37b06d',
                                                                        borderColor: '#37b06d',
                                                                    }}
                                                                    onClick={() =>
                                                                        handleLoadPrivatePreset(preset, 'replace')
                                                                    }
                                                                    title="Replace entire pocket with this loadout"
                                                                >
                                                                    <i className="fa-solid fa-arrow-down-to-bracket me-1"></i>
                                                                    Load
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-xs btn-outline-danger rounded-circle p-0 d-flex align-items-center justify-content-center"
                                                                    style={{ width: 24, height: 24 }}
                                                                    onClick={() =>
                                                                        handleDeletePrivatePreset(preset.id)
                                                                    }
                                                                    title="Delete private pocket"
                                                                >
                                                                    <i className="fa-solid fa-trash-can x-small"></i>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div className="text-center py-4 text-muted bg-light rounded-4 border">
                                                <div style={{ fontSize: '2.2rem' }} className="mb-2 text-muted">
                                                    <i className="fa-solid fa-floppy-disk" aria-hidden="true" />
                                                </div>
                                                <h4 className="fw-bold mb-1 h6 text-dark ac-font">
                                                    No Saved Private Pockets
                                                </h4>
                                                <p className="tiny-text text-muted mb-0 px-3">
                                                    Build your 40-slot pocket on the left, type a name above, and click
                                                    Save to store custom configurations!
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* ── TAB 2: COMMUNITY & OFFICIAL LOADOUTS ── */}
                            {rightPanelTab === 'community' && (
                                <div className="animate-fade">
                                    <div className="d-flex align-items-center justify-content-between mb-2">
                                        <span className="tiny-text fw-bold text-dark text-uppercase tracking-wider">
                                            <i className="fa-solid fa-boxes-packing text-warning me-1"></i> Featured
                                            Sets
                                        </span>
                                        <button
                                            type="button"
                                            className="btn btn-link p-0 text-success tiny-text fw-bold text-decoration-none"
                                            onClick={() => {
                                                setBundlesModalOpen(true);
                                                playChimeClick();
                                            }}
                                        >
                                            Full Vault Modal →
                                        </button>
                                    </div>

                                    <div
                                        className="d-flex flex-column gap-2"
                                        style={{ maxHeight: '420px', overflowY: 'auto' }}
                                    >
                                        {communityBundles.slice(0, 15).map((bundle) => (
                                            <div
                                                key={bundle.id}
                                                className="p-3 rounded-4 border bg-white shadow-2xs hover-shadow-sm transition-all"
                                            >
                                                <div className="d-flex align-items-center justify-content-between mb-1">
                                                    <strong
                                                        className="text-dark small fw-black text-truncate"
                                                        style={{ maxWidth: '68%' }}
                                                    >
                                                        {bundle.title}
                                                    </strong>
                                                    <span className="badge bg-primary bg-opacity-10 text-primary rounded-pill x-small fw-bold">
                                                        {bundle.items.length} Items
                                                    </span>
                                                </div>
                                                {bundle.description && (
                                                    <p className="tiny-text text-muted mb-2 text-truncate">
                                                        {bundle.description}
                                                    </p>
                                                )}

                                                {/* Item sprites preview row */}
                                                <div className="d-flex gap-1 overflow-x-auto py-1 mb-2 bg-light p-1 rounded-3">
                                                    {bundle.items.slice(0, 8).map((it: PocketBundleItem, idx: number) => (
                                                        <img
                                                            key={`${it.itemId}-${idx}`}
                                                            src={
                                                                it.image ||
                                                                "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23f1f5f9'/></svg>"
                                                            }
                                                            alt={it.name}
                                                            title={`${it.name} (×${it.quantity})`}
                                                            style={{
                                                                width: 22,
                                                                height: 22,
                                                                objectFit: 'contain',
                                                            }}
                                                        />
                                                    ))}
                                                    {bundle.items.length > 8 && (
                                                        <span className="tiny-text text-muted fw-bold d-flex align-items-center px-1">
                                                            +{bundle.items.length - 8}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="d-flex align-items-center justify-content-between pt-1">
                                                    <span className="badge bg-light text-dark border rounded-pill x-small">
                                                        {bundle.category || 'Curated'}
                                                    </span>
                                                    <div className="d-flex align-items-center gap-1">
                                                        <button
                                                            type="button"
                                                            className="btn btn-xs btn-outline-success rounded-pill fw-bold px-2 py-1"
                                                            onClick={() => handleLoadCommunityBundle(bundle, 'merge')}
                                                            title="Merge into empty slots"
                                                        >
                                                            Merge (+)
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn btn-xs btn-success text-white rounded-pill fw-bold px-3 py-1 shadow-2xs"
                                                            style={{
                                                                backgroundColor: '#37b06d',
                                                                borderColor: '#37b06d',
                                                            }}
                                                            onClick={() => handleLoadCommunityBundle(bundle, 'replace')}
                                                            title="Replace pocket with this bundle"
                                                        >
                                                            <i className="fa-solid fa-arrow-down-to-bracket me-1"></i>
                                                            Load
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="mt-3 text-center">
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-outline-dark rounded-pill fw-bold w-100"
                                            onClick={() => {
                                                setBundlesModalOpen(true);
                                                playChimeClick();
                                            }}
                                        >
                                            <i className="fa-solid fa-magnifying-glass me-1"></i> Browse Full Community
                                            Vault
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* ── TAB 3: COMMAND TERMINAL ── */}
                            {rightPanelTab === 'terminal' && (
                                <div className="animate-fade">
                                    {/* Terminal Box */}
                                    <div
                                        className="card rounded-4 border-0 shadow-sm overflow-hidden mb-3"
                                        style={{ backgroundColor: '#1c2420', color: '#ffffff' }}
                                    >
                                        <div
                                            className="px-3 py-2 d-flex align-items-center justify-content-between"
                                            style={{
                                                background: '#141a17',
                                                borderBottom: '1px solid rgba(255,255,255,0.08)',
                                            }}
                                        >
                                            <div className="d-flex align-items-center gap-2">
                                                <div className="d-flex gap-1" aria-hidden="true">
                                                    <span
                                                        className="rounded-circle"
                                                        style={{ width: 10, height: 10, backgroundColor: '#ff5f56' }}
                                                    />
                                                    <span
                                                        className="rounded-circle"
                                                        style={{ width: 10, height: 10, backgroundColor: '#ffbd2e' }}
                                                    />
                                                    <span
                                                        className="rounded-circle"
                                                        style={{ width: 10, height: 10, backgroundColor: '#27c93f' }}
                                                    />
                                                </div>
                                                <span className="font-monospace text-light fw-bold small ms-1">
                                                    <i
                                                        className="fa-solid fa-terminal text-success me-1"
                                                        aria-hidden="true"
                                                    ></i>
                                                    Bot Command Terminal
                                                </span>
                                            </div>
                                        </div>

                                        <div className="p-3">
                                            {/* Order Bot Command */}
                                            <div className="mb-3">
                                                <div className="d-flex justify-content-between align-items-center mb-1">
                                                    <span className="badge rounded-pill fw-bold font-monospace x-small bg-success text-white">
                                                        !order command ({totalOrderItemsCount > 0 ? `${totalOrderItemsCount}/40 items${orderVillager ? ` + ${orderVillager.name}` : ''}` : orderVillager ? `${orderVillager.name}` : '0 items'})
                                                    </span>
                                                </div>
                                                <div
                                                    className="p-2 rounded-3 font-monospace mb-2 text-break select-all"
                                                    style={{
                                                        backgroundColor: '#111713',
                                                        border: '1px solid rgba(255,255,255,0.08)',
                                                        fontSize: '0.78rem',
                                                        maxHeight: '80px',
                                                        overflowY: 'auto',
                                                        color: '#a3e635',
                                                    }}
                                                    tabIndex={0}
                                                    role="region"
                                                    aria-label="Order command text preview"
                                                >
                                                    {orderCommandText || (
                                                        <span className="text-muted fst-italic">
                                                            &gt; Add items to generate command...
                                                        </span>
                                                    )}
                                                </div>
                                                <button
                                                    type="button"
                                                    className={`btn w-100 rounded-pill py-2 fw-bold btn-sm shadow-sm transition-all d-flex align-items-center justify-content-center gap-2 ${
                                                        copyOrderStatus === 'Copied!'
                                                            ? 'btn-success text-white'
                                                            : 'btn-nook text-white'
                                                    }`}
                                                    onClick={handleCopyOrderWithFlow}
                                                    disabled={!orderCommandText}
                                                    title={
                                                        orderCommandText
                                                            ? 'Copy !order command to clipboard'
                                                            : 'Add items to enable'
                                                    }
                                                    aria-label="Copy order command"
                                                >
                                                    <i
                                                        className={`fa-solid ${
                                                            copyOrderStatus === 'Copied!' ? 'fa-check' : 'fa-copy'
                                                        }`}
                                                        aria-hidden="true"
                                                    ></i>
                                                    <span>
                                                        {copyOrderStatus === 'Copied!'
                                                            ? 'Copied !order Command!'
                                                            : 'Copy Order Command'}
                                                    </span>
                                                </button>

                                                {/* Order Bot Direct Action */}
                                                {orderCommandText && (
                                                    <Link
                                                        to="/order"
                                                        className="btn w-100 rounded-pill py-2 fw-bold btn-sm d-flex align-items-center justify-content-center gap-2 mt-2 text-decoration-none"
                                                        style={{
                                                            background: 'rgba(74,222,128,.14)',
                                                            color: '#4ade80',
                                                            border: '1px solid rgba(74,222,128,.3)',
                                                        }}
                                                        title="Open Order Bot to submit"
                                                    >
                                                        <i className="fa-solid fa-paper-plane" aria-hidden="true"></i>
                                                        <span>Send to Order Bot →</span>
                                                    </Link>
                                                )}
                                            </div>

                                            {/* Drop Bot Command */}
                                            <div className="pt-3 border-top border-secondary border-opacity-25">
                                                <div className="d-flex justify-content-between align-items-center mb-1">
                                                    <span className="badge rounded-pill fw-bold font-monospace x-small bg-info text-dark">
                                                        !drop command ({totalDropCount} items)
                                                    </span>
                                                </div>
                                                <div
                                                    className="p-2 rounded-3 font-monospace mb-2 text-break select-all"
                                                    style={{
                                                        backgroundColor: '#111713',
                                                        border: '1px solid rgba(255,255,255,0.08)',
                                                        fontSize: '0.78rem',
                                                        maxHeight: '80px',
                                                        overflowY: 'auto',
                                                        color: '#38bdf8',
                                                    }}
                                                    tabIndex={0}
                                                    role="region"
                                                    aria-label="Drop command text preview"
                                                >
                                                    {dropCommandText || (
                                                        <span className="text-muted fst-italic">
                                                            &gt; Add items to generate command...
                                                        </span>
                                                    )}
                                                </div>
                                                <button
                                                    type="button"
                                                    className={`btn w-100 rounded-pill py-2 fw-bold btn-sm shadow-sm transition-all d-flex align-items-center justify-content-center gap-2 ${
                                                        copyDropStatus === 'Copied!'
                                                            ? 'btn-info text-dark'
                                                            : 'btn-light text-dark'
                                                    }`}
                                                    onClick={handleCopyDropWithFlow}
                                                    disabled={!dropCommandText}
                                                    title={
                                                        dropCommandText
                                                            ? 'Copy !drop command to clipboard'
                                                            : 'Add drop items to enable'
                                                    }
                                                    aria-label="Copy drop command"
                                                >
                                                    <i
                                                        className={`fa-solid ${
                                                            copyDropStatus === 'Copied!' ? 'fa-check' : 'fa-copy'
                                                        }`}
                                                        aria-hidden="true"
                                                    ></i>
                                                    <span>
                                                        {copyDropStatus === 'Copied!'
                                                            ? 'Copied !drop Command!'
                                                            : 'Copy Drop Command'}
                                                    </span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* FLOW STEP INSTRUCTION CARDS (ORDER FLOW & DROP FLOW) */}
                        <div className="card rounded-4 border p-3 shadow-sm bg-white mb-3">
                            <h2 className="h6 fw-black text-dark mb-2 d-flex align-items-center gap-2 ac-font">
                                <i className="fa-solid fa-route text-success" aria-hidden="true"></i>
                                How Bot Delivery Works
                            </h2>

                            {/* ORDER BOT FLOW */}
                            <div
                                className={`p-3 rounded-4 mb-3 border transition-all ${
                                    copiedFlowType === 'order' ? 'bg-success-subtle border-success' : 'bg-light'
                                }`}
                            >
                                <div className="d-flex align-items-center justify-content-between mb-2">
                                    <strong className="small text-dark fw-bold d-flex align-items-center gap-2">
                                        <span className="badge bg-success text-white rounded-pill px-2 py-1">1</span>
                                        <span>Order Bot Flow (40 Items / Villager)</span>
                                    </strong>
                                    {copiedFlowType === 'order' && (
                                        <span className="badge bg-success text-white rounded-pill x-small animate-fade">
                                            ✓ Active Copy
                                        </span>
                                    )}
                                </div>

                                <ol className="tiny-text text-dark ps-3 mb-0" style={{ lineHeight: 1.6 }}>
                                    <li className="mb-1">
                                        <strong>Copy your command</strong> (<code>!order</code>) or click{' '}
                                        <strong>Send to Order Bot</strong>.
                                    </li>
                                    <li className="mb-1">
                                        <strong>Submit on website</strong> via{' '}
                                        <Link to="/order" className="text-success fw-bold">
                                            Order Bot
                                        </Link>{' '}
                                        or in Discord's <strong>#order-bot</strong> channel.
                                    </li>
                                    <li className="mb-1">
                                        <strong>Wait for your Dodo code</strong> when your order is ready with live
                                        notifications.
                                    </li>
                                    <li>
                                        <strong>Fly to the private island</strong> with empty pockets to collect all 40
                                        items!
                                    </li>
                                </ol>
                            </div>

                            {/* DROP BOT FLOW */}
                            <div
                                className={`p-3 rounded-4 border transition-all ${
                                    copiedFlowType === 'drop' ? 'bg-info-subtle border-info' : 'bg-light'
                                }`}
                            >
                                <div className="d-flex align-items-center justify-content-between mb-2">
                                    <strong className="small text-dark fw-bold d-flex align-items-center gap-2">
                                        <span className="badge bg-info text-dark rounded-pill px-2 py-1">2</span>
                                        <span>Drop Bot Flow (9 Ground Tiles)</span>
                                    </strong>
                                    {copiedFlowType === 'drop' && (
                                        <span className="badge bg-info text-dark rounded-pill x-small animate-fade">
                                            ✓ Active Copy
                                        </span>
                                    )}
                                </div>

                                <ol className="tiny-text text-dark ps-3 mb-0" style={{ lineHeight: 1.6 }}>
                                    <li className="mb-1">
                                        <strong>
                                            Copy your <code>!drop</code> command
                                        </strong>{' '}
                                        with up to 9 item codes.
                                    </li>
                                    <li className="mb-1">
                                        <strong>Fly to a Drop Bot Island</strong> using the live Dodo Code.
                                    </li>
                                    <li className="mb-1">
                                        <strong>Stand on a clear 3×3 tile ground area</strong>.
                                    </li>
                                    <li>
                                        <strong>
                                            Send <code>!drop</code> in chat
                                        </strong>{' '}
                                        — the bot drops all 9 items right at your feet!
                                    </li>
                                </ol>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* BATCH PASTE & PARSE MODAL */}
            {batchPasteModalOpen && (
                <div
                    className="modal fade show d-block"
                    tabIndex={-1}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="batch-paste-modal-title"
                    style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)', zIndex: 1070 }}
                >
                    <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
                        <div className="modal-content rounded-4 border-0 shadow-lg overflow-hidden">
                            <div className="modal-header border-0 bg-dark text-white px-4 py-3 d-flex align-items-center justify-content-between">
                                <div className="d-flex align-items-center gap-2">
                                    <div
                                        className="bg-success rounded-circle d-flex align-items-center justify-content-center text-white"
                                        style={{ width: 34, height: 34 }}
                                        aria-hidden="true"
                                    >
                                        <i className="fa-solid fa-paste small"></i>
                                    </div>
                                    <div>
                                        <h2
                                            className="modal-title h5 fw-black mb-0 ac-font text-white"
                                            id="batch-paste-modal-title"
                                        >
                                            Batch Paste Item Codes
                                        </h2>
                                        <span className="tiny-text opacity-75">
                                            Auto-parse bot commands, hexes, and multipliers
                                        </span>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    className="btn-close btn-close-white"
                                    onClick={() => setBatchPasteModalOpen(false)}
                                    aria-label="Close modal"
                                />
                            </div>

                            <div className="modal-body p-4 bg-light">
                                <div className="mb-3">
                                    <label htmlFor="batch-paste-textarea" className="form-label fw-bold small text-dark">
                                        Paste Command or Hex List:
                                    </label>
                                    <textarea
                                        id="batch-paste-textarea"
                                        className="form-control font-monospace border-2 rounded-3 text-dark shadow-none"
                                        rows={5}
                                        style={{ fontSize: '0.85rem' }}
                                        placeholder={
                                            '!order 1431 3438 0BF1 11F4\nor\n1431x10, 3438x20, Gold Nugget x10'
                                        }
                                        value={batchPasteText}
                                        onChange={(e) => setBatchPasteText(e.target.value)}
                                    />
                                    <div className="form-text tiny-text text-muted">
                                        Supports <code>!order 1431 16DB</code>, hex codes, or names with quantities (
                                        <code>Royal Crown x10</code>).
                                    </div>
                                </div>

                                {/* Preview parsed items */}
                                {parsedBatch.items.length > 0 && (
                                    <div className="card rounded-3 p-3 bg-white border mb-3">
                                        <div className="d-flex align-items-center justify-content-between mb-2">
                                            <span className="small fw-bold text-dark">
                                                Detected {parsedBatch.items.length} Item
                                                {parsedBatch.items.length === 1 ? '' : 's'} (
                                                {parsedBatch.items.reduce((s, it) => s + it.quantity, 0)} total count):
                                            </span>
                                            {parsedBatch.unrecognizedTokens.length > 0 && (
                                                <span className="badge bg-warning text-dark x-small">
                                                    {parsedBatch.unrecognizedTokens.length} unrecognized
                                                </span>
                                            )}
                                        </div>
                                        <div
                                            className="d-flex flex-wrap gap-2"
                                            style={{ maxHeight: '160px', overflowY: 'auto' }}
                                        >
                                            {parsedBatch.items.map((it, idx) => (
                                                <div
                                                    key={`${it.itemId}-${idx}`}
                                                    className="d-flex align-items-center gap-2 p-1 px-2 rounded-3 bg-light border"
                                                >
                                                    {it.image && (
                                                        <img
                                                            src={it.image}
                                                            alt={it.name}
                                                            style={{
                                                                width: '24px',
                                                                height: '24px',
                                                                objectFit: 'contain',
                                                            }}
                                                        />
                                                    )}
                                                    <span
                                                        className="small fw-bold text-dark text-truncate"
                                                        style={{ maxWidth: '120px' }}
                                                    >
                                                        {it.name}
                                                    </span>
                                                    <span className="badge bg-success rounded-pill x-small">
                                                        ×{it.quantity}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="modal-footer bg-white px-3 px-md-4 py-3 border-top d-flex flex-wrap align-items-center justify-content-between gap-2">
                                <button
                                    type="button"
                                    className="btn btn-outline-secondary rounded-pill btn-sm px-3"
                                    onClick={() => setBatchPasteModalOpen(false)}
                                >
                                    Cancel
                                </button>
                                <div className="d-flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        className="btn btn-outline-success rounded-pill btn-sm fw-bold px-3 text-nowrap"
                                        disabled={parsedBatch.items.length === 0}
                                        onClick={() => handleApplyBatchPaste('order', 'append')}
                                    >
                                        Append to Order (+)
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-nook text-white rounded-pill btn-sm fw-bold px-4 shadow-sm text-nowrap"
                                        disabled={parsedBatch.items.length === 0}
                                        onClick={() => handleApplyBatchPaste('order', 'replace')}
                                    >
                                        Replace Order Pocket
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* QUICK ADD ITEM MODAL */}
            {quickAddModalOpen && (
                <QuickAddItemModal
                    isOpen={quickAddModalOpen}
                    onClose={() => setQuickAddModalOpen(false)}
                    catalog={catalogData?.all || []}
                    initialTarget={quickAddTarget}
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
                    orderItems={orderItems}
                    dropItems={dropItems}
                />
            )}

            {/* COMMUNITY LOADOUTS & PRESET BUNDLES MODAL */}
            {bundlesModalOpen && (
                <CommunityLoadoutsModal
                    isOpen={bundlesModalOpen}
                    onClose={() => setBundlesModalOpen(false)}
                    currentOrderPockets={orderItems}
                    currentDropPockets={dropItems}
                    onLoadItems={(items, mode) => {
                        loadBundleIntoOrder(items, mode || 'replace');
                        setBundlesModalOpen(false);
                    }}
                />
            )}

            {/* SHARE POCKETS MODAL */}
            {shareModalOpen && (
                <CommandBuilderShareModal
                    isOpen={shareModalOpen}
                    onClose={() => setShareModalOpen(false)}
                    orderPockets={orderItems}
                    dropPockets={dropItems}
                />
            )}
        </div>
    );
};

export default PocketInventory;
