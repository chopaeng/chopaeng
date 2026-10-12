import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { playChimeClick } from "../utils/kkAudioSynthesizer";
import DisclaimerBanner from "../components/DisclaimerBanner";
import { AccountLinkingHub } from "../components/auth/AccountLinkingHub";

type SignInProvider = "youtube" | "twitch" | "patreon" | "discord";

interface MembershipPlatform {
    id: string;
    name: string;
    badge: string;
    tagline: string;
    description: string;
    icon: string;
    url: string;
    cta: string;
    /** Brand color for decoration (icon band, check marks). */
    brandColor: string;
    /** Darker shade used behind white text so buttons stay readable. */
    ctaColor: string;
    /** Providers that can be signed into directly from this page. */
    signInId?: SignInProvider;
    perks: string[];
}

const platforms: MembershipPlatform[] = [
    {
        id: "discord",
        name: "Discord",
        badge: "Server Member",
        tagline: "Sync Discord server perks",
        description:
            "Connect your Discord account to sync server roles, subscriber channel access, and chat privileges.",
        icon: "fa-brands fa-discord",
        url: "https://discord.gg/chopaeng",
        cta: "Sign in with Discord",
        brandColor: "#5865f2",
        ctaColor: "#4752c4",
        signInId: "discord",
        perks: [
            "Sync server sub & booster roles",
            "Access member-exclusive treasure islands",
            "Order bot & private island commands",
            "Community events & giveaways",
            "Direct moderator & community support",
        ],
    },
    {
        id: "youtube",
        name: "YouTube",
        badge: "Channel Member",
        tagline: "Support directly on YouTube",
        description:
            "Join as a YouTube channel member for member badges, custom chat emotes, and connected member roles.",
        icon: "fa-brands fa-youtube",
        url: "https://www.youtube.com/chopaengtv",
        cta: "Join on YouTube",
        brandColor: "#ff0000",
        ctaColor: "#cc0000",
        signInId: "youtube",
        perks: [
            "Channel loyalty badges & emotes",
            "Tiers: y ChoSoup, y ChoColate, y ChoTato",
            "Member-exclusive sub island access",
            "Live chat perks during streams",
            "Discord role & sync support",
        ],
    },
    {
        id: "twitch",
        name: "Twitch",
        badge: "Sub or Prime Gaming",
        tagline: "Free sub with Prime Gaming",
        description:
            "Subscribe on Twitch or use your free monthly Amazon Prime subscription to unlock member benefits.",
        icon: "fa-brands fa-twitch",
        url: "https://www.twitch.tv/chopaeng",
        cta: "Subscribe on Twitch",
        brandColor: "#9146ff",
        ctaColor: "#772ce8",
        signInId: "twitch",
        perks: [
            "ChoTato Club (Twitch Subs & Prime Gaming)",
            "Unlocks 11 Core VIP Sub Islands",
            "VIP Island & ChoBot privileges",
            "Custom animated Twitch emotes",
            "Instant Discord role sync",
        ],
    },
    {
        id: "patreon",
        name: "Patreon",
        badge: "Full Tier Access",
        tagline: "Dedicated membership tiers",
        description:
            "Explore membership tiers on Patreon tailored for private island trips, item requests, and VIP perks.",
        icon: "fa-brands fa-patreon",
        url: "https://www.patreon.com/cw/chopaeng/membership",
        cta: "Join on Patreon",
        brandColor: "#ff424d",
        ctaColor: "#d92d3a",
        signInId: "patreon",
        perks: [
            "Tiers: ChoSoup, ChoColate, ChoFries",
            "ChoSoup unlocks all 20 Sub Islands",
            "Private VIP Treasure Islands",
            "Priority ChoBot request slots",
            "Direct Discord role integration",
        ],
    },
    {
        id: "tiktok",
        name: "TikTok",
        badge: "LIVE Subscriber",
        tagline: "Subscribe on TikTok LIVE",
        description:
            "Subscribe during TikTok LIVE streams to support the community, get subscriber badges, and access member perks.",
        icon: "fa-brands fa-tiktok",
        url: "https://www.tiktok.com/@ChoPaengTV",
        cta: "Subscribe on TikTok",
        brandColor: "#161823",
        ctaColor: "#161823",
        perks: [
            "LIVE stream subscriber badge",
            "Subscriber-only stream chat",
            "Member community & island perks",
            "Discord community integration",
        ],
    },
];

