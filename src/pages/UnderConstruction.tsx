import { useEffect } from "react";
import { Link } from "react-router-dom";
import DisclaimerBanner from "../components/DisclaimerBanner";

interface UnderConstructionProps {
    /** Page heading. */
    title?: string;
    /** Short explanation shown under the heading. */
    message?: string;
    /** Name of the feature being built, shown in the status line (e.g. "Order history"). */
    feature?: string;
    /** Rough build progress, 0–100. Hidden when omitted. */
    progress?: number;
    /** Where the primary button goes. */
    backTo?: string;
    backLabel?: string;
}

const STYLES = `
.nook-os.cpu {
    --ink: #1d3328; --ink-soft: #5b6e63; --leaf: #1f8a4c; --leaf-dark: #166b3a;
    --line: #cfdcd3; --sky: #e3f4f1; --sand: #f3dd9a; --sand-dark: #b88a12;
    color: var(--ink);
    background:
        radial-gradient(1200px 380px at 50% -140px, #c9ebe4 0%, transparent 70%),
        var(--sky);
}
.cpu__wrap { width: 100%; max-width: 520px; margin: 0 auto; }

.cpu-card { background: #fff; border-radius: 28px; overflow: hidden; box-shadow: 0 1px 0 rgba(29,51,40,.04), 0 18px 40px -18px rgba(29,51,40,.28); }

/* Cover */
.cpu-cover { background: var(--leaf); color: #fff; padding: 1.5rem 1.75rem 1.4rem; display: flex; align-items: center; gap: 1rem; }
.cpu-crest { width: 54px; height: 54px; flex: none; border-radius: 50%; display: grid; place-items: center; background: rgba(255,255,255,.16); border: 2px dashed rgba(255,255,255,.55); font-size: 1.35rem; }
.cpu-crest i { transform-origin: 70% 80%; animation: cpu-hammer 2.4s ease-in-out 3; }
@keyframes cpu-hammer {
    0%, 55%, 100% { transform: rotate(0); }
    65% { transform: rotate(-28deg); }
    75% { transform: rotate(12deg); }
    85% { transform: rotate(-6deg); }
}
.cpu-cover h1 { margin: 0; font-size: 1.45rem; line-height: 1.15; font-weight: 800; }
.cpu-cover p { margin: .2rem 0 0; font-size: .85rem; opacity: .9; }
.cpu-seam { border-top: 3px dashed #fff; margin: 0 14px; position: relative; top: -2px; opacity: .85; }

.cpu-body { padding: 1.5rem 1.75rem 1.75rem; }
.cpu-msg { margin: 0 0 1.25rem; color: var(--ink-soft); font-size: .98rem; line-height: 1.55; font-weight: 600; max-width: 56ch; }

/* Caution tape strip */
.cpu-tape { height: 14px; border-radius: 7px; margin-bottom: 1.25rem; background: repeating-linear-gradient(-45deg, var(--sand) 0 12px, #3b3320 12px 24px); opacity: .9; }

/* Progress */
.cpu-progress { margin-bottom: 1.5rem; }
.cpu-progress__head { display: flex; justify-content: space-between; font-size: .85rem; font-weight: 800; margin-bottom: .45rem; }
.cpu-progress__head span:last-child { color: var(--ink-soft); font-weight: 700; }
.cpu-track { height: 12px; border-radius: 6px; background: #eef3ef; border: 1.5px dashed var(--line); overflow: hidden; }
.cpu-fill { height: 100%; background: var(--leaf); border-radius: 6px; transition: width .6s ease; }

/* Status list */
.cpu-status { list-style: none; margin: 0 0 1.5rem; padding: 0; display: flex; flex-direction: column; gap: .6rem; }
.cpu-status li { display: flex; align-items: center; gap: .65rem; font-size: .9rem; font-weight: 700; }
.cpu-status i { width: 1.2rem; text-align: center; }
.cpu-done i { color: var(--leaf); }
.cpu-doing i { color: var(--sand-dark); }
.cpu-todo { color: var(--ink-soft); }
.cpu-todo i { color: var(--line); }

/* Buttons */
.cpu-actions { display: grid; gap: .6rem; }
.cpu-btn { display: inline-flex; align-items: center; justify-content: center; gap: .55rem; border: 0; border-radius: 14px; padding: .8rem 1rem; background: var(--leaf); color: #fff; font-weight: 800; font-size: 1rem; text-decoration: none; box-shadow: 0 4px 0 var(--leaf-dark); transition: transform .08s ease, box-shadow .08s ease, background .15s ease; }
.cpu-btn:hover { background: #22984f; color: #fff; }
.cpu-btn:active { transform: translateY(3px); box-shadow: 0 1px 0 var(--leaf-dark); }
.cpu-btn--ghost { background: #fff; color: var(--ink); border: 1.5px solid var(--line); box-shadow: none; font-size: .92rem; }
.cpu-btn--ghost:hover { background: #f6faf7; border-color: var(--leaf); color: var(--ink); }
.cpu-btn--ghost:active { transform: none; box-shadow: none; }
.cpu-btn--ghost i { color: var(--leaf); }
.cpu-btn--discord i { color: #5865f2; }
.cpu-pair { display: grid; grid-template-columns: 1fr 1fr; gap: .6rem; }
@media (max-width: 420px) { .cpu-pair { grid-template-columns: 1fr; } }

.cpu :is(a, button):focus-visible { outline: 3px solid #0f5132; outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
    .cpu-crest i { animation: none; }
    .cpu * { transition: none !important; }
}
`;

