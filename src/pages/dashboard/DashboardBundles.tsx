import { useState, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { getAuthToken } from '../../context/authToken';
import {
    type PocketBundle,
    type PocketBundleCategory,
    type PocketBundleItem,
} from '../../data/pocketBundles';
import {
    fetchPocketBundles,
    createPocketBundle,
    updatePocketBundle,
    deletePocketBundle,
} from '../../utils/pocketBundleApi';
import { useCatalogData } from '../../hooks/useCatalogData';
import type { CatalogEntity } from '../../data/commandBuilderData';
import { getVariantKey, getVariantLabel, generateFullItemHex } from '../../utils/commandBuilderHex';
import { parseItemCodes } from '../../utils/itemCodeParser';

const CATEGORIES: PocketBundleCategory[] = [
    'All',
    'Popular',
    'Wealth',
    'Tools & Materials',
    'Seasonal',
    'Aesthetic',
    'Custom',
];

const ICONS = [
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
    'fa-wand-magic-sparkles',
    'fa-basket-shopping',
];

const CATALOG_CATEGORIES = [
    'All',
    'Furniture',
    'Clothing',
    'Tools',
    'Materials',
    'Recipes',
    'Villagers',
    'Misc',
];

const FALLBACK_IMAGE = 'https://via.placeholder.com/80?text=No+Image';

export const DashboardBundles = () => {
    const [bundles, setBundles] = useState<PocketBundle[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<PocketBundleCategory>('All');
    const [notice, setNotice] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    // Explorer Catalog Data from explorer.json + villagers.json
    const { data: catalogData, isLoading: catalogLoading } = useCatalogData();
    const [explorerCategory, setExplorerCategory] = useState('All');
    const [explorerSearch, setExplorerSearch] = useState('');
    const [selectedCatalogItem, setSelectedCatalogItem] = useState<CatalogEntity | null>(null);

    // Edit/Create Modal State
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingBundle, setEditingBundle] = useState<PocketBundle | null>(null);
    const [formTitle, setFormTitle] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formCategory, setFormCategory] = useState<PocketBundleCategory>('Popular');
    const [formIcon, setFormIcon] = useState('fa-box-open');
    const [formTarget, setFormTarget] = useState<'order' | 'drop'>('order');
    const [formItems, setFormItems] = useState<PocketBundleItem[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    // Manual Hex Code & Quick Parse Direct Adder
    const [manualHex, setManualHex] = useState('');
    const [copyCmdStatus, setCopyCmdStatus] = useState(false);

    // Batch Paste & Item Code Parser Modal State
    const [batchPasteModalOpen, setBatchPasteModalOpen] = useState(false);
    const [batchPasteInput, setBatchPasteInput] = useState('');
    const [batchPasteTarget, setBatchPasteTarget] = useState<'order' | 'drop'>('order');
    const [batchPasteBundleTitle, setBatchPasteBundleTitle] = useState('');
    const [batchPasteCategory, setBatchPasteCategory] = useState<PocketBundleCategory>('Popular');

    // Live parsed result from pasted item codes
    const parsedBatchResult = useMemo(() => {
        return parseItemCodes(batchPasteInput, catalogData?.all || []);
    }, [batchPasteInput, catalogData]);

    const maxSlots = formTarget === 'drop' ? 9 : 40;
    const currentSlotsCount = useMemo(() => {
        return (formItems || []).reduce((s, i) => s + (i?.quantity || 1), 0);
    }, [formItems]);

    // Computed bot command string (!order ... or !drop ...)
    const botCommandText = useMemo(() => {
        const prefix = formTarget === 'drop' ? '!drop' : '!order';
        const hexList: string[] = [];
        (formItems || []).forEach((item) => {
            const hex = generateFullItemHex(item.itemId, item.variantId, item.category);
            for (let i = 0; i < (item.quantity || 1); i++) {
                hexList.push(hex);
            }
        });
        return hexList.length > 0 ? `${prefix} ${hexList.join(' ')}` : '';
    }, [formItems, formTarget]);

    const handleCopyBotCommand = () => {
        if (!botCommandText) return;
        navigator.clipboard.writeText(botCommandText);
        setCopyCmdStatus(true);
        setTimeout(() => setCopyCmdStatus(false), 2500);
    };

    const handleManualAddHex = () => {
        if (!manualHex.trim()) return;
        const cleanHex = manualHex.trim().toUpperCase();
        if (currentSlotsCount >= maxSlots) {
            showNotice(`Cannot add item: maximum limit of ${maxSlots} slots reached.`, 'error');
            return;
        }

        const foundItem = catalogData?.all.find((i) => i.id.toUpperCase() === cleanHex);
        const newItem: PocketBundleItem = {
            itemId: cleanHex,
            name: foundItem ? foundItem.name : `Hex Item (${cleanHex})`,
            quantity: 1,
            category: foundItem?.category || 'Custom Hex',
            image: foundItem?.image || FALLBACK_IMAGE,
        };
        setFormItems([...formItems, newItem]);
        setManualHex('');
        showNotice(`✨ Added HEX ${cleanHex} to bundle!`);
    };

    // Inline quick parse from the single code box
    const handleInlineQuickParse = () => {
        if (!manualHex.trim()) return;
        const parsed = parseItemCodes(manualHex, catalogData?.all || []);
        if (parsed.items.length === 0) {
            handleManualAddHex();
            return;
        }

        const merged = [...formItems];
        for (const it of parsed.items) {
            const existingIdx = merged.findIndex((m) => m.itemId.toUpperCase() === it.itemId.toUpperCase());
            if (existingIdx >= 0) {
                merged[existingIdx] = {
                    ...merged[existingIdx],
                    quantity: merged[existingIdx].quantity + it.quantity,
                };
            } else {
                merged.push(it);
            }
        }
        setFormItems(merged);
        setManualHex('');
        showNotice(`✨ Parsed & added ${parsed.items.length} item types (${parsed.totalSlots} slots)!`);
    };

    // Apply parsed batch items to currently open Visual Builder modal
    const handleApplyBatchPasteToEditor = (mode: 'replace' | 'append') => {
        if (parsedBatchResult.items.length === 0) {
            showNotice('No items parsed from input. Please check your pasted text.', 'error');
            return;
        }

        if (mode === 'replace') {
            setFormItems(parsedBatchResult.items);
            showNotice(`✨ Replaced bundle with ${parsedBatchResult.items.length} parsed items (${parsedBatchResult.totalSlots} slots)!`);
        } else {
            const merged = [...formItems];
            for (const it of parsedBatchResult.items) {
                const existingIdx = merged.findIndex((m) => m.itemId.toUpperCase() === it.itemId.toUpperCase());
                if (existingIdx >= 0) {
                    merged[existingIdx] = {
                        ...merged[existingIdx],
                        quantity: merged[existingIdx].quantity + it.quantity,
                    };
                } else {
                    merged.push(it);
                }
            }
            setFormItems(merged);
            showNotice(`✨ Appended ${parsedBatchResult.items.length} items to bundle!`);
        }

        setBatchPasteModalOpen(false);
    };

    // Standalone direct creation from Batch Paste modal
    const handleCreateBundleFromBatchPaste = () => {
        if (parsedBatchResult.items.length === 0) {
            showNotice('No items parsed from input. Please check your pasted text.', 'error');
            return;
        }

        setEditingBundle(null);
        setFormTitle(batchPasteBundleTitle.trim() || `Bundle (${new Date().toLocaleDateString()})`);
        setFormDescription(`Auto-parsed bundle with ${parsedBatchResult.totalSlots} items.`);
        setFormCategory(batchPasteCategory);
        setFormIcon('fa-box-open');
        setFormTarget(batchPasteTarget);
        setFormItems(parsedBatchResult.items);

        setBatchPasteModalOpen(false);
        setEditModalOpen(true);
        showNotice(`✨ Loaded ${parsedBatchResult.items.length} parsed item types into Builder! Review & save.`);
    };

    // Load bundles from DB
    const loadBundles = useCallback(async () => {
        setLoading(true);
        try {
            const token = getAuthToken();
            const data = await fetchPocketBundles(token);
            setBundles(data);
        } catch {
            setBundles([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadBundles();
    }, [loadBundles]);

    const showNotice = (text: string, type: 'success' | 'error' = 'success') => {
        setNotice({ text, type });
        setTimeout(() => setNotice(null), 4000);
    };

    // Filter bundles list in table
    const filteredBundles = useMemo(() => {
        return bundles.filter((b) => {
            const matchesCat = selectedCategory === 'All' || b.category === selectedCategory;
            const q = searchQuery.toLowerCase().trim();
            const matchesSearch =
                !q ||
                b.title.toLowerCase().includes(q) ||
                b.description.toLowerCase().includes(q) ||
                ((b.items || []) as PocketBundleItem[]).some((i: PocketBundleItem) => (i.name || '').toLowerCase().includes(q));

            return matchesCat && matchesSearch;
        });
    }, [bundles, selectedCategory, searchQuery]);

    // Filter catalog items from explorer.json
    const filteredCatalogItems = useMemo(() => {
        if (!catalogData?.all) return [];
        const q = explorerSearch.toLowerCase().trim();
        return catalogData.all.filter((item) => {
            if (explorerCategory !== 'All') {
                if (explorerCategory === 'Villagers' && item.entityType !== 'villager') return false;
                if (explorerCategory !== 'Villagers' && item.entityType === 'villager') return false;
                if (explorerCategory !== 'Villagers' && item.category !== explorerCategory) {
                    if (explorerCategory === 'Furniture' && !['Housewares', 'Miscellaneous', 'Wall-mounted', 'Ceiling Decor'].includes(item.category || '')) {
                        return false;
                    }
                }
            }
            if (q) {
                const matchName = item.name.toLowerCase().includes(q);
                const matchCategory = item.category?.toLowerCase().includes(q);
                if (!matchName && !matchCategory) return false;
            }
            return true;
        }).slice(0, 48);
    }, [catalogData, explorerCategory, explorerSearch]);

    const openCreateModal = () => {
        setEditingBundle(null);
        setFormTitle('');
        setFormDescription('');
        setFormCategory('Popular');
        setFormIcon('fa-box-open');
        setFormTarget('order');
        setFormItems([
            { itemId: '3438', name: 'Nook Miles Ticket', quantity: 20, category: 'Currency', image: 'https://www.pange.ca/itemsearch/items/img/MilePlaneTicket.png' },
            { itemId: '1431', name: 'Royal Crown', quantity: 20, category: 'Clothing', image: 'https://www.pange.ca/itemsearch/items/img/CapHatCrownRed.png' },
        ]);
        setSelectedCatalogItem(null);
        setEditModalOpen(true);
    };

    const openEditModal = (bundle: PocketBundle) => {
        setEditingBundle(bundle);
        setFormTitle(bundle.title);
        setFormDescription(bundle.description);
        setFormCategory(bundle.category);
        setFormIcon(bundle.icon);
        setFormTarget(bundle.target || 'order');
        setFormItems([...(bundle.items || [])]);
        setSelectedCatalogItem(null);
        setEditModalOpen(true);
    };

    // Add item from visual catalog into bundle slots
    const handleAddCatalogItem = (entity: CatalogEntity, variant?: any) => {
        if (currentSlotsCount >= maxSlots) {
            showNotice(`Cannot add item: maximum limit of ${maxSlots} slots reached.`, 'error');
            return;
        }

        const variantId = variant ? getVariantKey(variant) : (entity.variations?.[0] ? getVariantKey(entity.variations[0]) : undefined);
        const variantLabel = variant ? getVariantLabel(variant) : (entity.variations?.[0] ? getVariantLabel(entity.variations[0]) : undefined);
        const image = (variant?.imageUrl || entity.image || FALLBACK_IMAGE) || undefined;

        // Check if matching item is already in formItems
        const existingIdx = formItems.findIndex(
            (i) => i.itemId === entity.id && i.variantId === (variantId || undefined)
        );

        if (existingIdx >= 0) {
            const updated = [...formItems];
            updated[existingIdx] = {
                ...updated[existingIdx],
                quantity: updated[existingIdx].quantity + 1,
            };
            setFormItems(updated);
        } else {
            const newItem: PocketBundleItem = {
                itemId: entity.id,
                name: entity.name,
                quantity: 1,
                category: entity.category || 'General',
                variantId: variantId && variantId !== 'NA' ? String(variantId) : undefined,
                variantLabel: variantLabel && variantLabel !== 'Default' ? variantLabel : undefined,
                image,
            };
            setFormItems([...formItems, newItem]);
        }
    };

    const handleUpdateItemQuantity = (index: number, delta: number) => {
        const item = formItems[index];
        if (!item) return;
        const newQty = item.quantity + delta;
        if (newQty <= 0) {
            setFormItems(formItems.filter((_, i) => i !== index));
        } else if (delta > 0 && currentSlotsCount >= maxSlots) {
            showNotice(`Maximum limit of ${maxSlots} slots reached.`, 'error');
        } else {
            const updated = [...formItems];
            updated[index] = { ...item, quantity: newQty };
            setFormItems(updated);
        }
    };

    const handleRemoveItem = (index: number) => {
        setFormItems(formItems.filter((_, i) => i !== index));
    };

    // Quick Fill Presets
    const handleQuickFill = (name: string, hexId: string, category: string, img: string) => {
        setFormItems([
            {
                itemId: hexId,
                name,
                quantity: maxSlots,
                category,
                image: img,
            }
        ]);
        showNotice(`Filled bundle with ${maxSlots}× ${name}!`);
    };

    // Import from localStorage Command Builder pockets
    const handleImportFromCommandBuilder = () => {
        try {
            const orderRaw = localStorage.getItem('chopaeng_order_pockets');
            const dropRaw = localStorage.getItem('chopaeng_drop_pockets');
            const targetRaw = formTarget === 'drop' ? dropRaw : orderRaw;
            if (targetRaw) {
                const parsed = JSON.parse(targetRaw);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    const importedItems: PocketBundleItem[] = parsed.map((p: any) => ({
                        itemId: p.item?.id || p.itemId || 'item',
                        name: p.item?.name || p.name || 'Item',
                        quantity: p.quantity || 1,
                        category: p.item?.category || p.category || 'General',
                        variantId: p.item?.variantId ? String(p.item.variantId) : undefined,
                        variantLabel: p.item?.variantLabel || undefined,
                        image: p.item?.image || undefined,
                    }));
                    setFormItems(importedItems);
                    showNotice(`✨ Imported ${importedItems.length} items from Command Builder pockets!`);
                    return;
                }
            }
            showNotice('Your Command Builder pockets are empty! Open Command Builder to add items first.', 'error');
        } catch {
            showNotice('Could not read Command Builder pockets.', 'error');
        }
    };

    const handleSaveBundle = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formTitle.trim()) {
            showNotice('Title is required', 'error');
            return;
        }
        if (formItems.length === 0) {
            showNotice('Bundle must contain at least 1 item', 'error');
            return;
        }

        setIsSaving(true);
        try {
            const token = getAuthToken();
            if (editingBundle) {
                await updatePocketBundle(
                    editingBundle.id,
                    {
                        title: formTitle.trim(),
                        description: formDescription.trim(),
                        category: formCategory,
                        icon: formIcon,
                        target: formTarget,
                        items: formItems,
                        isOfficial: true,
                    },
                    token
                );
                showNotice('⭐ Official Bundle updated successfully!');
            } else {
                await createPocketBundle(
                    {
                        title: formTitle.trim(),
                        description: formDescription.trim(),
                        category: formCategory,
                        icon: formIcon,
                        target: formTarget,
                        items: formItems,
                        isOfficial: true,
                    },
                    token
                );
                showNotice('⭐ Official Bundle created successfully in ChoBot!');
            }
            setEditModalOpen(false);
            await loadBundles();
        } catch {
            showNotice('Failed to save official bundle', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteBundle = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this official bundle from ChoBot?')) return;
        try {
            await deletePocketBundle(id, getAuthToken());
            showNotice('Bundle deleted successfully');
            await loadBundles();
        } catch {
            showNotice('Failed to delete bundle', 'error');
        }
    };

    const handleExportJson = () => {
        const jsonStr = JSON.stringify(bundles, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chopaeng-official-bundles-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="container-fluid py-4 px-md-4">
            <Helmet>
                <title>Pocket Bundles Manager | Chopaeng Admin</title>
            </Helmet>

            {/* Header */}
            <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-4">
                <div>
                    <h1 className="h3 fw-black text-dark mb-1 ac-font d-flex align-items-center gap-2">
                        <i className="fa-solid fa-boxes-packing text-success" />
                        Official Pocket Bundles Manager
                    </h1>
                    <p className="small text-muted mb-0">
                        Create, customize, and manage official community 1-click pocket presets with items from the Animal Crossing database.
                    </p>
                </div>

                <div className="d-flex flex-wrap gap-2">
                    <button type="button" className="btn btn-outline-secondary rounded-pill fw-bold btn-sm" onClick={handleExportJson}>
                        <i className="fa-solid fa-file-export me-1"></i>
                        Export JSON
                    </button>
                    <button
                        type="button"
                        className="btn btn-outline-success rounded-pill fw-bold btn-sm shadow-xs"
                        onClick={() => {
                            setBatchPasteInput('');
                            setBatchPasteBundleTitle('');
                            setBatchPasteModalOpen(true);
                        }}
                    >
                        <i className="fa-solid fa-paste me-1"></i>
                        Batch Paste Codes
                    </button>
                    <button type="button" className="btn btn-nook text-white rounded-pill fw-bold btn-sm shadow-sm" onClick={openCreateModal}>
                        <i className="fa-solid fa-wand-magic-sparkles me-1"></i>
                        Create Official Bundle (Visual Builder)
                    </button>
                </div>
            </div>

            {/* Notice */}
            {notice && (
                <div className={`alert ${notice.type === 'success' ? 'alert-success' : 'alert-danger'} rounded-4 py-2 px-4 mb-4 fw-bold small animate-fade`}>
                    <i className={`fa-solid ${notice.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'} me-2`} />
                    {notice.text}
                </div>
            )}

            {/* Controls */}
            <div className="card rounded-4 border p-3 mb-4 shadow-sm bg-white">
                <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
                    {/* Category tabs */}
                    <div className="d-flex flex-wrap gap-2">
                        {CATEGORIES.map((cat) => (
                            <button
                                key={cat}
                                type="button"
                                className={`btn btn-sm rounded-pill fw-bold px-3 ${
                                    selectedCategory === cat ? 'btn-dark text-white shadow-sm' : 'btn-white border text-muted'
                                }`}
                                onClick={() => setSelectedCategory(cat)}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>

                    {/* Search */}
                    <div className="position-relative" style={{ width: '260px' }}>
                        <input
                            type="text"
                            className="form-control form-control-sm rounded-pill ps-4 border"
                            placeholder="Search bundles..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <i className="fa-solid fa-magnifying-glass position-absolute top-50 start-0 translate-middle-y ms-3 text-muted x-small"></i>
                    </div>
                </div>
            </div>

            {/* Bundles Table */}
            <div className="card rounded-4 border overflow-hidden shadow-sm bg-white">
                <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                        <thead className="table-light">
                            <tr>
                                <th style={{ width: '60px' }}>Icon</th>
                                <th>Bundle Title & Description</th>
                                <th>Category</th>
                                <th>Target</th>
                                <th>Slots / Items</th>
                                <th>Type</th>
                                <th className="text-end">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-5 text-muted">
                                        <div className="spinner-border spinner-border-sm text-success me-2" />
                                        Loading ChoBot bundles...
                                    </td>
                                </tr>
                            ) : filteredBundles.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-5 text-muted">
                                        No pocket bundles found. Click "Create Official Bundle" above to add one!
                                    </td>
                                </tr>
                            ) : (
                                filteredBundles.map((bundle) => {
                                    const bundleItems = (Array.isArray(bundle?.items) ? bundle.items : []) as PocketBundleItem[];
                                    const totalItemsCount = bundleItems.reduce((s: number, i: PocketBundleItem) => s + (i?.quantity || 1), 0);

                                    return (
                                        <tr key={bundle.id}>
                                            <td>
                                                <div
                                                    className="rounded-3 bg-light d-flex align-items-center justify-content-center border"
                                                    style={{ width: '40px', height: '40px' }}
                                                >
                                                    <i className={`fa-solid ${bundle.icon || 'fa-box-open'} text-success fs-5`}></i>
                                                </div>
                                            </td>
                                            <td>
                                                <strong className="d-block text-dark small">{bundle.title}</strong>
                                                <span className="tiny-text text-muted line-clamp-1">{bundle.description}</span>
                                            </td>
                                            <td>
                                                <span className="badge bg-light text-dark border rounded-pill x-small">
                                                    {bundle.category}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`badge rounded-pill x-small ${bundle.target === 'drop' ? 'bg-info-subtle text-info-emphasis' : 'bg-success-subtle text-success'}`}>
                                                    {bundle.target === 'drop' ? 'Drop Bot (9)' : 'Order Bot (40)'}
                                                </span>
                                            </td>
                                            <td>
                                                <strong className="small text-dark">{totalItemsCount} slots</strong>
                                                <span className="tiny-text text-muted d-block">({bundleItems.length} unique)</span>
                                            </td>
                                            <td>
                                                {bundle.isOfficial ? (
                                                    <span className="badge bg-warning text-dark rounded-pill x-small fw-bold">
                                                        ⭐ Official
                                                    </span>
                                                ) : (
                                                    <span className="badge bg-secondary text-white rounded-pill x-small">
                                                        👤 User Custom
                                                    </span>
                                                )}
                                            </td>
                                            <td className="text-end">
                                                <div className="d-flex justify-content-end gap-1">
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-primary rounded-circle p-2"
                                                        title="Edit Bundle with Visual Explorer"
                                                        onClick={() => openEditModal(bundle)}
                                                    >
                                                        <i className="fa-solid fa-pen-to-square"></i>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-danger rounded-circle p-2"
                                                        title="Delete Bundle"
                                                        onClick={() => handleDeleteBundle(bundle.id)}
                                                    >
                                                        <i className="fa-solid fa-trash-can"></i>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════════════
               VISUAL BUNDLE BUILDER MODAL (Powered by explorer.json Catalog)
               ══════════════════════════════════════════════════════════════════════ */}
            {editModalOpen && (
                <div
                    className="modal fade show d-block"
                    tabIndex={-1}
                    role="dialog"
                    style={{ backgroundColor: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(4px)', zIndex: 1050 }}
                >
                    <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
                        <div className="modal-content rounded-5 border-0 shadow-lg overflow-hidden" style={{ background: '#fdfbf7' }}>
                            {/* Modal Header */}
                            <div className="modal-header border-0 bg-white px-4 py-3 shadow-sm d-flex align-items-center justify-content-between">
                                <div className="d-flex align-items-center gap-2">
                                    <div className="rounded-circle bg-success text-white d-flex align-items-center justify-content-center" style={{ width: '40px', height: '40px' }}>
                                        <i className="fa-solid fa-wand-magic-sparkles"></i>
                                    </div>
                                    <div>
                                        <h2 className="modal-title h5 fw-black text-dark mb-0 ac-font">
                                            {editingBundle ? 'Edit Official Bundle' : 'Visual Official Bundle Builder'}
                                        </h2>
                                        <p className="tiny-text text-muted mb-0">Browse Animal Crossing items and build 1-click community presets</p>
                                    </div>
                                </div>
                                <button type="button" className="btn-close" onClick={() => setEditModalOpen(false)} aria-label="Close" />
                            </div>

                            {/* Modal Body */}
                            <div className="modal-body p-4">
                                <form onSubmit={handleSaveBundle}>
                                    {/* Bundle Metadata */}
                                    <div className="row g-3 bg-white p-3 rounded-4 border shadow-sm mb-4">
                                        <div className="col-md-5">
                                            <label className="form-label small fw-bold text-muted">Bundle Title *</label>
                                            <input
                                                type="text"
                                                className="form-control rounded-3"
                                                placeholder="e.g. Royal Starter Kit"
                                                value={formTitle}
                                                onChange={(e) => setFormTitle(e.target.value)}
                                                required
                                            />
                                        </div>

                                        <div className="col-md-3">
                                            <label className="form-label small fw-bold text-muted">Category</label>
                                            <select
                                                className="form-select rounded-3"
                                                value={formCategory}
                                                onChange={(e) => setFormCategory(e.target.value as PocketBundleCategory)}
                                            >
                                                {CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                                                    <option key={cat} value={cat}>{cat}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="col-md-2">
                                            <label className="form-label small fw-bold text-muted">Target</label>
                                            <select
                                                className="form-select rounded-3"
                                                value={formTarget}
                                                onChange={(e) => setFormTarget(e.target.value as 'order' | 'drop')}
                                            >
                                                <option value="order">Order (40 Max)</option>
                                                <option value="drop">Drop (9 Max)</option>
                                            </select>
                                        </div>

                                        <div className="col-md-2">
                                            <label className="form-label small fw-bold text-muted">Icon</label>
                                            <div className="dropdown">
                                                <button
                                                    className="btn btn-outline-secondary dropdown-toggle rounded-3 w-100 d-flex align-items-center justify-content-between"
                                                    type="button"
                                                    data-bs-toggle="dropdown"
                                                >
                                                    <i className={`fa-solid ${formIcon} text-success`}></i>
                                                    <span className="small">{formIcon.replace('fa-', '')}</span>
                                                </button>
                                                <div className="dropdown-menu p-2 shadow-sm" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                                    <div className="d-flex flex-wrap gap-1">
                                                        {ICONS.map((ic) => (
                                                            <button
                                                                key={ic}
                                                                type="button"
                                                                className={`btn btn-sm rounded-2 ${formIcon === ic ? 'btn-success text-white' : 'btn-light'}`}
                                                                onClick={() => setFormIcon(ic)}
                                                                style={{ width: '36px', height: '36px' }}
                                                            >
                                                                <i className={`fa-solid ${ic}`} />
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="col-12">
                                            <label className="form-label small fw-bold text-muted">Description</label>
                                            <input
                                                type="text"
                                                className="form-control rounded-3"
                                                placeholder="Short summary of what this bundle provides..."
                                                value={formDescription}
                                                onChange={(e) => setFormDescription(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    {/* Quick Preset Utilities Bar */}
                                    <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3 bg-light p-2 rounded-4 border">
                                        <div className="d-flex flex-wrap gap-2 align-items-center">
                                            <span className="tiny-text fw-bold text-muted text-uppercase me-1">Quick Presets:</span>
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-white border rounded-pill shadow-2xs fw-bold text-dark"
                                                onClick={() => handleQuickFill('Nook Miles Ticket', '3438', 'Currency', 'https://www.pange.ca/itemsearch/items/img/MilePlaneTicket.png')}
                                            >
                                                +Full NMTs ({maxSlots})
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-white border rounded-pill shadow-2xs fw-bold text-dark"
                                                onClick={() => handleQuickFill('Royal Crown', '1431', 'Clothing', 'https://www.pange.ca/itemsearch/items/img/CapHatCrownRed.png')}
                                            >
                                                +Full Crowns ({maxSlots})
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-white border rounded-pill shadow-2xs fw-bold text-dark"
                                                onClick={() => handleQuickFill('Gold Nugget', '0BF1', 'Materials', 'https://www.pange.ca/itemsearch/items/img/DIYGold.png')}
                                            >
                                                +Full Gold ({maxSlots})
                                            </button>
                                        </div>

                                        <div className="d-flex flex-wrap gap-2 align-items-center">
                                            <div className="input-group input-group-sm" style={{ maxWidth: '280px' }}>
                                                <span className="input-group-text bg-dark text-white font-monospace py-0 px-2" style={{ fontSize: '0.7rem' }}>HEX/CODE</span>
                                                <input
                                                    type="text"
                                                    className="form-control font-monospace form-control-sm py-0"
                                                    placeholder="e.g. 1431 3438 or !order..."
                                                    style={{ fontSize: '0.75rem' }}
                                                    value={manualHex}
                                                    onChange={(e) => setManualHex(e.target.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleInlineQuickParse())}
                                                />
                                                <button type="button" className="btn btn-nook text-white fw-bold py-0 px-2" style={{ fontSize: '0.75rem' }} onClick={handleInlineQuickParse}>
                                                    +Parse
                                                </button>
                                            </div>

                                            <button
                                                type="button"
                                                className="btn btn-sm btn-white border rounded-pill shadow-2xs fw-bold text-dark"
                                                onClick={() => {
                                                    setBatchPasteInput('');
                                                    setBatchPasteModalOpen(true);
                                                }}
                                                title="Open multi-line batch paste & parser modal"
                                            >
                                                <i className="fa-solid fa-paste me-1 text-success"></i>
                                                Batch Paste
                                            </button>

                                            <button
                                                type="button"
                                                className="btn btn-sm btn-white border rounded-pill shadow-2xs fw-bold text-dark"
                                                onClick={handleImportFromCommandBuilder}
                                                title="Import items currently in your Command Builder pockets"
                                            >
                                                <i className="fa-solid fa-file-import me-1"></i>
                                                Import Pockets
                                            </button>
                                            {formItems.length > 0 && (
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-danger rounded-pill fw-bold"
                                                    onClick={() => setFormItems([])}
                                                >
                                                    <i className="fa-solid fa-trash me-1"></i>
                                                    Clear
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* 2-Column Main Builder: [Slots Manager] vs [Explorer Catalog Picker] */}
                                    <div className="row g-4">
                                        {/* LEFT: Current Bundle Slots List */}
                                        <div className="col-lg-5">
                                            <div className="bg-white rounded-4 border p-3 shadow-sm h-100 d-flex flex-column">
                                                <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
                                                    <div>
                                                        <strong className="text-dark small d-block">Bundle Contents</strong>
                                                        <span className="tiny-text text-muted">{formItems.length} unique items selected</span>
                                                    </div>
                                                    <span className={`badge rounded-pill px-3 py-2 fw-bold ${currentSlotsCount > maxSlots ? 'bg-danger text-white' : 'bg-nook-green text-white'}`}>
                                                        {currentSlotsCount} / {maxSlots} Slots
                                                    </span>
                                                </div>

                                                {formItems.length === 0 ? (
                                                    <div className="text-center py-5 text-muted my-auto">
                                                        <i className="fa-solid fa-basket-shopping fs-1 mb-2 opacity-25"></i>
                                                        <p className="small mb-1 fw-bold">Bundle is empty</p>
                                                        <p className="tiny-text mb-0">Click any item from the explorer catalog on the right to add it!</p>
                                                    </div>
                                                ) : (
                                                    <div className="d-flex flex-column gap-2 overflow-auto flex-grow-1 pe-1" style={{ maxHeight: '420px' }}>
                                                        {formItems.map((item, idx) => (
                                                            <div key={`${item.itemId}-${idx}`} className="d-flex align-items-center justify-content-between p-2 rounded-3 bg-light border">
                                                                <div className="d-flex align-items-center gap-2 min-w-0">
                                                                    <div className="ratio ratio-1x1 rounded-2 bg-white border flex-shrink-0" style={{ width: '38px', height: '38px', overflow: 'hidden' }}>
                                                                        <img
                                                                            src={item.image || FALLBACK_IMAGE}
                                                                            alt={item.name}
                                                                            className="w-100 h-100 object-fit-contain p-1"
                                                                            onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = FALLBACK_IMAGE; }}
                                                                        />
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <strong className="small text-dark d-block text-truncate" title={item.name}>
                                                                            {item.name}
                                                                        </strong>
                                                                        <div className="d-flex flex-wrap align-items-center gap-1 mt-1">
                                                                            <span className="badge bg-dark font-monospace text-white py-0 px-1" style={{ fontSize: '0.62rem' }}>
                                                                                HEX: {generateFullItemHex(item.itemId, item.variantId, item.category)}
                                                                            </span>
                                                                            <span className="tiny-text text-muted text-truncate" style={{ fontSize: '0.68rem' }}>
                                                                                {item.category}{item.variantLabel ? ` · ${item.variantLabel}` : ''}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* Quantity Stepper */}
                                                                <div className="d-flex align-items-center gap-1 flex-shrink-0 ms-2">
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-sm btn-white border rounded-circle p-0 d-flex align-items-center justify-content-center"
                                                                        style={{ width: '24px', height: '24px' }}
                                                                        onClick={() => handleUpdateItemQuantity(idx, -1)}
                                                                    >
                                                                        -
                                                                    </button>
                                                                    <span className="badge bg-dark text-white rounded-pill px-2 py-1 x-small fw-bold">
                                                                        ×{item.quantity}
                                                                    </span>
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-sm btn-white border rounded-circle p-0 d-flex align-items-center justify-content-center"
                                                                        style={{ width: '24px', height: '24px' }}
                                                                        onClick={() => handleUpdateItemQuantity(idx, 1)}
                                                                    >
                                                                        +
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-sm btn-link text-danger p-0 ms-1"
                                                                        onClick={() => handleRemoveItem(idx)}
                                                                        title="Remove from bundle"
                                                                    >
                                                                        <i className="fa-solid fa-trash-can x-small"></i>
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* RIGHT: Visual Explorer Catalog Browser */}
                                        <div className="col-lg-7">
                                            <div className="bg-white rounded-4 border p-3 shadow-sm h-100 d-flex flex-column">
                                                {/* Search & Category Pills */}
                                                <div className="mb-3">
                                                    <div className="position-relative mb-2">
                                                        <input
                                                            type="text"
                                                            className="form-control form-control-sm rounded-pill ps-4 border"
                                                            placeholder="Search items from catalog (e.g. Royal Crown, Golden Tool)..."
                                                            value={explorerSearch}
                                                            onChange={(e) => setExplorerSearch(e.target.value)}
                                                        />
                                                        <i className="fa-solid fa-magnifying-glass position-absolute top-50 start-0 translate-middle-y ms-3 text-muted x-small"></i>
                                                    </div>

                                                    <div className="d-flex flex-wrap gap-1">
                                                        {CATALOG_CATEGORIES.map((cat) => (
                                                            <button
                                                                key={cat}
                                                                type="button"
                                                                className={`btn btn-xs rounded-pill fw-bold px-2 py-1 ${
                                                                    explorerCategory === cat ? 'btn-dark text-white' : 'btn-light border text-muted'
                                                                }`}
                                                                style={{ fontSize: '0.72rem' }}
                                                                onClick={() => setExplorerCategory(cat)}
                                                            >
                                                                {cat}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Selected Item Variation Picker (if multi-variant) */}
                                                {selectedCatalogItem && (selectedCatalogItem.variations?.length ?? 0) > 1 && (
                                                    <div className="p-3 bg-light rounded-3 border mb-3">
                                                        <div className="d-flex align-items-center justify-content-between mb-2">
                                                            <strong className="small text-dark">Pick Variation for "{selectedCatalogItem.name}"</strong>
                                                            <button type="button" className="btn-close btn-close-white small" onClick={() => setSelectedCatalogItem(null)} />
                                                        </div>
                                                        <div className="d-flex flex-wrap gap-2 overflow-auto" style={{ maxHeight: '100px' }}>
                                                            {selectedCatalogItem.variations?.map((variant, vIdx) => (
                                                                <button
                                                                    key={vIdx}
                                                                    type="button"
                                                                    className="btn btn-sm btn-white border rounded-pill d-flex align-items-center gap-1 p-1 pe-2 shadow-2xs"
                                                                    onClick={() => {
                                                                        handleAddCatalogItem(selectedCatalogItem, variant);
                                                                    }}
                                                                >
                                                                    <img
                                                                        src={(variant.imageUrl || selectedCatalogItem.image || FALLBACK_IMAGE) as string}
                                                                        alt={getVariantLabel(variant) || 'Variant'}
                                                                        style={{ width: '22px', height: '22px', objectFit: 'contain' }}
                                                                    />
                                                                    <span className="tiny-text fw-bold">{getVariantLabel(variant) || 'Default'}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Catalog Items Grid */}
                                                <div className="flex-grow-1 overflow-auto pe-1" style={{ maxHeight: '360px' }}>
                                                    {catalogLoading ? (
                                                        <div className="text-center py-5 text-muted">
                                                            <div className="spinner-border spinner-border-sm text-success me-2" />
                                                            Loading catalog items...
                                                        </div>
                                                    ) : filteredCatalogItems.length === 0 ? (
                                                        <div className="text-center py-5 text-muted">
                                                            No matching items found.
                                                        </div>
                                                    ) : (
                                                        <div className="row g-2">
                                                            {filteredCatalogItems.map((item) => {
                                                                const hasVariants = (item.variations?.length ?? 0) > 1;
                                                                return (
                                                                    <div key={item.id} className="col-6 col-md-4 col-xl-3">
                                                                        <div
                                                                            className="card rounded-3 p-2 border h-100 transition-all hover-shadow bg-light d-flex flex-column align-items-center text-center cursor-pointer"
                                                                            onClick={() => {
                                                                                if (hasVariants) {
                                                                                    setSelectedCatalogItem(item);
                                                                                } else {
                                                                                    handleAddCatalogItem(item);
                                                                                }
                                                                            }}
                                                                            style={{ cursor: 'pointer' }}
                                                                        >
                                                                            <div className="ratio ratio-1x1 rounded-2 bg-white border mb-1 w-100" style={{ maxHeight: '64px', overflow: 'hidden' }}>
                                                                                <img
                                                                                    src={item.image || FALLBACK_IMAGE}
                                                                                    alt={item.name}
                                                                                    loading="lazy"
                                                                                    className="w-100 h-100 object-fit-contain p-1"
                                                                                    onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = FALLBACK_IMAGE; }}
                                                                                />
                                                                            </div>
                                                                            <strong className="tiny-text text-dark text-truncate w-100 d-block" title={item.name}>
                                                                                {item.name}
                                                                            </strong>
                                                                            <div className="d-flex align-items-center justify-content-center gap-1 my-1">
                                                                                <span className="badge bg-white text-dark border font-monospace" style={{ fontSize: '0.62rem' }}>
                                                                                    #{item.id}
                                                                                </span>
                                                                                <span className="x-small text-muted text-truncate" style={{ fontSize: '0.62rem' }}>
                                                                                    {hasVariants ? `${item.variations?.length} vars` : item.category || 'Item'}
                                                                                </span>
                                                                            </div>
                                                                            <button
                                                                                type="button"
                                                                                className="btn btn-xs btn-nook text-white rounded-pill mt-auto w-100 fw-bold py-0"
                                                                                style={{ fontSize: '0.65rem', minHeight: '20px' }}
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    if (hasVariants) {
                                                                                        setSelectedCatalogItem(item);
                                                                                    } else {
                                                                                        handleAddCatalogItem(item);
                                                                                    }
                                                                                }}
                                                                            >
                                                                                {hasVariants ? 'Variants →' : '+ Add'}
                                                                            </button>
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

                                    {/* Live SysBot Command String Preview */}
                                    {botCommandText && (
                                        <div className="bg-light rounded-4 border p-3 mt-3">
                                            <div className="d-flex align-items-center justify-content-between mb-1">
                                                <span className="tiny-text fw-bold text-muted text-uppercase">
                                                    <i className="fa-solid fa-terminal text-success me-1"></i>
                                                    SysBot Command Preview ({formItems.reduce((s, i) => s + (i.quantity || 1), 0)} items)
                                                </span>
                                                <button
                                                    type="button"
                                                    className={`btn btn-xs rounded-pill px-3 fw-bold ${copyCmdStatus ? 'btn-success text-white' : 'btn-white border text-dark'}`}
                                                    onClick={handleCopyBotCommand}
                                                >
                                                    <i className={`fa-solid ${copyCmdStatus ? 'fa-check' : 'fa-copy'} me-1`} />
                                                    {copyCmdStatus ? 'Copied!' : 'Copy Command'}
                                                </button>
                                            </div>
                                            <div className="font-monospace small bg-white p-2 rounded-3 border text-break text-dark select-all" style={{ maxHeight: '70px', overflowY: 'auto', fontSize: '0.78rem' }}>
                                                {botCommandText}
                                            </div>
                                        </div>
                                    )}

                                    {/* Modal Footer Buttons */}
                                    <div className="modal-footer border-0 bg-white px-0 pt-3 pb-0 d-flex justify-content-between mt-3">
                                        <button type="button" className="btn btn-outline-secondary rounded-pill px-4 fw-bold btn-sm" onClick={() => setEditModalOpen(false)}>
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="btn btn-nook text-white rounded-pill px-5 fw-bold shadow-sm"
                                            disabled={isSaving || formItems.length === 0}
                                        >
                                            {isSaving ? (
                                                <>
                                                    <span className="spinner-border spinner-border-sm me-2" role="status" />
                                                    Saving Official Bundle...
                                                </>
                                            ) : (
                                                <>
                                                    <i className="fa-solid fa-cloud-arrow-up me-2"></i>
                                                    Save Official Bundle to ChoBot
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Batch Paste & Parse Item Codes Modal */}
            {batchPasteModalOpen && (
                <div
                    className="modal fade show d-block"
                    tabIndex={-1}
                    role="dialog"
                    aria-modal="true"
                    style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(5px)', zIndex: 1070 }}
                >
                    <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
                        <div className="modal-content rounded-4 border-0 shadow-lg overflow-hidden">
                            <div className="modal-header border-0 bg-dark text-white px-4 py-3 d-flex align-items-center justify-content-between">
                                <div className="d-flex align-items-center gap-2">
                                    <div className="bg-success rounded-circle p-2 d-flex align-items-center justify-content-center" style={{ width: 34, height: 34 }}>
                                        <i className="fa-solid fa-paste text-white small"></i>
                                    </div>
                                    <div>
                                        <h5 className="modal-title fw-black mb-0">Batch Paste & Parse Item Codes</h5>
                                        <span className="tiny-text opacity-75">Auto-converts bot commands, multi-line hex lists, and item names</span>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    className="btn-close btn-close-white"
                                    aria-label="Close"
                                    onClick={() => setBatchPasteModalOpen(false)}
                                />
                            </div>

                            <div className="modal-body p-4 bg-light">
                                {/* Instructions & Example tags */}
                                <div className="mb-3">
                                    <label className="form-label fw-bold small text-dark d-flex align-items-center justify-content-between mb-1">
                                        <span>Paste Raw Item Codes or Bot Command:</span>
                                        <span className="tiny-text text-muted">Supports spaces, commas, line breaks, multipliers (1431x10)</span>
                                    </label>
                                    <textarea
                                        className="form-control font-monospace border-2 rounded-3 text-dark"
                                        rows={6}
                                        style={{ fontSize: '0.85rem' }}
                                        placeholder={"Paste here, for example:\n!order 1431 3438 0BF1 11F4\nor\n1431x10, 3438x5, Gold Nugget x10\nor\n1431\n3438\n0BF1"}
                                        value={batchPasteInput}
                                        onChange={(e) => setBatchPasteInput(e.target.value)}
                                        autoFocus
                                    />
                                </div>

                                {/* Quick Example Fillers */}
                                <div className="d-flex flex-wrap gap-1 align-items-center mb-3">
                                    <span className="tiny-text text-muted fw-bold me-1">Try Samples:</span>
                                    <button
                                        type="button"
                                        className="badge bg-white text-dark border rounded-pill px-2 py-1 x-small fw-bold cursor-pointer"
                                        onClick={() => setBatchPasteInput("!order 1431 3438 0BF1 1024 1025 09A2 09A3")}
                                    >
                                        Sample !order command
                                    </button>
                                    <button
                                        type="button"
                                        className="badge bg-white text-dark border rounded-pill px-2 py-1 x-small fw-bold cursor-pointer"
                                        onClick={() => setBatchPasteInput("3438x20, 1431x10, 0BF1x10")}
                                    >
                                        Multipliers (3438x20...)
                                    </button>
                                    <button
                                        type="button"
                                        className="badge bg-white text-dark border rounded-pill px-2 py-1 x-small fw-bold cursor-pointer"
                                        onClick={() => setBatchPasteInput("Royal Crown x10\nNook Miles Ticket x20\nGold Nugget x10")}
                                    >
                                        Item Names by Line
                                    </button>
                                </div>

                                {/* Live Parse Summary Box */}
                                <div className="bg-white rounded-4 border p-3 shadow-2xs mb-3">
                                    <div className="d-flex align-items-center justify-content-between mb-2">
                                        <div className="d-flex align-items-center gap-2">
                                            <span className={`badge rounded-pill px-3 py-1 fw-bold ${parsedBatchResult.items.length > 0 ? 'bg-success text-white' : 'bg-secondary text-white'}`}>
                                                {parsedBatchResult.items.length} Item Types
                                            </span>
                                            <span className={`badge rounded-pill px-3 py-1 fw-bold ${parsedBatchResult.totalSlots > (formTarget === 'drop' ? 9 : 40) ? 'bg-danger text-white' : 'bg-light text-dark border'}`}>
                                                {parsedBatchResult.totalSlots} Total Slots
                                            </span>
                                        </div>
                                        <span className="tiny-text text-muted fw-bold">
                                            {parsedBatchResult.parsedSummary}
                                        </span>
                                    </div>

                                    {/* Unrecognized warning if any */}
                                    {parsedBatchResult.unrecognizedTokens.length > 0 && (
                                        <div className="alert alert-warning py-1 px-3 mb-2 small rounded-3 d-flex align-items-center gap-2">
                                            <i className="fa-solid fa-triangle-exclamation text-warning"></i>
                                            <span className="tiny-text">Unrecognized tokens: {parsedBatchResult.unrecognizedTokens.slice(0, 5).join(', ')}{parsedBatchResult.unrecognizedTokens.length > 5 ? ` (+${parsedBatchResult.unrecognizedTokens.length - 5} more)` : ''}</span>
                                        </div>
                                    )}

                                    {/* Parsed Items Preview Chips */}
                                    {parsedBatchResult.items.length > 0 ? (
                                        <div className="d-flex flex-wrap gap-2" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                                            {parsedBatchResult.items.map((item, idx) => (
                                                <div key={idx} className="badge bg-light text-dark border rounded-pill px-3 py-2 d-flex align-items-center gap-2 shadow-2xs">
                                                    {item.image && (
                                                        <img src={item.image} alt={item.name} style={{ width: 20, height: 20, objectFit: 'contain' }} onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }} />
                                                    )}
                                                    <span className="font-monospace text-muted x-small">[{item.itemId}]</span>
                                                    <span className="fw-bold">{item.name}</span>
                                                    <span className="badge bg-dark text-white rounded-pill px-2">×{item.quantity}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-3 text-muted tiny-text">
                                            Type or paste item codes above to see instant preview.
                                        </div>
                                    )}
                                </div>

                                {/* Target options if opening standalone */}
                                {!editModalOpen && (
                                    <div className="row g-2 mb-2">
                                        <div className="col-md-6">
                                            <label className="form-label fw-bold tiny-text text-muted text-uppercase mb-1">Bundle Title (Optional)</label>
                                            <input
                                                type="text"
                                                className="form-control form-control-sm rounded-3"
                                                placeholder="e.g. Starter Wealth Pack"
                                                value={batchPasteBundleTitle}
                                                onChange={(e) => setBatchPasteBundleTitle(e.target.value)}
                                            />
                                        </div>
                                        <div className="col-md-3">
                                            <label className="form-label fw-bold tiny-text text-muted text-uppercase mb-1">Target</label>
                                            <select
                                                className="form-select form-select-sm rounded-3"
                                                value={batchPasteTarget}
                                                onChange={(e) => setBatchPasteTarget(e.target.value as 'order' | 'drop')}
                                            >
                                                <option value="order">Order Bot (40 Slots)</option>
                                                <option value="drop">Drop Bot (9 Slots)</option>
                                            </select>
                                        </div>
                                        <div className="col-md-3">
                                            <label className="form-label fw-bold tiny-text text-muted text-uppercase mb-1">Category</label>
                                            <select
                                                className="form-select form-select-sm rounded-3"
                                                value={batchPasteCategory}
                                                onChange={(e) => setBatchPasteCategory(e.target.value as PocketBundleCategory)}
                                            >
                                                {CATEGORIES.filter(c => c !== 'All').map(c => (
                                                    <option key={c} value={c}>{c}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="modal-footer border-0 bg-white px-4 py-3 d-flex justify-content-between">
                                <button
                                    type="button"
                                    className="btn btn-outline-secondary rounded-pill px-4 fw-bold btn-sm"
                                    onClick={() => setBatchPasteModalOpen(false)}
                                >
                                    Cancel
                                </button>

                                <div className="d-flex gap-2">
                                    {editModalOpen ? (
                                        <>
                                            <button
                                                type="button"
                                                className="btn btn-outline-success rounded-pill px-3 fw-bold btn-sm"
                                                disabled={parsedBatchResult.items.length === 0}
                                                onClick={() => handleApplyBatchPasteToEditor('append')}
                                            >
                                                + Append to Current ({parsedBatchResult.items.length})
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-nook text-white rounded-pill px-4 fw-bold btn-sm shadow-sm"
                                                disabled={parsedBatchResult.items.length === 0}
                                                onClick={() => handleApplyBatchPasteToEditor('replace')}
                                            >
                                                <i className="fa-solid fa-check me-1"></i>
                                                Replace Bundle Items ({parsedBatchResult.items.length})
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            type="button"
                                            className="btn btn-nook text-white rounded-pill px-4 fw-bold btn-sm shadow-sm"
                                            disabled={parsedBatchResult.items.length === 0}
                                            onClick={handleCreateBundleFromBatchPaste}
                                        >
                                            <i className="fa-solid fa-wand-magic-sparkles me-1"></i>
                                            Open in Visual Editor ({parsedBatchResult.items.length})
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DashboardBundles;
