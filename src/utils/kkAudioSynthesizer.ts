/**
 * Animal Crossing / K.K. Slider Web Audio Synthesizer Engine
 * Polyphonic music synthesizer simulating acoustic guitar, vibraphone, and kalimba.
 * Plays full procedural melodies with chord progressions and basslines with 100% offline reliability.
 */

import { playCustomClickSound } from './soundFxManager';

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let currentPlaybackTimer: any = null;
let isPlaying = false;
let currentSongId: string | null = null;
let currentSongStep = 0;
let onTimeUpdateCallback: ((currentTime: number, duration: number) => void) | null = null;
let onSongEndedCallback: (() => void) | null = null;

// Frequency table for notes (in Hz)
export const NOTES: Record<string, number> = {
    'C3': 130.81, 'D3': 146.83, 'E3': 164.81, 'F3': 174.61, 'G3': 196.00, 'A3': 220.00, 'B3': 246.94,
    'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'F#4': 369.99, 'Gb4': 369.99, 'G4': 392.00,
    'G#4': 415.30, 'Ab4': 415.30, 'A4': 440.00, 'A#4': 466.16, 'Bb4': 466.16, 'B4': 493.88,
    'C5': 523.25, 'C#5': 554.37, 'Db5': 554.37, 'D5': 587.33, 'D#5': 622.25, 'Eb5': 622.25,
    'E5': 659.25, 'F5': 698.46, 'F#5': 739.99, 'Gb5': 739.99, 'G5': 783.99, 'G#5': 830.61,
    'A5': 880.00, 'A#5': 932.33, 'Bb5': 932.33, 'B5': 987.77,
    'C6': 1046.50, 'D6': 1174.66, 'E6': 1318.51, 'G6': 1567.98,
    'REST': 0,
};

export interface SynthesizedSong {
    id: string;
    bpm: number;
    steps: Array<{
        lead: string;       // Melody note
        harmony?: string;   // Chord / accompaniment note
        bass?: string;      // Bass note
        leadDuration?: number;
    }>;
}

