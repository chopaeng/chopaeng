import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { fetchPublicPassportFromDb, cleanPassportUsername, type PublicPassportData } from '../utils/userProfileApi';
import { useAuth } from '../context/useAuth';
import { useCatalogData } from '../hooks/useCatalogData';
import { playChimeClick } from '../utils/kkAudioSynthesizer';
import { ResidentPassportCard } from '../components/passport/ResidentPassportCard';

export const PublicProfile: React.FC = () => {
    const { username } = useParams<{ username: string }>();
    const { user: authUser } = useAuth();
    const { data: catalogData } = useCatalogData();

    const cleanUser = cleanPassportUsername(username);
    const [passport, setPassport] = useState<PublicPassportData | null>(null);
    const [loading, setLoading] = useState(true);
    const [copiedLink, setCopiedLink] = useState(false);

    useEffect(() => {
        if (!cleanUser) {
            setLoading(false);
            return;
        }
        setLoading(true);
        fetchPublicPassportFromDb(cleanUser).then((data) => {
            setPassport(data);
            setLoading(false);
        });
    }, [cleanUser]);

    const isOwner = Boolean(
        authUser && (
            (passport?.username && authUser.username?.toLowerCase() === passport.username.toLowerCase()) ||
            (cleanUser && authUser.username?.toLowerCase() === cleanUser.toLowerCase())
        )
    );

    const handleCopyLink = () => {
        playChimeClick();
        navigator.clipboard.writeText(window.location.href).catch(() => {});
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2500);
    };

    if (loading) {
        return (
            <div className="nook-bg min-vh-100 d-flex align-items-center justify-content-center p-4">
                <div className="text-center bg-white rounded-5 shadow-sm border p-5 animate-bounce-gentle">
                    <div className="spinner-border text-success mb-3" role="status" style={{ width: '2.5rem', height: '2.5rem' }} />
                    <h2 className="h5 ac-font text-dark mb-1">Loading Resident Passport...</h2>
                    <p className="tiny-text text-muted mb-0">Connecting to Nook Inc. Identification Database</p>
                </div>
            </div>
        );
    }

    if (!passport || (!passport.isPublic && !isOwner)) {
        return (
            <div className="nook-bg min-vh-100 py-5 px-3 d-flex align-items-center justify-content-center">
                <Helmet>
                    <title>Private Resident Profile · ChoPaeng</title>
                </Helmet>
                <div className="container" style={{ maxWidth: 540 }}>
                    <div className="bg-white rounded-5 shadow-sm border p-4 p-md-5 text-center animate-fade">
                        <div
                            className="d-inline-flex align-items-center justify-content-center rounded-circle bg-light text-muted mb-3"
                            style={{ width: 72, height: 72, fontSize: '2rem' }}
                        >
                            <i className="fa-solid fa-lock text-warning" />
                        </div>
                        <h1 className="h4 fw-black text-dark mb-2 ac-font">This Passport is Private</h1>
                        <p className="text-muted small mb-4">
                            @{cleanUser || username} hasn't made their ACNH resident passport public yet, or this user does not exist.
                        </p>
                        <div className="d-flex align-items-center justify-content-center gap-2">
                            <Link to="/islands" className="btn btn-nook rounded-pill px-4 fw-bold shadow-2xs">
                                <i className="fa-solid fa-plane me-1" /> Explore Islands
                            </Link>
                            <Link to="/profile" className="btn btn-outline-secondary rounded-pill px-4 fw-bold shadow-2xs">
                                <i className="fa-solid fa-user me-1" /> My Passport
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const allVillagers = catalogData?.villagers || [];

    return (
        <div className="nook-bg min-vh-100 py-4 py-md-5 px-3 font-nunito">
            <Helmet>
                <title>{passport.username}'s ACNH Resident Passport · ChoPaeng</title>
                <meta
                    name="description"
                    content={`View ${passport.username}'s official Animal Crossing: New Horizons resident passport, favorite villagers, native fruit, and island details.`}
                />
            </Helmet>

            <div className="container" style={{ maxWidth: 920 }}>
                {/* Top Quick Actions Bar */}
                <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
                    <Link to="/islands" className="btn btn-sm btn-light rounded-pill border fw-bold px-3 shadow-2xs d-inline-flex align-items-center gap-1">
                        <i className="fa-solid fa-arrow-left text-success" />
                        <span>Treasure Islands</span>
                    </Link>

                    <div className="d-flex align-items-center gap-2">
                        {isOwner && (
                            <Link to="/profile" className="btn btn-sm btn-outline-success rounded-pill fw-bold px-3 shadow-2xs d-inline-flex align-items-center gap-1">
                                <i className="fa-solid fa-pen-nib" />
                                <span>Edit Passport</span>
                            </Link>
                        )}

                        <Link to="/trip-planner" className="btn btn-sm btn-light rounded-pill border fw-bold px-3 shadow-2xs d-inline-flex align-items-center gap-1 d-none d-sm-inline-flex">
                            <i className="fa-solid fa-map-location-dot text-primary" />
                            <span>Trip Planner</span>
                        </Link>

                        <button
                            type="button"
                            onClick={handleCopyLink}
                            className={`btn btn-sm rounded-pill fw-bold px-3 shadow-2xs d-inline-flex align-items-center gap-1 ${
                                copiedLink ? 'btn-success text-white' : 'btn-dark text-white'
                            }`}
                        >
                            <i className={`fa-solid ${copiedLink ? 'fa-check' : 'fa-share-nodes'}`} />
                            <span>{copiedLink ? 'Link Copied!' : 'Share Passport'}</span>
                        </button>
                    </div>
                </div>

                {isOwner && !passport.isPublic && (
                    <div className="alert alert-warning rounded-4 shadow-2xs d-flex align-items-center justify-content-between flex-wrap gap-2 mb-4">
                        <div className="d-flex align-items-center gap-2 small fw-bold text-dark">
                            <i className="fa-solid fa-eye text-warning fs-5" />
                            <span>Owner Preview: Your passport is currently private. Only you can view this page.</span>
                        </div>
                        <Link to="/profile" className="btn btn-xs btn-dark rounded-pill fw-bold px-3 py-1">
                            Publish in Studio
                        </Link>
                    </div>
                )}

                {/* ════ MAIN AUTHENTIC ANIMAL CROSSING PASSPORT CARD ════ */}
                <div className="mb-4">
                    <ResidentPassportCard
                        passport={passport}
                        avatarUrl={passport.avatarUrl}
                        allVillagers={allVillagers}
                        interactive={true}
                        onShareClick={handleCopyLink}
                        shareCopied={copiedLink}
                    />
                </div>

                {/* Bottom Nook Inc. CTA Banner */}
                <div className="card rounded-4 p-4 border bg-white shadow-2xs text-center">
                    <div className="d-flex flex-column flex-md-row align-items-center justify-content-between gap-3 text-center text-md-start">
                        <div className="d-flex align-items-center gap-3">
                            <div className="icon-circle bg-success bg-opacity-10 text-success p-3 rounded-circle" style={{ width: 50, height: 50, fontSize: '1.4rem' }}>
                                <i className="fa-solid fa-id-card"></i>
                            </div>
                            <div>
                                <h3 className="h6 ac-font fw-black text-dark mb-1">Create Your Custom ACNH Resident Passport</h3>
                                <p className="tiny-text text-muted mb-0">
                                    Customize your pronouns, native fruit, favorite K.K. Slider song, and 10 favorite villager besties to share with the community.
                                </p>
                            </div>
                        </div>

                        <Link to="/profile" className="btn btn-nook rounded-pill px-4 fw-bold shadow-2xs flex-shrink-0">
                            <i className="fa-solid fa-pen-nib me-1"></i>
                            <span>Customize My Passport</span>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PublicProfile;
