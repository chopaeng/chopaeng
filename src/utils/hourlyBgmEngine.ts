/**
 * Real-Time Hourly Island BGM Engine
 * Manages 24-hour Animal Crossing background music synced to player local time.
 * Supports auto-sync, weather switching (Sunny/Rain/Snow), Town Hall chime, and volume control.
 */

import { getHourlyBgmTrack, type HourlyBgmTrack } from '../data/hourlyBgmData';

export type BgmWeather = 'sunny' | 'rainy' | 'snowy';

export interface HourlyBgmState {
    hour: number;             // 0-23
    currentTrack: HourlyBgmTrack;
    isLiveSync: boolean;      // Auto sync with real clock
    weather: BgmWeather;
    isPlaying: boolean;
    volume: number;           // 0 to 1
    isMuted: boolean;
    chimeEnabled: boolean;
}

const STORAGE_HOUR_SYNC = 'chopaeng_hourly_bgm_live_sync';
const STORAGE_WEATHER = 'chopaeng_hourly_bgm_weather';
const STORAGE_CHIME = 'chopaeng_hourly_bgm_chime';
const STORAGE_VOLUME = 'chopaeng_hourly_bgm_volume';
const STORAGE_USER_PAUSED = 'chopaeng_hourly_bgm_user_paused';

class HourlyBgmEngine {
    private static instance: HourlyBgmEngine | null = null;
    private audioEl: HTMLAudioElement | null = null;
    private state: HourlyBgmState;
    private listeners: Set<(state: HourlyBgmState) => void> = new Set();
    private audioCtx: AudioContext | null = null;
    private userPaused: boolean = false;

    private constructor() {
        const nowHour = new Date().getHours();
        const savedSync = localStorage.getItem(STORAGE_HOUR_SYNC);
        const savedWeather = (localStorage.getItem(STORAGE_WEATHER) as BgmWeather) || 'sunny';
        const savedChime = localStorage.getItem(STORAGE_CHIME);
        const savedVol = localStorage.getItem(STORAGE_VOLUME);
        const savedPaused = localStorage.getItem(STORAGE_USER_PAUSED);

        this.userPaused = savedPaused === 'true';

        this.state = {
            hour: nowHour,
            currentTrack: getHourlyBgmTrack(nowHour),
            isLiveSync: savedSync !== null ? savedSync === 'true' : true,
            weather: ['sunny', 'rainy', 'snowy'].includes(savedWeather) ? savedWeather : 'sunny',
            isPlaying: false,
            volume: savedVol ? Math.max(0, Math.min(1, parseFloat(savedVol))) : 0.6,
            isMuted: false,
            chimeEnabled: savedChime !== null ? savedChime === 'true' : true,
        };

        this.initAudioElement();
        this.startClockWatcher();
        this.scheduleAutostart();
    }

    public static getInstance(): HourlyBgmEngine {
        if (!HourlyBgmEngine.instance) {
            HourlyBgmEngine.instance = new HourlyBgmEngine();
        }
        return HourlyBgmEngine.instance;
    }

    private initAudioElement() {
        if (typeof window === 'undefined') return;
        this.audioEl = new Audio();
        this.audioEl.loop = true;
        this.audioEl.preload = 'auto';
        this.updateAudioSource();
        this.applyVolume();

        this.audioEl.addEventListener('ended', () => {
            if (this.state.isLiveSync) {
                this.syncWithCurrentTime(false);
            }
        });
    }

    private updateAudioSource() {
        if (!this.audioEl) return;
        const track = this.state.currentTrack;
        const url = track.audioUrls[this.state.weather] || track.audioUrls.sunny;
        const wasPlaying = !this.audioEl.paused && this.state.isPlaying;

        if (this.audioEl.src !== url) {
            this.audioEl.src = url;
            this.audioEl.load();
            if (wasPlaying && !this.userPaused) {
                this.audioEl.play().catch(() => {});
            }
        }
    }

    private applyVolume() {
        if (!this.audioEl) return;
        this.audioEl.volume = this.state.isMuted ? 0 : this.state.volume;
    }

    private startClockWatcher() {
        if (typeof window === 'undefined') return;
        // Check every 30 seconds for hour turnover
        setInterval(() => {
            if (this.state.isLiveSync) {
                const nowHour = new Date().getHours();
                if (nowHour !== this.state.hour) {
                    if (this.state.chimeEnabled && this.state.isPlaying) {
                        this.playTownHallBell();
                    }
                    this.setHour(nowHour, false);
                }
            }
        }, 30000);
    }

    /**
     * Attempt autoplay on page load.
     * 1. Try immediately if the user has not explicitly paused previously.
     * 2. Fall back to the first user gesture (click / keydown / touchstart).
     */
    private scheduleAutostart(): void {
        if (typeof window === 'undefined') return;

        // If the user previously paused, respect their choice
        if (this.userPaused) return;

        const tryPlay = () => {
            if (this.userPaused || this.state.isPlaying) return;
            this.play().catch(() => {});
        };

        // Attempt 1: immediate (may be silently rejected by the browser)
        this.play().catch(() => {});

        // Attempt 2: on first user interaction
        const events = ['click', 'keydown', 'touchstart'] as const;
        const onInteraction = () => {
            events.forEach((ev) => window.removeEventListener(ev, onInteraction, { capture: true }));
            if (this.userPaused) return;
            tryPlay();
        };
        events.forEach((ev) =>
            window.addEventListener(ev, onInteraction, { once: true, capture: true })
        );
    }

