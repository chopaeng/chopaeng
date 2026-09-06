import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { KK_JUKEBOX_TRACKS, type JukeboxTrack } from '../../data/kkJukeboxTracks';
import {
    playChimeClick,
    startJukeboxPlayback,
    stopJukeboxPlayback,
} from '../../utils/kkAudioSynthesizer';
import {
    hourlyBgm,
    type HourlyBgmState,
    type BgmWeather,
} from '../../utils/hourlyBgmEngine';
import { HOURLY_BGM_TRACKS } from '../../data/hourlyBgmData';
import { getStoredTheme, type ThemeMode } from '../../utils/theme';
import {
    SOUND_FX_THEMES,
    getSoundFxTheme,
    setSoundFxTheme,
    getSoundFxVolume,
    setSoundFxVolume,
    playCustomClickSound,
    isTypingSoundsEnabled,
    setTypingSoundsEnabled,
    type SoundFxTheme,
} from '../../utils/soundFxManager';

type JukeboxMode = 'kk' | 'hourly' | 'sfx';

const STORAGE_KEY_MODE = 'chopaeng_audio_mode';
const STORAGE_KEY_TRACK = 'chopaeng_jukebox_track_id';
const STORAGE_KEY_VOLUME = 'chopaeng_jukebox_volume';
const STORAGE_KEY_SHOW_VOL = 'chopaeng_jukebox_show_volume';

const THEME_JUKEBOX_STYLES: Record<ThemeMode, {
    widgetBg: string;
    widgetBorder: string;
    widgetText: string;
    subtleBg: string;
    subtleBorder: string;
    pillBg: string;
    pillBorder: string;
    pillText: string;
    accentBtnBg: string;
    accentBtnText: string;
    accentBtnBorder: string;
    activeTabBg: string;
    dropdownBg: string;
    dropdownBorder: string;
    dropdownItemHover: string;
    isDark: boolean;
}> = {
    nook: {
        widgetBg: '#fffdfa',
        widgetBorder: '#2f3e35',
        widgetText: '#1e293b',
        subtleBg: '#f8fafc',
        subtleBorder: '#e2e8f0',
        pillBg: '#fffdfa',
        pillBorder: '#2f3e35',
        pillText: '#1e293b',
        accentBtnBg: '#37b06d',
        accentBtnText: '#ffffff',
        accentBtnBorder: '#2f3e35',
        activeTabBg: '#16a34a',
        dropdownBg: '#fffdfa',
        dropdownBorder: '#2f3e35',
        dropdownItemHover: 'rgba(55, 176, 109, 0.15)',
        isDark: false,
    },
    celeste: {
        widgetBg: '#1e293b',
        widgetBorder: '#4f46e5',
        widgetText: '#f8fafc',
        subtleBg: '#0f172a',
        subtleBorder: 'rgba(167, 139, 250, 0.28)',
        pillBg: '#0f172a',
        pillBorder: 'rgba(167, 139, 250, 0.35)',
        pillText: '#f8fafc',
        accentBtnBg: '#7c3aed',
        accentBtnText: '#ffffff',
        accentBtnBorder: '#a78bfa',
        activeTabBg: '#7c3aed',
        dropdownBg: '#1e293b',
        dropdownBorder: 'rgba(167, 139, 250, 0.4)',
        dropdownItemHover: 'rgba(139, 92, 246, 0.2)',
        isDark: true,
    },
    roost: {
        widgetBg: '#292524',
        widgetBorder: '#78350f',
        widgetText: '#fdf8f5',
        subtleBg: '#1c1917',
        subtleBorder: 'rgba(217, 119, 6, 0.28)',
        pillBg: '#1c1917',
        pillBorder: 'rgba(212, 163, 115, 0.35)',
        pillText: '#fdf8f5',
        accentBtnBg: '#a06b43',
        accentBtnText: '#ffffff',
        accentBtnBorder: '#d4a373',
        activeTabBg: '#a06b43',
        dropdownBg: '#292524',
        dropdownBorder: 'rgba(212, 163, 115, 0.4)',
        dropdownItemHover: 'rgba(217, 119, 6, 0.2)',
        isDark: true,
    },
    sakura: {
        widgetBg: '#ffffff',
        widgetBorder: 'rgba(236, 72, 153, 0.4)',
        widgetText: '#4a2040',
        subtleBg: '#fdf2f8',
        subtleBorder: 'rgba(236, 72, 153, 0.25)',
        pillBg: '#ffffff',
        pillBorder: 'rgba(236, 72, 153, 0.35)',
        pillText: '#4a2040',
        accentBtnBg: '#ec4899',
        accentBtnText: '#ffffff',
        accentBtnBorder: '#db2777',
        activeTabBg: '#ec4899',
        dropdownBg: '#ffffff',
        dropdownBorder: 'rgba(236, 72, 153, 0.4)',
        dropdownItemHover: 'rgba(236, 72, 153, 0.15)',
        isDark: false,
    },
    dal: {
        widgetBg: '#1e293b',
        widgetBorder: '#0284c7',
        widgetText: '#f8fafc',
        subtleBg: '#0f172a',
        subtleBorder: 'rgba(56, 189, 248, 0.28)',
        pillBg: '#0f172a',
        pillBorder: 'rgba(56, 189, 248, 0.35)',
        pillText: '#f8fafc',
        accentBtnBg: '#0284c7',
        accentBtnText: '#ffffff',
        accentBtnBorder: '#38bdf8',
        activeTabBg: '#0284c7',
        dropdownBg: '#1e293b',
        dropdownBorder: 'rgba(56, 189, 248, 0.4)',
        dropdownItemHover: 'rgba(2, 132, 199, 0.2)',
        isDark: true,
    },
    nooklink: {
        widgetBg: '#111827',
        widgetBorder: '#10b981',
        widgetText: '#f8fafc',
        subtleBg: '#090d16',
        subtleBorder: 'rgba(16, 185, 129, 0.3)',
        pillBg: '#090d16',
        pillBorder: 'rgba(16, 185, 129, 0.35)',
        pillText: '#f8fafc',
        accentBtnBg: '#10b981',
        accentBtnText: '#ffffff',
        accentBtnBorder: '#34d399',
        activeTabBg: '#10b981',
        dropdownBg: '#111827',
        dropdownBorder: 'rgba(16, 185, 129, 0.4)',
        dropdownItemHover: 'rgba(16, 185, 129, 0.2)',
        isDark: true,
    },
};

