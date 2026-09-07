import { useMemo, useState, useEffect, useCallback } from 'react';
import type { CatalogEntity } from '../data/commandBuilderData';
import { ITEMS } from '../data/commandBuilderData';
import { generateFullItemHex } from '../utils/commandBuilderHex';
import {
    maximizePocketStacks,
    fillRemainingPockets,
    sortPocketEntries,
    findRecipeIngredients,
} from '../utils/pocketOptimizer';
import banner from '../assets/banner.png';
import { getUserScopedItem, setUserScopedItem } from '../utils/accountStorage';

export type PocketItem = CatalogEntity & {
    baseId?: string | number | null;
    variantId?: string | number | null;
    variantLabel?: string | null;
};

export type PocketEntry = { item: PocketItem; quantity: number };

const ORDER_BOT_MAX = 40;
const DROP_BOT_MAX = 9;

const BUFFER_OPTIONS = {
    '16DB': { id: '16DB', name: 'Nook Miles Ticket', icon: 'https://dodo.ac/np/images/4/43/Nook_Miles_Ticket_NH_Inv_Icon.png' },
    '14BB': { id: '14BB', name: 'Royal Crown', icon: 'https://dodo.ac/np/images/c/c7/Royal_Crown_NH_Storage_Icon.png' },
    '08A4': { id: '08A4', name: '99,000 Bells', icon: 'https://dodo.ac/np/images/1/1e/99k_Bells_NH_Inv_Icon.png' },
};


const parsePocketEntries = (key: string, userId?: string | null): PocketEntry[] => {
    try {
        const saved = getUserScopedItem(key, userId);
        if (!saved) return [];
        const parsed = JSON.parse(saved);
        if (!Array.isArray(parsed)) return [];
        if (parsed.length > 0 && !parsed[0].item) {
            return parsed.map((item: PocketItem) => ({ item, quantity: 1 }));
        }
        return parsed.map((entry: PocketEntry) => ({
            item: entry.item,
            quantity: entry.item?.entityType === 'villager' ? 1 : (typeof entry.quantity === 'number' ? Math.max(1, entry.quantity) : 1),
        }));
    } catch {
        return [];
    }
};

// One-time migration: move old combined pocket data into order pockets
const migrateOldPockets = (): PocketEntry[] => {
    try {
        const legacy = localStorage.getItem('command_builder_selected_items');
        const alreadyMigrated = localStorage.getItem('command_builder_migrated_v2');
        if (!legacy || alreadyMigrated) return [];
        const entries = parsePocketEntries('command_builder_selected_items');
        localStorage.setItem('command_builder_migrated_v2', '1');
        localStorage.removeItem('command_builder_selected_items');
        return entries;
    } catch {
        return [];
    }
};

const getItemCommandId = (item: PocketItem) => {
    if (item.entityType === 'villager') {
        return `villager:${item.id}`;
    }
    return generateFullItemHex(item.baseId ?? item.id, item.variantId ?? 'NA', item.category);
};

