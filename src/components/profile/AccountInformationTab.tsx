import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { getAuthToken } from "../../context/authToken";
import { DODO_API_BASE } from "../../config/api";
import { playChimeClick } from "../../utils/kkAudioSynthesizer";
import { getUserSubTiers } from "../../utils/subIslandAccess";
import { cleanPassportUsername, type PublicPassportData } from "../../utils/userProfileApi";

interface AccountInformationTabProps {
    profileUser?: {
        id?: string;
        discord_name?: string;
        global_name?: string;
        account_name?: string;
        display_name?: string;
        nickname?: string;
        avatar?: string;
        joined_at?: string;
        joined_timestamp?: number | null;
        is_admin?: boolean;
        is_mod?: boolean;
    } | null;
    passportData: PublicPassportData;
}

import { type AuthProviderType } from "../../context/authContextShared";

interface ProviderMeta {
    id: AuthProviderType;
    name: string;
    icon: string;
    /** Brand color, used for the icon. */
    color: string;
    /** Darker shade that keeps white button text readable. */
    ctaColor: string;
    tiers: string;
    description: string;
}

const PROVIDER_CONFIGS: ProviderMeta[] = [
    {
        id: "discord",
        name: "Discord",
        icon: "fa-brands fa-discord",
        color: "#5865f2",
        ctaColor: "#4752c4",
        tiers: "Server Roles • Member Sub Access",
        description: "Server roles, community status, and subscriber channel privileges",
    },
    {
        id: "youtube",
        name: "YouTube",
        icon: "fa-brands fa-youtube",
        color: "#ff0000",
        ctaColor: "#cc0000",
        tiers: "y ChoSoup • y ChoColate • y ChoTato",
        description: "Channel Membership badges and connected sub island tiers",
    },
    {
        id: "patreon",
        name: "Patreon",
        icon: "fa-brands fa-patreon",
        color: "#ff424d",
        ctaColor: "#d92d3a",
        tiers: "ChoSoup • ChoColate • ChoFries",
        description: "Direct membership tiers, priority drops and all 20 islands",
    },
    {
        id: "twitch",
        name: "Twitch",
        icon: "fa-brands fa-twitch",
        color: "#9146ff",
        ctaColor: "#772ce8",
        tiers: "ChoTato Club (Subs & Prime Gaming)",
        description: "11 Core VIP islands, custom emotes and ChoBot access",
    },
];

type Notice = { type: "success" | "error"; text: string } | null;

