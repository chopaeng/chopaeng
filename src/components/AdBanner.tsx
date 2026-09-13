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
    const { user, loading: authLoading, canAccessIsland } = useAuth();
    const { islands, loading: islandsLoading } = useIslandData();
    const pushed = useRef(false);

    // Both auth and island data must have settled before we can correctly
    // determine subscriber status. While either is loading, hold off.
    const isReady = !authLoading && !islandsLoading;

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
        // Wait until both auth and island data are fully loaded so we don't
        // accidentally serve an ad to a subscriber during the loading window.
        if (!isReady) return;
        // Don't push if subscriber or already pushed for this mount
        if (isSubscriber || pushed.current) return;
        try {
            (window.adsbygoogle = window.adsbygoogle || []).push({});
            pushed.current = true;
        } catch (e) {
            console.error("AdSense push error:", e);
        }
    }, [isReady, isSubscriber]);

    // Show nothing while loading (prevents flash of ad for subscribers)
    // or once we know the user is a subscriber.
    if (!isReady || isSubscriber) return null;

    return (
        <div
            className={className}
            style={{ display: "block", overflow: "hidden", textAlign: "center", minHeight: "90px", ...style }}
            aria-hidden="true"
        >
            <ins
                className="adsbygoogle"
                style={{ display: "block", minHeight: "90px" }}
                data-ad-client="ca-pub-2383698626071146"
                data-ad-slot={slot}
                data-ad-format={format}
                data-full-width-responsive={responsive ? "true" : "false"}
            />
        </div>
    );
};

export default AdBanner;
