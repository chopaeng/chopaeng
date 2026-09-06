import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DODO_API_BASE } from "../config/api";
import { getAuthToken } from "../context/authToken";
import { useAuth } from "../context/useAuth";
import { useIslandData } from "../context/useIslandData";
import { useCatalogData } from "../hooks/useCatalogData";
import { useFavoriteIslands, getStoredFavoriteIslands, saveStoredFavoriteIslands } from "../hooks/useFavoriteIslands";
import { useSavedCharacters, type SavedCharacter } from "../hooks/useSavedCharacters";
import { parseItemCodes } from "../utils/itemCodeParser";
import { parseDiscordNicknameToCharacters, formatCharactersToNickname } from "../utils/characterParser";
import { playChimeClick, playWaveChime, playWaveBackChime } from "../utils/kkAudioSynthesizer";
import { fetchUserOrderHistory, type OrderHistoryItem } from "../utils/orderBotApi";
import { getStoredPassport, savePassportToDb, fetchPublicPassportFromDb, updateDiscordNickname, type PublicPassportData } from "../utils/userProfileApi";
import {
    getTrafficStats,
    calculateIslandOccupancy,
    getOnlineResidentsList,
    openCommunityModal,
    broadcastResidentWave,
    type TrafficStats,
    type OnlineResident,
    type WaveNotification,
} from "../utils/communityPresenceApi";
import { HowItWorksExplainer, PROFILE_EXPLAINER_CONFIG } from "../components/HowItWorksExplainer";
import { ResidentPassportCard, FRUIT_ICONS, ZODIAC_SIGNS, PERSONALITY_THEMES } from "../components/passport/ResidentPassportCard";
import { setUserScopedItem } from "../utils/accountStorage";
import "./Profile.css";

const CHARACTER_ICONS = [
    { id: "fa-leaf", label: "Leaf" },
    { id: "fa-crown", label: "Crown" },
    { id: "fa-star", label: "Star" },
    { id: "fa-heart", label: "Heart" },
    { id: "fa-compass", label: "Compass" },
    { id: "fa-plane", label: "Plane" },
    { id: "fa-fish", label: "Fish" },
    { id: "fa-wand-magic-sparkles", label: "Magic" },
    { id: "fa-user", label: "Resident" },
    { id: "fa-tree", label: "Tree" },
    { id: "fa-gem", label: "Gem" },
    { id: "fa-house", label: "House" },
];

interface ProfileUser {
    id: string;
    discord_name: string;
    global_name: string;
    account_name: string;
    display_name: string;
    nickname: string;
    avatar: string;
    joined_at: string;
    joined_timestamp?: number | null;
    is_admin: boolean;
    is_mod: boolean;
}

interface ProfileRole {
    id: string;
    name: string;
}

interface ProfileIslandAccess {
    id?: string;
    name?: string;
    type?: string;
    channel_id?: string;
    access_source?: string;
    required_roles?: Array<string | ProfileRole>;
    matched_roles?: Array<string | ProfileRole>;
}

interface ProfileSubscriptions {
    role_ids?: string[];
    role_names?: string[];
    roles?: ProfileRole[];
    matched_subscription_role_ids?: string[];
    matched_subscription_role_names?: string[];
    matched_subscription_roles?: ProfileRole[];
    subscription_role_ids?: string[];
    accessible_islands?: ProfileIslandAccess[];
    accessible_member_islands?: ProfileIslandAccess[];
}

interface VisitIsland {
    island_id?: string;
    island_name?: string;
    name?: string;
    type?: string;
    visits?: number;
    count?: number;
    last_visit?: string;
    visited_at?: string;
    authorized?: boolean;
}

interface ProfileVisits {
    total?: number;
    authorized?: number;
    unauthorized?: number;
    by_island_type?: Record<string, number>;
    visits_by_island_type?: Record<string, number>;
    most_visited_islands?: VisitIsland[];
    recent_visits?: VisitIsland[];
    warning_summary?: Record<string, number> | string[] | null;
}

interface ProfileResponse {
    user: ProfileUser;
    subscriptions: ProfileSubscriptions;
    visits: ProfileVisits;
    favorite_islands?: string[];
}

const asArray = <T,>(value: T[] | undefined): T[] => (Array.isArray(value) ? value : []);
const uniqueValues = (items: string[]) => Array.from(new Set(items.filter(Boolean)));
const roleNamesFrom = (roles?: ProfileRole[]) => asArray(roles).map((role) => role.name || role.id);

const MS_TIMESTAMP_THRESHOLD = 1e12;

const formatDate = (value?: string | number | null) => {
    if (!value) return "Not available";
    const date =
        typeof value === "number"
            ? new Date(value < MS_TIMESTAMP_THRESHOLD ? value * 1000 : value)
            : new Date(value);
    if (Number.isNaN(date.getTime())) return "Not available";
    return new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
    }).format(date);
};

const formatDateTime = (value?: string | number | null) => {
    if (!value) return "Not available";
    const date =
        typeof value === "number"
            ? new Date(value < MS_TIMESTAMP_THRESHOLD ? value * 1000 : value)
            : new Date(value);
    if (Number.isNaN(date.getTime())) return "Not available";
    return new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    }).format(date);
};

const formatNumber = (value?: number) => new Intl.NumberFormat().format(value ?? 0);