    public getState(): HourlyBgmState {
        return { ...this.state };
    }

    public subscribe(listener: (state: HourlyBgmState) => void): () => void {
        this.listeners.add(listener);
        listener(this.getState());
        return () => this.listeners.delete(listener);
    }

    private notify() {
        const cur = this.getState();
        this.listeners.forEach((l) => l(cur));
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('chopaeng_hourly_bgm_change', { detail: cur }));
        }
    }

    public async play(): Promise<void> {
        this.userPaused = false;
        try {
            localStorage.setItem(STORAGE_USER_PAUSED, 'false');
        } catch {}

        if (!this.audioEl) return;
        try {
            this.state.isPlaying = true;
            this.updateAudioSource();
            this.applyVolume();
            await this.audioEl.play();
            // If pause was requested while play was resolving
            if (this.userPaused) {
                this.audioEl.pause();
                this.state.isPlaying = false;
            }
            this.notify();
        } catch (e) {
            this.state.isPlaying = false;
            this.notify();
        }
    }

    public pause(): void {
        this.userPaused = true;
        try {
            localStorage.setItem(STORAGE_USER_PAUSED, 'true');
        } catch {}

        if (this.audioEl) {
            this.audioEl.pause();
        }
        this.state.isPlaying = false;
        this.notify();
    }

    public togglePlay(): void {
        if (this.state.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    public setHour(hour: number, manualOverride: boolean = true): void {
        const normHour = Math.max(0, Math.min(23, Math.floor(hour)));
        this.state.hour = normHour;
        this.state.currentTrack = getHourlyBgmTrack(normHour);
        if (manualOverride) {
            this.state.isLiveSync = false;
            localStorage.setItem(STORAGE_HOUR_SYNC, 'false');
        }
        this.updateAudioSource();
        this.notify();
    }

    public setLiveSync(enable: boolean): void {
        this.state.isLiveSync = enable;
        localStorage.setItem(STORAGE_HOUR_SYNC, String(enable));
        if (enable) {
            const currentRealHour = new Date().getHours();
            this.setHour(currentRealHour, false);
        } else {
            this.notify();
        }
    }

    public syncWithCurrentTime(notifyIfUnchanged: boolean = true): void {
        const nowHour = new Date().getHours();
        if (this.state.hour !== nowHour || notifyIfUnchanged) {
            this.state.hour = nowHour;
            this.state.currentTrack = getHourlyBgmTrack(nowHour);
            this.updateAudioSource();
            this.notify();
        }
    }

    public setWeather(weather: BgmWeather): void {
        this.state.weather = weather;
        localStorage.setItem(STORAGE_WEATHER, weather);
        this.updateAudioSource();
        this.notify();
    }

    public setVolume(vol: number): void {
        const clamped = Math.max(0, Math.min(1, vol));
        this.state.volume = clamped;
        this.state.isMuted = false;
        localStorage.setItem(STORAGE_VOLUME, String(clamped));
        this.applyVolume();
        this.notify();
    }

    public toggleMute(): void {
        this.state.isMuted = !this.state.isMuted;
        this.applyVolume();
        this.notify();
    }

    public toggleChime(enabled?: boolean): void {
        this.state.chimeEnabled = enabled !== undefined ? enabled : !this.state.chimeEnabled;
        localStorage.setItem(STORAGE_CHIME, String(this.state.chimeEnabled));
        this.notify();
    }

    /**
     * Synthesize authentic ACNH Town Hall Bell Chime on the hour
     */
    public playTownHallBell(): void {
        try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContextClass) return;
            if (!this.audioCtx) {
                this.audioCtx = new AudioContextClass();
            }
            if (this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            }

            const ctx = this.audioCtx;
            const now = ctx.currentTime;

            // Authentic 4-note town bell melody: E5 (659.25), G5 (783.99), F5 (698.46), C5 (523.25)
            const bellNotes = [
                { freq: 659.25, time: 0.0, dur: 0.8 },
                { freq: 783.99, time: 0.4, dur: 0.8 },
                { freq: 698.46, time: 0.8, dur: 0.8 },
                { freq: 523.25, time: 1.2, dur: 1.6 },
            ];

            bellNotes.forEach(({ freq, time, dur }) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now + time);

                // Bell envelope
                gain.gain.setValueAtTime(0, now + time);
                gain.gain.linearRampToValueAtTime(0.3 * (this.state.isMuted ? 0 : this.state.volume), now + time + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + time + dur);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(now + time);
                osc.stop(now + time + dur);
            });
        } catch (e) {
            // Web Audio fallback
        }
    }
}

export const hourlyBgm = HourlyBgmEngine.getInstance();
