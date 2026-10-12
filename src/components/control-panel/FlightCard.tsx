import React, { useState } from "react";
import type { FlightRecord, CorrelatedCandidate, ModActionType } from "../../types/controlPanel";

interface FlightCardProps {
    flight: FlightRecord;
    onQuickAuthorise: (flight: FlightRecord) => void;
    onQuickDismiss: (flight: FlightRecord) => void;
    onOpenActionModal: (flight: FlightRecord, action: ModActionType) => void;
    onOpenInspect: (flight: FlightRecord) => void;
    onUndoAction: (flight: FlightRecord) => void;
    isActing?: boolean;
}

export const FlightCard: React.FC<FlightCardProps> = ({
    flight,
    onQuickAuthorise,
    onQuickDismiss,
    onOpenActionModal,
    onOpenInspect,
    onUndoAction,
    isActing = false,
}) => {
    const [showRunners, setShowRunners] = useState(false);

    // Format flight arrival time
    const flightDate = new Date(flight.timestamp * 1000);
    const timeAgoMinutes = Math.max(0, Math.floor((Date.now() - flight.timestamp * 1000) / 60000));
    const timeDisplay =
        timeAgoMinutes < 1
            ? "Just now"
            : timeAgoMinutes === 1
            ? "1 min ago"
            : timeAgoMinutes < 60
            ? `${timeAgoMinutes} mins ago`
            : flightDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const primary = flight.primary_candidate;

    // Badge styling for match status
    const renderMatchBadge = () => {
        if (flight.review_status === "authorised") {
            return (
                <span className="cp-badge cp-badge-success">
                    <i className="fa-solid fa-circle-check" /> Authorised by {flight.handled_by || "Mod"}
                </span>
            );
        }
        if (flight.review_status === "dismissed") {
            return (
                <span className="cp-badge cp-badge-muted">
                    <i className="fa-solid fa-eye-slash" /> Dismissed by {flight.handled_by || "Mod"}
                </span>
            );
        }
        if (flight.review_status === "actioned") {
            return (
                <span className="cp-badge cp-badge-danger">
                    <i className="fa-solid fa-triangle-exclamation" /> Actioned by {flight.handled_by || "Mod"}
                </span>
            );
        }

        switch (flight.match_status) {
            case "verified":
                return (
                    <span className="cp-badge cp-badge-success" title="Character IGN & Island match registered profile">
                        <i className="fa-solid fa-circle-check" /> Verified Match ({flight.match_score}%)
                    </span>
                );
            case "partial":
                return (
                    <span className="cp-badge cp-badge-warning" title="Partial match — one field matches">
                        <i className="fa-solid fa-triangle-exclamation" /> Partial Match ({flight.match_score}%)
                    </span>
                );
            case "mismatch":
                return (
                    <span className="cp-badge cp-badge-danger" title="In-game character does not match the Dodo revealer">
                        <i className="fa-solid fa-circle-xmark" /> Mismatch ({flight.match_score}%)
                    </span>
                );
            case "unregistered":
            default:
                return (
                    <span className="cp-badge cp-badge-muted" title="No Dodo reveal logged in the 40-minute window">
                        <i className="fa-solid fa-user-xmark" /> No Reveal Found
                    </span>
                );
        }
    };

    return (
        <div className={`cp-flight-card cp-flight-${flight.review_status} ${flight.match_status === "mismatch" ? "is-mismatch" : ""}`}>
            {/* Card Header */}
            <div className="cp-card-header">
                <div className="cp-card-dest-wrap">
                    <span className="cp-dest-pill">
                        <i className="fa-solid fa-tree-palm" /> {flight.destination}
                    </span>
                    <span className="cp-time-text" title={flightDate.toLocaleString()}>
                        <i className="fa-regular fa-clock" /> {timeDisplay}
                    </span>
                </div>
                <div className="cp-card-badge-wrap">{renderMatchBadge()}</div>
            </div>

            {/* Side-by-Side Comparison */}
            <div className="cp-compare-grid">
                {/* Column 1: In-game arrival */}
                <div className="cp-compare-col cp-col-flight">
                    <div className="cp-col-title">
                        <i className="fa-solid fa-plane-arrival text-primary" />
                        <span>In-Game Flight Log</span>
                        <span className="cp-tag-id">#{flight.id}</span>
                    </div>

                    <div className="cp-info-item">
                        <span className="cp-info-label">Character IGN</span>
                        <strong className="cp-info-value cp-ign-text">{flight.ign}</strong>
                    </div>

                    <div className="cp-info-item">
                        <span className="cp-info-label">Origin Island</span>
                        <span className="cp-info-value">{flight.origin_island || "—"}</span>
                    </div>

                    <div className="cp-info-item">
                        <span className="cp-info-label">Destination</span>
                        <span className="cp-info-value text-info fw-bold">{flight.destination} Sub-Island</span>
                    </div>
                </div>

                {/* Divider Arrow */}
                <div className="cp-compare-divider">
                    <i className="fa-solid fa-arrow-right-arrow-left" />
                </div>

                {/* Column 2: Correlated Dodo Reveal */}
                <div className="cp-compare-col cp-col-reveal">
                    <div className="cp-col-title">
                        <i className="fa-brands fa-discord text-indigo" />
                        <span>Matched Dodo Reveal</span>
                        {primary && primary.strikes > 0 ? (
                            <span className="cp-strike-pill" title={`${primary.strikes} prior strikes on record`}>
                                <i className="fa-solid fa-triangle-exclamation" /> {primary.strikes} Strike{primary.strikes > 1 ? "s" : ""}
                            </span>
                        ) : (
                            <span className="cp-strike-pill cp-strike-clean">Clean Record</span>
                        )}
                    </div>

                    {primary ? (
                        <>
                            <div className="cp-info-item">
                                <span className="cp-info-label">Discord User</span>
                                <div className="cp-user-tag-wrap">
                                    <strong className="cp-info-value">@{primary.username}</strong>
                                    {primary.nickname && primary.nickname !== primary.username && (
                                        <span className="cp-user-nick">({primary.nickname})</span>
                                    )}
                                </div>
                            </div>

                            <div className="cp-info-item">
                                <span className="cp-info-label">Registered Profile</span>
                                <span className="cp-info-value">
                                    <strong>{primary.ign || "—"}</strong> from {primary.island_name || "—"}
                                </span>
                            </div>

                            <div className="cp-info-item">
                                <span className="cp-info-label">Reveal Time Delta</span>
                                <span className="cp-info-value text-muted">
                                    <i className="fa-solid fa-stopwatch me-1" />
                                    {Math.abs(primary.time_diff_seconds)}s {primary.time_diff_seconds >= 0 ? "before landing" : "after landing"}
                                </span>
                            </div>

                            {/* Active restriction banner if user is currently timed out or banned */}
                            {primary.active_restriction && (
                                <div className="cp-active-restriction-banner">
                                    <i className="fa-solid fa-ban me-1" />
                                    Active {primary.active_restriction.action_type}: {primary.active_restriction.reason}
                                </div>
                            )}

                            {/* System Suggestion */}
                            <div className="cp-suggestion-box">
                                <i className="fa-solid fa-robot" />
                                <span>{flight.suggestion}</span>
                            </div>
                        </>
                    ) : (
                        <div className="cp-no-reveal-box">
                            <i className="fa-solid fa-triangle-exclamation text-warning mb-2" />
                            <p className="mb-0">
                                No Dodo code reveal found for <strong>{flight.destination}</strong> in the 40-minute window prior to arrival.
                            </p>
                            <span className="cp-sub-note">Possible code sharing or unregistered visitor</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Runner-ups accordion */}
            {flight.runner_ups && flight.runner_ups.length > 0 && (
                <div className="cp-runner-ups-section">
                    <button
                        type="button"
                        className="cp-btn-runners-toggle"
                        onClick={() => setShowRunners(!showRunners)}
                    >
                        <i className={`fa-solid ${showRunners ? "fa-chevron-up" : "fa-chevron-down"}`} />
                        <span>{flight.runner_ups.length} other nearby Dodo reveal{flight.runner_ups.length > 1 ? "s" : ""}</span>
                    </button>

                    {showRunners && (
                        <div className="cp-runners-list">
                            {flight.runner_ups.map((runner: CorrelatedCandidate, idx: number) => (
                                <div key={idx} className="cp-runner-item">
                                    <div className="cp-runner-user">
                                        <strong>@{runner.username}</strong>
                                        <span className="text-muted ms-1">({runner.ign} / {runner.island_name})</span>
                                    </div>
                                    <div className="cp-runner-meta">
                                        <span className="badge bg-secondary me-2">{runner.score}% match</span>
                                        <span className="text-muted">{Math.abs(runner.time_diff_seconds)}s delta</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Actions Toolbar */}
            <div className="cp-card-actions">
                {flight.review_status === "pending" ? (
                    <>
                        <button
                            type="button"
                            className="cp-btn cp-btn-success"
                            onClick={() => onQuickAuthorise(flight)}
                            disabled={isActing}
                            title="Approve this flight (1-click)"
                        >
                            <i className="fa-solid fa-check" />
                            <span>Authorise</span>
                        </button>

                        <button
                            type="button"
                            className="cp-btn cp-btn-secondary"
                            onClick={() => onQuickDismiss(flight)}
                            disabled={isActing}
                            title="Dismiss without issuing warning"
                        >
                            <i className="fa-solid fa-eye-slash" />
                            <span>Dismiss</span>
                        </button>

                        <button
                            type="button"
                            className="cp-btn cp-btn-warning"
                            onClick={() => onOpenActionModal(flight, "warn")}
                            disabled={isActing}
                            title="Issue warning strike"
                        >
                            <i className="fa-solid fa-triangle-exclamation" />
                            <span>Warn</span>
                        </button>

                        <button
                            type="button"
                            className="cp-btn cp-btn-orange"
                            onClick={() => onOpenActionModal(flight, "timeout")}
                            disabled={isActing}
                            title="Temporary timeout"
                        >
                            <i className="fa-solid fa-clock-rotate-left" />
                            <span>Timeout</span>
                        </button>

                        <button
                            type="button"
                            className="cp-btn cp-btn-danger"
                            onClick={() => onOpenActionModal(flight, "ban")}
                            disabled={isActing}
                            title="Permanent ban"
                        >
                            <i className="fa-solid fa-ban" />
                            <span>Ban</span>
                        </button>

                        <button
                            type="button"
                            className="cp-btn cp-btn-info ms-auto"
                            onClick={() => onOpenInspect(flight)}
                            title="Deep inspect user history & saved characters"
                        >
                            <i className="fa-solid fa-magnifying-glass" />
                            <span>Inspect</span>
                        </button>
                    </>
                ) : (
                    <>
                        <div className="cp-handled-info">
                            <i className="fa-solid fa-user-shield me-1 text-muted" />
                            <span>
                                Handled as <strong>{flight.review_status}</strong> by{" "}
                                <strong>{flight.handled_by || "Moderator"}</strong>
                            </span>
                        </div>

                        <button
                            type="button"
                            className="cp-btn cp-btn-outline ms-auto me-2"
                            onClick={() => onUndoAction(flight)}
                            disabled={isActing}
                            title="Re-open this flight for review"
                        >
                            <i className="fa-solid fa-rotate-left" />
                            <span>Reopen / Undo</span>
                        </button>

                        <button
                            type="button"
                            className="cp-btn cp-btn-info"
                            onClick={() => onOpenInspect(flight)}
                            title="Deep inspect user profile"
                        >
                            <i className="fa-solid fa-magnifying-glass" />
                            <span>Inspect</span>
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};
