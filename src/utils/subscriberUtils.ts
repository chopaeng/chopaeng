/**
 * Subscriber & Staff access verification for ChoPaeng.
 * Dynamically resolves ad-free subscriber status from API responses:
 * 1. `/api/auth/me`: user.is_admin, user.is_mod, user.is_subscriber, user.sub_tier
 * 2. `/api/islands` (with Bearer token): checks if member/sub islands have "accessible": true
 * 3. Matrix tiers: ChoSoup, y ChoSoup, ChoTato Club, ChoColate, ChoFries, y ChoColate, y ChoTato
 */

import { ALL_SUB_TIERS } from './subIslandAccess';

export interface MinimalUser {
    user_id?: string;
    roles?: string[];
    is_mod?: boolean;
    is_admin?: boolean;
    is_subscriber?: boolean;
    sub_tier?: string | null;
    connected_providers?: string[];
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

    // 2. Direct Sub Tier (Twitch, Patreon, YouTube)
    if (user.sub_tier && typeof user.sub_tier === 'string' && user.sub_tier.trim()) {
        return true;
    }

    // 3. User roles match any known sub tier
    if (Array.isArray(user.roles) && user.roles.length > 0) {
        const normalized = user.roles.map(r => String(r).toLowerCase());
        const hasSubTier = ALL_SUB_TIERS.some(tier => normalized.includes(tier.toLowerCase()));
        if (hasSubTier) return true;
    }

    // 4. Check `/api/islands` response (authenticated with Bearer token):
    if (islands && islands.length > 0) {
        const hasAccessibleSubIsland = islands.some((island) => {
            const isSubIsland =
                island.cat === 'member' ||
                (typeof island.type === 'string' && island.type.toUpperCase() === 'VIP') ||
                (typeof island.status === 'string' && island.status.toUpperCase().includes('SUB'));

            if (!isSubIsland) return false;

            if (island.accessible === true || island.viewerHasAccess === true) {
                return true;
            }

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
                max-height: 0 !important;
                min-height: 0 !important;
                opacity: 0 !important;
                pointer-events: none !important;
            }
        `;
        document.head.appendChild(style);
    }

    const adElements = document.querySelectorAll(
        '.adsbygoogle, .google-auto-placed, ins[class*="adsbygoogle"], iframe[id^="aswift_"], iframe[id^="google_ads_"], div[id^="google_ads_iframe"]'
    );
    adElements.forEach((el) => {
        try {
            el.remove();
        } catch (_err) {
            // ignore element removal error
        }
    });
}
