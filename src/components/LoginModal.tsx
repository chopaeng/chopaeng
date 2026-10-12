import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/useAuth";
import { type AuthProviderType } from "../context/authContextShared";
import { storeAuthToken } from "../context/authToken";
import { DODO_API_BASE } from "../config/api";
import { playChimeClick } from "../utils/kkAudioSynthesizer";

interface LoginModalProps {
    isOpen?: boolean;
    onClose?: () => void;
    returnPath?: string;
    initialMode?: "login" | "register" | "platforms";
}

interface ProviderOption {
    id: AuthProviderType;
    name: string;
    tier: string;
    description: string;
    icon: string;
    color: string;
    enabled: boolean;
    disabledReason?: string;
}

const PROVIDERS: ProviderOption[] = [
    {
        id: "youtube",
        name: "YouTube",
        tier: "y ChoSoup • y ChoColate • y ChoTato",
        description: "Channel Member badges and sub island perks",
        icon: "fa-brands fa-youtube",
        color: "#e00000",
        enabled: true,
    },
    {
        id: "patreon",
        name: "Patreon",
        tier: "ChoSoup • ChoColate • ChoFries",
        description: "Direct tier perks, item drops and priority",
        icon: "fa-brands fa-patreon",
        color: "#ff424d",
        enabled: true,
    },
    {
        id: "twitch",
        name: "Twitch",
        tier: "ChoTato Club",
        description: "Subscriber or Amazon Prime Gaming",
        icon: "fa-brands fa-twitch",
        color: "#9146ff",
        enabled: true,
    },
    {
        id: "discord",
        name: "Discord",
        tier: "Community Account",
        description: "Server roles and member sub access",
        icon: "fa-brands fa-discord",
        color: "#5865f2",
        enabled: true,
    },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STRENGTH_LABELS = ["Too short", "Weak", "Okay", "Good", "Strong"];

/** 0–4 visual hint only — the server stays the authority. */
const scorePassword = (pw: string): number => {
    let s = 0;
    if (pw.length >= 6) s++;
    if (pw.length >= 10) s++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
    if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) s++;
    return s;
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
    width: 100%; max-width: 480px; max-height: calc(100dvh - 2rem);
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
.cpm__close { position: absolute; top: .8rem; right: .8rem; width: 36px; height: 36px; border: 0; border-radius: 50%; background: rgba(255,255,255,.18); color: #fff; display: grid; place-items: center; transition: background .15s ease; }
.cpm__close:hover { background: rgba(255,255,255,.3); }
.cpm__seam { flex: none; border-top: 3px dashed #fff; margin: 0 14px; position: relative; top: -2px; opacity: .85; }
.cpm__body { padding: 1.25rem 1.5rem 1.5rem; overflow-y: auto; }

.cpm-tabs { display: grid; grid-template-columns: 1fr 1fr; background: #eef3ef; border-radius: 999px; padding: 4px; margin-bottom: 1.1rem; }
.cpm-tab { border: 0; background: transparent; color: var(--ink-soft); font-weight: 700; font-size: .88rem; padding: .55rem .25rem; border-radius: 999px; transition: background .15s ease, color .15s ease; }
.cpm-tab[aria-selected="true"] { background: #fff; color: var(--ink); box-shadow: 0 1px 3px rgba(29,51,40,.18); }
.cpm-tab:not([aria-selected="true"]):hover { color: var(--ink); }

.cpm-alert { display: flex; gap: .6rem; align-items: flex-start; border-radius: 12px; padding: .7rem .9rem; margin-bottom: 1rem; font-size: .88rem; font-weight: 600; }
.cpm-alert i { margin-top: .15rem; }
.cpm-alert--error { background: #fdecea; color: var(--error); border-left: 4px solid var(--error); }
.cpm-alert--warn { background: #fff5dc; color: #7a5200; border-left: 4px solid #e0a030; }

.cpm-field { margin-bottom: .95rem; }
.cpm-label { display: block; font-size: .85rem; font-weight: 700; margin-bottom: .35rem; }
.cpm-optional { font-weight: 500; color: var(--ink-soft); }
.cpm-control { display: flex; align-items: center; border: 1.5px solid var(--line); border-radius: 14px; background: #fafcfb; transition: border-color .15s ease, box-shadow .15s ease, background .15s ease; }
.cpm-control:focus-within { border-color: var(--leaf); background: #fff; box-shadow: 0 0 0 4px rgba(31,138,76,.16); }
.cpm-control[data-invalid="true"] { border-color: var(--error); }
.cpm-control[data-invalid="true"]:focus-within { box-shadow: 0 0 0 4px rgba(179,38,30,.14); }
.cpm-control__icon { width: 2.6rem; padding-left: .95rem; flex: none; color: var(--ink-soft); }
.cpm-input { flex: 1; min-width: 0; border: 0; background: transparent; outline: none; padding: .72rem .9rem .72rem .25rem; font-size: 1rem; font-weight: 600; color: var(--ink); }
.cpm-input::placeholder { color: #9aaba1; font-weight: 500; }
.cpm-reveal { border: 0; background: transparent; color: var(--ink-soft); padding: 0 1rem; align-self: stretch; border-radius: 0 14px 14px 0; }
.cpm-reveal:hover { color: var(--ink); }
.cpm-hint { font-size: .8rem; color: var(--ink-soft); margin: .35rem 0 0; }
.cpm-hint--error { color: var(--error); font-weight: 600; }

.cpm-meter { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; margin-top: .5rem; }
.cpm-meter span { height: 5px; border-radius: 3px; background: #e2e9e4; transition: background .2s ease; }
.cpm-meter[data-score="1"] span:nth-child(-n+1) { background: #d9534f; }
.cpm-meter[data-score="2"] span:nth-child(-n+2) { background: #e0a030; }
.cpm-meter[data-score="3"] span:nth-child(-n+3) { background: #7bb342; }
.cpm-meter[data-score="4"] span:nth-child(-n+4) { background: var(--leaf); }

.cpm-check { display: inline-flex; align-items: center; gap: .55rem; font-size: .88rem; font-weight: 600; color: var(--ink-soft); cursor: pointer; margin: 0 0 1rem; }
.cpm-check input { width: 1.1rem; height: 1.1rem; accent-color: var(--leaf); cursor: pointer; }

.cpm-submit { width: 100%; border: 0; border-radius: 14px; padding: .82rem 1rem; background: var(--leaf); color: #fff; font-weight: 800; font-size: 1rem; display: inline-flex; align-items: center; justify-content: center; gap: .55rem; box-shadow: 0 4px 0 var(--leaf-dark); transition: transform .08s ease, box-shadow .08s ease, background .15s ease; }
.cpm-submit:hover:not(:disabled) { background: #22984f; }
.cpm-submit:active:not(:disabled) { transform: translateY(3px); box-shadow: 0 1px 0 var(--leaf-dark); }
.cpm-submit:disabled { opacity: .75; cursor: progress; }

.cpm-switch { text-align: center; font-size: .88rem; font-weight: 600; color: var(--ink-soft); margin: 1.1rem 0 0; }
.cpm-linkbtn { border: 0; background: transparent; padding: 0; margin-left: .3rem; color: var(--leaf-dark); font-weight: 800; }
.cpm-linkbtn:hover { text-decoration: underline; }

.cpm-divider { display: flex; align-items: center; gap: .8rem; margin: 1.25rem 0 .9rem; color: var(--ink-soft); font-size: .82rem; font-weight: 600; }
.cpm-divider::before, .cpm-divider::after { content: ""; flex: 1; border-top: 1.5px dashed var(--line); }
.cpm-socials { display: grid; grid-template-columns: repeat(3, 1fr); gap: .6rem; }
.cpm-social { display: flex; align-items: center; justify-content: center; gap: .5rem; border: 1.5px solid var(--line); background: #fff; color: var(--ink); border-radius: 14px; padding: .62rem .4rem; font-size: .88rem; font-weight: 700; transition: border-color .15s ease, background .15s ease; }
.cpm-social:hover { background: #f6faf7; border-color: var(--social); }
.cpm-social i { font-size: 1.1rem; color: var(--social); }
@media (max-width: 400px) { .cpm-social { flex-direction: column; gap: .25rem; font-size: .78rem; } }

/* Platform list */
.cpm-providers { display: flex; flex-direction: column; gap: .65rem; }
.cpm-provider { display: flex; align-items: center; gap: .9rem; width: 100%; text-align: left; border: 1.5px solid var(--line); background: #fff; border-radius: 16px; padding: .8rem .95rem; color: var(--ink); transition: border-color .15s ease, background .15s ease; }
.cpm-provider:hover:not([aria-disabled="true"]) { border-color: var(--p); background: #f9fcfa; }
.cpm-provider[aria-disabled="true"] { background: #f4f6f5; cursor: not-allowed; }
.cpm-provider[aria-disabled="true"] .cpm-provider__badge { filter: grayscale(1); opacity: .55; }
.cpm-provider__badge { width: 44px; height: 44px; flex: none; border-radius: 50%; display: grid; place-items: center; color: #fff; font-size: 1.2rem; background: var(--p); }
.cpm-provider__main { flex: 1; min-width: 0; }
.cpm-provider__name { font-weight: 800; font-size: .98rem; }
.cpm-provider__tier { font-size: .8rem; font-weight: 700; color: var(--ink); opacity: .85; }
.cpm-provider__desc { font-size: .8rem; color: var(--ink-soft); }
.cpm-provider__end { color: var(--ink-soft); flex: none; }

.cpm-foot { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: .5rem; margin-top: 1.25rem; padding-top: .95rem; border-top: 1.5px dashed var(--line); font-size: .85rem; font-weight: 600; color: var(--ink-soft); }
.cpm-foot a { color: var(--leaf-dark); font-weight: 800; text-decoration: none; }
.cpm-foot a:hover { text-decoration: underline; }

.cpm :is(button, a, input[type="checkbox"]):focus-visible { outline: 3px solid #0f5132; outline-offset: 2px; }
.cpm-close:focus-visible, .cpm__close:focus-visible { outline-color: #fff; }
.cpm-input:focus-visible { outline: none; }

@media (prefers-reduced-motion: reduce) {
    .cpm-backdrop, .cpm { animation: none; }
    .cpm * { transition: none !important; }
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
    inputRef?: React.Ref<HTMLInputElement>;
}

const Field: React.FC<FieldProps> = ({
    id, label, icon, type = "text", value, onChange, onBlur, placeholder,
    autoComplete, maxLength, error, hint, optional, trailing, children, inputRef,
}) => {
    const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
    return (
        <div className="cpm-field">
            <label htmlFor={id} className="cpm-label">
                {label} {optional && <span className="cpm-optional">(optional)</span>}
            </label>
            <div className="cpm-control" data-invalid={!!error}>
                <i className={`fa-solid ${icon} cpm-control__icon`} aria-hidden="true" />
                <input
                    id={id}
                    ref={inputRef}
                    className="cpm-input"
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
                <p id={`${id}-error`} className="cpm-hint cpm-hint--error">{error}</p>
            ) : hint ? (
                <p id={`${id}-hint`} className="cpm-hint">{hint}</p>
            ) : null}
            {children}
        </div>
    );
};

export const LoginModal: React.FC<LoginModalProps> = ({
    isOpen: propIsOpen,
    onClose: propOnClose,
    returnPath: propReturnPath,
    initialMode = "login",
}) => {
    const auth = useAuth();
    const isOpen = propIsOpen ?? auth.isLoginModalOpen;
    const onClose = propOnClose ?? auth.closeLoginModal;
    const uid = useId();

    const dialogRef = useRef<HTMLDivElement>(null);
    const firstInputRef = useRef<HTMLInputElement>(null);

    const [activeTab, setActiveTab] = useState<"account" | "platforms">(
        initialMode === "platforms" ? "platforms" : "account"
    );
    const [isRegisterMode, setIsRegisterMode] = useState(initialMode === "register");

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [username, setUsername] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(true);
    const [touched, setTouched] = useState({ email: false, password: false });

    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [tooltipMsg, setTooltipMsg] = useState<string | null>(null);

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
            if (e.shiftKey && document.activeElement === first) {
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

    // Lock page scroll, move focus in, restore focus on close
    useEffect(() => {
        if (!isOpen) return;
        const previouslyFocused = document.activeElement as HTMLElement | null;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const t = window.setTimeout(() => {
            (firstInputRef.current ?? dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE))?.focus();
        }, 30);
        return () => {
            window.clearTimeout(t);
            document.body.style.overflow = prevOverflow;
            previouslyFocused?.focus?.();
        };
    }, [isOpen]);

    useEffect(() => {
        setErrorMsg(null);
        setTooltipMsg(null);
        setTouched({ email: false, password: false });
    }, [activeTab, isRegisterMode]);

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

    if (!isOpen) return null;

    const switchTab = (tab: "account" | "platforms") => {
        if (tab === activeTab) return;
        playChimeClick();
        setActiveTab(tab);
    };

    const handleNativeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);
        setTouched({ email: true, password: true });
        if (emailError || passwordError) return;

        playChimeClick();
        setLoading(true);

        const endpoint = isRegisterMode
            ? `${DODO_API_BASE}/api/auth/register`
            : `${DODO_API_BASE}/api/auth/login`;

        const payload: Record<string, string> = {
            email: email.trim().toLowerCase(),
            password,
        };
        if (isRegisterMode && username.trim()) payload.username = username.trim();

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
                        (isRegisterMode
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
            onClose();
        } catch (_err) {
            setErrorMsg("Can't reach the server. Check your connection and try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleSelectProvider = (prov: ProviderOption) => {
        playChimeClick();
        if (!prov.enabled) {
            setTooltipMsg(prov.disabledReason || "This provider is temporarily unavailable.");
            return;
        }
        setTooltipMsg(null);
        auth.loginWithProvider(prov.id, propReturnPath);
        onClose();
    };

    const titleId = `${uid}-title`;
    const enabledProviders = PROVIDERS.filter((p) => p.enabled);

    const title =
        activeTab === "platforms"
            ? "Connect a membership"
            : isRegisterMode
                ? "Get your ChoPaeng passport"
                : "Welcome back, resident";

    const subtitle =
        activeTab === "platforms"
            ? "Sign in with a platform to verify and link your perks."
            : isRegisterMode
                ? "One account for your cart, wishlist and island drops."
                : "Sign in to see your subscriptions, orders and private islands.";

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
                        <h2 id={titleId} className="ac-font cpm__title">{title}</h2>
                        <p className="cpm__sub">{subtitle}</p>
                    </div>
                    <button type="button" className="cpm__close" onClick={onClose} aria-label="Close">
                        <i className="fa-solid fa-xmark" aria-hidden="true" />
                    </button>
                </header>
                <div className="cpm__seam" aria-hidden="true" />

                <div className="cpm__body">
                    <div className="cpm-tabs" role="tablist" aria-label="Sign-in method">
                        <button
                            type="button"
                            role="tab"
                            aria-selected={activeTab === "account"}
                            className="cpm-tab"
                            onClick={() => switchTab("account")}
                        >
                            Email account
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={activeTab === "platforms"}
                            className="cpm-tab"
                            onClick={() => switchTab("platforms")}
                        >
                            Membership platforms
                        </button>
                    </div>

                    <div role="alert" aria-live="assertive">
                        {errorMsg && (
                            <div className="cpm-alert cpm-alert--error">
                                <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />
                                <span>{errorMsg}</span>
                            </div>
                        )}
                    </div>
                    <div role="status" aria-live="polite">
                        {tooltipMsg && (
                            <div className="cpm-alert cpm-alert--warn">
                                <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
                                <span>{tooltipMsg}</span>
                            </div>
                        )}
                    </div>

                    {activeTab === "account" && (
                        <>
                            <form onSubmit={handleNativeSubmit} noValidate>
                                {isRegisterMode && (
                                    <Field
                                        id={`${uid}-username`}
                                        label="Display name"
                                        icon="fa-user"
                                        value={username}
                                        onChange={setUsername}
                                        placeholder="e.g. MayorNook"
                                        autoComplete="username"
                                        maxLength={50}
                                        optional
                                        hint="Shown on your profile and in community areas."
                                        inputRef={firstInputRef}
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
                                    inputRef={isRegisterMode ? undefined : firstInputRef}
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
                                    autoComplete={isRegisterMode ? "new-password" : "current-password"}
                                    error={touched.password ? passwordError : null}
                                    trailing={
                                        <button
                                            type="button"
                                            className="cpm-reveal"
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
                                    {isRegisterMode && password && (
                                        <>
                                            <div className="cpm-meter" data-score={strength} aria-hidden="true">
                                                <span /><span /><span /><span />
                                            </div>
                                            <p className="cpm-hint" aria-live="polite">
                                                Password strength: {STRENGTH_LABELS[strength]}
                                            </p>
                                        </>
                                    )}
                                </Field>

                                {!isRegisterMode && (
                                    <label className="cpm-check">
                                        <input
                                            type="checkbox"
                                            checked={rememberMe}
                                            onChange={(e) => setRememberMe(e.target.checked)}
                                        />
                                        Keep me signed in
                                    </label>
                                )}

                                <button
                                    type="submit"
                                    className="cpm-submit"
                                    disabled={loading}
                                    style={isRegisterMode ? { marginTop: ".4rem" } : undefined}
                                >
                                    {loading ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                                            <span>{isRegisterMode ? "Creating account…" : "Signing in…"}</span>
                                        </>
                                    ) : (
                                        <>
                                            <i
                                                className={`fa-solid ${isRegisterMode ? "fa-user-plus" : "fa-right-to-bracket"}`}
                                                aria-hidden="true"
                                            />
                                            <span>{isRegisterMode ? "Create account" : "Sign in"}</span>
                                        </>
                                    )}
                                </button>
                            </form>

                            <p className="cpm-switch">
                                {isRegisterMode ? "Already have an account?" : "New to ChoPaeng?"}
                                <button
                                    type="button"
                                    className="cpm-linkbtn"
                                    onClick={() => {
                                        playChimeClick();
                                        setIsRegisterMode((m) => !m);
                                    }}
                                >
                                    {isRegisterMode ? "Sign in" : "Create an account"}
                                </button>
                            </p>

                            <div className="cpm-divider">or continue with</div>

                            <div className="cpm-socials">
                                {enabledProviders.map((p) => (
                                    <button
                                        key={p.id}
                                        type="button"
                                        className="cpm-social"
                                        style={{ ["--social" as string]: p.color }}
                                        onClick={() => handleSelectProvider(p)}
                                    >
                                        <i className={p.icon} aria-hidden="true" />
                                        <span>{p.name}</span>
                                    </button>
                                ))}
                            </div>
                        </>
                    )}

                    {activeTab === "platforms" && (
                        <div className="cpm-providers">
                            {PROVIDERS.map((prov) => {
                                const disabled = !prov.enabled;
                                return (
                                    <button
                                        key={prov.id}
                                        type="button"
                                        className="cpm-provider"
                                        style={{ ["--p" as string]: prov.color }}
                                        aria-disabled={disabled}
                                        onClick={() => handleSelectProvider(prov)}
                                    >
                                        <span className="cpm-provider__badge" aria-hidden="true">
                                            <i className={prov.icon} />
                                        </span>
                                        <span className="cpm-provider__main">
                                            <span className="cpm-provider__name d-block">{prov.name}</span>
                                            <span className="cpm-provider__tier d-block">{prov.tier}</span>
                                            <span className="cpm-provider__desc d-block">{prov.description}</span>
                                        </span>
                                        <i
                                            className={`fa-solid ${disabled ? "fa-lock" : "fa-chevron-right"} cpm-provider__end`}
                                            aria-hidden="true"
                                        />
                                        {disabled && <span className="visually-hidden">Currently unavailable</span>}
                                    </button>
                                );
                            })}
                        </div>
                    )}

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