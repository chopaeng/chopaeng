import { useEffect, useMemo, useRef, useState, useCallback } from "react";
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

const CPP_STYLES = `
/* ── Scoped ChoPaeng Profile styles ── */
.cpp-page {
    --ink: #1d3328;
    --ink-soft: #5b6e63;
    --leaf: #1f8a4c;
    --leaf-dark: #166b3a;
    --line: #cfdcd3;
    --sky: #e3f4f1;
    --error: #b3261e;
    --gold: #f6d56b;
    --gold-dark: #8a6508;
    color: var(--ink);
    background: radial-gradient(ellipse 120% 60% at 50% 0%, #ffffff 0%, var(--sky) 70%);
    min-height: 100vh;
}

/* ── Passport Cards ── */
.cpp-card {
    background: #fff;
    border-radius: 26px;
    border: 1px solid rgba(207, 220, 211, 0.65);
    box-shadow: 0 1px 0 rgba(29, 51, 40, 0.04), 0 14px 30px -18px rgba(29, 51, 40, 0.22);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.cpp-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(29, 51, 40, 0.06), 0 18px 36px -18px rgba(29, 51, 40, 0.28);
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

.cpp-card__cover-left {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    min-width: 0;
}

.cpp-card__crest {
    width: 48px;
    height: 48px;
    flex: none;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: rgba(255, 255, 255, 0.18);
    border: 2px dashed rgba(255, 255, 255, 0.65);
    font-size: 1.25rem;
    color: #fff;
}

.cpp-card__title {
    margin: 0;
    font-size: 1.18rem;
    font-weight: 800;
    line-height: 1.2;
    color: #fff;
}

.cpp-card__subtitle {
    margin: 0.15rem 0 0;
    font-size: 0.82rem;
    opacity: 0.92;
    font-weight: 600;
}

.cpp-card__seam {
    border-top: 3px dashed #fff;
    margin: 0 14px;
    position: relative;
    top: -2px;
    opacity: 0.85;
}

.cpp-card__body {
    padding: 1.35rem 1.5rem;
    flex: 1;
}

/* ── Hero Passport Card ── */
.cpp-hero {
    background: #fff;
    border-radius: 28px;
    border: 1px solid rgba(207, 220, 211, 0.7);
    box-shadow: 0 1px 0 rgba(29, 51, 40, 0.04), 0 16px 36px -18px rgba(29, 51, 40, 0.24);
    overflow: hidden;
}

.cpp-hero__cover {
    background: var(--leaf);
    color: #fff;
    padding: 1.25rem 1.6rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
}

.cpp-hero__body {
    padding: 1.5rem 1.65rem;
}

.cpp-avatar {
    width: 82px;
    height: 82px;
    border-radius: 50%;
    border: 3.5px solid #fff;
    box-shadow: 0 6px 16px rgba(29, 51, 40, 0.18);
    object-fit: cover;
    background: #e6f4ec;
}

.cpp-avatar-placeholder {
    width: 82px;
    height: 82px;
    border-radius: 50%;
    border: 3.5px solid #fff;
    box-shadow: 0 6px 16px rgba(29, 51, 40, 0.18);
    background: #e6f4ec;
    color: var(--leaf);
    display: grid;
    place-items: center;
    font-size: 2rem;
}

/* ── Stats Ribbon ── */
.cpp-ribbon {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.5rem;
    background: #f6faf7;
    border: 1.5px solid var(--line);
    border-radius: 16px;
    padding: 0.75rem 0.6rem;
    text-align: center;
}

@media (max-width: 576px) {
    .cpp-ribbon {
        grid-template-columns: repeat(2, 1fr);
        gap: 0.75rem 0.5rem;
    }
}

.cpp-ribbon__item {
    text-decoration: none;
    color: inherit;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 0.25rem;
    border-radius: 10px;
    transition: background 0.15s ease;
}

.cpp-ribbon__item:hover {
    background: #eef5f0;
    color: inherit;
}

.cpp-ribbon__val {
    font-size: 1.35rem;
    font-weight: 800;
    line-height: 1.1;
    color: var(--ink);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.cpp-ribbon__label {
    font-size: 0.76rem;
    color: var(--ink-soft);
    font-weight: 700;
    margin-top: 0.15rem;
}

/* ── Segmented Pill Mode Switch (Tabs) ── */
.cpp-tablist {
    display: flex;
    gap: 0.4rem;
    background: #fff;
    border: 1.5px solid var(--line);
    border-radius: 999px;
    padding: 5px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    box-shadow: 0 4px 14px -6px rgba(29, 51, 40, 0.1);
}

.cpp-tab {
    flex: none;
    border: none;
    background: transparent;
    color: var(--ink-soft);
    border-radius: 999px;
    padding: 0.55rem 1rem;
    font-size: 0.88rem;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
    white-space: nowrap;
}

.cpp-tab:hover:not(.cpp-tab--active) {
    background: #f6faf7;
    color: var(--ink);
}

.cpp-tab--active {
    background: var(--leaf);
    color: #fff;
    font-weight: 800;
    box-shadow: 0 2px 6px rgba(31, 138, 76, 0.35);
}

.cpp-tab__count {
    padding: 0.1rem 0.45rem;
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 800;
    background: rgba(0, 0, 0, 0.08);
}

.cpp-tab--active .cpp-tab__count {
    background: rgba(255, 255, 255, 0.25);
    color: #fff;
}

/* ── Primary & Secondary Buttons ── */
.cpp-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    border-radius: 14px;
    padding: 0.6rem 1.15rem;
    font-size: 0.88rem;
    font-weight: 700;
    text-decoration: none;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease, transform 0.08s ease, box-shadow 0.08s ease;
}

.cpp-btn--primary {
    background: var(--leaf);
    border: 1.5px solid var(--leaf);
    color: #fff;
    box-shadow: 0 4px 0 var(--leaf-dark);
}

.cpp-btn--primary:hover:not(:disabled) {
    background: #22984f;
    border-color: #22984f;
    color: #fff;
}

.cpp-btn--primary:active:not(:disabled) {
    transform: translateY(3px);
    box-shadow: 0 1px 0 var(--leaf-dark);
}

.cpp-btn--secondary {
    background: #fff;
    border: 1.5px solid var(--line);
    color: var(--ink);
}

.cpp-btn--secondary:hover:not(:disabled) {
    border-color: var(--leaf);
    background: #f6faf7;
    color: var(--ink);
}

.cpp-btn--sm {
    padding: 0.4rem 0.8rem;
    font-size: 0.82rem;
    border-radius: 12px;
}

.cpp-btn--oncover {
    background: rgba(255, 255, 255, 0.18);
    border: 1.5px solid rgba(255, 255, 255, 0.45);
    color: #fff;
}

.cpp-btn--oncover:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.3);
    border-color: #fff;
    color: #fff;
}

/* ── Badges & Chips ── */
.cpp-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.25rem 0.7rem;
    border-radius: 999px;
    font-size: 0.78rem;
    font-weight: 700;
}

.cpp-badge--gold {
    background: #fef3c7;
    color: #78350f;
    border: 1px solid #fde68a;
}

.cpp-badge--gold-outline {
    background: #fff;
    color: #78350f;
    border: 1.5px solid #fde68a;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.cpp-badge--leaf {
    background: #e6f4ec;
    color: var(--leaf-dark);
    border: 1px solid #b7dfc8;
}

.cpp-badge--muted {
    background: #f1f5f3;
    color: var(--ink-soft);
    border: 1px solid var(--line);
}

.cpp-badge--danger {
    background: #fee2e2;
    color: #991b1b;
    border: 1px solid #fecaca;
}

/* ── Stitched Seams & Dividers ── */
.cpp-stitch {
    border-top: 1.5px dashed var(--line);
    margin: 1.25rem 0;
}

/* ── Island Cards ── */
.cpp-island {
    background: #fff;
    border: 1.5px solid var(--line);
    border-radius: 18px;
    padding: 1.15rem;
    display: flex;
    flex-direction: column;
    height: 100%;
    transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}

.cpp-island:hover {
    transform: translateY(-2px);
    border-color: var(--leaf);
    box-shadow: 0 8px 22px -6px rgba(29, 51, 40, 0.18);
}

/* ── Order Cards ── */
.cpp-order-card {
    background: #fff;
    border: 1.5px solid var(--line);
    border-radius: 18px;
    padding: 1.2rem;
    display: flex;
    flex-direction: column;
    height: 100%;
}

/* ── Accessibility Focus ── */
.cpp-page :is(button, a, input, select):focus-visible {
    outline: 3px solid #0f5132;
    outline-offset: 2px;
}

.cpp-card__cover :is(button, a):focus-visible {
    outline-color: #fff;
}

@media (prefers-reduced-motion: reduce) {
    .cpp-page * {
        transition: none !important;
        animation: none !important;
        transform: none !important;
    }
}
`;

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
    const [activeTab, setActiveTab] = useState<"profile" | "account" | "access" | "favorites" | "orders" | "history">("profile");
    const [accessFilter, setAccessFilter] = useState<"all" | "public" | "member" | "order">("all");

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
            setPrefNotice(`Loaded ${bundle.items.length} item types (${bundle.totalSlots} slots) from order #${order.id}. Opening ${targetRoute === "/order" ? "order bot" : "command builder"}...`);
            setTimeout(() => setPrefNotice(null), 4000);
            navigate(targetRoute);
        } else {
            playChimeClick();
            navigate(targetRoute);
        }
    };

    const handleCopyOrderCommand = (order: OrderHistoryItem) => {
        const cmd = order.command.startsWith("!") ? order.command : `!order ${order.command}`;
        navigator.clipboard.writeText(cmd).catch(() => {});
        setCopiedOrderId(order.id);
        playChimeClick();
        setTimeout(() => setCopiedOrderId(null), 2500);
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
            setCharError("In-Game Name (IGN) is required.");
            return;
        }
        if (!cleanIsland) {
            setCharError("Island Name is required.");
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
                    setCharError(`Maximum ${maxSlots} character slots reached.`);
                    setIsSavingChar(false);
                    return;
                }
                playChimeClick();
            }

            setPrefNotice(
                editingCharId
                    ? `Character "${cleanIgn}" updated.`
                    : `New character "${cleanIgn}" created.`
            );

            setTimeout(() => setPrefNotice(null), 4000);
            setCharacterModalOpen(false);
        } finally {
            setIsSavingChar(false);
        }
    };

    const handleSetActiveCharacter = (char: SavedCharacter) => {
        setDefaultCharacter(char.id);
        playChimeClick();
        setPrefNotice(`Active character set to "${char.ign}".`);
        setTimeout(() => setPrefNotice(null), 3500);
    };

    const handleDeleteCharacter = (char: SavedCharacter) => {
        if (window.confirm(`Are you sure you want to delete character "${char.ign}"?`)) {
            deleteCharacter(char.id);
            playChimeClick();
            setPrefNotice(`Character "${char.ign}" deleted.`);
            setTimeout(() => setPrefNotice(null), 3500);
        }
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

    if (authLoading || loading) {
        return (
            <div className="cpp-page d-flex align-items-center justify-content-center p-4">
                <style>{CPP_STYLES}</style>
                <div className="cpp-card p-4 p-md-5 text-center" style={{ maxWidth: 420 }}>
                    <div className="spinner-border text-success mb-3 mx-auto" role="status" aria-hidden="true" />
                    <h2 className="ac-font h5 text-dark mb-1">Loading resident passport</h2>
                    <p className="small text-muted mb-0">Connecting to ChoPaeng resident records…</p>
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
                        <div className="cpp-card__body text-center py-4 px-3 px-sm-4">
                            <p className="text-muted mb-4" style={{ lineHeight: 1.6 }}>
                                Sign in with your Twitch, Patreon, YouTube, or Discord account to view your verified island passport, track your order bot requests, manage in-game characters, and check unlocked treasure islands.
                            </p>
                            <button
                                type="button"
                                onClick={() => login()}
                                className="cpp-btn cpp-btn--primary px-4 py-2.5 mx-auto"
                            >
                                <i className="fa-solid fa-right-to-bracket" aria-hidden="true" />
                                <span>Sign in to passport</span>
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
                <div className="cpp-card p-4 text-center" style={{ maxWidth: 480 }}>
                    <header className="cpp-card__cover" style={{ background: "#991b1b" }}>
                        <div className="cpp-card__cover-left">
                            <div className="cpp-card__crest" aria-hidden="true" style={{ borderColor: "#fecaca" }}>
                                <i className="fa-solid fa-triangle-exclamation" />
                            </div>
                            <div>
                                <h1 className="ac-font cpp-card__title">Profile unavailable</h1>
                                <p className="cpp-card__subtitle">Please check your connection</p>
                            </div>
                        </div>
                    </header>
                    <div className="cpp-card__seam" aria-hidden="true" />
                    <div className="cpp-card__body">
                        <p className="text-muted mb-4">{error}</p>
                        <button
                            type="button"
                            onClick={() => login()}
                            className="cpp-btn cpp-btn--primary w-100"
                        >
                            <i className="fa-solid fa-rotate" aria-hidden="true" />
                            <span>Refresh login session</span>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="cpp-page font-nunito pb-5">
            <style>{CPP_STYLES}</style>

            {/* ── 1. PASSPORT HERO HEADER ── */}
            <div className="border-bottom pb-4 pt-3 pt-md-4">
                <div className="container" style={{ maxWidth: 1140 }}>
                    {/* Animal Crossing Resident Passport Card */}
                    <div className="cpp-hero mb-4">
                        <header className="cpp-hero__cover">
                            <div className="d-flex align-items-center gap-2.5 flex-wrap">
                                <div className="cpp-card__crest" aria-hidden="true">
                                    <i className="fa-solid fa-passport" />
                                </div>
                                <div>
                                    <h1 className="ac-font cpp-card__title">Resident passport</h1>
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
                                {/* Identity details */}
                                <div className="col-lg-7 d-flex flex-column flex-sm-row align-items-center align-items-sm-start gap-3.5 text-center text-sm-start">
                                    <div className="position-relative flex-shrink-0">
                                        {profileUser?.avatar ? (
                                            <img
                                                src={profileUser.avatar}
                                                alt={`${displayName}'s avatar`}
                                                className="cpp-avatar"
                                            />
                                        ) : (
                                            <div className="cpp-avatar-placeholder" aria-hidden="true">
                                                <i className="fa-solid fa-user-astronaut" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-grow-1 min-w-0">
                                        <h2 className="ac-font h3 text-dark mb-1">
                                            {activeCharacter.ign || displayName}
                                        </h2>

                                        <p className="text-muted fw-bold small mb-2.5">
                                            <i className="fa-solid fa-tree text-success me-1.5" aria-hidden="true" />
                                            <span>Island: </span>
                                            <strong className="text-dark">{activeCharacter.islandName || "ChoPaeng Island"}</strong>
                                        </p>

                                        {/* Status & Sub Tier Badges */}
                                        <div className="d-flex flex-wrap align-items-center justify-content-center justify-content-sm-start gap-1.5">
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
                                                <span className="cpp-badge cpp-badge--muted">
                                                    <span>Standard resident pass</span>
                                                </span>
                                            )}

                                            <span className="cpp-badge cpp-badge--muted font-monospace">
                                                <i className="fa-regular fa-calendar-check text-muted" aria-hidden="true" />
                                                <span>Joined {formatDate(profileUser?.joined_at ?? profileUser?.joined_timestamp)}</span>
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Key stats ribbon */}
                                <div className="col-lg-5">
                                    <div className="cpp-ribbon">
                                        <div className="cpp-ribbon__item">
                                            <span className="cpp-ribbon__val">{formatNumber(orders.length)}</span>
                                            <span className="cpp-ribbon__label">Orders</span>
                                        </div>
                                        <Link
                                            to="/my-collection"
                                            className="cpp-ribbon__item"
                                            title="View caught critters in my collection"
                                        >
                                            <span className="cpp-ribbon__val text-success">{formatNumber(caughtCritters.caughtCount)}</span>
                                            <span className="cpp-ribbon__label">Critters</span>
                                        </Link>
                                        <div className="cpp-ribbon__item">
                                            <span className="cpp-ribbon__val">{formatNumber(profile?.visits.total)}</span>
                                            <span className="cpp-ribbon__label">Visits</span>
                                        </div>
                                        <div className="cpp-ribbon__item">
                                            <span className="cpp-ribbon__val text-success">{formatNumber(userUnlockedIslands.length)}</span>
                                            <span className="cpp-ribbon__label">Unlocked</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Mode switch navigation (Segmented pill tablist) */}
                    <div className="cpp-tablist" role="tablist" aria-label="Passport dashboard sections">
                        <button
                            type="button"
                            role="tab"
                            id="tab-btn-profile"
                            aria-controls="tab-panel-profile"
                            aria-selected={activeTab === "profile"}
                            className={`cpp-tab ${activeTab === "profile" ? "cpp-tab--active" : ""}`}
                            onClick={() => {
                                playChimeClick();
                                setActiveTab("profile");
                            }}
                        >
                            <i className="fa-solid fa-user" aria-hidden="true" />
                            <span>Profile hub</span>
                            <span className="cpp-tab__count">{characters.length}/3</span>
                        </button>

                        <button
                            type="button"
                            role="tab"
                            id="tab-btn-account"
                            aria-controls="tab-panel-account"
                            aria-selected={activeTab === "account"}
                            className={`cpp-tab ${activeTab === "account" ? "cpp-tab--active" : ""}`}
                            onClick={() => {
                                playChimeClick();
                                setActiveTab("account");
                            }}
                        >
                            <i className="fa-solid fa-user-shield" aria-hidden="true" />
                            <span>Account information</span>
                            <span className="cpp-tab__count">
                                {authUser?.connected_providers?.length || (authUser?.email ? 1 : 0)}
                            </span>
                        </button>

                        <button
                            type="button"
                            role="tab"
                            id="tab-btn-access"
                            aria-controls="tab-panel-access"
                            aria-selected={activeTab === "access"}
                            className={`cpp-tab ${activeTab === "access" ? "cpp-tab--active" : ""}`}
                            onClick={() => {
                                playChimeClick();
                                setActiveTab("access");
                            }}
                        >
                            <i className="fa-solid fa-key" aria-hidden="true" />
                            <span>Your access &amp; islands</span>
                            <span className="cpp-tab__count">{userUnlockedIslands.length}</span>
                        </button>

                        <button
                            type="button"
                            role="tab"
                            id="tab-btn-favorites"
                            aria-controls="tab-panel-favorites"
                            aria-selected={activeTab === "favorites"}
                            className={`cpp-tab ${activeTab === "favorites" ? "cpp-tab--active" : ""}`}
                            onClick={() => {
                                playChimeClick();
                                setActiveTab("favorites");
                            }}
                        >
                            <i className="fa-solid fa-star" aria-hidden="true" />
                            <span>Favorite islands</span>
                            <span className="cpp-tab__count">{favoriteIslands.length}</span>
                        </button>

                        <button
                            type="button"
                            role="tab"
                            id="tab-btn-orders"
                            aria-controls="tab-panel-orders"
                            aria-selected={activeTab === "orders"}
                            className={`cpp-tab ${activeTab === "orders" ? "cpp-tab--active" : ""}`}
                            onClick={() => {
                                playChimeClick();
                                setActiveTab("orders");
                            }}
                        >
                            <i className="fa-solid fa-box-open" aria-hidden="true" />
                            <span>Order history</span>
                            {orders.length > 0 && <span className="cpp-tab__count">{orders.length}</span>}
                        </button>

                        <button
                            type="button"
                            role="tab"
                            id="tab-btn-history"
                            aria-controls="tab-panel-history"
                            aria-selected={activeTab === "history"}
                            className={`cpp-tab ${activeTab === "history" ? "cpp-tab--active" : ""}`}
                            onClick={() => {
                                playChimeClick();
                                setActiveTab("history");
                            }}
                        >
                            <i className="fa-solid fa-clock-rotate-left" aria-hidden="true" />
                            <span>Flight history &amp; logs</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* ── 2. TAB CONTENT ── */}
            <div className="container py-4" style={{ maxWidth: 1140 }}>
                {prefNotice && (
                    <div
                        role="alert"
                        aria-live="polite"
                        className="alert alert-success rounded-4 py-2.5 px-3 small fw-bold mb-4 d-flex align-items-center gap-2 border-0 shadow-sm"
                        style={{ background: "#e6f4ec", color: "#166b3a" }}
                    >
                        <i className="fa-solid fa-circle-check fs-6" aria-hidden="true" />
                        <span>{prefNotice}</span>
                    </div>
                )}

                {/* Explainer banner */}
                <HowItWorksExplainer {...PROFILE_EXPLAINER_CONFIG} className="mb-4" defaultExpanded={false} />

                {/* ── TAB 1: PROFILE HUB ── */}
                {activeTab === "profile" && (
                    <div
                        id="tab-panel-profile"
                        role="tabpanel"
                        aria-labelledby="tab-btn-profile"
                        className="row g-4"
                    >
                        <div className="col-lg-7 d-flex flex-column gap-4">
                            <SavedCharactersCard
                                characters={characters}
                                isSyncingDb={isSyncingDb}
                                onOpenAddCharacter={handleOpenAddCharacter}
                                onOpenEditCharacter={handleOpenEditCharacter}
                                onDeleteCharacter={handleDeleteCharacter}
                                onSetActiveCharacter={handleSetActiveCharacter}
                            />

                            {/* Critterpedia summary card */}
                            <CritterpediaSummaryCard caughtCritters={caughtCritters} />
                        </div>

                        {/* Sidebar Column */}
                        <div className="col-lg-5 d-flex flex-column gap-4">
                            {/* Public link card */}
                            <div className="cpp-card">
                                <header className="cpp-card__cover">
                                    <div className="cpp-card__cover-left">
                                        <div className="cpp-card__crest" aria-hidden="true">
                                            <i className="fa-solid fa-globe" />
                                        </div>
                                        <div>
                                            <h3 className="ac-font cpp-card__title">Public profile</h3>
                                            <p className="cpp-card__subtitle">Shareable resident card</p>
                                        </div>
                                    </div>
                                    <Link
                                        to={`/u/${encodeURIComponent(cleanPassportUsername(passportData.username, authUser?.username || "resident"))}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="cpp-btn cpp-btn--sm cpp-btn--oncover"
                                    >
                                        <span>View</span>
                                        <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" />
                                        <span className="visually-hidden"> (opens in a new tab)</span>
                                    </Link>
                                </header>
                                <div className="cpp-card__seam" aria-hidden="true" />
                                <div className="cpp-card__body">
                                    <p className="small text-muted mb-2 font-weight-bold">Your public link:</p>
                                    <div className="p-2.5 rounded-3 bg-light border font-monospace small text-truncate mb-3 text-dark">
                                        {window.location.origin}/u/{cleanPassportUsername(passportData.username, authUser?.username || "resident")}
                                    </div>
                                    <button
                                        type="button"
                                        className={`cpp-btn w-100 ${passportLinkCopied ? "cpp-btn--primary" : "cpp-btn--secondary"}`}
                                        onClick={() => {
                                            const uname = cleanPassportUsername(passportData.username, authUser?.username || "resident");
                                            const url = `${window.location.origin}/u/${encodeURIComponent(uname)}`;
                                            navigator.clipboard.writeText(url).catch(() => {});
                                            setPassportLinkCopied(true);
                                            playChimeClick();
                                            setTimeout(() => setPassportLinkCopied(false), 2500);
                                        }}
                                    >
                                        <i className={`fa-solid ${passportLinkCopied ? "fa-check" : "fa-copy"}`} aria-hidden="true" />
                                        <span>{passportLinkCopied ? "Link copied" : "Copy profile link"}</span>
                                    </button>
                                </div>
                            </div>

                            {/* Account standing quick card */}
                            <div className="cpp-card">
                                <header className="cpp-card__cover">
                                    <div className="cpp-card__cover-left">
                                        <div className="cpp-card__crest" aria-hidden="true">
                                            <i className="fa-solid fa-user-shield" />
                                        </div>
                                        <div>
                                            <h3 className="ac-font cpp-card__title">Account standing</h3>
                                            <p className="cpp-card__subtitle">ID &amp; entitlements</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            playChimeClick();
                                            setActiveTab("account");
                                        }}
                                        className="cpp-btn cpp-btn--sm cpp-btn--oncover"
                                    >
                                        <span>Manage</span>
                                    </button>
                                </header>
                                <div className="cpp-card__seam" aria-hidden="true" />
                                <div className="cpp-card__body">
                                    <div className="p-2.5 rounded-3 bg-light border mb-2 small d-flex align-items-center justify-content-between">
                                        <span className="text-muted fw-bold">Primary citizen:</span>
                                        <span className="fw-bold text-dark font-monospace text-truncate ms-2">
                                            {authUser?.username || profile?.user?.discord_name || "Resident"}
                                        </span>
                                    </div>
                                    <div className="p-2.5 rounded-3 bg-light border mb-3 small d-flex align-items-center justify-content-between">
                                        <span className="text-muted fw-bold">Pass status:</span>
                                        <span className={`cpp-badge ${hasActiveSubscription ? "cpp-badge--gold" : "cpp-badge--muted"}`}>
                                            {primarySubscriptionTier || (hasActiveSubscription ? "Active subscriber" : "Standard resident pass")}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            playChimeClick();
                                            setActiveTab("account");
                                        }}
                                        className="cpp-btn cpp-btn--secondary w-100"
                                    >
                                        <i className="fa-solid fa-link" aria-hidden="true" />
                                        <span>Open account information</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── TAB 2: ACCOUNT INFORMATION ── */}
                {activeTab === "account" && (
                    <div
                        id="tab-panel-account"
                        role="tabpanel"
                        aria-labelledby="tab-btn-account"
                    >
                        <AccountInformationTab
                            profileUser={profile?.user}
                            passportData={passportData}
                        />
                    </div>
                )}

                {/* ── TAB 3: YOUR ACCESS & SUBSCRIPTION ISLANDS ── */}
                {activeTab === "access" && (
                    <div
                        id="tab-panel-access"
                        role="tabpanel"
                        aria-labelledby="tab-btn-access"
                    >
                        <div className="cpp-card mb-4">
                            <header className="cpp-card__cover">
                                <div className="cpp-card__cover-left">
                                    <div className="cpp-card__crest" aria-hidden="true">
                                        <i className="fa-solid fa-key" />
                                    </div>
                                    <div>
                                        <h2 className="ac-font cpp-card__title">Your subscription &amp; island access</h2>
                                        <p className="cpp-card__subtitle">
                                            Real-time overview of unlocked Animal Crossing treasure destinations
                                        </p>
                                    </div>
                                </div>
                                <div className="d-flex align-items-center gap-2">
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
                                {/* Subscription Tier Status Overview Banner */}
                                <div
                                    className="p-3.5 rounded-4 border mb-4 d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3"
                                    style={{ background: hasActiveSubscription ? "#fffbeb" : "#f6faf7", borderColor: hasActiveSubscription ? "#fde68a" : "var(--line)" }}
                                >
                                    <div className="d-flex align-items-center gap-3">
                                        <div
                                            className="rounded-circle d-flex align-items-center justify-content-center shadow-xs flex-shrink-0"
                                            style={{
                                                width: 52,
                                                height: 52,
                                                background: hasActiveSubscription ? "#fef3c7" : "#d8f3dc",
                                                color: hasActiveSubscription ? "#92400e" : "#1b4332",
                                                fontSize: "1.25rem",
                                            }}
                                            aria-hidden="true"
                                        >
                                            <i className={`fa-solid ${hasActiveSubscription ? "fa-crown" : "fa-leaf"}`} />
                                        </div>
                                        <div>
                                            <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                                                <h3 className="h6 fw-black text-dark mb-0">
                                                    {hasActiveSubscription ? "Active subscription tier" : "Standard resident pass"}
                                                </h3>
                                                <span className={`cpp-badge ${hasActiveSubscription ? "cpp-badge--gold" : "cpp-badge--muted"}`}>
                                                    {hasActiveSubscription ? "Subscriber access" : "Free access"}
                                                </span>
                                            </div>
                                            <div className="d-flex flex-wrap gap-1.5 align-items-center">
                                                {primarySubscriptionTier ? (
                                                    <span className="cpp-badge cpp-badge--gold-outline">
                                                        <i className="fa-solid fa-check text-success" aria-hidden="true" />
                                                        <span>{primarySubscriptionTier}</span>
                                                    </span>
                                                ) : hasActiveSubscription ? (
                                                    <span className="small text-muted fw-bold">
                                                        Connected subscriber account (all eligible sub islands unlocked)
                                                    </span>
                                                ) : (
                                                    <span className="small text-muted">
                                                        Access to all public islands ({allIslands.filter(i => i.cat === "public").length} free islands)
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Unlocked stats */}
                                    <div className="d-flex align-items-center gap-2">
                                        <div className="bg-white rounded-3 p-2.5 border text-center" style={{ minWidth: 95 }}>
                                            <span className="tiny-text text-muted d-block fw-bold">Unlocked</span>
                                            <strong className="h5 fw-black text-success mb-0 font-monospace">
                                                {userUnlockedIslands.length}
                                            </strong>
                                        </div>
                                        <div className="bg-white rounded-3 p-2.5 border text-center" style={{ minWidth: 95 }}>
                                            <span className="tiny-text text-muted d-block fw-bold">Free public</span>
                                            <strong className="h5 fw-black text-dark mb-0 font-monospace">
                                                {userUnlockedIslands.filter(i => i.cat === "public").length}
                                            </strong>
                                        </div>
                                        <div className="bg-white rounded-3 p-2.5 border text-center" style={{ minWidth: 95 }}>
                                            <span className="tiny-text text-muted d-block fw-bold">Subscriber</span>
                                            <strong className="h5 fw-black text-warning mb-0 font-monospace">
                                                {userUnlockedIslands.filter(i => i.cat === "member").length}
                                            </strong>
                                        </div>
                                    </div>
                                </div>

                                {/* Filter pills */}
                                <div className="d-flex flex-column flex-sm-row align-items-start align-items-sm-center justify-content-between gap-2 mb-3">
                                    <div className="d-flex flex-wrap gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => setAccessFilter("all")}
                                            className={`cpp-btn cpp-btn--sm ${accessFilter === "all" ? "cpp-btn--primary" : "cpp-btn--secondary"}`}
                                        >
                                            <span>All unlocked ({userUnlockedIslands.length})</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setAccessFilter("public")}
                                            className={`cpp-btn cpp-btn--sm ${accessFilter === "public" ? "cpp-btn--primary" : "cpp-btn--secondary"}`}
                                        >
                                            <i className="fa-solid fa-lock-open" aria-hidden="true" />
                                            <span>Free public ({userUnlockedIslands.filter(i => i.cat === "public").length})</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setAccessFilter("member")}
                                            className={`cpp-btn cpp-btn--sm ${accessFilter === "member" ? "cpp-btn--primary" : "cpp-btn--secondary"}`}
                                        >
                                            <i className="fa-solid fa-crown" aria-hidden="true" />
                                            <span>Subscriber only ({userUnlockedIslands.filter(i => i.cat === "member").length})</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setAccessFilter("order")}
                                            className={`cpp-btn cpp-btn--sm ${accessFilter === "order" ? "cpp-btn--primary" : "cpp-btn--secondary"}`}
                                        >
                                            <i className="fa-solid fa-box-open" aria-hidden="true" />
                                            <span>Order bot ({userUnlockedIslands.filter(i => i.cat === "order").length})</span>
                                        </button>
                                    </div>

                                    <span className="small text-muted font-weight-bold">
                                        Showing {filteredAccessIslands.length} accessible destinations
                                    </span>
                                </div>

                                {/* Unlocked Island Cards */}
                                {filteredAccessIslands.length > 0 ? (
                                    <div className="row g-3 mb-4">
                                        {filteredAccessIslands.map((island) => {
                                            const isOnline = island.discordBotOnline === true;
                                            const isFav = isFavoriteIsland(island.id);

                                            return (
                                                <div key={island.id} className="col-12 col-md-6 col-lg-4">
                                                    <div className="cpp-island">
                                                        <div className="d-flex align-items-center justify-content-between mb-2">
                                                            <div className="d-flex align-items-center gap-2">
                                                                <span className={`cpp-badge ${island.cat === "member" ? "cpp-badge--gold" : island.cat === "order" ? "cpp-badge--muted" : "cpp-badge--leaf"}`}>
                                                                    {island.cat === "member" ? (
                                                                        <><i className="fa-solid fa-crown me-1" aria-hidden="true" />VIP unlocked</>
                                                                    ) : island.cat === "order" ? (
                                                                        <><i className="fa-solid fa-box me-1" aria-hidden="true" />Order bot</>
                                                                    ) : (
                                                                        <><i className="fa-solid fa-lock-open me-1" aria-hidden="true" />Free public</>
                                                                    )}
                                                                </span>

                                                                <span className="small fw-bold d-inline-flex align-items-center gap-1">
                                                                    <span
                                                                        className={`rounded-circle ${isOnline ? "bg-success" : "bg-secondary"}`}
                                                                        style={{ width: 7, height: 7 }}
                                                                        aria-hidden="true"
                                                                    />
                                                                    <span className={isOnline ? "text-success" : "text-muted"}>
                                                                        {isOnline ? "Online" : "Offline"}
                                                                    </span>
                                                                </span>
                                                            </div>

                                                            <button
                                                                type="button"
                                                                onClick={(e) => toggleFavoriteIsland(island.id, e)}
                                                                className={`btn btn-sm border rounded-circle shadow-2xs d-flex align-items-center justify-content-center ${isFav ? "btn-warning text-dark border-warning" : "btn-light text-muted"}`}
                                                                style={{ width: 30, height: 30 }}
                                                                title={isFav ? "Remove from favorites" : "Add to favorites"}
                                                                aria-label={isFav ? `Remove ${island.name} from favorites` : `Add ${island.name} to favorites`}
                                                            >
                                                                <i className={`${isFav ? "fa-solid text-dark" : "fa-regular text-muted"} fa-star x-small`} aria-hidden="true" />
                                                            </button>
                                                        </div>

                                                        <div className="d-flex align-items-center justify-content-between mb-2">
                                                            <div>
                                                                <h4 className="ac-font h5 text-dark mb-0">{island.name}</h4>
                                                                <span className="tiny-text text-muted fw-bold">{island.type}</span>
                                                            </div>
                                                            <div
                                                                className="rounded-circle d-flex align-items-center justify-content-center border"
                                                                style={{ width: 30, height: 30, background: "#f6faf7", color: "var(--leaf)" }}
                                                                title={`${island.seasonal || "Standard"} season`}
                                                                aria-hidden="true"
                                                            >
                                                                <i className="fa-solid fa-leaf text-success" />
                                                            </div>
                                                        </div>

                                                        {island.items && island.items.length > 0 && (
                                                            <div className="d-flex flex-wrap gap-1 mb-3">
                                                                {island.items.slice(0, 3).map((item, i) => (
                                                                    <span key={i} className="badge bg-light text-secondary border rounded-pill x-small fw-bold">
                                                                        {item}
                                                                    </span>
                                                                ))}
                                                                {island.items.length > 3 && (
                                                                    <span className="badge bg-light text-muted border rounded-pill x-small fw-bold">
                                                                        +{island.items.length - 3}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}

                                                        <div className="mt-auto pt-2 border-top d-flex align-items-center justify-content-between">
                                                            <span className="tiny-text text-muted font-monospace fw-bold">
                                                                <i className="fa-solid fa-users me-1" aria-hidden="true" />
                                                                {island.visitors ?? 0}/7 visitors
                                                            </span>
                                                            <Link
                                                                to={`/island/${encodeURIComponent(island.id)}`}
                                                                className="cpp-btn cpp-btn--sm cpp-btn--primary"
                                                            >
                                                                <span>Fly to island</span>
                                                                <i className="fa-solid fa-plane-departure" aria-hidden="true" />
                                                            </Link>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center py-5 text-muted">
                                        <p className="mb-0">No islands matched this filter. Select "All unlocked" to view all available destinations.</p>
                                    </div>
                                )}

                                {/* Locked islands preview */}
                                {lockedIslands.length > 0 && (
                                    <div className="p-3.5 rounded-4 border bg-light">
                                        <div className="d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between gap-3 mb-3">
                                            <div>
                                                <div className="d-flex align-items-center gap-2 mb-1">
                                                    <span className="cpp-badge cpp-badge--muted">
                                                        <i className="fa-solid fa-lock" aria-hidden="true" />
                                                        <span>Subscriber only</span>
                                                    </span>
                                                    <h3 className="h6 fw-black text-dark mb-0">
                                                        Locked treasure islands ({lockedIslands.length})
                                                    </h3>
                                                </div>
                                                <p className="tiny-text text-muted mb-0">
                                                    Upgrade your membership tier on Twitch, Patreon, YouTube, or Discord to unlock priority 24/7 Dodo codes, 2.0 DIYs, and custom order bots.
                                                </p>
                                            </div>

                                            <Link to="/membership" className="cpp-btn cpp-btn--primary text-nowrap">
                                                <i className="fa-solid fa-crown" aria-hidden="true" />
                                                <span>Unlock all islands</span>
                                            </Link>
                                        </div>

                                        <div className="d-flex flex-wrap gap-1.5">
                                            {lockedIslands.map((locked) => (
                                                <span
                                                    key={locked.id}
                                                    className="badge bg-white text-muted border rounded-pill px-3 py-2 fw-bold d-inline-flex align-items-center gap-1.5 shadow-2xs"
                                                    title="Subscribe to unlock this island"
                                                >
                                                    <i className="fa-solid fa-lock text-warning" aria-hidden="true" />
                                                    <span className="text-dark">{locked.name}</span>
                                                    <span className="text-muted">({locked.type})</span>
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── TAB 4: FAVORITE ISLANDS ── */}
                {activeTab === "favorites" && (
                    <div
                        id="tab-panel-favorites"
                        role="tabpanel"
                        aria-labelledby="tab-btn-favorites"
                    >
                        <div className="cpp-card">
                            <header className="cpp-card__cover">
                                <div className="cpp-card__cover-left">
                                    <div className="cpp-card__crest" aria-hidden="true">
                                        <i className="fa-solid fa-star" />
                                    </div>
                                    <div>
                                        <h2 className="ac-font cpp-card__title">Favorite treasure islands</h2>
                                        <p className="cpp-card__subtitle">
                                            Your starred destinations for quick access and live dodo monitoring
                                        </p>
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
                                                    <div className="cpp-island">
                                                        <div className="d-flex align-items-center justify-content-between mb-2">
                                                            <span className="small fw-bold d-inline-flex align-items-center gap-1">
                                                                <span
                                                                    className={`rounded-circle ${isOnline ? "bg-success" : "bg-secondary"}`}
                                                                    style={{ width: 8, height: 8 }}
                                                                    aria-hidden="true"
                                                                />
                                                                <span className={isOnline ? "text-success" : "text-muted"}>
                                                                    {isOnline ? "Online" : "Offline"}
                                                                </span>
                                                            </span>

                                                            <button
                                                                type="button"
                                                                className="btn btn-sm p-1 text-warning border-0"
                                                                onClick={(e) => toggleFavoriteIsland(island.id, e)}
                                                                title="Remove from favorites"
                                                                aria-label={`Remove ${island.name} from favorites`}
                                                            >
                                                                <i className="fa-solid fa-star fs-5" aria-hidden="true" />
                                                            </button>
                                                        </div>

                                                        <div className="fw-black text-dark h5 mb-1 ac-font d-flex align-items-center gap-2">
                                                            <i className="fa-solid fa-tree text-success" aria-hidden="true" />
                                                            <span>{island.name}</span>
                                                        </div>

                                                        <p className="tiny-text text-muted mb-3 flex-grow-1" style={{ lineHeight: 1.5 }}>
                                                            {island.description || "Treasure island with loaded DIYs, materials, and catalog items."}
                                                        </p>

                                                        <div className="d-flex align-items-center justify-content-between pt-2 border-top mt-auto">
                                                            <span className="badge bg-white text-muted border rounded-pill x-small fw-bold">
                                                                {island.cat || island.type || "Treasure island"}
                                                            </span>
                                                            <Link
                                                                to={`/island/${encodeURIComponent(island.id)}`}
                                                                className="cpp-btn cpp-btn--sm cpp-btn--primary"
                                                            >
                                                                <span>Fly now</span>
                                                            </Link>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center py-5 px-3">
                                        <div className="fs-1 text-warning mb-2" aria-hidden="true">⭐</div>
                                        <h3 className="h5 ac-font text-dark mb-1">No favorite islands starred yet</h3>
                                        <p className="small text-muted mb-4" style={{ maxWidth: 440, margin: "0 auto" }}>
                                            Star your favorite free or subscriber treasure islands on the flight board to keep track of their live dodo status here!
                                        </p>
                                        <Link to="/islands" className="cpp-btn cpp-btn--primary">
                                            <i className="fa-solid fa-compass" aria-hidden="true" />
                                            <span>Browse treasure islands</span>
                                        </Link>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── TAB 5: ORDER HISTORY ── */}
                {activeTab === "orders" && (
                    <div
                        id="tab-panel-orders"
                        role="tabpanel"
                        aria-labelledby="tab-btn-orders"
                    >
                        <div className="cpp-card">
                            <header className="cpp-card__cover">
                                <div className="cpp-card__cover-left">
                                    <div className="cpp-card__crest" aria-hidden="true">
                                        <i className="fa-solid fa-box-open" />
                                    </div>
                                    <div>
                                        <h2 className="ac-font cpp-card__title">Your order history</h2>
                                        <p className="cpp-card__subtitle">
                                            Past order bot requests with 1-click reordering and pocket loading
                                        </p>
                                    </div>
                                </div>
                                <div className="d-flex gap-2">
                                    <button
                                        type="button"
                                        className="cpp-btn cpp-btn--sm cpp-btn--oncover"
                                        onClick={loadOrders}
                                        disabled={ordersLoading}
                                        aria-label="Refresh order history"
                                    >
                                        <i className={`fa-solid fa-arrows-rotate ${ordersLoading ? "fa-spin" : ""}`} aria-hidden="true" />
                                        <span>Refresh</span>
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
                                    <div className="text-center py-5 text-muted">
                                        <span className="spinner-border spinner-border-sm text-success me-2" role="status" aria-hidden="true" />
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
                                                    <div className="cpp-order-card">
                                                        <div className="d-flex align-items-center justify-content-between mb-2 flex-wrap gap-2">
                                                            <div className="d-flex align-items-center gap-2">
                                                                <span className="badge bg-dark text-white rounded-pill font-monospace x-small px-2 py-1">
                                                                    #{order.id.slice(0, 16)}
                                                                </span>
                                                                <span className={`cpp-badge ${statusClass}`}>
                                                                    {order.status}
                                                                </span>
                                                            </div>
                                                            <span className="tiny-text text-muted font-monospace">
                                                                <i className="fa-regular fa-clock me-1" aria-hidden="true" />
                                                                {formatDateTime(order.created_at)}
                                                            </span>
                                                        </div>

                                                        {order.island_name && (
                                                            <div className="d-flex align-items-center gap-2 mb-2 tiny-text">
                                                                <span className="fw-bold text-dark d-flex align-items-center gap-1">
                                                                    <i className="fa-solid fa-tree text-success" aria-hidden="true" />
                                                                    <span>Island: <strong>{order.island_name}</strong></span>
                                                                </span>
                                                                {order.dodo_code && (
                                                                    <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill font-monospace">
                                                                        Dodo: {order.dodo_code}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Parsed items preview */}
                                                        <div className="bg-light rounded-3 p-2.5 border mb-3 flex-grow-1">
                                                            <span className="text-muted fw-bold tiny-text d-block mb-1.5">
                                                                {parsed.items.length > 0
                                                                    ? `${parsed.items.length} item types (${parsed.totalSlots} slots)`
                                                                    : "Order command"}
                                                            </span>

                                                            {parsed.items.length > 0 ? (
                                                                <div className="d-flex flex-wrap gap-1" style={{ maxHeight: "100px", overflowY: "auto" }}>
                                                                    {parsed.items.map((item, idx) => (
                                                                        <span
                                                                            key={`${item.itemId}-${idx}`}
                                                                            className="badge bg-white text-dark border rounded-pill px-2 py-1 d-inline-flex align-items-center gap-1 small"
                                                                        >
                                                                            {item.image && (
                                                                                <img
                                                                                    src={item.image}
                                                                                    alt=""
                                                                                    style={{ width: 14, height: 14, objectFit: "contain" }}
                                                                                />
                                                                            )}
                                                                            <span>{item.name}</span>
                                                                            <span className="text-success fw-bold">×{item.quantity}</span>
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <div className="font-monospace text-muted tiny-text text-break" style={{ maxHeight: "60px", overflowY: "auto" }}>
                                                                    {order.command}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Action Buttons */}
                                                        <div className="d-flex align-items-center justify-content-between pt-2 border-top mt-auto gap-2 flex-wrap">
                                                            <button
                                                                type="button"
                                                                className="cpp-btn cpp-btn--sm cpp-btn--primary"
                                                                onClick={() => handleReorder(order, "/order")}
                                                                title="Load this pocket and open order bot"
                                                            >
                                                                <i className="fa-solid fa-rotate-left" aria-hidden="true" />
                                                                <span>Reorder pocket</span>
                                                            </button>

                                                            <div className="d-flex gap-1.5">
                                                                <button
                                                                    type="button"
                                                                    className="cpp-btn cpp-btn--sm cpp-btn--secondary"
                                                                    onClick={() => handleReorder(order, "/command-builder")}
                                                                    title="Load into command builder to edit"
                                                                >
                                                                    <i className="fa-solid fa-pencil" aria-hidden="true" />
                                                                    <span>Builder</span>
                                                                </button>

                                                                <button
                                                                    type="button"
                                                                    className={`cpp-btn cpp-btn--sm ${isCopied ? "cpp-btn--primary" : "cpp-btn--secondary"}`}
                                                                    onClick={() => handleCopyOrderCommand(order)}
                                                                    title="Copy order command to clipboard"
                                                                >
                                                                    <i className={`fa-solid ${isCopied ? "fa-check" : "fa-copy"}`} aria-hidden="true" />
                                                                    <span>{isCopied ? "Copied" : "Copy command"}</span>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center py-5 px-3">
                                        <div className="fs-1 text-muted mb-2" aria-hidden="true">📦</div>
                                        <h3 className="h5 ac-font text-dark mb-1">No orders placed yet</h3>
                                        <p className="small text-muted mb-4" style={{ maxWidth: 460, margin: "0 auto" }}>
                                            Build your 40-slot pocket loadout in the command builder and summon the order bot to receive delivery right to your island!
                                        </p>
                                        <div className="d-flex justify-content-center gap-2 flex-wrap">
                                            <Link to="/command-builder" className="cpp-btn cpp-btn--primary">
                                                <i className="fa-solid fa-cubes-stacked" aria-hidden="true" />
                                                <span>Build pocket</span>
                                            </Link>
                                            <Link to="/order" className="cpp-btn cpp-btn--secondary">
                                                <i className="fa-solid fa-box-open" aria-hidden="true" />
                                                <span>Order bot</span>
                                            </Link>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── TAB 6: FLIGHT HISTORY & LOGS ── */}
                {activeTab === "history" && (
                    <div
                        id="tab-panel-history"
                        role="tabpanel"
                        aria-labelledby="tab-btn-history"
                        className="d-flex flex-column gap-4"
                    >
                        <div className="cpp-card">
                            <header className="cpp-card__cover">
                                <div className="cpp-card__cover-left">
                                    <div className="cpp-card__crest" aria-hidden="true">
                                        <i className="fa-solid fa-plane-departure" />
                                    </div>
                                    <div>
                                        <h2 className="ac-font cpp-card__title">Recent flights &amp; visits</h2>
                                        <p className="cpp-card__subtitle">Your past island travel records</p>
                                    </div>
                                </div>
                            </header>
                            <div className="cpp-card__seam" aria-hidden="true" />
                            <div className="cpp-card__body">
                                <IslandVisitTable visits={recentVisits} emptyText="No recent flights recorded." showDate />
                            </div>
                        </div>

                        <div className="cpp-card">
                            <header className="cpp-card__cover">
                                <div className="cpp-card__cover-left">
                                    <div className="cpp-card__crest" aria-hidden="true">
                                        <i className="fa-solid fa-map-location-dot" />
                                    </div>
                                    <div>
                                        <h2 className="ac-font cpp-card__title">Top visited destinations</h2>
                                        <p className="cpp-card__subtitle">Most frequently visited islands</p>
                                    </div>
                                </div>
                            </header>
                            <div className="cpp-card__seam" aria-hidden="true" />
                            <div className="cpp-card__body">
                                <IslandVisitTable visits={mostVisited} emptyText="No favorite destinations yet." />
                            </div>
                        </div>

                        {/* Warnings Summary if any */}
                        {warningSummary && (
                            <div className="cpp-card">
                                <header className="cpp-card__cover" style={{ background: "#78350f" }}>
                                    <div className="cpp-card__cover-left">
                                        <div className="cpp-card__crest" aria-hidden="true">
                                            <i className="fa-solid fa-shield-halved" />
                                        </div>
                                        <div>
                                            <h2 className="ac-font cpp-card__title">Account standing log</h2>
                                            <p className="cpp-card__subtitle">Official community record</p>
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
                                        <div className="p-3 rounded-3 small fw-bold d-flex align-items-center gap-2" style={{ background: "#e6f4ec", color: "var(--leaf-dark)" }}>
                                            <i className="fa-solid fa-shield-check" aria-hidden="true" />
                                            <span>Clean record. No active warnings or penalties on this passport.</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── Profile Modals ── */}
            <AddEditCharacterModal
                isOpen={characterModalOpen}
                onClose={() => setCharacterModalOpen(false)}
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
                    placeholder: "Search flights...",
                    perPage: "rows per page",
                    noRows: "No flight logs found",
                    info: "Showing {start} to {end} of {rows} logs",
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
        return <div className="p-3 bg-light border rounded-3 text-muted fw-bold small">{emptyText}</div>;
    }

    return <PaginatedTable columns={columns} rows={rows} />;
};

export default Profile;