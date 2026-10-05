import React from 'react';
import { useAuth } from '../context/useAuth';
import { playChimeClick } from '../utils/kkAudioSynthesizer';

interface RequireAuthViewProps {
    title: string;
    description: string;
    icon?: string;
    badge?: string;
    returnPath?: string;
}

export const RequireAuthView: React.FC<RequireAuthViewProps> = ({
    title,
    description,
    icon = 'fa-lock',
    badge = 'Resident Account Required',
    returnPath,
}) => {
    const { login, loading } = useAuth();

    const handleLogin = () => {
        playChimeClick();
        login(returnPath || window.location.pathname + window.location.search);
    };

    if (loading) {
        return (
            <div className="container py-5 text-center">
                <div className="spinner-border text-success mb-3" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
                <div className="fw-bold text-muted ac-font">Verifying Resident Credentials...</div>
            </div>
        );
    }

    return (
        <div className="container py-5 my-4" style={{ maxWidth: 680 }}>
            <div className="card border-0 shadow-sm rounded-4 overflow-hidden text-center p-4 p-md-5 position-relative"
                style={{
                    backgroundColor: 'var(--card-bg, #ffffff)',
                    border: '1.5px solid var(--border-color, rgba(0, 0, 0, 0.08))',
                }}
            >
                {/* Decorative Top Accent */}
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 6,
                        background: 'linear-gradient(90deg, #10b981 0%, #5865f2 50%, #38bdf8 100%)',
                    }}
                />

                {/* Badge */}
                <div className="mb-3">
                    <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 rounded-pill px-3 py-1.5 fw-bold text-uppercase"
                        style={{ fontSize: '0.72rem', letterSpacing: '0.06em' }}
                    >
                        <i className="fa-solid fa-leaf me-1.5"></i>
                        {badge}
                    </span>
                </div>

                {/* Big Icon Circle */}
                <div className="d-inline-flex align-items-center justify-content-center mx-auto mb-4 rounded-circle shadow-sm"
                    style={{
                        width: 84,
                        height: 84,
                        backgroundColor: '#5865F2',
                        color: '#ffffff',
                        fontSize: '2rem',
                    }}
                >
                    <i className={`fa-solid ${icon}`}></i>
                </div>

                {/* Title */}
                <h1 className="ac-font h3 text-dark mb-3 fw-black">
                    {title}
                </h1>

                {/* Description */}
                <p className="text-muted fw-bold mb-4 mx-auto" style={{ maxWidth: 500, fontSize: '0.98rem', lineHeight: 1.6 }}>
                    {description}
                </p>

                {/* Feature checklist */}
                <div className="bg-light rounded-3 p-3 mb-4 text-start border d-flex flex-column gap-2 mx-auto w-100" style={{ maxWidth: 460 }}>
                    <div className="d-flex align-items-center gap-2 small fw-bold text-secondary">
                        <i className="fa-solid fa-circle-check text-success"></i>
                        <span>Saved to ChoBot automatically</span>
                    </div>
                    <div className="d-flex align-items-center gap-2 small fw-bold text-secondary">
                        <i className="fa-solid fa-circle-check text-success"></i>
                        <span>Syncs seamlessly across your browser, phone, and tablet</span>
                    </div>
                    <div className="d-flex align-items-center gap-2 small fw-bold text-secondary">
                        <i className="fa-solid fa-circle-check text-success"></i>
                        <span>Protected under your private Discord resident account</span>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="d-flex flex-column flex-sm-row align-items-center justify-content-center gap-3">
                    <button
                        type="button"
                        onClick={handleLogin}
                        className="btn btn-lg rounded-pill fw-black px-4 py-2.5 shadow-sm d-inline-flex align-items-center gap-2 text-white border-0"
                        style={{ backgroundColor: '#5865F2', fontSize: '0.95rem' }}
                    >
                        <i className="fa-brands fa-discord fs-5"></i>
                        <span>Login with Discord</span>
                    </button>
                    <a
                        href="/"
                        className="btn btn-lg btn-light border rounded-pill fw-bold px-4 py-2.5 small text-secondary"
                        style={{ fontSize: '0.9rem' }}
                    >
                        Return Home
                    </a>
                </div>
            </div>
        </div>
    );
};
