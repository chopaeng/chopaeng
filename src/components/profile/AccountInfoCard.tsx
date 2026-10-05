import React from "react";

interface AccountInfoCardProps {
    profileUser?: {
        id?: string;
        discord_name?: string;
        nickname?: string;
    } | null;
    authUser?: {
        username?: string;
        user_id?: string;
    } | null;
    rawDiscordName: string;
    subscriptionRoleNames: string[];
    handleOpenDiscordNickModal: () => void;
    prefNotice: string | null;
}

export const AccountInfoCard: React.FC<AccountInfoCardProps> = ({
    profileUser,
    authUser,
    rawDiscordName,
    subscriptionRoleNames,
    handleOpenDiscordNickModal,
    prefNotice,
}) => {
    return (
        <div className="pf-card">
            <div className="d-flex align-items-center gap-3 mb-3">
                <div className="icon-bubble bg-success bg-opacity-10 text-success" style={{ width: 40, height: 40, fontSize: "1.15rem" }}>
                    <i className="fa-solid fa-user-shield"></i>
                </div>
                <div>
                    <h2 className="h6 ac-font text-dark mb-0">Account Information</h2>
                    <span className="tiny-text text-muted">Discord &amp; Community Standing</span>
                </div>
            </div>

            {prefNotice && (
                <div className="alert alert-success rounded-3 py-2 px-3 small fw-bold mb-3 animate-fade d-flex align-items-center gap-2">
                    <i className="fa-solid fa-circle-check text-success flex-shrink-0"></i>
                    <span>{prefNotice}</span>
                </div>
            )}

            <div className="passport-field mb-3">
                <div className="tiny-text text-muted fw-bold text-uppercase tracking-wider mb-1">Active Discord Account</div>
                <div className="fw-bold text-dark font-monospace small d-flex align-items-center gap-2 p-2 bg-light rounded-2 border">
                    <i className="fa-brands fa-discord text-primary" style={{ fontSize: "1.05rem" }}></i>
                    <span className="text-truncate">{profileUser?.discord_name || authUser?.username}</span>
                </div>
            </div>

            <div className="passport-field mb-3">
                <div className="d-flex align-items-center justify-content-between mb-1">
                    <span className="tiny-text text-muted fw-bold text-uppercase tracking-wider">Discord Server Nickname</span>
                    <button
                        type="button"
                        onClick={() => handleOpenDiscordNickModal()}
                        className="btn btn-link p-0 tiny-text fw-bold text-primary text-decoration-none d-flex align-items-center gap-1"
                        title="Update nickname on ChoPaeng server"
                    >
                        <i className="fa-solid fa-pen"></i>
                        <span>Change</span>
                    </button>
                </div>
                <div className="fw-bold text-dark font-monospace small d-flex align-items-center justify-content-between p-2 px-3 bg-light rounded-3 border">
                    <div className="d-flex align-items-center gap-2 text-truncate me-2">
                        <i className="fa-solid fa-id-card text-muted"></i>
                        <span className="text-truncate">{profileUser?.nickname || rawDiscordName || "Not Set"}</span>
                    </div>
                    <span className="badge bg-primary bg-opacity-10 text-primary rounded-pill x-small fw-bold flex-shrink-0">
                        Server Nick
                    </span>
                </div>
            </div>

            <div className="passport-field mb-3">
                <div className="tiny-text text-muted fw-bold text-uppercase tracking-wider mb-1">Discord ID</div>
                <div className="tiny-text text-muted font-monospace p-2 bg-light rounded-2 border text-truncate">
                    {profileUser?.id || authUser?.user_id || "N/A"}
                </div>
            </div>

            <div className="passport-field mb-3">
                <div className="tiny-text text-muted fw-bold text-uppercase tracking-wider mb-1">Account Standing</div>
                <div className="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-3 py-1.5 fw-bold d-inline-flex align-items-center gap-1.5">
                    <i className="fa-solid fa-shield-check"></i>
                    <span>Good Standing • Verified Resident</span>
                </div>
            </div>

            <div className="passport-field mb-0">
                <div className="tiny-text text-muted fw-bold text-uppercase tracking-wider mb-1">Subscription Roles</div>
                <div className="d-flex flex-wrap gap-1 mt-1">
                    {subscriptionRoleNames.length > 0 ? (
                        subscriptionRoleNames.map((role) => (
                            <span key={role} className="badge bg-warning bg-opacity-10 text-dark border border-warning-subtle rounded-pill px-2.5 py-1 tiny-text fw-bold d-inline-flex align-items-center gap-1">
                                <i className="fa-solid fa-crown text-warning"></i>
                                <span>{role}</span>
                            </span>
                        ))
                    ) : (
                        <span className="tiny-text text-muted fst-italic">Free Community Member</span>
                    )}
                </div>
            </div>
        </div>
    );
};
