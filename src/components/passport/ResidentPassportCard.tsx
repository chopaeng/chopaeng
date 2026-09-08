import React from 'react';
import type { PublicPassportData } from '../../utils/userProfileApi';
import { playChimeClick } from '../../utils/kkAudioSynthesizer';

export const FRUIT_ICONS: Record<string, string> = {
    Apple: 'https://dodo.ac/np/images/2/22/Apple_NH_Inv_Icon.png',
    Cherry: 'https://dodo.ac/np/images/2/20/Cherry_NH_Inv_Icon.png',
    Orange: 'https://dodo.ac/np/images/8/87/Orange_NH_Inv_Icon.png',
    Peach: 'https://dodo.ac/np/images/8/86/Peach_NH_Inv_Icon.png',
    Pear: 'https://dodo.ac/np/images/e/e0/Pear_NH_Inv_Icon.png',
    Coconut: 'https://dodo.ac/np/images/2/2f/Coconut_NH_Inv_Icon.png',
};

export const ZODIAC_SIGNS: Record<string, string> = {
    January: '♑ Capricorn / ♒ Aquarius',
    February: '♒ Aquarius / ♓ Pisces',
    March: '♓ Pisces / ♈ Aries',
    April: '♈ Aries / ♉ Taurus',
    May: '♉ Taurus / ♊ Gemini',
    June: '♊ Gemini / ♋ Cancer',
    July: '♋ Cancer / ♌ Leo',
    August: '♌ Leo / ♍ Virgo',
    September: '♍ Virgo / ♎ Libra',
    October: '♎ Libra / ♏ Scorpio',
    November: '♏ Scorpio / ♐ Sagittarius',
    December: '♐ Sagittarius / ♑ Capricorn',
};

export const PERSONALITY_THEMES: Record<string, { bg: string; text: string; icon: string }> = {
    Lazy: { bg: '#fef3c7', text: '#b45309', icon: 'fa-bed' },
    Jock: { bg: '#fee2e2', text: '#b91c1c', icon: 'fa-dumbbell' },
    Cranky: { bg: '#f3e8ff', text: '#7e22ce', icon: 'fa-bolt' },
    Smug: { bg: '#dbeafe', text: '#1d4ed8', icon: 'fa-glasses' },
    Normal: { bg: '#d1fae5', text: '#047857', icon: 'fa-book-open' },
    Peppy: { bg: '#fce7f3', text: '#be185d', icon: 'fa-sparkles' },
    Snooty: { bg: '#e0e7ff', text: '#4338ca', icon: 'fa-gem' },
    'Big Sister': { bg: '#ccfbf1', text: '#0f766e', icon: 'fa-shield-heart' },
};

export interface PassportSkinConfig {
    id: string;
    label: string;
    desc: string;
    icon: string;
    headerGradient: string;
    headerBorder: string;
    bookletBg: string;
    bookletBorder: string;
    dashedBorder: string;
    patternColor: string;
    accentColor: string;
    tapeBg: string;
    tapeBorder: string;
    cardBg: string;
    cardBorder: string;
    cardText: string;
    cardLabel: string;
    barcodeColor: string;
    isDark: boolean;
}

