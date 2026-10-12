import React, { useState, useMemo, useEffect, useId } from "react";
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
    getIslandPlatforms,
} from "../utils/subIslandAccess";

type PlatformFilter = "all" | "patreon" | "twitch" | "youtube" | "unlocked";
type SignInProvider = "patreon" | "twitch" | "youtube";

interface PlatformCard {
    id: SignInProvider;
    name: string;
    sub: string;
    badge: string;
    icon: string;
    color: string;
    cta: string;
    tiers: string[];
    desc: React.ReactNode;
    joinUrl: string;
    joinLabel: string;
}

const PLATFORM_CARDS: PlatformCard[] = [
    {
        id: "patreon",
        name: "Patreon",
        sub: "Multi-tier support",
        badge: "3 tiers",
        icon: "fa-brands fa-patreon",
        color: "#ff424d",
        cta: "#d92d3a",
        tiers: ["ChoSoup (Full Access)", "ChoColate", "ChoFries"],
        desc: "ChoSoup unlocks all 20 Sub Islands. ChoColate and ChoFries unlock dedicated sets including 2.0, Furniture, Seasonal, Mats, and Critters.",
        joinUrl: "https://www.patreon.com/cw/chopaeng/membership",
        joinLabel: "Join on Patreon",
    },
    {
        id: "twitch",
        name: "Twitch",
        sub: "ChoTato Club",
        badge: "Sub or Prime",
        icon: "fa-brands fa-twitch",
        color: "#9146ff",
        cta: "#772ce8",
        tiers: ["ChoTato Club (All Twitch Subs)"],
        desc: (
            <>
                Any Twitch subscription (including free Prime Gaming) unlocks <strong>11 core Sub Islands</strong>{" "}
                including 1.0, 2.0, Furniture, Seasonal, Mats, Critters, Clothing, 3.0, and Pink Island.
            </>
        ),
        joinUrl: "https://www.twitch.tv/chopaeng",
        joinLabel: "Sub on Twitch",
    },
    {
        id: "youtube",
        name: "YouTube",
        sub: "Channel members",
        badge: "3 tiers",
        icon: "fa-brands fa-youtube",
        color: "#ff0000",
        cta: "#cc0000",
        tiers: ["y ChoSoup (Full Access)", "y ChoColate", "y ChoTato"],
        desc: (
            <>
                YouTube channel members get equivalent access: <strong>y ChoSoup</strong> unlocks all 20 islands,{" "}
                <strong>y ChoColate</strong> unlocks 10, and <strong>y ChoTato</strong> unlocks Hiraya and Bahaghari.
            </>
        ),
        joinUrl: "https://www.youtube.com/chopaengtv",
        joinLabel: "Join on YouTube",
    },
];

const PLATFORM_ICON: Record<string, { icon: string; color: string; label: string }> = {
    patreon: { icon: "fa-brands fa-patreon", color: "#d92d3a", label: "Patreon" },
    twitch: { icon: "fa-brands fa-twitch", color: "#772ce8", label: "Twitch" },
    youtube: { icon: "fa-brands fa-youtube", color: "#cc0000", label: "YouTube" },
};

const TIER_OPTIONS: { group: string; items: string[] }[] = [
    { group: "Patreon", items: ["ChoSoup", "ChoColate", "ChoFries"] },
    { group: "Twitch", items: ["ChoTato Club"] },
    { group: "YouTube", items: ["y ChoSoup", "y ChoColate", "y ChoTato"] },
];

const STEPS = [
    {
        title: "Join on YouTube, Twitch, or Patreon",
        desc: "Choose the tier that covers the sub islands you want to fly to.",
    },
    {
        title: "Connect your account in Discord",
        desc: "Go to Discord > User Settings > Connections and link your platform account.",
    },
    {
        title: "Sign in to ChoPaeng",
        desc: "Your subscriber role syncs automatically and reveals your live Dodo flight passes.",
    },
];

