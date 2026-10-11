import React from "react";
import type { SavedCharacter } from "../../hooks/useSavedCharacters";

interface SavedCharactersCardProps {
    characters: SavedCharacter[];
    isSyncingDb: boolean;
    onOpenAddCharacter: () => void;
    onOpenEditCharacter: (char: SavedCharacter) => void;
    onDeleteCharacter: (char: SavedCharacter) => void;
    onSetActiveCharacter: (char: SavedCharacter) => void;
}

export const SavedCharactersCard: React.FC<SavedCharactersCardProps> = ({
    characters,
    isSyncingDb,
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
                    </div>
                    <p className="tiny-text text-muted mb-0">
                        Active character automatically fills your In-Game Name (IGN) and Island Name across order bot, drop bot, and your resident passport.
                    </p>
                </div>

                <div className="d-flex align-items-center gap-2 flex-wrap">
                    <button
                        type="button"
                        onClick={onOpenAddCharacter}
                        disabled={characters.length >= 3}
                        className="btn btn-sm btn-success text-white rounded-pill fw-bold px-3 d-flex align-items-center gap-1.5 shadow-2xs"
                    >
                        <i className="fa-solid fa-plus"></i>
                        <span>Add Character</span>
                    </button>
                </div>
            </div>

            {/* 3 Fixed Character Slots Grid */}
            <div className="row g-3">
                {[0, 1, 2].map((slotIdx) => {
                    const char = characters[slotIdx];
                    const isSelected = char?.isDefault;

                    if (char) {
                        return (
                            <div key={char.id} className="col-12 col-md-4">
                                <div
                                    className={`char-slot-card p-3 rounded-4 border h-100 position-relative transition-all ${
                                        isSelected
                                            ? "border-success bg-success bg-opacity-10 shadow-xs"
                                            : "bg-white border-light-subtle shadow-2xs"
                                    }`}
                                >
                                    <div className="d-flex align-items-center justify-content-between mb-2">
                                        <div className="d-flex align-items-center gap-2">
                                            <div
                                                className={`rounded-circle d-flex align-items-center justify-content-center ${
                                                    isSelected
                                                        ? "bg-success text-white"
                                                        : "bg-light text-secondary border"
                                                }`}
                                                style={{ width: "32px", height: "32px", fontSize: "0.85rem" }}
                                            >
                                                <i className={`fa-solid ${char.icon || "fa-user"}`}></i>
                                            </div>
                                            <span className="tiny-text fw-bold text-muted text-uppercase">
                                                Slot {slotIdx + 1}
                                            </span>
                                        </div>

                                        {isSelected && (
                                            <span className="badge bg-success text-white rounded-pill tiny-text px-2 py-0.5 fw-bold">
                                                Active
                                            </span>
                                        )}
                                    </div>

                                    <div className="mb-3">
                                        <div className="fw-black text-dark text-truncate h6 mb-0 ac-font">
                                            {char.ign}
                                        </div>
                                        <div className="tiny-text text-muted text-truncate d-flex align-items-center gap-1">
                                            <i className="fa-solid fa-tree text-success"></i>
                                            <span>{char.islandName}</span>
                                        </div>
                                    </div>

                                    <div className="d-flex align-items-center justify-content-between pt-2 border-top gap-1 mt-auto">
                                        {!isSelected ? (
                                            <button
                                                type="button"
                                                onClick={() => onSetActiveCharacter(char)}
                                                className="btn btn-xs btn-outline-success rounded-pill fw-bold px-2 py-1 tiny-text"
                                            >
                                                Set Active
                                            </button>
                                        ) : (
                                            <span className="tiny-text text-success fw-bold">
                                                <i className="fa-solid fa-circle-check me-1"></i>Primary
                                            </span>
                                        )}

                                        <div className="d-flex align-items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() => onOpenEditCharacter(char)}
                                                className="btn btn-xs btn-light text-secondary rounded-circle p-1 d-flex align-items-center justify-content-center"
                                                style={{ width: "26px", height: "26px" }}
                                                title="Edit Character"
                                            >
                                                <i className="fa-solid fa-pen tiny-text"></i>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => onDeleteCharacter(char)}
                                                className="btn btn-xs btn-light text-danger rounded-circle p-1 d-flex align-items-center justify-content-center"
                                                style={{ width: "26px", height: "26px" }}
                                                title="Delete Character"
                                            >
                                                <i className="fa-solid fa-trash tiny-text"></i>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    }

                    return (
                        <div key={`empty-slot-${slotIdx}`} className="col-12 col-md-4">
                            <div
                                onClick={onOpenAddCharacter}
                                className="char-slot-empty p-3 rounded-4 border border-dashed text-center h-100 d-flex flex-column align-items-center justify-content-center cursor-pointer transition-all hover-lift bg-light bg-opacity-50"
                                style={{ minHeight: "130px" }}
                            >
                                <div className="rounded-circle bg-white border p-2 mb-2 shadow-2xs text-muted">
                                    <i className="fa-solid fa-plus text-success"></i>
                                </div>
                                <span className="small fw-bold text-dark mb-0">Empty Slot {slotIdx + 1}</span>
                                <span className="tiny-text text-muted">+ Add In-Game Character</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
