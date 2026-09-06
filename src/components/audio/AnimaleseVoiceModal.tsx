import React, { useState, useEffect, useRef } from 'react';
import {
    speakAnimalese,
    stopAnimalese,
    downloadAnimaleseWav,
    preloadSoundType,
} from '../../utils/animaleseSynthesizer';
import {
    type AnimaleseSoundType,
    playSingleSoundBlip,
} from '../../utils/animaleseSoundLoader';
import { playChimeClick } from '../../utils/kkAudioSynthesizer';
import { getStoredTheme, type ThemeMode } from '../../utils/theme';

const FUN_PHRASES = [
    "Yes, yes! Welcome to ChoPaeng Island!",
    "Dodo Airlines flight is now ready for boarding!",
    "One cup of hot coffee with Pigeon Milk, please...",
    "Look! A shooting star is falling over the beach tonight!",
    "Do you want 40 Royal Crowns and 10 Gold Nuggets?",
    "Bells, bells, magnificent bells!",
    "K.K. Slider is setting up his stool at the plaza tonight!",
    "Did you catch that rare Coelacanth in the rain?",
    "May the stars guide your island journey forever!",
];

const ARCHETYPE_CONFIGS: Record<AnimaleseSoundType, {
    name: string;
    title: string;
    color: string;
    gradient: string;
    icon: string;
    villagers: string;
    pitchDesc: string;
}> = {
    default: {
        name: 'Normal',
        title: 'Light Resident',
        color: '#10b981',
        gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        icon: 'fa-user',
        villagers: 'Fauna · Goldie · Maple',
        pitchDesc: 'Warm & balanced',
    },
    deep: {
        name: 'Cranky',
        title: 'Deep Nook Inc.',
        color: '#d97706',
        gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
        icon: 'fa-leaf',
        villagers: 'Tom Nook · Apollo · Fang',
        pitchDesc: 'Low gravelly rumble',
    },
    squeaky: {
        name: 'Peppy',
        title: 'Squeaky Stargazer',
        color: '#ec4899',
        gradient: 'linear-gradient(135deg, #f43f5e 0%, #ec4899 100%)',
        icon: 'fa-star',
        villagers: 'Rosie · Celeste · Audie',
        pitchDesc: 'High energetic chirp',
    },
    robot: {
        name: 'Cyber',
        title: '8-Bit Robot',
        color: '#06b6d4',
        gradient: 'linear-gradient(135deg, #06b6d4 0%, #0284c7 100%)',
        icon: 'fa-robot',
        villagers: 'Cephalobot · Sprocket · Ribbot',
        pitchDesc: 'Synthesized chip blip',
    },
    tired: {
        name: 'Lazy',
        title: 'The Roost Cafe',
        color: '#a06b43',
        gradient: 'linear-gradient(135deg, #b47b4d 0%, #8c5832 100%)',
        icon: 'fa-mug-hot',
        villagers: 'Brewster · Bob · Lucky',
        pitchDesc: 'Mellow sleepy drawl',
    },
    tired_alt: {
        name: 'Alvin',
        title: 'High-Pitch Curious',
        color: '#8b5cf6',
        gradient: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
        icon: 'fa-feather',
        villagers: 'Sasha · Sherb · Stitches',
        pitchDesc: 'Ultra-high chirpy tone',
    },
};

const THEME_ACCENTS: Record<ThemeMode, {
    primary: string;
    borderTop: string;
    modalBg: string;
    subtleBg: string;
    cardBg: string;
    borderSubtle: string;
    textColor: string;
    textMuted: string;
    inputBg: string;
    inputBorder: string;
    isDark: boolean;
}> = {
    nook: {
        primary: '#16a34a',
        borderTop: '#16a34a',
        modalBg: '#fffdfa',
        subtleBg: '#f8fafc',
        cardBg: '#ffffff',
        borderSubtle: 'rgba(55, 176, 109, 0.25)',
        textColor: '#1e293b',
        textMuted: '#64748b',
        inputBg: '#ffffff',
        inputBorder: '#cbd5e1',
        isDark: false,
    },
    celeste: {
        primary: '#7c3aed',
        borderTop: '#a78bfa',
        modalBg: '#0f172a',
        subtleBg: '#1e293b',
        cardBg: '#1e293b',
        borderSubtle: 'rgba(167, 139, 250, 0.3)',
        textColor: '#f8fafc',
        textMuted: '#94a3b8',
        inputBg: '#0b1120',
        inputBorder: 'rgba(167, 139, 250, 0.35)',
        isDark: true,
    },
    roost: {
        primary: '#a06b43',
        borderTop: '#d4a373',
        modalBg: '#1c1917',
        subtleBg: '#292524',
        cardBg: '#292524',
        borderSubtle: 'rgba(217, 119, 6, 0.3)',
        textColor: '#fdf8f5',
        textMuted: '#a8a29e',
        inputBg: '#141210',
        inputBorder: 'rgba(212, 163, 115, 0.35)',
        isDark: true,
    },
    sakura: {
        primary: '#ec4899',
        borderTop: '#ec4899',
        modalBg: '#ffffff',
        subtleBg: '#fdf2f8',
        cardBg: '#fff5f9',
        borderSubtle: 'rgba(236, 72, 153, 0.3)',
        textColor: '#4a2040',
        textMuted: '#9d4e7f',
        inputBg: '#ffffff',
        inputBorder: 'rgba(236, 72, 153, 0.35)',
        isDark: false,
    },
    dal: {
        primary: '#0284c7',
        borderTop: '#38bdf8',
        modalBg: '#0f172a',
        subtleBg: '#1e293b',
        cardBg: '#1e293b',
        borderSubtle: 'rgba(56, 189, 248, 0.3)',
        textColor: '#f8fafc',
        textMuted: '#94a3b8',
        inputBg: '#0b1120',
        inputBorder: 'rgba(56, 189, 248, 0.35)',
        isDark: true,
    },
    nooklink: {
        primary: '#10b981',
        borderTop: '#34d399',
        modalBg: '#090d16',
        subtleBg: '#111827',
        cardBg: '#111827',
        borderSubtle: 'rgba(16, 185, 129, 0.3)',
        textColor: '#f8fafc',
        textMuted: '#94a3b8',
        inputBg: '#05080e',
        inputBorder: 'rgba(16, 185, 129, 0.35)',
        isDark: true,
    },
};

