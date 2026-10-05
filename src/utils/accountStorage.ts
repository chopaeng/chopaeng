/**
 * Utility for managing user-scoped local storage and ensuring zero data leakage
 * when logging into different accounts on the same device.
 */

export const ACTIVE_USER_ID_KEY = 'chopaeng_active_user_id';

// Base keys that must be isolated per user account
export const USER_SCOPED_BASE_KEYS = [
    'chopaeng_saved_characters_v1',
    'chopaeng_order_profile_v1',
    'chopaeng_discord_nickname',
    'chopaeng_active_order_v1',
    'chopaeng_saved_loadouts_v1',
    'chopaeng_local_order_history',
    'chopaeng_order_history_v1',
    'chopaeng_user_passport',
    'chopaeng_user_preferences',
    'chopaeng_local_preset_vault_v1',
    'chopaeng_user_orders_placed_count',
    'chopaeng_user_drops_placed_count',
    'command_builder_order_items',
    'command_builder_drop_items',
    'command_builder_selected_items',
    'chopaeng_item_favorites',
    'chopaeng_favorite_islands',
    'chopaeng_collection',
    'chopaeng_community_upvotes',
    'chopaeng_user_upvoted_loadouts',
    'chopaeng_caught_critters_north',
    'chopaeng_caught_critters_south',
    'chopaeng_notification_history_v1',
    'chopaeng_notification_history',
    'chopaeng_active_order',
    'chopaeng_saved_order_loadouts',
    'chopaeng_public_profile_v1',
    'chopaeng_tracked_items',
    'chopaeng_saved_trip_plans',
] as const;

export const getActiveUserId = (): string | null => {
    try {
        return localStorage.getItem(ACTIVE_USER_ID_KEY);
    } catch {
        return null;
    }
};

export const setActiveUserId = (userId: string | null): void => {
    try {
        if (userId) {
            localStorage.setItem(ACTIVE_USER_ID_KEY, userId);
        } else {
            localStorage.removeItem(ACTIVE_USER_ID_KEY);
        }
    } catch {
        // Storage write failed
    }
};

/**
 * Returns a user-scoped storage key.
 * If userId is provided, uses that. Otherwise falls back to the currently active user ID.
 * If no user is logged in, uses a guest-scoped key so guest data is also isolated from logged-in users.
 */
export const getUserScopedKey = (baseKey: string, userId?: string | null): string => {
    const uid = userId !== undefined ? userId : getActiveUserId();
    if (!uid) {
        return `${baseKey}_guest`;
    }
    return `${baseKey}_u_${uid}`;
};

/**
 * Gets a user-scoped item with fallback to legacy unscoped key on initial migration.
 */
export const getUserScopedItem = (baseKey: string, userId?: string | null): string | null => {
    try {
        const uid = userId !== undefined ? userId : getActiveUserId();
        if (uid) {
            const scopedKey = `${baseKey}_u_${uid}`;
            const scopedVal = localStorage.getItem(scopedKey);
            if (scopedVal !== null) {
                return scopedVal;
            }
            // Check legacy unscoped key for migration if this was the last active user
            const legacyVal = localStorage.getItem(baseKey);
            if (legacyVal !== null) {
                // Migrate to user-scoped key and remove legacy
                localStorage.setItem(scopedKey, legacyVal);
                localStorage.removeItem(baseKey);
                return legacyVal;
            }
            return null;
        } else {
            return localStorage.getItem(`${baseKey}_guest`) ?? localStorage.getItem(baseKey);
        }
    } catch {
        return null;
    }
};

/**
 * Sets a user-scoped storage item and removes any lingering unscoped key.
 */
export const setUserScopedItem = (baseKey: string, value: string, userId?: string | null): void => {
    try {
        const uid = userId !== undefined ? userId : getActiveUserId();
        const key = uid ? `${baseKey}_u_${uid}` : `${baseKey}_guest`;
        localStorage.setItem(key, value);
        // Clean up legacy unscoped key so it never lingers or gets picked up by other accounts
        localStorage.removeItem(baseKey);
    } catch {
        // Storage write failed
    }
};

/**
 * Removes a user-scoped storage item.
 */
export const removeUserScopedItem = (baseKey: string, userId?: string | null): void => {
    try {
        const uid = userId !== undefined ? userId : getActiveUserId();
        if (uid) {
            localStorage.removeItem(`${baseKey}_u_${uid}`);
        } else {
            localStorage.removeItem(`${baseKey}_guest`);
        }
        localStorage.removeItem(baseKey);
    } catch {
        // Ignore
    }
};

/**
 * Clears all unscoped legacy keys and guest keys so nothing leaks.
 */
export const clearUnscopedAccountData = (): void => {
    try {
        for (const baseKey of USER_SCOPED_BASE_KEYS) {
            localStorage.removeItem(baseKey);
            localStorage.removeItem(`${baseKey}_guest`);
        }
    } catch {
        // Ignore
    }
};

/**
 * Detects if the logged-in user changed and handles the switch cleanly.
 */
export const handleAccountSwitchCheck = (newUserId: string | null): boolean => {
    try {
        const currentActiveId = localStorage.getItem(ACTIVE_USER_ID_KEY);
        if (currentActiveId && newUserId && currentActiveId !== newUserId) {
            // Switched from User A to User B! Clean up old un-scoped keys
            clearUnscopedAccountData();
            localStorage.setItem(ACTIVE_USER_ID_KEY, newUserId);
            window.dispatchEvent(
                new CustomEvent('chopaeng_account_switched', {
                    detail: { previousUserId: currentActiveId, newUserId },
                })
            );
            return true;
        } else if (newUserId) {
            localStorage.setItem(ACTIVE_USER_ID_KEY, newUserId);
        } else {
            localStorage.removeItem(ACTIVE_USER_ID_KEY);
        }
    } catch {
        // Ignore
    }
    return false;
};

/**
 * Clears active session data when user logs out.
 */
export const handleLogoutStorageCleanup = (): void => {
    try {
        clearUnscopedAccountData();
        localStorage.removeItem(ACTIVE_USER_ID_KEY);
        window.dispatchEvent(
            new CustomEvent('chopaeng_account_switched', {
                detail: { previousUserId: null, newUserId: null },
            })
        );
    } catch {
        // Ignore
    }
};
