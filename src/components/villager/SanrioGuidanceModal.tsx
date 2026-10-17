import React, { useEffect, useId, useRef, useState } from "react";
import { playChimeClick } from "../../utils/kkAudioSynthesizer";
import { injectIslandVillager } from "../../utils/dropBotApi";
import { triggerConfetti } from "../../utils/confetti";

export interface SanrioVillagerInfo {
    name: string;
    collab: string;
    species: string;
    personality: string;
    emoji: string;
    image: string;
    catchphrase: string;
}

export const SANRIO_VILLAGERS: SanrioVillagerInfo[] = [
    {
        name: "Chai",
        collab: "Cinnamoroll",
        species: "Elephant",
        personality: "Peppy",
        emoji: "☕",
        image: "https://dodo.ac/np/images/2/27/Chai_NH.png",
        catchphrase: "flap flap",
    },
    {
        name: "Chelsea",
        collab: "My Melody",
        species: "Deer",
        personality: "Sweet (Normal)",
        emoji: "🌸",
        image: "https://dodo.ac/np/images/2/25/Chelsea_NH.png",
        catchphrase: "pound cake",
    },
    {
        name: "Étoile",
        collab: "Little Twin Stars",
        species: "Sheep",
        personality: "Sweet (Normal)",
        emoji: "⭐",
        image: "https://dodo.ac/np/images/8/8c/%C3%89toile_NH.png",
        catchphrase: "fuzzy",
    },
    {
        name: "Marty",
        collab: "Pompompurin",
        species: "Bear cub",
        personality: "Lazy",
        emoji: "🍮",
        image: "https://dodo.ac/np/images/4/46/Marty_NH.png",
        catchphrase: "pompom",
    },
    {
        name: "Rilla",
        collab: "Hello Kitty",
        species: "Gorilla",
        personality: "Peppy",
        emoji: "🎀",
        image: "https://dodo.ac/np/images/5/52/Rilla_NH.png",
        catchphrase: "hello",
    },
    {
        name: "Toby",
        collab: "Kerokerokeroppi",
        species: "Rabbit",
        personality: "Smug",
        emoji: "🍵",
        image: "https://dodo.ac/np/images/c/c5/Toby_NH.png",
        catchphrase: "ribbit",
    },
];

export const PLACEHOLDER_VILLAGERS = [
    { name: "Raymond", details: "Smug • Cat (Recommended)", image: "https://dodo.ac/np/images/2/2a/Raymond_NH.png" },
    { name: "Marshal", details: "Smug • Squirrel", image: "https://dodo.ac/np/images/2/27/Marshal_NH.png" },
    { name: "Shino", details: "Peppy • Deer", image: "https://dodo.ac/np/images/7/7b/Shino_NH.png" },
    { name: "Sasha", details: "Lazy • Rabbit", image: "https://dodo.ac/np/images/1/18/Sasha_NH.png" },
    { name: "Judy", details: "Snooty • Bear cub", image: "https://dodo.ac/np/images/d/d4/Judy_NH.png" },
    { name: "Ankha", details: "Snooty • Cat", image: "https://dodo.ac/np/images/5/56/Ankha_NH.png" },
];

export function isSanrioVillager(name?: string | null): boolean {
    if (!name) return false;
    const clean = name.trim().toLowerCase();
    return SANRIO_VILLAGERS.some(
        (v) => v.name.toLowerCase() === clean || (clean.startsWith("etoile") && v.name === "Étoile")
    );
}

interface SanrioGuidanceModalProps {
    isOpen: boolean;
    onClose: () => void;
    targetIslandName?: string | null;
    initialVillagerName?: string | null;
    onInjectSuccess?: (villagerName: string, plot: number) => void;
}

