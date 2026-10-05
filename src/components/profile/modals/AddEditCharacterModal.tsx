import React from "react";
import { playChimeClick } from "../../../utils/kkAudioSynthesizer";

interface AddEditCharacterModalProps {
    isOpen: boolean;
    onClose: () => void;
    editingCharId: string | null;
    charIgn: string;
    setCharIgn: (val: string) => void;
    charIsland: string;
    setCharIsland: (val: string) => void;
    charIcon: string;
    setCharIcon: (val: string) => void;
    charError: string;
    syncToDiscordNick: boolean;
    setSyncToDiscordNick: (val: boolean) => void;
    targetDiscordNick: string;
    setTargetDiscordNick: (val: string) => void;
    setCustomizedNick: (val: boolean) => void;
    isSavingChar: boolean;
    onSave: (e: React.FormEvent) => void;
    characterIcons: Array<{ id: string; label: string }>;
}

export const AddEditCharacterModal: React.FC<AddEditCharacterModalProps> = ({
    isOpen,
    onClose,
    editingCharId,
    charIgn,
    setCharIgn,
    charIsland,
    setCharIsland,
    charIcon,
    setCharIcon,
    charError,
    syncToDiscordNick,
    setSyncToDiscordNick,
    targetDiscordNick,
    setTargetDiscordNick,
    setCustomizedNick,
    isSavingChar,
    onSave,
    characterIcons,
}) => {
    if (!isOpen) return null;

    return (
        <div
            className="char-modal-backdrop animate-fade"
            style={{ zIndex: 1060 }}
            onClick={onClose}
        >
            <div
                className="char-modal-dialog"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="char-modal-header">
                    <div className="d-flex align-items-center gap-2.5">
                        <div className="char-modal-header-icon shadow-2xs">
                            <i className={`fa-solid ${charIcon}`}></i>
                        </div>
                        <div>
                            <h3 className="char-modal-title ac-font">
                                {editingCharId ? "Edit In-Game Character" : "Add In-Game Character"}
                            </h3>
                            <div className="char-modal-subtitle">
                                {editingCharId
                                    ? "Update resident passport details"
                                    : "Register a resident for bot orders & passport"}
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="btn-close"
                        aria-label="Close"
                        onClick={onClose}
                    />
                </div>

                <form onSubmit={onSave} className="d-flex flex-column" style={{ minHeight: 0 }}>
                    <div className="char-modal-body">
                        {charError && (
                            <div className="alert alert-danger py-2 px-3 small rounded-3 mb-3 fw-bold d-flex align-items-center gap-1.5">
                                <i className="fa-solid fa-circle-exclamation text-danger flex-shrink-0"></i>
                                <span>{charError}</span>
                            </div>
                        )}

                        <div className="row g-2.5 mb-3">
                            <div className="col-12 col-sm-6">
                                <label className="char-modal-input-label" htmlFor="profileCharIgn">
                                    <i className="fa-solid fa-user text-success"></i>
                                    <span>In-Game Name (IGN)</span>
                                    <span className="text-danger">*</span>
                                </label>
                                <input
                                    id="profileCharIgn"
                                    type="text"
                                    className="char-modal-input"
                                    placeholder="e.g. Bitress"
                                    value={charIgn}
                                    onChange={(e) => setCharIgn(e.target.value)}
                                    maxLength={24}
                                    autoFocus
                                />
                                <div className="tiny-text text-muted mt-1">Exact ACNH player name</div>
                            </div>

                            <div className="col-12 col-sm-6">
                                <label className="char-modal-input-label" htmlFor="profileCharIsland">
                                    <i className="fa-solid fa-mountain-sun text-success"></i>
                                    <span>Island Name</span>
                                    <span className="text-danger">*</span>
                                </label>
                                <input
                                    id="profileCharIsland"
                                    type="text"
                                    className="char-modal-input"
                                    placeholder="e.g. Cheurnice"
                                    value={charIsland}
                                    onChange={(e) => setCharIsland(e.target.value)}
                                    maxLength={24}
                                />
                                <div className="tiny-text text-muted mt-1">Your ACNH island name</div>
                            </div>
                        </div>

                        {/* Icon Picker */}
                        <div>
                            <div className="d-flex align-items-center justify-content-between mb-2">
                                <label className="char-modal-input-label mb-0">
                                    <i className="fa-solid fa-icons text-success"></i>
                                    <span>Character Badge Icon</span>
                                </label>
                                <span className="badge bg-success bg-opacity-10 text-success rounded-pill x-small fw-bold px-2 py-0.5">
                                    {characterIcons.find((i) => i.id === charIcon)?.label || "Selected"}
                                </span>
                            </div>
                            <div className="char-icon-grid">
                                {characterIcons.map((iconItem) => {
                                    const isIconActive = charIcon === iconItem.id;
                                    return (
                                        <button
                                            key={iconItem.id}
                                            type="button"
                                            className={`char-icon-btn ${isIconActive ? "active shadow-2xs" : ""}`}
                                            onClick={() => {
                                                setCharIcon(iconItem.id);
                                                playChimeClick();
                                            }}
                                            title={iconItem.label}
                                            aria-label={iconItem.label}
                                        >
                                            <i className={`fa-solid ${iconItem.id}`}></i>
                                            <span>{iconItem.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Discord Server Nickname Auto-Sync Section */}
                        <div className="mt-3 pt-3 border-top">
                            <div className="d-flex align-items-center justify-content-between mb-2">
                                <label
                                    className="d-flex align-items-center gap-2 mb-0 fw-bold small text-dark"
                                    style={{ cursor: "pointer" }}
                                >
                                    <input
                                        type="checkbox"
                                        className="form-check-input mt-0"
                                        checked={syncToDiscordNick}
                                        onChange={(e) => setSyncToDiscordNick(e.target.checked)}
                                    />
                                    <i className="fa-brands fa-discord text-primary"></i>
                                    <span>Update Discord Server Nickname</span>
                                </label>
                                <span className="badge bg-primary bg-opacity-10 text-primary rounded-pill x-small fw-bold px-2 py-0.5">
                                    Auto-Sync
                                </span>
                            </div>

                            {syncToDiscordNick && (
                                <div className="p-2.5 rounded-3 bg-light border">
                                    <div className="d-flex align-items-center justify-content-between mb-1.5">
                                        <span className="tiny-text text-muted fw-bold text-uppercase">
                                            Discord Nickname Preview
                                        </span>
                                        <span
                                            className={`tiny-text font-monospace ${
                                                targetDiscordNick.length > 32
                                                    ? "text-danger fw-bold"
                                                    : "text-muted"
                                            }`}
                                        >
                                            {targetDiscordNick.length}/32 chars
                                        </span>
                                    </div>

                                    <div className="input-group input-group-sm">
                                        <span className="input-group-text bg-white text-primary border-end-0">
                                            <i className="fa-brands fa-discord"></i>
                                        </span>
                                        <input
                                            type="text"
                                            className="form-control form-control-sm border-start-0 font-monospace fw-bold"
                                            placeholder="IGN1/IGN2/IGN3 | Island1/Island2/Island3"
                                            value={targetDiscordNick}
                                            onChange={(e) => {
                                                setTargetDiscordNick(e.target.value.slice(0, 32));
                                                setCustomizedNick(true);
                                            }}
                                            maxLength={32}
                                        />
                                    </div>

                                    <div className="tiny-text text-muted mt-2 d-flex align-items-center gap-1">
                                        <i className="fa-solid fa-circle-check text-success"></i>
                                        <span>
                                            Automatically syncs Slots 1, 2, and 3 using "/" between IGNs and "|" before Island names.
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="char-modal-footer">
                        <button
                            type="button"
                            className="btn btn-outline-secondary rounded-pill fw-bold px-4 py-2"
                            onClick={onClose}
                            disabled={isSavingChar}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSavingChar}
                            className="btn btn-success text-white rounded-pill fw-bold px-4 py-2 shadow-sm d-flex align-items-center gap-2"
                            style={{ backgroundColor: "#37b06d", borderColor: "#37b06d" }}
                        >
                            <i
                                className={
                                    isSavingChar
                                        ? "fa-solid fa-spinner fa-spin"
                                        : editingCharId
                                        ? "fa-solid fa-check"
                                        : "fa-solid fa-cloud-arrow-up"
                                }
                            ></i>
                            <span>
                                {isSavingChar
                                    ? "Saving & Syncing..."
                                    : editingCharId
                                    ? "Save Changes & Sync"
                                    : "Create & Save Character"}
                            </span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
