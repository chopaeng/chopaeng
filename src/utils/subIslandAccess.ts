/**
 * Sub Island Tier Access Matrix & Verification for ChoPaeng
 *
 * Tiers:
 * - YouTube: y ChoSoup, y ChoColate, y ChoTato
 * - Twitch: ChoTato Club (Twitch Subscribers & Prime Gaming)
 * - Patreon: ChoSoup, ChoColate, ChoFries
 */

import type { AuthUser } from '../context/authContextShared';
import { TIER_ID_TO_NAME } from '../config/constants';

export const SUB_ISLAND_ACCESS_MATRIX: Record<string, string[]> = {
    "Hiraya": ["ChoSoup", "y ChoSoup", "ChoColate", "ChoFries", "y ChoTato"],
    "Tagumpay": ["ChoSoup", "y ChoSoup", "ChoTato Club", "y ChoColate"],
    "Bahaghari": ["ChoSoup", "y ChoSoup", "ChoTato Club", "ChoColate", "ChoFries", "y ChoTato"],
    "Alapaap": ["ChoSoup", "y ChoSoup", "y ChoColate"],
    "Bituin": ["ChoSoup", "y ChoSoup", "ChoTato Club", "ChoColate", "ChoFries"],
    "Lakan": ["ChoSoup", "y ChoSoup", "ChoTato Club", "y ChoColate"],
    "Galak": ["ChoSoup", "y ChoSoup", "ChoTato Club", "ChoColate", "ChoFries"],
    "Aruga": ["ChoSoup", "y ChoSoup", "y ChoColate"],
    "Likha": ["ChoSoup", "y ChoSoup", "ChoTato Club", "ChoColate", "ChoFries"],
    "Dalisay": ["ChoSoup", "y ChoSoup", "y ChoColate"],
    "Marahuyo": ["ChoSoup", "y ChoSoup", "ChoTato Club", "ChoColate", "ChoFries"],
    "Diwa": ["ChoSoup", "y ChoSoup", "ChoTato Club", "y ChoColate"],
    "Bonita": ["ChoSoup", "y ChoSoup", "ChoTato Club", "ChoColate", "ChoFries"],
    "Gabay": ["ChoSoup", "y ChoSoup", "y ChoColate"],
    "Dakila": ["ChoSoup", "y ChoSoup", "ChoTato Club", "ChoColate", "ChoFries", "y ChoColate"],
    "Kalangitan": ["ChoSoup", "y ChoSoup"],
    "Malaya": ["ChoSoup", "y ChoSoup"],
    "Pangarap": ["ChoSoup", "y ChoSoup"],
    "Giliw": ["ChoSoup", "y ChoSoup", "ChoTato Club", "ChoColate", "ChoFries", "y ChoColate"],
    "Adhika": ["ChoSoup", "y ChoSoup"],
};

export const SUB_ISLAND_CATEGORIES: Record<string, string> = {
    "Hiraya": "1.0 Island",
    "Tagumpay": "1.0 Island",
    "Bahaghari": "2.0 Island",
    "Alapaap": "2.0 Island",
    "Bituin": "Furniture Island",
    "Lakan": "Furniture Island",
    "Galak": "Seasonal Island",
    "Aruga": "Seasonal Island",
    "Likha": "Mats and DIY",
    "Dalisay": "Mats and DIY",
    "Marahuyo": "Critters & DIY",
    "Diwa": "Critters & DIY",
    "Bonita": "Clothing",
    "Gabay": "Clothing",
    "Dakila": "3.0 Island",
    "Kalangitan": "3.0 Island",
    "Malaya": "3.0 Island",
    "Pangarap": "3.0 Island",
    "Giliw": "Pink Island",
    "Adhika": "Pink Island",
};

export const PROVIDER_TIERS = {
    youtube: ["y ChoSoup", "y ChoColate", "y ChoTato"],
    twitch: ["ChoTato Club"],
    patreon: ["ChoSoup", "ChoColate", "ChoFries"],
} as const;

export const ALL_SUB_TIERS = [
    "ChoSoup",
    "y ChoSoup",
    "ChoTato Club",
    "ChoColate",
    "ChoFries",
    "y ChoColate",
    "y ChoTato",
] as const;

/**
 * Normalizes island name for matrix lookup
 */
export function cleanIslandName(name: string): string {
    if (!name) return "";
    return name
        .trim()
        .replace(/^sub\s+island\s+/i, "")
        .trim();
}

