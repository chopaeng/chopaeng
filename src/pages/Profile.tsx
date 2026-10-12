import { useEffect, useId, useMemo, useRef, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DODO_API_BASE } from "../config/api";
import { getAuthToken } from "../context/authToken";
import { useAuth } from "../context/useAuth";
import { useIslandData } from "../context/useIslandData";
import { useCatalogData } from "../hooks/useCatalogData";
import { useFavoriteIslands, getStoredFavoriteIslands, saveStoredFavoriteIslands } from "../hooks/useFavoriteIslands";
import { useSavedCharacters, type SavedCharacter } from "../hooks/useSavedCharacters";
import { useCaughtCritters } from "../hooks/useCaughtCritters";
import { parseItemCodes } from "../utils/itemCodeParser";
import { playChimeClick } from "../utils/kkAudioSynthesizer";
import { fetchUserOrderHistory, type OrderHistoryItem } from "../utils/orderBotApi";
import { getStoredPassport, fetchPublicPassportFromDb, fetchUserPassportFromDb, cleanPassportUsername, type PublicPassportData } from "../utils/userProfileApi";
import { HowItWorksExplainer, PROFILE_EXPLAINER_CONFIG } from "../components/HowItWorksExplainer";
import { SavedCharactersCard } from "../components/profile/SavedCharactersCard";
import { CritterpediaSummaryCard } from "../components/profile/CritterpediaSummaryCard";
import { AccountInformationTab } from "../components/profile/AccountInformationTab";
import { AddEditCharacterModal } from "../components/profile/modals/AddEditCharacterModal";
import { setUserScopedItem } from "../utils/accountStorage";
import { canUserAccessSubIsland, getUserSubTiers } from "../utils/subIslandAccess";
import { TIER_ID_TO_NAME } from "../config/constants";
import "./Profile.css";

const CHARACTER_ICONS = [
    { id: "fa-leaf", label: "Leaf" },
    { id: "fa-crown", label: "Crown" },
    { id: "fa-star", label: "Star" },
    { id: "fa-heart", label: "Heart" },
    { id: "fa-compass", label: "Compass" },
    { id: "fa-plane", label: "Plane" },
    { id: "fa-fish", label: "Fish" },
    { id: "fa-wand-magic-sparkles", label: "Magic" },
    { id: "fa-user", label: "Resident" },
    { id: "fa-tree", label: "Tree" },
    { id: "fa-gem", label: "Gem" },
    { id: "fa-house", label: "House" },
];

type TabId = "profile" | "account" | "access" | "favorites" | "orders" | "history";
type AccessFilter = "all" | "public" | "member" | "order";

interface ProfileUser {
    id: string;
    discord_name: string;
    global_name: string;
    account_name: string;
    display_name: string;
    nickname: string;
    avatar: string;
    joined_at: string;
    joined_timestamp?: number | null;
    is_admin: boolean;
    is_mod: boolean;
}

interface ProfileRole {
    id: string;
    name: string;
}

interface ProfileIslandAccess {
    id?: string;
    name?: string;
    type?: string;
    channel_id?: string;
    access_source?: string;
    required_roles?: Array<string | ProfileRole>;
    matched_roles?: Array<string | ProfileRole>;
}

interface ProfileSubscriptions {
    role_ids?: string[];
    role_names?: string[];
    roles?: ProfileRole[];
    matched_subscription_role_ids?: string[];
    matched_subscription_role_names?: string[];
    matched_subscription_roles?: ProfileRole[];
    subscription_role_ids?: string[];
    accessible_islands?: ProfileIslandAccess[];
    accessible_member_islands?: ProfileIslandAccess[];
}

interface VisitIsland {
    island_id?: string;
    island_name?: string;
    name?: string;
    type?: string;
    visits?: number;
    count?: number;
    last_visit?: string;
    visited_at?: string;
    authorized?: boolean;
}

interface ProfileVisits {
    total?: number;
    authorized?: number;
    unauthorized?: number;
    by_island_type?: Record<string, number>;
    visits_by_island_type?: Record<string, number>;
    most_visited_islands?: VisitIsland[];
    recent_visits?: VisitIsland[];
    warning_summary?: Record<string, number> | string[] | null;
}

interface ProfileResponse {
    user: ProfileUser;
    subscriptions: ProfileSubscriptions;
    visits: ProfileVisits;
    favorite_islands?: string[];
}

const asArray = <T,>(value: T[] | undefined): T[] => (Array.isArray(value) ? value : []);
const uniqueValues = (items: string[]) => Array.from(new Set(items.filter(Boolean)));
const roleNamesFrom = (roles?: ProfileRole[]) =>
    asArray(roles)
        .map((role) => {
            const name = role.name?.trim();
            if (name && !/^\d+$/.test(name)) return name;
            const id = role.id?.trim();
            if (id && TIER_ID_TO_NAME[id]) return TIER_ID_TO_NAME[id];
            return null;
        })
        .filter((n): n is string => Boolean(n));

const getTierScore = (tierName: string): number => {
    const lower = tierName.toLowerCase();
    let score = 0;
    if (lower.includes("chosoup")) score += 300;
    else if (lower.includes("chocolate")) score += 200;
    else if (lower.includes("chotato") || lower.includes("chofries") || lower.includes("booster")) score += 100;
    else score += 50;

    // Detailed label with platform/tier descriptor (e.g. "ChoSoup (Patreon Tier 3)") preferred over bare "ChoSoup"
    if (lower.includes("patreon") || lower.includes("youtube") || lower.includes("twitch") || lower.includes("tier")) {
        score += 25;
    }
    score += Math.min(lower.length, 10);
    return score;
};

const MS_TIMESTAMP_THRESHOLD = 1e12;

const formatDate = (value?: string | number | null) => {
    if (!value) return "Not available";
    const date =
        typeof value === "number"
            ? new Date(value < MS_TIMESTAMP_THRESHOLD ? value * 1000 : value)
            : new Date(value);
    if (Number.isNaN(date.getTime())) return "Not available";
    return new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
    }).format(date);
};

const formatDateTime = (value?: string | number | null) => {
    if (!value) return "Not available";
    const date =
        typeof value === "number"
            ? new Date(value < MS_TIMESTAMP_THRESHOLD ? value * 1000 : value)
            : new Date(value);
    if (Number.isNaN(date.getTime())) return "Not available";
    return new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    }).format(date);
};

const formatNumber = (value?: number) => new Intl.NumberFormat().format(value ?? 0);

const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