const generalPerks = [
    {
        icon: "fa-solid fa-umbrella-beach",
        title: "VIP Treasure Islands",
        desc: "24/7 access to private, low-traffic islands stocked with all items, DIYs, materials, and villagers.",
    },
    {
        icon: "fa-solid fa-robot",
        title: "Priority ChoBot drops",
        desc: "Fast-track item drop requests, custom pocket orders, and inventory deliveries with VIP queue priority.",
    },
    {
        icon: "fa-brands fa-discord",
        title: "Exclusive Discord roles",
        desc: "Unlock member-only channels, direct support from island hosts, early event notices, and community giveaways.",
    },
    {
        icon: "fa-solid fa-bolt",
        title: "24/7 fast access",
        desc: "Automated island management and resets ensure smooth visits anytime, regardless of your time zone.",
    },
];

const steps = [
    {
        title: "Subscribe on your preferred platform",
        desc: "Choose YouTube, Twitch, Patreon, or TikTok and complete your subscription.",
    },
    {
        title: "Connect your account to Discord",
        desc: (
            <>
                In Discord, open <strong>User Settings &gt; Connections</strong> and connect your
                YouTube, Twitch, or Patreon account.
            </>
        ),
    },
    {
        title: "Get instant VIP island and bot access",
        desc: "Your role syncs automatically, granting immediate access to private Dodo codes and ChoBot commands.",
    },
];

