import React, { useEffect, useRef } from "react";
import { parseDiscordNicknameToCharacters } from "../../../utils/characterParser";
import { playChimeClick } from "../../../utils/kkAudioSynthesizer";

interface SyncDiscordModalProps {
    isOpen: boolean;
    onClose: () => void;
    rawDiscordName: string;
    charactersCount: number;
    syncFromDiscordNickname: (nick: string) => number;
    setPrefNotice: (msg: string | null) => void;
}

export const SyncDiscordModal: React.FC<SyncDiscordModalProps> = ({
    isOpen,
    onClose,
    rawDiscordName,
    charactersCount,
    syncFromDiscordNickname,
    setPrefNotice,
}) => {
    const modalRef = useRef<HTMLDivElement | null>(null);
    const previousActiveElementRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (!isOpen) return;

        previousActiveElementRef.current = document.activeElement as HTMLElement | null;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault();
                onClose();
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
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", handleKeyDown);
            if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === "function") {
                previousActiveElementRef.current.focus();
            }
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const parsed = parseDiscordNicknameToCharacters(rawDiscordName);
    const hasParsed = parsed.length > 0;

    const handleConfirm = () => {
        const count = syncFromDiscordNickname(rawDiscordName);
        onClose();
        setPrefNotice(
            count > 0
                ? `Synced ${count} character slot${count > 1 ? "s" : ""} from Discord ("${rawDiscordName}")!`
                : `No IGN/Island pattern detected in "${rawDiscordName}".`
        );
        setTimeout(() => setPrefNotice(null), 3500);
        playChimeClick();
    };

    return (
        <div
            className="modal show d-block"
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="sync-discord-modal-title"
            style={{
                backgroundColor: "rgba(29, 51, 40, 0.65)",
                zIndex: 1060,
                backdropFilter: "blur(4px)",
            }}
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
                        className="py-3 px-4 d-flex align-items-center justify-content-between"
                        style={{ background: "#d97706", color: "#fff" }}
                    >
                        <div className="d-flex align-items-center gap-2">
                            <span
                                className="rounded-circle d-flex align-items-center justify-content-center"
                                style={{
                                    width: 34,
                                    height: 34,
                                    background: "rgba(255, 255, 255, 0.2)",
                                    border: "2px dashed rgba(255, 255, 255, 0.6)",
                                    color: "#fff",
                                }}
                                aria-hidden="true"
                            >
                                <i className="fa-solid fa-triangle-exclamation" />
                            </span>
                            <h2 id="sync-discord-modal-title" className="h6 ac-font fw-bold mb-0 text-white">
                                Sync from Discord warning
                            </h2>
                        </div>
                        <button
                            type="button"
                            className="btn-close btn-close-white"
                            onClick={onClose}
                            aria-label="Close dialog"
                        />
                    </div>

                    <div className="p-4" style={{ background: "#fff" }}>
                        {/* Warning Notice Box */}
                        <div
                            className="p-3 rounded-3 mb-3 border"
                            style={{ background: "#fffbeb", borderColor: "#fde68a" }}
                            role="alert"
                        >
                            <div className="d-flex gap-2 align-items-start">
                                <i className="fa-solid fa-triangle-exclamation text-warning mt-1 flex-shrink-0" aria-hidden="true" />
                                <div className="small text-dark">
                                    <strong className="d-block mb-1">Overwriting saved character slots</strong>
                                    Syncing from Discord will replace and overwrite your current saved character slots ({charactersCount} configured) with the in-game names parsed from your Discord nickname.
                                </div>
                            </div>
                        </div>

                        <div className="mb-3">
                            <label className="small fw-bold d-block mb-1" style={{ color: "#1d3328" }}>
                                Current Discord nickname
                            </label>
                            <div
                                className="p-2 px-3 rounded-3 font-monospace small border fw-bold"
                                style={{ background: "#f8f9fa", borderColor: "#cfdcd3", color: "#5865F2" }}
                            >
                                <i className="fa-brands fa-discord me-2" aria-hidden="true" />
                                {rawDiscordName}
                            </div>
                        </div>

                        {/* Preview of Parsed Characters */}
                        <div className="mb-3">
                            <label className="small fw-bold d-block mb-1" style={{ color: "#1d3328" }}>
                                Parsed characters to import
                            </label>
                            {!hasParsed ? (
                                <div
                                    className="p-3 rounded-3 small border"
                                    style={{ background: "#fee2e2", borderColor: "#fecaca", color: "#991b1b" }}
                                    role="alert"
                                >
                                    <i className="fa-solid fa-circle-exclamation me-1" aria-hidden="true" />
                                    No IGN / Island Name pattern detected in <code>"{rawDiscordName}"</code>.
                                    <div className="mt-1" style={{ fontSize: "0.78rem", color: "#7f1d1d" }}>
                                        Expected format: <code>IGN / Island Name</code> or <code>IGN1 / Island1 | IGN2 / Island2</code>.
                                    </div>
                                </div>
                            ) : (
                                <div className="d-flex flex-column gap-2">
                                    {parsed.slice(0, 3).map((p, idx) => (
                                        <div
                                            key={idx}
                                            className="d-flex align-items-center justify-content-between p-2 px-3 rounded-3 border"
                                            style={{ background: "#f6faf7", borderColor: "#b7dfc8" }}
                                        >
                                            <div className="d-flex align-items-center gap-2">
                                                <span
                                                    className="badge rounded-pill px-2 py-0.5"
                                                    style={{ background: "#e6f4ec", color: "#166b3a", fontSize: "0.74rem" }}
                                                >
                                                    Slot #{idx + 1}
                                                </span>
                                                <strong className="text-dark small">{p.ign}</strong>
                                                <span style={{ fontSize: "0.78rem", color: "#5b6e63" }}>from {p.islandName}</span>
                                            </div>
                                            <span className="badge bg-light text-muted" style={{ fontSize: "0.74rem" }}>
                                                {idx === 0 ? "Default" : "Secondary"}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <p className="mb-0" style={{ fontSize: "0.78rem", color: "#5b6e63" }}>
                            <i className="fa-solid fa-circle-info me-1" aria-hidden="true" />
                            If you have custom badge icons configured, syncing will reset them to default values.
                        </p>
                    </div>

                    <div
                        className="py-3 px-4 d-flex justify-content-end align-items-center gap-2 border-top"
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
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            disabled={!hasParsed}
                            className="btn fw-bold px-4 py-2 small text-white d-flex align-items-center gap-2"
                            style={{
                                borderRadius: "14px",
                                backgroundColor: hasParsed ? "#d97706" : "#9ca3af",
                                borderColor: hasParsed ? "#d97706" : "#9ca3af",
                                boxShadow: hasParsed ? "0 4px 0 #b45309" : undefined,
                            }}
                            onClick={handleConfirm}
                        >
                            <i className="fa-solid fa-arrows-rotate" aria-hidden="true" />
                            <span>Overwrite and sync</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
