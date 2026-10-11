import React, { useState, useEffect, useCallback } from "react";
import { DODO_API_BASE } from "../config/api";
import { AuthContext, type AuthUser, type AuthProviderType } from "./authContextShared";
import { clearAuthToken, getAuthToken } from "./authToken";
import { handleAccountSwitchCheck, handleLogoutStorageCleanup } from "../utils/accountStorage";
import { checkIsSubscriberOrStaff } from "../utils/subscriberUtils";
import { TIER_ID_TO_NAME, TIER_NAME_TO_ID } from "../config/constants";
import { LoginModal } from "../components/LoginModal";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const [loginModalReturnPath, setLoginModalReturnPath] = useState<string | undefined>(undefined);

    const openLoginModal = useCallback((returnPath?: string) => {
        setLoginModalReturnPath(returnPath);
        setIsLoginModalOpen(true);
    }, []);

    const closeLoginModal = useCallback(() => {
        setIsLoginModalOpen(false);
    }, []);

    const fetchMe = useCallback(async (token: string): Promise<AuthUser | null> => {
        try {
            const resp = await fetch(`${DODO_API_BASE}/api/auth/me`, {
                headers: { Authorization: `Bearer ${token}` },
                credentials: "include",
            });
            if (!resp.ok) return null;
            const data = await resp.json();
            if (data.logged_in) {
                const authedUser: AuthUser = {
                    user_id:  data.user_id,
                    username: data.username,
                    discord_name: data.discord_name || data.username,
                    nickname: data.nickname || '',
                    avatar:   data.avatar,
                    roles:    data.roles ?? [],
                    is_mod:   data.is_mod ?? false,
                    is_admin: data.is_admin ?? false,
                    is_subscriber: Boolean(data.is_subscriber || data.sub_tier || checkIsSubscriberOrStaff(data)),
                    provider: data.provider || (data.has_password ? "native" : "discord"),
                    sub_tier: data.sub_tier || null,
                    connected_providers: data.connected_providers || [],
                    connected_accounts: data.connected_accounts || {},
                    email: data.email || "",
                    has_password: Boolean(data.has_password),
                };
                handleAccountSwitchCheck(authedUser.user_id);
                setUser(authedUser);
                return authedUser;
            }
        } catch {
            // network error — treat as not logged in
        }
        return null;
    }, []);

    const refreshAuth = useCallback(async (tokenOverride?: string): Promise<boolean> => {
        setLoading(true);
        const token = tokenOverride || getAuthToken();
        if (!token) {
            handleLogoutStorageCleanup();
            setUser(null);
            setLoading(false);
            window.dispatchEvent(new CustomEvent("chopaeng_auth_change", { detail: { user: null } }));
            return false;
        }

        const authedUser = await fetchMe(token);
        if (!authedUser) {
            clearAuthToken();
            handleLogoutStorageCleanup();
            setUser(null);
            setLoading(false);
            window.dispatchEvent(new CustomEvent("chopaeng_auth_change", { detail: { user: null } }));
            return false;
        }

        setUser(authedUser);
        setLoading(false);
        window.dispatchEvent(new CustomEvent("chopaeng_auth_change", { detail: { user: authedUser } }));
        return true;
    }, [fetchMe]);

    useEffect(() => {
        const token = getAuthToken();
        if (token) {
            fetchMe(token).then(authedUser => {
                if (!authedUser) {
                    clearAuthToken();
                    handleLogoutStorageCleanup();
                    window.dispatchEvent(new CustomEvent("chopaeng_auth_change", { detail: { user: null } }));
                } else {
                    window.dispatchEvent(new CustomEvent("chopaeng_auth_change", { detail: { user: authedUser } }));
                }
                setLoading(false);
            });
        } else {
            setLoading(false);
            window.dispatchEvent(new CustomEvent("chopaeng_auth_change", { detail: { user: null } }));
        }

        const handleNickUpdated = (e: Event) => {
            const custom = e as CustomEvent<{ nickname?: string }>;
            const newNick = custom.detail?.nickname;
            if (typeof newNick === 'string') {
                setUser((prev) => (prev ? { ...prev, nickname: newNick } : prev));
            }
        };

        window.addEventListener('chopaeng_nickname_updated', handleNickUpdated);
        return () => window.removeEventListener('chopaeng_nickname_updated', handleNickUpdated);
    }, [fetchMe]);

    const loginWithProvider = useCallback((provider: AuthProviderType, returnPath?: string) => {
        try {
            const target = typeof returnPath === "string" && returnPath
                ? returnPath
                : window.location.pathname + window.location.search;
            sessionStorage.setItem("chopaeng_auth_return_to", target);
        } catch (_err) {
            // ignore storage errors
        }
        const returnTo = `${window.location.origin}/auth/callback`;
        const activeToken = getAuthToken();
        const tokenQuery = activeToken ? `&auth_token=${encodeURIComponent(activeToken)}` : "";
        window.location.href = `${DODO_API_BASE}/api/auth/${provider}?return_to=${encodeURIComponent(returnTo)}${tokenQuery}`;
    }, []);

    const login = useCallback((returnPathOrEvent?: string | React.MouseEvent) => {
        const target = typeof returnPathOrEvent === "string" ? returnPathOrEvent : undefined;
        openLoginModal(target);
    }, [openLoginModal]);

    const unlinkProvider = useCallback(async (provider: string): Promise<boolean> => {
        const token = getAuthToken();
        if (!token) return false;
        try {
            const resp = await fetch(`${DODO_API_BASE}/api/auth/unlink/${provider}`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });
            const data = await resp.json();
            if (data.success) {
                await fetchMe(token);
                return true;
            }
            return false;
        } catch (err) {
            console.error("Failed to unlink provider", err);
            return false;
        }
    }, [fetchMe]);

    const logout = async () => {
        const token = getAuthToken();
        if (token) {
            try {
                await fetch(`${DODO_API_BASE}/api/auth/logout`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}` },
                    credentials: "include",
                });
            } catch (_err) {
                // ignore network error on logout
            }
        }
        clearAuthToken();
        handleLogoutStorageCleanup();
        setUser(null);
        window.dispatchEvent(new CustomEvent("chopaeng_auth_change", { detail: { user: null } }));
    };

    const hasRole = (roleIds: string[]): boolean => {
        if (!user) return false;
        if (user.is_mod || user.is_admin) return true;
        
        // Expand user roles to include both IDs and names
        const expandedUserRoles = new Set<string>();
        for (const r of user.roles || []) {
            const s = String(r).trim();
            expandedUserRoles.add(s);
            if (TIER_ID_TO_NAME[s]) expandedUserRoles.add(TIER_ID_TO_NAME[s]);
            if (TIER_NAME_TO_ID[s.toLowerCase()]) expandedUserRoles.add(TIER_NAME_TO_ID[s.toLowerCase()]);
        }
        
        return roleIds.some(id => {
            const clean = String(id).trim();
            if (expandedUserRoles.has(clean)) return true;
            if (TIER_ID_TO_NAME[clean] && expandedUserRoles.has(TIER_ID_TO_NAME[clean])) return true;
            if (TIER_NAME_TO_ID[clean.toLowerCase()] && expandedUserRoles.has(TIER_NAME_TO_ID[clean.toLowerCase()])) return true;
            return false;
        });
    };

    const canAccessIsland = (requiredRoles: string[]): boolean => {
        if (!requiredRoles || requiredRoles.length === 0) return true;
        if (!user) return false;
        return hasRole(requiredRoles);
    };

    const isSubscriber = checkIsSubscriberOrStaff(user);

    return (
        <AuthContext.Provider
            value={{
                user,
                loading,
                isSubscriber,
                login,
                loginWithProvider,
                unlinkProvider,
                logout,
                refreshAuth,
                hasRole,
                canAccessIsland,
                isLoginModalOpen,
                openLoginModal,
                closeLoginModal,
            }}
        >
            {children}
            <LoginModal isOpen={isLoginModalOpen} onClose={closeLoginModal} returnPath={loginModalReturnPath} />
        </AuthContext.Provider>
    );
};