export const SYNTH_SONGS: Record<string, SynthesizedSong> = {
    'bubblegum-kk': {
        id: 'bubblegum-kk',
        bpm: 128,
        steps: [
            { lead: 'E5', harmony: 'G4', bass: 'C3' },
            { lead: 'E5', harmony: 'G4' },
            { lead: 'E5', harmony: 'G4', bass: 'G3' },
            { lead: 'D5', harmony: 'F4' },
            { lead: 'C5', harmony: 'E4', bass: 'A3' },
            { lead: 'D5', harmony: 'F4' },
            { lead: 'E5', harmony: 'G4', bass: 'F3' },
            { lead: 'G5', harmony: 'B4' },
            { lead: 'E5', harmony: 'G4', bass: 'C3' },
            { lead: 'D5', harmony: 'F4' },
            { lead: 'C5', harmony: 'E4', bass: 'G3' },
            { lead: 'REST' },
            { lead: 'A4', harmony: 'C4', bass: 'A3' },
            { lead: 'C5', harmony: 'E4' },
            { lead: 'D5', harmony: 'F4', bass: 'F3' },
            { lead: 'E5', harmony: 'G4', bass: 'G3' },
            { lead: 'D5', harmony: 'F4', bass: 'G3' },
            { lead: 'C5', harmony: 'E4', bass: 'C3' },
            { lead: 'REST' },
            { lead: 'REST' },
        ],
    },
    'welcome-horizons': {
        id: 'welcome-horizons',
        bpm: 104,
        steps: [
            { lead: 'C5', harmony: 'E4', bass: 'C3' },
            { lead: 'REST' },
            { lead: 'E5', harmony: 'G4', bass: 'G3' },
            { lead: 'G5', harmony: 'B4' },
            { lead: 'C6', harmony: 'E5', bass: 'C3' },
            { lead: 'G5', harmony: 'C5' },
            { lead: 'E5', harmony: 'G4', bass: 'A3' },
            { lead: 'D5', harmony: 'F4', bass: 'F3' },
            { lead: 'C5', harmony: 'E4', bass: 'C3' },
            { lead: 'REST' },
            { lead: 'A4', harmony: 'C4', bass: 'F3' },
            { lead: 'B4', harmony: 'D4', bass: 'G3' },
            { lead: 'C5', harmony: 'E4', bass: 'C3' },
            { lead: 'REST' },
            { lead: 'E5', harmony: 'G4', bass: 'E3' },
            { lead: 'D5', harmony: 'F4', bass: 'G3' },
        ],
    },
    'kk-cruisin': {
        id: 'kk-cruisin',
        bpm: 96,
        steps: [
            { lead: 'A4', harmony: 'C4', bass: 'F3' },
            { lead: 'REST' },
            { lead: 'C5', harmony: 'E4', bass: 'G3' },
            { lead: 'D5', harmony: 'F4' },
            { lead: 'E5', harmony: 'G4', bass: 'A3' },
            { lead: 'D5', harmony: 'F4' },
            { lead: 'C5', harmony: 'E4', bass: 'G3' },
            { lead: 'A4', harmony: 'C4', bass: 'F3' },
            { lead: 'G4', harmony: 'B3', bass: 'E3' },
            { lead: 'REST' },
            { lead: 'A4', harmony: 'C4', bass: 'A3' },
            { lead: 'C5', harmony: 'E4' },
            { lead: 'D5', harmony: 'F4', bass: 'D3' },
            { lead: 'E5', harmony: 'G4', bass: 'E3' },
            { lead: 'A4', harmony: 'C4', bass: 'A3' },
            { lead: 'REST' },
        ],
    },
    'stale-cupcakes': {
        id: 'stale-cupcakes',
        bpm: 78,
        steps: [
            { lead: 'C5', harmony: 'E4', bass: 'C3' },
            { lead: 'REST' },
            { lead: 'D5', harmony: 'F4', bass: 'G3' },
            { lead: 'E5', harmony: 'G4', bass: 'C3' },
            { lead: 'D5', harmony: 'F4', bass: 'G3' },
            { lead: 'C5', harmony: 'E4', bass: 'A3' },
            { lead: 'A4', harmony: 'C4', bass: 'F3' },
            { lead: 'G4', harmony: 'B3', bass: 'G3' },
            { lead: 'E4', harmony: 'G3', bass: 'C3' },
            { lead: 'REST' },
            { lead: 'F4', harmony: 'A3', bass: 'F3' },
            { lead: 'G4', harmony: 'B3', bass: 'G3' },
            { lead: 'C5', harmony: 'E4', bass: 'C3' },
            { lead: 'REST' },
        ],
    },
    'kk-bossa': {
        id: 'kk-bossa',
        bpm: 112,
        steps: [
            { lead: 'A4', harmony: 'C4', bass: 'D3' },
            { lead: 'B4', harmony: 'D4' },
            { lead: 'C5', harmony: 'E4', bass: 'G3' },
            { lead: 'D5', harmony: 'F4' },
            { lead: 'E5', harmony: 'G4', bass: 'C3' },
            { lead: 'D5', harmony: 'F4' },
            { lead: 'C5', harmony: 'E4', bass: 'A3' },
            { lead: 'REST' },
            { lead: 'B4', harmony: 'D4', bass: 'E3' },
            { lead: 'A4', harmony: 'C4', bass: 'A3' },
            { lead: 'G4', harmony: 'B3', bass: 'G3' },
            { lead: 'REST' },
        ],
    },
    '5am-sunrise': {
        id: '5am-sunrise',
        bpm: 72,
        steps: [
            { lead: 'G4', harmony: 'B3', bass: 'G3' },
            { lead: 'A4', harmony: 'C4' },
            { lead: 'C5', harmony: 'E4', bass: 'C3' },
            { lead: 'REST' },
            { lead: 'E5', harmony: 'G4', bass: 'E3' },
            { lead: 'D5', harmony: 'F4', bass: 'G3' },
            { lead: 'C5', harmony: 'E4', bass: 'C3' },
            { lead: 'A4', harmony: 'C4', bass: 'F3' },
            { lead: 'G4', harmony: 'B3', bass: 'G3' },
            { lead: 'REST' },
        ],
    },
    '12pm-afternoon': {
        id: '12pm-afternoon',
        bpm: 110,
        steps: [
            { lead: 'C5', harmony: 'E4', bass: 'C3' },
            { lead: 'E5', harmony: 'G4' },
            { lead: 'G5', harmony: 'B4', bass: 'G3' },
            { lead: 'E5', harmony: 'G4' },
            { lead: 'F5', harmony: 'A4', bass: 'F3' },
            { lead: 'D5', harmony: 'F4', bass: 'G3' },
            { lead: 'C5', harmony: 'E4', bass: 'C3' },
            { lead: 'REST' },
        ],
    },
    'kk-house': {
        id: 'kk-house',
        bpm: 125,
        steps: [
            { lead: 'D5', harmony: 'F4', bass: 'D3' },
            { lead: 'D5', harmony: 'F4' },
            { lead: 'E5', harmony: 'G4', bass: 'A3' },
            { lead: 'G5', harmony: 'B4', bass: 'C3' },
            { lead: 'A5', harmony: 'C5', bass: 'D3' },
            { lead: 'G5', harmony: 'B4' },
            { lead: 'E5', harmony: 'G4', bass: 'C3' },
            { lead: 'D5', harmony: 'F4', bass: 'D3' },
        ],
    },
};

