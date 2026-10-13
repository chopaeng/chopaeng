import React, { useId } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import DisclaimerBanner from "../components/DisclaimerBanner";

const STYLES = `
.cp-login {
    --cp-ink: #1d3328;
    --cp-ink-soft: #5b6e63;
    --cp-leaf: #1f8a4c;
    --cp-leaf-dark: #166b3a;
    --cp-sky: #e3f4f1;
    --cp-sand: #f3e9cf;
    --cp-line: #cfdcd3;
    --cp-error: #b3261e;
    color: var(--cp-ink);
    min-height: 100%;
    padding: 3rem 1rem 3.5rem;
    background:
        radial-gradient(1200px 380px at 50% -140px, #c9ebe4 0%, transparent 70%),
        var(--cp-sky);
}
.cp-login__wrap { max-width: 440px; margin: 0 auto; }

/* Passport card */
.cp-card {
    background: #fff;
    border-radius: 28px;
    box-shadow: 0 1px 0 rgba(29,51,40,.04), 0 18px 40px -18px rgba(29,51,40,.28);
    overflow: hidden;
}
.cp-card__cover {
    background: var(--cp-leaf);
    color: #fff;
    padding: 1.6rem 1.8rem 1.4rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    position: relative;
}
.cp-card__crest {
    width: 54px; height: 54px; flex: none;
    border-radius: 50%;
    display: grid; place-items: center;
    background: rgba(255,255,255,.16);
    border: 2px dashed rgba(255,255,255,.55);
    font-size: 1.35rem;
}
.cp-card__title { margin: 0; font-size: 1.45rem; line-height: 1.15; font-weight: 800; }
.cp-card__sub { margin: .25rem 0 0; font-size: .85rem; opacity: .9; }

/* Stitched seam between cover and body */
.cp-card__seam { height: 0; border-top: 3px dashed #fff; margin: 0 14px; position: relative; top: -2px; opacity: .85; }
.cp-card__body { padding: 1.6rem 1.8rem 1.75rem; }

/* Alert */
.cp-alert {
    display: flex; gap: .6rem; align-items: flex-start;
    background: #fdecea; color: var(--cp-error);
    border-left: 4px solid var(--cp-error);
    border-radius: 12px; padding: .7rem .9rem; margin-bottom: 1.15rem;
    font-size: .88rem; font-weight: 600;
}
.cp-alert i { margin-top: .15rem; }

/* Big Discord button */
.cp-discord-btn {
    width: 100%; border: 0; border-radius: 16px; padding: 1rem 1.25rem;
    background: #5865f2; color: #fff; font-weight: 800; font-size: 1.08rem;
    display: flex; align-items: center; justify-content: center; gap: .7rem;
    box-shadow: 0 4px 0 #3b47d1; cursor: pointer;
    transition: background .15s ease, transform .08s ease, box-shadow .08s ease;
}
.cp-discord-btn:hover { background: #4752c4; }
.cp-discord-btn:active { transform: translateY(3px); box-shadow: 0 1px 0 #3b47d1; }
.cp-discord-btn i { font-size: 1.35rem; }

.cp-note {
    font-size: .86rem; color: var(--cp-ink-soft); line-height: 1.5;
    margin: 1.25rem 0 0; text-align: center;
}

/* Footer links */
.cp-links {
    display: flex; justify-content: space-between; flex-wrap: wrap; gap: .5rem;
    margin-top: 1.4rem; padding-top: 1.1rem; border-top: 1.5px dashed var(--cp-line);
    font-size: .88rem; font-weight: 700;
}
.cp-links a { color: var(--cp-leaf-dark); text-decoration: none; }
.cp-links a:hover { text-decoration: underline; }
.cp-links a.cp-muted { color: var(--cp-ink-soft); font-weight: 600; }


/* Discord server notice */
.cp-discord-notice {
    display: flex; gap: .85rem; align-items: flex-start;
    background: #eef2ff; border: 1.5px solid #c7d2fe;
    border-radius: 16px; padding: .9rem 1rem; margin-bottom: 1.15rem;
    font-size: .88rem; color: #1e1b4b; line-height: 1.45;
}
.cp-discord-notice__icon {
    width: 34px; height: 34px; border-radius: 50%;
    background: #5865f2; color: #fff; display: grid; place-items: center;
    flex: none; font-size: 1.05rem; margin-top: .1rem;
}
.cp-discord-notice__content { flex: 1; }
.cp-discord-notice__content strong {
    display: block; font-size: .92rem; font-weight: 800; color: #312e81; margin-bottom: .2rem;
}
.cp-discord-notice__content p { margin: 0 0 .5rem 0; font-size: .84rem; color: #4338ca; }
.cp-discord-notice__link {
    display: inline-flex; align-items: center; gap: .35rem;
    font-size: .82rem; font-weight: 700; color: #4f46e5; text-decoration: none;
    background: #fff; padding: .3rem .65rem; border-radius: 9999px;
    border: 1px solid #c7d2fe; box-shadow: 0 1px 2px rgba(0,0,0,.04);
    transition: all .15s ease;
}
.cp-discord-notice__link:hover {
    background: #5865f2; color: #fff; border-color: #5865f2; text-decoration: none;
}

/* Keyboard focus */
.cp-login :is(button, a):focus-visible { outline: 3px solid #0f5132; outline-offset: 2px; }

@media (prefers-reduced-motion: reduce) {
    .cp-login * { transition: none !important; }
}
`;

