import React, { useState, useEffect, useMemo } from 'react';
import type { CatalogEntity } from '../../data/commandBuilderData';
import type { PocketItem } from '../../hooks/useCommandBuilderPockets';
import { getVariantCommandParts, getVariantKey, getVariantLabel, type ItemVariant } from '../../utils/commandBuilderHex';
import { playChimeClick } from '../../utils/kkAudioSynthesizer';

const FALLBACK_IMAGE = "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23f1f3f5'/%3E%3Cpath d='M30 65 L45 45 L58 58 L68 42 L75 65 Z' fill='%23ced4da'/%3E%3Ccircle cx='38' cy='35' r='7' fill='%23ced4da'/%3E%3C/svg%3E";

const getAcnhcdnUrl = (url: string | undefined): string => {
    if (!url) return FALLBACK_IMAGE;
    return url;
};

interface CommandBuilderVariantModalProps {
    item: (CatalogEntity & Partial<PocketItem>) | null;
    isOpen: boolean;
    onClose: () => void;
    onOpenFullDetail: (item: CatalogEntity, variantKey?: string) => void;
    addItemToOrderPockets?: (item: PocketItem) => { success: boolean; message: string };
    addItemToDropPockets: (item: PocketItem) => { success: boolean; message: string };
    decreaseOrderQuantity?: (id: string) => void;
    increaseOrderQuantity?: (id: string) => void;
    decreaseDropQuantity: (id: string) => void;
    increaseDropQuantity: (id: string) => void;
    totalOrderCount?: number;
    totalDropCount?: number;
    canIncreaseOrder?: boolean;
    canIncreaseDrop?: boolean;
    getOrderPocketQuantity?: (id: string) => number;
    getDropPocketQuantity?: (id: string) => number;
    isFavorite?: boolean;
    onToggleFavorite?: (id: string, e: React.MouseEvent) => void;
    showOrder?: boolean;
    showDrop?: boolean;
    mode?: 'both' | 'order-only' | 'drop-only';
}

