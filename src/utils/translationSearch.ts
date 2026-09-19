/**
 * Multi-language translation lookup for ACNH catalogue items.
 * Builds a reverse index from translated names → item IDs for cross-language search.
 */

export interface TranslationLanguage {
    code: string;
    label: string;
    flag: string; // Font Awesome class or emoji fallback
}

export const SUPPORTED_LANGUAGES: TranslationLanguage[] = [
    { code: 'en', label: 'English', flag: 'us' },
    { code: 'jPja', label: '日本語', flag: 'jp' },
    { code: 'kRko', label: '한국어', flag: 'kr' },
    { code: 'cNzh', label: '简体中文', flag: 'cn' },
    { code: 'tWzh', label: '繁體中文', flag: 'tw' },
    { code: 'eUde', label: 'Deutsch', flag: 'de' },
    { code: 'eUfr', label: 'Français', flag: 'fr' },
    { code: 'eUes', label: 'Español', flag: 'es' },
    { code: 'eUit', label: 'Italiano', flag: 'it' },
    { code: 'eUnl', label: 'Nederlands', flag: 'nl' },
    { code: 'eUru', label: 'Русский', flag: 'ru' },
];

export type TranslationIndex = Map<string, { name: string; translatedName: string }[]>;

let _cachedIndex: Map<string, TranslationIndex> | null = null;

/**
 * Build a reverse lookup index: for each language, maps lowercase translated name → item name(s).
 * This is built lazily and cached.
 */
export const buildTranslationIndex = async (): Promise<Map<string, TranslationIndex>> => {
    if (_cachedIndex) return _cachedIndex;

    // Items-translations.json is a build-time-generated static asset containing only
    // { name, translations } per item, served from public/ to stay under the
    // Cloudflare Workers 25 MiB per-asset limit.
    const items = await fetch('/Items-translations.json').then((r) => r.json()) as any[];
    const index = new Map<string, TranslationIndex>();

    for (const lang of SUPPORTED_LANGUAGES) {
        if (lang.code === 'en') continue; // English is default, skip
        index.set(lang.code, new Map());
    }

    for (const item of items as any[]) {
        if (!item.translations) continue;
        const enName = item.name || item.translations?.uSen || item.translations?.eUen || '';

        for (const lang of SUPPORTED_LANGUAGES) {
            if (lang.code === 'en') continue;
            const translatedName = item.translations[lang.code];
            if (!translatedName || typeof translatedName !== 'string') continue;

            const langIndex = index.get(lang.code)!;
            const lowerTranslated = translatedName.toLowerCase();

            if (!langIndex.has(lowerTranslated)) {
                langIndex.set(lowerTranslated, []);
            }
            langIndex.get(lowerTranslated)!.push({ name: enName, translatedName });
        }
    }

    _cachedIndex = index;
    return index;
};

/**
 * Search items by translated name across all supported languages.
 * Returns matching English item names with the translation details.
 */
export const searchAllTranslations = (
    indexMap: Map<string, TranslationIndex>,
    query: string
): { name: string; translatedName: string; langCode: string; langLabel: string }[] => {
    if (!query.trim()) return [];
    const lowerQuery = query.toLowerCase();
    const results: { name: string; translatedName: string; langCode: string; langLabel: string }[] = [];
    const seen = new Set<string>();

    for (const lang of SUPPORTED_LANGUAGES) {
        if (lang.code === 'en') continue;
        const langIndex = indexMap.get(lang.code);
        if (!langIndex) continue;

        for (const [translatedKey, entries] of langIndex) {
            if (translatedKey.includes(lowerQuery)) {
                for (const entry of entries) {
                    if (!seen.has(entry.name)) {
                        seen.add(entry.name);
                        results.push({
                            name: entry.name,
                            translatedName: entry.translatedName,
                            langCode: lang.code,
                            langLabel: lang.label,
                        });
                    }
                }
            }
        }
    }

    return results;
};

/**
 * Search items by translated name in a specific language index.
 */
export const searchByTranslation = (
    index: TranslationIndex,
    query: string
): { name: string; translatedName: string }[] => {
    if (!query.trim()) return [];
    const lowerQuery = query.toLowerCase();
    const results: { name: string; translatedName: string }[] = [];
    const seen = new Set<string>();

    for (const [translatedKey, entries] of index) {
        if (translatedKey.includes(lowerQuery)) {
            for (const entry of entries) {
                if (!seen.has(entry.name)) {
                    seen.add(entry.name);
                    results.push(entry);
                }
            }
        }
    }

    return results;
};


