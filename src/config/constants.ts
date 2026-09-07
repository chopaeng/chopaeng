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