export const CommandBuilderVariantModal: React.FC<CommandBuilderVariantModalProps> = ({
    item,
    isOpen,
    onClose,
    onOpenFullDetail,
    addItemToOrderPockets,
    addItemToDropPockets,
    decreaseOrderQuantity,
    increaseOrderQuantity,
    decreaseDropQuantity,
    increaseDropQuantity,
    totalOrderCount = 0,
    totalDropCount = 0,
    canIncreaseOrder = true,
    canIncreaseDrop = true,
    getOrderPocketQuantity,
    getDropPocketQuantity,
    isFavorite = false,
    onToggleFavorite,
    showOrder = true,
    showDrop = true,
    mode = 'both',
}) => {
    const [selectedVariantKey, setSelectedVariantKey] = useState<string | null>(null);
    const [statusMessage, setStatusMessage] = useState<string>('');

    const effectiveShowOrder = showOrder && mode !== 'drop-only' && !!addItemToOrderPockets;
    const effectiveShowDrop = showDrop && mode !== 'order-only';

    // Reset selected variant when opened with a new item
    useEffect(() => {
        if (!isOpen || !item) {
            setSelectedVariantKey(null);
            setStatusMessage('');
            return;
        }

        const variants = item.variations || [];
        if (variants.length > 0) {
            setSelectedVariantKey(getVariantKey(variants[0]));
        } else {
            setSelectedVariantKey(null);
        }
    }, [isOpen, item]);

    // Close on Escape key
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    const variations = useMemo(() => item?.variations || [], [item]);

    const selectedVariant = useMemo<ItemVariant | null>(() => {
        if (!variations.length) return null;
        return variations.find((v) => getVariantKey(v) === selectedVariantKey) || variations[0] || null;
    }, [variations, selectedVariantKey]);

    if (!isOpen || !item) return null;

    const variantLabel = getVariantLabel(selectedVariant);
    const selectedVariantParts = getVariantCommandParts(item.id, selectedVariant);
    const activeImage = getAcnhcdnUrl(selectedVariant?.imageUrl || item.image);

    const pocketItemId = selectedVariantKey ? `${item.id}:${selectedVariantKey}` : item.id;
    const currentOrderQty = (effectiveShowOrder && getOrderPocketQuantity) ? getOrderPocketQuantity(pocketItemId) : 0;
    const currentDropQty = getDropPocketQuantity ? getDropPocketQuantity(pocketItemId) : 0;

    const buildPocketItem = (): PocketItem => {
        return {
            ...item,
            id: pocketItemId,
            baseId: selectedVariantParts.baseId,
            variantId: selectedVariantParts.variantId,
            variantLabel,
            image: activeImage,
        };
    };

    const handleAddOrder = () => {
        if (!addItemToOrderPockets) return;
        const pocketItem = buildPocketItem();
        const res = addItemToOrderPockets(pocketItem);
        setStatusMessage(res.message);
        setTimeout(() => setStatusMessage(''), 2500);
    };

    const handleAddDrop = () => {
        const pocketItem = buildPocketItem();
        const res = addItemToDropPockets(pocketItem);
        setStatusMessage(res.message);
        setTimeout(() => setStatusMessage(''), 2500);
    };

    return (
        <div
            className="modal-overlay d-flex align-items-center justify-content-center p-3"
            onClick={onClose}
            style={{ zIndex: 1060, backgroundColor: 'rgba(0, 0, 0, 0.45)' }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="variant-modal-title"
        >
            <div
                className="modal-content-card bg-white rounded-5 shadow-2xl overflow-hidden border-0 position-relative w-100 animate-up"
                style={{ maxWidth: '640px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-3 px-4 border-bottom d-flex align-items-center justify-content-between bg-light">
                    <div className="d-flex align-items-center gap-2">
                        {onToggleFavorite && (
                            <button
                                type="button"
                                onClick={(e) => onToggleFavorite(item.id, e)}
                                className={`btn btn-sm rounded-circle d-flex align-items-center justify-content-center p-0 transition-all ${
                                    isFavorite ? 'btn-warning text-white shadow-sm' : 'btn-white bg-white text-muted border shadow-2xs'
                                }`}
                                style={{ width: '32px', height: '32px' }}
                                title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                            >
                                <i className={`fa-${isFavorite ? 'solid' : 'regular'} fa-star small`}></i>
                            </button>
                        )}
                        <div>
                            <h2 id="variant-modal-title" className="h5 fw-black mb-0 text-dark">
                                {item.name}
                            </h2>
                            <span className="badge bg-white text-muted border rounded-pill x-small fw-bold">
                                {item.category} · {variations.length} Variations
                            </span>
                        </div>
                    </div>

                    <div className="d-flex align-items-center gap-2">
                        <button
                            type="button"
                            className="btn btn-sm btn-outline-dark rounded-pill px-3 py-1 fw-bold"
                            onClick={() => onOpenFullDetail(item, selectedVariantKey || undefined)}
                            title="Open full item catalog page"
                        >
                            <i className="fa-solid fa-up-right-from-square me-1"></i>
                            <span>Details</span>
                        </button>
                        <button
                            type="button"
                            className="btn-close"
                            onClick={onClose}
                            aria-label="Close modal"
                        ></button>
                    </div>
                </div>

                {/* Body Content */}
                <div className="p-4 overflow-y-auto flex-grow-1" style={{ backgroundColor: '#fffdfa' }}>
                    {/* Active Selected Variation Preview Card */}
                    <div className="card rounded-4 border p-3 mb-4 shadow-xs bg-white">
                        <div className="row g-3 align-items-center">
                            <div className="col-auto">
                                <div
                                    className="ratio ratio-1x1 bg-light rounded-4 overflow-hidden border d-flex align-items-center justify-content-center"
                                    style={{ width: '84px', height: '84px' }}
                                >
                                    <img
                                        src={activeImage}
                                        alt={variantLabel || item.name}
                                        className="w-100 h-100 object-fit-contain p-2"
                                        onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = FALLBACK_IMAGE; }}
                                    />
                                </div>
                            </div>
                            <div className="col">
                                <div className="d-flex align-items-center gap-2 mb-1">
                                    <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill fw-bold" style={{ fontSize: '0.75rem' }}>
                                        Selected: {variantLabel || 'Standard'}
                                    </span>
                                </div>
                                <div className="d-flex flex-wrap gap-2 text-muted small">
                                    {selectedVariant?.Variation && <span>Variation: <strong className="text-dark">{selectedVariant.Variation}</strong></span>}
                                    {selectedVariant?.Pattern && <span>Pattern: <strong className="text-dark">{selectedVariant.Pattern}</strong></span>}
                                </div>

                                {statusMessage && (
                                    <div className="text-success small fw-bold mt-1 animate-fade">
                                        <i className="fa-solid fa-circle-check me-1"></i>
                                        {statusMessage}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* High-Contrast Order vs Drop Stepper Actions */}
                        <div className="row g-2 mt-3 pt-3 border-top">
                            {/* Order Action ($order 40 Max) */}
                            {effectiveShowOrder && (
                                <div className={effectiveShowDrop ? "col-6" : "col-12"}>
                                    {currentOrderQty > 0 ? (
                                        <div className="btn-group rounded-pill w-100 border border-success overflow-hidden" style={{ backgroundColor: '#f0fdf4' }}>
                                            <button
                                                type="button"
                                                className="btn btn-sm text-success fw-bold px-3 py-2 border-0 hover-bg-success hover-text-white transition-all"
                                                onClick={() => decreaseOrderQuantity?.(pocketItemId)}
                                                title="Decrease order quantity"
                                            >
                                                −
                                            </button>
                                            <div className="d-flex align-items-center justify-content-center fw-bold px-2 text-success flex-grow-1 font-monospace" style={{ fontSize: '0.85rem' }}>
                                                <i className="fa-solid fa-box me-1 small"></i>
                                                <span>{currentOrderQty}</span>
                                            </div>
                                            <button
                                                type="button"
                                                className="btn btn-sm text-success fw-bold px-3 py-2 border-0 hover-bg-success hover-text-white transition-all"
                                                onClick={() => increaseOrderQuantity?.(pocketItemId)}
                                                disabled={!canIncreaseOrder}
                                                title={!canIncreaseOrder ? 'Order full (40/40)' : 'Increase order quantity'}
                                            >
                                                +
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-outline-success rounded-pill w-100 py-2 fw-bold d-flex align-items-center justify-content-center gap-2 transition-all"
                                            onClick={handleAddOrder}
                                            disabled={totalOrderCount >= 40}
                                            title={totalOrderCount >= 40 ? 'Order bot full (40/40)' : 'Add variant to Order ($order)'}
                                        >
                                            <i className="fa-solid fa-box"></i>
                                            <span>+ Order ({totalOrderCount}/40)</span>
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Drop Action ($drop 9 Max) */}
                            {effectiveShowDrop && (
                                <div className={effectiveShowOrder ? "col-6" : "col-12"}>
                                    {currentDropQty > 0 ? (
                                        <div className="btn-group rounded-pill w-100 border border-info overflow-hidden" style={{ backgroundColor: '#f0f9ff', borderColor: '#0284c7' }}>
                                            <button
                                                type="button"
                                                className="btn btn-sm text-info fw-bold px-3 py-2 border-0 hover-bg-info hover-text-white transition-all"
                                                style={{ color: '#0284c7' }}
                                                onClick={() => decreaseDropQuantity(pocketItemId)}
                                                title="Decrease drop quantity"
                                            >
                                                −
                                            </button>
                                            <div className="d-flex align-items-center justify-content-center fw-bold px-2 flex-grow-1 font-monospace" style={{ fontSize: '0.85rem', color: '#0284c7' }}>
                                                <i className="fa-solid fa-plane-arrival me-1 small"></i>
                                                <span>{currentDropQty}</span>
                                            </div>
                                            <button
                                                type="button"
                                                className="btn btn-sm text-info fw-bold px-3 py-2 border-0 hover-bg-info hover-text-white transition-all"
                                                style={{ color: '#0284c7' }}
                                                onClick={() => increaseDropQuantity(pocketItemId)}
                                                disabled={!canIncreaseDrop}
                                                title={!canIncreaseDrop ? 'Drop full (9/9)' : 'Increase drop quantity'}
                                            >
                                                +
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-outline-info rounded-pill w-100 py-2 fw-bold d-flex align-items-center justify-content-center gap-2 transition-all"
                                            style={{ color: '#0284c7', borderColor: '#0284c7' }}
                                            onClick={handleAddDrop}
                                            disabled={totalDropCount >= 9}
                                            title={totalDropCount >= 9 ? 'Drop bot full (9/9)' : 'Add variant to Drop ($drop)'}
                                        >
                                            <i className="fa-solid fa-plane-arrival"></i>
                                            <span>+ Drop ({totalDropCount}/9)</span>
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Variations Grid Selection */}
                    <h3 className="h6 fw-bold text-dark mb-2">
                        <i className="fa-solid fa-palette me-2 text-success"></i>
                        Available Color Variations ({variations.length})
                    </h3>

                    <div className="row g-2">
                        {variations.map((v) => {
                            const vKey = getVariantKey(v);
                            const isSelected = vKey === selectedVariantKey;
                            const vLabel = getVariantLabel(v);
                            const vImage = getAcnhcdnUrl(v.imageUrl || item.image);
                            const vPocketId = `${item.id}:${vKey}`;
                            const vOrderCount = (effectiveShowOrder && getOrderPocketQuantity) ? getOrderPocketQuantity(vPocketId) : 0;
                            const vDropCount = (effectiveShowDrop && getDropPocketQuantity) ? getDropPocketQuantity(vPocketId) : 0;

                            return (
                                <div key={vKey} className="col-4 col-sm-3">
                                    <div
                                        className={`card rounded-4 p-2 text-center h-100 transition-all cursor-pointer border position-relative ${
                                            isSelected
                                                ? 'border-success border-2 shadow-xs bg-success-subtle'
                                                : 'border-light bg-white hover-border-success hover-shadow-2xs'
                                        }`}
                                        onClick={() => {
                                            setSelectedVariantKey(vKey);
                                            playChimeClick();
                                        }}
                                        role="button"
                                        tabIndex={0}
                                    >
                                        {/* Pocket Count Badges */}
                                        {((effectiveShowOrder && vOrderCount > 0) || (effectiveShowDrop && vDropCount > 0)) && (
                                            <div className="position-absolute top-0 end-0 m-1 d-flex flex-column gap-1">
                                                {effectiveShowOrder && vOrderCount > 0 && <span className="badge bg-success rounded-circle p-1" style={{ fontSize: '0.6rem' }}>O:{vOrderCount}</span>}
                                                {effectiveShowDrop && vDropCount > 0 && <span className="badge bg-info text-dark rounded-circle p-1" style={{ fontSize: '0.6rem' }}>D:{vDropCount}</span>}
                                            </div>
                                        )}

                                        <div className="ratio ratio-1x1 bg-light rounded-3 mb-1 overflow-hidden d-flex align-items-center justify-content-center">
                                            <img
                                                src={vImage}
                                                alt={vLabel || item.name}
                                                className="w-100 h-100 object-fit-contain p-1"
                                                loading="lazy"
                                                onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = FALLBACK_IMAGE; }}
                                            />
                                        </div>

                                        <span className="tiny-text fw-bold text-dark text-truncate d-block" title={vLabel || undefined} style={{ fontSize: '0.72rem' }}>
                                            {vLabel || 'Variant'}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="p-3 px-4 border-top bg-light d-flex align-items-center justify-content-between">
                    <div className="text-muted small">
                        {effectiveShowOrder && effectiveShowDrop ? (
                            <>
                                Pockets: <strong className="text-success">{totalOrderCount}/40 Order</strong> · <strong className="text-info" style={{ color: '#0284c7' }}>{totalDropCount}/9 Drop</strong>
                            </>
                        ) : effectiveShowDrop ? (
                            <>
                                Drop Pocket: <strong className="text-info" style={{ color: '#0284c7' }}>{totalDropCount}/9 Slots Used</strong>
                            </>
                        ) : (
                            <>
                                Order Pocket: <strong className="text-success">{totalOrderCount}/40 Slots Used</strong>
                            </>
                        )}
                    </div>
                    <button type="button" className="btn btn-dark rounded-pill px-4 fw-bold btn-sm" onClick={onClose}>
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CommandBuilderVariantModal;
