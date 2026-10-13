import React, { useEffect, useId, useRef, useState } from "react";
import { useAuth } from "../context/useAuth";
import { type AuthProviderType } from "../context/authContextShared";
import { playChimeClick } from "../utils/kkAudioSynthesizer";

interface LoginModalProps {
    isOpen?: boolean;
    onClose?: () => void;
    returnPath?: string;
    initialMode?: "login" | "register";
}

interface ProviderOption {
    id: AuthProviderType;
    name: string;
    icon: string;
    color: string;
    enabled: boolean;
    disabledReason?: string;
}

const DISCORD_PROVIDER: ProviderOption = {
    id: "discord",
    name: "Discord",
    icon: "fa-brands fa-discord",
    color: "#5865f2",
    enabled: true,
};

const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

const STYLES = `
.cpm-backdrop {
    position: fixed; inset: 0; z-index: 9999;
    display: flex; align-items: center; justify-content: center;
    padding: 1rem;
    background: rgba(18, 38, 29, .62);
    backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
    animation: cpm-fade .18s ease-out;
}
.cpm {
    --ink: #1d3328; --ink-soft: #5b6e63; --leaf: #1f8a4c; --leaf-dark: #166b3a;
    --line: #cfdcd3; --error: #b3261e;
    width: 100%; max-width: 440px; max-height: calc(100dvh - 2rem);
    display: flex; flex-direction: column;
    background: #fff; color: var(--ink); border-radius: 28px; overflow: hidden;
    box-shadow: 0 30px 60px -20px rgba(18, 38, 29, .55);
    animation: cpm-rise .22s ease-out;
}
@keyframes cpm-fade { from { opacity: 0 } to { opacity: 1 } }
@keyframes cpm-rise { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }

.cpm__cover { background: var(--leaf); color: #fff; padding: 1.35rem 3.4rem 1.25rem 1.5rem; display: flex; gap: 1rem; align-items: center; position: relative; flex: none; }
.cpm__crest { width: 50px; height: 50px; flex: none; border-radius: 50%; display: grid; place-items: center; background: rgba(255,255,255,.16); border: 2px dashed rgba(255,255,255,.55); font-size: 1.25rem; }
.cpm__title { margin: 0; font-size: 1.35rem; line-height: 1.15; font-weight: 800; }
.cpm__sub { margin: .2rem 0 0; font-size: .84rem; opacity: .9; line-height: 1.4; }
.cpm__close { position: absolute; top: .8rem; right: .8rem; width: 36px; height: 36px; border: 0; border-radius: 50%; background: rgba(255,255,255,.18); color: #fff; display: grid; place-items: center; transition: background .15s ease; cursor: pointer; }
.cpm__close:hover { background: rgba(255,255,255,.3); }
.cpm__seam { flex: none; border-top: 3px dashed #fff; margin: 0 14px; position: relative; top: -2px; opacity: .85; }
.cpm__body { padding: 1.5rem 1.5rem 1.5rem; overflow-y: auto; }

.cpm-alert { display: flex; gap: .6rem; align-items: flex-start; border-radius: 12px; padding: .7rem .9rem; margin-bottom: 1rem; font-size: .88rem; font-weight: 600; }
.cpm-alert i { margin-top: .15rem; }
.cpm-alert--error { background: #fdecea; color: var(--error); border-left: 4px solid var(--error); }
.cpm-alert--warn { background: #fff5dc; color: #7a5200; border-left: 4px solid #e0a030; }

.cpm-discord-btn {
    width: 100%; border: 0; border-radius: 16px; padding: 1rem 1.25rem;
    background: #5865f2; color: #fff; font-weight: 800; font-size: 1.08rem;
    display: flex; align-items: center; justify-content: center; gap: .7rem;
    box-shadow: 0 4px 0 #3b47d1; cursor: pointer;
    transition: background .15s ease, transform .08s ease, box-shadow .08s ease;
}
.cpm-discord-btn:hover { background: #4752c4; }
.cpm-discord-btn:active { transform: translateY(3px); box-shadow: 0 1px 0 #3b47d1; }
.cpm-discord-btn i { font-size: 1.35rem; }

.cpm-note {
    font-size: .85rem; color: var(--ink-soft); line-height: 1.5;
    margin: 1.15rem 0 0; text-align: center;
}

.cpm-foot {
    display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: .5rem;
    margin-top: 1.35rem; padding-top: 1rem; border-top: 1.5px dashed var(--line);
    font-size: .85rem; font-weight: 600; color: var(--ink-soft);
}
.cpm-foot a { color: var(--leaf-dark); font-weight: 800; text-decoration: none; }
.cpm-foot a:hover { text-decoration: underline; }


.cpm-discord-notice {
    display: flex; gap: .75rem; align-items: flex-start;
    background: #eef2ff; border: 1.5px solid #c7d2fe;
    border-radius: 14px; padding: .8rem .95rem; margin-bottom: 1.1rem;
    font-size: .85rem; color: #1e1b4b; line-height: 1.45;
}
.cpm-discord-notice__icon {
    width: 30px; height: 30px; border-radius: 50%;
    background: #5865f2; color: #fff; display: grid; place-items: center;
    flex: none; font-size: .95rem; margin-top: .1rem;
}
.cpm-discord-notice__content { flex: 1; }
.cpm-discord-notice__content strong {
    display: block; font-size: .88rem; font-weight: 800; color: #312e81; margin-bottom: .15rem;
}
.cpm-discord-notice__content p { margin: 0 0 .45rem 0; font-size: .82rem; color: #4338ca; }
.cpm-discord-notice__link {
    display: inline-flex; align-items: center; gap: .3rem;
    font-size: .8rem; font-weight: 700; color: #4f46e5; text-decoration: none;
    background: #fff; padding: .25rem .6rem; border-radius: 9999px;
    border: 1px solid #c7d2fe; box-shadow: 0 1px 2px rgba(0,0,0,.04);
    transition: all .15s ease;
}
.cpm-discord-notice__link:hover {
    background: #5865f2; color: #fff; border-color: #5865f2; text-decoration: none;
}

.cpm :is(button, a):focus-visible { outline: 3px solid #0f5132; outline-offset: 2px; }
.cpm__close:focus-visible { outline-color: #fff; }

@media (prefers-reduced-motion: reduce) {
    .cpm-backdrop, .cpm { animation: none; }
    .cpm * { transition: none !important; }
}
`;

