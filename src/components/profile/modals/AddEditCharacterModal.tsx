import React, { useEffect, useRef, useState } from "react";

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
    const modalRef = useRef<HTMLDivElement | null>(null);
    const previousActiveElementRef = useRef<HTMLElement | null>(null);

    const [touchedIgn, setTouchedIgn] = useState(false);
    const [touchedIsland, setTouchedIsland] = useState(false);

    // Body scroll lock and focus restore
    useEffect(() => {
        if (!isOpen) {
            setTouchedIgn(false);
            setTouchedIsland(false);
            return;
        }

        previousActiveElementRef.current = document.activeElement as HTMLElement | null;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        // Auto focus first input after opening
        const timer = setTimeout(() => {
            const input = modalRef.current?.querySelector<HTMLInputElement>("input#profileCharIgn");
            input?.focus();
        }, 50);

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
            clearTimeout(timer);
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", handleKeyDown);
            if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === "function") {
                previousActiveElementRef.current.focus();
            }
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const ignInvalid = touchedIgn && !charIgn.trim();
    const islandInvalid = touchedIsland && !charIsland.trim();

    const handleSubmit = (e: React.FormEvent) => {
        setTouchedIgn(true);
        setTouchedIsland(true);
        if (!charIgn.trim() || !charIsland.trim()) {
            e.preventDefault();
            return;
        }
        onSave(e);
    };

    return (
        <div
            className="modal show d-block"
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="char-modal-title"
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
                style={{ maxWidth: "480px" }}
                onClick={(e) => e.stopPropagation()}
            >
                <div
                    className="modal-content border-0 overflow-hidden"
                    style={{
                        borderRadius: "26px",
                        boxShadow: "0 20px 45px -12px rgba(29, 51, 40, 0.35)",
                    }}
                >
                    {/* Passport Card Cover Header */}
                    <div
                        className="py-3 px-4 d-flex align-items-center justify-content-between"
                        style={{ background: "#1f8a4c", color: "#fff" }}
                    >
                        <div className="d-flex align-items-center gap-2.5">
                            <span
                                className="rounded-circle d-flex align-items-center justify-content-center"
                                style={{
                                    width: 38,
                                    height: 38,
                                    background: "rgba(255, 255, 255, 0.2)",
                                    border: "2px dashed rgba(255, 255, 255, 0.65)",
                                    color: "#fff",
                                    fontSize: "1rem",
                                }}
                                aria-hidden="true"
                            >
                                <i className={`fa-solid ${charIcon || "fa-user"}`} />
                            </span>
                            <div>
                                <h2 id="char-modal-title" className="h6 fw-bold text-white mb-0 ac-font" style={{ fontSize: "1.1rem" }}>
                                    {editingCharId ? "Edit in-game character" : "Add in-game character"}
                                </h2>
                                <span style={{ fontSize: "0.78rem", color: "rgba(255, 255, 255, 0.88)" }}>
                                    Saved to ChoBot for automated orders and passport
                                </span>
                            </div>
                        </div>

                        <button
                            type="button"
                            className="btn-close btn-close-white rounded-circle p-2"
                            onClick={onClose}
                            aria-label="Close dialog"
                        />
                    </div>

                    {/* Stitched Seam */}
                    <div
                        style={{
                            borderTop: "3px dashed #fff",
                            margin: "0 14px",
                            position: "relative",
                            top: "-2px",
                            opacity: 0.85,
                        }}
                        aria-hidden="true"
                    />

                    <form onSubmit={handleSubmit} className="d-flex flex-column" noValidate>
                        <div className="p-4" style={{ background: "#fff" }}>
                            {charError && (
                                <div
                                    className="alert alert-danger py-2 px-3 small rounded-3 mb-3 fw-bold d-flex align-items-center gap-2"
                                    role="alert"
                                >
                                    <i className="fa-solid fa-circle-exclamation text-danger flex-shrink-0" aria-hidden="true" />
                                    <span>{charError}</span>
                                </div>
                            )}

                            <div className="row g-3 mb-3">
                                {/* IGN */}
                                <div className="col-12 col-sm-6">
                                    <label
                                        className="form-label small fw-bold mb-1 d-block"
                                        htmlFor="profileCharIgn"
                                        style={{ color: "#1d3328" }}
                                    >
                                        In-game name (IGN)
                                    </label>
                                    <div className="position-relative">
                                        <i
                                            className="fa-solid fa-user position-absolute top-50 translate-middle-y"
                                            style={{ left: "12px", color: ignInvalid ? "#b3261e" : "#5b6e63", pointerEvents: "none" }}
                                            aria-hidden="true"
                                        />
                                        <input
                                            id="profileCharIgn"
                                            type="text"
                                            className="form-control"
                                            style={{
                                                paddingLeft: "36px",
                                                borderRadius: "14px",
                                                border: `1.5px solid ${ignInvalid ? "#b3261e" : "#cfdcd3"}`,
                                                boxShadow: ignInvalid ? "0 0 0 3px rgba(179, 38, 30, 0.15)" : undefined,
                                            }}
                                            placeholder="e.g. Bitress"
                                            value={charIgn}
                                            onChange={(e) => setCharIgn(e.target.value)}
                                            onBlur={() => setTouchedIgn(true)}
                                            maxLength={24}
                                            aria-invalid={ignInvalid}
                                            aria-describedby={ignInvalid ? "ignError" : "ignHint"}
                                            required
                                        />
                                    </div>
                                    {ignInvalid ? (
                                        <div id="ignError" className="small mt-1" role="alert" style={{ color: "#b3261e", fontSize: "0.78rem" }}>
                                            Please enter your in-game name.
                                        </div>
                                    ) : (
                                        <div id="ignHint" className="mt-1" style={{ fontSize: "0.76rem", color: "#5b6e63" }}>
                                            Exact player name in Animal Crossing
                                        </div>
                                    )}
                                </div>

                                {/* Island Name */}
                                <div className="col-12 col-sm-6">
                                    <label
                                        className="form-label small fw-bold mb-1 d-block"
                                        htmlFor="profileCharIsland"
                                        style={{ color: "#1d3328" }}
                                    >
                                        Island name
                                    </label>
                                    <div className="position-relative">
                                        <i
                                            className="fa-solid fa-mountain-sun position-absolute top-50 translate-middle-y"
                                            style={{ left: "12px", color: islandInvalid ? "#b3261e" : "#5b6e63", pointerEvents: "none" }}
                                            aria-hidden="true"
                                        />
                                        <input
                                            id="profileCharIsland"
                                            type="text"
                                            className="form-control"
                                            style={{
                                                paddingLeft: "36px",
                                                borderRadius: "14px",
                                                border: `1.5px solid ${islandInvalid ? "#b3261e" : "#cfdcd3"}`,
                                                boxShadow: islandInvalid ? "0 0 0 3px rgba(179, 38, 30, 0.15)" : undefined,
                                            }}
                                            placeholder="e.g. Cheurnice"
                                            value={charIsland}
                                            onChange={(e) => setCharIsland(e.target.value)}
                                            onBlur={() => setTouchedIsland(true)}
                                            maxLength={24}
                                            aria-invalid={islandInvalid}
                                            aria-describedby={islandInvalid ? "islandError" : "islandHint"}
                                            required
                                        />
                                    </div>
                                    {islandInvalid ? (
                                        <div id="islandError" className="small mt-1" role="alert" style={{ color: "#b3261e", fontSize: "0.78rem" }}>
                                            Please enter your island name.
                                        </div>
                                    ) : (
                                        <div id="islandHint" className="mt-1" style={{ fontSize: "0.76rem", color: "#5b6e63" }}>
                                            Your island name in Animal Crossing
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Badge Icon Picker */}
                            <div className="mt-3">
                                <div className="d-flex align-items-center justify-content-between mb-2">
                                    <label className="form-label small fw-bold mb-0" style={{ color: "#1d3328" }}>
                                        Character badge icon <span style={{ fontWeight: 400, color: "#5b6e63" }}>(optional)</span>
                                    </label>
                                    <span
                                        className="badge rounded-pill px-2 py-0.5"
                                        style={{ background: "#e6f4ec", color: "#166b3a", fontSize: "0.74rem" }}
                                    >
                                        {characterIcons.find((i) => i.id === charIcon)?.label || "Selected"}
                                    </span>
                                </div>
                                <div className="d-flex flex-wrap gap-2" role="group" aria-label="Character badge icons">
                                    {characterIcons.map((ic) => (
                                        <button
                                            key={ic.id}
                                            type="button"
                                            onClick={() => setCharIcon(ic.id)}
                                            aria-label={`Select ${ic.label} icon`}
                                            aria-pressed={charIcon === ic.id}
                                            className="btn btn-sm rounded-circle d-flex align-items-center justify-content-center p-0"
                                            style={{
                                                width: "36px",
                                                height: "36px",
                                                background: charIcon === ic.id ? "#1f8a4c" : "#fff",
                                                color: charIcon === ic.id ? "#fff" : "#1d3328",
                                                border: `1.5px solid ${charIcon === ic.id ? "#1f8a4c" : "#cfdcd3"}`,
                                                boxShadow: charIcon === ic.id ? "0 2px 6px rgba(31, 138, 76, 0.3)" : undefined,
                                                cursor: "pointer",
                                            }}
                                            title={ic.label}
                                        >
                                            <i className={`fa-solid ${ic.id}`} aria-hidden="true" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer with Leaf Primary Button */}
                        <div
                            className="py-3 px-4 d-flex align-items-center justify-content-end gap-2 border-top"
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
                                    cursor: "pointer",
                                }}
                                onClick={onClose}
                                disabled={isSavingChar}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="btn text-white fw-bold px-4 py-2 small d-inline-flex align-items-center gap-1.5"
                                style={{
                                    borderRadius: "14px",
                                    background: "#1f8a4c",
                                    border: "1.5px solid #1f8a4c",
                                    boxShadow: "0 4px 0 #166b3a",
                                    color: "#fff",
                                    cursor: "pointer",
                                }}
                                disabled={isSavingChar}
                            >
                                {isSavingChar ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                                        <span>Saving…</span>
                                    </>
                                ) : (
                                    <>
                                        <i className="fa-solid fa-floppy-disk" aria-hidden="true" />
                                        <span>{editingCharId ? "Save changes" : "Create character"}</span>
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
