import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
    ResidentPassportCard,
    FRUIT_ICONS,
    ZODIAC_SIGNS,
    PERSONALITY_THEMES,
    PASSPORT_SKINS,
    PASSPORT_PATTERNS,
} from "../passport/ResidentPassportCard";
import { playChimeClick } from "../../utils/kkAudioSynthesizer";
import {
    cleanPassportUsername,
    savePassportToDb,
    type PublicPassportData,
} from "../../utils/userProfileApi";
import { getAuthToken } from "../../context/authToken";
import type { CatalogEntity } from "../../data/commandBuilderData";

interface PassportStudioProps {
    passportData: PublicPassportData;
    setPassportData: React.Dispatch<React.SetStateAction<PublicPassportData>>;
    passportDirty: boolean;
    setPassportDirty: (dirty: boolean) => void;
    lastSavedDbTime: number | null;
    setLastSavedDbTime: (time: number | null) => void;
    savingPassport: boolean;
    setSavingPassport: (saving: boolean) => void;
    passportNotice: { type: "success" | "warning" | "error"; message: string } | null;
    setPassportNotice: React.Dispatch<
        React.SetStateAction<{ type: "success" | "warning" | "error"; message: string } | null>
    >;
    catalogData?: {
        items?: CatalogEntity[];
        villagers?: CatalogEntity[];
    } | null;
    profileUser?: {
        avatar?: string;
        discord_name?: string;
    } | null;
    authUser?: {
        username?: string;
        avatar?: string;
    } | null;
    setPrefNotice: (msg: string | null) => void;
}