const STYLES = `
.cpa {
    --ink: #1d3328; --ink-soft: #5b6e63; --leaf: #1f8a4c; --leaf-dark: #166b3a;
    --line: #cfdcd3; --error: #b3261e; --sand-dark: #8a6508;
    color: var(--ink);
    display: grid; grid-template-columns: 1fr; gap: 1.5rem; align-items: start;
}
@media (min-width: 992px) { .cpa { grid-template-columns: 7fr 5fr; } }
.cpa__col { display: flex; flex-direction: column; gap: 1.5rem; min-width: 0; }

/* Cards */
.cpa-card { background: #fff; border-radius: 24px; padding: 1.4rem 1.5rem; box-shadow: 0 1px 0 rgba(29,51,40,.04), 0 14px 30px -18px rgba(29,51,40,.3); }
.cpa-card--passport { padding: 0; overflow: hidden; }
.cpa-head { display: flex; align-items: center; justify-content: space-between; gap: .75rem; flex-wrap: wrap; padding-bottom: .9rem; margin-bottom: 1rem; border-bottom: 1.5px dashed var(--line); }
.cpa-head__main { display: flex; align-items: center; gap: .75rem; min-width: 0; }
.cpa-icon { width: 42px; height: 42px; flex: none; border-radius: 50%; display: grid; place-items: center; background: #e6f4ec; color: var(--leaf-dark); font-size: 1.05rem; }
.cpa-title { margin: 0; font-size: 1.1rem; font-weight: 800; line-height: 1.2; }
.cpa-sub { margin: .1rem 0 0; font-size: .82rem; color: var(--ink-soft); font-weight: 600; }

/* Passport cover */
.cpa-cover { background: var(--leaf); color: #fff; padding: 1.25rem 1.5rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
.cpa-cover__who { display: flex; align-items: center; gap: 1rem; min-width: 0; }
.cpa-crest { width: 56px; height: 56px; flex: none; border-radius: 50%; display: grid; place-items: center; background: rgba(255,255,255,.16); border: 2px dashed rgba(255,255,255,.55); font-size: 1.4rem; }
.cpa-name { margin: 0; font-size: 1.4rem; font-weight: 800; line-height: 1.15; overflow-wrap: anywhere; }
.cpa-id { margin: .2rem 0 0; font-size: .8rem; opacity: .9; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; overflow-wrap: anywhere; }
.cpa-chip { display: inline-flex; align-items: center; gap: .35rem; padding: .2rem .65rem; border-radius: 999px; font-size: .78rem; font-weight: 800; background: rgba(255,255,255,.2); color: #fff; margin-bottom: .35rem; }
.cpa-chip--gold { background: #f6d56b; color: #4a3600; }
.cpa-seam { border-top: 3px dashed #fff; margin: 0 14px; position: relative; top: -2px; opacity: .85; }
.cpa-passport__body { padding: 1.25rem 1.5rem 1.5rem; }

/* Buttons */
.cpa-btn { display: inline-flex; align-items: center; justify-content: center; gap: .45rem; border: 1.5px solid var(--line); background: #fff; color: var(--ink); border-radius: 12px; padding: .5rem .9rem; font-size: .85rem; font-weight: 700; text-decoration: none; transition: border-color .15s ease, background .15s ease; }
.cpa-btn:hover:not(:disabled) { border-color: var(--leaf); background: #f6faf7; color: var(--ink); }
.cpa-btn:disabled { opacity: .7; cursor: progress; }
.cpa-btn i { color: var(--leaf); }
.cpa-btn--primary { background: var(--leaf); border-color: var(--leaf); color: #fff; box-shadow: 0 3px 0 var(--leaf-dark); }
.cpa-btn--primary:hover:not(:disabled) { background: #22984f; border-color: #22984f; color: #fff; }
.cpa-btn--primary:active:not(:disabled) { transform: translateY(2px); box-shadow: 0 1px 0 var(--leaf-dark); }
.cpa-btn--primary i { color: #fff; }
.cpa-btn--danger { color: var(--error); border-color: #e8bcb8; }
.cpa-btn--danger:hover:not(:disabled) { background: #fdecea; border-color: var(--error); color: var(--error); }
.cpa-btn--danger i { color: var(--error); }
.cpa-btn--solid-danger { background: var(--error); border-color: var(--error); color: #fff; }
.cpa-btn--solid-danger:hover:not(:disabled) { background: #9a1f18; border-color: #9a1f18; color: #fff; }
.cpa-btn--solid-danger i { color: #fff; }
.cpa-btn--onleaf { background: rgba(255,255,255,.18); border-color: rgba(255,255,255,.45); color: #fff; }
.cpa-btn--onleaf:hover:not(:disabled) { background: rgba(255,255,255,.3); border-color: #fff; color: #fff; }
.cpa-btn--onleaf i { color: #fff; }
.cpa-btn--block { width: 100%; }
.cpa-btn--sm { padding: .35rem .75rem; font-size: .8rem; border-radius: 10px; }

/* Details */
.cpa-details { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: .85rem 1.25rem; margin: 0; }
.cpa-details > div { min-width: 0; }
.cpa-details dt { font-size: .8rem; font-weight: 700; color: var(--ink-soft); margin-bottom: .2rem; }
.cpa-details dd { margin: 0; display: flex; align-items: center; justify-content: space-between; gap: .5rem; font-size: .92rem; font-weight: 700; min-width: 0; }
.cpa-val { display: inline-flex; align-items: center; gap: .5rem; min-width: 0; }
.cpa-val span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cpa-val i { color: var(--ink-soft); flex: none; }
.cpa-val i.ok { color: var(--leaf); }
.cpa-val i.warn { color: #c98a0a; }

/* Notices */
.cpa-notice { display: flex; gap: .6rem; align-items: flex-start; border-radius: 12px; padding: .65rem .85rem; margin-bottom: .9rem; font-size: .86rem; font-weight: 600; }
.cpa-notice i { margin-top: .15rem; }
.cpa-notice--success { background: #e6f4ec; color: var(--leaf-dark); border-left: 4px solid var(--leaf); }
.cpa-notice--error { background: #fdecea; color: var(--error); border-left: 4px solid var(--error); }

/* Password form */
.cpa-pw { margin-top: 1.25rem; padding: 1.1rem 1.1rem 1.2rem; border: 2px dashed var(--line); border-radius: 18px; background: #fafcfb; }
.cpa-pw h3 { margin: 0 0 .9rem; font-size: 1rem; font-weight: 800; display: flex; align-items: center; gap: .5rem; }
.cpa-pw h3 i { color: var(--leaf); }
.cpa-field { margin-bottom: .85rem; }
.cpa-label { display: block; font-size: .84rem; font-weight: 700; margin-bottom: .3rem; }
.cpa-control { display: flex; align-items: center; border: 1.5px solid var(--line); border-radius: 12px; background: #fff; transition: border-color .15s ease, box-shadow .15s ease; }
.cpa-control:focus-within { border-color: var(--leaf); box-shadow: 0 0 0 4px rgba(31,138,76,.16); }
.cpa-control[data-invalid="true"] { border-color: var(--error); }
.cpa-input { flex: 1; min-width: 0; border: 0; background: transparent; outline: none; padding: .6rem .85rem; font-size: .95rem; font-weight: 600; color: var(--ink); }
.cpa-input::placeholder { color: #9aaba1; font-weight: 500; }
.cpa-reveal { border: 0; background: transparent; color: var(--ink-soft); padding: 0 .9rem; align-self: stretch; border-radius: 0 12px 12px 0; }
.cpa-reveal:hover { color: var(--ink); }
.cpa-fielderr { font-size: .8rem; font-weight: 600; color: var(--error); margin: .3rem 0 0; }
.cpa-form-actions { display: flex; justify-content: flex-end; gap: .6rem; margin-top: 1rem; }

/* Access stats */
.cpa-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: .75rem; margin: 0 0 1.1rem; }
.cpa-stat { background: #f3f8f5; border-radius: 16px; padding: .8rem .9rem; }
.cpa-stat dt { font-size: .8rem; font-weight: 700; color: var(--ink-soft); margin: 0; }
.cpa-stat dd { margin: .15rem 0 0; }
.cpa-stat__val { display: block; font-size: 1.2rem; font-weight: 800; color: var(--leaf-dark); line-height: 1.25; }
.cpa-stat__val--muted { color: var(--ink-soft); }
.cpa-stat__cap { display: block; font-size: .78rem; color: var(--ink-soft); font-weight: 600; }
.cpa-lead { margin: 0 0 1rem; font-size: .9rem; line-height: 1.5; color: var(--ink-soft); font-weight: 600; }
.cpa-foot { display: flex; justify-content: space-between; align-items: center; gap: .6rem; flex-wrap: wrap; padding-top: .9rem; border-top: 1.5px dashed var(--line); }

/* Linked platforms */
.cpa-count { font-size: .8rem; font-weight: 800; padding: .25rem .7rem; border-radius: 999px; background: #eef3ef; color: var(--ink-soft); }
.cpa-count--on { background: #e6f4ec; color: var(--leaf-dark); }
.cpa-plist { list-style: none; margin: 0 0 1rem; padding: 0; display: flex; flex-direction: column; gap: .75rem; }
.cpa-prov { border: 1.5px solid var(--line); border-radius: 16px; padding: .85rem 1rem; background: #fff; }
.cpa-prov[data-linked="true"] { border-color: var(--leaf); background: #fbfefc; }
.cpa-prov__top { display: flex; align-items: center; justify-content: space-between; gap: .6rem; }
.cpa-prov__name { display: flex; align-items: center; gap: .55rem; font-weight: 800; font-size: .98rem; }
.cpa-prov__name i { font-size: 1.2rem; }
.cpa-status { font-size: .78rem; font-weight: 800; padding: .15rem .6rem; border-radius: 999px; display: inline-flex; align-items: center; gap: .35rem; }
.cpa-status--on { background: #e6f4ec; color: var(--leaf-dark); }
.cpa-status--off { background: #eef3ef; color: var(--ink-soft); }
.cpa-prov__tiers { margin: .3rem 0 .7rem; font-size: .82rem; color: var(--ink-soft); font-weight: 600; }
.cpa-prov__who { display: flex; align-items: center; justify-content: space-between; gap: .5rem; background: #f3f8f5; border-radius: 10px; padding: .4rem .7rem; margin-bottom: .7rem; font-size: .84rem; font-weight: 600; color: var(--ink-soft); }
.cpa-prov__who strong { color: var(--ink); }
.cpa-prov__who .t { background: var(--leaf); color: #fff; border-radius: 999px; padding: .1rem .55rem; font-size: .75rem; font-weight: 800; flex: none; }
.cpa-connect { width: 100%; border: 0; border-radius: 12px; padding: .55rem 1rem; font-size: .88rem; font-weight: 800; color: #fff; background: var(--cta); display: inline-flex; align-items: center; justify-content: center; gap: .45rem; transition: filter .15s ease; }
.cpa-connect:hover { filter: brightness(1.12); }
.cpa-confirm { background: #fff5f4; border: 1.5px solid #e8bcb8; border-radius: 12px; padding: .7rem .8rem; }
.cpa-confirm p { margin: 0 0 .6rem; font-size: .85rem; font-weight: 700; color: #7a1c16; line-height: 1.4; }
.cpa-confirm__actions { display: flex; gap: .5rem; }
.cpa-confirm__actions .cpa-btn { flex: 1; }
.cpa-note { display: flex; gap: .6rem; font-size: .84rem; font-weight: 600; color: var(--ink-soft); line-height: 1.45; }
.cpa-note i { color: var(--leaf); margin-top: .15rem; }

/* Public profile */
.cpa-url { background: #f3f8f5; border-radius: 14px; padding: .8rem .9rem; margin-bottom: 1rem; }
.cpa-url__label { font-size: .8rem; font-weight: 700; color: var(--ink-soft); display: block; margin-bottom: .25rem; }
.cpa-url__val { display: block; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .85rem; font-weight: 600; overflow-wrap: anywhere; margin-bottom: .7rem; }
.cpa-url__actions { display: flex; gap: .5rem; flex-wrap: wrap; }
.cpa-url__actions .cpa-btn:first-child { flex: 1; }
.cpa-signout { padding-top: 1rem; border-top: 1.5px dashed var(--line); }

.cpa :is(a, button):focus-visible { outline: 3px solid #0f5132; outline-offset: 2px; }
.cpa-cover :is(a, button):focus-visible { outline-color: #fff; }
@media (prefers-reduced-motion: reduce) { .cpa * { transition: none !important; } }
`;

