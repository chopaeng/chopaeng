import React, { useEffect, useId, useRef, useState } from "react";
import { SUB_RULES_LIST, markSubRulesAccepted } from "../../utils/subRulesStorage";
import { playChimeClick } from "../../utils/kkAudioSynthesizer";

interface SubRulesModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAccept: () => void;
    userId?: string | null;
}

const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

const STYLES = `
.cps-backdrop {
    position: fixed; inset: 0; z-index: 1090;
    display: flex; align-items: center; justify-content: center;
    padding: 1rem;
    background: rgba(18, 38, 29, .62);
    backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
    animation: cps-fade .18s ease-out;
}
.cps {
    --ink: #1d3328; --ink-soft: #5b6e63; --leaf: #1f8a4c; --leaf-dark: #166b3a; --line: #cfdcd3;
    width: 100%; max-width: 720px; max-height: calc(100dvh - 2rem);
    display: flex; flex-direction: column;
    background: #fff; color: var(--ink); border-radius: 28px; overflow: hidden;
    box-shadow: 0 30px 60px -20px rgba(18, 38, 29, .55);
    animation: cps-rise .22s ease-out;
    outline: none;
}
@keyframes cps-fade { from { opacity: 0 } to { opacity: 1 } }
@keyframes cps-rise { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }

.cps__cover { flex: none; background: var(--leaf); color: #fff; padding: 1.3rem 3.4rem 1.2rem 1.5rem; display: flex; gap: 1rem; align-items: center; position: relative; }
.cps__crest { width: 52px; height: 52px; flex: none; border-radius: 50%; display: grid; place-items: center; background: rgba(255,255,255,.16); border: 2px dashed rgba(255,255,255,.55); font-size: 1.3rem; }
.cps__title { margin: 0; font-size: 1.35rem; line-height: 1.15; font-weight: 800; }
.cps__sub { margin: .2rem 0 0; font-size: .84rem; opacity: .92; line-height: 1.4; }
.cps__close { position: absolute; top: .8rem; right: .8rem; width: 36px; height: 36px; border: 0; border-radius: 50%; background: rgba(255,255,255,.18); color: #fff; display: grid; place-items: center; transition: background .15s ease; }
.cps__close:hover { background: rgba(255,255,255,.3); }
.cps__seam { flex: none; border-top: 3px dashed #fff; margin: 0 14px; position: relative; top: -2px; opacity: .85; }

.cps__body { flex: 1; min-height: 0; overflow-y: auto; padding: 1.1rem 1.5rem 1.25rem; }
.cps__notice { display: flex; gap: .75rem; align-items: flex-start; background: #fff5dc; border-left: 4px solid #e0a030; border-radius: 12px; padding: .75rem .95rem; margin-bottom: 1.1rem; font-size: .88rem; line-height: 1.45; color: #5c4200; font-weight: 600; }
.cps__notice i { margin-top: .15rem; color: #b07a0c; }
.cps__notice strong { color: #3f2d00; }

.cps-rules { list-style: none; margin: 0; padding: 0; }
.cps-rule { display: flex; gap: 1rem; padding: 1rem 0; border-bottom: 1.5px dashed var(--line); }
.cps-rule:first-child { padding-top: .25rem; }
.cps-rule:last-child { border-bottom: 0; padding-bottom: 0; }
.cps-rule__badge { width: 46px; flex: none; text-align: center; }
.cps-rule__icon { width: 42px; height: 42px; margin: 0 auto .3rem; border-radius: 50%; display: grid; place-items: center; background: #e6f4ec; color: var(--leaf-dark); font-size: 1rem; }
.cps-rule__num { font-size: .78rem; font-weight: 800; color: var(--ink-soft); }
.cps-rule__main { min-width: 0; flex: 1; }
.cps-rule__head { display: flex; flex-wrap: wrap; align-items: center; gap: .45rem; margin-bottom: .3rem; }
.cps-rule__title { margin: 0; font-size: 1.02rem; font-weight: 800; line-height: 1.25; }
.cps-tag { padding: .12rem .55rem; border-radius: 999px; background: #eef3ef; color: var(--ink-soft); font-size: .76rem; font-weight: 700; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.cps-flag { padding: .12rem .6rem; border-radius: 999px; background: #f6d56b; color: #4a3600; font-size: .78rem; font-weight: 800; }
.cps-rule__desc { margin: 0; font-size: .9rem; line-height: 1.55; color: var(--ink-soft); font-weight: 600; overflow-wrap: anywhere; }

.cps__foot { flex: none; display: flex; flex-direction: column; gap: .9rem; padding: 1rem 1.5rem 1.25rem; border-top: 2px dashed var(--line); background: #fff; }
@media (min-width: 576px) { .cps__foot { flex-direction: row; align-items: center; justify-content: space-between; } }
.cps-check { display: flex; align-items: center; gap: .65rem; margin: 0; cursor: pointer; font-size: .9rem; font-weight: 700; user-select: none; }
.cps-check input { width: 1.3rem; height: 1.3rem; flex: none; accent-color: var(--leaf); cursor: pointer; }
.cps__actions { display: flex; gap: .6rem; flex: none; }
.cps__actions > * { flex: 1; }
@media (min-width: 576px) { .cps__actions > * { flex: none; } }

.cps-btn { display: inline-flex; align-items: center; justify-content: center; gap: .5rem; border: 1.5px solid var(--line); background: #fff; color: var(--ink); border-radius: 14px; padding: .7rem 1.1rem; font-weight: 700; font-size: .95rem; transition: border-color .15s ease, background .15s ease; }
.cps-btn:hover:not(:disabled) { border-color: var(--leaf); background: #f6faf7; }
.cps-btn:disabled { opacity: .6; cursor: not-allowed; }
.cps-btn--primary { background: var(--leaf); border-color: var(--leaf); color: #fff; font-weight: 800; box-shadow: 0 4px 0 var(--leaf-dark); transition: transform .08s ease, box-shadow .08s ease, background .15s ease; }
.cps-btn--primary:hover:not(:disabled) { background: #22984f; border-color: #22984f; }
.cps-btn--primary:active:not(:disabled) { transform: translateY(3px); box-shadow: 0 1px 0 var(--leaf-dark); }
.cps-btn--primary:disabled { background: #9db7a8; border-color: #9db7a8; box-shadow: 0 4px 0 #809b8d; opacity: 1; cursor: not-allowed; }

.cps :is(button, input, a):focus-visible { outline: 3px solid #0f5132; outline-offset: 2px; }
.cps__cover :is(button):focus-visible { outline-color: #fff; }
.cps__body:focus-visible { outline: 3px solid #0f5132; outline-offset: -3px; border-radius: 4px; }

@media (prefers-reduced-motion: reduce) {
    .cps-backdrop, .cps { animation: none; }
    .cps * { transition: none !important; }
}
`;

