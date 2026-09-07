import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useIslandData } from "../context/useIslandData";
import { useAuth } from "../context/useAuth";
import { getAuthToken } from "../context/authToken";
import { useFavoriteIslands } from "../hooks/useFavoriteIslands";
import { fetchBotStatus, type BotStatusResponse } from "../utils/orderBotApi";
import RevealErrorPopup from "../components/RevealErrorPopup";
import DisclaimerBanner from "../components/DisclaimerBanner";
import { DODO_API_BASE } from "../config/api";
import { 
    DODO_PLACEHOLDER, 
    ISLAND_STATUS, 
    ISLAND_CATEGORY, 
    DODO_UI_CONFIG 
} from "../config/constants";
import type { DodoUiState } from "../config/constants";
import { ResidentVillagerPill } from "../components/island/ResidentVillagerPill";
import { IslandMapPolaroid } from "../components/island/IslandMapPolaroid";
import { DALFlightBoard } from "../components/island/DALFlightBoard";
import { IslandActionArea } from "../components/island/IslandActionArea";
import { InteractiveIslandMapModal } from "../components/island/InteractiveIslandMapModal";
import "./IslandDetail.css";


// ─────────────────────────────────────────────────────────────
// Dodo-code button: derived UI state + lookup table
// (replaces three duplicated nested-ternary chains)
// ─────────────────────────────────────────────────────────────


function getDodoUiState(params: {
    copied: boolean;
    isFreeIsland: boolean;
    freeLiveCode: string | null;
    revealedCode: string | null;
    isRevealing: boolean;
    isRevealableState: boolean;
    needsAuth: boolean;
    user: unknown;
}): DodoUiState {
    const { copied, isFreeIsland, freeLiveCode, revealedCode, isRevealing, isRevealableState, needsAuth, user } =
        params;

    if (copied) return "copied";
    if (isFreeIsland && freeLiveCode) return "free-available";
    if (revealedCode) return "revealed";
    if (isRevealing) return "revealing";
    if (isRevealableState && !needsAuth) return "revealable";
    if (!user) return "needs-login";
    if (needsAuth) return "needs-membership";
    return "gate-closed";
}





async function copyToClipboard(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (e) {
        console.error("Clipboard write failed:", e);
        return false;
    }
}

