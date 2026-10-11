import React, { useId, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { storeAuthToken } from "../context/authToken";
import { DODO_API_BASE } from "../config/api";
import { playChimeClick } from "../utils/kkAudioSynthesizer";
import DisclaimerBanner from "../components/DisclaimerBanner";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 0–4 score, purely a visual hint — the server stays the authority. */
const scorePassword = (pw: string): number => {
    let score = 0;
    if (pw.length >= 6) score++;
    if (pw.length >= 10) score++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
    if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) score++;
    return score;
};

const STRENGTH_LABELS = ["Too short", "Weak", "Okay", "Good", "Strong"];

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
    padding: 2.5rem 1rem 3rem;
    background:
        radial-gradient(1200px 380px at 50% -140px, #c9ebe4 0%, transparent 70%),
        var(--cp-sky);
}
.cp-login__wrap { max-width: 460px; margin: 0 auto; }

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
    padding: 1.5rem 1.75rem 1.4rem;
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
.cp-card__sub { margin: .2rem 0 0; font-size: .85rem; opacity: .88; }

/* Stitched seam between cover and body */
.cp-card__seam { height: 0; border-top: 3px dashed #fff; margin: 0 14px; position: relative; top: -2px; opacity: .85; }
.cp-card__body { padding: 1.5rem 1.75rem 1.75rem; }

/* Mode switch */
.cp-tabs {
    display: grid; grid-template-columns: 1fr 1fr;
    background: #eef3ef; border-radius: 999px; padding: 4px; margin-bottom: 1.25rem;
}
.cp-tab {
    border: 0; background: transparent; color: var(--cp-ink-soft);
    font-weight: 700; font-size: .92rem; padding: .55rem 0; border-radius: 999px;
    transition: background .15s ease, color .15s ease, box-shadow .15s ease;
}
.cp-tab[aria-selected="true"] { background: #fff; color: var(--cp-ink); box-shadow: 0 1px 3px rgba(29,51,40,.18); }
.cp-tab:not([aria-selected="true"]):hover { color: var(--cp-ink); }

.cp-lead { color: var(--cp-ink-soft); font-size: .92rem; line-height: 1.5; margin: 0 0 1.25rem; }

/* Alert */
.cp-alert {
    display: flex; gap: .6rem; align-items: flex-start;
    background: #fdecea; color: var(--cp-error);
    border-left: 4px solid var(--cp-error);
    border-radius: 12px; padding: .7rem .9rem; margin-bottom: 1rem;
    font-size: .88rem; font-weight: 600;
}
.cp-alert i { margin-top: .15rem; }

/* Fields */
.cp-field { margin-bottom: 1rem; }
.cp-label { display: block; font-size: .85rem; font-weight: 700; margin-bottom: .35rem; }
.cp-optional { font-weight: 500; color: var(--cp-ink-soft); }
.cp-control {
    display: flex; align-items: center;
    border: 1.5px solid var(--cp-line); border-radius: 14px; background: #fafcfb;
    transition: border-color .15s ease, box-shadow .15s ease, background .15s ease;
}
.cp-control:focus-within { border-color: var(--cp-leaf); background: #fff; box-shadow: 0 0 0 4px rgba(31,138,76,.16); }
.cp-control[data-invalid="true"] { border-color: var(--cp-error); }
.cp-control[data-invalid="true"]:focus-within { box-shadow: 0 0 0 4px rgba(179,38,30,.14); }
.cp-control__icon { padding-left: .95rem; color: var(--cp-ink-soft); width: 2.6rem; flex: none; }
.cp-input {
    flex: 1; min-width: 0; border: 0; background: transparent; outline: none;
    padding: .75rem .9rem .75rem .25rem; font-size: 1rem; font-weight: 600; color: var(--cp-ink);
}
.cp-input::placeholder { color: #9aaba1; font-weight: 500; }
.cp-reveal {
    border: 0; background: transparent; color: var(--cp-ink-soft);
    padding: 0 1rem; align-self: stretch; border-radius: 0 14px 14px 0;
}
.cp-reveal:hover { color: var(--cp-ink); }
.cp-hint { font-size: .8rem; color: var(--cp-ink-soft); margin: .35rem 0 0; }
.cp-hint--error { color: var(--cp-error); font-weight: 600; }

/* Strength meter */
.cp-meter { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; margin-top: .5rem; }
.cp-meter span { height: 5px; border-radius: 3px; background: #e2e9e4; transition: background .2s ease; }
.cp-meter[data-score="1"] span:nth-child(-n+1) { background: #d9534f; }
.cp-meter[data-score="2"] span:nth-child(-n+2) { background: #e0a030; }
.cp-meter[data-score="3"] span:nth-child(-n+3) { background: #7bb342; }
.cp-meter[data-score="4"] span:nth-child(-n+4) { background: var(--cp-leaf); }

/* Remember me */
.cp-check { display: inline-flex; align-items: center; gap: .55rem; font-size: .88rem; font-weight: 600; color: var(--cp-ink-soft); cursor: pointer; margin: 0 0 1.1rem; }
.cp-check input { width: 1.1rem; height: 1.1rem; accent-color: var(--cp-leaf); cursor: pointer; }

/* Primary button */
.cp-submit {
    width: 100%; border: 0; border-radius: 14px; padding: .85rem 1rem;
    background: var(--cp-leaf); color: #fff; font-weight: 800; font-size: 1rem;
    display: inline-flex; align-items: center; justify-content: center; gap: .55rem;
    box-shadow: 0 4px 0 var(--cp-leaf-dark);
    transition: transform .08s ease, box-shadow .08s ease, background .15s ease;
}
.cp-submit:hover:not(:disabled) { background: #22984f; }
.cp-submit:active:not(:disabled) { transform: translateY(3px); box-shadow: 0 1px 0 var(--cp-leaf-dark); }
.cp-submit:disabled { opacity: .75; cursor: progress; }

/* Divider + socials */
.cp-divider { display: flex; align-items: center; gap: .8rem; margin: 1.4rem 0 1rem; color: var(--cp-ink-soft); font-size: .82rem; font-weight: 600; }
.cp-divider::before, .cp-divider::after { content: ""; flex: 1; border-top: 1.5px dashed var(--cp-line); }
.cp-socials { display: grid; grid-template-columns: repeat(3, 1fr); gap: .6rem; }
.cp-social {
    display: flex; align-items: center; justify-content: center; gap: .5rem;
    border: 1.5px solid var(--cp-line); background: #fff; color: var(--cp-ink);
    border-radius: 14px; padding: .65rem .4rem; font-size: .88rem; font-weight: 700;
    transition: border-color .15s ease, background .15s ease;
}
.cp-social:hover { background: #f6faf7; border-color: var(--social, var(--cp-leaf)); }
.cp-social i { font-size: 1.1rem; color: var(--social); }
@media (max-width: 400px) {
    .cp-social { flex-direction: column; gap: .25rem; font-size: .78rem; }
}

/* Footer links */
.cp-links { display: flex; justify-content: space-between; flex-wrap: wrap; gap: .5rem; margin-top: 1.5rem; padding-top: 1rem; border-top: 1.5px dashed var(--cp-line); font-size: .88rem; font-weight: 700; }
.cp-links a { color: var(--cp-leaf-dark); text-decoration: none; }
.cp-links a:hover { text-decoration: underline; }
.cp-links a.cp-muted { color: var(--cp-ink-soft); font-weight: 600; }

/* Keyboard focus */
.cp-login :is(button, a, input[type="checkbox"]):focus-visible { outline: 3px solid #0f5132; outline-offset: 2px; }
.cp-input:focus-visible { outline: none; }

@media (prefers-reduced-motion: reduce) {
    .cp-login * { transition: none !important; }
}
`;

interface FieldProps {
    id: string;
    label: string;
    icon: string;
    type?: string;
    value: string;
    onChange: (v: string) => void;
    onBlur?: () => void;
    placeholder?: string;
    autoComplete?: string;
    maxLength?: number;
    error?: string | null;
    hint?: React.ReactNode;
    optional?: boolean;
    trailing?: React.ReactNode;
    children?: React.ReactNode;
}

const Field: React.FC<FieldProps> = ({
    id, label, icon, type = "text", value, onChange, onBlur, placeholder,
    autoComplete, maxLength, error, hint, optional, trailing, children,
}) => {
    const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
    return (
        <div className="cp-field">
            <label htmlFor={id} className="cp-label">
                {label} {optional && <span className="cp-optional">(optional)</span>}
            </label>
            <div className="cp-control" data-invalid={!!error}>
                <i className={`fa-solid ${icon} cp-control__icon`} aria-hidden="true" />
                <input
                    id={id}
                    className="cp-input"
                    type={type}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onBlur={onBlur}
                    placeholder={placeholder}
                    autoComplete={autoComplete}
                    maxLength={maxLength}
                    aria-invalid={!!error}
                    aria-describedby={describedBy}
                />
                {trailing}
            </div>
            {error ? (
                <p id={`${id}-error`} className="cp-hint cp-hint--error">{error}</p>
            ) : hint ? (
                <p id={`${id}-hint`} className="cp-hint">{hint}</p>
            ) : null}
            {children}
        </div>
    );
};

export const Login: React.FC<{ defaultRegister?: boolean }> = ({ defaultRegister = false }) => {
    const auth = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const returnTo = searchParams.get("return_to") || "/profile";
    const uid = useId();

    const [isRegister, setIsRegister] = useState(defaultRegister);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [username, setUsername] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(true);

    const [touched, setTouched] = useState({ email: false, password: false });
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const emailError = !email.trim()
        ? "Enter your email address."
        : !EMAIL_RE.test(email.trim())
            ? "That doesn't look like an email address."
            : null;
    const passwordError = !password
        ? "Enter your password."
        : password.length < 6
            ? "Use at least 6 characters."
            : null;

    const strength = useMemo(() => scorePassword(password), [password]);

    const switchMode = (register: boolean) => {
        if (register === isRegister) return;
        playChimeClick();
        setIsRegister(register);
        setErrorMsg(null);
        setTouched({ email: false, password: false });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);
        setTouched({ email: true, password: true });

        if (emailError || passwordError) return;

        playChimeClick();
        setLoading(true);

        const endpoint = isRegister
            ? `${DODO_API_BASE}/api/auth/register`
            : `${DODO_API_BASE}/api/auth/login`;

        const payload: Record<string, string> = {
            email: email.trim().toLowerCase(),
            password,
        };
        if (isRegister && username.trim()) payload.username = username.trim();

        try {
            const resp = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await resp.json().catch(() => ({}));

            if (!resp.ok || !data.success) {
                setErrorMsg(
                    data.error ||
                        (isRegister
                            ? "We couldn't create your account. Try again."
                            : "Email or password is incorrect.")
                );
                return;
            }

            if (data.token) {
                storeAuthToken(data.token);
                await auth.refreshAuth(data.token);
            }

            playChimeClick();
            navigate(returnTo);
        } catch (_err) {
            setErrorMsg("Can't reach the server. Check your connection and try again.");
        } finally {
            setLoading(false);
        }
    };

    const socials = [
        { id: "youtube", label: "YouTube", icon: "fa-youtube", color: "#e00000" },
        { id: "patreon", label: "Patreon", icon: "fa-patreon", color: "#ff424d" },
        { id: "twitch", label: "Twitch", icon: "fa-twitch", color: "#9146ff" },
    ] as const;

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
                            <h1 className="ac-font cp-card__title">
                                {isRegister ? "Get your ChoPaeng passport" : "Welcome back, resident"}
                            </h1>
                            <p className="cp-card__sub">
                                {isRegister
                                    ? "One account for your cart, island passes and memberships."
                                    : "Sign in to open your islands and manage drops."}
                            </p>
                        </div>
                    </header>
                    <div className="cp-card__seam" aria-hidden="true" />

                    <div className="cp-card__body">
                        {/* Mode switch */}
                        <div className="cp-tabs" role="tablist" aria-label="Account mode">
                            <button
                                type="button"
                                role="tab"
                                aria-selected={!isRegister}
                                className="cp-tab"
                                onClick={() => switchMode(false)}
                            >
                                Sign in
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={isRegister}
                                className="cp-tab"
                                onClick={() => switchMode(true)}
                            >
                                Create account
                            </button>
                        </div>

                        <div role="alert" aria-live="assertive">
                            {errorMsg && (
                                <div className="cp-alert">
                                    <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />
                                    <span>{errorMsg}</span>
                                </div>
                            )}
                        </div>

                        <form onSubmit={handleSubmit} noValidate>
                            {isRegister && (
                                <Field
                                    id={`${uid}-username`}
                                    label="Display name"
                                    icon="fa-user"
                                    value={username}
                                    onChange={setUsername}
                                    placeholder="e.g. IslandMayor"
                                    autoComplete="username"
                                    maxLength={50}
                                    optional
                                    hint="Shown on your profile and in community areas."
                                />
                            )}

                            <Field
                                id={`${uid}-email`}
                                label="Email"
                                icon="fa-envelope"
                                type="email"
                                value={email}
                                onChange={setEmail}
                                onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                                placeholder="resident@chopaeng.com"
                                autoComplete="email"
                                error={touched.email ? emailError : null}
                            />

                            <Field
                                id={`${uid}-password`}
                                label="Password"
                                icon="fa-lock"
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={setPassword}
                                onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                                placeholder="At least 6 characters"
                                autoComplete={isRegister ? "new-password" : "current-password"}
                                error={touched.password ? passwordError : null}
                                trailing={
                                    <button
                                        type="button"
                                        className="cp-reveal"
                                        onClick={() => setShowPassword((s) => !s)}
                                        aria-label={showPassword ? "Hide password" : "Show password"}
                                        aria-pressed={showPassword}
                                    >
                                        <i
                                            className={`fa-solid ${showPassword ? "fa-eye-slash" : "fa-eye"}`}
                                            aria-hidden="true"
                                        />
                                    </button>
                                }
                            >
                                {isRegister && password && (
                                    <>
                                        <div className="cp-meter" data-score={strength} aria-hidden="true">
                                            <span /><span /><span /><span />
                                        </div>
                                        <p className="cp-hint" aria-live="polite">
                                            Password strength: {STRENGTH_LABELS[strength]}
                                        </p>
                                    </>
                                )}
                            </Field>

                            {!isRegister && (
                                <label className="cp-check">
                                    <input
                                        type="checkbox"
                                        checked={rememberMe}
                                        onChange={(e) => setRememberMe(e.target.checked)}
                                    />
                                    Keep me signed in
                                </label>
                            )}

                            <button type="submit" className="cp-submit" disabled={loading} style={isRegister ? { marginTop: ".5rem" } : undefined}>
                                {loading ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                                        <span>{isRegister ? "Creating account…" : "Signing in…"}</span>
                                    </>
                                ) : (
                                    <>
                                        <i
                                            className={`fa-solid ${isRegister ? "fa-user-plus" : "fa-right-to-bracket"}`}
                                            aria-hidden="true"
                                        />
                                        <span>{isRegister ? "Create account" : "Sign in"}</span>
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="cp-divider">or continue with</div>

                        <div className="cp-socials">
                            {socials.map((s) => (
                                <button
                                    key={s.id}
                                    type="button"
                                    className="cp-social"
                                    style={{ ["--social" as string]: s.color }}
                                    onClick={() => auth.loginWithProvider(s.id, returnTo)}
                                >
                                    <i className={`fa-brands ${s.icon}`} aria-hidden="true" />
                                    <span>{s.label}</span>
                                </button>
                            ))}
                        </div>

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