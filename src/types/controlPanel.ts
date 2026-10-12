export type ReviewStatus = 'pending' | 'authorised' | 'dismissed' | 'actioned';

export type MatchStatus = 'verified' | 'partial' | 'mismatch' | 'unregistered';

export type ModActionType = 'authorise' | 'dismiss' | 'warn' | 'timeout' | 'ban';

export interface ActiveRestriction {
    id: number;
    user_id: string;
    discord_id: string | null;
    action_type: 'TIMEOUT' | 'BAN';
    reason: string;
    created_at: number;
    expires_at: number | null;
}

export interface CorrelatedCandidate {
    user_id: string;
    username: string;
    nickname: string;
    ign: string;
    island_name: string;
    revealed_at: number;
    time_diff_seconds: number;
    score: number;
    char_icon?: string;
    char_default?: boolean;
    strikes: number;
    active_restriction?: ActiveRestriction | null;
    channel_id?: string;
    message_url?: string;
    is_flagged?: boolean;
    flag_reason?: string | null;
    flag_message?: string | null;
}

export interface FlightRecord {
    id: number;
    ign: string;
    origin_island: string;
    destination: string;
    timestamp: number;
    island_type: string;
    review_status: ReviewStatus;
    handled_by: string | null;
    handled_at: number | null;
    match_status: MatchStatus;
    match_score: number;
    strike_count: number;
    suggestion: string;
    is_flagged?: boolean;
    flag_reason?: string | null;
    primary_candidate: CorrelatedCandidate | null;
    runner_ups: CorrelatedCandidate[];
}

export interface ControlPanelStats {
    flights_today: number;
    pending_total: number;
    authorised_today: number;
    actioned_today: number;
    active_restrictions: number;
    server_time: number;
}

export interface ModActionPayload {
    visit_id: number;
    action: ModActionType;
    user_id?: string;
    discord_id?: string;
    reason?: string;
    notes?: string;
    duration_hours?: number;
    force?: boolean;
    idempotency_key?: string;
}

export interface ActionResponse {
    success: boolean;
    action: string;
    visit_id: number;
    review_status: ReviewStatus;
    handled_by: string;
    handled_at: number;
    expires_at?: number | null;
    message: string;
    error?: string;
    code?: string;
}

export interface SavedCharacter {
    id: number;
    ign: string;
    island_name: string;
    icon: string;
    is_default: boolean;
    created_at: number;
}

export interface WarningRecord {
    id: number;
    reason: string;
    mod_id: string;
    timestamp: number;
    action_type: string;
}

export interface RecentFlightRecord {
    id: number;
    ign: string;
    origin_island: string;
    destination: string;
    review_status: ReviewStatus;
    timestamp: number;
}

export interface UserInspectResult {
    user_id: string;
    ign: string;
    characters: SavedCharacter[];
    warnings: WarningRecord[];
    recent_flights: RecentFlightRecord[];
    active_restriction: ActiveRestriction | null;
}

export interface ActionHistoryItem {
    id: number;
    actor_name: string;
    action: string;
    target: string;
    details: {
        visit_id?: number;
        flight_ign?: string;
        flight_origin?: string;
        destination?: string;
        target_user_id?: string;
        target_discord_id?: string;
        reason?: string;
        notes?: string;
        duration_hours?: number;
        expires_at?: number | null;
        reverted_from_status?: string;
        reverted_mod?: string;
        [key: string]: unknown;
    };
    created_at: number;
}