export const KKSliderJukebox: React.FC = () => {
    // Current theme synchronization
    const [currentTheme, setCurrentTheme] = useState<ThemeMode>(getStoredTheme);

    // Mode: 'kk' (K.K. Slider songs) or 'hourly' (24h Live Island BGM)
    const [audioMode, setAudioMode] = useState<JukeboxMode>(() => {
        const saved = localStorage.getItem(STORAGE_KEY_MODE) as JukeboxMode | null;
        return saved === 'hourly' ? 'hourly' : 'kk';
    });

    // Widget visible / open state
    const [isOpen, setIsOpen] = useState<boolean>(false);
    // Bottom volume row visible state
    const [showVolume] = useState<boolean>(() => {
        const saved = localStorage.getItem(STORAGE_KEY_SHOW_VOL);
        return saved !== null ? saved === 'true' : true;
    });

    // K.K. state
    const [isKKPlaying, setIsKKPlaying] = useState(false);
    const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
    const [isLooping, setIsLooping] = useState(false);
    const [isShuffling, setIsShuffling] = useState(false);
    const [isLoadingAudio, setIsLoadingAudio] = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);

    // Hourly BGM state
    const [hourlyState, setHourlyState] = useState<HourlyBgmState>(hourlyBgm.getState());
    const [hourDropdownOpen, setHourDropdownOpen] = useState(false);

    // Sound FX state & Aircheck state
    const [sfxTheme, setSfxThemeState] = useState<SoundFxTheme>(getSoundFxTheme);
    const [sfxVolume, setSfxVolumeState] = useState<number>(getSoundFxVolume);
    const [isAircheck, setIsAircheck] = useState<boolean>(false);
    const [isTypingEnabled, setIsTypingEnabled] = useState<boolean>(isTypingSoundsEnabled);

    // Shared Volume
    const [volume, setVolume] = useState<number>(() => {
        const saved = localStorage.getItem(STORAGE_KEY_VOLUME);
        return saved ? parseFloat(saved) : 0.65;
    });
    const [isMuted, setIsMuted] = useState(false);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const dropdownRef = useRef<HTMLDivElement | null>(null);
    const hourDropdownRef = useRef<HTMLDivElement | null>(null);

    const activeKKTrack: JukeboxTrack = useMemo(() => {
        return KK_JUKEBOX_TRACKS[currentTrackIndex] || KK_JUKEBOX_TRACKS[0];
    }, [currentTrackIndex]);

    // Sync theme updates
    useEffect(() => {
        const handleThemeUpdate = (e: any) => {
            if (e.detail?.theme) {
                setCurrentTheme(e.detail.theme);
            } else {
                setCurrentTheme(getStoredTheme());
            }
        };
        window.addEventListener('chopaeng_theme_updated', handleThemeUpdate);
        return () => window.removeEventListener('chopaeng_theme_updated', handleThemeUpdate);
    }, []);

    // Sync sound FX updates
    useEffect(() => {
        const handleSfxUpdate = (e: any) => {
            if (e.detail?.theme) setSfxThemeState(e.detail.theme);
            if (e.detail?.volume !== undefined) setSfxVolumeState(e.detail.volume);
            if (e.detail?.typingEnabled !== undefined) setIsTypingEnabled(e.detail.typingEnabled);
        };
        window.addEventListener('chopaeng_sfx_updated', handleSfxUpdate);
        return () => window.removeEventListener('chopaeng_sfx_updated', handleSfxUpdate);
    }, []);

    // Subscribe to Hourly BGM Engine state
    useEffect(() => {
        const unsubscribe = hourlyBgm.subscribe((newState) => {
            setHourlyState(newState);
        });
        return unsubscribe;
    }, []);

    // Restore saved track on mount
    useEffect(() => {
        const savedId = localStorage.getItem(STORAGE_KEY_TRACK);
        if (savedId) {
            const idx = KK_JUKEBOX_TRACKS.findIndex((t) => t.id === savedId);
            if (idx >= 0) setCurrentTrackIndex(idx);
        }
    }, []);

    // Save mode & volume
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY_MODE, audioMode);
    }, [audioMode]);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY_VOLUME, String(volume));
        hourlyBgm.setVolume(volume);
    }, [volume]);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY_SHOW_VOL, String(showVolume));
    }, [showVolume]);

    // Close dropdowns on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setDropdownOpen(false);
            }
            if (hourDropdownRef.current && !hourDropdownRef.current.contains(e.target as Node)) {
                setHourDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Global toggle listener
    useEffect(() => {
        const handleOpenJukebox = (e?: any) => {
            setIsOpen(true);
            playChimeClick();
            if (e?.detail?.mode) {
                setAudioMode(e.detail.mode);
            } else if (hourlyBgm.getState().isPlaying) {
                setAudioMode('hourly');
            }
        };
        const handleToggleJukebox = () => {
            setIsOpen((prev) => {
                const next = !prev;
                if (next && hourlyBgm.getState().isPlaying) {
                    setAudioMode('hourly');
                }
                return next;
            });
            playChimeClick();
        };

        window.addEventListener('chopaeng_open_jukebox', handleOpenJukebox);
        window.addEventListener('chopaeng_toggle_jukebox', handleToggleJukebox);

        return () => {
            window.removeEventListener('chopaeng_open_jukebox', handleOpenJukebox);
            window.removeEventListener('chopaeng_toggle_jukebox', handleToggleJukebox);
        };
    }, []);

    // Handle K.K. audio playback
    const stopKKAudio = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        stopJukeboxPlayback();
        setIsKKPlaying(false);
    }, []);

    const playKKAudio = useCallback(async (track: JukeboxTrack, aircheckOverride?: boolean) => {
        // Stop hourly if playing
        hourlyBgm.pause();

        const useAircheck = aircheckOverride !== undefined ? aircheckOverride : isAircheck;
        const targetUrl = useAircheck && track.radioAudioUrl ? track.radioAudioUrl : track.audioUrl;

        if (targetUrl) {
            if (audioRef.current) {
                stopJukeboxPlayback();
                audioRef.current.src = targetUrl;
                audioRef.current.volume = isMuted ? 0 : volume;
                setIsLoadingAudio(true);
                try {
                    await audioRef.current.play();
                    setIsKKPlaying(true);
                } catch {
                    // Fallback to Web Audio synthesizer
                    startJukeboxPlayback(track.id, isMuted ? 0 : volume);
                    setIsKKPlaying(true);
                } finally {
                    setIsLoadingAudio(false);
                }
            }
        } else {
            if (audioRef.current) audioRef.current.pause();
            startJukeboxPlayback(track.id, isMuted ? 0 : volume);
            setIsKKPlaying(true);
        }
    }, [isAircheck, isMuted, volume]);

    const toggleAircheck = () => {
        playChimeClick();
        const next = !isAircheck;
        setIsAircheck(next);
        if (isKKPlaying && activeKKTrack) {
            playKKAudio(activeKKTrack, next);
        }
    };

    const togglePlay = () => {
        playChimeClick();
        if (audioMode === 'kk') {
            if (isKKPlaying) {
                stopKKAudio();
            } else {
                playKKAudio(activeKKTrack);
            }
        } else {
            if (hourlyState.isPlaying) {
                hourlyBgm.pause();
            } else {
                stopKKAudio();
                hourlyBgm.play();
            }
        }
    };

    const handleNextTrack = () => {
        playChimeClick();
        let nextIndex: number;
        if (isShuffling) {
            nextIndex = Math.floor(Math.random() * KK_JUKEBOX_TRACKS.length);
        } else {
            nextIndex = (currentTrackIndex + 1) % KK_JUKEBOX_TRACKS.length;
        }
        setCurrentTrackIndex(nextIndex);
        localStorage.setItem(STORAGE_KEY_TRACK, KK_JUKEBOX_TRACKS[nextIndex].id);
        if (isKKPlaying) {
            playKKAudio(KK_JUKEBOX_TRACKS[nextIndex]);
        }
    };

    const handlePrevTrack = () => {
        playChimeClick();
        const prevIndex = (currentTrackIndex - 1 + KK_JUKEBOX_TRACKS.length) % KK_JUKEBOX_TRACKS.length;
        setCurrentTrackIndex(prevIndex);
        localStorage.setItem(STORAGE_KEY_TRACK, KK_JUKEBOX_TRACKS[prevIndex].id);
        if (isKKPlaying) {
            playKKAudio(KK_JUKEBOX_TRACKS[prevIndex]);
        }
    };

    const selectKKTrack = (index: number) => {
        playChimeClick();
        setCurrentTrackIndex(index);
        localStorage.setItem(STORAGE_KEY_TRACK, KK_JUKEBOX_TRACKS[index].id);
        setDropdownOpen(false);
        if (isKKPlaying) {
            playKKAudio(KK_JUKEBOX_TRACKS[index]);
        }
    };

    const selectHour = (hour: number) => {
        playChimeClick();
        hourlyBgm.setHour(hour, true);
        setHourDropdownOpen(false);
        if (!hourlyState.isPlaying) {
            stopKKAudio();
            hourlyBgm.play();
        }
    };

    const toggleAudioMode = (mode: JukeboxMode) => {
        playChimeClick();
        setAudioMode(mode);
        if (mode === 'hourly') {
            stopKKAudio();
            if (isKKPlaying) {
                hourlyBgm.play();
            }
        } else if (mode === 'kk') {
            if (isKKPlaying) {
                hourlyBgm.pause();
            }
        }
    };

    const openAnimaleseStudio = () => {
        playChimeClick();
        window.dispatchEvent(new CustomEvent('chopaeng_open_animalese_modal'));
    };

    const isCurrentPlaying = audioMode === 'kk' ? isKKPlaying : hourlyState.isPlaying;
    const themeStyle = THEME_JUKEBOX_STYLES[currentTheme] || THEME_JUKEBOX_STYLES.nook;

    return (
        <>
            {/* Hidden HTML5 Audio for K.K. Slider */}
            <audio
                ref={audioRef}
                crossOrigin="anonymous"
                onLoadedMetadata={() => setIsLoadingAudio(false)}
                onEnded={() => {
                    if (isLooping) {
                        if (audioRef.current) {
                            audioRef.current.currentTime = 0;
                            audioRef.current.play();
                        }
                    } else {
                        handleNextTrack();
                    }
                }}
                onError={() => {
                    setIsLoadingAudio(false);
                    if (isKKPlaying) {
                        startJukeboxPlayback(activeKKTrack.id, isMuted ? 0 : volume);
                    }
                }}
            />

            {/* ── EXPANDED FLOATING ISLAND RADIO & JUKEBOX WIDGET ── */}
            {isOpen && (
                <div
                    className="kk-widget-container position-fixed shadow-lg animate-up"
                    style={{
                        bottom: '20px',
                        left: '20px',
                        zIndex: 1060,
                        backgroundColor: themeStyle.widgetBg,
                        border: `3px solid ${themeStyle.widgetBorder}`,
                        borderRadius: '28px',
                        padding: '12px 16px',
                        color: themeStyle.widgetText,
                        boxShadow: `0 16px 40px rgba(0, 0, 0, ${themeStyle.isDark ? '0.5' : '0.2'}), 0 2px 6px rgba(0,0,0,0.08)`,
                        transition: 'all 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
                        maxWidth: 'calc(100vw - 32px)',
                        width: '360px',
                    }}
                >
                    {/* Mode Selector Tabs */}
                    <div
                        className="d-flex align-items-center justify-content-between gap-1 mb-2.5 pb-2 border-bottom"
                        style={{ borderColor: themeStyle.subtleBorder }}
                    >
                        <div
                            className="d-flex align-items-center gap-1 rounded-pill p-1 border"
                            style={{
                                backgroundColor: themeStyle.subtleBg,
                                borderColor: themeStyle.subtleBorder,
                            }}
                        >
                            <button
                                type="button"
                                onClick={() => toggleAudioMode('kk')}
                                className={`btn btn-xs rounded-pill px-2.5 py-1 fw-black transition-all ${
                                    audioMode === 'kk' ? 'shadow-xs' : 'btn-link text-muted text-decoration-none'
                                }`}
                                style={{
                                    fontSize: '0.72rem',
                                    backgroundColor: audioMode === 'kk' ? themeStyle.activeTabBg : 'transparent',
                                    color: audioMode === 'kk' ? '#ffffff' : (themeStyle.isDark ? '#94a3b8' : '#64748b'),
                                }}
                            >
                                <i className="fa-solid fa-guitar me-1" /> K.K. Slider
                            </button>
                            <button
                                type="button"
                                onClick={() => toggleAudioMode('hourly')}
                                className={`btn btn-xs rounded-pill px-2.5 py-1 fw-black transition-all ${
                                    audioMode === 'hourly' ? 'shadow-xs' : 'btn-link text-muted text-decoration-none'
                                }`}
                                style={{
                                    fontSize: '0.72rem',
                                    backgroundColor: audioMode === 'hourly' ? themeStyle.activeTabBg : 'transparent',
                                    color: audioMode === 'hourly' ? '#ffffff' : (themeStyle.isDark ? '#94a3b8' : '#64748b'),
                                }}
                            >
                                <i className="fa-solid fa-clock me-1" /> Hourly BGM
                            </button>
                            <button
                                type="button"
                                onClick={() => toggleAudioMode('sfx')}
                                className={`btn btn-xs rounded-pill px-2.5 py-1 fw-black transition-all ${
                                    audioMode === 'sfx' ? 'shadow-xs' : 'btn-link text-muted text-decoration-none'
                                }`}
                                style={{
                                    fontSize: '0.72rem',
                                    backgroundColor: audioMode === 'sfx' ? themeStyle.activeTabBg : 'transparent',
                                    color: audioMode === 'sfx' ? '#ffffff' : (themeStyle.isDark ? '#94a3b8' : '#64748b'),
                                }}
                                title="Customize UI Sound FX"
                            >
                                <i className="fa-solid fa-bell me-1" /> Sound FX
                            </button>
                        </div>

                        <div className="d-flex align-items-center gap-1.5">
                            <button
                                type="button"
                                onClick={openAnimaleseStudio}
                                className="btn btn-xs rounded-pill px-2 py-1 fw-bold d-flex align-items-center gap-1 border"
                                style={{
                                    fontSize: '0.7rem',
                                    borderColor: themeStyle.accentBtnBorder,
                                    color: themeStyle.accentBtnBg,
                                    backgroundColor: themeStyle.subtleBg,
                                }}
                                title="Open Animalese Voice Studio"
                            >
                                <i className="fa-solid fa-comment-dots" /> Speak
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="btn btn-link p-0 border-0"
                                style={{
                                    fontSize: '0.9rem',
                                    color: themeStyle.isDark ? '#94a3b8' : '#64748b',
                                }}
                                title="Close Radio Widget"
                            >
                                <i className="fa-solid fa-xmark" />
                            </button>
                        </div>
                    </div>

                    {/* ── Live Island BGM Active Banner when on K.K. or SFX tab ── */}
                    {hourlyState.isPlaying && audioMode !== 'hourly' && (
                        <div
                            className="d-flex align-items-center justify-content-between p-1.5 px-2.5 rounded-3 mb-2.5 border shadow-2xs animate-up"
                            style={{
                                backgroundColor: themeStyle.isDark ? 'rgba(16, 185, 129, 0.12)' : '#ecfdf5',
                                borderColor: themeStyle.isDark ? 'rgba(16, 185, 129, 0.3)' : '#a7f3d0',
                            }}
                        >
                            <div className="d-flex align-items-center gap-1.5 overflow-hidden">
                                <span className="spinner-grow spinner-grow-sm text-success" style={{ width: '8px', height: '8px' }} />
                                <span className="tiny-text fw-bold text-truncate" style={{ color: themeStyle.isDark ? '#6ee7b7' : '#047857', fontSize: '0.72rem' }}>
                                    Island BGM Active ({hourlyState.currentTrack.period} {hourlyState.weather === 'snowy' ? '❄️' : hourlyState.weather === 'rainy' ? '🌧️' : '☀️'})
                                </span>
                            </div>
                            <div className="d-flex align-items-center gap-1 flex-shrink-0">
                                <button
                                    type="button"
                                    onClick={() => {
                                        playChimeClick();
                                        setAudioMode('hourly');
                                    }}
                                    className="btn btn-xs rounded-pill px-2 py-0.5 fw-bold"
                                    style={{ fontSize: '0.66rem', color: '#10b981' }}
                                >
                                    View
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        playChimeClick();
                                        hourlyBgm.pause();
                                    }}
                                    className="btn btn-xs btn-danger rounded-pill px-2 py-0.5 fw-bold shadow-2xs"
                                    style={{ fontSize: '0.66rem' }}
                                    title="Pause Island BGM"
                                >
                                    <i className="fa-solid fa-pause me-1" /> Pause
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Sound FX Customizer Mode ── */}
                    {audioMode === 'sfx' ? (
                        <div className="mb-2 animate-up">
                            <div className="d-flex align-items-center justify-content-between mb-2">
                                <span className="fw-bold x-small text-uppercase" style={{ color: themeStyle.isDark ? '#94a3b8' : '#64748b' }}>
                                    Tactile Click Theme
                                </span>
                                <button
                                    type="button"
                                    onClick={() => playCustomClickSound()}
                                    className="btn btn-xs rounded-pill px-2.5 py-0.5 fw-bold border shadow-xs"
                                    style={{
                                        fontSize: '0.68rem',
                                        backgroundColor: themeStyle.pillBg,
                                        borderColor: themeStyle.subtleBorder,
                                        color: themeStyle.widgetText,
                                    }}
                                >
                                    <i className="fa-solid fa-play me-1" /> Test Click
                                </button>
                            </div>

                            <div className="row g-1.5 mb-2.5">
                                {SOUND_FX_THEMES.map((t) => {
                                    const isSelected = sfxTheme === t.id;
                                    return (
                                        <div className="col-6" key={t.id}>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSoundFxTheme(t.id);
                                                    setSfxThemeState(t.id);
                                                    playCustomClickSound();
                                                }}
                                                className="btn btn-sm w-100 text-start p-1.5 px-2 rounded-3 d-flex align-items-center gap-1.5 border transition-all"
                                                style={{
                                                    backgroundColor: isSelected ? themeStyle.activeTabBg : themeStyle.subtleBg,
                                                    borderColor: isSelected ? themeStyle.activeTabBg : themeStyle.subtleBorder,
                                                    color: isSelected ? '#ffffff' : themeStyle.widgetText,
                                                    fontSize: '0.72rem',
                                                    fontWeight: isSelected ? 'bold' : '600',
                                                }}
                                            >
                                                <i className={`fa-solid ${t.icon} x-small`} />
                                                <span className="text-truncate">{t.name.split(' ')[0]}</span>
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>

                            <div
                                className="p-2 rounded-3 border d-flex align-items-center justify-content-between gap-2"
                                style={{
                                    backgroundColor: themeStyle.subtleBg,
                                    borderColor: themeStyle.subtleBorder,
                                }}
                            >
                                <span className="x-small fw-bold" style={{ color: themeStyle.isDark ? '#94a3b8' : '#64748b' }}>
                                    SFX Vol
                                </span>
                                <input
                                    type="range"
                                    className="form-range flex-grow-1"
                                    min={0}
                                    max={1}
                                    step={0.05}
                                    value={sfxVolume}
                                    onChange={(e) => {
                                        const v = parseFloat(e.target.value);
                                        setSoundFxVolume(v);
                                        setSfxVolumeState(v);
                                    }}
                                    style={{ height: '4px', accentColor: themeStyle.accentBtnBg }}
                                />
                                <span className="fw-bold x-small" style={{ fontSize: '0.7rem', minWidth: '28px', color: themeStyle.isDark ? '#94a3b8' : '#64748b' }}>
                                    {Math.round(sfxVolume * 100)}%
                                </span>
                            </div>

                            {/* Live Input Typing Sounds Switch */}
                            <div
                                className="p-2 rounded-3 border d-flex align-items-center justify-content-between mt-2"
                                style={{
                                    backgroundColor: themeStyle.subtleBg,
                                    borderColor: themeStyle.subtleBorder,
                                }}
                            >
                                <div className="d-flex align-items-center gap-2">
                                    <i className="fa-solid fa-keyboard text-muted" style={{ fontSize: '0.8rem' }} />
                                    <div>
                                        <div className="fw-bold x-small" style={{ color: themeStyle.widgetText }}>
                                            Input Typing Audio
                                        </div>
                                        <div className="tiny-text text-muted" style={{ fontSize: '0.62rem' }}>
                                            Play Animalese phonemes when typing in inputs
                                        </div>
                                    </div>
                                </div>
                                <div className="form-check form-switch mb-0">
                                    <input
                                        className="form-check-input cursor-pointer"
                                        type="checkbox"
                                        role="switch"
                                        checked={isTypingEnabled}
                                        onChange={(e) => {
                                            setTypingSoundsEnabled(e.target.checked);
                                            setIsTypingEnabled(e.target.checked);
                                            playCustomClickSound();
                                        }}
                                        style={{ accentColor: themeStyle.accentBtnBg }}
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* ── Main Control Row ── */}
                            <div className="d-flex align-items-center gap-2 position-relative mb-2">
                                {/* Prev (KK Mode Only) */}
                                {audioMode === 'kk' ? (
                                    <button
                                        type="button"
                                        onClick={handlePrevTrack}
                                        className="btn rounded-circle d-flex align-items-center justify-content-center transition-all p-0 flex-shrink-0"
                                        style={{
                                            width: '34px',
                                            height: '34px',
                                            backgroundColor: themeStyle.pillBg,
                                            border: `2px solid ${themeStyle.pillBorder}`,
                                            color: themeStyle.pillText,
                                        }}
                                        title="Previous Track"
                                    >
                                        <i className="fa-solid fa-backward-step" style={{ fontSize: '0.75rem' }} />
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            playChimeClick();
                                            hourlyBgm.setHour((hourlyState.hour + 23) % 24, true);
                                        }}
                                        className="btn rounded-circle d-flex align-items-center justify-content-center transition-all p-0 flex-shrink-0"
                                        style={{
                                            width: '34px',
                                            height: '34px',
                                            backgroundColor: themeStyle.pillBg,
                                            border: `2px solid ${themeStyle.pillBorder}`,
                                            color: themeStyle.pillText,
                                        }}
                                        title="Previous Hour"
                                    >
                                        <i className="fa-solid fa-chevron-left" style={{ fontSize: '0.75rem' }} />
                                    </button>
                                )}

                                {/* Play / Pause Main Button */}
                                <button
                                    type="button"
                                    onClick={togglePlay}
                                    className="btn rounded-circle text-white d-flex align-items-center justify-content-center shadow-sm transition-all p-0 flex-shrink-0"
                                    style={{
                                        width: '42px',
                                        height: '42px',
                                        backgroundColor: themeStyle.accentBtnBg,
                                        border: `2.5px solid ${themeStyle.accentBtnBorder}`,
                                        transform: isCurrentPlaying ? 'scale(1.04)' : 'scale(1)',
                                    }}
                                    title={isCurrentPlaying ? 'Pause' : 'Play Music'}
                                >
                                    {isLoadingAudio ? (
                                        <span className="spinner-border spinner-border-sm" role="status" />
                                    ) : (
                                        <i
                                            className={`fa-solid ${isCurrentPlaying ? 'fa-pause' : 'fa-play'}`}
                                            style={{
                                                fontSize: '1rem',
                                                marginLeft: isCurrentPlaying ? '0' : '2px',
                                            }}
                                        />
                                    )}
                                </button>

                                {/* Next / Forward Button */}
                                {audioMode === 'kk' ? (
                                    <button
                                        type="button"
                                        onClick={handleNextTrack}
                                        className="btn rounded-circle d-flex align-items-center justify-content-center transition-all p-0 flex-shrink-0"
                                        style={{
                                            width: '34px',
                                            height: '34px',
                                            backgroundColor: themeStyle.pillBg,
                                            border: `2px solid ${themeStyle.pillBorder}`,
                                            color: themeStyle.pillText,
                                        }}
                                        title="Next Track"
                                    >
                                        <i className="fa-solid fa-forward-step" style={{ fontSize: '0.75rem' }} />
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            playChimeClick();
                                            hourlyBgm.setHour((hourlyState.hour + 1) % 24, true);
                                        }}
                                        className="btn rounded-circle d-flex align-items-center justify-content-center transition-all p-0 flex-shrink-0"
                                        style={{
                                            width: '34px',
                                            height: '34px',
                                            backgroundColor: themeStyle.pillBg,
                                            border: `2px solid ${themeStyle.pillBorder}`,
                                            color: themeStyle.pillText,
                                        }}
                                        title="Next Hour"
                                    >
                                        <i className="fa-solid fa-chevron-right" style={{ fontSize: '0.75rem' }} />
                                    </button>
                                )}

                                {/* Dropdown Selector Pill */}
                                {audioMode === 'kk' ? (
                                    <div className="position-relative flex-grow-1" ref={dropdownRef}>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                playChimeClick();
                                                setDropdownOpen(!dropdownOpen);
                                            }}
                                            className="btn rounded-pill d-flex align-items-center justify-content-between px-3 py-1 fw-black w-100 transition-all text-truncate"
                                            style={{
                                                backgroundColor: themeStyle.pillBg,
                                                border: `2px solid ${themeStyle.pillBorder}`,
                                                color: themeStyle.pillText,
                                                height: '36px',
                                                fontSize: '0.82rem',
                                            }}
                                        >
                                            <span className="text-truncate me-1">
                                                {currentTrackIndex + 1}. {activeKKTrack.title}
                                            </span>
                                            <i className={`fa-solid fa-caret-down text-muted transition-all ${dropdownOpen ? 'rotate-180' : ''}`} style={{ fontSize: '0.75rem' }} />
                                        </button>

                                        {dropdownOpen && (
                                            <div
                                                className="position-absolute bottom-100 start-0 mb-2 w-100 rounded-4 shadow-xl border overflow-hidden animate-up"
                                                style={{
                                                    backgroundColor: themeStyle.dropdownBg,
                                                    borderColor: themeStyle.dropdownBorder,
                                                    borderWidth: '2.5px',
                                                    maxHeight: '240px',
                                                    overflowY: 'auto',
                                                    zIndex: 1070,
                                                    minWidth: '230px',
                                                }}
                                            >
                                                <div
                                                    className="p-2 border-bottom d-flex align-items-center justify-content-between"
                                                    style={{
                                                        backgroundColor: themeStyle.subtleBg,
                                                        borderColor: themeStyle.subtleBorder,
                                                    }}
                                                >
                                                    <span className="tiny-text fw-bold text-muted text-uppercase">
                                                        <i className="fa-solid fa-music me-1" style={{ color: themeStyle.accentBtnBg }} /> K.K. Tracks ({KK_JUKEBOX_TRACKS.length})
                                                    </span>
                                                    <div className="d-flex align-items-center gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setIsShuffling(!isShuffling);
                                                                playChimeClick();
                                                            }}
                                                            className="btn btn-xs rounded-circle p-0 d-flex align-items-center justify-content-center border"
                                                            style={{
                                                                width: '22px',
                                                                height: '22px',
                                                                backgroundColor: isShuffling ? themeStyle.accentBtnBg : themeStyle.pillBg,
                                                                color: isShuffling ? '#ffffff' : (themeStyle.isDark ? '#94a3b8' : '#64748b'),
                                                                borderColor: themeStyle.subtleBorder,
                                                            }}
                                                        >
                                                            <i className="fa-solid fa-shuffle x-small" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setIsLooping(!isLooping);
                                                                playChimeClick();
                                                            }}
                                                            className="btn btn-xs rounded-circle p-0 d-flex align-items-center justify-content-center border"
                                                            style={{
                                                                width: '22px',
                                                                height: '22px',
                                                                backgroundColor: isLooping ? themeStyle.accentBtnBg : themeStyle.pillBg,
                                                                color: isLooping ? '#ffffff' : (themeStyle.isDark ? '#94a3b8' : '#64748b'),
                                                                borderColor: themeStyle.subtleBorder,
                                                            }}
                                                        >
                                                            <i className="fa-solid fa-repeat x-small" />
                                                        </button>
                                                    </div>
                                                </div>
                                                {KK_JUKEBOX_TRACKS.map((track, idx) => {
                                                    const isSelected = idx === currentTrackIndex;
                                                    return (
                                                        <button
                                                            key={track.id}
                                                            type="button"
                                                            onClick={() => selectKKTrack(idx)}
                                                            className="btn btn-sm w-100 text-start px-3 py-1.5 d-flex align-items-center justify-content-between border-0 transition-all"
                                                            style={{
                                                                backgroundColor: isSelected ? themeStyle.accentBtnBg : 'transparent',
                                                                color: isSelected ? '#ffffff' : themeStyle.widgetText,
                                                                fontSize: '0.8rem',
                                                                fontWeight: isSelected ? 'bold' : '600',
                                                            }}
                                                        >
                                                            <span className="text-truncate">{idx + 1}. {track.title}</span>
                                                            {isSelected && isKKPlaying && <i className="fa-solid fa-volume-high x-small ms-2" />}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    /* Hourly Track Selector */
                                    <div className="position-relative flex-grow-1" ref={hourDropdownRef}>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                playChimeClick();
                                                setHourDropdownOpen(!hourDropdownOpen);
                                            }}
                                            className="btn rounded-pill d-flex align-items-center justify-content-between px-3 py-1 fw-black w-100 transition-all text-truncate"
                                            style={{
                                                backgroundColor: themeStyle.pillBg,
                                                border: `2px solid ${themeStyle.pillBorder}`,
                                                color: themeStyle.pillText,
                                                height: '36px',
                                                fontSize: '0.82rem',
                                            }}
                                        >
                                            <span className="text-truncate me-1">
                                                🕒 {hourlyState.currentTrack.title}
                                            </span>
                                            <i className={`fa-solid fa-caret-down text-muted transition-all ${hourDropdownOpen ? 'rotate-180' : ''}`} style={{ fontSize: '0.75rem' }} />
                                        </button>

                                        {hourDropdownOpen && (
                                            <div
                                                className="position-absolute bottom-100 start-0 mb-2 w-100 rounded-4 shadow-xl border overflow-hidden animate-up"
                                                style={{
                                                    backgroundColor: themeStyle.dropdownBg,
                                                    borderColor: themeStyle.dropdownBorder,
                                                    borderWidth: '2.5px',
                                                    maxHeight: '240px',
                                                    overflowY: 'auto',
                                                    zIndex: 1070,
                                                    minWidth: '240px',
                                                }}
                                            >
                                                <div
                                                    className="p-2 border-bottom d-flex align-items-center justify-content-between"
                                                    style={{
                                                        backgroundColor: themeStyle.subtleBg,
                                                        borderColor: themeStyle.subtleBorder,
                                                    }}
                                                >
                                                    <span className="tiny-text fw-bold text-muted text-uppercase">
                                                        <i className="fa-solid fa-clock me-1" style={{ color: themeStyle.accentBtnBg }} /> 24 Hours
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            hourlyBgm.setLiveSync(true);
                                                            playChimeClick();
                                                        }}
                                                        className="btn btn-xs rounded-pill px-2 py-0.5 fw-bold border"
                                                        style={{
                                                            fontSize: '0.68rem',
                                                            backgroundColor: hourlyState.isLiveSync ? themeStyle.accentBtnBg : themeStyle.pillBg,
                                                            color: hourlyState.isLiveSync ? '#ffffff' : (themeStyle.isDark ? '#94a3b8' : '#64748b'),
                                                            borderColor: themeStyle.subtleBorder,
                                                        }}
                                                    >
                                                        ⚡ Live Sync
                                                    </button>
                                                </div>
                                                {HOURLY_BGM_TRACKS.map((track) => {
                                                    const isSelected = track.hour === hourlyState.hour;
                                                    return (
                                                        <button
                                                            key={track.hour}
                                                            type="button"
                                                            onClick={() => selectHour(track.hour)}
                                                            className="btn btn-sm w-100 text-start px-3 py-1.5 d-flex align-items-center justify-content-between border-0 transition-all"
                                                            style={{
                                                                backgroundColor: isSelected ? themeStyle.accentBtnBg : 'transparent',
                                                                color: isSelected ? '#ffffff' : themeStyle.widgetText,
                                                                fontSize: '0.8rem',
                                                                fontWeight: isSelected ? 'bold' : '600',
                                                            }}
                                                        >
                                                            <span className="text-truncate">{track.title}</span>
                                                            <span className="x-small opacity-75">{track.mood.split(',')[0]}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* KK Mode Aircheck / Version Switcher */}
                            {audioMode === 'kk' && (
                                <div
                                    className="d-flex align-items-center justify-content-between p-1.5 px-2.5 rounded-3 mb-2 border"
                                    style={{
                                        backgroundColor: themeStyle.subtleBg,
                                        borderColor: themeStyle.subtleBorder,
                                    }}
                                >
                                    <span className="badge rounded-pill fw-bold text-muted border x-small text-truncate" style={{ fontSize: '0.66rem' }}>
                                        {activeKKTrack.mood || activeKKTrack.category}
                                    </span>

                                    {activeKKTrack.radioAudioUrl ? (
                                        <button
                                            type="button"
                                            onClick={toggleAircheck}
                                            className={`btn btn-xs rounded-pill px-2.5 py-0.5 fw-bold d-flex align-items-center gap-1 border transition-all ${
                                                isAircheck ? 'shadow-xs' : ''
                                            }`}
                                            style={{
                                                fontSize: '0.68rem',
                                                backgroundColor: isAircheck ? themeStyle.activeTabBg : themeStyle.pillBg,
                                                color: isAircheck ? '#ffffff' : (themeStyle.isDark ? '#94a3b8' : '#64748b'),
                                                borderColor: isAircheck ? themeStyle.activeTabBg : themeStyle.subtleBorder,
                                            }}
                                            title="Switch between Live Acoustic (stool) and Studio Aircheck (Radio)"
                                        >
                                            <i className={`fa-solid ${isAircheck ? 'fa-radio' : 'fa-guitar'}`} />
                                            <span>{isAircheck ? 'Aircheck Radio' : 'Live Stool'}</span>
                                        </button>
                                    ) : (
                                        <span className="tiny-text opacity-60" style={{ fontSize: '0.68rem' }}>
                                            <i className="fa-solid fa-guitar me-1" />Live Version
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* Hourly Mode Details: Weather Selector & Live Sync Chip */}
                            {audioMode === 'hourly' && (
                                <div
                                    className="d-flex align-items-center justify-content-between p-1.5 px-2.5 rounded-3 mb-2 border"
                                    style={{
                                        backgroundColor: themeStyle.subtleBg,
                                        borderColor: themeStyle.subtleBorder,
                                    }}
                                >
                                    <div className="d-flex align-items-center gap-1">
                                        {(['sunny', 'rainy', 'snowy'] as BgmWeather[]).map((w) => (
                                            <button
                                                key={w}
                                                type="button"
                                                onClick={() => {
                                                    hourlyBgm.setWeather(w);
                                                    playChimeClick();
                                                }}
                                                className="btn btn-xs rounded-pill px-2 py-0.5 fw-bold border"
                                                style={{
                                                    fontSize: '0.68rem',
                                                    backgroundColor: hourlyState.weather === w ? themeStyle.accentBtnBg : themeStyle.pillBg,
                                                    color: hourlyState.weather === w ? '#ffffff' : (themeStyle.isDark ? '#94a3b8' : '#64748b'),
                                                    borderColor: themeStyle.subtleBorder,
                                                }}
                                            >
                                                {w === 'sunny' ? '☀️ Sun' : w === 'rainy' ? '🌧️ Rain' : '❄️ Snow'}
                                            </button>
                                        ))}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            hourlyBgm.toggleChime();
                                            playChimeClick();
                                        }}
                                        className="btn btn-xs rounded-pill px-2 py-0.5 fw-bold border"
                                        style={{
                                            fontSize: '0.68rem',
                                            backgroundColor: hourlyState.chimeEnabled ? (themeStyle.isDark ? 'rgba(34, 197, 94, 0.2)' : '#dcfce7') : themeStyle.pillBg,
                                            color: hourlyState.chimeEnabled ? '#22c55e' : (themeStyle.isDark ? '#94a3b8' : '#64748b'),
                                            borderColor: hourlyState.chimeEnabled ? '#86efac' : themeStyle.subtleBorder,
                                        }}
                                        title="Town Hall Bell Chime on the Hour"
                                    >
                                        <i className="fa-solid fa-bell me-1" /> Chime
                                    </button>
                                </div>
                            )}
                        </>
                    )}

                    {/* ── Volume Slider ── */}
                    {showVolume && (
                        <div
                            className="d-flex align-items-center justify-content-between gap-2 pt-1 border-top"
                            style={{ borderColor: themeStyle.subtleBorder }}
                        >
                            <button
                                type="button"
                                onClick={() => {
                                    setIsMuted(!isMuted);
                                    hourlyBgm.toggleMute();
                                    playChimeClick();
                                }}
                                className="btn btn-link p-0 border-0"
                                title={isMuted ? 'Unmute' : 'Mute'}
                                style={{ color: themeStyle.isDark ? '#94a3b8' : '#64748b' }}
                            >
                                <i className={`fa-solid ${isMuted || volume === 0 ? 'fa-volume-xmark text-danger' : 'fa-volume-low'}`} style={{ fontSize: '0.8rem' }} />
                            </button>

                            <input
                                type="range"
                                className="form-range flex-grow-1"
                                min={0}
                                max={1}
                                step={0.05}
                                value={isMuted ? 0 : volume}
                                onChange={(e) => {
                                    setVolume(parseFloat(e.target.value));
                                    setIsMuted(false);
                                }}
                                style={{ height: '4px', accentColor: themeStyle.accentBtnBg }}
                            />

                            <span
                                className="fw-bold x-small"
                                style={{
                                    fontSize: '0.7rem',
                                    minWidth: '28px',
                                    color: themeStyle.isDark ? '#94a3b8' : '#64748b',
                                }}
                            >
                                {isMuted ? '0%' : `${Math.round(volume * 100)}%`}
                            </span>
                        </div>
                    )}
                </div>
            )}
        </>
    );
};

export default KKSliderJukebox;
