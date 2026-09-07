import { useEffect, useState, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import type { CatalogEntity } from "../data/commandBuilderData";
import { SmartFillDropdown } from "./command-builder/SmartFillDropdown";
import { ChoPaengDispatchCard } from "./command-builder/ChoPaengDispatchCard";
import { playChimeClick } from "../utils/kkAudioSynthesizer";
import { generateFullItemHex } from "../utils/commandBuilderHex";

type PocketItem = CatalogEntity & {
    baseId?: string | number | null;
    variantId?: string | number | null;
    variantLabel?: string | null;
};

const getItemCommandId = (item: PocketItem) => {
    if (item.entityType === 'villager') {
        return `villager:${item.id}`;
    }
    return generateFullItemHex(item.baseId ?? item.id, item.variantId ?? 'NA', item.category);
};

type CommandBuilderSummaryProps = {
    // Order pockets
    orderPockets: Array<{ item: PocketItem; quantity: number }>;
    // Drop pockets
    dropPockets: Array<{ item: PocketItem; quantity: number }>;
    orderCommandText: string;
    dropCommandText: string;
    copyOrderStatus: string;
    copyDropStatus: string;
    onCopyOrder: () => void;
    onCopyDrop: () => void;
    // Order item controls
    onDecreaseOrderQuantity?: (itemId: string) => void;
    onIncreaseOrderQuantity?: (itemId: string) => void;
    onRemoveOrderItem?: (itemId: string) => void;
    // Drop item controls
    onDecreaseDropQuantity?: (itemId: string) => void;
    onIncreaseDropQuantity?: (itemId: string) => void;
    onRemoveDropItem?: (itemId: string) => void;
    onClearOrderPockets?: () => void;
    onClearDropPockets?: () => void;
    canIncreaseOrder?: boolean;
    canIncreaseDrop?: boolean;
    onFillTickets?: () => void;
    onFillCrowns?: () => void;
    onFillBells?: () => void;
    onMaximizeStacks?: () => void;
    onFillRemaining?: (type: 'nmt' | 'crowns' | 'bells' | 'gold' | 'repeat') => void;
    onSortPockets?: () => void;
    showTerminal?: boolean;
    onOpenBundlesModal?: () => void;
    onOpenShareModal?: () => void;
    onOpenCommunityLoadoutsModal?: () => void;
    onOpenBatchImportModal?: () => void;
    onFlipOrderAndDrop?: () => void;
};

const ORDER_BOT_MAX = 40;
const DROP_BOT_MAX = 9;
const POCKETS_LIST_ID = "command-builder-pockets-list";

export const CommandBuilderSummary = ({
    orderPockets,
    dropPockets,
    orderCommandText,
    dropCommandText,
    copyOrderStatus,
    copyDropStatus,
    onCopyOrder,
    onCopyDrop,
    onDecreaseOrderQuantity,
    onIncreaseOrderQuantity,
    onRemoveOrderItem,
    onDecreaseDropQuantity,
    onIncreaseDropQuantity,
    onRemoveDropItem,
    onClearOrderPockets,
    onClearDropPockets,
    canIncreaseOrder = true,
    canIncreaseDrop = true,
    onFillTickets,
    onFillCrowns,
    onFillBells,
    onMaximizeStacks,
    onFillRemaining,
    onSortPockets,
    onFlipOrderAndDrop,
    showTerminal = true,
    onOpenShareModal,
    onOpenCommunityLoadoutsModal,
    onOpenBatchImportModal,
}: CommandBuilderSummaryProps) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [activeTab, setActiveTab] = useState<'all' | 'order' | 'drop'>('all');

    // Sync pocket filter tabs
    const handleTabChange = (tab: 'all' | 'order' | 'drop') => {
        setActiveTab(tab);
        playChimeClick();
    };
    const [listSearchQuery, setListSearchQuery] = useState('');

    const orderItemsCount = useMemo(
        () => orderPockets.filter((p) => p.item.entityType !== 'villager').reduce((sum, p) => sum + p.quantity, 0),
        [orderPockets]
    );
    const dropItemsCount = useMemo(
        () => dropPockets.filter((p) => p.item.entityType !== 'villager').reduce((sum, p) => sum + p.quantity, 0),
        [dropPockets]
    );

    const orderCount = orderItemsCount;
    const dropCount = dropItemsCount;
    const totalCount = orderCount + dropCount;
    const isEmpty = orderPockets.length === 0 && dropPockets.length === 0;

    const orderFull = orderCount >= ORDER_BOT_MAX;
    const dropFull = dropCount >= DROP_BOT_MAX;
    const remainingOrderSlots = Math.max(0, ORDER_BOT_MAX - orderCount);

    // Capacity percentages
    const orderPercent = Math.min(100, Math.round((orderCount / ORDER_BOT_MAX) * 100));
    const dropPercent = Math.min(100, Math.round((dropCount / DROP_BOT_MAX) * 100));

    // Filtered lists when searching in list view
    const filteredOrderPockets = useMemo(() => {
        if (!listSearchQuery.trim()) return orderPockets;
        const q = listSearchQuery.toLowerCase();
        return orderPockets.filter(p => p.item.name.toLowerCase().includes(q) || (p.item.category && p.item.category.toLowerCase().includes(q)));
    }, [orderPockets, listSearchQuery]);

    const filteredDropPockets = useMemo(() => {
        if (!listSearchQuery.trim()) return dropPockets;
        const q = listSearchQuery.toLowerCase();
        return dropPockets.filter(p => p.item.name.toLowerCase().includes(q) || (p.item.category && p.item.category.toLowerCase().includes(q)));
    }, [dropPockets, listSearchQuery]);

    const [copiedInstruction, setCopiedInstruction] = useState<'order' | 'drop' | null>(null);
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const instructionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const copyToClipboardWithFeedback = (text: string, key: string, instructionType: 'order' | 'drop') => {
        if (!text) return;
        navigator.clipboard.writeText(text).catch(() => { });
        setCopiedKey(key);
        setCopiedInstruction(instructionType);
        playChimeClick();

        // Redirect to Discord channel after brief delay so click registers
        setTimeout(() => {
            if (instructionType === 'order') {
                window.open('https://discord.com/channels/729590421478703135/1175672083183829075', '_blank');
            } else {
                window.open('https://discord.gg/chopaeng', '_blank');
            }
        }, 450);

        setTimeout(() => {
            setCopiedKey((prev) => (prev === key ? null : prev));
        }, 2000);

        if (instructionTimeoutRef.current) clearTimeout(instructionTimeoutRef.current);
        instructionTimeoutRef.current = setTimeout(() => {
            setCopiedInstruction(null);
        }, 8000);
    };

    useEffect(() => {
        return () => {
            if (instructionTimeoutRef.current) clearTimeout(instructionTimeoutRef.current);
        };
    }, []);

    // 1. Unified Order Command: Items FIRST, Villager LAST (!order <itemHexes...> villager:<id>)
    const unifiedOrderCmd = useMemo(() => {
        const regularItems = orderPockets.filter((p) => p.item.entityType !== 'villager');
        const villager = orderPockets.find((p) => p.item.entityType === 'villager');
        const itemsList = regularItems.flatMap((p) => Array(p.quantity).fill(getItemCommandId(p.item)));
        const villagerList = villager ? [`villager:${villager.item.id}`] : [];
        const combined = [...itemsList, ...villagerList];
        return combined.length > 0 ? `!order ${combined.join(' ')}` : '';
    }, [orderPockets]);

    // 2. Copy Drop Item Command (!drop <hexes>)
    const dropItemsOnlyCmd = useMemo(() => {
        const regularItems = dropPockets.filter(p => p.item.entityType !== 'villager');
        if (regularItems.length === 0) return '';
        const list = regularItems.flatMap(p => Array(p.quantity).fill(getItemCommandId(p.item))).slice(0, DROP_BOT_MAX).join(' ');
        return list ? `!drop ${list}` : '';
    }, [dropPockets]);

    // 3. Copy Drop Villager Command (!injectvillager if 1, !mvi if 2+)
    const dropVillagerOnlyCmd = useMemo(() => {
        const villagers = dropPockets.filter(p => p.item.entityType === 'villager');
        if (villagers.length === 0) return '';
        const uniqueNames = Array.from(new Set(villagers.map(p => p.item.name)));
        return uniqueNames.length === 1 ? `!injectvillager ${uniqueNames[0]}` : `!mvi ${uniqueNames.join(' ')}`;
    }, [dropPockets]);

    // Keyboard shortcuts: Ctrl+Shift+O = Copy Order, Ctrl+Shift+D = Copy Drop
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.shiftKey && (e.key === 'O' || e.key === 'o')) {
                e.preventDefault();
                if (orderCommandText) {
                    onCopyOrder();
                    setCopiedInstruction('order');
                }
            }
            if (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
                e.preventDefault();
                if (dropCommandText) {
                    onCopyDrop();
                    setCopiedInstruction('drop');
                }
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [orderCommandText, dropCommandText, onCopyOrder, onCopyDrop]);

    return (
        <div
            className="command-builder-summary rounded-4 border shadow-sm p-3 p-md-4 transition-all"
            style={{
                borderTop: '5px solid var(--nook-green)',
                backgroundColor: 'var(--card-bg, #ffffff)',
                borderColor: 'var(--card-border, #e9ecef)',
            }}
        >
            {/* Screen-reader announcements for copy actions */}
            <div aria-live="polite" className="visually-hidden">
                {[copyOrderStatus, copyDropStatus].filter(Boolean).join(". ")}
            </div>

            {/* ── Top Header ─────────────────────────────────────────── */}
            <div className="d-flex flex-column gap-3 mb-3">
                <div className="d-flex align-items-center justify-content-between">
                    <div className="d-flex align-items-center gap-2">
                        <div
                            className="d-flex align-items-center justify-content-center rounded-circle shadow-sm"
                            style={{
                                width: '40px',
                                height: '40px',
                                background: 'linear-gradient(135deg, #e8f7ec 0%, #c3edd0 100%)',
                                color: 'var(--nook-green)'
                            }}
                        >
                            <i className="fa-solid fa-bag-shopping fs-5"></i>
                        </div>
                        <div>
                            <h2 className="h5 fw-black mb-0 ac-font text-dark" style={{ fontSize: '1.25rem', letterSpacing: '0.3px' }}>
                                Pocket Summary
                            </h2>
                            <p className="tiny-text text-muted mb-0 font-monospace">
                                {totalCount} {totalCount === 1 ? 'item' : 'items'} queued ({orderCount} order · {dropCount} drop)
                            </p>
                        </div>
                    </div>

                    <div className="d-flex align-items-center gap-1">
                        <Link
                            to="/pockets"
                            className="btn btn-sm btn-white border rounded-pill fw-bold text-dark px-2 px-sm-3 py-1 transition-all shadow-2xs d-flex align-items-center gap-1"
                            title="Open Full-Screen 40-Slot Pocket Inventory Grid"
                            style={{ fontSize: '0.78rem' }}
                        >
                            <i className="fa-solid fa-up-right-and-down-left-from-center text-success x-small"></i>
                            <span className="d-none d-sm-inline">Full Grid</span>
                        </Link>

                        <button
                            type="button"
                            className="btn btn-sm btn-light border rounded-pill fw-bold px-2 px-sm-3 py-1 text-muted transition-all shadow-none"
                            onClick={() => {
                                setIsCollapsed((v) => !v);
                                playChimeClick();
                            }}
                            aria-expanded={!isCollapsed}
                            aria-controls={POCKETS_LIST_ID}
                            title={isCollapsed ? "Expand Pocket Summary" : "Collapse Pocket Summary"}
                            style={{ fontSize: '0.78rem' }}
                        >
                            <i className={`fa-solid ${isCollapsed ? 'fa-chevron-down' : 'fa-chevron-up'} me-1`}></i>
                            <span>{isCollapsed ? 'Show' : 'Hide'}</span>
                        </button>
                    </div>
                </div>

                {/* Capacity Progress Meters */}
                <div className="row g-2">
                    {/* Order Capacity Meter */}
                    <div className="col-6">
                        <div
                            className="p-2 rounded-3 border transition-all"
                            style={{
                                backgroundColor: orderFull ? 'rgba(220, 53, 69, 0.08)' : 'var(--subtle-bg, #f4fbf6)',
                                borderColor: orderFull ? '#f5c6cb' : 'var(--card-border, #d2f0dd)'
                            }}
                        >
                            <div className="d-flex justify-content-between align-items-center mb-1">
                                <span className="tiny-text fw-bold text-uppercase tracking-wider" style={{ color: orderFull ? '#dc3545' : 'var(--nook-green)' }}>
                                    <i className="fa-solid fa-cart-flatbed me-1"></i>Order Bot
                                </span>
                                <span className={`badge rounded-pill ${orderFull ? 'bg-danger' : 'bg-success'} text-white x-small px-2 py-0`}>
                                    {orderCount}/{ORDER_BOT_MAX}
                                </span>
                            </div>
                            <div className="progress" style={{ height: '6px', backgroundColor: '#e9ecef', borderRadius: '10px' }}>
                                <div
                                    className={`progress-bar transition-all ${orderFull ? 'bg-danger' : orderPercent > 75 ? 'bg-warning' : 'bg-success'}`}
                                    role="progressbar"
                                    style={{ width: `${orderPercent}%`, borderRadius: '10px' }}
                                    aria-valuenow={orderCount}
                                    aria-valuemin={0}
                                    aria-valuemax={ORDER_BOT_MAX}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Drop Capacity Meter */}
                    <div className="col-6">
                        <div
                            className="p-2 rounded-3 border transition-all"
                            style={{
                                backgroundColor: dropFull ? 'rgba(220, 53, 69, 0.08)' : dropCount > 0 ? 'rgba(23, 162, 184, 0.08)' : 'var(--subtle-bg, #f8f9fa)',
                                borderColor: dropFull ? '#f5c6cb' : 'var(--card-border, #e9ecef)'
                            }}
                        >
                            <div className="d-flex justify-content-between align-items-center mb-1">
                                <span className="tiny-text fw-bold text-uppercase tracking-wider" style={{ color: dropFull ? '#dc3545' : '#17a2b8' }}>
                                    <i className="fa-solid fa-layer-group me-1"></i>Drop Radius
                                </span>
                                <span className={`badge rounded-pill ${dropFull ? 'bg-danger' : dropCount > 0 ? 'bg-info text-dark' : 'bg-secondary'} text-white x-small px-2 py-0`}>
                                    {dropCount}/{DROP_BOT_MAX}
                                </span>
                            </div>
                            <div className="progress" style={{ height: '6px', backgroundColor: '#e9ecef', borderRadius: '10px' }}>
                                <div
                                    className={`progress-bar transition-all ${dropFull ? 'bg-danger' : 'bg-info'}`}
                                    role="progressbar"
                                    style={{ width: `${dropPercent}%`, borderRadius: '10px' }}
                                    aria-valuenow={dropCount}
                                    aria-valuemin={0}
                                    aria-valuemax={DROP_BOT_MAX}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Quick Action Toolbar (Bundles, Smart Tools, Batch Import & Share) ─────────────────────────── */}
            <div className="d-flex flex-wrap gap-2 mb-3 min-w-0">
                {onOpenCommunityLoadoutsModal && (
                    <button
                        type="button"
                        onClick={() => {
                            onOpenCommunityLoadoutsModal();
                            playChimeClick();
                        }}
                        className="btn btn-sm text-white rounded-pill fw-bold px-3 py-2 shadow-sm flex-grow-1 transition-all d-flex align-items-center justify-content-center gap-2 text-nowrap"
                        title="Browse Community Loadouts & Official Bundles"
                        style={{
                            background: 'linear-gradient(135deg, #37b06d 0%, #2ea466 100%)',
                            border: 'none',
                            fontSize: '0.8rem',
                            minHeight: '34px',
                        }}
                    >
                        <i className="fa-solid fa-box-open text-warning"></i>
                        <span>Loadouts & Bundles</span>
                    </button>
                )}

                {onOpenBatchImportModal && (
                    <button
                        type="button"
                        onClick={() => {
                            onOpenBatchImportModal();
                            playChimeClick();
                        }}
                        className="btn btn-sm btn-white border rounded-pill fw-bold px-3 py-2 shadow-2xs transition-all d-flex align-items-center justify-content-center gap-2"
                        title="Batch import raw hex codes, $order commands, or item lists"
                        style={{
                            borderColor: '#cbd5e1',
                            fontSize: '0.8rem',
                            minHeight: '34px',
                        }}
                    >
                        <i className="fa-solid fa-file-import text-success"></i>
                        <span>Batch Import</span>
                    </button>
                )}

                {/* Smart Fill & Optimization Dropdown */}
                {onFillRemaining && onMaximizeStacks && onSortPockets && (
                    <SmartFillDropdown
                        onFillNmt={() => { onFillRemaining('nmt'); playChimeClick(); }}
                        onFillCrowns={() => { onFillRemaining('crowns'); playChimeClick(); }}
                        onFillBells={() => { onFillRemaining('bells'); playChimeClick(); }}
                        onFillGold={() => { onFillRemaining('gold'); playChimeClick(); }}
                        onFillRepeat={() => { onFillRemaining('repeat'); playChimeClick(); }}
                        onMaximizeStacks={() => { onMaximizeStacks(); playChimeClick(); }}
                        onSortPockets={() => { onSortPockets(); playChimeClick(); }}
                        isOrderFull={orderFull}
                        hasItems={orderPockets.length > 0}
                    />
                )}

                {onFlipOrderAndDrop && (
                    <button
                        type="button"
                        onClick={() => {
                            onFlipOrderAndDrop();
                            playChimeClick();
                        }}
                        className="btn btn-sm btn-white border rounded-pill fw-bold px-3 py-2 shadow-2xs transition-all d-flex align-items-center justify-content-center gap-2"
                        title="Swap or convert items between Order (40 slots) and Drop (9 radius spots)"
                        disabled={isEmpty}
                        style={{
                            borderColor: isEmpty ? '#e9ecef' : '#cbd5e1',
                            fontSize: '0.8rem',
                        }}
                    >
                        <i className="fa-solid fa-right-left text-info"></i>
                        <span className="d-none d-md-inline">Flip Order ⇄ Drop</span>
                        <span className="d-inline d-md-none">Flip</span>
                    </button>
                )}

                {onOpenShareModal && (
                    <button
                        type="button"
                        onClick={() => {
                            onOpenShareModal();
                            playChimeClick();
                        }}
                        className="btn btn-sm btn-white border rounded-pill fw-bold px-3 py-2 shadow-2xs transition-all d-flex align-items-center justify-content-center gap-2"
                        title="Generate shareable link for this exact pocket"
                        disabled={isEmpty}
                        style={{
                            borderColor: isEmpty ? '#e9ecef' : '#bfe3f0',
                            backgroundColor: isEmpty ? '#f8f9fa' : '#ffffff',
                            fontSize: '0.8rem',
                        }}
                    >
                        <i className="fa-solid fa-share-nodes text-primary"></i>
                        <span className="d-none d-sm-inline">Share</span>
                    </button>
                )}
            </div>

            {!isCollapsed && (
                <div id={POCKETS_LIST_ID}>
                    {/* Empty State */}
                    {isEmpty ? (
                        <div
                            className="text-center py-4 px-3 rounded-4 mb-3"
                            style={{
                                backgroundColor: 'var(--subtle-bg, #fbfcf9)',
                                border: '2px dashed var(--card-border, #d5e8db)'
                            }}
                        >
                            <div
                                className="d-inline-flex align-items-center justify-content-center rounded-circle mb-2"
                                style={{ width: '48px', height: '48px', backgroundColor: '#eef8f2', color: 'var(--nook-green)' }}
                            >
                                <i className="fa-solid fa-leaf fs-4" style={{ opacity: 0.6 }}></i>
                            </div>
                            <h6 className="fw-bold text-dark mb-1">Your pockets are empty</h6>
                            <p className="small text-muted mb-0" style={{ maxWidth: '280px', margin: '0 auto' }}>
                                Click any item card from the catalog or paste bot codes to start building your order.
                            </p>
                        </div>
                    ) : (
                        /* Compact / Detailed List View */
                        <div className="d-flex flex-column gap-3 mb-3">
                            {/* Filter & Subtabs in List View */}
                            <div className="d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-2">
                                <div className="d-flex p-1 bg-light rounded-pill border flex-grow-1">
                                    <button
                                        type="button"
                                        onClick={() => handleTabChange('all')}
                                        className={`btn btn-sm rounded-pill flex-grow-1 py-1 fw-bold transition-all ${activeTab === 'all' ? 'btn-white text-dark shadow-sm' : 'text-muted border-0'}`}
                                        style={{ fontSize: '0.75rem' }}
                                    >
                                        All ({totalCount})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleTabChange('order')}
                                        className={`btn btn-sm rounded-pill flex-grow-1 py-1 fw-bold transition-all ${activeTab === 'order' ? 'btn-white text-dark shadow-sm' : 'text-muted border-0'}`}
                                        style={{ fontSize: '0.75rem' }}
                                    >
                                        Order ({orderCount}/40)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleTabChange('drop')}
                                        className={`btn btn-sm rounded-pill flex-grow-1 py-1 fw-bold transition-all ${activeTab === 'drop' ? 'btn-white text-dark shadow-sm' : 'text-muted border-0'}`}
                                        style={{ fontSize: '0.75rem' }}
                                    >
                                        Drop ({dropCount}/9)
                                    </button>
                                </div>

                                {totalCount > 4 && (
                                    <div className="position-relative" style={{ minWidth: '130px' }}>
                                        <input
                                            type="text"
                                            className="form-control form-control-sm rounded-pill ps-3 pe-4"
                                            placeholder="Filter..."
                                            value={listSearchQuery}
                                            onChange={(e) => setListSearchQuery(e.target.value)}
                                            style={{ fontSize: '0.75rem' }}
                                        />
                                        {listSearchQuery && (
                                            <button
                                                type="button"
                                                className="btn btn-link text-muted position-absolute end-0 top-50 translate-middle-y p-0 pe-2 border-0"
                                                onClick={() => setListSearchQuery('')}
                                            >
                                                <i className="fa-solid fa-xmark x-small"></i>
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* ── Order List Section ────────────────────────────────── */}
                            {(activeTab === 'all' || activeTab === 'order') && (
                                <div className="p-3 rounded-4 bg-light border">
                                    <div className="d-flex align-items-center justify-content-between mb-2">
                                        <div className="d-flex align-items-center gap-2">
                                            <span className="badge bg-success text-white rounded-pill fw-bold x-small px-2 py-1 shadow-sm">
                                                <i className="fa-solid fa-bag-shopping me-1"></i>Order Bot
                                            </span>
                                            <span className="tiny-text text-muted font-monospace">
                                                {orderCount} / {ORDER_BOT_MAX} slots
                                            </span>
                                        </div>
                                        {onClearOrderPockets && orderPockets.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={onClearOrderPockets}
                                                className="btn btn-sm btn-outline-danger rounded-pill transition-all fw-bold py-0 px-2"
                                                style={{ fontSize: '0.7rem' }}
                                                title="Clear all order items"
                                            >
                                                <i className="fa-solid fa-trash-can me-1"></i>Clear
                                            </button>
                                        )}
                                    </div>

                                    {filteredOrderPockets.length === 0 ? (
                                        <div className="text-center py-2 text-muted x-small bg-white rounded-3 border">
                                            {orderPockets.length === 0 ? 'No order items added yet' : 'No matching items'}
                                        </div>
                                    ) : (
                                        <div className="d-flex flex-column gap-1 overflow-auto" style={{ maxHeight: '280px', paddingRight: '2px' }}>
                                            {filteredOrderPockets.map((pocket) => (
                                                <div
                                                    key={pocket.item.id}
                                                    className="d-flex align-items-center gap-2 p-2 rounded-3 bg-white border shadow-2xs transition-all hover-shadow-sm"
                                                >
                                                    <div
                                                        className="ratio ratio-1x1 bg-light rounded-2 border d-flex align-items-center justify-content-center"
                                                        style={{ width: '38px', minWidth: '38px', overflow: 'hidden' }}
                                                    >
                                                        <img
                                                            src={pocket.item.image}
                                                            alt={pocket.item.name}
                                                            className="w-100 h-100 object-fit-contain p-1"
                                                            loading="lazy"
                                                            onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                                                        />
                                                    </div>
                                                    <div className="flex-grow-1 text-truncate">
                                                        <strong className="d-block text-dark small text-truncate" title={pocket.item.name}>
                                                            {pocket.item.name}
                                                        </strong>
                                                        <div className="d-flex align-items-center gap-1 flex-wrap">
                                                            <span className="badge bg-light text-secondary border x-small py-0 px-1 font-monospace">
                                                                {pocket.item.category}
                                                            </span>
                                                            {pocket.item.variantLabel && (
                                                                <span className="badge bg-warning-subtle text-warning-emphasis border x-small py-0 px-1 text-truncate" style={{ maxWidth: '100px' }}>
                                                                    {pocket.item.variantLabel}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="d-flex align-items-center gap-1 flex-nowrap">
                                                        {pocket.item.entityType !== 'villager' && (
                                                            <div className="d-flex align-items-center bg-light rounded-pill border p-1">
                                                                {onDecreaseOrderQuantity && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            onDecreaseOrderQuantity(pocket.item.id);
                                                                            playChimeClick();
                                                                        }}
                                                                        className="btn btn-sm btn-white rounded-circle shadow-none p-0 d-flex align-items-center justify-content-center"
                                                                        style={{ width: '22px', height: '22px', border: '1px solid #dee2e6' }}
                                                                        title={pocket.quantity === 1 ? "Remove from order" : "Decrease quantity"}
                                                                        aria-label={`Decrease quantity of ${pocket.item.name}`}
                                                                    >
                                                                        <i className={`fa-solid ${pocket.quantity === 1 ? 'fa-trash-can' : 'fa-minus'} x-small ${pocket.quantity === 1 ? 'text-danger' : 'text-muted'}`}></i>
                                                                    </button>
                                                                )}
                                                                <span className="x-small px-2 fw-bold text-dark font-monospace">
                                                                    {pocket.quantity}
                                                                </span>
                                                                {onIncreaseOrderQuantity && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            onIncreaseOrderQuantity(pocket.item.id);
                                                                            playChimeClick();
                                                                        }}
                                                                        className="btn btn-sm btn-white rounded-circle shadow-none p-0 d-flex align-items-center justify-content-center"
                                                                        style={{ width: '22px', height: '22px', border: '1px solid #dee2e6' }}
                                                                        disabled={!canIncreaseOrder}
                                                                        title={!canIncreaseOrder ? `Order bot full (${ORDER_BOT_MAX}/${ORDER_BOT_MAX})` : 'Increase quantity'}
                                                                        aria-label={`Increase quantity of ${pocket.item.name}`}
                                                                    >
                                                                        <i className="fa-solid fa-plus x-small text-muted"></i>
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                        {onRemoveOrderItem && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    onRemoveOrderItem(pocket.item.id);
                                                                    playChimeClick();
                                                                }}
                                                                className="btn btn-sm btn-light text-danger rounded-circle p-0 d-flex align-items-center justify-content-center ms-1 transition-all"
                                                                style={{ width: '26px', height: '26px' }}
                                                                title="Remove item"
                                                                aria-label={`Remove ${pocket.item.name} from order`}
                                                            >
                                                                <i className="fa-solid fa-trash-can x-small"></i>
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Quick Fill Buttons for Order */}
                                    {canIncreaseOrder && (onFillTickets || onFillCrowns || onFillBells) && (
                                        <div className="mt-2 pt-2 border-top">
                                            <div className="d-flex justify-content-between align-items-center mb-1">
                                                <span className="tiny-text fw-bold text-muted text-uppercase tracking-wider d-inline-flex align-items-center">
                                                    <i className="fa-solid fa-bolt text-warning me-1" aria-hidden="true" />
                                                    <span>Fill remaining ({remainingOrderSlots} slots)</span>
                                                </span>
                                            </div>
                                            <div className="d-flex gap-1">
                                                {onFillTickets && (
                                                    <button
                                                        type="button"
                                                        onClick={() => { onFillTickets(); playChimeClick(); }}
                                                        className="btn btn-sm btn-white border rounded-pill shadow-2xs fw-bold flex-grow-1 py-1 transition-all d-flex align-items-center justify-content-center gap-1"
                                                        title="Fill remaining slots with Nook Miles Tickets"
                                                        style={{ fontSize: '0.75rem' }}
                                                    >
                                                        <i className="fa-solid fa-ticket text-primary"></i>
                                                        <span>Tickets</span>
                                                    </button>
                                                )}
                                                {onFillCrowns && (
                                                    <button
                                                        type="button"
                                                        onClick={() => { onFillCrowns(); playChimeClick(); }}
                                                        className="btn btn-sm btn-white border rounded-pill shadow-2xs fw-bold flex-grow-1 py-1 transition-all d-flex align-items-center justify-content-center gap-1"
                                                        title="Fill remaining slots with Royal Crowns"
                                                        style={{ fontSize: '0.75rem' }}
                                                    >
                                                        <i className="fa-solid fa-crown text-warning"></i>
                                                        <span>Crowns</span>
                                                    </button>
                                                )}
                                                {onFillBells && (
                                                    <button
                                                        type="button"
                                                        onClick={() => { onFillBells(); playChimeClick(); }}
                                                        className="btn btn-sm btn-white border rounded-pill shadow-2xs fw-bold flex-grow-1 py-1 transition-all d-flex align-items-center justify-content-center gap-1"
                                                        title="Fill remaining slots with 99,000 Bells"
                                                        style={{ fontSize: '0.75rem' }}
                                                    >
                                                        <i className="fa-solid fa-sack-dollar text-success"></i>
                                                        <span>Bells</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── Drop List Section ─────────────────────────────────── */}
                            {(activeTab === 'all' || activeTab === 'drop') && (
                                <div className="p-3 rounded-4 bg-light border">
                                    <div className="d-flex align-items-center justify-content-between mb-2">
                                        <div className="d-flex align-items-center gap-2">
                                            <span className="badge bg-info text-dark rounded-pill fw-bold x-small px-2 py-1 shadow-sm">
                                                <i className="fa-solid fa-layer-group me-1"></i>Drop Bot
                                            </span>
                                            <span className="tiny-text text-muted font-monospace">
                                                {dropCount} / {DROP_BOT_MAX} slots
                                            </span>
                                        </div>
                                        {onClearDropPockets && dropPockets.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={onClearDropPockets}
                                                className="btn btn-sm btn-outline-danger rounded-pill transition-all fw-bold py-0 px-2"
                                                style={{ fontSize: '0.7rem' }}
                                                title="Clear all drop items"
                                            >
                                                <i className="fa-solid fa-trash-can me-1"></i>Clear
                                            </button>
                                        )}
                                    </div>

                                    {filteredDropPockets.length === 0 ? (
                                        <div className="text-center py-2 text-muted x-small bg-white rounded-3 border">
                                            {dropPockets.length === 0 ? 'No drop items added yet' : 'No matching items'}
                                        </div>
                                    ) : (
                                        <div className="d-flex flex-column gap-1 overflow-auto" style={{ maxHeight: '200px', paddingRight: '2px' }}>
                                            {filteredDropPockets.map((pocket) => (
                                                <div
                                                    key={pocket.item.id}
                                                    className="d-flex align-items-center gap-2 p-2 rounded-3 bg-white border shadow-2xs transition-all hover-shadow-sm"
                                                >
                                                    <div
                                                        className="ratio ratio-1x1 bg-light rounded-2 border d-flex align-items-center justify-content-center"
                                                        style={{ width: '38px', minWidth: '38px', overflow: 'hidden' }}
                                                    >
                                                        <img
                                                            src={pocket.item.image}
                                                            alt={pocket.item.name}
                                                            className="w-100 h-100 object-fit-contain p-1"
                                                            loading="lazy"
                                                            onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                                                        />
                                                    </div>
                                                    <div className="flex-grow-1 text-truncate">
                                                        <strong className="d-block text-dark small text-truncate" title={pocket.item.name}>
                                                            {pocket.item.name}
                                                        </strong>
                                                        <div className="d-flex align-items-center gap-1 flex-wrap">
                                                            <span className="badge bg-light text-secondary border x-small py-0 px-1 font-monospace">
                                                                {pocket.item.category}
                                                            </span>
                                                            {pocket.item.variantLabel && (
                                                                <span className="badge bg-warning-subtle text-warning-emphasis border x-small py-0 px-1 text-truncate" style={{ maxWidth: '100px' }}>
                                                                    {pocket.item.variantLabel}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="d-flex align-items-center gap-1 flex-nowrap">
                                                        {pocket.item.entityType !== 'villager' && (
                                                            <div className="d-flex align-items-center bg-light rounded-pill border p-1">
                                                                {onDecreaseDropQuantity && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            onDecreaseDropQuantity(pocket.item.id);
                                                                            playChimeClick();
                                                                        }}
                                                                        className="btn btn-sm btn-white rounded-circle shadow-none p-0 d-flex align-items-center justify-content-center"
                                                                        style={{ width: '22px', height: '22px', border: '1px solid #dee2e6' }}
                                                                        title={pocket.quantity === 1 ? "Remove from drop" : "Decrease quantity"}
                                                                        aria-label={`Decrease quantity of ${pocket.item.name}`}
                                                                    >
                                                                        <i className={`fa-solid ${pocket.quantity === 1 ? 'fa-trash-can' : 'fa-minus'} x-small ${pocket.quantity === 1 ? 'text-danger' : 'text-muted'}`}></i>
                                                                    </button>
                                                                )}
                                                                <span className="x-small px-2 fw-bold text-dark font-monospace">
                                                                    {pocket.quantity}
                                                                </span>
                                                                {onIncreaseDropQuantity && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            onIncreaseDropQuantity(pocket.item.id);
                                                                            playChimeClick();
                                                                        }}
                                                                        className="btn btn-sm btn-white rounded-circle shadow-none p-0 d-flex align-items-center justify-content-center"
                                                                        style={{ width: '22px', height: '22px', border: '1px solid #dee2e6' }}
                                                                        disabled={!canIncreaseDrop}
                                                                        title={!canIncreaseDrop ? `Drop bot full (${DROP_BOT_MAX}/${DROP_BOT_MAX})` : 'Increase quantity'}
                                                                        aria-label={`Increase quantity of ${pocket.item.name}`}
                                                                    >
                                                                        <i className="fa-solid fa-plus x-small text-muted"></i>
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                        {onRemoveDropItem && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    onRemoveDropItem(pocket.item.id);
                                                                    playChimeClick();
                                                                }}
                                                                className="btn btn-sm btn-light text-danger rounded-circle p-0 d-flex align-items-center justify-content-center ms-1 transition-all"
                                                                style={{ width: '26px', height: '26px' }}
                                                                title="Remove item"
                                                                aria-label={`Remove ${pocket.item.name} from drop`}
                                                            >
                                                                <i className="fa-solid fa-trash-can x-small"></i>
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Bot Delivery & Commands ───────────────────────────────── */}
                    {showTerminal && (
                        <ChoPaengDispatchCard
                            orderPockets={orderPockets}
                            dropPockets={dropPockets}
                            unifiedOrderCmd={unifiedOrderCmd}
                            dropItemsOnlyCmd={dropItemsOnlyCmd}
                            dropVillagerOnlyCmd={dropVillagerOnlyCmd}
                            orderCount={orderCount}
                            dropCount={dropCount}
                            copiedKey={copiedKey}
                            onCopyCommand={copyToClipboardWithFeedback}
                            onFillRemaining={onFillRemaining}
                            onClearOrderPockets={onClearOrderPockets}
                            onClearDropPockets={onClearDropPockets}
                            onSortPockets={onSortPockets}
                            onFlipOrderAndDrop={onFlipOrderAndDrop}
                            onOpenShareModal={onOpenShareModal}
                            onOpenBatchImportModal={onOpenBatchImportModal}
                        />
                    )}

                    {/* Floating Bot Delivery Flow Notification Pop-up Toast */}
                    {copiedInstruction && (
                        <div
                            className="position-fixed"
                            style={{
                                bottom: '24px',
                                right: '24px',
                                zIndex: 1090,
                                maxWidth: '420px',
                                width: 'calc(100vw - 48px)',
                            }}
                        >
                            <div
                                className="card border-0 rounded-4 shadow-lg p-3 position-relative overflow-hidden animate-pop-in"
                                style={{
                                    backgroundColor: '#ffffff',
                                    borderLeft: `5px solid ${copiedInstruction === 'order' ? '#198754' : '#0284c7'}`,
                                    boxShadow: '0 20px 45px -10px rgba(0, 0, 0, 0.28), 0 0 0 1px rgba(0, 0, 0, 0.08)',
                                }}
                                role="alert"
                                aria-live="polite"
                            >
                                <div className="d-flex align-items-center justify-content-between mb-2">
                                    <div className="d-flex align-items-center gap-2">
                                        <div
                                            className="rounded-circle d-flex align-items-center justify-content-center text-white flex-shrink-0"
                                            style={{
                                                width: '30px',
                                                height: '30px',
                                                backgroundColor: copiedInstruction === 'order' ? '#198754' : '#0284c7',
                                                fontSize: '0.85rem'
                                            }}
                                        >
                                            <i className={`fa-solid ${copiedInstruction === 'order' ? 'fa-box' : 'fa-plane-arrival'}`}></i>
                                        </div>
                                        <div>
                                            <strong className="text-dark small fw-black text-uppercase tracking-wider d-block">
                                                Bot Delivery Instructions
                                            </strong>
                                            <span className="tiny-text text-success fw-bold">
                                                <i className="fa-solid fa-check me-1"></i>Command copied to clipboard!
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        className="btn-close btn-sm"
                                        onClick={() => setCopiedInstruction(null)}
                                        aria-label="Close notification"
                                        title="Dismiss"
                                    />
                                </div>

                                {copiedInstruction === 'order' ? (
                                    <div className="p-2 rounded-3 bg-light border border-success-subtle mt-1">
                                        <div className="d-flex align-items-center gap-2 mb-1">
                                            <span className="badge bg-success text-white rounded-pill px-2 py-0 font-monospace">Order Bot</span>
                                            <strong className="text-dark small fw-bold">Discord Delivery Flow:</strong>
                                        </div>
                                        <p className="small text-muted mb-0" style={{ fontSize: '0.78rem', lineHeight: 1.45 }}>
                                            Paste <code>!order</code> in the Discord <strong>#order-bot</strong> channel. The bot will DM you a private <strong>Dodo Code</strong>. Empty your inventory and fly over to pick up your items!
                                        </p>
                                    </div>
                                ) : (
                                    <div className="p-2 rounded-3 bg-light border border-info-subtle mt-1">
                                        <div className="d-flex align-items-center gap-2 mb-1">
                                            <span className="badge text-white rounded-pill px-2 py-0 font-monospace" style={{ backgroundColor: '#0284c7' }}>Drop Bot</span>
                                            <strong className="text-dark small fw-bold">In-Game Ground Drop:</strong>
                                        </div>
                                        <p className="small text-muted mb-0" style={{ fontSize: '0.78rem', lineHeight: 1.45 }}>
                                            Fly to an active treasure island, stand on an open 3×3 ground space, and send your command in in-game chat or Discord — ChoBot will drop everything right at your feet!
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default CommandBuilderSummary;