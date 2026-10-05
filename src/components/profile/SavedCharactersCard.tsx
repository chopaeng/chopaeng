import React from "react";
import type { SavedCharacter } from "../../hooks/useSavedCharacters";
import { playChimeClick } from "../../utils/kkAudioSynthesizer";

interface SavedCharactersCardProps {
    characters: SavedCharacter[];
    isSyncingDb: boolean;
    rawDiscordName: string;
    onOpenSyncDiscordModal: () => void;
    onOpenDiscordNickModal: () => void;
    onOpenAddCharacter: () => void;
    onOpenEditCharacter: (char: SavedCharacter) => void;
    onDeleteCharacter: (char: SavedCharacter) => void;
    onSetActiveCharacter: (char: SavedCharacter) => void;
}

export const SavedCharactersCard: React.FC<SavedCharactersCardProps> = ({
    characters,
    isSyncingDb,
    rawDiscordName,
    onOpenSyncDiscordModal,
    onOpenDiscordNickModal,
    onOpenAddCharacter,
    onOpenEditCharacter,
    onDeleteCharacter,
    onSetActiveCharacter,
}) => {
    return (
        <div className="pf-card h-100">
            <div className="pf-section-header flex-column flex-sm-row align-items-start align-items-sm-center">
                <div>
                    <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                        <h2 className="h5 ac-font text-dark mb-0">Saved In-Game Characters</h2>
                        <span className="badge bg-success bg-opacity-10 text-success rounded-pill x-small fw-black">
                            {characters.length} / 3 Slots
                        </span>
                        <span className="badge bg-light text-success border border-success-subtle rounded-pill x-small fw-bold d-inline-flex align-items-center gap-1">
                            <i className={isSyncingDb ? "fa-solid fa-spinner fa-spin text-primary" : "fa-solid fa-cloud-arrow-up text-success"}></i>
                            <span>{isSyncingDb ? "Syncing to ChoBot..." : "Saved to ChoBot"}</span>
                        </span>
                        <span className="badge bg-primary bg-opacity-10 text-primary border border-primary-subtle rounded-pill x-small fw-bold d-inline-flex align-items-center gap-1">
                            <i className="fa-brands fa-discord"></i>
                            <span>Syncs Slots 1, 2 &amp; 3 (| and /)</span>
                        </span>
                    </div>
                    <p className="tiny-text text-muted mb-0">
                        Active character auto-fills your IGN &amp; Island Name in orders. Adding, editing, or setting active automatically syncs Slots 1, 2, and 3 to your ChoPaeng Discord server nickname using | and /.
                    </p>
                </div>

                {/* Action buttons */}
                <div className="d-flex align-items-center gap-2 flex-wrap">
                    {rawDiscordName && (
                        <button
                            type="button"
                            onClick={() => {
                                onOpenSyncDiscordModal();
                                playChimeClick();
                            }}
                            className="btn btn-sm btn-outline-secondary rounded-pill fw-bold px-3 d-flex align-items-center gap-1 shadow-2xs"
                            title={`Parse IGN & Island from Discord: "${rawDiscordName}"`}
                        >
                            <i className="fa-brands fa-discord text-primary"></i>
                            <span>Sync from Discord</span>
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => {
                            onOpenDiscordNickModal();
                        }}
                        className="btn btn-sm btn-outline-primary rounded-pill fw-bold px-3 d-flex align-items-center gap-1 shadow-2xs"
                        title="Update your server nickname on the ChoPaeng Discord server"
                    >
                        <i className="fa-solid fa-pen-to-square"></i>
                        <span>Update Discord Nick</span>
                    </button>
                </div>
            </div>

            {/* Warning Callout on Discord Sync */}
            {rawDiscordName && (
                <div className="discord-sync-warning-banner animate-fade mb-3">
                    <i className="fa-solid fa-triangle-exclamation warning-icon"></i>
                    <div>
                        <strong className="warning-title">Warning: "Sync from Discord" will replace saved characters</strong>
                        <span className="warning-text">
                            Clicking <strong>Sync from Discord</strong> parses your server nickname (<code>{rawDiscordName}</code>) and will <strong>overwrite and replace</strong> your existing in-game character slots. To avoid losing custom character slots, use <strong>+ Add / Edit</strong> manually instead.
                        </span>
                    </div>
                </div>
            )}

            {/* 3 Fixed Character Slots Grid */}
            <div className="row g-3">
                {[0, 1, 2].map((slotIdx) => {
                    const char = characters[slotIdx];
                    const isSelected = char?.isDefault;

                    if (char) {
                        return (
                            <div key={char.id} className="col-12 col-md-6 col-lg-4">
                                <div className={`pf-char-card ${isSelected ? "primary shadow-sm" : ""} h-100 d-flex flex-column transition-all`}>
                                    <div className="d-flex align-items-start justify-content-between mb-2 gap-2">
                                        <div className="d-flex align-items-center gap-2 overflow-hidden">
                                            <div className="pf-char-icon-circle shadow-2xs">
                                                <i className={`fa-solid ${char.icon || "fa-leaf"}`}></i>
                                            </div>
                                            <div className="text-truncate">
                                                <div className="fw-black text-truncate" style={{ fontSize: "1rem" }}>
                                                    {char.ign}
                                                </div>
                                                <div className="tiny-text text-muted fw-bold text-truncate">
                                                    {slotIdx === 0 ? "Main Character" : `Slot #${slotIdx + 1}`}
                                                </div>
                                            </div>
                                        </div>

                                        {isSelected ? (
                                            <span className="badge bg-success bg-opacity-20 text-success border border-success border-opacity-40 rounded-pill x-small fw-black text-nowrap d-inline-flex align-items-center gap-1 px-2.5 py-1">
                                                <i className="fa-solid fa-circle-check"></i>
                                                <span>Active</span>
                                            </span>
                                        ) : (
                                            <button
                                                type="button"
                                                className="btn btn-xs btn-light rounded-pill border fw-bold tiny-text text-nowrap px-2.5 py-1"
                                                onClick={() => onSetActiveCharacter(char)}
                                                aria-label={`Set ${char.ign} as active character`}
                                            >
                                                Set Active
                                            </button>
                                        )}
                                    </div>

                                    <div className="pf-char-island-box">
                                        <div className="d-flex align-items-center justify-content-between tiny-text">
                                            <span className="text-muted fw-bold">Island Name:</span>
                                            <span className="fw-black d-flex align-items-center gap-1.5 text-dark">
                                                <i className="fa-solid fa-tree text-success"></i>
                                                <span>{char.islandName}</span>
                                            </span>
                                        </div>
                                    </div>

                                    <div className="d-flex align-items-center justify-content-between pt-2 border-top mt-auto">
                                        <span className="tiny-text text-success font-monospace d-flex align-items-center gap-1 fw-bold">
                                            <i className="fa-solid fa-cloud-check"></i>
                                            <span>Synced</span>
                                        </span>

                                        <div className="d-flex align-items-center gap-1">
                                            <button
                                                type="button"
                                                className="btn btn-xs btn-outline-secondary rounded-pill fw-bold px-2 py-1 tiny-text d-flex align-items-center gap-1"
                                                onClick={() => onOpenEditCharacter(char)}
                                                title="Edit character details"
                                                aria-label={`Edit ${char.ign}`}
                                            >
                                                <i className="fa-solid fa-pen"></i>
                                                <span>Edit</span>
                                            </button>
                                            {characters.length > 1 && (
                                                <button
                                                    type="button"
                                                    className="btn btn-xs btn-outline-danger rounded-pill fw-bold px-2 py-1 tiny-text d-flex align-items-center gap-1"
                                                    onClick={() => onDeleteCharacter(char)}
                                                    title="Delete character"
                                                    aria-label={`Delete ${char.ign}`}
                                                >
                                                    <i className="fa-solid fa-trash"></i>
                                                </button>
                                            )}
                                            {!isSelected && (
                                                <button
                                                    type="button"
                                                    className="btn btn-xs btn-outline-success rounded-pill fw-bold px-2 py-1 tiny-text"
                                                    onClick={() => onSetActiveCharacter(char)}
                                                    aria-label={`Set ${char.ign} as primary`}
                                                >
                                                    Set Primary
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    }

                    // Empty Slot Card
                    const slotTitle = slotIdx === 0 ? "Slot 1 (Main Character)" : slotIdx === 1 ? "Slot 2 (Secondary)" : "Slot 3 (Extra Slot)";
                    return (
                        <div key={`empty_slot_${slotIdx}`} className="col-12 col-md-6 col-lg-4">
                            <div
                                className="pf-char-card pf-empty-slot-card d-flex flex-column align-items-center justify-content-center text-center p-4 h-100"
                                onClick={onOpenAddCharacter}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                        onOpenAddCharacter();
                                    }
                                }}
                            >
                                <div className="pf-empty-slot-icon mb-2">
                                    <i className="fa-solid fa-plus"></i>
                                </div>
                                <div className="fw-black mb-1" style={{ fontSize: "0.95rem" }}>
                                    {slotTitle}
                                </div>
                                <p className="tiny-text text-muted mb-3">
                                    Empty slot • Click to configure
                                </p>
                                <button
                                    type="button"
                                    className="btn btn-sm btn-nook rounded-pill px-3 py-1 fw-bold tiny-text d-flex align-items-center gap-1 shadow-2xs mt-auto"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onOpenAddCharacter();
                                    }}
                                >
                                    <i className="fa-solid fa-plus"></i>
                                    <span>Add Character</span>
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
