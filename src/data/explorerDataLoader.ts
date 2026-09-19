import type { CatalogEntity } from './commandBuilderData';

export interface ExplorerItem {
    Name: string;
    Category: string;
    'Internal ID': string;
    Buy: string;
    Sell: string;
    Source?: string;
    HHA?: string;
    HHA2?: string;
    Interact?: string;
    Series?: string;
    ExchangePrice?: string;
    ExchangeCurrency?: string;
    StackSize?: string;
    DIY?: string;
    SeasonEvent?: string;
    Description?: string;
    CatchPhrase?: string;
    Genuine?: string;
    ItemTag?: string;
    FossilGroup?: string;
    Colours?: string[];
    BodyTitle?: string;
    PatternTitle?: string;
    Variations?: Array<{
        Variation?: string;
        Pattern?: string;
        id?: string;
        pokerId?: string;
        Filename?: string;
        imageUrl?: string;
        Colours?: string[];
        uniqueEntryId?: string;
    }>;
}

const FALLBACK_IMAGE = 'https://acnhcdn.com/latest/FtrIcon/FtrLeaf.png';

const ACRONYMS = new Set(['DIY', 'NMT', 'TV', 'KK', 'K.K.', 'DJ', 'NPC', 'ACNH', 'OK', 'LED', 'LCD', 'HHA', 'CJ', 'C.J.']);

