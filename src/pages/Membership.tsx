import { useEffect } from "react";
import { Link } from "react-router-dom";
import DisclaimerBanner from "../components/DisclaimerBanner";

interface MembershipPlatform {
    id: string;
    name: string;
    badge: string;
    badgeBg: string;
    badgeText: string;
    tagline: string;
    description: string;
    icon: string;
    url: string;
    cta: string;
    brandColor: string;
    brandGradient: string;
    glowColor: string;
    cardBgLight: string;
    borderColor: string;
    perks: string[];
}

const platforms: MembershipPlatform[] = [
    {
        id: "youtube",
        name: "YouTube",
        badge: "Channel Member",
        badgeBg: "rgba(255, 0, 0, 0.1)",
        badgeText: "#DC2626",
        tagline: "Support directly on YouTube",
        description: "Join as a YouTube channel member for member badges, custom chat emotes, and connected member roles.",
        icon: "fa-brands fa-youtube",
        url: "https://www.youtube.com/chopaengtv",
        cta: "Join on YouTube",
        brandColor: "#FF0000",
        brandGradient: "linear-gradient(135deg, #FF0000 0%, #B91C1C 100%)",
        glowColor: "rgba(255, 0, 0, 0.22)",
        cardBgLight: "rgba(255, 0, 0, 0.03)",
        borderColor: "rgba(255, 0, 0, 0.2)",
        perks: [
            "Channel loyalty badges & emotes",
            "Member-exclusive island access",
            "Live chat perks during streams",
            "Discord role & sync support"
        ]
    },
    {
        id: "twitch",
        name: "Twitch",
        badge: "Sub or Prime Gaming",
        badgeBg: "rgba(145, 70, 255, 0.12)",
        badgeText: "#7C3AED",
        tagline: "Free sub with Prime Gaming",
        description: "Subscribe on Twitch or use your free monthly Amazon Prime subscription to unlock member benefits.",
        icon: "fa-brands fa-twitch",
        url: "https://www.twitch.tv/chopaeng",
        cta: "Subscribe on Twitch",
        brandColor: "#9146FF",
        brandGradient: "linear-gradient(135deg, #9146FF 0%, #6D28D9 100%)",
        glowColor: "rgba(145, 70, 255, 0.25)",
        cardBgLight: "rgba(145, 70, 255, 0.03)",
        borderColor: "rgba(145, 70, 255, 0.2)",
        perks: [
            "Free sub with Prime Gaming",
            "VIP Island & ChoBot privileges",
            "Custom animated Twitch emotes",
            "Instant Discord role sync"
        ]
    },
    {
        id: "patreon",
        name: "Patreon",
        badge: "Full Tier Access",
        badgeBg: "rgba(255, 66, 77, 0.12)",
        badgeText: "#EA580C",
        tagline: "Dedicated membership tiers",
        description: "Explore membership tiers on Patreon tailored for private island trips, item requests, and VIP perks.",
        icon: "fa-brands fa-patreon",
        url: "https://www.patreon.com/cw/chopaeng/membership",
        cta: "Join on Patreon",
        brandColor: "#FF424D",
        brandGradient: "linear-gradient(135deg, #FF424D 0%, #EA580C 100%)",
        glowColor: "rgba(255, 66, 77, 0.25)",
        cardBgLight: "rgba(255, 66, 77, 0.03)",
        borderColor: "rgba(255, 66, 77, 0.2)",
        perks: [
            "Multiple tiers to fit your needs",
            "Private VIP Treasure Islands",
            "Priority ChoBot request slots",
            "Direct Discord role integration"
        ]
    },
    {
        id: "tiktok",
        name: "TikTok",
        badge: "LIVE Subscriber",
        badgeBg: "rgba(15, 23, 42, 0.08)",
        badgeText: "#0F172A",
        tagline: "Subscribe on TikTok LIVE",
        description: "Subscribe during TikTok LIVE streams to support the community, get subscriber badges, and access member perks.",
        icon: "fa-brands fa-tiktok",
        url: "https://www.tiktok.com/@ChoPaengTV",
        cta: "Subscribe on TikTok",
        brandColor: "#000000",
        brandGradient: "linear-gradient(135deg, #1E293B 0%, #0F172A 100%)",
        glowColor: "rgba(37, 244, 238, 0.25)",
        cardBgLight: "rgba(15, 23, 42, 0.03)",
        borderColor: "rgba(15, 23, 42, 0.18)",
        perks: [
            "LIVE stream subscriber badge",
            "Subscriber-only stream chat",
            "Member community & island perks",
            "Discord community integration"
        ]
    }
];

