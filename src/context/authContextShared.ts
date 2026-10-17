import { createContext } from "react";

export type AuthProviderType = "twitch" | "patreon" | "youtube" | "discord";

export interface ConnectedAccountDetail {
    id?: string;
    username?: string;
    name?: string;
    email?: string;
    avatar?: string;
    roles?: string[];
    sub_tier?: string | null;
    linked_at?: number;
}

export interface AuthUser {
    user_id: string;
    username: string;
    discord_name?: string;
    nickname?: string;
    avatar: string;
    roles: string[];
    is_mod: boolean;
    is_admin?: boolean;
    is_subscriber?: boolean;
    provider?: string;
    sub_tier?: string | null;
    connected_providers?: string[];
    connected_accounts?: Record<string, ConnectedAccountDetail>;
    email?: string;
    has_password?: boolean;
    sub_rules_accepted?: boolean;
    order_rules_accepted?: boolean;
    auth_checked_at?: number;
}

export interface AuthContextType {
    user: AuthUser | null;
    loading: boolean;
    isSubscriber: boolean;
    login: (returnPathOrEvent?: string | React.MouseEvent) => void;
    loginWithProvider: (provider: AuthProviderType, returnPath?: string) => void;
    unlinkProvider: (provider: string) => Promise<boolean>;
    logout: () => Promise<void>;
    refreshAuth: (tokenOverride?: string) => Promise<boolean>;
    hasRole: (roleIds: string[]) => boolean;
    canAccessIsland: (requiredRoles: string[]) => boolean;
    isLoginModalOpen: boolean;
    openLoginModal: (returnPath?: string) => void;
    closeLoginModal: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