const Profile = () => {
    const navigate = useNavigate();
    const { user: authUser, loading: authLoading, login, canAccessIsland } = useAuth();
    const { islands: allIslands } = useIslandData();
    const { favoriteIslands, toggleFavoriteIsland, isFavoriteIsland } = useFavoriteIslands();

    const [profile, setProfile] = useState<ProfileResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [prefNotice, setPrefNotice] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"profile" | "access" | "favorites" | "orders" | "history" | "community">("profile");
    const [accessFilter, setAccessFilter] = useState<"all" | "public" | "member" | "order">("all");

    // Community Radar & Traffic Telemetry State
    const [trafficStats, setTrafficStats] = useState<TrafficStats>(getTrafficStats);

    useEffect(() => {
        const interval = setInterval(() => {
            setTrafficStats(getTrafficStats());
        }, 30_000);
        return () => clearInterval(interval);
    }, []);
    const [communitySearchQuery, setCommunitySearchQuery] = useState("");
    const [communityFilter, setCommunityFilter] = useState<"all" | "on_island" | "ordering" | "passport">("all");
    const [communitySubTab, setCommunitySubTab] = useState<"online" | "islands" | "visits">("online");
    const [profileWaveNote, setProfileWaveNote] = useState<string | null>(null);
    const [profileWavedMap, setProfileWavedMap] = useState<Record<string, boolean>>({});

    // Listen for cross-tab or local incoming waves
    useEffect(() => {
        const handleIncomingWave = (e: any) => {
            const wave = e.detail as WaveNotification | undefined;
            if (!wave) return;
            const currentUsername = authUser?.username?.toLowerCase() || "";
            if (currentUsername && wave.toUsername.toLowerCase() === currentUsername) {
                playWaveBackChime();
                setProfileWaveNote(`👋 ${wave.fromDisplayName} waved hello at you!`);
                setTimeout(() => setProfileWaveNote(null), 6000);
            }
        };
        window.addEventListener("chopaeng_resident_wave", handleIncomingWave);
        return () => window.removeEventListener("chopaeng_resident_wave", handleIncomingWave);
    }, [authUser]);

    const handleProfileWave = (resident: OnlineResident) => {
        // Strict guard: do not wave self
        if (resident.isCurrentUser || profileWavedMap[resident.id]) return;

        playWaveChime();
        setProfileWavedMap((prev) => ({ ...prev, [resident.id]: true }));
        setTimeout(() => {
            setProfileWavedMap((prev) => {
                const next = { ...prev };
                delete next[resident.id];
                return next;
            });
        }, 8000);

        const myUsername = authUser?.username || "Guest";
        const myDisplayName = authUser?.nickname || authUser?.discord_name || (authUser?.username ? `@${authUser.username}` : "Island Resident");

        broadcastResidentWave({
            fromUsername: myUsername,
            fromDisplayName: myDisplayName,
            fromAvatarUrl: authUser?.avatar,
            toUsername: resident.username,
            toDisplayName: resident.displayName,
        });

        setProfileWaveNote(`You waved at ${resident.displayName}! 👋`);

        setTimeout(() => {
            playWaveBackChime();
            setProfileWaveNote(`✨ ${resident.displayName} smiled and warmly waved back!`);
            setTimeout(() => setProfileWaveNote(null), 4500);
        }, 1300);
    };

    const liveOccupancy = useMemo(() => calculateIslandOccupancy(allIslands), [allIslands]);
    const onlineResidents = useMemo(() => getOnlineResidentsList(authUser, "/profile"), [authUser]);

    const filteredOnlineResidents = useMemo(() => {
        return onlineResidents.filter((r) => {
            if (communityFilter === "on_island" && r.status !== "on_island") return false;
            if (communityFilter === "ordering" && r.status !== "ordering") return false;
            if (communityFilter === "passport" && !r.hasPublicPassport) return false;
            if (communitySearchQuery.trim()) {
                const q = communitySearchQuery.toLowerCase().trim();
                return (
                    r.displayName.toLowerCase().includes(q) ||
                    r.username.toLowerCase().includes(q) ||
                    (r.ign && r.ign.toLowerCase().includes(q)) ||
                    (r.islandName && r.islandName.toLowerCase().includes(q)) ||
                    r.currentActivity.toLowerCase().includes(q)
                );
            }
            return true;
        });
    }, [onlineResidents, communityFilter, communitySearchQuery]);

    // Load catalog if user is viewing orders, history, or passport studio (for villagers & sprites)
    const shouldLoadCatalog = activeTab === "orders" || activeTab === "history" || activeTab === "profile";
    const { data: catalogData } = useCatalogData({ enabled: shouldLoadCatalog });

    // Public Passport Customizer State
    const [passportData, setPassportData] = useState<PublicPassportData>(() => getStoredPassport(authUser?.username || ''));
    const [savingPassport, setSavingPassport] = useState(false);
    const [villagerSearchQuery, setVillagerSearchQuery] = useState('');
    const [passportLinkCopied, setPassportLinkCopied] = useState(false);
    const [studioViewMode, setStudioViewMode] = useState<"split" | "card" | "editor">("split");
    const [studioSection, setStudioSection] = useState<"identity" | "vibe" | "motto" | "besties" | "privacy">("identity");
    const [passportDirty, setPassportDirty] = useState(false);

    // Orders History & Reorder State
    const [orders, setOrders] = useState<OrderHistoryItem[]>([]);
    const [ordersLoading, setOrdersLoading] = useState(false);
    const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);

    const loadOrders = useCallback(async () => {
        setOrdersLoading(true);
        const token = getAuthToken();
        const res = await fetchUserOrderHistory(token);
        if (res.success && res.orders) {
            setOrders(res.orders);
        }
        setOrdersLoading(false);
    }, []);

    useEffect(() => {
        loadOrders();
    }, [loadOrders, authUser?.user_id]);

    const parsedOrdersMap = useMemo(() => {
        const map = new Map<string, ReturnType<typeof parseItemCodes>>();
        const catalog = catalogData?.all || [];
        for (const order of orders) {
            map.set(order.id, parseItemCodes(order.command, catalog));
        }
        return map;
    }, [orders, catalogData?.all]);

    const handleReorder = (order: OrderHistoryItem, targetRoute: "/order" | "/command-builder" = "/order") => {
        const bundle = parseItemCodes(order.command, catalogData?.all || []);
        if (bundle.items.length > 0) {
            const mappedEntries = bundle.items.map((item) => ({
                item: {
                    id: item.itemId,
                    name: item.name,
                    category: item.category || "General",
                    image: item.image,
                    baseId: item.itemId,
                    variantId: item.variantId ?? null,
                    variantLabel: item.variantLabel ?? null,
                },
                quantity: item.quantity,
            }));
            setUserScopedItem("command_builder_order_items", JSON.stringify(mappedEntries), authUser?.user_id);
            playChimeClick();
            setPrefNotice(`Loaded ${bundle.items.length} item types (${bundle.totalSlots} slots) from order #${order.id}! Opening...`);
            setTimeout(() => setPrefNotice(null), 4000);
            navigate(targetRoute);
        } else {
            playChimeClick();
            navigate(targetRoute);
        }
    };

    const handleCopyOrderCommand = (order: OrderHistoryItem) => {
        const cmd = order.command.startsWith("!") ? order.command : `!order ${order.command}`;
        navigator.clipboard.writeText(cmd).catch(() => {});
        setCopiedOrderId(order.id);
        playChimeClick();
        setTimeout(() => setCopiedOrderId(null), 2500);
    };


    const subscriptionRoleNames = useMemo(() => {
        const subscriptions = profile?.subscriptions;
        const preferredNames = uniqueValues([
            ...asArray(subscriptions?.matched_subscription_role_names),
            ...roleNamesFrom(subscriptions?.matched_subscription_roles),
        ]);
        if (preferredNames.length > 0) return preferredNames;

        const roleNames = uniqueValues([
            ...asArray(subscriptions?.role_names),
            ...roleNamesFrom(subscriptions?.roles),
        ]);
        if (roleNames.length > 0) return roleNames;

        return uniqueValues([
            ...asArray(subscriptions?.role_ids),
            ...asArray(subscriptions?.matched_subscription_role_ids),
            ...asArray(subscriptions?.subscription_role_ids),
        ]);
    }, [profile]);

    const rawDiscordName =
        profile?.user.nickname ||
        profile?.user.display_name ||
        profile?.user.global_name ||
        authUser?.username ||
        "";

    // Multi-slot saved characters (auto-synced from Discord nickname e.g. "bitress/cheurnice | bitress")
    const {
        characters,
        activeCharacter,
        maxSlots,
        isSyncingDb,
        addCharacter,
        updateCharacter,
        deleteCharacter,
        setDefaultCharacter,
        syncFromDiscordNickname,
    } = useSavedCharacters(rawDiscordName);

    // Sync and hydrate Public Passport state from ChoBot database & local storage
    useEffect(() => {
        const username = profile?.user?.discord_name || authUser?.username || '';
        const userAvatar = profile?.user?.avatar || authUser?.avatar || '';
        if (username) {
            const token = getAuthToken();
            fetchPublicPassportFromDb(username, token).then((dbPassport) => {
                const base = dbPassport || getStoredPassport(username);
                setPassportData({
                    ...base,
                    username,
                    avatarUrl: userAvatar || base.avatarUrl || '',
                    primaryIgn: activeCharacter.ign || base.primaryIgn || '',
                    primaryIsland: activeCharacter.islandName || base.primaryIsland || '',
                });
            }).catch(() => {
                const stored = getStoredPassport(username);
                setPassportData({
                    ...stored,
                    username,
                    avatarUrl: userAvatar || stored.avatarUrl || '',
                    primaryIgn: activeCharacter.ign || stored.primaryIgn || '',
                    primaryIsland: activeCharacter.islandName || stored.primaryIsland || '',
                });
            });
        }
    }, [profile?.user?.discord_name, profile?.user?.avatar, authUser?.username, authUser?.avatar, activeCharacter.ign, activeCharacter.islandName]);

    // Saved in-game character creation / editing state
    const [characterModalOpen, setCharacterModalOpen] = useState(false);
    const [syncDiscordModalOpen, setSyncDiscordModalOpen] = useState(false);
    const [editingCharId, setEditingCharId] = useState<string | null>(null);
    const [charIgn, setCharIgn] = useState("");
    const [charIsland, setCharIsland] = useState("");
    const [charIcon, setCharIcon] = useState("fa-leaf");
    const [charError, setCharError] = useState("");
    const [syncToDiscordNick, setSyncToDiscordNick] = useState(true);
    const [targetDiscordNick, setTargetDiscordNick] = useState("");
    const [customizedNick, setCustomizedNick] = useState(false);
    const [isSavingChar, setIsSavingChar] = useState(false);

    // Automatically update target Discord nickname preview as user types IGN and Island
    useEffect(() => {
        if (!customizedNick) {
            const ign = charIgn.trim();
            const isl = charIsland.trim();
            if (ign && isl) {
                const candidateChar = { ign, islandName: isl };
                const candidateList = editingCharId
                    ? characters.map((c) => (c.id === editingCharId ? { ...candidateChar, isDefault: c.isDefault } : c))
                    : [...characters, { ...candidateChar, isDefault: characters.length === 0 }];
                const formatted = formatCharactersToNickname(candidateList);
                setTargetDiscordNick(formatted || `${ign} | ${isl}`.slice(0, 32));
            } else if (ign) {
                setTargetDiscordNick(ign.slice(0, 32));
            } else {
                setTargetDiscordNick("");
            }
        }
    }, [charIgn, charIsland, customizedNick, editingCharId, characters]);

    const handleOpenAddCharacter = () => {
        setEditingCharId(null);
        setCharIgn("");
        setCharIsland("");
        setCharIcon("fa-leaf");
        setCharError("");
        setSyncToDiscordNick(true);
        setTargetDiscordNick(formatCharactersToNickname(characters));
        setCustomizedNick(false);
        setCharacterModalOpen(true);
        playChimeClick();
    };

    const handleOpenEditCharacter = (char: SavedCharacter) => {
        setEditingCharId(char.id);
        setCharIgn(char.ign);
        setCharIsland(char.islandName);
        setCharIcon(char.icon || "fa-leaf");
        setCharError("");
        setSyncToDiscordNick(true);
        setTargetDiscordNick(formatCharactersToNickname(characters));
        setCustomizedNick(false);
        setCharacterModalOpen(true);
        playChimeClick();
    };

    const handleSaveCharacterModal = async (e: React.FormEvent) => {
        e.preventDefault();
        const cleanIgn = charIgn.trim();
        const cleanIsland = charIsland.trim();
        if (!cleanIgn) {
            setCharError("In-Game Name (IGN) is required.");
            return;
        }
        if (!cleanIsland) {
            setCharError("Island Name is required.");
            return;
        }

        setIsSavingChar(true);
        setCharError("");

        try {
            if (editingCharId) {
                updateCharacter(editingCharId, {
                    ign: cleanIgn,
                    islandName: cleanIsland,
                    icon: charIcon,
                });
                playChimeClick();
            } else {
                const ok = addCharacter(cleanIgn, cleanIsland, charIcon);
                if (!ok) {
                    setCharError(`Maximum ${maxSlots} character slots reached.`);
                    setIsSavingChar(false);
                    return;
                }
                playChimeClick();
            }

            // Sync to Discord Server Nickname if requested
            let discordMsg = "";
            if (syncToDiscordNick) {
                const candidateChar = { ign: cleanIgn, islandName: cleanIsland, icon: charIcon };
                const candidateList = editingCharId
                    ? characters.map((c) => (c.id === editingCharId ? { ...candidateChar, isDefault: c.isDefault } : c))
                    : [...characters, { ...candidateChar, isDefault: characters.length === 0 }];
                const multiNick = formatCharactersToNickname(candidateList);
                const finalNick = (targetDiscordNick.trim() || multiNick || `${cleanIgn} | ${cleanIsland}`).slice(0, 32);
                const token = getAuthToken();
                if (token) {
                    try {
                        const res = await updateDiscordNickname(finalNick, token);
                        if (res.success) {
                            const updated = res.nickname || finalNick;
                            setUserScopedItem('chopaeng_discord_nickname', updated, authUser?.user_id);
                            window.dispatchEvent(
                                new CustomEvent('chopaeng_nickname_updated', {
                                    detail: { nickname: updated },
                                })
                            );
                            if (profile) {
                                setProfile((prev) =>
                                    prev
                                        ? {
                                              ...prev,
                                              user: { ...prev.user, nickname: updated },
                                          }
                                        : null
                                );
                            }
                            discordMsg = ` & Discord nickname updated to "${updated}"`;
                        } else {
                            discordMsg = ` (Discord nickname notice: ${res.message || 'update skipped'})`;
                        }
                    } catch {
                        // Background discord sync failed gracefully
                    }
                }
            }

            setPrefNotice(
                editingCharId
                    ? `Character "${cleanIgn}" updated${discordMsg}!`
                    : `New character "${cleanIgn}" created${discordMsg}!`
            );

            setTimeout(() => setPrefNotice(null), 4000);
            setCharacterModalOpen(false);
        } finally {
            setIsSavingChar(false);
        }
    };

    const handleSetActiveCharacter = async (char: SavedCharacter) => {
        setDefaultCharacter(char.id);
        playChimeClick();

        // Slot 1 is the active character, followed by other saved slots (Slots 2 & 3)
        const reordered = [
            { ...char, isDefault: true },
            ...characters.filter((c) => c.id !== char.id).map((c) => ({ ...c, isDefault: false })),
        ];
        const newNick = formatCharactersToNickname(reordered) || `${char.ign} | ${char.islandName}`.slice(0, 32);
        const token = getAuthToken();
        let nickUpdated = false;
        if (token) {
            try {
                const res = await updateDiscordNickname(newNick, token);
                if (res.success) {
                    const updated = res.nickname || newNick;
                    setUserScopedItem('chopaeng_discord_nickname', updated, authUser?.user_id);
                    window.dispatchEvent(
                        new CustomEvent('chopaeng_nickname_updated', {
                            detail: { nickname: updated },
                        })
                    );
                    if (profile) {
                        setProfile((prev) =>
                            prev
                                ? {
                                      ...prev,
                                      user: { ...prev.user, nickname: updated },
                                  }
                                : null
                        );
                    }
                    nickUpdated = true;
                }
            } catch {
                // Ignore
            }
        }

        setPrefNotice(
            nickUpdated
                ? `Active character set to "${char.ign}" & Discord nickname synced to "${newNick}"!`
                : `Active character set to "${char.ign}".`
        );
        setTimeout(() => setPrefNotice(null), 3500);
    };

    const handleDeleteCharacter = async (char: SavedCharacter) => {
        if (window.confirm(`Are you sure you want to delete character "${char.ign}"?`)) {
            deleteCharacter(char.id);
            playChimeClick();

            const remaining = characters.filter((c) => c.id !== char.id);
            let nickNotice = '';
            if (remaining.length > 0) {
                const remainingNick = formatCharactersToNickname(remaining);
                const token = getAuthToken();
                if (token && remainingNick) {
                    try {
                        const res = await updateDiscordNickname(remainingNick, token);
                        if (res.success) {
                            const updated = res.nickname || remainingNick;
                            setUserScopedItem('chopaeng_discord_nickname', updated, authUser?.user_id);
                            window.dispatchEvent(
                                new CustomEvent('chopaeng_nickname_updated', {
                                    detail: { nickname: updated },
                                })
                            );
                            if (profile) {
                                setProfile((prev) =>
                                    prev ? { ...prev, user: { ...prev.user, nickname: updated } } : null
                                );
                            }
                            nickNotice = ` & Discord nickname synced to "${updated}"`;
                        }
                    } catch {
                        // ignore
                    }
                }
            }

            setPrefNotice(`Character "${char.ign}" deleted${nickNotice}.`);
            setTimeout(() => setPrefNotice(null), 3500);
        }
    };

    // Discord Server Nickname Modal State
    const [discordNickModalOpen, setDiscordNickModalOpen] = useState(false);
    const [newDiscordNick, setNewDiscordNick] = useState("");
    const [updatingNick, setUpdatingNick] = useState(false);
    const [nickModalMessage, setNickModalMessage] = useState<{ type: "success" | "danger"; text: string } | null>(null);

    const handleOpenDiscordNickModal = (initialVal?: string) => {
        setNickModalMessage(null);
        if (initialVal !== undefined) {
            setNewDiscordNick(initialVal.slice(0, 32));
        } else if (characters.length > 0) {
            const multiNick = formatCharactersToNickname(characters);
            setNewDiscordNick(multiNick || (profile?.user?.nickname || rawDiscordName || "").slice(0, 32));
        } else {
            setNewDiscordNick((profile?.user?.nickname || rawDiscordName || "").slice(0, 32));
        }
        setDiscordNickModalOpen(true);
        playChimeClick();
    };

    const handleSaveDiscordNick = async (e: React.FormEvent) => {
        e.preventDefault();
        const clean = newDiscordNick.trim();
        if (!clean) return;
        setUpdatingNick(true);
        setNickModalMessage(null);
        playChimeClick();

        const token = getAuthToken();
        const res = await updateDiscordNickname(clean, token);
        setUpdatingNick(false);

        if (res.success) {
            const updated = res.nickname || clean;
            setNickModalMessage({ type: "success", text: res.message || "Nickname updated on Discord!" });
            if (profile) {
                setProfile({
                    ...profile,
                    user: {
                        ...profile.user,
                        nickname: updated,
                    },
                });
            }
            setPrefNotice(`Discord server nickname updated to "${updated}"!`);
            setTimeout(() => {
                setDiscordNickModalOpen(false);
                setNickModalMessage(null);
            }, 1800);
        } else {
            setNickModalMessage({ type: "danger", text: res.message || "Failed to update Discord nickname." });
        }
    };

    useEffect(() => {
        document.title = "Resident Passport & Dashboard • Chopaeng";
    }, []);

    useEffect(() => {
        if (authLoading) return;

        const token = getAuthToken();
        if (!token) {
            setLoading(false);
            return;
        }

        const controller = new AbortController();
        setLoading(true);
        setError("");

        fetch(`${DODO_API_BASE}/api/profile`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
        })
            .then(async (resp) => {
                if (!resp.ok) {
                    const body = await resp.json().catch(() => ({}));
                    throw new Error(body.error || "Unable to load your profile.");
                }
                return resp.json() as Promise<ProfileResponse>;
            })
            .then((data) => {
                setProfile(data);
                if (Array.isArray(data.favorite_islands) && data.favorite_islands.length > 0) {
                    const local = getStoredFavoriteIslands();
                    const merged = Array.from(
                        new Set([...local, ...data.favorite_islands.map((id) => id.trim().toLowerCase())])
                    );
                    saveStoredFavoriteIslands(merged);
                }
            })
            .catch((err: unknown) => {
                if (err instanceof DOMException && err.name === "AbortError") return;
                const message = err instanceof Error ? err.message : "Unable to load your profile.";
                setError(message);
            })
            .finally(() => {
                setLoading(false);
            });

        return () => {
            controller.abort();
        };
    }, [authLoading, authUser?.user_id]);

    const accessibleIslands = asArray(
        profile?.subscriptions.accessible_member_islands ?? profile?.subscriptions.accessible_islands
    );
    const mostVisited = asArray(profile?.visits.most_visited_islands);
    const recentVisits = asArray(profile?.visits.recent_visits);
    const warningSummary = profile?.visits.warning_summary;
    const profileUser = profile?.user;
    const displayName = profileUser?.display_name || authUser?.username || "Resident Member";

    // Matching Favorite Islands with live Island data
    const favoritedIslandObjects = useMemo(() => {
        if (favoriteIslands.length === 0) return [];
        return allIslands.filter((isl) =>
            favoriteIslands.some(
                (fav) =>
                    fav.trim().toLowerCase() === isl.name.trim().toLowerCase() ||
                    fav.trim().toLowerCase() === isl.id.trim().toLowerCase()
            )
        );
    }, [allIslands, favoriteIslands]);

    // Compute total unlocked islands based on public tier + subscription/role matches
    const userUnlockedIslands = useMemo(() => {
        return allIslands.filter((island) => {
            const isFree = island.cat === "public" && (island.requiredRoles?.length ?? 0) === 0;
            if (isFree) return true;
            if (island.accessible || island.viewerHasAccess) return true;
            if (island.requiredRoles && island.requiredRoles.length > 0 && canAccessIsland(island.requiredRoles)) {
                return true;
            }
            return accessibleIslands.some(
                (acc) =>
                    (acc.id && acc.id.toLowerCase() === island.id.toLowerCase()) ||
                    (acc.name && acc.name.toLowerCase() === island.name.toLowerCase())
            );
        });
    }, [allIslands, accessibleIslands, canAccessIsland]);

    const lockedIslands = useMemo(() => {
        return allIslands.filter(
            (island) => !userUnlockedIslands.some((u) => u.id === island.id)
        );
    }, [allIslands, userUnlockedIslands]);

    const filteredAccessIslands = useMemo(() => {
        if (accessFilter === "all") return userUnlockedIslands;
        return userUnlockedIslands.filter((island) => island.cat === accessFilter);
    }, [userUnlockedIslands, accessFilter]);

    if (authLoading || loading) {
        return (
            <div className="nook-bg min-vh-100 d-flex align-items-center justify-content-center p-4">
                <div className="text-center bg-white rounded-4 shadow-sm border p-5">
                    <div className="spinner-border text-success mb-3" role="status" />
                    <p className="fw-bold text-muted mb-0">Loading Resident Passport...</p>
                </div>
            </div>
        );
    }

    if (!authUser && !profile) {
        return (
            <div className="nook-bg min-vh-100 py-5 px-3">
                <div className="container" style={{ maxWidth: 680 }}>
                    <div className="bg-white rounded-4 shadow-sm border p-4 p-md-5 text-center mb-4">
                        <div
                            className="d-inline-flex align-items-center justify-content-center rounded-circle text-white mb-4"
                            style={{ width: 76, height: 76, backgroundColor: "#5865F2" }}
                        >
                            <i className="fa-brands fa-discord fa-2x"></i>
                        </div>
                        <h1 className="ac-font h2 text-dark mb-3">Resident Passport & Profile</h1>
                        <p className="text-muted fw-bold mb-4">
                            Login with Discord to view your verified Island Passport, track your Order Bot & Drop orders, manage multi-character slots, and check accessible treasure islands.
                        </p>
                        <button type="button" onClick={login} className="btn btn-success rounded-pill fw-black px-4 py-3 shadow-sm">
                            <i className="fa-solid fa-right-to-bracket me-2"></i>
                            Login with Discord
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="nook-bg min-vh-100 d-flex align-items-center justify-content-center p-4">
                <div className="bg-white rounded-4 shadow-sm border p-4 p-md-5 text-center" style={{ maxWidth: 520 }}>
                    <i className="fa-solid fa-triangle-exclamation text-warning display-4 mb-3"></i>
                    <h1 className="ac-font h3 text-dark mb-3">Profile unavailable</h1>
                    <p className="text-muted fw-bold mb-4">{error}</p>
                    <button type="button" onClick={login} className="btn btn-success rounded-pill fw-black px-4 py-3">
                        Refresh Discord Login
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="profile-page-wrapper font-nunito pb-5">
            {/* ── 1. PASSPORT HERO HEADER ────────────────────────────────────────── */}
            <div className="bg-white border-bottom shadow-xs">
                <div className="container py-4 py-lg-5">
                    {/* Animal Crossing Passport Card Container */}
                    <div className="pf-hero-card p-4 p-md-5 mb-4">
                        {/* Passport Watermark Stamp */}
                        <div
                            className="pf-passport-watermark"
                            aria-hidden="true"
                        >
                            <i className="fa-solid fa-passport fs-4 mb-1"></i>
                            <span className="tiny-text fw-black text-uppercase font-monospace">Verified</span>
                        </div>

                        <div className="row align-items-center gy-4">
                            {/* Left Zone: Passport Identity */}
                            <div className="col-lg-7 d-flex flex-column flex-sm-row align-items-center align-items-sm-start gap-4 text-center text-sm-start">
                                <div className="position-relative">
                                    <div className="pf-avatar-frame">
                                        {profileUser?.avatar ? (
                                            <img
                                                src={profileUser.avatar}
                                                alt={`${displayName}'s avatar`}
                                                className="pf-avatar-img"
                                            />
                                        ) : (
                                            <div className="w-100 h-100 d-flex align-items-center justify-content-center bg-success bg-opacity-10 text-success">
                                                <i className="fa-solid fa-user-astronaut fa-3x"></i>
                                            </div>
                                        )}
                                    </div>
                                    <span
                                        className="position-absolute bottom-0 end-0 p-1 bg-success border border-white rounded-circle shadow-xs"
                                        title="Discord Connected & Verified"
                                        aria-label="Discord Connected & Verified"
                                        style={{ width: "18px", height: "18px" }}
                                    ></span>
                                </div>

                                <div className="flex-grow-1">
                                    <div className="d-flex align-items-center justify-content-center justify-content-sm-start gap-2 mb-1">
                                        <span className="badge bg-success text-white rounded-pill px-3 py-1 tiny-text fw-black text-uppercase letter-spacing-1">
                                            Island Passport
                                        </span>
                                        <span className="tiny-text text-muted font-monospace">
                                            ID: {profileUser?.id || "Resident"}
                                        </span>
                                    </div>

                                    <h1 className="ac-font display-6 text-dark mb-1 fw-black">
                                        {activeCharacter.ign || displayName}
                                    </h1>

                                    <div className="d-flex flex-wrap align-items-center justify-content-center justify-content-sm-start gap-2 text-muted fw-bold small mb-2">
                                        <span>
                                            <i className="fa-solid fa-tree text-success me-1"></i>
                                            Island: <strong className="text-dark">{activeCharacter.islandName || "Island"}</strong>
                                        </span>
                                    </div>

                                    {/* Unified Role Badges & Member Since */}
                                    <div className="d-flex flex-wrap align-items-center justify-content-center justify-content-sm-start gap-2">
                                        {profileUser?.is_admin && <span className="badge rounded-pill bg-danger px-3 py-1">Admin</span>}
                                        {profileUser?.is_mod && <span className="badge rounded-pill bg-success px-3 py-1">Moderator</span>}
                                        {subscriptionRoleNames.length > 0 ? (
                                            subscriptionRoleNames.map((role) => (
                                                <span key={role} className="badge rounded-pill bg-warning text-dark px-3 py-1 fw-bold">
                                                    <i className="fa-solid fa-crown me-1"></i>
                                                    {role}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="badge rounded-pill bg-light text-muted border px-3 py-1 fw-bold">
                                                Free Member
                                            </span>
                                        )}
                                        <span className="badge rounded-pill bg-white text-muted border px-3 py-1 shadow-2xs font-monospace small">
                                            <i className="fa-solid fa-calendar-check text-primary me-1"></i>
                                            Joined {formatDate(profileUser?.joined_at ?? profileUser?.joined_timestamp)}
                                        </span>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                playChimeClick();
                                                setActiveTab("community");
                                            }}
                                            className="badge rounded-pill bg-white text-dark border px-3 py-1.5 shadow-2xs small fw-bold d-inline-flex align-items-center gap-2 text-decoration-none transition-all"
                                            style={{ cursor: 'pointer' }}
                                            title="View Live Island Radar, Online Residents & Traffic"
                                        >
                                            <span style={{ width: 8, height: 8, backgroundColor: '#22c55e', borderRadius: '50%', boxShadow: '0 0 6px #22c55e' }} />
                                            <span><strong>{liveOccupancy.totalVisitors}</strong> in Islands · <strong>{trafficStats.activeOnlineCount}</strong> Online · <strong>2.8M</strong> Visits</span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Right Zone: Key Stats Ribbon */}
                            <div className="col-lg-5">
                                <div className="pf-stats-ribbon">
                                    <div className="pf-stat-item">
                                        <div className="pf-stat-value">{formatNumber(orders.length)}</div>
                                        <div className="pf-stat-label">Orders</div>
                                    </div>
                                    <div className="pf-stat-item">
                                        <div className="pf-stat-value">0</div>
                                        <div className="pf-stat-label">Drops</div>
                                    </div>
                                    <div className="pf-stat-item">
                                        <div className="pf-stat-value">{formatNumber(profile?.visits.total)}</div>
                                        <div className="pf-stat-label">Visits</div>
                                    </div>
                                    <div className="pf-stat-item">
                                        <div className="pf-stat-value">{formatNumber(userUnlockedIslands.length)}</div>
                                        <div className="pf-stat-label">Unlocked</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Modern Tab Navigation with Attached Counts */}
                    <div className="pf-tab-scroller" role="tablist" aria-label="Profile navigation tabs">
                        <button
                            type="button"
                            role="tab"
                            aria-selected={activeTab === "profile"}
                            className={`pf-tab-btn ${activeTab === "profile" ? "active" : ""}`}
                            onClick={() => setActiveTab("profile")}
                        >
                            <i className="fa-solid fa-user"></i>
                            <span>Profile</span>
                            <span className="pf-tab-count">{characters.length}/3</span>
                        </button>

                        <button
                            type="button"
                            role="tab"
                            aria-selected={activeTab === "access"}
                            className={`pf-tab-btn ${activeTab === "access" ? "active" : ""}`}
                            onClick={() => setActiveTab("access")}
                        >
                            <i className="fa-solid fa-key"></i>
                            <span>Your Access &amp; Islands</span>
                            <span className="pf-tab-count">{userUnlockedIslands.length}</span>
                        </button>

                        <button
                            type="button"
                            role="tab"
                            aria-selected={activeTab === "favorites"}
                            className={`pf-tab-btn ${activeTab === "favorites" ? "active" : ""}`}
                            onClick={() => setActiveTab("favorites")}
                        >
                            <i className="fa-solid fa-star text-warning"></i>
                            <span>Favorite Islands</span>
                            <span className="pf-tab-count">{favoriteIslands.length}</span>
                        </button>

                        <button
                            type="button"
                            role="tab"
                            aria-selected={activeTab === "orders"}
                            className={`pf-tab-btn ${activeTab === "orders" ? "active" : ""}`}
                            onClick={() => setActiveTab("orders")}
                        >
                            <i className="fa-solid fa-box-open"></i>
                            <span>Order History</span>
                            {orders.length > 0 && <span className="pf-tab-count">{orders.length}</span>}
                        </button>

                        <button
                            type="button"
                            role="tab"
                            aria-selected={activeTab === "history"}
                            className={`pf-tab-btn ${activeTab === "history" ? "active" : ""}`}
                            onClick={() => setActiveTab("history")}
                        >
                            <i className="fa-solid fa-clock-rotate-left"></i>
                            <span>Flight History &amp; Logs</span>
                        </button>

                        <button
                            type="button"
                            role="tab"
                            aria-selected={activeTab === "community"}
                            className={`pf-tab-btn ${activeTab === "community" ? "active" : ""}`}
                            onClick={() => {
                                playChimeClick();
                                setActiveTab("community");
                            }}
                        >
                            <i className="fa-solid fa-satellite-dish text-success"></i>
                            <span>Island Radar &amp; Traffic</span>
                            <span className="badge bg-success text-white rounded-pill px-2 py-0.5" style={{ fontSize: '0.62rem' }}>
                                LIVE
                            </span>
                        </button>
                    </div>
                </div>
            </div>

            {/* ── 2. TAB CONTENT ─────────────────────────────────────────────────── */}
            <div className="container py-4">
                {/* ── REUSABLE HOW IT WORKS EXPLAINER ── */}
                <HowItWorksExplainer {...PROFILE_EXPLAINER_CONFIG} className="mb-4" defaultExpanded={false} />

                {/* ── TAB 1: PROFILE & PUBLIC PASSPORT HUB ──────────────── */}
                {activeTab === "profile" && (
                    <div className="row g-4 animate-fade" role="tabpanel" aria-label="Profile Hub">
                        <div className="col-lg-8">
                            <div className="pf-card h-100">
                                <div className="pf-section-header flex-column flex-sm-row align-items-start align-items-sm-center">
                                    <div>
                                        <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                                            <h2 className="h5 ac-font text-dark mb-0">Saved In-Game Characters</h2>
                                            <span className="badge bg-success bg-opacity-10 text-success rounded-pill x-small fw-black">
                                                {characters.length} / 3 Slots
                                            </span>
                                            <span className="badge bg-light text-success border border-success-subtle rounded-pill x-small fw-bold d-inline-flex align-items-center gap-1">
                                                <i className={isSyncingDb ? "fa-solid fa-spinner fa-spin text-primary" : "fa-solid fa-cloud-arrow-up text-success"}></i>
                                                <span>{isSyncingDb ? "Syncing to Database..." : "Auto-Saved to Database"}</span>
                                            </span>
                                            <span className="badge bg-primary bg-opacity-10 text-primary border border-primary-subtle rounded-pill x-small fw-bold d-inline-flex align-items-center gap-1">
                                                <i className="fa-brands fa-discord"></i>
                                                <span>Syncs Slots 1, 2 &amp; 3 (| and /)</span>
                                            </span>
                                        </div>
                                        <p className="tiny-text text-muted mb-0">
                                            Active character auto-fills your IGN &amp; Island Name in orders. Adding, editing, or setting active automatically syncs Slots 1, 2, and 3 to your ChoPaeng Discord server nickname using | and /.
                                        </p>
                                    </div>

                                    {/* Action buttons */}
                                    <div className="d-flex align-items-center gap-2 flex-wrap">
                                        {rawDiscordName && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSyncDiscordModalOpen(true);
                                                    playChimeClick();
                                                }}
                                                className="btn btn-sm btn-outline-secondary rounded-pill fw-bold px-3 d-flex align-items-center gap-1 shadow-2xs"
                                                title={`Parse IGN & Island from Discord: "${rawDiscordName}"`}
                                            >
                                                <i className="fa-brands fa-discord text-primary"></i>
                                                <span>Sync from Discord</span>
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                handleOpenDiscordNickModal();
                                            }}
                                            className="btn btn-sm btn-outline-primary rounded-pill fw-bold px-3 d-flex align-items-center gap-1 shadow-2xs"
                                            title="Update your server nickname on the ChoPaeng Discord server"
                                        >
                                            <i className="fa-solid fa-pen-to-square"></i>
                                            <span>Update Discord Nick</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Warning Callout on Discord Sync */}
                                {rawDiscordName && (
                                    <div className="discord-sync-warning-banner animate-fade">
                                        <i className="fa-solid fa-triangle-exclamation warning-icon"></i>
                                        <div>
                                            <strong className="warning-title">Warning: "Sync from Discord" will replace saved characters</strong>
                                            <span className="warning-text">
                                                Clicking <strong>Sync from Discord</strong> parses your server nickname (<code>{rawDiscordName}</code>) and will <strong>overwrite and replace</strong> your existing in-game character slots. To avoid losing custom character slots, use <strong>+ Add / Edit</strong> manually instead.
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* 3 Fixed Character Slots Grid */}
                                <div className="row g-3">
                                    {[0, 1, 2].map((slotIdx) => {
                                        const char = characters[slotIdx];
                                        const isSelected = char?.isDefault;

                                        if (char) {
                                            return (
                                                <div key={char.id} className="col-12 col-md-6 col-lg-4">
                                                    <div className={`pf-char-card ${isSelected ? "primary" : ""} h-100 d-flex flex-column`}>
                                                        <div className="d-flex align-items-start justify-content-between mb-2 gap-2">
                                                            <div className="d-flex align-items-center gap-2 overflow-hidden">
                                                                <div className="pf-char-icon-circle">
                                                                    <i className={`fa-solid ${char.icon || "fa-leaf"}`}></i>
                                                                </div>
                                                                <div className="text-truncate">
                                                                    <div className="fw-black text-truncate" style={{ fontSize: "1rem" }}>
                                                                        {char.ign}
                                                                    </div>
                                                                    <div className="tiny-text text-muted fw-bold text-truncate">
                                                                        {slotIdx === 0 ? "Main Character" : `Slot #${slotIdx + 1}`}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {isSelected ? (
                                                                <span className="badge bg-success bg-opacity-20 text-success border border-success border-opacity-40 rounded-pill x-small fw-black text-nowrap d-inline-flex align-items-center gap-1">
                                                                    <i className="fa-solid fa-circle-check"></i>
                                                                    <span>Active</span>
                                                                </span>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-xs btn-light rounded-pill border fw-bold tiny-text text-nowrap"
                                                                    onClick={() => handleSetActiveCharacter(char)}
                                                                    aria-label={`Set ${char.ign} as active character`}
                                                                >
                                                                    Set Active
                                                                </button>
                                                            )}
                                                        </div>

                                                        <div className="pf-char-island-box">
                                                            <div className="d-flex align-items-center justify-content-between tiny-text">
                                                                <span className="text-muted fw-bold">Island Name:</span>
                                                                <span className="fw-black d-flex align-items-center gap-1">
                                                                    <i className="fa-solid fa-tree text-success"></i>
                                                                    <span>{char.islandName}</span>
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <div className="d-flex align-items-center justify-content-between pt-2 border-top mt-auto">
                                                            <span className="tiny-text text-success font-monospace d-flex align-items-center gap-1 fw-bold">
                                                                <i className="fa-solid fa-cloud-check"></i>
                                                                <span>Synced</span>
                                                            </span>

                                                            <div className="d-flex align-items-center gap-1">
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-xs btn-outline-secondary rounded-pill fw-bold px-2 py-1 tiny-text d-flex align-items-center gap-1"
                                                                    onClick={() => handleOpenEditCharacter(char)}
                                                                    title="Edit character details"
                                                                    aria-label={`Edit ${char.ign}`}
                                                                >
                                                                    <i className="fa-solid fa-pen"></i>
                                                                    <span>Edit</span>
                                                                </button>
                                                                {characters.length > 1 && (
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-xs btn-outline-danger rounded-pill fw-bold px-2 py-1 tiny-text d-flex align-items-center gap-1"
                                                                        onClick={() => handleDeleteCharacter(char)}
                                                                        title="Delete character"
                                                                        aria-label={`Delete ${char.ign}`}
                                                                    >
                                                                        <i className="fa-solid fa-trash"></i>
                                                                    </button>
                                                                )}
                                                                {!isSelected && (
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-xs btn-outline-success rounded-pill fw-bold px-2 py-1 tiny-text"
                                                                        onClick={() => handleSetActiveCharacter(char)}
                                                                        aria-label={`Set ${char.ign} as primary`}
                                                                    >
                                                                        Set Primary
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        // Empty Slot Card
                                        const slotTitle = slotIdx === 0 ? "Slot 1 (Main Character)" : slotIdx === 1 ? "Slot 2 (Secondary)" : "Slot 3 (Extra Slot)";
                                        return (
                                            <div key={`empty_slot_${slotIdx}`} className="col-12 col-md-6 col-lg-4">
                                                <div
                                                    className="pf-char-card pf-empty-slot-card d-flex flex-column align-items-center justify-content-center text-center p-4 h-100"
                                                    onClick={handleOpenAddCharacter}
                                                    role="button"
                                                    tabIndex={0}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter" || e.key === " ") {
                                                            handleOpenAddCharacter();
                                                        }
                                                    }}
                                                >
                                                    <div className="pf-empty-slot-icon mb-2">
                                                        <i className="fa-solid fa-plus"></i>
                                                    </div>
                                                    <div className="fw-black mb-1" style={{ fontSize: "0.95rem" }}>
                                                        {slotTitle}
                                                    </div>
                                                    <p className="tiny-text text-muted mb-3">
                                                        Empty slot • Click to configure
                                                    </p>
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-nook rounded-pill px-3 py-1 fw-bold tiny-text d-flex align-items-center gap-1 shadow-2xs mt-auto"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleOpenAddCharacter();
                                                        }}
                                                    >
                                                        <i className="fa-solid fa-plus"></i>
                                                        <span>Add Character</span>
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Account & Passport Sidebar Column */}
                        <div className="col-lg-4 d-flex flex-column gap-4">
                            {/* 1. Public Profile Link & Quick Share Card */}
                            <div className="pf-card">
                                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
                                    <span className={`badge rounded-pill px-3 py-1 fw-bold ${passportData.isPublic ? "bg-success text-white" : "bg-secondary text-white"}`}>
                                        <i className={`fa-solid ${passportData.isPublic ? "fa-globe" : "fa-lock"} me-1`}></i>
                                        {passportData.isPublic ? "Public Profile Active" : "Private Profile"}
                                    </span>
                                    <Link
                                        to={`/u/${encodeURIComponent(passportData.username || profileUser?.discord_name || authUser?.username || "resident")}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn btn-xs btn-outline-success rounded-pill fw-bold px-2 py-1 d-inline-flex align-items-center gap-1 shadow-2xs"
                                    >
                                        <span>View</span>
                                        <i className="fa-solid fa-arrow-up-right-from-square"></i>
                                    </Link>
                                </div>

                                <div className="bg-light rounded-3 p-3 border mb-0">
                                    <span className="tiny-text fw-bold text-muted text-uppercase d-block mb-1">Your Public Link:</span>
                                    <strong className="text-dark font-monospace small text-truncate d-block mb-2">
                                        {window.location.origin}/u/{passportData.username || profileUser?.discord_name || authUser?.username || "resident"}
                                    </strong>
                                    <button
                                        type="button"
                                        className={`btn btn-xs w-100 rounded-pill fw-bold py-1 shadow-2xs d-inline-flex align-items-center justify-content-center gap-1 ${
                                            passportLinkCopied ? "btn-success text-white" : "btn-dark text-white"
                                        }`}
                                        onClick={() => {
                                            const url = `${window.location.origin}/u/${passportData.username || profileUser?.discord_name || authUser?.username || "resident"}`;
                                            navigator.clipboard.writeText(url).catch(() => {});
                                            setPassportLinkCopied(true);
                                            playChimeClick();
                                            setTimeout(() => setPassportLinkCopied(false), 2500);
                                        }}
                                    >
                                        <i className={`fa-solid ${passportLinkCopied ? "fa-check" : "fa-copy"}`}></i>
                                        <span>{passportLinkCopied ? "Link Copied!" : "Copy Link"}</span>
                                    </button>
                                </div>
                            </div>

                            {/* 2. Discord & Account Information Card */}
                            <div className="pf-card">
                                <div className="d-flex align-items-center gap-3 mb-3">
                                    <div className="icon-bubble bg-success bg-opacity-10 text-success">
                                        <i className="fa-solid fa-user-shield"></i>
                                    </div>
                                    <h2 className="h5 ac-font text-dark mb-0">Account Information</h2>
                                </div>

                                {prefNotice && (
                                    <div className="alert alert-success rounded-3 py-2 px-3 small fw-bold mb-3 animate-fade">
                                        <i className="fa-solid fa-circle-check me-2"></i>
                                        {prefNotice}
                                    </div>
                                )}

                                <div className="passport-field mb-3">
                                    <div className="tiny-text text-muted fw-black text-uppercase mb-1">Active Discord Account</div>
                                    <div className="fw-bold text-dark font-monospace small d-flex align-items-center gap-2">
                                        <i className="fa-brands fa-discord text-primary"></i>
                                        <span>{profileUser?.discord_name || authUser?.username}</span>
                                    </div>
                                </div>

                                <div className="passport-field mb-3">
                                    <div className="d-flex align-items-center justify-content-between mb-1">
                                        <span className="tiny-text text-muted fw-black text-uppercase">Discord Server Nickname</span>
                                        <button
                                            type="button"
                                            onClick={() => handleOpenDiscordNickModal()}
                                            className="btn btn-link p-0 tiny-text fw-bold text-primary text-decoration-none d-flex align-items-center gap-1"
                                        >
                                            <i className="fa-solid fa-pen"></i>
                                            <span>Change</span>
                                        </button>
                                    </div>
                                    <div className="fw-bold text-dark font-monospace small d-flex align-items-center justify-content-between p-2 px-3 bg-light rounded-3 border">
                                        <div className="d-flex align-items-center gap-2 text-truncate">
                                            <i className="fa-solid fa-id-card text-muted"></i>
                                            <span className="text-truncate">{profileUser?.nickname || rawDiscordName || "Not Set"}</span>
                                        </div>
                                        <span className="badge bg-primary bg-opacity-10 text-primary rounded-pill x-small fw-bold">
                                            Server Nick
                                        </span>
                                    </div>
                                </div>

                                <div className="passport-field mb-3">
                                    <div className="tiny-text text-muted fw-black text-uppercase mb-1">Discord ID</div>
                                    <div className="tiny-text text-muted font-monospace">{profileUser?.id || authUser?.user_id || "N/A"}</div>
                                </div>

                                <div className="passport-field mb-3">
                                    <div className="tiny-text text-muted fw-black text-uppercase mb-1">Account Standing</div>
                                    <div className="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-3 py-2 fw-bold">
                                        <i className="fa-solid fa-shield-check me-1"></i>Good Standing • Verified
                                    </div>
                                </div>

                                <div className="passport-field mb-0">
                                    <div className="tiny-text text-muted fw-black text-uppercase mb-1">Subscription Roles</div>
                                    <div className="d-flex flex-wrap gap-1 mt-1">
                                        {subscriptionRoleNames.length > 0 ? (
                                            subscriptionRoleNames.map((role) => (
                                                <span key={role} className="badge bg-warning bg-opacity-10 text-dark border border-warning-subtle rounded-pill px-2 py-1 tiny-text fw-bold">
                                                    <i className="fa-solid fa-crown text-warning me-1"></i>{role}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="tiny-text text-muted">Free Community Member</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 2. Authentic Nook Inc. Resident Passport Studio */}
                        <div className="col-12">
                            <div className="pf-card">
                                {/* Studio Command Header */}
                                <div className="studio-hero-bar mb-4 d-flex align-items-center justify-content-between flex-wrap gap-3">
                                    <div className="d-flex align-items-center gap-3">
                                        <div className="icon-bubble bg-success bg-opacity-10 text-success shadow-2xs" style={{ width: 48, height: 48, fontSize: "1.35rem" }}>
                                            <i className="fa-solid fa-passport"></i>
                                        </div>
                                        <div>
                                            <div className="d-flex align-items-center gap-2 flex-wrap">
                                                <h2 className="h5 ac-font mb-0">Nook Inc. Resident Passport Studio</h2>
                                                <span className="badge bg-success bg-opacity-15 text-success border border-success border-opacity-25 rounded-pill x-small fw-bold">
                                                    <i className="fa-solid fa-leaf me-1"></i>Official DAL Studio
                                                </span>
                                            </div>
                                            <p className="tiny-text text-muted mb-0">
                                                Customize your authentic in-game passport, preview updates in real-time, and share your resident card.
                                            </p>
                                        </div>
                                    </div>

                                    {/* View Mode & Quick Actions */}
                                    <div className="d-flex align-items-center gap-2 flex-wrap">
                                        {/* View Mode Switcher */}
                                        <div className="studio-mode-pill-group">
                                            <button
                                                type="button"
                                                className={`studio-mode-pill-btn ${studioViewMode === "split" ? "active" : ""}`}
                                                onClick={() => {
                                                    playChimeClick();
                                                    setStudioViewMode("split");
                                                }}
                                                title="Split Studio: Live Card Preview + Editor"
                                            >
                                                <i className="fa-solid fa-table-columns"></i>
                                                <span className="d-none d-sm-inline">Split Studio</span>
                                            </button>
                                            <button
                                                type="button"
                                                className={`studio-mode-pill-btn ${studioViewMode === "card" ? "active" : ""}`}
                                                onClick={() => {
                                                    playChimeClick();
                                                    setStudioViewMode("card");
                                                }}
                                                title="Full Card Preview"
                                            >
                                                <i className="fa-solid fa-passport"></i>
                                                <span className="d-none d-sm-inline">Live Card</span>
                                            </button>
                                            <button
                                                type="button"
                                                className={`studio-mode-pill-btn ${studioViewMode === "editor" ? "active" : ""}`}
                                                onClick={() => {
                                                    playChimeClick();
                                                    setStudioViewMode("editor");
                                                }}
                                                title="Studio Tools Only"
                                            >
                                                <i className="fa-solid fa-sliders"></i>
                                                <span className="d-none d-sm-inline">Studio Tools</span>
                                            </button>
                                        </div>

                                        {/* Public Badge */}
                                        <span className={`badge rounded-pill px-3 py-2 fw-bold ${passportData.isPublic ? "bg-success text-white" : "bg-secondary text-white"}`}>
                                            <i className={`fa-solid ${passportData.isPublic ? "fa-globe" : "fa-lock"} me-1`}></i>
                                            {passportData.isPublic ? "Public" : "Private"}
                                        </span>

                                        {/* Share Link Button */}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                playChimeClick();
                                                const uname = passportData.username || profileUser?.discord_name || authUser?.username || "resident";
                                                const url = `${window.location.origin}/u/${encodeURIComponent(uname)}`;
                                                navigator.clipboard.writeText(url).then(() => {
                                                    setPassportLinkCopied(true);
                                                    setTimeout(() => setPassportLinkCopied(false), 2500);
                                                }).catch(() => {
                                                    setPassportLinkCopied(true);
                                                    setTimeout(() => setPassportLinkCopied(false), 2500);
                                                });
                                            }}
                                            className={`btn btn-xs rounded-pill fw-bold px-3 py-2 d-inline-flex align-items-center gap-1 shadow-2xs ${
                                                passportLinkCopied ? "btn-success text-white" : "btn-white border text-dark"
                                            }`}
                                            title="Copy Public Passport URL"
                                        >
                                            <i className={`fa-solid ${passportLinkCopied ? "fa-check" : "fa-share-nodes"}`}></i>
                                            <span>{passportLinkCopied ? "Link Copied!" : "Share"}</span>
                                        </button>

                                        {/* View Live Page */}
                                        <Link
                                            to={`/u/${encodeURIComponent(passportData.username || profileUser?.discord_name || authUser?.username || "resident")}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="btn btn-xs btn-outline-success rounded-pill fw-bold px-3 py-2 d-inline-flex align-items-center gap-1 shadow-2xs"
                                            title="Open Public Passport in New Tab"
                                        >
                                            <span>View Live</span>
                                            <i className="fa-solid fa-arrow-up-right-from-square"></i>
                                        </Link>
                                    </div>
                                </div>

                                <form
                                    onSubmit={async (e) => {
                                        e.preventDefault();
                                        setSavingPassport(true);
                                        playChimeClick();
                                        const ok = await savePassportToDb(passportData, getAuthToken());
                                        setSavingPassport(false);
                                        setPassportDirty(false);
                                        setPrefNotice(ok ? "Your Resident Passport has been saved to the ChoBot database!" : "Passport saved locally (server sync pending).");
                                        setTimeout(() => setPrefNotice(null), 3500);
                                    }}
                                >
                                    {/* ── CARD FOCUS VIEW MODE ── */}
                                    {studioViewMode === "card" && (
                                        <div className="py-3 px-1 animate-fade" style={{ maxWidth: 880, margin: "0 auto" }}>
                                            <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
                                                <div className="d-flex align-items-center gap-2">
                                                    <span className="live-sync-pulse">
                                                        <span className="live-sync-dot"></span>
                                                        <span>Full Card Viewport</span>
                                                    </span>
                                                    <span className="tiny-text text-muted">
                                                        Official Dodo Airlines boarding record
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        playChimeClick();
                                                        setStudioViewMode("split");
                                                    }}
                                                    className="btn btn-xs btn-outline-success rounded-pill fw-bold px-3 py-1 d-inline-flex align-items-center gap-1"
                                                >
                                                    <i className="fa-solid fa-pen-to-square"></i>
                                                    <span>Open Split Studio to Edit</span>
                                                </button>
                                            </div>

                                            <ResidentPassportCard
                                                passport={passportData}
                                                allVillagers={catalogData?.villagers || []}
                                                avatarUrl={profileUser?.avatar || authUser?.avatar || passportData.avatarUrl}
                                                interactive={true}
                                                onShareClick={() => {
                                                    playChimeClick();
                                                    const uname = passportData.username || profileUser?.discord_name || authUser?.username || "resident";
                                                    const url = `${window.location.origin}/u/${encodeURIComponent(uname)}`;
                                                    navigator.clipboard.writeText(url);
                                                    setPassportLinkCopied(true);
                                                    setTimeout(() => setPassportLinkCopied(false), 2500);
                                                }}
                                                shareCopied={passportLinkCopied}
                                            />
                                        </div>
                                    )}

                                    {/* ── SPLIT OR EDITOR VIEW MODE ── */}
                                    {studioViewMode !== "card" && (
                                        <div className="row g-4">
                                            {/* LEFT COLUMN: Sticky Live Passport Card Preview (Split Mode Only) */}
                                            {studioViewMode === "split" && (
                                                <div className="col-xl-6 col-12">
                                                    <div className="studio-preview-sticky">
                                                        <div className="d-flex align-items-center justify-content-between mb-2">
                                                            <div className="d-flex align-items-center gap-2">
                                                                <span className="live-sync-pulse">
                                                                    <span className="live-sync-dot"></span>
                                                                    <span>Live Preview</span>
                                                                </span>
                                                                <span className="badge bg-light text-muted border rounded-pill x-small">
                                                                    Updates in real time
                                                                </span>
                                                            </div>
                                                            <span className="tiny-text font-monospace text-muted">
                                                                CP-{(passportData.username || "RESIDENT").toUpperCase().slice(0, 8)}-{passportData.birthDay || "01"}
                                                            </span>
                                                        </div>

                                                        {/* Interactive Live Passport Card Component */}
                                                        <ResidentPassportCard
                                                            passport={passportData}
                                                            allVillagers={catalogData?.villagers || []}
                                                            avatarUrl={profileUser?.avatar || authUser?.avatar || passportData.avatarUrl}
                                                            interactive={true}
                                                            onShareClick={() => {
                                                                playChimeClick();
                                                                const uname = passportData.username || profileUser?.discord_name || authUser?.username || "resident";
                                                                const url = `${window.location.origin}/u/${encodeURIComponent(uname)}`;
                                                                navigator.clipboard.writeText(url);
                                                                setPassportLinkCopied(true);
                                                                setTimeout(() => setPassportLinkCopied(false), 2500);
                                                            }}
                                                            shareCopied={passportLinkCopied}
                                                        />

                                                        {/* Preview Status Strip */}
                                                        <div className="mt-2 p-2 px-3 rounded-3 studio-inner-box d-flex align-items-center justify-content-between flex-wrap gap-2 shadow-2xs">
                                                            <div className="d-flex align-items-center gap-2 tiny-text text-muted">
                                                                <i className="fa-solid fa-circle-check text-success"></i>
                                                                <span>Live sync ready. Select tabs on the right to edit.</span>
                                                            </div>
                                                            <div className="d-flex align-items-center gap-2">
                                                                <span className={`badge rounded-pill x-small fw-bold ${passportData.isPublic ? "bg-success text-white" : "bg-secondary text-white"}`}>
                                                                    <i className={`fa-solid ${passportData.isPublic ? "fa-globe" : "fa-lock"} me-1`}></i>
                                                                    {passportData.isPublic ? "Public Passport" : "Private"}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* RIGHT COLUMN: Categorized Studio Tools & Navigation */}
                                            <div className={studioViewMode === "split" ? "col-xl-6 col-12" : "col-12"}>
                                                {/* Category Navigation Pills */}
                                                <div className="studio-nav-tabs">
                                                    {[
                                                        { id: "identity", label: "Identity & Island", icon: "fa-address-card" },
                                                        { id: "vibe", label: "Vibe & Themes", icon: "fa-palette" },
                                                        { id: "motto", label: "Motto & Bio", icon: "fa-quote-left" },
                                                        { id: "besties", label: `Besties (${passportData.favouriteVillagers.length}/10)`, icon: "fa-paw" },
                                                        { id: "privacy", label: "Privacy & Link", icon: "fa-sliders" },
                                                    ].map((sec) => (
                                                        <button
                                                            key={sec.id}
                                                            type="button"
                                                            className={`studio-nav-btn ${studioSection === sec.id ? "active" : ""}`}
                                                            onClick={() => {
                                                                playChimeClick();
                                                                setStudioSection(sec.id as any);
                                                            }}
                                                        >
                                                            <i className={`fa-solid ${sec.icon}`}></i>
                                                            <span>{sec.label}</span>
                                                        </button>
                                                    ))}
                                                </div>

                                                {/* TAB 1: RESIDENT IDENTITY & ISLAND TRAITS */}
                                                {studioSection === "identity" && (
                                                    <div className="studio-tool-card animate-fade">
                                                        <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
                                                            <h3 className="h6 fw-black mb-0 ac-font d-flex align-items-center gap-2">
                                                                <i className="fa-solid fa-address-card text-success"></i>
                                                                Resident Identity &amp; Island Traits
                                                            </h3>
                                                            <span className="tiny-text text-muted">Core Passport Record</span>
                                                        </div>

                                                        {/* Primary IGN & Island Name (Syncs to Polaroid!) */}
                                                        <div className="row g-2 mb-3">
                                                            <div className="col-sm-6">
                                                                <label className="form-label fw-bold small mb-1">
                                                                    In-Game Name (IGN)
                                                                </label>
                                                                <input
                                                                    type="text"
                                                                    className="form-control rounded-3 border-2"
                                                                    placeholder="e.g. Cho, Tom"
                                                                    value={passportData.primaryIgn || ""}
                                                                    onChange={(e) => {
                                                                        setPassportDirty(true);
                                                                        setPassportData({ ...passportData, primaryIgn: e.target.value });
                                                                    }}
                                                                />
                                                            </div>
                                                            <div className="col-sm-6">
                                                                <label className="form-label fw-bold small mb-1">
                                                                    Island Name
                                                                </label>
                                                                <input
                                                                    type="text"
                                                                    className="form-control rounded-3 border-2"
                                                                    placeholder="e.g. Cho Island, Nooktopia"
                                                                    value={passportData.primaryIsland || ""}
                                                                    onChange={(e) => {
                                                                        setPassportDirty(true);
                                                                        setPassportData({ ...passportData, primaryIsland: e.target.value });
                                                                    }}
                                                                />
                                                            </div>
                                                            <div className="col-12">
                                                                <p className="tiny-text text-muted mb-0">
                                                                    <i className="fa-solid fa-camera-retro me-1 text-success"></i>
                                                                    These traits appear directly on your passport polaroid portrait frame.
                                                                </p>
                                                            </div>
                                                        </div>

                                                        {/* Pronouns */}
                                                        <div className="mb-3">
                                                            <div className="d-flex align-items-center justify-content-between mb-1">
                                                                <label className="form-label fw-bold small mb-0">
                                                                    Pronouns
                                                                </label>
                                                                <div className="d-flex gap-1 flex-wrap">
                                                                    {["she/her", "he/him", "they/them", "she/they"].map((p) => (
                                                                        <button
                                                                            key={p}
                                                                            type="button"
                                                                            className={`btn btn-xs rounded-pill px-2 py-0 border ${passportData.pronouns === p ? "btn-success text-white" : "studio-motto-chip"}`}
                                                                            style={{ fontSize: "0.68rem" }}
                                                                            onClick={() => {
                                                                                playChimeClick();
                                                                                setPassportDirty(true);
                                                                                setPassportData({ ...passportData, pronouns: p });
                                                                            }}
                                                                        >
                                                                            {p}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                            <input
                                                                type="text"
                                                                className="form-control rounded-3 border-2"
                                                                placeholder="e.g. she/her, they/them, he/him"
                                                                value={passportData.pronouns}
                                                                onChange={(e) => {
                                                                    setPassportDirty(true);
                                                                    setPassportData({ ...passportData, pronouns: e.target.value });
                                                                }}
                                                            />
                                                        </div>

                                                        {/* Birthday & Dynamic Zodiac Constellation */}
                                                        <div className="mb-3">
                                                            <div className="d-flex align-items-center justify-content-between mb-1">
                                                                <label className="form-label fw-bold small mb-0">
                                                                    Birthday &amp; Zodiac Sign
                                                                </label>
                                                                <span className="badge bg-warning bg-opacity-15 text-warning border border-warning border-opacity-30 rounded-pill x-small fw-bold">
                                                                    <i className="fa-solid fa-star me-1"></i>
                                                                    {ZODIAC_SIGNS[passportData.birthMonth] || "Island Star"}
                                                                </span>
                                                            </div>
                                                            <div className="row g-2">
                                                                <div className="col-5">
                                                                    <select
                                                                        className="form-select rounded-3 border-2"
                                                                        value={passportData.birthDay}
                                                                        onChange={(e) => {
                                                                            playChimeClick();
                                                                            setPassportDirty(true);
                                                                            setPassportData({ ...passportData, birthDay: e.target.value });
                                                                        }}
                                                                    >
                                                                        {Array.from({ length: 31 }, (_, i) => String(i + 1)).map((d) => (
                                                                            <option key={d} value={d}>
                                                                                Day {d}
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                                <div className="col-7">
                                                                    <select
                                                                        className="form-select rounded-3 border-2"
                                                                        value={passportData.birthMonth}
                                                                        onChange={(e) => {
                                                                            playChimeClick();
                                                                            setPassportDirty(true);
                                                                            setPassportData({ ...passportData, birthMonth: e.target.value });
                                                                        }}
                                                                    >
                                                                        {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((m) => (
                                                                            <option key={m} value={m}>
                                                                                {m}
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Native Fruit Selector */}
                                                        <div className="mb-3">
                                                            <label className="form-label fw-bold small mb-2 d-flex align-items-center justify-content-between">
                                                                <span>Native Fruit (Island Orchard Origin)</span>
                                                                <span className="tiny-text text-muted">Selected: <strong>{passportData.nativeFruit}</strong></span>
                                                            </label>
                                                            <div className="studio-fruit-grid">
                                                                {(["Apple", "Cherry", "Orange", "Peach", "Pear", "Coconut"] as const).map((fruit) => {
                                                                    const isSelected = passportData.nativeFruit === fruit;
                                                                    return (
                                                                        <button
                                                                            key={fruit}
                                                                            type="button"
                                                                            onClick={() => {
                                                                                playChimeClick();
                                                                                setPassportDirty(true);
                                                                                setPassportData({ ...passportData, nativeFruit: fruit });
                                                                            }}
                                                                            className={`studio-fruit-card ${isSelected ? "active" : ""}`}
                                                                        >
                                                                            <img
                                                                                src={FRUIT_ICONS[fruit]}
                                                                                alt={fruit}
                                                                                className="studio-fruit-icon"
                                                                                onError={(e) => { (e.currentTarget as HTMLElement).style.display = "none"; }}
                                                                            />
                                                                            <span className="studio-fruit-label">{fruit}</span>
                                                                            {isSelected && <i className="fa-solid fa-circle-check studio-fruit-check"></i>}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>

                                                        {/* Country & Language */}
                                                        <div className="row g-2">
                                                            <div className="col-6">
                                                                <label className="form-label fw-bold small mb-1">
                                                                    Country / Region
                                                                </label>
                                                                <input
                                                                    type="text"
                                                                    className="form-control rounded-3 border-2"
                                                                    placeholder="e.g. Canada, Japan"
                                                                    value={passportData.country}
                                                                    onChange={(e) => {
                                                                        setPassportDirty(true);
                                                                        setPassportData({ ...passportData, country: e.target.value });
                                                                    }}
                                                                />
                                                            </div>
                                                            <div className="col-6">
                                                                <label className="form-label fw-bold small mb-1">
                                                                    Language
                                                                </label>
                                                                <input
                                                                    type="text"
                                                                    className="form-control rounded-3 border-2"
                                                                    placeholder="e.g. English, Español"
                                                                    value={passportData.language}
                                                                    onChange={(e) => {
                                                                        setPassportDirty(true);
                                                                        setPassportData({ ...passportData, language: e.target.value });
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* TAB 2: ISLAND VIBE & AESTHETICS */}
                                                {studioSection === "vibe" && (
                                                    <div className="studio-tool-card animate-fade">
                                                        <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
                                                            <h3 className="h6 fw-black mb-0 ac-font d-flex align-items-center gap-2">
                                                                <i className="fa-solid fa-palette text-primary"></i>
                                                                Island Vibe &amp; Aesthetics
                                                            </h3>
                                                            <span className="tiny-text text-muted">Visual Styling &amp; Sound</span>
                                                        </div>

                                                        {/* Personality Archetypes */}
                                                        <div className="mb-3">
                                                            <label className="form-label fw-bold small mb-1">
                                                                Your Island Personality
                                                            </label>
                                                            <div className="d-flex flex-wrap gap-1">
                                                                {(["Lazy", "Jock", "Cranky", "Smug", "Normal", "Peppy", "Snooty", "Big Sister"] as const).map((p) => {
                                                                    const isSelected = passportData.personality === p;
                                                                    const pTheme = PERSONALITY_THEMES[p] || PERSONALITY_THEMES.Normal;
                                                                    return (
                                                                        <button
                                                                            key={p}
                                                                            type="button"
                                                                            onClick={() => {
                                                                                playChimeClick();
                                                                                setPassportDirty(true);
                                                                                setPassportData({ ...passportData, personality: p });
                                                                            }}
                                                                            className={`studio-personality-pill ${isSelected ? "active" : ""}`}
                                                                            style={{
                                                                                backgroundColor: isSelected ? pTheme.bg : undefined,
                                                                                color: isSelected ? pTheme.text : undefined,
                                                                                borderColor: isSelected ? pTheme.text : undefined,
                                                                            }}
                                                                        >
                                                                            <i className={`fa-solid ${pTheme.icon}`}></i>
                                                                            <span>{p}</span>
                                                                            {isSelected && <i className="fa-solid fa-check ms-1 small"></i>}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>

                                                        {/* Theme Colour with AC Preset Palette */}
                                                        <div className="mb-3">
                                                            <div className="d-flex align-items-center justify-content-between mb-2">
                                                                <label className="form-label fw-bold small mb-0">
                                                                    Passport Theme Color
                                                                </label>
                                                                <span className="tiny-text text-muted">Palette Preset</span>
                                                            </div>
                                                            <div className="studio-color-swatch-grid mb-2">
                                                                {[
                                                                    { hex: "#37b06d", label: "Nook Leaf" },
                                                                    { hex: "#8b5cf6", label: "Celeste Star" },
                                                                    { hex: "#d97706", label: "Roost Amber" },
                                                                    { hex: "#0284c7", label: "Dodo Sky" },
                                                                    { hex: "#ec4899", label: "Cherry Blossom" },
                                                                    { hex: "#eab308", label: "Bell Coin" },
                                                                    { hex: "#292524", label: "Brewster Noir" },
                                                                    { hex: "#14b8a6", label: "Seafarer Teal" },
                                                                ].map((c) => (
                                                                    <button
                                                                        key={c.hex}
                                                                        type="button"
                                                                        onClick={() => {
                                                                            playChimeClick();
                                                                            setPassportDirty(true);
                                                                            setPassportData({ ...passportData, favouriteColour: c.hex });
                                                                        }}
                                                                        className={`studio-color-swatch-btn ${passportData.favouriteColour === c.hex ? "active" : ""}`}
                                                                    >
                                                                        <span className="studio-color-dot" style={{ backgroundColor: c.hex }} />
                                                                        <span>{c.label}</span>
                                                                        {passportData.favouriteColour === c.hex && <i className="fa-solid fa-check small text-success"></i>}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                            <div className="d-flex align-items-center gap-2">
                                                                <input
                                                                    type="color"
                                                                    className="form-control form-control-color border-2 rounded-3"
                                                                    value={passportData.favouriteColour || "#37b06d"}
                                                                    onChange={(e) => {
                                                                        setPassportDirty(true);
                                                                        setPassportData({ ...passportData, favouriteColour: e.target.value });
                                                                    }}
                                                                    title="Choose custom colour"
                                                                />
                                                                <input
                                                                    type="text"
                                                                    className="form-control rounded-3 border-2 font-monospace small"
                                                                    value={passportData.favouriteColour}
                                                                    onChange={(e) => {
                                                                        setPassportDirty(true);
                                                                        setPassportData({ ...passportData, favouriteColour: e.target.value });
                                                                    }}
                                                                    placeholder="#37b06d"
                                                                />
                                                            </div>
                                                        </div>

                                                        {/* Favourite K.K. Slider Song */}
                                                        <div>
                                                            <div className="d-flex align-items-center justify-content-between mb-1">
                                                                <label className="form-label fw-bold small mb-0">
                                                                    Favourite K.K. Slider Song
                                                                </label>
                                                                <span className="tiny-text text-muted">Aircheck Track</span>
                                                            </div>
                                                            <div className="input-group mb-2">
                                                                <span className="input-group-text border-2 border-end-0 text-muted">
                                                                    <i className="fa-solid fa-compact-disc"></i>
                                                                </span>
                                                                <input
                                                                    type="text"
                                                                    className="form-control rounded-end-3 border-2 border-start-0"
                                                                    placeholder="e.g. K.K. Cruisin', Bubblegum K.K."
                                                                    value={passportData.favouriteSong}
                                                                    onChange={(e) => {
                                                                        setPassportDirty(true);
                                                                        setPassportData({ ...passportData, favouriteSong: e.target.value });
                                                                    }}
                                                                />
                                                            </div>
                                                            <div className="d-flex gap-1 flex-wrap">
                                                                {["K.K. Cruisin'", "Bubblegum K.K.", "Stale Cupcakes", "K.K. Disco", "Drivin'", "Animal City"].map((song) => (
                                                                    <button
                                                                        key={song}
                                                                        type="button"
                                                                        className={`btn btn-xs rounded-pill px-2 py-0 border ${passportData.favouriteSong === song ? "btn-success text-white" : "studio-motto-chip"}`}
                                                                        style={{ fontSize: "0.68rem" }}
                                                                        onClick={() => {
                                                                            playChimeClick();
                                                                            setPassportDirty(true);
                                                                            setPassportData({ ...passportData, favouriteSong: song });
                                                                        }}
                                                                    >
                                                                        {song}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* TAB 3: ISLAND MOTTO & BIO */}
                                                {studioSection === "motto" && (
                                                    <div className="studio-tool-card animate-fade">
                                                        <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
                                                            <h3 className="h6 fw-black mb-0 ac-font d-flex align-items-center gap-2">
                                                                <i className="fa-solid fa-quote-left text-warning"></i>
                                                                Island Motto &amp; Comment Bubble
                                                            </h3>
                                                            <span className="tiny-text text-muted">Passport Inscription</span>
                                                        </div>

                                                        {/* Comment Textarea with Live Counter */}
                                                        <div className="mb-2">
                                                            <div className="d-flex align-items-center justify-content-between mb-1">
                                                                <label className="form-label fw-bold small mb-0">
                                                                    Passport Comment (160 characters max)
                                                                </label>
                                                                <span className={`tiny-text font-monospace ${passportData.aboutYou.length > 160 ? "text-danger fw-bold" : "text-muted"}`}>
                                                                    {passportData.aboutYou.length}/160
                                                                </span>
                                                            </div>
                                                            <textarea
                                                                className="form-control rounded-3 border-2"
                                                                rows={3}
                                                                maxLength={160}
                                                                placeholder="Share your island theme, favorite activities, or dream designs with visitors..."
                                                                value={passportData.aboutYou}
                                                                onChange={(e) => {
                                                                    setPassportDirty(true);
                                                                    setPassportData({ ...passportData, aboutYou: e.target.value });
                                                                }}
                                                            ></textarea>
                                                        </div>

                                                        {/* Quick Motto Chips */}
                                                        <div className="mb-3">
                                                            <span className="tiny-text text-muted fw-bold d-block mb-1">
                                                                Inspirational Quick-Pills:
                                                            </span>
                                                            <div className="d-flex gap-1 flex-wrap">
                                                                {[
                                                                    "Living my best island life! 🌴",
                                                                    "5-Star Island in progress ⭐",
                                                                    "Cottagecore vibes only 🍄",
                                                                    "Hunting for cute DIYs & friends 🛠️",
                                                                    "Catching bugs & making bells 💰",
                                                                    "Stargazing with Celeste ✨",
                                                                ].map((preset) => (
                                                                    <button
                                                                        key={preset}
                                                                        type="button"
                                                                        className="studio-motto-chip"
                                                                        onClick={() => {
                                                                            playChimeClick();
                                                                            setPassportDirty(true);
                                                                            setPassportData({ ...passportData, aboutYou: preset });
                                                                        }}
                                                                    >
                                                                        <i className="fa-solid fa-sparkles text-warning small"></i>
                                                                        <span>{preset}</span>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* Hobbies & Activities */}
                                                        <div className="mb-3">
                                                            <label className="form-label fw-bold small mb-1">
                                                                Hobbies &amp; Activities
                                                            </label>
                                                            <input
                                                                type="text"
                                                                className="form-control rounded-3 border-2 mb-1"
                                                                placeholder="e.g. Gardening, Fishing, Stargazing, Decorating"
                                                                value={passportData.hobbies}
                                                                onChange={(e) => {
                                                                    setPassportDirty(true);
                                                                    setPassportData({ ...passportData, hobbies: e.target.value });
                                                                }}
                                                            />
                                                            <div className="d-flex gap-1 flex-wrap">
                                                                {["Gardening & Flowers 🌸", "Island Decorating 🏡", "Fishing & Diving 🎣", "Stargazing ✨", "Catalog Trading 📦"].map((h) => (
                                                                    <button
                                                                        key={h}
                                                                        type="button"
                                                                        className="studio-motto-chip"
                                                                        style={{ fontSize: "0.68rem" }}
                                                                        onClick={() => {
                                                                            playChimeClick();
                                                                            setPassportDirty(true);
                                                                            setPassportData({ ...passportData, hobbies: h });
                                                                        }}
                                                                    >
                                                                        {h}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* Favourite Shows & Films / Media Aesthetic */}
                                                        <div>
                                                            <label className="form-label fw-bold small mb-1">
                                                                Favorite Media / Island Aesthetic
                                                            </label>
                                                            <input
                                                                type="text"
                                                                className="form-control rounded-3 border-2"
                                                                placeholder="e.g. Studio Ghibli, Sailor Moon, Cyberpunk"
                                                                value={passportData.favouriteShowsFilms || ""}
                                                                onChange={(e) => {
                                                                    setPassportDirty(true);
                                                                    setPassportData({ ...passportData, favouriteShowsFilms: e.target.value });
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {/* TAB 4: ISLAND BESTIES & VILLAGERS */}
                                                {studioSection === "besties" && (
                                                    <div className="studio-tool-card animate-fade">
                                                        <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
                                                            <h3 className="h6 fw-black mb-0 ac-font d-flex align-items-center gap-2">
                                                                <i className="fa-solid fa-paw text-warning"></i>
                                                                Island Besties &amp; Villagers ({passportData.favouriteVillagers.length}/10)
                                                            </h3>
                                                            <span className="badge bg-warning bg-opacity-15 text-warning rounded-pill x-small fw-bold">
                                                                Max 10
                                                            </span>
                                                        </div>

                                                        {/* Current Selected Villagers Chips */}
                                                        <div className="mb-3">
                                                            <div className="d-flex flex-wrap gap-2 mb-2">
                                                                {passportData.favouriteVillagers.map((vName) => {
                                                                    const matched = (catalogData?.villagers || []).find((v) => v.name.toLowerCase() === vName.toLowerCase());
                                                                    const sprite = matched?.image || matched?.variations?.[0]?.imageUrl;
                                                                    return (
                                                                        <div key={vName} className="studio-villager-chip">
                                                                            {sprite ? (
                                                                                <img src={sprite} alt="" className="studio-villager-avatar" />
                                                                            ) : (
                                                                                <i className="fa-solid fa-paw text-warning small"></i>
                                                                            )}
                                                                            <span>{vName}</span>
                                                                            <button
                                                                                type="button"
                                                                                className="btn btn-link text-muted hover-text-danger p-0 ms-1 border-0"
                                                                                onClick={() => {
                                                                                    playChimeClick();
                                                                                    setPassportDirty(true);
                                                                                    setPassportData({
                                                                                        ...passportData,
                                                                                        favouriteVillagers: passportData.favouriteVillagers.filter((v) => v !== vName),
                                                                                    });
                                                                                }}
                                                                                aria-label={`Remove ${vName}`}
                                                                            >
                                                                                <i className="fa-solid fa-xmark"></i>
                                                                            </button>
                                                                        </div>
                                                                    );
                                                                })}
                                                                {passportData.favouriteVillagers.length === 0 && (
                                                                    <div className="p-3 text-center text-muted small w-100 rounded-3 border border-dashed studio-inner-box">
                                                                        <i className="fa-solid fa-paw text-warning me-1"></i>
                                                                        No island besties added yet. Search or click recommendations below!
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Quick Popular Villagers Recommendations */}
                                                        {passportData.favouriteVillagers.length < 10 && (
                                                            <div className="mb-3">
                                                                <span className="tiny-text text-muted fw-bold d-block mb-1">
                                                                    Quick Add Popular Villagers:
                                                                </span>
                                                                <div className="d-flex gap-1 flex-wrap">
                                                                    {["Raymond", "Shino", "Marshal", "Sasha", "Ione", "Ankha", "Judy", "Sherb", "Marina", "Bob"]
                                                                        .filter((name) => !passportData.favouriteVillagers.includes(name))
                                                                        .map((vName) => {
                                                                            const matched = (catalogData?.villagers || []).find((v) => v.name.toLowerCase() === vName.toLowerCase());
                                                                            const sprite = matched?.image || matched?.variations?.[0]?.imageUrl;
                                                                            return (
                                                                                <button
                                                                                    key={vName}
                                                                                    type="button"
                                                                                    className="studio-motto-chip shadow-2xs d-inline-flex align-items-center gap-1"
                                                                                    style={{ fontSize: "0.74rem" }}
                                                                                    onClick={() => {
                                                                                        playChimeClick();
                                                                                        setPassportDirty(true);
                                                                                        setPassportData({
                                                                                            ...passportData,
                                                                                            favouriteVillagers: [...passportData.favouriteVillagers, vName].slice(0, 10),
                                                                                        });
                                                                                    }}
                                                                                >
                                                                                    {sprite ? (
                                                                                        <img src={sprite} alt="" style={{ width: 16, height: 16, borderRadius: "50%" }} />
                                                                                    ) : (
                                                                                        <i className="fa-solid fa-plus text-success x-small"></i>
                                                                                    )}
                                                                                    <span>+{vName}</span>
                                                                                </button>
                                                                            );
                                                                        })}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Search Villager Autocomplete */}
                                                        {passportData.favouriteVillagers.length < 10 && (
                                                            <div className="position-relative">
                                                                <label className="form-label fw-bold small mb-1">
                                                                    Search Villagers by Name
                                                                </label>
                                                                <div className="input-group">
                                                                    <span className="input-group-text border-2 border-end-0 text-muted">
                                                                        <i className="fa-solid fa-magnifying-glass"></i>
                                                                    </span>
                                                                    <input
                                                                        type="text"
                                                                        className="form-control rounded-end-3 border-2 border-start-0"
                                                                        placeholder="Type villager name (e.g. Roald, Beau, Judy)..."
                                                                        value={villagerSearchQuery}
                                                                        onChange={(e) => setVillagerSearchQuery(e.target.value)}
                                                                    />
                                                                </div>

                                                                {/* Autocomplete Dropdown Popover */}
                                                                {villagerSearchQuery.trim().length > 0 && (
                                                                    <div className="position-absolute start-0 end-0 rounded-3 shadow-lg p-2 mt-1 z-3 studio-dropdown-popover" style={{ maxHeight: "220px", overflowY: "auto" }}>
                                                                        {(catalogData?.villagers || [])
                                                                            .filter((v) => v.name.toLowerCase().includes(villagerSearchQuery.trim().toLowerCase()) && !passportData.favouriteVillagers.includes(v.name))
                                                                            .slice(0, 8)
                                                                            .map((v) => {
                                                                                const sprite = v.image || v.variations?.[0]?.imageUrl;
                                                                                return (
                                                                                    <button
                                                                                        key={v.name}
                                                                                        type="button"
                                                                                        className="studio-dropdown-item d-flex align-items-center justify-content-between p-2 rounded-2"
                                                                                        onClick={() => {
                                                                                            playChimeClick();
                                                                                            setPassportDirty(true);
                                                                                            setPassportData({
                                                                                                ...passportData,
                                                                                                favouriteVillagers: [...passportData.favouriteVillagers, v.name].slice(0, 10),
                                                                                            });
                                                                                            setVillagerSearchQuery("");
                                                                                        }}
                                                                                    >
                                                                                        <div className="d-flex align-items-center gap-2">
                                                                                            {sprite && (
                                                                                                <img
                                                                                                    src={sprite}
                                                                                                    alt=""
                                                                                                    style={{ width: 24, height: 24, objectFit: "contain", borderRadius: "50%" }}
                                                                                                />
                                                                                            )}
                                                                                            <strong className="small">{v.name}</strong>
                                                                                            {v.species && <span className="tiny-text text-muted">({v.species})</span>}
                                                                                        </div>
                                                                                        <div className="d-flex align-items-center gap-2">
                                                                                            {v.personality && (
                                                                                                <span className="badge bg-light text-muted x-small">
                                                                                                    {v.personality}
                                                                                                </span>
                                                                                            )}
                                                                                            <span className="badge bg-success bg-opacity-15 text-success rounded-pill x-small fw-bold">
                                                                                                + Add
                                                                                            </span>
                                                                                        </div>
                                                                                    </button>
                                                                                );
                                                                            })}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* TAB 5: PRIVACY & PUBLISHING CONTROLS */}
                                                {studioSection === "privacy" && (
                                                    <div className="studio-tool-card animate-fade">
                                                        <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
                                                            <h3 className="h6 fw-black mb-0 ac-font d-flex align-items-center gap-2">
                                                                <i className="fa-solid fa-sliders text-success"></i>
                                                                Privacy &amp; Sharing Controls
                                                            </h3>
                                                            <span className="tiny-text text-muted">Publishing Settings</span>
                                                        </div>

                                                        {/* Switches */}
                                                        <div className="studio-inner-box mb-3">
                                                            <div className="form-check form-switch mb-3">
                                                                <input
                                                                    className="form-check-input"
                                                                    type="checkbox"
                                                                    role="switch"
                                                                    id="showCharAndIsland"
                                                                    checked={passportData.showCharacterAndIsland}
                                                                    onChange={(e) => {
                                                                        setPassportDirty(true);
                                                                        setPassportData({ ...passportData, showCharacterAndIsland: e.target.checked });
                                                                    }}
                                                                />
                                                                <label className="form-check-label fw-bold small ms-2" htmlFor="showCharAndIsland">
                                                                    Show in-game character &amp; island name on passport
                                                                </label>
                                                                <p className="tiny-text text-muted mb-0 ms-2">
                                                                    Displays your primary character nickname and island origin on the Polaroid photo.
                                                                </p>
                                                            </div>

                                                            <div className="form-check form-switch">
                                                                <input
                                                                    className="form-check-input"
                                                                    type="checkbox"
                                                                    role="switch"
                                                                    id="makeProfilePublic"
                                                                    checked={passportData.isPublic}
                                                                    onChange={(e) => {
                                                                        setPassportDirty(true);
                                                                        setPassportData({ ...passportData, isPublic: e.target.checked });
                                                                    }}
                                                                />
                                                                <label className="form-check-label fw-bold small ms-2" htmlFor="makeProfilePublic">
                                                                    Make passport public (accessible via your personal URL)
                                                                </label>
                                                                <p className="tiny-text text-muted mb-0 ms-2">
                                                                    Enables any visitor to view your resident passport card at your dedicated handle URL.
                                                                </p>
                                                            </div>
                                                        </div>

                                                        {/* Public Handle Box */}
                                                        <div className="studio-inner-box">
                                                            <div className="d-flex align-items-center justify-content-between mb-2">
                                                                <span className="fw-bold small">
                                                                    <i className="fa-solid fa-link text-primary me-1"></i> Your Public Passport Link:
                                                                </span>
                                                                <span className={`badge rounded-pill x-small fw-bold ${passportData.isPublic ? "bg-success text-white" : "bg-secondary text-white"}`}>
                                                                    {passportData.isPublic ? "Active & Public" : "Draft (Private)"}
                                                                </span>
                                                            </div>
                                                            <div className="input-group">
                                                                <input
                                                                    type="text"
                                                                    readOnly
                                                                    className="form-control rounded-start-3 border-2 font-monospace small"
                                                                    value={`${window.location.origin}/u/${encodeURIComponent(passportData.username || profileUser?.discord_name || authUser?.username || "resident")}`}
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        playChimeClick();
                                                                        const uname = passportData.username || profileUser?.discord_name || authUser?.username || "resident";
                                                                        const url = `${window.location.origin}/u/${encodeURIComponent(uname)}`;
                                                                        navigator.clipboard.writeText(url);
                                                                        setPassportLinkCopied(true);
                                                                        setTimeout(() => setPassportLinkCopied(false), 2500);
                                                                    }}
                                                                    className={`btn fw-bold px-3 ${passportLinkCopied ? "btn-success" : "btn-dark"}`}
                                                                >
                                                                    <i className={`fa-solid ${passportLinkCopied ? "fa-check" : "fa-copy"} me-1`}></i>
                                                                    <span>{passportLinkCopied ? "Copied!" : "Copy"}</span>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Bottom Sticky Action Bar */}
                                    <div className="studio-save-bar mt-4 d-flex align-items-center justify-content-between flex-wrap gap-2">
                                        <div className="d-flex align-items-center gap-2">
                                            {passportDirty ? (
                                                <span className="badge bg-warning bg-opacity-20 text-warning border border-warning border-opacity-40 rounded-pill px-3 py-1 fw-bold">
                                                    <i className="fa-solid fa-pen-nib me-1"></i>
                                                    Unsaved Studio Changes
                                                </span>
                                            ) : (
                                                <span className="badge bg-success bg-opacity-15 text-success border border-success border-opacity-30 rounded-pill px-3 py-1 fw-bold">
                                                    <i className="fa-solid fa-cloud-check me-1"></i>
                                                    Passport Synchronized
                                                </span>
                                            )}
                                            <span className="tiny-text text-muted d-none d-md-inline">
                                                Changes save securely to ChoBot &amp; your browser.
                                            </span>
                                        </div>

                                        <div className="d-flex align-items-center gap-2">
                                            <button
                                                type="submit"
                                                disabled={savingPassport}
                                                className="btn btn-nook rounded-pill fw-black px-4 py-2 shadow-xs d-inline-flex align-items-center gap-2"
                                            >
                                                <i className={savingPassport ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-floppy-disk"}></i>
                                                <span>{savingPassport ? "Saving to Database..." : "Save Passport to Database"}</span>
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── TAB 2: YOUR ACCESS & SUBSCRIPTION ISLANDS ────────────────────── */}
                {activeTab === "access" && (
                    <div className="row g-4 animate-fade" role="tabpanel" aria-label="Your Access & Islands">
                        <div className="col-lg-12">
                            <div className="pf-card">
                                {/* Header Row */}
                                <div className="pf-section-header flex-column flex-sm-row align-items-start align-items-sm-center">
                                    <div>
                                        <div className="d-flex align-items-center gap-2 mb-1">
                                            <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-3 py-1 fw-bold">
                                                <i className="fa-solid fa-passport me-1"></i>Tier Passport
                                            </span>
                                            <h2 className="h5 ac-font text-dark mb-0">Your Subscription &amp; Island Access</h2>
                                        </div>
                                        <p className="tiny-text text-muted mb-0">
                                            Real-time overview of your membership status, Discord tier roles, and unlocked Animal Crossing treasure islands.
                                        </p>
                                    </div>

                                    <div className="d-flex align-items-center gap-2">
                                        <Link to="/islands" className="btn btn-sm btn-nook rounded-pill px-3 fw-bold shadow-xs">
                                            <i className="fa-solid fa-plane-departure me-1"></i>Live Flight Board
                                        </Link>
                                        <Link to="/membership" className="btn btn-sm btn-outline-warning text-dark border-warning rounded-pill px-3 fw-bold">
                                            <i className="fa-solid fa-crown text-warning me-1"></i>Perks &amp; Tiers
                                        </Link>
                                    </div>
                                </div>

                                {/* Subscription Tier Status Overview Banner */}
                                <div className="bg-light rounded-4 p-4 border mb-4">
                                    <div className="row g-3 align-items-center">
                                        <div className="col-lg-6">
                                            <div className="d-flex align-items-center gap-3">
                                                <div
                                                    className="rounded-circle d-flex align-items-center justify-content-center shadow-xs"
                                                    style={{
                                                        width: 52,
                                                        height: 52,
                                                        background: subscriptionRoleNames.length > 0 ? "#fef3c7" : "#d8f3dc",
                                                        color: subscriptionRoleNames.length > 0 ? "#92400e" : "#1b4332",
                                                    }}
                                                >
                                                    <i className={`fa-solid ${subscriptionRoleNames.length > 0 ? "fa-crown fa-lg" : "fa-leaf fa-lg"}`}></i>
                                                </div>
                                                <div>
                                                    <div className="d-flex align-items-center gap-2 mb-1">
                                                        <h3 className="h6 fw-black text-dark mb-0">
                                                            {subscriptionRoleNames.length > 0 ? "Active Subscription Tier" : "Free Resident Access"}
                                                        </h3>
                                                        <span className={`badge rounded-pill px-2 py-1 x-small fw-bold ${
                                                            subscriptionRoleNames.length > 0 ? "bg-warning text-dark" : "bg-secondary text-white"
                                                        }`}>
                                                            {subscriptionRoleNames.length > 0 ? "VIP PASS" : "STANDARD PASS"}
                                                        </span>
                                                    </div>
                                                    <div className="d-flex flex-wrap gap-1 align-items-center">
                                                        {subscriptionRoleNames.length > 0 ? (
                                                            subscriptionRoleNames.map((role) => (
                                                                <span key={role} className="badge bg-white text-dark border rounded-pill px-2 py-1 x-small fw-bold shadow-2xs">
                                                                    <i className="fa-solid fa-check text-success me-1"></i>{role}
                                                                </span>
                                                            ))
                                                        ) : (
                                                            <span className="tiny-text text-muted fw-bold">
                                                                Access to all public islands ({allIslands.filter(i => i.cat === "public").length} free islands)
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="col-lg-6">
                                            <div className="row g-2 text-center">
                                                <div className="col-4">
                                                    <div className="bg-white rounded-3 p-2 border shadow-2xs">
                                                        <div className="x-small text-muted fw-bold text-uppercase">Unlocked</div>
                                                        <div className="h5 fw-black text-success mb-0 font-monospace">{userUnlockedIslands.length}</div>
                                                    </div>
                                                </div>
                                                <div className="col-4">
                                                    <div className="bg-white rounded-3 p-2 border shadow-2xs">
                                                        <div className="x-small text-muted fw-bold text-uppercase">Public Free</div>
                                                        <div className="h5 fw-black text-dark mb-0 font-monospace">
                                                            {userUnlockedIslands.filter(i => i.cat === "public").length}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="col-4">
                                                    <div className="bg-white rounded-3 p-2 border shadow-2xs">
                                                        <div className="x-small text-muted fw-bold text-uppercase">VIP / Premium</div>
                                                        <div className="h5 fw-black text-warning mb-0 font-monospace">
                                                            {userUnlockedIslands.filter(i => i.cat === "member").length}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Filter Pills for Unlocked Islands */}
                                <div className="d-flex flex-column flex-sm-row align-items-start align-items-sm-center justify-content-between gap-2 mb-3">
                                    <div className="d-flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setAccessFilter("all")}
                                            className={`btn btn-sm rounded-pill px-3 fw-bold transition-all ${
                                                accessFilter === "all" ? "btn-dark shadow-xs" : "btn-light border text-muted"
                                            }`}
                                        >
                                            All Unlocked ({userUnlockedIslands.length})
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setAccessFilter("public")}
                                            className={`btn btn-sm rounded-pill px-3 fw-bold transition-all ${
                                                accessFilter === "public" ? "btn-success text-white shadow-xs" : "btn-light border text-muted"
                                            }`}
                                        >
                                            <i className="fa-solid fa-lock-open me-1"></i>Free Public ({userUnlockedIslands.filter(i => i.cat === "public").length})
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setAccessFilter("member")}
                                            className={`btn btn-sm rounded-pill px-3 fw-bold transition-all ${
                                                accessFilter === "member" ? "btn-warning text-dark shadow-xs" : "btn-light border text-muted"
                                            }`}
                                        >
                                            <i className="fa-solid fa-crown me-1"></i>VIP / Sub ({userUnlockedIslands.filter(i => i.cat === "member").length})
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setAccessFilter("order")}
                                            className={`btn btn-sm rounded-pill px-3 fw-bold transition-all ${
                                                accessFilter === "order" ? "btn-info text-dark shadow-xs" : "btn-light border text-muted"
                                            }`}
                                        >
                                            <i className="fa-solid fa-box-open me-1"></i>Order Bot ({userUnlockedIslands.filter(i => i.cat === "order").length})
                                        </button>
                                    </div>

                                    <span className="tiny-text text-muted fw-bold">
                                        Showing {filteredAccessIslands.length} accessible destinations
                                    </span>
                                </div>

                                {/* Unlocked Island Cards */}
                                {filteredAccessIslands.length > 0 ? (
                                    <div className="row g-3 mb-4">
                                        {filteredAccessIslands.map((island) => {
                                            const isOnline = island.discordBotOnline === true;
                                            const isFav = isFavoriteIsland(island.id);

                                            return (
                                                <div key={island.id} className="col-12 col-md-6 col-lg-4">
                                                    <div className="pf-island-card">
                                                        <div className="d-flex align-items-center justify-content-between mb-2">
                                                            <div className="d-flex align-items-center gap-2">
                                                                <span className={`badge rounded-pill x-small fw-bold ${
                                                                    island.cat === "member"
                                                                        ? "bg-warning-subtle text-warning-emphasis border border-warning-subtle"
                                                                        : island.cat === "order"
                                                                            ? "bg-info-subtle text-info-emphasis border border-info-subtle"
                                                                            : "bg-success-subtle text-success border border-success-subtle"
                                                                }`}>
                                                                    {island.cat === "member" ? (
                                                                        <><i className="fa-solid fa-crown me-1"></i>VIP Unlocked</>
                                                                    ) : island.cat === "order" ? (
                                                                        <><i className="fa-solid fa-box me-1"></i>Order Bot</>
                                                                    ) : (
                                                                        <><i className="fa-solid fa-lock-open me-1"></i>Public Free</>
                                                                    )}
                                                                </span>

                                                                <div className="d-flex align-items-center gap-1 x-small fw-bold">
                                                                    <span className={`status-dot ${isOnline ? "bg-success pulse-ring" : "bg-danger"}`} style={{ width: 8, height: 8 }}></span>
                                                                    <span className={isOnline ? "text-success" : "text-muted"}>
                                                                        {isOnline ? "ONLINE" : "OFFLINE"}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            <button
                                                                type="button"
                                                                onClick={(e) => toggleFavoriteIsland(island.id, e)}
                                                                className={`btn btn-sm border rounded-circle shadow-2xs d-flex align-items-center justify-content-center transition-all ${
                                                                    isFav ? "btn-warning text-dark border-warning" : "btn-light text-muted"
                                                                }`}
                                                                style={{ width: 30, height: 30 }}
                                                                title={isFav ? "Remove from Favorites" : "Add to Favorites"}
                                                                aria-label={isFav ? `Remove ${island.name} from Favorites` : `Add ${island.name} to Favorites`}
                                                            >
                                                                <i className={`${isFav ? "fa-solid text-dark" : "fa-regular text-muted"} fa-star x-small`}></i>
                                                            </button>
                                                        </div>

                                                        <div className="d-flex align-items-center justify-content-between mb-2">
                                                            <div>
                                                                <h4 className="ac-font h5 text-dark mb-0">{island.name}</h4>
                                                                <span className="tiny-text text-muted fw-bold text-uppercase">{island.type}</span>
                                                            </div>
                                                            <div
                                                                className={`theme-badge rounded-circle d-flex align-items-center justify-content-center theme-${island.theme} border shadow-2xs`}
                                                                style={{ width: 30, height: 30, fontSize: "0.75rem" }}
                                                                title={`${island.seasonal} Season`}
                                                            >
                                                                <i className="fa-solid fa-leaf"></i>
                                                            </div>
                                                        </div>

                                                        {island.items && island.items.length > 0 && (
                                                            <div className="d-flex flex-wrap gap-1 mb-3">
                                                                {island.items.slice(0, 3).map((item, i) => (
                                                                    <span key={i} className="badge bg-light text-secondary border rounded-pill x-small fw-bold">
                                                                        {item}
                                                                    </span>
                                                                ))}
                                                                {island.items.length > 3 && (
                                                                    <span className="badge bg-light text-muted border rounded-pill x-small fw-bold">
                                                                        +{island.items.length - 3}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}

                                                        <div className="mt-auto pt-2 border-top d-flex align-items-center justify-content-between">
                                                            <span className="tiny-text text-muted font-monospace fw-bold">
                                                                <i className="fa-solid fa-users me-1"></i>
                                                                {island.visitors ?? 0}/7 Visitors
                                                            </span>
                                                            <Link
                                                                to={`/island/${encodeURIComponent(island.id)}`}
                                                                className="btn btn-sm btn-nook rounded-pill px-3 py-1 fw-bold d-flex align-items-center gap-1 shadow-xs"
                                                            >
                                                                <span>Fly to Island</span>
                                                                <i className="fa-solid fa-plane-departure x-small"></i>
                                                            </Link>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="pf-empty-state mb-4">
                                        <div className="pf-empty-icon text-muted"><i className="fa-solid fa-map-location-dot"></i></div>
                                        <div className="pf-empty-title">No Islands Found</div>
                                        <p className="pf-empty-desc">Try selecting "All Unlocked" to view all available destinations.</p>
                                    </div>
                                )}

                                {/* Locked Islands Preview Card (for subscribers & free members) */}
                                {lockedIslands.length > 0 && (
                                    <div className="bg-light border rounded-4 p-4">
                                        <div className="d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between gap-3 mb-3">
                                            <div>
                                                <div className="d-flex align-items-center gap-2 mb-1">
                                                    <span className="badge bg-secondary text-white rounded-pill px-2 py-1 x-small fw-bold">
                                                        <i className="fa-solid fa-lock me-1"></i>VIP EXCLUSIVE
                                                    </span>
                                                    <h3 className="h6 fw-black text-dark mb-0">Locked Treasure Islands ({lockedIslands.length})</h3>
                                                </div>
                                                <p className="tiny-text text-muted mb-0">
                                                    Upgrade your subscription tier on Discord to unlock priority 24/7 Dodo codes, 2.0 DIYs, custom order bots, and all private islands.
                                                </p>
                                            </div>

                                            <Link to="/membership" className="btn btn-sm btn-warning text-dark border-warning rounded-pill px-4 fw-bold shadow-xs text-nowrap">
                                                <i className="fa-solid fa-crown me-1"></i>Unlock All Islands
                                            </Link>
                                        </div>

                                        <div className="d-flex flex-wrap gap-2">
                                            {lockedIslands.map((locked) => (
                                                <div
                                                    key={locked.id}
                                                    className="badge bg-white text-muted border rounded-pill px-3 py-2 fw-bold d-flex align-items-center gap-2 shadow-2xs"
                                                    title="Subscribe to unlock this island"
                                                >
                                                    <i className="fa-solid fa-lock text-warning x-small"></i>
                                                    <span className="text-dark">{locked.name}</span>
                                                    <span className="x-small text-muted">({locked.type})</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── TAB 3: FAVOURITE TREASURE ISLANDS ────────────────────────────── */}
                {activeTab === "favorites" && (
                    <div className="row g-4 animate-fade" role="tabpanel" aria-label="Favorite Islands">
                        <div className="col-lg-12">
                            <div className="pf-card">
                                <div className="pf-section-header">
                                    <div>
                                        <div className="d-flex align-items-center gap-2 mb-1">
                                            <h2 className="h5 ac-font text-dark mb-0">Favorite Treasure Islands</h2>
                                            <span className="badge bg-warning bg-opacity-25 text-dark rounded-pill x-small fw-black">
                                                {favoriteIslands.length} Starred
                                            </span>
                                        </div>
                                        <p className="tiny-text text-muted mb-0">
                                            Your starred treasure islands for quick access and live status monitoring.
                                        </p>
                                    </div>

                                    <Link to="/islands" className="btn btn-sm btn-outline-success rounded-pill px-3 fw-bold">
                                        <i className="fa-solid fa-plus me-1"></i>Find More Islands
                                    </Link>
                                </div>

                                {favoritedIslandObjects.length > 0 ? (
                                    <div className="row g-3">
                                        {favoritedIslandObjects.map((island) => {
                                            const isOnline = island.status === "ONLINE";

                                            return (
                                                <div key={island.id} className="col-md-6 col-lg-4">
                                                    <div className="pf-island-card">
                                                        <div className="d-flex align-items-center justify-content-between mb-2">
                                                            <div className="d-flex align-items-center gap-1">
                                                                <span
                                                                    className={`status-dot ${isOnline ? "bg-success pulse-ring" : "bg-secondary"}`}
                                                                    style={{ width: "8px", height: "8px" }}
                                                                ></span>
                                                                <span className={`tiny-text fw-black ${isOnline ? "text-success" : "text-muted"}`}>
                                                                    {island.status}
                                                                </span>
                                                            </div>

                                                            <button
                                                                type="button"
                                                                className="btn btn-sm p-1 text-warning border-0"
                                                                onClick={(e) => toggleFavoriteIsland(island.id, e)}
                                                                title="Remove from Favorites"
                                                                aria-label={`Remove ${island.name} from Favorites`}
                                                            >
                                                                <i className="fa-solid fa-star fs-5"></i>
                                                            </button>
                                                        </div>

                                                        <div className="fw-black text-dark h5 mb-1 ac-font d-flex align-items-center gap-2">
                                                            <i className="fa-solid fa-tree text-success"></i>
                                                            <span>{island.name}</span>
                                                        </div>

                                                        <p className="tiny-text text-muted mb-3 flex-grow-1 line-clamp-2">
                                                            {island.description || "Treasure island with loaded DIYs, materials, and catalog items."}
                                                        </p>

                                                        <div className="d-flex align-items-center justify-content-between pt-2 border-top mt-auto">
                                                            <span className="badge bg-white text-muted border rounded-pill x-small fw-bold">
                                                                {island.cat || island.type || "Treasure Island"}
                                                            </span>
                                                            <Link
                                                                to={`/island/${encodeURIComponent(island.id)}`}
                                                                className="btn btn-xs btn-success text-white rounded-pill px-3 fw-bold shadow-xs"
                                                            >
                                                                Travel Now
                                                            </Link>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="pf-empty-state">
                                        <div className="pf-empty-icon">⭐</div>
                                        <h3 className="pf-empty-title">No Favorite Islands Starred Yet</h3>
                                        <p className="pf-empty-desc">
                                            Star your favorite free or subscriber treasure islands to keep track of their live dodo status and fast travel anytime!
                                        </p>
                                        <div className="d-flex justify-content-center">
                                            <Link to="/islands" className="btn btn-sm btn-success text-white rounded-pill px-4 py-2 fw-bold shadow-xs">
                                                <i className="fa-solid fa-compass me-1"></i>Browse Treasure Islands
                                            </Link>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── TAB: ORDER HISTORY & REORDER ─────────────────────────────────────── */}
                {activeTab === "orders" && (
                    <div className="row g-4 animate-fade" role="tabpanel" aria-label="Order History">
                        <div className="col-12">
                            <div className="pf-card">
                                <div className="pf-section-header flex-column flex-sm-row align-items-start align-items-sm-center">
                                    <div>
                                        <div className="d-flex align-items-center gap-2 mb-1">
                                            <h2 className="h5 ac-font text-dark mb-0">Your Order History</h2>
                                            <span className="badge bg-success bg-opacity-10 text-success rounded-pill x-small fw-black">
                                                {orders.length} Order{orders.length === 1 ? "" : "s"}
                                            </span>
                                        </div>
                                        <p className="tiny-text text-muted mb-0">
                                            Saved Order Bot requests. Reorder any previous pocket with 1-click or export items to Command Builder.
                                        </p>
                                    </div>

                                    <div className="d-flex gap-2">
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-outline-secondary rounded-pill fw-bold px-3 d-flex align-items-center gap-1 shadow-2xs"
                                            onClick={loadOrders}
                                            disabled={ordersLoading}
                                            title="Refresh order history"
                                            aria-label="Refresh order history"
                                        >
                                            <i className={`fa-solid fa-arrows-rotate ${ordersLoading ? "fa-spin" : ""}`}></i>
                                            <span>Refresh</span>
                                        </button>
                                        <Link
                                            to="/order"
                                            className="btn btn-sm btn-success text-white rounded-pill fw-bold px-3 d-flex align-items-center gap-1 shadow-xs"
                                        >
                                            <i className="fa-solid fa-paper-plane"></i>
                                            <span>Order Bot</span>
                                        </Link>
                                    </div>
                                </div>

                                {ordersLoading && orders.length === 0 ? (
                                    <div className="text-center py-5 text-muted">
                                        <span className="spinner-border spinner-border-sm text-success me-2" role="status" aria-hidden="true" />
                                        <span className="small fw-bold">Loading order history…</span>
                                    </div>
                                ) : orders.length > 0 ? (
                                    <div className="row g-3">
                                        {orders.map((order) => {
                                            const parsed = parsedOrdersMap.get(order.id) || { items: [], totalSlots: 0, unrecognizedCodes: [] };
                                            const isCopied = copiedOrderId === order.id;
                                            const statusColor =
                                                order.status === "ready" || order.status === "completed"
                                                    ? "bg-success text-white"
                                                    : order.status === "preparing"
                                                    ? "bg-warning text-dark"
                                                    : order.status === "cancelled" || order.status === "error"
                                                    ? "bg-danger text-white"
                                                    : "bg-info text-dark";

                                            return (
                                                <div key={order.id} className="col-12 col-xl-6">
                                                    <div className="pf-order-card h-100 d-flex flex-column">
                                                        {/* Card Top: Order ID + Status + Date */}
                                                        <div className="d-flex align-items-center justify-content-between mb-2 flex-wrap gap-2">
                                                            <div className="d-flex align-items-center gap-2">
                                                                <span className="badge bg-dark text-white rounded-pill font-monospace x-small px-2 py-1">
                                                                    #{order.id.slice(0, 16)}
                                                                </span>
                                                                <span className={`badge rounded-pill x-small fw-black text-uppercase ${statusColor}`}>
                                                                    {order.status}
                                                                </span>
                                                            </div>
                                                            <span className="tiny-text text-muted">
                                                                <i className="fa-regular fa-clock me-1"></i>
                                                                {formatDateTime(order.created_at)}
                                                            </span>
                                                        </div>

                                                        {/* Island info & Dodo code if ready */}
                                                        {order.island_name && (
                                                            <div className="d-flex align-items-center gap-2 mb-2 tiny-text">
                                                                <span className="fw-bold text-dark d-flex align-items-center gap-1">
                                                                    <i className="fa-solid fa-tree text-success"></i>
                                                                    <span>Island: <strong>{order.island_name}</strong></span>
                                                                </span>
                                                                {order.dodo_code && (
                                                                    <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill font-monospace">
                                                                        Dodo: {order.dodo_code}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Parsed Items Preview */}
                                                        <div className="bg-light rounded-3 p-2 border mb-3 flex-grow-1">
                                                            <div className="d-flex align-items-center justify-content-between mb-2 tiny-text">
                                                                <span className="text-muted fw-bold">
                                                                    {parsed.items.length > 0
                                                                        ? `${parsed.items.length} item types (${parsed.totalSlots} slots)`
                                                                        : "Order Command"}
                                                                </span>
                                                            </div>

                                                            {parsed.items.length > 0 ? (
                                                                <div className="d-flex flex-wrap gap-1" style={{ maxHeight: "100px", overflowY: "auto" }}>
                                                                    {parsed.items.map((item, idx) => (
                                                                        <span
                                                                            key={`${item.itemId}-${idx}`}
                                                                            className="pf-order-pill"
                                                                        >
                                                                            {item.image && (
                                                                                <img
                                                                                    src={item.image}
                                                                                    alt=""
                                                                                    style={{ width: 14, height: 14, objectFit: "contain" }}
                                                                                />
                                                                            )}
                                                                            <span>{item.name}</span>
                                                                            <span className="text-success fw-bold">×{item.quantity}</span>
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <div className="font-monospace text-muted tiny-text text-break select-all" style={{ maxHeight: "60px", overflowY: "auto" }}>
                                                                    {order.command}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Action Buttons */}
                                                        <div className="d-flex align-items-center justify-content-between pt-2 border-top mt-auto gap-2 flex-wrap">
                                                            <button
                                                                type="button"
                                                                className="btn btn-sm btn-nook text-white rounded-pill px-3 fw-bold d-inline-flex align-items-center gap-1 shadow-xs"
                                                                onClick={() => handleReorder(order, "/order")}
                                                                title="Load this pocket and open Order Bot"
                                                                aria-label="Reorder this pocket with Order Bot"
                                                            >
                                                                <i className="fa-solid fa-rotate-left"></i>
                                                                <span>Reorder</span>
                                                            </button>

                                                            <div className="d-flex gap-2">
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-sm btn-outline-success rounded-pill px-3 fw-bold d-inline-flex align-items-center gap-1 shadow-2xs"
                                                                    onClick={() => handleReorder(order, "/command-builder")}
                                                                    title="Load into Command Builder to edit"
                                                                    aria-label="Open pocket in Command Builder"
                                                                >
                                                                    <i className="fa-solid fa-pencil"></i>
                                                                    <span className="d-none d-sm-inline">Builder</span>
                                                                </button>

                                                                <button
                                                                    type="button"
                                                                    className={`btn btn-sm rounded-pill px-3 fw-bold d-inline-flex align-items-center gap-1 ${
                                                                        isCopied ? "btn-success text-white" : "btn-light border text-dark"
                                                                    }`}
                                                                    onClick={() => handleCopyOrderCommand(order)}
                                                                    title="Copy !order command to clipboard"
                                                                    aria-label="Copy order command to clipboard"
                                                                >
                                                                    <i className={`fa-solid ${isCopied ? "fa-check" : "fa-copy"}`}></i>
                                                                    <span>{isCopied ? "Copied" : "Copy"}</span>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="pf-empty-state">
                                        <div className="pf-empty-icon text-muted"><i className="fa-solid fa-box-open"></i></div>
                                        <h3 className="pf-empty-title">No Orders Placed Yet</h3>
                                        <p className="pf-empty-desc">
                                            Build your 40-slot pocket loadout in the Command Builder and place an order to get automatic tracking and 1-click reordering here.
                                        </p>
                                        <div className="d-flex justify-content-center gap-2">
                                            <Link to="/command-builder" className="btn btn-sm btn-success text-white rounded-pill px-4 py-2 fw-bold shadow-xs">
                                                <i className="fa-solid fa-cubes-stacked me-1"></i>Build Pocket
                                            </Link>
                                            <Link to="/order" className="btn btn-sm btn-outline-success rounded-pill px-4 py-2 fw-bold shadow-2xs">
                                                <i className="fa-solid fa-box-open me-1"></i>Order Bot
                                            </Link>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── TAB 4: FLIGHT HISTORY & VISIT LOGS ────────────────────────────── */}
                {activeTab === "history" && (
                    <div className="row g-4 animate-fade" role="tabpanel" aria-label="Flight History">
                        <div className="col-lg-12">
                            <div className="pf-card mb-4">
                                <h2 className="h5 ac-font text-dark mb-3">Recent Flights &amp; Visits</h2>
                                <IslandVisitTable visits={recentVisits} emptyText="No recent flights recorded." showDate />
                            </div>

                            <div className="pf-card">
                                <h2 className="h5 ac-font text-dark mb-3">Top Visited Destinations</h2>
                                <IslandVisitTable visits={mostVisited} emptyText="No favorite destinations yet." />
                            </div>

                            {/* Warnings Summary if any */}
                            {warningSummary && (
                                <div className="pf-card mt-4">
                                    <h2 className="h5 ac-font text-dark mb-3">Account Warnings Log</h2>
                                    {Array.isArray(warningSummary) && warningSummary.length > 0 ? (
                                        <PaginatedTable
                                            columns={["Warning Note"]}
                                            rows={warningSummary.map((w) => [String(w)])}
                                            searchable={false}
                                        />
                                    ) : !Array.isArray(warningSummary) && Object.keys(warningSummary).length > 0 ? (
                                        <PaginatedTable
                                            columns={["Warning Type", "Count"]}
                                            rows={Object.entries(warningSummary).map(([k, v]) => [k.replaceAll("_", " "), formatNumber(Number(v))])}
                                            searchable={false}
                                        />
                                    ) : (
                                        <div className="alert alert-success rounded-3 py-2 px-3 small fw-bold mb-0">
                                            <i className="fa-solid fa-shield-check me-2"></i>Clean record! No active warnings or penalties on this passport.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── TAB 6: LIVE COMMUNITY RADAR & ISLAND TRAFFIC ──────────────────── */}
                {activeTab === "community" && (
                    <div className="row g-4 animate-fade" role="tabpanel" aria-label="Island Radar & Community Traffic">
                        <div className="col-12">
                            {/* Hero Telemetry Card */}
                            <div
                                className="p-4 p-md-5 rounded-5 text-white shadow-sm border mb-4 position-relative overflow-hidden"
                                style={{
                                    background: 'linear-gradient(135deg, #065f46 0%, #047857 50%, #0f766e 100%)',
                                }}
                            >
                                <div className="row g-4 align-items-center">
                                    <div className="col-lg-7">
                                        <div className="d-inline-flex align-items-center gap-2 px-3 py-1 rounded-pill bg-white bg-opacity-20 border border-white border-opacity-25 mb-3">
                                            <span style={{ width: 8, height: 8, backgroundColor: '#4ade80', borderRadius: '50%', boxShadow: '0 0 8px #4ade80' }} />
                                            <span className="tiny-text fw-bold tracking-wider text-uppercase text-white">
                                                DAL AIR TRAFFIC CONTROL · LIVE TELEMETRY
                                            </span>
                                        </div>
                                        <h2 className="h2 ac-font mb-2 text-white">
                                            Community Radar &amp; Island Occupancy
                                        </h2>
                                        <p className="text-white-50 mb-4 max-w-xl">
                                            Real-time overview of Animal Crossing residents online right now, active player occupancy across all treasure islands, and lifetime website flight telemetry.
                                        </p>

                                        <div className="d-flex align-items-center gap-2 flex-wrap">
                                            <button
                                                type="button"
                                                className="btn btn-warning rounded-pill px-4 py-2 fw-black text-dark shadow-xs d-inline-flex align-items-center gap-2"
                                                onClick={() => openCommunityModal("online")}
                                            >
                                                <i className="fa-solid fa-satellite-dish"></i>
                                                <span>Open Live Radar Modal</span>
                                            </button>
                                            <Link
                                                to="/islands"
                                                className="btn btn-outline-light rounded-pill px-4 py-2 fw-bold d-inline-flex align-items-center gap-2"
                                            >
                                                <i className="fa-solid fa-plane-departure"></i>
                                                <span>Live Flight Board</span>
                                            </Link>
                                        </div>
                                    </div>

                                    <div className="col-lg-5">
                                        <div className="row g-3">
                                            <div className="col-6">
                                                <div className="p-3.5 rounded-4 bg-white bg-opacity-10 border border-white border-opacity-20 text-center">
                                                    <div className="text-white-50 tiny-text fw-bold text-uppercase">Online Now</div>
                                                    <div className="display-6 fw-black text-white mt-1">
                                                        {trafficStats.activeOnlineCount}
                                                    </div>
                                                    <div className="tiny-text text-white-50">Residents Active</div>
                                                </div>
                                            </div>
                                            <div className="col-6">
                                                <div className="p-3.5 rounded-4 bg-white bg-opacity-10 border border-white border-opacity-20 text-center">
                                                    <div className="text-white-50 tiny-text fw-bold text-uppercase">In Islands</div>
                                                    <div className="display-6 fw-black text-warning mt-1">
                                                        {liveOccupancy.totalVisitors}
                                                    </div>
                                                    <div className="tiny-text text-white-50">Players on Gates</div>
                                                </div>
                                            </div>
                                            <div className="col-6">
                                                <div className="p-3.5 rounded-4 bg-white bg-opacity-10 border border-white border-opacity-20 text-center">
                                                    <div className="text-white-50 tiny-text fw-bold text-uppercase">All-Time Visits</div>
                                                    <div className="fs-3 fw-black text-white mt-1">
                                                        {trafficStats.allTimeVisits.toLocaleString()}
                                                    </div>
                                                    <div className="tiny-text text-white-50">Lifetime Flights</div>
                                                </div>
                                            </div>
                                            <div className="col-6">
                                                <div className="p-3.5 rounded-4 bg-white bg-opacity-10 border border-white border-opacity-20 text-center">
                                                    <div className="text-white-50 tiny-text fw-bold text-uppercase">Visits Today</div>
                                                    <div className="fs-3 fw-black text-info mt-1">
                                                        {trafficStats.visitsToday.toLocaleString()}
                                                    </div>
                                                    <div className="tiny-text text-white-50">Flights Logged</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {profileWaveNote && (
                                <div className="alert alert-success border-success-subtle rounded-4 py-2 px-3 mb-4 d-flex align-items-center justify-content-between animate-bounce-gentle">
                                    <span className="small fw-bold">
                                        <i className="fa-solid fa-hand me-2 text-warning"></i>
                                        {profileWaveNote}
                                    </span>
                                    <button
                                        type="button"
                                        className="btn-close btn-close-sm"
                                        onClick={() => setProfileWaveNote(null)}
                                    ></button>
                                </div>
                            )}

                            {/* Sub-Tabs Switcher */}
                            <div className="pf-card p-3 mb-4">
                                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                                    <div className="d-flex align-items-center gap-2">
                                        <button
                                            type="button"
                                            className={`btn btn-sm rounded-pill px-3.5 py-1.5 fw-bold ${
                                                communitySubTab === "online"
                                                    ? "btn-success text-white shadow-2xs"
                                                    : "btn-light text-dark border"
                                            }`}
                                            onClick={() => {
                                                playChimeClick();
                                                setCommunitySubTab("online");
                                            }}
                                        >
                                            <i className="fa-solid fa-users me-1.5"></i>
                                            Who's Currently Online ({trafficStats.activeOnlineCount})
                                        </button>
                                        <button
                                            type="button"
                                            className={`btn btn-sm rounded-pill px-3.5 py-1.5 fw-bold ${
                                                communitySubTab === "islands"
                                                    ? "btn-success text-white shadow-2xs"
                                                    : "btn-light text-dark border"
                                            }`}
                                            onClick={() => {
                                                playChimeClick();
                                                setCommunitySubTab("islands");
                                            }}
                                        >
                                            <i className="fa-solid fa-plane-arrival me-1.5"></i>
                                            Island Occupancy ({liveOccupancy.totalVisitors} on Islands)
                                        </button>
                                        <button
                                            type="button"
                                            className={`btn btn-sm rounded-pill px-3.5 py-1.5 fw-bold ${
                                                communitySubTab === "visits"
                                                    ? "btn-success text-white shadow-2xs"
                                                    : "btn-light text-dark border"
                                            }`}
                                            onClick={() => {
                                                playChimeClick();
                                                setCommunitySubTab("visits");
                                            }}
                                        >
                                            <i className="fa-solid fa-chart-line me-1.5"></i>
                                            All-Time Website Visits
                                        </button>
                                    </div>

                                    <div className="tiny-text text-muted">
                                        <i className="fa-solid fa-circle-check text-success me-1"></i>
                                        Live data synced via Dodo Flight APIs
                                    </div>
                                </div>
                            </div>

                            {/* ── SUB-TAB 1: WHO'S CURRENTLY ONLINE ── */}
                            {communitySubTab === "online" && (
                                <div className="pf-card">
                                    <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
                                        <div>
                                            <h3 className="h5 ac-font text-dark mb-1">Active Community Residents</h3>
                                            <p className="tiny-text text-muted mb-0">
                                                Animal Crossing islanders actively browsing ChoPaeng, flying to islands, and crafting orders.
                                            </p>
                                        </div>

                                        {/* Search Bar */}
                                        <div className="d-flex align-items-center gap-2">
                                            <input
                                                type="text"
                                                className="form-control form-control-sm rounded-pill px-3 py-1.5"
                                                placeholder="Search by name, IGN, or island..."
                                                style={{ maxWidth: 260 }}
                                                value={communitySearchQuery}
                                                onChange={(e) => setCommunitySearchQuery(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    {/* Filter Pills */}
                                    <div className="d-flex align-items-center gap-1.5 mb-4 flex-wrap">
                                        <button
                                            type="button"
                                            className={`btn btn-xs rounded-pill px-3 fw-bold ${
                                                communityFilter === "all" ? "btn-dark text-white" : "btn-outline-secondary"
                                            }`}
                                            onClick={() => setCommunityFilter("all")}
                                        >
                                            All Online ({onlineResidents.length})
                                        </button>
                                        <button
                                            type="button"
                                            className={`btn btn-xs rounded-pill px-3 fw-bold ${
                                                communityFilter === "on_island" ? "btn-success text-white" : "btn-outline-secondary"
                                            }`}
                                            onClick={() => setCommunityFilter("on_island")}
                                        >
                                            <i className="fa-solid fa-plane-arrival me-1"></i>
                                            On Islands ({onlineResidents.filter((r) => r.status === "on_island").length})
                                        </button>
                                        <button
                                            type="button"
                                            className={`btn btn-xs rounded-pill px-3 fw-bold ${
                                                communityFilter === "ordering" ? "btn-info text-white" : "btn-outline-secondary"
                                            }`}
                                            onClick={() => setCommunityFilter("ordering")}
                                        >
                                            <i className="fa-solid fa-box-open me-1"></i>
                                            In Bot Queue ({onlineResidents.filter((r) => r.status === "ordering").length})
                                        </button>
                                        <button
                                            type="button"
                                            className={`btn btn-xs rounded-pill px-3 fw-bold ${
                                                communityFilter === "passport" ? "btn-warning text-dark" : "btn-outline-secondary"
                                            }`}
                                            onClick={() => setCommunityFilter("passport")}
                                        >
                                            <i className="fa-solid fa-id-card me-1"></i>
                                            Passport Holders ({onlineResidents.filter((r) => r.hasPublicPassport).length})
                                        </button>
                                    </div>

                                    {/* Resident Cards Grid */}
                                    <div className="row g-3">
                                        {filteredOnlineResidents.map((resident) => (
                                            <div className="col-md-6 col-xl-4" key={resident.id}>
                                                <div
                                                    className={`p-3 rounded-4 border h-100 d-flex flex-column justify-content-between transition-all ${
                                                        resident.isCurrentUser
                                                            ? "bg-success-subtle border-success shadow-xs"
                                                            : "bg-white shadow-2xs"
                                                    }`}
                                                >
                                                    <div className="d-flex align-items-start gap-3">
                                                        <div className="position-relative flex-shrink-0">
                                                            <img
                                                                src={resident.avatarUrl}
                                                                alt={resident.displayName}
                                                                className="rounded-circle border"
                                                                style={{ width: 48, height: 48, objectFit: 'cover' }}
                                                                onError={(e) => {
                                                                    (e.currentTarget as HTMLImageElement).src =
                                                                        "https://acnhcdn.com/latest/NpcIcon/der00.png";
                                                                }}
                                                            />
                                                            <span
                                                                className="position-absolute bottom-0 end-0 rounded-circle border border-2 border-white"
                                                                style={{
                                                                    width: 12,
                                                                    height: 12,
                                                                    backgroundColor:
                                                                        resident.status === "on_island"
                                                                            ? "#3b82f6"
                                                                            : resident.status === "ordering"
                                                                            ? "#f59e0b"
                                                                            : "#22c55e",
                                                                }}
                                                            />
                                                        </div>

                                                        <div className="flex-grow-1 min-w-0">
                                                            <div className="d-flex align-items-center gap-1.5 flex-wrap">
                                                                <strong className="text-dark text-truncate" style={{ maxWidth: 120 }}>
                                                                    {resident.displayName}
                                                                </strong>
                                                                {resident.isCurrentUser && (
                                                                    <span className="badge bg-warning text-dark rounded-pill tiny-text fw-bold">
                                                                        You
                                                                    </span>
                                                                )}
                                                                {profileWavedMap[resident.id] && (
                                                                    <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill tiny-text fw-bold animate-bounce-gentle">
                                                                        👋 Waved!
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="tiny-text text-muted mt-0.5">
                                                                IGN: <strong>{resident.ign}</strong> · 🏝️ {resident.islandName}
                                                            </div>
                                                            <div className="mt-1.5">
                                                                <span
                                                                    className="badge rounded-pill px-2.5 py-1 tiny-text fw-normal text-wrap"
                                                                    style={{
                                                                        backgroundColor:
                                                                            resident.status === "on_island"
                                                                                ? "#eff6ff"
                                                                                : resident.status === "ordering"
                                                                                ? "#fffbeb"
                                                                                : "#f0fdf4",
                                                                        color:
                                                                            resident.status === "on_island"
                                                                                ? "#1d4ed8"
                                                                                : resident.status === "ordering"
                                                                                ? "#b45309"
                                                                                : "#15803d",
                                                                    }}
                                                                >
                                                                    {resident.currentActivity}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="d-flex align-items-center justify-content-between mt-3 pt-2 border-top">
                                                        {!resident.isCurrentUser ? (
                                                            <button
                                                                type="button"
                                                                className={`btn btn-xs rounded-pill px-2.5 py-1 border shadow-2xs fw-bold transition-all ${
                                                                    profileWavedMap[resident.id]
                                                                        ? "btn-success text-white"
                                                                        : "btn-outline-secondary"
                                                                }`}
                                                                style={{
                                                                    transform: profileWavedMap[resident.id] ? "scale(0.97)" : "scale(1)",
                                                                    cursor: profileWavedMap[resident.id] ? "default" : "pointer",
                                                                }}
                                                                disabled={Boolean(profileWavedMap[resident.id])}
                                                                onClick={() => handleProfileWave(resident)}
                                                            >
                                                                {profileWavedMap[resident.id] ? (
                                                                    <span className="d-inline-flex align-items-center gap-1">
                                                                        <i className="fa-solid fa-check"></i> Waved!
                                                                    </span>
                                                                ) : (
                                                                    "👋 Wave"
                                                                )}
                                                            </button>
                                                        ) : (
                                                            <span className="badge bg-secondary-subtle text-secondary rounded-pill px-2.5 py-1 tiny-text fw-bold">
                                                                ✨ That's You
                                                            </span>
                                                        )}

                                                        {resident.hasPublicPassport ? (
                                                            <Link
                                                                to={`/u/${resident.username}`}
                                                                className="btn btn-xs btn-outline-success rounded-pill px-2.5 fw-bold text-decoration-none"
                                                            >
                                                                View Passport <i className="fa-solid fa-arrow-up-right-from-square ms-0.5"></i>
                                                            </Link>
                                                        ) : (
                                                            <span className="tiny-text text-muted fst-italic">Private Passport</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* ── SUB-TAB 2: ISLAND OCCUPANCY ── */}
                            {communitySubTab === "islands" && (
                                <div className="pf-card">
                                    <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
                                        <div>
                                            <h3 className="h5 ac-font text-dark mb-1">
                                                All In The Islands ({liveOccupancy.totalVisitors} Active Players)
                                            </h3>
                                            <p className="tiny-text text-muted mb-0">
                                                Real-time passenger counts and available gates across all public and subscriber islands.
                                            </p>
                                        </div>

                                        <Link to="/islands" className="btn btn-sm btn-nook rounded-pill px-3 fw-bold">
                                            View Flight Board <i className="fa-solid fa-arrow-right ms-1"></i>
                                        </Link>
                                    </div>

                                    {/* Occupancy Progress Meter */}
                                    <div className="bg-light p-3.5 rounded-4 border mb-4">
                                        <div className="d-flex align-items-center justify-content-between mb-2">
                                            <span className="small fw-bold text-dark">
                                                Overall Island Capacity ({liveOccupancy.totalVisitors} / {liveOccupancy.maxCapacity} Seats Occupied)
                                            </span>
                                            <span className="badge bg-primary text-white rounded-pill px-2.5 py-0.5 fw-bold">
                                                {liveOccupancy.percentFull}% Capacity
                                            </span>
                                        </div>
                                        <div className="progress rounded-pill overflow-hidden" style={{ height: 10 }}>
                                            <div
                                                className="progress-bar bg-success progress-bar-striped progress-bar-animated"
                                                role="progressbar"
                                                style={{ width: `${liveOccupancy.percentFull}%` }}
                                                aria-valuenow={liveOccupancy.percentFull}
                                                aria-valuemin={0}
                                                aria-valuemax={100}
                                            />
                                        </div>
                                    </div>

                                    {/* Island Breakdown Rows */}
                                    <div className="vstack gap-2.5">
                                        {liveOccupancy.busiestIslands.map((island) => (
                                            <div
                                                key={island.name}
                                                className="p-3 rounded-4 bg-white border shadow-2xs d-flex align-items-center justify-content-between flex-wrap gap-2"
                                            >
                                                <div className="d-flex align-items-center gap-3">
                                                    <div
                                                        className="rounded-circle d-flex align-items-center justify-content-center text-white flex-shrink-0"
                                                        style={{
                                                            width: 40,
                                                            height: 40,
                                                            backgroundColor: island.visitors >= 7 ? '#ef4444' : '#16a34a',
                                                            fontSize: '1rem',
                                                        }}
                                                    >
                                                        <i className="fa-solid fa-plane"></i>
                                                    </div>
                                                    <div>
                                                        <div className="d-flex align-items-center gap-2">
                                                            <strong className="text-dark ac-font">{island.name}</strong>
                                                            <span className="badge bg-light text-muted border rounded-pill tiny-text">
                                                                {island.cat === 'member' ? 'Subscriber Only' : 'Public Access'}
                                                            </span>
                                                        </div>
                                                        <div className="tiny-text text-muted">
                                                            Status: <strong>{island.status || 'ONLINE'}</strong> · Passengers: {island.visitors}/7 seats
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="d-flex align-items-center gap-3">
                                                    <div className="d-flex align-items-center gap-1">
                                                        {Array.from({ length: 7 }).map((_, i) => (
                                                            <span
                                                                key={i}
                                                                style={{
                                                                    width: 12,
                                                                    height: 12,
                                                                    borderRadius: 3,
                                                                    backgroundColor: i < island.visitors ? '#16a34a' : '#e2e8f0',
                                                                    display: 'inline-block',
                                                                }}
                                                            />
                                                        ))}
                                                    </div>

                                                    <Link
                                                        to="/islands"
                                                        className="btn btn-xs btn-outline-secondary rounded-pill px-3 fw-bold"
                                                    >
                                                        Fly to Island
                                                    </Link>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* ── SUB-TAB 3: ALL-TIME WEBSITE VISITS ── */}
                            {communitySubTab === "visits" && (
                                <div className="pf-card text-center p-4 p-md-5">
                                    <div className="text-muted tiny-text fw-bold text-uppercase mb-2">
                                        NOOK INC. DAL FLIGHT DISPATCHER TELEMETRY
                                    </div>
                                    <h3 className="h3 ac-font text-dark mb-4">
                                        All-Time Website Flights &amp; Resident Visits
                                    </h3>

                                    <div className="d-inline-flex align-items-center justify-content-center gap-1.5 p-3 rounded-4 bg-dark border shadow-sm mb-4">
                                        {String(trafficStats.allTimeVisits).padStart(7, '0').split('').map((digit, idx) => (
                                            <div
                                                key={idx}
                                                className="px-3 py-2 rounded-3 text-warning fw-black fs-2 font-monospace"
                                                style={{
                                                    background: '#0f172a',
                                                    border: '2px solid #334155',
                                                    minWidth: '2.5rem',
                                                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)',
                                                }}
                                            >
                                                {digit}
                                            </div>
                                        ))}
                                    </div>

                                    <p className="text-muted small max-w-lg mx-auto mb-4">
                                        Recorded across every community visit, Dodo flight code retrieval, inventory catalog query, and order bot execution.
                                    </p>

                                    <div className="row g-3 max-w-xl mx-auto">
                                        <div className="col-4">
                                            <div className="p-3 bg-light rounded-4 border">
                                                <div className="tiny-text text-muted fw-bold">TODAY</div>
                                                <div className="fs-4 fw-black text-success mt-1">{trafficStats.visitsToday.toLocaleString()}</div>
                                            </div>
                                        </div>
                                        <div className="col-4">
                                            <div className="p-3 bg-light rounded-4 border">
                                                <div className="tiny-text text-muted fw-bold">THIS WEEK</div>
                                                <div className="fs-4 fw-black text-primary mt-1">{trafficStats.visitsThisWeek.toLocaleString()}</div>
                                            </div>
                                        </div>
                                        <div className="col-4">
                                            <div className="p-3 bg-light rounded-4 border">
                                                <div className="tiny-text text-muted fw-bold">ONLINE NOW</div>
                                                <div className="fs-4 fw-black text-warning mt-1">{trafficStats.activeOnlineCount}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ── SAVED CHARACTER ADD / EDIT MODAL ── */}
            {characterModalOpen && (
                <div
                    className="char-modal-backdrop"
                    onClick={() => setCharacterModalOpen(false)}
                    role="dialog"
                    aria-modal="true"
                    aria-label={editingCharId ? "Edit In-Game Character" : "Add In-Game Character"}
                >
                    <div
                        className="char-modal-card"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="char-modal-header">
                            <div className="d-flex align-items-center gap-2.5">
                                <div className="char-modal-header-icon">
                                    <i className={`fa-solid ${charIcon}`}></i>
                                </div>
                                <div>
                                    <h3 className="char-modal-title ac-font">
                                        {editingCharId ? "Edit In-Game Character" : "Add In-Game Character"}
                                    </h3>
                                    <div className="char-modal-subtitle">
                                        {editingCharId ? "Update resident passport details" : "Register a resident for bot orders & passport"}
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                className="btn-close"
                                aria-label="Close"
                                onClick={() => setCharacterModalOpen(false)}
                            />
                        </div>

                        <form onSubmit={handleSaveCharacterModal} className="d-flex flex-column" style={{ minHeight: 0 }}>
                            <div className="char-modal-body">
                                {charError && (
                                    <div className="alert alert-danger py-2 px-3 small rounded-3 mb-3 fw-bold">
                                        <i className="fa-solid fa-circle-exclamation me-1"></i> {charError}
                                    </div>
                                )}

                                <div className="row g-2.5 mb-3">
                                    <div className="col-12 col-sm-6">
                                        <label className="char-modal-input-label" htmlFor="profileCharIgn">
                                            <i className="fa-solid fa-user text-success"></i>
                                            <span>In-Game Name (IGN)</span>
                                            <span className="text-danger">*</span>
                                        </label>
                                        <input
                                            id="profileCharIgn"
                                            type="text"
                                            className="char-modal-input"
                                            placeholder="e.g. Bitress"
                                            value={charIgn}
                                            onChange={(e) => setCharIgn(e.target.value)}
                                            maxLength={24}
                                            autoFocus
                                        />
                                        <div className="tiny-text text-muted mt-1">Exact ACNH player name</div>
                                    </div>

                                    <div className="col-12 col-sm-6">
                                        <label className="char-modal-input-label" htmlFor="profileCharIsland">
                                            <i className="fa-solid fa-mountain-sun text-success"></i>
                                            <span>Island Name</span>
                                            <span className="text-danger">*</span>
                                        </label>
                                        <input
                                            id="profileCharIsland"
                                            type="text"
                                            className="char-modal-input"
                                            placeholder="e.g. Cheurnice"
                                            value={charIsland}
                                            onChange={(e) => setCharIsland(e.target.value)}
                                            maxLength={24}
                                        />
                                        <div className="tiny-text text-muted mt-1">Your ACNH island name</div>
                                    </div>
                                </div>

                                {/* Icon Picker */}
                                <div>
                                    <div className="d-flex align-items-center justify-content-between mb-2">
                                        <label className="char-modal-input-label mb-0">
                                            <i className="fa-solid fa-icons text-success"></i>
                                            <span>Character Badge Icon</span>
                                        </label>
                                        <span className="badge bg-success bg-opacity-10 text-success rounded-pill x-small fw-bold px-2 py-0.5">
                                            {CHARACTER_ICONS.find((i) => i.id === charIcon)?.label || "Selected"}
                                        </span>
                                    </div>
                                    <div className="char-icon-grid">
                                        {CHARACTER_ICONS.map((iconItem) => {
                                            const isIconActive = charIcon === iconItem.id;
                                            return (
                                                <button
                                                    key={iconItem.id}
                                                    type="button"
                                                    className={`char-icon-btn ${isIconActive ? "active" : ""}`}
                                                    onClick={() => {
                                                        setCharIcon(iconItem.id);
                                                        playChimeClick();
                                                    }}
                                                    title={iconItem.label}
                                                    aria-label={iconItem.label}
                                                >
                                                    <i className={`fa-solid ${iconItem.id}`}></i>
                                                    <span>{iconItem.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Discord Server Nickname Auto-Sync Section */}
                                <div className="mt-3 pt-3 border-top">
                                    <div className="d-flex align-items-center justify-content-between mb-2">
                                        <label className="d-flex align-items-center gap-2 mb-0 fw-bold small text-dark" style={{ cursor: "pointer" }}>
                                            <input
                                                type="checkbox"
                                                className="form-check-input mt-0"
                                                checked={syncToDiscordNick}
                                                onChange={(e) => setSyncToDiscordNick(e.target.checked)}
                                            />
                                            <i className="fa-brands fa-discord text-primary"></i>
                                            <span>Update Discord Server Nickname</span>
                                        </label>
                                        <span className="badge bg-primary bg-opacity-10 text-primary rounded-pill x-small fw-bold px-2 py-0.5">
                                            Auto-Sync
                                        </span>
                                    </div>

                                    {syncToDiscordNick && (
                                        <div className="p-2.5 rounded-3 bg-light border">
                                            <div className="d-flex align-items-center justify-content-between mb-1.5">
                                                <span className="tiny-text text-muted fw-bold text-uppercase">
                                                    Discord Nickname Preview
                                                </span>
                                                <span className={`tiny-text font-monospace ${targetDiscordNick.length > 32 ? "text-danger fw-bold" : "text-muted"}`}>
                                                    {targetDiscordNick.length}/32 chars
                                                </span>
                                            </div>

                                            <div className="input-group input-group-sm">
                                                <span className="input-group-text bg-white text-primary border-end-0">
                                                    <i className="fa-brands fa-discord"></i>
                                                </span>
                                                <input
                                                    type="text"
                                                    className="form-control form-control-sm border-start-0 font-monospace fw-bold"
                                                    placeholder="IGN1/IGN2/IGN3 | Island1/Island2/Island3"
                                                    value={targetDiscordNick}
                                                    onChange={(e) => {
                                                        setTargetDiscordNick(e.target.value.slice(0, 32));
                                                        setCustomizedNick(true);
                                                    }}
                                                    maxLength={32}
                                                />
                                            </div>

                                            <div className="tiny-text text-muted mt-2 d-flex align-items-center gap-1">
                                                <i className="fa-solid fa-circle-check text-success"></i>
                                                <span>Automatically syncs Slots 1, 2, and 3 using "/" between IGNs and "|" before Island names.</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="char-modal-footer">
                                <button
                                    type="button"
                                    className="btn btn-outline-secondary rounded-pill fw-bold px-4 py-2"
                                    onClick={() => setCharacterModalOpen(false)}
                                    disabled={isSavingChar}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingChar}
                                    className="btn btn-success text-white rounded-pill fw-bold px-4 py-2 shadow-sm d-flex align-items-center gap-2"
                                    style={{ backgroundColor: "#37b06d", borderColor: "#37b06d" }}
                                >
                                    <i className={isSavingChar ? "fa-solid fa-spinner fa-spin" : editingCharId ? "fa-solid fa-check" : "fa-solid fa-cloud-arrow-up"}></i>
                                    <span>{isSavingChar ? "Saving & Syncing..." : editingCharId ? "Save Changes & Sync" : "Create & Save Character"}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── 3. UPDATE DISCORD SERVER NICKNAME MODAL ───────────────────── */}
            {discordNickModalOpen && (
                <div className="modal show d-block" style={{ backgroundColor: "rgba(0, 0, 0, 0.65)", zIndex: 1060, backdropFilter: "blur(4px)" }} tabIndex={-1}>
                    <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: "520px" }}>
                        <div className="modal-content rounded-4 border-0 shadow-lg overflow-hidden animate-fade">
                            <div className="modal-header text-white p-3 px-4" style={{ background: "linear-gradient(135deg, #5865F2 0%, #4752C4 100%)" }}>
                                <div className="d-flex align-items-center gap-2">
                                    <div className="icon-bubble bg-white bg-opacity-20 text-white" style={{ width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                        <i className="fa-brands fa-discord"></i>
                                    </div>
                                    <div>
                                        <h5 className="modal-title ac-font fw-bold mb-0 text-white">Update Discord Server Nickname</h5>
                                        <span className="tiny-text text-white text-opacity-75">Syncs directly to ChoPaeng Discord server</span>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    className="btn-close btn-close-white"
                                    onClick={() => setDiscordNickModalOpen(false)}
                                    aria-label="Close"
                                />
                            </div>

                            <form onSubmit={handleSaveDiscordNick}>
                                <div className="modal-body p-4">
                                    {nickModalMessage && (
                                        <div className={`alert alert-${nickModalMessage.type} p-3 rounded-3 small mb-3 animate-fade`}>
                                            <i className={`fa-solid ${nickModalMessage.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'} me-2`}></i>
                                            {nickModalMessage.text}
                                        </div>
                                    )}

                                    {/* Discord Visual Preview Box */}
                                    <label className="text-uppercase tiny-text fw-bold text-muted d-block mb-1">
                                        Discord Member Preview
                                    </label>
                                    <div className="discord-chat-preview-box mb-3 d-flex align-items-center gap-3">
                                        <img
                                            src={profileUser?.avatar || authUser?.avatar || "https://cdn.discordapp.com/embed/avatars/0.png"}
                                            alt="Avatar"
                                            className="discord-avatar-circle"
                                        />
                                        <div className="overflow-hidden">
                                            <div className="d-flex align-items-center gap-2">
                                                <span className="discord-member-name text-truncate">
                                                    {newDiscordNick.trim() || profileUser?.discord_name || authUser?.username || "Resident"}
                                                </span>
                                                <span className="badge bg-secondary text-white tiny-text py-0 px-1" style={{ fontSize: '0.65rem' }}>
                                                    MEMBER
                                                </span>
                                            </div>
                                            <span className="tiny-text text-secondary d-block">
                                                @{profileUser?.discord_name || authUser?.username}
                                            </span>
                                        </div>
                                    </div>


                                    {/* Nickname Input Field */}
                                    <div className="mb-3">
                                        <div className="d-flex align-items-center justify-content-between mb-1">
                                            <label className="text-uppercase tiny-text fw-bold text-dark" htmlFor="discordNickInput">
                                                Server Nickname
                                            </label>
                                            <span className={`tiny-text font-monospace ${newDiscordNick.length > 32 ? 'text-danger fw-bold' : 'text-muted'}`}>
                                                {newDiscordNick.length} / 32 chars
                                            </span>
                                        </div>
                                        <input
                                            id="discordNickInput"
                                            type="text"
                                            maxLength={32}
                                            className="form-control rounded-3 font-monospace fw-bold"
                                            placeholder="e.g. Character Name | Island Name"
                                            value={newDiscordNick}
                                            onChange={(e) => setNewDiscordNick(e.target.value)}
                                            required
                                        />
                                        <span className="tiny-text text-muted d-block mt-1">
                                            <i className="fa-solid fa-circle-info me-1 text-primary"></i>
                                            Server standard format: <code>Character Name | Island Name</code>. Max 32 characters.
                                        </span>
                                    </div>
                                </div>

                                <div className="modal-footer border-top bg-light p-3 px-4 d-flex justify-content-between align-items-center">
                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary rounded-pill fw-bold px-4"
                                        onClick={() => setDiscordNickModalOpen(false)}
                                        disabled={updatingNick}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={updatingNick || !newDiscordNick.trim() || newDiscordNick.length > 32}
                                        className="btn btn-primary fw-bold rounded-pill px-4 shadow-sm d-flex align-items-center gap-2"
                                        style={{ backgroundColor: '#5865F2', borderColor: '#5865F2' }}
                                    >
                                        <i className={updatingNick ? "fa-solid fa-spinner fa-spin" : "fa-brands fa-discord"}></i>
                                        <span>{updatingNick ? "Updating Discord..." : "Update on Discord"}</span>
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* ── 4. CONFIRM DISCORD SYNC WARNING MODAL ───────────────────────── */}
            {syncDiscordModalOpen && (
                <div
                    className="modal show d-block"
                    tabIndex={-1}
                    style={{ backgroundColor: "rgba(0,0,0,0.65)", zIndex: 1060, backdropFilter: "blur(4px)" }}
                >
                    <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: "520px" }}>
                        <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden animate-fade">
                            <div className="modal-header border-bottom bg-warning bg-opacity-10 py-3 px-4 d-flex align-items-center justify-content-between">
                                <div className="d-flex align-items-center gap-2">
                                    <span className="badge bg-warning text-dark rounded-circle p-2 d-flex align-items-center justify-content-center" style={{ width: 32, height: 32 }}>
                                        <i className="fa-solid fa-triangle-exclamation"></i>
                                    </span>
                                    <h3 className="modal-title h5 ac-font text-dark mb-0">
                                        Sync from Discord Warning
                                    </h3>
                                </div>
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={() => setSyncDiscordModalOpen(false)}
                                    aria-label="Close"
                                />
                            </div>

                            <div className="modal-body p-4">
                                {/* Warning Notice Box */}
                                <div className="alert alert-warning border border-warning border-opacity-30 rounded-3 p-3 mb-3">
                                    <div className="d-flex gap-2 align-items-start">
                                        <i className="fa-solid fa-triangle-exclamation text-warning mt-1 flex-shrink-0"></i>
                                        <div className="small text-dark">
                                            <strong className="d-block mb-1">Overwriting Saved Character Slots</strong>
                                            Syncing from Discord will <strong>replace and overwrite</strong> your current saved character slots ({characters.length} configured) with the in-game names parsed from your Discord nickname.
                                        </div>
                                    </div>
                                </div>

                                <div className="mb-3">
                                    <label className="text-uppercase tiny-text fw-bold text-muted d-block mb-1">
                                        Current Discord Nickname
                                    </label>
                                    <div className="p-2 px-3 bg-light rounded-3 font-monospace small text-primary fw-bold border">
                                        <i className="fa-brands fa-discord me-2"></i>
                                        {rawDiscordName}
                                    </div>
                                </div>

                                {/* Preview of Parsed Characters */}
                                <div className="mb-3">
                                    <label className="text-uppercase tiny-text fw-bold text-muted d-block mb-1">
                                        Parsed Characters to Import
                                    </label>
                                    {(() => {
                                        const parsed = parseDiscordNicknameToCharacters(rawDiscordName);
                                        if (parsed.length === 0) {
                                            return (
                                                <div className="alert alert-danger p-3 rounded-3 small mb-0">
                                                    <i className="fa-solid fa-circle-exclamation me-1"></i>
                                                    No IGN / Island Name pattern detected in <code>"{rawDiscordName}"</code>.
                                                    <div className="tiny-text mt-1 text-muted">
                                                        Expected format: <code>IGN / Island Name</code> or <code>IGN1 / Island1 | IGN2 / Island2</code>.
                                                    </div>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div className="d-flex flex-column gap-2">
                                                {parsed.slice(0, 3).map((p, idx) => (
                                                    <div key={idx} className="d-flex align-items-center justify-content-between p-2 px-3 bg-white border border-success border-opacity-30 rounded-3 shadow-2xs">
                                                        <div className="d-flex align-items-center gap-2">
                                                            <span className="badge bg-success bg-opacity-10 text-success rounded-pill x-small fw-bold">
                                                                Slot #{idx + 1}
                                                            </span>
                                                            <strong className="text-dark small">{p.ign}</strong>
                                                            <span className="tiny-text text-muted">from {p.islandName}</span>
                                                        </div>
                                                        <span className="badge bg-light text-muted x-small">
                                                            {idx === 0 ? "Default" : "Secondary"}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })()}
                                </div>

                                <p className="tiny-text text-muted mb-0">
                                    <i className="fa-solid fa-info-circle me-1"></i>
                                    If you have custom titles or icons configured, syncing will reset them to default values.
                                </p>
                            </div>

                            <div className="modal-footer border-top bg-light p-3 px-4 d-flex justify-content-between align-items-center">
                                <button
                                    type="button"
                                    className="btn btn-outline-secondary rounded-pill fw-bold px-4"
                                    onClick={() => setSyncDiscordModalOpen(false)}
                                >
                                    Cancel
                                </button>
                                {(() => {
                                    const parsed = parseDiscordNicknameToCharacters(rawDiscordName);
                                    const hasParsed = parsed.length > 0;
                                    return (
                                        <button
                                            type="button"
                                            disabled={!hasParsed}
                                            className={`btn btn-warning text-dark fw-bold rounded-pill px-4 shadow-sm d-flex align-items-center gap-2 ${!hasParsed ? 'opacity-50' : ''}`}
                                            onClick={() => {
                                                const count = syncFromDiscordNickname(rawDiscordName);
                                                setSyncDiscordModalOpen(false);
                                                setPrefNotice(
                                                    count > 0
                                                        ? `Synced ${count} character slot${count > 1 ? "s" : ""} from Discord ("${rawDiscordName}")!`
                                                        : `No IGN/Island pattern detected in "${rawDiscordName}".`
                                                );
                                                setTimeout(() => setPrefNotice(null), 3500);
                                                playChimeClick();
                                            }}
                                        >
                                            <i className="fa-solid fa-arrows-rotate"></i>
                                            <span>Overwrite &amp; Sync</span>
                                        </button>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

interface PaginatedTableProps {
    columns: string[];
    rows: string[][];
    searchable?: boolean;
    perPage?: number;
}

const PaginatedTable = ({ columns, rows, searchable = true, perPage = 5 }: PaginatedTableProps) => {
    const tableRef = useRef<HTMLTableElement | null>(null);

    const tableKey = useMemo(
        () => `${columns.join("|")}::${rows.length}::${rows.map((row) => row.join(",")).join(";")}`,
        [columns, rows]
    );

    useEffect(() => {
        if (!tableRef.current || rows.length === 0) return;

        let dataTable: import("simple-datatables").DataTable | undefined;

        Promise.all([
            import("simple-datatables"),
            import("simple-datatables/dist/style.css"),
        ]).then(([{ DataTable }]) => {
            if (!tableRef.current) return;
            dataTable = new DataTable(tableRef.current, {
                searchable,
                perPage,
                perPageSelect: [5, 10, 25],
                fixedHeight: false,
                labels: {
                    placeholder: "Search flights...",
                    perPage: "rows per page",
                    noRows: "No flight logs found",
                    info: "Showing {start} to {end} of {rows} logs",
                },
            });
        });

        return () => dataTable?.destroy();
    }, [tableKey, searchable, perPage, rows.length]);

    return (
        <div className="profile-table-wrap mb-2">
            <table ref={tableRef} className="table table-hover align-middle mb-0 profile-table">
                <thead>
                    <tr>
                        {columns.map((column) => (
                            <th key={column} scope="col">
                                {column}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, rowIndex) => (
                        <tr key={`${row.join("-")}-${rowIndex}`}>
                            {row.map((cell, cellIndex) => (
                                <td key={`${cell}-${cellIndex}`}>{cell || "Not available"}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

interface IslandVisitTableProps {
    visits: VisitIsland[];
    emptyText: string;
    showDate?: boolean;
}

const IslandVisitTable = ({ visits, emptyText, showDate = false }: IslandVisitTableProps) => {
    const columns = useMemo(
        () => (showDate ? ["Island", "Type", "Status", "Visited", "Visits"] : ["Island", "Type", "Status", "Visits"]),
        [showDate]
    );

    const rows = useMemo(
        () =>
            visits.map((visit) => {
                const base = [
                    visit.island_name ?? visit.name ?? visit.island_id ?? "Island",
                    visit.type ?? "Treasure island",
                    visit.authorized === false ? "Denied" : "Authorized",
                ];

                return showDate
                    ? [
                          ...base,
                          formatDate(visit.visited_at ?? visit.last_visit),
                          formatNumber(visit.visits ?? visit.count ?? 1),
                      ]
                    : [...base, formatNumber(visit.visits ?? visit.count ?? 1)];
            }),
        [visits, showDate]
    );

    if (visits.length === 0) {
        return <div className="bg-light border rounded-3 p-3 text-muted fw-bold small">{emptyText}</div>;
    }

    return <PaginatedTable columns={columns} rows={rows} />;
};

export default Profile;