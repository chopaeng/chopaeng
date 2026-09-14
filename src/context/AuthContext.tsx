import React, { useState, useEffect, useCallback } from "react";
import { DODO_API_BASE } from "../config/api";
import { AuthContext, type AuthUser } from "./authContextShared";
import { clearAuthToken, getAuthToken } from "./authToken";
import { handleAccountSwitchCheck, handleLogoutStorageCleanup } from "../utils/accountStorage";
import { checkIsSubscriberOrStaff } from "../utils/subscriberUtils";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);

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
                    is_subscriber: Boolean(data.is_subscriber || checkIsSubscriberOrStaff(data)),
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
                }
                setLoading(false);
            });
        } else {
            setLoading(false);
        }

        const handleNickUpdated = (e: any) => {
            const newNick = e.detail?.nickname;
            if (typeof newNick === 'string') {
                setUser((prev) => (prev ? { ...prev, nickname: newNick } : prev));
            }
        };

        window.addEventListener('chopaeng_nickname_updated', handleNickUpdated);
        return () => window.removeEventListener('chopaeng_nickname_updated', handleNickUpdated);
    }, [fetchMe]);

    const login = (returnPath?: string | React.MouseEvent) => {
        try {
            const target = typeof returnPath === "string" && returnPath
                ? returnPath
                : window.location.pathname + window.location.search;
            sessionStorage.setItem("chopaeng_auth_return_to", target);
        } catch {}
        const returnTo = `${window.location.origin}/auth/callback`;
        window.location.href = `${DODO_API_BASE}/api/auth/discord?return_to=${encodeURIComponent(returnTo)}`;
    };

    const logout = async () => {
        const token = getAuthToken();
        if (token) {
            try {
                await fetch(`${DODO_API_BASE}/api/auth/logout`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}` },
                    credentials: "include",
                });
            } catch { /* ignore */ }
        }
        clearAuthToken();
        handleLogoutStorageCleanup();
        setUser(null);
        window.dispatchEvent(new CustomEvent("chopaeng_auth_change", { detail: { user: null } }));
    };

    const hasRole = (roleIds: string[]): boolean => {
        if (!user) return false;
        if (user.is_mod || user.is_admin) return true;
        return roleIds.some(id => user.roles.includes(id));
    };

    const canAccessIsland = (requiredRoles: string[]): boolean => {
        if (!requiredRoles || requiredRoles.length === 0) return true;
        if (!user) return false;
        return hasRole(requiredRoles);
    };

    const isSubscriber = checkIsSubscriberOrStaff(user);

    return (
        <AuthContext.Provider value={{ user, loading, isSubscriber, login, logout, refreshAuth, hasRole, canAccessIsland }}>
            {children}
        </AuthContext.Provider>
    );
};
