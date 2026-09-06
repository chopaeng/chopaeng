/**
 * Animalese Sound Loader & AudioBuffer Manager
 * Loads authentic Animal Crossing 0-9 and a-z sound assets across 6 sound types
 * with instant in-memory AudioBuffer caching and background pre-warming.
 */

export type AnimaleseSoundType =
    | 'default'    // Light / Normal (snd_light_*.ogg)
    | 'deep'       // Deep / Cranky (snd_deep_*.ogg)
    | 'squeaky'    // Peppy / Squeaky (snd_squeaky_*.ogg)
    | 'robot'      // Robot / Cyber (snd_robot_*.ogg)
    | 'tired'      // Lazy / Tired (snd_tired_*.ogg)
    | 'tired_alt'; // Alvin / High-Pitched Tired (s_alvin_*.ogg)

export interface SoundTypeConfig {
    id: AnimaleseSoundType;
    name: string;
    folder: string;
    prefix: string;
    description: string;
    avatar: string;
    badge: string;
    pitchOffset: number; // default pitch multiplier for this archetype
    defaultSpeed: number;
}

export const SOUND_TYPE_CONFIGS: Record<AnimaleseSoundType, SoundTypeConfig> = {
    default: {
        id: 'default',
        name: 'Normal (Light)',
        folder: 'default',
        prefix: 'snd_light_',
        description: 'Friendly, warm island resident chatter',
        avatar: 'fa-user',
        badge: 'Fauna / Goldie',
        pitchOffset: 1.0,
        defaultSpeed: 1.05,
    },
    deep: {
        id: 'deep',
        name: 'Cranky (Deep)',
        folder: 'deep',
        prefix: 'snd_deep_',
        description: 'Low-pitched rumble like Tom Nook & Apollo',
        avatar: 'fa-leaf',
        badge: 'Tom Nook / Fang',
        pitchOffset: 0.9,
        defaultSpeed: 0.95,
    },
    squeaky: {
        id: 'squeaky',
        name: 'Peppy (Squeaky)',
        folder: 'squeaky',
        prefix: 'snd_squeaky_',
        description: 'High-energy, bouncy chatter like Rosie & Celeste',
        avatar: 'fa-star',
        badge: 'Rosie / Audie',
        pitchOffset: 1.1,
        defaultSpeed: 1.2,
    },
    robot: {
        id: 'robot',
        name: 'Cyber (Robot)',
        folder: 'robot',
        prefix: 'snd_robot_',
        description: 'Mechanical 8-bit synthesized villager voice',
        avatar: 'fa-robot',
        badge: 'Cephalobot / Sprocket',
        pitchOffset: 1.0,
        defaultSpeed: 1.1,
    },
    tired: {
        id: 'tired',
        name: 'Lazy (Tired)',
        folder: 'tired',
        prefix: 'snd_tired_',
        description: 'Sleepy, laid-back murmur like Brewster & Bob',
        avatar: 'fa-mug-hot',
        badge: 'Brewster / Bob',
        pitchOffset: 0.95,
        defaultSpeed: 0.85,
    },
    tired_alt: {
        id: 'tired_alt',
        name: 'Alvin (High Tired)',
        folder: 'tired (alt)',
        prefix: 's_alvin_',
        description: 'Curious, chirpy high-tone like Sasha & Sherb',
        avatar: 'fa-feather',
        badge: 'Sasha / Sherb',
        pitchOffset: 1.15,
        defaultSpeed: 1.1,
    },
};

// Index all .ogg sound files eagerly via Vite's asset globber
const SOUND_MODULES = import.meta.glob('/src/assets/sounds/**/*.ogg', {
    eager: true,
    query: '?url',
    import: 'default',
}) as Record<string, string>;

// Normalized lookup map: "folder/filename" -> asset URL
const URL_BY_KEY = new Map<string, string>();

