import React from "react";
import { Link } from "react-router-dom";
import { useCommandBuilderPockets } from "../../hooks/useCommandBuilderPockets";
import type { BotStatusResponse } from "../../utils/orderBotApi";
import { ORDER_MAX } from "../../constants/limits";

interface IslandActionAreaProps {
    islandName?: string;
    isOrderIsland: boolean;
    canShowDodo: boolean;
    needsAuth: boolean;
    onRevealCode: () => void;
    dodoUiConfig: any;
    user: any;
    login: () => void;
    botStatus?: BotStatusResponse | null;
    botLoading?: boolean;
    onRefreshRoles?: () => void;
    isRefreshingRoles?: boolean;
    freeLiveCode?: string | null;
    revealedCode?: string | null;
}

const FALLBACK_IMG =
    "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23f0fdf4'/%3E%3Ctext x='50' y='62' text-anchor='middle' font-size='40'%3E📦%3C/text%3E%3C/svg%3E";

export const IslandActionArea: React.FC<IslandActionAreaProps> = ({
    islandName,
    isOrderIsland,
    canShowDodo,
    needsAuth,
    onRevealCode,
    dodoUiConfig,
    user,
    login,
    botStatus,
    botLoading,
    onRefreshRoles,
    isRefreshingRoles = false,
    freeLiveCode,
    revealedCode,
}) => {
    const { totalOrderCount, orderItems } = useCommandBuilderPockets();

    if (isOrderIsland) {
        const isOnline = botStatus?.success && botStatus.accepting_commands !== false;
        const capacityPct = Math.min(100, Math.round((totalOrderCount / ORDER_MAX) * 100));

        return (
            <div className="rounded-4 p-4 order-bot-island-card shadow-sm border">
                {/* Header */}
                <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
                    <div className="d-flex align-items-center gap-3">
                        <span className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 order-bot-icon">
                            <i className="fa-solid fa-box-open"></i>
                        </span>
                        <div>
                            <div className="fw-black order-bot-title">ORDER BOT ISLAND</div>
                            <div className="text-muted small lh-sm">
                                {islandName ? `Custom delivery for ${islandName}` : "Custom item & villager delivery"}
                            </div>
                        </div>
                    </div>

                    {/* Live Status Badge */}
                    <div>
                        {botLoading ? (
                            <span className="badge rounded-pill bg-light text-muted border px-3 py-2">
                                <span className="spinner-border spinner-border-sm me-1" style={{ width: 10, height: 10 }} />
                                Connecting…
                            </span>
                        ) : isOnline ? (
                            <span className="badge rounded-pill bg-success text-white px-3 py-2 fw-bold d-inline-flex align-items-center gap-1">
                                <span className="p-1 rounded-circle bg-white" style={{ width: 6, height: 6 }} />
                                Online
                                {typeof botStatus?.queue_count === "number" && (
                                    <span className="ms-1 opacity-75">· Queue: {botStatus.queue_count}</span>
                                )}
                            </span>
                        ) : (
                            <span className="badge rounded-pill bg-danger text-white px-3 py-2 fw-bold">
                                Offline
                            </span>
                        )}
                    </div>
                </div>

                {/* Pocket Status Preview */}
                <div className="order-bot-pocket-card rounded-4 p-3 mb-3 shadow-2xs">
                    <div className="d-flex align-items-center justify-content-between mb-2">
                        <div className="d-flex align-items-center gap-2">
                            <i className="fa-solid fa-bag-shopping text-success"></i>
                            <span className="fw-bold small">Your Loaded Pocket</span>
                        </div>
                        <span className="badge bg-success bg-opacity-10 text-success rounded-pill fw-bold x-small">
                            {totalOrderCount} / {ORDER_MAX} Slots ({capacityPct}%)
                        </span>
                    </div>

                    {/* Progress bar */}
                    <div className="progress mb-2" style={{ height: "6px", borderRadius: "10px" }}>
                        <div
                            className="progress-bar bg-success transition-all"
                            role="progressbar"
                            style={{ width: `${capacityPct}%` }}
                            aria-valuenow={totalOrderCount}
                            aria-valuemin={0}
                            aria-valuemax={ORDER_MAX}
                        />
                    </div>

                    {/* Pocket items sprite row */}
                    {orderItems.length > 0 ? (
                        <div className="d-flex align-items-center gap-1 overflow-x-auto py-1">
                            {orderItems.slice(0, 10).map((entry, idx) => (
                                <div
                                    key={`${entry.item.id}-${idx}`}
                                    className="p-1 border rounded-3 bg-light d-flex align-items-center justify-content-center flex-shrink-0"
                                    style={{ width: 34, height: 34 }}
                                    title={`${entry.item.name}${entry.quantity > 1 ? ` ×${entry.quantity}` : ""}`}
                                >
                                    <img
                                        src={entry.item.image || FALLBACK_IMG}
                                        alt={entry.item.name}
                                        style={{ width: 24, height: 24, objectFit: "contain" }}
                                        onError={(e) => {
                                            (e.currentTarget as HTMLImageElement).src = FALLBACK_IMG;
                                        }}
                                    />
                                </div>
                            ))}
                            {orderItems.length > 10 && (
                                <span className="tiny-text text-muted fw-bold ms-1">
                                    +{orderItems.length - 10} more
                                </span>
                            )}
                        </div>
                    ) : (
                        <p className="tiny-text text-muted mb-0">
                            Your pocket is currently empty. Build items in Command Builder or open Order Bot to order.
                        </p>
                    )}
                </div>

                {/* Primary Actions */}
                <div className="d-flex flex-column gap-2 mb-3">
                    <Link
                        to="/order"
                        className="btn btn-nook text-white fw-bold d-flex align-items-center justify-content-center gap-2 rounded-pill py-2 shadow-sm"
                    >
                        <i className="fa-solid fa-paper-plane"></i>
                        <span>{totalOrderCount > 0 ? `Send Order (${totalOrderCount} items) →` : "Open Order Bot →"}</span>
                    </Link>

                    <div className="d-flex gap-2">
                        <Link
                            to="/command-builder"
                            className="btn btn-outline-success fw-bold d-flex align-items-center justify-content-center gap-2 rounded-pill py-2 flex-grow-1 btn-sm"
                        >
                            <i className="fa-solid fa-cubes-stacked"></i>
                            <span>Command Builder</span>
                        </Link>
                        <Link
                            to="/pockets"
                            className="btn btn-outline-secondary fw-bold d-flex align-items-center justify-content-center gap-2 rounded-pill py-2 btn-sm px-3"
                        >
                            <i className="fa-solid fa-grip"></i>
                            <span>Pocket Grid</span>
                        </Link>
                    </div>
                </div>

                {/* Secondary Discord / Twitch Community Links */}
                <div className="pt-2 border-top d-flex align-items-center justify-content-between flex-wrap gap-2">
                    <span className="tiny-text text-muted">Also available in chat:</span>
                    <div className="d-flex gap-2">
                        <a
                            href="https://discord.gg/chopaeng"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-xs btn-light text-muted border rounded-pill px-2 py-1 tiny-text fw-bold d-inline-flex align-items-center gap-1"
                        >
                            <i className="fa-brands fa-discord text-primary"></i>
                            <span>Discord</span>
                        </a>
                        <a
                            href="https://www.twitch.tv/chopaeng"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-xs btn-light text-muted border rounded-pill px-2 py-1 tiny-text fw-bold d-inline-flex align-items-center gap-1"
                        >
                            <i className="fa-brands fa-twitch text-danger"></i>
                            <span>Twitch</span>
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    const isCodeShowing = Boolean(freeLiveCode || revealedCode);

    return (
        <>
            <button
                type="button"
                disabled={!canShowDodo && !needsAuth}
                className={`btn-dodo-3d ${canShowDodo || needsAuth ? "" : "disabled"} ${user && needsAuth ? "btn-dodo-upgrade" : ""} ${isCodeShowing ? "btn-dodo-revealed" : ""}`}
                onClick={isCodeShowing ? undefined : onRevealCode}
                style={isCodeShowing ? { cursor: 'default' } : undefined}
            >
                <div className="content">
                    <div className="icon-box">
                        <i className={`fa-solid ${dodoUiConfig.icon}`}></i>
                    </div>
                    <div className="text-group">
                        <span className="action-label">{dodoUiConfig.label}</span>
                        <span className="action-code">
                            {dodoUiConfig.code({ freeLiveCode: freeLiveCode ?? null, revealedCode: revealedCode ?? null })}
                        </span>
                    </div>
                </div>
            </button>

            {/* When user is logged in, but has no access to this island -> Upgrade / No Access card */}
            {user && needsAuth && (
                <div className="card rounded-4 p-3.5 p-md-4 mt-3 shadow-2xs island-no-access-card">
                    <div className="d-flex align-items-start gap-3">
                        <div
                            className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 text-white shadow-2xs"
                            style={{ width: 42, height: 42, background: 'linear-gradient(135deg, #d97706, #b45309)', fontSize: '1.15rem' }}
                        >
                            <i className="fa-solid fa-lock" />
                        </div>
                        <div className="flex-grow-1 min-w-0">
                            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-1">
                                <strong className="text-dark ac-font" style={{ fontSize: '0.98rem' }}>
                                    No Access to {islandName || "This Island"}
                                </strong>
                                <span
                                    className="badge rounded-pill fw-bold"
                                    style={{
                                        background: 'rgba(217, 119, 6, 0.14)',
                                        color: '#b45309',
                                        border: '1px solid rgba(217, 119, 6, 0.3)',
                                        fontSize: '0.68rem',
                                    }}
                                >
                                    Subscribers Only
                                </span>
                            </div>
                            <p className="text-muted small mb-3 lh-sm" style={{ fontSize: '0.82rem' }}>
                                You are signed in as <strong className="text-dark">{user.username}</strong>, but your Discord account doesn't have the subscriber tier required for this VIP island. Upgrade your membership or sync your Discord roles to get instant Dodo code access!
                            </p>
                            <div className="d-flex align-items-center gap-2 flex-wrap">
                                <Link
                                    to="/membership"
                                    className="btn btn-sm btn-warning text-dark rounded-pill fw-bold px-3 py-1.5 shadow-2xs d-inline-flex align-items-center gap-1.5"
                                    style={{ fontSize: '0.82rem' }}
                                >
                                    <i className="fa-solid fa-gem text-dark" /> Upgrade Membership
                                </Link>
                                <a
                                    href="https://www.patreon.com/cw/chopaeng/membership"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-sm btn-outline-dark rounded-pill fw-bold px-3 py-1.5 d-inline-flex align-items-center gap-1.5"
                                    style={{ fontSize: '0.82rem' }}
                                >
                                    <i className="fa-brands fa-patreon" style={{ color: '#ff424d' }} /> Patreon Plans
                                </a>
                                {onRefreshRoles && (
                                    <button
                                        type="button"
                                        disabled={isRefreshingRoles}
                                        onClick={onRefreshRoles}
                                        className="btn btn-sm btn-light border rounded-pill px-2.5 py-1.5 tiny-text fw-bold d-inline-flex align-items-center gap-1"
                                        title="Re-check Discord roles"
                                    >
                                        <i className={`fa-solid fa-arrows-rotate ${isRefreshingRoles ? "fa-spin text-warning" : "text-muted"}`} />
                                        <span>{isRefreshingRoles ? "Checking..." : "Sync Roles"}</span>
                                    </button>
                                )}
                                <a
                                    href="https://discord.gg/chopaeng"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-sm btn-link text-muted text-decoration-none fw-semibold px-2 py-1 tiny-text d-inline-flex align-items-center gap-1 ms-sm-auto"
                                >
                                    <i className="fa-brands fa-discord text-primary" /> Role Help
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* When user is NOT logged in and island requires auth */}
            {!user && needsAuth && (
                <div className="text-center mt-3">
                    <button
                        type="button"
                        onClick={login}
                        className="btn btn-link text-muted text-decoration-none small fw-bold d-inline-flex align-items-center gap-1.5"
                    >
                        <i className="fa-brands fa-discord text-primary" />
                        <span>Login with Discord to check your island access</span>
                    </button>
                </div>
            )}
        </>
    );
};