const generalPerks = [
    {
        icon: "fa-solid fa-umbrella-beach",
        title: "VIP Treasure Islands",
        desc: "24/7 access to private, low-traffic islands stocked with all items, DIYs, materials, and villagers."
    },
    {
        icon: "fa-solid fa-robot",
        title: "Priority ChoBot Drops",
        desc: "Fast-track item drop requests, custom pocket orders, and inventory deliveries with VIP queue priority."
    },
    {
        icon: "fa-brands fa-discord",
        title: "Exclusive Discord Roles",
        desc: "Unlock member-only channels, direct support from island hosts, early event notices, and community giveaways."
    },
    {
        icon: "fa-solid fa-bolt",
        title: "24/7 Fast Access",
        desc: "Automated island management and resets ensure smooth visits anytime, regardless of your time zone."
    }
];

const Membership = () => {
    useEffect(() => {
        const site = window.location.origin;
        const url = `${site}/membership`;
        const img = `${site}/banner.png`;

        const title = "Chopaeng Membership – Join via YouTube, Twitch, Patreon, or TikTok";
        const desc =
            "Support Chopaeng and unlock VIP treasure islands, priority ChoBot access, and exclusive community perks via YouTube, Twitch, Patreon, or TikTok.";

        document.title = title;

        const setMeta = (attr: string, key: string, value: string) => {
            let el = document.querySelector(`meta[${attr}="${key}"]`);
            if (!el) {
                el = document.createElement("meta");
                el.setAttribute(attr, key);
                document.head.appendChild(el);
            }
            el.setAttribute("content", value);
        };

        const setLink = (rel: string, href: string) => {
            let el = document.querySelector(`link[rel="${rel}"]`);
            if (!el) {
                el = document.createElement("link");
                el.setAttribute(rel, rel);
                document.head.appendChild(el);
            }
            el.setAttribute("href", href);
        };

        setMeta("name", "description", desc);
        setLink("canonical", url);

        setMeta("property", "og:type", "website");
        setMeta("property", "og:site_name", "Chopaeng");
        setMeta("property", "og:url", url);
        setMeta("property", "og:title", title);
        setMeta("property", "og:description", desc);
        setMeta("property", "og:image", img);

        setMeta("name", "twitter:card", "summary_large_image");
        setMeta("name", "twitter:title", title);
        setMeta("name", "twitter:description", desc);
        setMeta("name", "twitter:image", img);
    }, []);

    return (
        <div className="nook-os min-vh-100 p-3 p-lg-5 font-nunito d-flex flex-column align-items-center">
            <div className="app-container w-100" style={{ maxWidth: "1140px" }}>

                {/* Top Navigation Bar */}
                <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
                    <Link
                        to="/islands"
                        className="btn btn-sm btn-white bg-white border rounded-pill px-3 py-1.5 fw-bold text-dark shadow-2xs text-decoration-none d-inline-flex align-items-center gap-2 hover-lift"
                    >
                        <i className="fa-solid fa-arrow-left text-success"></i>
                        <span>Back to Islands</span>
                    </Link>

                    <a
                        href="https://discord.com/invite/chopaeng"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm btn-outline-primary rounded-pill px-3 py-1.5 fw-bold d-inline-flex align-items-center gap-2 text-decoration-none shadow-2xs hover-lift"
                    >
                        <i className="fa-brands fa-discord"></i>
                        <span>Need Help? Join Discord</span>
                    </a>
                </div>

                {/* Header Banner */}
                <div className="text-center mb-5">
                    <div className="d-inline-flex align-items-center justify-content-center bg-white p-3 rounded-4 shadow-sm mb-3 border border-3 border-light transform-rotate-n3">
                        <i className="fa-solid fa-crown fs-1 text-warning"></i>
                    </div>
                    <h1 className="display-5 fw-black ac-font text-dark mb-2">Choose Your Membership</h1>
                    <p className="lead text-muted fw-bold mx-auto mb-3" style={{ maxWidth: "700px" }}>
                        Support Chopaeng on your preferred platform to unlock private Treasure Islands, priority ChoBot access, and exclusive Discord perks!
                    </p>
                    <div className="d-inline-flex align-items-center gap-2 bg-white bg-opacity-75 border rounded-pill px-3 py-1.5 shadow-2xs">
                        <i className="fa-solid fa-wand-magic-sparkles text-warning"></i>
                        <span className="small fw-bold text-muted">
                            Plans, pricing, and perks are managed directly on each platform
                        </span>
                    </div>
                </div>

                {/* Platform Selector Grid (4 Platforms) */}
                <div className="row g-4 justify-content-center mb-5">
                    {platforms.map((platform) => (
                        <div key={platform.id} className="col-12 col-md-6 col-xl-3">
                            <a
                                href={platform.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="platform-card h-100 d-flex flex-column bg-white rounded-4 p-4 shadow-sm border border-2 text-decoration-none position-relative overflow-hidden"
                                style={{
                                    borderColor: "rgba(0, 0, 0, 0.08)",
                                    "--card-glow": platform.glowColor,
                                    "--hover-border": platform.brandColor
                                } as React.CSSProperties}
                                aria-label={`Join Chopaeng on ${platform.name}`}
                            >
                                {/* Platform Top Header */}
                                <div className="d-flex align-items-center justify-content-between mb-3">
                                    <div
                                        className="platform-icon-box d-flex align-items-center justify-content-center rounded-3 shadow-2xs"
                                        style={{
                                            width: "52px",
                                            height: "52px",
                                            background: platform.brandGradient,
                                            color: "#FFFFFF"
                                        }}
                                    >
                                        <i className={`${platform.icon} fs-3`}></i>
                                    </div>
                                    <span
                                        className="badge rounded-pill px-2.5 py-1.5 fw-bold small border"
                                        style={{
                                            backgroundColor: platform.badgeBg,
                                            color: platform.badgeText,
                                            borderColor: platform.borderColor,
                                            fontSize: "0.74rem"
                                        }}
                                    >
                                        {platform.badge}
                                    </span>
                                </div>

                                {/* Platform Title & Tagline */}
                                <h3 className="h4 fw-black ac-font text-dark mb-1">{platform.name}</h3>
                                <p className="small text-muted fw-bold mb-3">{platform.tagline}</p>
                                <p className="small text-secondary lh-sm mb-3 opacity-90">{platform.description}</p>

                                <div className="receipt-line my-2 opacity-50"></div>

                                {/* Perks List */}
                                <div className="mb-4 flex-grow-1 pt-2">
                                    <div className="tiny-text text-uppercase fw-bold text-muted spacing-wide mb-2 opacity-75">
                                        Included Perks
                                    </div>
                                    <ul className="list-unstyled d-flex flex-column gap-2 mb-0">
                                        {platform.perks.map((perk, idx) => (
                                            <li key={idx} className="d-flex align-items-start small fw-bold text-dark opacity-90">
                                                <i
                                                    className="fa-solid fa-circle-check me-2 flex-shrink-0 mt-1"
                                                    style={{ color: platform.brandColor }}
                                                ></i>
                                                <span className="lh-sm">{perk}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                {/* Action CTA Button */}
                                <div className="mt-auto pt-2">
                                    <div
                                        className="platform-cta-btn btn w-100 rounded-pill fw-black py-2.5 px-3 text-white text-uppercase d-flex align-items-center justify-content-center gap-2 shadow-sm border-0"
                                        style={{
                                            background: platform.brandGradient
                                        }}
                                    >
                                        <span>{platform.cta}</span>
                                        <i className="fa-solid fa-arrow-up-right-from-square small"></i>
                                    </div>
                                </div>
                            </a>
                        </div>
                    ))}
                </div>

                {/* Member Perks Overview */}
                <div className="bg-white p-4 p-md-5 rounded-4 shadow-sm border border-light mb-5 position-relative overflow-hidden">
                    <div className="position-absolute top-0 start-0 w-100 h-100 bg-grid opacity-10 pointer-events-none"></div>

                    <div className="position-relative z-1">
                        <div className="text-center mb-4">
                            <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-3 py-1.5 rounded-pill fw-bold text-uppercase spacing-wide mb-2">
                                <i className="fa-solid fa-gem me-1.5"></i> All Members Enjoy
                            </span>
                            <h2 className="h3 fw-black ac-font text-dark mb-1">What You Get With Any Membership</h2>
                            <p className="text-muted small fw-bold mb-0">
                                Whichever platform you choose, connecting your membership unlocks these core community benefits:
                            </p>
                        </div>

                        <div className="row g-3 g-md-4">
                            {generalPerks.map((perk, i) => (
                                <div key={i} className="col-12 col-md-6 col-lg-3">
                                    <div className="p-3 rounded-4 bg-light border h-100 d-flex flex-column">
                                        <div className="icon-circle mb-3 bg-white shadow-2xs text-success border d-flex align-items-center justify-content-center">
                                            <i className={`${perk.icon} fs-5`}></i>
                                        </div>
                                        <h4 className="h6 fw-bold text-dark mb-1.5">{perk.title}</h4>
                                        <p className="small text-muted fw-semibold lh-sm mb-0">{perk.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Activation & Sync Guide */}
                <div className="bg-white p-4 p-md-5 rounded-4 shadow-sm border border-light mb-5 position-relative overflow-hidden">
                    <div className="row align-items-center position-relative z-1">
                        <div className="col-lg-4 text-center mb-4 mb-lg-0">
                            <div className="d-inline-block p-4 rounded-circle bg-success bg-opacity-10 border border-success border-opacity-25 mb-3">
                                <i className="fa-solid fa-rotate fs-1 text-success spin-hover"></i>
                            </div>
                            <h3 className="h4 fw-black ac-font text-dark mb-1">Perk Activation</h3>
                            <p className="text-muted small fw-bold mb-0">How to sync your account & start playing</p>
                        </div>
                        <div className="col-lg-8">
                            <div className="d-flex flex-column gap-3">
                                <div className="d-flex align-items-center gap-3 bg-light p-3 rounded-3 border">
                                    <span className="badge bg-dark rounded-circle p-2 px-3 fw-bold fs-6">1</span>
                                    <div>
                                        <div className="fw-bold text-dark">Subscribe on your preferred platform</div>
                                        <div className="small text-muted fw-semibold">
                                            Choose YouTube, Twitch, Patreon, or TikTok and complete your subscription.
                                        </div>
                                    </div>
                                </div>
                                <div className="d-flex align-items-center gap-3 bg-light p-3 rounded-3 border">
                                    <span className="badge bg-dark rounded-circle p-2 px-3 fw-bold fs-6">2</span>
                                    <div>
                                        <div className="fw-bold text-dark">Connect your account with Discord</div>
                                        <div className="small text-muted fw-semibold">
                                            In Discord, open <strong>User Settings &gt; Connections</strong> and connect your YouTube/Twitch/Patreon account.
                                        </div>
                                    </div>
                                </div>
                                <div className="d-flex align-items-center gap-3 bg-light p-3 rounded-3 border">
                                    <span className="badge bg-dark rounded-circle p-2 px-3 fw-bold fs-6">3</span>
                                    <div>
                                        <div className="fw-bold text-dark">Instant VIP island and bot access!</div>
                                        <div className="small text-muted fw-semibold">
                                            Your role will sync automatically, granting immediate access to private Dodo codes and ChoBot commands.
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Disclaimers */}
                <div className="text-center mt-4">
                    <p className="tiny-text text-muted fw-bold text-uppercase opacity-60 mb-2">
                        * NO REFUNDS ON DIGITAL GOODS. ISLANDS MANAGED BY THE CHOPAENG COMMUNITY.
                    </p>
                    <DisclaimerBanner variant="text" className="mb-0" />
                </div>

            </div>

            <style>{`
                .platform-card {
                    transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
                }
                .platform-card:hover {
                    transform: translateY(-8px);
                    border-color: var(--hover-border) !important;
                    box-shadow: 0 16px 32px var(--card-glow) !important;
                }
                .platform-card:hover .platform-icon-box {
                    transform: scale(1.08) rotate(-4deg);
                }
                .platform-icon-box {
                    transition: transform 0.25s ease;
                }
                .platform-cta-btn {
                    transition: transform 0.2s ease, filter 0.2s ease;
                }
                .platform-card:hover .platform-cta-btn {
                    transform: scale(1.02);
                    filter: brightness(1.1);
                }
                .receipt-line {
                    border-top: 1px dashed rgba(0, 0, 0, 0.15);
                }
                .hover-lift {
                    transition: transform 0.15s ease;
                }
                .hover-lift:hover {
                    transform: translateY(-2px);
                }
                .tiny-text {
                    font-size: 0.72rem;
                }
                .shadow-2xs {
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
                }
                .spacing-wide {
                    letter-spacing: 0.08em;
                }
            `}</style>
        </div>
    );
};

export default Membership;
