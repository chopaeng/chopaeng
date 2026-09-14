/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ChoPaeng ACNH Confetti & Celebration Engine v1.0
 * 
 * Lightweight, zero-dependency canvas particle celebration engine with
 * authentic Animal Crossing iconography:
 *  - Green Nook Leaves 🍃
 *  - Golden Sparkling Stars ⭐
 *  - Shiny Gold Bell Coins 🪙
 *  - Festive Ribbons & Streamers
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface ConfettiOptions {
    particleCount?: number;
    spread?: number;
    origin?: { x: number; y: number }; // 0 to 1
    theme?: 'nook' | 'gold' | 'rainbow' | 'stars';
}

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    rotation: number;
    rotationSpeed: number;
    size: number;
    color: string;
    type: 'leaf' | 'star' | 'coin' | 'ribbon';
    alpha: number;
    decay: number;
    tilt: number;
    tiltSpeed: number;
}

const NOOK_COLORS = ['#22c55e', '#16a34a', '#86efac', '#eab308', '#facc15', '#ffffff'];
const GOLD_COLORS = ['#f59e0b', '#d97706', '#fbbf24', '#fef08a', '#ffffff', '#eab308'];
const RAINBOW_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#8b5cf6', '#ec4899'];

export function triggerConfetti(options: ConfettiOptions = {}) {
    // Respect reduced motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
    }

    const count = options.particleCount ?? 65;
    const origin = options.origin ?? { x: 0.5, y: 0.6 };
    const theme = options.theme ?? 'nook';

    const colors = theme === 'gold' ? GOLD_COLORS : theme === 'rainbow' ? RAINBOW_COLORS : NOOK_COLORS;

    let canvas = document.getElementById('chopaeng-confetti-canvas') as HTMLCanvasElement | null;
    if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = 'chopaeng-confetti-canvas';
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100vw';
        canvas.style.height = '100vh';
        canvas.style.pointerEvents = 'none';
        canvas.style.zIndex = '99999';
        document.body.appendChild(canvas);
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth * window.devicePixelRatio;
    canvas.height = window.innerHeight * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const startX = origin.x * window.innerWidth;
    const startY = origin.y * window.innerHeight;

    const particles: Particle[] = [];
    const types: Particle['type'][] = theme === 'stars' 
        ? ['star', 'coin'] 
        : ['leaf', 'star', 'coin', 'ribbon'];

    for (let i = 0; i < count; i++) {
        const angle = Math.PI * (1.2 + Math.random() * 0.6); // upward arc
        const speed = 7 + Math.random() * 11;
        const type = types[Math.floor(Math.random() * types.length)];

        particles.push({
            x: startX,
            y: startY,
            vx: Math.cos(angle) * speed * (0.8 + Math.random() * 0.4),
            vy: Math.sin(angle) * speed,
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 8,
            size: type === 'ribbon' ? 8 + Math.random() * 6 : 12 + Math.random() * 10,
            color: colors[Math.floor(Math.random() * colors.length)],
            type,
            alpha: 1,
            decay: 0.009 + Math.random() * 0.012,
            tilt: Math.random() * 10,
            tiltSpeed: 0.1 + Math.random() * 0.2,
        });
    }

    const render = () => {
        if (!ctx || !canvas) return;
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

        let activeCount = 0;

        for (const p of particles) {
            if (p.alpha <= 0) continue;
            activeCount++;

            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.28; // gravity
            p.vx *= 0.985; // drag
            p.rotation += p.rotationSpeed;
            p.tilt += p.tiltSpeed;
            p.alpha -= p.decay;

            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate((p.rotation * Math.PI) / 180);
            ctx.globalAlpha = Math.max(0, p.alpha);

            if (p.type === 'leaf') {
                // Draw Animal Crossing Nook Leaf
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.moveTo(0, -p.size);
                ctx.bezierCurveTo(p.size * 0.8, -p.size * 0.5, p.size * 0.8, p.size * 0.5, 0, p.size);
                ctx.bezierCurveTo(-p.size * 0.8, p.size * 0.5, -p.size * 0.8, -p.size * 0.5, 0, -p.size);
                ctx.fill();
                // leaf stem
                ctx.strokeStyle = '#15803d';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(0, -p.size * 0.7);
                ctx.lineTo(0, p.size * 0.8);
                ctx.stroke();
            } else if (p.type === 'star') {
                // Draw 5-point Animal Crossing star
                ctx.fillStyle = p.color;
                ctx.beginPath();
                for (let s = 0; s < 5; s++) {
                    const outerAngle = (s * 4 * Math.PI) / 5 - Math.PI / 2;
                    const r = p.size * 0.75;
                    const sx = Math.cos(outerAngle) * r;
                    const sy = Math.sin(outerAngle) * r;
                    if (s === 0) ctx.moveTo(sx, sy);
                    else ctx.lineTo(sx, sy);
                }
                ctx.closePath();
                ctx.fill();
            } else if (p.type === 'coin') {
                // Draw Bell Coin
                ctx.fillStyle = '#f59e0b';
                ctx.beginPath();
                ctx.arc(0, 0, p.size * 0.6, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#fbbf24';
                ctx.lineWidth = 2;
                ctx.stroke();
                // inner rim
                ctx.strokeStyle = '#d97706';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(0, 0, p.size * 0.35, 0, Math.PI * 2);
                ctx.stroke();
            } else {
                // Standard festive ribbon
                ctx.fillStyle = p.color;
                const width = p.size;
                const height = p.size * 0.45;
                ctx.fillRect(-width / 2, -height / 2, width, height);
            }

            ctx.restore();
        }

        if (activeCount > 0) {
            requestAnimationFrame(render);
        } else {
            ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
            if (canvas && canvas.parentNode) {
                canvas.parentNode.removeChild(canvas);
            }
        }
    };

    requestAnimationFrame(render);
}

// Global Custom Event Listener
if (typeof window !== 'undefined') {
    window.addEventListener('chopaeng_confetti', ((e: CustomEvent<ConfettiOptions>) => {
        triggerConfetti(e.detail || {});
    }) as EventListener);
}