export const PASSPORT_SKINS: Record<string, PassportSkinConfig> = {
    nook: {
        id: 'nook',
        label: 'Nook Inc. Emerald',
        desc: 'Deserted Island Signature',
        icon: 'fa-leaf',
        headerGradient: 'linear-gradient(135deg, #1b4332 0%, #2d6a4f 100%)',
        headerBorder: '#52b788',
        bookletBg: '#fdfbf7',
        bookletBorder: '#e3dec3',
        dashedBorder: 'rgba(45, 106, 79, 0.3)',
        patternColor: '#2d6a4f',
        accentColor: '#2d6a4f',
        tapeBg: 'rgba(254, 240, 138, 0.85)',
        tapeBorder: 'rgba(202, 138, 4, 0.4)',
        cardBg: '#ffffff',
        cardBorder: '#e9e4cf',
        cardText: '#1e293b',
        cardLabel: '#64748b',
        barcodeColor: '#64748b',
        isDark: false,
    },
    celeste: {
        id: 'celeste',
        label: 'Celeste Stargazer',
        desc: 'Observatory Starry Night',
        icon: 'fa-moon',
        headerGradient: 'linear-gradient(135deg, #1e103c 0%, #3b166e 50%, #581c87 100%)',
        headerBorder: '#a78bfa',
        bookletBg: '#0f172a',
        bookletBorder: '#334155',
        dashedBorder: 'rgba(167, 139, 250, 0.35)',
        patternColor: '#a78bfa',
        accentColor: '#c084fc',
        tapeBg: 'rgba(216, 180, 254, 0.85)',
        tapeBorder: 'rgba(147, 51, 234, 0.4)',
        cardBg: '#1e293b',
        cardBorder: '#334155',
        cardText: '#f8fafc',
        cardLabel: '#94a3b8',
        barcodeColor: '#94a3b8',
        isDark: true,
    },
    sakura: {
        id: 'sakura',
        label: 'Cherry Blossom',
        desc: 'Spring Hanami Petals',
        icon: 'fa-fan',
        headerGradient: 'linear-gradient(135deg, #be185d 0%, #db2777 50%, #f472b6 100%)',
        headerBorder: '#fbcfe8',
        bookletBg: '#fff5f7',
        bookletBorder: '#fce7f3',
        dashedBorder: 'rgba(219, 39, 119, 0.25)',
        patternColor: '#f472b6',
        accentColor: '#db2777',
        tapeBg: 'rgba(252, 231, 243, 0.9)',
        tapeBorder: 'rgba(236, 72, 153, 0.4)',
        cardBg: '#ffffff',
        cardBorder: '#fce7f3',
        cardText: '#1e293b',
        cardLabel: '#831843',
        barcodeColor: '#9d174d',
        isDark: false,
    },
    sunset: {
        id: 'sunset',
        label: 'Golden Hour',
        desc: 'Island Sunset & Warm Breeze',
        icon: 'fa-sun',
        headerGradient: 'linear-gradient(135deg, #c2410c 0%, #ea580c 50%, #f59e0b 100%)',
        headerBorder: '#fcd34d',
        bookletBg: '#fffbeb',
        bookletBorder: '#fde68a',
        dashedBorder: 'rgba(234, 88, 12, 0.25)',
        patternColor: '#ea580c',
        accentColor: '#ea580c',
        tapeBg: 'rgba(254, 215, 170, 0.9)',
        tapeBorder: 'rgba(249, 115, 22, 0.4)',
        cardBg: '#ffffff',
        cardBorder: '#fef3c7',
        cardText: '#1e293b',
        cardLabel: '#9a3412',
        barcodeColor: '#c2410c',
        isDark: false,
    },
    ocean: {
        id: 'ocean',
        label: 'Dodo Seaplane',
        desc: 'DAL High-Flier Oceanic',
        icon: 'fa-plane-departure',
        headerGradient: 'linear-gradient(135deg, #075985 0%, #0284c7 50%, #06b6d4 100%)',
        headerBorder: '#38bdf8',
        bookletBg: '#f0f9ff',
        bookletBorder: '#bae6fd',
        dashedBorder: 'rgba(2, 132, 199, 0.3)',
        patternColor: '#0284c7',
        accentColor: '#0284c7',
        tapeBg: 'rgba(254, 240, 138, 0.9)',
        tapeBorder: 'rgba(234, 179, 8, 0.5)',
        cardBg: '#ffffff',
        cardBorder: '#e0f2fe',
        cardText: '#0f172a',
        cardLabel: '#0369a1',
        barcodeColor: '#0284c7',
        isDark: false,
    },
    midnight: {
        id: 'midnight',
        label: 'Haunted Twilight',
        desc: 'Foggy Island Nightshade',
        icon: 'fa-ghost',
        headerGradient: 'linear-gradient(135deg, #090d16 0%, #1e1b4b 50%, #312e81 100%)',
        headerBorder: '#6366f1',
        bookletBg: '#0b0f19',
        bookletBorder: '#1f2937',
        dashedBorder: 'rgba(99, 102, 241, 0.3)',
        patternColor: '#818cf8',
        accentColor: '#818cf8',
        tapeBg: 'rgba(165, 180, 252, 0.85)',
        tapeBorder: 'rgba(79, 70, 229, 0.4)',
        cardBg: '#131c2e',
        cardBorder: '#283548',
        cardText: '#f9fafb',
        cardLabel: '#94a3b8',
        barcodeColor: '#6366f1',
        isDark: true,
    },
    golden: {
        id: 'golden',
        label: 'Golden Resident',
        desc: '5-Star Luxury Prestige',
        icon: 'fa-crown',
        headerGradient: 'linear-gradient(135deg, #78350f 0%, #b45309 40%, #d97706 70%, #f59e0b 100%)',
        headerBorder: '#fef08a',
        bookletBg: '#fffdf5',
        bookletBorder: '#fde047',
        dashedBorder: 'rgba(217, 119, 6, 0.35)',
        patternColor: '#d97706',
        accentColor: '#b45309',
        tapeBg: 'rgba(254, 240, 138, 0.95)',
        tapeBorder: 'rgba(217, 119, 6, 0.5)',
        cardBg: '#ffffff',
        cardBorder: '#fef3c7',
        cardText: '#1e293b',
        cardLabel: '#92400e',
        barcodeColor: '#b45309',
        isDark: false,
    },
};