const UnderConstruction = ({
    title = "This page is still being built",
    message = "We're hard at work on it. Check back soon, or head to a part of the island that's ready to visit.",
    feature,
    progress,
    backTo = "/",
    backLabel = "Back to home",
}: UnderConstructionProps) => {
    useEffect(() => {
        const prev = document.title;
        document.title = "Under construction – Chopaeng";
        return () => {
            document.title = prev;
        };
    }, []);

    const pct = typeof progress === "number" ? Math.max(0, Math.min(100, Math.round(progress))) : null;

    return (
        <div className="nook-os cpu min-vh-100 p-3 p-lg-5 font-nunito d-flex flex-column justify-content-center">
            <style>{STYLES}</style>

            <main className="cpu__wrap">
                <div className="cpu-card">
                    <header className="cpu-cover">
                        <div className="cpu-crest" aria-hidden="true">
                            <i className="fa-solid fa-hammer" />
                        </div>
                        <div>
                            <h1 className="ac-font">{title}</h1>
                            <p>{feature ? `${feature} is coming soon.` : "New things are on the way."}</p>
                        </div>
                    </header>
                    <div className="cpu-seam" aria-hidden="true" />

                    <div className="cpu-body">
                        <div className="cpu-tape" aria-hidden="true" />

                        <p className="cpu-msg">{message}</p>

                        {pct !== null && (
                            <div className="cpu-progress">
                                <div className="cpu-progress__head">
                                    <span>Build progress</span>
                                    <span>{pct}%</span>
                                </div>
                                <div
                                    className="cpu-track"
                                    role="progressbar"
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                    aria-valuenow={pct}
                                    aria-label="Build progress"
                                >
                                    <div className="cpu-fill" style={{ width: `${pct}%` }} />
                                </div>
                            </div>
                        )}

                        <ul className="cpu-status" aria-label="Status">
                            <li className="cpu-done">
                                <i className="fa-solid fa-circle-check" aria-hidden="true" />
                                <span>Plans drawn up</span>
                            </li>
                            <li className="cpu-doing">
                                <i className="fa-solid fa-helmet-safety" aria-hidden="true" />
                                <span>Building in progress</span>
                            </li>
                            <li className="cpu-todo">
                                <i className="fa-regular fa-circle" aria-hidden="true" />
                                <span>Opening day</span>
                            </li>
                        </ul>

                        <div className="cpu-actions">
                            <Link to={backTo} className="cpu-btn">
                                <i className="fa-solid fa-house" aria-hidden="true" />
                                {backLabel}
                            </Link>
                            <div className="cpu-actions">

                                <a
                                    href="https://discord.com/invite/chopaeng"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="cpu-btn cpu-btn--ghost cpu-btn--discord"
                                >
                                    <i className="fa-brands fa-discord" aria-hidden="true" />
                                    Get updates
                                    <span className="visually-hidden">(opens in a new tab)</span>
                                </a>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-4 text-center">
                    <DisclaimerBanner variant="text" />
                </div>
            </main>
        </div>
    );
};

export default UnderConstruction;