const STYLES = `
.cpr-backdrop {
    position: fixed; inset: 0; z-index: 1090;
    display: flex; align-items: center; justify-content: center;
    padding: 1rem;
    background: rgba(35, 15, 25, .65);
    backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
    animation: cpr-fade .18s ease-out;
}
.cpr {
    --ink: #2b1b24; --ink-soft: #634d59; --pink: #ec4899; --pink-dark: #be185d; --pink-soft: #fdf2f8; --line: #fbcfe8;
    width: 100%; max-width: 740px; max-height: calc(100dvh - 2rem);
    display: flex; flex-direction: column;
    background: #fff; color: var(--ink); border-radius: 28px; overflow: hidden;
    box-shadow: 0 30px 60px -20px rgba(70, 20, 45, .55);
    animation: cpr-rise .22s ease-out;
    outline: none;
}
@keyframes cpr-fade { from { opacity: 0 } to { opacity: 1 } }
@keyframes cpr-rise { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }

.cpr__cover {
    flex: none;
    background: linear-gradient(135deg, #ec4899 0%, #f43f5e 100%);
    color: #fff;
    padding: 1.3rem 3.4rem 1.2rem 1.5rem;
    display: flex; gap: 1rem; align-items: center; position: relative;
}
.cpr__crest {
    width: 52px; height: 52px; flex: none; border-radius: 50%;
    display: grid; place-items: center;
    background: rgba(255,255,255,.2);
    border: 2px dashed rgba(255,255,255,.65);
    font-size: 1.5rem;
}
.cpr__title { margin: 0; font-size: 1.35rem; line-height: 1.15; font-weight: 800; font-family: var(--font-heading, "Nunito", sans-serif); }
.cpr__sub { margin: .25rem 0 0; font-size: .84rem; opacity: .95; line-height: 1.4; }
.cpr__close {
    position: absolute; top: .8rem; right: .8rem; width: 36px; height: 36px;
    border: 0; border-radius: 50%; background: rgba(255,255,255,.2);
    color: #fff; display: grid; place-items: center; transition: background .15s ease;
}
.cpr__close:hover { background: rgba(255,255,255,.35); }

.cpr__body { flex: 1; min-height: 0; overflow-y: auto; padding: 1.2rem 1.5rem 1.25rem; }

.cpr-card {
    background: var(--pink-soft);
    border: 1.5px solid var(--line);
    border-radius: 18px;
    padding: 1rem 1.2rem;
    margin-bottom: 1.2rem;
}

.cpr-villagers-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(105px, 1fr));
    gap: .65rem;
    margin: .8rem 0;
}
.cpr-vcard {
    border: 1.5px solid var(--line);
    border-radius: 14px;
    background: #fff;
    padding: .6rem .4rem;
    text-align: center;
    cursor: pointer;
    transition: all .15s ease;
}
.cpr-vcard:hover { border-color: var(--pink); transform: translateY(-2px); }
.cpr-vcard.is-active {
    border-color: var(--pink);
    background: #fdf2f8;
    box-shadow: 0 0 0 2px var(--pink);
}
.cpr-vcard__img {
    width: 48px; height: 48px; object-fit: contain; margin: 0 auto .3rem; display: block;
}
.cpr-vcard__name { font-weight: 800; font-size: .84rem; line-height: 1.1; display: block; }
.cpr-vcard__collab { font-size: .7rem; color: var(--pink-dark); font-weight: 700; display: block; margin-top: 2px; }

.cpr-step {
    display: flex; gap: 1rem; padding: 1rem 0; border-bottom: 1.5px dashed var(--line);
}
.cpr-step:last-child { border-bottom: 0; padding-bottom: 0; }
.cpr-step__num {
    width: 38px; height: 38px; flex: none; border-radius: 50%;
    display: grid; place-items: center;
    background: #fce7f3; color: var(--pink-dark);
    font-weight: 800; font-size: 1rem;
}
.cpr-step__num.is-done {
    background: #10b981; color: #fff;
}
.cpr-step__main { min-width: 0; flex: 1; }
.cpr-step__head { display: flex; align-items: center; justify-content: space-between; gap: .5rem; flex-wrap: wrap; margin-bottom: .25rem; }
.cpr-step__title { margin: 0; font-size: 1.02rem; font-weight: 800; }
.cpr-step__desc { margin: 0; font-size: .88rem; line-height: 1.5; color: var(--ink-soft); font-weight: 600; }

.cpr-badge {
    padding: .15rem .6rem; border-radius: 999px; font-size: .75rem; font-weight: 800;
}
.cpr-badge--pink { background: #fce7f3; color: var(--pink-dark); }
.cpr-badge--emerald { background: #d1fae5; color: #065f46; }

.cpr__foot {
    flex: none; display: flex; align-items: center; justify-content: space-between;
    padding: 1rem 1.5rem; border-top: 2px dashed var(--line); background: #fff; flex-wrap: wrap; gap: .8rem;
}

.cpr-btn {
    display: inline-flex; align-items: center; justify-content: center; gap: .45rem;
    border: 1.5px solid var(--line); background: #fff; color: var(--ink);
    border-radius: 12px; padding: .6rem 1rem; font-weight: 700; font-size: .88rem;
    transition: all .15s ease;
}
.cpr-btn:hover:not(:disabled) { border-color: var(--pink); background: #fdf2f8; }
.cpr-btn--primary {
    background: var(--pink); border-color: var(--pink); color: #fff; font-weight: 800;
    box-shadow: 0 3px 0 var(--pink-dark);
}
.cpr-btn--primary:hover:not(:disabled) { background: var(--pink-dark); border-color: var(--pink-dark); }
.cpr-btn--primary:disabled { background: #fbcfe8; border-color: #fbcfe8; box-shadow: none; cursor: not-allowed; }
`;

