import { useEffect, useRef } from "react";
import { useAuth } from "../context/useAuth";
import { useIslandData } from "../context/useIslandData";
import { checkIsSubscriberOrStaff, suppressAdsForSubscriber } from "../utils/subscriberUtils";

const ADSENSE_CLIENT_ID = "ca-pub-2383698626071146";
const ADSENSE_SCRIPT_ID = "chopaeng-adsense-sdk";

/**
 * AdSenseManager
 *
 * Dynamically controls Google AdSense lifecycle.
 * - For logged-in subscribers (ChoFries, ChoSoup, etc.) and staff (admin/mod),
 *   ads are 100% suppressed: adsbygoogle.js is NEVER loaded, any injected auto-ads
 *   are eliminated, and a strict CSS guard prevents any ad overlays.
 * - For free/unauthenticated visitors, adsbygoogle.js is injected dynamically.
 */
export default function AdSenseManager() {
    const { user, loading: authLoading, canAccessIsland } = useAuth();
    const { islands, loading: islandsLoading } = useIslandData();
    const scriptInjectedRef = useRef(false);

    const isSubscriber = checkIsSubscriberOrStaff(user, islands, canAccessIsland);
    const isSettled = !authLoading && !islandsLoading;

    useEffect(() => {
        // If the user is identified as subscriber or staff, completely suppress ads
        if (isSubscriber) {
            suppressAdsForSubscriber();

            // Run an observer/poller for 5 seconds to catch any auto-ads iframes AdSense may try to spawn
            const interval = setInterval(() => {
                suppressAdsForSubscriber();
            }, 500);

            const timer = setTimeout(() => clearInterval(interval), 5000);
            return () => {
                clearInterval(interval);
                clearTimeout(timer);
            };
        }

        // Only inject AdSense for non-subscribers after auth state has fully settled
        if (isSettled && !isSubscriber && !scriptInjectedRef.current) {
            if (!document.getElementById(ADSENSE_SCRIPT_ID)) {
                const script = document.createElement("script");
                script.id = ADSENSE_SCRIPT_ID;
                script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`;
                script.async = true;
                script.crossOrigin = "anonymous";
                document.head.appendChild(script);
                scriptInjectedRef.current = true;
            }
        }
    }, [isSubscriber, isSettled]);

    return null;
}
