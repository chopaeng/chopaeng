import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/useAuth';
import { playChimeClick } from '../utils/kkAudioSynthesizer';

export interface AuthRequiredEventDetail {
    action?: string;
    message?: string;
    returnPath?: string;
}

export const AuthRequiredModal: React.FC = () => {
    const { login } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [modalData, setModalData] = useState<AuthRequiredEventDetail>({});

    useEffect(() => {
        const handleOpen = (e: CustomEvent<AuthRequiredEventDetail>) => {
            setModalData(e.detail || {});
            setIsOpen(true);
        };

        window.addEventListener('chopaeng_auth_required' as any, handleOpen);
        return () => {
            window.removeEventListener('chopaeng_auth_required' as any, handleOpen);
        };
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsOpen(false);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    if (!isOpen) return null;

    const actionName = modalData.action || 'This Feature';
    const message = modalData.message || `Please sign in with Discord to use ${actionName} and save your progress to ChoBot.`;

    const handleLogin = () => {
        playChimeClick();
        login(modalData.returnPath || window.location.pathname + window.location.search);
        setIsOpen(false);
    };

    const handleClose = () => {
        playChimeClick();
        setIsOpen(false);
    };

    return (
        <div
            className="modal-backdrop-custom d-flex align-items-center justify-content-center"
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(15, 23, 42, 0.65)',
                backdropFilter: 'blur(5px)',
                zIndex: 9999,
                padding: '1rem',
            }}
            onClick={handleClose}
        >
            <div
                className="bg-white rounded-4 shadow-lg border p-4 text-center position-relative animate-fade"
                style={{
                    maxWidth: 460,
                    width: '100%',
                    border: '1.5px solid rgba(0, 0, 0, 0.08)',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close Button */}
                <button
                    type="button"
                    onClick={handleClose}
                    className="btn btn-sm btn-light rounded-circle position-absolute top-0 end-0 m-3 d-flex align-items-center justify-content-center"
                    style={{ width: 32, height: 32 }}
                    aria-label="Close"
                >
                    <i className="fa-solid fa-xmark text-muted"></i>
                </button>

                {/* Discord Badge Icon */}
                <div
                    className="d-inline-flex align-items-center justify-content-center rounded-circle text-white mb-3 shadow-sm"
                    style={{
                        width: 64,
                        height: 64,
                        backgroundColor: '#5865F2',
                        fontSize: '1.6rem',
                    }}
                >
                    <i className="fa-brands fa-discord"></i>
                </div>

                <div className="mb-2">
                    <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 rounded-pill px-3 py-1 fw-bold text-uppercase" style={{ fontSize: '0.68rem', letterSpacing: '0.05em' }}>
                        <i className="fa-solid fa-leaf me-1"></i>Authentication Required
                    </span>
                </div>

                <h2 className="ac-font h4 text-dark mb-2 fw-black">
                    Sign in to use {actionName}
                </h2>

                <p className="text-muted fw-bold small mb-4" style={{ lineHeight: 1.5 }}>
                    {message}
                </p>


                <div className="d-flex flex-column gap-2">
                    <button
                        type="button"
                        onClick={handleLogin}
                        className="btn btn-lg rounded-pill fw-black py-2.5 text-white shadow-sm border-0 d-flex align-items-center justify-content-center gap-2"
                        style={{ backgroundColor: '#5865F2', fontSize: '0.95rem' }}
                    >
                        <i className="fa-brands fa-discord fs-5"></i>
                        <span>Log in with Discord</span>
                    </button>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="btn btn-sm btn-link text-muted fw-bold text-decoration-none"
                    >
                        Not Now
                    </button>
                </div>
            </div>
        </div>
    );
};