export const PassportStudio: React.FC<PassportStudioProps> = ({
    passportData,
    setPassportData,
    passportDirty,
    setPassportDirty,
    lastSavedDbTime,
    setLastSavedDbTime,
    savingPassport,
    setSavingPassport,
    passportNotice,
    setPassportNotice,
    catalogData,
    profileUser,
    authUser,
    setPrefNotice,
}) => {
    const [studioViewMode, setStudioViewMode] = useState<"split" | "card" | "editor">("split");
    const [studioSection, setStudioSection] = useState<
        "identity" | "vibe" | "motto" | "besties" | "items" | "privacy"
    >("identity");
    const [villagerSearchQuery, setVillagerSearchQuery] = useState("");
    const [itemSearchQuery, setItemSearchQuery] = useState("");
    const [passportLinkCopied, setPassportLinkCopied] = useState(false);

    const handleSaveToChoBot = async () => {
        setSavingPassport(true);
        playChimeClick();
        const token = getAuthToken();
        const res = await savePassportToDb(passportData, token);
        setSavingPassport(false);
        setPassportDirty(false);
        if (res.savedToDb) {
            setLastSavedDbTime(Date.now());
        }
        setPrefNotice(res.message);
        setPassportNotice({
            type: res.savedToDb ? "success" : "warning",
            message: res.message,
        });
        setTimeout(() => setPassportNotice(null), 4500);
        setTimeout(() => setPrefNotice(null), 3500);
    };

    return (
        <div className="col-12">
            <div className="pf-card shadow-sm">
                {/* Studio Command Header */}
                <div className="studio-hero-bar mb-4 d-flex align-items-center justify-content-between flex-wrap gap-3">
                    <div className="d-flex align-items-center gap-3">
                        <div
                            className="icon-bubble bg-success bg-opacity-10 text-success shadow-2xs"
                            style={{ width: 48, height: 48, fontSize: "1.35rem" }}
                        >
                            <i className="fa-solid fa-passport"></i>
                        </div>
                        <div>
                            <div className="d-flex align-items-center gap-2 flex-wrap">
                                <h2 className="h5 ac-font mb-0 text-dark">Nook Inc. Resident Passport Studio</h2>
                                <span className="badge bg-success bg-opacity-15 text-success border border-success border-opacity-25 rounded-pill x-small fw-bold">
                                    <i className="fa-solid fa-leaf me-1"></i>Official DAL Studio
                                </span>
                            </div>
                            <p className="tiny-text text-muted mb-0">
                                Customize your authentic in-game passport, preview updates in real-time, and share your resident card.
                            </p>
                        </div>
                    </div>

                    {/* View Mode & Quick Actions */}
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                        {/* View Mode Switcher */}
                        <div className="studio-mode-pill-group">
                            <button
                                type="button"
                                className={`studio-mode-pill-btn ${studioViewMode === "split" ? "active" : ""}`}
                                onClick={() => {
                                    playChimeClick();
                                    setStudioViewMode("split");
                                }}
                                title="Split Studio: Live Card Preview + Editor"
                            >
                                <i className="fa-solid fa-table-columns"></i>
                                <span className="d-none d-sm-inline">Split Studio</span>
                            </button>
                            <button
                                type="button"
                                className={`studio-mode-pill-btn ${studioViewMode === "card" ? "active" : ""}`}
                                onClick={() => {
                                    playChimeClick();
                                    setStudioViewMode("card");
                                }}
                                title="Full Card Preview"
                            >
                                <i className="fa-solid fa-passport"></i>
                                <span className="d-none d-sm-inline">Live Card</span>
                            </button>
                            <button
                                type="button"
                                className={`studio-mode-pill-btn ${studioViewMode === "editor" ? "active" : ""}`}
                                onClick={() => {
                                    playChimeClick();
                                    setStudioViewMode("editor");
                                }}
                                title="Studio Tools Only"
                            >
                                <i className="fa-solid fa-sliders"></i>
                                <span className="d-none d-sm-inline">Studio Tools</span>
                            </button>
                        </div>

                        {/* Public Badge */}
                        <span
                            className={`badge rounded-pill px-3 py-2 fw-bold ${
                                passportData.isPublic ? "bg-success text-white" : "bg-secondary text-white"
                            }`}
                        >
                            <i className={`fa-solid ${passportData.isPublic ? "fa-globe" : "fa-lock"} me-1`}></i>
                            {passportData.isPublic ? "Public" : "Private"}
                        </span>

                        {/* Share Link Button */}
                        <button
                            type="button"
                            onClick={() => {
                                playChimeClick();
                                const uname = cleanPassportUsername(
                                    passportData.username,
                                    authUser?.username || "resident"
                                );
                                const url = `${window.location.origin}/u/${encodeURIComponent(uname)}`;
                                navigator.clipboard.writeText(url).then(() => {
                                    setPassportLinkCopied(true);
                                    setTimeout(() => setPassportLinkCopied(false), 2500);
                                }).catch(() => {
                                    setPassportLinkCopied(true);
                                    setTimeout(() => setPassportLinkCopied(false), 2500);
                                });
                            }}
                            className={`btn btn-xs rounded-pill fw-bold px-3 py-2 d-inline-flex align-items-center gap-1 shadow-2xs ${
                                passportLinkCopied ? "btn-success text-white" : "btn-white border text-dark"
                            }`}
                            title="Copy Public Passport URL"
                        >
                            <i className={`fa-solid ${passportLinkCopied ? "fa-check" : "fa-share-nodes"}`}></i>
                            <span>{passportLinkCopied ? "Link Copied!" : "Share"}</span>
                        </button>

                        {/* View Live Page */}
                        <Link
                            to={`/u/${encodeURIComponent(
                                cleanPassportUsername(passportData.username, authUser?.username || "resident")
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-xs btn-outline-success rounded-pill fw-bold px-3 py-2 d-inline-flex align-items-center gap-1 shadow-2xs"
                            title="Open Public Passport in New Tab"
                        >
                            <span>View Live</span>
                            <i className="fa-solid fa-arrow-up-right-from-square"></i>
                        </Link>

                        {/* Quick Save to ChoBot Button */}
                        <button
                            type="button"
                            onClick={handleSaveToChoBot}
                            disabled={savingPassport}
                            className={`btn btn-xs rounded-pill fw-bold px-3 py-2 d-inline-flex align-items-center gap-1 shadow-2xs ${
                                passportDirty ? "btn-warning text-dark border-warning" : "btn-nook text-white"
                            }`}
                            title="Save Resident Passport to ChoBot"
                        >
                            <i
                                className={
                                    savingPassport
                                        ? "fa-solid fa-spinner fa-spin"
                                        : passportDirty
                                        ? "fa-solid fa-floppy-disk"
                                        : "fa-solid fa-cloud-arrow-up"
                                }
                            ></i>
                            <span>
                                {savingPassport
                                    ? "Saving..."
                                    : passportDirty
                                    ? "Save to ChoBot *"
                                    : "Save to ChoBot"}
                            </span>
                        </button>
                    </div>
                </div>

                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        handleSaveToChoBot();
                    }}
                >
                    {/* Passport Studio ChoBot Status Banner */}
                    {passportNotice && (
                        <div
                            className={`alert alert-${
                                passportNotice.type === "success" ? "success" : "warning"
                            } rounded-4 py-2 px-3 small fw-bold mb-3 d-flex align-items-center justify-content-between animate-fade shadow-2xs`}
                        >
                            <div className="d-flex align-items-center gap-2">
                                <i
                                    className={`fa-solid ${
                                        passportNotice.type === "success"
                                            ? "fa-circle-check text-success"
                                            : "fa-triangle-exclamation text-warning"
                                    }`}
                                ></i>
                                <span>{passportNotice.message}</span>
                            </div>
                            <button
                                type="button"
                                className="btn-close small ms-2"
                                onClick={() => setPassportNotice(null)}
                                aria-label="Dismiss notice"
                            ></button>
                        </div>
                    )}

                    {/* ── CARD FOCUS VIEW MODE ── */}
                    {studioViewMode === "card" && (
                        <div className="py-3 px-1 animate-fade" style={{ maxWidth: 880, margin: "0 auto" }}>
                            <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
                                <div className="d-flex align-items-center gap-2">
                                    <span className="live-sync-pulse">
                                        <span className="live-sync-dot"></span>
                                        <span>Full Card Viewport</span>
                                    </span>
                                    <span className="tiny-text text-muted">
                                        Official Dodo Airlines boarding record
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        playChimeClick();
                                        setStudioViewMode("split");
                                    }}
                                    className="btn btn-xs btn-outline-success rounded-pill fw-bold px-3 py-1 d-inline-flex align-items-center gap-1"
                                >
                                    <i className="fa-solid fa-pen-to-square"></i>
                                    <span>Open Split Studio to Edit</span>
                                </button>
                            </div>

                            <ResidentPassportCard
                                passport={passportData}
                                allVillagers={catalogData?.villagers || []}
                                allCatalogItems={catalogData?.items || []}
                                avatarUrl={profileUser?.avatar || authUser?.avatar || passportData.avatarUrl}
                                interactive={true}
                                onShareClick={() => {
                                    playChimeClick();
                                    const uname = cleanPassportUsername(
                                        passportData.username,
                                        authUser?.username || "resident"
                                    );
                                    const url = `${window.location.origin}/u/${encodeURIComponent(uname)}`;
                                    navigator.clipboard.writeText(url);
                                    setPassportLinkCopied(true);
                                    setTimeout(() => setPassportLinkCopied(false), 2500);
                                }}
                                shareCopied={passportLinkCopied}
                            />
                        </div>
                    )}

                    {/* ── SPLIT OR EDITOR VIEW MODE ── */}
                    {studioViewMode !== "card" && (
                        <div className="row g-4">
                            {/* LEFT COLUMN: Sticky Live Passport Card Preview (Split Mode Only) */}
                            {studioViewMode === "split" && (
                                <div className="col-xl-6 col-12">
                                    <div className="studio-preview-sticky">
                                        <div className="d-flex align-items-center justify-content-between mb-2">
                                            <div className="d-flex align-items-center gap-2">
                                                <span className="live-sync-pulse">
                                                    <span className="live-sync-dot"></span>
                                                    <span>Live Preview</span>
                                                </span>
                                                <span className="badge bg-light text-muted border rounded-pill x-small">
                                                    Updates in real time
                                                </span>
                                            </div>
                                            <span className="tiny-text font-monospace text-muted">
                                                CP-{(passportData.username || "RESIDENT").toUpperCase().slice(0, 8)}-{passportData.birthDay || "01"}
                                            </span>
                                        </div>

                                        <ResidentPassportCard
                                            passport={passportData}
                                            allVillagers={catalogData?.villagers || []}
                                            allCatalogItems={catalogData?.items || []}
                                            avatarUrl={profileUser?.avatar || authUser?.avatar || passportData.avatarUrl}
                                            interactive={true}
                                            onShareClick={() => {
                                                playChimeClick();
                                                const uname = cleanPassportUsername(
                                                    passportData.username,
                                                    authUser?.username || "resident"
                                                );
                                                const url = `${window.location.origin}/u/${encodeURIComponent(uname)}`;
                                                navigator.clipboard.writeText(url);
                                                setPassportLinkCopied(true);
                                                setTimeout(() => setPassportLinkCopied(false), 2500);
                                            }}
                                            shareCopied={passportLinkCopied}
                                        />

                                        {/* Preview Status Strip */}
                                        <div className="mt-2 p-2 px-3 rounded-3 studio-inner-box d-flex align-items-center justify-content-between flex-wrap gap-2 shadow-2xs">
                                            <div className="d-flex align-items-center gap-2 tiny-text text-muted">
                                                <i className="fa-solid fa-circle-check text-success"></i>
                                                <span>Live sync ready. Select tabs on the right to edit.</span>
                                            </div>
                                            <div className="d-flex align-items-center gap-2">
                                                <span
                                                    className={`badge rounded-pill x-small fw-bold ${
                                                        passportData.isPublic ? "bg-success text-white" : "bg-secondary text-white"
                                                    }`}
                                                >
                                                    <i
                                                        className={`fa-solid ${
                                                            passportData.isPublic ? "fa-globe" : "fa-lock"
                                                        } me-1`}
                                                    ></i>
                                                    {passportData.isPublic ? "Public Passport" : "Private"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* RIGHT COLUMN: Categorized Studio Tools & Navigation */}
                            <div className={studioViewMode === "split" ? "col-xl-6 col-12" : "col-12"}>
                                {/* Category Navigation Pills */}
                                <div className="studio-nav-tabs">
                                    {[
                                        { id: "identity", label: "Identity & Island", icon: "fa-address-card" },
                                        { id: "vibe", label: "Vibe & Cover", icon: "fa-palette" },
                                        { id: "motto", label: "Motto & Bio", icon: "fa-quote-left" },
                                        {
                                            id: "besties",
                                            label: `Besties (${passportData.favouriteVillagers.length}/10)`,
                                            icon: "fa-paw",
                                        },
                                        {
                                            id: "items",
                                            label: `Treasures (${(passportData.featuredItems || []).length}/3)`,
                                            icon: "fa-trophy",
                                        },
                                        { id: "privacy", label: "Privacy & Link", icon: "fa-sliders" },
                                    ].map((sec) => (
                                        <button
                                            key={sec.id}
                                            type="button"
                                            className={`studio-nav-btn ${studioSection === sec.id ? "active" : ""}`}
                                            onClick={() => {
                                                playChimeClick();
                                                setStudioSection(sec.id as any);
                                            }}
                                        >
                                            <i className={`fa-solid ${sec.icon}`}></i>
                                            <span>{sec.label}</span>
                                        </button>
                                    ))}
                                </div>

                                {/* TAB 1: RESIDENT IDENTITY & ISLAND TRAITS */}
                                {studioSection === "identity" && (
                                    <div className="studio-tool-card animate-fade">
                                        <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
                                            <h3 className="h6 fw-black mb-0 ac-font d-flex align-items-center gap-2">
                                                <i className="fa-solid fa-address-card text-success"></i>
                                                Resident Identity &amp; Island Traits
                                            </h3>
                                            <span className="tiny-text text-muted">Core Passport Record</span>
                                        </div>

                                        {/* Primary IGN & Island Name (Syncs to Polaroid!) */}
                                        <div className="row g-2 mb-3">
                                            <div className="col-sm-6">
                                                <label className="form-label fw-bold small mb-1">
                                                    In-Game Name (IGN)
                                                </label>
                                                <input
                                                    type="text"
                                                    className="form-control rounded-3 border-2"
                                                    placeholder="e.g. Cho, Tom"
                                                    value={passportData.primaryIgn || ""}
                                                    onChange={(e) => {
                                                        setPassportDirty(true);
                                                        setPassportData({ ...passportData, primaryIgn: e.target.value });
                                                    }}
                                                />
                                            </div>
                                            <div className="col-sm-6">
                                                <label className="form-label fw-bold small mb-1">
                                                    Island Name
                                                </label>
                                                <input
                                                    type="text"
                                                    className="form-control rounded-3 border-2"
                                                    placeholder="e.g. Cho Island, Nooktopia"
                                                    value={passportData.primaryIsland || ""}
                                                    onChange={(e) => {
                                                        setPassportDirty(true);
                                                        setPassportData({ ...passportData, primaryIsland: e.target.value });
                                                    }}
                                                />
                                            </div>
                                            <div className="col-12">
                                                <p className="tiny-text text-muted mb-0">
                                                    <i className="fa-solid fa-camera-retro me-1 text-success"></i>
                                                    These traits appear directly on your passport polaroid portrait frame.
                                                </p>
                                            </div>
                                        </div>

                                        {/* Pronouns */}
                                        <div className="mb-3">
                                            <div className="d-flex align-items-center justify-content-between mb-1">
                                                <label className="form-label fw-bold small mb-0">
                                                    Pronouns
                                                </label>
                                                <div className="d-flex gap-1 flex-wrap">
                                                    {["she/her", "he/him", "they/them", "she/they"].map((p) => (
                                                        <button
                                                            key={p}
                                                            type="button"
                                                            className={`btn btn-xs rounded-pill px-2 py-0 border ${
                                                                passportData.pronouns === p
                                                                    ? "btn-success text-white"
                                                                    : "studio-motto-chip"
                                                            }`}
                                                            style={{ fontSize: "0.68rem" }}
                                                            onClick={() => {
                                                                playChimeClick();
                                                                setPassportDirty(true);
                                                                setPassportData({ ...passportData, pronouns: p });
                                                            }}
                                                        >
                                                            {p}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <input
                                                type="text"
                                                className="form-control rounded-3 border-2"
                                                placeholder="e.g. she/her, they/them, he/him"
                                                value={passportData.pronouns}
                                                onChange={(e) => {
                                                    setPassportDirty(true);
                                                    setPassportData({ ...passportData, pronouns: e.target.value });
                                                }}
                                            />
                                        </div>

                                        {/* Birthday & Dynamic Zodiac Constellation */}
                                        <div className="mb-3">
                                            <div className="d-flex align-items-center justify-content-between mb-1">
                                                <label className="form-label fw-bold small mb-0">
                                                    Birthday &amp; Zodiac Sign
                                                </label>
                                                <span className="badge bg-warning bg-opacity-15 text-warning border border-warning border-opacity-30 rounded-pill x-small fw-bold">
                                                    <i className="fa-solid fa-star me-1"></i>
                                                    {ZODIAC_SIGNS[passportData.birthMonth] || "Island Star"}
                                                </span>
                                            </div>
                                            <div className="row g-2">
                                                <div className="col-5">
                                                    <select
                                                        className="form-select rounded-3 border-2"
                                                        value={passportData.birthDay}
                                                        onChange={(e) => {
                                                            playChimeClick();
                                                            setPassportDirty(true);
                                                            setPassportData({ ...passportData, birthDay: e.target.value });
                                                        }}
                                                    >
                                                        {Array.from({ length: 31 }, (_, i) => String(i + 1)).map((d) => (
                                                            <option key={d} value={d}>
                                                                Day {d}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="col-7">
                                                    <select
                                                        className="form-select rounded-3 border-2"
                                                        value={passportData.birthMonth}
                                                        onChange={(e) => {
                                                            playChimeClick();
                                                            setPassportDirty(true);
                                                            setPassportData({ ...passportData, birthMonth: e.target.value });
                                                        }}
                                                    >
                                                        {[
                                                            "January",
                                                            "February",
                                                            "March",
                                                            "April",
                                                            "May",
                                                            "June",
                                                            "July",
                                                            "August",
                                                            "September",
                                                            "October",
                                                            "November",
                                                            "December",
                                                        ].map((m) => (
                                                            <option key={m} value={m}>
                                                                {m}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Native Fruit Selector */}
                                        <div className="mb-3">
                                            <label className="form-label fw-bold small mb-2 d-flex align-items-center justify-content-between">
                                                <span>Native Fruit (Island Orchard Origin)</span>
                                                <span className="tiny-text text-muted">
                                                    Selected: <strong>{passportData.nativeFruit}</strong>
                                                </span>
                                            </label>
                                            <div className="studio-fruit-grid">
                                                {(["Apple", "Cherry", "Orange", "Peach", "Pear", "Coconut"] as const).map(
                                                    (fruit) => {
                                                        const isSelected = passportData.nativeFruit === fruit;
                                                        return (
                                                            <button
                                                                key={fruit}
                                                                type="button"
                                                                onClick={() => {
                                                                    playChimeClick();
                                                                    setPassportDirty(true);
                                                                    setPassportData({ ...passportData, nativeFruit: fruit });
                                                                }}
                                                                className={`studio-fruit-card ${isSelected ? "active" : ""}`}
                                                            >
                                                                <img
                                                                    src={FRUIT_ICONS[fruit]}
                                                                    alt={fruit}
                                                                    className="studio-fruit-icon"
                                                                    onError={(e) => {
                                                                        (e.currentTarget as HTMLElement).style.display = "none";
                                                                    }}
                                                                />
                                                                <span className="studio-fruit-label">{fruit}</span>
                                                                {isSelected && (
                                                                    <i className="fa-solid fa-circle-check studio-fruit-check"></i>
                                                                )}
                                                            </button>
                                                        );
                                                    }
                                                )}
                                            </div>
                                        </div>

                                        {/* Country & Language */}
                                        <div className="row g-2">
                                            <div className="col-6">
                                                <label className="form-label fw-bold small mb-1">
                                                    Country / Region
                                                </label>
                                                <input
                                                    type="text"
                                                    className="form-control rounded-3 border-2"
                                                    placeholder="e.g. Canada, Japan"
                                                    value={passportData.country}
                                                    onChange={(e) => {
                                                        setPassportDirty(true);
                                                        setPassportData({ ...passportData, country: e.target.value });
                                                    }}
                                                />
                                            </div>
                                            <div className="col-6">
                                                <label className="form-label fw-bold small mb-1">
                                                    Language
                                                </label>
                                                <input
                                                    type="text"
                                                    className="form-control rounded-3 border-2"
                                                    placeholder="e.g. English, Español"
                                                    value={passportData.language}
                                                    onChange={(e) => {
                                                        setPassportDirty(true);
                                                        setPassportData({ ...passportData, language: e.target.value });
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* TAB 2: ISLAND VIBE & AESTHETICS */}
                                {studioSection === "vibe" && (
                                    <div className="studio-tool-card animate-fade">
                                        <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
                                            <h3 className="h6 fw-black mb-0 ac-font d-flex align-items-center gap-2">
                                                <i className="fa-solid fa-palette text-primary"></i>
                                                Passport Skins &amp; Aesthetics
                                            </h3>
                                            <span className="tiny-text text-muted">Covers, Patterns &amp; Sound</span>
                                        </div>

                                        {/* Passport Booklet Skin */}
                                        <div className="mb-4">
                                            <div className="d-flex align-items-center justify-content-between mb-2">
                                                <label className="form-label fw-bold small mb-0">
                                                    Passport Booklet Skin
                                                </label>
                                                <span className="tiny-text text-muted">7 Exclusive Covers</span>
                                            </div>
                                            <div className="studio-skin-grid">
                                                {Object.values(PASSPORT_SKINS).map((skin) => {
                                                    const isSelected =
                                                        (passportData.passportSkin || "nook") === skin.id;
                                                    return (
                                                        <button
                                                            key={skin.id}
                                                            type="button"
                                                            onClick={() => {
                                                                playChimeClick();
                                                                setPassportDirty(true);
                                                                setPassportData({ ...passportData, passportSkin: skin.id });
                                                            }}
                                                            className={`studio-skin-card ${isSelected ? "active" : ""}`}
                                                            title={skin.desc}
                                                        >
                                                            <div
                                                                className="studio-skin-swatch-bar"
                                                                style={{
                                                                    background: skin.headerGradient,
                                                                    borderBottom: `2px solid ${skin.headerBorder}`,
                                                                }}
                                                            >
                                                                <i className={`fa-solid ${skin.icon}`}></i>
                                                                {isSelected && <i className="fa-solid fa-circle-check"></i>}
                                                            </div>
                                                            <div>
                                                                <div className="studio-skin-name">{skin.label}</div>
                                                                <div className="studio-skin-desc">{skin.desc}</div>
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Passport Background Pattern */}
                                        <div className="mb-4">
                                            <div className="d-flex align-items-center justify-content-between mb-2">
                                                <label className="form-label fw-bold small mb-0">
                                                    Background Pattern
                                                </label>
                                                <span className="tiny-text text-muted">Booklet Texture</span>
                                            </div>
                                            <div className="studio-pattern-grid">
                                                {Object.values(PASSPORT_PATTERNS).map((pat) => {
                                                    const isSelected =
                                                        (passportData.passportPattern || "dots") === pat.id;
                                                    return (
                                                        <button
                                                            key={pat.id}
                                                            type="button"
                                                            onClick={() => {
                                                                playChimeClick();
                                                                setPassportDirty(true);
                                                                setPassportData({ ...passportData, passportPattern: pat.id });
                                                            }}
                                                            className={`studio-pattern-btn ${isSelected ? "active" : ""}`}
                                                            title={pat.label}
                                                        >
                                                            <i className={`fa-solid ${pat.icon}`}></i>
                                                            <span>{pat.label}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Personality Archetypes */}
                                        <div className="mb-3">
                                            <label className="form-label fw-bold small mb-1">
                                                Your Island Personality
                                            </label>
                                            <div className="d-flex flex-wrap gap-1">
                                                {([
                                                    "Lazy",
                                                    "Jock",
                                                    "Cranky",
                                                    "Smug",
                                                    "Normal",
                                                    "Peppy",
                                                    "Snooty",
                                                    "Big Sister",
                                                ] as const).map((p) => {
                                                    const isSelected = passportData.personality === p;
                                                    const pTheme =
                                                        PERSONALITY_THEMES[p] || PERSONALITY_THEMES.Normal;
                                                    return (
                                                        <button
                                                            key={p}
                                                            type="button"
                                                            onClick={() => {
                                                                playChimeClick();
                                                                setPassportDirty(true);
                                                                setPassportData({ ...passportData, personality: p });
                                                            }}
                                                            className={`studio-personality-pill ${isSelected ? "active" : ""}`}
                                                            style={{
                                                                backgroundColor: isSelected ? pTheme.bg : undefined,
                                                                color: isSelected ? pTheme.text : undefined,
                                                                borderColor: isSelected ? pTheme.text : undefined,
                                                            }}
                                                        >
                                                            <i className={`fa-solid ${pTheme.icon}`}></i>
                                                            <span>{p}</span>
                                                            {isSelected && <i className="fa-solid fa-check ms-1 small"></i>}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Theme Colour with AC Preset Palette */}
                                        <div className="mb-3">
                                            <div className="d-flex align-items-center justify-content-between mb-2">
                                                <label className="form-label fw-bold small mb-0">
                                                    Passport Theme Color
                                                </label>
                                                <span className="tiny-text text-muted">Palette Preset</span>
                                            </div>
                                            <div className="studio-color-swatch-grid mb-2">
                                                {[
                                                    { hex: "#37b06d", label: "Nook Leaf" },
                                                    { hex: "#8b5cf6", label: "Celeste Star" },
                                                    { hex: "#d97706", label: "Roost Amber" },
                                                    { hex: "#0284c7", label: "Dodo Sky" },
                                                    { hex: "#ec4899", label: "Cherry Blossom" },
                                                    { hex: "#eab308", label: "Bell Coin" },
                                                    { hex: "#292524", label: "Brewster Noir" },
                                                    { hex: "#14b8a6", label: "Seafarer Teal" },
                                                ].map((c) => (
                                                    <button
                                                        key={c.hex}
                                                        type="button"
                                                        onClick={() => {
                                                            playChimeClick();
                                                            setPassportDirty(true);
                                                            setPassportData({ ...passportData, favouriteColour: c.hex });
                                                        }}
                                                        className={`studio-color-swatch-btn ${
                                                            passportData.favouriteColour === c.hex ? "active" : ""
                                                        }`}
                                                    >
                                                        <span
                                                            className="studio-color-dot"
                                                            style={{ backgroundColor: c.hex }}
                                                        />
                                                        <span>{c.label}</span>
                                                        {passportData.favouriteColour === c.hex && (
                                                            <i className="fa-solid fa-check small text-success"></i>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="d-flex align-items-center gap-2">
                                                <input
                                                    type="color"
                                                    className="form-control form-control-color border-2 rounded-3"
                                                    value={passportData.favouriteColour || "#37b06d"}
                                                    onChange={(e) => {
                                                        setPassportDirty(true);
                                                        setPassportData({ ...passportData, favouriteColour: e.target.value });
                                                    }}
                                                    title="Choose custom colour"
                                                />
                                                <input
                                                    type="text"
                                                    className="form-control rounded-3 border-2 font-monospace small"
                                                    value={passportData.favouriteColour}
                                                    onChange={(e) => {
                                                        setPassportDirty(true);
                                                        setPassportData({ ...passportData, favouriteColour: e.target.value });
                                                    }}
                                                    placeholder="#37b06d"
                                                />
                                            </div>
                                        </div>

                                        {/* Favourite K.K. Slider Song */}
                                        <div>
                                            <div className="d-flex align-items-center justify-content-between mb-1">
                                                <label className="form-label fw-bold small mb-0">
                                                    Favourite K.K. Slider Song
                                                </label>
                                                <span className="tiny-text text-muted">Aircheck Track</span>
                                            </div>
                                            <div className="input-group mb-2">
                                                <span className="input-group-text border-2 border-end-0 text-muted">
                                                    <i className="fa-solid fa-compact-disc"></i>
                                                </span>
                                                <input
                                                    type="text"
                                                    className="form-control rounded-end-3 border-2 border-start-0"
                                                    placeholder="e.g. K.K. Cruisin', Bubblegum K.K."
                                                    value={passportData.favouriteSong}
                                                    onChange={(e) => {
                                                        setPassportDirty(true);
                                                        setPassportData({ ...passportData, favouriteSong: e.target.value });
                                                    }}
                                                />
                                            </div>
                                            <div className="d-flex gap-1 flex-wrap">
                                                {[
                                                    "K.K. Cruisin'",
                                                    "Bubblegum K.K.",
                                                    "Stale Cupcakes",
                                                    "K.K. Disco",
                                                    "Drivin'",
                                                    "Animal City",
                                                ].map((song) => (
                                                    <button
                                                        key={song}
                                                        type="button"
                                                        className={`btn btn-xs rounded-pill px-2 py-0 border ${
                                                            passportData.favouriteSong === song
                                                                ? "btn-success text-white"
                                                                : "studio-motto-chip"
                                                        }`}
                                                        style={{ fontSize: "0.68rem" }}
                                                        onClick={() => {
                                                            playChimeClick();
                                                            setPassportDirty(true);
                                                            setPassportData({ ...passportData, favouriteSong: song });
                                                        }}
                                                    >
                                                        {song}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* TAB 3: ISLAND MOTTO & BIO */}
                                {studioSection === "motto" && (
                                    <div className="studio-tool-card animate-fade">
                                        <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
                                            <h3 className="h6 fw-black mb-0 ac-font d-flex align-items-center gap-2">
                                                <i className="fa-solid fa-quote-left text-warning"></i>
                                                Island Motto &amp; Comment Bubble
                                            </h3>
                                            <span className="tiny-text text-muted">Passport Inscription</span>
                                        </div>

                                        {/* Comment Textarea with Live Counter */}
                                        <div className="mb-2">
                                            <div className="d-flex align-items-center justify-content-between mb-1">
                                                <label className="form-label fw-bold small mb-0">
                                                    Passport Comment (160 characters max)
                                                </label>
                                                <span
                                                    className={`tiny-text font-monospace ${
                                                        passportData.aboutYou.length > 160
                                                            ? "text-danger fw-bold"
                                                            : "text-muted"
                                                    }`}
                                                >
                                                    {passportData.aboutYou.length}/160
                                                </span>
                                            </div>
                                            <textarea
                                                className="form-control rounded-3 border-2"
                                                rows={3}
                                                maxLength={160}
                                                placeholder="Share your island theme, favorite activities, or dream designs with visitors..."
                                                value={passportData.aboutYou}
                                                onChange={(e) => {
                                                    setPassportDirty(true);
                                                    setPassportData({ ...passportData, aboutYou: e.target.value });
                                                }}
                                            ></textarea>
                                        </div>

                                        {/* Quick Motto Chips */}
                                        <div className="mb-3">
                                            <span className="tiny-text text-muted fw-bold d-block mb-1">
                                                Inspirational Quick-Pills:
                                            </span>
                                            <div className="d-flex gap-1 flex-wrap">
                                                {[
                                                    "Living my best island life! 🌴",
                                                    "5-Star Island in progress ⭐",
                                                    "Cottagecore vibes only 🍄",
                                                    "Hunting for cute DIYs & friends 🛠️",
                                                    "Catching bugs & making bells 💰",
                                                    "Stargazing with Celeste ✨",
                                                ].map((preset) => (
                                                    <button
                                                        key={preset}
                                                        type="button"
                                                        className="studio-motto-chip"
                                                        onClick={() => {
                                                            playChimeClick();
                                                            setPassportDirty(true);
                                                            setPassportData({ ...passportData, aboutYou: preset });
                                                        }}
                                                    >
                                                        <i className="fa-solid fa-sparkles text-warning small"></i>
                                                        <span>{preset}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Hobbies & Activities */}
                                        <div className="mb-3">
                                            <label className="form-label fw-bold small mb-1">
                                                Hobbies &amp; Activities
                                            </label>
                                            <input
                                                type="text"
                                                className="form-control rounded-3 border-2 mb-1"
                                                placeholder="e.g. Gardening, Fishing, Stargazing, Decorating"
                                                value={passportData.hobbies}
                                                onChange={(e) => {
                                                    setPassportDirty(true);
                                                    setPassportData({ ...passportData, hobbies: e.target.value });
                                                }}
                                            />
                                            <div className="d-flex gap-1 flex-wrap">
                                                {[
                                                    "Gardening & Flowers 🌸",
                                                    "Island Decorating 🏡",
                                                    "Fishing & Diving 🎣",
                                                    "Stargazing ✨",
                                                    "Catalog Trading 📦",
                                                ].map((h) => (
                                                    <button
                                                        key={h}
                                                        type="button"
                                                        className="studio-motto-chip"
                                                        style={{ fontSize: "0.68rem" }}
                                                        onClick={() => {
                                                            playChimeClick();
                                                            setPassportDirty(true);
                                                            setPassportData({ ...passportData, hobbies: h });
                                                        }}
                                                    >
                                                        {h}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Favourite Shows & Films / Media Aesthetic */}
                                        <div>
                                            <label className="form-label fw-bold small mb-1">
                                                Favorite Media / Island Aesthetic
                                            </label>
                                            <input
                                                type="text"
                                                className="form-control rounded-3 border-2"
                                                placeholder="e.g. Studio Ghibli, Sailor Moon, Cyberpunk"
                                                value={passportData.favouriteShowsFilms || ""}
                                                onChange={(e) => {
                                                    setPassportDirty(true);
                                                    setPassportData({
                                                        ...passportData,
                                                        favouriteShowsFilms: e.target.value,
                                                    });
                                                }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* TAB 4: ISLAND BESTIES & VILLAGERS */}
                                {studioSection === "besties" && (
                                    <div className="studio-tool-card animate-fade">
                                        <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
                                            <h3 className="h6 fw-black mb-0 ac-font d-flex align-items-center gap-2">
                                                <i className="fa-solid fa-paw text-warning"></i>
                                                Island Besties &amp; Villagers ({passportData.favouriteVillagers.length}/10)
                                            </h3>
                                            <span className="badge bg-warning bg-opacity-15 text-warning rounded-pill x-small fw-bold">
                                                Max 10
                                            </span>
                                        </div>

                                        {/* Current Selected Villagers Chips */}
                                        <div className="mb-3">
                                            <div className="d-flex flex-wrap gap-2 mb-2">
                                                {passportData.favouriteVillagers.map((vName) => {
                                                    const matched = (catalogData?.villagers || []).find(
                                                        (v) => v.name.toLowerCase() === vName.toLowerCase()
                                                    );
                                                    const sprite =
                                                        matched?.image || matched?.variations?.[0]?.imageUrl;
                                                    return (
                                                        <div key={vName} className="studio-villager-chip">
                                                            {sprite ? (
                                                                <img
                                                                    src={sprite}
                                                                    alt=""
                                                                    className="studio-villager-avatar"
                                                                />
                                                            ) : (
                                                                <i className="fa-solid fa-paw text-warning small"></i>
                                                            )}
                                                            <span>{vName}</span>
                                                            <button
                                                                type="button"
                                                                className="btn btn-link text-muted hover-text-danger p-0 ms-1 border-0"
                                                                onClick={() => {
                                                                    playChimeClick();
                                                                    setPassportDirty(true);
                                                                    setPassportData({
                                                                        ...passportData,
                                                                        favouriteVillagers:
                                                                            passportData.favouriteVillagers.filter(
                                                                                (v) => v !== vName
                                                                            ),
                                                                    });
                                                                }}
                                                                aria-label={`Remove ${vName}`}
                                                            >
                                                                <i className="fa-solid fa-xmark"></i>
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                                {passportData.favouriteVillagers.length === 0 && (
                                                    <div className="p-3 text-center text-muted small w-100 rounded-3 border border-dashed studio-inner-box">
                                                        <i className="fa-solid fa-paw text-warning me-1"></i>
                                                        No island besties added yet. Search or click recommendations below!
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Quick Popular Villagers Recommendations */}
                                        {passportData.favouriteVillagers.length < 10 && (
                                            <div className="mb-3">
                                                <span className="tiny-text text-muted fw-bold d-block mb-1">
                                                    Quick Add Popular Villagers:
                                                </span>
                                                <div className="d-flex gap-1 flex-wrap">
                                                    {[
                                                        "Raymond",
                                                        "Shino",
                                                        "Marshal",
                                                        "Sasha",
                                                        "Ione",
                                                        "Ankha",
                                                        "Judy",
                                                        "Sherb",
                                                        "Marina",
                                                        "Bob",
                                                    ]
                                                        .filter((name) => !passportData.favouriteVillagers.includes(name))
                                                        .map((vName) => {
                                                            const matched = (catalogData?.villagers || []).find(
                                                                (v) => v.name.toLowerCase() === vName.toLowerCase()
                                                            );
                                                            const sprite =
                                                                matched?.image || matched?.variations?.[0]?.imageUrl;
                                                            return (
                                                                <button
                                                                    key={vName}
                                                                    type="button"
                                                                    className="studio-motto-chip shadow-2xs d-inline-flex align-items-center gap-1"
                                                                    style={{ fontSize: "0.74rem" }}
                                                                    onClick={() => {
                                                                        playChimeClick();
                                                                        setPassportDirty(true);
                                                                        setPassportData({
                                                                            ...passportData,
                                                                            favouriteVillagers: [
                                                                                ...passportData.favouriteVillagers,
                                                                                vName,
                                                                            ].slice(0, 10),
                                                                        });
                                                                    }}
                                                                >
                                                                    {sprite ? (
                                                                        <img
                                                                            src={sprite}
                                                                            alt=""
                                                                            style={{
                                                                                width: 16,
                                                                                height: 16,
                                                                                borderRadius: "50%",
                                                                            }}
                                                                        />
                                                                    ) : (
                                                                        <i className="fa-solid fa-plus text-success x-small"></i>
                                                                    )}
                                                                    <span>+{vName}</span>
                                                                </button>
                                                            );
                                                        })}
                                                </div>
                                            </div>
                                        )}

                                        {/* Search Villager Autocomplete */}
                                        {passportData.favouriteVillagers.length < 10 && (
                                            <div className="position-relative">
                                                <label className="form-label fw-bold small mb-1">
                                                    Search Villagers by Name
                                                </label>
                                                <div className="input-group">
                                                    <span className="input-group-text border-2 border-end-0 text-muted">
                                                        <i className="fa-solid fa-magnifying-glass"></i>
                                                    </span>
                                                    <input
                                                        type="text"
                                                        className="form-control rounded-end-3 border-2 border-start-0"
                                                        placeholder="Type villager name (e.g. Roald, Beau, Judy)..."
                                                        value={villagerSearchQuery}
                                                        onChange={(e) => setVillagerSearchQuery(e.target.value)}
                                                    />
                                                </div>

                                                {/* Autocomplete Dropdown Popover */}
                                                {villagerSearchQuery.trim().length > 0 && (
                                                    <div
                                                        className="position-absolute start-0 end-0 rounded-3 shadow-lg p-2 mt-1 z-3 studio-dropdown-popover"
                                                        style={{ maxHeight: "220px", overflowY: "auto" }}
                                                    >
                                                        {(catalogData?.villagers || [])
                                                            .filter(
                                                                (v) =>
                                                                    v.name
                                                                        .toLowerCase()
                                                                        .includes(villagerSearchQuery.trim().toLowerCase()) &&
                                                                    !passportData.favouriteVillagers.includes(v.name)
                                                            )
                                                            .slice(0, 8)
                                                            .map((v) => {
                                                                const sprite =
                                                                    v.image || v.variations?.[0]?.imageUrl;
                                                                return (
                                                                    <button
                                                                        key={v.name}
                                                                        type="button"
                                                                        className="studio-dropdown-item d-flex align-items-center justify-content-between p-2 rounded-2"
                                                                        onClick={() => {
                                                                            playChimeClick();
                                                                            setPassportDirty(true);
                                                                            setPassportData({
                                                                                ...passportData,
                                                                                favouriteVillagers: [
                                                                                    ...passportData.favouriteVillagers,
                                                                                    v.name,
                                                                                ].slice(0, 10),
                                                                            });
                                                                            setVillagerSearchQuery("");
                                                                        }}
                                                                    >
                                                                        <div className="d-flex align-items-center gap-2">
                                                                            {sprite && (
                                                                                <img
                                                                                    src={sprite}
                                                                                    alt=""
                                                                                    style={{
                                                                                        width: 24,
                                                                                        height: 24,
                                                                                        objectFit: "contain",
                                                                                        borderRadius: "50%",
                                                                                    }}
                                                                                />
                                                                            )}
                                                                            <strong className="small">{v.name}</strong>
                                                                            {v.species && (
                                                                                <span className="tiny-text text-muted">
                                                                                    ({v.species})
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <div className="d-flex align-items-center gap-2">
                                                                            {v.personality && (
                                                                                <span className="badge bg-light text-muted x-small">
                                                                                    {v.personality}
                                                                                </span>
                                                                            )}
                                                                            <span className="badge bg-success bg-opacity-15 text-success rounded-pill x-small fw-bold">
                                                                                + Add
                                                                            </span>
                                                                        </div>
                                                                    </button>
                                                                );
                                                            })}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* TAB 5: ISLAND TREASURES & TROPHY SHELF */}
                                {studioSection === "items" && (
                                    <div className="studio-tool-card animate-fade">
                                        <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
                                            <h3 className="h6 fw-black mb-0 ac-font d-flex align-items-center gap-2">
                                                <i className="fa-solid fa-trophy text-warning"></i>
                                                Island Treasures &amp; Trophy Shelf (
                                                {(passportData.featuredItems || []).length}/3)
                                            </h3>
                                            <span className="badge bg-warning bg-opacity-15 text-warning rounded-pill x-small fw-bold">
                                                Max 3
                                            </span>
                                        </div>

                                        <p className="tiny-text text-muted mb-3">
                                            Showcase up to 3 prized catalog treasures, rare golden tools, crowns, or DIY crafts on your official resident passport.
                                        </p>

                                        {/* 3 Trophy Slots */}
                                        <div className="studio-trophy-shelf mb-4">
                                            {[0, 1, 2].map((slotIdx) => {
                                                const itemName = (passportData.featuredItems || [])[slotIdx];
                                                const matchedItem = itemName
                                                    ? (catalogData?.items || []).find(
                                                          (i) => i.name.toLowerCase() === itemName.toLowerCase()
                                                      )
                                                    : null;
                                                const sprite =
                                                    matchedItem?.image || matchedItem?.variations?.[0]?.imageUrl;

                                                if (itemName) {
                                                    return (
                                                        <div
                                                            key={slotIdx}
                                                            className="studio-trophy-slot filled animate-fade"
                                                        >
                                                            <span className="studio-trophy-slot-num">
                                                                #{slotIdx + 1}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                className="studio-trophy-remove-btn"
                                                                onClick={() => {
                                                                    playChimeClick();
                                                                    setPassportDirty(true);
                                                                    const next = (
                                                                        passportData.featuredItems || []
                                                                    ).filter((_, idx) => idx !== slotIdx);
                                                                    setPassportData({
                                                                        ...passportData,
                                                                        featuredItems: next,
                                                                    });
                                                                }}
                                                                title={`Remove ${itemName}`}
                                                                aria-label={`Remove ${itemName}`}
                                                            >
                                                                <i className="fa-solid fa-xmark"></i>
                                                            </button>
                                                            {sprite ? (
                                                                <img
                                                                    src={sprite}
                                                                    alt={itemName}
                                                                    className="studio-trophy-item-img"
                                                                />
                                                            ) : (
                                                                <div className="studio-trophy-item-img d-flex align-items-center justify-content-center text-warning fs-3">
                                                                    <i className="fa-solid fa-gem"></i>
                                                                </div>
                                                            )}
                                                            <div className="studio-trophy-item-name" title={itemName}>
                                                                {itemName}
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                return (
                                                    <div key={slotIdx} className="studio-trophy-slot">
                                                        <span className="studio-trophy-slot-num">#{slotIdx + 1}</span>
                                                        <div className="text-muted opacity-40 mb-1 fs-4">
                                                            <i className="fa-solid fa-plus"></i>
                                                        </div>
                                                        <span className="tiny-text text-muted fw-bold">Empty Slot</span>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Quick Add Popular Treasures */}
                                        {(passportData.featuredItems || []).length < 3 && (
                                            <div className="mb-4">
                                                <span className="tiny-text text-muted fw-bold d-block mb-1">
                                                    Quick Add Popular Treasures:
                                                </span>
                                                <div className="d-flex gap-1 flex-wrap">
                                                    {[
                                                        "Royal Crown",
                                                        "Crown",
                                                        "Nook Miles Ticket",
                                                        "100,000 Bells",
                                                        "Golden Axe",
                                                        "Golden Shovel",
                                                        "Golden Watering Can",
                                                        "Star Wand",
                                                        "Froggy Chair",
                                                        "Moon",
                                                        "Nova Light",
                                                        "Robot Hero",
                                                    ]
                                                        .filter(
                                                            (name) => !(passportData.featuredItems || []).includes(name)
                                                        )
                                                        .map((name) => {
                                                            const matched = (catalogData?.items || []).find(
                                                                (i) => i.name.toLowerCase() === name.toLowerCase()
                                                            );
                                                            const sprite =
                                                                matched?.image || matched?.variations?.[0]?.imageUrl;

                                                            return (
                                                                <button
                                                                    key={name}
                                                                    type="button"
                                                                    className="studio-motto-chip shadow-2xs d-inline-flex align-items-center gap-1"
                                                                    style={{ fontSize: "0.74rem" }}
                                                                    onClick={() => {
                                                                        playChimeClick();
                                                                        setPassportDirty(true);
                                                                        const current = passportData.featuredItems || [];
                                                                        if (current.length < 3 && !current.includes(name)) {
                                                                            setPassportData({
                                                                                ...passportData,
                                                                                featuredItems: [...current, name],
                                                                            });
                                                                        }
                                                                    }}
                                                                >
                                                                    {sprite ? (
                                                                        <img
                                                                            src={sprite}
                                                                            alt=""
                                                                            style={{
                                                                                width: 16,
                                                                                height: 16,
                                                                                objectFit: "contain",
                                                                            }}
                                                                        />
                                                                    ) : (
                                                                        <i className="fa-solid fa-plus text-success x-small"></i>
                                                                    )}
                                                                    <span>+{name}</span>
                                                                </button>
                                                            );
                                                        })}
                                                </div>
                                            </div>
                                        )}

                                        {/* Search Catalog Items Autocomplete */}
                                        {(passportData.featuredItems || []).length < 3 && (
                                            <div className="position-relative">
                                                <label className="form-label fw-bold small mb-1">
                                                    Search ACNH Catalog Items
                                                </label>
                                                <div className="input-group">
                                                    <span className="input-group-text border-2 border-end-0 text-muted">
                                                        <i className="fa-solid fa-magnifying-glass"></i>
                                                    </span>
                                                    <input
                                                        type="text"
                                                        className="form-control rounded-end-3 border-2 border-start-0"
                                                        placeholder="Type item name (e.g. Crescent-Moon Chair, Katana, Pagoda)..."
                                                        value={itemSearchQuery}
                                                        onChange={(e) => setItemSearchQuery(e.target.value)}
                                                    />
                                                </div>

                                                {/* Autocomplete Dropdown Popover */}
                                                {itemSearchQuery.trim().length > 0 && (
                                                    <div
                                                        className="position-absolute start-0 end-0 rounded-3 shadow-lg p-2 mt-1 z-3 studio-dropdown-popover"
                                                        style={{ maxHeight: "240px", overflowY: "auto" }}
                                                    >
                                                        {(catalogData?.items || [])
                                                            .filter(
                                                                (item) =>
                                                                    item.name
                                                                        .toLowerCase()
                                                                        .includes(itemSearchQuery.trim().toLowerCase()) &&
                                                                    !(passportData.featuredItems || []).includes(item.name)
                                                            )
                                                            .slice(0, 8)
                                                            .map((item) => {
                                                                const sprite =
                                                                    item.image || item.variations?.[0]?.imageUrl;
                                                                return (
                                                                    <button
                                                                        key={item.id || item.name}
                                                                        type="button"
                                                                        className="studio-dropdown-item d-flex align-items-center justify-content-between p-2 rounded-2"
                                                                        onClick={() => {
                                                                            playChimeClick();
                                                                            setPassportDirty(true);
                                                                            const current =
                                                                                passportData.featuredItems || [];
                                                                            if (
                                                                                current.length < 3 &&
                                                                                !current.includes(item.name)
                                                                            ) {
                                                                                setPassportData({
                                                                                    ...passportData,
                                                                                    featuredItems: [...current, item.name],
                                                                                });
                                                                            }
                                                                            setItemSearchQuery("");
                                                                        }}
                                                                    >
                                                                        <div className="d-flex align-items-center gap-2">
                                                                            {sprite && (
                                                                                <img
                                                                                    src={sprite}
                                                                                    alt=""
                                                                                    style={{
                                                                                        width: 26,
                                                                                        height: 26,
                                                                                        objectFit: "contain",
                                                                                    }}
                                                                                />
                                                                            )}
                                                                            <strong className="small">{item.name}</strong>
                                                                            {item.category && (
                                                                                <span className="tiny-text text-muted">
                                                                                    ({item.category})
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <span className="badge bg-success bg-opacity-15 text-success rounded-pill x-small fw-bold">
                                                                            + Feature
                                                                        </span>
                                                                    </button>
                                                                );
                                                            })}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* TAB 6: PRIVACY & PUBLISHING CONTROLS */}
                                {studioSection === "privacy" && (
                                    <div className="studio-tool-card animate-fade">
                                        <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
                                            <h3 className="h6 fw-black mb-0 ac-font d-flex align-items-center gap-2">
                                                <i className="fa-solid fa-sliders text-success"></i>
                                                Privacy &amp; Sharing Controls
                                            </h3>
                                            <span className="tiny-text text-muted">Publishing Settings</span>
                                        </div>

                                        {/* Switches */}
                                        <div className="studio-inner-box mb-3">
                                            <div className="form-check form-switch mb-3">
                                                <input
                                                    className="form-check-input"
                                                    type="checkbox"
                                                    role="switch"
                                                    id="showCharAndIsland"
                                                    checked={passportData.showCharacterAndIsland}
                                                    onChange={(e) => {
                                                        setPassportDirty(true);
                                                        setPassportData({
                                                            ...passportData,
                                                            showCharacterAndIsland: e.target.checked,
                                                        });
                                                    }}
                                                />
                                                <label
                                                    className="form-check-label fw-bold small ms-2"
                                                    htmlFor="showCharAndIsland"
                                                >
                                                    Show in-game character &amp; island name on passport
                                                </label>
                                                <p className="tiny-text text-muted mb-0 ms-2">
                                                    Displays your primary character nickname and island origin on the Polaroid photo.
                                                </p>
                                            </div>

                                            <div className="form-check form-switch">
                                                <input
                                                    className="form-check-input"
                                                    type="checkbox"
                                                    role="switch"
                                                    id="makeProfilePublic"
                                                    checked={passportData.isPublic}
                                                    onChange={(e) => {
                                                        setPassportDirty(true);
                                                        setPassportData({
                                                            ...passportData,
                                                            isPublic: e.target.checked,
                                                        });
                                                    }}
                                                />
                                                <label
                                                    className="form-check-label fw-bold small ms-2"
                                                    htmlFor="makeProfilePublic"
                                                >
                                                    Make passport public (accessible via your personal URL)
                                                </label>
                                                <p className="tiny-text text-muted mb-0 ms-2">
                                                    Enables any visitor to view your resident passport card at your dedicated handle URL.
                                                </p>
                                            </div>
                                        </div>

                                        {/* Public Handle Box */}
                                        <div className="studio-inner-box">
                                            <div className="d-flex align-items-center justify-content-between mb-2">
                                                <span className="fw-bold small">
                                                    <i className="fa-solid fa-link text-primary me-1"></i> Choose Your Public Passport Username:
                                                </span>
                                                <span
                                                    className={`badge rounded-pill x-small fw-bold ${
                                                        passportData.isPublic ? "bg-success text-white" : "bg-secondary text-white"
                                                    }`}
                                                >
                                                    {passportData.isPublic ? "Active & Public" : "Draft (Private)"}
                                                </span>
                                            </div>

                                            <div className="input-group mb-2">
                                                <span className="input-group-text bg-light text-muted font-monospace small">
                                                    {window.location.host}/u/
                                                </span>
                                                <input
                                                    type="text"
                                                    className="form-control rounded-0 font-monospace fw-bold"
                                                    placeholder={authUser?.username || "your-handle"}
                                                    value={passportData.username || ""}
                                                    onChange={(e) => {
                                                        const sanitized = e.target.value
                                                            .toLowerCase()
                                                            .replace(/[^a-z0-9_-]/g, "")
                                                            .slice(0, 30);
                                                        setPassportDirty(true);
                                                        setPassportData({ ...passportData, username: sanitized });
                                                    }}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        playChimeClick();
                                                        const uname = cleanPassportUsername(
                                                            passportData.username,
                                                            authUser?.username || "resident"
                                                        );
                                                        const url = `${window.location.origin}/u/${encodeURIComponent(
                                                            uname
                                                        )}`;
                                                        navigator.clipboard.writeText(url);
                                                        setPassportLinkCopied(true);
                                                        setTimeout(() => setPassportLinkCopied(false), 2500);
                                                    }}
                                                    className={`btn fw-bold px-3 ${
                                                        passportLinkCopied ? "btn-success" : "btn-dark"
                                                    }`}
                                                    title="Copy Public Passport Link"
                                                >
                                                    <i
                                                        className={`fa-solid ${
                                                            passportLinkCopied ? "fa-check" : "fa-copy"
                                                        } me-1`}
                                                    ></i>
                                                    <span>{passportLinkCopied ? "Copied!" : "Copy"}</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={savingPassport}
                                                    onClick={handleSaveToChoBot}
                                                    className="btn btn-nook fw-bold px-3 d-inline-flex align-items-center gap-1 shadow-2xs"
                                                    title="Save Public Username directly to ChoBot"
                                                >
                                                    <i
                                                        className={
                                                            savingPassport
                                                                ? "fa-solid fa-spinner fa-spin"
                                                                : "fa-solid fa-cloud-arrow-up"
                                                        }
                                                    ></i>
                                                    <span>{savingPassport ? "Saving..." : "Save to ChoBot"}</span>
                                                </button>
                                            </div>

                                            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                                                <span className="tiny-text text-muted">
                                                    <i className="fa-solid fa-circle-info me-1 text-primary"></i>
                                                    Allowed: letters, numbers, hyphens, underscores (max 30 chars). Saved to ChoBot.
                                                </span>
                                                {authUser?.username && passportData.username !== authUser.username && (
                                                    <button
                                                        type="button"
                                                        className="btn btn-link p-0 tiny-text text-primary text-decoration-none fw-bold"
                                                        onClick={() => {
                                                            setPassportDirty(true);
                                                            setPassportData({ ...passportData, username: cleanPassportUsername(authUser.username, '') });
                                                        }}
                                                    >
                                                        Use Discord username (@{authUser.username})
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Bottom Sticky Action Bar */}
                    <div className="studio-save-bar mt-4 d-flex align-items-center justify-content-between flex-wrap gap-2">
                        <div className="d-flex align-items-center gap-2">
                            {passportDirty ? (
                                <span className="badge bg-warning bg-opacity-20 text-warning border border-warning border-opacity-40 rounded-pill px-3 py-1 fw-bold">
                                    <i className="fa-solid fa-pen-nib me-1"></i>
                                    Unsaved Studio Changes
                                </span>
                            ) : (
                                <span className="badge bg-success bg-opacity-15 text-success border border-success border-opacity-30 rounded-pill px-3 py-1 fw-bold">
                                    <i className="fa-solid fa-cloud-check me-1"></i>
                                    Passport Synchronized
                                </span>
                            )}
                            <span className="tiny-text text-muted d-none d-md-inline">
                                {lastSavedDbTime ? (
                                    <span>
                                        <i className="fa-solid fa-cloud-arrow-up text-success me-1"></i>
                                        Saved to ChoBot at{" "}
                                        {new Date(lastSavedDbTime).toLocaleTimeString([], {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}
                                    </span>
                                ) : (
                                    "Changes save securely to ChoBot & your browser."
                                )}
                            </span>
                        </div>

                        <div className="d-flex align-items-center gap-2">
                            <button
                                type="submit"
                                disabled={savingPassport}
                                className="btn btn-nook rounded-pill fw-black px-4 py-2 shadow-xs d-inline-flex align-items-center gap-2"
                            >
                                <i
                                    className={
                                        savingPassport ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-floppy-disk"
                                    }
                                ></i>
                                <span>{savingPassport ? "Saving to ChoBot..." : "Save Passport to ChoBot"}</span>
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};
