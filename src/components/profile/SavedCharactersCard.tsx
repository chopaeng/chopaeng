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

const MAX_SLOTS = 3;
const SLOTS = Array.from({ length: MAX_SLOTS }, (_, i) => i);

const STYLES = `
.cpsc {
    --ink: #1d3328; --ink-soft: #5b6e63; --leaf: #1f8a4c; --leaf-dark: #166b3a;
    --line: #cfdcd3; --error: #b3261e;
    color: var(--ink);
    background: #fff; border-radius: 24px; overflow: hidden;
    box-shadow: 0 1px 0 rgba(29,51,40,.04), 0 14px 30px -18px rgba(29,51,40,.3);
}

/* Cover */
.cpsc__cover { background: var(--leaf); color: #fff; padding: 1.2rem 1.4rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
.cpsc__who { display: flex; align-items: center; gap: .9rem; min-width: 0; }
.cpsc__crest { width: 48px; height: 48px; flex: none; border-radius: 50%; display: grid; place-items: center; background: rgba(255,255,255,.16); border: 2px dashed rgba(255,255,255,.55); font-size: 1.15rem; }
.cpsc__title { margin: 0; font-size: 1.2rem; font-weight: 800; line-height: 1.15; }
.cpsc__meter { display: flex; align-items: center; gap: .5rem; margin-top: .3rem; font-size: .82rem; font-weight: 600; opacity: .95; }
.cpsc__dots { display: inline-flex; gap: 4px; }
.cpsc__dot { width: 10px; height: 10px; border-radius: 50%; border: 2px solid rgba(255,255,255,.7); }
.cpsc__dot--on { background: #fff; border-color: #fff; }
.cpsc__seam { border-top: 3px dashed #fff; margin: 0 14px; position: relative; top: -2px; opacity: .85; }
.cpsc__body { padding: 1rem 1.4rem 1.4rem; }

/* Info row */
.cpsc__info { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: .6rem; padding-bottom: .85rem; margin-bottom: .85rem; border-bottom: 1.5px dashed var(--line); }
.cpsc__hint { margin: 0; font-size: .85rem; line-height: 1.45; color: var(--ink-soft); font-weight: 600; max-width: 52ch; }
.cpsc__sync { display: inline-flex; align-items: center; gap: .45rem; padding: .25rem .7rem; border-radius: 999px; border: 1.5px solid var(--line); background: #fff; font-size: .78rem; font-weight: 700; color: var(--leaf-dark); white-space: nowrap; }
.cpsc__sync[data-syncing="true"] { color: #1d4fb8; }

/* Buttons */
.cpsc-btn { display: inline-flex; align-items: center; justify-content: center; gap: .45rem; border: 1.5px solid var(--line); background: #fff; color: var(--ink); border-radius: 12px; padding: .5rem .95rem; font-size: .86rem; font-weight: 700; transition: border-color .15s ease, background .15s ease; }
.cpsc-btn:hover:not(:disabled) { border-color: var(--leaf); background: #f6faf7; }
.cpsc-btn i { color: var(--leaf); }
.cpsc-btn--cover { background: rgba(255,255,255,.18); border-color: rgba(255,255,255,.5); color: #fff; }
.cpsc-btn--cover:hover:not(:disabled) { background: rgba(255,255,255,.3); border-color: #fff; }
.cpsc-btn--cover i { color: #fff; }
.cpsc-btn:disabled { opacity: .65; cursor: not-allowed; }
.cpsc-btn--sm { padding: .35rem .8rem; font-size: .8rem; border-radius: 10px; }
.cpsc-btn--set { border-color: var(--leaf); color: var(--leaf-dark); }

.cpsc-icon { width: 36px; height: 36px; display: grid; place-items: center; border-radius: 50%; border: 1.5px solid var(--line); background: #fff; color: var(--ink-soft); font-size: .8rem; transition: border-color .15s ease, background .15s ease, color .15s ease; }
.cpsc-icon:hover { border-color: var(--leaf); color: var(--ink); background: #f6faf7; }
.cpsc-icon--danger { color: var(--error); border-color: #e8bcb8; }
.cpsc-icon--danger:hover { border-color: var(--error); background: #fdecea; color: var(--error); }

/* Slots */
.cpsc-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: .65rem; }
.cpsc-slot { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: .6rem .9rem; border: 1.5px solid var(--line); border-radius: 16px; padding: .75rem .9rem; background: #fff; }
.cpsc-slot[data-active="true"] { background: #f1faf4; border-color: var(--leaf); box-shadow: inset 4px 0 0 var(--leaf); }
.cpsc-id { display: flex; align-items: center; gap: .75rem; min-width: 0; flex: 1 1 200px; }
.cpsc-avatar { width: 40px; height: 40px; flex: none; border-radius: 50%; display: grid; place-items: center; background: #eef3ef; color: var(--ink-soft); font-size: .95rem; border: 1.5px solid var(--line); }
.cpsc-slot[data-active="true"] .cpsc-avatar { background: var(--leaf); border-color: var(--leaf); color: #fff; }
.cpsc-text { min-width: 0; }
.cpsc-ign { display: flex; align-items: center; gap: .5rem; min-width: 0; }
.cpsc-ign strong { font-size: 1rem; font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cpsc-slotno { flex: none; padding: .05rem .5rem; border-radius: 999px; background: #eef3ef; color: var(--ink-soft); font-size: .72rem; font-weight: 800; }
.cpsc-island { display: flex; align-items: center; gap: .4rem; font-size: .82rem; font-weight: 600; color: var(--ink-soft); }
.cpsc-island i { color: var(--leaf); }
.cpsc-island span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cpsc-actions { display: flex; align-items: center; gap: .5rem; margin-left: auto; }
.cpsc-active { display: inline-flex; align-items: center; gap: .35rem; padding: .25rem .7rem; border-radius: 999px; background: var(--leaf); color: #fff; font-size: .78rem; font-weight: 800; }

/* Empty slot */
.cpsc-empty { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: .75rem; text-align: left; border: 2px dashed var(--line); border-radius: 16px; background: #fafcfb; padding: .75rem .9rem; color: var(--ink); transition: border-color .15s ease, background .15s ease; }
.cpsc-empty:hover { border-color: var(--leaf); background: #f3faf6; }
.cpsc-empty .cpsc-avatar { background: #fff; border-style: dashed; }
.cpsc-empty strong { display: block; font-size: .92rem; font-weight: 800; }
.cpsc-empty small { display: block; font-size: .8rem; color: var(--ink-soft); font-weight: 600; }
.cpsc-add { flex: none; padding: .2rem .65rem; border-radius: 999px; background: #e6f4ec; color: var(--leaf-dark); font-size: .78rem; font-weight: 800; }

.cpsc :is(button):focus-visible { outline: 3px solid #0f5132; outline-offset: 2px; }
.cpsc__cover button:focus-visible { outline-color: #fff; }
@media (prefers-reduced-motion: reduce) { .cpsc * { transition: none !important; } }
`;

