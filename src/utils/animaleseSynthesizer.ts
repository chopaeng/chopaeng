/**
 * Authentic Animalese Voice Synthesizer
 * Uses official Animal Crossing letter-by-letter sound samples (0-9 and a-z across 6 sound types)
 * with real-time speed scaling, pitch inflection contours, cadence pauses, and WAV export.
 */

import {
    type AnimaleseSoundType,
    SOUND_TYPE_CONFIGS,
    getSoundBuffer,
    getSharedAudioContext,
    preloadSoundType,
} from './animaleseSoundLoader';

export type AnimaleseVoice =
    | 'default'
    | 'deep'
    | 'squeaky'
    | 'robot'
    | 'tired'
    | 'tired_alt'
    // Backwards compatibility aliases
    | 'standard'
    | 'peppy'
    | 'cranky'
    | 'lazy';

export interface AnimaleseOptions {
    voice?: AnimaleseVoice;
    speed?: number;           // 0.5 (slow) to 2.2 (fast)
    pitchMultiplier?: number; // 0.6 (deep) to 1.8 (high)
    volume?: number;          // 0 to 1
    onProgress?: (index: number, char: string, total: number) => void;
    onComplete?: () => void;
}

export interface VoicePreset {
    id: AnimaleseSoundType;
    name: string;
    description: string;
    avatar: string;
    badge: string;
    pitchOffset: number;
    defaultSpeed: number;
}

export const VOICE_PRESETS: Record<string, VoicePreset> = {
    default: {
        id: 'default',
        name: 'Normal (Light)',
        description: 'Friendly, warm island resident chatter',
        avatar: 'fa-user',
        badge: 'Fauna / Goldie',
        pitchOffset: 1.0,
        defaultSpeed: 1.05,
    },
    standard: {
        id: 'default',
        name: 'Normal (Light)',
        description: 'Friendly, warm island resident chatter',
        avatar: 'fa-user',
        badge: 'Fauna / Goldie',
        pitchOffset: 1.0,
        defaultSpeed: 1.05,
    },
    deep: {
        id: 'deep',
        name: 'Cranky (Deep)',
        description: 'Low-pitched rumble like Tom Nook & Apollo',
        avatar: 'fa-leaf',
        badge: 'Tom Nook / Fang',
        pitchOffset: 0.9,
        defaultSpeed: 0.95,
    },
    cranky: {
        id: 'deep',
        name: 'Cranky (Deep)',
        description: 'Low-pitched rumble like Tom Nook & Apollo',
        avatar: 'fa-leaf',
        badge: 'Tom Nook / Fang',
        pitchOffset: 0.9,
        defaultSpeed: 0.95,
    },
    squeaky: {
        id: 'squeaky',
        name: 'Peppy (Squeaky)',
        description: 'High-energy, bouncy chatter like Rosie & Celeste',
        avatar: 'fa-star',
        badge: 'Rosie / Celeste',
        pitchOffset: 1.1,
        defaultSpeed: 1.2,
    },
    peppy: {
        id: 'squeaky',
        name: 'Peppy (Squeaky)',
        description: 'High-energy, bouncy chatter like Rosie & Celeste',
        avatar: 'fa-star',
        badge: 'Rosie / Celeste',
        pitchOffset: 1.1,
        defaultSpeed: 1.2,
    },
    robot: {
        id: 'robot',
        name: 'Cyber (Robot)',
        description: 'Mechanical 8-bit synthesized villager voice',
        avatar: 'fa-robot',
        badge: 'Cephalobot / Sprocket',
        pitchOffset: 1.0,
        defaultSpeed: 1.1,
    },
    tired: {
        id: 'tired',
        name: 'Lazy (Tired)',
        description: 'Sleepy, laid-back murmur like Brewster & Bob',
        avatar: 'fa-mug-hot',
        badge: 'Brewster / Bob',
        pitchOffset: 0.95,
        defaultSpeed: 0.88,
    },
    lazy: {
        id: 'tired',
        name: 'Lazy (Tired)',
        description: 'Sleepy, laid-back murmur like Brewster & Bob',
        avatar: 'fa-mug-hot',
        badge: 'Brewster / Bob',
        pitchOffset: 0.95,
        defaultSpeed: 0.88,
    },
    tired_alt: {
        id: 'tired_alt',
        name: 'Alvin (High Tired)',
        description: 'Curious, chirpy high-tone like Sasha & Sherb',
        avatar: 'fa-feather',
        badge: 'Sasha / Sherb',
        pitchOffset: 1.15,
        defaultSpeed: 1.12,
    },
};

export function resolveSoundType(voice: AnimaleseVoice = 'squeaky'): AnimaleseSoundType {
    const preset = VOICE_PRESETS[voice];
    return preset ? preset.id : 'default';
}

let activeSources: Array<{ stop: () => void; disconnect: () => void }> = [];
let speechTimeouts: any[] = [];
let currentSpeechToken = 0;

