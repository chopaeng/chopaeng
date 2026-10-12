import React from "react";
import { useAuth } from "../../context/useAuth";

interface AccountInfoCardProps {
    profileUser?: {
        id?: string;
        discord_name?: string;
        nickname?: string;
    } | null;
    authUser?: {
        username?: string;
        user_id?: string;
        provider?: string;
        sub_tier?: string | null;
        connected_providers?: string[];
        connected_accounts?: Record<string, any>;
    } | null;
    subscriptionRoleNames: string[];
    prefNotice: string | null;
}

export const AccountInfoCard: React.FC<AccountInfoCardProps> = ({
    profileUser,
    authUser,
    subscriptionRoleNames,
    prefNotice,
}) => {
    const { loginWithProvider, unlinkProvider } = useAuth();
    const [unlinking, setUnlinking] = React.useState<string | null>(null);
    const provider = authUser?.provider || "Resident";
    const subTier = authUser?.sub_tier || (subscriptionRoleNames.length > 0 ? subscriptionRoleNames[0] : null);

    return (
        <div className="pf-card">
            <div className="d-flex align-items-center gap-3 mb-3">
                <div className="icon-bubble bg-success bg-opacity-10 text-success" style={{ width: 40, height: 40, fontSize: "1.15rem" }}>
                    <i className="fa-solid fa-user-shield"></i>
                </div>
                <div>
                    <h2 className="h6 ac-font text-dark mb-0">Account Information</h2>
                    <span className="tiny-text text-muted">Membership &amp; Resident Standing</span>
                </div>
            </div>

            {prefNotice && (
                <div className="alert alert-success rounded-3 py-2 px-3 small fw-bold mb-3 animate-fade d-flex align-items-center gap-2">
                    <i className="fa-solid fa-circle-check text-success flex-shrink-0"></i>
                    <span>{prefNotice}</span>
                </div>
            )}

            {/* Active Membership Account */}
            <div className="passport-field mb-3">
                <div className="tiny-text text-muted fw-bold text-uppercase tracking-wider mb-1">Authenticated Account</div>
                <div className="fw-bold text-dark font-monospace small d-flex align-items-center justify-content-between p-2.5 bg-light rounded-3 border">
                    <div className="d-flex align-items-center gap-2 text-truncate">
                        <i className={`fa-brands ${
                            provider === "discord" ? "fa-discord text-primary" :
                            provider === "twitch" ? "fa-twitch text-purple" :
                            provider === "youtube" ? "fa-youtube text-danger" :
                            provider === "patreon" ? "fa-patreon text-warning" : "fa-passport text-success"
                        }`} style={{ fontSize: "1.05rem" }}></i>
                        <span className="text-truncate">{authUser?.username || profileUser?.discord_name}</span>
                    </div>
                    <span className="badge bg-dark rounded-pill x-small fw-bold text-uppercase">
                        {provider}
                    </span>
                </div>
            </div>

            {/* Active Tier */}
            <div className="passport-field mb-3">
                <div className="tiny-text text-muted fw-bold text-uppercase tracking-wider mb-1">Subscriber Status</div>
                <div className="fw-bold text-dark font-monospace small d-flex align-items-center justify-content-between p-2.5 bg-light rounded-3 border">
                    <div className="d-flex align-items-center gap-2">
                        <i className={`fa-solid ${subTier ? "fa-crown text-warning" : "fa-leaf text-success"}`}></i>
                        <span>{subTier || "Standard Resident"}</span>
                    </div>
                    <span className={`badge rounded-pill x-small fw-bold ${subTier ? "bg-warning text-dark" : "bg-light text-muted border"}`}>
                        {subTier ? "VIP" : "FREE"}
                    </span>
                </div>
            </div>

            {/* OAuth 2.0 Account Linking Hub */}
            <div className="passport-field pt-2 border-top">
                <div className="d-flex align-items-center justify-content-between mb-2">
                    <div className="tiny-text text-muted fw-bold text-uppercase tracking-wider">OAuth 2.0 Linked Platforms</div>
                    <span className="badge bg-light text-muted border rounded-pill x-small">
                        {authUser?.connected_providers?.length || 0} Connected
                    </span>
                </div>
                <div className="d-flex flex-column gap-2">
                    {[
                        { id: "discord", name: "Discord", icon: "fa-brands fa-discord", color: "#5865F2" },
                        { id: "youtube", name: "YouTube Member", icon: "fa-brands fa-youtube", color: "#FF0000" },
                        { id: "patreon", name: "Patreon Tier", icon: "fa-brands fa-patreon", color: "#FF424D" },
                        { id: "twitch", name: "Twitch (ChoTato Club)", icon: "fa-brands fa-twitch", color: "#9146FF" },
                    ].map((prov) => {
                        const isConnected = Boolean(
                            authUser?.connected_providers?.includes(prov.id) ||
                            (authUser?.connected_accounts && authUser.connected_accounts[prov.id]) ||
                            authUser?.provider === prov.id
                        );
                        const detail = authUser?.connected_accounts?.[prov.id];
                        const name = detail?.username || detail?.name;

                        return (
                            <div
                                key={prov.id}
                                className={`p-2 rounded-3 border d-flex align-items-center justify-content-between gap-2 ${
                                    isConnected ? "bg-white border-success" : "bg-light"
                                }`}
                                style={{ fontSize: "0.82rem" }}
                            >
                                <div className="d-flex align-items-center gap-2 text-truncate">
                                    <i className={prov.icon} style={{ color: prov.color, fontSize: "1rem" }} />
                                    <div className="text-truncate">
                                        <div className="fw-bold text-dark text-truncate">{prov.name}</div>
                                        {isConnected && name && (
                                            <div className="x-small text-muted text-truncate">Linked: {name}</div>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    {isConnected ? (
                                        <button
                                            type="button"
                                            disabled={unlinking === prov.id}
                                            onClick={async () => {
                                                if (window.confirm(`Unlink ${prov.name}?`)) {
                                                    setUnlinking(prov.id);
                                                    try {
                                                        await unlinkProvider(prov.id);
                                                    } finally {
                                                        setUnlinking(null);
                                                    }
                                                }
                                            }}
                                            className="btn btn-outline-danger btn-sm rounded-pill py-0.5 px-2 fw-bold"
                                            style={{ fontSize: "0.72rem" }}
                                            title="Unlink Platform"
                                        >
                                            {unlinking === prov.id ? <i className="fa-solid fa-spinner fa-spin" /> : "Unlink"}
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => loginWithProvider(prov.id as any)}
                                            className="btn btn-outline-secondary btn-sm rounded-pill py-0.5 px-2 fw-bold"
                                            style={{ fontSize: "0.72rem" }}
                                        >
                                            <i className="fa-solid fa-link me-1" /> Connect
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
