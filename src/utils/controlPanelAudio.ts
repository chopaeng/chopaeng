/**
 * Audio cues for Control Panel live events (Air arrivals, alerts, action completions)
 */
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!audioCtx) {
        const AudioContextClass =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioContextClass) {
            audioCtx = new AudioContextClass();
        }
    }
    if (audioCtx && audioCtx.state === "suspended") {
        audioCtx.resume().catch(() => {});
    }
    return audioCtx;
}

export function playCockpitSound(type: "arrival" | "alert" | "action" | "undo"): void {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const now = ctx.currentTime;

        if (type === "arrival") {
            // Friendly 2-tone airport chime (G5 -> C6)
            [783.99, 1046.5].forEach((freq, idx) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                const noteTime = now + idx * 0.08;

                osc.type = "sine";
                osc.frequency.setValueAtTime(freq, noteTime);

                gain.gain.setValueAtTime(0.12, noteTime);
                gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.25);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(noteTime);
                osc.stop(noteTime + 0.25);
            });
        } else if (type === "alert") {
            // Attention 2-tone warning chime
            [587.33, 440].forEach((freq, idx) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                const noteTime = now + idx * 0.12;

                osc.type = "triangle";
                osc.frequency.setValueAtTime(freq, noteTime);

                gain.gain.setValueAtTime(0.15, noteTime);
                gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.2);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(noteTime);
                osc.stop(noteTime + 0.2);
            });
        } else if (type === "action") {
            // Bright cheerful rising arpeggio (C5 -> E5 -> G5)
            [523.25, 659.25, 783.99].forEach((freq, idx) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                const noteTime = now + idx * 0.06;

                osc.type = "sine";
                osc.frequency.setValueAtTime(freq, noteTime);

                gain.gain.setValueAtTime(0.1, noteTime);
                gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.18);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(noteTime);
                osc.stop(noteTime + 0.18);
            });
        } else if (type === "undo") {
            // Descending chime
            [783.99, 523.25].forEach((freq, idx) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                const noteTime = now + idx * 0.08;

                osc.type = "sine";
                osc.frequency.setValueAtTime(freq, noteTime);

                gain.gain.setValueAtTime(0.1, noteTime);
                gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.2);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(noteTime);
                osc.stop(noteTime + 0.2);
            });
        }
    } catch {
        // Ignore audio errors if audio context blocked by browser autoplay policy
    }
}
