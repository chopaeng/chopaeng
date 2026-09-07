import { Link } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import banner from '../assets/banner.png';
import logo from '../assets/logo.webp';
import StreamEmbed from "../components/StreamEmbed";
import DisclaimerBanner from "../components/DisclaimerBanner";
import { BLOGS_API_BASE } from "../config/api";
import { useIslandData } from "../context/useIslandData";
import { playChimeClick } from "../utils/kkAudioSynthesizer";
import TodaySnapshot from "../components/TodaySnapshot";

interface BlogPost {
    id: string;
    title: string;
    date: string;
    category: string;
    image: string;
    excerpt: string;
}

const stripHtml = (html: string) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || "";
};

const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    const month = date.toLocaleString('default', { month: 'short' });
    const day = date.getDate();
    return `${month} ${day}`;
};

const Home = () => {
    const { islands, loading: islandsLoading } = useIslandData();
    const [posts, setPosts] = useState<BlogPost[]>([]);
    const [loading, setLoading] = useState(true);

    // Hero interactive showcase tab state (flights vs stream)
    const [heroTab, setHeroTab] = useState<'flights' | 'stream'>('flights');
    const [flightFilter, setFlightFilter] = useState<'all' | 'public' | 'member'>('all');

    // Fetch blog posts
    useEffect(() => {
        const fetchPosts = async () => {
            try {
                const response = await fetch(`${BLOGS_API_BASE}/api/patreon/posts`);
                if (!response.ok) throw new Error("Failed to fetch");

                const json = await response.json();

                const transformed: BlogPost[] = [...json.data]
                    .sort(
                        (a: any, b: any) =>
                            new Date(b.attributes.published_at).getTime() -
                            new Date(a.attributes.published_at).getTime()
                    )
                    .slice(0, 3)
                    .map((item: any) => {
                        const attr = item.attributes;
                        let imageUrl = attr.image?.large_url;
                        if (!imageUrl && attr.embed_data?.provider === "YouTube") {
                            imageUrl = banner;
                        }
                        if (!imageUrl) {
                            imageUrl = banner;
                        }

                        const category = attr.is_public ? "Announcement" : "Members Only";
                        const rawText = stripHtml(attr.content);
                        const excerpt = rawText.length > 100 ? rawText.substring(0, 100) + "..." : rawText;

                        return {
                            id: item.id,
                            title: attr.title,
                            date: formatDate(attr.published_at),
                            category,
                            image: imageUrl,
                            excerpt
                        };
                    });

                setPosts(transformed);
            } catch (error) {
                console.error("Error loading posts:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchPosts();
    }, []);

    // Filter featured live islands for the departure board
    const liveIslands = useMemo(() => {
        if (!islands || islands.length === 0) return [];
        return islands
            .filter((isl) => {
                const isOnline = isl.status === 'ONLINE' || !isl.status;
                if (!isOnline) return false;
                if (flightFilter === 'public') return isl.cat === 'public';
                if (flightFilter === 'member') return isl.cat === 'member';
                return true;
            })
            .slice(0, 5);
    }, [islands, flightFilter]);

    return (
        <>
            <title>Chopaeng | #1 ACNH Treasure Island Hub & Order Bot</title>
            <meta name="description" content="Chopaeng is the ultimate Animal Crossing: New Horizons companion hub. 24/7 Live Treasure Islands, interactive 40-slot Command Builder, automated Order Bot delivery, and community loadouts." />
            <meta name="keywords" content="ACNH treasure islands, Animal Crossing New Horizons treasure island, order bot acnh, command builder acnh, ACNH dodo codes, free acnh items, bells, villagers, DIYs" />
            <link rel="canonical" href="https://www.chopaeng.com/" />

            <meta property="og:type" content="website" />
            <meta property="og:site_name" content="Chopaeng" />
            <meta property="og:title" content="Chopaeng | #1 ACNH Treasure Island Hub & Order Bot" />
            <meta property="og:description" content="24/7 Live Treasure Islands, interactive 40-slot Command Builder, and automated Order Bot delivery." />
            <meta property="og:url" content="https://www.chopaeng.com/" />
            <meta property="og:image" content="https://www.chopaeng.com/banner.png" />

            <style>
                {`
                .home-hero-bg {
                    background: radial-gradient(circle at 10% 20%, rgba(220, 252, 231, 0.45) 0%, rgba(240, 253, 244, 0.2) 50%, rgba(255, 255, 255, 1) 100%);
                }
                [data-theme="celeste"] .home-hero-bg {
                    background: radial-gradient(circle at 10% 20%, rgba(139, 92, 246, 0.15) 0%, rgba(30, 41, 59, 0.4) 50%, #0b0f19 100%) !important;
                }
                [data-theme="roost"] .home-hero-bg {
                    background: radial-gradient(circle at 10% 20%, rgba(217, 119, 6, 0.15) 0%, rgba(41, 37, 36, 0.4) 50%, #141210 100%) !important;
                }
                [data-theme="sakura"] .home-hero-bg {
                    background: radial-gradient(circle at 10% 20%, rgba(244, 114, 182, 0.25) 0%, rgba(253, 242, 248, 0.6) 50%, #ffffff 100%) !important;
                }
                [data-theme="dal"] .home-hero-bg {
                    background: radial-gradient(circle at 10% 20%, rgba(56, 189, 248, 0.15) 0%, rgba(30, 41, 59, 0.4) 50%, #0f172a 100%) !important;
                }
                [data-theme="nooklink"] .home-hero-bg {
                    background: radial-gradient(circle at 10% 20%, rgba(16, 185, 129, 0.15) 0%, rgba(17, 24, 39, 0.4) 50%, #090d16 100%) !important;
                }

                .hero-tab-btn {
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .hero-tab-btn.active {
                    background-color: #1b2d24 !important;
                    color: #ffffff !important;
                    box-shadow: 0 4px 12px rgba(27, 45, 36, 0.2);
                }
                [data-theme="celeste"] .hero-tab-btn.active {
                    background-color: #7c3aed !important;
                    box-shadow: 0 4px 12px rgba(124, 58, 237, 0.35) !important;
                }
                [data-theme="roost"] .hero-tab-btn.active {
                    background-color: #a06b43 !important;
                    box-shadow: 0 4px 12px rgba(160, 107, 67, 0.35) !important;
                }
                [data-theme="sakura"] .hero-tab-btn.active {
                    background-color: #ec4899 !important;
                    box-shadow: 0 4px 12px rgba(236, 72, 153, 0.35) !important;
                }
                [data-theme="dal"] .hero-tab-btn.active {
                    background-color: #0284c7 !important;
                    box-shadow: 0 4px 12px rgba(2, 132, 199, 0.35) !important;
                }
                [data-theme="nooklink"] .hero-tab-btn.active {
                    background-color: #10b981 !important;
                    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35) !important;
                }

                .interactive-sandbox-slot {
                    transition: all 0.15s ease;
                    user-select: none;
                }
                .interactive-sandbox-slot:hover {
                    transform: scale(1.08);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                    z-index: 2;
                }
                .departure-row {
                    transition: all 0.2s ease;
                }
                .departure-row:hover {
                    background-color: #f8fafc;
                    transform: translateY(-1px);
                }
                [data-theme="celeste"] .departure-row:hover,
                [data-theme="roost"] .departure-row:hover,
                [data-theme="dal"] .departure-row:hover,
                [data-theme="nooklink"] .departure-row:hover {
                    background-color: rgba(255, 255, 255, 0.05) !important;
                }
                [data-theme="sakura"] .departure-row:hover {
                    background-color: rgba(236, 72, 153, 0.08) !important;
                }

                .transform-active:active { transform: scale(0.96); }
                .faq-item[open] summary .fa-chevron-down { transform: rotate(180deg); }
                .faq-item summary .fa-chevron-down { transition: transform 0.2s ease; }
                `}
            </style>

            {/* ════════════════ HERO SECTION: INTERACTIVE COMMAND CENTER ════════════════ */}
            <section className="home-hero-bg position-relative pt-4 pb-5 overflow-hidden">
                {/* Background Nook Leaf Icon */}
                <div className="position-absolute top-0 end-0 opacity-10 p-4 d-none d-xl-block pointer-events-none" style={{ zIndex: 0 }}>
                    <i className="fa-solid fa-leaf text-success" style={{ fontSize: '24rem', transform: 'rotate(35deg)' }}></i>
                </div>

                <div className="container position-relative z-1 py-4">
                    <div className="row align-items-center g-4 g-lg-5">

                        {/* LEFT COLUMN: Core Value Prop & Action Matrix */}
                        <div className="col-12 col-lg-6 text-center text-lg-start">
                            <div className="d-inline-flex align-items-center gap-2 mb-3 px-3 py-1 rounded-pill bg-white border border-success border-opacity-25 shadow-2xs">
                                <span className="live-dot bg-success rounded-circle" style={{ width: '8px', height: '8px' }}></span>
                                <span className="text-success fw-bold x-small text-uppercase tracking-wider" style={{ fontSize: '0.75rem' }}>
                                    24/7 Island Network & Order Bot Live
                                </span>
                            </div>

                            <h1 className="fw-black ac-font lh-1 mb-3 text-dark display-5 display-lg-4 text-balance">
                                The All-In-One <br className="d-none d-lg-block" />
                                <span className="text-nook">Animal Crossing Hub.</span>
                            </h1>

                            <p className="lead text-muted mb-4 fw-bold opacity-75 fs-6 mx-auto mx-lg-0" style={{ maxWidth: '520px' }}>
                                Skip the daily grind. Fly to 24/7 auto-restocked Treasure Islands, design custom 40-slot pockets, and receive direct in-game Dodo delivery with ChoBot.
                            </p>

                            {/* 4-Pillar Quick Action Launchpad */}
                            <div className="d-flex flex-wrap gap-2 mb-4 justify-content-center justify-content-lg-start">
                                <Link to="/islands" className="btn btn-nook-primary rounded-pill px-4 py-2 fw-black shadow-sm d-flex align-items-center justify-content-center gap-2 transform-active">
                                    <i className="fa-solid fa-plane-departure"></i> Treasure Islands
                                </Link>
                                <Link to="/command-builder" className="btn btn-dark rounded-pill px-4 py-2 fw-bold shadow-sm d-flex align-items-center justify-content-center gap-2 transform-active" style={{ backgroundColor: '#1b2d24', borderColor: '#1b2d24' }}>
                                    <i className="fa-solid fa-boxes-stacked text-warning"></i> Command Builder
                                </Link>
                                <Link to="/order" className="btn btn-white rounded-pill px-3 py-2 fw-bold border shadow-2xs text-dark transform-active d-flex align-items-center gap-2">
                                    <i className="fa-solid fa-robot text-info"></i> Order Bot
                                </Link>
                                <Link to="/maps" className="btn btn-white rounded-pill px-3 py-2 fw-bold border shadow-2xs text-muted transform-active d-flex align-items-center gap-2">
                                    <i className="fa-solid fa-map text-success"></i> Maps
                                </Link>
                            </div>

                            {/* Live Platform Proof Metrics */}
                            <div className="d-flex flex-wrap align-items-center justify-content-center justify-content-lg-start gap-3 gap-md-4 text-muted small fw-bold">
                                <div className="d-flex align-items-center gap-2">
                                    <i className="fa-brands fa-discord fs-5 text-primary opacity-75"></i> <span>29k+ Potatoes</span>
                                </div>
                                <div className="d-flex align-items-center gap-2">
                                    <i className="fa-solid fa-bolt fs-5 text-warning opacity-75"></i> <span>Instant Dodo Queue</span>
                                </div>
                                <div className="d-flex align-items-center gap-2">
                                    <i className="fa-solid fa-rotate fs-5 text-success opacity-75"></i> <span>Auto-Restock 24/7</span>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Live Dodo Flights & Stream Radar */}
                        <div className="col-12 col-lg-6">
                            <div className="card rounded-5 border-0 shadow-xl overflow-hidden bg-white position-relative">

                                {/* Widget Tab Header */}
                                <div className="p-3 bg-light border-bottom d-flex align-items-center justify-content-between flex-wrap gap-2">
                                    <div className="d-flex align-items-center gap-1 p-1 bg-white rounded-pill border shadow-2xs">
                                        <button
                                            type="button"
                                            onClick={() => { setHeroTab('flights'); playChimeClick(); }}
                                            className={`btn btn-sm rounded-pill fw-bold px-3 hero-tab-btn ${heroTab === 'flights' ? 'active' : 'text-muted'}`}
                                            style={{ fontSize: '0.8rem' }}
                                        >
                                            <i className="fa-solid fa-plane-departure me-1"></i> Live Flights
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setHeroTab('stream'); playChimeClick(); }}
                                            className={`btn btn-sm rounded-pill fw-bold px-3 hero-tab-btn ${heroTab === 'stream' ? 'active' : 'text-muted'}`}
                                            style={{ fontSize: '0.8rem' }}
                                        >
                                            <i className="fa-solid fa-tv me-1 text-danger"></i> Live Stream
                                        </button>
                                    </div>

                                    {heroTab === 'flights' && (
                                        <div className="d-flex align-items-center gap-1">
                                            {(['all', 'public', 'member'] as const).map((mode) => (
                                                <button
                                                    key={mode}
                                                    type="button"
                                                    onClick={() => { setFlightFilter(mode); playChimeClick(); }}
                                                    className={`btn btn-sm rounded-pill x-small fw-bold px-2 py-1 transition-all ${
                                                        flightFilter === mode ? 'btn-dark text-white' : 'btn-white border text-muted shadow-2xs'
                                                    }`}
                                                    style={{ fontSize: '0.7rem' }}
                                                >
                                                    {mode === 'all' ? 'All' : mode === 'public' ? 'Public' : 'Sub Member'}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* TAB 1: Live Flight Departure Cards */}
                                {heroTab === 'flights' && (
                                    <div className="p-3 p-sm-4 animate-fade">
                                        <div className="d-flex align-items-center justify-content-between mb-3">
                                            <h3 className="h6 fw-black text-dark ac-font mb-0">
                                                <i className="fa-solid fa-tower-broadcast text-success me-2"></i>
                                                Dodo Airlines Departure Board
                                            </h3>
                                            <Link to="/islands" className="small text-success fw-bold text-decoration-none">
                                                All Islands ({islands.length}) <i className="fa-solid fa-arrow-right ms-1"></i>
                                            </Link>
                                        </div>

                                        {islandsLoading ? (
                                            <div className="text-center py-5 text-muted">
                                                <span className="spinner-border spinner-border-sm text-success me-2"></span>
                                                <span>Connecting to Dodo radar…</span>
                                            </div>
                                        ) : liveIslands.length > 0 ? (
                                            <div className="d-flex flex-column gap-2">
                                                {liveIslands.map((isl) => {
                                                    const mapSrc = isl.mapUrl || `https://cdn.chopaeng.com/maps/${isl.name.toLowerCase()}.png`;
                                                    return (
                                                        <div key={isl.id} className="d-flex align-items-center justify-content-between p-2 p-sm-3 rounded-4 bg-light border departure-row">
                                                            <div className="d-flex align-items-center gap-3">
                                                                <Link
                                                                    to={`/islands`}
                                                                    className="rounded-3 border overflow-hidden shadow-2xs flex-shrink-0 position-relative bg-white d-block hover-scale transition-all"
                                                                    style={{ width: '48px', height: '48px' }}
                                                                    title={`View ${isl.name} Map`}
                                                                >
                                                                    <img
                                                                        src={mapSrc}
                                                                        alt={`${isl.name} Island Map`}
                                                                        className="w-100 h-100 object-fit-cover"
                                                                        onError={(e) => {
                                                                            e.currentTarget.onerror = null;
                                                                            e.currentTarget.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='%231b2d24'/><text x='50%' y='65%' font-size='40' text-anchor='middle' fill='%2352b788'>MAP</text></svg>";
                                                                        }}
                                                                    />
                                                                </Link>
                                                                <div>
                                                                    <div className="d-flex align-items-center gap-2 flex-wrap">
                                                                        <strong className="text-dark small fw-black">{isl.name}</strong>
                                                                        <span className="badge bg-success rounded-pill x-small" style={{ fontSize: '0.65rem' }}>OPEN</span>
                                                                        {isl.cat === 'member' && (
                                                                            <span className="badge bg-warning-subtle text-warning-emphasis border border-warning rounded-pill x-small" style={{ fontSize: '0.6rem' }}>
                                                                                <i className="fa-solid fa-crown me-1"></i>SUB MEMBER
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <span className="tiny-text text-muted fw-bold d-block mt-1">
                                                                        {isl.type || (isl.cat === 'public' ? 'Public Island' : 'Sub Member Island')} · Auto-Restocked
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            <div>
                                                                {isl.dodoCode ? (
                                                                    <div
                                                                        className="badge bg-white border text-dark rounded-pill fw-black px-3 py-1.5 font-monospace shadow-2xs d-inline-flex align-items-center"
                                                                        style={{ fontSize: '0.82rem' }}
                                                                    >
                                                                        <i className="fa-solid fa-plane-departure text-nook me-1"></i> {isl.dodoCode}
                                                                    </div>
                                                                ) : (
                                                                    <Link to={`/islands`} className="btn btn-sm btn-outline-success rounded-pill fw-bold px-3" style={{ fontSize: '0.8rem' }}>
                                                                        View Pass
                                                                    </Link>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="text-center py-5">
                                                <div className="fs-1 mb-2 text-success">
                                                    <i className="fa-solid fa-map-location-dot"></i>
                                                </div>
                                                <p className="text-muted small mb-2 fw-bold">No active islands matching filter right now.</p>
                                                <button
                                                    type="button"
                                                    onClick={() => setFlightFilter('all')}
                                                    className="btn btn-sm btn-nook-primary rounded-pill fw-bold px-3"
                                                >
                                                    Show All Islands
                                                </button>
                                            </div>
                                        )}

                                        {/* Telemetry Footer */}
                                        <div className="mt-3 pt-3 border-top d-flex align-items-center justify-content-between text-muted x-small fw-bold">
                                            <span className="d-flex align-items-center gap-1">
                                                <i className="fa-solid fa-rotate text-success"></i> Auto-Refreshed
                                            </span>
                                            <Link to="/islands" className="text-decoration-none text-muted hover-text-dark">
                                                View Live Visitor Traffic →
                                            </Link>
                                        </div>
                                    </div>
                                )}

                                {/* TAB 2: Live Video Stream */}
                                {heroTab === 'stream' && (
                                    <div className="p-3 animate-fade">
                                        <div className="ratio ratio-16x9 bg-dark rounded-4 overflow-hidden border">
                                            <StreamEmbed />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ════════════════ TODAY'S SNAPSHOT ════════════════ */}
            <section className="container py-4">
                <TodaySnapshot />
            </section>

            {/* ════════════════ 4-PILLAR SIGNATURE ECOSYSTEM ════════════════ */}
            <section className="container py-5">
                <div className="text-center mb-5">
                    <div className="d-flex align-items-center justify-content-center gap-2 mb-2">
                        <i className="fa-solid fa-crown text-warning fs-5"></i>
                        <span className="text-muted fw-bold text-uppercase x-small tracking-widest">Everything You Need</span>
                    </div>
                    <h2 className="display-6 fw-black text-dark ac-font mb-2">Built For Island Perfection</h2>
                    <p className="text-muted fw-bold mx-auto" style={{ maxWidth: '560px' }}>
                        Whether you want to explore public treasure islands or order exact 40-slot furniture sets directly to your town.
                    </p>
                </div>

                <div className="row g-4">
                    {/* Feature 1: Treasure Islands */}
                    <div className="col-12 col-md-6 col-lg-3">
                        <Link to="/islands" className="text-decoration-none h-100 d-block">
                            <div className="card rounded-5 border bg-white p-4 h-100 shadow-sm transition-all hover-shadow-md d-flex flex-column justify-content-between">
                                <div>
                                    <div className="d-inline-flex align-items-center justify-content-center rounded-circle bg-light-green text-nook mb-3" style={{ width: '56px', height: '56px' }}>
                                        <i className="fa-solid fa-plane-departure fs-4"></i>
                                    </div>
                                    <h3 className="h5 fw-black text-dark ac-font mb-2">24/7 Treasure Islands</h3>
                                    <p className="text-muted small fw-bold mb-3">
                                        Fly to active islands loaded with Bells, DIY recipes, seasonal furniture, materials, and real artwork.
                                    </p>
                                </div>
                                <div className="d-flex align-items-center text-success fw-bold small pt-2 border-top">
                                    <span>Browse Islands</span>
                                    <i className="fa-solid fa-arrow-right ms-2"></i>
                                </div>
                            </div>
                        </Link>
                    </div>

                    {/* Feature 2: Command Builder */}
                    <div className="col-12 col-md-6 col-lg-3">
                        <Link to="/command-builder" className="text-decoration-none h-100 d-block">
                            <div className="card rounded-5 border bg-white p-4 h-100 shadow-sm transition-all hover-shadow-md d-flex flex-column justify-content-between">
                                <div>
                                    <div className="d-inline-flex align-items-center justify-content-center rounded-circle bg-light-yellow text-warning mb-3" style={{ width: '56px', height: '56px' }}>
                                        <i className="fa-solid fa-boxes-stacked fs-4"></i>
                                    </div>
                                    <h3 className="h5 fw-black text-dark ac-font mb-2">Command Builder</h3>
                                    <p className="text-muted small fw-bold mb-3">
                                        Interactive 40-slot pocket designer with K.K. audio, smart stack fill, variant color preview, and instant hex codes.
                                    </p>
                                </div>
                                <div className="d-flex align-items-center text-warning fw-bold small pt-2 border-top">
                                    <span>Build Pocket</span>
                                    <i className="fa-solid fa-arrow-right ms-2"></i>
                                </div>
                            </div>
                        </Link>
                    </div>

                    {/* Feature 3: Order Bot */}
                    <div className="col-12 col-md-6 col-lg-3">
                        <Link to="/order" className="text-decoration-none h-100 d-block">
                            <div className="card rounded-5 border bg-white p-4 h-100 shadow-sm transition-all hover-shadow-md d-flex flex-column justify-content-between">
                                <div>
                                    <div className="d-inline-flex align-items-center justify-content-center rounded-circle bg-light-blue text-info mb-3" style={{ width: '56px', height: '56px' }}>
                                        <i className="fa-solid fa-robot fs-4"></i>
                                    </div>
                                    <h3 className="h5 fw-black text-dark ac-font mb-2">Automated Order Bot</h3>
                                    <p className="text-muted small fw-bold mb-3">
                                        Submit 40 items in 1 click and receive a private Dodo boarding pass with live queue tracking & browser notifications.
                                    </p>
                                </div>
                                <div className="d-flex align-items-center text-info fw-bold small pt-2 border-top">
                                    <span>Order Items</span>
                                    <i className="fa-solid fa-arrow-right ms-2"></i>
                                </div>
                            </div>
                        </Link>
                    </div>

                    {/* Feature 4: Community Loadouts & Vault */}
                    <div className="col-12 col-md-6 col-lg-3">
                        <Link to="/command-builder" className="text-decoration-none h-100 d-block">
                            <div className="card rounded-5 border bg-white p-4 h-100 shadow-sm transition-all hover-shadow-md d-flex flex-column justify-content-between">
                                <div>
                                    <div className="d-inline-flex align-items-center justify-content-center rounded-circle bg-danger-subtle text-danger mb-3" style={{ width: '56px', height: '56px' }}>
                                        <i className="fa-solid fa-heart fs-4"></i>
                                    </div>
                                    <h3 className="h5 fw-black text-dark ac-font mb-2">Community Loadouts</h3>
                                    <p className="text-muted small fw-bold mb-3">
                                        Explore staff curated bundles, search items inside builds, upvote favorites, and save to your private cloud-synced Vault.
                                    </p>
                                </div>
                                <div className="d-flex align-items-center text-danger fw-bold small pt-2 border-top">
                                    <span>Explore Loadouts</span>
                                    <i className="fa-solid fa-arrow-right ms-2"></i>
                                </div>
                            </div>
                        </Link>
                    </div>
                </div>
            </section>

            {/* ════════════════ 3-STEP QUICK START PROCESS ════════════════ */}
            <section className="container py-5">
                <div className="text-center mb-5">
                    <div className="d-flex align-items-center justify-content-center gap-2 mb-2">
                        <i className="fa-solid fa-map text-success fs-4"></i>
                        <span className="text-muted fw-bold text-uppercase x-small tracking-widest">Fast Track</span>
                    </div>
                    <h2 className="display-6 fw-black text-dark ac-font mb-2">How It Works</h2>
                    <p className="text-muted fw-bold mx-auto" style={{ maxWidth: '480px' }}>Getting free items, bells, and villagers is just three steps away.</p>
                </div>
                <div className="row g-4 justify-content-center">
                    {[
                        {
                            step: "01",
                            icon: "fa-boxes-packing",
                            color: "bg-light-green text-nook",
                            title: "Choose Island or Build Pocket",
                            desc: "Browse 24/7 Treasure Island themes or design your custom 40-slot pocket in the Command Builder.",
                        },
                        {
                            step: "02",
                            icon: "fa-ticket",
                            color: "bg-light-yellow text-warning",
                            title: "Grab Your Dodo Pass",
                            desc: "Copy an active public Dodo code or submit your order to receive a private personal flight boarding pass.",
                        },
                        {
                            step: "03",
                            icon: "fa-plane-departure",
                            color: "bg-light-blue text-info",
                            title: "Fly with Dodo Airlines",
                            desc: "Speak with Orville at the airport, enter the 5-digit code, land on the island, and pick up your items.",
                        },
                    ].map((item) => (
                        <div className="col-md-4" key={item.step}>
                            <div className="bg-white rounded-5 shadow-sm border p-4 h-100 text-center position-relative overflow-hidden">
                                <span className="position-absolute top-0 end-0 m-3 fw-black ac-font opacity-10" style={{ fontSize: '4rem', lineHeight: 1 }}>{item.step}</span>
                                <div className={`app-icon mb-3 mx-auto d-flex align-items-center justify-content-center rounded-circle ${item.color}`} style={{ width: '64px', height: '64px' }}>
                                    <i className={`fa-solid ${item.icon} fs-3`}></i>
                                </div>
                                <h4 className="fw-black text-dark ac-font mb-2 h5">{item.title}</h4>
                                <p className="text-muted small fw-bold mb-0">{item.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ════════════════ BULLETIN BOARD & NEWS ════════════════ */}
            <section className="container py-5 mt-2 position-relative z-2">
                <div className="d-flex align-items-end justify-content-between mb-4">
                    <div>
                        <div className="d-flex align-items-center gap-2 mb-2">
                            <i className="fa-solid fa-bullhorn text-warning fs-4 rotate-n10"></i>
                            <span className="text-muted fw-bold text-uppercase x-small tracking-widest">Village News</span>
                        </div>
                        <h2 className="display-6 fw-black text-dark ac-font mb-0">Bulletin Board</h2>
                    </div>
                    <Link to="/blog" className="btn btn-white rounded-pill border fw-bold px-4 py-2 shadow-2xs text-nook transform-active text-decoration-none">
                        Read All <i className="fa-solid fa-arrow-right ms-2"></i>
                    </Link>
                </div>

                <div className="row g-4">
                    {loading ? (
                        [1, 2, 3].map(i => (
                            <div className="col-lg-4 col-md-6" key={i}>
                                <div className="post-card h-100 bg-white rounded-5 shadow-sm border border-light overflow-hidden">
                                    <div className="bg-light" style={{ height: 220 }}></div>
                                    <div className="p-4">
                                        <div className="placeholder-glow">
                                            <span className="placeholder col-4 rounded-pill mb-3"></span>
                                            <span className="placeholder col-10 mb-2"></span>
                                            <span className="placeholder col-8"></span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        posts.map((post, index) => (
                            <div className="col-lg-4 col-md-6" key={post.id}>
                                <Link to={`/blog/${post.id}`} className="text-decoration-none">
                                    <div
                                        className="post-card h-100 bg-white rounded-5 shadow-sm border border-light position-relative overflow-hidden"
                                        style={{ animationDelay: `${index * 100}ms` }}
                                    >
                                        <div className="post-img-container">
                                            <div className="washi-tape-small"></div>
                                            <img src={post.image} alt={post.title} className="w-100 h-100 object-fit-cover transition-scale" />
                                            <div className="date-sticker">
                                                <span className="d-block fw-bold small text-uppercase">{post.date.split(" ")[0]}</span>
                                                <span className="d-block fw-black fs-4 lh-1">{post.date.split(" ")[1]}</span>
                                            </div>
                                        </div>

                                        <div className="p-4 pt-4">
                                            <div className="mb-2">
                                                <span className={`badge rounded-pill fw-bold border border-opacity-10 px-3 py-1 ${
                                                    post.category === 'Announcement' ? 'bg-success-subtle text-success border-success' :
                                                        post.category === 'Members Only' ? 'bg-warning-subtle text-warning-emphasis border-warning' :
                                                            'bg-light text-muted border-secondary'
                                                }`}>
                                                    {post.category}
                                                </span>
                                            </div>

                                            <h3 className="h5 fw-black text-dark mb-2 ac-font">{post.title}</h3>
                                            <p className="text-muted small fw-bold mb-4 opacity-75 line-clamp-2">
                                                {post.excerpt}
                                            </p>

                                            <div className="d-flex align-items-center text-nook fw-black small group-hover-arrow">
                                                Read Article <i className="fa-solid fa-chevron-right ms-2 transition-transform"></i>
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            </div>
                        ))
                    )}
                </div>
            </section>

            {/* ════════════════ FAQ ACCORDION ════════════════ */}
            <section className="container py-5">
                <div className="mx-auto" style={{ maxWidth: '760px' }}>
                    <div className="text-center mb-5">
                        <div className="d-flex align-items-center justify-content-center gap-2 mb-2">
                            <i className="fa-solid fa-circle-question text-success fs-4"></i>
                            <span className="text-muted fw-bold text-uppercase x-small tracking-widest">Got Questions?</span>
                        </div>
                        <h2 className="display-6 fw-black text-dark ac-font mb-0">Frequently Asked Questions</h2>
                    </div>
                    <div className="d-flex flex-column gap-3">
                        {[
                            {
                                q: "What is an ACNH Treasure Island?",
                                a: "An ACNH Treasure Island is a community-hosted Animal Crossing: New Horizons destination organized with thousands of items including catalog furniture, DIY recipe cards, building materials, seasonal decor, Bells, and Nook Miles Tickets. Players visit via a standard Dodo code to find specific items needed to decorate their home and island without waiting months for natural store rotations.",
                            },
                            {
                                q: "How does the Order Bot work?",
                                a: "The Order Bot lets you choose up to 40 items in our visual Command Builder and queue a personal delivery. You'll receive a real-time Dodo code boarding pass with live queue countdown and browser push notifications when your gate is ready.",
                            },
                            {
                                q: "Is Chopaeng free to use?",
                                a: "Yes! Free public community islands are accessible to every Animal Crossing player at no charge. You can view online islands on our monitor page, grab an active Dodo code, and fly over. We also offer optional community supporter tiers for priority queue access and Discord perks.",
                            },
                            {
                                q: "What should I do before flying to a treasure island?",
                                a: "Clear all 40 slots in your pockets before talking to Orville at the airport. Leave your tools and clothing in storage so you have maximum inventory space to pick up items and recipes.",
                            },
                        ].map((faq) => (
                            <details key={faq.q} className="bg-white rounded-4 shadow-sm border p-4 faq-item" style={{ cursor: 'pointer' }}>
                                <summary className="fw-black text-dark ac-font fs-6 d-flex justify-content-between align-items-center" style={{ listStyle: 'none' }}>
                                    <span>{faq.q}</span>
                                    <i className="fa-solid fa-chevron-down text-muted small ms-3 flex-shrink-0"></i>
                                </summary>
                                <p className="text-muted small fw-bold mb-0 mt-3 lh-lg">{faq.a}</p>
                            </details>
                        ))}
                    </div>
                </div>
            </section>

            {/* ════════════════ PASSPORT SECTION ════════════════ */}
            <section className="container py-5 mb-5">
                <div className="mx-auto bg-nook-green rounded-5 p-4 p-lg-5 shadow-lg" style={{ maxWidth: '900px' }}>
                    <div className="row align-items-center">
                        <div className="col-lg-5 text-center text-lg-start mb-4 mb-lg-0">
                            <h2 className="display-5 fw-black text-white ac-font mb-3">Get Your <br /> Passport</h2>
                            <p className="text-white opacity-75 fw-bold mb-4">Join the community on Patreon, Twitch, or Discord to unlock priority support and perks.</p>
                            <a href="https://www.patreon.com/cw/chopaeng/membership" target="_blank" rel="noreferrer" className="btn btn-light rounded-pill px-4 py-2 fw-black text-nook shadow-sm">
                                <i className="fa-brands fa-patreon me-2"></i> Subscribe Now
                            </a>
                        </div>
                        <div className="col-lg-7">
                            <div className="bg-cream passport-card rounded-4 p-4 shadow-sm rotate-n2 position-relative">
                                <div className="position-absolute top-0 end-0 m-3 opacity-25"><i className="fa-solid fa-stamp fa-4x text-nook"></i></div>
                                <div className="d-flex align-items-center gap-3 mb-4">
                                    <div
                                        className="bg-white rounded-3 d-flex align-items-center justify-content-center shadow-sm"
                                        style={{ width: '80px', height: '80px', overflow: 'hidden' }}
                                    >
                                        <img
                                            src={logo}
                                            alt="Chopaeng Logo"
                                            style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '8px' }}
                                        />
                                    </div>
                                    <div><h4 className="fw-black text-dark m-0">PASSPORT</h4><span className="text-muted small text-uppercase fw-bold">Cho Membership</span></div>
                                </div>
                                <div className="border-top border-2 border-dashed my-3 opacity-25"></div>
                                <div className="row fw-bold text-dark small">
                                    <div className="col-6 mb-2 text-muted text-uppercase x-small">Community Perks</div>
                                    <div className="col-6 mb-2 text-end text-nook">Active</div>
                                    <div className="col-12 mb-2"><i className="fa-solid fa-check text-success me-2"></i> 24/7 Island Monitoring</div>
                                    <div className="col-12 mb-2"><i className="fa-solid fa-check text-success me-2"></i> Priority Villager & Item Matching</div>
                                    <div className="col-12 mb-2"><i className="fa-solid fa-check text-success me-2"></i> Exclusive Supporter Islands</div>
                                    <div className="col-12"><i className="fa-solid fa-check text-success me-2"></i> Exclusive Discord Role & Support</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* VISIBLE UNOFFICIAL FAN-SITE DISCLAIMER */}
            <DisclaimerBanner variant="footer" className="mt-0" />
        </>
    );
};

export default Home;