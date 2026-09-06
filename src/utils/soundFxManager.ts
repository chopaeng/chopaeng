/**
 * ChoPaeng Sound FX Customizer Engine
 * Manages tactile UI sound effects across the application with authentic Animal Crossing themes:
 * - Animalese Blip (authentic character voice blip from assets)
 * - Nook Chime (warm resident leaf chime)
 * - Dodo Bell (D.A.L. airport departure chime)
 * - Nook Register (cash register ka-ching)
 * - Bell Bag (metallic coin pouch jingle)
 * - Muted (silent mode)
 * - Live Input Typing Sounds (real-time letter phoneme blips on inputs across the entire site!)
 */

import {
    playSingleSoundBlip,
    getSharedAudioContext,
    preloadSoundType,
    type AnimaleseSoundType,
} from './animaleseSoundLoader';

export type SoundFxTheme =
    | 'animalese'
    | 'nook_chime'
    | 'dodo_bell'
    | 'nook_register'
    | 'bell_bag'
    | 'muted';

export interface SoundFxThemeOption {
    id: SoundFxTheme;
    name: string;
    description: string;
    icon: string;
}

export const SOUND_FX_THEMES: SoundFxThemeOption[] = [
    {
        id: 'animalese',
        name: 'Animalese Blip',
        description: 'Authentic character speech phoneme blip on every interaction',
        icon: 'fa-comment-dots',
    },
    {
        id: 'nook_chime',
        name: 'Nook Chime',
        description: 'Classic warm islander marimba chime',
        icon: 'fa-leaf',
    },
    {
        id: 'dodo_bell',
        name: 'D.A.L. Airport Bell',
        description: 'Iconic Dodo Airlines boarding fanfare chime',
        icon: 'fa-plane',
    },
    {
        id: 'nook_register',
        name: 'Nook Cash Register',
        description: 'Crisp Bell counter shop register ka-ching',
        icon: 'fa-cash-register',
    },
    {
        id: 'bell_bag',
        name: 'Bell Pouch Coins',
        description: 'Rattling 99,000 Bell coin bag jingle',
        icon: 'fa-coins',
    },
    {
        id: 'muted',
        name: 'Muted',
        description: 'Silent UI navigation without click sounds',
        icon: 'fa-volume-xmark',
    },
];

const STORAGE_KEY_THEME = 'chopaeng_sound_fx_theme';
const STORAGE_KEY_VOL = 'chopaeng_sound_fx_volume';
const STORAGE_KEY_TYPING = 'chopaeng_typing_sounds_enabled';
const STORAGE_KEY_TYPING_VOICE = 'chopaeng_typing_sound_voice';

let cachedTheme: SoundFxTheme = 'animalese';
let cachedVolume: number = 0.5;
let cachedTypingEnabled: boolean = true;
let cachedTypingVoice: AnimaleseSoundType = 'default';

// Initialize from localStorage
if (typeof window !== 'undefined') {
    try {
        const storedTheme = localStorage.getItem(STORAGE_KEY_THEME) as SoundFxTheme;
        if (storedTheme && SOUND_FX_THEMES.some((t) => t.id === storedTheme)) {
            cachedTheme = storedTheme;
        }

        const storedVol = localStorage.getItem(STORAGE_KEY_VOL);
        if (storedVol !== null) {
            const v = parseFloat(storedVol);
            if (!isNaN(v)) cachedVolume = Math.max(0, Math.min(1, v));
        }

        const storedTyping = localStorage.getItem(STORAGE_KEY_TYPING);
        if (storedTyping !== null) {
            cachedTypingEnabled = storedTyping === 'true';
        }

        const storedTypingVoice = localStorage.getItem(STORAGE_KEY_TYPING_VOICE) as AnimaleseSoundType;
        if (storedTypingVoice && ['default', 'deep', 'squeaky', 'robot', 'tired', 'tired_alt'].includes(storedTypingVoice)) {
            cachedTypingVoice = storedTypingVoice;
        }

        // Pre-warm default typing voice
        preloadSoundType(cachedTypingVoice).catch(() => {});
    } catch {}
}

export function getSoundFxTheme(): SoundFxTheme {
    return cachedTheme;
}

export function setSoundFxTheme(theme: SoundFxTheme): void {
    cachedTheme = theme;
    if (typeof window !== 'undefined') {
        try {
            localStorage.setItem(STORAGE_KEY_THEME, theme);
            window.dispatchEvent(new CustomEvent('chopaeng_sfx_updated', {
                detail: {
                    theme,
                    volume: cachedVolume,
                    typingEnabled: cachedTypingEnabled,
                    typingVoice: cachedTypingVoice,
                }
            }));
        } catch {}
    }
}

export function getSoundFxVolume(): number {
    return cachedVolume;
}

export function setSoundFxVolume(volume: number): void {
    cachedVolume = Math.max(0, Math.min(1, volume));
    if (typeof window !== 'undefined') {
        try {
            localStorage.setItem(STORAGE_KEY_VOL, cachedVolume.toString());
            window.dispatchEvent(new CustomEvent('chopaeng_sfx_updated', {
                detail: {
                    theme: cachedTheme,
                    volume: cachedVolume,
                    typingEnabled: cachedTypingEnabled,
                    typingVoice: cachedTypingVoice,
                }
            }));
        } catch {}
    }
}

export function isTypingSoundsEnabled(): boolean {
    return cachedTypingEnabled;
}

