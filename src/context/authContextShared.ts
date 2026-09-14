import { createContext } from "react";

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
}

export interface AuthContextType {
    user: AuthUser | null;
    loading: boolean;
    isSubscriber: boolean;
    login: (returnPath?: string | React.MouseEvent) => void;
    logout: () => Promise<void>;
    refreshAuth: (tokenOverride?: string) => Promise<boolean>;
    hasRole: (roleIds: string[]) => boolean;
    canAccessIsland: (requiredRoles: string[]) => boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
