import React from "react";
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
            style={{
                backgroundColor: "rgba(0,0,0,0.65)",
                zIndex: 1060,
                backdropFilter: "blur(4px)",
            }}
            onClick={onClose}
        >
            <div
                className="modal-dialog modal-dialog-centered"
                style={{ maxWidth: "520px" }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden animate-fade">
                    <div className="modal-header border-bottom bg-warning bg-opacity-10 py-3 px-4 d-flex align-items-center justify-content-between">
                        <div className="d-flex align-items-center gap-2">
                            <span
                                className="badge bg-warning text-dark rounded-circle p-2 d-flex align-items-center justify-content-center"
                                style={{ width: 32, height: 32 }}
                            >
                                <i className="fa-solid fa-triangle-exclamation"></i>
                            </span>
                            <h3 className="modal-title h5 ac-font text-dark mb-0">
                                Sync from Discord Warning
                            </h3>
                        </div>
                        <button
                            type="button"
                            className="btn-close"
                            onClick={onClose}
                            aria-label="Close"
                        />
                    </div>

                    <div className="modal-body p-4">
                        {/* Warning Notice Box */}
                        <div className="alert alert-warning border border-warning border-opacity-30 rounded-3 p-3 mb-3">
                            <div className="d-flex gap-2 align-items-start">
                                <i className="fa-solid fa-triangle-exclamation text-warning mt-1 flex-shrink-0"></i>
                                <div className="small text-dark">
                                    <strong className="d-block mb-1">Overwriting Saved Character Slots</strong>
                                    Syncing from Discord will <strong>replace and overwrite</strong> your current saved character slots ({charactersCount} configured) with the in-game names parsed from your Discord nickname.
                                </div>
                            </div>
                        </div>

                        <div className="mb-3">
                            <label className="text-uppercase tiny-text fw-bold text-muted d-block mb-1">
                                Current Discord Nickname
                            </label>
                            <div className="p-2 px-3 bg-light rounded-3 font-monospace small text-primary fw-bold border">
                                <i className="fa-brands fa-discord me-2"></i>
                                {rawDiscordName}
                            </div>
                        </div>

                        {/* Preview of Parsed Characters */}
                        <div className="mb-3">
                            <label className="text-uppercase tiny-text fw-bold text-muted d-block mb-1">
                                Parsed Characters to Import
                            </label>
                            {!hasParsed ? (
                                <div className="alert alert-danger p-3 rounded-3 small mb-0">
                                    <i className="fa-solid fa-circle-exclamation me-1"></i>
                                    No IGN / Island Name pattern detected in <code>"{rawDiscordName}"</code>.
                                    <div className="tiny-text mt-1 text-muted">
                                        Expected format: <code>IGN / Island Name</code> or <code>IGN1 / Island1 | IGN2 / Island2</code>.
                                    </div>
                                </div>
                            ) : (
                                <div className="d-flex flex-column gap-2">
                                    {parsed.slice(0, 3).map((p, idx) => (
                                        <div
                                            key={idx}
                                            className="d-flex align-items-center justify-content-between p-2 px-3 bg-white border border-success border-opacity-30 rounded-3 shadow-2xs"
                                        >
                                            <div className="d-flex align-items-center gap-2">
                                                <span className="badge bg-success bg-opacity-10 text-success rounded-pill x-small fw-bold">
                                                    Slot #{idx + 1}
                                                </span>
                                                <strong className="text-dark small">{p.ign}</strong>
                                                <span className="tiny-text text-muted">from {p.islandName}</span>
                                            </div>
                                            <span className="badge bg-light text-muted x-small">
                                                {idx === 0 ? "Default" : "Secondary"}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <p className="tiny-text text-muted mb-0">
                            <i className="fa-solid fa-info-circle me-1"></i>
                            If you have custom titles or icons configured, syncing will reset them to default values.
                        </p>
                    </div>

                    <div className="modal-footer border-top bg-light p-3 px-4 d-flex justify-content-between align-items-center">
                        <button
                            type="button"
                            className="btn btn-outline-secondary rounded-pill fw-bold px-4"
                            onClick={onClose}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            disabled={!hasParsed}
                            className={`btn btn-warning text-dark fw-bold rounded-pill px-4 shadow-sm d-flex align-items-center gap-2 ${
                                !hasParsed ? "opacity-50" : ""
                            }`}
                            onClick={handleConfirm}
                        >
                            <i className="fa-solid fa-arrows-rotate"></i>
                            <span>Overwrite &amp; Sync</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
