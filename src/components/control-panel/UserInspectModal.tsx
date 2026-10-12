import React, { useEffect, useState } from "react";
import type { FlightRecord, UserInspectResult } from "../../types/controlPanel";
import { inspectUser } from "../../utils/controlPanelApi";

interface UserInspectModalProps {
    isOpen: boolean;
    flight: FlightRecord | null;
    onClose: () => void;
}

export const UserInspectModal: React.FC<UserInspectModalProps> = ({ isOpen, flight, onClose }) => {
    const [data, setData] = useState<UserInspectResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<"characters" | "warnings" | "flights">("characters");

    useEffect(() => {
        if (isOpen && flight) {
            setLoading(true);
            const userId = flight.primary_candidate?.user_id;
            const ign = flight.ign;

            inspectUser({ user_id: userId, ign: ign })
                .then((res) => setData(res))
                .catch(() => setData(null))
                .finally(() => setLoading(false));
        }
    }, [isOpen, flight]);

    if (!isOpen || !flight) return null;

    const primary = flight.primary_candidate;

    return (
        <div className="cp-modal-overlay" onClick={onClose}>
            <div className="cp-modal-card cp-modal-wide" onClick={(e) => e.stopPropagation()}>
                <div className="cp-modal-header">
                    <div className="cp-modal-title-wrap">
                        <i className="fa-solid fa-id-card cp-inspect-icon" />
                        <div>
                            <h2 className="cp-modal-title">User Deep Inspection</h2>
                            <span className="cp-drawer-sub">
                                Review saved characters, warning history & flight logs
                            </span>
                        </div>
                    </div>
                    <button type="button" className="cp-modal-close" onClick={onClose}>
                        <i className="fa-solid fa-xmark" />
                    </button>
                </div>

                <div className="cp-modal-body">
                    {/* User profile overview */}
                    <div className="cp-inspect-header-card">
                        <div className="cp-inspect-avatar">
                            <i className="fa-brands fa-discord" />
                        </div>
                        <div className="cp-inspect-user-details">
                            <h3 className="cp-inspect-username">
                                {primary ? `@${primary.username}` : flight.ign}
                            </h3>
                            <div className="cp-inspect-tags">
                                {primary?.nickname && (
                                    <span className="cp-tag">Nick: {primary.nickname}</span>
                                )}
                                <span className="cp-tag">In-Game IGN: {flight.ign}</span>
                                <span className="cp-tag">Origin: {flight.origin_island || "Island"}</span>
                            </div>
                        </div>

                        {data?.active_restriction && (
                            <div className="cp-inspect-restriction-badge">
                                <i className="fa-solid fa-ban text-danger" />
                                <span>Active {data.active_restriction.action_type}</span>
                            </div>
                        )}
                    </div>

                    {/* Navigation tabs */}
                    <div className="cp-inspect-tabs">
                        <button
                            type="button"
                            className={`cp-inspect-tab ${activeTab === "characters" ? "is-active" : ""}`}
                            onClick={() => setActiveTab("characters")}
                        >
                            <i className="fa-solid fa-users" />
                            <span>Saved Characters ({data?.characters?.length || 0})</span>
                        </button>

                        <button
                            type="button"
                            className={`cp-inspect-tab ${activeTab === "warnings" ? "is-active" : ""}`}
                            onClick={() => setActiveTab("warnings")}
                        >
                            <i className="fa-solid fa-triangle-exclamation" />
                            <span>Warnings & Strikes ({data?.warnings?.length || 0})</span>
                        </button>

                        <button
                            type="button"
                            className={`cp-inspect-tab ${activeTab === "flights" ? "is-active" : ""}`}
                            onClick={() => setActiveTab("flights")}
                        >
                            <i className="fa-solid fa-plane" />
                            <span>Recent Flights ({data?.recent_flights?.length || 0})</span>
                        </button>
                    </div>

                    {/* Tab contents */}
                    {loading ? (
                        <div className="cp-inspect-loading">
                            <i className="fa-solid fa-circle-notch fa-spin text-success" />
                            <span>Loading user data...</span>
                        </div>
                    ) : (
                        <div className="cp-inspect-tab-content">
                            {/* Tab 1: Characters */}
                            {activeTab === "characters" && (
                                <div className="cp-chars-grid">
                                    {data?.characters && data.characters.length > 0 ? (
                                        data.characters.map((char) => (
                                            <div key={char.id} className="cp-char-card">
                                                <div className="cp-char-icon">
                                                    {char.icon ? (
                                                        <img src={char.icon} alt={char.ign} />
                                                    ) : (
                                                        <i className="fa-solid fa-user" />
                                                    )}
                                                </div>
                                                <div className="cp-char-info">
                                                    <strong className="cp-char-name">{char.ign}</strong>
                                                    <span className="cp-char-island">🏝️ {char.island_name}</span>
                                                    {char.is_default && (
                                                        <span className="cp-badge cp-badge-primary">Default</span>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="cp-empty-state">
                                            <p className="text-muted">No characters saved in profile.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Tab 2: Warnings */}
                            {activeTab === "warnings" && (
                                <div className="cp-warnings-list">
                                    {data?.warnings && data.warnings.length > 0 ? (
                                        data.warnings.map((warn) => (
                                            <div key={warn.id} className="cp-warning-item">
                                                <div className="cp-warning-header">
                                                    <span className="cp-badge cp-badge-danger">
                                                        {warn.action_type || "WARN"}
                                                    </span>
                                                    <span className="text-muted">
                                                        {new Date(warn.timestamp * 1000).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                <div className="cp-warning-reason">"{warn.reason}"</div>
                                                <span className="cp-warning-mod">Issued by: {warn.mod_id}</span>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="cp-empty-state">
                                            <p className="text-muted">Clean record! No warnings or strikes recorded.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Tab 3: Flights */}
                            {activeTab === "flights" && (
                                <div className="cp-flights-history">
                                    {data?.recent_flights && data.recent_flights.length > 0 ? (
                                        <table className="cp-table">
                                            <thead>
                                                <tr>
                                                    <th>IGN</th>
                                                    <th>Origin</th>
                                                    <th>Destination</th>
                                                    <th>Status</th>
                                                    <th>Time</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {data.recent_flights.map((f) => (
                                                    <tr key={f.id}>
                                                        <td><strong>{f.ign}</strong></td>
                                                        <td>{f.origin_island || "—"}</td>
                                                        <td>{f.destination}</td>
                                                        <td>
                                                            <span className={`cp-badge cp-badge-${f.review_status}`}>
                                                                {f.review_status}
                                                            </span>
                                                        </td>
                                                        <td className="text-muted">
                                                            {new Date(f.timestamp * 1000).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <div className="cp-empty-state">
                                            <p className="text-muted">No past flight history found.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="cp-modal-footer">
                    <button type="button" className="cp-btn cp-btn-primary" onClick={onClose}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};
