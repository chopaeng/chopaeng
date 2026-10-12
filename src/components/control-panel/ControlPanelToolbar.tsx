import React from "react";

interface ControlPanelToolbarProps {
    searchQuery: string;
    onSearchChange: (query: string) => void;
    statusFilter: string;
    onStatusChange: (status: string) => void;
    islandFilter: string;
    onIslandChange: (island: string) => void;
    activeIslands: string[];
    pendingCount: number;
    verifiedPendingCount: number;
    incomingCount: number;
    onApplyIncoming: () => void;
    onBulkAuthorise: () => void;
    isBulkAuthorising: boolean;
}

export const ControlPanelToolbar: React.FC<ControlPanelToolbarProps> = ({
    searchQuery,
    onSearchChange,
    statusFilter,
    onStatusChange,
    islandFilter,
    onIslandChange,
    activeIslands,
    pendingCount,
    verifiedPendingCount,
    incomingCount,
    onApplyIncoming,
    onBulkAuthorise,
    isBulkAuthorising,
}) => {
    return (
        <div className="cp-toolbar-container">
            {/* Incoming buffer banner */}
            {incomingCount > 0 && (
                <div className="cp-incoming-banner" onClick={onApplyIncoming} role="button" tabIndex={0}>
                    <i className="fa-solid fa-bolt text-warning" />
                    <span>
                        <strong>{incomingCount} new flight{incomingCount > 1 ? "s" : ""} landed!</strong> Click here to display new flights.
                    </span>
                    <button type="button" className="cp-btn cp-btn-compact cp-btn-primary ms-auto">
                        Show Now
                    </button>
                </div>
            )}

            <div className="cp-toolbar-row">
                {/* Search */}
                <div className="cp-search-wrap">
                    <i className="fa-solid fa-magnifying-glass cp-search-icon" />
                    <input
                        type="text"
                        id="cp-search-input"
                        className="cp-input cp-search-input"
                        placeholder="Search player IGN, island, Discord @username or nickname..."
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            className="cp-search-clear"
                            onClick={() => onSearchChange("")}
                            title="Clear search"
                        >
                            <i className="fa-solid fa-xmark" />
                        </button>
                    )}
                </div>

                {/* Island Filter */}
                <div className="cp-filter-island">
                    <select
                        id="cp-island-filter-select"
                        className="cp-select"
                        value={islandFilter}
                        onChange={(e) => onIslandChange(e.target.value)}
                    >
                        <option value="">All Sub-Islands</option>
                        {activeIslands.map((island) => (
                            <option key={island} value={island}>
                                🏝️ {island}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Bulk Authorise Button */}
                <button
                    type="button"
                    id="cp-bulk-authorise-btn"
                    className="cp-btn cp-btn-success"
                    disabled={verifiedPendingCount === 0 || isBulkAuthorising}
                    onClick={onBulkAuthorise}
                    title="Automatically approve all pending flights with match score ≥ 90%"
                >
                    <i className={`fa-solid ${isBulkAuthorising ? "fa-circle-notch fa-spin" : "fa-bolt"}`} />
                    <span>Authorise Verified ({verifiedPendingCount})</span>
                </button>
            </div>

            {/* Filter pills */}
            <div className="cp-filter-pills">
                <button
                    type="button"
                    className={`cp-pill ${statusFilter === "pending" ? "is-active" : ""}`}
                    onClick={() => onStatusChange("pending")}
                >
                    <i className="fa-solid fa-clock" />
                    <span>Pending Review</span>
                    {pendingCount > 0 && <span className="cp-pill-badge">{pendingCount}</span>}
                </button>

                <button
                    type="button"
                    className={`cp-pill ${statusFilter === "alerts" ? "is-active" : ""}`}
                    onClick={() => onStatusChange("alerts")}
                >
                    <i className="fa-solid fa-triangle-exclamation text-warning" />
                    <span>Alerts & Mismatches</span>
                </button>

                <button
                    type="button"
                    className={`cp-pill ${statusFilter === "all" ? "is-active" : ""}`}
                    onClick={() => onStatusChange("all")}
                >
                    <i className="fa-solid fa-list" />
                    <span>All Flights</span>
                </button>

                <button
                    type="button"
                    className={`cp-pill ${statusFilter === "authorised" ? "is-active" : ""}`}
                    onClick={() => onStatusChange("authorised")}
                >
                    <i className="fa-solid fa-circle-check text-success" />
                    <span>Authorised</span>
                </button>

                <button
                    type="button"
                    className={`cp-pill ${statusFilter === "actioned" ? "is-active" : ""}`}
                    onClick={() => onStatusChange("actioned")}
                >
                    <i className="fa-solid fa-shield-halved text-danger" />
                    <span>Actioned / Warned</span>
                </button>

                <button
                    type="button"
                    className={`cp-pill ${statusFilter === "dismissed" ? "is-active" : ""}`}
                    onClick={() => onStatusChange("dismissed")}
                >
                    <i className="fa-solid fa-eye-slash text-muted" />
                    <span>Dismissed</span>
                </button>
            </div>
        </div>
    );
};