export const useCommandBuilderPockets = () => {
    // Separate order and drop pocket lists — with one-time migration from old combined key
    const [orderItems, setOrderItems] = useState<PocketEntry[]>(() => {
        const migrated = migrateOldPockets();
        if (migrated.length > 0) return migrated;
        return parsePocketEntries('command_builder_order_items');
    });
    const [dropItems, setDropItems] = useState<PocketEntry[]>(() =>
        parsePocketEntries('command_builder_drop_items')
    );
    const [copyOrderStatus, setCopyOrderStatus] = useState('Copy order');
    const [copyDropStatus, setCopyDropStatus] = useState('Copy drop');

    // Persist to user-scoped localStorage
    useEffect(() => {
        setUserScopedItem('command_builder_order_items', JSON.stringify(orderItems));
    }, [orderItems]);

    useEffect(() => {
        setUserScopedItem('command_builder_drop_items', JSON.stringify(dropItems));
    }, [dropItems]);

    // Handle account switches cleanly so pocket items reset/reload for the switched account
    useEffect(() => {
        const handleAccountSwitch = (e: any) => {
            const newUid = e.detail?.newUserId;
            setOrderItems(parsePocketEntries('command_builder_order_items', newUid));
            setDropItems(parsePocketEntries('command_builder_drop_items', newUid));
        };
        window.addEventListener('chopaeng_account_switched', handleAccountSwitch);
        return () => window.removeEventListener('chopaeng_account_switched', handleAccountSwitch);
    }, []);



    // Counts
    const totalOrderItemsCount = orderItems
        .filter((p) => p.item.entityType !== 'villager')
        .reduce((acc, curr) => acc + curr.quantity, 0);
    const orderVillagerItem = orderItems.find((p) => p.item.entityType === 'villager');
    const orderVillager = orderVillagerItem ? orderVillagerItem.item : null;
    const totalOrderVillagersCount = orderVillager ? 1 : 0;

    const totalDropItemsCount = dropItems
        .filter((p) => p.item.entityType !== 'villager')
        .reduce((acc, curr) => acc + curr.quantity, 0);
    const dropVillagerItem = dropItems.find((p) => p.item.entityType === 'villager');
    const dropVillager = dropVillagerItem ? dropVillagerItem.item : null;
    const totalDropVillagersCount = dropVillager ? 1 : 0;

    // Total order count for regular 40-slot grid
    const totalOrderCount = totalOrderItemsCount;
    const totalDropCount = totalDropItemsCount;
    // Keep legacy alias for components that use totalItemsCount
    const totalItemsCount = totalOrderCount;

    const canIncrease = totalOrderItemsCount < ORDER_BOT_MAX;
    const canIncreaseOrder = totalOrderItemsCount < ORDER_BOT_MAX;
    const canIncreaseDrop = totalDropItemsCount < DROP_BOT_MAX;
    const canAddOrderVillager = !orderVillager;

    // ── Order pocket operations ────────────────────────────────────────────
    const decreaseOrderQuantity = useCallback((id: string) => {
        setOrderItems((prev) => {
            const existing = prev.find((p) => p.item.id === id);
            if (!existing) return prev;
            if (existing.quantity <= 1 || existing.item.entityType === 'villager') {
                return prev.filter((p) => p.item.id !== id);
            }
            return prev.map((pocket) => {
                if (pocket.item.id !== id) return pocket;
                return { ...pocket, quantity: pocket.quantity - 1 };
            });
        });
    }, []);

    const increaseOrderQuantity = useCallback((id: string) => {
        setOrderItems((prev) => {
            const pocket = prev.find((p) => p.item.id === id);
            if (!pocket) return prev;
            if (pocket.item.entityType === 'villager') return prev; // Villagers cannot have quantity > 1
            const regularCount = prev
                .filter((p) => p.item.entityType !== 'villager')
                .reduce((acc, curr) => acc + curr.quantity, 0);
            if (regularCount >= ORDER_BOT_MAX) return prev;
            return prev.map((p) => {
                if (p.item.id !== id) return p;
                return { ...p, quantity: p.quantity + 1 };
            });
        });
    }, []);

    const removeOrderItem = useCallback((id: string) => {
        setOrderItems((prev) => prev.filter((pocket) => pocket.item.id !== id));
    }, []);

    const removeOrderVillager = useCallback(() => {
        setOrderItems((prev) => prev.filter((pocket) => pocket.item.entityType !== 'villager'));
    }, []);

    // ── Drop pocket operations ─────────────────────────────────────────────
    const decreaseDropQuantity = useCallback((id: string) => {
        setDropItems((prev) => {
            const existing = prev.find((p) => p.item.id === id);
            if (!existing) return prev;
            if (existing.quantity <= 1 || existing.item.entityType === 'villager') {
                return prev.filter((p) => p.item.id !== id);
            }
            return prev.map((pocket) => {
                if (pocket.item.id !== id) return pocket;
                return { ...pocket, quantity: pocket.quantity - 1 };
            });
        });
    }, []);

    const increaseDropQuantity = useCallback((id: string) => {
        setDropItems((prev) => {
            const pocket = prev.find((p) => p.item.id === id);
            if (!pocket) return prev;
            if (pocket.item.entityType === 'villager') return prev; // Only 1 villager allowed
            const regularCount = prev
                .filter((p) => p.item.entityType !== 'villager')
                .reduce((acc, curr) => acc + curr.quantity, 0);
            if (regularCount >= DROP_BOT_MAX) return prev; // silently block; UI disables the button
            return prev.map((p) => {
                if (p.item.id !== id) return p;
                return { ...p, quantity: p.quantity + 1 };
            });
        });
    }, []);

    const removeDropItem = useCallback((id: string) => {
        setDropItems((prev) => prev.filter((pocket) => pocket.item.id !== id));
    }, []);

    const removeDropVillager = useCallback(() => {
        setDropItems((prev) => prev.filter((pocket) => pocket.item.entityType !== 'villager'));
    }, []);

    // ── Legacy aliases (used by some pages still referencing old API) ──────
    const decreaseQuantity = decreaseOrderQuantity;
    const increaseQuantity = increaseOrderQuantity;
    const removeItem = removeOrderItem;

    // ── Add to pockets ─────────────────────────────────────────────────────
    const addItemToOrderPockets = useCallback((item: PocketItem): { success: boolean; message: string } => {
        if (item.entityType === 'villager') {
            let message = `${item.name} added to Order as moving-in Villager (1/1)!`;
            let success = true;
            setOrderItems((prev) => {
                const existingVillager = prev.find((p) => p.item.entityType === 'villager');
                if (existingVillager && existingVillager.item.id === item.id) {
                    message = `${item.name} is already selected as your Order Villager.`;
                    success = false;
                    return prev;
                }
                if (existingVillager) {
                    message = `Replaced ${existingVillager.item.name} with ${item.name} in Order Villager box!`;
                }
                const withoutVillagers = prev.filter((p) => p.item.entityType !== 'villager');
                return [...withoutVillagers, { item, quantity: 1 }];
            });
            return { success, message };
        }

        // Regular item: check if 40 item slots are filled
        const regularCount = orderItems
            .filter((p) => p.item.entityType !== 'villager')
            .reduce((acc, curr) => acc + curr.quantity, 0);

        if (regularCount >= ORDER_BOT_MAX) {
            return { success: false, message: `Order item slots are full (${ORDER_BOT_MAX}/40 items). Remove an item first.` };
        }

        let message = `Added ${item.name} to Order pockets!`;
        let success = true;
        setOrderItems((prev) => {
            const existing = prev.find((p) => p.item.id === item.id);
            if (existing) {
                return prev.map((p) => (p.item.id === item.id ? { ...p, quantity: p.quantity + 1 } : p));
            }
            return [...prev, { item, quantity: 1 }];
        });
        return { success, message };
    }, [orderItems]);

    const addItemToDropPockets = useCallback((item: PocketItem): { success: boolean; message: string } => {
        if (item.entityType === 'villager') {
            let message = `${item.name} added to Drop pockets!`;
            let success = true;
            setDropItems((prev) => {
                const existingVillager = prev.find((p) => p.item.id === item.id);
                if (existingVillager) {
                    message = `${item.name} is already in Drop pockets.`;
                    success = false;
                    return prev;
                }
                return [...prev, { item, quantity: 1 }];
            });
            return { success, message };
        }

        const regularCount = dropItems
            .filter((p) => p.item.entityType !== 'villager')
            .reduce((acc, curr) => acc + curr.quantity, 0);

        if (regularCount >= DROP_BOT_MAX) {
            return { success: false, message: `Drop pockets are full (${DROP_BOT_MAX} items). Remove an item first.` };
        }

        let message = `Added ${item.name} to Drop pockets!`;
        let success = true;
        setDropItems((prev) => {
            const existing = prev.find((p) => p.item.id === item.id);
            if (existing) {
                return prev.map((p) => (p.item.id === item.id ? { ...p, quantity: p.quantity + 1 } : p));
            }
            return [...prev, { item, quantity: 1 }];
        });
        return { success, message };
    }, [dropItems]);

    // Legacy alias — adds to order by default
    const addItemToPockets = addItemToOrderPockets;

    // ── Fill helpers (order only) ──────────────────────────────────────────
    const fillWithItemName = useCallback((name: string) => {
        setOrderItems((prev) => {
            const regularCount = prev
                .filter((p) => p.item.entityType !== 'villager')
                .reduce((acc, curr) => acc + curr.quantity, 0);
            const remaining = ORDER_BOT_MAX - regularCount;
            if (remaining <= 0) return prev;

            const bufferOption = Object.values(BUFFER_OPTIONS).find((buffer) => buffer.name === name);
            let item: PocketItem | undefined;

            if (bufferOption) {
                item = {
                    id: bufferOption.id,
                    entityType: 'item',
                    name: bufferOption.name,
                    category: 'Currency',
                    theme: 'Buffer',
                    series: 'Buffer',
                    interactivity: 'Consumable',
                    colour: 'Various',
                    image: bufferOption.icon,
                    description: `${bufferOption.name} buffer item`,
                };
            } else {
                item = ITEMS.find((it) => it.name === name && it.entityType === 'item');
            }

            if (!item) return prev;

            const existing = prev.find((p) => p.item.id === item!.id);
            if (existing) {
                return prev.map((p) => (p.item.id === item!.id ? { ...p, quantity: p.quantity + remaining } : p));
            }
            return [...prev, { item, quantity: remaining }];
        });
    }, []);

    const handleFillTickets = useCallback(() => fillWithItemName('Nook Miles Ticket'), [fillWithItemName]);
    const handleFillCrowns = useCallback(() => fillWithItemName('Royal Crown'), [fillWithItemName]);
    const handleFillBells = useCallback(() => fillWithItemName('99,000 Bells'), [fillWithItemName]);

    // ── Smart Pocket Optimization Helpers ─────────────────────────────────
    const handleMaximizeStacks = useCallback(() => {
        setOrderItems((prev) => maximizePocketStacks(prev, ORDER_BOT_MAX));
    }, []);

    const handleFillRemaining = useCallback((type: 'nmt' | 'crowns' | 'bells' | 'gold' | 'repeat') => {
        setOrderItems((prev) => fillRemainingPockets(prev, type, ORDER_BOT_MAX));
    }, []);

    const handleSortPockets = useCallback(() => {
        setOrderItems((prev) => sortPocketEntries(prev));
    }, []);

    // ── Reorder helpers (used by drag-and-drop in VisualPocketGrid) ────────
    // `newOrder` is an ordered list of item IDs (with duplicates for multi-qty stacks)
    const reorderOrderPockets = useCallback((newOrder: string[]) => {
        setOrderItems((prev) => {
            // Build a map from id -> entry
            const entryMap = new Map<string, PocketEntry>();
            prev.forEach((p) => entryMap.set(p.item.id, p));

            // Count how many times each id appears in newOrder
            const quantityMap = new Map<string, number>();
            for (const id of newOrder) {
                quantityMap.set(id, (quantityMap.get(id) || 0) + 1);
            }

            // Rebuild ordered unique list preserving first-seen order
            const seen = new Set<string>();
            const result: PocketEntry[] = [];
            for (const id of newOrder) {
                if (!seen.has(id)) {
                    seen.add(id);
                    const entry = entryMap.get(id);
                    if (entry) {
                        result.push({ ...entry, quantity: quantityMap.get(id) || entry.quantity });
                    }
                }
            }
            return result;
        });
    }, []);

    const reorderDropPockets = useCallback((newOrder: string[]) => {
        setDropItems((prev) => {
            const entryMap = new Map<string, PocketEntry>();
            prev.forEach((p) => entryMap.set(p.item.id, p));

            const quantityMap = new Map<string, number>();
            for (const id of newOrder) {
                quantityMap.set(id, (quantityMap.get(id) || 0) + 1);
            }

            const seen = new Set<string>();
            const result: PocketEntry[] = [];
            for (const id of newOrder) {
                if (!seen.has(id)) {
                    seen.add(id);
                    const entry = entryMap.get(id);
                    if (entry) {
                        result.push({ ...entry, quantity: quantityMap.get(id) || entry.quantity });
                    }
                }
            }
            return result;
        });
    }, []);

    const handleLoadRecipeMaterials = useCallback((recipeName: string, multiplier: number = 1) => {
        const ingredients = findRecipeIngredients(recipeName);
        if (!ingredients || ingredients.length === 0) return;

        setOrderItems((prev) => {
            const currentEntries = [...prev];
            let currentTotal = currentEntries.reduce((acc, curr) => acc + curr.quantity, 0);

            for (const ing of ingredients) {
                if (currentTotal >= ORDER_BOT_MAX) break;
                const neededQuantity = Math.min(ing.quantity * multiplier, ORDER_BOT_MAX - currentTotal);
                if (neededQuantity <= 0) continue;

                const pocketItem: PocketItem = {
                    id: ing.id,
                    name: ing.name,
                    entityType: 'item',
                    category: 'Materials',
                    theme: 'Crafting',
                    series: 'Materials',
                    interactivity: 'Consumable',
                    colour: 'Various',
                    image: ing.image,
                    description: `${ing.name} crafting material`,
                    baseId: ing.id,
                };

                const existingIdx = currentEntries.findIndex((p) => p.item.id === ing.id);
                if (existingIdx >= 0) {
                    currentEntries[existingIdx] = {
                        ...currentEntries[existingIdx],
                        quantity: currentEntries[existingIdx].quantity + neededQuantity,
                    };
                } else {
                    currentEntries.push({ item: pocketItem, quantity: neededQuantity });
                }
                currentTotal += neededQuantity;
            }

            return currentEntries;
        });
    }, []);

    // ── Bundle & Share loaders ─────────────────────────────────────────────
    const loadBundleIntoOrder = useCallback((bundleItems: Array<{ itemId?: string; id?: string; name: string; quantity: number; category?: string; variantId?: string | number | null; variantLabel?: string | null; image?: string; entityType?: 'item' | 'villager' }>, mode: 'replace' | 'merge' = 'replace') => {
        setOrderItems((prev) => {
            const currentEntries: PocketEntry[] = mode === 'replace' ? [] : [...prev];
            let currentCount = currentEntries.reduce((acc, curr) => acc + curr.quantity, 0);

            for (const bItem of bundleItems) {
                if (currentCount >= ORDER_BOT_MAX) break;
                // itemId from pocketBundles is the explorer.json 'Internal ID' hex (= pokerId)
                const itemId = String(bItem.itemId || bItem.id || bItem.name);
                const quantityToAdd = Math.min(bItem.quantity || 1, ORDER_BOT_MAX - currentCount);
                if (quantityToAdd <= 0) continue;

                const pocketItem: PocketItem = {
                    id: itemId,
                    name: bItem.name,
                    entityType: bItem.entityType || 'item',
                    category: bItem.category || 'Misc',
                    theme: 'Standard',
                    series: 'General',
                    interactivity: 'Static',
                    colour: 'Various',
                    image: bItem.image || banner,
                    description: bItem.name,
                    // baseId is always the itemId (pokerId hex from explorer.json)
                    // variantId is the variation key (e.g. "0_0") or undefined/NA for no-variant items
                    baseId: itemId,
                    variantId: bItem.variantId ?? undefined,
                    variantLabel: bItem.variantLabel ?? undefined,
                };

                const existingIdx = currentEntries.findIndex((p) => p.item.id === itemId);
                if (existingIdx >= 0) {
                    currentEntries[existingIdx] = {
                        ...currentEntries[existingIdx],
                        quantity: currentEntries[existingIdx].quantity + quantityToAdd,
                    };
                } else {
                    currentEntries.push({ item: pocketItem, quantity: quantityToAdd });
                }
                currentCount += quantityToAdd;
            }

            return currentEntries;
        });
    }, []);

    const loadBundleIntoDrop = useCallback((bundleItems: Array<{ itemId?: string; id?: string; name: string; quantity: number; category?: string; variantId?: string | number | null; variantLabel?: string | null; image?: string; entityType?: 'item' | 'villager' }>, mode: 'replace' | 'merge' = 'replace') => {
        setDropItems((prev) => {
            const currentEntries: PocketEntry[] = mode === 'replace' ? [] : [...prev];
            let currentCount = currentEntries.reduce((acc, curr) => acc + curr.quantity, 0);

            for (const bItem of bundleItems) {
                if (currentCount >= DROP_BOT_MAX) break;
                const itemId = String(bItem.itemId || bItem.id || bItem.name);
                const quantityToAdd = Math.min(bItem.quantity || 1, DROP_BOT_MAX - currentCount);
                if (quantityToAdd <= 0) continue;

                const pocketItem: PocketItem = {
                    id: itemId,
                    name: bItem.name,
                    entityType: bItem.entityType || 'item',
                    category: bItem.category || 'Misc',
                    theme: 'Standard',
                    series: 'General',
                    interactivity: 'Static',
                    colour: 'Various',
                    image: bItem.image || banner,
                    description: bItem.name,
                    // baseId is always the itemId (pokerId hex from explorer.json)
                    baseId: itemId,
                    variantId: bItem.variantId ?? undefined,
                    variantLabel: bItem.variantLabel ?? undefined,
                };

                const existingIdx = currentEntries.findIndex((p) => p.item.id === itemId);
                if (existingIdx >= 0) {
                    currentEntries[existingIdx] = {
                        ...currentEntries[existingIdx],
                        quantity: currentEntries[existingIdx].quantity + quantityToAdd,
                    };
                } else {
                    currentEntries.push({ item: pocketItem, quantity: quantityToAdd });
                }
                currentCount += quantityToAdd;
            }

            return currentEntries;
        });
    }, []);

    const loadSharedPocket = useCallback((sharedData: { orderItems?: any[]; dropItems?: any[] }) => {
        if (Array.isArray(sharedData.orderItems) && sharedData.orderItems.length > 0) {
            loadBundleIntoOrder(sharedData.orderItems, 'replace');
        }
        if (Array.isArray(sharedData.dropItems) && sharedData.dropItems.length > 0) {
            loadBundleIntoDrop(sharedData.dropItems, 'replace');
        }
    }, [loadBundleIntoOrder, loadBundleIntoDrop]);

    // ── Command text ───────────────────────────────────────────────────────
    const orderItemsOnlyCommand = useMemo(() => {
        const regularItems = orderItems.filter((p) => p.item.entityType !== 'villager');
        if (regularItems.length === 0) return '';
        const itemsList = regularItems.flatMap((p) => Array(p.quantity).fill(getItemCommandId(p.item))).join(' ');
        return itemsList ? `!order ${itemsList}` : '';
    }, [orderItems]);

    const orderVillagerCommand = useMemo(() => {
        const villager = orderItems.find((p) => p.item.entityType === 'villager');
        if (!villager) return '';
        return `!order villager:${villager.item.id}`;
    }, [orderItems]);

    const injectVillagerCommand = useMemo(() => {
        const villagers = dropItems.filter((p) => p.item.entityType === 'villager');
        if (villagers.length === 0) return '';
        const uniqueNames = Array.from(new Set(villagers.map((p) => p.item.name)));
        return `!injectvillager ${uniqueNames.join(' ')}`;
    }, [dropItems]);

    const mviVillagerCommand = useMemo(() => {
        const villagers = dropItems.filter((p) => p.item.entityType === 'villager');
        if (villagers.length === 0) return '';
        const uniqueNames = Array.from(new Set(villagers.map((p) => p.item.name)));
        return `!mvi ${uniqueNames.join(' ')}`;
    }, [dropItems]);

    const dropVillagerCommand = useMemo(() => {
        const villagers = dropItems.filter((p) => p.item.entityType === 'villager');
        if (villagers.length === 0) return '';
        const uniqueNames = Array.from(new Set(villagers.map((p) => p.item.name)));
        return uniqueNames.length === 1 ? `!injectvillager ${uniqueNames[0]}` : `!mvi ${uniqueNames.join(' ')}`;
    }, [dropItems]);

    const dropItemsOnlyCommand = useMemo(() => {
        const regularItems = dropItems.filter((p) => p.item.entityType !== 'villager');
        if (regularItems.length === 0) return '';
        const itemsList = regularItems
            .flatMap((p) => Array(p.quantity).fill(getItemCommandId(p.item)))
            .slice(0, DROP_BOT_MAX)
            .join(' ');
        return itemsList ? `!drop ${itemsList}` : '';
    }, [dropItems]);

    const orderCommandText = useMemo(() => {
        if (orderItems.length === 0) return '';
        const regularItems = orderItems.filter((p) => p.item.entityType !== 'villager');
        const villager = orderItems.find((p) => p.item.entityType === 'villager');

        // All regular item hexes FIRST
        const itemsList = regularItems.flatMap((p) => Array(p.quantity).fill(getItemCommandId(p.item)));
        // Moving-in villager token at the END
        const villagerList = villager ? [`villager:${villager.item.id}`] : [];

        const combined = [...itemsList, ...villagerList];
        return combined.length > 0 ? `!order ${combined.join(' ')}` : '';
    }, [orderItems]);

    const dropCommandText = useMemo(() => {
        const regularItems = dropItems.filter(p => p.item.entityType !== 'villager');
        const villagers = dropItems.filter(p => p.item.entityType === 'villager');

        let dropPart = '';
        if (regularItems.length > 0) {
            const itemsList = regularItems.flatMap((p) => Array(p.quantity).fill(getItemCommandId(p.item))).join(' ');
            dropPart = `!drop ${itemsList}`;
        }

        let villagerPart = '';
        const uniqueVillagerNames = Array.from(new Set(villagers.map(p => p.item.name)));
        if (uniqueVillagerNames.length === 1) {
            villagerPart = `!injectvillager ${uniqueVillagerNames[0]}`;
        } else if (uniqueVillagerNames.length > 1) {
            villagerPart = `!mvi ${uniqueVillagerNames.join(' ')}`;
        }

        if (dropPart && villagerPart) return `${dropPart}\n${villagerPart}`;
        return dropPart || villagerPart;
    }, [dropItems]);

    // ── Copy handlers ──────────────────────────────────────────────────────
    const handleCopyOrder = useCallback(async () => {
        if (!orderCommandText) return;
        try {
            await navigator.clipboard.writeText(orderCommandText);
            setCopyOrderStatus('Copied!');
            setTimeout(() => setCopyOrderStatus('Copy order'), 1300);
        } catch (error) {
            console.error(error);
            setCopyOrderStatus('Error');
            setTimeout(() => setCopyOrderStatus('Copy order'), 1300);
        }
    }, [orderCommandText]);

    const handleCopyDrop = useCallback(async () => {
        if (!dropCommandText) return;
        try {
            await navigator.clipboard.writeText(dropCommandText);
            setCopyDropStatus('Copied!');
            setTimeout(() => setCopyDropStatus('Copy drop'), 1300);
        } catch (error) {
            console.error(error);
            setCopyDropStatus('Error');
            setTimeout(() => setCopyDropStatus('Copy drop'), 1300);
        }
    }, [dropCommandText]);



    // ── Flip & Copy between Order & Drop ──────────────────────────────────
    const handleFlipOrderAndDrop = useCallback(() => {
        setOrderItems((prevOrder) => {
            const newOrder: PocketEntry[] = [];
            let orderCount = 0;
            for (const entry of dropItems) {
                if (orderCount >= ORDER_BOT_MAX) break;
                const qty = Math.min(entry.quantity, ORDER_BOT_MAX - orderCount);
                if (qty > 0) {
                    newOrder.push({ ...entry, quantity: qty });
                    orderCount += qty;
                }
            }

            setDropItems(() => {
                const newDrop: PocketEntry[] = [];
                let dropCount = 0;
                for (const entry of prevOrder) {
                    if (dropCount >= DROP_BOT_MAX) break;
                    const qty = Math.min(entry.quantity, DROP_BOT_MAX - dropCount);
                    if (qty > 0) {
                        newDrop.push({ ...entry, quantity: qty });
                        dropCount += qty;
                    }
                }
                return newDrop;
            });

            return newOrder;
        });
    }, [dropItems]);

    const handleCopyOrderToDrop = useCallback(() => {
        setDropItems(() => {
            const newDrop: PocketEntry[] = [];
            let dropCount = 0;
            for (const entry of orderItems) {
                if (dropCount >= DROP_BOT_MAX) break;
                const qty = Math.min(entry.quantity, DROP_BOT_MAX - dropCount);
                if (qty > 0) {
                    newDrop.push({ ...entry, quantity: qty });
                    dropCount += qty;
                }
            }
            return newDrop;
        });
    }, [orderItems]);

    const handleCopyDropToOrder = useCallback(() => {
        setOrderItems((prevOrder) => {
            const newOrder = [...prevOrder];
            let currentCount = newOrder.reduce((acc, curr) => acc + curr.quantity, 0);
            for (const entry of dropItems) {
                if (currentCount >= ORDER_BOT_MAX) break;
                const neededQty = Math.min(entry.quantity, ORDER_BOT_MAX - currentCount);
                if (neededQty <= 0) continue;
                const existing = newOrder.find((p) => p.item.id === entry.item.id);
                if (existing) {
                    existing.quantity += neededQty;
                } else {
                    newOrder.push({ ...entry, quantity: neededQty });
                }
                currentCount += neededQty;
            }
            return newOrder;
        });
    }, [dropItems]);

    // ── Quantity lookup ────────────────────────────────────────────────────
    const getOrderPocketQuantity = useCallback((itemId: string) => {
        return orderItems.find((p) => p.item.id === itemId)?.quantity ?? 0;
    }, [orderItems]);

    const getDropPocketQuantity = useCallback((itemId: string) => {
        return dropItems.find((p) => p.item.id === itemId)?.quantity ?? 0;
    }, [dropItems]);

    const getPocketQuantity = getOrderPocketQuantity;

    return {
        // State
        orderItems,
        setOrderItems,
        dropItems,
        setDropItems,
        // Legacy alias for pages that haven't been updated
        selectedItems: orderItems,
        setSelectedItems: setOrderItems,

        // Counts
        totalOrderCount,
        totalDropCount,
        totalItemsCount,
        totalOrderItemsCount,
        totalOrderVillagersCount,
        totalDropItemsCount,
        totalDropVillagersCount,

        // Villager helpers
        orderVillager,
        dropVillager,
        canAddOrderVillager,
        removeOrderVillager,
        removeDropVillager,

        // Can-increase flags
        canIncrease,
        canIncreaseOrder,
        canIncreaseDrop,

        // Order operations
        decreaseOrderQuantity,
        increaseOrderQuantity,
        removeOrderItem,

        // Drop operations
        decreaseDropQuantity,
        increaseDropQuantity,
        removeDropItem,

        // Legacy aliases
        decreaseQuantity,
        increaseQuantity,
        removeItem,

        // Add to pocket
        addItemToOrderPockets,
        addItemToDropPockets,
        addItemToPockets,

        // Fill helpers
        handleFillTickets,
        handleFillCrowns,
        handleFillBells,

        // Smart Pocket Optimization
        handleMaximizeStacks,
        handleFillRemaining,
        handleSortPockets,
        handleLoadRecipeMaterials,

        // Flip & Copy
        handleFlipOrderAndDrop,
        handleCopyOrderToDrop,
        handleCopyDropToOrder,

        // Reorder (drag-and-drop)
        reorderOrderPockets,
        reorderDropPockets,

        // Bundle & Share loaders
        loadBundleIntoOrder,
        loadBundleIntoDrop,
        loadSharedPocket,

        orderCommandText,
        dropCommandText,
        orderItemsOnlyCommand,
        orderVillagerCommand,
        injectVillagerCommand,
        mviVillagerCommand,
        dropItemsOnlyCommand,
        dropVillagerCommand,

        copyOrderStatus,
        copyDropStatus,

        handleCopyOrder,
        handleCopyDrop,

        // Lookup
        getPocketQuantity,
        getOrderPocketQuantity,
        getDropPocketQuantity,
    };
};