const STYLES = `
.nook-os.cpg {
    --ink: #1d3328; --ink-soft: #5b6e63; --leaf: #1f8a4c; --leaf-dark: #166b3a;
    --line: #cfdcd3; --sky: #e3f4f1;
    color: var(--ink);
    background:
        radial-gradient(1200px 380px at 50% -140px, #c9ebe4 0%, transparent 70%),
        var(--sky);
}
.cpg__wrap { width: 100%; max-width: 1140px; }

/* Top bar */
.cpg-top { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: .6rem; margin-bottom: 2rem; }
.cpg-pill { display: inline-flex; align-items: center; gap: .5rem; padding: .5rem 1rem; border-radius: 999px; background: #fff; border: 1.5px solid var(--line); color: var(--ink); font-size: .9rem; font-weight: 700; text-decoration: none; transition: border-color .15s ease, background .15s ease; }
.cpg-pill:hover { border-color: var(--leaf); background: #f6faf7; color: var(--ink); }
.cpg-pill i { color: var(--leaf); }
.cpg-pill--discord i { color: #5865f2; }

/* Hero */
.cpg-hero { display: flex; align-items: center; gap: 1.4rem; margin-bottom: 1.75rem; }
.cpg-crest { width: 84px; height: 84px; flex: none; border-radius: 50%; display: grid; place-items: center; background: var(--leaf); color: #fff; font-size: 2rem; border: 4px double rgba(255,255,255,.7); box-shadow: 0 0 0 4px var(--leaf), 0 10px 24px -10px rgba(29,51,40,.5); margin: 4px; }
.cpg-h1 { margin: 0 0 .35rem; font-size: clamp(1.9rem, 4.2vw, 2.7rem); line-height: 1.1; font-weight: 800; }
.cpg-lead { margin: 0; max-width: 62ch; color: var(--ink-soft); font-size: 1.05rem; line-height: 1.55; font-weight: 600; }
.cpg-note { margin: .65rem 0 0; font-size: .88rem; color: var(--ink-soft); font-weight: 600; }
.cpg-note i { color: var(--leaf); margin-right: .4rem; }
@media (max-width: 575px) { .cpg-hero { flex-direction: column; align-items: flex-start; } }

/* Tier matrix callout */
.cpg-callout { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; padding: 1rem 1.25rem; margin-bottom: 2.25rem; background: #fff; border: 2px dashed var(--leaf); border-radius: 20px; }
.cpg-callout__text { display: flex; align-items: center; gap: .9rem; min-width: 0; flex: 1 1 320px; }
.cpg-callout__icon { width: 44px; height: 44px; flex: none; border-radius: 50%; display: grid; place-items: center; background: #e6f4ec; color: var(--leaf-dark); font-size: 1.1rem; }
.cpg-callout h2 { margin: 0 0 .15rem; font-size: 1.05rem; font-weight: 800; }
.cpg-callout p { margin: 0; font-size: .88rem; color: var(--ink-soft); font-weight: 600; line-height: 1.45; }

.cpg-btn { display: inline-flex; align-items: center; justify-content: center; gap: .5rem; border: 0; border-radius: 14px; padding: .7rem 1.2rem; background: var(--leaf); color: #fff; font-weight: 800; font-size: .95rem; text-decoration: none; box-shadow: 0 4px 0 var(--leaf-dark); transition: transform .08s ease, box-shadow .08s ease, background .15s ease; }
.cpg-btn:hover { background: #22984f; color: #fff; }
.cpg-btn:active { transform: translateY(3px); box-shadow: 0 1px 0 var(--leaf-dark); }

/* Platform passes */
.cpg-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.25rem; margin-bottom: 2.75rem; }
.cpg-pass { display: flex; flex-direction: column; background: #fff; border-radius: 24px; overflow: hidden; box-shadow: 0 1px 0 rgba(29,51,40,.04), 0 14px 30px -18px rgba(29,51,40,.35); transition: transform .2s ease, box-shadow .2s ease; }
.cpg-pass:hover { transform: translateY(-3px); box-shadow: 0 1px 0 rgba(29,51,40,.04), 0 20px 36px -18px rgba(29,51,40,.45); }
.cpg-pass__band { background: var(--brand); color: #fff; padding: 1.1rem 1.25rem; display: flex; align-items: center; gap: .85rem; }
.cpg-pass__icon { width: 46px; height: 46px; flex: none; border-radius: 50%; display: grid; place-items: center; background: rgba(255,255,255,.18); border: 2px dashed rgba(255,255,255,.55); font-size: 1.3rem; }
.cpg-pass__name { margin: 0; font-size: 1.35rem; font-weight: 800; line-height: 1.1; }
.cpg-pass__tag { margin: .15rem 0 0; font-size: .82rem; opacity: .92; font-weight: 600; }
.cpg-pass__seam { border-top: 3px dashed #fff; margin: 0 12px; position: relative; top: -2px; opacity: .85; }
.cpg-pass__body { display: flex; flex-direction: column; flex: 1; padding: 1rem 1.25rem 1.25rem; }
.cpg-badge { align-self: flex-start; padding: .25rem .7rem; border-radius: 999px; font-size: .78rem; font-weight: 800; background: color-mix(in srgb, var(--brand) 12%, white); color: var(--cta); margin-bottom: .75rem; }
.cpg-pass__desc { margin: 0 0 1rem; font-size: .9rem; line-height: 1.5; color: var(--ink-soft); font-weight: 600; }
.cpg-perks { list-style: none; margin: 0 0 1.25rem; padding: .9rem 0 0; border-top: 1.5px dashed var(--line); display: flex; flex-direction: column; gap: .55rem; flex: 1; }
.cpg-perks li { display: flex; gap: .6rem; align-items: flex-start; font-size: .88rem; font-weight: 700; line-height: 1.35; }
.cpg-perks i { margin-top: .2rem; color: var(--brand); flex: none; }
.cpg-cta { display: flex; align-items: center; justify-content: center; gap: .5rem; width: 100%; border-radius: 14px; padding: .75rem 1rem; background: var(--cta); color: #fff; font-weight: 800; font-size: .95rem; text-decoration: none; transition: filter .15s ease; }
.cpg-cta:hover { filter: brightness(1.12); color: #fff; }
.cpg-signin { width: 100%; margin-top: .55rem; border: 1.5px solid var(--line); background: #fff; color: var(--ink-soft); border-radius: 14px; padding: .55rem 1rem; font-size: .85rem; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; gap: .45rem; transition: border-color .15s ease, color .15s ease; }
.cpg-signin:hover { border-color: var(--leaf); color: var(--ink); }
.cpg-signin i { color: var(--leaf); }

/* Sections */
.cpg-panel { background: #fff; border-radius: 28px; padding: 2rem 1.75rem; margin-bottom: 2.25rem; box-shadow: 0 1px 0 rgba(29,51,40,.04), 0 14px 30px -18px rgba(29,51,40,.3); }
.cpg-h2 { margin: 0 0 .3rem; font-size: 1.6rem; font-weight: 800; }
.cpg-sub { margin: 0 0 1.5rem; color: var(--ink-soft); font-size: .95rem; font-weight: 600; max-width: 62ch; line-height: 1.5; }
.cpg-benefits { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1.5rem 2rem; }
.cpg-benefit__icon { width: 46px; height: 46px; border-radius: 50%; display: grid; place-items: center; background: #e6f4ec; color: var(--leaf-dark); font-size: 1.1rem; margin-bottom: .75rem; }
.cpg-benefit h3 { margin: 0 0 .3rem; font-size: 1.02rem; font-weight: 800; }
.cpg-benefit p { margin: 0; font-size: .88rem; line-height: 1.5; color: var(--ink-soft); font-weight: 600; }

.cpg-steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.cpg-step { display: flex; gap: 1rem; position: relative; padding-bottom: 1.4rem; }
.cpg-step:last-child { padding-bottom: 0; }
.cpg-step:not(:last-child)::before { content: ""; position: absolute; left: 17px; top: 38px; bottom: 4px; border-left: 2px dashed var(--line); }
.cpg-step__num { width: 36px; height: 36px; flex: none; border-radius: 50%; display: grid; place-items: center; background: var(--leaf); color: #fff; font-weight: 800; }
.cpg-step h3 { margin: .3rem 0 .2rem; font-size: 1.02rem; font-weight: 800; }
.cpg-step p { margin: 0; font-size: .9rem; color: var(--ink-soft); font-weight: 600; line-height: 1.5; }
.cpg-activate { display: grid; grid-template-columns: 1fr; gap: 1.75rem; }
@media (min-width: 992px) { .cpg-activate { grid-template-columns: 5fr 7fr; gap: 3rem; align-items: center; } }

.cpg-fine { text-align: center; color: var(--ink-soft); font-size: .8rem; font-weight: 600; margin: 0 0 .5rem; }

.cpg :is(a, button):focus-visible { outline: 3px solid #0f5132; outline-offset: 2px; }
.cpg-pass__band :is(a, button):focus-visible { outline-color: #fff; }
@media (prefers-reduced-motion: reduce) {
    .cpg * { transition: none !important; }
    .cpg-pass:hover { transform: none; }
}
`;