export const toTitleCase = (str?: string | null): string => {
    if (!str) return '';
    return str
        .split(' ')
        .map((word) => {
            if (!word) return '';
            const clean = word.replace(/[^a-zA-Z]/g, '').toUpperCase();
            if (ACRONYMS.has(clean)) return word.toUpperCase();
            if (word.startsWith('(') && word.endsWith(')')) {
                const inner = word.slice(1, -1);
                return `(${inner.charAt(0).toUpperCase() + inner.slice(1)})`;
            }
            return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join(' ');
};

let _cachedCatalogItems: CatalogEntity[] | null = null;

export const loadExplorerItems = async (): Promise<CatalogEntity[]> => {
    if (_cachedCatalogItems) {
        return _cachedCatalogItems;
    }

    try {
        // Items.json is served as a static public asset (/Items.json) rather than
        // bundled, to stay under the Cloudflare Workers 25 MiB per-asset limit.
        const [itemsRes, recipesMod, creaturesMod, reactionsMod, constructionMod, achievementsMod] = await Promise.all([
            fetch('/Items.json').then((r) => r.json()),
            import('@bitress/animal-crossing/lib/data/Recipes.json'),
            import('@bitress/animal-crossing/lib/data/Creatures.json'),
            import('@bitress/animal-crossing/lib/data/Reactions.json'),
            import('@bitress/animal-crossing/lib/data/Construction.json'),
            import('@bitress/animal-crossing/lib/data/Achievements.json'),
        ]);
        const items = itemsRes as any[];
        const recipes = (recipesMod.default || recipesMod) as any[];
        const creatures = (creaturesMod.default || creaturesMod) as any[];
        const reactions = (reactionsMod.default || reactionsMod) as any[];
        const construction = (constructionMod.default || constructionMod) as any[];
        const achievements = (achievementsMod.default || achievementsMod) as any[];

        const allCatalog: CatalogEntity[] = [];

        // 1. Regular Items (Furniture, Clothing, Tools, Music, Photos, Posters, Rugs, Walls, Floors, etc.)
        if (Array.isArray(items)) {
            for (const item of items) {
                const firstVar = item.variations?.[0];
                const intId = item.internalId ?? firstVar?.internalId;
                const rawHexId = intId != null
                    ? intId.toString(16).toUpperCase().padStart(4, '0')
                    : item.name.toLowerCase().replace(/[^a-z0-9]/g, '_');

                const primaryImage = item.image
                    || item.inventoryImage
                    || item.storageImage
                    || firstVar?.image
                    || firstVar?.storageImage
                    || firstVar?.closetImage
                    || FALLBACK_IMAGE;

                const mappedVariations = item.variations?.map((v: any) => {
                    const vHex = v.internalId != null
                        ? v.internalId.toString(16).toUpperCase().padStart(4, '0')
                        : rawHexId;
                    return {
                        id: v.variantId ? String(v.variantId) : (v.internalId != null ? v.internalId.toString(16).toUpperCase().padStart(4, '0') : undefined),
                        pokerId: vHex,
                        imageUrl: v.image || v.storageImage || v.closetImage || primaryImage,
                        Variation: v.variation != null ? toTitleCase(String(v.variation)) : undefined,
                        Pattern: v.pattern != null ? toTitleCase(String(v.pattern)) : undefined,
                        Colours: Array.isArray(v.colors) ? v.colors.map((c: any) => toTitleCase(String(c))) : [],
                        uniqueEntryId: v.uniqueEntryId,
                    };
                }) || [];

                allCatalog.push({
                    id: rawHexId,
                    name: toTitleCase(item.name),
                    entityType: 'item',
                    category: item.sourceSheet ? String(item.sourceSheet) : 'Miscellaneous',
                    theme: item.hhaCategory ? toTitleCase(String(item.hhaCategory)) : item.tag ? toTitleCase(String(item.tag)) : 'Standard',
                    series: item.series ? toTitleCase(String(item.series)) : 'General',
                    interactivity: item.interact ? 'Interactive' : 'Static',
                    colour: item.colors?.[0] ? toTitleCase(String(item.colors[0])) : 'Various',
                    image: primaryImage,
                    description: item.description?.[0] || `A ${item.sourceSheet || 'catalog item'} in Animal Crossing: New Horizons.`,
                    variations: mappedVariations,
                    unorderable: false,
                    buy: item.buy != null && item.buy > 0 ? item.buy : null,
                    sell: item.sell != null && item.sell > 0 ? item.sell : null,
                    source: item.source ? item.source.map(toTitleCase) : [],
                    sourceNotes: item.sourceNotes ? item.sourceNotes.map(String) : [],
                    seasonEvent: item.seasonEvent ? toTitleCase(item.seasonEvent) : null,
                    tag: item.tag ? toTitleCase(item.tag) : undefined,
                    size: item.size ? String(item.size) : undefined,
                    surface: !!item.surface,
                    diy: !!item.diy,
                });
            }
        }

        // 2. DIY & Cooking Recipes (Ordered as 16-character hex cards in SysBot)
        if (Array.isArray(recipes)) {
            for (const recipe of recipes) {
                const recipeHex = recipe.internalId != null
                    ? recipe.internalId.toString(16).toUpperCase().padStart(4, '0')
                    : '0000';
                // SysBot recipe card item code: 0000<recipeHex>000016A2
                const recipeId = `0000${recipeHex}000016A2`;

                const materialsText = recipe.materials
                    ? Object.entries(recipe.materials).map(([mat, qty]) => `${qty}x ${toTitleCase(mat)}`).join(', ')
                    : '';

                allCatalog.push({
                    id: recipeId,
                    name: `${toTitleCase(recipe.name)} (Recipe)`,
                    entityType: 'item',
                    category: 'Recipes',
                    theme: recipe.category ? toTitleCase(String(recipe.category)) : 'DIY Recipe',
                    series: recipe.seasonEvent ? toTitleCase(String(recipe.seasonEvent)) : 'Recipe',
                    interactivity: 'Interactive',
                    colour: recipe.cardColor ? toTitleCase(String(recipe.cardColor)) : 'Yellow',
                    image: recipe.image || FALLBACK_IMAGE,
                    description: materialsText
                        ? `DIY Recipe card for crafting ${toTitleCase(recipe.name)}. Materials: ${materialsText}.`
                        : `DIY Recipe card for crafting ${toTitleCase(recipe.name)}.`,
                    variations: [],
                    unorderable: false,
                    materials: recipe.materials || undefined,
                    craftedItemName: recipe.name ? toTitleCase(recipe.name) : undefined,
                    cardColor: recipe.cardColor ? toTitleCase(recipe.cardColor) : undefined,
                    source: recipe.source ? recipe.source.map(toTitleCase) : ['Crafting'],
                    seasonEvent: recipe.seasonEvent ? toTitleCase(recipe.seasonEvent) : null,
                    buy: recipe.buy != null && recipe.buy > 0 ? recipe.buy : null,
                    sell: recipe.sell != null && recipe.sell > 0 ? recipe.sell : null,
                });
            }
        }

        // 3. Creatures (Insects, Fish, Sea Creatures)
        if (Array.isArray(creatures)) {
            for (const creature of creatures) {
                const creatureHex = creature.internalId != null
                    ? creature.internalId.toString(16).toUpperCase().padStart(4, '0')
                    : `creature_${creature.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

                const primaryImage = creature.iconImage
                    || creature.critterpediaImage
                    || creature.furnitureImage
                    || FALLBACK_IMAGE;

                allCatalog.push({
                    id: creatureHex,
                    name: toTitleCase(creature.name),
                    entityType: 'item',
                    category: creature.sourceSheet ? String(creature.sourceSheet) : 'Creatures',
                    theme: creature.hhaCategory ? toTitleCase(String(creature.hhaCategory)) : 'Creatures',
                    series: creature.sourceSheet ? String(creature.sourceSheet) : 'Creatures',
                    interactivity: 'Interactive',
                    colour: creature.colors?.[0] ? toTitleCase(String(creature.colors[0])) : 'Various',
                    image: primaryImage,
                    description: creature.description?.[0] || creature.catchPhrase?.[0] || `A ${toTitleCase(creature.name)} in Animal Crossing: New Horizons.`,
                    variations: [],
                    unorderable: false,
                    catchPhrase: creature.catchPhrase?.[0] || undefined,
                    shadow: creature.shadow ? String(creature.shadow) : undefined,
                    movementSpeed: creature.movementSpeed ? String(creature.movementSpeed) : undefined,
                    sell: creature.sell != null && creature.sell > 0 ? creature.sell : null,
                    buy: null,
                    source: [creature.sourceSheet || 'Nature'],
                });
            }
        }

        // 4. Reactions (Reference only, unorderable)
        if (Array.isArray(reactions)) {
            for (const reaction of reactions) {
                const reactionId = `reaction_${reaction.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
                allCatalog.push({
                    id: reactionId,
                    name: toTitleCase(reaction.name),
                    entityType: 'item',
                    category: 'Reactions',
                    theme: 'Reaction',
                    series: reaction.source?.[0] ? toTitleCase(String(reaction.source[0])) : 'Reaction',
                    interactivity: 'Interactive',
                    colour: 'Yellow',
                    image: reaction.image || FALLBACK_IMAGE,
                    description: `A reaction emotion: ${toTitleCase(reaction.name)} in Animal Crossing: New Horizons.`,
                    variations: [],
                    unorderable: true,
                    source: reaction.source ? reaction.source.map(toTitleCase) : ['Reactions'],
                });
            }
        }

        // 5. Construction (Reference only, unorderable)
        if (Array.isArray(construction)) {
            for (const item of construction) {
                const itemName = toTitleCase(item.name || 'Construction Component');
                const constId = `construction_${itemName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
                allCatalog.push({
                    id: constId,
                    name: itemName,
                    entityType: 'item',
                    category: item.sourceSheet ? String(item.sourceSheet) : 'Construction',
                    theme: item.category ? toTitleCase(String(item.category)) : 'Construction',
                    series: item.sourceSheet ? String(item.sourceSheet) : 'Construction',
                    interactivity: 'Static',
                    colour: 'Various',
                    image: item.image || FALLBACK_IMAGE,
                    description: `Island construction customization: ${itemName}.`,
                    variations: [],
                    unorderable: true,
                    buy: item.buy != null && item.buy > 0 ? item.buy : null,
                    source: ['Resident Services'],
                });
            }
        }

        // 6. Achievements (Reference only, unorderable)
        if (Array.isArray(achievements)) {
            for (const ach of achievements) {
                const achId = `achievement_${ach.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
                allCatalog.push({
                    id: achId,
                    name: toTitleCase(ach.name),
                    entityType: 'item',
                    category: 'Achievements',
                    theme: 'Nook Miles',
                    series: 'Achievement',
                    interactivity: 'Static',
                    colour: 'Yellow',
                    image: FALLBACK_IMAGE,
                    description: ach.achievementDescription || `Nook Miles Stamp Achievement: ${toTitleCase(ach.name)}.`,
                    variations: [],
                    unorderable: true,
                    source: ['NookPhone App'],
                });
            }
        }

        _cachedCatalogItems = allCatalog;
        return allCatalog;
    } catch (error) {
        console.error('Failed to load items from @bitress/animal-crossing:', error);
        return [];
    }
};

export const fetchExplorerData = async (): Promise<any> => {
    return loadExplorerItems();
};
