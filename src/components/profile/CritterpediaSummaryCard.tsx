import React from "react";
import { Link } from "react-router-dom";
import type { useCaughtCritters } from "../../hooks/useCaughtCritters";

interface CritterpediaSummaryCardProps {
    caughtCritters: ReturnType<typeof useCaughtCritters>;
}

export const CritterpediaSummaryCard: React.FC<CritterpediaSummaryCardProps> = ({ caughtCritters }) => {
    return (
        <div className="cpp-card">
            {/* Passport Card Cover */}
            <header className="cpp-card__cover">
                <div className="cpp-card__cover-left">
                    <div className="cpp-card__crest" aria-hidden="true">
                        <i className="fa-solid fa-feather" />
                    </div>
                    <div>
                        <h3 className="ac-font cpp-card__title">Museum &amp; Critterpedia</h3>
                        <p className="cpp-card__subtitle">
                            {caughtCritters.isNorth ? "Northern hemisphere" : "Southern hemisphere"}
                        </p>
                    </div>
                </div>

                {/* Hemisphere Selector Buttons */}
                <div
                    className="d-flex align-items-center gap-1 p-1 rounded-pill"
                    style={{ background: "rgba(255, 255, 255, 0.2)", border: "1px solid rgba(255, 255, 255, 0.4)" }}
                    role="group"
                    aria-label="Hemisphere selector"
                >
                    <button
                        type="button"
                        className="btn btn-sm rounded-pill px-2.5 py-0.5 fw-bold"
                        style={{
                            fontSize: "0.74rem",
                            background: caughtCritters.isNorth ? "#fff" : "transparent",
                            color: caughtCritters.isNorth ? "var(--leaf-dark)" : "#fff",
                            border: "none",
                        }}
                        onClick={() => caughtCritters.setHemisphere("north")}
                        title="Northern hemisphere"
                        aria-label="Northern hemisphere"
                        aria-pressed={caughtCritters.isNorth}
                    >
                        NH
                    </button>
                    <button
                        type="button"
                        className="btn btn-sm rounded-pill px-2.5 py-0.5 fw-bold"
                        style={{
                            fontSize: "0.74rem",
                            background: caughtCritters.isSouth ? "#fff" : "transparent",
                            color: caughtCritters.isSouth ? "var(--leaf-dark)" : "#fff",
                            border: "none",
                        }}
                        onClick={() => caughtCritters.setHemisphere("south")}
                        title="Southern hemisphere"
                        aria-label="Southern hemisphere"
                        aria-pressed={caughtCritters.isSouth}
                    >
                        SH
                    </button>
                </div>
            </header>

            <div className="cpp-card__seam" aria-hidden="true" />

            <div className="cpp-card__body">
                {/* Overall Progress Meter */}
                <div className="p-3 rounded-3 bg-light border mb-3" style={{ borderColor: "var(--line)" }}>
                    <div className="d-flex align-items-center justify-content-between mb-1.5">
                        <span className="small fw-bold text-muted">Total catches</span>
                        <div className="d-flex align-items-baseline gap-1">
                            <strong className="h5 ac-font text-success mb-0">{caughtCritters.caughtCount}</strong>
                            <span className="small text-muted">/ {caughtCritters.stats.totalCount}</span>
                            <span className="badge rounded-pill fw-bold ms-1" style={{ background: "#e6f4ec", color: "var(--leaf-dark)", fontSize: "0.72rem" }}>
                                {Math.round(caughtCritters.stats.overallPercentage)}%
                            </span>
                        </div>
                    </div>
                    <div className="progress" style={{ height: 8, borderRadius: 999, backgroundColor: "#e2e8f0" }}>
                        <div
                            className="progress-bar"
                            role="progressbar"
                            style={{
                                width: `${caughtCritters.stats.overallPercentage}%`,
                                backgroundColor: "var(--leaf)",
                                transition: "width 0.4s ease",
                            }}
                            aria-valuenow={Math.round(caughtCritters.stats.overallPercentage)}
                            aria-valuemin={0}
                            aria-valuemax={100}
                        />
                    </div>
                </div>

                {/* Category Breakdown */}
                <div className="d-flex flex-column gap-2 mb-3">
                    {/* Fish */}
                    <div className="d-flex align-items-center justify-content-between p-2 px-2.5 rounded-2 bg-white border" style={{ borderColor: "var(--line)" }}>
                        <div className="d-flex align-items-center gap-2">
                            <span style={{ fontSize: "1.1rem" }} aria-hidden="true">🐟</span>
                            <span className="small fw-bold text-dark">Fish</span>
                        </div>
                        <div className="d-flex align-items-center gap-2">
                            <div className="progress" style={{ width: 64, height: 6, borderRadius: 999, backgroundColor: "#e2e8f0" }}>
                                <div
                                    className="progress-bar bg-primary"
                                    style={{ width: `${caughtCritters.stats.fish.percentage}%`, transition: "width 0.3s ease" }}
                                />
                            </div>
                            <span className="font-monospace small fw-bold text-muted" style={{ minWidth: 42, textAlign: "right" }}>
                                {caughtCritters.stats.fish.caught}/{caughtCritters.stats.fish.total}
                            </span>
                        </div>
                    </div>

                    {/* Bugs */}
                    <div className="d-flex align-items-center justify-content-between p-2 px-2.5 rounded-2 bg-white border" style={{ borderColor: "var(--line)" }}>
                        <div className="d-flex align-items-center gap-2">
                            <span style={{ fontSize: "1.1rem" }} aria-hidden="true">🦋</span>
                            <span className="small fw-bold text-dark">Bugs</span>
                        </div>
                        <div className="d-flex align-items-center gap-2">
                            <div className="progress" style={{ width: 64, height: 6, borderRadius: 999, backgroundColor: "#e2e8f0" }}>
                                <div
                                    className="progress-bar bg-warning"
                                    style={{ width: `${caughtCritters.stats.bugs.percentage}%`, transition: "width 0.3s ease" }}
                                />
                            </div>
                            <span className="font-monospace small fw-bold text-muted" style={{ minWidth: 42, textAlign: "right" }}>
                                {caughtCritters.stats.bugs.caught}/{caughtCritters.stats.bugs.total}
                            </span>
                        </div>
                    </div>

                    {/* Sea Creatures */}
                    <div className="d-flex align-items-center justify-content-between p-2 px-2.5 rounded-2 bg-white border" style={{ borderColor: "var(--line)" }}>
                        <div className="d-flex align-items-center gap-2">
                            <span style={{ fontSize: "1.1rem" }} aria-hidden="true">🤿</span>
                            <span className="small fw-bold text-dark">Sea creatures</span>
                        </div>
                        <div className="d-flex align-items-center gap-2">
                            <div className="progress" style={{ width: 64, height: 6, borderRadius: 999, backgroundColor: "#e2e8f0" }}>
                                <div
                                    className="progress-bar bg-info"
                                    style={{ width: `${caughtCritters.stats.sea.percentage}%`, transition: "width 0.3s ease" }}
                                />
                            </div>
                            <span className="font-monospace small fw-bold text-muted" style={{ minWidth: 42, textAlign: "right" }}>
                                {caughtCritters.stats.sea.caught}/{caughtCritters.stats.sea.total}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Leaving Soon Notice */}
                {caughtCritters.stats.leavingThisMonthCount > 0 && (
                    <div
                        className="py-1.5 px-2.5 rounded-2 d-flex align-items-center gap-2 mb-3 small"
                        style={{ background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e" }}
                        role="alert"
                    >
                        <i className="fa-solid fa-clock flex-shrink-0" aria-hidden="true" />
                        <span>
                            <strong>{caughtCritters.stats.leavingThisMonthCount} uncaught</strong> critters leaving this month!
                        </span>
                    </div>
                )}

                {/* ChoBot Sync indicator */}
                <div className="d-flex align-items-center justify-content-between mb-3 px-1 small" style={{ color: "#5b6e63" }}>
                    <span className="d-inline-flex align-items-center gap-1.5">
                        <i className={caughtCritters.dbSyncing ? "fa-solid fa-spinner fa-spin text-primary" : "fa-solid fa-cloud-arrow-up text-success"} aria-hidden="true" />
                        <span>{caughtCritters.dbSyncing ? "Syncing…" : "Saved to ChoBot"}</span>
                    </span>
                    <span>Auto-saved</span>
                </div>

                {/* Direct Links */}
                <div className="d-flex gap-2 pt-2 border-top" style={{ borderColor: "var(--line)" }}>
                    <Link
                        to="/my-collection"
                        className="cpp-btn cpp-btn--sm cpp-btn--secondary w-100"
                    >
                        <i className="fa-solid fa-book-bookmark" aria-hidden="true" />
                        <span>My collection</span>
                    </Link>
                    <Link
                        to="/critters"
                        className="cpp-btn cpp-btn--sm cpp-btn--secondary w-100"
                    >
                        <i className="fa-solid fa-compass" aria-hidden="true" />
                        <span>Critter guide</span>
                    </Link>
                </div>
            </div>
        </div>
    );
};
