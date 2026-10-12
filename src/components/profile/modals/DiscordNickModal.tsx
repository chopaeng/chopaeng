import React, { useEffect, useRef } from "react";

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
    const modalRef = useRef<HTMLDivElement | null>(null);
    const previousActiveElementRef = useRef<HTMLElement | null>(null);
    const onCloseRef = useRef(onClose);

    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        if (!isOpen) return;

        previousActiveElementRef.current = document.activeElement as HTMLElement | null;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        const timer = setTimeout(() => {
            const input = modalRef.current?.querySelector<HTMLInputElement>("input#discordNickInput");
            input?.focus();
        }, 50);

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault();
                onCloseRef.current();
                return;
            }

            if (e.key === "Tab" && modalRef.current) {
                const focusable = modalRef.current.querySelectorAll<HTMLElement>(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                );
                if (focusable.length === 0) return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];

                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            clearTimeout(timer);
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", handleKeyDown);
            if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === "function") {
                previousActiveElementRef.current.focus();
            }
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div
            className="modal show d-block"
            style={{
                backgroundColor: "rgba(29, 51, 40, 0.65)",
                zIndex: 1060,
                backdropFilter: "blur(4px)",
            }}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="discord-nick-modal-title"
            onClick={onClose}
        >
            <div
                ref={modalRef}
                className="modal-dialog modal-dialog-centered"
                style={{ maxWidth: "520px" }}
                onClick={(e) => e.stopPropagation()}
            >
                <div
                    className="modal-content border-0 overflow-hidden"
                    style={{
                        borderRadius: "26px",
                        boxShadow: "0 20px 45px -12px rgba(29, 51, 40, 0.35)",
                    }}
                >
                    <div
                        className="modal-header text-white p-3 px-4"
                        style={{ background: "#5865F2" }}
                    >
                        <div className="d-flex align-items-center gap-2">
                            <div
                                style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: "50%",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    background: "rgba(255, 255, 255, 0.2)",
                                }}
                                aria-hidden="true"
                            >
                                <i className="fa-brands fa-discord" />
                            </div>
                            <div>
                                <h2 id="discord-nick-modal-title" className="h6 ac-font fw-bold mb-0 text-white">
                                    Update Discord server nickname
                                </h2>
                                <span style={{ fontSize: "0.78rem", color: "rgba(255, 255, 255, 0.85)" }}>
                                    Syncs directly to ChoPaeng Discord server
                                </span>
                            </div>
                        </div>
                        <button
                            type="button"
                            className="btn-close btn-close-white"
                            onClick={onClose}
                            aria-label="Close dialog"
                        />
                    </div>

                    <form onSubmit={onSave}>
                        <div className="p-4" style={{ background: "#fff" }}>
                            {nickModalMessage && (
                                <div
                                    className={`alert alert-${nickModalMessage.type} p-3 rounded-3 small mb-3 d-flex align-items-center gap-2`}
                                    role="alert"
                                >
                                    <i
                                        className={`fa-solid ${
                                            nickModalMessage.type === "success"
                                                ? "fa-circle-check text-success"
                                                : "fa-circle-exclamation text-danger"
                                        } flex-shrink-0`}
                                        aria-hidden="true"
                                    />
                                    <span>{nickModalMessage.text}</span>
                                </div>
                            )}

                            {/* Discord Member Preview */}
                            <label className="small fw-bold d-block mb-1" style={{ color: "#1d3328" }}>
                                Discord member preview
                            </label>
                            <div
                                className="mb-3 d-flex align-items-center gap-3 p-3 rounded-3 border"
                                style={{ background: "#f8f9fa", borderColor: "#cfdcd3" }}
                            >
                                <img
                                    src={
                                        profileUser?.avatar ||
                                        authUser?.avatar ||
                                        "https://cdn.discordapp.com/embed/avatars/0.png"
                                    }
                                    alt="Avatar"
                                    style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover" }}
                                />
                                <div className="overflow-hidden">
                                    <div className="d-flex align-items-center gap-2">
                                        <span className="text-truncate fw-bold" style={{ color: "#1d3328" }}>
                                            {newDiscordNick.trim() ||
                                                profileUser?.discord_name ||
                                                authUser?.username ||
                                                "Resident"}
                                        </span>
                                        <span
                                            className="badge bg-secondary text-white py-0 px-1"
                                            style={{ fontSize: "0.65rem" }}
                                        >
                                            Member
                                        </span>
                                    </div>
                                    <span style={{ fontSize: "0.78rem", color: "#5b6e63" }}>
                                        @{profileUser?.discord_name || authUser?.username}
                                    </span>
                                </div>
                            </div>

                            {/* Nickname Input Field */}
                            <div className="mb-3">
                                <div className="d-flex align-items-center justify-content-between mb-1">
                                    <label
                                        className="small fw-bold mb-0"
                                        htmlFor="discordNickInput"
                                        style={{ color: "#1d3328" }}
                                    >
                                        Server nickname
                                    </label>
                                    <span
                                        className={`font-monospace ${
                                            newDiscordNick.length > 32 ? "text-danger fw-bold" : "text-muted"
                                        }`}
                                        style={{ fontSize: "0.78rem" }}
                                    >
                                        {newDiscordNick.length} / 32 characters
                                    </span>
                                </div>
                                <input
                                    id="discordNickInput"
                                    type="text"
                                    maxLength={32}
                                    className="form-control"
                                    style={{
                                        borderRadius: "14px",
                                        border: "1.5px solid #cfdcd3",
                                    }}
                                    placeholder="e.g. Character Name | Island Name"
                                    value={newDiscordNick}
                                    onChange={(e) => setNewDiscordNick(e.target.value)}
                                    required
                                    autoFocus
                                />
                                <span className="d-block mt-1" style={{ fontSize: "0.78rem", color: "#5b6e63" }}>
                                    <i className="fa-solid fa-circle-info me-1 text-primary" aria-hidden="true" />
                                    Server standard format: <code>Character Name | Island Name</code> (max 32 characters).
                                </span>
                            </div>
                        </div>

                        <div
                            className="p-3 px-4 d-flex justify-content-end align-items-center gap-2 border-top"
                            style={{ background: "#f6faf7", borderColor: "#cfdcd3" }}
                        >
                            <button
                                type="button"
                                className="btn fw-bold px-3 py-2 small"
                                style={{
                                    borderRadius: "14px",
                                    border: "1.5px solid #cfdcd3",
                                    background: "#fff",
                                    color: "#1d3328",
                                }}
                                onClick={onClose}
                                disabled={updatingNick}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={updatingNick || !newDiscordNick.trim() || newDiscordNick.length > 32}
                                className="btn fw-bold px-4 py-2 small text-white d-flex align-items-center gap-2"
                                style={{
                                    borderRadius: "14px",
                                    backgroundColor: "#5865F2",
                                    borderColor: "#5865F2",
                                    boxShadow: "0 4px 0 #4752C4",
                                }}
                            >
                                <i className={updatingNick ? "fa-solid fa-spinner fa-spin" : "fa-brands fa-discord"} aria-hidden="true" />
                                <span>{updatingNick ? "Updating Discord…" : "Update on Discord"}</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};
