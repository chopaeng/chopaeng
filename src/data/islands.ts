export type IslandCategory = "public" | "member" | "order";
export type IslandTheme = "pink" | "teal" | "purple" | "gold";
export type IslandStatus = "ONLINE" | "SUB ONLY" | "REFRESHING" | "OFFLINE";

export interface GameTimeData {
    success?: boolean;
    game_time?: string;
    formatted?: string;
    year?: number;
    month?: number;
    day?: number;
    hour?: number;
    minute?: number;
    is_nooks_open?: boolean;
    nooks_status?: string;
    nooks_message?: string;
    mode?: string;
    message?: string;
}

export interface IslandData {
    id: string;
    name: string;
    canonicalName?: string;
    type: string;
    items: string[];
    theme: IslandTheme;
    cat: IslandCategory;
    description: string;
    seasonal: string;

    dodoCode?: string;
    status: IslandStatus;
    discordBotOnline?: boolean;
    visitors: number;
    mapUrl?: string;
    updatedAt?: string;
    requiredRoles: string[];
    accessible?: boolean;
    viewerHasAccess?: boolean;
    channel_id?: string;

    gameTime?: string;
    isNooksOpen?: boolean;
    nooksStatus?: string;
    nooksMessage?: string;
    mode?: string;
    gametime?: GameTimeData;
}
