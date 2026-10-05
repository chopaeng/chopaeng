import { useState, useEffect, useMemo, useCallback } from 'react';
import type { PocketItem } from '../../hooks/useCommandBuilderPockets';
import {
    type PocketBundle,
    type PocketBundleCategory,
    type PocketBundleItem,
} from '../../data/pocketBundles';
import {
    fetchPocketBundles,
    createPocketBundle,
    deletePocketBundle
} from '../../utils/pocketBundleApi';
import { useAuth } from '../../context/useAuth';
import { getAuthToken } from '../../context/authToken';

interface CommandBuilderPocketBundlesModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentOrderPockets: Array<{ item: PocketItem; quantity: number }>;
    currentDropPockets: Array<{ item: PocketItem; quantity: number }>;
    onApplyBundleToOrder: (items: PocketBundleItem[], mode: 'replace' | 'merge') => void;
    onApplyBundleToDrop: (items: PocketBundleItem[], mode: 'replace' | 'merge') => void;
}

const CATEGORIES: PocketBundleCategory[] = [
    'All',
    'Popular',
    'Wealth',
    'Tools & Materials',
    'Seasonal',
    'Aesthetic',
    'Custom',
];

const ICONS_LIST = [
    'fa-box-open',
    'fa-crown',
    'fa-hammer',
    'fa-palette',
    'fa-fan',
    'fa-ghost',
    'fa-snowflake',
    'fa-chess-rook',
    'fa-seedling',
    'fa-star',
    'fa-heart',
    'fa-wand-magic-sparkles',
    'fa-basket-shopping',
];

