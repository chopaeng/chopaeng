import { useState, useEffect } from 'react';
import { useAuth } from '../../context/useAuth';
import type { SuggestionFormData } from '../../types/suggestion';
import {
    sendDiscordSuggestion,
    getSuggestionCooldownRemaining,
} from '../../utils/suggestionsApi';

interface SuggestionModalProps {
    isOpen?: boolean;
    onClose?: () => void;
}

export const SuggestionModal = ({
    isOpen: controlledIsOpen,
    onClose: controlledOnClose,
}: SuggestionModalProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [discordUsername, setDiscordUsername] = useState('');
    const [inGameName, setInGameName] = useState('');
    const [islandName, setIslandName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [cooldown, setCooldown] = useState(0);

    const { user } = useAuth();

    // Auto-fill username if logged in
    useEffect(() => {
        if (user?.username) {
            setDiscordUsername(user.username);
        }
    }, [user]);

    // Handle global event trigger
    useEffect(() => {
        const handleOpenEvent = () => {
            setIsOpen(true);
            setIsSubmitted(false);
            setErrorMessage(null);
            setCooldown(getSuggestionCooldownRemaining());
        };

        window.addEventListener('chopaeng_open_suggestions', handleOpenEvent);
        return () => window.removeEventListener('chopaeng_open_suggestions', handleOpenEvent);
    }, []);

    // Controlled prop sync
    useEffect(() => {
        if (controlledIsOpen !== undefined) {
            setIsOpen(controlledIsOpen);
            if (controlledIsOpen) {
                setIsSubmitted(false);
                setErrorMessage(null);
                setCooldown(getSuggestionCooldownRemaining());
            }
        }
    }, [controlledIsOpen]);

    // Cooldown countdown timer
    useEffect(() => {
        if (cooldown <= 0) return;
        const interval = setInterval(() => {
            setCooldown((prev) => {
                if (prev <= 1) {
                    clearInterval(interval);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [cooldown]);

    const handleClose = () => {
        setIsOpen(false);
        controlledOnClose?.();
    };

    const handleReset = () => {
        setTitle('');
        setDescription('');
        setIsSubmitted(false);
        setErrorMessage(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !description.trim()) {
            setErrorMessage('Please fill in both a title and details.');
            return;
        }

        setIsSubmitting(true);
        setErrorMessage(null);

        const payload: SuggestionFormData = {
            title: title.trim(),
            description: description.trim(),
            discordUsername: discordUsername.trim() || undefined,
            inGameName: inGameName.trim() || undefined,
            islandName: islandName.trim() || undefined,
            pageUrl: window.location.href,
        };

        const result = await sendDiscordSuggestion(payload);

        setIsSubmitting(false);

        if (result.success) {
            setIsSubmitted(true);
            setCooldown(15);
        } else {
            setErrorMessage(result.error || 'Failed to send suggestion to Discord.');
            if (result.cooldownSeconds) {
                setCooldown(result.cooldownSeconds);
            }
        }
    };

    if (!isOpen) return null;

    const charPercentage = Math.min(100, Math.round((description.length / 1000) * 100));

    return (
        <div
            className="modal show d-block fade-in"
            style={{
                backgroundColor: 'rgba(0, 0, 0, 0.55)',
                zIndex: 1060,
                backdropFilter: 'blur(4px)',
            }}
            onClick={handleClose}
        >
            <div
                className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable my-3"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: '620px' }}
            >
                <div className="modal-content rounded-4 border-0 shadow-lg overflow-hidden bg-white">
                    {/* ── Modal Header (Clean Flat Style) ────────────────────── */}
                    <div className="modal-header py-3 px-4 bg-white border-bottom border-light-subtle">
                        <div className="d-flex align-items-center gap-3">
                            <div
                                className="rounded-circle d-flex align-items-center justify-content-center bg-success bg-opacity-10 text-success"
                                style={{
                                    width: '40px',
                                    height: '40px',
                                }}
                            >
                                <i className="fa-solid fa-lightbulb text-warning fs-5"></i>
                            </div>
                            <div>
                                <div className="d-flex align-items-center gap-2 mb-0">
                                    <h4 className="modal-title fw-black ac-font mb-0 text-dark" style={{ fontSize: '1.15rem' }}>
                                        Resident Suggestion Box
                                    </h4>
                                    <span className="badge bg-primary bg-opacity-10 text-primary rounded-pill x-small fw-bold border border-primary border-opacity-25">
                                        <i className="fa-brands fa-discord me-1"></i>Discord Relay
                                    </span>
                                </div>
                                <p className="tiny-text mb-0 text-muted">
                                    Send your ideas, feature requests, or bugs directly to staff
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            className="btn-close shadow-none"
                            onClick={handleClose}
                            aria-label="Close"
                        ></button>
                    </div>

                    {/* ── Modal Body ───────────────────────────────────────── */}
                    <div className="modal-body p-4">
                        {isSubmitted ? (
                            /* ── Celebratory Delivery Screen ──────────────────── */
                            <div className="text-center py-4 px-2 animate-scale-up">
                                <div
                                    className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3 bg-success text-white shadow-sm"
                                    style={{
                                        width: '72px',
                                        height: '72px',
                                    }}
                                >
                                    <i className="fa-solid fa-envelope-circle-check fs-2"></i>
                                </div>

                                <h3 className="fw-black ac-font text-dark mb-2" style={{ fontSize: '1.3rem' }}>
                                    Delivered to Staff Discord!
                                </h3>
                                <p className="text-muted small mb-4" style={{ maxWidth: '440px', margin: '0 auto' }}>
                                    Thank you! Your feedback has been formatted into an embed and dispatched directly to the staff Discord channel.
                                </p>

                                {/* Delivery Summary Card */}
                                <div
                                    className="rounded-3 p-3 bg-light border border-light-subtle shadow-2xs mb-4 text-start position-relative"
                                    style={{ maxWidth: '480px', margin: '0 auto' }}
                                >
                                    <div className="fw-black text-dark font-monospace mb-1 d-flex align-items-center" style={{ fontSize: '0.95rem' }}>
                                        <i className="fa-solid fa-lightbulb text-warning me-1.5" aria-hidden="true" />
                                        <span>{title}</span>
                                    </div>

                                    <p className="text-muted mb-2 small text-truncate-3" style={{ fontSize: '0.85rem' }}>
                                        {description}
                                    </p>

                                    <div className="tiny-text text-muted font-monospace border-top pt-2 d-flex align-items-center justify-content-between">
                                        <span>From: <strong>{discordUsername || 'Anonymous Resident'}</strong></span>
                                        <span>Sent just now</span>
                                    </div>
                                </div>

                                <div className="d-flex justify-content-center gap-2">
                                    <button
                                        type="button"
                                        className="btn btn-light rounded-pill px-4 fw-bold border"
                                        onClick={handleClose}
                                    >
                                        Done
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-success text-white rounded-pill px-4 fw-bold shadow-2xs"
                                        onClick={handleReset}
                                    >
                                        <i className="fa-solid fa-plus me-1"></i>Submit Another Idea
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* ── Clean Form View ──────────────────────────────── */
                            <form onSubmit={handleSubmit}>
                                {/* 1. Suggestion Title */}
                                <div className="mb-3">
                                    <label className="form-label fw-black text-uppercase text-muted tiny-text letter-spacing-1 mb-1">
                                        Suggestion Title <span className="text-danger">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        className="form-control rounded-3 fw-bold border-light-subtle shadow-none"
                                        placeholder="e.g. Add 1-Click Pocket Autofill in Command Builder"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        maxLength={120}
                                        required
                                        style={{ fontSize: '0.92rem' }}
                                    />
                                </div>

                                {/* 2. Details & Notes */}
                                <div className="mb-3">
                                    <div className="d-flex align-items-center justify-content-between mb-1">
                                        <label className="form-label fw-black text-uppercase text-muted tiny-text letter-spacing-1 mb-0">
                                            Details & Explanation <span className="text-danger">*</span>
                                        </label>
                                        <span
                                            className={`tiny-text font-monospace ${
                                                description.length > 900 ? 'text-danger fw-black' : 'text-muted'
                                            }`}
                                        >
                                            {description.length} / 1000
                                        </span>
                                    </div>

                                    <textarea
                                        className="form-control rounded-3 border-light-subtle shadow-none"
                                        rows={4}
                                        placeholder="Describe your idea, feature request, island feedback, or bug report..."
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        maxLength={1000}
                                        required
                                        style={{ fontSize: '0.88rem', lineHeight: '1.5' }}
                                    ></textarea>

                                    {/* Character Progress Bar */}
                                    <div className="progress mt-1 rounded-pill" style={{ height: '3px' }}>
                                        <div
                                            className={`progress-bar transition-all ${
                                                charPercentage > 90
                                                    ? 'bg-danger'
                                                    : charPercentage > 60
                                                    ? 'bg-warning'
                                                    : 'bg-success'
                                            }`}
                                            style={{ width: `${charPercentage}%` }}
                                        ></div>
                                    </div>
                                </div>

                                {/* 3. Resident Info Card */}
                                <div className="card rounded-3 p-3 bg-light border border-light-subtle shadow-2xs mb-4">
                                    <div className="d-flex align-items-center gap-2 mb-2">
                                        <div
                                            className="rounded-circle d-flex align-items-center justify-content-center bg-success bg-opacity-10 text-success"
                                            style={{ width: '22px', height: '22px', fontSize: '0.75rem' }}
                                        >
                                            <i className="fa-solid fa-id-card"></i>
                                        </div>
                                        <span className="tiny-text fw-black text-uppercase text-muted letter-spacing-1">
                                            Resident Info (Optional)
                                        </span>
                                    </div>

                                    <div className="row g-2">
                                        <div className="col-12 col-md-5">
                                            <div className="input-group input-group-sm">
                                                <span className="input-group-text bg-white border-light-subtle text-muted">
                                                    <i className="fa-brands fa-discord text-primary"></i>
                                                </span>
                                                <input
                                                    type="text"
                                                    className="form-control shadow-none bg-white"
                                                    placeholder="Discord tag (e.g. Cho#0001)"
                                                    value={discordUsername}
                                                    onChange={(e) => setDiscordUsername(e.target.value)}
                                                />
                                            </div>
                                        </div>

                                        <div className="col-6 col-md-3">
                                            <div className="input-group input-group-sm">
                                                <span className="input-group-text bg-white border-light-subtle text-muted">
                                                    <i className="fa-solid fa-user text-success"></i>
                                                </span>
                                                <input
                                                    type="text"
                                                    className="form-control shadow-none bg-white"
                                                    placeholder="In-Game Name"
                                                    value={inGameName}
                                                    onChange={(e) => setInGameName(e.target.value)}
                                                />
                                            </div>
                                        </div>

                                        <div className="col-6 col-md-4">
                                            <div className="input-group input-group-sm">
                                                <span className="input-group-text bg-white border-light-subtle text-muted">
                                                    <i className="fa-solid fa-umbrella-beach text-warning"></i>
                                                </span>
                                                <input
                                                    type="text"
                                                    className="form-control shadow-none bg-white"
                                                    placeholder="Island Name"
                                                    value={islandName}
                                                    onChange={(e) => setIslandName(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Error Alert */}
                                {errorMessage && (
                                    <div className="alert alert-danger py-2 px-3 small rounded-3 mb-3 animate-fade-in d-flex align-items-center gap-2">
                                        <i className="fa-solid fa-triangle-exclamation text-danger fs-5"></i>
                                        <span>{errorMessage}</span>
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="d-flex align-items-center justify-content-between pt-3 border-top">
                                    <div className="tiny-text text-muted d-flex align-items-center gap-1">
                                        <i className="fa-solid fa-shield-halved text-success"></i>
                                        <span className="d-none d-sm-inline">Dispatches directly to Discord staff channel</span>
                                        <span className="d-inline d-sm-none">To Discord staff</span>
                                    </div>

                                    <div className="d-flex gap-2">
                                        <button
                                            type="button"
                                            className="btn btn-light rounded-pill px-3 fw-bold border hover-bg-light"
                                            onClick={handleClose}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isSubmitting || cooldown > 0 || !title.trim() || !description.trim()}
                                            className="btn btn-success text-white rounded-pill px-4 fw-black shadow-sm d-flex align-items-center gap-2"
                                            style={{
                                                minWidth: '135px',
                                                justifyContent: 'center',
                                            }}
                                        >
                                            {isSubmitting ? (
                                                <>
                                                    <span className="spinner-border spinner-border-sm"></span>
                                                    <span>Sending...</span>
                                                </>
                                            ) : cooldown > 0 ? (
                                                <>
                                                    <i className="fa-solid fa-clock"></i>
                                                    <span>Wait {cooldown}s</span>
                                                </>
                                            ) : (
                                                <>
                                                    <i className="fa-solid fa-paper-plane"></i>
                                                    <span>Send Idea</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            </div>

            <style>{`
                .animate-scale-up {
                    animation: scaleUpModal 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                @keyframes scaleUpModal {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
            `}</style>
        </div>
    );
};
