import React, { useState, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { useAuth } from "../../context/useAuth";
import { useControlPanelFeed } from "../../hooks/useControlPanelFeed";
import type { FlightRecord, ModActionType, ModActionPayload } from "../../types/controlPanel";
import { executeModAction, undoModAction, bulkAuthoriseVerified } from "../../utils/controlPanelApi";
import { playCockpitSound } from "../../utils/controlPanelAudio";

import { ControlPanelHeader } from "../../components/control-panel/ControlPanelHeader";
import { ControlPanelToolbar } from "../../components/control-panel/ControlPanelToolbar";
import { FlightCard } from "../../components/control-panel/FlightCard";
import { ActionModal } from "../../components/control-panel/ActionModal";
import { ActionToast } from "../../components/control-panel/ActionToast";
import { ActionHistoryDrawer } from "../../components/control-panel/ActionHistoryDrawer";
import { UserInspectModal } from "../../components/control-panel/UserInspectModal";

import "./ControlPanelPage.css";

export const ControlPanelPage: React.FC = () => {
    const { user } = useAuth();
    const feed = useControlPanelFeed({
        initialInterval: 4000,
        defaultStatus: "pending",
    });

    // Modal & Toast states
    const [actionModalFlight, setActionModalFlight] = useState<FlightRecord | null>(null);
    const [actionModalType, setActionModalType] = useState<ModActionType>("warn");
    const [isActionModalOpen, setIsActionModalOpen] = useState(false);
    const [isActionSubmitting, setIsActionSubmitting] = useState(false);
    const [actionModalError, setActionModalError] = useState<string | null>(null);

    const [inspectFlight, setInspectFlight] = useState<FlightRecord | null>(null);
    const [isInspectModalOpen, setIsInspectModalOpen] = useState(false);

    const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);

    const [toast, setToast] = useState<{
        id: string;
        message: string;
        visitId: number;
        action: string;
        expiresAt: number;
    } | null>(null);
    const [isUndoing, setIsUndoing] = useState(false);
    const [isBulkAuthorising, setIsBulkAuthorising] = useState(false);

    // Active islands list
    const activeIslands = useMemo(() => {
        const set = new Set<string>();
        feed.flights.forEach((f) => {
            if (f.destination) set.add(f.destination);
        });
        feed.incomingBuffer.forEach((f) => {
            if (f.destination) set.add(f.destination);
        });
        return Array.from(set).sort();
    }, [feed.flights, feed.incomingBuffer]);

    // Counts
    const pendingCount = useMemo(() => {
        return feed.flights.filter((f) => f.review_status === "pending").length;
    }, [feed.flights]);

    const verifiedPendingCount = useMemo(() => {
        return feed.flights.filter((f) => f.review_status === "pending" && f.match_score >= 90).length;
    }, [feed.flights]);

    // Quick 1-click authorise
    const handleQuickAuthorise = async (flight: FlightRecord) => {
        try {
            feed.updateFlightLocal(flight.id, "authorised", user?.username || "You");
            playCockpitSound("action");

            await executeModAction({
                visit_id: flight.id,
                action: "authorise",
            });

            setToast({
                id: `toast-${Date.now()}`,
                message: `Flight #${flight.id} (${flight.ign}) authorised.`,
                visitId: flight.id,
                action: "authorise",
                expiresAt: Date.now() + 15000,
            });
        } catch (err: unknown) {
            feed.loadFeed(false);
            const msg = err instanceof Error ? err.message : "Failed to authorise flight";
            alert(`Error: ${msg}`);
        }
    };

    // Quick dismiss
    const handleQuickDismiss = async (flight: FlightRecord) => {
        try {
            feed.updateFlightLocal(flight.id, "dismissed", user?.username || "You");
            await executeModAction({
                visit_id: flight.id,
                action: "dismiss",
            });

            setToast({
                id: `toast-${Date.now()}`,
                message: `Flight #${flight.id} (${flight.ign}) dismissed.`,
                visitId: flight.id,
                action: "dismiss",
                expiresAt: Date.now() + 15000,
            });
        } catch (err: unknown) {
            feed.loadFeed(false);
            const msg = err instanceof Error ? err.message : "Failed to dismiss flight";
            alert(`Error: ${msg}`);
        }
    };

    // Open Action Modal (Warn, Timeout, Ban)
    const handleOpenActionModal = (flight: FlightRecord, action: ModActionType) => {
        setActionModalFlight(flight);
        setActionModalType(action);
        setActionModalError(null);
        setIsActionModalOpen(true);
    };

    // Action Modal Submit
    const handleActionModalSubmit = async (payload: ModActionPayload) => {
        setIsActionSubmitting(true);
        setActionModalError(null);
        try {
            const res = await executeModAction(payload);
            const actionLabel = payload.action.toUpperCase();

            feed.updateFlightLocal(payload.visit_id, res.review_status || "actioned", user?.username || "You");
            setIsActionModalOpen(false);

            setToast({
                id: `toast-${Date.now()}`,
                message: `Action ${actionLabel} applied to #${payload.visit_id}.`,
                visitId: payload.visit_id,
                action: payload.action,
                expiresAt: Date.now() + 15000,
            });

            playCockpitSound("action");
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Action failed";
            setActionModalError(msg);
        } finally {
            setIsActionSubmitting(false);
        }
    };

    // Undo action handler
    const handleUndoAction = async (visitId: number) => {
        setIsUndoing(true);
        try {
            await undoModAction(visitId);
            feed.updateFlightLocal(visitId, "pending", "");
            setToast(null);
            playCockpitSound("undo");
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Undo failed";
            alert(`Undo Error: ${msg}`);
        } finally {
            setIsUndoing(false);
        }
    };

    // Bulk Authorise verified
    const handleBulkAuthorise = async () => {
        if (!window.confirm(`Are you sure you want to approve all ${verifiedPendingCount} verified flights?`)) {
            return;
        }

        setIsBulkAuthorising(true);
        try {
            const res = await bulkAuthoriseVerified(feed.islandFilter || undefined);
            alert(`Success: ${res.message}`);
            feed.loadFeed(true);
            playCockpitSound("action");
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Bulk authorise failed";
            alert(`Error: ${msg}`);
        } finally {
            setIsBulkAuthorising(false);
        }
    };

    // Inspect user
    const handleOpenInspect = (flight: FlightRecord) => {
        setInspectFlight(flight);
        setIsInspectModalOpen(true);
    };

    return (
        <main className="cp-page-root">
            <Helmet>
                <title>Sub-Island Moderation Cockpit – ChoPaeng</title>
                <meta name="robots" content="noindex, nofollow" />
            </Helmet>

            <div className="cp-container">
                {/* Header */}
                <ControlPanelHeader
                    stats={feed.stats}
                    isLive={feed.isLive}
                    onToggleLive={() => feed.setIsLive(!feed.isLive)}
                    pollInterval={feed.pollInterval}
                    onChangeInterval={feed.setPollInterval}
                    countdown={feed.countdown}
                    soundEnabled={feed.soundEnabled}
                    onToggleSound={() => feed.setSoundEnabled(!feed.soundEnabled)}
                    onRefresh={() => feed.loadFeed(true)}
                    refreshing={feed.refreshing}
                    onOpenHistory={() => setIsHistoryDrawerOpen(true)}
                />

                {/* Toolbar */}
                <ControlPanelToolbar
                    searchQuery={feed.searchQuery}
                    onSearchChange={feed.setSearchQuery}
                    statusFilter={feed.statusFilter}
                    onStatusChange={feed.setStatusFilter}
                    islandFilter={feed.islandFilter}
                    onIslandChange={feed.setIslandFilter}
                    activeIslands={activeIslands}
                    pendingCount={pendingCount}
                    verifiedPendingCount={verifiedPendingCount}
                    incomingCount={feed.incomingBuffer.length}
                    onApplyIncoming={feed.applyIncomingBuffer}
                    onBulkAuthorise={handleBulkAuthorise}
                    isBulkAuthorising={isBulkAuthorising}
                />

                {/* Main Content Feed */}
                <section className="cp-feed-section">
                    {feed.loading && feed.flights.length === 0 ? (
                        <div className="cp-feed-loading">
                            <div className="cp-radar-pulse" />
                            <i className="fa-solid fa-plane-departure fa-bounce text-success fs-2 mb-3" />
                            <h3 className="h5 fw-bold text-light">Scanning Sub-Island Airspace...</h3>
                            <p className="text-muted">Correlating live flights against recent Dodo reveals</p>
                        </div>
                    ) : feed.error ? (
                        <div className="cp-feed-error">
                            <i className="fa-solid fa-triangle-exclamation text-warning fs-2 mb-2" />
                            <h3 className="h6 text-danger fw-bold">{feed.error}</h3>
                            <button
                                type="button"
                                className="cp-btn cp-btn-primary mt-3"
                                onClick={() => feed.loadFeed(true)}
                            >
                                <i className="fa-solid fa-arrows-rotate me-2" />
                                Retry Connection
                            </button>
                        </div>
                    ) : feed.flights.length === 0 ? (
                        <div className="cp-feed-empty">
                            <div className="cp-empty-leaf-icon">
                                <i className="fa-solid fa-leaf" />
                            </div>
                            <h3 className="h5 fw-bold text-light mb-1">
                                {feed.statusFilter === "pending"
                                    ? "All Caught Up!"
                                    : "No Flights Found"}
                            </h3>
                            <p className="text-muted mb-3">
                                {feed.statusFilter === "pending"
                                    ? "There are currently no pending flights awaiting moderation."
                                    : "No flights match your current search or filter criteria."}
                            </p>
                            {feed.searchQuery && (
                                <button
                                    type="button"
                                    className="cp-btn cp-btn-outline"
                                    onClick={() => feed.setSearchQuery("")}
                                >
                                    Clear Search Query
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="cp-cards-grid">
                            {feed.flights.map((flight) => (
                                <FlightCard
                                    key={flight.id}
                                    flight={flight}
                                    onQuickAuthorise={handleQuickAuthorise}
                                    onQuickDismiss={handleQuickDismiss}
                                    onOpenActionModal={handleOpenActionModal}
                                    onOpenInspect={handleOpenInspect}
                                    onUndoAction={(f) => handleUndoAction(f.id)}
                                />
                            ))}
                        </div>
                    )}
                </section>
            </div>

            {/* Modals & Slide-out Drawers */}
            <ActionModal
                isOpen={isActionModalOpen}
                flight={actionModalFlight}
                actionType={actionModalType}
                onClose={() => setIsActionModalOpen(false)}
                onSubmit={handleActionModalSubmit}
                isSubmitting={isActionSubmitting}
                errorMessage={actionModalError}
            />

            <UserInspectModal
                isOpen={isInspectModalOpen}
                flight={inspectFlight}
                onClose={() => setIsInspectModalOpen(false)}
            />

            <ActionHistoryDrawer
                isOpen={isHistoryDrawerOpen}
                onClose={() => setIsHistoryDrawerOpen(false)}
                onActionReversed={() => feed.loadFeed(true)}
            />

            {/* 15-second Undo Floating Toast */}
            <ActionToast
                toast={toast}
                onUndo={handleUndoAction}
                onDismiss={() => setToast(null)}
                isUndoing={isUndoing}
            />
        </main>
    );
};

export default ControlPanelPage;
