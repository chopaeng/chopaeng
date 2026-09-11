import { useEffect, useRef } from "react";
import { useAuth } from "../context/useAuth";
import { useIslandData } from "../context/useIslandData";

// Augment the Window interface so TypeScript knows about adsbygoogle
declare global {
    interface Window {
        adsbygoogle: unknown[];
    }
}

export type AdFormat = "auto" | "fluid" | "rectangle" | "vertical" | "horizontal";

interface AdBannerProps {
    /** Google AdSense ad-unit slot ID (the numeric string from your AdSense account). */
    slot: string;
    /**
     * Ad format passed to data-ad-format.
     * @default "auto"
     */
    format?: AdFormat;
    /**
     * When true, sets data-full-width-responsive="true" on the <ins> element.
     * @default true
     */
    responsive?: boolean;
    /** Optional extra className applied to the wrapping <div>. */
    className?: string;
    /** Optional inline style applied to the wrapping <div>. */
    style?: React.CSSProperties;
}

/**
 * AdBanner
 *
 * Renders a Google AdSense ad unit. Ads are automatically suppressed (component
 * returns null) for users who have subscriber-level island access, i.e. users
 * whose Discord roles grant them access to at least one member-gated island
 * (ChoFries tier and above).
 *
 * Free users (no roles) and unauthenticated visitors will see ads normally.
 *
 * Usage:
 * ```tsx
 * import AdBanner from "../components/AdBanner";
 * import { AD_SLOTS } from "../config/adSlots";
 *
 * <AdBanner slot={AD_SLOTS.DISPLAY} />
 * ```
 */
const AdBanner: React.FC<AdBannerProps> = ({
    slot,
    format = "auto",
    responsive = true,
    className,
    style,
}) => {
    const { user, canAccessIsland } = useAuth();
    const { islands } = useIslandData();
    const pushed = useRef(false);

    // ── Subscriber gate ─────────────────────────────────────────────────────
    // Suppress ads for users who can access at least one member-gated island.
    // Member islands require Discord roles (ChoFries+), so this naturally gates
    // on paid tiers without hardcoding specific role IDs that may change.
    const isSubscriber: boolean = (() => {
        if (!user) return false;
        // Mods / admins always get ad-free experience
        if (user.is_mod || user.is_admin) return true;
        // Check if the user has access to any member-category island with required roles
        return islands.some(
            (island) =>
                island.cat === "member" &&
                island.requiredRoles.length > 0 &&
                canAccessIsland(island.requiredRoles)
        );
    })();

    // ── Push AdSense unit ────────────────────────────────────────────────────
    useEffect(() => {
        // Don't push if subscriber or already pushed for this mount
        if (isSubscriber || pushed.current) return;
        try {
            (window.adsbygoogle = window.adsbygoogle || []).push({});
            pushed.current = true;
        } catch (e) {
            console.error("AdSense push error:", e);
        }
    }, [isSubscriber]);

    // Subscribers see nothing
    if (isSubscriber) return null;

    return (
        <div
            className={className}
            style={{ overflow: "hidden", textAlign: "center", ...style }}
            aria-hidden="true"
        >
            <ins
                className="adsbygoogle"
                style={{ display: "block" }}
                data-ad-client="ca-pub-2383698626071146"
                data-ad-slot={slot}
                data-ad-format={format}
                data-full-width-responsive={responsive ? "true" : "false"}
            />
        </div>
    );
};

export default AdBanner;
