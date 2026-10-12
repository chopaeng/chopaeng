import React from "react";
import { Link } from "react-router-dom";
import type { ControlPanelStats } from "../../types/controlPanel";

interface ControlPanelHeaderProps {
    stats: ControlPanelStats | null;
    isLive: boolean;
    onToggleLive: () => void;
    pollInterval: number;
    onChangeInterval: (interval: number) => void;
    countdown: number;
    soundEnabled: boolean;
    onToggleSound: () => void;
    onRefresh: () => void;
    refreshing: boolean;
    onOpenHistory: () => void;
}

export const ControlPanelHeader: React.FC<ControlPanelHeaderProps> = ({
    stats,
    isLive,
    onToggleLive,
    pollInterval,
    onChangeInterval,
    countdown,
    soundEnabled,
    onToggleSound,
    onRefresh,
    refreshing,
    onOpenHistory,
}) => {
    return (
        <header className="cp-header">
            <div className="cp-header-top">
                <div className="cp-brand">
                    <div className="cp-brand-icon">
                        <i className="fa-solid fa-plane-departure" />
                    </div>
                    <div>
                        <div className="cp-brand-title-wrap">
                            <h1 className="cp-brand-title">ChoBot Moderation Cockpit</h1>
                            <span className="cp-sub-badge">Sub-Island Live Radar</span>
                        </div>
                        <p className="cp-brand-sub">Real-time arrival correlation, Dodo reveal verification & action enforcement</p>
                    </div>
                </div>

                <div className="cp-actions">
                    <Link to="/" className="cp-btn cp-btn-ghost" title="Return to Main Website">
                        <i className="fa-solid fa-house" />
                        <span>Website</span>
                    </Link>

                    <Link to="/dashboard" className="cp-btn cp-btn-ghost" title="Open Legacy Dashboard">
                        <i className="fa-solid fa-chart-pie" />
                        <span>Dashboard</span>
                    </Link>

                    <button
                        type="button"
                        id="cp-toggle-sound-btn"
                        className={`cp-btn cp-btn-ghost ${soundEnabled ? "cp-btn-active" : ""}`}
                        onClick={onToggleSound}
                        title={soundEnabled ? "Mute audio cues" : "Enable arrival audio cues"}
                    >
                        <i className={`fa-solid ${soundEnabled ? "fa-volume-high text-success" : "fa-volume-xmark text-muted"}`} />
                        <span>{soundEnabled ? "Sound On" : "Muted"}</span>
                    </button>

                    <button
                        type="button"
                        id="cp-open-history-btn"
                        className="cp-btn cp-btn-ghost"
                        onClick={onOpenHistory}
                        title="View Moderation Audit Log"
                    >
                        <i className="fa-solid fa-clock-rotate-left" />
                        <span>Audit Log</span>
                    </button>

                    <div className="cp-live-controls">
                        <button
                            type="button"
                            id="cp-toggle-live-btn"
                            className={`cp-btn-live ${isLive ? "is-live" : "is-paused"}`}
                            onClick={onToggleLive}
                            title={isLive ? "Pause auto-polling" : "Resume auto-polling"}
                        >
                            <span className="cp-live-pulse" />
                            <span>{isLive ? `LIVE (${countdown}s)` : "PAUSED"}</span>
                        </button>

                        <select
                            id="cp-poll-interval-select"
                            className="cp-select cp-select-compact"
                            value={pollInterval}
                            onChange={(e) => onChangeInterval(Number(e.target.value))}
                            title="Polling frequency"
                        >
                            <option value={3000}>3s poll</option>
                            <option value={5000}>5s poll</option>
                            <option value={10000}>10s poll</option>
                        </select>

                        <button
                            type="button"
                            id="cp-refresh-btn"
                            className={`cp-btn cp-btn-icon ${refreshing ? "is-spinning" : ""}`}
                            onClick={onRefresh}
                            disabled={refreshing}
                            title="Refresh Now"
                        >
                            <i className="fa-solid fa-arrows-rotate" />
                        </button>
                    </div>
                </div>
            </div>

            {/* KPI Stats Bar */}
            <div className="cp-kpi-grid">
                <div className="cp-kpi-card">
                    <div className="cp-kpi-icon icon-blue">
                        <i className="fa-solid fa-plane-arrival" />
                    </div>
                    <div className="cp-kpi-content">
                        <span className="cp-kpi-label">Flights Today</span>
                        <strong className="cp-kpi-value">{stats ? stats.flights_today : "—"}</strong>
                    </div>
                </div>

                <div className={`cp-kpi-card ${stats && stats.pending_total > 0 ? "cp-kpi-alert" : ""}`}>
                    <div className="cp-kpi-icon icon-amber">
                        <i className="fa-solid fa-clock" />
                    </div>
                    <div className="cp-kpi-content">
                        <span className="cp-kpi-label">Pending Reviews</span>
                        <strong className="cp-kpi-value">{stats ? stats.pending_total : "—"}</strong>
                    </div>
                    {stats && stats.pending_total > 0 && (
                        <span className="cp-kpi-badge-pulse">{stats.pending_total} require review</span>
                    )}
                </div>

                <div className="cp-kpi-card">
                    <div className="cp-kpi-icon icon-green">
                        <i className="fa-solid fa-circle-check" />
                    </div>
                    <div className="cp-kpi-content">
                        <span className="cp-kpi-label">Authorised Today</span>
                        <strong className="cp-kpi-value">{stats ? stats.authorised_today : "—"}</strong>
                    </div>
                </div>

                <div className="cp-kpi-card">
                    <div className="cp-kpi-icon icon-coral">
                        <i className="fa-solid fa-triangle-exclamation" />
                    </div>
                    <div className="cp-kpi-content">
                        <span className="cp-kpi-label">Actioned / Warned</span>
                        <strong className="cp-kpi-value">{stats ? stats.actioned_today : "—"}</strong>
                    </div>
                </div>

                <div className="cp-kpi-card">
                    <div className="cp-kpi-icon icon-red">
                        <i className="fa-solid fa-user-slash" />
                    </div>
                    <div className="cp-kpi-content">
                        <span className="cp-kpi-label">Active Suspensions</span>
                        <strong className="cp-kpi-value">{stats ? stats.active_restrictions : "—"}</strong>
                    </div>
                </div>
            </div>
        </header>
    );
};