export interface PassportPatternConfig {
    id: string;
    label: string;
    icon: string;
    backgroundImage: string;
    backgroundSize: string;
    backgroundPosition: string;
    lightOpacity: number;
    darkOpacity: number;
}

export const PASSPORT_PATTERNS: Record<string, PassportPatternConfig> = {
    dots: {
        id: 'dots',
        label: 'Dots',
        icon: 'fa-braille',
        backgroundImage: 'radial-gradient(currentColor 1.2px, transparent 1.2px), radial-gradient(currentColor 1.2px, transparent 1.2px)',
        backgroundSize: '20px 20px',
        backgroundPosition: '0 0, 10px 10px',
        lightOpacity: 0.22,
        darkOpacity: 0.18,
    },
    leaves: {
        id: 'leaves',
        label: 'Leaves',
        icon: 'fa-leaf',
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='36' height='36' viewBox='0 0 36 36' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M18 5C12 5 8 11 8 18c0 4.5 2.5 8.5 7 10.5-.6-2.5 0-5 2-7s5-2.5 7.5-2C24.5 15.5 25.5 9 23 6c-1.5-1-3.2-1-5-1z' fill='%23000' fill-opacity='0.6'/%3E%3C/svg%3E")`,
        backgroundSize: '36px 36px',
        backgroundPosition: '0 0',
        lightOpacity: 0.08,
        darkOpacity: 0.14,
    },
    stars: {
        id: 'stars',
        label: 'Stars',
        icon: 'fa-star',
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='44' height='44' viewBox='0 0 44 44' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M22 6l1.8 7.2L31 15l-7.2 1.8L22 24l-1.8-7.2L13 15l7.2-1.8z' fill='%23000' fill-opacity='0.7'/%3E%3Ccircle cx='38' cy='36' r='1.5' fill='%23000' fill-opacity='0.5'/%3E%3Ccircle cx='7' cy='34' r='1.2' fill='%23000' fill-opacity='0.4'/%3E%3Ccircle cx='36' cy='9' r='1.2' fill='%23000' fill-opacity='0.4'/%3E%3C/svg%3E")`,
        backgroundSize: '44px 44px',
        backgroundPosition: '0 0',
        lightOpacity: 0.08,
        darkOpacity: 0.16,
    },
    waves: {
        id: 'waves',
        label: 'Waves',
        icon: 'fa-water',
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='48' height='24' viewBox='0 0 48 24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 12 Q12 2 24 12 T48 12' fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round' stroke-opacity='0.5'/%3E%3C/svg%3E")`,
        backgroundSize: '48px 24px',
        backgroundPosition: '0 0',
        lightOpacity: 0.09,
        darkOpacity: 0.15,
    },
    grid: {
        id: 'grid',
        label: 'Grid',
        icon: 'fa-table-cells',
        backgroundImage: 'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)',
        backgroundSize: '20px 20px',
        backgroundPosition: '0 0',
        lightOpacity: 0.12,
        darkOpacity: 0.14,
    },
    none: {
        id: 'none',
        label: 'Plain',
        icon: 'fa-ban',
        backgroundImage: 'none',
        backgroundSize: 'auto',
        backgroundPosition: '0 0',
        lightOpacity: 0,
        darkOpacity: 0,
    },
};