export const SavedCharactersCard: React.FC<SavedCharactersCardProps> = ({
    characters,
    isSyncingDb,
    onOpenAddCharacter,
    onOpenEditCharacter,
    onDeleteCharacter,
    onSetActiveCharacter,
}) => {
    const isFull = characters.length >= MAX_SLOTS;

    return (
        <section className="cpsc" aria-label="Saved in-game characters">
            <style>{STYLES}</style>

            <header className="cpsc__cover">
                <div className="cpsc__who">
                    <div className="cpsc__crest" aria-hidden="true">
                        <i className="fa-solid fa-users" />
                    </div>
                    <div>
                        <h2 className="ac-font cpsc__title">Saved in-game characters</h2>
                        <div className="cpsc__meter">
                            <span className="cpsc__dots" aria-hidden="true">
                                {SLOTS.map((i) => (
                                    <span key={i} className={`cpsc__dot ${i < characters.length ? "cpsc__dot--on" : ""}`} />
                                ))}
                            </span>
                            <span>
                                {characters.length} of {MAX_SLOTS} slots used
                            </span>
                        </div>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={onOpenAddCharacter}
                    disabled={isFull}
                    className="cpsc-btn cpsc-btn--cover"
                >
                    <i className={`fa-solid ${isFull ? "fa-lock" : "fa-plus"}`} aria-hidden="true" />
                    <span>{isFull ? "Slots full" : "Add character"}</span>
                </button>
            </header>
            <div className="cpsc__seam" aria-hidden="true" />

            <div className="cpsc__body">
                <div className="cpsc__info">
                    <p className="cpsc__hint">
                        Your active character fills in your IGN and island name for the order bot and drop bot.
                    </p>
                    <span className="cpsc__sync" data-syncing={isSyncingDb} role="status" aria-live="polite">
                        <i
                            className={isSyncingDb ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-cloud-arrow-up"}
                            aria-hidden="true"
                        />
                        {isSyncingDb ? "Syncing to ChoBot…" : "Saved to ChoBot"}
                    </span>
                </div>

                <ul className="cpsc-list">
                    {SLOTS.map((slotIdx) => {
                        const char = characters[slotIdx];
                        const slotNumber = slotIdx + 1;

                        if (!char) {
                            return (
                                <li key={`empty-slot-${slotIdx}`}>
                                    <button type="button" className="cpsc-empty" onClick={onOpenAddCharacter}>
                                        <span className="d-flex align-items-center gap-3">
                                            <span className="cpsc-avatar" aria-hidden="true">
                                                <i className="fa-solid fa-plus" />
                                            </span>
                                            <span>
                                                <strong>Empty slot {slotNumber}</strong>
                                                <small>Add an in-game character</small>
                                            </span>
                                        </span>
                                        <span className="cpsc-add" aria-hidden="true">Add</span>
                                    </button>
                                </li>
                            );
                        }

                        const isActive = !!char.isDefault;

                        return (
                            <li key={char.id} className="cpsc-slot" data-active={isActive}>
                                <div className="cpsc-id">
                                    <span className="cpsc-avatar" aria-hidden="true">
                                        <i className={`fa-solid ${char.icon || "fa-user"}`} />
                                    </span>
                                    <div className="cpsc-text">
                                        <div className="cpsc-ign">
                                            <strong className="ac-font">{char.ign}</strong>
                                            <span className="cpsc-slotno">Slot {slotNumber}</span>
                                        </div>
                                        <div className="cpsc-island">
                                            <i className="fa-solid fa-tree" aria-hidden="true" />
                                            <span>{char.islandName}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="cpsc-actions">
                                    {isActive ? (
                                        <span className="cpsc-active">
                                            <i className="fa-solid fa-check" aria-hidden="true" />
                                            Active
                                        </span>
                                    ) : (
                                        <button
                                            type="button"
                                            className="cpsc-btn cpsc-btn--sm cpsc-btn--set"
                                            onClick={() => onSetActiveCharacter(char)}
                                            aria-label={`Set ${char.ign} as active character`}
                                        >
                                            Set active
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        className="cpsc-icon"
                                        onClick={() => onOpenEditCharacter(char)}
                                        title={`Edit ${char.ign}`}
                                        aria-label={`Edit ${char.ign}`}
                                    >
                                        <i className="fa-solid fa-pen" aria-hidden="true" />
                                    </button>
                                    <button
                                        type="button"
                                        className="cpsc-icon cpsc-icon--danger"
                                        onClick={() => onDeleteCharacter(char)}
                                        title={`Delete ${char.ign}`}
                                        aria-label={`Delete ${char.ign}`}
                                    >
                                        <i className="fa-solid fa-trash" aria-hidden="true" />
                                    </button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </section>
    );
};

export default SavedCharactersCard;