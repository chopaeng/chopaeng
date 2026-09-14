export type ThemeMode = 'nook' | 'celeste' | 'roost' | 'sakura' | 'dal' | 'nooklink';

export interface ThemeOption {
    id: ThemeMode;
    name: string;
    description: string;
    icon: string;
    badgeColor: string;
    accentColor: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
    {
        id: 'nook',
        name: 'Nook Classic',
        description: 'Classic island sand & vibrant Nook green',
        icon: 'fa-leaf',
        badgeColor: '#28a745',
        accentColor: '#16a34a',
    },
    {
        id: 'celeste',
        name: 'Celeste Galaxy',
        description: 'Deep midnight navy with golden starlight accents',
        icon: 'fa-star',
        badgeColor: '#c084fc',
        accentColor: '#8b5cf6',
    },
    {
        id: 'roost',
        name: 'The Roost Cafe',
        description: 'Warm espresso, rich mahogany & cafe tones',
        icon: 'fa-mug-hot',
        badgeColor: '#d4a373',
        accentColor: '#b45309',
    },
    {
        id: 'sakura',
        name: 'Cherry Blossom',
        description: 'Pastel sakura pink & spring petals',
        icon: 'fa-heart',
        badgeColor: '#f472b6',
        accentColor: '#ec4899',
    },
    {
        id: 'dal',
        name: 'Dodo Airlines',
        description: 'Aviation navy with vibrant canary wings',
        icon: 'fa-plane',
        badgeColor: '#38bdf8',
        accentColor: '#0284c7',
    },
    {
        id: 'nooklink',
        name: 'NookLink Dark',
        description: 'Sleek cyber obsidian with emerald highlights',
        icon: 'fa-mobile-screen',
        badgeColor: '#10b981',
        accentColor: '#059669',
    },
];

const THEME_STORAGE_KEY = 'chopaeng_active_theme';

const VALID_THEMES: Set<ThemeMode> = new Set(['nook', 'celeste', 'roost', 'sakura', 'dal', 'nooklink']);

export const getStoredTheme = (): ThemeMode => {
    try {
        const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
        if (saved && VALID_THEMES.has(saved)) {
            return saved;
        }
    } catch {
        // Local storage inaccessible
    }
    return 'nook';
};

export const applyTheme = (theme: ThemeMode): void => {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);

    // Update theme-color meta tag for browser mobile address bars
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    const colorMap: Record<ThemeMode, string> = {
        nook: '#fefae0',
        celeste: '#182035',
        roost: '#26201c',
        sakura: '#fdf2f8',
        dal: '#0f172a',
        nooklink: '#090d16',
    };
    if (metaTheme && colorMap[theme]) {
        metaTheme.setAttribute('content', colorMap[theme]);
    }
};

export const setStoredTheme = (theme: ThemeMode): void => {
    try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
        // Local storage inaccessible
    }
    applyTheme(theme);
    window.dispatchEvent(new CustomEvent('chopaeng_theme_updated', { detail: { theme } }));
};

export const initTheme = (): ThemeMode => {
    const theme = getStoredTheme();
    applyTheme(theme);
    return theme;
};

export const cycleTheme = (): ThemeMode => {
    const current = getStoredTheme();
    const idx = THEME_OPTIONS.findIndex(o => o.id === current);
    const nextIdx = idx === -1 ? 0 : (idx + 1) % THEME_OPTIONS.length;
    const nextTheme = THEME_OPTIONS[nextIdx].id;
    setStoredTheme(nextTheme);
    return nextTheme;
};