const STYLES = `
.nook-os.cpt {
    --ink: #1d3328; --ink-soft: #5b6e63; --leaf: #1f8a4c; --leaf-dark: #166b3a;
    --line: #cfdcd3; --sky: #e3f4f1;
    color: var(--ink);
    background:
        radial-gradient(1200px 380px at 50% -140px, #c9ebe4 0%, transparent 70%),
        var(--sky);
}
.cpt__wrap { width: 100%; max-width: 1200px; }

.cpt-top { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: .6rem; margin-bottom: 2rem; }
.cpt-top__right { display: flex; gap: .6rem; flex-wrap: wrap; }
.cpt-pill { display: inline-flex; align-items: center; gap: .5rem; padding: .5rem 1rem; border-radius: 999px; background: #fff; border: 1.5px solid var(--line); color: var(--ink); font-size: .9rem; font-weight: 700; text-decoration: none; transition: border-color .15s ease, background .15s ease; }
.cpt-pill:hover { border-color: var(--leaf); background: #f6faf7; color: var(--ink); }
.cpt-pill i { color: var(--leaf); }
.cpt-pill--discord i { color: #5865f2; }

/* Hero */
.cpt-hero { display: flex; align-items: center; gap: 1.4rem; margin-bottom: 1.5rem; }
.cpt-crest { width: 84px; height: 84px; flex: none; border-radius: 50%; display: grid; place-items: center; background: var(--leaf); color: #fff; font-size: 2rem; border: 4px double rgba(255,255,255,.7); box-shadow: 0 0 0 4px var(--leaf), 0 10px 24px -10px rgba(29,51,40,.5); margin: 4px; }
.cpt-h1 { margin: 0 0 .35rem; font-size: clamp(1.8rem, 4vw, 2.6rem); line-height: 1.1; font-weight: 800; }
.cpt-lead { margin: 0; max-width: 66ch; color: var(--ink-soft); font-size: 1.03rem; line-height: 1.55; font-weight: 600; }
@media (max-width: 575px) { .cpt-hero { flex-direction: column; align-items: flex-start; } }

/* Status strip */
.cpt-status { display: flex; align-items: center; flex-wrap: wrap; gap: .9rem 1.4rem; background: #fff; border: 2px dashed var(--leaf); border-radius: 20px; padding: .85rem 1.1rem; margin-bottom: 2.25rem; font-size: .92rem; font-weight: 700; }
.cpt-status i { color: var(--leaf); }
.cpt-status__who { display: inline-flex; align-items: center; gap: .5rem; }
.cpt-meter { display: flex; align-items: center; gap: .6rem; }
.cpt-meter__track { width: 120px; height: 10px; border-radius: 5px; background: #eef3ef; border: 1.5px dashed var(--line); overflow: hidden; }
.cpt-meter__fill { height: 100%; background: var(--leaf); }
.cpt-linkbtn { border: 0; background: transparent; padding: 0; color: var(--leaf-dark); font-weight: 800; text-decoration: underline; text-underline-offset: 3px; }
.cpt-linkbtn:hover { color: var(--leaf); }

/* Tier chips */
.cpt-chip { display: inline-flex; align-items: center; gap: .4rem; padding: .2rem .65rem; border-radius: 999px; border: 1.5px solid var(--line); background: #fff; font-size: .8rem; font-weight: 700; color: var(--ink); white-space: nowrap; }
.cpt-chip--mine { border-color: var(--leaf); box-shadow: 0 0 0 2px rgba(31,138,76,.18); }
.cpt-chip--mine .check { color: var(--leaf); }
.cpt-chips { display: flex; flex-wrap: wrap; gap: .4rem; }

/* Platform passes */
.cpt-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem; margin-bottom: 2.5rem; }
.cpt-pass { display: flex; flex-direction: column; background: #fff; border-radius: 24px; overflow: hidden; box-shadow: 0 1px 0 rgba(29,51,40,.04), 0 14px 30px -18px rgba(29,51,40,.35); }
.cpt-pass__band { background: var(--brand); color: #fff; padding: 1rem 1.25rem; display: flex; align-items: center; justify-content: space-between; gap: .75rem; }
.cpt-pass__id { display: flex; align-items: center; gap: .8rem; min-width: 0; }
.cpt-pass__icon { width: 44px; height: 44px; flex: none; border-radius: 50%; display: grid; place-items: center; background: rgba(255,255,255,.18); border: 2px dashed rgba(255,255,255,.55); font-size: 1.2rem; }
.cpt-pass__name { margin: 0; font-size: 1.25rem; font-weight: 800; line-height: 1.1; }
.cpt-pass__sub { margin: .1rem 0 0; font-size: .8rem; opacity: .92; font-weight: 600; }
.cpt-pass__badge { background: rgba(255,255,255,.2); border-radius: 999px; padding: .2rem .65rem; font-size: .78rem; font-weight: 800; white-space: nowrap; }
.cpt-pass__seam { border-top: 3px dashed #fff; margin: 0 12px; position: relative; top: -2px; opacity: .85; }
.cpt-pass__body { display: flex; flex-direction: column; flex: 1; padding: .9rem 1.25rem 1.25rem; }
.cpt-pass__desc { margin: .85rem 0 1.1rem; font-size: .9rem; line-height: 1.5; color: var(--ink-soft); font-weight: 600; flex: 1; }
.cpt-pass__actions { display: flex; gap: .5rem; }
.cpt-cta { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: .5rem; border-radius: 12px; padding: .65rem .9rem; background: var(--cta); color: #fff; font-weight: 800; font-size: .92rem; text-decoration: none; transition: filter .15s ease; }
.cpt-cta:hover { filter: brightness(1.12); color: #fff; }
.cpt-ghost { border: 1.5px solid var(--line); background: #fff; color: var(--ink); border-radius: 12px; padding: .65rem .9rem; font-size: .88rem; font-weight: 700; transition: border-color .15s ease, background .15s ease; }
.cpt-ghost:hover { border-color: var(--leaf); background: #f6faf7; }

/* Controls */
.cpt-controls { background: #fff; border-radius: 24px; padding: 1.1rem 1.25rem; margin-bottom: 1rem; box-shadow: 0 1px 0 rgba(29,51,40,.04), 0 14px 30px -18px rgba(29,51,40,.3); display: flex; flex-direction: column; gap: 1rem; }
.cpt-filters { display: flex; flex-wrap: wrap; gap: .5rem; }
.cpt-filter { display: inline-flex; align-items: center; gap: .45rem; border: 1.5px solid var(--line); background: #fff; color: var(--ink-soft); border-radius: 999px; padding: .45rem .95rem; font-size: .86rem; font-weight: 700; transition: background .15s ease, border-color .15s ease, color .15s ease; }
.cpt-filter:hover { border-color: var(--leaf); color: var(--ink); }
.cpt-filter[aria-pressed="true"] { background: var(--leaf); border-color: var(--leaf); color: #fff; }
.cpt-filter[aria-pressed="true"] i { color: #fff !important; }
.cpt-search-row { display: flex; gap: .75rem; flex-wrap: wrap; }
.cpt-fieldwrap { flex: 1 1 220px; min-width: 0; }
.cpt-label { display: block; font-size: .82rem; font-weight: 700; margin-bottom: .3rem; }
.cpt-control { display: flex; align-items: center; border: 1.5px solid var(--line); border-radius: 12px; background: #fafcfb; transition: border-color .15s ease, box-shadow .15s ease; }
.cpt-control:focus-within { border-color: var(--leaf); background: #fff; box-shadow: 0 0 0 4px rgba(31,138,76,.16); }
.cpt-control i.lead { width: 2.4rem; padding-left: .9rem; color: var(--ink-soft); flex: none; }
.cpt-input, .cpt-select { flex: 1; min-width: 0; border: 0; background: transparent; outline: none; padding: .6rem .85rem; font-size: .95rem; font-weight: 600; color: var(--ink); }
.cpt-input { padding-left: .25rem; }
.cpt-select { cursor: pointer; }
.cpt-clear { border: 0; background: transparent; color: var(--ink-soft); padding: 0 .9rem; align-self: stretch; border-radius: 0 12px 12px 0; }
.cpt-clear:hover { color: var(--ink); }
.cpt-count { display: flex; align-items: center; justify-content: space-between; gap: .75rem; flex-wrap: wrap; margin: 0 .25rem .75rem; font-size: .88rem; font-weight: 700; color: var(--ink-soft); }

/* Table */
.cpt-tablewrap { background: #fff; border-radius: 24px; overflow: hidden; margin-bottom: 2.5rem; box-shadow: 0 1px 0 rgba(29,51,40,.04), 0 14px 30px -18px rgba(29,51,40,.3); }
.cpt-table { width: 100%; border-collapse: collapse; }
.cpt-table th { text-align: left; padding: .9rem 1rem; font-size: .86rem; font-weight: 800; color: var(--ink-soft); background: #f3f8f5; border-bottom: 2px dashed var(--line); white-space: nowrap; }
.cpt-table td { padding: .85rem 1rem; vertical-align: middle; border-bottom: 1.5px dashed var(--line); }
.cpt-table tbody tr:last-child td { border-bottom: 0; }
.cpt-table tbody tr { transition: background .15s ease; }
.cpt-table tbody tr:hover { background: #fafcfb; }
.cpt-row--open { background: #f1faf4; }
.cpt-row--open td:first-child { box-shadow: inset 4px 0 0 var(--leaf); }
.cpt-isl { display: flex; align-items: center; gap: .75rem; }
.cpt-isl__icon { width: 36px; height: 36px; flex: none; border-radius: 50%; display: grid; place-items: center; background: #e6f4ec; color: var(--leaf-dark); font-size: .9rem; }
.cpt-isl__name { font-weight: 800; color: var(--ink); text-decoration: none; display: block; }
.cpt-isl__name:hover { color: var(--leaf-dark); text-decoration: underline; }
.cpt-gate { display: inline-flex; align-items: center; gap: .4rem; font-size: .8rem; font-weight: 600; color: var(--ink-soft); }
.cpt-dot { width: 8px; height: 8px; border-radius: 50%; background: #aab8af; }
.cpt-dot--on { background: var(--leaf); }
.cpt-cat { display: inline-block; padding: .2rem .65rem; border-radius: 999px; background: #eef3ef; font-size: .8rem; font-weight: 700; }
.cpt-plats { display: inline-flex; gap: .65rem; font-size: 1.05rem; }
.cpt-fly { display: inline-flex; align-items: center; gap: .4rem; border-radius: 10px; padding: .4rem .8rem; background: var(--leaf); color: #fff; font-size: .82rem; font-weight: 800; text-decoration: none; box-shadow: 0 3px 0 var(--leaf-dark); transition: background .15s ease; }
.cpt-fly:hover { background: #22984f; color: #fff; }
.cpt-locked { display: inline-flex; align-items: center; gap: .4rem; font-size: .82rem; font-weight: 700; color: var(--ink-soft); }
.cpt-locked i { color: #c98a0a; }
.cpt-check { border: 1.5px solid var(--line); background: #fff; color: var(--ink); border-radius: 10px; padding: .4rem .8rem; font-size: .8rem; font-weight: 700; }
.cpt-check:hover { border-color: var(--leaf); background: #f6faf7; }
.cpt-end { text-align: right; }
.cpt-empty { text-align: center; padding: 3rem 1.5rem; color: var(--ink-soft); font-weight: 700; }
.cpt-empty i { display: block; font-size: 2rem; margin-bottom: .6rem; color: var(--line); }
.cpt-empty button { margin-top: .9rem; }

@media (max-width: 767px) {
    .cpt-table, .cpt-table tbody, .cpt-table tr, .cpt-table td { display: block; }
    .cpt-table thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
    .cpt-table tbody tr { padding: 1rem 1.1rem; border-bottom: 2px dashed var(--line); }
    .cpt-table tbody tr:last-child { border-bottom: 0; }
    .cpt-table td { padding: .4rem 0; border: 0; }
    .cpt-table td[data-label]::before { content: attr(data-label); display: block; font-size: .78rem; font-weight: 700; color: var(--ink-soft); margin-bottom: .25rem; }
    .cpt-end { text-align: left; }
    .cpt-row--open td:first-child { box-shadow: none; }
    .cpt-row--open { box-shadow: inset 4px 0 0 var(--leaf); }
}

/* How it works */
.cpt-panel { background: #fff; border-radius: 28px; padding: 2rem 1.75rem; margin-bottom: 2.25rem; box-shadow: 0 1px 0 rgba(29,51,40,.04), 0 14px 30px -18px rgba(29,51,40,.3); display: grid; grid-template-columns: 1fr; gap: 1.75rem; }
@media (min-width: 992px) { .cpt-panel { grid-template-columns: 5fr 7fr; gap: 3rem; align-items: center; } }
.cpt-h2 { margin: 0 0 .4rem; font-size: 1.6rem; font-weight: 800; }
.cpt-sub { margin: 0 0 1.2rem; color: var(--ink-soft); font-size: .95rem; font-weight: 600; line-height: 1.5; max-width: 52ch; }
.cpt-btn { display: inline-flex; align-items: center; justify-content: center; gap: .5rem; border-radius: 14px; padding: .7rem 1.2rem; background: var(--leaf); color: #fff; font-weight: 800; font-size: .95rem; text-decoration: none; box-shadow: 0 4px 0 var(--leaf-dark); transition: transform .08s ease, box-shadow .08s ease, background .15s ease; }
.cpt-btn:hover { background: #22984f; color: #fff; }
.cpt-btn:active { transform: translateY(3px); box-shadow: 0 1px 0 var(--leaf-dark); }
.cpt-steps { list-style: none; margin: 0; padding: 0; }
.cpt-step { display: flex; gap: 1rem; position: relative; padding-bottom: 1.4rem; }
.cpt-step:last-child { padding-bottom: 0; }
.cpt-step:not(:last-child)::before { content: ""; position: absolute; left: 17px; top: 38px; bottom: 4px; border-left: 2px dashed var(--line); }
.cpt-step__num { width: 36px; height: 36px; flex: none; border-radius: 50%; display: grid; place-items: center; background: var(--leaf); color: #fff; font-weight: 800; }
.cpt-step h3 { margin: .3rem 0 .2rem; font-size: 1.02rem; font-weight: 800; }
.cpt-step p { margin: 0; font-size: .9rem; color: var(--ink-soft); font-weight: 600; line-height: 1.5; }

.cpt :is(a, button, select, input):focus-visible { outline: 3px solid #0f5132; outline-offset: 2px; }
.cpt-pass__band :is(a, button):focus-visible { outline-color: #fff; }
.cpt-filter[aria-pressed="true"]:focus-visible { outline-color: #0f5132; outline-offset: 3px; }
.cpt-control :is(input, select):focus-visible { outline: none; }
@media (prefers-reduced-motion: reduce) { .cpt * { transition: none !important; } }
`;

