import { CONSOLE_API_BASE } from '../config/api';

export interface IslandMapItem {
    name: string;
    category: string;
    diy?: boolean;
    internalId?: string;
    itemIdHex?: string;
    itemIdDecimal?: number;
    markerField?: string;
    record_index?: number;
    raw_A?: number;
    raw_B?: number;
    raw_F?: number;
    raw_G?: number;
    position_confirmed?: boolean;
    x?: number;
    y?: number;
    sector?: string; // e.g. "B2", "C4"
    count?: number;
    imageUrl?: string;
}

export interface IslandSectorSummary {
    total_items: number;
    top_categories: string[];
    sample_items: string[];
}

export interface IslandMapGrid {
    width: number;
    height: number;
    acre_size: number;
    cols: string[]; // ["A", "B", "C", "D", "E", "F", "G"]
    rows: number[]; // [1, 2, 3, 4, 5, 6]
}

export interface IslandMapStats {
    total_items: number;
    unique_categories: number;
    category_counts: Record<string, number>;
    empty_slots?: number;
    background_fill_slots?: number;
}

export interface IslandMapResponse {
    ok: boolean;
    island: string;
    status: 'live_nhl' | 'live_nhl_v2' | 'not_found' | 'error' | string;
    file_found: boolean;
    file_path?: string | null;
    checked_paths?: string[];
    error?: string;
    record_size_bytes?: number;
    total_records?: number;
    grid?: IslandMapGrid;
    stats?: IslandMapStats;
    sector_summary?: Record<string, IslandSectorSummary>;
    sectors?: Record<string, IslandMapItem[]>;
    items: IslandMapItem[];
    caveats?: string[];
}

export interface IslandMapSearchResult {
    ok: boolean;
    island: string;
    query: string;
    status: string;
    total_matches: number;
    matches: IslandMapItem[];
}

export interface IslandMapStatusSummary {
    island: string;
    has_nhl: boolean;
    file_path?: string | null;
    expected_paths: string[];
}

/**
 * Fetch full item layout & sector data for an island.
 * Reads from VILLAGERS_DIR/<island_name>/nhl/maprefresh.nhl or
 * TWITCH_VILLAGERS_DIR/<island_name>/nhl/maprefresh.nhl.
 */
export const fetchIslandMap = async (
    islandName: string,
    forceRefresh: boolean = false
): Promise<IslandMapResponse> => {
    const clean = encodeURIComponent(islandName.trim());
    const url = `${CONSOLE_API_BASE}/api/islands/${clean}/map${forceRefresh ? '?refresh=1' : ''}`;
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Failed to load island map: HTTP ${res.status}`);
    }
    return res.json();
};

/**
 * Search items or categories on a specific island map.
 */
export const searchIslandMapItems = async (
    islandName: string,
    query: string
): Promise<IslandMapSearchResult> => {
    const clean = encodeURIComponent(islandName.trim());
    const q = encodeURIComponent(query.trim());
    const url = `${CONSOLE_API_BASE}/api/islands/${clean}/map/search?q=${q}`;
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Failed to search island items: HTTP ${res.status}`);
    }
    return res.json();
};

/**
 * List all islands and check which ones have maprefresh.nhl available.
 */
export const fetchIslandMapList = async (): Promise<IslandMapStatusSummary[]> => {
    const res = await fetch(`${CONSOLE_API_BASE}/api/islands/maps`);
    if (!res.ok) {
        throw new Error(`Failed to load island maps status: HTTP ${res.status}`);
    }
    const data = await res.json();
    return data.islands || [];
};
