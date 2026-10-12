import React, { useState, useEffect } from "react";
import type { FlightRecord, ModActionType, ModActionPayload } from "../../types/controlPanel";

interface ActionModalProps {
    isOpen: boolean;
    flight: FlightRecord | null;
    actionType: ModActionType;
    onClose: () => void;
    onSubmit: (payload: ModActionPayload) => Promise<void>;
    isSubmitting: boolean;
    errorMessage: string | null;
}

const PRESET_REASONS = [
    { label: "IGN Mismatch (In-game name differs from Discord/Profile)", value: "IGN Mismatch (In-game character name differs from registered Discord profile)" },
    { label: "Unregistered Character (Character not linked on website)", value: "Unregistered Character (Character has not been verified on Chopaeng)" },
    { label: "Sub-Island Rule #1 (Multi-bagging / blocking traffic)", value: "Rule #1 Violation: Multi-bagging or blocking island airport traffic" },
    { label: "Dodo Code Sharing / Leak", value: "Dodo Code Leak: Sharing private Sub-Island code with non-members" },
    { label: "Leaving via Minus Button (-)", value: "Minus Button Departure: Left quietly without using airport gates" },
    { label: "Custom Reason", value: "" },
];

export const ActionModal: React.FC<ActionModalProps> = ({
    isOpen,
    flight,
    actionType,
    onClose,
    onSubmit,
    isSubmitting,
    errorMessage,
}) => {
    const [selectedPreset, setSelectedPreset] = useState(PRESET_REASONS[0].value);
    const [customReason, setCustomReason] = useState("");
    const [notes, setNotes] = useState("");
    const [durationHours, setDurationHours] = useState(24);
    const [forceOverride, setForceOverride] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setSelectedPreset(PRESET_REASONS[0].value);
            setCustomReason("");
            setNotes("");
            setDurationHours(24);
            setForceOverride(false);
        }
    }, [isOpen, actionType]);

    if (!isOpen || !flight) return null;

    const primary = flight.primary_candidate;
    const finalReason = selectedPreset || customReason || `${actionType.toUpperCase()} action taken by moderator`;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const payload: ModActionPayload = {
            visit_id: flight.id,
            action: actionType,
            user_id: primary?.user_id || undefined,
            discord_id: primary?.user_id || undefined,
            reason: finalReason,
            notes: notes || undefined,
            duration_hours: actionType === "timeout" ? durationHours : undefined,
            force: forceOverride,
        };
        await onSubmit(payload);
    };

    const actionColors: Record<ModActionType, { title: string; badge: string; icon: string }> = {
        authorise: { title: "Authorise Flight", badge: "cp-badge-success", icon: "fa-circle-check" },
        dismiss: { title: "Dismiss Flight", badge: "cp-badge-muted", icon: "fa-eye-slash" },
        warn: { title: "Issue Warning Strike", badge: "cp-badge-warning", icon: "fa-triangle-exclamation" },
        timeout: { title: "Issue Temporary Timeout", badge: "cp-badge-orange", icon: "fa-clock-rotate-left" },
        ban: { title: "Permanent Sub-Island Ban", badge: "cp-badge-danger", icon: "fa-ban" },
    };

    const currentConfig = actionColors[actionType] || actionColors.warn;

    return (
        <div className="cp-modal-overlay" onClick={onClose}>
            <div className="cp-modal-card" onClick={(e) => e.stopPropagation()}>
                <div className="cp-modal-header">
                    <div className="cp-modal-title-wrap">
                        <span className={`cp-badge ${currentConfig.badge}`}>
                            <i className={`fa-solid ${currentConfig.icon}`} /> {actionType.toUpperCase()}
                        </span>
                        <h2 className="cp-modal-title">{currentConfig.title}</h2>
                    </div>
                    <button type="button" className="cp-modal-close" onClick={onClose}>
                        <i className="fa-solid fa-xmark" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="cp-modal-body">
                    {/* Target summary banner */}
                    <div className="cp-modal-target-box">
                        <div className="cp-target-row">
                            <span className="text-muted">Target Flight:</span>
                            <strong>#{flight.id} — {flight.ign} ({flight.origin_island || "Island"})</strong>
                        </div>
                        <div className="cp-target-row">
                            <span className="text-muted">Destination:</span>
                            <span className="text-info">{flight.destination} Sub-Island</span>
                        </div>
                        <div className="cp-target-row">
                            <span className="text-muted">Matched User:</span>
                            <strong>{primary ? `@${primary.username} (${primary.ign || "No IGN"})` : "No Reveal Recorded"}</strong>
                        </div>
                    </div>

                    {/* Ban warning alert */}
                    {actionType === "ban" && (
                        <div className="cp-alert-danger">
                            <i className="fa-solid fa-triangle-exclamation" />
                            <div>
                                <strong>Permanent Ban Warning</strong>
                                <p className="mb-0">
                                    This will block this user from revealing Sub-Island Dodo codes permanently and issue an official ban record.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Error display */}
                    {errorMessage && (
                        <div className="cp-alert-danger">
                            <i className="fa-solid fa-circle-exclamation" />
                            <div>
                                <span>{errorMessage}</span>
                                {errorMessage.includes("already handled") && (
                                    <label className="cp-checkbox-label mt-2 d-block">
                                        <input
                                            type="checkbox"
                                            checked={forceOverride}
                                            onChange={(e) => setForceOverride(e.target.checked)}
                                        />
                                        <span>Force Override Previous Action</span>
                                    </label>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Timeout Duration Picker */}
                    {actionType === "timeout" && (
                        <div className="cp-form-group">
                            <label className="cp-form-label">Timeout Duration</label>
                            <select
                                className="cp-select w-100"
                                value={durationHours}
                                onChange={(e) => setDurationHours(Number(e.target.value))}
                            >
                                <option value={1}>1 Hour (Quick Cooling Off)</option>
                                <option value={6}>6 Hours</option>
                                <option value={24}>24 Hours (Standard 1st Offense)</option>
                                <option value={72}>3 Days (72 Hours)</option>
                                <option value={168}>7 Days (1 Week)</option>
                                <option value={720}>30 Days (1 Month)</option>
                            </select>
                        </div>
                    )}

                    {/* Reason Presets */}
                    <div className="cp-form-group">
                        <label className="cp-form-label">Reason for Action</label>
                        <select
                            className="cp-select w-100 mb-2"
                            value={selectedPreset}
                            onChange={(e) => setSelectedPreset(e.target.value)}
                        >
                            {PRESET_REASONS.map((preset, idx) => (
                                <option key={idx} value={preset.value}>
                                    {preset.label}
                                </option>
                            ))}
                        </select>

                        {/* Custom Reason Text if selected */}
                        {selectedPreset === "" && (
                            <input
                                type="text"
                                className="cp-input w-100"
                                placeholder="Enter custom reason..."
                                value={customReason}
                                onChange={(e) => setCustomReason(e.target.value)}
                                required
                            />
                        )}
                    </div>

                    {/* Moderator Internal Notes */}
                    <div className="cp-form-group">
                        <label className="cp-form-label">Moderator Internal Notes (Optional)</label>
                        <textarea
                            className="cp-textarea w-100"
                            rows={2}
                            placeholder="Add internal notes for other staff members..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </div>

                    {/* Footer Buttons */}
                    <div className="cp-modal-footer">
                        <button type="button" className="cp-btn cp-btn-ghost" onClick={onClose} disabled={isSubmitting}>
                            Cancel
                        </button>
                        <button type="submit" className={`cp-btn ${actionType === "ban" ? "cp-btn-danger" : "cp-btn-primary"}`} disabled={isSubmitting}>
                            {isSubmitting ? (
                                <>
                                    <i className="fa-solid fa-circle-notch fa-spin me-2" />
                                    Applying...
                                </>
                            ) : (
                                `Confirm ${actionType.toUpperCase()}`
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