export function setTypingSoundsEnabled(enabled: boolean): void {
    cachedTypingEnabled = enabled;
    if (typeof window !== 'undefined') {
        try {
            localStorage.setItem(STORAGE_KEY_TYPING, String(enabled));
            window.dispatchEvent(new CustomEvent('chopaeng_sfx_updated', {
                detail: {
                    theme: cachedTheme,
                    volume: cachedVolume,
                    typingEnabled: cachedTypingEnabled,
                    typingVoice: cachedTypingVoice,
                }
            }));
        } catch {}
    }
}

export function getTypingVoice(): AnimaleseSoundType {
    return cachedTypingVoice;
}

export function setTypingVoice(voice: AnimaleseSoundType): void {
    cachedTypingVoice = voice;
    preloadSoundType(voice).catch(() => {});
    if (typeof window !== 'undefined') {
        try {
            localStorage.setItem(STORAGE_KEY_TYPING_VOICE, voice);
            window.dispatchEvent(new CustomEvent('chopaeng_sfx_updated', {
                detail: {
                    theme: cachedTheme,
                    volume: cachedVolume,
                    typingEnabled: cachedTypingEnabled,
                    typingVoice: cachedTypingVoice,
                }
            }));
        } catch {}
    }
}

/**
 * Plays a live typing phoneme blip corresponding to a pressed key.
 */
export function playTypingKeystroke(key: string): void {
    if (!cachedTypingEnabled || cachedTheme === 'muted' || cachedVolume <= 0.01) return;

    try {
        const lower = key.toLowerCase();
        if (/^[a-z0-9]$/.test(lower)) {
            playSingleSoundBlip(cachedTypingVoice, lower, cachedVolume * 0.55);
        } else if (key === ' ' || key === 'Space') {
            playSingleSoundBlip(cachedTypingVoice, 'a', cachedVolume * 0.4);
        } else if (key === 'Backspace' || key === 'Delete') {
            playSingleSoundBlip(cachedTypingVoice, 'd', cachedVolume * 0.45);
        } else if (key === 'Enter') {
            playSingleSoundBlip(cachedTypingVoice, 'o', cachedVolume * 0.6);
        }
    } catch {}
}

/**
 * Plays the user-selected tactile UI click sound.
 */
export function playCustomClickSound(): void {
    if (cachedTheme === 'muted' || cachedVolume <= 0.01) return;

    try {
        if (cachedTheme === 'animalese') {
            playSingleSoundBlip(cachedTypingVoice, undefined, cachedVolume * 0.7);
            return;
        }

        const ctx = getSharedAudioContext();
        if (!ctx) return;
        const now = ctx.currentTime;

        if (cachedTheme === 'nook_chime') {
            // Two-tone rising harmonic marimba
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const gain = ctx.createGain();

            osc1.type = 'triangle';
            osc1.frequency.setValueAtTime(880, now);
            osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.08);

            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(1760, now);
            osc2.frequency.exponentialRampToValueAtTime(2640, now + 0.08);

            gain.gain.setValueAtTime(cachedVolume * 0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(ctx.destination);

            osc1.start(now);
            osc2.start(now);
            osc1.stop(now + 0.09);
            osc2.stop(now + 0.09);
        } else if (cachedTheme === 'dodo_bell') {
            // 2-tone airport chime (G5 -> C6)
            [783.99, 1046.5].forEach((freq, idx) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                const noteTime = now + idx * 0.045;

                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, noteTime);

                gain.gain.setValueAtTime(cachedVolume * 0.18, noteTime);
                gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.11);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(noteTime);
                osc.stop(noteTime + 0.12);
            });
        } else if (cachedTheme === 'nook_register') {
            // High register ding + metallic ping
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(2400, now);
            osc.frequency.exponentialRampToValueAtTime(1800, now + 0.06);

            gain.gain.setValueAtTime(cachedVolume * 0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.08);
        } else if (cachedTheme === 'bell_bag') {
            // Metallic coin clink
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(1200, now);
            osc.frequency.exponentialRampToValueAtTime(3200, now + 0.03);
            osc.frequency.exponentialRampToValueAtTime(1600, now + 0.08);

            gain.gain.setValueAtTime(cachedVolume * 0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.09);
        }
    } catch {}
}

// ── Global Event Listener for Real-Time Typing Sounds on all Inputs ──
let lastKeystrokeTime = 0;

function handleGlobalKeydown(e: KeyboardEvent) {
    if (!cachedTypingEnabled || cachedTheme === 'muted' || cachedVolume <= 0.01) return;

    // Ignore keyboard shortcuts (Ctrl+C, Cmd+V, Alt+Tab, etc.)
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    // Target element check: only play when typing in an input, textarea, or contenteditable
    const target = e.target as HTMLElement | null;
    if (!target) return;

    const isInput =
        target.tagName === 'INPUT' &&
        !['checkbox', 'radio', 'range', 'file', 'color', 'submit', 'button', 'reset'].includes(
            (target as HTMLInputElement).type?.toLowerCase() || ''
        );
    const isTextArea = target.tagName === 'TEXTAREA';
    const isContentEditable = target.isContentEditable;

    if (!isInput && !isTextArea && !isContentEditable) return;

    // Ignore lonely modifier keys
    if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab', 'Escape'].includes(e.key)) return;

    // Throttle repeat keys (e.g. key holding) to 60ms minimum
    const now = performance.now();
    if (e.repeat && now - lastKeystrokeTime < 60) return;
    lastKeystrokeTime = now;

    playTypingKeystroke(e.key);
}

// Attach listener globally in browser
if (typeof window !== 'undefined') {
    window.addEventListener('keydown', handleGlobalKeydown, { capture: true, passive: true });
}
