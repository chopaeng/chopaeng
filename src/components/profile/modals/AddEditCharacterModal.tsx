import React from "react";

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
    isSavingChar,
    onSave,
    characterIcons,
}) => {
    if (!isOpen) return null;

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
                style={{ maxWidth: "480px" }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden animate-fade">
                    <div className="modal-header border-bottom py-3 px-4 d-flex align-items-center justify-content-between">
                        <div className="d-flex align-items-center gap-2">
                            <span
                                className="badge bg-success bg-opacity-10 text-success rounded-circle p-2 d-flex align-items-center justify-content-center"
                                style={{ width: 34, height: 34 }}
                            >
                                <i className={`fa-solid ${charIcon || "fa-user"}`}></i>
                            </span>
                            <div>
                                <h3 className="modal-title h6 fw-black text-dark mb-0 ac-font">
                                    {editingCharId ? "Edit In-Game Character" : "Add In-Game Character"}
                                </h3>
                                <span className="tiny-text text-muted">
                                    Saved to ChoBot for automated orders &amp; passport
                                </span>
                            </div>
                        </div>

                        <button
                            type="button"
                            className="btn-close rounded-circle p-2"
                            onClick={onClose}
                            aria-label="Close"
                        />
                    </div>

                    <form onSubmit={onSave} className="d-flex flex-column" style={{ minHeight: 0 }}>
                        <div className="modal-body p-4">
                            {charError && (
                                <div className="alert alert-danger py-2 px-3 small rounded-3 mb-3 fw-bold d-flex align-items-center gap-1.5">
                                    <i className="fa-solid fa-circle-exclamation text-danger flex-shrink-0"></i>
                                    <span>{charError}</span>
                                </div>
                            )}

                            <div className="row g-3 mb-3">
                                <div className="col-12 col-sm-6">
                                    <label className="form-label small fw-bold text-dark mb-1" htmlFor="profileCharIgn">
                                        <i className="fa-solid fa-user text-success me-1"></i>
                                        <span>In-Game Name (IGN)</span>
                                        <span className="text-danger">*</span>
                                    </label>
                                    <input
                                        id="profileCharIgn"
                                        type="text"
                                        className="form-control rounded-3"
                                        placeholder="e.g. Bitress"
                                        value={charIgn}
                                        onChange={(e) => setCharIgn(e.target.value)}
                                        maxLength={24}
                                        autoFocus
                                    />
                                    <div className="tiny-text text-muted mt-1">Exact ACNH player name</div>
                                </div>

                                <div className="col-12 col-sm-6">
                                    <label className="form-label small fw-bold text-dark mb-1" htmlFor="profileCharIsland">
                                        <i className="fa-solid fa-mountain-sun text-success me-1"></i>
                                        <span>Island Name</span>
                                        <span className="text-danger">*</span>
                                    </label>
                                    <input
                                        id="profileCharIsland"
                                        type="text"
                                        className="form-control rounded-3"
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
                                    <label className="form-label small fw-bold text-dark mb-0">
                                        <i className="fa-solid fa-icons text-success me-1"></i>
                                        <span>Character Badge Icon</span>
                                    </label>
                                    <span className="badge bg-success bg-opacity-10 text-success rounded-pill x-small fw-bold px-2 py-0.5">
                                        {characterIcons.find((i) => i.id === charIcon)?.label || "Selected"}
                                    </span>
                                </div>
                                <div className="d-flex flex-wrap gap-2">
                                    {characterIcons.map((ic) => (
                                        <button
                                            key={ic.id}
                                            type="button"
                                            onClick={() => setCharIcon(ic.id)}
                                            className={`btn btn-sm rounded-circle d-flex align-items-center justify-content-center p-0 transition-all ${
                                                charIcon === ic.id
                                                    ? "btn-success text-white shadow-xs"
                                                    : "btn-light text-secondary border"
                                            }`}
                                            style={{ width: "36px", height: "36px" }}
                                            title={ic.label}
                                        >
                                            <i className={`fa-solid ${ic.id}`}></i>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="modal-footer border-top py-2.5 px-4 bg-light d-flex align-items-center justify-content-end gap-2">
                            <button
                                type="button"
                                className="btn btn-outline-secondary rounded-pill fw-bold px-4 py-2 small"
                                onClick={onClose}
                                disabled={isSavingChar}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="btn btn-success text-white rounded-pill fw-black px-4 py-2 small d-inline-flex align-items-center gap-1.5 shadow-xs"
                                disabled={isSavingChar}
                            >
                                {isSavingChar ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm" role="status" />
                                        <span>Saving...</span>
                                    </>
                                ) : (
                                    <>
                                        <i className="fa-solid fa-floppy-disk"></i>
                                        <span>{editingCharId ? "Save Changes" : "Create Character"}</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};
