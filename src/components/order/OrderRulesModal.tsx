import React, { useEffect, useId, useRef, useState } from "react";
import { ORDER_RULES_LIST, markOrderRulesAccepted } from "../../utils/orderRulesStorage";
import { playChimeClick } from "../../utils/kkAudioSynthesizer";

interface OrderRulesModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAccept: () => void;
    userId?: string | null;
}

const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

const STYLES = `
.cpo-backdrop {
    position: fixed; inset: 0; z-index: 1090;
    display: flex; align-items: center; justify-content: center;
    padding: 1rem;
    background: rgba(18, 30, 42, .65);
    backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
    animation: cpo-fade .18s ease-out;
}
.cpo {
    --ink: #1a2736; --ink-soft: #536477; --theme: #2563eb; --theme-dark: #1d4ed8; --line: #cfdbe6;
    width: 100%; max-width: 720px; max-height: calc(100dvh - 2rem);
    display: flex; flex-direction: column;
    background: #fff; color: var(--ink); border-radius: 28px; overflow: hidden;
    box-shadow: 0 30px 60px -20px rgba(18, 30, 42, .55);
    animation: cpo-rise .22s ease-out;
    outline: none;
}
@keyframes cpo-fade { from { opacity: 0 } to { opacity: 1 } }
@keyframes cpo-rise { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }

.cpo__cover { flex: none; background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%); color: #fff; padding: 1.3rem 3.4rem 1.2rem 1.5rem; display: flex; gap: 1rem; align-items: center; position: relative; }
.cpo__crest { width: 52px; height: 52px; flex: none; border-radius: 50%; display: grid; place-items: center; background: rgba(255,255,255,.16); border: 2px dashed rgba(255,255,255,.55); font-size: 1.3rem; }
.cpo__title { margin: 0; font-size: 1.35rem; line-height: 1.15; font-weight: 800; }
.cpo__sub { margin: .2rem 0 0; font-size: .84rem; opacity: .92; line-height: 1.4; }
.cpo__close { position: absolute; top: .8rem; right: .8rem; width: 36px; height: 36px; border: 0; border-radius: 50%; background: rgba(255,255,255,.18); color: #fff; display: grid; place-items: center; transition: background .15s ease; }
.cpo__close:hover { background: rgba(255,255,255,.3); }
.cpo__seam { flex: none; border-top: 3px dashed #fff; margin: 0 14px; position: relative; top: -2px; opacity: .85; }

.cpo__body { flex: 1; min-height: 0; overflow-y: auto; padding: 1.1rem 1.5rem 1.25rem; }
.cpo__notice { display: flex; gap: .75rem; align-items: flex-start; background: #fff5dc; border-left: 4px solid #e0a030; border-radius: 12px; padding: .75rem .95rem; margin-bottom: 1.1rem; font-size: .88rem; line-height: 1.45; color: #5c4200; font-weight: 600; }
.cpo__notice i { margin-top: .15rem; color: #b07a0c; }
.cpo__notice strong { color: #3f2d00; }

.cpo-rules { list-style: none; margin: 0; padding: 0; }
.cpo-rule { display: flex; gap: 1rem; padding: 1rem 0; border-bottom: 1.5px dashed var(--line); }
.cpo-rule:first-child { padding-top: .25rem; }
.cpo-rule:last-child { border-bottom: 0; padding-bottom: 0; }
.cpo-rule__badge { width: 46px; flex: none; text-align: center; }
.cpo-rule__icon { width: 42px; height: 42px; margin: 0 auto .3rem; border-radius: 50%; display: grid; place-items: center; background: #eef4ff; color: var(--theme-dark); font-size: 1rem; }
.cpo-rule__num { font-size: .78rem; font-weight: 800; color: var(--ink-soft); }
.cpo-rule__main { min-width: 0; flex: 1; }
.cpo-rule__head { display: flex; flex-wrap: wrap; align-items: center; gap: .45rem; margin-bottom: .3rem; }
.cpo-rule__title { margin: 0; font-size: 1.02rem; font-weight: 800; line-height: 1.25; }
.cpo-tag { padding: .12rem .55rem; border-radius: 999px; background: #eef3f8; color: var(--ink-soft); font-size: .76rem; font-weight: 700; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.cpo-flag { padding: .12rem .6rem; border-radius: 999px; background: #fde047; color: #4a3600; font-size: .78rem; font-weight: 800; }
.cpo-rule__desc { margin: 0; font-size: .9rem; line-height: 1.55; color: var(--ink-soft); font-weight: 600; overflow-wrap: anywhere; }

.cpo__foot { flex: none; display: flex; flex-direction: column; gap: .9rem; padding: 1rem 1.5rem 1.25rem; border-top: 2px dashed var(--line); background: #fff; }
@media (min-width: 576px) { .cpo__foot { flex-direction: row; align-items: center; justify-content: space-between; } }
.cpo-check { display: flex; align-items: center; gap: .65rem; margin: 0; cursor: pointer; font-size: .9rem; font-weight: 700; user-select: none; }
.cpo-check input { width: 1.3rem; height: 1.3rem; flex: none; accent-color: var(--theme); cursor: pointer; }
.cpo__actions { display: flex; gap: .6rem; flex: none; }
.cpo__actions > * { flex: 1; }
@media (min-width: 576px) { .cpo__actions > * { flex: none; } }

.cpo-btn { display: inline-flex; align-items: center; justify-content: center; gap: .5rem; border: 1.5px solid var(--line); background: #fff; color: var(--ink); border-radius: 14px; padding: .7rem 1.1rem; font-weight: 700; font-size: .95rem; transition: border-color .15s ease, background .15s ease; }
.cpo-btn:hover:not(:disabled) { border-color: var(--theme); background: #f0f7ff; }
.cpo-btn:disabled { opacity: .6; cursor: not-allowed; }
.cpo-btn--primary { background: var(--theme); border-color: var(--theme); color: #fff; font-weight: 800; box-shadow: 0 4px 0 var(--theme-dark); transition: transform .08s ease, box-shadow .08s ease, background .15s ease; }
.cpo-btn--primary:hover:not(:disabled) { background: #1d4ed8; border-color: #1d4ed8; }
.cpo-btn--primary:active:not(:disabled) { transform: translateY(3px); box-shadow: 0 1px 0 var(--theme-dark); }
.cpo-btn--primary:disabled { background: #93c5fd; border-color: #93c5fd; box-shadow: 0 4px 0 #60a5fa; opacity: 1; cursor: not-allowed; }

.cpo :is(button, input, a):focus-visible { outline: 3px solid #1d4ed8; outline-offset: 2px; }
.cpo__cover :is(button):focus-visible { outline-color: #fff; }
.cpo__body:focus-visible { outline: 3px solid #1d4ed8; outline-offset: -3px; border-radius: 4px; }

@media (prefers-reduced-motion: reduce) {
    .cpo-backdrop, .cpo { animation: none; }
    .cpo * { transition: none !important; }
}
`;

