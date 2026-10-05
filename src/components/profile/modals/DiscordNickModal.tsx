import React from "react";

interface DiscordNickModalProps {
    isOpen: boolean;
    onClose: () => void;
    profileUser?: {
        avatar?: string;
        discord_name?: string;
    } | null;
    authUser?: {
        username?: string;
        avatar?: string;
    } | null;
    newDiscordNick: string;
    setNewDiscordNick: (val: string) => void;
    updatingNick: boolean;
    nickModalMessage: { type: string; text: string } | null;
    onSave: (e: React.FormEvent) => void;
}

export const DiscordNickModal: React.FC<DiscordNickModalProps> = ({
    isOpen,
    onClose,
    profileUser,
    authUser,
    newDiscordNick,
    setNewDiscordNick,
    updatingNick,
    nickModalMessage,
    onSave,
}) => {
    if (!isOpen) return null;

    return (
        <div
            className="modal show d-block"
            style={{
                backgroundColor: "rgba(0, 0, 0, 0.65)",
                zIndex: 1060,
                backdropFilter: "blur(4px)",
            }}
            tabIndex={-1}
            onClick={onClose}
        >
            <div
                className="modal-dialog modal-dialog-centered"
                style={{ maxWidth: "520px" }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="modal-content rounded-4 border-0 shadow-lg overflow-hidden animate-fade">
                    <div
                        className="modal-header text-white p-3 px-4"
                        style={{ background: "linear-gradient(135deg, #5865F2 0%, #4752C4 100%)" }}
                    >
                        <div className="d-flex align-items-center gap-2">
                            <div
                                className="icon-bubble bg-white bg-opacity-20 text-white"
                                style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: "50%",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <i className="fa-brands fa-discord"></i>
                            </div>
                            <div>
                                <h5 className="modal-title ac-font fw-bold mb-0 text-white">
                                    Update Discord Server Nickname
                                </h5>
                                <span className="tiny-text text-white text-opacity-75">
                                    Syncs directly to ChoPaeng Discord server
                                </span>
                            </div>
                        </div>
                        <button
                            type="button"
                            className="btn-close btn-close-white"
                            onClick={onClose}
                            aria-label="Close"
                        />
                    </div>

                    <form onSubmit={onSave}>
                        <div className="modal-body p-4">
                            {nickModalMessage && (
                                <div
                                    className={`alert alert-${nickModalMessage.type} p-3 rounded-3 small mb-3 animate-fade d-flex align-items-center gap-2`}
                                >
                                    <i
                                        className={`fa-solid ${
                                            nickModalMessage.type === "success"
                                                ? "fa-circle-check text-success"
                                                : "fa-circle-exclamation text-danger"
                                        } flex-shrink-0`}
                                    ></i>
                                    <span>{nickModalMessage.text}</span>
                                </div>
                            )}

                            {/* Discord Visual Preview Box */}
                            <label className="text-uppercase tiny-text fw-bold text-muted d-block mb-1">
                                Discord Member Preview
                            </label>
                            <div className="discord-chat-preview-box mb-3 d-flex align-items-center gap-3">
                                <img
                                    src={
                                        profileUser?.avatar ||
                                        authUser?.avatar ||
                                        "https://cdn.discordapp.com/embed/avatars/0.png"
                                    }
                                    alt="Avatar"
                                    className="discord-avatar-circle shadow-2xs"
                                />
                                <div className="overflow-hidden">
                                    <div className="d-flex align-items-center gap-2">
                                        <span className="discord-member-name text-truncate">
                                            {newDiscordNick.trim() ||
                                                profileUser?.discord_name ||
                                                authUser?.username ||
                                                "Resident"}
                                        </span>
                                        <span
                                            className="badge bg-secondary text-white tiny-text py-0 px-1"
                                            style={{ fontSize: "0.65rem" }}
                                        >
                                            MEMBER
                                        </span>
                                    </div>
                                    <span className="tiny-text text-secondary d-block">
                                        @{profileUser?.discord_name || authUser?.username}
                                    </span>
                                </div>
                            </div>

                            {/* Nickname Input Field */}
                            <div className="mb-3">
                                <div className="d-flex align-items-center justify-content-between mb-1">
                                    <label
                                        className="text-uppercase tiny-text fw-bold text-dark"
                                        htmlFor="discordNickInput"
                                    >
                                        Server Nickname
                                    </label>
                                    <span
                                        className={`tiny-text font-monospace ${
                                            newDiscordNick.length > 32 ? "text-danger fw-bold" : "text-muted"
                                        }`}
                                    >
                                        {newDiscordNick.length} / 32 chars
                                    </span>
                                </div>
                                <input
                                    id="discordNickInput"
                                    type="text"
                                    maxLength={32}
                                    className="form-control rounded-3 font-monospace fw-bold"
                                    placeholder="e.g. Character Name | Island Name"
                                    value={newDiscordNick}
                                    onChange={(e) => setNewDiscordNick(e.target.value)}
                                    required
                                    autoFocus
                                />
                                <span className="tiny-text text-muted d-block mt-1">
                                    <i className="fa-solid fa-circle-info me-1 text-primary"></i>
                                    Server standard format: <code>Character Name | Island Name</code>. Max 32 characters.
                                </span>
                            </div>
                        </div>

                        <div className="modal-footer border-top bg-light p-3 px-4 d-flex justify-content-between align-items-center">
                            <button
                                type="button"
                                className="btn btn-outline-secondary rounded-pill fw-bold px-4"
                                onClick={onClose}
                                disabled={updatingNick}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={updatingNick || !newDiscordNick.trim() || newDiscordNick.length > 32}
                                className="btn btn-primary fw-bold rounded-pill px-4 shadow-sm d-flex align-items-center gap-2"
                                style={{ backgroundColor: "#5865F2", borderColor: "#5865F2" }}
                            >
                                <i className={updatingNick ? "fa-solid fa-spinner fa-spin" : "fa-brands fa-discord"}></i>
                                <span>{updatingNick ? "Updating Discord..." : "Update on Discord"}</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};