// ─────────────────────────────────────────────────────────────
// IslandDetail
// ─────────────────────────────────────────────────────────────
const IslandDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { islands, villagersMap, loading } = useIslandData();
    const { user, login, canAccessIsland } = useAuth();
    const { isFavoriteIsland, toggleFavoriteIsland } = useFavoriteIslands();

    const [showImageModal, setShowImageModal] = useState(false);
    const [revealedCode, setRevealedCode] = useState<string | null>(null);
    const [isRevealing, setIsRevealing] = useState(false);
    const [copied, setCopied] = useState(false);
    const [revealError, setRevealError] = useState<string | null>(null);
    const [botStatus, setBotStatus] = useState<BotStatusResponse | null>(null);
    const [botLoading, setBotLoading] = useState(false);
    const revealInFlightRef = useRef(false);
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    // Fetch Order Bot status for live queue and bot health
    useEffect(() => {
        let timer: ReturnType<typeof setInterval> | null = null;
        let isMounted = true;

        const loadBotStatus = async () => {
            try {
                const token = getAuthToken();
                const res = await fetchBotStatus(token);
                if (isMounted) {
                    setBotStatus(res);
                    setBotLoading(false);
                }
            } catch {
                if (isMounted) setBotLoading(false);
            }
        };

        setBotLoading(true);
        loadBotStatus();
        timer = setInterval(loadBotStatus, 20_000);

        return () => {
            isMounted = false;
            if (timer) clearInterval(timer);
        };
    }, []);

    // Close the image modal on Escape for keyboard accessibility
    useEffect(() => {
        if (!showImageModal) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") setShowImageModal(false);
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [showImageModal]);

    const island = useMemo(() => {
        const found = islands.find((i) => i.id === id);
        if (!found) return null;

        return {
            ...found,
            live: {
                dodo: found.dodoCode,
                status: found.status,
                access:
                    found.cat === ISLAND_CATEGORY.MEMBER
                        ? "SUB ONLY"
                        : found.cat === ISLAND_CATEGORY.ORDER
                            ? "ORDER BOT"
                            : "PUBLIC",
                visitors: found.visitors?.toString() || "0",
                isSubOnly: found.cat === ISLAND_CATEGORY.MEMBER,
                isOnline: found.discordBotOnline === true,
            },
        };
    }, [islands, id]);

    if (!island) {
        return (
            <div className="nook-bg min-vh-100 d-flex align-items-center justify-content-center">
                <div className="text-center">
                    <i className="fa-solid fa-plane-slash fa-3x mb-3 opacity-50"></i>
                    <h2 className="fw-black">Destination Not Found</h2>
                    <button onClick={() => navigate("/maps")} className="btn btn-link text-success fw-bold">
                        Return Home
                    </button>
                </div>
            </div>
        );
    }

    const live = island.live;
    const isOrderIsland = island.cat === ISLAND_CATEGORY.ORDER;
    const isSubIsland = island.cat === ISLAND_CATEGORY.MEMBER || live?.access === "SUB ONLY";
    const isFreeIsland = !isSubIsland && !isOrderIsland;
    const isRevealableState = live?.status !== ISLAND_STATUS.OFFLINE && live?.dodo !== DODO_PLACEHOLDER.GETTING;
    const freeLiveCode =
        isFreeIsland &&
            live?.dodo &&
            !Object.values(DODO_PLACEHOLDER).includes(live.dodo as (typeof DODO_PLACEHOLDER)[keyof typeof DODO_PLACEHOLDER])
            ? live.dodo
            : null;
    const requiredRoles = island.requiredRoles ?? [];
    const hasMemberAccess = isFreeIsland
        ? true
        : island.accessible ?? island.viewerHasAccess ?? (requiredRoles.length > 0 && canAccessIsland(requiredRoles));
    const needsAuth = !isFreeIsland && !hasMemberAccess;
    const canShowDodo = isOrderIsland ? false : isFreeIsland ? !!freeLiveCode : !!(isRevealableState && !needsAuth);
    const mapImageSrc = island.mapUrl || `https://cdn.chopaeng.com/maps/${island.name.toLowerCase()}.png`;

    const flashCopied = () => {
        setCopied(true);
        setTimeout(() => {
            if (isMountedRef.current) setCopied(false);
        }, 2000);
    };

    const onRevealCode = async () => {
        setRevealError(null);
        if (isOrderIsland) {
            setRevealError(
                "This is an order-bot island. Use the Discord or Twitch order channel to place your order and receive a Dodo Code."
            );
            return;
        }
        // Free islands do not require reveal/auth; copy the live code directly.
        if (isFreeIsland) {
            if (freeLiveCode) {
                const ok = await copyToClipboard(freeLiveCode);
                if (ok) flashCopied();
                else setRevealError("Couldn't copy to clipboard. Please copy the code manually.");
            } else {
                setRevealError("No live dodo code available right now.");
            }
            return;
        }
        if (revealedCode) {
            const ok = await copyToClipboard(revealedCode);
            if (ok) flashCopied();
            else setRevealError("Couldn't copy to clipboard. Please copy the code manually.");
            return;
        }
        if (!user) {
            login();
            return;
        }
        if (needsAuth) {
            navigate("/membership");
            return;
        }
        if (revealInFlightRef.current) return;

        revealInFlightRef.current = true;
        setIsRevealing(true);
        try {
            const token = getAuthToken();
            const resp = await fetch(`${DODO_API_BASE}/api/islands/${encodeURIComponent(island.name)}/dodo`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                credentials: "include",
            });
            if (!isMountedRef.current) return;

            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                if (!isMountedRef.current) return;

                if (resp.status === 401) {
                    setRevealError("Your login expired. Please login again.");
                    return;
                }
                if (resp.status === 403) {
                    setRevealError(err.error || "You do not have access to this island's dodo code.");
                    return;
                }
                if (resp.status === 404) {
                    setRevealError("Dodo code is not available right now. Please try again shortly.");
                    return;
                }
                setRevealError(err.error || "Unable to reveal dodo code right now.");
                return;
            }
            const data = await resp.json();
            if (!isMountedRef.current) return;

            const rawCode = String(data.dodo_code || "");
            const code = rawCode.includes(": ") ? rawCode.split(": ").pop() || rawCode : rawCode;
            setRevealedCode(code);

            const ok = await copyToClipboard(code);
            if (!isMountedRef.current) return;

            if (ok) {
                flashCopied();
                setRevealError(null);
            } else {
                setRevealError("Code revealed, but couldn't copy automatically. Please copy it manually.");
            }
        } catch (e) {
            console.error(e);
            if (isMountedRef.current) {
                setRevealError("Network error while revealing dodo code. Please try again.");
            }
        } finally {
            revealInFlightRef.current = false;
            if (isMountedRef.current) setIsRevealing(false);
        }
    };

    // Try exact key first, then case-insensitive key fallback.
    const villagerKey = villagersMap[island.name]
        ? island.name
        : Object.keys(villagersMap).find((key) => key.toLowerCase() === island.name.toLowerCase());
    const currentVillagers = villagerKey ? villagersMap[villagerKey] ?? [] : [];

    const capitalizeFirstLetter = (string: string) => {
        if (!string) return string;
        return string.charAt(0).toUpperCase() + string.slice(1);
    };

    const siteUrl = window.location.origin;
    const currentUrl = `${siteUrl}${location.pathname}`;
    const seoImage = mapImageSrc;
    const pageTitle = `${capitalizeFirstLetter(island.name)} ACNH Treasure Island – Map, Items & Villagers | Chopaeng`;
    const pageDesc = `${island.description ? island.description + ". " : ""
        }View the full map, available items, DIYs, Bells, villagers, and live Dodo code status for the ${capitalizeFirstLetter(
            island.name
        )} ACNH treasure island on Chopaeng.`;

    const dodoUiState = getDodoUiState({
        copied,
        isFreeIsland,
        freeLiveCode,
        revealedCode,
        isRevealing,
        isRevealableState,
        needsAuth,
        user,
    });
    const dodoUiConfig = DODO_UI_CONFIG[dodoUiState];

    return (
        <div className="nook-bg min-vh-100 py-4 py-md-5">
            <Helmet>
                <title>{pageTitle}</title>
                <meta name="description" content={pageDesc} />
                <meta
                    name="keywords"
                    content={`${capitalizeFirstLetter(
                        island.name
                    )} ACNH treasure island, ACNH treasure islands, Animal Crossing New Horizons treasure island, ${capitalizeFirstLetter(
                        island.name
                    )} island dodo code, ACNH free items, Animal Crossing treasure island`}
                />
                <link rel="canonical" href={currentUrl} />

                {/* Open Graph */}
                <meta property="og:type" content="website" />
                <meta property="og:url" content={currentUrl} />
                <meta property="og:title" content={pageTitle} />
                <meta property="og:description" content={pageDesc} />
                <meta property="og:image" content={seoImage} />
                <meta property="og:site_name" content="Chopaeng" />

                {/* Twitter Cards */}
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content={pageTitle} />
                <meta name="twitter:description" content={pageDesc} />
                <meta name="twitter:image" content={seoImage} />

                {/* Breadcrumb + Island structured data */}
                <script type="application/ld+json">
                    {JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "BreadcrumbList",
                        itemListElement: [
                            { "@type": "ListItem", position: 1, name: "Home", item: "https://www.chopaeng.com/" },
                            {
                                "@type": "ListItem",
                                position: 2,
                                name: "Islands",
                                item: "https://www.chopaeng.com/islands",
                            },
                            { "@type": "ListItem", position: 3, name: `${capitalizeFirstLetter(island.name)} Island` },
                        ],
                    })}
                </script>
            </Helmet>

            <div className="container" style={{ maxWidth: "1050px" }}>
                {/* Navigation Breadcrumb & Favorite Button */}
                <div className="d-flex align-items-center justify-content-between mb-4 px-2">
                    <div className="d-flex align-items-center">
                        <button
                            onClick={() => navigate("/islands")}
                            className="btn-nook-back me-3"
                            aria-label="Back to Islands"
                        >
                            <i className="fa-solid fa-arrow-left"></i>
                        </button>
                        <span className="text-muted fw-bold text-uppercase small tracking-wide">
                            Islands / {island.name}
                        </span>
                    </div>

                    <button
                        type="button"
                        onClick={(e) => toggleFavoriteIsland(island.id, e)}
                        className={`btn btn-sm rounded-pill px-3 py-2 fw-bold d-flex align-items-center gap-2 shadow-sm transition-all ${
                            isFavoriteIsland(island.id)
                                ? "btn-warning text-dark border-warning"
                                : "btn-white bg-white text-muted border border-light-subtle hover-shadow-sm"
                        }`}
                        title={isFavoriteIsland(island.id) ? "Remove from Favorites" : "Add to Favorites"}
                        aria-label={isFavoriteIsland(island.id) ? "Favorited" : "Add to Favorites"}
                    >
                        <i className={`${isFavoriteIsland(island.id) ? "fa-solid text-dark" : "fa-regular text-warning"} fa-star`}></i>
                        <span>{isFavoriteIsland(island.id) ? "Favorited" : "Add to Favorites"}</span>
                    </button>
                </div>

                <div className="row g-4">
                    {/* LEFT COLUMN: Map & Status */}
                    <div className="col-lg-5">
                        {/* Map Polaroid – hidden for order-bot islands */}
                        {!isOrderIsland && (
                            <IslandMapPolaroid 
                                mapImageSrc={mapImageSrc} 
                                islandName={island.name} 
                                onClick={() => setShowImageModal(true)} 
                            />
                        )}

                        {/* DAL Flight Board */}
                        <DALFlightBoard 
                            island={island} 
                            live={live} 
                            loading={loading} 
                            isOrderIsland={isOrderIsland}
                            botStatus={botStatus}
                            botLoading={botLoading}
                        />
                    </div>

                    {/* RIGHT COLUMN: Passport Info */}
                    <div className="col-lg-7">
                        <div className="passport-booklet shadow-lg">
                            {/* Passport Header with Tear-off effect */}
                            <div className="passport-header">
                                <div className="d-flex justify-content-between align-items-start position-relative z-2">
                                    <div>
                                        <div className="passport-stamp mb-2">VERIFIED</div>
                                        <h1 className="island-title">{island.name}</h1>
                                        <span className="island-badge">{island.type}</span>
                                    </div>
                                    <div className="d-flex align-items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={(e) => toggleFavoriteIsland(island.id, e)}
                                            className={`btn btn-sm rounded-circle border-0 shadow-sm d-flex align-items-center justify-content-center transition-all ${
                                                isFavoriteIsland(island.id) ? "bg-warning text-dark" : "bg-white bg-opacity-75 text-muted hover-bg-white"
                                            }`}
                                            style={{ width: 40, height: 40 }}
                                            title={isFavoriteIsland(island.id) ? "Remove from Favorites" : "Add to Favorites"}
                                            aria-label={isFavoriteIsland(island.id) ? "Favorited" : "Add to Favorites"}
                                        >
                                            <i className={`${isFavoriteIsland(island.id) ? "fa-solid text-dark" : "fa-regular text-warning"} fa-star fs-5`}></i>
                                        </button>
                                        <i className="fa-solid fa-passport fa-4x opacity-25 text-white rotate-12"></i>
                                    </div>
                                </div>
                                <div className="wave-pattern"></div>
                            </div>

                            <div className="passport-body">
                                <div className="mb-4">
                                    <h5 className="notebook-heading">
                                        <i className="fa-solid fa-bullhorn me-2 text-nook"></i>
                                        Island Bulletin
                                    </h5>
                                    <div className="notebook-lines p-3">{island.description}</div>
                                </div>

                                <div className="mb-4">
                                    <h5 className="notebook-heading">
                                        <i className="fa-solid fa-gem me-2 text-nook"></i>
                                        Available Loot
                                    </h5>
                                    <div className="d-flex flex-wrap gap-2">
                                        {(island.items ?? []).map((item) => (
                                            <div key={item} className="item-pill">
                                                <span className="dot"></span> {item}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {!isOrderIsland && (
                                <div className="mb-4">
                                    <h5 className="notebook-heading">
                                        <i className="fa-solid fa-house-user me-2 text-nook"></i>
                                        Current Residents
                                    </h5>
                                    {loading ? (
                                        <div className="notebook-lines p-2 text-muted fst-italic">
                                            <i className="fa-solid fa-circle-notch fa-spin me-2"></i> Scanning resident list...
                                        </div>
                                    ) : currentVillagers.length > 0 ? (
                                        <div className="d-flex flex-wrap gap-2">
                                            {currentVillagers.map((villager) => (
                                                <ResidentVillagerPill key={villager} villagerName={villager} />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="notebook-lines p-2 text-muted fst-italic">
                                            No residents currently tracked on this island.
                                        </div>
                                    )}
                                </div>
                                )}

                                {/* Subtle Order Bot banner for regular treasure islands */}
                                {!isOrderIsland && (
                                    <div className="card rounded-4 p-3 order-bot-suggestion-banner shadow-2xs mb-4">
                                        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                                            <div className="d-flex align-items-center gap-2">
                                                <span
                                                    className="rounded-circle d-flex align-items-center justify-content-center order-bot-suggestion-icon flex-shrink-0"
                                                    style={{ width: 36, height: 36 }}
                                                >
                                                    <i className="fa-solid fa-box-open"></i>
                                                </span>
                                                <div>
                                                    <strong className="d-block small fw-bold">Need Specific Items Delivered?</strong>
                                                    <span className="tiny-text text-muted">Use our 40-slot Order Bot for custom item & villager delivery.</span>
                                                </div>
                                            </div>

                                            <div className="d-flex gap-2 align-items-center">
                                                <Link
                                                    to="/command-builder"
                                                    className="btn btn-xs btn-outline-success rounded-pill fw-bold px-3 py-1 shadow-2xs"
                                                >
                                                    <i className="fa-solid fa-cubes-stacked me-1"></i>Build
                                                </Link>
                                                <Link
                                                    to="/order"
                                                    className="btn btn-xs btn-nook text-white rounded-pill fw-bold px-3 py-1 shadow-2xs"
                                                >
                                                    <i className="fa-solid fa-paper-plane me-1"></i>Order Bot
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="action-area">
                                    <IslandActionArea 
                                        islandName={island.name}
                                        isOrderIsland={isOrderIsland}
                                        canShowDodo={canShowDodo}
                                        needsAuth={needsAuth}
                                        onRevealCode={onRevealCode}
                                        dodoUiConfig={dodoUiConfig}
                                        isRevealableState={isRevealableState}
                                        user={user}
                                        login={login}
                                        botStatus={botStatus}
                                        botLoading={botLoading}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Interactive Ground Radar Modal */}
            <InteractiveIslandMapModal
                isOpen={showImageModal}
                onClose={() => setShowImageModal(false)}
                islandName={island.name}
                mapImageSrc={mapImageSrc}
            />

            {revealError && <RevealErrorPopup message={revealError} onClose={() => setRevealError(null)} />}

            {/* VISIBLE UNOFFICIAL FAN-SITE DISCLAIMER */}
            <DisclaimerBanner variant="footer" style={{ maxWidth: "1050px" }} />
        </div>
    );
};

export default IslandDetail;