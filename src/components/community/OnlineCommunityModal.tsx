import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useIslandData } from '../../context/useIslandData';
import { useAuth } from '../../context/useAuth';
import { playChimeClick } from '../../utils/kkAudioSynthesizer';
import {
    getTrafficStats,
    recordSiteVisit,
    calculateIslandOccupancy,
    getOnlineResidentsList,
    fetchOnlinePresence,
    sendPresenceHeartbeat,
    type OnlineResident,
    type TrafficStats,
} from '../../utils/communityPresenceApi';

export const OnlineCommunityModal: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'online' | 'islands' | 'visits'>('online');
    const [searchQuery, setSearchQuery] = useState('');
    const [residentFilter, setResidentFilter] = useState<'all' | 'on_island' | 'ordering' | 'passport'>('all');
    const [trafficStats, setTrafficStats] = useState<TrafficStats>(getTrafficStats);
    const [waveFeedback, setWaveFeedback] = useState<string | null>(null);
    const [copiedDodo, setCopiedDodo] = useState<string | null>(null);

    const { islands } = useIslandData();
    const { user } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    // Dynamic backend presence state
    const [residents, setResidents] = useState<OnlineResident[]>(() =>
        getOnlineResidentsList(user, location.pathname)
    );
    const [isServerLive, setIsServerLive] = useState<boolean>(false);
    const [presenceLoading, setPresenceLoading] = useState<boolean>(false);

    const refreshPresence = useCallback(async () => {
        setPresenceLoading(true);
        try {
            await sendPresenceHeartbeat(location.pathname, user);
            const res = await fetchOnlinePresence(user, location.pathname);
            setResidents(res.residents);
            setIsServerLive(res.isLive);
        } catch {
            // fallback handled inside fetchOnlinePresence
        } finally {
            setPresenceLoading(false);
        }
    }, [location.pathname, user]);

    // Refresh presence when modal is open
    useEffect(() => {
        if (!isOpen) return;
        refreshPresence();
        const interval = setInterval(refreshPresence, 10_000);
        return () => clearInterval(interval);
    }, [isOpen, refreshPresence]);

    // Record site visit on mount & listen for global trigger event
    useEffect(() => {
        const stats = recordSiteVisit();
        setTrafficStats(stats);

        const handleOpen = (e: any) => {
            playChimeClick();
            if (e.detail?.tab) {
                setActiveTab(e.detail.tab);
            }
            setIsOpen(true);
        };

        const handleTrafficUpdate = (e: any) => {
            if (e.detail) setTrafficStats(e.detail);
        };

        window.addEventListener('chopaeng_open_community_hub', handleOpen);
        window.addEventListener('chopaeng_traffic_updated', handleTrafficUpdate);

        return () => {
            window.removeEventListener('chopaeng_open_community_hub', handleOpen);
            window.removeEventListener('chopaeng_traffic_updated', handleTrafficUpdate);
        };
    }, []);

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                setIsOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    // Live occupancy calculation
    const occupancy = useMemo(() => calculateIslandOccupancy(islands), [islands]);

    // Filtered residents list based on search and filter tab
    const filteredResidents = useMemo(() => {
        return residents.filter((r) => {
            if (residentFilter === 'on_island' && r.status !== 'on_island') return false;
            if (residentFilter === 'ordering' && r.status !== 'ordering') return false;
            if (residentFilter === 'passport' && !r.hasPublicPassport) return false;

            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matchName = r.displayName.toLowerCase().includes(q) || r.username.toLowerCase().includes(q);
                const matchIgn = r.ign?.toLowerCase().includes(q) || false;
                const matchIsland = r.islandName?.toLowerCase().includes(q) || false;
                const matchAct = r.currentActivity.toLowerCase().includes(q);
                return matchName || matchIgn || matchIsland || matchAct;
            }
            return true;
        });
    }, [residents, residentFilter, searchQuery]);

    const handleWave = (resident: OnlineResident) => {
        playChimeClick();
        setWaveFeedback(`You waved at ${resident.displayName}! 👋`);
        setTimeout(() => setWaveFeedback(null), 3000);
    };

    const handleCopyDodo = (dodo: string) => {
        playChimeClick();
        navigator.clipboard.writeText(dodo);
        setCopiedDodo(dodo);
        setTimeout(() => setCopiedDodo(null), 2000);
    };

    if (!isOpen) return null;

    // Digits for the retro all-time visits odometer
    const visitDigits = String(trafficStats.allTimeVisits).padStart(7, '0').split('');

    return (
        <div
            className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
            style={{
                backgroundColor: 'rgba(15, 23, 42, 0.72)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                zIndex: 1060,
                padding: '1rem',
            }}
            onClick={() => setIsOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="communityRadarTitle"
        >
            <style>{`
                @keyframes pulseDot {
                    0%, 100% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.4); opacity: 0.6; }
                }
                .radar-pulse-dot {
                    width: 10px;
                    height: 10px;
                    background-color: #22c55e;
                    border-radius: 50%;
                    display: inline-block;
                    box-shadow: 0 0 10px rgba(34, 197, 94, 0.7);
                    animation: pulseDot 2s infinite ease-in-out;
                }
                .odometer-digit-box {
                    background: linear-gradient(180deg, #1e293b, #0f172a);
                    color: #fde047;
                    font-family: 'Courier New', Courier, monospace;
                    font-weight: 900;
                    font-size: 2.25rem;
                    line-height: 1;
                    padding: 0.5rem 0.65rem;
                    border-radius: 0.5rem;
                    border: 2px solid #334155;
                    box-shadow: inset 0 2px 6px rgba(0,0,0,0.6), 0 4px 12px rgba(0,0,0,0.3);
                    min-width: 2.5rem;
                    text-align: center;
                    text-shadow: 0 0 8px rgba(253, 224, 71, 0.5);
                }
                @media (max-width: 576px) {
                    .odometer-digit-box {
                        font-size: 1.5rem;
                        padding: 0.35rem 0.45rem;
                        min-width: 1.8rem;
                    }
                }
                .radar-tab-btn {
                    padding: 0.65rem 1.15rem;
                    border-radius: 9999px;
                    font-weight: 700;
                    font-size: 0.88rem;
                    border: none;
                    background: transparent;
                    color: #64748b;
                    transition: all 0.2s ease;
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                .radar-tab-btn:hover {
                    color: #0f172a;
                    background-color: rgba(241, 245, 249, 0.8);
                }
                .radar-tab-btn.active {
                    background-color: #16a34a;
                    color: #ffffff !important;
                    box-shadow: 0 4px 12px rgba(22, 163, 74, 0.3);
                }
                .seat-dot {
                    width: 14px;
                    height: 14px;
                    border-radius: 4px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                }
                .seat-dot.filled {
                    background-color: #16a34a;
                    color: #fff;
                    box-shadow: 0 2px 4px rgba(22, 163, 74, 0.3);
                }
                .seat-dot.empty {
                    background-color: #e2e8f0;
                    border: 1.5px dashed #94a3b8;
                }
            `}</style>

            <div
                className="bg-white rounded-5 shadow-lg border overflow-hidden d-flex flex-column animate-fade"
                style={{
                    width: '100%',
                    maxWidth: '860px',
                    maxHeight: '90vh',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* ── MODAL HEADER ── */}
                <div
                    className="p-3.5 px-4 d-flex align-items-center justify-content-between border-bottom"
                    style={{
                        background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
                    }}
                >
                    <div className="d-flex align-items-center gap-3">
                        <div
                            className="rounded-4 d-flex align-items-center justify-content-center shadow-xs text-white"
                            style={{
                                width: 44,
                                height: 44,
                                background: 'linear-gradient(135deg, #16a34a, #15803d)',
                                fontSize: '1.25rem',
                            }}
                        >
                            <i className="fa-solid fa-satellite-dish"></i>
                        </div>
                        <div>
                            <div className="d-flex align-items-center gap-2">
                                <span className="radar-pulse-dot"></span>
                                <h3 id="communityRadarTitle" className="h5 ac-font text-dark mb-0">
                                    ChoPaeng Live Radar
                                </h3>
                                <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-2.5 py-0.5 tiny-text fw-bold">
                                    DAL Telemetry
                                </span>
                            </div>
                            <p className="tiny-text text-muted mb-0">
                                Online Residents · Island Occupancy · Lifetime Traffic
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => setIsOpen(false)}
                        className="btn btn-light rounded-circle border d-flex align-items-center justify-content-center shadow-xs"
                        style={{ width: 36, height: 36 }}
                        aria-label="Close"
                    >
                        <i className="fa-solid fa-xmark text-muted"></i>
                    </button>
                </div>

                {/* ── TAB SELECTOR ── */}
                <div className="px-4 py-2.5 bg-light border-bottom d-flex align-items-center justify-content-between flex-wrap gap-2">
                    <div className="d-flex align-items-center gap-1.5 flex-wrap">
                        <button
                            type="button"
                            className={`radar-tab-btn ${activeTab === 'online' ? 'active' : ''}`}
                            onClick={() => {
                                playChimeClick();
                                setActiveTab('online');
                            }}
                        >
                            <i className="fa-solid fa-users"></i>
                            <span>Who's Online</span>
                            <span
                                className={`badge rounded-pill px-2 py-0.5 ${
                                    activeTab === 'online' ? 'bg-white text-success' : 'bg-success text-white'
                                }`}
                            >
                                {trafficStats.activeOnlineCount}
                            </span>
                        </button>

                        <button
                            type="button"
                            className={`radar-tab-btn ${activeTab === 'islands' ? 'active' : ''}`}
                            onClick={() => {
                                playChimeClick();
                                setActiveTab('islands');
                            }}
                        >
                            <i className="fa-solid fa-plane-arrival"></i>
                            <span>Island Occupancy</span>
                            <span
                                className={`badge rounded-pill px-2 py-0.5 ${
                                    activeTab === 'islands' ? 'bg-white text-success' : 'bg-primary text-white'
                                }`}
                            >
                                {occupancy.totalVisitors} in Islands
                            </span>
                        </button>

                        <button
                            type="button"
                            className={`radar-tab-btn ${activeTab === 'visits' ? 'active' : ''}`}
                            onClick={() => {
                                playChimeClick();
                                setActiveTab('visits');
                            }}
                        >
                            <i className="fa-solid fa-chart-line"></i>
                            <span>All-Time Visits</span>
                            <span
                                className={`badge rounded-pill px-2 py-0.5 ${
                                    activeTab === 'visits' ? 'bg-white text-success' : 'bg-warning text-dark'
                                }`}
                            >
                                2.8M+
                            </span>
                        </button>
                    </div>

                    <div className="d-flex align-items-center gap-2 tiny-text">
                        {isServerLive ? (
                            <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-2 py-0.5 d-inline-flex align-items-center gap-1">
                                <span className="radar-pulse-dot" style={{ width: 6, height: 6 }} />
                                Live Server Presence
                            </span>
                        ) : (
                            <span className="badge bg-secondary-subtle text-secondary rounded-pill px-2 py-0.5">
                                Local Roster
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={() => {
                                playChimeClick();
                                refreshPresence();
                            }}
                            disabled={presenceLoading}
                            className="btn btn-sm btn-link text-muted p-0 text-decoration-none"
                            title="Refresh live presence now"
                        >
                            <i className={`fa-solid fa-rotate ${presenceLoading ? 'fa-spin text-success' : 'text-success'}`} />
                        </button>
                    </div>
                </div>

                {/* ── MODAL BODY SCROLLABLE ── */}
                <div
                    className="p-4 overflow-y-auto"
                    style={{
                        maxHeight: 'calc(90vh - 150px)',
                    }}
                >
                    {waveFeedback && (
                        <div className="alert alert-success border-success-subtle rounded-4 py-2 px-3 mb-3 d-flex align-items-center justify-content-between animate-bounce-gentle">
                            <span className="small fw-bold">
                                <i className="fa-solid fa-hand me-2 text-warning"></i>
                                {waveFeedback}
                            </span>
                            <button
                                type="button"
                                className="btn-close btn-close-sm"
                                onClick={() => setWaveFeedback(null)}
                            ></button>
                        </div>
                    )}

                    {/* ════════════ TAB 1: WHO'S CURRENTLY ONLINE ════════════ */}
                    {activeTab === 'online' && (
                        <div className="animate-fade">
                            {/* Filter & Search Bar */}
                            <div className="row g-2 mb-3 align-items-center">
                                <div className="col-md-6">
                                    <div className="position-relative">
                                        <i className="fa-solid fa-magnifying-glass position-absolute top-50 start-0 translate-middle-y ms-3 text-muted"></i>
                                        <input
                                            type="text"
                                            className="form-control rounded-pill ps-5 pe-3 py-2 small shadow-2xs"
                                            placeholder="Search residents by name, IGN, or island..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                        {searchQuery && (
                                            <button
                                                type="button"
                                                className="btn position-absolute top-50 end-0 translate-middle-y me-2 p-0 text-muted"
                                                onClick={() => setSearchQuery('')}
                                            >
                                                <i className="fa-solid fa-circle-xmark"></i>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="col-md-6 d-flex align-items-center gap-1 justify-content-md-end flex-wrap">
                                    <button
                                        type="button"
                                        className={`btn btn-xs rounded-pill px-3 fw-bold ${
                                            residentFilter === 'all'
                                                ? 'btn-dark text-white'
                                                : 'btn-outline-secondary'
                                        }`}
                                        onClick={() => {
                                            playChimeClick();
                                            setResidentFilter('all');
                                        }}
                                    >
                                        All ({residents.length})
                                    </button>
                                    <button
                                        type="button"
                                        className={`btn btn-xs rounded-pill px-3 fw-bold ${
                                            residentFilter === 'on_island'
                                                ? 'btn-success text-white'
                                                : 'btn-outline-secondary'
                                        }`}
                                        onClick={() => {
                                            playChimeClick();
                                            setResidentFilter('on_island');
                                        }}
                                    >
                                        <i className="fa-solid fa-plane-arrival me-1"></i>
                                        On Islands ({residents.filter((r) => r.status === 'on_island').length})
                                    </button>
                                    <button
                                        type="button"
                                        className={`btn btn-xs rounded-pill px-3 fw-bold ${
                                            residentFilter === 'ordering'
                                                ? 'btn-info text-white'
                                                : 'btn-outline-secondary'
                                        }`}
                                        onClick={() => {
                                            playChimeClick();
                                            setResidentFilter('ordering');
                                        }}
                                    >
                                        <i className="fa-solid fa-box-open me-1"></i>
                                        In Queue ({residents.filter((r) => r.status === 'ordering').length})
                                    </button>
                                    <button
                                        type="button"
                                        className={`btn btn-xs rounded-pill px-3 fw-bold ${
                                            residentFilter === 'passport'
                                                ? 'btn-warning text-dark'
                                                : 'btn-outline-secondary'
                                        }`}
                                        onClick={() => {
                                            playChimeClick();
                                            setResidentFilter('passport');
                                        }}
                                    >
                                        <i className="fa-solid fa-id-card me-1"></i>
                                        Passports ({residents.filter((r) => r.hasPublicPassport).length})
                                    </button>
                                </div>
                            </div>

                            {/* Residents Grid */}
                            <div className="row g-3">
                                {filteredResidents.length === 0 ? (
                                    <div className="col-12 py-5 text-center text-muted">
                                        <i className="fa-solid fa-user-slash fs-1 mb-2 text-muted opacity-50"></i>
                                        <div className="fw-bold">No online residents match your search.</div>
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-outline-success rounded-pill mt-2"
                                            onClick={() => {
                                                setSearchQuery('');
                                                setResidentFilter('all');
                                            }}
                                        >
                                            Reset Filters
                                        </button>
                                    </div>
                                ) : (
                                    filteredResidents.map((resident) => (
                                        <div className="col-md-6" key={resident.id}>
                                            <div
                                                className={`p-3 rounded-4 border h-100 d-flex flex-column justify-content-between transition-all ${
                                                    resident.isCurrentUser
                                                        ? 'bg-success-subtle border-success'
                                                        : 'bg-white shadow-xs'
                                                }`}
                                                style={{ minHeight: 120 }}
                                            >
                                                <div className="d-flex align-items-start gap-3">
                                                    {/* Avatar with Live Indicator */}
                                                    <div className="position-relative flex-shrink-0">
                                                        <img
                                                            src={resident.avatarUrl}
                                                            alt={resident.displayName}
                                                            className="rounded-circle border shadow-xs"
                                                            style={{
                                                                width: 50,
                                                                height: 50,
                                                                objectFit: 'cover',
                                                                backgroundColor: '#f8fafc',
                                                            }}
                                                            onError={(e) => {
                                                                (e.currentTarget as HTMLImageElement).src =
                                                                    'https://acnhcdn.com/latest/NpcIcon/der00.png';
                                                            }}
                                                        />
                                                        <span
                                                            className="position-absolute bottom-0 end-0 rounded-circle border border-2 border-white"
                                                            style={{
                                                                width: 14,
                                                                height: 14,
                                                                backgroundColor:
                                                                    resident.status === 'on_island'
                                                                        ? '#3b82f6'
                                                                        : resident.status === 'ordering'
                                                                        ? '#f59e0b'
                                                                        : '#22c55e',
                                                            }}
                                                            title={resident.status}
                                                        ></span>
                                                    </div>

                                                    {/* Resident Info */}
                                                    <div className="flex-grow-1 min-w-0">
                                                        <div className="d-flex align-items-center gap-1.5 flex-wrap">
                                                            <span className="fw-bold text-dark text-truncate" style={{ maxWidth: 140 }}>
                                                                {resident.displayName}
                                                            </span>
                                                            {resident.isCurrentUser && (
                                                                <span className="badge bg-warning text-dark rounded-pill tiny-text fw-bold">
                                                                    You
                                                                </span>
                                                            )}
                                                            <span
                                                                className={`badge rounded-pill tiny-text px-2 ${
                                                                    resident.role === 'admin'
                                                                        ? 'bg-danger-subtle text-danger border border-danger-subtle'
                                                                        : resident.role === 'mod'
                                                                        ? 'bg-primary-subtle text-primary border border-primary-subtle'
                                                                        : resident.role === 'member'
                                                                        ? 'bg-warning-subtle text-warning-emphasis border border-warning-subtle'
                                                                        : 'bg-secondary-subtle text-secondary'
                                                                }`}
                                                            >
                                                                {resident.role.toUpperCase()}
                                                            </span>
                                                        </div>

                                                        {/* In-Game details */}
                                                        <div className="tiny-text text-muted mt-0.5">
                                                            <span>IGN: <strong>{resident.ign}</strong></span>
                                                            <span className="mx-1">·</span>
                                                            <span>🏝️ {resident.islandName}</span>
                                                        </div>

                                                        {/* Activity Tag */}
                                                        <div className="mt-1.5">
                                                            <span
                                                                className="badge rounded-pill px-2.5 py-1 tiny-text fw-normal d-inline-flex align-items-center gap-1.5 text-wrap"
                                                                style={{
                                                                    backgroundColor:
                                                                        resident.status === 'on_island'
                                                                            ? '#eff6ff'
                                                                            : resident.status === 'ordering'
                                                                            ? '#fffbeb'
                                                                            : '#f0fdf4',
                                                                    color:
                                                                        resident.status === 'on_island'
                                                                            ? '#1d4ed8'
                                                                            : resident.status === 'ordering'
                                                                            ? '#b45309'
                                                                            : '#15803d',
                                                                    border: '1px solid currentColor',
                                                                    borderColor: 'rgba(0,0,0,0.08)',
                                                                }}
                                                            >
                                                                <i
                                                                    className={`fa-solid ${
                                                                        resident.status === 'on_island'
                                                                            ? 'fa-plane-departure'
                                                                            : resident.status === 'ordering'
                                                                            ? 'fa-box'
                                                                            : 'fa-circle-dot'
                                                                    }`}
                                                                ></i>
                                                                <span>{resident.currentActivity}</span>
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Action Bar */}
                                                <div className="d-flex align-items-center justify-content-between mt-2 pt-2 border-top">
                                                    <span className="tiny-text text-muted">
                                                        {resident.joinedMinutesAgo === 0
                                                            ? 'Active right now'
                                                            : `Active ${resident.joinedMinutesAgo}m ago`}
                                                    </span>

                                                    <div className="d-flex align-items-center gap-1.5">
                                                        <button
                                                            type="button"
                                                            className="btn btn-xs btn-outline-secondary rounded-pill px-2"
                                                            title="Wave hello"
                                                            onClick={() => handleWave(resident)}
                                                        >
                                                            👋 Wave
                                                        </button>
                                                        {resident.hasPublicPassport ? (
                                                            <button
                                                                type="button"
                                                                className="btn btn-xs btn-outline-success rounded-pill px-2.5 fw-bold"
                                                                onClick={() => {
                                                                    playChimeClick();
                                                                    setIsOpen(false);
                                                                    navigate(`/u/${resident.username}`);
                                                                }}
                                                            >
                                                                Passport <i className="fa-solid fa-arrow-up-right-from-square ms-0.5"></i>
                                                            </button>
                                                        ) : (
                                                            <span className="tiny-text text-muted fst-italic">Private</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Summary note */}
                            <div className="p-3 bg-light rounded-4 border mt-3 text-center tiny-text text-muted">
                                <i className="fa-solid fa-shield-cat me-1.5 text-success"></i>
                                Showing active residents registered on ChoPaeng. Real-time presence synced via NookLink DAL flight communications.
                            </div>
                        </div>
                    )}

                    {/* ════════════ TAB 2: HOW MANY IN THE ISLANDS (ISLAND OCCUPANCY) ════════════ */}
                    {activeTab === 'islands' && (
                        <div className="animate-fade">
                            {/* Hero Island Occupancy Gauge */}
                            <div
                                className="p-4 rounded-4 text-white shadow-sm mb-4 position-relative overflow-hidden"
                                style={{
                                    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                                }}
                            >
                                <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
                                    <div>
                                        <div className="d-flex align-items-center gap-2 mb-1">
                                            <span className="badge bg-white text-info rounded-pill px-2.5 py-1 fw-bold tiny-text">
                                                <i className="fa-solid fa-tower-broadcast me-1"></i>LIVE RADAR
                                            </span>
                                            <span className="text-white-50 tiny-text">DAL Air Traffic Control</span>
                                        </div>
                                        <h4 className="h2 ac-font mb-1 text-white">
                                            {occupancy.totalVisitors} Players on Islands
                                        </h4>
                                        <p className="small text-white-50 mb-0">
                                            Currently active across {occupancy.onlineIslandCount} open treasure island gates (Capacity: {occupancy.maxCapacity} slots)
                                        </p>
                                    </div>

                                    <div className="text-end">
                                        <div className="display-6 fw-black text-white">
                                            {occupancy.percentFull}%
                                        </div>
                                        <span className="badge bg-white-20 rounded-pill px-2.5 py-1 text-white tiny-text">
                                            Total Island Load
                                        </span>
                                    </div>
                                </div>

                                {/* Visual Runway Progress Bar */}
                                <div className="mt-3">
                                    <div
                                        className="progress rounded-pill overflow-hidden"
                                        style={{ height: 12, backgroundColor: 'rgba(255,255,255,0.25)' }}
                                    >
                                        <div
                                            className="progress-bar bg-warning progress-bar-striped progress-bar-animated"
                                            role="progressbar"
                                            style={{ width: `${occupancy.percentFull}%` }}
                                            aria-valuenow={occupancy.percentFull}
                                            aria-valuemin={0}
                                            aria-valuemax={100}
                                        ></div>
                                    </div>
                                    <div className="d-flex justify-content-between text-white-50 tiny-text mt-1.5">
                                        <span>0 Passengers</span>
                                        <span>{occupancy.totalVisitors} / {occupancy.maxCapacity} Seats Occupied</span>
                                        <span>Full ({occupancy.maxCapacity})</span>
                                    </div>
                                </div>
                            </div>

                            {/* 4 Stat Highlights */}
                            <div className="row g-3 mb-4">
                                <div className="col-6 col-md-3">
                                    <div className="p-3 bg-light rounded-4 border text-center">
                                        <div className="text-muted tiny-text fw-bold text-uppercase">Online Gates</div>
                                        <div className="fs-3 fw-black text-success mt-1">{occupancy.onlineIslandCount}</div>
                                        <div className="tiny-text text-muted">Islands active</div>
                                    </div>
                                </div>

                                <div className="col-6 col-md-3">
                                    <div className="p-3 bg-light rounded-4 border text-center">
                                        <div className="text-muted tiny-text fw-bold text-uppercase">Public Passengers</div>
                                        <div className="fs-3 fw-black text-primary mt-1">{occupancy.publicVisitors}</div>
                                        <div className="tiny-text text-muted">On free islands</div>
                                    </div>
                                </div>

                                <div className="col-6 col-md-3">
                                    <div className="p-3 bg-light rounded-4 border text-center">
                                        <div className="text-muted tiny-text fw-bold text-uppercase">Member Travelers</div>
                                        <div className="fs-3 fw-black text-warning-emphasis mt-1">{occupancy.memberVisitors}</div>
                                        <div className="tiny-text text-muted">On sub islands</div>
                                    </div>
                                </div>

                                <div className="col-6 col-md-3">
                                    <div className="p-3 bg-light rounded-4 border text-center">
                                        <div className="text-muted tiny-text fw-bold text-uppercase">Refreshing</div>
                                        <div className="fs-3 fw-black text-secondary mt-1">{occupancy.refreshingCount}</div>
                                        <div className="tiny-text text-muted">Resetting Dodo</div>
                                    </div>
                                </div>
                            </div>

                            {/* Island-by-Island Passenger Roster */}
                            <div className="d-flex align-items-center justify-content-between mb-3">
                                <h5 className="h6 ac-font text-dark mb-0">
                                    <i className="fa-solid fa-list-check me-2 text-success"></i>
                                    Island Flight Roster &amp; Gate Occupancy
                                </h5>
                                <button
                                    type="button"
                                    className="btn btn-xs btn-nook rounded-pill px-3 fw-bold"
                                    onClick={() => {
                                        playChimeClick();
                                        setIsOpen(false);
                                        navigate('/islands');
                                    }}
                                >
                                    Open Full Board <i className="fa-solid fa-arrow-right ms-1"></i>
                                </button>
                            </div>

                            <div className="vstack gap-2.5">
                                {occupancy.busiestIslands.length === 0 ? (
                                    <div className="text-center py-4 text-muted">No live islands currently online.</div>
                                ) : (
                                    occupancy.busiestIslands.map((island) => {
                                        const isFull = island.visitors >= 7;
                                        const isOnline = island.status === 'ONLINE' || !island.status;

                                        return (
                                            <div
                                                key={island.name}
                                                className="p-3 rounded-4 bg-white border shadow-xs d-flex align-items-center justify-content-between flex-wrap gap-2"
                                            >
                                                {/* Left: Island Info */}
                                                <div className="d-flex align-items-center gap-3 min-w-0">
                                                    <div
                                                        className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                                                        style={{
                                                            width: 40,
                                                            height: 40,
                                                            backgroundColor: isFull
                                                                ? '#fee2e2'
                                                                : isOnline
                                                                ? '#dcfce7'
                                                                : '#f1f5f9',
                                                            color: isFull ? '#dc2626' : isOnline ? '#16a34a' : '#64748b',
                                                            fontWeight: 900,
                                                        }}
                                                    >
                                                        <i
                                                            className={`fa-solid ${
                                                                isFull ? 'fa-user-group' : 'fa-plane'
                                                            }`}
                                                        ></i>
                                                    </div>

                                                    <div>
                                                        <div className="d-flex align-items-center gap-2">
                                                            <strong className="text-dark ac-font">{island.name}</strong>
                                                            <span
                                                                className={`badge rounded-pill tiny-text px-2 py-0.5 ${
                                                                    island.cat === 'member'
                                                                        ? 'bg-warning-subtle text-warning-emphasis border border-warning-subtle'
                                                                        : 'bg-info-subtle text-info border border-info-subtle'
                                                                }`}
                                                            >
                                                                {island.cat === 'member' ? 'Sub Member' : 'Public'}
                                                            </span>
                                                            <span
                                                                className={`badge rounded-pill tiny-text px-2 py-0.5 ${
                                                                    isOnline ? 'bg-success text-white' : 'bg-secondary text-white'
                                                                }`}
                                                            >
                                                                {island.status || 'ONLINE'}
                                                            </span>
                                                        </div>
                                                        <div className="tiny-text text-muted">
                                                            Gate Status: {isFull ? 'Flight Gate Full (7/7)' : `${island.visitors}/7 seats taken`}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Right: Seat Dots & Quick Copy */}
                                                <div className="d-flex align-items-center gap-3">
                                                    {/* 7 Passenger Seat Indicator Dots */}
                                                    <div className="d-flex align-items-center gap-1" title={`${island.visitors}/7 Passengers`}>
                                                        {Array.from({ length: 7 }).map((_, i) => (
                                                            <span
                                                                key={i}
                                                                className={`seat-dot ${i < island.visitors ? 'filled' : 'empty'}`}
                                                            >
                                                                {i < island.visitors && (
                                                                    <i className="fa-solid fa-check" style={{ fontSize: '0.5rem' }}></i>
                                                                )}
                                                            </span>
                                                        ))}
                                                    </div>

                                                    {/* Dodo Code Button if available */}
                                                    {island.dodoCode && island.dodoCode !== "GETTIN'" && (
                                                        <button
                                                            type="button"
                                                            className={`btn btn-xs rounded-pill px-3 fw-bold font-monospace ${
                                                                copiedDodo === island.dodoCode
                                                                    ? 'btn-success text-white'
                                                                    : 'btn-outline-dark'
                                                            }`}
                                                            onClick={() => handleCopyDodo(island.dodoCode!)}
                                                        >
                                                            {copiedDodo === island.dodoCode ? (
                                                                <>
                                                                    <i className="fa-solid fa-check me-1"></i>Copied!
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <i className="fa-solid fa-copy me-1"></i>
                                                                    {island.dodoCode}
                                                                </>
                                                            )}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}

                    {/* ════════════ TAB 3: ALL-TIME WEBSITE VISITS ════════════ */}
                    {activeTab === 'visits' && (
                        <div className="animate-fade text-center">
                            {/* Odometer Section */}
                            <div className="p-4 p-md-5 rounded-4 bg-dark text-white border shadow-sm mb-4">
                                <div className="text-warning tiny-text fw-bold text-uppercase mb-2" style={{ letterSpacing: '0.12em' }}>
                                    <i className="fa-solid fa-passport me-1.5"></i>
                                    NOOK INC. DAL FLIGHT DISPATCHER TELEMETRY
                                </div>
                                <h4 className="h3 ac-font text-white mb-4">
                                    All-Time Community Flights &amp; Site Visits
                                </h4>

                                {/* Digit Flip Box */}
                                <div className="d-flex align-items-center justify-content-center gap-1.5 flex-wrap mb-4">
                                    {visitDigits.map((digit, idx) => (
                                        <div key={idx} className="odometer-digit-box">
                                            {digit}
                                        </div>
                                    ))}
                                </div>

                                <p className="small text-muted mb-0 max-w-md mx-auto">
                                    Every flight, inventory search, catalog lookup, and bot order across all Animal Crossing players worldwide.
                                </p>
                            </div>

                            {/* Secondary Metrics */}
                            <div className="row g-3 mb-4">
                                <div className="col-md-4">
                                    <div className="p-3 bg-light rounded-4 border">
                                        <div className="text-muted tiny-text fw-bold text-uppercase">Visits Today</div>
                                        <div className="fs-3 fw-black text-nook-green mt-1">
                                            {trafficStats.visitsToday.toLocaleString()}
                                        </div>
                                        <div className="tiny-text text-muted">Flights logged today</div>
                                    </div>
                                </div>

                                <div className="col-md-4">
                                    <div className="p-3 bg-light rounded-4 border">
                                        <div className="text-muted tiny-text fw-bold text-uppercase">Visits This Week</div>
                                        <div className="fs-3 fw-black text-info mt-1">
                                            {trafficStats.visitsThisWeek.toLocaleString()}
                                        </div>
                                        <div className="tiny-text text-muted">7-day community traffic</div>
                                    </div>
                                </div>

                                <div className="col-md-4">
                                    <div className="p-3 bg-light rounded-4 border">
                                        <div className="text-muted tiny-text fw-bold text-uppercase">Active Online</div>
                                        <div className="fs-3 fw-black text-success mt-1">
                                            {trafficStats.activeOnlineCount}
                                        </div>
                                        <div className="tiny-text text-muted">Residents active now</div>
                                    </div>
                                </div>
                            </div>

                            {/* Fun Community Achievements */}
                            <div className="row g-3 text-start">
                                <div className="col-md-6">
                                    <div className="p-3 rounded-4 bg-white border shadow-xs d-flex align-items-start gap-3">
                                        <div
                                            className="rounded-circle bg-warning-subtle text-warning d-flex align-items-center justify-content-center flex-shrink-0"
                                            style={{ width: 42, height: 42, fontSize: '1.25rem' }}
                                        >
                                            <i className="fa-solid fa-trophy"></i>
                                        </div>
                                        <div>
                                            <div className="fw-bold text-dark">Over 2.8 Million Visits Milestone</div>
                                            <div className="tiny-text text-muted">
                                                ChoPaeng has served over 2.8 million animal crossing flights, item searches, and orders!
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="col-md-6">
                                    <div className="p-3 rounded-4 bg-white border shadow-xs d-flex align-items-start gap-3">
                                        <div
                                            className="rounded-circle bg-success-subtle text-success d-flex align-items-center justify-content-center flex-shrink-0"
                                            style={{ width: 42, height: 42, fontSize: '1.25rem' }}
                                        >
                                            <i className="fa-solid fa-plane-departure"></i>
                                        </div>
                                        <div>
                                            <div className="fw-bold text-dark">DAL 24/7 Flight Gate Uptime</div>
                                            <div className="tiny-text text-muted">
                                                Near-zero airport delays with continuous automated Dodo code refreshing and live file sync.
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── MODAL FOOTER ── */}
                <div className="p-3 px-4 bg-light border-top d-flex align-items-center justify-content-between flex-wrap gap-2">
                    <div className="tiny-text text-muted d-flex align-items-center gap-2">
                        <span className="radar-pulse-dot"></span>
                        <span>Dodo Airlines Flight Telemetry &middot; Live Community Feed</span>
                    </div>

                    <div className="d-flex align-items-center gap-2">
                        <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary rounded-pill px-3"
                            onClick={() => setIsOpen(false)}
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OnlineCommunityModal;