const Membership = () => {
    const { user, loginWithProvider } = useAuth();

    const isPlatformLinked = (provId?: string) => {
        if (!provId || !user) return false;
        return Boolean(
            user.connected_providers?.includes(provId) ||
            (user.connected_accounts && user.connected_accounts[provId]) ||
            user.provider === provId
        );
    };

    const handleDirectLogin = (provId: SignInProvider) => {
        playChimeClick();
        loginWithProvider(provId);
    };

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
                el.setAttribute("rel", rel); // was setAttribute(rel, rel), which never set the rel attribute
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
        <div className="nook-os cpg min-vh-100 p-3 p-lg-5 font-nunito d-flex flex-column align-items-center">
            <style>{STYLES}</style>

            <div className="cpg__wrap">
                {/* Top bar */}
                <nav className="cpg-top" aria-label="Page navigation">
                    <Link to="/islands" className="cpg-pill">
                        <i className="fa-solid fa-arrow-left" aria-hidden="true" />
                        Back to islands
                    </Link>
                    <a
                        href="https://discord.com/invite/chopaeng"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="cpg-pill cpg-pill--discord"
                    >
                        <i className="fa-brands fa-discord" aria-hidden="true" />
                        Need help? Join Discord
                    </a>
                </nav>

                {/* Hero */}
                <header className="cpg-hero">
                    <div className="cpg-crest" aria-hidden="true">
                        <i className="fa-solid fa-crown" />
                    </div>
                    <div>
                        <h1 className="ac-font cpg-h1">Choose your membership</h1>
                        <p className="cpg-lead">
                            Support Chopaeng on the platform you already use to unlock private Treasure Islands,
                            priority ChoBot access, and exclusive Discord perks.
                        </p>
                        <p className="cpg-note">
                            <i className="fa-solid fa-circle-info" aria-hidden="true" />
                            Plans, pricing, and perks are managed on each platform.
                        </p>
                    </div>
                </header>

                {/* ChoPaeng Account & OAuth 2.0 Account Linking Hub */}
                <AccountLinkingHub className="mb-5" />

                {/* Tier matrix callout */}
                <section className="cpg-callout" aria-labelledby="cpg-matrix-title">
                    <div className="cpg-callout__text">
                        <div className="cpg-callout__icon" aria-hidden="true">
                            <i className="fa-solid fa-table-cells" />
                        </div>
                        <div>
                            <h2 id="cpg-matrix-title" className="ac-font">
                                Which sub islands does each tier unlock?
                            </h2>
                            <p>
                                Compare all 20 sub islands across Patreon, Twitch (ChoTato Club), and YouTube tiers.
                            </p>
                        </div>
                    </div>
                    <Link to="/membership-tiers" className="cpg-btn">
                        View tier access matrix
                        <i className="fa-solid fa-arrow-right" aria-hidden="true" />
                    </Link>
                </section>

                {/* Platform passes */}
                <section className="cpg-grid" aria-label="Membership platforms">
                    {platforms.map((p) => (
                        <article
                            key={p.id}
                            className="cpg-pass"
                            style={{ ["--brand" as string]: p.brandColor, ["--cta" as string]: p.ctaColor }}
                        >
                            <div className="cpg-pass__band">
                                <div className="cpg-pass__icon" aria-hidden="true">
                                    <i className={p.icon} />
                                </div>
                                <div>
                                    <h3 className="ac-font cpg-pass__name">{p.name}</h3>
                                    <p className="cpg-pass__tag">{p.tagline}</p>
                                </div>
                            </div>
                            <div className="cpg-pass__seam" aria-hidden="true" />

                            <div className="cpg-pass__body">
                                <div className="d-flex align-items-center justify-content-between mb-2">
                                    <span className="cpg-badge mb-0">{p.badge}</span>
                                    {p.signInId && isPlatformLinked(p.signInId) && (
                                        <span className="badge bg-success bg-opacity-10 text-success rounded-pill px-2.5 py-1 small fw-bold">
                                            <i className="fa-solid fa-circle-check me-1" /> Linked
                                        </span>
                                    )}
                                </div>
                                <p className="cpg-pass__desc">{p.description}</p>

                                <ul className="cpg-perks" aria-label={`${p.name} perks`}>
                                    {p.perks.map((perk) => (
                                        <li key={perk}>
                                            <i className="fa-solid fa-circle-check" aria-hidden="true" />
                                            <span>{perk}</span>
                                        </li>
                                    ))}
                                </ul>

                                <a
                                    href={p.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="cpg-cta"
                                >
                                    <span>{p.cta}</span>
                                    <i className="fa-solid fa-arrow-up-right-from-square small" aria-hidden="true" />
                                    <span className="visually-hidden">(opens in a new tab)</span>
                                </a>

                                {p.signInId && (
                                    <button
                                        type="button"
                                        className={`cpg-signin ${isPlatformLinked(p.signInId) ? "border-success text-success" : ""}`}
                                        onClick={() => handleDirectLogin(p.signInId!)}
                                    >
                                        <i className={`fa-solid ${isPlatformLinked(p.signInId) ? "fa-circle-check text-success" : "fa-right-to-bracket"}`} aria-hidden="true" />
                                        {isPlatformLinked(p.signInId)
                                            ? `Linked with ${p.name} • Click to Re-sync`
                                            : `Already a member? Link with ${p.name}`}
                                    </button>
                                )}
                            </div>
                        </article>
                    ))}
                </section>

                {/* What every member gets */}
                <section className="cpg-panel" aria-labelledby="cpg-perks-title">
                    <h2 id="cpg-perks-title" className="ac-font cpg-h2">What every member gets</h2>
                    <p className="cpg-sub">
                        Whichever platform you choose, connecting your membership unlocks these benefits.
                    </p>
                    <div className="cpg-benefits">
                        {generalPerks.map((perk) => (
                            <div key={perk.title} className="cpg-benefit">
                                <div className="cpg-benefit__icon" aria-hidden="true">
                                    <i className={perk.icon} />
                                </div>
                                <h3>{perk.title}</h3>
                                <p>{perk.desc}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Activation guide */}
                <section className="cpg-panel" aria-labelledby="cpg-activate-title">
                    <div className="cpg-activate">
                        <div>
                            <h2 id="cpg-activate-title" className="ac-font cpg-h2">Activate your perks</h2>
                            <p className="cpg-sub" style={{ marginBottom: 0 }}>
                                Three steps to sync your membership and start visiting islands.
                            </p>
                        </div>
                        <ol className="cpg-steps">
                            {steps.map((s, i) => (
                                <li key={s.title} className="cpg-step">
                                    <span className="cpg-step__num" aria-hidden="true">{i + 1}</span>
                                    <div>
                                        <h3>{s.title}</h3>
                                        <p>{s.desc}</p>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    </div>
                </section>

                {/* Footer */}
                <footer className="text-center mt-4">
                    <p className="cpg-fine">
                        No refunds on digital goods. Islands are managed by the Chopaeng community.
                    </p>
                    <DisclaimerBanner variant="text" className="mb-0" />
                </footer>
            </div>
        </div>
    );
};

export default Membership;