interface VillagerCatalogItem {
    name: string;
    image?: string | null;
    variations?: Array<{ imageUrl?: string | null }>;
    species?: string;
    personality?: string;
}

interface CatalogItemBrief {
    name: string;
    image?: string | null;
    variations?: Array<{ imageUrl?: string | null }>;
}

interface ResidentPassportCardProps {
    passport: PublicPassportData;
    allVillagers?: VillagerCatalogItem[];
    allCatalogItems?: CatalogItemBrief[];
    avatarUrl?: string | null;
    interactive?: boolean;
    onShareClick?: () => void;
    shareCopied?: boolean;
    compact?: boolean;
    className?: string;
}

export const ResidentPassportCard: React.FC<ResidentPassportCardProps> = ({
    passport,
    allVillagers = [],
    allCatalogItems = [],
    avatarUrl,
    interactive = true,
    onShareClick,
    shareCopied = false,
    compact = false,
    className = '',
}) => {
    const [imgError, setImgError] = React.useState(false);
    const displayAvatar = avatarUrl || passport.avatarUrl;

    const zodiac = ZODIAC_SIGNS[passport.birthMonth] || 'Island Star';
    const personalityStyle = PERSONALITY_THEMES[passport.personality] || PERSONALITY_THEMES.Normal;
    const fruitIcon = FRUIT_ICONS[passport.nativeFruit] || FRUIT_ICONS.Apple;

    const passportNumber = `CP-${(passport.username || 'RESIDENT').toUpperCase().slice(0, 8)}-${passport.birthDay || '01'}`;

    // Skin & Pattern Styling Tokens
    const skinKey = passport.passportSkin || 'nook';
    const skin = PASSPORT_SKINS[skinKey] || PASSPORT_SKINS.nook;
    const patternKey = passport.passportPattern || 'dots';
    const pattern = PASSPORT_PATTERNS[patternKey] || PASSPORT_PATTERNS.dots;

    return (
        <div className={`ac-passport-wrapper ${compact ? 'compact' : ''} ${className}`}>
            <div
                className="ac-passport-booklet"
                style={{
                    backgroundColor: skin.bookletBg,
                    backgroundImage: 'none',
                    borderColor: skin.bookletBorder,
                    color: skin.cardText,
                    // CSS variables for children and pseudo-elements
                    ['--passport-dashed-border' as any]: skin.dashedBorder,
                    ['--passport-card-bg' as any]: skin.cardBg,
                    ['--passport-card-border' as any]: skin.cardBorder,
                    ['--passport-card-text' as any]: skin.cardText,
                    ['--passport-card-label' as any]: skin.cardLabel,
                    ['--passport-header-bg' as any]: skin.headerGradient,
                    ['--passport-header-border' as any]: skin.headerBorder,
                    ['--passport-accent' as any]: skin.accentColor,
                    ['--passport-tape-bg' as any]: skin.tapeBg,
                    ['--passport-tape-border' as any]: skin.tapeBorder,
                    ['--passport-barcode-color' as any]: skin.barcodeColor,
                }}
            >
                {/* Background Pattern Layer */}
                {pattern.backgroundImage !== 'none' && (
                    <div
                        className="ac-passport-pattern-overlay"
                        style={{
                            backgroundImage: pattern.backgroundImage,
                            backgroundSize: pattern.backgroundSize,
                            backgroundPosition: pattern.backgroundPosition,
                            opacity: skin.isDark ? pattern.darkOpacity : pattern.lightOpacity,
                            color: skin.patternColor,
                        }}
                        aria-hidden="true"
                    />
                )}

                {/* DAL Circular Watermark Seal */}
                <div
                    className="ac-passport-stamp-seal d-none d-md-flex"
                    style={{
                        borderColor: skin.dashedBorder,
                        color: skin.patternColor,
                    }}
                >
                    <span className="stamp-top">DAL PASSPORT</span>
                    <span className="stamp-mid">DODO</span>
                    <span className="stamp-bot">VERIFIED 2026</span>
                </div>

                {/* 1. Header Banner */}
                <div
                    className="ac-passport-header"
                    style={{
                        background: skin.headerGradient,
                        borderBottomColor: skin.headerBorder,
                    }}
                >
                    <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                        <div className="d-flex align-items-center gap-3">
                            <div className="ac-passport-leaf-seal">
                                <i className={`fa-solid ${skin.icon}`}></i>
                            </div>
                            <div>
                                <h1 className="ac-passport-title text-white mb-0">
                                    ChoPaeng Resident Passport
                                </h1>
                                <div className="ac-passport-subtitle">
                                    Nook Inc. Deserted Island Getaway Package
                                </div>
                            </div>
                        </div>

                        <div className="d-flex align-items-center gap-2">
                            <span className="ac-passport-seal-badge">
                                <i className="fa-solid fa-plane-departure text-warning"></i>
                                <span>{passportNumber}</span>
                            </span>
                            {onShareClick && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        playChimeClick();
                                        onShareClick();
                                    }}
                                    className={`btn btn-xs rounded-pill fw-bold px-3 py-1 d-inline-flex align-items-center gap-1 shadow-2xs ${
                                        shareCopied ? 'btn-success text-white' : 'btn-light text-dark'
                                    }`}
                                    title="Share Passport Link"
                                >
                                    <i className={`fa-solid ${shareCopied ? 'fa-check' : 'fa-share-nodes'}`}></i>
                                    <span>{shareCopied ? 'Copied!' : 'Share'}</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* 2. Passport Body */}
                <div className="p-3 p-md-4 position-relative" style={{ zIndex: 2 }}>
                    <div className="row g-4">
                        {/* Left: Polaroid Portrait Frame */}
                        <div className="col-12 col-md-4 col-lg-3">
                            <div className="ac-passport-polaroid text-center mx-auto" style={{ maxWidth: 220 }}>
                                <div
                                    className="ac-tape-strip"
                                    style={{
                                        backgroundColor: skin.tapeBg,
                                        borderLeftColor: skin.tapeBorder,
                                        borderRightColor: skin.tapeBorder,
                                    }}
                                ></div>
                                <div className="ac-passport-avatar-box">
                                    {displayAvatar && !imgError ? (
                                        <img
                                            src={displayAvatar}
                                            alt={`${passport.username || 'Resident'}'s avatar`}
                                            className="ac-passport-avatar-img"
                                            onError={() => setImgError(true)}
                                        />
                                    ) : (
                                        <i className="fa-solid fa-crown ac-passport-avatar-icon"></i>
                                    )}
                                </div>
                                <div className="ac-passport-polaroid-caption">
                                    <div className="ac-passport-ign text-truncate">
                                        {passport.primaryIgn || passport.username || "Resident"}
                                    </div>
                                    {passport.showCharacterAndIsland && (
                                        <div className="ac-passport-island-pill text-truncate">
                                            <i className="fa-solid fa-tree text-success"></i>
                                            <span>{passport.primaryIsland || "Cho Island"}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Right: Resident Details & Quote Bubble */}
                        <div className="col-12 col-md-8 col-lg-9">
                            {/* In-Game Comment Bubble */}
                            <div
                                className="ac-passport-quote-bubble"
                                style={{
                                    backgroundColor: skin.cardBg,
                                    borderColor: skin.cardBorder,
                                    color: skin.cardText,
                                }}
                            >
                                <div className="d-flex align-items-start gap-2">
                                    <i className="fa-solid fa-quote-left mt-1 opacity-50" style={{ color: skin.accentColor }}></i>
                                    <p className="ac-passport-quote-text mb-0" style={{ color: skin.cardText }}>
                                        {passport.aboutYou || "Living my best island life in Animal Crossing: New Horizons!"}
                                    </p>
                                </div>
                            </div>

                            {/* 6-Pill Field Grid */}
                            <div className="row g-2 g-md-3">
                                {/* Birthday & Zodiac */}
                                <div className="col-6 col-md-4">
                                    <div
                                        className="ac-passport-data-pill"
                                        style={{
                                            backgroundColor: skin.cardBg,
                                            borderColor: skin.cardBorder,
                                            color: skin.cardText,
                                        }}
                                    >
                                        <span className="ac-passport-data-label" style={{ color: skin.cardLabel }}>
                                            <i className="fa-solid fa-cake-candles text-warning"></i> Birthday
                                        </span>
                                        <span className="ac-passport-data-val" style={{ color: skin.cardText }}>
                                            {passport.birthMonth} {passport.birthDay}
                                        </span>
                                        <span className="tiny-text" style={{ color: skin.cardLabel }}>{zodiac}</span>
                                    </div>
                                </div>

                                {/* Native Fruit */}
                                <div className="col-6 col-md-4">
                                    <div
                                        className="ac-passport-data-pill"
                                        style={{
                                            backgroundColor: skin.cardBg,
                                            borderColor: skin.cardBorder,
                                            color: skin.cardText,
                                        }}
                                    >
                                        <span className="ac-passport-data-label" style={{ color: skin.cardLabel }}>
                                            <i className="fa-solid fa-apple-whole text-danger"></i> Native Fruit
                                        </span>
                                        <span className="ac-passport-data-val" style={{ color: skin.cardText }}>
                                            <img
                                                src={fruitIcon}
                                                alt=""
                                                style={{ width: 20, height: 20, objectFit: 'contain' }}
                                                onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                                            />
                                            <span>{passport.nativeFruit}</span>
                                        </span>
                                        <span className="tiny-text" style={{ color: skin.cardLabel }}>Island Orchard Origin</span>
                                    </div>
                                </div>

                                {/* Personality */}
                                <div className="col-6 col-md-4">
                                    <div
                                        className="ac-passport-data-pill"
                                        style={{
                                            backgroundColor: skin.cardBg,
                                            borderColor: skin.cardBorder,
                                            color: skin.cardText,
                                        }}
                                    >
                                        <span className="ac-passport-data-label" style={{ color: skin.cardLabel }}>
                                            <i className="fa-solid fa-smile text-info"></i> Personality
                                        </span>
                                        <span className="ac-passport-data-val" style={{ color: skin.cardText }}>
                                            <span
                                                className="badge rounded-pill x-small fw-bold px-2 py-1"
                                                style={{ backgroundColor: personalityStyle.bg, color: personalityStyle.text }}
                                            >
                                                <i className={`fa-solid ${personalityStyle.icon} me-1`}></i>
                                                {passport.personality}
                                            </span>
                                        </span>
                                        <span className="tiny-text" style={{ color: skin.cardLabel }}>Island Spirit</span>
                                    </div>
                                </div>

                                {/* Favorite Song */}
                                <div className="col-6 col-md-4">
                                    <div
                                        className="ac-passport-data-pill"
                                        style={{
                                            backgroundColor: skin.cardBg,
                                            borderColor: skin.cardBorder,
                                            color: skin.cardText,
                                        }}
                                    >
                                        <span className="ac-passport-data-label" style={{ color: skin.cardLabel }}>
                                            <i className="fa-solid fa-music text-success"></i> K.K. Favorite
                                        </span>
                                        <span className="ac-passport-data-val text-truncate" title={passport.favouriteSong} style={{ color: skin.cardText }}>
                                            <i className="fa-solid fa-compact-disc text-muted small"></i>
                                            <span className="text-truncate">{passport.favouriteSong || "K.K. Cruisin'"}</span>
                                        </span>
                                        <span className="tiny-text" style={{ color: skin.cardLabel }}>Aircheck Track</span>
                                    </div>
                                </div>

                                {/* Island Theme / Color */}
                                <div className="col-6 col-md-4">
                                    <div
                                        className="ac-passport-data-pill"
                                        style={{
                                            backgroundColor: skin.cardBg,
                                            borderColor: skin.cardBorder,
                                            color: skin.cardText,
                                        }}
                                    >
                                        <span className="ac-passport-data-label" style={{ color: skin.cardLabel }}>
                                            <i className="fa-solid fa-palette text-primary"></i> Theme Color
                                        </span>
                                        <span className="ac-passport-data-val" style={{ color: skin.cardText }}>
                                            <span
                                                className="rounded-circle border d-inline-block"
                                                style={{ width: 16, height: 16, backgroundColor: passport.favouriteColour || '#37b06d' }}
                                            ></span>
                                            <span>{passport.favouriteColour || "#37b06d"}</span>
                                        </span>
                                        <span className="tiny-text" style={{ color: skin.cardLabel }}>Signature Palette</span>
                                    </div>
                                </div>

                                {/* Country & Language */}
                                <div className="col-6 col-md-4">
                                    <div
                                        className="ac-passport-data-pill"
                                        style={{
                                            backgroundColor: skin.cardBg,
                                            borderColor: skin.cardBorder,
                                            color: skin.cardText,
                                        }}
                                    >
                                        <span className="ac-passport-data-label" style={{ color: skin.cardLabel }}>
                                            <i className="fa-solid fa-globe text-secondary"></i> Origin &amp; Lang
                                        </span>
                                        <span className="ac-passport-data-val text-truncate" style={{ color: skin.cardText }}>
                                            {passport.country || "Island Paradise"}
                                        </span>
                                        <span className="tiny-text" style={{ color: skin.cardLabel }}>{passport.language || "English"}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 3. Favorite Villager Besties Gallery (Up to 10) */}
                    {passport.favouriteVillagers && passport.favouriteVillagers.length > 0 && (
                        <div className="mt-4 pt-3 border-top" style={{ borderColor: skin.cardBorder }}>
                            <div className="d-flex align-items-center justify-content-between mb-2">
                                <h3 className="h6 fw-black mb-0 ac-font d-flex align-items-center gap-2" style={{ color: skin.cardText }}>
                                    <i className="fa-solid fa-paw text-warning"></i>
                                    Island Besties &amp; Favorite Villagers ({passport.favouriteVillagers.length}/10)
                                </h3>
                                <span className="tiny-text" style={{ color: skin.cardLabel }}>Deserted Island Crew</span>
                            </div>

                            <div className="d-flex flex-wrap gap-2">
                                {passport.favouriteVillagers.map((vName) => {
                                    const matched = allVillagers.find((v) => v.name.toLowerCase() === vName.toLowerCase());
                                    const sprite = matched?.image || matched?.variations?.[0]?.imageUrl;

                                    return (
                                        <div
                                            key={vName}
                                            className="ac-passport-villager-chip"
                                            style={{
                                                backgroundColor: skin.cardBg,
                                                borderColor: skin.cardBorder,
                                            }}
                                            onClick={() => {
                                                if (interactive) playChimeClick();
                                            }}
                                            title={`${vName}${matched?.species ? ` · ${matched.species}` : ''}`}
                                        >
                                            {sprite ? (
                                                <img
                                                    src={sprite}
                                                    alt={vName}
                                                    className="ac-passport-villager-img"
                                                    onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                                                />
                                            ) : (
                                                <div className="ac-passport-villager-img d-flex align-items-center justify-content-center">
                                                    <i className="fa-solid fa-paw tiny-text" style={{ color: skin.accentColor }}></i>
                                                </div>
                                            )}
                                            <span className="ac-passport-villager-name" style={{ color: skin.cardText }}>{vName}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* 3.5 Featured Items Trophy Shelf (Up to 3) */}
                    {passport.featuredItems && passport.featuredItems.length > 0 && (
                        <div className="mt-3 pt-3 border-top" style={{ borderColor: skin.cardBorder }}>
                            <div className="d-flex align-items-center justify-content-between mb-2">
                                <h3 className="h6 fw-black mb-0 ac-font d-flex align-items-center gap-2" style={{ color: skin.cardText }}>
                                    <i className="fa-solid fa-trophy text-warning"></i>
                                    Island Trophies &amp; Featured Treasures ({passport.featuredItems.length}/3)
                                </h3>
                                <span className="tiny-text" style={{ color: skin.cardLabel }}>Pride of the Island</span>
                            </div>

                            <div className="d-flex flex-wrap gap-2">
                                {passport.featuredItems.map((itemName) => {
                                    const matchedItem = allCatalogItems.find(
                                        (i) => i.name.toLowerCase() === itemName.toLowerCase()
                                    );
                                    const sprite = matchedItem?.image || matchedItem?.variations?.[0]?.imageUrl;

                                    return (
                                        <div
                                            key={itemName}
                                            className="ac-passport-featured-chip"
                                            style={{
                                                backgroundColor: skin.cardBg,
                                                borderColor: skin.cardBorder,
                                            }}
                                            onClick={() => {
                                                if (interactive) playChimeClick();
                                            }}
                                            title={`Featured Item: ${itemName}`}
                                        >
                                            {sprite ? (
                                                <img
                                                    src={sprite}
                                                    alt={itemName}
                                                    className="ac-passport-featured-img"
                                                    onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                                                />
                                            ) : (
                                                <div
                                                    className="ac-passport-featured-icon-box"
                                                    style={{ backgroundColor: `${skin.accentColor}25`, color: skin.accentColor }}
                                                >
                                                    <i className="fa-solid fa-gem tiny-text"></i>
                                                </div>
                                            )}
                                            <span className="ac-passport-featured-name" style={{ color: skin.cardText }}>
                                                {itemName}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* 4. DAL Boarding Barcode & Official Stamp Line */}
                    <div className="ac-passport-barcode-bar" style={{ borderColor: skin.dashedBorder }}>
                        <div className="d-flex align-items-center gap-3">
                            <div className="ac-passport-fake-barcode" style={{ color: skin.barcodeColor }}>
                                |||| | ||| ||||| || |||||| | |||
                            </div>
                            <span className="tiny-text font-monospace d-none d-sm-inline" style={{ color: skin.cardLabel }}>
                                DAL-FLIGHT-2026-CHOPAENG
                            </span>
                        </div>

                        <div className="d-flex align-items-center gap-2 tiny-text fw-bold" style={{ color: skin.accentColor }}>
                            <i className="fa-solid fa-shield-check"></i>
                            <span>OFFICIAL NOOK INC. PASSPORT</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