export const CommandBuilderPocketBundlesModal = ({
    isOpen,
    onClose,
    currentOrderPockets,
    currentDropPockets,
    onApplyBundleToOrder,
    onApplyBundleToDrop,
}: CommandBuilderPocketBundlesModalProps) => {
    const { user } = useAuth();
    const [bundles, setBundles] = useState<PocketBundle[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<PocketBundleCategory>('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedBundleId, setSelectedBundleId] = useState<string | null>(null);

    // Save New Bundle Form State
    const [showSaveForm, setShowSaveForm] = useState(false);
    const [saveTitle, setSaveTitle] = useState('');
    const [saveDescription, setSaveDescription] = useState('');
    const [saveCategory, setSaveCategory] = useState<PocketBundleCategory>('Custom');
    const [saveIcon, setSaveIcon] = useState('fa-box-open');
    const [saveTarget, setSaveTarget] = useState<'order' | 'drop'>('order');
    const [saveAsOfficial, setSaveAsOfficial] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [feedbackNotice, setFeedbackNotice] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    // Load bundles from database API
    const loadBundles = useCallback(async () => {
        setLoading(true);
        try {
            const token = getAuthToken();
            const data = await fetchPocketBundles(token);
            setBundles(data);
            if (!selectedBundleId && data.length > 0) {
                setSelectedBundleId(data[0].id);
            }
        } catch {
            setBundles([]);
        } finally {
            setLoading(false);
        }
    }, [selectedBundleId]);

    useEffect(() => {
        if (isOpen) {
            loadBundles();
            setShowSaveForm(false);
            setFeedbackNotice(null);
            if (user?.is_admin) {
                setSaveAsOfficial(true);
                setSaveCategory('Popular');
            }
        }
    }, [isOpen, loadBundles, user]);

    const showNotice = (text: string, type: 'success' | 'error' = 'success') => {
        setFeedbackNotice({ text, type });
        setTimeout(() => setFeedbackNotice(null), 3500);
    };

    // Filter bundles
    const filteredBundles = useMemo(() => {
        return bundles.filter((b) => {
            const matchesCat =
                selectedCategory === 'All'
                    ? true
                    : selectedCategory === 'Custom'
                    ? !b.isOfficial || b.userId
                    : b.category === selectedCategory;

            const q = searchQuery.toLowerCase().trim();
            const matchesSearch =
                !q ||
                b.title.toLowerCase().includes(q) ||
                b.description.toLowerCase().includes(q) ||
                b.items.some((i) => i.name.toLowerCase().includes(q));

            return matchesCat && matchesSearch;
        });
    }, [bundles, selectedCategory, searchQuery]);

    const activeBundle = useMemo(() => {
        return bundles.find((b) => b.id === selectedBundleId) || filteredBundles[0] || null;
    }, [bundles, selectedBundleId, filteredBundles]);

    // Handle Save Current Pocket as Custom / Official Bundle
    const handleSaveCurrentPocket = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!saveTitle.trim()) {
            showNotice('Please provide a bundle title.', 'error');
            return;
        }

        const sourcePockets = saveTarget === 'order' ? currentOrderPockets : currentDropPockets;
        if (sourcePockets.length === 0) {
            showNotice(`Your ${saveTarget} pockets are empty! Add items first.`, 'error');
            return;
        }

        setIsSaving(true);
        try {
            const bundleItems: PocketBundleItem[] = sourcePockets.map((p) => ({
                itemId: p.item.id,
                name: p.item.name,
                quantity: p.quantity,
                category: p.item.category,
                variantId: p.item.variantId ? String(p.item.variantId) : undefined,
                variantLabel: p.item.variantLabel || undefined,
                image: p.item.image,
            }));

            const isOfficial = Boolean(user?.is_admin && saveAsOfficial);

            const newBundle = await createPocketBundle(
                {
                    title: saveTitle.trim(),
                    description: saveDescription.trim() || `Curated bundle with ${bundleItems.reduce((s, i) => s + i.quantity, 0)} items.`,
                    category: saveCategory,
                    icon: saveIcon,
                    target: saveTarget,
                    isOfficial,
                    items: bundleItems,
                    userId: user?.user_id || undefined,
                },
                getAuthToken()
            );

            await loadBundles();
            setSelectedBundleId(newBundle.id);
            setShowSaveForm(false);
            setSaveTitle('');
            setSaveDescription('');
            showNotice(isOfficial ? '⭐ Official Community Bundle saved to ChoBot!' : '💾 Custom Bundle saved to ChoBot!');
        } catch (err) {
            showNotice('Failed to save bundle to ChoBot.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // Handle Delete Bundle
    const handleDeleteBundle = async (bundleId: string) => {
        if (!window.confirm('Are you sure you want to delete this bundle?')) return;
        try {
            await deletePocketBundle(bundleId, getAuthToken());
            showNotice('Bundle deleted.');
            await loadBundles();
        } catch {
            showNotice('Failed to delete bundle.', 'error');
        }
    };

    if (!isOpen) return null;

    const totalOrderItemsCount = (currentOrderPockets || []).reduce((s, p) => s + (p?.quantity || 1), 0);
    const totalDropItemsCount = (currentDropPockets || []).reduce((s, p) => s + (p?.quantity || 1), 0);

    return (
        <div
            className="modal fade show d-block"
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(4px)', zIndex: 1060 }}
        >
            <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
                <div className="modal-content rounded-5 border-0 shadow-lg overflow-hidden" style={{ backgroundColor: 'var(--paper, #fdfbf7)' }}>
                    
                    {/* Header */}
                    <div className="modal-header border-0 px-3 px-md-4 py-3 shadow-sm d-flex align-items-center justify-content-between flex-wrap gap-2" style={{ backgroundColor: 'var(--card-bg, #ffffff)' }}>
                        <div className="d-flex align-items-center gap-2 min-w-0">
                            <div
                                className="rounded-circle d-flex align-items-center justify-content-center text-white shadow-sm flex-shrink-0"
                                style={{ width: '42px', height: '42px', background: 'var(--nook-green, #2b8a3e)' }}
                            >
                                <i className="fa-solid fa-box-open fs-5"></i>
                            </div>
                            <div className="min-w-0">
                                <h2 className="modal-title h5 fw-black text-dark mb-0 ac-font text-truncate">Pocket Bundles</h2>
                                <p className="tiny-text text-muted mb-0 text-truncate">1-click themed item sets &amp; ChoBot presets</p>
                            </div>
                        </div>

                        <div className="d-flex align-items-center gap-2 flex-shrink-0">
                            <button
                                type="button"
                                className={`btn btn-sm rounded-pill px-3 fw-bold transition-all ${showSaveForm ? 'btn-outline-secondary' : 'btn-nook text-white shadow-sm'}`}
                                onClick={() => setShowSaveForm(!showSaveForm)}
                            >
                                <i className={`fa-solid ${showSaveForm ? 'fa-xmark' : 'fa-plus'} me-1`}></i>
                                {showSaveForm ? 'Cancel Form' : 'Save Current Pocket'}
                            </button>
                            <button
                                type="button"
                                className="btn-close rounded-circle p-2"
                                onClick={onClose}
                                aria-label="Close"
                            />
                        </div>
                    </div>

                    {/* Notice alert */}
                    {feedbackNotice && (
                        <div className={`alert ${feedbackNotice.type === 'success' ? 'alert-success' : 'alert-danger'} rounded-0 mb-0 py-2 px-4 text-center fw-bold small animate-fade`}>
                            <i className={`fa-solid ${feedbackNotice.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'} me-2`} />
                            {feedbackNotice.text}
                        </div>
                    )}

                    {/* Body */}
                    <div className="modal-body p-4">
                        {/* ── Save Current Pocket Form ── */}
                        {showSaveForm && (
                            <div className="bg-white rounded-4 border p-4 shadow-sm mb-4 animate-up">
                                <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
                                    <h3 className="h6 fw-black text-dark mb-0 ac-font">
                                        <i className="fa-solid fa-floppy-disk text-success me-2"></i>
                                        Save Current Pocket to ChoBot
                                    </h3>
                                    <span className="badge bg-light text-dark border">
                                        Using {saveTarget === 'order' ? `${totalOrderItemsCount} Order Items` : `${totalDropItemsCount} Drop Items`}
                                    </span>
                                </div>

                                <form onSubmit={handleSaveCurrentPocket}>
                                    <div className="row g-3">
                                        <div className="col-md-6">
                                            <label className="form-label small fw-bold text-muted">Bundle Title *</label>
                                            <input
                                                type="text"
                                                className="form-control rounded-3"
                                                placeholder="e.g., My Cottagecore Furniture Pack"
                                                value={saveTitle}
                                                onChange={(e) => setSaveTitle(e.target.value)}
                                                required
                                            />
                                        </div>

                                        <div className="col-md-3">
                                            <label className="form-label small fw-bold text-muted">Category</label>
                                            <select
                                                className="form-select rounded-3"
                                                value={saveCategory}
                                                onChange={(e) => setSaveCategory(e.target.value as PocketBundleCategory)}
                                            >
                                                {CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                                                    <option key={cat} value={cat}>{cat}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="col-md-3">
                                            <label className="form-label small fw-bold text-muted">Target Pocket</label>
                                            <select
                                                className="form-select rounded-3"
                                                value={saveTarget}
                                                onChange={(e) => setSaveTarget(e.target.value as 'order' | 'drop')}
                                            >
                                                <option value="order">Order Pocket ({totalOrderItemsCount} items)</option>
                                                <option value="drop">Drop Pocket ({totalDropItemsCount} items)</option>
                                            </select>
                                        </div>

                                        <div className="col-12">
                                            <label className="form-label small fw-bold text-muted">Description</label>
                                            <input
                                                type="text"
                                                className="form-control rounded-3"
                                                placeholder="Short summary of what this bundle contains..."
                                                value={saveDescription}
                                                onChange={(e) => setSaveDescription(e.target.value)}
                                            />
                                        </div>

                                        <div className="col-md-6">
                                            <label className="form-label small fw-bold text-muted">Icon</label>
                                            <div className="d-flex flex-wrap gap-2">
                                                {ICONS_LIST.map((ic) => (
                                                    <button
                                                        type="button"
                                                        key={ic}
                                                        className={`btn btn-sm rounded-circle ${saveIcon === ic ? 'btn-dark text-white shadow-sm' : 'btn-outline-light text-dark border'}`}
                                                        style={{ width: '36px', height: '36px' }}
                                                        onClick={() => setSaveIcon(ic)}
                                                    >
                                                        <i className={`fa-solid ${ic}`}></i>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {user?.is_admin && (
                                            <div className="col-md-6 d-flex align-items-center">
                                                <div className="form-check form-switch p-3 bg-light rounded-3 border w-100">
                                                    <input
                                                        className="form-check-input ms-0 me-2"
                                                        type="checkbox"
                                                        id="adminOfficialCheck"
                                                        checked={saveAsOfficial}
                                                        onChange={(e) => setSaveAsOfficial(e.target.checked)}
                                                    />
                                                    <label className="form-check-label fw-bold text-dark small" htmlFor="adminOfficialCheck">
                                                        ⭐ Save as Official Community Bundle (Admin)
                                                    </label>
                                                    <div className="tiny-text text-muted">Makes this bundle visible to all visitors in the official presets tab.</div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="col-12 text-end mt-3">
                                            <button
                                                type="submit"
                                                className="btn btn-nook rounded-pill px-4 fw-bold shadow-sm"
                                                disabled={isSaving}
                                            >
                                                {isSaving ? (
                                                    <>
                                                        <span className="spinner-border spinner-border-sm me-2" role="status" />
                                                        Saving to ChoBot...
                                                    </>
                                                ) : (
                                                    <>
                                                        <i className="fa-solid fa-cloud-arrow-up me-2"></i>
                                                        Save Bundle to ChoBot
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            </div>
                        )}

                        {/* ── Filters & Search ── */}
                        <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-4">
                            {/* Category tabs */}
                            <div className="d-flex flex-wrap gap-2">
                                {CATEGORIES.map((cat) => {
                                    const count = bundles.filter((b) =>
                                        cat === 'All'
                                            ? true
                                            : cat === 'Custom'
                                            ? !b.isOfficial || b.userId
                                            : b.category === cat
                                    ).length;

                                    return (
                                        <button
                                            key={cat}
                                            type="button"
                                            onClick={() => setSelectedCategory(cat)}
                                            className={`btn btn-sm rounded-pill px-3 fw-bold transition-all ${
                                                selectedCategory === cat
                                                    ? 'btn-dark text-white shadow-sm'
                                                    : 'btn-white border text-muted'
                                            }`}
                                        >
                                            {cat === 'Custom' && <i className="fa-solid fa-user me-1 text-primary"></i>}
                                            {cat}
                                            <span className={`badge rounded-pill ms-2 ${selectedCategory === cat ? 'bg-white text-dark' : 'bg-light text-muted border'}`}>
                                                {count}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Search bar */}
                            <div className="position-relative" style={{ minWidth: '220px' }}>
                                <input
                                    type="text"
                                    className="form-control form-control-sm rounded-pill ps-4 border"
                                    placeholder="Search bundles or items..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                                <i className="fa-solid fa-magnifying-glass position-absolute top-50 start-0 translate-middle-y ms-3 text-muted x-small"></i>
                            </div>
                        </div>

                        {/* ── Main Layout: Bundle Cards + Item Slot Preview ── */}
                        <div className="row g-4">
                            {/* Left List of Bundles */}
                            <div className="col-lg-5">
                                <div className="d-flex flex-column gap-3 overflow-auto pe-1" style={{ maxHeight: '520px' }}>
                                    {loading ? (
                                        <div className="text-center py-5 text-muted">
                                            <div className="spinner-border spinner-border-sm text-success mb-2" />
                                            <p className="small mb-0">Loading ChoBot bundles...</p>
                                        </div>
                                    ) : filteredBundles.length === 0 ? (
                                        <div className="bg-white rounded-4 border p-4 text-center text-muted">
                                            <i className="fa-solid fa-box-open fs-3 text-muted opacity-50 mb-2"></i>
                                            <p className="small mb-0">No bundles found in this category.</p>
                                        </div>
                                    ) : (
                                        filteredBundles.map((bundle) => {
                                            const isSelected = activeBundle?.id === bundle.id;
                                            const bundleItems = Array.isArray(bundle?.items) ? bundle.items : [];
                                            const totalItems = bundleItems.reduce((s, i) => s + (i?.quantity || 1), 0);

                                            return (
                                                <div
                                                    key={bundle.id}
                                                    onClick={() => setSelectedBundleId(bundle.id)}
                                                    className={`card rounded-4 p-3 border transition-all cursor-pointer ${
                                                        isSelected
                                                            ? 'border-success bg-white shadow-sm'
                                                            : 'bg-white border-light hover-shadow'
                                                    }`}
                                                    style={{ cursor: 'pointer' }}
                                                >
                                                    <div className="d-flex align-items-start gap-3">
                                                        <div
                                                            className={`rounded-3 d-flex align-items-center justify-content-center flex-shrink-0 ${
                                                                isSelected ? 'bg-success text-white shadow-sm' : 'bg-light text-secondary'
                                                            }`}
                                                            style={{ width: '44px', height: '44px' }}
                                                        >
                                                            <i className={`fa-solid ${bundle.icon || 'fa-box-open'} fs-5`}></i>
                                                        </div>

                                                        <div className="flex-grow-1 min-w-0">
                                                            <div className="d-flex align-items-center justify-content-between gap-1 mb-1">
                                                                <h4 className="h6 fw-bold text-dark text-truncate mb-0 ac-font">
                                                                    {bundle.title}
                                                                </h4>
                                                                {bundle.isOfficial ? (
                                                                    <span className="badge bg-warning-subtle text-warning-emphasis border-warning-subtle rounded-pill x-small">
                                                                        Official
                                                                    </span>
                                                                ) : (
                                                                    <span className="badge bg-primary-subtle text-primary border-primary-subtle rounded-pill x-small">
                                                                        Custom
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="tiny-text text-muted line-clamp-2 mb-2">
                                                                {bundle.description}
                                                            </p>
                                                            <div className="d-flex align-items-center justify-content-between">
                                                                <span className="badge bg-light text-muted border rounded-pill x-small">
                                                                    {totalItems} items ({bundleItems.length} types)
                                                                </span>
                                                                <span className="tiny-text fw-bold text-success">
                                                                    {isSelected ? 'Viewing Items →' : 'Click to preview'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            {/* Right Bundle Preview & Load Actions */}
                            <div className="col-lg-7">
                                {activeBundle ? (
                                    <div className="bg-white rounded-4 border p-4 shadow-sm h-100 d-flex flex-column">
                                        {/* Header */}
                                        <div className="d-flex align-items-start justify-content-between gap-3 mb-3 border-bottom pb-3">
                                            <div>
                                                <div className="d-flex align-items-center gap-2 mb-1">
                                                    <span className="badge bg-nook-green text-white rounded-pill px-3 py-1 fw-bold x-small">
                                                        {activeBundle.category}
                                                    </span>
                                                    {activeBundle.isOfficial ? (
                                                        <span className="badge bg-warning text-dark rounded-pill px-2 py-1 fw-bold x-small">
                                                            <i className="fa-solid fa-certificate me-1"></i> Official
                                                        </span>
                                                    ) : (
                                                        <span className="badge bg-info text-dark rounded-pill px-2 py-1 fw-bold x-small">
                                                            <i className="fa-solid fa-user me-1"></i> Community
                                                        </span>
                                                    )}
                                                </div>
                                                <h3 className="h5 fw-black text-dark mb-1 ac-font">{activeBundle.title}</h3>
                                                <p className="small text-muted mb-0">{activeBundle.description}</p>
                                            </div>

                                            {(!activeBundle.isOfficial || user?.is_admin) && (
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-danger rounded-circle p-2"
                                                    title="Delete this bundle from ChoBot"
                                                    onClick={() => handleDeleteBundle(activeBundle.id)}
                                                >
                                                    <i className="fa-solid fa-trash-can"></i>
                                                </button>
                                            )}
                                        </div>

                                        {/* Slots Preview Grid */}
                                        <div className="flex-grow-1 overflow-auto mb-3" style={{ maxHeight: '340px' }}>
                                            <div className="d-flex align-items-center justify-content-between mb-2">
                                                <span className="tiny-text fw-bold text-muted text-uppercase tracking-wider">
                                                    Included Items ({((activeBundle?.items) || []).reduce((s, i) => s + (i?.quantity || 1), 0)} Total)
                                                </span>
                                            </div>

                                            <div className="row g-2">
                                                {((activeBundle?.items) || []).map((item, idx) => (
                                                    <div key={`${item.itemId}-${idx}`} className="col-sm-6">
                                                        <div className="d-flex align-items-center gap-2 p-2 rounded-3 bg-light border">
                                                            <div className="ratio ratio-1x1 rounded-2 bg-white border flex-shrink-0" style={{ width: '38px', height: '38px', overflow: 'hidden' }}>
                                                                <img
                                                                    src={item.image || 'https://via.placeholder.com/60'}
                                                                    alt={item.name}
                                                                    className="w-100 h-100 object-fit-contain p-1"
                                                                />
                                                            </div>
                                                            <div className="min-w-0 flex-grow-1">
                                                                <strong className="d-block small text-dark text-truncate" title={item.name}>
                                                                    {item.name}
                                                                </strong>
                                                                <span className="tiny-text text-muted text-truncate d-block">
                                                                    {item.category}{item.variantLabel ? ` · ${item.variantLabel}` : ''}
                                                                </span>
                                                            </div>
                                                            <span className="badge bg-dark text-white rounded-pill x-small fw-bold px-2">
                                                                ×{item.quantity}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Apply Action Buttons */}
                                        <div className="border-top pt-3">
                                            <span className="tiny-text fw-bold text-muted d-block mb-2 text-uppercase">1-Click Apply to Your Pockets</span>
                                            <div className="d-flex flex-wrap gap-2">
                                                <button
                                                    type="button"
                                                    className="btn btn-nook rounded-pill fw-bold btn-sm py-2 px-3 flex-grow-1 shadow-sm text-white"
                                                    onClick={() => {
                                                        onApplyBundleToOrder(activeBundle.items, 'replace');
                                                        onClose();
                                                    }}
                                                >
                                                    <i className="fa-solid fa-arrows-rotate me-1"></i>
                                                    Replace Order Pockets (40 Slots)
                                                </button>

                                                <button
                                                    type="button"
                                                    className="btn btn-white border rounded-pill fw-bold btn-sm py-2 px-3 flex-grow-1 shadow-sm"
                                                    onClick={() => {
                                                        onApplyBundleToOrder(activeBundle.items, 'merge');
                                                        onClose();
                                                    }}
                                                >
                                                    <i className="fa-solid fa-plus me-1 text-success"></i>
                                                    Fill Empty Order Slots
                                                </button>

                                                <button
                                                    type="button"
                                                    className="btn btn-info text-dark rounded-pill fw-bold btn-sm py-2 px-3 shadow-sm border-0"
                                                    onClick={() => {
                                                        onApplyBundleToDrop(activeBundle.items.slice(0, 9), 'replace');
                                                        onClose();
                                                    }}
                                                >
                                                    <i className="fa-solid fa-box-open me-1"></i>
                                                    Load to Drop Pockets (9 Max)
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-white rounded-4 border p-5 text-center text-muted h-100 d-flex flex-column align-items-center justify-content-center">
                                        <i className="fa-solid fa-box-open fs-1 text-muted opacity-25 mb-3"></i>
                                        <h4 className="h6 fw-bold">Select a Bundle</h4>
                                        <p className="small mb-0">Choose a bundle on the left to preview its items and load it into your pockets.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
