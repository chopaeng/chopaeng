export const DODO_PLACEHOLDER = {
    GETTING: "GETTIN'",
    FULL: "FULL",
    SUB_ONLY: "SUB ONLY",
} as const;

export const ISLAND_STATUS = {
    OFFLINE: "OFFLINE",
} as const;

export const ISLAND_CATEGORY = {
    MEMBER: "member",
    ORDER: "order",
} as const;

export const PERSONALITY_COLORS: Record<string, { ring: string; bg: string; text: string }> = {
    lazy: { ring: "#E8A33D", bg: "#FBF0DD", text: "#8A5A17" },
    jock: { ring: "#4F8FE8", bg: "#E7F0FD", text: "#1F508C" },
    cranky: { ring: "#8B6F9E", bg: "#F0EAF4", text: "#5B4470" },
    smug: { ring: "#4FAE99", bg: "#E5F5F1", text: "#2C6E5F" },
    normal: { ring: "#7BAE6F", bg: "#EDF5EA", text: "#4A6E40" },
    peppy: { ring: "#F07FA6", bg: "#FDEBF1", text: "#A03D63" },
    snooty: { ring: "#A15FD9", bg: "#F2E9FB", text: "#6B3A94" },
    sisterly: { ring: "#E8574F", bg: "#FBE7E5", text: "#A5342C" },
    "big sister": { ring: "#E8574F", bg: "#FBE7E5", text: "#A5342C" },
};

export const FALLBACK_PALETTE = [
    { ring: "#4F8FE8", bg: "#E7F0FD", text: "#1F508C" },
    { ring: "#4FAE99", bg: "#E5F5F1", text: "#2C6E5F" },
    { ring: "#E8A33D", bg: "#FBF0DD", text: "#8A5A17" },
    { ring: "#A15FD9", bg: "#F2E9FB", text: "#6B3A94" },
    { ring: "#F07FA6", bg: "#FDEBF1", text: "#A03D63" },
    { ring: "#7BAE6F", bg: "#EDF5EA", text: "#4A6E40" },
];

export type DodoUiState =
    | "copied"
    | "free-available"
    | "revealed"
    | "revealing"
    | "revealable"
    | "needs-login"
    | "needs-membership"
    | "gate-closed";

export const DODO_UI_CONFIG: Record<
    DodoUiState,
    {
        icon: string;
        label: string;
        code: (ctx: { freeLiveCode: string | null; revealedCode: string | null }) => string;
    }
> = {
    copied: { icon: "fa-check", label: "Copied!", code: () => "✓ Copied" },
    "free-available": {
        icon: "fa-plane-departure",
        label: "Dodo Code™",
        code: ({ freeLiveCode }) => freeLiveCode ?? "",
    },
    revealed: {
        icon: "fa-plane-departure",
        label: "Dodo Code™",
        code: ({ revealedCode }) => revealedCode ?? "",
    },
    revealing: { icon: "fa-spinner fa-spin", label: "Loading...", code: () => "..." },
    revealable: { icon: "fa-eye", label: "Reveal Code", code: () => "Tap to Reveal" },
    "needs-login": { icon: "fa-lock", label: "Subscribers Only", code: () => "Login with Discord" },
    "needs-membership": { icon: "fa-lock", label: "No Island Access", code: () => "Upgrade to Access" },
    "gate-closed": { icon: "fa-power-off", label: "Gate Closed", code: () => "Offline" },
};

// ============================================================================
// MEMBERSHIP TIER ROLES (PATREON, TWITCH, YOUTUBE)
// ============================================================================

export interface MembershipRoleInfo {
    id: string;
    name: string;
    platform: "patreon" | "twitch" | "youtube";
    badgeText: string;
    brandColor: string;
    icon: string;
    tierLevel: number;
}

export const MEMBERSHIP_ROLES: Record<string, MembershipRoleInfo> = {
    // Patreon Tiers
    CHOSOUP: {
        id: "1031974843656192080",
        name: "ChoSoup",
        platform: "patreon",
        badgeText: "Patreon · ChoSoup",
        brandColor: "#FF424D",
        icon: "fa-brands fa-patreon",
        tierLevel: 3,
    },
    CHOFRIES: {
        id: "1031974954113179729",
        name: "ChoFries",
        platform: "patreon",
        badgeText: "Patreon · ChoFries",
        brandColor: "#FF424D",
        icon: "fa-brands fa-patreon",
        tierLevel: 1,
    },
    CHOCOLATE: {
        id: "1039516557405081601",
        name: "ChoColate",
        platform: "patreon",
        badgeText: "Patreon · ChoColate",
        brandColor: "#FF424D",
        icon: "fa-brands fa-patreon",
        tierLevel: 2,
    },

    // Twitch Tier (All Twitch Subscribers)
    CHOTATO_CLUB: {
        id: "898373041799696454",
        name: "ChoTato Club",
        platform: "twitch",
        badgeText: "Twitch Subscriber",
        brandColor: "#9146FF",
        icon: "fa-brands fa-twitch",
        tierLevel: 1,
    },

    // YouTube Channel Memberships (y Prefix)
    Y_CHOSOUP: {
        id: "1048323845771247681",
        name: "y ChoSoup",
        platform: "youtube",
        badgeText: "YouTube · y ChoSoup",
        brandColor: "#FF0000",
        icon: "fa-brands fa-youtube",
        tierLevel: 3,
    },
    Y_CHOCOLATE: {
        id: "1048323845771247680",
        name: "y ChoColate",
        platform: "youtube",
        badgeText: "YouTube · y ChoColate",
        brandColor: "#FF0000",
        icon: "fa-brands fa-youtube",
        tierLevel: 2,
    },
    Y_CHOTATO: {
        id: "1048323845771247679",
        name: "y ChoTato",
        platform: "youtube",
        badgeText: "YouTube · y ChoTato",
        brandColor: "#FF0000",
        icon: "fa-brands fa-youtube",
        tierLevel: 1,
    },
};

export const TIER_ID_TO_NAME: Record<string, string> = Object.values(MEMBERSHIP_ROLES).reduce(
    (acc, role) => {
        acc[role.id] = role.name;
        return acc;
    },
    {} as Record<string, string>
);

export const TIER_NAME_TO_ID: Record<string, string> = Object.values(MEMBERSHIP_ROLES).reduce(
    (acc, role) => {
        acc[role.name.toLowerCase()] = role.id;
        return acc;
    },
    {} as Record<string, string>
);
