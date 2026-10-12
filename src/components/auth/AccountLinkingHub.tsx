import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { playChimeClick } from "../../utils/kkAudioSynthesizer";
import { getUserSubTiers } from "../../utils/subIslandAccess";

interface AccountLinkingHubProps {
    className?: string;
    showArchitectureDiagram?: boolean;
}

interface ProviderMeta {
    id: "youtube" | "patreon" | "twitch" | "discord";
    name: string;
    icon: string;
    color: string;
    bgColor: string;
    borderColor: string;
    tiers: string;
    description: string;
}

const PROVIDER_CONFIGS: ProviderMeta[] = [
    {
        id: "discord",
        name: "Discord",
        icon: "fa-brands fa-discord",
        color: "#5865F2",
        bgColor: "rgba(88, 101, 242, 0.06)",
        borderColor: "rgba(88, 101, 242, 0.25)",
        tiers: "Community Roles • Member Sub Access",
        description: "Server roles, community status, and member perks",
    },
    {
        id: "youtube",
        name: "YouTube",
        icon: "fa-brands fa-youtube",
        color: "#FF0000",
        bgColor: "rgba(255, 0, 0, 0.06)",
        borderColor: "rgba(255, 0, 0, 0.25)",
        tiers: "y ChoSoup • y ChoColate • y ChoTato",
        description: "Channel Membership badges and connected sub island tiers",
    },
    {
        id: "patreon",
        name: "Patreon",
        icon: "fa-brands fa-patreon",
        color: "#FF424D",
        bgColor: "rgba(255, 66, 77, 0.06)",
        borderColor: "rgba(255, 66, 77, 0.25)",
        tiers: "ChoSoup • ChoColate • ChoFries",
        description: "Direct membership tiers, priority drops and all 20 islands",
    },
    {
        id: "twitch",
        name: "Twitch",
        icon: "fa-brands fa-twitch",
        color: "#9146FF",
        bgColor: "rgba(145, 70, 255, 0.06)",
        borderColor: "rgba(145, 70, 255, 0.25)",
        tiers: "ChoTato Club (Subs & Prime Gaming)",
        description: "11 Core VIP islands, custom emotes and ChoBot access",
    },
];