const CPP_STYLES = `
/* ── Scoped ChoPaeng profile styles ── */
.cpp-page {
    --ink: #1d3328;
    --ink-soft: #5b6e63;
    --leaf: #1f8a4c;
    --leaf-dark: #166b3a;
    --line: #cfdcd3;
    --sky: #e3f4f1;
    --error: #b3261e;
    color: var(--ink);
    background:
        radial-gradient(1200px 380px at 50% -140px, #c9ebe4 0%, transparent 70%),
        var(--sky);
    min-height: 100vh;
}

/* Cards (shared with child components such as CritterpediaSummaryCard) */
.cpp-card {
    background: #fff;
    border-radius: 26px;
    box-shadow: 0 1px 0 rgba(29, 51, 40, .04), 0 14px 30px -18px rgba(29, 51, 40, .3);
    overflow: hidden;
    display: flex;
    flex-direction: column;
}
.cpp-card__cover {
    background: var(--leaf);
    color: #fff;
    padding: 1.15rem 1.45rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
}
.cpp-card__cover-left { display: flex; align-items: center; gap: .85rem; min-width: 0; }
.cpp-card__crest {
    width: 48px; height: 48px; flex: none; border-radius: 50%;
    display: grid; place-items: center;
    background: rgba(255,255,255,.16);
    border: 2px dashed rgba(255,255,255,.6);
    font-size: 1.2rem; color: #fff;
}
.cpp-card__title { margin: 0; font-size: 1.18rem; font-weight: 800; line-height: 1.2; color: #fff; }
.cpp-card__subtitle { margin: .15rem 0 0; font-size: .82rem; opacity: .92; font-weight: 600; }
.cpp-card__seam { border-top: 3px dashed #fff; margin: 0 14px; position: relative; top: -2px; opacity: .85; }
.cpp-card__body { padding: 1.35rem 1.5rem; flex: 1; }

/* Hero */
.cpp-hero { background: #fff; border-radius: 28px; box-shadow: 0 1px 0 rgba(29,51,40,.04), 0 16px 36px -18px rgba(29,51,40,.3); overflow: hidden; }
.cpp-hero__cover { background: var(--leaf); color: #fff; padding: 1.25rem 1.6rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
.cpp-hero__body { padding: 1.5rem 1.65rem; }
.cpp-avatar, .cpp-avatar-placeholder { width: 82px; height: 82px; border-radius: 50%; border: 3.5px solid #fff; box-shadow: 0 6px 16px rgba(29,51,40,.18); background: #e6f4ec; }
.cpp-avatar { object-fit: cover; }
.cpp-avatar-placeholder { color: var(--leaf); display: grid; place-items: center; font-size: 2rem; }
.cpp-hero__name { margin: 0 0 .25rem; font-size: 1.7rem; font-weight: 800; line-height: 1.15; overflow-wrap: anywhere; }
.cpp-hero__island { margin: 0 0 .7rem; font-size: .92rem; font-weight: 700; color: var(--ink-soft); }
.cpp-hero__island i { color: var(--leaf); margin-right: .4rem; }
.cpp-hero__island strong { color: var(--ink); }
.cpp-badges { display: flex; flex-wrap: wrap; gap: .45rem; }

/* Stats ribbon */
.cpp-ribbon { list-style: none; margin: 0; padding: .6rem; display: grid; grid-template-columns: repeat(4, 1fr); gap: .35rem; background: #f3f8f5; border-radius: 18px; }
@media (max-width: 575px) { .cpp-ribbon { grid-template-columns: repeat(2, 1fr); } }
.cpp-ribbon__item { width: 100%; border: 0; background: transparent; font: inherit; color: inherit; text-decoration: none; display: flex; flex-direction: column; align-items: center; padding: .55rem .25rem; border-radius: 12px; cursor: pointer; transition: background .15s ease; }
.cpp-ribbon__item:hover { background: #e6f1ea; color: inherit; }
.cpp-ribbon__val { font-size: 1.4rem; font-weight: 800; line-height: 1.1; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.cpp-ribbon__val--leaf { color: var(--leaf-dark); }
.cpp-ribbon__label { font-size: .8rem; color: var(--ink-soft); font-weight: 700; margin-top: .15rem; }

/* Tabs */
.cpp-tablist { display: flex; gap: .35rem; background: #fff; border: 1.5px solid var(--line); border-radius: 999px; padding: 5px; overflow-x: auto; -webkit-overflow-scrolling: touch; margin-top: 1.25rem; scrollbar-width: thin; }
.cpp-tab { flex: none; border: 0; background: transparent; color: var(--ink-soft); border-radius: 999px; padding: .55rem 1rem; font-size: .88rem; font-weight: 700; display: inline-flex; align-items: center; gap: .45rem; white-space: nowrap; transition: background .15s ease, color .15s ease; }
.cpp-tab:hover:not(.cpp-tab--active) { background: #f3f8f5; color: var(--ink); }
.cpp-tab--active { background: var(--leaf); color: #fff; font-weight: 800; }
.cpp-tab__count { padding: .08rem .45rem; border-radius: 999px; font-size: .72rem; font-weight: 800; background: rgba(0,0,0,.08); }
.cpp-tab--active .cpp-tab__count { background: rgba(255,255,255,.25); }

/* Buttons */
.cpp-btn { display: inline-flex; align-items: center; justify-content: center; gap: .45rem; border-radius: 14px; padding: .6rem 1.15rem; font-size: .88rem; font-weight: 700; text-decoration: none; cursor: pointer; border: 1.5px solid transparent; transition: background .15s ease, border-color .15s ease, transform .08s ease, box-shadow .08s ease; }
.cpp-btn:disabled { opacity: .65; cursor: not-allowed; }
.cpp-btn--primary { background: var(--leaf); border-color: var(--leaf); color: #fff; box-shadow: 0 4px 0 var(--leaf-dark); }
.cpp-btn--primary:hover:not(:disabled) { background: #22984f; border-color: #22984f; color: #fff; }
.cpp-btn--primary:active:not(:disabled) { transform: translateY(3px); box-shadow: 0 1px 0 var(--leaf-dark); }
.cpp-btn--secondary { background: #fff; border-color: var(--line); color: var(--ink); }
.cpp-btn--secondary:hover:not(:disabled) { border-color: var(--leaf); background: #f6faf7; color: var(--ink); }
.cpp-btn--secondary i { color: var(--leaf); }
.cpp-btn--danger { background: var(--error); border-color: var(--error); color: #fff; }
.cpp-btn--danger:hover:not(:disabled) { background: #9a1f18; border-color: #9a1f18; color: #fff; }
.cpp-btn--sm { padding: .4rem .85rem; font-size: .82rem; border-radius: 12px; }
.cpp-btn--sm.cpp-btn--primary { box-shadow: 0 3px 0 var(--leaf-dark); }
.cpp-btn--oncover { background: rgba(255,255,255,.18); border-color: rgba(255,255,255,.5); color: #fff; }
.cpp-btn--oncover:hover:not(:disabled) { background: rgba(255,255,255,.3); border-color: #fff; color: #fff; }

/* Badges */
.cpp-badge { display: inline-flex; align-items: center; gap: .35rem; padding: .25rem .7rem; border-radius: 999px; font-size: .78rem; font-weight: 700; }
.cpp-badge--gold { background: #fef3c7; color: #78350f; border: 1px solid #fde68a; }
.cpp-badge--gold-outline { background: #fff; color: #78350f; border: 1.5px solid #fde68a; }
.cpp-badge--leaf { background: #e6f4ec; color: var(--leaf-dark); border: 1px solid #b7dfc8; }
.cpp-badge--muted { background: #f1f5f3; color: var(--ink-soft); border: 1px solid var(--line); }
.cpp-badge--danger { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
.cpp-badge--mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }

.cpp-stitch { border-top: 1.5px dashed var(--line); margin: 1.25rem 0; }

/* Notice */
.cpp-notice { display: flex; gap: .6rem; align-items: flex-start; background: #e6f4ec; color: var(--leaf-dark); border-left: 4px solid var(--leaf); border-radius: 12px; padding: .7rem .95rem; margin-bottom: 1.25rem; font-size: .9rem; font-weight: 700; }
.cpp-notice i { margin-top: .15rem; }

/* Key/value rows and URL box */
.cpp-kv { display: flex; align-items: center; justify-content: space-between; gap: .75rem; background: #f3f8f5; border-radius: 14px; padding: .65rem .9rem; font-size: .88rem; font-weight: 700; }
.cpp-kv + .cpp-kv { margin-top: .6rem; }
.cpp-kv > span:first-child { color: var(--ink-soft); flex: none; }
.cpp-kv__val { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.cpp-url { background: #f3f8f5; border-radius: 14px; padding: .8rem .9rem; margin-bottom: 1rem; }
.cpp-url__label { display: block; font-size: .8rem; font-weight: 700; color: var(--ink-soft); margin-bottom: .25rem; }
.cpp-url__val { display: block; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .85rem; font-weight: 600; overflow-wrap: anywhere; }
.cpp-stack { display: flex; flex-direction: column; gap: 1.5rem; min-width: 0; }

/* Access banner */
.cpp-banner { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1rem; padding: 1rem 1.1rem; border-radius: 20px; border: 1.5px solid var(--line); background: #f6faf7; margin-bottom: 1.25rem; }
.cpp-banner[data-sub="true"] { background: #fffbeb; border-color: #fde68a; }
.cpp-banner__main { display: flex; align-items: center; gap: .9rem; min-width: 0; }
.cpp-banner__icon { width: 50px; height: 50px; flex: none; border-radius: 50%; display: grid; place-items: center; background: #d8f3dc; color: #1b4332; font-size: 1.2rem; }
.cpp-banner[data-sub="true"] .cpp-banner__icon { background: #fef3c7; color: #92400e; }
.cpp-banner__title { margin: 0; font-size: 1rem; font-weight: 800; }
.cpp-banner__sub { margin: .35rem 0 0; font-size: .85rem; color: var(--ink-soft); font-weight: 600; }
.cpp-stats { display: flex; flex-wrap: wrap; gap: .6rem; margin: 0; }
.cpp-stat { background: #fff; border: 1.5px solid var(--line); border-radius: 14px; padding: .5rem .9rem; min-width: 92px; text-align: center; }
.cpp-stat dt { font-size: .78rem; font-weight: 700; color: var(--ink-soft); }
.cpp-stat dd { margin: 0; font-size: 1.25rem; font-weight: 800; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }

/* Filters */
.cpp-toolbar { display: flex; flex-direction: column; gap: .7rem; margin-bottom: 1rem; }
@media (min-width: 768px) { .cpp-toolbar { flex-direction: row; align-items: center; justify-content: space-between; } }
.cpp-filters { display: flex; flex-wrap: wrap; gap: .5rem; }
.cpp-filter { display: inline-flex; align-items: center; gap: .45rem; border: 1.5px solid var(--line); background: #fff; color: var(--ink-soft); border-radius: 999px; padding: .4rem .9rem; font-size: .84rem; font-weight: 700; transition: background .15s ease, border-color .15s ease, color .15s ease; }
.cpp-filter:hover { border-color: var(--leaf); color: var(--ink); }
.cpp-filter[aria-pressed="true"] { background: var(--leaf); border-color: var(--leaf); color: #fff; }
.cpp-note { font-size: .85rem; font-weight: 700; color: var(--ink-soft); }

/* Island cards */
.cpp-island { background: #fff; border: 1.5px solid var(--line); border-radius: 20px; padding: 1.1rem; display: flex; flex-direction: column; height: 100%; transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease; }
.cpp-island:hover { transform: translateY(-2px); border-color: var(--leaf); box-shadow: 0 10px 24px -12px rgba(29,51,40,.3); }
.cpp-island__top { display: flex; align-items: center; justify-content: space-between; gap: .5rem; margin-bottom: .7rem; }
.cpp-island__top-left { display: flex; align-items: center; gap: .55rem; flex-wrap: wrap; min-width: 0; }
.cpp-island__name { margin: 0; font-size: 1.15rem; font-weight: 800; line-height: 1.2; }
.cpp-island__type { font-size: .8rem; font-weight: 600; color: var(--ink-soft); }
.cpp-island__desc { margin: .5rem 0 .9rem; font-size: .85rem; line-height: 1.5; color: var(--ink-soft); font-weight: 600; flex: 1; }
.cpp-island__foot { margin-top: auto; padding-top: .8rem; border-top: 1.5px dashed var(--line); display: flex; align-items: center; justify-content: space-between; gap: .5rem; flex-wrap: wrap; }
.cpp-island__visitors { font-size: .82rem; font-weight: 700; color: var(--ink-soft); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.cpp-status { display: inline-flex; align-items: center; gap: .35rem; font-size: .8rem; font-weight: 700; color: var(--ink-soft); }
.cpp-status--on { color: var(--leaf-dark); }
.cpp-dot { width: 8px; height: 8px; border-radius: 50%; background: #aab8af; }
.cpp-status--on .cpp-dot { background: var(--leaf); }
.cpp-chips { display: flex; flex-wrap: wrap; gap: .35rem; margin: .6rem 0 .9rem; }
.cpp-chip { padding: .15rem .6rem; border-radius: 999px; background: #eef3ef; font-size: .76rem; font-weight: 700; color: var(--ink-soft); }
.cpp-iconbtn { width: 36px; height: 36px; flex: none; border-radius: 50%; display: grid; place-items: center; border: 1.5px solid var(--line); background: #fff; color: var(--ink-soft); transition: background .15s ease, border-color .15s ease; }
.cpp-iconbtn:hover { border-color: var(--leaf); background: #f6faf7; }
.cpp-iconbtn[aria-pressed="true"] { background: #fef3c7; border-color: #f0c53d; color: #8a6508; }

/* Locked panel */
.cpp-locked { background: #f3f8f5; border-radius: 20px; padding: 1.1rem 1.2rem; margin-top: 1.25rem; }
.cpp-locked__head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: .9rem; }
.cpp-locked h3 { margin: 0 0 .25rem; font-size: 1rem; font-weight: 800; }
.cpp-locked p { margin: 0; font-size: .85rem; color: var(--ink-soft); font-weight: 600; max-width: 62ch; line-height: 1.45; }
.cpp-lockchip { display: inline-flex; align-items: center; gap: .4rem; padding: .3rem .75rem; border-radius: 999px; background: #fff; border: 1.5px solid var(--line); font-size: .8rem; font-weight: 700; }
.cpp-lockchip i { color: #c98a0a; }
.cpp-lockchip small { color: var(--ink-soft); font-weight: 600; font-size: inherit; }

/* Orders */
.cpp-order-card { background: #fff; border: 1.5px solid var(--line); border-radius: 20px; padding: 1.15rem; display: flex; flex-direction: column; height: 100%; }
.cpp-order__head { display: flex; align-items: center; justify-content: space-between; gap: .6rem; flex-wrap: wrap; margin-bottom: .6rem; }
.cpp-order__id { background: var(--ink); color: #fff; border-radius: 999px; padding: .15rem .65rem; font-size: .75rem; font-weight: 700; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.cpp-order__time { font-size: .8rem; font-weight: 600; color: var(--ink-soft); }
.cpp-order__island { display: flex; align-items: center; flex-wrap: wrap; gap: .5rem; font-size: .85rem; font-weight: 700; margin-bottom: .6rem; }
.cpp-order__island i { color: var(--leaf); }
.cpp-order__box { background: #f3f8f5; border-radius: 14px; padding: .7rem .85rem; margin-bottom: 1rem; flex: 1; }
.cpp-order__box-title { display: block; font-size: .8rem; font-weight: 700; color: var(--ink-soft); margin-bottom: .45rem; }
.cpp-order__items { display: flex; flex-wrap: wrap; gap: .35rem; max-height: 110px; overflow-y: auto; }
.cpp-item { display: inline-flex; align-items: center; gap: .35rem; background: #fff; border: 1.5px solid var(--line); border-radius: 999px; padding: .15rem .65rem; font-size: .8rem; font-weight: 700; }
.cpp-item img { width: 16px; height: 16px; object-fit: contain; }
.cpp-item b { color: var(--leaf-dark); font-weight: 800; }
.cpp-order__cmd { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .8rem; color: var(--ink-soft); overflow-wrap: anywhere; max-height: 70px; overflow-y: auto; }
.cpp-order__actions { margin-top: auto; padding-top: .8rem; border-top: 1.5px dashed var(--line); display: flex; align-items: center; justify-content: space-between; gap: .5rem; flex-wrap: wrap; }
.cpp-order__actions-right { display: flex; gap: .5rem; flex-wrap: wrap; }

/* Empty states, simple panels */
.cpp-empty { text-align: center; padding: 2.5rem 1rem; }
.cpp-empty__icon { width: 64px; height: 64px; border-radius: 50%; display: grid; place-items: center; margin: 0 auto .8rem; background: #e6f4ec; color: var(--leaf-dark); font-size: 1.5rem; }
.cpp-empty h3 { margin: 0 0 .3rem; font-size: 1.15rem; font-weight: 800; }
.cpp-empty p { max-width: 46ch; margin: 0 auto 1.1rem; color: var(--ink-soft); font-size: .92rem; font-weight: 600; line-height: 1.5; }
.cpp-empty__actions { display: flex; justify-content: center; gap: .6rem; flex-wrap: wrap; }
.cpp-info { background: #f3f8f5; border-radius: 14px; padding: .8rem 1rem; font-size: .88rem; font-weight: 700; color: var(--ink-soft); }
.cpp-info--ok { background: #e6f4ec; color: var(--leaf-dark); display: flex; align-items: center; gap: .6rem; }
.cpp-lead { margin: 0 0 1.25rem; color: var(--ink-soft); line-height: 1.6; font-weight: 600; }
.cpp-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

/* Confirm dialog */
.cpp-modal-backdrop { position: fixed; inset: 0; z-index: 1090; display: flex; align-items: center; justify-content: center; padding: 1rem; background: rgba(18,38,29,.62); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }
.cpp-modal { width: 100%; max-width: 420px; background: #fff; border-radius: 24px; overflow: hidden; box-shadow: 0 30px 60px -20px rgba(18,38,29,.55); outline: none; }
.cpp-modal__body { padding: 1.25rem 1.5rem 1.5rem; }
.cpp-modal__body p { margin: 0 0 1.25rem; color: var(--ink-soft); font-weight: 600; line-height: 1.55; overflow-wrap: anywhere; }
.cpp-modal__actions { display: flex; gap: .6rem; justify-content: flex-end; flex-wrap: wrap; }

/* Focus */
.cpp-page :is(button, a, input, select):focus-visible { outline: 3px solid #0f5132; outline-offset: 2px; }
.cpp-card__cover :is(button, a):focus-visible,
.cpp-hero__cover :is(button, a):focus-visible { outline-color: #fff; }
.cpp-tab--active:focus-visible, .cpp-filter[aria-pressed="true"]:focus-visible { outline-offset: 3px; }

@media (prefers-reduced-motion: reduce) {
    .cpp-page * { transition: none !important; animation: none !important; }
    .cpp-island:hover { transform: none; }
}
`;