export const MembershipTiers = () => {
    const { user, loginWithProvider, login } = useAuth();
    const { islands } = useIslandData();
    const uid = useId();

    const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");
    const [selectedTier, setSelectedTier] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        document.title = "Sub Island Membership Access Matrix • Chopaeng";
    }, []);

    const userTiers = useMemo(() => getUserSubTiers(user), [user]);
    const isSubscriber = userTiers.length > 0 || !!(user?.is_admin || user?.is_mod);

    // Live island lookup (status, id)
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
                const matchesTier = row.allowedTiers.some((t) => t.toLowerCase().includes(q));
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

    const unlockedCount = useMemo(() => islandRows.filter((r) => r.hasAccess).length, [islandRows]);
    const total = islandRows.length;

    // Counts shown in filters are calculated from the matrix so they can't drift from the data
    const platformCount = (p: SignInProvider) => islandRows.filter((r) => r.platforms.includes(p)).length;
    const tierCount = (t: string) => islandRows.filter((r) => r.allowedTiers.includes(t)).length;

    const filtersActive = platformFilter !== "all" || selectedTier !== "all" || searchQuery.trim() !== "";
    const resetFilters = () => {
        setPlatformFilter("all");
        setSelectedTier("all");
        setSearchQuery("");
    };

    const platformFilters: { key: PlatformFilter; label: string; icon: string; color?: string }[] = [
        { key: "all", label: `All platforms (${total})`, icon: "fa-solid fa-globe", color: "var(--ink-soft)" },
        { key: "patreon", label: `Patreon (${platformCount("patreon")})`, icon: PLATFORM_ICON.patreon.icon, color: PLATFORM_ICON.patreon.color },
        { key: "twitch", label: `Twitch (${platformCount("twitch")})`, icon: PLATFORM_ICON.twitch.icon, color: PLATFORM_ICON.twitch.color },
        { key: "youtube", label: `YouTube (${platformCount("youtube")})`, icon: PLATFORM_ICON.youtube.icon, color: PLATFORM_ICON.youtube.color },
        ...(user
            ? [{ key: "unlocked" as PlatformFilter, label: `My unlocked (${unlockedCount})`, icon: "fa-solid fa-circle-check", color: "var(--leaf)" }]
            : []),
    ];

    return (
        <div className="nook-os cpt min-vh-100 p-3 p-lg-5 font-nunito d-flex flex-column align-items-center">
            <style>{STYLES}</style>

            <div className="cpt__wrap">
                {/* Top bar */}
                <nav className="cpt-top" aria-label="Page navigation">
                    <Link to="/membership" className="cpt-pill">
                        <i className="fa-solid fa-arrow-left" aria-hidden="true" />
                        Membership overview
                    </Link>
                    <div className="cpt-top__right">
                        <Link to="/islands" className="cpt-pill">
                            <i className="fa-solid fa-umbrella-beach" aria-hidden="true" />
                            All treasure islands
                        </Link>
                        <a
                            href="https://discord.com/invite/chopaeng"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="cpt-pill cpt-pill--discord"
                        >
                            <i className="fa-brands fa-discord" aria-hidden="true" />
                            Discord support
                            <span className="visually-hidden">(opens in a new tab)</span>
                        </a>
                    </div>
                </nav>

                {/* Hero */}
                <header className="cpt-hero">
                    <div className="cpt-crest" aria-hidden="true">
                        <i className="fa-solid fa-map-location-dot" />
                    </div>
                    <div>
                        <h1 className="ac-font cpt-h1">Sub island access matrix</h1>
                        <p className="cpt-lead">
                            Every sub member treasure island unlocks based on your tier on <strong>Patreon</strong>,{" "}
                            <strong>Twitch</strong>, or <strong>YouTube</strong>. Use the matrix below to see exactly
                            which islands your membership covers.
                        </p>
                    </div>
                </header>

                {/* User status */}
                <div className="cpt-status" aria-live="polite">
                    {user ? (
                        <>
                            <span className="cpt-status__who">
                                <i className="fa-solid fa-circle-user" aria-hidden="true" />
                                Signed in as <strong>{user.username}</strong>
                            </span>
                            <span className="cpt-meter">
                                <span>
                                    {isSubscriber ? `${unlockedCount} of ${total} islands unlocked` : "Free tier"}
                                </span>
                                {isSubscriber && (
                                    <span className="cpt-meter__track" aria-hidden="true">
                                        <span
                                            className="cpt-meter__fill d-block"
                                            style={{ width: `${total ? (unlockedCount / total) * 100 : 0}%` }}
                                        />
                                    </span>
                                )}
                            </span>
                            {userTiers.length > 0 && (
                                <span className="cpt-chips">
                                    {userTiers.map((t) => {
                                        const meta = getTierBadgeMeta(t);
                                        return (
                                            <span key={t} className="cpt-chip">
                                                <i className={meta.icon} style={{ color: meta.color }} aria-hidden="true" />
                                                {t}
                                            </span>
                                        );
                                    })}
                                </span>
                            )}
                        </>
                    ) : (
                        <span className="cpt-status__who">
                            <i className="fa-solid fa-passport" aria-hidden="true" />
                            <span>
                                Want to see which islands you've unlocked?{" "}
                                <button type="button" className="cpt-linkbtn" onClick={() => login()}>
                                    Sign in with Discord or a platform
                                </button>
                            </span>
                        </span>
                    )}
                </div>

                {/* Platform passes */}
                <section className="cpt-grid" aria-label="Membership platforms">
                    {PLATFORM_CARDS.map((p) => (
                        <article
                            key={p.id}
                            className="cpt-pass"
                            style={{ ["--brand" as string]: p.color, ["--cta" as string]: p.cta }}
                        >
                            <div className="cpt-pass__band">
                                <div className="cpt-pass__id">
                                    <div className="cpt-pass__icon" aria-hidden="true">
                                        <i className={p.icon} />
                                    </div>
                                    <div>
                                        <h2 className="ac-font cpt-pass__name">{p.name}</h2>
                                        <p className="cpt-pass__sub">{p.sub}</p>
                                    </div>
                                </div>
                                <span className="cpt-pass__badge">{p.badge}</span>
                            </div>
                            <div className="cpt-pass__seam" aria-hidden="true" />

                            <div className="cpt-pass__body">
                                <div className="cpt-chips">
                                    {p.tiers.map((t) => (
                                        <span key={t} className="cpt-chip">{t}</span>
                                    ))}
                                </div>
                                <p className="cpt-pass__desc">{p.desc}</p>
                                <div className="cpt-pass__actions">
                                    <a href={p.joinUrl} target="_blank" rel="noopener noreferrer" className="cpt-cta">
                                        {p.joinLabel}
                                        <i className="fa-solid fa-arrow-up-right-from-square small" aria-hidden="true" />
                                        <span className="visually-hidden">(opens in a new tab)</span>
                                    </a>
                                    <button
                                        type="button"
                                        className="cpt-ghost"
                                        onClick={() => loginWithProvider(p.id)}
                                        aria-label={`Sign in with ${p.name}`}
                                    >
                                        Sign in
                                    </button>
                                </div>
                            </div>
                        </article>
                    ))}
                </section>

                {/* Controls */}
                <section className="cpt-controls" aria-label="Filter islands">
                    <div role="group" aria-label="Filter by platform" className="cpt-filters">
                        {platformFilters.map((item) => (
                            <button
                                key={item.key}
                                type="button"
                                className="cpt-filter"
                                aria-pressed={platformFilter === item.key}
                                onClick={() => {
                                    setPlatformFilter(item.key);
                                    playChimeClick();
                                }}
                            >
                                <i className={item.icon} style={{ color: item.color }} aria-hidden="true" />
                                {item.label}
                            </button>
                        ))}
                    </div>

                    <div className="cpt-search-row">
                        <div className="cpt-fieldwrap">
                            <label htmlFor={`${uid}-tier`} className="cpt-label">Membership tier</label>
                            <div className="cpt-control">
                                <select
                                    id={`${uid}-tier`}
                                    className="cpt-select"
                                    value={selectedTier}
                                    onChange={(e) => setSelectedTier(e.target.value)}
                                >
                                    <option value="all">All tiers</option>
                                    {TIER_OPTIONS.map((g) => (
                                        <optgroup key={g.group} label={g.group}>
                                            {g.items.map((t) => (
                                                <option key={t} value={t}>
                                                    {t} ({tierCount(t)} islands)
                                                </option>
                                            ))}
                                        </optgroup>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="cpt-fieldwrap">
                            <label htmlFor={`${uid}-search`} className="cpt-label">Search</label>
                            <div className="cpt-control">
                                <i className="fa-solid fa-magnifying-glass lead" aria-hidden="true" />
                                <input
                                    id={`${uid}-search`}
                                    type="search"
                                    className="cpt-input"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Island, category or tier"
                                    autoComplete="off"
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        className="cpt-clear"
                                        onClick={() => setSearchQuery("")}
                                        aria-label="Clear search"
                                    >
                                        <i className="fa-solid fa-xmark" aria-hidden="true" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </section>

                <div className="cpt-count" role="status" aria-live="polite">
                    <span>
                        Showing {filteredRows.length} of {total} islands
                    </span>
                    {filtersActive && (
                        <button type="button" className="cpt-linkbtn" onClick={resetFilters}>
                            Reset filters
                        </button>
                    )}
                </div>

                {/* Matrix */}
                <div className="cpt-tablewrap">
                    {filteredRows.length === 0 ? (
                        <div className="cpt-empty">
                            <i className="fa-solid fa-filter-circle-xmark" aria-hidden="true" />
                            No islands match your filters.
                            <div>
                                <button type="button" className="cpt-ghost" onClick={resetFilters}>
                                    Reset filters
                                </button>
                            </div>
                        </div>
                    ) : (
                        <table className="cpt-table">
                            <caption className="visually-hidden">
                                Sub islands and the membership tiers that unlock them
                            </caption>
                            <thead>
                                <tr>
                                    <th scope="col" style={{ width: 230 }}>Sub island</th>
                                    <th scope="col" style={{ width: 160 }}>Category</th>
                                    <th scope="col">Tiers that unlock it</th>
                                    <th scope="col" style={{ width: 120 }}>Platforms</th>
                                    <th scope="col" className="cpt-end" style={{ width: 140 }}>Your access</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRows.map((row) => {
                                    const online = /online|open/i.test(row.status);
                                    return (
                                        <tr key={row.name} className={row.hasAccess ? "cpt-row--open" : undefined}>
                                            <td>
                                                <div className="cpt-isl">
                                                    <span className="cpt-isl__icon" aria-hidden="true">
                                                        <i className="fa-solid fa-tree" />
                                                    </span>
                                                    <div>
                                                        <Link to={`/island/${row.id}`} className="cpt-isl__name">
                                                            {row.name}
                                                        </Link>
                                                        <span className="cpt-gate">
                                                            <span className={`cpt-dot ${online ? "cpt-dot--on" : ""}`} aria-hidden="true" />
                                                            Gate: {row.status}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>

                                            <td data-label="Category">
                                                <span className="cpt-cat">{row.category}</span>
                                            </td>

                                            <td data-label="Tiers that unlock it">
                                                <div className="cpt-chips">
                                                    {row.allowedTiers.map((tier) => {
                                                        const meta = getTierBadgeMeta(tier);
                                                        const mine = userTiers.some((ut) => ut.toLowerCase() === tier.toLowerCase());
                                                        return (
                                                            <span
                                                                key={tier}
                                                                className={`cpt-chip ${mine ? "cpt-chip--mine" : ""}`}
                                                                title={`Platform: ${meta.provider}`}
                                                            >
                                                                <i className={meta.icon} style={{ color: meta.color }} aria-hidden="true" />
                                                                {tier}
                                                                {mine && (
                                                                    <>
                                                                        <i className="fa-solid fa-check check" aria-hidden="true" />
                                                                        <span className="visually-hidden">(your tier)</span>
                                                                    </>
                                                                )}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            </td>

                                            <td data-label="Platforms">
                                                <span className="cpt-plats">
                                                    {(["patreon", "twitch", "youtube"] as const)
                                                        .filter((p) => row.platforms.includes(p))
                                                        .map((p) => (
                                                            <span key={p} title={PLATFORM_ICON[p].label}>
                                                                <i
                                                                    className={PLATFORM_ICON[p].icon}
                                                                    style={{ color: PLATFORM_ICON[p].color }}
                                                                    aria-hidden="true"
                                                                />
                                                                <span className="visually-hidden">{PLATFORM_ICON[p].label}</span>
                                                            </span>
                                                        ))}
                                                </span>
                                            </td>

                                            <td className="cpt-end" data-label="Your access">
                                                {user ? (
                                                    row.hasAccess ? (
                                                        <Link to={`/island/${row.id}`} className="cpt-fly">
                                                            <i className="fa-solid fa-plane-departure" aria-hidden="true" />
                                                            Fly now
                                                            <span className="visually-hidden">to {row.name}</span>
                                                        </Link>
                                                    ) : (
                                                        <span className="cpt-locked">
                                                            <i className="fa-solid fa-lock" aria-hidden="true" />
                                                            Locked
                                                        </span>
                                                    )
                                                ) : (
                                                    <button type="button" className="cpt-check" onClick={() => login()}>
                                                        Check access
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* How it works */}
                <section className="cpt-panel" aria-labelledby={`${uid}-how`}>
                    <div>
                        <h2 id={`${uid}-how`} className="ac-font cpt-h2">Connecting your sub island access</h2>
                        <p className="cpt-sub">
                            Sub island gates use automated Discord and OAuth role integration. When you join on
                            Patreon, Twitch, or YouTube, your role gives you instant Dodo code passes.
                        </p>
                        <Link to="/membership" className="cpt-btn">
                            View full membership plans
                            <i className="fa-solid fa-arrow-right" aria-hidden="true" />
                        </Link>
                    </div>
                    <ol className="cpt-steps">
                        {STEPS.map((s, i) => (
                            <li key={s.title} className="cpt-step">
                                <span className="cpt-step__num" aria-hidden="true">{i + 1}</span>
                                <div>
                                    <h3>{s.title}</h3>
                                    <p>{s.desc}</p>
                                </div>
                            </li>
                        ))}
                    </ol>
                </section>

                <div className="text-center mt-3">
                    <DisclaimerBanner variant="text" className="mb-0" />
                </div>
            </div>
        </div>
    );
};

export default MembershipTiers;