export function stopAnimalese(): void {
    currentSpeechToken++;
    activeSources.forEach((src) => {
        try {
            src.stop();
            src.disconnect();
        } catch { }
    });
    activeSources = [];

    speechTimeouts.forEach((t) => clearTimeout(t));
    speechTimeouts = [];
}

/**
 * Procedurally speaks any text in authentic Animal Crossing Animalese!
 */
export async function speakAnimalese(
    text: string,
    options: AnimaleseOptions = {}
): Promise<void> {
    if (!text || typeof window === 'undefined') return;

    stopAnimalese();
    const token = currentSpeechToken;

    const ctx = getSharedAudioContext();
    const soundType = resolveSoundType(options.voice);
    const config = SOUND_TYPE_CONFIGS[soundType];

    const speed = Math.max(0.5, Math.min(2.5, options.speed || config.defaultSpeed));
    const pitchMultiplier = Math.max(0.5, Math.min(2.2, (options.pitchMultiplier || 1.0) * config.pitchOffset));
    const volume = Math.max(0, Math.min(1, options.volume !== undefined ? options.volume : 0.8));

    // Base character timing in seconds (~48ms at 1.0x speed)
    const baseCharDuration = 0.052 / speed;
    const characters = text.split('');

    // Pre-load sounds for the characters used in this text
    const uniqueChars = Array.from(new Set(text.toLowerCase().replace(/[^a-z0-9]/g, '').split('')));
    await Promise.all(uniqueChars.map((c) => getSoundBuffer(soundType, c)));

    if (currentSpeechToken !== token) return; // cancelled while preloading

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(volume * 0.75, ctx.currentTime);
    masterGain.connect(ctx.destination);

    let currentTime = ctx.currentTime + 0.03;
    const isQuestion = /\?\s*$/.test(text);
    const isExclamation = /!\s*$/.test(text);

    for (let i = 0; i < characters.length; i++) {
        if (currentSpeechToken !== token) break;

        const char = characters[i];
        const lower = char.toLowerCase();

        // Check if question pitch rise applies near the end of the sentence
        let pitchInflection = 1.0;
        if (isQuestion && i >= characters.length - 4) {
            const step = i - (characters.length - 4);
            pitchInflection = 1.0 + step * 0.12; // Inquisitive rise
        } else if (isExclamation && i >= characters.length - 3) {
            pitchInflection = 1.15; // Emphatic pop
        }

        // Slight micro-pitch humanization (±2%)
        const microDetune = 1 + (Math.random() - 0.5) * 0.04;
        const finalRate = Math.max(0.2, Math.min(3.0, pitchMultiplier * pitchInflection * microDetune));

        if (char === ' ') {
            currentTime += baseCharDuration * 0.8;
            continue;
        }

        if (['.', '!', '?'].includes(char)) {
            currentTime += baseCharDuration * 2.8;
            continue;
        }

        if ([',', ';', ':', '-'].includes(char)) {
            currentTime += baseCharDuration * 1.8;
            continue;
        }

        if (/^[a-z0-9]$/.test(lower)) {
            const buffer = await getSoundBuffer(soundType, lower);
            if (buffer && currentSpeechToken === token) {
                const source = ctx.createBufferSource();
                source.buffer = buffer;
                source.playbackRate.setValueAtTime(finalRate, currentTime);

                // Quick fade out at the end of the phoneme to prevent clicks
                const charGain = ctx.createGain();
                const noteDuration = Math.min(buffer.duration / finalRate, baseCharDuration * 1.35);

                charGain.gain.setValueAtTime(1.0, currentTime);
                charGain.gain.setValueAtTime(1.0, currentTime + noteDuration - 0.008);
                charGain.gain.linearRampToValueAtTime(0.01, currentTime + noteDuration);

                source.connect(charGain);
                charGain.connect(masterGain);

                source.start(currentTime);
                source.stop(currentTime + noteDuration + 0.01);

                activeSources.push(source);

                // Schedule UI progress callback
                if (options.onProgress) {
                    const delayMs = Math.max(0, (currentTime - ctx.currentTime) * 1000);
                    const timeoutId = setTimeout(() => {
                        if (currentSpeechToken === token && options.onProgress) {
                            options.onProgress(i, char, characters.length);
                        }
                    }, delayMs);
                    speechTimeouts.push(timeoutId);
                }
            }

            currentTime += baseCharDuration;
        }
    }

    // Schedule completion callback
    if (options.onComplete) {
        const totalDelayMs = Math.max(0, (currentTime - ctx.currentTime + 0.1) * 1000);
        const completionTimeout = setTimeout(() => {
            if (currentSpeechToken === token && options.onComplete) {
                options.onComplete();
            }
        }, totalDelayMs);
        speechTimeouts.push(completionTimeout);
    }
}

/**
 * Encodes an AudioBuffer into standard 16-bit PCM WAV format.
 */