const getAudioContext = (): AudioContext | null => {
    try {
        if (!audioCtx) {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContextClass) {
                audioCtx = new AudioContextClass();
                masterGain = audioCtx.createGain();
                masterGain.gain.setValueAtTime(0.5, audioCtx.currentTime);
                masterGain.connect(audioCtx.destination);
            }
        }
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        return audioCtx;
    } catch {
        return null;
    }
};

export const setMasterVolume = (vol: number) => {
    try {
        const ctx = getAudioContext();
        if (ctx && masterGain) {
            masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, vol)), ctx.currentTime);
        }
    } catch { /* ignore */ }
};

/**
 * Click tactile UI sound (routed through Sound FX Customizer)
 */
export const playChimeClick = () => {
    try {
        // Dynamically import or call soundFxManager
        playCustomClickSound();
    } catch {
        try {
            const ctx = getAudioContext();
            if (!ctx) return;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.07);

            gain.gain.setValueAtTime(0.06, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);

            osc.connect(gain);
            if (masterGain) gain.connect(masterGain);
            else gain.connect(ctx.destination);

            osc.start();
            osc.stop(ctx.currentTime + 0.07);
        } catch { /* ignore */ }
    }
};

/**
 * Play order status chime alert
 * - 'preparing': Gentle 2-note upward chime
 * - 'ready': 4-note triumphant DAL boarding pass arrival fanfare
 */
export const playOrderAlertChime = (type: 'preparing' | 'ready' | 'alert' = 'ready') => {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;

        if (type === 'preparing') {
            playPluckNote(392.00, 0.35, 0.15, 'sine'); // G4
            setTimeout(() => playPluckNote(523.25, 0.45, 0.18, 'triangle'), 140); // C5
        } else {
            // 'ready' or 'alert' - 4 note DAL flight chime
            playPluckNote(523.25, 0.3, 0.14, 'triangle'); // C5
            setTimeout(() => playPluckNote(659.25, 0.3, 0.15, 'triangle'), 120); // E5
            setTimeout(() => playPluckNote(783.99, 0.35, 0.16, 'triangle'), 240); // G5
            setTimeout(() => playPluckNote(1046.50, 0.6, 0.20, 'sine'), 380);    // C6
        }
    } catch { /* ignore */ }
};

/**
 * Cheerful ascending melodic wave chime when waving hello to an online resident
 */