const SOUNDBOARD_DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
const SOUNDBOARD_LETTERS = [
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
];

export const AnimaleseVoiceModal: React.FC = () => {
    const [currentTheme, setCurrentTheme] = useState<ThemeMode>(getStoredTheme);
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'studio' | 'soundboard'>('studio');

    const [text, setText] = useState("Yes, yes! Welcome to ChoPaeng Island!");
    const [selectedVoice, setSelectedVoice] = useState<AnimaleseSoundType>('default');
    const [speed, setSpeed] = useState<number>(1.1);
    const [pitch, setPitch] = useState<number>(1.0);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isTypewriterEnabled, setIsTypewriterEnabled] = useState(true);
    const [currentCharIndex, setCurrentCharIndex] = useState<number>(-1);
    const [mouthOpen, setMouthOpen] = useState(false);
    const [activeSoundboardKey, setActiveSoundboardKey] = useState<string | null>(null);
    const [lastPlayedPhoneme, setLastPlayedPhoneme] = useState<string | null>(null);

    const mouthIntervalRef = useRef<any>(null);

    useEffect(() => {
        const handleOpen = () => {
            setIsOpen(true);
            playChimeClick();
            preloadSoundType('default').catch(() => {});
        };
        const handleThemeUpdate = (e: any) => {
            if (e.detail?.theme) {
                setCurrentTheme(e.detail.theme);
            } else {
                setCurrentTheme(getStoredTheme());
            }
        };

        window.addEventListener('chopaeng_open_animalese_modal', handleOpen);
        window.addEventListener('chopaeng_theme_updated', handleThemeUpdate);

        return () => {
            window.removeEventListener('chopaeng_open_animalese_modal', handleOpen);
            window.removeEventListener('chopaeng_theme_updated', handleThemeUpdate);
        };
    }, []);

    // Stop audio if closed
    useEffect(() => {
        if (!isOpen) {
            stopAnimalese();
            setIsSpeaking(false);
            setCurrentCharIndex(-1);
            clearInterval(mouthIntervalRef.current);
        }
    }, [isOpen]);

    // Animate mouth flap and head bobbing while talking
    useEffect(() => {
        if (isSpeaking) {
            mouthIntervalRef.current = setInterval(() => {
                setMouthOpen((prev) => !prev);
            }, 75);
        } else {
            clearInterval(mouthIntervalRef.current);
            setMouthOpen(false);
            setCurrentCharIndex(-1);
        }
        return () => clearInterval(mouthIntervalRef.current);
    }, [isSpeaking]);

    // Physical keyboard trigger for Soundboard tab
    useEffect(() => {
        if (!isOpen || activeTab !== 'soundboard') return;

        const handlePhysicalKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
                return;
            }
            if (e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;
            const key = e.key.toLowerCase();
            if ((key >= 'a' && key <= 'z') || (key >= '0' && key <= '9')) {
                setActiveSoundboardKey(key);
                setLastPlayedPhoneme(key);
                playSingleSoundBlip(selectedVoice, key, 0.75);
                setTimeout(() => setActiveSoundboardKey(null), 220);
            }
        };

        window.addEventListener('keydown', handlePhysicalKeyDown);
        return () => window.removeEventListener('keydown', handlePhysicalKeyDown);
    }, [isOpen, activeTab, selectedVoice]);

    const handleSelectVoice = (voiceId: AnimaleseSoundType) => {
        setSelectedVoice(voiceId);
        preloadSoundType(voiceId).catch(() => {});
        playSingleSoundBlip(voiceId, 'e', 0.65);
    };

    const handlePlay = async () => {
        if (!text.trim()) return;
        setIsSpeaking(true);
        setCurrentCharIndex(0);

        try {
            await speakAnimalese(text, {
                voice: selectedVoice,
                speed,
                pitchMultiplier: pitch,
                onProgress: (idx) => {
                    setCurrentCharIndex(idx);
                },
                onComplete: () => {
                    setIsSpeaking(false);
                    setCurrentCharIndex(-1);
                },
            });
        } catch {
            setIsSpeaking(false);
            setCurrentCharIndex(-1);
        }
    };

    const handleStop = () => {
        stopAnimalese();
        setIsSpeaking(false);
        setCurrentCharIndex(-1);
        playChimeClick();
    };

    const handleDownload = async () => {
        if (!text.trim() || isDownloading) return;
        playChimeClick();
        setIsDownloading(true);
        try {
            await downloadAnimaleseWav(text, {
                voice: selectedVoice,
                speed,
                pitchMultiplier: pitch,
            });
        } finally {
            setIsDownloading(false);
        }
    };

    const handleTextChange = (newVal: string) => {
        if (isTypewriterEnabled && newVal.length > text.length) {
            const addedChar = newVal.slice(-1);
            if (/^[a-z0-9]$/i.test(addedChar)) {
                playSingleSoundBlip(selectedVoice, addedChar, 0.45);
            }
        }
        setText(newVal);
    };

    const pickRandomPhrase = () => {
        playChimeClick();
        const available = FUN_PHRASES.filter((p) => p !== text);
        const randomPhrase = available[Math.floor(Math.random() * available.length)] || FUN_PHRASES[0];
        setText(randomPhrase);
        playSingleSoundBlip(selectedVoice, 'a', 0.5);
    };

    const handleSoundboardTap = (char: string) => {
        setActiveSoundboardKey(char);
        setLastPlayedPhoneme(char);
        playSingleSoundBlip(selectedVoice, char, 0.75);
        setTimeout(() => setActiveSoundboardKey(null), 220);
    };

    if (!isOpen) return null;

    const theme = THEME_ACCENTS[currentTheme] || THEME_ACCENTS.nook;
    const currentArch = ARCHETYPE_CONFIGS[selectedVoice] || ARCHETYPE_CONFIGS.default;

    // Estimate duration
    const charCount = text.length;
    const estDurationSec = Math.max(0.4, (charCount * (0.052 / speed))).toFixed(1);

    return (
        <div
            className="modal-backdrop-custom d-flex align-items-center justify-content-center"
            style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(15, 23, 42, 0.75)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                zIndex: 1060,
                padding: '1rem',
            }}
            onClick={() => setIsOpen(false)}
        >
            <div
                className="rounded-5 shadow-2xl overflow-hidden border animate-up"
                style={{
                    maxWidth: '680px',
                    width: '100%',
                    maxHeight: '92vh',
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: theme.modalBg,
                    borderColor: theme.borderSubtle,
                    borderTop: `6px solid ${currentArch.color}`,
                    color: theme.textColor,
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.08)',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* ── Top Header ── */}
                <div
                    className="p-3.5 px-4 border-bottom d-flex align-items-center justify-content-between flex-shrink-0"
                    style={{
                        backgroundColor: theme.subtleBg,
                        borderColor: theme.borderSubtle,
                    }}
                >
                    <div className="d-flex align-items-center gap-3">
                        <div
                            className="rounded-circle d-flex align-items-center justify-content-center shadow text-white"
                            style={{
                                width: '42px',
                                height: '42px',
                                fontSize: '1.15rem',
                                background: currentArch.gradient,
                                border: '2px solid rgba(255,255,255,0.4)',
                            }}
                        >
                            <i className="fa-solid fa-comment-dots" />
                        </div>
                        <div>
                            <div className="d-flex align-items-center gap-2">
                                <h5 className="fw-black mb-0 ac-font" style={{ color: theme.textColor, fontSize: '1.2rem', letterSpacing: '0.5px' }}>
                                    Animalese Voice Studio
                                </h5>
                                <span
                                    className="badge rounded-pill fw-black"
                                    style={{
                                        fontSize: '0.66rem',
                                        backgroundColor: currentArch.color + '22',
                                        color: currentArch.color,
                                        border: `1px solid ${currentArch.color}55`,
                                    }}
                                >
                                    Authentic 0-9 & A-Z
                                </span>
                            </div>
                            <small className="fw-bold x-small" style={{ color: theme.textMuted }}>
                                Official Nintendo Animal Crossing character speech synthesizer
                            </small>
                        </div>
                    </div>

                    <div className="d-flex align-items-center gap-2">
                        {/* Tab Switcher */}
                        <div
                            className="d-flex align-items-center gap-1 p-1 rounded-pill border"
                            style={{
                                backgroundColor: theme.modalBg,
                                borderColor: theme.borderSubtle,
                            }}
                        >
                            <button
                                type="button"
                                onClick={() => {
                                    setActiveTab('studio');
                                    playChimeClick();
                                }}
                                className={`btn btn-xs rounded-pill px-2.5 py-1 fw-bold transition-all ${
                                    activeTab === 'studio' ? 'shadow-xs text-white' : 'btn-link text-muted text-decoration-none'
                                }`}
                                style={{
                                    fontSize: '0.72rem',
                                    backgroundColor: activeTab === 'studio' ? currentArch.color : 'transparent',
                                }}
                            >
                                <i className="fa-solid fa-microphone me-1" /> Speech
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setActiveTab('soundboard');
                                    playChimeClick();
                                }}
                                className={`btn btn-xs rounded-pill px-2.5 py-1 fw-bold transition-all ${
                                    activeTab === 'soundboard' ? 'shadow-xs text-white' : 'btn-link text-muted text-decoration-none'
                                }`}
                                style={{
                                    fontSize: '0.72rem',
                                    backgroundColor: activeTab === 'soundboard' ? currentArch.color : 'transparent',
                                }}
                            >
                                <i className="fa-solid fa-keyboard me-1" /> Soundboard
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="btn-close shadow-none"
                            style={{ filter: theme.isDark ? 'invert(1)' : 'none' }}
                            aria-label="Close"
                        />
                    </div>
                </div>

                {/* ── Scrollable Body ── */}
                <div className="p-4 overflow-y-auto custom-scrollbar flex-grow-1">
                    {/* ── Visual Villager Speech Dialogue Bubble Stage ── */}
                    <div
                        className="rounded-4 mb-4 p-3.5 border shadow-sm position-relative overflow-hidden transition-all"
                        style={{
                            backgroundColor: theme.subtleBg,
                            borderColor: isSpeaking ? currentArch.color : theme.borderSubtle,
                            borderWidth: isSpeaking ? '2.5px' : '1px',
                        }}
                    >
                        <div className="d-flex align-items-start gap-3">
                            {/* Animated Villager Portrait Avatar */}
                            <div className="flex-shrink-0 text-center">
                                <div
                                    className={`rounded-circle d-flex align-items-center justify-content-center shadow-md position-relative mx-auto transition-transform ${
                                        isSpeaking ? 'scale-105' : ''
                                    }`}
                                    style={{
                                        width: '64px',
                                        height: '64px',
                                        background: currentArch.gradient,
                                        border: '3px solid #ffffff',
                                        transform: isSpeaking ? (mouthOpen ? 'translateY(-2px) rotate(-3deg)' : 'translateY(0) rotate(3deg)') : 'none',
                                    }}
                                >
                                    {/* Icon Body */}
                                    <i className={`fa-solid ${currentArch.icon} text-white`} style={{ fontSize: '1.6rem' }} />

                                    {/* Animated Talking Mouth Flap */}
                                    <div
                                        className="position-absolute bottom-0 start-50 translate-middle-x mb-1 rounded-pill transition-all"
                                        style={{
                                            width: mouthOpen ? '16px' : '8px',
                                            height: mouthOpen ? '10px' : '3px',
                                            backgroundColor: mouthOpen ? '#dc2626' : '#ffffff',
                                            border: '1.5px solid rgba(0,0,0,0.15)',
                                            boxShadow: mouthOpen ? 'inset 0 2px 4px rgba(0,0,0,0.4)' : 'none',
                                        }}
                                    />

                                    {/* Floating Animated Musical Notes */}
                                    {isSpeaking && (
                                        <div className="position-absolute top-0 end-0 translate-middle text-warning animate-bounce" style={{ fontSize: '0.85rem' }}>
                                            {mouthOpen ? '🎵' : '🎶'}
                                        </div>
                                    )}
                                </div>

                                <div className="mt-1.5">
                                    <span
                                        className="badge rounded-pill fw-black text-white px-2 py-0.5 shadow-xs"
                                        style={{
                                            backgroundColor: currentArch.color,
                                            fontSize: '0.68rem',
                                            letterSpacing: '0.5px',
                                        }}
                                    >
                                        {currentArch.name}
                                    </span>
                                </div>
                            </div>

                            {/* Dialogue Balloon Content */}
                            <div className="flex-grow-1 overflow-hidden">
                                <div className="d-flex align-items-center justify-content-between mb-1.5">
                                    <div className="d-flex align-items-center gap-2 flex-wrap">
                                        <span className="fw-black small ac-font" style={{ color: theme.textColor, fontSize: '0.95rem' }}>
                                            {currentArch.title}
                                        </span>
                                        <span
                                            className="badge rounded-pill fw-bold"
                                            style={{
                                                fontSize: '0.7rem',
                                                backgroundColor: theme.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
                                                color: theme.textMuted,
                                                letterSpacing: '0.2px',
                                            }}
                                        >
                                            {currentArch.villagers}
                                        </span>
                                    </div>

                                    {/* Soundwave Visualizer Bars */}
                                    {isSpeaking ? (
                                        <div className="d-flex align-items-end gap-1" style={{ height: '18px' }}>
                                            <div className="rounded-pill" style={{ width: '3.5px', height: mouthOpen ? '16px' : '6px', backgroundColor: currentArch.color, transition: 'height 0.08s' }} />
                                            <div className="rounded-pill" style={{ width: '3.5px', height: mouthOpen ? '10px' : '18px', backgroundColor: currentArch.color, transition: 'height 0.08s' }} />
                                            <div className="rounded-pill" style={{ width: '3.5px', height: mouthOpen ? '18px' : '8px', backgroundColor: currentArch.color, transition: 'height 0.08s' }} />
                                            <div className="rounded-pill" style={{ width: '3.5px', height: mouthOpen ? '12px' : '15px', backgroundColor: currentArch.color, transition: 'height 0.08s' }} />
                                            <div className="rounded-pill" style={{ width: '3.5px', height: mouthOpen ? '16px' : '5px', backgroundColor: currentArch.color, transition: 'height 0.08s' }} />
                                        </div>
                                    ) : (
                                        <span className="tiny-text fw-bold text-muted d-flex align-items-center gap-1">
                                            <i className="fa-solid fa-clock" style={{ fontSize: '0.65rem' }} /> ~{estDurationSec}s audio
                                        </span>
                                    )}
                                </div>

                                {/* Animal Crossing Speech Box */}
                                <div
                                    className="p-3 rounded-4 fw-bold shadow-inner position-relative border"
                                    style={{
                                        fontSize: '0.92rem',
                                        lineHeight: '1.45',
                                        backgroundColor: theme.cardBg,
                                        borderColor: theme.borderSubtle,
                                        color: theme.textColor,
                                        minHeight: '64px',
                                    }}
                                >
                                    {isSpeaking && currentCharIndex >= 0 ? (
                                        <span>
                                            <span className="opacity-60">{text.slice(0, currentCharIndex)}</span>
                                            <span
                                                className="px-1.5 py-0.5 rounded-3 fw-black text-white shadow-xs mx-0.5"
                                                style={{
                                                    backgroundColor: currentArch.color,
                                                    display: 'inline-block',
                                                    transform: 'scale(1.15)',
                                                    transition: 'all 0.05s ease',
                                                }}
                                            >
                                                {text[currentCharIndex] || ''}
                                            </span>
                                            <span className="opacity-40">{text.slice(currentCharIndex + 1)}</span>
                                        </span>
                                    ) : (
                                        <span className="opacity-90">{text || 'Type your message below to hear authentic speech...'}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── TAB 1: SPEECH STUDIO ── */}
                    {activeTab === 'studio' && (
                        <>
                            {/* ── Voice Archetype Picker Grid ── */}
                            <div className="d-flex align-items-center justify-content-between mb-2">
                                <label className="fw-bold small text-uppercase tracking-wider mb-0" style={{ color: theme.textMuted }}>
                                    Select Villager Voice Archetype:
                                </label>
                                <span className="tiny-text opacity-70" style={{ color: theme.textMuted }}>
                                    6 Authentic Tone Sets
                                </span>
                            </div>

                            <div className="row g-2.5 mb-4">
                                {(Object.keys(ARCHETYPE_CONFIGS) as AnimaleseSoundType[]).map((voiceKey) => {
                                    const cfg = ARCHETYPE_CONFIGS[voiceKey];
                                    const isSelected = selectedVoice === voiceKey;

                                    return (
                                        <div className="col-6 col-sm-4" key={voiceKey}>
                                            <button
                                                type="button"
                                                onClick={() => handleSelectVoice(voiceKey)}
                                                className={`btn w-100 text-start p-2.5 rounded-4 d-flex flex-column gap-1 transition-all border shadow-sm position-relative overflow-hidden ${
                                                    isSelected ? 'scale-102' : ''
                                                }`}
                                                style={{
                                                    backgroundColor: isSelected ? theme.cardBg : theme.subtleBg,
                                                    borderColor: isSelected ? cfg.color : theme.borderSubtle,
                                                    borderWidth: isSelected ? '2.5px' : '1px',
                                                    color: theme.textColor,
                                                }}
                                            >
                                                {/* Left Accent Stripe */}
                                                <div
                                                    className="position-absolute top-0 start-0 bottom-0"
                                                    style={{
                                                        width: '4px',
                                                        backgroundColor: cfg.color,
                                                        opacity: isSelected ? 1 : 0.4,
                                                    }}
                                                />

                                                <div className="d-flex align-items-center justify-content-between ps-1.5 w-100">
                                                    <div className="d-flex align-items-center gap-2">
                                                        <div
                                                            className="rounded-circle d-flex align-items-center justify-content-center text-white shadow-xs"
                                                            style={{
                                                                width: '26px',
                                                                height: '26px',
                                                                fontSize: '0.75rem',
                                                                background: cfg.gradient,
                                                            }}
                                                        >
                                                            <i className={`fa-solid ${cfg.icon}`} />
                                                        </div>
                                                        <span className="fw-black small text-truncate" style={{ color: isSelected ? cfg.color : theme.textColor }}>
                                                            {cfg.name}
                                                        </span>
                                                    </div>

                                                    {isSelected && (
                                                        <i className="fa-solid fa-circle-check" style={{ color: cfg.color, fontSize: '0.85rem' }} />
                                                    )}
                                                </div>

                                                <div className="ps-1.5 text-truncate" style={{ fontSize: '0.7rem', color: theme.textMuted }}>
                                                    {cfg.villagers.split('·')[0].trim()}
                                                </div>
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* ── Text Input Area ── */}
                            <div className="mb-3.5">
                                <div className="d-flex align-items-center justify-content-between mb-1.5">
                                    <label className="fw-bold small text-uppercase tracking-wider mb-0" style={{ color: theme.textMuted }}>
                                        Text Message:
                                    </label>

                                    <div className="d-flex align-items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={pickRandomPhrase}
                                            className="btn btn-link p-0 text-decoration-none fw-bold d-flex align-items-center gap-1"
                                            style={{ fontSize: '0.72rem', color: currentArch.color }}
                                            title="Pick a random Animal Crossing phrase"
                                        >
                                            <i className="fa-solid fa-dice" /> Random Quote
                                        </button>

                                        <label className="d-flex align-items-center gap-1.5 mb-0 cursor-pointer user-select-none" style={{ fontSize: '0.72rem', color: theme.textMuted }}>
                                            <input
                                                type="checkbox"
                                                className="form-check-input mt-0 cursor-pointer"
                                                checked={isTypewriterEnabled}
                                                onChange={(e) => setIsTypewriterEnabled(e.target.checked)}
                                                style={{ accentColor: currentArch.color }}
                                            />
                                            <span className="fw-bold">Typewriter Audio</span>
                                        </label>
                                    </div>
                                </div>

                                <div className="position-relative">
                                    <textarea
                                        className="form-control rounded-4 fw-bold border shadow-sm custom-scrollbar"
                                        rows={3}
                                        value={text}
                                        onChange={(e) => handleTextChange(e.target.value)}
                                        placeholder="Type any message with 0-9 digits or A-Z letters..."
                                        style={{
                                            fontSize: '0.95rem',
                                            backgroundColor: theme.inputBg,
                                            borderColor: theme.inputBorder,
                                            color: theme.textColor,
                                            paddingRight: '36px',
                                        }}
                                    />
                                    {text.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setText('');
                                                playChimeClick();
                                            }}
                                            className="btn btn-link position-absolute top-0 end-0 p-2.5 text-muted border-0"
                                            title="Clear text"
                                        >
                                            <i className="fa-solid fa-xmark" style={{ fontSize: '0.85rem' }} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* ── Quick Phrase Chips ── */}
                            <div className="mb-4">
                                <small className="fw-bold d-block mb-1.5" style={{ fontSize: '0.72rem', color: theme.textMuted }}>
                                    Quick Island Phrases:
                                </small>
                                <div className="d-flex flex-wrap gap-1.5">
                                    {FUN_PHRASES.slice(0, 5).map((phrase, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => {
                                                setText(phrase);
                                                playSingleSoundBlip(selectedVoice, 'a', 0.4);
                                            }}
                                            className="btn btn-sm border text-truncate fw-bold rounded-pill transition-all"
                                            style={{
                                                maxWidth: '280px',
                                                fontSize: '0.72rem',
                                                backgroundColor: theme.subtleBg,
                                                borderColor: theme.borderSubtle,
                                                color: theme.textColor,
                                            }}
                                        >
                                            {phrase}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* ── Speed & Pitch Acoustic Controls ── */}
                            <div
                                className="row g-3 p-3.5 rounded-4 border shadow-sm mb-1"
                                style={{
                                    backgroundColor: theme.subtleBg,
                                    borderColor: theme.borderSubtle,
                                }}
                            >
                                <div className="col-6">
                                    <div className="d-flex justify-content-between align-items-center mb-1">
                                        <label className="x-small fw-black mb-0 text-uppercase" style={{ color: theme.textMuted }}>
                                            Speech Speed
                                        </label>
                                        <span
                                            className="badge border px-2 py-0.5 rounded-pill x-small fw-black"
                                            style={{
                                                backgroundColor: theme.cardBg,
                                                borderColor: theme.borderSubtle,
                                                color: currentArch.color,
                                            }}
                                        >
                                            {speed.toFixed(1)}x
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        className="form-range"
                                        min={0.6}
                                        max={2.2}
                                        step={0.1}
                                        value={speed}
                                        onChange={(e) => setSpeed(parseFloat(e.target.value))}
                                        style={{ accentColor: currentArch.color }}
                                    />
                                    <div className="d-flex justify-content-between x-small opacity-60" style={{ fontSize: '0.65rem' }}>
                                        <button type="button" onClick={() => setSpeed(0.8)} className="btn btn-link p-0 text-muted tiny-text text-decoration-none">0.8x</button>
                                        <button type="button" onClick={() => setSpeed(1.1)} className="btn btn-link p-0 text-muted tiny-text text-decoration-none">1.1x (Def)</button>
                                        <button type="button" onClick={() => setSpeed(1.8)} className="btn btn-link p-0 text-muted tiny-text text-decoration-none">1.8x (Fast)</button>
                                    </div>
                                </div>

                                <div className="col-6">
                                    <div className="d-flex justify-content-between align-items-center mb-1">
                                        <label className="x-small fw-black mb-0 text-uppercase" style={{ color: theme.textMuted }}>
                                            Voice Pitch
                                        </label>
                                        <span
                                            className="badge border px-2 py-0.5 rounded-pill x-small fw-black"
                                            style={{
                                                backgroundColor: theme.cardBg,
                                                borderColor: theme.borderSubtle,
                                                color: currentArch.color,
                                            }}
                                        >
                                            {pitch.toFixed(1)}x
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        className="form-range"
                                        min={0.6}
                                        max={1.8}
                                        step={0.1}
                                        value={pitch}
                                        onChange={(e) => setPitch(parseFloat(e.target.value))}
                                        style={{ accentColor: currentArch.color }}
                                    />
                                    <div className="d-flex justify-content-between x-small opacity-60" style={{ fontSize: '0.65rem' }}>
                                        <button type="button" onClick={() => setPitch(0.8)} className="btn btn-link p-0 text-muted tiny-text text-decoration-none">Deep</button>
                                        <button type="button" onClick={() => setPitch(1.0)} className="btn btn-link p-0 text-muted tiny-text text-decoration-none">Natural</button>
                                        <button type="button" onClick={() => setPitch(1.4)} className="btn btn-link p-0 text-muted tiny-text text-decoration-none">Chirpy</button>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {/* ── TAB 2: PHONEME SOUNDBOARD ── */}
                    {activeTab === 'soundboard' && (
                        <div className="animate-up">
                            {/* Header */}
                            <div className="d-flex align-items-center justify-content-between mb-3">
                                <div>
                                    <h6 className="fw-black mb-0 ac-font" style={{ color: theme.textColor }}>
                                        Interactive Letter Soundboard
                                    </h6>
                                    <small className="tiny-text text-muted">
                                        Tap any character or use your physical keyboard (0-9 & A-Z) to audition raw phonemes
                                    </small>
                                </div>

                                <span
                                    className="badge rounded-pill fw-bold text-white px-2.5 py-1 shadow-xs"
                                    style={{ backgroundColor: currentArch.color, fontSize: '0.72rem' }}
                                >
                                    Voice: {currentArch.name}
                                </span>
                            </div>

                            {/* Voice Font Switcher for Soundboard */}
                            <div
                                className="d-flex align-items-center gap-1.5 flex-wrap mb-3 p-2 rounded-4 border shadow-2xs"
                                style={{ backgroundColor: theme.subtleBg, borderColor: theme.borderSubtle }}
                            >
                                <span className="tiny-text fw-bold text-muted me-1 d-flex align-items-center gap-1">
                                    <i className="fa-solid fa-sliders" style={{ fontSize: '0.65rem' }} /> Voice Font:
                                </span>
                                {(Object.keys(ARCHETYPE_CONFIGS) as AnimaleseSoundType[]).map((vKey) => {
                                    const c = ARCHETYPE_CONFIGS[vKey];
                                    const isSel = selectedVoice === vKey;
                                    return (
                                        <button
                                            key={vKey}
                                            type="button"
                                            onClick={() => handleSelectVoice(vKey)}
                                            className={`btn btn-xs rounded-pill fw-black px-2.5 py-1 border transition-all ${
                                                isSel ? 'text-white shadow-xs scale-105' : 'text-muted'
                                            }`}
                                            style={{
                                                fontSize: '0.72rem',
                                                backgroundColor: isSel ? c.color : theme.cardBg,
                                                borderColor: isSel ? c.color : theme.borderSubtle,
                                            }}
                                        >
                                            <i className={`fa-solid ${c.icon} me-1`} />
                                            {c.name}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Live Soundboard Monitor Box */}
                            <div
                                className="d-flex align-items-center justify-content-between p-2.5 px-3 rounded-4 border mb-3 shadow-xs"
                                style={{ backgroundColor: theme.subtleBg, borderColor: theme.borderSubtle }}
                            >
                                <div className="d-flex align-items-center gap-3">
                                    <div
                                        className="rounded-circle d-flex align-items-center justify-content-center text-white fw-black shadow-xs transition-transform"
                                        style={{
                                            width: '40px',
                                            height: '40px',
                                            fontSize: '1.25rem',
                                            background: currentArch.gradient,
                                            transform: activeSoundboardKey ? 'scale(1.15) rotate(-5deg)' : 'none',
                                        }}
                                    >
                                        {lastPlayedPhoneme ? lastPlayedPhoneme.toUpperCase() : <i className="fa-solid fa-music" style={{ fontSize: '1rem' }} />}
                                    </div>
                                    <div>
                                        <div className="fw-black small ac-font" style={{ color: theme.textColor }}>
                                            {lastPlayedPhoneme ? `Active Phoneme: "${lastPlayedPhoneme.toUpperCase()}"` : 'Audition any character'}
                                        </div>
                                        <div className="tiny-text opacity-75" style={{ color: theme.textMuted }}>
                                            {lastPlayedPhoneme
                                                ? `Playing authentic .ogg sample in ${currentArch.name} voice font`
                                                : 'Press keys on keyboard or tap below to test'}
                                        </div>
                                    </div>
                                </div>

                                {lastPlayedPhoneme && (
                                    <button
                                        type="button"
                                        onClick={() => handleSoundboardTap(lastPlayedPhoneme)}
                                        className="btn btn-xs rounded-pill fw-bold px-2.5 py-1 d-flex align-items-center gap-1.5 shadow-2xs border"
                                        style={{
                                            backgroundColor: theme.cardBg,
                                            borderColor: theme.borderSubtle,
                                            color: currentArch.color,
                                        }}
                                        title="Replay this sound"
                                    >
                                        <i className="fa-solid fa-rotate-right" /> Replay
                                    </button>
                                )}
                            </div>

                            {/* Digits 0-9 Row */}
                            <div className="mb-3">
                                <div className="d-flex align-items-center justify-content-between mb-1.5">
                                    <label className="x-small fw-black text-uppercase tracking-wider mb-0 text-muted">
                                        Numbers (0-9):
                                    </label>
                                    <span className="tiny-text opacity-60 text-muted">
                                        Digits 0 to 9
                                    </span>
                                </div>
                                <div className="d-flex flex-wrap gap-1.5">
                                    {SOUNDBOARD_DIGITS.map((num) => {
                                        const isTapped = activeSoundboardKey === num;
                                        return (
                                            <button
                                                key={num}
                                                type="button"
                                                onClick={() => handleSoundboardTap(num)}
                                                className={`btn rounded-3 fw-black p-0 d-flex align-items-center justify-content-center transition-all border shadow-xs ${
                                                    isTapped ? 'scale-115 shadow-md' : ''
                                                }`}
                                                style={{
                                                    width: '42px',
                                                    height: '42px',
                                                    fontSize: '1.05rem',
                                                    backgroundColor: isTapped ? currentArch.color : theme.subtleBg,
                                                    color: isTapped ? '#ffffff' : theme.textColor,
                                                    borderColor: isTapped ? currentArch.color : theme.borderSubtle,
                                                }}
                                            >
                                                {num}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* QWERTY Alphabet Rows */}
                            <div>
                                <div className="d-flex align-items-center justify-content-between mb-1.5">
                                    <label className="x-small fw-black text-uppercase tracking-wider mb-0 text-muted">
                                        Letters (A-Z):
                                    </label>
                                    <span className="tiny-text opacity-60 text-muted">
                                        Alphabet phonemes
                                    </span>
                                </div>
                                {SOUNDBOARD_LETTERS.map((row, rowIdx) => (
                                    <div key={rowIdx} className="d-flex justify-content-center gap-1.5 mb-1.5">
                                        {row.map((char) => {
                                            const isTapped = activeSoundboardKey === char;
                                            return (
                                                <button
                                                    key={char}
                                                    type="button"
                                                    onClick={() => handleSoundboardTap(char)}
                                                    className={`btn rounded-3 fw-black p-0 d-flex align-items-center justify-content-center transition-all border shadow-xs ${
                                                        isTapped ? 'scale-115 shadow-md' : ''
                                                    }`}
                                                    style={{
                                                        width: '42px',
                                                        height: '42px',
                                                        fontSize: '1rem',
                                                        textTransform: 'uppercase',
                                                        backgroundColor: isTapped ? currentArch.color : theme.subtleBg,
                                                        color: isTapped ? '#ffffff' : theme.textColor,
                                                        borderColor: isTapped ? currentArch.color : theme.borderSubtle,
                                                    }}
                                                >
                                                    {char}
                                                </button>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Modal Footer Controls ── */}
                <div
                    className="p-3.5 px-4 border-top d-flex align-items-center justify-content-between gap-3 flex-shrink-0"
                    style={{
                        backgroundColor: theme.subtleBg,
                        borderColor: theme.borderSubtle,
                    }}
                >
                    <button
                        type="button"
                        onClick={handleDownload}
                        disabled={isDownloading || !text.trim()}
                        className="btn btn-sm rounded-pill fw-bold px-3.5 py-2 d-flex align-items-center gap-2 shadow-xs border transition-all"
                        style={{
                            borderColor: theme.borderSubtle,
                            color: theme.textColor,
                            backgroundColor: theme.cardBg,
                        }}
                        title="Render and download this speech as an uncompressed 16-bit PCM .WAV audio file"
                    >
                        {isDownloading ? (
                            <>
                                <span className="spinner-border spinner-border-sm" role="status" />
                                <span>Rendering WAV...</span>
                            </>
                        ) : (
                            <>
                                <i className="fa-solid fa-download" style={{ color: currentArch.color }} />
                                <span>Export .WAV</span>
                            </>
                        )}
                    </button>

                    <div className="d-flex align-items-center gap-2">
                        {isSpeaking ? (
                            <button
                                type="button"
                                onClick={handleStop}
                                className="btn btn-danger rounded-pill fw-black px-4 py-2 shadow-sm d-flex align-items-center gap-2"
                            >
                                <i className="fa-solid fa-stop" /> Stop Speaking
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handlePlay}
                                className="btn rounded-pill fw-black px-4 py-2 shadow-md d-flex align-items-center gap-2 text-white transition-all scale-102"
                                style={{
                                    background: currentArch.gradient,
                                    border: 'none',
                                }}
                                disabled={!text.trim()}
                            >
                                <i className="fa-solid fa-play" /> Speak Animalese
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AnimaleseVoiceModal;