function audioBufferToWav(buffer: AudioBuffer): Blob {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;

    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    const dataLength = buffer.length * blockAlign;
    const headerLength = 44;
    const totalLength = headerLength + dataLength;

    const out = new Uint8Array(totalLength);
    const view = new DataView(out.buffer);

    function writeString(offset: number, str: string) {
        for (let i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i));
        }
    }

    // RIFF chunk descriptor
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(8, 'WAVE');

    // fmt sub-chunk
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, format, true); // AudioFormat (1 for PCM)
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true); // ByteRate
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);

    // data sub-chunk
    writeString(36, 'data');
    view.setUint32(40, dataLength, true);

    // Write samples
    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
        for (let channel = 0; channel < numChannels; channel++) {
            const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
            const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
            view.setInt16(offset, intSample, true);
            offset += 2;
        }
    }

    return new Blob([out], { type: 'audio/wav' });
}

/**
 * Exports speech audio to a high-quality .WAV Blob using OfflineAudioContext.
 */
export async function exportAnimaleseWav(
    text: string,
    options: AnimaleseOptions = {}
): Promise<Blob | null> {
    if (!text || typeof window === 'undefined') return null;

    const soundType = resolveSoundType(options.voice);
    const config = SOUND_TYPE_CONFIGS[soundType];
    const speed = Math.max(0.5, Math.min(2.5, options.speed || config.defaultSpeed));
    const pitchMultiplier = Math.max(0.5, Math.min(2.2, (options.pitchMultiplier || 1.0) * config.pitchOffset));
    const volume = Math.max(0, Math.min(1, options.volume !== undefined ? options.volume : 0.8));

    const baseCharDuration = 0.052 / speed;
    const characters = text.split('');

    // Preload required buffers
    const uniqueChars = Array.from(new Set(text.toLowerCase().replace(/[^a-z0-9]/g, '').split('')));
    const bufferMap = new Map<string, AudioBuffer>();
    await Promise.all(
        uniqueChars.map(async (c) => {
            const buf = await getSoundBuffer(soundType, c);
            if (buf) bufferMap.set(c, buf);
        })
    );

    // Calculate approximate duration
    let estimatedDuration = 0.1;
    for (const char of characters) {
        if (char === ' ') estimatedDuration += baseCharDuration * 0.8;
        else if (['.', '!', '?'].includes(char)) estimatedDuration += baseCharDuration * 2.8;
        else if ([',', ';', ':'].includes(char)) estimatedDuration += baseCharDuration * 1.8;
        else estimatedDuration += baseCharDuration;
    }
    estimatedDuration += 0.5;

    const sampleRate = 44100;
    const totalFrames = Math.ceil(estimatedDuration * sampleRate);
    const OfflineCtxClass = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
    const offlineCtx = new OfflineCtxClass(1, totalFrames, sampleRate);

    const masterGain = offlineCtx.createGain();
    masterGain.gain.setValueAtTime(volume * 0.75, 0);
    masterGain.connect(offlineCtx.destination);

    let currentTime = 0.05;
    const isQuestion = /\?\s*$/.test(text);
    const isExclamation = /!\s*$/.test(text);

    for (let i = 0; i < characters.length; i++) {
        const char = characters[i];
        const lower = char.toLowerCase();

        let pitchInflection = 1.0;
        if (isQuestion && i >= characters.length - 4) {
            const step = i - (characters.length - 4);
            pitchInflection = 1.0 + step * 0.12;
        } else if (isExclamation && i >= characters.length - 3) {
            pitchInflection = 1.15;
        }

        const finalRate = Math.max(0.2, Math.min(3.0, pitchMultiplier * pitchInflection));

        if (char === ' ') {
            currentTime += baseCharDuration * 0.8;
            continue;
        }
        if (['.', '!', '?'].includes(char)) {
            currentTime += baseCharDuration * 2.8;
            continue;
        }
        if ([',', ';', ':'].includes(char)) {
            currentTime += baseCharDuration * 1.8;
            continue;
        }

        const buffer = bufferMap.get(lower);
        if (buffer) {
            const source = offlineCtx.createBufferSource();
            source.buffer = buffer;
            source.playbackRate.setValueAtTime(finalRate, currentTime);

            const charGain = offlineCtx.createGain();
            const noteDuration = Math.min(buffer.duration / finalRate, baseCharDuration * 1.35);

            charGain.gain.setValueAtTime(1.0, currentTime);
            charGain.gain.setValueAtTime(1.0, currentTime + noteDuration - 0.008);
            charGain.gain.linearRampToValueAtTime(0.01, currentTime + noteDuration);

            source.connect(charGain);
            charGain.connect(masterGain);

            source.start(currentTime);
            source.stop(currentTime + noteDuration + 0.01);
        }

        currentTime += baseCharDuration;
    }

    const renderedBuffer = await offlineCtx.startRendering();
    return audioBufferToWav(renderedBuffer);
}

/**
 * Triggers download of generated Animalese speech as a .wav file.
 */
export async function downloadAnimaleseWav(
    text: string,
    options: AnimaleseOptions = {},
    customFilename?: string
): Promise<void> {
    const blob = await exportAnimaleseWav(text, options);
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const sanitized = text.slice(0, 20).replace(/[^a-z0-9_-]/gi, '_') || 'animalese';
    link.download = customFilename || `${sanitized}_voice.wav`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export { preloadSoundType };
