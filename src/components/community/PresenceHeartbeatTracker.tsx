import React, { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import {
    sendPresenceHeartbeat,
    sendPresenceLeave,
    pollPendingWaves,
    broadcastResidentWave,
    setActivePresenceUser,
    type WaveNotification,
} from '../../utils/communityPresenceApi';
import { playWaveChime, playWaveBackChime, playChimeClick } from '../../utils/kkAudioSynthesizer';

/**
 * Global component mounted inside <Router> that:
 * 1. Sends continuous real-time presence heartbeats & leave beacons to backend.
 * 2. Synchronizes active user identity for presence routing.
 * 3. Regularly polls for pending cross-device waves directed to this user or session.
 * 4. Renders an Animal Crossing-styled floating toast notification when another resident waves!
 */
export const PresenceHeartbeatTracker: React.FC = () => {
    const location = useLocation();
    const { user } = useAuth();
    const [incomingWave, setIncomingWave] = useState<WaveNotification | null>(null);
    const [wavedBackSuccess, setWavedBackSuccess] = useState(false);
    const dismissTimerRef = useRef<any>(null);

    // Sync active presence user identity
    useEffect(() => {
        setActivePresenceUser(user);
    }, [user]);

    // Heartbeat on route navigation or user auth state update
    useEffect(() => {
        sendPresenceHeartbeat(location.pathname, user);
    }, [location.pathname, user]);

    // Periodic heartbeat every 25 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            sendPresenceHeartbeat(location.pathname, user);
        }, 25_000);

        return () => clearInterval(interval);
    }, [location.pathname, user]);

    // Fast background wave poll every 6 seconds to deliver waves without delay
    useEffect(() => {
        pollPendingWaves();
        const pollInterval = setInterval(() => {
            pollPendingWaves();
        }, 6_000);

        return () => clearInterval(pollInterval);
    }, []);

    // Send departure beacon when closing browser tab or navigating away
    useEffect(() => {
        const handleBeforeUnload = () => {
            sendPresenceLeave();
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, []);

    // Listen for genuine incoming wave events directed to this user/session
    useEffect(() => {
        const handleWave = (e: any) => {
            const wave = e.detail as WaveNotification | undefined;
            if (!wave) return;

            // Clear any previous dismiss timer
            if (dismissTimerRef.current) {
                clearTimeout(dismissTimerRef.current);
            }

            playWaveChime();
            setIncomingWave(wave);
            setWavedBackSuccess(false);

            // Auto dismiss after 9 seconds if untouched
            dismissTimerRef.current = setTimeout(() => {
                setIncomingWave(null);
                setWavedBackSuccess(false);
            }, 9000);
        };

        window.addEventListener('chopaeng_resident_wave', handleWave);
        return () => {
            window.removeEventListener('chopaeng_resident_wave', handleWave);
            if (dismissTimerRef.current) {
                clearTimeout(dismissTimerRef.current);
            }
        };
    }, []);

    const handleWaveBack = () => {
        if (!incomingWave) return;
        playWaveBackChime();

        const myUsername = user?.username || 'Guest';
        const myDisplayName = user?.nickname || user?.discord_name || (user?.username ? `@${user.username}` : 'Island Explorer');

        broadcastResidentWave({
            fromUsername: myUsername,
            fromDisplayName: myDisplayName,
            fromAvatarUrl: user?.avatar,
            toUsername: incomingWave.fromUsername,
            toDisplayName: incomingWave.fromDisplayName,
            toSessionId: incomingWave.fromSessionId,
        });

        setWavedBackSuccess(true);

        if (dismissTimerRef.current) {
            clearTimeout(dismissTimerRef.current);
        }
        dismissTimerRef.current = setTimeout(() => {
            setIncomingWave(null);
            setWavedBackSuccess(false);
        }, 3000);
    };

    const handleDismiss = () => {
        playChimeClick();
        if (dismissTimerRef.current) {
            clearTimeout(dismissTimerRef.current);
        }
        setIncomingWave(null);
        setWavedBackSuccess(false);
    };

    if (!incomingWave) return null;

    return (
        <>
            <style>{`
                @keyframes slideDownToast {
                    0% {
                        opacity: 0;
                        transform: translate(-50%, -24px) scale(0.94);
                    }
                    60% {
                        transform: translate(-50%, 4px) scale(1.02);
                    }
                    100% {
                        opacity: 1;
                        transform: translate(-50%, 0) scale(1);
                    }
                }
                @keyframes waveHandWiggle {
                    0%, 100% { transform: rotate(0deg); }
                    20% { transform: rotate(18deg); }
                    40% { transform: rotate(-12deg); }
                    60% { transform: rotate(14deg); }
                    80% { transform: rotate(-6deg); }
                }
                .chopaeng-wave-toast {
                    animation: slideDownToast 0.38s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                .chopaeng-wave-hand {
                    display: inline-block;
                    animation: waveHandWiggle 1.4s ease-in-out infinite;
                    transform-origin: 70% 70%;
                }
                .chopaeng-wave-btn:hover {
                    transform: scale(1.05);
                    box-shadow: 0 4px 14px rgba(16, 185, 129, 0.45) !important;
                }
                .chopaeng-wave-btn:active {
                    transform: scale(0.96);
                }
            `}</style>

            <div
                className="chopaeng-wave-toast position-fixed shadow-lg"
                style={{
                    top: '1.25rem',
                    left: '50%',
                    zIndex: 999999,
                    width: 'calc(100% - 2rem)',
                    maxWidth: '450px',
                    backgroundColor: 'rgba(15, 23, 42, 0.94)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    border: '1.5px solid rgba(16, 185, 129, 0.65)',
                    borderRadius: '1.25rem',
                    boxShadow: '0 16px 40px rgba(0, 0, 0, 0.5), 0 0 25px rgba(16, 185, 129, 0.25)',
                    color: '#f8fafc',
                    padding: '0.75rem 1rem',
                }}
                role="alert"
                aria-live="polite"
            >
                <div className="d-flex align-items-center justify-content-between gap-3">
                    {/* Left: Avatar with pulsing halo & waving hand badge */}
                    <div className="position-relative flex-shrink-0">
                        <img
                            src={incomingWave.fromAvatarUrl || 'https://acnhcdn.com/latest/NpcIcon/der00.png'}
                            alt={incomingWave.fromDisplayName}
                            style={{
                                width: 44,
                                height: 44,
                                borderRadius: '50%',
                                objectFit: 'cover',
                                border: '2.5px solid #10b981',
                                backgroundColor: '#1e293b',
                                display: 'block',
                            }}
                            onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src = 'https://acnhcdn.com/latest/NpcIcon/der00.png';
                            }}
                        />
                        <span
                            className="position-absolute chopaeng-wave-hand"
                            style={{
                                bottom: -3,
                                right: -5,
                                fontSize: '1.05rem',
                                lineHeight: 1,
                                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
                            }}
                        >
                            👋
                        </span>
                    </div>

                    {/* Middle: Details */}
                    <div className="flex-grow-1 min-w-0">
                        <div className="d-flex align-items-center gap-1.5 mb-0.5">
                            <span
                                className="badge rounded-pill px-1.5 py-0.5 fw-bold"
                                style={{
                                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                                    color: '#34d399',
                                    border: '1px solid rgba(16, 185, 129, 0.4)',
                                    fontSize: '0.66rem',
                                    letterSpacing: '0.04em',
                                }}
                            >
                                DAL RADAR
                            </span>
                            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                Island Wave
                            </span>
                        </div>
                        <div
                            className="fw-bold text-truncate"
                            style={{ fontSize: '0.92rem', color: '#ffffff', lineHeight: 1.25 }}
                        >
                            {incomingWave.fromDisplayName}
                        </div>
                        <div
                            className="text-truncate"
                            style={{
                                fontSize: '0.75rem',
                                color: wavedBackSuccess ? '#34d399' : '#cbd5e1',
                                marginTop: '1px',
                            }}
                        >
                            {wavedBackSuccess
                                ? '✨ You warmly waved back across the skies!'
                                : 'Waved hello at you from the island radar!'}
                        </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="d-flex align-items-center gap-1.5 flex-shrink-0">
                        {!wavedBackSuccess ? (
                            <button
                                type="button"
                                className="btn btn-sm rounded-pill fw-bold text-white px-3 py-1.5 chopaeng-wave-btn d-inline-flex align-items-center gap-1.5"
                                style={{
                                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                    border: 'none',
                                    fontSize: '0.8rem',
                                    boxShadow: '0 2px 10px rgba(16, 185, 129, 0.4)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                                }}
                                onClick={handleWaveBack}
                                title={`Wave back to ${incomingWave.fromDisplayName}`}
                            >
                                <span>Wave Back</span>
                                <span className="chopaeng-wave-hand">👋</span>
                            </button>
                        ) : (
                            <span
                                className="badge rounded-pill px-2.5 py-1.5 d-inline-flex align-items-center gap-1 fw-bold"
                                style={{
                                    backgroundColor: 'rgba(16, 185, 129, 0.25)',
                                    color: '#34d399',
                                    border: '1px solid #10b981',
                                    fontSize: '0.78rem',
                                }}
                            >
                                <i className="fa-solid fa-check"></i>
                                <span>Sent!</span>
                            </span>
                        )}

                        <button
                            type="button"
                            className="btn btn-sm p-1 d-inline-flex align-items-center justify-content-center"
                            style={{
                                width: 28,
                                height: 28,
                                borderRadius: '50%',
                                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                                border: 'none',
                                color: '#94a3b8',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                            }}
                            onClick={handleDismiss}
                            aria-label="Dismiss wave"
                            title="Dismiss"
                        >
                            <i className="fa-solid fa-xmark" style={{ fontSize: '0.85rem' }}></i>
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};
