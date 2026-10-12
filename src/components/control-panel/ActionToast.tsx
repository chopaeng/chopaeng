import React, { useEffect, useState } from "react";

interface ActionToastProps {
    toast: {
        id: string;
        message: string;
        visitId: number;
        action: string;
        expiresAt: number;
    } | null;
    onUndo: (visitId: number) => void;
    onDismiss: () => void;
    isUndoing: boolean;
}

export const ActionToast: React.FC<ActionToastProps> = ({ toast, onUndo, onDismiss, isUndoing }) => {
    const [progressPercent, setProgressPercent] = useState(100);

    useEffect(() => {
        if (!toast) return;

        const totalDuration = 15000; // 15s undo window
        const startTime = Date.now();

        const interval = window.setInterval(() => {
            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, 100 - (elapsed / totalDuration) * 100);
            setProgressPercent(remaining);

            if (remaining <= 0) {
                clearInterval(interval);
                onDismiss();
            }
        }, 100);

        return () => clearInterval(interval);
    }, [toast, onDismiss]);

    if (!toast) return null;

    return (
        <div className="cp-action-toast">
            <div className="cp-toast-content">
                <div className="cp-toast-icon">
                    <i className="fa-solid fa-circle-check text-success" />
                </div>
                <div className="cp-toast-text">
                    <strong>{toast.message}</strong>
                    <span className="cp-toast-sub">15s remaining to undo this action</span>
                </div>
                <button
                    type="button"
                    className="cp-btn cp-btn-undo"
                    onClick={() => onUndo(toast.visitId)}
                    disabled={isUndoing}
                    title="Revert this moderation action"
                >
                    <i className={`fa-solid ${isUndoing ? "fa-circle-notch fa-spin" : "fa-rotate-left"}`} />
                    <span>Undo</span>
                </button>
                <button type="button" className="cp-toast-close" onClick={onDismiss}>
                    <i className="fa-solid fa-xmark" />
                </button>
            </div>
            {/* Progress bar */}
            <div className="cp-toast-progress-track">
                <div className="cp-toast-progress-bar" style={{ width: `${progressPercent}%` }} />
            </div>
        </div>
    );
};