export const LoginModal: React.FC<LoginModalProps> = ({
    isOpen = false,
    onClose = () => {},
    returnPath,
}) => {
    const auth = useAuth();
    const uid = useId();
    const dialogRef = useRef<HTMLDivElement>(null);
    const [tooltipMsg, setTooltipMsg] = useState<string | null>(null);

    const propReturnPath = returnPath ?? (typeof window !== "undefined" ? window.location.pathname : "/");

    // Close on Escape key
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    // Focus trap inside modal
    useEffect(() => {
        if (!isOpen) return;
        const root = dialogRef.current;
        if (!root) return;

        const getNodes = () =>
            Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
                (el) => el.offsetParent !== null
            );

        const nodes = getNodes();
        if (nodes.length > 0) {
            nodes[0].focus();
        }

        const handleTrap = (e: KeyboardEvent) => {
            if (e.key !== "Tab") return;
            const current = getNodes();
            if (current.length === 0) return;
            const first = current[0];
            const last = current[current.length - 1];

            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };

        window.addEventListener("keydown", handleTrap);
        return () => window.removeEventListener("keydown", handleTrap);
    }, [isOpen]);

    if (!isOpen) return null;

    const handleDiscordLogin = () => {
        playChimeClick();
        if (!DISCORD_PROVIDER.enabled) {
            setTooltipMsg("Discord sign-in is temporarily unavailable.");
            return;
        }
        setTooltipMsg(null);
        auth.loginWithProvider(DISCORD_PROVIDER.id, propReturnPath);
        onClose();
    };

    const titleId = `${uid}-title`;

    return (
        <div className="cpm-backdrop" onClick={onClose}>
            <style>{STYLES}</style>

            <div
                ref={dialogRef}
                className="cpm"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onClick={(e) => e.stopPropagation()}
            >
                <header className="cpm__cover">
                    <div className="cpm__crest" aria-hidden="true">
                        <i className="fa-solid fa-passport" />
                    </div>
                    <div>
                        <h2 id={titleId} className="ac-font cpm__title">Resident passport</h2>
                        <p className="cpm__sub">Sign in with Discord to access your perks and islands.</p>
                    </div>
                    <button type="button" className="cpm__close" onClick={onClose} aria-label="Close">
                        <i className="fa-solid fa-xmark" aria-hidden="true" />
                    </button>
                </header>
                <div className="cpm__seam" aria-hidden="true" />

                <div className="cpm__body">
                    {tooltipMsg && (
                        <div role="status" aria-live="polite" className="cpm-alert cpm-alert--warn">
                            <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
                            <span>{tooltipMsg}</span>
                        </div>
                    )}

                                        {/* Notice to join Discord server */}
                    <div className="cpm-discord-notice">
                        <div className="cpm-discord-notice__icon" aria-hidden="true">
                            <i className="fa-brands fa-discord" />
                        </div>
                        <div className="cpm-discord-notice__content">
                            <strong>Make sure to join our Discord server</strong>
                            <p>
                                Make sure you have joined our Discord server so your membership roles, subscriber perks, and island access sync properly.
                            </p>
                            <a
                                href="https://discord.gg/chopaeng"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="cpm-discord-notice__link"
                            >
                                <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" />
                                Join Server (discord.gg/chopaeng)
                            </a>
                        </div>
                    </div>

                    {/* Primary Discord button */}
                    <button
                        type="button"
                        className="cpm-discord-btn"
                        onClick={handleDiscordLogin}
                    >
                        <i className="fa-brands fa-discord" aria-hidden="true" />
                        Continue with Discord
                    </button>

                    <p className="cpm-note">
                        Sign in with Discord to automatically sync your server roles, subscriptions, and island access.
                    </p>

                    <div className="cpm-foot">
                        <span>Want to see what each tier includes?</span>
                        <a href="/membership" onClick={onClose}>View membership plans</a>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginModal;