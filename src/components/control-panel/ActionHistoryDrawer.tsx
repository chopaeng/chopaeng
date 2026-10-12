import React, { useEffect, useState } from "react";
import type { ActionHistoryItem } from "../../types/controlPanel";
import { fetchActionHistory, undoModAction } from "../../utils/controlPanelApi";

interface ActionHistoryDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    onActionReversed: () => void;
}

export const ActionHistoryDrawer: React.FC<ActionHistoryDrawerProps> = ({
    isOpen,
    onClose,
    onActionReversed,
}) => {
    const [history, setHistory] = useState<ActionHistoryItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [reversingId, setReversingId] = useState<number | null>(null);

    const loadHistory = async () => {
        setLoading(true);
        try {
            const res = await fetchActionHistory(50);
            setHistory(res.history || []);
        } catch {
            setHistory([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            loadHistory();
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleReverse = async (item: ActionHistoryItem) => {
        const visitId = item.details?.visit_id;
        if (!visitId) return;

        setReversingId(item.id);
        try {
            await undoModAction(visitId);
            await loadHistory();
            onActionReversed();
        } catch (err: unknown) {
            alert(err instanceof Error ? err.message : "Failed to reverse action");
        } finally {
            setReversingId(null);
        }
    };

    return (
        <div className="cp-drawer-overlay" onClick={onClose}>
            <div className="cp-drawer-panel" onClick={(e) => e.stopPropagation()}>
                <div className="cp-drawer-header">
                    <div className="cp-drawer-title-wrap">
                        <i className="fa-solid fa-clock-rotate-left cp-drawer-icon" />
                        <div>
                            <h2 className="cp-drawer-title">Moderation Audit Log</h2>
                            <span className="cp-drawer-sub">Recent actions executed by moderators</span>
                        </div>
                    </div>
                    <div className="cp-drawer-actions">
                        <button
                            type="button"
                            className={`cp-btn cp-btn-icon ${loading ? "is-spinning" : ""}`}
                            onClick={loadHistory}
                            disabled={loading}
                            title="Refresh audit log"
                        >
                            <i className="fa-solid fa-arrows-rotate" />
                        </button>
                        <button type="button" className="cp-modal-close" onClick={onClose}>
                            <i className="fa-solid fa-xmark" />
                        </button>
                    </div>
                </div>

                <div className="cp-drawer-body">
                    {loading && history.length === 0 ? (
                        <div className="cp-drawer-loading">
                            <i className="fa-solid fa-circle-notch fa-spin text-success" />
                            <span>Loading history...</span>
                        </div>
                    ) : history.length === 0 ? (
                        <div className="cp-drawer-empty">
                            <i className="fa-solid fa-scroll text-muted mb-2" />
                            <p>No recent moderation actions recorded.</p>
                        </div>
                    ) : (
                        <div className="cp-history-timeline">
                            {history.map((item) => {
                                const visitId = item.details?.visit_id;
                                const actionClean = item.action.replace("CONTROL_PANEL_", "");
                                const isReversible = Boolean(visitId && actionClean !== "ACTION_REVERSED");

                                return (
                                    <div key={item.id} className="cp-timeline-item">
                                        <div className="cp-timeline-header">
                                            <span className={`cp-badge cp-badge-${actionClean.toLowerCase()}`}>
                                                {actionClean}
                                            </span>
                                            <span className="cp-timeline-time">
                                                {new Date(item.created_at * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                            </span>
                                        </div>

                                        <div className="cp-timeline-content">
                                            <div className="cp-timeline-actor">
                                                <strong>{item.actor_name}</strong> {actionClean.toLowerCase()}ed target <code>{item.target}</code>
                                            </div>

                                            {item.details?.flight_ign && (
                                                <div className="cp-timeline-details">
                                                    <span>Player: <strong>{item.details.flight_ign}</strong></span>
                                                    {item.details.destination && <span> • Island: {item.details.destination}</span>}
                                                </div>
                                            )}

                                            {item.details?.reason && (
                                                <div className="cp-timeline-reason">
                                                    <em>"{item.details.reason}"</em>
                                                </div>
                                            )}
                                        </div>

                                        {isReversible && (
                                            <button
                                                type="button"
                                                className="cp-btn cp-btn-compact cp-btn-outline mt-2"
                                                onClick={() => handleReverse(item)}
                                                disabled={reversingId === item.id}
                                                title="Revert this action and reset flight to pending"
                                            >
                                                <i className={`fa-solid ${reversingId === item.id ? "fa-circle-notch fa-spin" : "fa-rotate-left"}`} />
                                                <span>Reverse Action</span>
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