export const playWaveChime = () => {
    try {
        playPluckNote(523.25, 0.22, 0.14, 'triangle'); // C5
        setTimeout(() => playPluckNote(659.25, 0.24, 0.15, 'triangle'), 80);  // E5
        setTimeout(() => playPluckNote(783.99, 0.32, 0.16, 'sine'), 160);     // G5
        setTimeout(() => playPluckNote(1046.50, 0.45, 0.18, 'sine'), 260);    // C6
    } catch {
        playChimeClick();
    }
};

/**
 * Delightful reciprocal chime when resident waves back
 */
export const playWaveBackChime = () => {
    try {
        playPluckNote(783.99, 0.24, 0.13, 'sine');     // G5
        setTimeout(() => playPluckNote(987.77, 0.28, 0.15, 'triangle'), 100); // B5
        setTimeout(() => playPluckNote(1174.66, 0.38, 0.16, 'triangle'), 200); // D6
        setTimeout(() => playPluckNote(1567.98, 0.46, 0.17, 'sine'), 320);    // G6
    } catch {
        playChimeClick();
    }
};

/**
 * Plucks an acoustic instrument note (guitar / vibraphone)
 */
export const playPluckNote = (freq: number, duration = 0.45, volume = 0.12, type: 'triangle' | 'sine' = 'triangle') => {
    if (!freq || freq <= 0) return;
    try {
        const ctx = getAudioContext();
        if (!ctx) return;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);

        // Acoustic attack & gentle pluck decay envelope
        gain.gain.setValueAtTime(0.001, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

        osc.connect(gain);
        if (masterGain) gain.connect(masterGain);
        else gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + duration);
    } catch { /* ignore */ }
};

/**
 * Starts polyphonic playback of a synthesized K.K. track
 */
export const startJukeboxPlayback = (
    songId: string,
    volume = 0.5,
    onTimeUpdate?: (currentTime: number, duration: number) => void,
    onEnded?: () => void
) => {
    stopJukeboxPlayback();
    const ctx = getAudioContext();
    if (!ctx) return;

    setMasterVolume(volume);

    const song = SYNTH_SONGS[songId] || SYNTH_SONGS['welcome-horizons'];
    currentSongId = songId;
    isPlaying = true;
    currentSongStep = 0;
    onTimeUpdateCallback = onTimeUpdate || null;
    onSongEndedCallback = onEnded || null;

    const stepMs = Math.round((60 / song.bpm) * 1000 * 0.5); // 8th note duration
    const totalDurationSeconds = (song.steps.length * stepMs) / 1000;

    currentPlaybackTimer = setInterval(() => {
        if (!isPlaying) return;

        const step = song.steps[currentSongStep % song.steps.length];

        // 1. Lead Melody Note (Warm triangle guitar)
        if (step.lead && NOTES[step.lead]) {
            playPluckNote(NOTES[step.lead], 0.45, 0.14, 'triangle');
        }

        // 2. Harmony / Chord Note (Vibraphone sine)
        if (step.harmony && NOTES[step.harmony]) {
            playPluckNote(NOTES[step.harmony], 0.35, 0.08, 'sine');
        }

        // 3. Bass Note (Deep acoustic low end)
        if (step.bass && NOTES[step.bass]) {
            playPluckNote(NOTES[step.bass], 0.5, 0.16, 'sine');
        }

        currentSongStep++;
        const currentSecs = (currentSongStep * stepMs) / 1000;

        if (onTimeUpdateCallback) {
            onTimeUpdateCallback(currentSecs % totalDurationSeconds, totalDurationSeconds);
        }

        // Loop or end event trigger
        if (currentSongStep >= song.steps.length * 4) { // Repeat 4 loops before ending or looping
            currentSongStep = 0;
            if (onSongEndedCallback) onSongEndedCallback();
        }
    }, stepMs);
};

export const stopJukeboxPlayback = () => {
    isPlaying = false;
    currentSongId = null;
    if (currentPlaybackTimer) {
        clearInterval(currentPlaybackTimer);
        currentPlaybackTimer = null;
    }
};

export const isJukeboxPlaying = () => isPlaying;
export const getCurrentSongId = () => currentSongId;