export const SubRulesModal: React.FC<SubRulesModalProps> = ({
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
        if (isOpen) {
            setHasAgreed(false);
            setIsSubmitting(false);
        }
    }, [isOpen]);

    // Escape to close, Tab stays inside the dialog
    useEffect(() => {
        if (!isOpen) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onClose();
                return;
            }
            if (e.key !== "Tab" || !dialogRef.current) return;
            const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
            if (!items.length) return;
            const first = items[0];
            const last = items[items.length - 1];
            if (e.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [isOpen, onClose]);

    // Lock page scroll, move focus into the dialog, restore focus on close
    useEffect(() => {
        if (!isOpen) return;
        const previouslyFocused = document.activeElement as HTMLElement | null;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const t = window.setTimeout(() => dialogRef.current?.focus(), 30);
        return () => {
            window.clearTimeout(t);
            document.body.style.overflow = prevOverflow;
            previouslyFocused?.focus?.();
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const handleConfirm = async () => {
        if (!hasAgreed || isSubmitting) return;
        setIsSubmitting(true);
        playChimeClick();
        try {
            await markSubRulesAccepted(userId);
        } catch {
            // ignore
        } finally {
            setIsSubmitting(false);
            onAccept();
        }
    };

    const titleId = `${uid}-title`;
    const noticeId = `${uid}-notice`;
    const ruleCount = SUB_RULES_LIST.length;

    return (
        <div className="cps-backdrop" onClick={onClose}>
            <style>{STYLES}</style>

            <div
                ref={dialogRef}
                className="cps"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={noticeId}
                tabIndex={-1}
                onClick={(e) => e.stopPropagation()}
            >
                <header className="cps__cover">
                    <div className="cps__crest" aria-hidden="true">
                        <i className="fa-solid fa-crown" />
                    </div>
                    <div>
                        <h2 id={titleId} className="ac-font cps__title">Sub member rules &amp; island guidelines</h2>
                        <p className="cps__sub">
                            Read the {ruleCount} rules below to keep flights smooth for everyone.
                        </p>
                    </div>
                    <button type="button" className="cps__close" onClick={onClose} aria-label="Close">
                        <i className="fa-solid fa-xmark" aria-hidden="true" />
                    </button>
                </header>
                <div className="cps__seam" aria-hidden="true" />

                <div className="cps__body" tabIndex={0} role="region" aria-label="Sub member rules">
                    <div id={noticeId} className="cps__notice">
                        <i className="fa-solid fa-shield-halved" aria-hidden="true" />
                        <span>
                            <strong>You only need to accept these once.</strong> Breaking an island rule means
                            losing your sub island access right away.
                        </span>
                    </div>

                    <ol className="cps-rules">
                        {SUB_RULES_LIST.map((rule) => (
                            <li key={rule.id} className="cps-rule">
                                <div className="cps-rule__badge" aria-hidden="true">
                                    <div className="cps-rule__icon">
                                        <i className={`fa-solid ${rule.icon}`} />
                                    </div>
                                    <span className="cps-rule__num">{String(rule.number).padStart(2, "0")}</span>
                                </div>
                                <div className="cps-rule__main">
                                    <div className="cps-rule__head">
                                        <h3 className="ac-font cps-rule__title">
                                            <span className="visually-hidden">Rule {rule.number}: </span>
                                            {rule.title}
                                        </h3>
                                        {rule.tag && <span className="cps-tag">{rule.tag}</span>}
                                        {rule.highlight && <span className="cps-flag">{rule.highlight}</span>}
                                    </div>
                                    <p className="cps-rule__desc">{rule.description}</p>
                                </div>
                            </li>
                        ))}
                    </ol>
                </div>

                <footer className="cps__foot">
                    <label className="cps-check">
                        <input
                            type="checkbox"
                            checked={hasAgreed}
                            onChange={(e) => {
                                setHasAgreed(e.target.checked);
                                if (e.target.checked) playChimeClick();
                            }}
                        />
                        <span>I've read and agree to follow all {ruleCount} sub rules</span>
                    </label>

                    <div className="cps__actions">
                        <button type="button" className="cps-btn" onClick={onClose} disabled={isSubmitting}>
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="cps-btn cps-btn--primary"
                            disabled={!hasAgreed || isSubmitting}
                            onClick={handleConfirm}
                        >
                            {isSubmitting ? (
                                <>
                                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                                    <span>Saving…</span>
                                </>
                            ) : (
                                <>
                                    <i className="fa-solid fa-circle-check" aria-hidden="true" />
                                    <span>Agree &amp; continue</span>
                                </>
                            )}
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default SubRulesModal;