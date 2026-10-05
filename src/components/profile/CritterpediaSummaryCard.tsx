import React from "react";
import { Link } from "react-router-dom";
import type { useCaughtCritters } from "../../hooks/useCaughtCritters";

interface CritterpediaSummaryCardProps {
    caughtCritters: ReturnType<typeof useCaughtCritters>;
}

export const CritterpediaSummaryCard: React.FC<CritterpediaSummaryCardProps> = ({ caughtCritters }) => {
    return (
        <div className="pf-card pf-critterpedia-card">
            {/* Header */}
            <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
                <div className="d-flex align-items-center gap-2">
                    <div className="icon-bubble bg-success bg-opacity-10 text-success" style={{ width: 40, height: 40, fontSize: "1.15rem" }}>
                        <i className="fa-solid fa-feather"></i>
                    </div>
                    <div>
                        <h2 className="h6 ac-font text-dark mb-0">Museum &amp; Critterpedia</h2>
                        <span className="tiny-text text-muted">
                            {caughtCritters.isNorth ? "Northern Hemisphere" : "Southern Hemisphere"}
                        </span>
                    </div>
                </div>

                {/* Hemisphere Selector Buttons */}
                <div className="d-flex align-items-center gap-1 bg-light p-1 rounded-pill border">
                    <button
                        type="button"
                        className={`btn btn-xs rounded-pill px-2.5 py-0.5 fw-bold transition-all ${caughtCritters.isNorth ? "btn-success text-white shadow-2xs" : "btn-light text-muted border-0"}`}
                        onClick={() => caughtCritters.setHemisphere("north")}
                        title="Northern Hemisphere"
                    >
                        NH
                    </button>
                    <button
                        type="button"
                        className={`btn btn-xs rounded-pill px-2.5 py-0.5 fw-bold transition-all ${caughtCritters.isSouth ? "btn-success text-white shadow-2xs" : "btn-light text-muted border-0"}`}
                        onClick={() => caughtCritters.setHemisphere("south")}
                        title="Southern Hemisphere"
                    >
                        SH
                    </button>
                </div>
            </div>

            {/* Overall Progress Meter */}
            <div className="p-3 rounded-3 bg-light border mb-3">
                <div className="d-flex align-items-center justify-content-between mb-1.5">
                    <span className="tiny-text fw-bold text-muted text-uppercase tracking-wider">Total Catches</span>
                    <div className="d-flex align-items-baseline gap-1">
                        <strong className="h5 ac-font text-success mb-0">{caughtCritters.caughtCount}</strong>
                        <span className="tiny-text text-muted">/ {caughtCritters.stats.totalCount}</span>
                        <span className="badge bg-success bg-opacity-15 text-success rounded-pill x-small fw-bold ms-1">
                            {Math.round(caughtCritters.stats.overallPercentage)}%
                        </span>
                    </div>
                </div>
                <div className="progress" style={{ height: 8, borderRadius: 999, backgroundColor: "#e2e8f0" }}>
                    <div
                        className="progress-bar bg-success"
                        role="progressbar"
                        style={{
                            width: `${caughtCritters.stats.overallPercentage}%`,
                            backgroundImage: "linear-gradient(90deg, #10b981 0%, #059669 100%)",
                            transition: "width 0.4s ease"
                        }}
                        aria-valuenow={Math.round(caughtCritters.stats.overallPercentage)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                    />
                </div>
            </div>

            {/* Category Breakdown (Fish, Bugs, Sea) */}
            <div className="d-flex flex-column gap-2 mb-3">
                {/* Fish */}
                <div className="pf-critter-progress-item d-flex align-items-center justify-content-between p-2 px-2.5 rounded-2 bg-white border">
                    <div className="d-flex align-items-center gap-2">
                        <span style={{ fontSize: "1.1rem" }}>🐟</span>
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
                <div className="pf-critter-progress-item d-flex align-items-center justify-content-between p-2 px-2.5 rounded-2 bg-white border">
                    <div className="d-flex align-items-center gap-2">
                        <span style={{ fontSize: "1.1rem" }}>🦋</span>
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
                <div className="pf-critter-progress-item d-flex align-items-center justify-content-between p-2 px-2.5 rounded-2 bg-white border">
                    <div className="d-flex align-items-center gap-2">
                        <span style={{ fontSize: "1.1rem" }}>🤿</span>
                        <span className="small fw-bold text-dark">Sea Creatures</span>
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
                <div className="alert alert-warning py-1.5 px-2.5 rounded-2 d-flex align-items-center gap-2 mb-3 tiny-text">
                    <i className="fa-solid fa-clock text-warning flex-shrink-0"></i>
                    <span>
                        <strong>{caughtCritters.stats.leavingThisMonthCount} uncaught</strong> critters leaving this month!
                    </span>
                </div>
            )}

            {/* ChoBot Sync indicator */}
            <div className="d-flex align-items-center justify-content-between mb-3 px-1">
                <span className="tiny-text text-muted d-inline-flex align-items-center gap-1.5">
                    <i className={caughtCritters.dbSyncing ? "fa-solid fa-spinner fa-spin text-primary" : "fa-solid fa-cloud-arrow-up text-success"}></i>
                    <span>{caughtCritters.dbSyncing ? "Syncing..." : "Saved to ChoBot"}</span>
                </span>
                <span className="tiny-text text-muted">Auto-saved</span>
            </div>

            {/* Direct Links */}
            <div className="d-flex gap-2 pt-2 border-top">
                <Link
                    to="/my-collection"
                    className="btn btn-xs btn-outline-success rounded-pill fw-bold w-100 py-1.5 d-inline-flex align-items-center justify-content-center gap-1 shadow-2xs"
                >
                    <i className="fa-solid fa-book-bookmark"></i>
                    <span>My Collection</span>
                </Link>
                <Link
                    to="/critters"
                    className="btn btn-xs btn-light border rounded-pill fw-bold w-100 py-1.5 d-inline-flex align-items-center justify-content-center gap-1 shadow-2xs"
                >
                    <i className="fa-solid fa-compass"></i>
                    <span>Critter Guide</span>
                </Link>
            </div>
        </div>
    );
};