/**
 * Resolves all active subscription tier names from an authenticated user.
 * Translates Discord Role IDs to human-readable tier names.
 */
export function getUserSubTiers(user: AuthUser | null | undefined): string[] {
    if (!user) return [];
    const tiers = new Set<string>();

    if (user.sub_tier && typeof user.sub_tier === "string" && user.sub_tier.trim()) {
        tiers.add(user.sub_tier.trim());
    }

    if (user.connected_accounts && typeof user.connected_accounts === "object") {
        for (const acc of Object.values(user.connected_accounts)) {
            if (acc && typeof acc === "object" && (acc as any).sub_tier) {
                tiers.add(String((acc as any).sub_tier).trim());
            }
        }
    }

    if (Array.isArray(user.roles)) {
        for (const role of user.roles) {
            if (!role) continue;
            const rStr = String(role).trim();
            // Check direct role ID mapping
            if (TIER_ID_TO_NAME[rStr]) {
                tiers.add(TIER_ID_TO_NAME[rStr]);
            }
            // Check if already a tier name
            const matchingTier = ALL_SUB_TIERS.find(t => t.toLowerCase() === rStr.toLowerCase());
            if (matchingTier) {
                tiers.add(matchingTier);
            }
        }
    }

    return Array.from(tiers);
}

/**
 * Returns allowed tiers for a given Sub Island
 */
export function getSubIslandAllowedTiers(islandName: string): string[] {
    const clean = cleanIslandName(islandName);
    const key = Object.keys(SUB_ISLAND_ACCESS_MATRIX).find(
        (k) => k.toLowerCase() === clean.toLowerCase()
    );
    return key ? SUB_ISLAND_ACCESS_MATRIX[key] : [];
}

/**
 * Returns the unique set of platform origins (youtube, twitch, patreon) that unlock an island.
 */
export function getIslandPlatforms(islandName: string): ("patreon" | "twitch" | "youtube")[] {
    const allowed = getSubIslandAllowedTiers(islandName);
    const platforms = new Set<"patreon" | "twitch" | "youtube">();

    for (const tier of allowed) {
        if (tier.startsWith("y ")) {
            platforms.add("youtube");
        } else if (tier.toLowerCase().includes("chotato") || tier.toLowerCase().includes("twitch")) {
            platforms.add("twitch");
        } else {
            platforms.add("patreon");
        }
    }

    return Array.from(platforms);
}

/**
 * Checks whether an authenticated user has access to a specific Sub Island.
 */
export function canUserAccessSubIsland(
    islandName: string,
    user: AuthUser | null | undefined
): boolean {
    if (!user) return false;
    if (user.is_admin || user.is_mod) return true;

    const allowedTiers = getSubIslandAllowedTiers(islandName);
    if (!allowedTiers || allowedTiers.length === 0) return false;

    const userTiers = getUserSubTiers(user);
    const normalizedUser = userTiers.map((t) => t.toLowerCase());

    return allowedTiers.some((allowed) =>
        normalizedUser.includes(allowed.toLowerCase())
    );
}

/**
 * Returns UI metadata for a tier
 */
export function getTierBadgeMeta(tierName: string): {
    label: string;
    icon: string;
    color: string;
    bgColor: string;
    borderColor: string;
    provider: "youtube" | "twitch" | "patreon" | "unknown";
} {
    const t = (tierName || "").trim();
    if (t.startsWith("y ") || t.toLowerCase().includes("youtube")) {
        return {
            label: t,
            icon: "fa-brands fa-youtube",
            color: "#DC2626",
            bgColor: "rgba(220, 38, 38, 0.1)",
            borderColor: "rgba(220, 38, 38, 0.25)",
            provider: "youtube",
        };
    }
    if (t.toLowerCase().includes("chotato") || t.toLowerCase().includes("twitch")) {
        return {
            label: t,
            icon: "fa-brands fa-twitch",
            color: "#9146FF",
            bgColor: "rgba(145, 70, 255, 0.1)",
            borderColor: "rgba(145, 70, 255, 0.25)",
            provider: "twitch",
        };
    }
    return {
        label: t,
        icon: "fa-brands fa-patreon",
        color: "#EA580C",
        bgColor: "rgba(234, 88, 12, 0.1)",
        borderColor: "rgba(234, 88, 12, 0.25)",
        provider: "patreon",
    };
}
