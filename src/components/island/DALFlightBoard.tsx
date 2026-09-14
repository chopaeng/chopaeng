import React from "react";
import { DODO_PLACEHOLDER } from "../../config/constants";
import type { BotStatusResponse } from "../../utils/orderBotApi";
import { openCommunityModal } from "../../utils/communityPresenceApi";

interface DALFlightBoardProps {
    island: any;
    live: any;
    loading: boolean;
    isOrderIsland: boolean;
    botStatus?: BotStatusResponse | null;
    botLoading?: boolean;
}

function formatPassengerCount(visitors: string | undefined): string {
    if (!visitors) return "0/7";
    const match = visitors.match(/\d+/)?.[0];
    return `${match ?? "0"}/7`;
}

export const DALFlightBoard: React.FC<DALFlightBoardProps> = ({
    island,
    live,
    loading,
    isOrderIsland,
    botStatus,
    botLoading,
}) => {
    return (
        <div className="dal-card shadow-sm">
            <div className="dal-header">
                <i className="fa-solid fa-plane-up me-2"></i> DAL Flight Info
            </div>
            <div className="dal-body">
                {/* Status Row */}
                <div className="flight-row">
                    <span className="flight-label">STATUS</span>
                    {isOrderIsland ? (
                        <span
                            className={`flight-value ${
                                botLoading
                                    ? "text-muted"
                                    : botStatus?.success && botStatus.accepting_commands !== false
                                    ? "text-dal-blue"
                                    : "text-danger"
                            }`}
                        >
                            {botLoading ? (
                                <span className="pulse">SCANNING BOT...</span>
                            ) : botStatus?.success && botStatus.accepting_commands !== false ? (
                                "ACCEPTING ORDERS"
                            ) : (
                                "OFFLINE"
                            )}
                        </span>
                    ) : (
                        <span
                            className={`flight-value ${
                                live?.isOnline && live?.dodo !== DODO_PLACEHOLDER.GETTING
                                    ? "text-dal-blue"
                                    : "text-danger"
                            }`}
                        >
                            {loading ? (
                                <span className="pulse">SCANNING...</span>
                            ) : live?.dodo === DODO_PLACEHOLDER.GETTING ? (
                                DODO_PLACEHOLDER.GETTING
                            ) : live?.isOnline ? (
                                "ONLINE"
                            ) : (
                                "OFFLINE"
                            )}
                        </span>
                    )}
                </div>

                {/* Second Row: Passengers or Order Queue */}
                <div className="flight-divider"></div>
                {isOrderIsland ? (
                    <div className="flight-row">
                        <span className="flight-label">QUEUE</span>
                        <span className="flight-value text-dal-blue">
                            {botLoading ? "--" : `${botStatus?.queue_count ?? 0} in queue`}
                        </span>
                    </div>
                ) : (
                    <div className="flight-row">
                        <span className="flight-label">PASSENGERS</span>
                        <div className="d-flex align-items-center gap-2">
                            <span className="flight-value">{formatPassengerCount(live?.visitors)}</span>
                            <button
                                type="button"
                                onClick={() => openCommunityModal('islands')}
                                className="badge bg-primary text-white rounded-pill px-2 py-0.5 border-0 shadow-2xs d-inline-flex align-items-center gap-1 cursor-pointer hover-scale"
                                style={{ fontSize: '0.65rem', textDecoration: 'none' }}
                                title="Open DAL Live Island Occupancy Radar"
                            >
                                <i className="fa-solid fa-plane-departure" style={{ fontSize: '0.6rem' }}></i>
                                <span>Live Radar</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* Third Row: Gate Type */}
                <div className="flight-divider"></div>
                <div className="flight-row">
                    <span className="flight-label">GATE TYPE</span>
                    <span className="flight-value text-warning">
                        {isOrderIsland ? "ORDER BOT (PRIVATE DODO)" : live?.access || "PUBLIC"}
                    </span>
                </div>

            </div>
            <div className="dal-footer d-flex align-items-center justify-content-between flex-wrap gap-1">
                <small>Dodo Airlines • We make travel a breeze!</small>
                <button
                    type="button"
                    onClick={() => openCommunityModal('islands')}
                    className="btn btn-link btn-sm p-0 tiny-text text-decoration-none text-white-50 hover-text-white fw-bold d-inline-flex align-items-center gap-1"
                    title="Open ChoPaeng Live Radar"
                >
                    <span className="live-dot bg-success" style={{ width: 6, height: 6 }}></span>
                    <span>Airport Radar</span>
                    <i className="fa-solid fa-arrow-right" style={{ fontSize: '0.6rem' }}></i>
                </button>
                {island.updatedAt && (
                    <small className="d-block w-100 mt-1 text-muted opacity-75">
                        Updated {new Date(island.updatedAt).toLocaleString()}
                    </small>
                )}
            </div>
        </div>
    );
};