export const Login: React.FC<{ defaultRegister?: boolean }> = () => {
    const auth = useAuth();
    const [searchParams] = useSearchParams();
    const returnTo = searchParams.get("return_to") || "/profile";
    const errorParam = searchParams.get("error");
    const uid = useId();

    const titleId = `${uid}-title`;

    return (
        <div className="cp-login">
            <style>{STYLES}</style>

            <div className="cp-login__wrap">
                <div className="cp-card">
                    {/* Passport cover */}
                    <header className="cp-card__cover">
                        <div className="cp-card__crest" aria-hidden="true">
                            <i className="fa-solid fa-passport" />
                        </div>
                        <div>
                            <h1 id={titleId} className="ac-font cp-card__title">
                                Resident passport
                            </h1>
                            <p className="cp-card__sub">
                                Sign in with Discord to access your islands, orders, and perks.
                            </p>
                        </div>
                    </header>
                    <div className="cp-card__seam" aria-hidden="true" />

                    <div className="cp-card__body">
                        {errorParam && (
                            <div role="alert" aria-live="assertive" className="cp-alert">
                                <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />
                                <span>
                                    {errorParam === "access_denied"
                                        ? "Sign in was cancelled."
                                        : "Authentication error. Please try signing in again."}
                                </span>
                            </div>
                        )}

                                                {/* Notice to join Discord server */}
                        <div className="cp-discord-notice">
                            <div className="cp-discord-notice__icon" aria-hidden="true">
                                <i className="fa-brands fa-discord" />
                            </div>
                            <div className="cp-discord-notice__content">
                                <strong>Make sure to join our Discord server</strong>
                                <p>
                                    Please ensure you have joined our Discord server before logging in so your membership roles, subscriber perks, and island permissions can synchronize automatically.
                                </p>
                                <a
                                    href="https://discord.gg/chopaeng"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="cp-discord-notice__link"
                                >
                                    <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" />
                                    Join Server (discord.gg/chopaeng)
                                </a>
                            </div>
                        </div>

                        {/* Primary: Discord button */}
                        <button
                            type="button"
                            className="cp-discord-btn"
                            onClick={() => auth.loginWithProvider("discord", returnTo)}
                        >
                            <i className="fa-brands fa-discord" aria-hidden="true" />
                            Continue with Discord
                        </button>

                        <p className="cp-note">
                            We use Discord to verify resident status and automatically synchronize membership roles.
                        </p>

                        <nav className="cp-links" aria-label="More options">
                            <Link to="/membership">View membership plans</Link>
                            <Link to="/" className="cp-muted">Back to home</Link>
                        </nav>
                    </div>
                </div>

                <div className="mt-4 text-center">
                    <DisclaimerBanner variant="text" />
                </div>
            </div>
        </div>
    );
};

export default Login;