export const OrderRulesModal: React.FC<OrderRulesModalProps> = ({
    isOpen,
    onClose,
    onAccept,
    userId,
}) => {
    const uid = useId();
    const dialogRef = useRef<HTMLDivElement>(null);

    const [hasAgreed, setHasAgreed] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setHasAgreed(false);
        setIsSubmitting(false);

        const previouslyFocused = document.activeElement as HTMLElement | null;
        const dialog = dialogRef.current;
        if (dialog) {
            const firstFocusable = dialog.querySelector<HTMLElement>(FOCUSABLE);
            if (firstFocusable) {
                firstFocusable.focus();
            } else {
                dialog.focus();
            }
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                onClose();
                return;
            }
            if (event.key !== "Tab" || !dialog) return;

            const nodes = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
                (el) => el.offsetParent !== null
            );
            if (nodes.length === 0) {
                event.preventDefault();
                return;
            }
            const first = nodes[0];
            const last = nodes[nodes.length - 1];

            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", handleKeyDown);

        return () => {
            document.body.style.overflow = originalOverflow;
            window.removeEventListener("keydown", handleKeyDown);
            if (previouslyFocused && typeof previouslyFocused.focus === "function") {
                previouslyFocused.focus();
            }
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleAcceptClick = async () => {
        if (!hasAgreed || isSubmitting) return;
        setIsSubmitting(true);
        try {
            playChimeClick();
            await markOrderRulesAccepted(userId);
            onAccept();
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div
            className="cpo-backdrop"
            role="presentation"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <style>{STYLES}</style>
            <div
                ref={dialogRef}
                className="cpo"
                role="dialog"
                aria-modal="true"
                aria-labelledby={`${uid}-title`}
                aria-describedby={`${uid}-desc`}
                tabIndex={-1}
            >
                <header className="cpo__cover">
                    <div className="cpo__crest" aria-hidden="true">
                        <i className="fa-solid fa-box-open"></i>
                    </div>
                    <div>
                        <h2 id={`${uid}-title`} className="cpo__title">
                            Order Bot Rules & Guidelines
                        </h2>
                        <p id={`${uid}-desc`} className="cpo__sub">
                            Please review our Order Bot guidelines before placing an order or item drop.
                        </p>
                    </div>
                    <button
                        type="button"
                        className="cpo__close"
                        onClick={onClose}
                        aria-label="Close Order Rules dialog"
                    >
                        <i className="fa-solid fa-xmark"></i>
                    </button>
                </header>
                <div className="cpo__seam" aria-hidden="true" />

                <div className="cpo__body" tabIndex={0} aria-label="Order Bot Rules content">
                    <div className="cpo__notice" role="alert">
                        <i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
                        <div>
                            <strong>Warning:</strong> If you are caught using the orderbot and have not followed the rules, you might get a mute, kick, or ban.
                        </div>
                    </div>

                    <ol className="cpo-rules">
                        {ORDER_RULES_LIST.map((rule) => (
                            <li key={rule.id} className="cpo-rule">
                                <div className="cpo-rule__badge">
                                    <div className="cpo-rule__icon" aria-hidden="true">
                                        <i className={`fa-solid ${rule.icon}`}></i>
                                    </div>
                                    <div className="cpo-rule__num">Rule {rule.number}</div>
                                </div>
                                <div className="cpo-rule__main">
                                    <div className="cpo-rule__head">
                                        <h3 className="cpo-rule__title">{rule.title}</h3>
                                        <span className="cpo-tag">{rule.tag}</span>
                                        {rule.highlight && <span className="cpo-flag">{rule.highlight}</span>}
                                    </div>
                                    <p className="cpo-rule__desc">{rule.description}</p>
                                </div>
                            </li>
                        ))}
                    </ol>
                </div>

                <footer className="cpo__foot">
                    <label className="cpo-check">
                        <input
                            type="checkbox"
                            checked={hasAgreed}
                            onChange={(e) => {
                                playChimeClick();
                                setHasAgreed(e.target.checked);
                            }}
                        />
                        <span>I have read, understood, and agree to follow all Order Bot rules.</span>
                    </label>

                    <div className="cpo__actions">
                        <button type="button" className="cpo-btn" onClick={onClose} disabled={isSubmitting}>
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="cpo-btn cpo-btn--primary"
                            disabled={!hasAgreed || isSubmitting}
                            onClick={handleAcceptClick}
                        >
                            {isSubmitting ? (
                                <>
                                    <i className="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>
                                    <span>Saving...</span>
                                </>
                            ) : (
                                <>
                                    <i className="fa-solid fa-check" aria-hidden="true"></i>
                                    <span>Done!</span>
                                </>
                            )}
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default OrderRulesModal;
