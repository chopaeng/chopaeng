/**
 * Subscriber & Staff access verification for ChoPaeng.
 * Dynamically resolves ad-free subscriber status from API responses:
 * 1. `/api/auth/me`: user.is_admin, user.is_mod, user.is_subscriber
 * 2. `/api/islands` (with Bearer token): checks if member/sub islands have "accessible": true
 *
 * No hardcoded Discord role IDs.
 */

export interface MinimalUser {
    user_id?: string;
    roles?: string[];
    is_mod?: boolean;
    is_admin?: boolean;
    is_subscriber?: boolean;
}

export interface MinimalIsland {
    id?: string;
    name?: string;
    cat?: string;
    type?: string;
    status?: string;
    accessible?: boolean;
    viewerHasAccess?: boolean;
    requiredRoles?: string[];
}

/**
 * Checks if a user is an active subscriber or staff member (Admin/Mod).
 * Subscribers and staff are 100% ad-free across the entire platform.
 *
 * Evaluates live API data:
 * - Staff or subscriber flags returned from `/api/auth/me`
 * - Member / subscriber islands returned from `/api/islands` with `"accessible": true`
 */
export function checkIsSubscriberOrStaff(
    user: MinimalUser | null | undefined,
    islands?: MinimalIsland[],
    canAccessIsland?: (requiredRoles: string[]) => boolean
): boolean {
    if (!user) return false;

    // 1. Check `/api/auth/me` response: Admin, Mod, or Subscriber flag
    if (user.is_admin || user.is_mod || user.is_subscriber) {
        return true;
    }

    // 2. Check `/api/islands` response (authenticated with Bearer token):
    // If the user has "accessible": true on any member / subscriber island, they are a subscriber
    if (islands && islands.length > 0) {
        const hasAccessibleSubIsland = islands.some((island) => {
            const isSubIsland =
                island.cat === 'member' ||
                (typeof island.type === 'string' && island.type.toUpperCase() === 'VIP') ||
                (typeof island.status === 'string' && island.status.toUpperCase().includes('SUB'));

            if (!isSubIsland) return false;

            // Direct API data: /api/islands returns accessible: true when user holds valid subscription roles/access
            if (island.accessible === true || island.viewerHasAccess === true) {
                return true;
            }

            // Fallback role check against island requiredRoles if provided
            if (canAccessIsland && island.requiredRoles && island.requiredRoles.length > 0) {
                return canAccessIsland(island.requiredRoles);
            }

            return false;
        });

        if (hasAccessibleSubIsland) {
            return true;
        }
    }

    return false;
}

const AD_KILLER_STYLE_ID = 'chopaeng-ad-free-guard';

/**
 * Purge and suppress Google AdSense Auto-Ads and iframes for subscribers.
 */
export function suppressAdsForSubscriber(): void {
    if (typeof document === 'undefined') return;

    // Inject permanent suppression stylesheet
    if (!document.getElementById(AD_KILLER_STYLE_ID)) {
        const style = document.createElement('style');
        style.id = AD_KILLER_STYLE_ID;
        style.textContent = `
            .adsbygoogle,
            .google-auto-placed,
            ins[class*="adsbygoogle"],
            iframe[id^="aswift_"],
            iframe[id^="google_ads_"],
            iframe[name^="google_ads_"],
            div[id^="google_ads_iframe"] {
                display: none !important;
                visibility: hidden !important;
                height: 0 !important;
                width: 0 !important;
                pointer-events: none !important;
                position: absolute !important;
                top: -9999px !important;
                left: -9999px !important;
            }
        `;
        document.head.appendChild(style);
    }

    // Remove any ad scripts or elements already present in the DOM
    try {
        const adElements = document.querySelectorAll(
            '.adsbygoogle, .google-auto-placed, ins[class*="adsbygoogle"], iframe[id^="aswift_"], iframe[id^="google_ads_"]'
        );
        adElements.forEach((el) => {
            el.remove();
        });
    } catch {
        // Ignore removal errors
    }
}