interface PwFieldProps {
    id: string;
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
    autoComplete: string;
    reveal?: { shown: boolean; toggle: () => void };
    error?: string | null;
    minLength?: number;
}

const PwField: React.FC<PwFieldProps> = ({
    id, label, value, onChange, placeholder, autoComplete, reveal, error, minLength,
}) => (
    <div className="cpa-field">
        <label htmlFor={id} className="cpa-label">{label}</label>
        <div className="cpa-control" data-invalid={!!error}>
            <input
                id={id}
                className="cpa-input"
                type={reveal && reveal.shown ? "text" : "password"}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                autoComplete={autoComplete}
                minLength={minLength}
                required
                aria-invalid={!!error}
                aria-describedby={error ? `${id}-err` : undefined}
            />
            {reveal && (
                <button
                    type="button"
                    className="cpa-reveal"
                    onClick={reveal.toggle}
                    aria-label={reveal.shown ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
                    aria-pressed={reveal.shown}
                >
                    <i className={`fa-solid ${reveal.shown ? "fa-eye-slash" : "fa-eye"}`} aria-hidden="true" />
                </button>
            )}
        </div>
        {error && <p id={`${id}-err`} className="cpa-fielderr">{error}</p>}
    </div>
);

export const AccountInformationTab: React.FC<AccountInformationTabProps> = ({
    profileUser,
    passportData,
}) => {
    const { user: authUser, loginWithProvider, unlinkProvider, refreshAuth, logout } = useAuth();
    const uid = useId();

    // Password form
    const [showPasswordForm, setShowPasswordForm] = useState(false);
    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showOldPw, setShowOldPw] = useState(false);
    const [showNewPw, setShowNewPw] = useState(false);
    const [loadingPw, setLoadingPw] = useState(false);
    const [pwNotice, setPwNotice] = useState<Notice>(null);

    // Linked platforms
    const [unlinkingProvider, setUnlinkingProvider] = useState<string | null>(null);
    const [confirmingUnlink, setConfirmingUnlink] = useState<string | null>(null);
    const [hubNotice, setHubNotice] = useState<Notice>(null);

    // Misc
    const [linkCopied, setLinkCopied] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [confirmingSignOut, setConfirmingSignOut] = useState(false);

    // Timers are cleared on unmount so they can't update an unmounted component
    const timers = useRef<number[]>([]);
    const later = (fn: () => void, ms: number) => {
        timers.current.push(window.setTimeout(fn, ms));
    };
    useEffect(() => {
        const list = timers.current;
        return () => list.forEach((t) => window.clearTimeout(t));
    }, []);

    const activeTiers = getUserSubTiers(authUser);
    const hasActiveSubscription = activeTiers.length > 0 || !!(authUser?.is_admin || authUser?.is_mod);

    const resolvedTier = useMemo(() => {
        if (authUser?.is_admin) return { name: "ChoPaeng Administrator", level: 3, islands: 20, badge: "Staff" };
        if (authUser?.is_mod) return { name: "ChoPaeng Moderator", level: 3, islands: 20, badge: "Staff" };

        const names = activeTiers.map((t) => t.toLowerCase());
        if (names.some((t) => t.includes("chosoup"))) {
            return { name: "Tier 3 • ChoSoup VIP", level: 3, islands: 20, badge: "Tier 3" };
        }
        if (names.some((t) => t.includes("chocolate"))) {
            return { name: "Tier 2 • ChoColate VIP", level: 2, islands: 15, badge: "Tier 2" };
        }
        if (names.some((t) => t.includes("chotato") || t.includes("chofries"))) {
            return { name: "Tier 1 • ChoTato Club / VIP", level: 1, islands: 11, badge: "Tier 1" };
        }
        if (activeTiers.length > 0) {
            return { name: activeTiers[0], level: 1, islands: 11, badge: "VIP" };
        }
        if (authUser?.is_subscriber) {
            return { name: "Subscriber VIP Pass", level: 1, islands: 11, badge: "VIP" };
        }
        return { name: "Standard Resident Pass", level: 0, islands: 0, badge: "Free" };
    }, [activeTiers, authUser]);

    const confirmMismatch =
        confirmPassword.length > 0 && newPassword !== confirmPassword ? "Passwords don't match." : null;

    const closePasswordForm = () => {
        setShowPasswordForm(false);
        setPwNotice(null);
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
    };

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        playChimeClick();
        setPwNotice(null);

        if (newPassword.length < 6) {
            setPwNotice({ type: "error", text: "Use at least 6 characters for your new password." });
            return;
        }
        if (newPassword !== confirmPassword) {
            setPwNotice({ type: "error", text: "The new passwords don't match." });
            return;
        }

        const token = getAuthToken();
        if (!token) {
            setPwNotice({ type: "error", text: "Your session has expired. Sign in again to change your password." });
            return;
        }

        setLoadingPw(true);
        try {
            const resp = await fetch(`${DODO_API_BASE}/api/auth/password`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    old_password: oldPassword || undefined,
                    new_password: newPassword,
                }),
            });
            const data = await resp.json();
            if (resp.ok && data.success) {
                setPwNotice({ type: "success", text: "Password updated." });
                setOldPassword("");
                setNewPassword("");
                setConfirmPassword("");
                later(() => setShowPasswordForm(false), 2000);
            } else {
                setPwNotice({ type: "error", text: data.error || "We couldn't update your password. Try again." });
            }
        } catch {
            setPwNotice({ type: "error", text: "Can't reach the server. Check your connection and try again." });
        } finally {
            setLoadingPw(false);
        }
    };

    const handleUnlink = async (provider: string, provName: string) => {
        playChimeClick();
        setConfirmingUnlink(null);
        setUnlinkingProvider(provider);
        try {
            const ok = await unlinkProvider(provider);
            setHubNotice(
                ok
                    ? { type: "success", text: `${provName} is no longer linked to your ChoPaeng account.` }
                    : { type: "error", text: `We couldn't unlink ${provName}. Try again.` }
            );
        } catch {
            setHubNotice({ type: "error", text: `Something went wrong while unlinking ${provName}.` });
        } finally {
            setUnlinkingProvider(null);
            later(() => setHubNotice(null), 5000);
        }
    };

    const handleSync = async () => {
        playChimeClick();
        setSyncing(true);
        try {
            await refreshAuth();
        } finally {
            setSyncing(false);
        }
    };

    const usernameDisplay = authUser?.username || profileUser?.discord_name || "Resident";
    const publicSlug = cleanPassportUsername(passportData.username, usernameDisplay);
    const publicUrl = `${window.location.origin}/u/${publicSlug}`;

    const handleCopy = async () => {
        playChimeClick();
        try {
            await navigator.clipboard.writeText(publicUrl);
            setLinkCopied(true);
            later(() => setLinkCopied(false), 2500);
        } catch {
            // Clipboard can be blocked; the URL stays visible so it can be copied by hand
        }
    };

    const connectedCount = PROVIDER_CONFIGS.filter((prov) =>
        Boolean(
            authUser?.connected_providers?.includes(prov.id) ||
            (authUser?.connected_accounts && authUser.connected_accounts[prov.id]) ||
            authUser?.provider === prov.id
        )
    ).length;
    const standing = authUser?.is_admin ? "Administrator" : authUser?.is_mod ? "Community moderator" : "Active resident";

    return (
        <div className="cpa" role="tabpanel" aria-label="Account information and settings">
            <style>{STYLES}</style>

            {/* Left column */}
            <div className="cpa__col">
                {/* Identity passport */}
                <section className="cpa-card cpa-card--passport" aria-labelledby={`${uid}-id`}>
                    <header className="cpa-cover">
                        <div className="cpa-cover__who">
                            <div className="cpa-crest" aria-hidden="true">
                                <i className="fa-solid fa-passport" />
                            </div>
                            <div style={{ minWidth: 0 }}>
                                <span className={`cpa-chip ${hasActiveSubscription ? "cpa-chip--gold" : ""}`}>
                                    {resolvedTier.badge}
                                </span>
                                <h2 id={`${uid}-id`} className="ac-font cpa-name">{usernameDisplay}</h2>
                                <p className="cpa-id">ID: {authUser?.user_id || "resident"}</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            className="cpa-btn cpa-btn--onleaf"
                            onClick={handleSync}
                            disabled={syncing}
                            title="Refresh your sign-in and access from linked platforms"
                        >
                            <i className={`fa-solid fa-arrows-rotate ${syncing ? "fa-spin" : ""}`} aria-hidden="true" />
                            {syncing ? "Syncing…" : "Sync now"}
                        </button>
                    </header>
                    <div className="cpa-seam" aria-hidden="true" />

                    <div className="cpa-passport__body">
                        <dl className="cpa-details">
                            <div>
                                <dt>Email</dt>
                                <dd>
                                    <span className="cpa-val">
                                        <i className="fa-solid fa-envelope" aria-hidden="true" />
                                        <span>{authUser?.email || "Not linked"}</span>
                                    </span>
                                </dd>
                            </div>
                            <div>
                                <dt>Sign-in method</dt>
                                <dd>
                                    <span className="cpa-val">
                                        <i className="fa-solid fa-shield-halved ok" aria-hidden="true" />
                                        <span className="text-capitalize">{authUser?.provider === "native" ? "Native (ChoPaeng Account)" : authUser?.provider || "ChoPaeng account"}</span>
                                    </span>
                                </dd>
                            </div>
                            <div>
                                <dt>Password</dt>
                                <dd>
                                    <span className="cpa-val">
                                        <i
                                            className={`fa-solid ${authUser?.has_password ? "fa-lock ok" : "fa-lock-open warn"}`}
                                            aria-hidden="true"
                                        />
                                        <span>{authUser?.has_password ? "Password set" : "No password yet"}</span>
                                    </span>
                                    <button
                                        type="button"
                                        className="cpa-btn cpa-btn--sm"
                                        aria-expanded={showPasswordForm}
                                        aria-controls={`${uid}-pw`}
                                        onClick={() => {
                                            playChimeClick();
                                            if (showPasswordForm) closePasswordForm();
                                            else setShowPasswordForm(true);
                                        }}
                                    >
                                        {showPasswordForm ? "Cancel" : authUser?.has_password ? "Change" : "Set password"}
                                    </button>
                                </dd>
                            </div>
                            <div>
                                <dt>Standing</dt>
                                <dd>
                                    <span className="cpa-val">
                                        <i className="fa-solid fa-certificate warn" aria-hidden="true" />
                                        <span>{standing}</span>
                                    </span>
                                </dd>
                            </div>
                        </dl>

                        {showPasswordForm && (
                            <div className="cpa-pw" id={`${uid}-pw`}>
                                <h3>
                                    <i className="fa-solid fa-key" aria-hidden="true" />
                                    {authUser?.has_password ? "Change your password" : "Set a password"}
                                </h3>

                                <div role="status" aria-live="polite">
                                    {pwNotice && (
                                        <div className={`cpa-notice cpa-notice--${pwNotice.type}`}>
                                            <i
                                                className={`fa-solid ${pwNotice.type === "success" ? "fa-circle-check" : "fa-circle-exclamation"}`}
                                                aria-hidden="true"
                                            />
                                            <span>{pwNotice.text}</span>
                                        </div>
                                    )}
                                </div>

                                <form onSubmit={handlePasswordSubmit}>
                                    {authUser?.has_password && (
                                        <PwField
                                            id={`${uid}-old`}
                                            label="Current password"
                                            value={oldPassword}
                                            onChange={setOldPassword}
                                            placeholder="Enter your current password"
                                            autoComplete="current-password"
                                            reveal={{ shown: showOldPw, toggle: () => setShowOldPw((s) => !s) }}
                                        />
                                    )}
                                    <PwField
                                        id={`${uid}-new`}
                                        label="New password"
                                        value={newPassword}
                                        onChange={setNewPassword}
                                        placeholder="At least 6 characters"
                                        autoComplete="new-password"
                                        minLength={6}
                                        reveal={{ shown: showNewPw, toggle: () => setShowNewPw((s) => !s) }}
                                    />
                                    <PwField
                                        id={`${uid}-confirm`}
                                        label="Confirm new password"
                                        value={confirmPassword}
                                        onChange={setConfirmPassword}
                                        placeholder="Repeat your new password"
                                        autoComplete="new-password"
                                        minLength={6}
                                        error={confirmMismatch}
                                    />

                                    <div className="cpa-form-actions">
                                        <button type="button" className="cpa-btn" onClick={closePasswordForm}>
                                            Cancel
                                        </button>
                                        <button type="submit" className="cpa-btn cpa-btn--primary" disabled={loadingPw}>
                                            {loadingPw ? (
                                                <>
                                                    <i className="fa-solid fa-spinner fa-spin" aria-hidden="true" />
                                                    Saving…
                                                </>
                                            ) : (
                                                <>
                                                    <i className="fa-solid fa-check" aria-hidden="true" />
                                                    Save password
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}
                    </div>
                </section>

                {/* Access */}
                <section className="cpa-card" aria-labelledby={`${uid}-access`}>
                    <div className="cpa-head">
                        <div className="cpa-head__main">
                            <div className="cpa-icon" aria-hidden="true"><i className="fa-solid fa-crown" /></div>
                            <div>
                                <h3 id={`${uid}-access`} className="ac-font cpa-title">Your access</h3>
                                <p className="cpa-sub">Based on all your linked platforms</p>
                            </div>
                        </div>
                        <span className={`cpa-chip ${hasActiveSubscription ? "cpa-chip--gold" : ""}`} style={hasActiveSubscription ? undefined : { background: "#eef3ef", color: "var(--ink-soft)" }}>
                            {resolvedTier.name}
                        </span>
                    </div>

                    <p className="cpa-lead">
                        Your access is worked out from every account you've connected across YouTube, Patreon, and Twitch. The highest tier wins.
                    </p>

                    <dl className="cpa-stats">
                        <div className="cpa-stat">
                            <dt>Sub islands</dt>
                            <dd>
                                <span className="cpa-stat__val">{resolvedTier.islands} / 20</span>
                                <span className="cpa-stat__cap">VIP Dodo codes</span>
                            </dd>
                        </div>
                        <div className="cpa-stat">
                            <dt>Drop bot</dt>
                            <dd>
                                <span className={`cpa-stat__val ${resolvedTier.level >= 1 ? "" : "cpa-stat__val--muted"}`}>
                                    {resolvedTier.level >= 1 ? "Priority" : "Standard"}
                                </span>
                                <span className="cpa-stat__cap">Queue status</span>
                            </dd>
                        </div>
                        <div className="cpa-stat">
                            <dt>Villagers</dt>
                            <dd>
                                <span className={`cpa-stat__val ${resolvedTier.level >= 2 ? "" : "cpa-stat__val--muted"}`}>
                                    {resolvedTier.level >= 2 ? "VIP" : "Restricted"}
                                </span>
                                <span className="cpa-stat__cap">Injections</span>
                            </dd>
                        </div>
                        <div className="cpa-stat">
                            <dt>Catalogue</dt>
                            <dd>
                                <span className="cpa-stat__val">Active</span>
                                <span className="cpa-stat__cap">Pockets &amp; cart</span>
                            </dd>
                        </div>
                    </dl>

                    <div className="cpa-foot">
                        <Link to="/membership-tiers" className="cpa-btn">
                            <i className="fa-solid fa-table-cells" aria-hidden="true" />
                            View island matrix
                        </Link>
                        <Link to="/islands" className="cpa-btn cpa-btn--primary">
                            <i className="fa-solid fa-plane-departure" aria-hidden="true" />
                            Visit sub islands
                        </Link>
                    </div>
                </section>
            </div>

            {/* Right column */}
            <div className="cpa__col">
                {/* Linked platforms */}
                <section className="cpa-card" aria-labelledby={`${uid}-links`}>
                    <div className="cpa-head">
                        <div className="cpa-head__main">
                            <div className="cpa-icon" aria-hidden="true"><i className="fa-solid fa-link" /></div>
                            <div>
                                <h3 id={`${uid}-links`} className="ac-font cpa-title">Linked platforms</h3>
                                <p className="cpa-sub">Sync your memberships</p>
                            </div>
                        </div>
                        <span className={`cpa-count ${connectedCount > 0 ? "cpa-count--on" : ""}`}>
                            {connectedCount} of {PROVIDER_CONFIGS.length} connected
                        </span>
                    </div>

                    <div role="status" aria-live="polite">
                        {hubNotice && (
                            <div className={`cpa-notice cpa-notice--${hubNotice.type}`}>
                                <i
                                    className={`fa-solid ${hubNotice.type === "success" ? "fa-circle-check" : "fa-circle-exclamation"}`}
                                    aria-hidden="true"
                                />
                                <span>{hubNotice.text}</span>
                            </div>
                        )}
                    </div>

                    <ul className="cpa-plist">
                        {PROVIDER_CONFIGS.map((prov) => {
                            const isLinked = Boolean(
                                authUser?.connected_providers?.includes(prov.id) ||
                                (authUser?.connected_accounts && authUser.connected_accounts[prov.id]) ||
                                authUser?.provider === prov.id
                            );
                            const accountDetail = authUser?.connected_accounts?.[prov.id];
                            const linkedName =
                                accountDetail?.username ||
                                accountDetail?.name ||
                                (authUser?.provider === prov.id ? authUser?.username : null);
                            const linkedTier = accountDetail?.sub_tier;
                            const isConfirming = confirmingUnlink === prov.id;
                            const isUnlinking = unlinkingProvider === prov.id;

                            return (
                                <li
                                    key={prov.id}
                                    className="cpa-prov"
                                    data-linked={isLinked}
                                    style={{ ["--cta" as string]: prov.ctaColor }}
                                >
                                    <div className="cpa-prov__top">
                                        <span className="cpa-prov__name">
                                            <i className={prov.icon} style={{ color: prov.color }} aria-hidden="true" />
                                            {prov.name}
                                        </span>
                                        {isLinked ? (
                                            <span className="cpa-status cpa-status--on">
                                                <i className="fa-solid fa-circle-check" aria-hidden="true" /> Connected
                                            </span>
                                        ) : (
                                            <span className="cpa-status cpa-status--off">Not linked</span>
                                        )}
                                    </div>
                                    <p className="cpa-prov__tiers">{prov.tiers}</p>

                                    {isLinked && linkedName && (
                                        <div className="cpa-prov__who">
                                            <span className="text-truncate">
                                                Signed in as <strong>{linkedName}</strong>
                                            </span>
                                            {linkedTier && <span className="t">{linkedTier}</span>}
                                        </div>
                                    )}

                                    {!isLinked && (
                                        <button
                                            type="button"
                                            className="cpa-connect"
                                            onClick={() => {
                                                playChimeClick();
                                                loginWithProvider(prov.id);
                                            }}
                                        >
                                            <i className="fa-solid fa-link" aria-hidden="true" />
                                            Connect {prov.name}
                                        </button>
                                    )}

                                    {isLinked && !isConfirming && (
                                        <button
                                            type="button"
                                            className="cpa-btn cpa-btn--danger cpa-btn--block"
                                            disabled={isUnlinking}
                                            onClick={() => {
                                                playChimeClick();
                                                setConfirmingUnlink(prov.id);
                                            }}
                                        >
                                            {isUnlinking ? (
                                                <>
                                                    <i className="fa-solid fa-spinner fa-spin" aria-hidden="true" />
                                                    Unlinking…
                                                </>
                                            ) : (
                                                <>
                                                    <i className="fa-solid fa-link-slash" aria-hidden="true" />
                                                    Unlink {prov.name}
                                                </>
                                            )}
                                        </button>
                                    )}

                                    {isLinked && isConfirming && (
                                        <div className="cpa-confirm" role="group" aria-label={`Confirm unlinking ${prov.name}`}>
                                            <p>
                                                Unlink {prov.name}? Perks from this account will update the next time you sync.
                                            </p>
                                            <div className="cpa-confirm__actions">
                                                <button
                                                    type="button"
                                                    className="cpa-btn cpa-btn--sm cpa-btn--solid-danger"
                                                    onClick={() => handleUnlink(prov.id, prov.name)}
                                                >
                                                    Yes, unlink
                                                </button>
                                                <button
                                                    type="button"
                                                    className="cpa-btn cpa-btn--sm"
                                                    onClick={() => setConfirmingUnlink(null)}
                                                >
                                                    Keep linked
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>

                    <p className="cpa-note">
                        <i className="fa-solid fa-circle-info" aria-hidden="true" />
                        <span>Linking a platform gives you its perks without switching accounts.</span>
                    </p>
                </section>

                {/* Public profile + sign out */}
                <section className="cpa-card" aria-labelledby={`${uid}-public`}>
                    <div className="cpa-head">
                        <div className="cpa-head__main">
                            <div className="cpa-icon" aria-hidden="true"><i className="fa-solid fa-share-nodes" /></div>
                            <div>
                                <h3 id={`${uid}-public`} className="ac-font cpa-title">Public profile</h3>
                                <p className="cpa-sub">Share your island standing</p>
                            </div>
                        </div>
                        <span className={`cpa-count ${passportData.isPublic ? "cpa-count--on" : ""}`}>
                            {passportData.isPublic ? "Public" : "Private"}
                        </span>
                    </div>

                    <div className="cpa-url">
                        <span className="cpa-url__label">Your link</span>
                        <code className="cpa-url__val">{publicUrl}</code>
                        <div className="cpa-url__actions">
                            <button type="button" className="cpa-btn cpa-btn--primary" onClick={handleCopy}>
                                <i className={`fa-solid ${linkCopied ? "fa-check" : "fa-copy"}`} aria-hidden="true" />
                                <span aria-live="polite">{linkCopied ? "Copied" : "Copy link"}</span>
                            </button>
                            <Link to={`/u/${publicSlug}`} target="_blank" rel="noopener noreferrer" className="cpa-btn">
                                Preview
                                <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" />
                                <span className="visually-hidden">(opens in a new tab)</span>
                            </Link>
                        </div>
                    </div>

                    <div className="cpa-signout">
                        {!confirmingSignOut ? (
                            <button
                                type="button"
                                className="cpa-btn cpa-btn--danger cpa-btn--block"
                                onClick={() => {
                                    playChimeClick();
                                    setConfirmingSignOut(true);
                                }}
                            >
                                <i className="fa-solid fa-arrow-right-from-bracket" aria-hidden="true" />
                                Sign out
                            </button>
                        ) : (
                            <div className="cpa-confirm" role="group" aria-label="Confirm sign out">
                                <p>Sign out of ChoPaeng on this device?</p>
                                <div className="cpa-confirm__actions">
                                    <button
                                        type="button"
                                        className="cpa-btn cpa-btn--sm cpa-btn--solid-danger"
                                        onClick={async () => {
                                            playChimeClick();
                                            await logout();
                                        }}
                                    >
                                        Yes, sign out
                                    </button>
                                    <button
                                        type="button"
                                        className="cpa-btn cpa-btn--sm"
                                        onClick={() => setConfirmingSignOut(false)}
                                    >
                                        Stay signed in
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
};

export default AccountInformationTab;