interface ConfirmDialogProps {
    open: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
}

const ConfirmDialog = ({
    open,
    title,
    message,
    confirmLabel,
    cancelLabel = "Keep it",
    onConfirm,
    onCancel,
}: ConfirmDialogProps) => {
    const uid = useId();
    const dialogRef = useRef<HTMLDivElement>(null);
    const cancelBtnRef = useRef<HTMLButtonElement>(null);
    const onCancelRef = useRef(onCancel);

    useEffect(() => {
        onCancelRef.current = onCancel;
    });

    useEffect(() => {
        if (!open) return;
        const previouslyFocused = document.activeElement as HTMLElement | null;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const t = window.setTimeout(() => cancelBtnRef.current?.focus(), 30);

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onCancelRef.current();
                return;
            }
            if (e.key !== "Tab" || !dialogRef.current) return;
            const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
            if (!items.length) return;
            const first = items[0];
            const last = items[items.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };
        document.addEventListener("keydown", onKeyDown);

        return () => {
            window.clearTimeout(t);
            document.removeEventListener("keydown", onKeyDown);
            document.body.style.overflow = prevOverflow;
            previouslyFocused?.focus?.();
        };
    }, [open]);

    if (!open) return null;

    return (
        <div className="cpp-modal-backdrop" onClick={() => onCancelRef.current()}>
            <div
                ref={dialogRef}
                className="cpp-modal"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby={`${uid}-title`}
                aria-describedby={`${uid}-msg`}
                onClick={(e) => e.stopPropagation()}
            >
                <header className="cpp-card__cover">
                    <div className="cpp-card__cover-left">
                        <div className="cpp-card__crest" aria-hidden="true">
                            <i className="fa-solid fa-trash" />
                        </div>
                        <h2 id={`${uid}-title`} className="ac-font cpp-card__title">{title}</h2>
                    </div>
                </header>
                <div className="cpp-card__seam" aria-hidden="true" />
                <div className="cpp-modal__body">
                    <p id={`${uid}-msg`}>{message}</p>
                    <div className="cpp-modal__actions">
                        <button ref={cancelBtnRef} type="button" className="cpp-btn cpp-btn--secondary" onClick={onCancel}>
                            {cancelLabel}
                        </button>
                        <button type="button" className="cpp-btn cpp-btn--danger" onClick={onConfirm}>
                            {confirmLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const Profile = () => {
    const navigate = useNavigate();
    const { user: authUser, loading: authLoading, login, canAccessIsland } = useAuth();
    const { islands: allIslands } = useIslandData();
    const { favoriteIslands, toggleFavoriteIsland, isFavoriteIsland } = useFavoriteIslands();
    const caughtCritters = useCaughtCritters();

    const [profile, setProfile] = useState<ProfileResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [prefNotice, setPrefNotice] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<TabId>("profile");
    const [accessFilter, setAccessFilter] = useState<AccessFilter>("all");

    // One notice at a time; a new notice replaces the old one and resets its timer
    const noticeTimer = useRef<number | null>(null);
    const showNotice = useCallback((message: string, ms = 4000) => {
        setPrefNotice(message);
        if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
        noticeTimer.current = window.setTimeout(() => setPrefNotice(null), ms);
    }, []);
    useEffect(() => {
        return () => {
            if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
        };
    }, []);

    // Load catalog if user is viewing orders, history, or passport studio (for villagers & sprites)
    const shouldLoadCatalog = activeTab === "orders" || activeTab === "history" || activeTab === "profile";
    const { data: catalogData } = useCatalogData({ enabled: shouldLoadCatalog });

    // Public Passport Customizer State
    const [passportData, setPassportData] = useState<PublicPassportData>(() => {
        const authHandle = cleanPassportUsername(authUser?.username, "");
        const base = getStoredPassport(authHandle);
        return {
            ...base,
            username: cleanPassportUsername(base.username, authHandle),
        };
    });
    const [passportLinkCopied, setPassportLinkCopied] = useState(false);
    const copyTimers = useRef<number[]>([]);
    useEffect(() => {
        const list = copyTimers.current;
        return () => list.forEach((t) => window.clearTimeout(t));
    }, []);

    // Orders History & Reorder State
    const [orders, setOrders] = useState<OrderHistoryItem[]>([]);
    const [ordersLoading, setOrdersLoading] = useState(false);
    const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);

    const loadOrders = useCallback(async () => {
        setOrdersLoading(true);
        const token = getAuthToken();
        const res = await fetchUserOrderHistory(token);
        if (res.success && res.orders) {
            setOrders(res.orders);
        }
        setOrdersLoading(false);
    }, []);

    useEffect(() => {
        loadOrders();
    }, [loadOrders, authUser?.user_id]);

    const parsedOrdersMap = useMemo(() => {
        const map = new Map<string, ReturnType<typeof parseItemCodes>>();
        const catalog = catalogData?.all || [];
        for (const order of orders) {
            map.set(order.id, parseItemCodes(order.command, catalog));
        }
        return map;
    }, [orders, catalogData?.all]);

    const handleReorder = (order: OrderHistoryItem, targetRoute: "/order" | "/command-builder" = "/order") => {
        const bundle = parseItemCodes(order.command, catalogData?.all || []);
        if (bundle.items.length > 0) {
            const mappedEntries = bundle.items.map((item) => ({
                item: {
                    id: item.itemId,
                    name: item.name,
                    category: item.category || "General",
                    image: item.image,
                    baseId: item.itemId,
                    variantId: item.variantId ?? null,
                    variantLabel: item.variantLabel ?? null,
                },
                quantity: item.quantity,
            }));
            setUserScopedItem("command_builder_order_items", JSON.stringify(mappedEntries), authUser?.user_id);
            playChimeClick();
            showNotice(
                `Loaded ${bundle.items.length} item types (${bundle.totalSlots} slots) from order #${order.id}. Opening ${targetRoute === "/order" ? "order bot" : "command builder"}…`
            );
            navigate(targetRoute);
        } else {
            playChimeClick();
            navigate(targetRoute);
        }
    };

    const handleCopyOrderCommand = async (order: OrderHistoryItem) => {
        const cmd = order.command.startsWith("!") ? order.command : `!order ${order.command}`;
        playChimeClick();
        try {
            await navigator.clipboard.writeText(cmd);
            setCopiedOrderId(order.id);
            copyTimers.current.push(window.setTimeout(() => setCopiedOrderId(null), 2500));
        } catch {
            showNotice("Couldn't copy to your clipboard. Select the command and copy it by hand.", 5000);
        }
    };

    // ── MULTI-PLATFORM UNIFIED SUBSCRIPTION DETECTION ──
    const userSubTiers = useMemo(() => getUserSubTiers(authUser), [authUser]);

    const subscriptionRoleNames = useMemo(() => {
        const subscriptions = profile?.subscriptions;
        const candidateNames = uniqueValues([
            ...asArray(subscriptions?.matched_subscription_role_names),
            ...roleNamesFrom(subscriptions?.matched_subscription_roles),
            ...asArray(subscriptions?.role_names),
            ...roleNamesFrom(subscriptions?.roles),
        ]);
        const validNames = candidateNames
            .map((name) => {
                const trimmed = name?.trim();
                if (!trimmed) return null;
                if (/^\d+$/.test(trimmed)) {
                    return TIER_ID_TO_NAME[trimmed] || null;
                }
                return trimmed;
            })
            .filter((n): n is string => Boolean(n));

        if (validNames.length > 0) return uniqueValues(validNames);

        const idCandidates = uniqueValues([
            ...asArray(subscriptions?.role_ids),
            ...asArray(subscriptions?.matched_subscription_role_ids),
            ...asArray(subscriptions?.subscription_role_ids),
        ]);
        return idCandidates
            .map((id) => TIER_ID_TO_NAME[id?.trim() || ""])
            .filter((n): n is string => Boolean(n));
    }, [profile]);

    // Consolidate tiers from Discord, Twitch, Patreon, and YouTube
    const allSubscriptionTierNames = useMemo(() => {
        const rawCandidates = new Set<string>();
        if (authUser?.sub_tier && typeof authUser.sub_tier === "string" && authUser.sub_tier.trim()) {
            rawCandidates.add(authUser.sub_tier.trim());
        }
        for (const t of userSubTiers) {
            if (t && typeof t === "string" && t.trim()) rawCandidates.add(t.trim());
        }
        for (const r of subscriptionRoleNames) {
            if (r && typeof r === "string" && r.trim()) rawCandidates.add(r.trim());
        }

        const validCandidates = Array.from(rawCandidates)
            .map((name) => {
                const trimmed = name.trim();
                if (/^\d+$/.test(trimmed)) {
                    return TIER_ID_TO_NAME[trimmed] || null;
                }
                return trimmed;
            })
            .filter((n): n is string => Boolean(n));

        if (validCandidates.length === 0) return [];

        // Deduplicate redundant base forms (e.g. if "ChoSoup (Patreon Tier 3)" exists, remove bare "ChoSoup")
        const deduplicated = validCandidates.filter((cand) => {
            const isRedundantBase = validCandidates.some(
                (other) =>
                    other !== cand &&
                    other.toLowerCase().startsWith(cand.toLowerCase()) &&
                    other.length > cand.length
            );
            return !isRedundantBase;
        });

        return deduplicated.sort((a, b) => getTierScore(b) - getTierScore(a));
    }, [authUser?.sub_tier, userSubTiers, subscriptionRoleNames]);

    const primarySubscriptionTier = useMemo(() => {
        if (allSubscriptionTierNames.length > 0) {
            return allSubscriptionTierNames[0];
        }
        if (authUser?.sub_tier && !/^\d+$/.test(authUser.sub_tier.trim())) {
            return authUser.sub_tier.trim();
        }
        if (authUser?.is_subscriber) {
            return "Active subscriber";
        }
        return null;
    }, [allSubscriptionTierNames, authUser]);

    const hasActiveSubscription =
        allSubscriptionTierNames.length > 0 ||
        Boolean(primarySubscriptionTier) ||
        Boolean(authUser?.is_subscriber) ||
        Boolean(authUser?.is_admin) ||
        Boolean(authUser?.is_mod);

    const rawDiscordName =
        profile?.user.nickname ||
        profile?.user.display_name ||
        profile?.user.global_name ||
        authUser?.username ||
        "";

    // Multi-slot saved characters
    const {
        characters,
        activeCharacter,
        maxSlots,
        isSyncingDb,
        addCharacter,
        updateCharacter,
        deleteCharacter,
        setDefaultCharacter,
    } = useSavedCharacters(rawDiscordName);

    // Sync and hydrate Public Passport state from ChoBot database & local storage
    useEffect(() => {
        const authName = cleanPassportUsername(authUser?.username || profile?.user?.account_name, "");
        const userAvatar = profile?.user?.avatar || authUser?.avatar || "";
        const lookupHandle = cleanPassportUsername(passportData.username, authName);
        if (lookupHandle || authName) {
            const queryTarget = lookupHandle || authName;
            const token = getAuthToken();

            Promise.allSettled([
                fetchUserPassportFromDb(token),
                fetchPublicPassportFromDb(queryTarget, token),
            ]).then(([userRes, pubRes]) => {
                const userPassport = userRes.status === "fulfilled" ? userRes.value : null;
                const pubPassport = pubRes.status === "fulfilled" ? pubRes.value : null;
                const dbPassport = userPassport || pubPassport;
                const base = dbPassport || getStoredPassport(queryTarget);
                const resolvedUsername = cleanPassportUsername(base.username, queryTarget);

                setPassportData((prev) => {
                    const chosenUsername = dbPassport?.username
                        ? cleanPassportUsername(dbPassport.username, resolvedUsername)
                        : cleanPassportUsername(prev.username, resolvedUsername);
                    return {
                        ...base,
                        passportSkin: prev.passportSkin || base.passportSkin || "nook",
                        passportPattern: prev.passportPattern || base.passportPattern || "dots",
                        featuredItems: (prev.featuredItems && prev.featuredItems.length > 0) ? prev.featuredItems : (base.featuredItems || []),
                        username: chosenUsername,
                        avatarUrl: userAvatar || base.avatarUrl || "",
                        primaryIgn: activeCharacter.ign || base.primaryIgn || "",
                        primaryIsland: activeCharacter.islandName || base.primaryIsland || "",
                    };
                });
            }).catch(() => {
                const stored = getStoredPassport(queryTarget);
                const resolvedUsername = cleanPassportUsername(stored.username, queryTarget);
                setPassportData((prev) => ({
                    ...stored,
                    username: cleanPassportUsername(prev.username, resolvedUsername),
                    avatarUrl: userAvatar || stored.avatarUrl || "",
                    primaryIgn: activeCharacter.ign || stored.primaryIgn || "",
                    primaryIsland: activeCharacter.islandName || stored.primaryIsland || "",
                }));
            });
        }
    }, [authUser?.username, profile?.user?.account_name, profile?.user?.avatar, authUser?.avatar, activeCharacter.ign, activeCharacter.islandName]);

    // Saved in-game character creation / editing state
    const [characterModalOpen, setCharacterModalOpen] = useState(false);
    const [editingCharId, setEditingCharId] = useState<string | null>(null);
    const [charIgn, setCharIgn] = useState("");
    const [charIsland, setCharIsland] = useState("");
    const [charIcon, setCharIcon] = useState("fa-leaf");
    const [charError, setCharError] = useState("");
    const [isSavingChar, setIsSavingChar] = useState(false);
    const [pendingDelete, setPendingDelete] = useState<SavedCharacter | null>(null);

    const handleOpenAddCharacter = () => {
        setEditingCharId(null);
        setCharIgn("");
        setCharIsland("");
        setCharIcon("fa-leaf");
        setCharError("");
        setCharacterModalOpen(true);
        playChimeClick();
    };

    const handleOpenEditCharacter = (char: SavedCharacter) => {
        setEditingCharId(char.id);
        setCharIgn(char.ign);
        setCharIsland(char.islandName);
        setCharIcon(char.icon || "fa-leaf");
        setCharError("");
        setCharacterModalOpen(true);
        playChimeClick();
    };

    const handleSaveCharacterModal = async (e: React.FormEvent) => {
        e.preventDefault();
        const cleanIgn = charIgn.trim();
        const cleanIsland = charIsland.trim();
        if (!cleanIgn) {
            setCharError("Enter your in-game name (IGN).");
            return;
        }
        if (!cleanIsland) {
            setCharError("Enter your island name.");
            return;
        }

        setIsSavingChar(true);
        setCharError("");

        try {
            if (editingCharId) {
                updateCharacter(editingCharId, {
                    ign: cleanIgn,
                    islandName: cleanIsland,
                    icon: charIcon,
                });
                playChimeClick();
            } else {
                const ok = addCharacter(cleanIgn, cleanIsland, charIcon);
                if (!ok) {
                    setCharError(`All ${maxSlots} character slots are used. Delete one to add another.`);
                    setIsSavingChar(false);
                    return;
                }
                playChimeClick();
            }

            showNotice(
                editingCharId
                    ? `Character "${cleanIgn}" updated.`
                    : `New character "${cleanIgn}" created.`
            );
            setCharacterModalOpen(false);
        } finally {
            setIsSavingChar(false);
        }
    };

    const handleCloseCharacterModal = useCallback(() => setCharacterModalOpen(false), []);

    const handleSetActiveCharacter = (char: SavedCharacter) => {
        setDefaultCharacter(char.id);
        playChimeClick();
        showNotice(`Active character set to "${char.ign}".`, 3500);
    };

    // Deleting now asks in an in-page dialog instead of window.confirm
    const handleDeleteCharacter = (char: SavedCharacter) => {
        playChimeClick();
        setPendingDelete(char);
    };

    const closeDeleteDialog = useCallback(() => setPendingDelete(null), []);

    const confirmDeleteCharacter = () => {
        if (!pendingDelete) return;
        deleteCharacter(pendingDelete.id);
        playChimeClick();
        showNotice(`Character "${pendingDelete.ign}" deleted.`, 3500);
        setPendingDelete(null);
    };

    useEffect(() => {
        document.title = "Resident Passport & Dashboard • Chopaeng";
    }, []);

    useEffect(() => {
        if (authLoading) return;

        const token = getAuthToken();
        if (!token) {
            setLoading(false);
            return;
        }

        const controller = new AbortController();
        setLoading(true);
        setError("");

        fetch(`${DODO_API_BASE}/api/profile`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
        })
            .then(async (resp) => {
                if (!resp.ok) {
                    const body = await resp.json().catch(() => ({}));
                    throw new Error(body.error || "Unable to load your profile.");
                }
                return resp.json() as Promise<ProfileResponse>;
            })
            .then((data) => {
                setProfile(data);
                if (Array.isArray(data.favorite_islands) && data.favorite_islands.length > 0) {
                    const local = getStoredFavoriteIslands();
                    const merged = Array.from(
                        new Set([...local, ...data.favorite_islands.map((id) => id.trim().toLowerCase())])
                    );
                    saveStoredFavoriteIslands(merged);
                }
            })
            .catch((err: unknown) => {
                if (err instanceof DOMException && err.name === "AbortError") return;
                const message = err instanceof Error ? err.message : "Unable to load your profile.";
                setError(message);
            })
            .finally(() => {
                setLoading(false);
            });

        return () => {
            controller.abort();
        };
    }, [authLoading, authUser?.user_id]);

    const accessibleIslands = asArray(
        profile?.subscriptions.accessible_member_islands ?? profile?.subscriptions.accessible_islands
    );
    const mostVisited = asArray(profile?.visits.most_visited_islands);
    const recentVisits = asArray(profile?.visits.recent_visits);
    const warningSummary = profile?.visits.warning_summary;
    const profileUser = profile?.user;
    const displayName = profileUser?.display_name || authUser?.username || "Resident Member";

    // Matching Favorite Islands with live Island data
    const favoritedIslandObjects = useMemo(() => {
        if (favoriteIslands.length === 0) return [];
        return allIslands.filter((isl) =>
            favoriteIslands.some(
                (fav) =>
                    fav.trim().toLowerCase() === isl.name.trim().toLowerCase() ||
                    fav.trim().toLowerCase() === isl.id.trim().toLowerCase()
            )
        );
    }, [allIslands, favoriteIslands]);

    // Compute total unlocked islands based on public tier + subscription/role matches + sub island matrix
    const userUnlockedIslands = useMemo(() => {
        return allIslands.filter((island) => {
            const isFree = island.cat === "public" && (island.requiredRoles?.length ?? 0) === 0;
            if (isFree) return true;
            if (island.accessible || island.viewerHasAccess) return true;
            if (island.requiredRoles && island.requiredRoles.length > 0 && canAccessIsland(island.requiredRoles)) {
                return true;
            }
            if (canUserAccessSubIsland(island.name, authUser)) {
                return true;
            }
            return accessibleIslands.some(
                (acc) =>
                    (acc.id && acc.id.toLowerCase() === island.id.toLowerCase()) ||
                    (acc.name && acc.name.toLowerCase() === island.name.toLowerCase())
            );
        });
    }, [allIslands, accessibleIslands, canAccessIsland, authUser]);

    const lockedIslands = useMemo(() => {
        return allIslands.filter(
            (island) => !userUnlockedIslands.some((u) => u.id === island.id)
        );
    }, [allIslands, userUnlockedIslands]);

    const filteredAccessIslands = useMemo(() => {
        if (accessFilter === "all") return userUnlockedIslands;
        return userUnlockedIslands.filter((island) => island.cat === accessFilter);
    }, [userUnlockedIslands, accessFilter]);

    const unlockedPublic = userUnlockedIslands.filter((i) => i.cat === "public").length;
    const unlockedMember = userUnlockedIslands.filter((i) => i.cat === "member").length;
    const unlockedOrder = userUnlockedIslands.filter((i) => i.cat === "order").length;

    // Tabs: roving tabindex with arrow keys
    const tabRefs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({});
    const tabs: { id: TabId; icon: string; label: string; count?: string | number }[] = [
        { id: "profile", icon: "fa-user", label: "Profile hub", count: `${characters.length}/${maxSlots}` },
        {
            id: "account",
            icon: "fa-user-shield",
            label: "Account information",
            count: authUser?.connected_providers?.length || (authUser?.email ? 1 : 0),
        },
        { id: "access", icon: "fa-key", label: "Your access & islands", count: userUnlockedIslands.length },
        { id: "favorites", icon: "fa-star", label: "Favorite islands", count: favoriteIslands.length },
        { id: "orders", icon: "fa-box-open", label: "Order history", count: orders.length > 0 ? orders.length : undefined },
        { id: "history", icon: "fa-clock-rotate-left", label: "Flight history & logs" },
    ];

    const goTab = (id: TabId) => {
        playChimeClick();
        setActiveTab(id);
    };

    const onTabKeyDown = (e: React.KeyboardEvent, index: number) => {
        let next = index;
        if (e.key === "ArrowRight") next = (index + 1) % tabs.length;
        else if (e.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
        else if (e.key === "Home") next = 0;
        else if (e.key === "End") next = tabs.length - 1;
        else return;
        e.preventDefault();
        const target = tabs[next];
        setActiveTab(target.id);
        tabRefs.current[target.id]?.focus();
    };

    if (authLoading || loading) {
        return (
            <div className="cpp-page d-flex align-items-center justify-content-center p-4">
                <style>{CPP_STYLES}</style>
                <div className="cpp-card" style={{ maxWidth: 420, width: "100%" }} role="status" aria-live="polite">
                    <div className="cpp-card__body text-center py-5">
                        <div className="spinner-border text-success mb-3 mx-auto" aria-hidden="true" />
                        <h2 className="ac-font h5 mb-1">Loading your passport</h2>
                        <p className="small text-muted mb-0">Fetching your resident records…</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!authUser && !profile) {
        return (
            <div className="cpp-page py-5 px-3">
                <style>{CPP_STYLES}</style>
                <div className="container" style={{ maxWidth: 640 }}>
                    <div className="cpp-card">
                        <header className="cpp-card__cover">
                            <div className="cpp-card__cover-left">
                                <div className="cpp-card__crest" aria-hidden="true">
                                    <i className="fa-solid fa-passport" />
                                </div>
                                <div>
                                    <h1 className="ac-font cpp-card__title">Resident passport &amp; profile</h1>
                                    <p className="cpp-card__subtitle">ChoPaeng community verification</p>
                                </div>
                            </div>
                        </header>
                        <div className="cpp-card__seam" aria-hidden="true" />
                        <div className="cpp-card__body text-center">
                            <p className="cpp-lead">
                                Sign in with your Twitch, Patreon, YouTube, or Discord account to see your verified passport, track order bot requests, manage in-game characters, and check which islands you've unlocked.
                            </p>
                            <button type="button" onClick={() => login()} className="cpp-btn cpp-btn--primary px-4">
                                <i className="fa-solid fa-right-to-bracket" aria-hidden="true" />
                                <span>Sign in to your passport</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="cpp-page d-flex align-items-center justify-content-center p-4">
                <style>{CPP_STYLES}</style>
                <div className="cpp-card" style={{ maxWidth: 480, width: "100%" }}>
                    <header className="cpp-card__cover" style={{ background: "#991b1b" }}>
                        <div className="cpp-card__cover-left">
                            <div className="cpp-card__crest" aria-hidden="true">
                                <i className="fa-solid fa-triangle-exclamation" />
                            </div>
                            <div>
                                <h1 className="ac-font cpp-card__title">We couldn't load your profile</h1>
                                <p className="cpp-card__subtitle">Check your connection and try again</p>
                            </div>
                        </div>
                    </header>
                    <div className="cpp-card__seam" aria-hidden="true" />
                    <div className="cpp-card__body">
                        <p role="alert" className="cpp-lead">{error}</p>
                        <div className="d-grid gap-2">
                            <button type="button" onClick={() => window.location.reload()} className="cpp-btn cpp-btn--primary">
                                <i className="fa-solid fa-rotate" aria-hidden="true" />
                                <span>Reload the page</span>
                            </button>
                            <button type="button" onClick={() => login()} className="cpp-btn cpp-btn--secondary">
                                <i className="fa-solid fa-right-to-bracket" aria-hidden="true" />
                                <span>Sign in again</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const publicUsername = cleanPassportUsername(passportData.username, authUser?.username || "resident");
    const publicPath = `/u/${encodeURIComponent(publicUsername)}`;
    const publicUrl = `${window.location.origin}${publicPath}`;

    const handleCopyProfileLink = async () => {
        playChimeClick();
        try {
            await navigator.clipboard.writeText(publicUrl);
            setPassportLinkCopied(true);
            copyTimers.current.push(window.setTimeout(() => setPassportLinkCopied(false), 2500));
        } catch {
            showNotice("Couldn't copy to your clipboard. Select the link and copy it by hand.", 5000);
        }
    };

    return (
        <div className="cpp-page font-nunito pb-5">
            <style>{CPP_STYLES}</style>

            {/* ── 1. PASSPORT HERO ── */}
            <div className="pt-3 pt-md-4">
                <div className="container" style={{ maxWidth: 1140 }}>
                    <section className="cpp-hero" aria-labelledby="cpp-hero-title">
                        <header className="cpp-hero__cover">
                            <div className="cpp-card__cover-left">
                                <div className="cpp-card__crest" aria-hidden="true">
                                    <i className="fa-solid fa-passport" />
                                </div>
                                <div>
                                    <h1 id="cpp-hero-title" className="ac-font cpp-card__title">Resident passport</h1>
                                    <p className="cpp-card__subtitle">
                                        Verified citizen &middot; ID {profileUser?.id || authUser?.user_id || "Resident"}
                                    </p>
                                </div>
                            </div>
                            <span className="cpp-badge cpp-badge--gold">
                                <i className="fa-solid fa-stamp" aria-hidden="true" />
                                <span>Verified passport</span>
                            </span>
                        </header>
                        <div className="cpp-card__seam" aria-hidden="true" />

                        <div className="cpp-hero__body">
                            <div className="row align-items-center gy-4">
                                <div className="col-lg-7 d-flex flex-column flex-sm-row align-items-center align-items-sm-start gap-3 text-center text-sm-start">
                                    <div className="flex-shrink-0">
                                        {profileUser?.avatar ? (
                                            <img src={profileUser.avatar} alt={`${displayName}'s avatar`} className="cpp-avatar" />
                                        ) : (
                                            <div className="cpp-avatar-placeholder" aria-hidden="true">
                                                <i className="fa-solid fa-user-astronaut" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-grow-1" style={{ minWidth: 0 }}>
                                        <h2 className="ac-font cpp-hero__name">{activeCharacter.ign || displayName}</h2>
                                        <p className="cpp-hero__island">
                                            <i className="fa-solid fa-tree" aria-hidden="true" />
                                            Island: <strong>{activeCharacter.islandName || "ChoPaeng Island"}</strong>
                                        </p>

                                        <div className="cpp-badges justify-content-center justify-content-sm-start">
                                            {profileUser?.is_admin && (
                                                <span className="cpp-badge cpp-badge--danger">Administrator</span>
                                            )}
                                            {profileUser?.is_mod && (
                                                <span className="cpp-badge cpp-badge--leaf">Moderator</span>
                                            )}

                                            {primarySubscriptionTier ? (
                                                <span className="cpp-badge cpp-badge--gold">
                                                    <i className="fa-solid fa-crown" aria-hidden="true" />
                                                    <span>{primarySubscriptionTier}</span>
                                                </span>
                                            ) : hasActiveSubscription ? (
                                                <span className="cpp-badge cpp-badge--gold">
                                                    <i className="fa-solid fa-crown" aria-hidden="true" />
                                                    <span>Active subscriber</span>
                                                </span>
                                            ) : (
                                                <span className="cpp-badge cpp-badge--muted">Standard resident pass</span>
                                            )}

                                            <span className="cpp-badge cpp-badge--muted">
                                                <i className="fa-regular fa-calendar-check" aria-hidden="true" />
                                                <span>Joined {formatDate(profileUser?.joined_at ?? profileUser?.joined_timestamp)}</span>
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="col-lg-5">
                                    <ul className="cpp-ribbon" aria-label="Passport stats">
                                        <li>
                                            <button
                                                type="button"
                                                className="cpp-ribbon__item"
                                                onClick={() => goTab("orders")}
                                                aria-label={`${formatNumber(orders.length)} orders. View order history`}
                                            >
                                                <span className="cpp-ribbon__val">{formatNumber(orders.length)}</span>
                                                <span className="cpp-ribbon__label">Orders</span>
                                            </button>
                                        </li>
                                        <li>
                                            <Link
                                                to="/my-collection"
                                                className="cpp-ribbon__item"
                                                aria-label={`${formatNumber(caughtCritters.caughtCount)} critters caught. View my collection`}
                                            >
                                                <span className="cpp-ribbon__val cpp-ribbon__val--leaf">{formatNumber(caughtCritters.caughtCount)}</span>
                                                <span className="cpp-ribbon__label">Critters</span>
                                            </Link>
                                        </li>
                                        <li>
                                            <button
                                                type="button"
                                                className="cpp-ribbon__item"
                                                onClick={() => goTab("history")}
                                                aria-label={`${formatNumber(profile?.visits.total)} visits. View flight history`}
                                            >
                                                <span className="cpp-ribbon__val">{formatNumber(profile?.visits.total)}</span>
                                                <span className="cpp-ribbon__label">Visits</span>
                                            </button>
                                        </li>
                                        <li>
                                            <button
                                                type="button"
                                                className="cpp-ribbon__item"
                                                onClick={() => goTab("access")}
                                                aria-label={`${formatNumber(userUnlockedIslands.length)} islands unlocked. View your access`}
                                            >
                                                <span className="cpp-ribbon__val cpp-ribbon__val--leaf">{formatNumber(userUnlockedIslands.length)}</span>
                                                <span className="cpp-ribbon__label">Unlocked</span>
                                            </button>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Section switch */}
                    <div className="cpp-tablist" role="tablist" aria-label="Passport dashboard sections">
                        {tabs.map((tab, index) => {
                            const selected = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    ref={(el) => {
                                        tabRefs.current[tab.id] = el;
                                    }}
                                    type="button"
                                    role="tab"
                                    id={`tab-btn-${tab.id}`}
                                    aria-controls={selected ? "cpp-tabpanel" : undefined}
                                    aria-selected={selected}
                                    tabIndex={selected ? 0 : -1}
                                    className={`cpp-tab ${selected ? "cpp-tab--active" : ""}`}
                                    onClick={() => goTab(tab.id)}
                                    onKeyDown={(e) => onTabKeyDown(e, index)}
                                >
                                    <i className={`fa-solid ${tab.icon}`} aria-hidden="true" />
                                    <span>{tab.label}</span>
                                    {tab.count !== undefined && <span className="cpp-tab__count">{tab.count}</span>}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ── 2. SECTION CONTENT ── */}
            <div className="container py-4" style={{ maxWidth: 1140 }}>
                <div role="status" aria-live="polite">
                    {prefNotice && (
                        <div className="cpp-notice">
                            <i className="fa-solid fa-circle-check" aria-hidden="true" />
                            <span>{prefNotice}</span>
                        </div>
                    )}
                </div>

                <HowItWorksExplainer {...PROFILE_EXPLAINER_CONFIG} className="mb-4" defaultExpanded={false} />

                <div id="cpp-tabpanel" role="tabpanel" aria-labelledby={`tab-btn-${activeTab}`}>
                    {/* ── PROFILE HUB ── */}
                    {activeTab === "profile" && (
                        <div className="row g-4">
                            <div className="col-lg-7 cpp-stack">
                                <SavedCharactersCard
                                    characters={characters}
                                    isSyncingDb={isSyncingDb}
                                    onOpenAddCharacter={handleOpenAddCharacter}
                                    onOpenEditCharacter={handleOpenEditCharacter}
                                    onDeleteCharacter={handleDeleteCharacter}
                                    onSetActiveCharacter={handleSetActiveCharacter}
                                />

                                <CritterpediaSummaryCard caughtCritters={caughtCritters} />
                            </div>

                            <div className="col-lg-5 cpp-stack">
                                <section className="cpp-card" aria-labelledby="cpp-public-title">
                                    <header className="cpp-card__cover">
                                        <div className="cpp-card__cover-left">
                                            <div className="cpp-card__crest" aria-hidden="true">
                                                <i className="fa-solid fa-globe" />
                                            </div>
                                            <div>
                                                <h3 id="cpp-public-title" className="ac-font cpp-card__title">Public profile</h3>
                                                <p className="cpp-card__subtitle">Your shareable resident card</p>
                                            </div>
                                        </div>
                                        <Link
                                            to={publicPath}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="cpp-btn cpp-btn--sm cpp-btn--oncover"
                                        >
                                            <span>View</span>
                                            <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" />
                                            <span className="cpp-sr">(opens in a new tab)</span>
                                        </Link>
                                    </header>
                                    <div className="cpp-card__seam" aria-hidden="true" />
                                    <div className="cpp-card__body">
                                        <div className="cpp-url">
                                            <span className="cpp-url__label">Your link</span>
                                            <code className="cpp-url__val">{publicUrl}</code>
                                        </div>
                                        <button
                                            type="button"
                                            className={`cpp-btn w-100 ${passportLinkCopied ? "cpp-btn--primary" : "cpp-btn--secondary"}`}
                                            onClick={handleCopyProfileLink}
                                        >
                                            <i className={`fa-solid ${passportLinkCopied ? "fa-check" : "fa-copy"}`} aria-hidden="true" />
                                            <span aria-live="polite">{passportLinkCopied ? "Link copied" : "Copy profile link"}</span>
                                        </button>
                                    </div>
                                </section>

                                <section className="cpp-card" aria-labelledby="cpp-standing-title">
                                    <header className="cpp-card__cover">
                                        <div className="cpp-card__cover-left">
                                            <div className="cpp-card__crest" aria-hidden="true">
                                                <i className="fa-solid fa-user-shield" />
                                            </div>
                                            <div>
                                                <h3 id="cpp-standing-title" className="ac-font cpp-card__title">Account standing</h3>
                                                <p className="cpp-card__subtitle">Your ID and access</p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => goTab("account")}
                                            className="cpp-btn cpp-btn--sm cpp-btn--oncover"
                                        >
                                            Manage
                                        </button>
                                    </header>
                                    <div className="cpp-card__seam" aria-hidden="true" />
                                    <div className="cpp-card__body">
                                        <div className="cpp-kv">
                                            <span>Primary citizen</span>
                                            <span className="cpp-kv__val">
                                                {authUser?.username || profile?.user?.discord_name || "Resident"}
                                            </span>
                                        </div>
                                        <div className="cpp-kv">
                                            <span>Pass status</span>
                                            <span className={`cpp-badge ${hasActiveSubscription ? "cpp-badge--gold" : "cpp-badge--muted"}`}>
                                                {primarySubscriptionTier || (hasActiveSubscription ? "Active subscriber" : "Standard resident pass")}
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => goTab("account")}
                                            className="cpp-btn cpp-btn--secondary w-100 mt-3"
                                        >
                                            <i className="fa-solid fa-link" aria-hidden="true" />
                                            <span>Open account information</span>
                                        </button>
                                    </div>
                                </section>
                            </div>
                        </div>
                    )}

                    {/* ── ACCOUNT INFORMATION ── */}
                    {activeTab === "account" && (
                        <AccountInformationTab profileUser={profile?.user} passportData={passportData} />
                    )}

                    {/* ── YOUR ACCESS & ISLANDS ── */}
                    {activeTab === "access" && (
                        <section className="cpp-card" aria-labelledby="cpp-access-title">
                            <header className="cpp-card__cover">
                                <div className="cpp-card__cover-left">
                                    <div className="cpp-card__crest" aria-hidden="true">
                                        <i className="fa-solid fa-key" />
                                    </div>
                                    <div>
                                        <h2 id="cpp-access-title" className="ac-font cpp-card__title">Your subscription &amp; island access</h2>
                                        <p className="cpp-card__subtitle">The treasure islands you can fly to right now</p>
                                    </div>
                                </div>
                                <div className="d-flex align-items-center gap-2 flex-wrap">
                                    <Link to="/islands" className="cpp-btn cpp-btn--sm cpp-btn--oncover">
                                        <i className="fa-solid fa-plane-departure" aria-hidden="true" />
                                        <span>Flight board</span>
                                    </Link>
                                    <Link to="/membership" className="cpp-btn cpp-btn--sm cpp-btn--oncover">
                                        <i className="fa-solid fa-crown" aria-hidden="true" />
                                        <span>Perks &amp; tiers</span>
                                    </Link>
                                </div>
                            </header>
                            <div className="cpp-card__seam" aria-hidden="true" />

                            <div className="cpp-card__body">
                                <div className="cpp-banner" data-sub={hasActiveSubscription}>
                                    <div className="cpp-banner__main">
                                        <div className="cpp-banner__icon" aria-hidden="true">
                                            <i className={`fa-solid ${hasActiveSubscription ? "fa-crown" : "fa-leaf"}`} />
                                        </div>
                                        <div>
                                            <div className="d-flex align-items-center gap-2 flex-wrap">
                                                <h3 className="cpp-banner__title">
                                                    {hasActiveSubscription ? "Active subscription tier" : "Standard resident pass"}
                                                </h3>
                                                <span className={`cpp-badge ${hasActiveSubscription ? "cpp-badge--gold" : "cpp-badge--muted"}`}>
                                                    {hasActiveSubscription ? "Subscriber access" : "Free access"}
                                                </span>
                                            </div>
                                            <p className="cpp-banner__sub">
                                                {primarySubscriptionTier ? (
                                                    <span className="cpp-badge cpp-badge--gold-outline">
                                                        <i className="fa-solid fa-check text-success" aria-hidden="true" />
                                                        <span>{primarySubscriptionTier}</span>
                                                    </span>
                                                ) : hasActiveSubscription ? (
                                                    "Connected subscriber account (all eligible sub islands unlocked)"
                                                ) : (
                                                    `Access to all public islands (${allIslands.filter((i) => i.cat === "public").length} free islands)`
                                                )}
                                            </p>
                                        </div>
                                    </div>

                                    <dl className="cpp-stats">
                                        <div className="cpp-stat">
                                            <dt>Unlocked</dt>
                                            <dd style={{ color: "var(--leaf-dark)" }}>{userUnlockedIslands.length}</dd>
                                        </div>
                                        <div className="cpp-stat">
                                            <dt>Free public</dt>
                                            <dd>{unlockedPublic}</dd>
                                        </div>
                                        <div className="cpp-stat">
                                            <dt>Subscriber</dt>
                                            <dd style={{ color: "#8a6508" }}>{unlockedMember}</dd>
                                        </div>
                                    </dl>
                                </div>

                                <div className="cpp-toolbar">
                                    <div className="cpp-filters" role="group" aria-label="Filter unlocked islands">
                                        {(
                                            [
                                                { key: "all", label: `All unlocked (${userUnlockedIslands.length})`, icon: null },
                                                { key: "public", label: `Free public (${unlockedPublic})`, icon: "fa-lock-open" },
                                                { key: "member", label: `Subscriber only (${unlockedMember})`, icon: "fa-crown" },
                                                { key: "order", label: `Order bot (${unlockedOrder})`, icon: "fa-box-open" },
                                            ] as { key: AccessFilter; label: string; icon: string | null }[]
                                        ).map((f) => (
                                            <button
                                                key={f.key}
                                                type="button"
                                                className="cpp-filter"
                                                aria-pressed={accessFilter === f.key}
                                                onClick={() => setAccessFilter(f.key)}
                                            >
                                                {f.icon && <i className={`fa-solid ${f.icon}`} aria-hidden="true" />}
                                                <span>{f.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                    <span className="cpp-note" role="status" aria-live="polite">
                                        Showing {filteredAccessIslands.length} accessible {filteredAccessIslands.length === 1 ? "destination" : "destinations"}
                                    </span>
                                </div>

                                {filteredAccessIslands.length > 0 ? (
                                    <div className="row g-3">
                                        {filteredAccessIslands.map((island) => {
                                            const isOnline = island.discordBotOnline === true;
                                            const isFav = isFavoriteIsland(island.id);

                                            return (
                                                <div key={island.id} className="col-12 col-md-6 col-lg-4">
                                                    <article className="cpp-island">
                                                        <div className="cpp-island__top">
                                                            <div className="cpp-island__top-left">
                                                                <span className={`cpp-badge ${island.cat === "member" ? "cpp-badge--gold" : island.cat === "order" ? "cpp-badge--muted" : "cpp-badge--leaf"}`}>
                                                                    {island.cat === "member" ? (
                                                                        <><i className="fa-solid fa-crown" aria-hidden="true" />VIP unlocked</>
                                                                    ) : island.cat === "order" ? (
                                                                        <><i className="fa-solid fa-box" aria-hidden="true" />Order bot</>
                                                                    ) : (
                                                                        <><i className="fa-solid fa-lock-open" aria-hidden="true" />Free public</>
                                                                    )}
                                                                </span>
                                                                <span className={`cpp-status ${isOnline ? "cpp-status--on" : ""}`}>
                                                                    <span className="cpp-dot" aria-hidden="true" />
                                                                    {isOnline ? "Online" : "Offline"}
                                                                </span>
                                                            </div>

                                                            <button
                                                                type="button"
                                                                onClick={(e) => toggleFavoriteIsland(island.id, e)}
                                                                className="cpp-iconbtn"
                                                                aria-pressed={isFav}
                                                                aria-label={isFav ? `Remove ${island.name} from favorites` : `Add ${island.name} to favorites`}
                                                                title={isFav ? "Remove from favorites" : "Add to favorites"}
                                                            >
                                                                <i className={`${isFav ? "fa-solid" : "fa-regular"} fa-star`} aria-hidden="true" />
                                                            </button>
                                                        </div>

                                                        <h4 className="ac-font cpp-island__name">{island.name}</h4>
                                                        <span className="cpp-island__type">
                                                            {island.type}
                                                            {island.seasonal ? ` · ${island.seasonal} season` : ""}
                                                        </span>

                                                        {island.items && island.items.length > 0 ? (
                                                            <div className="cpp-chips">
                                                                {island.items.slice(0, 3).map((item, i) => (
                                                                    <span key={i} className="cpp-chip">{item}</span>
                                                                ))}
                                                                {island.items.length > 3 && (
                                                                    <span className="cpp-chip">+{island.items.length - 3}</span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div style={{ flex: 1 }} />
                                                        )}

                                                        <div className="cpp-island__foot">
                                                            <span className="cpp-island__visitors">
                                                                <i className="fa-solid fa-users me-1" aria-hidden="true" />
                                                                {island.visitors ?? 0}/7 visitors
                                                            </span>
                                                            <Link
                                                                to={`/island/${encodeURIComponent(island.id)}`}
                                                                className="cpp-btn cpp-btn--sm cpp-btn--primary"
                                                            >
                                                                <span>Fly to island</span>
                                                                <i className="fa-solid fa-plane-departure" aria-hidden="true" />
                                                                <span className="cpp-sr">{island.name}</span>
                                                            </Link>
                                                        </div>
                                                    </article>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="cpp-info">
                                        No islands match this filter. Choose "All unlocked" to see every destination you can visit.
                                    </div>
                                )}

                                {lockedIslands.length > 0 && (
                                    <div className="cpp-locked">
                                        <div className="cpp-locked__head">
                                            <div>
                                                <h3>
                                                    <i className="fa-solid fa-lock me-2" aria-hidden="true" />
                                                    Locked treasure islands ({lockedIslands.length})
                                                </h3>
                                                <p>
                                                    Upgrade your membership on Twitch, Patreon, YouTube, or Discord to unlock priority 24/7 Dodo codes, 2.0 DIYs, and custom order bots.
                                                </p>
                                            </div>
                                            <Link to="/membership" className="cpp-btn cpp-btn--primary text-nowrap">
                                                <i className="fa-solid fa-crown" aria-hidden="true" />
                                                <span>Unlock all islands</span>
                                            </Link>
                                        </div>
                                        <ul className="cpp-chips list-unstyled mb-0 mt-0">
                                            {lockedIslands.map((locked) => (
                                                <li key={locked.id} className="cpp-lockchip">
                                                    <i className="fa-solid fa-lock" aria-hidden="true" />
                                                    <span>{locked.name}</span>
                                                    <small>({locked.type})</small>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </section>
                    )}

                    {/* ── FAVORITE ISLANDS ── */}
                    {activeTab === "favorites" && (
                        <section className="cpp-card" aria-labelledby="cpp-fav-title">
                            <header className="cpp-card__cover">
                                <div className="cpp-card__cover-left">
                                    <div className="cpp-card__crest" aria-hidden="true">
                                        <i className="fa-solid fa-star" />
                                    </div>
                                    <div>
                                        <h2 id="cpp-fav-title" className="ac-font cpp-card__title">Favorite treasure islands</h2>
                                        <p className="cpp-card__subtitle">Starred islands for quick access and live Dodo status</p>
                                    </div>
                                </div>
                                <Link to="/islands" className="cpp-btn cpp-btn--sm cpp-btn--oncover">
                                    <i className="fa-solid fa-plus" aria-hidden="true" />
                                    <span>Find more islands</span>
                                </Link>
                            </header>
                            <div className="cpp-card__seam" aria-hidden="true" />

                            <div className="cpp-card__body">
                                {favoritedIslandObjects.length > 0 ? (
                                    <div className="row g-3">
                                        {favoritedIslandObjects.map((island) => {
                                            const isOnline = island.status === "ONLINE";

                                            return (
                                                <div key={island.id} className="col-md-6 col-lg-4">
                                                    <article className="cpp-island">
                                                        <div className="cpp-island__top">
                                                            <span className={`cpp-status ${isOnline ? "cpp-status--on" : ""}`}>
                                                                <span className="cpp-dot" aria-hidden="true" />
                                                                {isOnline ? "Online" : "Offline"}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                className="cpp-iconbtn"
                                                                aria-pressed="true"
                                                                onClick={(e) => toggleFavoriteIsland(island.id, e)}
                                                                title="Remove from favorites"
                                                                aria-label={`Remove ${island.name} from favorites`}
                                                            >
                                                                <i className="fa-solid fa-star" aria-hidden="true" />
                                                            </button>
                                                        </div>

                                                        <h3 className="ac-font cpp-island__name">
                                                            <i className="fa-solid fa-tree me-2" style={{ color: "var(--leaf)" }} aria-hidden="true" />
                                                            {island.name}
                                                        </h3>

                                                        <p className="cpp-island__desc">
                                                            {island.description || "Treasure island with loaded DIYs, materials, and catalog items."}
                                                        </p>

                                                        <div className="cpp-island__foot">
                                                            <span className="cpp-chip">{island.cat || island.type || "Treasure island"}</span>
                                                            <Link
                                                                to={`/island/${encodeURIComponent(island.id)}`}
                                                                className="cpp-btn cpp-btn--sm cpp-btn--primary"
                                                            >
                                                                <span>Fly now</span>
                                                                <span className="cpp-sr">to {island.name}</span>
                                                            </Link>
                                                        </div>
                                                    </article>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="cpp-empty">
                                        <div className="cpp-empty__icon" aria-hidden="true">
                                            <i className="fa-solid fa-star" />
                                        </div>
                                        <h3 className="ac-font">No favorite islands yet</h3>
                                        <p>
                                            Star islands on the flight board to keep an eye on their live Dodo status here.
                                        </p>
                                        <Link to="/islands" className="cpp-btn cpp-btn--primary">
                                            <i className="fa-solid fa-compass" aria-hidden="true" />
                                            <span>Browse treasure islands</span>
                                        </Link>
                                    </div>
                                )}
                            </div>
                        </section>
                    )}

                    {/* ── ORDER HISTORY ── */}
                    {activeTab === "orders" && (
                        <section className="cpp-card" aria-labelledby="cpp-orders-title">
                            <header className="cpp-card__cover">
                                <div className="cpp-card__cover-left">
                                    <div className="cpp-card__crest" aria-hidden="true">
                                        <i className="fa-solid fa-box-open" />
                                    </div>
                                    <div>
                                        <h2 id="cpp-orders-title" className="ac-font cpp-card__title">Your order history</h2>
                                        <p className="cpp-card__subtitle">Past order bot requests you can reorder in one click</p>
                                    </div>
                                </div>
                                <div className="d-flex gap-2 flex-wrap">
                                    <button
                                        type="button"
                                        className="cpp-btn cpp-btn--sm cpp-btn--oncover"
                                        onClick={loadOrders}
                                        disabled={ordersLoading}
                                    >
                                        <i className={`fa-solid fa-arrows-rotate ${ordersLoading ? "fa-spin" : ""}`} aria-hidden="true" />
                                        <span>{ordersLoading ? "Refreshing…" : "Refresh"}</span>
                                    </button>
                                    <Link to="/order" className="cpp-btn cpp-btn--sm cpp-btn--oncover">
                                        <i className="fa-solid fa-paper-plane" aria-hidden="true" />
                                        <span>Order bot</span>
                                    </Link>
                                </div>
                            </header>
                            <div className="cpp-card__seam" aria-hidden="true" />

                            <div className="cpp-card__body">
                                {ordersLoading && orders.length === 0 ? (
                                    <div className="cpp-empty" role="status">
                                        <span className="spinner-border spinner-border-sm text-success me-2" aria-hidden="true" />
                                        <span className="small fw-bold">Loading order history…</span>
                                    </div>
                                ) : orders.length > 0 ? (
                                    <div className="row g-3">
                                        {orders.map((order) => {
                                            const parsed = parsedOrdersMap.get(order.id) || { items: [], totalSlots: 0, unrecognizedCodes: [] };
                                            const isCopied = copiedOrderId === order.id;
                                            const statusClass =
                                                order.status === "ready" || order.status === "completed"
                                                    ? "cpp-badge--leaf"
                                                    : order.status === "preparing"
                                                        ? "cpp-badge--gold"
                                                        : order.status === "cancelled" || order.status === "error"
                                                            ? "cpp-badge--danger"
                                                            : "cpp-badge--muted";

                                            return (
                                                <div key={order.id} className="col-12 col-xl-6">
                                                    <article className="cpp-order-card">
                                                        <div className="cpp-order__head">
                                                            <div className="d-flex align-items-center gap-2 flex-wrap">
                                                                <span className="cpp-order__id">#{order.id.slice(0, 16)}</span>
                                                                <span className={`cpp-badge ${statusClass}`}>{order.status}</span>
                                                            </div>
                                                            <span className="cpp-order__time">
                                                                <i className="fa-regular fa-clock me-1" aria-hidden="true" />
                                                                {formatDateTime(order.created_at)}
                                                            </span>
                                                        </div>

                                                        {order.island_name && (
                                                            <div className="cpp-order__island">
                                                                <span>
                                                                    <i className="fa-solid fa-tree me-1" aria-hidden="true" />
                                                                    Island: <strong>{order.island_name}</strong>
                                                                </span>
                                                                {order.dodo_code && (
                                                                    <span className="cpp-badge cpp-badge--leaf cpp-badge--mono">
                                                                        Dodo: {order.dodo_code}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}

                                                        <div className="cpp-order__box">
                                                            <span className="cpp-order__box-title">
                                                                {parsed.items.length > 0
                                                                    ? `${parsed.items.length} item types (${parsed.totalSlots} slots)`
                                                                    : "Order command"}
                                                            </span>

                                                            {parsed.items.length > 0 ? (
                                                                <div className="cpp-order__items">
                                                                    {parsed.items.map((item, idx) => (
                                                                        <span key={`${item.itemId}-${idx}`} className="cpp-item">
                                                                            {item.image && <img src={item.image} alt="" />}
                                                                            <span>{item.name}</span>
                                                                            <b>×{item.quantity}</b>
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <div className="cpp-order__cmd">{order.command}</div>
                                                            )}
                                                        </div>

                                                        <div className="cpp-order__actions">
                                                            <button
                                                                type="button"
                                                                className="cpp-btn cpp-btn--sm cpp-btn--primary"
                                                                onClick={() => handleReorder(order, "/order")}
                                                            >
                                                                <i className="fa-solid fa-rotate-left" aria-hidden="true" />
                                                                <span>Reorder pocket</span>
                                                                <span className="cpp-sr">for order {order.id.slice(0, 16)}</span>
                                                            </button>

                                                            <div className="cpp-order__actions-right">
                                                                <button
                                                                    type="button"
                                                                    className="cpp-btn cpp-btn--sm cpp-btn--secondary"
                                                                    onClick={() => handleReorder(order, "/command-builder")}
                                                                >
                                                                    <i className="fa-solid fa-pencil" aria-hidden="true" />
                                                                    <span>Edit in builder</span>
                                                                    <span className="cpp-sr">for order {order.id.slice(0, 16)}</span>
                                                                </button>

                                                                <button
                                                                    type="button"
                                                                    className={`cpp-btn cpp-btn--sm ${isCopied ? "cpp-btn--primary" : "cpp-btn--secondary"}`}
                                                                    onClick={() => handleCopyOrderCommand(order)}
                                                                >
                                                                    <i className={`fa-solid ${isCopied ? "fa-check" : "fa-copy"}`} aria-hidden="true" />
                                                                    <span aria-live="polite">{isCopied ? "Copied" : "Copy command"}</span>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </article>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="cpp-empty">
                                        <div className="cpp-empty__icon" aria-hidden="true">
                                            <i className="fa-solid fa-box-open" />
                                        </div>
                                        <h3 className="ac-font">No orders yet</h3>
                                        <p>
                                            Build your 40-slot pocket in the command builder, then send it to the order bot to have it delivered to your island.
                                        </p>
                                        <div className="cpp-empty__actions">
                                            <Link to="/command-builder" className="cpp-btn cpp-btn--primary">
                                                <i className="fa-solid fa-cubes-stacked" aria-hidden="true" />
                                                <span>Build a pocket</span>
                                            </Link>
                                            <Link to="/order" className="cpp-btn cpp-btn--secondary">
                                                <i className="fa-solid fa-box-open" aria-hidden="true" />
                                                <span>Open order bot</span>
                                            </Link>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>
                    )}

                    {/* ── FLIGHT HISTORY & LOGS ── */}
                    {activeTab === "history" && (
                        <div className="cpp-stack">
                            <section className="cpp-card" aria-labelledby="cpp-recent-title">
                                <header className="cpp-card__cover">
                                    <div className="cpp-card__cover-left">
                                        <div className="cpp-card__crest" aria-hidden="true">
                                            <i className="fa-solid fa-plane-departure" />
                                        </div>
                                        <div>
                                            <h2 id="cpp-recent-title" className="ac-font cpp-card__title">Recent flights &amp; visits</h2>
                                            <p className="cpp-card__subtitle">Your latest island travel records</p>
                                        </div>
                                    </div>
                                </header>
                                <div className="cpp-card__seam" aria-hidden="true" />
                                <div className="cpp-card__body">
                                    <IslandVisitTable visits={recentVisits} emptyText="No recent flights recorded." showDate />
                                </div>
                            </section>

                            <section className="cpp-card" aria-labelledby="cpp-top-title">
                                <header className="cpp-card__cover">
                                    <div className="cpp-card__cover-left">
                                        <div className="cpp-card__crest" aria-hidden="true">
                                            <i className="fa-solid fa-map-location-dot" />
                                        </div>
                                        <div>
                                            <h2 id="cpp-top-title" className="ac-font cpp-card__title">Top visited destinations</h2>
                                            <p className="cpp-card__subtitle">The islands you fly to most</p>
                                        </div>
                                    </div>
                                </header>
                                <div className="cpp-card__seam" aria-hidden="true" />
                                <div className="cpp-card__body">
                                    <IslandVisitTable visits={mostVisited} emptyText="No frequently visited islands yet." />
                                </div>
                            </section>

                            {warningSummary && (
                                <section className="cpp-card" aria-labelledby="cpp-standing-log-title">
                                    <header className="cpp-card__cover" style={{ background: "#78350f" }}>
                                        <div className="cpp-card__cover-left">
                                            <div className="cpp-card__crest" aria-hidden="true">
                                                <i className="fa-solid fa-shield-halved" />
                                            </div>
                                            <div>
                                                <h2 id="cpp-standing-log-title" className="ac-font cpp-card__title">Account standing log</h2>
                                                <p className="cpp-card__subtitle">Your official community record</p>
                                            </div>
                                        </div>
                                    </header>
                                    <div className="cpp-card__seam" aria-hidden="true" />
                                    <div className="cpp-card__body">
                                        {Array.isArray(warningSummary) && warningSummary.length > 0 ? (
                                            <PaginatedTable
                                                columns={["Warning note"]}
                                                rows={warningSummary.map((w) => [String(w)])}
                                                searchable={false}
                                            />
                                        ) : !Array.isArray(warningSummary) && Object.keys(warningSummary).length > 0 ? (
                                            <PaginatedTable
                                                columns={["Warning type", "Count"]}
                                                rows={Object.entries(warningSummary).map(([k, v]) => [k.replaceAll("_", " "), formatNumber(Number(v))])}
                                                searchable={false}
                                            />
                                        ) : (
                                            <div className="cpp-info cpp-info--ok">
                                                <i className="fa-solid fa-circle-check" aria-hidden="true" />
                                                <span>Clean record. No active warnings or penalties on this passport.</span>
                                            </div>
                                        )}
                                    </div>
                                </section>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Modals ── */}
            <AddEditCharacterModal
                isOpen={characterModalOpen}
                onClose={handleCloseCharacterModal}
                editingCharId={editingCharId}
                charIgn={charIgn}
                setCharIgn={setCharIgn}
                charIsland={charIsland}
                setCharIsland={setCharIsland}
                charIcon={charIcon}
                setCharIcon={setCharIcon}
                charError={charError}
                isSavingChar={isSavingChar}
                onSave={handleSaveCharacterModal}
                characterIcons={CHARACTER_ICONS}
            />

            <ConfirmDialog
                open={pendingDelete !== null}
                title="Delete this character?"
                message={
                    pendingDelete
                        ? `"${pendingDelete.ign}" will be removed from your saved characters. This can't be undone.`
                        : ""
                }
                confirmLabel="Yes, delete"
                cancelLabel="Keep character"
                onConfirm={confirmDeleteCharacter}
                onCancel={closeDeleteDialog}
            />
        </div>
    );
};

interface PaginatedTableProps {
    columns: string[];
    rows: string[][];
    searchable?: boolean;
    perPage?: number;
}

const PaginatedTable = ({ columns, rows, searchable = true, perPage = 5 }: PaginatedTableProps) => {
    const tableRef = useRef<HTMLTableElement | null>(null);

    const tableKey = useMemo(
        () => `${columns.join("|")}::${rows.length}::${rows.map((row) => row.join(",")).join(";")}`,
        [columns, rows]
    );

    useEffect(() => {
        if (!tableRef.current || rows.length === 0) return;

        let dataTable: import("simple-datatables").DataTable | undefined;

        Promise.all([
            import("simple-datatables"),
            import("simple-datatables/dist/style.css"),
        ]).then(([{ DataTable }]) => {
            if (!tableRef.current) return;
            dataTable = new DataTable(tableRef.current, {
                searchable,
                perPage,
                perPageSelect: [5, 10, 25],
                fixedHeight: false,
                labels: {
                    placeholder: "Search records…",
                    perPage: "rows per page",
                    noRows: "No records found",
                    info: "Showing {start} to {end} of {rows} records",
                },
            });
        });

        return () => dataTable?.destroy();
    }, [tableKey, searchable, perPage, rows.length]);

    return (
        <div className="table-responsive mb-2">
            <table ref={tableRef} className="table table-hover align-middle mb-0 profile-table">
                <thead>
                    <tr>
                        {columns.map((column) => (
                            <th key={column} scope="col">
                                {column}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, rowIndex) => (
                        <tr key={`${row.join("-")}-${rowIndex}`}>
                            {row.map((cell, cellIndex) => (
                                <td key={`${cell}-${cellIndex}`}>{cell || "Not available"}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

interface IslandVisitTableProps {
    visits: VisitIsland[];
    emptyText: string;
    showDate?: boolean;
}

const IslandVisitTable = ({ visits, emptyText, showDate = false }: IslandVisitTableProps) => {
    const columns = useMemo(
        () => (showDate ? ["Island", "Type", "Status", "Visited", "Visits"] : ["Island", "Type", "Status", "Visits"]),
        [showDate]
    );

    const rows = useMemo(
        () =>
            visits.map((visit) => {
                const base = [
                    visit.island_name ?? visit.name ?? visit.island_id ?? "Island",
                    visit.type ?? "Treasure island",
                    visit.authorized === false ? "Denied" : "Authorized",
                ];

                return showDate
                    ? [
                        ...base,
                        formatDate(visit.visited_at ?? visit.last_visit),
                        formatNumber(visit.visits ?? visit.count ?? 1),
                    ]
                    : [...base, formatNumber(visit.visits ?? visit.count ?? 1)];
            }),
        [visits, showDate]
    );

    if (visits.length === 0) {
        return <div className="cpp-info">{emptyText}</div>;
    }

    return <PaginatedTable columns={columns} rows={rows} />;
};

export default Profile;