export const AccountLinkingHub: React.FC<AccountLinkingHubProps> = ({
    className = "",
    showArchitectureDiagram = true,
}) => {
    const { user, loginWithProvider, unlinkProvider, openLoginModal } = useAuth();
    const [unlinkingProvider, setUnlinkingProvider] = useState<string | null>(null);
    const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const activeTiers = getUserSubTiers(user);
    const hasActiveSubscription = activeTiers.length > 0 || !!(user?.is_admin || user?.is_mod);

    // Compute highest entitlement tier
    const resolvedTier = React.useMemo(() => {
        if (user?.is_admin) return { name: "ChoPaeng Administrator", level: 3, islands: 20, badge: "STAFF" };
        if (user?.is_mod) return { name: "ChoPaeng Moderator", level: 3, islands: 20, badge: "STAFF" };

        const tierNamesLower = activeTiers.map((t) => t.toLowerCase());
        if (tierNamesLower.some((t) => t.includes("chosoup"))) {
            return { name: "Tier 3 • ChoSoup VIP", level: 3, islands: 20, badge: "TIER 3" };
        }
        if (tierNamesLower.some((t) => t.includes("chocolate"))) {
            return { name: "Tier 2 • ChoColate VIP", level: 2, islands: 15, badge: "TIER 2" };
        }
        if (tierNamesLower.some((t) => t.includes("chotato") || t.includes("chofries"))) {
            return { name: "Tier 1 • ChoTato Club / VIP", level: 1, islands: 11, badge: "TIER 1" };
        }
        return { name: "Standard Resident Pass", level: 0, islands: 0, badge: "FREE" };
    }, [activeTiers, user]);

    const handleLink = (provider: "youtube" | "patreon" | "twitch" | "discord") => {
        playChimeClick();
        loginWithProvider(provider);
    };

    const handleUnlink = async (provider: string, provName: string) => {
        playChimeClick();
        if (!window.confirm(`Are you sure you want to unlink your ${provName} account? Any associated sub island perks will remain until sync updates.`)) {
            return;
        }
        setUnlinkingProvider(provider);
        try {
            const ok = await unlinkProvider(provider);
            if (ok) {
                setNotice({ type: "success", text: `Successfully unlinked ${provName} from your ChoPaeng account.` });
            } else {
                setNotice({ type: "error", text: `Failed to unlink ${provName}. Please try again.` });
            }
        } catch {
            setNotice({ type: "error", text: `An error occurred while unlinking ${provName}.` });
        } finally {
            setUnlinkingProvider(null);
            setTimeout(() => setNotice(null), 5000);
        }
    };

    return (
        <section className={`cpg-linking-hub ${className}`} aria-label="Account Linking Hub">
            <style>{`
                .cpg-hub-card {
                    background: #ffffff;
                    border: 2px solid #e2ede5;
                    border-radius: 24px;
                    padding: 1.5rem;
                    box-shadow: 0 10px 30px -15px rgba(29, 51, 40, 0.12);
                    position: relative;
                }
                .cpg-hub-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.4rem;
                    font-size: 0.76rem;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    padding: 0.25rem 0.65rem;
                    border-radius: 999px;
                }
                .cpg-provider-box {
                    border-radius: 18px;
                    padding: 1.15rem;
                    transition: transform 0.15s ease, box-shadow 0.15s ease;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                }
                .cpg-provider-box:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 24px -10px rgba(0, 0, 0, 0.12);
                }
                .cpg-arch-pillar {
                    background: #fdfbf7;
                    border: 1.5px solid #eae2d5;
                    border-radius: 18px;
                    padding: 1.25rem;
                    height: 100%;
                }
                .cpg-arch-num {
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    display: grid;
                    place-items: center;
                    background: #2ea75c;
                    color: #fff;
                    font-weight: 800;
                    font-size: 0.9rem;
                    margin-bottom: 0.75rem;
                }
            `}</style>

            {/* Resident Identity & Entitlement Header Card */}
            <div className="cpg-hub-card mb-4">
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3 pb-3 border-bottom">
                    <div className="d-flex align-items-center gap-3">
                        <div
                            style={{
                                width: 54,
                                height: 54,
                                borderRadius: "50%",
                                background: "#e8f5ec",
                                border: "2px solid #2ea75c",
                                display: "grid",
                                placeItems: "center",
                                fontSize: "1.45rem",
                                color: "#2ea75c",
                            }}
                        >
                            <i className={user ? "fa-solid fa-passport" : "fa-solid fa-user-plus"} />
                        </div>
                        <div>
                            <div className="d-flex align-items-center gap-2 flex-wrap">
                                <span className="cpg-hub-badge bg-success bg-opacity-10 text-success">
                                    <i className="fa-solid fa-leaf" /> Primary Identity
                                </span>
                                {user && (
                                    <span className={`cpg-hub-badge ${hasActiveSubscription ? "bg-warning text-dark fw-bold" : "bg-light text-muted border"}`}>
                                        {resolvedTier.badge}
                                    </span>
                                )}
                            </div>
                            <h2 className="ac-font h5 mb-0 mt-1 text-dark">
                                {user ? (user.username || user.discord_name || "ChoPaeng Resident") : "Resident Identity Portal"}
                            </h2>
                            <p className="small text-muted mb-0">
                                {user ? (user.email ? user.email : `User ID: ${user.user_id}`) : "Sign in or register to link your YouTube, Patreon, and Twitch accounts."}
                            </p>
                        </div>
                    </div>

                    <div>
                        {user ? (
                            <div className="text-end">
                                <div className="small text-muted fw-bold mb-1">Entitlement Status</div>
                                <div className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-3 py-2 rounded-pill fw-bold">
                                    <i className="fa-solid fa-shield-halved me-1" />
                                    {resolvedTier.name}
                                </div>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => {
                                    playChimeClick();
                                    openLoginModal();
                                }}
                                className="btn btn-nook text-white fw-bold px-4 py-2 rounded-pill shadow-sm d-inline-flex align-items-center gap-2"
                            >
                                <i className="fa-solid fa-right-to-bracket" />
                                <span>Resident Sign In / Register</span>
                            </button>
                        )}
                    </div>
                </div>

                {notice && (
                    <div className={`alert ${notice.type === "success" ? "alert-success" : "alert-danger"} py-2 px-3 small fw-bold rounded-3 mb-3 d-flex align-items-center gap-2`}>
                        <i className={`fa-solid ${notice.type === "success" ? "fa-circle-check" : "fa-circle-exclamation"}`} />
                        <span>{notice.text}</span>
                    </div>
                )}

                {/* Unified Entitlement Engine (UEE) Access Banner */}
                {user && (
                    <div
                        className="p-3 rounded-4 mb-4"
                        style={{
                            background: resolvedTier.level > 0 ? "linear-gradient(135deg, #eef9f2 0%, #f4fbf7 100%)" : "#f8faf9",
                            border: `1.5px dashed ${resolvedTier.level > 0 ? "#2ea75c" : "#ccdcd0"}`,
                        }}
                    >
                        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
                            <div className="d-flex align-items-center gap-3">
                                <div
                                    style={{
                                        width: 44,
                                        height: 44,
                                        borderRadius: "50%",
                                        background: resolvedTier.level > 0 ? "#2ea75c" : "#e0eade",
                                        color: resolvedTier.level > 0 ? "#fff" : "#576b5d",
                                        display: "grid",
                                        placeItems: "center",
                                        fontSize: "1.2rem",
                                    }}
                                >
                                    <i className={resolvedTier.level > 0 ? "fa-solid fa-crown" : "fa-solid fa-umbrella-beach"} />
                                </div>
                                <div>
                                    <div className="fw-bold text-dark">
                                        Unified Entitlement Engine (UEE): <span className="text-success">{resolvedTier.name}</span>
                                    </div>
                                    <p className="small text-muted mb-0">
                                        {resolvedTier.level > 0
                                            ? `Calculated from your linked memberships. Unlocks ${resolvedTier.islands} Sub Islands, Drop Bot privileges, and villager injections!`
                                            : "Connect your YouTube, Patreon, or Twitch membership below to automatically activate VIP island passes."}
                                    </p>
                                </div>
                            </div>
                            <div className="d-flex align-items-center gap-2">
                                <Link to="/membership-tiers" className="btn btn-sm btn-outline-success rounded-pill fw-bold px-3">
                                    <i className="fa-solid fa-table-cells me-1" /> View 20 Island Matrix
                                </Link>
                                <Link to="/islands" className="btn btn-sm btn-success rounded-pill fw-bold px-3 text-white">
                                    <i className="fa-solid fa-plane-departure me-1" /> Visit Sub Islands
                                </Link>
                            </div>
                        </div>
                    </div>
                )}

                {/* OAuth 2.0 Account Linking Hub (3 Platform Cards) */}
                <div>
                    <div className="d-flex align-items-center justify-content-between mb-3">
                        <div>
                            <h3 className="ac-font h6 text-dark mb-0">
                                <i className="fa-solid fa-link text-success me-2" />
                                OAuth 2.0 Account Linking Hub
                            </h3>
                            <p className="small text-muted mb-0">
                                Connect multiple streaming &amp; patron platforms directly to your ChoPaeng resident account.
                            </p>
                        </div>
                        <span className="small text-muted fw-bold">
                            {user?.connected_providers?.length || 0} Connected
                        </span>
                    </div>

                    <div className="row g-3">
                        {PROVIDER_CONFIGS.map((prov) => {
                            const isLinked = Boolean(
                                user?.connected_providers?.includes(prov.id) ||
                                (user?.connected_accounts && user.connected_accounts[prov.id]) ||
                                user?.provider === prov.id
                            );

                            const accountDetail = user?.connected_accounts?.[prov.id];
                            const linkedName = accountDetail?.username || accountDetail?.name || (user?.provider === prov.id ? user?.username : null);
                            const linkedTier = accountDetail?.sub_tier;

                            return (
                                <div key={prov.id} className="col-12 col-md-6 col-lg-3">
                                    <div
                                        className="cpg-provider-box h-100"
                                        style={{
                                            background: isLinked ? "#ffffff" : prov.bgColor,
                                            border: `1.5px solid ${isLinked ? "#2ea75c" : prov.borderColor}`,
                                        }}
                                    >
                                        <div>
                                            <div className="d-flex align-items-center justify-content-between mb-2">
                                                <div className="d-flex align-items-center gap-2">
                                                    <i className={`${prov.icon}`} style={{ fontSize: "1.3rem", color: prov.color }} />
                                                    <span className="fw-bold text-dark">{prov.name}</span>
                                                </div>
                                                {isLinked ? (
                                                    <span className="badge bg-success bg-opacity-10 text-success rounded-pill px-2.5 py-1 small fw-bold">
                                                        <i className="fa-solid fa-check me-1" /> Connected
                                                    </span>
                                                ) : (
                                                    <span className="badge bg-light text-muted border rounded-pill px-2.5 py-1 small fw-bold">
                                                        Not Linked
                                                    </span>
                                                )}
                                            </div>

                                            <p className="small text-muted mb-2" style={{ minHeight: "2.4rem" }}>
                                                {prov.description}
                                            </p>

                                            <div className="p-2 rounded-3 bg-white bg-opacity-75 border mb-3 small">
                                                <div className="text-muted fw-bold x-small text-uppercase">Supported Tiers</div>
                                                <div className="fw-bold text-dark font-monospace" style={{ fontSize: "0.78rem" }}>
                                                    {prov.tiers}
                                                </div>
                                            </div>

                                            {isLinked && linkedName && (
                                                <div className="small text-muted mb-3 d-flex align-items-center gap-1">
                                                    <i className="fa-solid fa-user-check text-success" />
                                                    <span>Linked as: <strong className="text-dark">{linkedName}</strong></span>
                                                    {linkedTier && <span className="badge bg-success text-white ms-auto">{linkedTier}</span>}
                                                </div>
                                            )}
                                        </div>

                                        <div>
                                            {user ? (
                                                isLinked ? (
                                                    <button
                                                        type="button"
                                                        disabled={unlinkingProvider === prov.id}
                                                        onClick={() => handleUnlink(prov.id, prov.name)}
                                                        className="btn btn-sm btn-outline-danger w-100 rounded-pill fw-bold py-1.5"
                                                    >
                                                        {unlinkingProvider === prov.id ? (
                                                            <span><i className="fa-solid fa-spinner fa-spin me-1" /> Unlinking...</span>
                                                        ) : (
                                                            <span><i className="fa-solid fa-link-slash me-1" /> Unlink Account</span>
                                                        )}
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleLink(prov.id)}
                                                        className="btn btn-sm w-100 rounded-pill fw-bold text-white py-1.5 shadow-sm"
                                                        style={{ background: prov.color }}
                                                    >
                                                        <i className="fa-solid fa-link me-1" /> Link {prov.name}
                                                    </button>
                                                )
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        playChimeClick();
                                                        openLoginModal();
                                                    }}
                                                    className="btn btn-sm btn-outline-secondary w-100 rounded-pill fw-bold py-1.5"
                                                >
                                                    <i className="fa-solid fa-lock me-1" /> Sign in to link
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Architecture Overview Flowchart Card */}
            {showArchitectureDiagram && (
                <div className="cpg-hub-card">
                    <div className="text-center max-w-700 mx-auto mb-4">
                        <span className="cpg-hub-badge bg-primary bg-opacity-10 text-primary mb-2">
                            <i className="fa-solid fa-diagram-project" /> Unified Architecture
                        </span>
                        <h2 className="ac-font h4 text-dark mb-1">How ChoPaeng Account Linking Works</h2>
                        <p className="small text-muted mb-0">
                            One primary account connects all your memberships to calculate permissions across our 20 private sub islands.
                        </p>
                    </div>

                    <div className="row g-3 text-start">
                        <div className="col-12 col-md-4">
                            <div className="cpg-arch-pillar">
                                <div className="cpg-arch-num">1</div>
                                <h3 className="ac-font h6 text-dark mb-1">ChoPaeng Account</h3>
                                <p className="small text-muted mb-2">
                                    Your central resident identity. Sign in with your native email and password to secure carts, orders, and flight passes.
                                </p>
                                <ul className="list-unstyled small text-muted mb-0 d-flex flex-column gap-1">
                                    <li><i className="fa-solid fa-check text-success me-1.5" /> Email &amp; Password Login</li>
                                    <li><i className="fa-solid fa-check text-success me-1.5" /> Native Cart &amp; Wishlist</li>
                                    <li><i className="fa-solid fa-check text-success me-1.5" /> Persistent In-game Passports</li>
                                </ul>
                            </div>
                        </div>

                        <div className="col-12 col-md-4">
                            <div className="cpg-arch-pillar">
                                <div className="cpg-arch-num" style={{ background: "#8854d0" }}>2</div>
                                <h3 className="ac-font h6 text-dark mb-1">OAuth 2.0 Linking Hub</h3>
                                <p className="small text-muted mb-2">
                                    Link your YouTube Channel, Patreon Tier, and Twitch Subscription simultaneously under one unified identity.
                                </p>
                                <ul className="list-unstyled small text-muted mb-0 d-flex flex-column gap-1">
                                    <li><i className="fa-brands fa-youtube text-danger me-1.5" /> YouTube Memberships</li>
                                    <li><i className="fa-brands fa-patreon text-warning me-1.5" /> Patreon Subscriptions</li>
                                    <li><i className="fa-brands fa-twitch text-purple me-1.5" /> Twitch Subs &amp; Prime Gaming</li>
                                </ul>
                            </div>
                        </div>

                        <div className="col-12 col-md-4">
                            <div className="cpg-arch-pillar">
                                <div className="cpg-arch-num" style={{ background: "#fa8231" }}>3</div>
                                <h3 className="ac-font h6 text-dark mb-1">Unified Entitlement Engine</h3>
                                <p className="small text-muted mb-2">
                                    The UEE aggregates all linked accounts, resolves your highest tier, and activates real-time access.
                                </p>
                                <ul className="list-unstyled small text-muted mb-0 d-flex flex-column gap-1">
                                    <li><i className="fa-solid fa-umbrella-beach text-success me-1.5" /> 20 VIP Sub Island Dodos</li>
                                    <li><i className="fa-solid fa-box-open text-primary me-1.5" /> Priority Drop Bot Queue</li>
                                    <li><i className="fa-solid fa-paw text-warning me-1.5" /> SysBot Villager Injections</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 pt-3 border-top text-center d-flex flex-wrap align-items-center justify-content-center gap-2">
                        <Link to="/membership-tiers" className="btn btn-sm btn-nook text-white fw-bold px-3 py-1.5 rounded-pill">
                            <i className="fa-solid fa-table-cells me-1" /> Island Tier Permissions Matrix
                        </Link>
                        <Link to="/drop-bot" className="btn btn-sm btn-outline-secondary fw-bold px-3 py-1.5 rounded-pill">
                            <i className="fa-solid fa-robot me-1" /> Drop Bot Portal
                        </Link>
                        <Link to="/islands" className="btn btn-sm btn-outline-secondary fw-bold px-3 py-1.5 rounded-pill">
                            <i className="fa-solid fa-compass me-1" /> Browse Treasure Islands
                        </Link>
                    </div>
                </div>
            )}
        </section>
    );
};

export default AccountLinkingHub;
