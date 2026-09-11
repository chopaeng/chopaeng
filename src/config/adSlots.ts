/**
 * Google AdSense ad unit slot IDs.
 * Add your real slot IDs from your AdSense account:
 * https://www.google.com/adsense → Ads → By ad unit
 *
 * The AdSense publisher ID (ca-pub-2383698626071146) is already in index.html.
 *
 * Available AdSense unit types:
 *  - DISPLAY     → "Display ads"     — all-rounder, works anywhere
 *  - IN_FEED     → "In-feed ads"     — between posts / listings (native)
 *  - IN_ARTICLE  → "In-article ads"  — inside article / content pages (native)
 *  - MULTIPLEX   → "Multiplex ads"   — grid-based content recommendation (native)
 */
export const AD_SLOTS = {
    /**
     * Display ads — recommended all-rounder.
     * Use data-ad-format="auto" + data-full-width-responsive="true".
     * Current unit: Square (5283173261)
     */
    DISPLAY: "5283173261",

    /**
     * In-feed ads — native unit that fits in-between posts or listings.
     * Replace with your In-feed slot ID from AdSense.
     */
    IN_FEED: "5205940193",

    /**
     * In-article ads — native unit for inside article / content pages.
     * Replace with your In-article slot ID from AdSense.
     */
    IN_ARTICLE: "5642265914",

    /**
     * Multiplex ads — grid-based content recommendation native unit.
     * Replace with your Multiplex slot ID from AdSense.
     */
    MULTIPLEX: "4329184243",
} as const;

export type AdSlotKey = keyof typeof AD_SLOTS;