for (const [path, url] of Object.entries(SOUND_MODULES)) {
    const match = path.match(/sounds[/\\]([^/\\]+)[/\\]([^/\\]+\.ogg)$/i);
    if (match) {
        const folder = match[1].toLowerCase();
        const filename = match[2].toLowerCase();
        URL_BY_KEY.set(`${folder}/${filename}`, url);
    }
}

// In-memory decoded AudioBuffer cache
const BUFFER_CACHE = new Map<string, AudioBuffer>();
const PENDING_LOADS = new Map<string, Promise<AudioBuffer | null>>();

let sharedAudioContext: AudioContext | null = null;

export function getSharedAudioContext(): AudioContext {
    if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        sharedAudioContext = new AudioCtxClass();
    }
    if (sharedAudioContext.state === 'suspended') {
        sharedAudioContext.resume().catch(() => {});
    }
    return sharedAudioContext;
}

/**
 * Returns the resolved asset URL for a given sound type and character.
 */
export function getSoundUrl(soundType: AnimaleseSoundType, char: string): string | null {
    const config = SOUND_TYPE_CONFIGS[soundType] || SOUND_TYPE_CONFIGS.default;
    const c = char.toLowerCase();
    const filename = `${config.prefix}${c}.ogg`;
    const key = `${config.folder.toLowerCase()}/${filename.toLowerCase()}`;
    return URL_BY_KEY.get(key) || null;
}

/**
 * Fetches and decodes the AudioBuffer for a given character and sound type.
 */
export async function getSoundBuffer(
    soundType: AnimaleseSoundType,
    char: string
): Promise<AudioBuffer | null> {
    const config = SOUND_TYPE_CONFIGS[soundType] || SOUND_TYPE_CONFIGS.default;
    const c = char.toLowerCase();

    // Only 0-9 and a-z have audio samples
    if (!/^[a-z0-9]$/.test(c)) {
        return null;
    }

    const cacheKey = `${config.id}:${c}`;
    if (BUFFER_CACHE.has(cacheKey)) {
        return BUFFER_CACHE.get(cacheKey)!;
    }

    if (PENDING_LOADS.has(cacheKey)) {
        return PENDING_LOADS.get(cacheKey)!;
    }

    const loadPromise = (async (): Promise<AudioBuffer | null> => {
        try {
            const url = getSoundUrl(soundType, c);
            if (!url) return null;

            const response = await fetch(url);
            if (!response.ok) return null;

            const arrayBuffer = await response.arrayBuffer();
            const ctx = getSharedAudioContext();
            const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

            BUFFER_CACHE.set(cacheKey, audioBuffer);
            return audioBuffer;
        } catch (err) {
            console.warn(`[AnimaleseSoundLoader] Failed to decode ${config.id}/${c}:`, err);
            return null;
        } finally {
            PENDING_LOADS.delete(cacheKey);
        }
    })();

    PENDING_LOADS.set(cacheKey, loadPromise);
    return loadPromise;
}

/**
 * Preloads and decodes all 36 characters (0-9, a-z) for a sound type into memory.
 */
export async function preloadSoundType(soundType: AnimaleseSoundType): Promise<void> {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyz'.split('');
    await Promise.all(chars.map((c) => getSoundBuffer(soundType, c)));
}

/**
 * Plays a single quick phoneme blip (ideal for button clicks and typewriter keystrokes).
 */
export async function playSingleSoundBlip(
    soundType: AnimaleseSoundType = 'default',
    char?: string,
    volume: number = 0.5
): Promise<void> {
    try {
        const c = char && /^[a-z0-9]$/i.test(char)
            ? char.toLowerCase()
            : 'aeiou'[Math.floor(Math.random() * 5)];

        const buffer = await getSoundBuffer(soundType, c);
        if (!buffer) return;

        const ctx = getSharedAudioContext();
        const source = ctx.createBufferSource();
        source.buffer = buffer;

        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), ctx.currentTime);

        source.connect(gainNode);
        gainNode.connect(ctx.destination);

        source.start(ctx.currentTime);
    } catch {
        // AudioContext may be blocked before first user gesture
    }
}