export const SanrioGuidanceModal: React.FC<SanrioGuidanceModalProps> = ({
    isOpen,
    onClose,
    targetIslandName,
    initialVillagerName,
    onInjectSuccess,
}) => {
    const titleId = useId();
    const dialogRef = useRef<HTMLDivElement>(null);

    const [selectedTarget, setSelectedTarget] = useState<string>(() => {
        if (initialVillagerName && isSanrioVillager(initialVillagerName)) {
            return initialVillagerName;
        }
        return "Chai";
    });

    const [selectedPlaceholder, setSelectedPlaceholder] = useState<string>("Raymond");
    const [step1Done, setStep1Done] = useState(false);
    const [step2Done, setStep2Done] = useState(false);
    const [isInjecting1, setIsInjecting1] = useState(false);
    const [isInjecting2, setIsInjecting2] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);

    useEffect(() => {
        if (initialVillagerName && isSanrioVillager(initialVillagerName)) {
            setSelectedTarget(initialVillagerName);
        }
    }, [initialVillagerName]);

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const playSound = () => {
        try { playChimeClick(); } catch {}
    };

    const targetVillagerObj = SANRIO_VILLAGERS.find(
        (v) => v.name.toLowerCase() === selectedTarget.toLowerCase()
    ) || SANRIO_VILLAGERS[0];

    const handleExecuteStep1 = async () => {
        if (!targetIslandName) return;
        playSound();
        setIsInjecting1(true);
        setStatusMessage(null);
        try {
            const res = await injectIslandVillager(targetIslandName, selectedPlaceholder, 1);
            if (res.success) {
                setStep1Done(true);
                triggerConfetti({ theme: "gold", particleCount: 50 });
                setStatusMessage(`✅ Step 1 complete! Plot 1 on ${targetIslandName} now has placeholder "${selectedPlaceholder}". Board your flight now!`);
            } else {
                setStatusMessage(`❌ Step 1 error: ${res.error || "Injection failed. Make sure the bot is online."}`);
            }
        } catch (err: any) {
            setStatusMessage(`❌ Network error: ${err?.message || "Failed to contact bot."}`);
        } finally {
            setIsInjecting1(false);
        }
    };

    const handleExecuteStep2 = async () => {
        if (!targetIslandName) return;
        playSound();
        setIsInjecting2(true);
        setStatusMessage(null);
        try {
            const res = await injectIslandVillager(targetIslandName, targetVillagerObj.name, 1);
            if (res.success) {
                setStep2Done(true);
                triggerConfetti({ theme: "rainbow", particleCount: 80 });
                setStatusMessage(`🎉 Step 2 complete! ${targetVillagerObj.name} is now inside the Plot 1 house! Walk to the house and invite them to move in!`);
                if (onInjectSuccess) {
                    onInjectSuccess(targetVillagerObj.name, 1);
                }
            } else {
                setStatusMessage(`❌ Step 2 error: ${res.error || "Injection failed. Make sure the bot is online."}`);
            }
        } catch (err: any) {
            setStatusMessage(`❌ Network error: ${err?.message || "Failed to contact bot."}`);
        } finally {
            setIsInjecting2(false);
        }
    };

    return (
        <div className="cpr-backdrop" role="presentation" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <style>{STYLES}</style>
            <div
                className="cpr"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                ref={dialogRef}
                tabIndex={-1}
            >
                <header className="cpr__cover">
                    <div className="cpr__crest" aria-hidden="true">
                        🎀
                    </div>
                    <div>
                        <h2 id={titleId} className="cpr__title">
                            Sanrio & Amiibo Villager Guide
                        </h2>
                        <p className="cpr__sub">
                            Nintendo restriction workaround: 2-step swap technique to adopt Sanrio villagers
                        </p>
                    </div>
                    <button
                        type="button"
                        className="cpr__close"
                        aria-label="Close guide"
                        onClick={() => { playSound(); onClose(); }}
                    >
                        <i className="fa-solid fa-xmark" aria-hidden="true" />
                    </button>
                </header>

                <div className="cpr__body">
                    <div className="cpr-card">
                        <div className="d-flex align-items-center gap-2 mb-2">
                            <i className="fa-solid fa-circle-info" style={{ color: "var(--pink)" }} />
                            <strong style={{ fontSize: ".92rem" }}>Why is a 2-step process required?</strong>
                        </div>
                        <p style={{ fontSize: ".84rem", margin: 0, lineHeight: 1.55 }}>
                            In <em>Animal Crossing: New Horizons</em>, Sanrio villagers cannot be invited from boxes on another player's island normally.
                            To bypass this restriction, SysBot loads a <strong>standard placeholder villager</strong> into Plot 1 before you fly. Once you land on the island, we swap in your chosen <strong>Sanrio character</strong>. You can then enter their house and invite them!
                        </p>
                    </div>

                    <div className="mb-3">
                        <label className="fw-bold mb-1 d-flex align-items-center justify-content-between" style={{ fontSize: ".88rem" }}>
                            <span>1. Select your target Sanrio villager:</span>
                            <span className="cpr-badge cpr-badge--pink">
                                {targetVillagerObj.emoji} {targetVillagerObj.name} ({targetVillagerObj.collab})
                            </span>
                        </label>
                        <div className="cpr-villagers-grid">
                            {SANRIO_VILLAGERS.map((v) => {
                                const isActive = selectedTarget.toLowerCase() === v.name.toLowerCase();
                                return (
                                    <div
                                        key={v.name}
                                        className={`cpr-vcard ${isActive ? "is-active" : ""}`}
                                        onClick={() => { playSound(); setSelectedTarget(v.name); }}
                                    >
                                        <img src={v.image} alt={v.name} className="cpr-vcard__img" />
                                        <span className="cpr-vcard__name">{v.name}</span>
                                        <span className="cpr-vcard__collab">{v.collab}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {statusMessage && (
                        <div
                            className="p-3 mb-3 rounded-3"
                            style={{
                                background: statusMessage.startsWith("✅") || statusMessage.startsWith("🎉") ? "#ecfdf5" : "#fef2f2",
                                border: `1.5px solid ${statusMessage.startsWith("✅") || statusMessage.startsWith("🎉") ? "#a7f3d0" : "#fecaca"}`,
                                fontSize: ".86rem",
                                fontWeight: 700,
                                color: statusMessage.startsWith("✅") || statusMessage.startsWith("🎉") ? "#065f46" : "#991b1b",
                            }}
                        >
                            {statusMessage}
                        </div>
                    )}

                    <div className="border rounded-4 p-3 bg-light">
                        <div className="cpr-step">
                            <div className={`cpr-step__num ${step1Done ? "is-done" : ""}`}>
                                {step1Done ? <i className="fa-solid fa-check" /> : "1"}
                            </div>
                            <div className="cpr-step__main">
                                <div className="cpr-step__head">
                                    <h3 className="cpr-step__title">Pre-Flight Step: Inject Placeholder</h3>
                                    <span className="cpr-badge cpr-badge--pink">Plot 1</span>
                                </div>
                                <p className="cpr-step__desc mb-2">
                                    Before boarding your flight at Dodo Airlines, inject a standard placeholder villager into <strong>Plot 1</strong>.
                                </p>
                                <div className="d-flex align-items-center gap-2 flex-wrap mb-2">
                                    <select
                                        className="form-select form-select-sm w-auto rounded-pill"
                                        value={selectedPlaceholder}
                                        onChange={(e) => setSelectedPlaceholder(e.target.value)}
                                        style={{ fontSize: ".82rem", fontWeight: 700 }}
                                    >
                                        {PLACEHOLDER_VILLAGERS.map((p) => (
                                            <option key={p.name} value={p.name}>
                                                {p.name} ({p.details})
                                            </option>
                                        ))}
                                    </select>

                                    {targetIslandName && (
                                        <button
                                            type="button"
                                            className="cpr-btn cpr-btn--primary"
                                            disabled={isInjecting1 || step1Done}
                                            onClick={handleExecuteStep1}
                                        >
                                            {isInjecting1 ? (
                                                <span className="spinner-border spinner-border-sm" />
                                            ) : (
                                                <i className="fa-solid fa-paper-plane" />
                                            )}
                                            <span>{step1Done ? "Placeholder Injected" : `Inject ${selectedPlaceholder} (Plot 1)`}</span>
                                        </button>
                                    )}
                                </div>
                                <div className="font-monospace text-muted" style={{ fontSize: ".76rem" }}>
                                    SysBot Command: <code>!injectvillager {selectedPlaceholder} 1</code>
                                </div>
                            </div>
                        </div>

                        <div className="cpr-step">
                            <div className={`cpr-step__num ${step1Done ? "is-done" : ""}`}>
                                ✈️
                            </div>
                            <div className="cpr-step__main">
                                <div className="cpr-step__head">
                                    <h3 className="cpr-step__title">Board Flight & Land</h3>
                                    <span className="cpr-badge cpr-badge--pink">
                                        {targetIslandName ? `Target: ${targetIslandName}` : "Treasure Island"}
                                    </span>
                                </div>
                                <p className="cpr-step__desc">
                                    Fly to the island using the Dodo code. <strong>Wait until your character lands completely and exits the airport.</strong>
                                </p>
                            </div>
                        </div>

                        <div className="cpr-step">
                            <div className={`cpr-step__num ${step2Done ? "is-done" : ""}`}>
                                {step2Done ? <i className="fa-solid fa-check" /> : "2"}
                            </div>
                            <div className="cpr-step__main">
                                <div className="cpr-step__head">
                                    <h3 className="cpr-step__title">On-Island Step: Inject {targetVillagerObj.name}</h3>
                                    <span className="cpr-badge cpr-badge--pink">Plot 1</span>
                                </div>
                                <p className="cpr-step__desc mb-2">
                                    While standing on the island, inject <strong>{targetVillagerObj.name}</strong> into Plot 1.
                                </p>
                                {targetIslandName && (
                                    <button
                                        type="button"
                                        className="cpr-btn cpr-btn--primary mb-2"
                                        disabled={isInjecting2 || !step1Done || step2Done}
                                        onClick={handleExecuteStep2}
                                    >
                                        {isInjecting2 ? (
                                            <span className="spinner-border spinner-border-sm" />
                                        ) : (
                                            <i className="fa-solid fa-wand-magic-sparkles" />
                                        )}
                                        <span>{step2Done ? `${targetVillagerObj.name} Injected` : `Inject ${targetVillagerObj.name} (Plot 1)`}</span>
                                    </button>
                                )}
                                <div className="font-monospace text-muted" style={{ fontSize: ".76rem" }}>
                                    SysBot Command: <code>!injectvillager {targetVillagerObj.name} 1</code>
                                </div>
                            </div>
                        </div>

                        <div className="cpr-step">
                            <div className={`cpr-step__num ${step2Done ? "is-done" : ""}`}>
                                🏡
                            </div>
                            <div className="cpr-step__main">
                                <div className="cpr-step__head">
                                    <h3 className="cpr-step__title">Enter House & Invite</h3>
                                    <span className="cpr-badge cpr-badge--emerald">Move-In</span>
                                </div>
                                <p className="cpr-step__desc">
                                    Walk to the <strong>Plot 1 house</strong> on the island. Enter the house, talk to the villager inside, and invite them to move to your island!
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <footer className="cpr__foot">
                    <span className="text-muted" style={{ fontSize: ".8rem" }}>
                        {targetIslandName ? `Active Island: ${targetIslandName}` : "Tip: Select an island on DropBot to enable 1-click injection"}
                    </span>
                    <button
                        type="button"
                        className="cpr-btn cpr-btn--primary"
                        onClick={() => { playSound(); onClose(); }}
                    >
                        Got it!
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default SanrioGuidanceModal;
