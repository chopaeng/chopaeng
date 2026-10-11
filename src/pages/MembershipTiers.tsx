import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { useIslandData } from "../context/useIslandData";
import { playChimeClick } from "../utils/kkAudioSynthesizer";
import DisclaimerBanner from "../components/DisclaimerBanner";
import {
    SUB_ISLAND_ACCESS_MATRIX,
    SUB_ISLAND_CATEGORIES,
        canUserAccessSubIsland,
    getUserSubTiers,
    getTierBadgeMeta,
    getIslandPlatforms
} from "../utils/subIslandAccess";

type PlatformFilter = "all" | "patreon" | "twitch" | "youtube" | "unlocked";

export const MembershipTiers = () => {
    const { user, loginWithProvider, login } = useAuth();
    const { islands } = useIslandData();

    const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");
    const [selectedTier, setSelectedTier] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        document.title = "Sub Island Membership Access Matrix • Chopaeng";
    }, []);

    const userTiers = useMemo(() => getUserSubTiers(user), [user]);
    const isSubscriber = userTiers.length > 0 || !!(user?.is_admin || user?.is_mod);

    // Island telemetry lookup map
    const islandLiveMap = useMemo(() => {
        const map = new Map<string, (typeof islands)[0]>();
        for (const isl of islands) {
            map.set(isl.name.toLowerCase(), isl);
        }
        return map;
    }, [islands]);

    const islandRows = useMemo(() => {
        return Object.entries(SUB_ISLAND_ACCESS_MATRIX).map(([name, allowedTiers]) => {
            const category = SUB_ISLAND_CATEGORIES[name] || "Member Island";
            const platforms = getIslandPlatforms(name);
            const live = islandLiveMap.get(name.toLowerCase());
            const hasAccess = user ? canUserAccessSubIsland(name, user) : false;

            return {
                name,
                category,
                allowedTiers,
                platforms,
                status: live?.status || "ONLINE",
                visitors: live?.visitors ?? 0,
                hasAccess,
                id: live?.id || name.toLowerCase(),
            };
        });
    }, [islandLiveMap, user]);

    const filteredRows = useMemo(() => {
        return islandRows.filter((row) => {
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matchesName = row.name.toLowerCase().includes(q);
                const matchesCategory = row.category.toLowerCase().includes(q);
                const matchesTier = row.allowedTiers.some(t => t.toLowerCase().includes(q));
                if (!matchesName && !matchesCategory && !matchesTier) return false;
            }

            if (platformFilter === "unlocked") {
                if (!row.hasAccess) return false;
            } else if (platformFilter !== "all") {
                if (!row.platforms.includes(platformFilter)) return false;
            }

            if (selectedTier !== "all") {
                if (!row.allowedTiers.includes(selectedTier)) return false;
            }

            return true;
        });
    }, [islandRows, searchQuery, platformFilter, selectedTier]);

    const unlockedCount = useMemo(() => {
        return islandRows.filter(r => r.hasAccess).length;
    }, [islandRows]);

    return (
        <div className="nook-os min-vh-100 p-3 p-lg-5 font-nunito d-flex flex-column align-items-center">
            <div className="app-container w-100" style={{ maxWidth: "1200px" }}>

                {/* Top Navigation */}
                <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
                    <Link
                        to="/membership"
                        className="btn btn-sm btn-white bg-white border rounded-pill px-3 py-1.5 fw-bold text-dark shadow-2xs text-decoration-none d-inline-flex align-items-center gap-2 hover-lift"
                    >
                        <i className="fa-solid fa-arrow-left text-success"></i>
                        <span>Membership Overview</span>
                    </Link>

                    <div className="d-flex align-items-center gap-2">
                        <Link
                            to="/islands"
                            className="btn btn-sm btn-outline-success rounded-pill px-3 py-1.5 fw-bold text-decoration-none d-inline-flex align-items-center gap-1.5 shadow-2xs"
                        >
                            <i className="fa-solid fa-umbrella-beach"></i>
                            <span>All Treasure Islands</span>
                        </Link>
                        <a
                            href="https://discord.com/invite/chopaeng"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-sm btn-outline-primary rounded-pill px-3 py-1.5 fw-bold d-inline-flex align-items-center gap-2 text-decoration-none shadow-2xs"
                        >
                            <i className="fa-brands fa-discord"></i>
                            <span>Discord Support</span>
                        </a>
                    </div>
                </div>

                {/* Header Banner */}
                <div className="text-center mb-5">
                    <div className="d-inline-flex align-items-center justify-content-center bg-white p-3 rounded-4 shadow-sm mb-3 border border-3 border-light transform-rotate-n3">
                        <i className="fa-solid fa-map-location-dot fs-1 text-warning"></i>
                    </div>
                    <h1 className="display-5 fw-black ac-font text-dark mb-2">Sub Island Tier Access Matrix</h1>
                    <p className="lead text-muted fw-bold mx-auto mb-3" style={{ maxWidth: "750px" }}>
                        Every Sub Member Treasure Island is unlocked based on your tier on <strong>Patreon</strong>, <strong>Twitch</strong>, or <strong>YouTube</strong>. Use this interactive matrix to see exactly which islands your membership covers!
                    </p>

                    {/* Authenticated user status bar */}
                    {user ? (
                        <div className="d-inline-flex align-items-center gap-3 bg-white p-2.5 px-4 rounded-pill shadow-sm border flex-wrap justify-content-center">
                            <span className="small fw-bold text-dark d-flex align-items-center gap-1.5">
                                <i className="fa-solid fa-circle-user text-success"></i>
                                Signed in as <strong>{user.username}</strong>
                            </span>
                            <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 rounded-pill px-3 py-1 fw-bold">
                                {isSubscriber ? `✓ ${unlockedCount}/20 Islands Unlocked` : "Free Tier"}
                            </span>
                            {userTiers.length > 0 && (
                                <div className="d-flex align-items-center gap-1">
                                    {userTiers.map(t => {
                                        const meta = getTierBadgeMeta(t);
                                        return (
                                            <span
                                                key={t}
                                                className="badge rounded-pill px-2.5 py-1 text-dark fw-bold border"
                                                style={{ backgroundColor: meta.bgColor, borderColor: meta.borderColor }}
                                            >
                                                <i className={`${meta.icon} me-1`} style={{ color: meta.color }}></i>
                                                {t}
                                            </span>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="d-inline-flex align-items-center gap-2 bg-white bg-opacity-75 border rounded-pill px-3 py-1.5 shadow-2xs">
                            <i className="fa-solid fa-passport text-warning"></i>
                            <span className="small fw-bold text-muted">
                                Want to check your unlocked islands?{" "}
                                <button type="button" onClick={() => login()} className="btn btn-link p-0 text-success fw-bold text-decoration-none">
                                    Sign In with Discord / Platform
                                </button>
                            </span>
                        </div>
                    )}
                </div>

                {/* Platform Overview Cards (3 Platforms) */}
                <div className="row g-3 mb-5">
                    {/* Patreon */}
                    <div className="col-12 col-md-4">
                        <div className="card h-100 bg-white border-2 rounded-4 p-4 shadow-sm position-relative overflow-hidden" style={{ borderColor: "rgba(255, 66, 77, 0.25)" }}>
                            <div className="d-flex align-items-center justify-content-between mb-3">
                                <div className="d-flex align-items-center gap-2.5">
                                    <div className="p-2.5 rounded-3 text-white d-flex align-items-center justify-content-center shadow-2xs" style={{ background: "linear-gradient(135deg, #FF424D, #EA580C)", width: 44, height: 44 }}>
                                        <i className="fa-brands fa-patreon fs-4"></i>
                                    </div>
                                    <div>
                                        <h3 className="h5 fw-black ac-font text-dark mb-0">Patreon</h3>
                                        <span className="tiny-text text-muted fw-bold">Multi-tier support</span>
                                    </div>
                                </div>
                                <span className="badge rounded-pill px-2.5 py-1 fw-bold small" style={{ background: "rgba(255, 66, 77, 0.1)", color: "#EA580C", border: "1px solid rgba(255, 66, 77, 0.2)" }}>
                                    3 Tiers
                                </span>
                            </div>
                            <div className="d-flex flex-wrap gap-1.5 mb-3">
                                <span className="badge bg-light text-dark border rounded-pill px-2.5 py-1 fw-bold small">ChoSoup (Full Access)</span>
                                <span className="badge bg-light text-dark border rounded-pill px-2.5 py-1 fw-bold small">ChoColate</span>
                                <span className="badge bg-light text-dark border rounded-pill px-2.5 py-1 fw-bold small">ChoFries</span>
                            </div>
                            <p className="small text-secondary mb-4 flex-grow-1">
                                ChoSoup unlocks all 20 Sub Islands. ChoColate and ChoFries unlock dedicated sets including 2.0, Furniture, Seasonal, Mats, and Critters.
                            </p>
                            <div className="d-flex gap-2 mt-auto">
                                <a
                                    href="https://www.patreon.com/cw/chopaeng/membership"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-sm text-white rounded-pill fw-bold flex-grow-1 py-2 d-flex align-items-center justify-content-center gap-1.5 shadow-2xs"
                                    style={{ background: "linear-gradient(135deg, #FF424D, #EA580C)" }}
                                >
                                    <span>Join on Patreon</span>
                                    <i className="fa-solid fa-arrow-up-right-from-square small"></i>
                                </a>
                                <button
                                    type="button"
                                    onClick={() => loginWithProvider("patreon")}
                                    className="btn btn-sm btn-light border rounded-pill fw-bold px-3 py-2 text-muted"
                                    title="Sign in with Patreon"
                                >
                                    Sign In
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Twitch */}
                    <div className="col-12 col-md-4">
                        <div className="card h-100 bg-white border-2 rounded-4 p-4 shadow-sm position-relative overflow-hidden" style={{ borderColor: "rgba(145, 70, 255, 0.25)" }}>
                            <div className="d-flex align-items-center justify-content-between mb-3">
                                <div className="d-flex align-items-center gap-2.5">
                                    <div className="p-2.5 rounded-3 text-white d-flex align-items-center justify-content-center shadow-2xs" style={{ background: "linear-gradient(135deg, #9146FF, #6D28D9)", width: 44, height: 44 }}>
                                        <i className="fa-brands fa-twitch fs-4"></i>
                                    </div>
                                    <div>
                                        <h3 className="h5 fw-black ac-font text-dark mb-0">Twitch</h3>
                                        <span className="tiny-text text-muted fw-bold">ChoTato Club</span>
                                    </div>
                                </div>
                                <span className="badge rounded-pill px-2.5 py-1 fw-bold small" style={{ background: "rgba(145, 70, 255, 0.1)", color: "#7C3AED", border: "1px solid rgba(145, 70, 255, 0.2)" }}>
                                    Sub or Prime
                                </span>
                            </div>
                            <div className="d-flex flex-wrap gap-1.5 mb-3">
                                <span className="badge bg-light text-dark border rounded-pill px-2.5 py-1 fw-bold small">ChoTato Club (All Twitch Subs)</span>
                            </div>
                            <p className="small text-secondary mb-4 flex-grow-1">
                                Any Twitch subscription (including free Prime Gaming) unlocks <strong>11 core Sub Islands</strong> including 1.0, 2.0, Furniture, Seasonal, Mats, Critters, Clothing, 3.0, and Pink Island!
                            </p>
                            <div className="d-flex gap-2 mt-auto">
                                <a
                                    href="https://www.twitch.tv/chopaeng"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-sm text-white rounded-pill fw-bold flex-grow-1 py-2 d-flex align-items-center justify-content-center gap-1.5 shadow-2xs"
                                    style={{ background: "linear-gradient(135deg, #9146FF, #6D28D9)" }}
                                >
                                    <span>Sub on Twitch</span>
                                    <i className="fa-solid fa-arrow-up-right-from-square small"></i>
                                </a>
                                <button
                                    type="button"
                                    onClick={() => loginWithProvider("twitch")}
                                    className="btn btn-sm btn-light border rounded-pill fw-bold px-3 py-2 text-muted"
                                    title="Sign in with Twitch"
                                >
                                    Sign In
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* YouTube */}
                    <div className="col-12 col-md-4">
                        <div className="card h-100 bg-white border-2 rounded-4 p-4 shadow-sm position-relative overflow-hidden" style={{ borderColor: "rgba(255, 0, 0, 0.25)" }}>
                            <div className="d-flex align-items-center justify-content-between mb-3">
                                <div className="d-flex align-items-center gap-2.5">
                                    <div className="p-2.5 rounded-3 text-white d-flex align-items-center justify-content-center shadow-2xs" style={{ background: "linear-gradient(135deg, #FF0000, #B91C1C)", width: 44, height: 44 }}>
                                        <i className="fa-brands fa-youtube fs-4"></i>
                                    </div>
                                    <div>
                                        <h3 className="h5 fw-black ac-font text-dark mb-0">YouTube</h3>
                                        <span className="tiny-text text-muted fw-bold">Channel Members</span>
                                    </div>
                                </div>
                                <span className="badge rounded-pill px-2.5 py-1 fw-bold small" style={{ background: "rgba(255, 0, 0, 0.1)", color: "#DC2626", border: "1px solid rgba(255, 0, 0, 0.2)" }}>
                                    3 Tiers
                                </span>
                            </div>
                            <div className="d-flex flex-wrap gap-1.5 mb-3">
                                <span className="badge bg-light text-dark border rounded-pill px-2.5 py-1 fw-bold small">y ChoSoup (Full Access)</span>
                                <span className="badge bg-light text-dark border rounded-pill px-2.5 py-1 fw-bold small">y ChoColate</span>
                                <span className="badge bg-light text-dark border rounded-pill px-2.5 py-1 fw-bold small">y ChoTato</span>
                            </div>
                            <p className="small text-secondary mb-4 flex-grow-1">
                                YouTube channel members enjoy equivalent access: <strong>y ChoSoup</strong> unlocks all 20 islands, <strong>y ChoColate</strong> unlocks 10 islands, and <strong>y ChoTato</strong> unlocks Hiraya and Bahaghari.
                            </p>
                            <div className="d-flex gap-2 mt-auto">
                                <a
                                    href="https://www.youtube.com/chopaengtv"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-sm text-white rounded-pill fw-bold flex-grow-1 py-2 d-flex align-items-center justify-content-center gap-1.5 shadow-2xs"
                                    style={{ background: "linear-gradient(135deg, #FF0000, #B91C1C)" }}
                                >
                                    <span>Join on YouTube</span>
                                    <i className="fa-solid fa-arrow-up-right-from-square small"></i>
                                </a>
                                <button
                                    type="button"
                                    onClick={() => loginWithProvider("youtube")}
                                    className="btn btn-sm btn-light border rounded-pill fw-bold px-3 py-2 text-muted"
                                    title="Sign in with YouTube"
                                >
                                    Sign In
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filter and Matrix Controls */}
                <div className="bg-white p-4 rounded-4 shadow-sm border mb-4">
                    <div className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3 flex-wrap">

                        {/* Platform Filter Buttons */}
                        <div className="d-flex align-items-center gap-1.5 flex-wrap">
                            <span className="tiny-text fw-bold text-muted text-uppercase me-2">Platform:</span>
                            {(
                                [
                                    { key: "all", label: "All Platforms (20)", icon: "fa-solid fa-globe" },
                                    { key: "patreon", label: "Patreon", icon: "fa-brands fa-patreon text-orange" },
                                    { key: "twitch", label: "Twitch (11)", icon: "fa-brands fa-twitch text-purple" },
                                    { key: "youtube", label: "YouTube", icon: "fa-brands fa-youtube text-danger" },
                                    ...(user ? [{ key: "unlocked", label: `My Unlocked (${unlockedCount})`, icon: "fa-solid fa-circle-check text-success" }] : []),
                                ] as { key: PlatformFilter; label: string; icon: string }[]
                            ).map((item) => (
                                <button
                                    key={item.key}
                                    type="button"
                                    onClick={() => {
                                        setPlatformFilter(item.key);
                                        playChimeClick();
                                    }}
                                    className={`btn btn-sm rounded-pill fw-bold px-3 py-1.5 transition-all d-flex align-items-center gap-1.5 ${
                                        platformFilter === item.key ? "btn-dark text-white shadow-2xs" : "btn-light border text-muted"
                                    }`}
                                >
                                    <i className={item.icon}></i>
                                    <span>{item.label}</span>
                                </button>
                            ))}
                        </div>

                        {/* Search and Specific Tier Filter */}
                        <div className="d-flex align-items-center gap-2 flex-grow-1 justify-content-lg-end" style={{ maxWidth: "520px" }}>
                            <select
                                value={selectedTier}
                                onChange={(e) => setSelectedTier(e.target.value)}
                                className="form-select form-select-sm rounded-pill fw-bold border"
                                style={{ maxWidth: "200px" }}
                            >
                                <option value="all">Filter by Tier (All)</option>
                                <option disabled>── Patreon ──</option>
                                <option value="ChoSoup">ChoSoup (20 Islands)</option>
                                <option value="ChoColate">ChoColate (8 Islands)</option>
                                <option value="ChoFries">ChoFries (8 Islands)</option>
                                <option disabled>── Twitch ──</option>
                                <option value="ChoTato Club">ChoTato Club (11 Islands)</option>
                                <option disabled>── YouTube ──</option>
                                <option value="y ChoSoup">y ChoSoup (20 Islands)</option>
                                <option value="y ChoColate">y ChoColate (10 Islands)</option>
                                <option value="y ChoTato">y ChoTato (2 Islands)</option>
                            </select>

                            <div className="input-group input-group-sm rounded-pill overflow-hidden border">
                                <span className="input-group-text bg-white border-0 ps-3">
                                    <i className="fa-solid fa-magnifying-glass text-muted"></i>
                                </span>
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search island..."
                                    className="form-control border-0 shadow-none fw-bold"
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchQuery("")}
                                        className="btn btn-white bg-white border-0 text-muted"
                                    >
                                        <i className="fa-solid fa-xmark"></i>
                                    </button>
                                )}
                            </div>
                        </div>

                    </div>
                </div>

                {/* Sub Island Access Matrix Table */}
                <div className="bg-white rounded-4 shadow-sm border overflow-hidden mb-5">
                    <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0">
                            <thead className="bg-light border-bottom">
                                <tr>
                                    <th className="py-3 px-4 fw-black text-dark ac-font" style={{ width: "220px" }}>Sub Island</th>
                                    <th className="py-3 px-3 fw-black text-dark ac-font" style={{ width: "160px" }}>Category</th>
                                    <th className="py-3 px-3 fw-black text-dark ac-font">Allowed Membership Tiers</th>
                                    <th className="py-3 px-3 fw-black text-dark ac-font text-center" style={{ width: "130px" }}>Platforms</th>
                                    <th className="py-3 px-4 fw-black text-dark ac-font text-end" style={{ width: "150px" }}>Your Access</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="text-center py-5 text-muted fw-bold">
                                            <i className="fa-solid fa-filter-circle-xmark fs-2 mb-2 d-block text-secondary"></i>
                                            No islands match your current filter. Try resetting search or platform filters.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredRows.map((row) => (
                                        <tr key={row.name} className={row.hasAccess ? "table-success bg-opacity-25" : ""}>
                                            {/* Island Name */}
                                            <td className="py-3 px-4">
                                                <div className="d-flex align-items-center gap-2.5">
                                                    <span className="p-2 rounded-circle bg-light border text-success d-inline-flex align-items-center justify-content-center" style={{ width: 34, height: 34 }}>
                                                        <i className="fa-solid fa-tree small"></i>
                                                    </span>
                                                    <div>
                                                        <Link to={`/island/${row.id}`} className="fw-black text-dark text-decoration-none hover-green d-block">
                                                            {row.name}
                                                        </Link>
                                                        <span className="tiny-text text-muted fw-bold">
                                                            Gate: {row.status}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Category */}
                                            <td className="py-3 px-3">
                                                <span className="badge bg-light text-dark border rounded-pill px-2.5 py-1 fw-bold small">
                                                    {row.category}
                                                </span>
                                            </td>

                                            {/* Allowed Tiers */}
                                            <td className="py-3 px-3">
                                                <div className="d-flex flex-wrap gap-1.5">
                                                    {row.allowedTiers.map((tier) => {
                                                        const meta = getTierBadgeMeta(tier);
                                                        const userHasThisTier = userTiers.some(ut => ut.toLowerCase() === tier.toLowerCase());
                                                        return (
                                                            <span
                                                                key={tier}
                                                                className={`badge rounded-pill px-2.5 py-1 fw-bold d-inline-flex align-items-center gap-1 border ${
                                                                    userHasThisTier ? "ring-2 ring-success shadow-2xs" : ""
                                                                }`}
                                                                style={{
                                                                    backgroundColor: meta.bgColor,
                                                                    color: meta.color,
                                                                    borderColor: meta.borderColor,
                                                                    fontSize: "0.74rem"
                                                                }}
                                                                title={`Platform: ${meta.provider.toUpperCase()}`}
                                                            >
                                                                <i className={meta.icon}></i>
                                                                <span>{tier}</span>
                                                                {userHasThisTier && <i className="fa-solid fa-check small ms-0.5"></i>}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            </td>

                                            {/* Supported Platforms Icons */}
                                            <td className="py-3 px-3 text-center">
                                                <div className="d-inline-flex align-items-center gap-1.5 bg-light p-1 px-2 rounded-pill border">
                                                    {row.platforms.includes("patreon") && (
                                                        <i className="fa-brands fa-patreon text-orange" title="Patreon Supported"></i>
                                                    )}
                                                    {row.platforms.includes("twitch") && (
                                                        <i className="fa-brands fa-twitch text-purple" title="Twitch Supported"></i>
                                                    )}
                                                    {row.platforms.includes("youtube") && (
                                                        <i className="fa-brands fa-youtube text-danger" title="YouTube Supported"></i>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Access Status & Link */}
                                            <td className="py-3 px-4 text-end">
                                                {user ? (
                                                    row.hasAccess ? (
                                                        <Link
                                                            to={`/island/${row.id}`}
                                                            className="btn btn-sm btn-success rounded-pill fw-bold px-3 py-1 d-inline-flex align-items-center gap-1 shadow-2xs"
                                                            style={{ fontSize: "0.75rem" }}
                                                        >
                                                            <i className="fa-solid fa-plane-departure"></i>
                                                            <span>Fly Now</span>
                                                        </Link>
                                                    ) : (
                                                        <span className="badge rounded-pill bg-light text-muted border px-2.5 py-1.5 fw-bold" style={{ fontSize: "0.72rem" }}>
                                                            <i className="fa-solid fa-lock me-1 text-warning"></i> Locked
                                                        </span>
                                                    )
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => login()}
                                                        className="btn btn-sm btn-outline-secondary rounded-pill fw-bold px-2.5 py-1"
                                                        style={{ fontSize: "0.72rem" }}
                                                    >
                                                        Check Access
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Integration FAQ & How-To */}
                <div className="bg-white p-4 p-md-5 rounded-4 shadow-sm border mb-5">
                    <div className="row g-4 align-items-center">
                        <div className="col-lg-5">
                            <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-3 py-1.5 rounded-pill fw-bold text-uppercase spacing-wide mb-2">
                                <i className="fa-solid fa-circle-question me-1.5"></i> How It Works
                            </span>
                            <h2 className="h3 fw-black ac-font text-dark mb-2">Connecting Your Sub Island Access</h2>
                            <p className="text-muted small fw-bold mb-3">
                                Sub Island gates use automated Discord and OAuth role integration. When you join on Patreon, Twitch, or YouTube, your role gives you instant Dodo code passes.
                            </p>
                            <Link to="/membership" className="btn btn-nook-primary rounded-pill fw-bold px-4 py-2">
                                View Full Membership Plans
                            </Link>
                        </div>
                        <div className="col-lg-7">
                            <div className="d-flex flex-column gap-3">
                                <div className="p-3 rounded-3 bg-light border d-flex align-items-start gap-3">
                                    <span className="badge bg-dark rounded-circle p-2 px-3 fw-bold">1</span>
                                    <div>
                                        <strong className="text-dark d-block">Join on YouTube, Twitch, or Patreon</strong>
                                        <span className="text-muted small">Choose your preferred tier based on which Sub Islands you want to fly to.</span>
                                    </div>
                                </div>
                                <div className="p-3 rounded-3 bg-light border d-flex align-items-start gap-3">
                                    <span className="badge bg-dark rounded-circle p-2 px-3 fw-bold">2</span>
                                    <div>
                                        <strong className="text-dark d-block">Connect your Account in Discord Settings</strong>
                                        <span className="text-muted small">Go to Discord &gt; User Settings &gt; Connections and link your platform account.</span>
                                    </div>
                                </div>
                                <div className="p-3 rounded-3 bg-light border d-flex align-items-start gap-3">
                                    <span className="badge bg-dark rounded-circle p-2 px-3 fw-bold">3</span>
                                    <div>
                                        <strong className="text-dark d-block">Sign in to ChoPaeng with Discord</strong>
                                        <span className="text-muted small">Your subscriber role will sync automatically, instantly revealing live Dodo flight passes!</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Disclaimer */}
                <div className="text-center mt-3">
                    <DisclaimerBanner variant="text" className="mb-0" />
                </div>

            </div>
        </div>
    );
};

export default MembershipTiers;
