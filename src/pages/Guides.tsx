import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { playChimeClick } from "../utils/kkAudioSynthesizer";

type GuideTab = 'steps' | 'rules' | 'chobot' | 'faq';

const Guide: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const tabParam = searchParams.get('tab') as GuideTab | null;
    const [activeTab, setActiveTab] = useState<GuideTab>(
        tabParam && ['steps', 'rules', 'chobot', 'faq'].includes(tabParam) ? tabParam : 'steps'
    );

    const handleTabChange = (tab: GuideTab) => {
        setActiveTab(tab);
        setSearchParams({ tab });
        playChimeClick();
    };

    const site = typeof window !== 'undefined' ? window.location.origin : 'https://www.chopaeng.com';

    const seoTitle =
        activeTab === "steps"
            ? "How to Join ACNH Treasure Islands – Step-by-Step Guide | Chopaeng"
            : activeTab === "rules"
            ? "ACNH Treasure Island Rules – Sub Rules & Order Bot Rules | Chopaeng"
            : activeTab === "chobot"
            ? "ChoBot Overview – Community Request Bot | Chopaeng"
            : "ACNH Treasure Island FAQ – Help & Common Issues | Chopaeng";

    const seoDesc =
        activeTab === "steps"
            ? "Step-by-step guide on how to join Chopaeng ACNH treasure islands. Learn Dodo code entry, airport tips, and best practices for smooth Animal Crossing visits."
            : activeTab === "rules"
            ? "Review the sub rules and order bot rules for visiting Chopaeng ACNH treasure islands. Proper airport exits, code confidentiality, and ChoBot etiquette keep islands running smoothly."
            : activeTab === "chobot"
            ? "Learn what ChoBot is and how Chopaeng members use it to request items, DIY recipes, and villagers."
            : "Find answers to common ACNH treasure island issues on Chopaeng — interference errors, communication errors, and bot usage.";

    const rules = [
        {
            num: "C1",
            title: "Strict Code Confidentiality",
            desc: "Do NOT share the Dodo Code with anyone — including alternate accounts, friends, or family. The code is exclusively for you.",
            type: "danger",
            icon: "fa-solid fa-shield-halved",
        },
        {
            num: "C2",
            title: "Set Your Nickname",
            desc: "Set your server nickname to the format: ACNH Character Name | Your ACNH Island Name in the 👑 set-nick channel.",
            type: "info",
            icon: "fa-solid fa-id-badge",
        },
        {
            num: "C3",
            title: "Always Leave via Airport (No Minus Button)",
            desc: "NEVER press the minus (–) button or sleep your console to leave. Always walk to the airport gate to avoid crashing the island for other players.",
            type: "danger",
            icon: "fa-solid fa-plane-departure",
        },
        {
            num: "C4",
            title: "Stable Internet Required",
            desc: "NAT Type A or B with a stable connection is required for smooth island visits without dropped sessions.",
            type: "primary",
            icon: "fa-solid fa-wifi",
        },
        {
            num: "C5",
            title: "Read Pinned Messages",
            desc: "Check the pinned messages in each Discord channel for up-to-date island schedules and announcements before asking.",
            type: "secondary",
            icon: "fa-solid fa-thumbtack",
        },
        {
            num: "C6",
            title: "No Littering",
            desc: "Do not drop unwanted items on the ground. Use the trash bins placed across the island to maintain item spawn points.",
            type: "warning",
            icon: "fa-solid fa-trash",
        },
        {
            num: "C7",
            title: "ChoBot & Order Etiquette",
            desc: "Review the ChoBot guide in the 🍄 chobot-how channel. Only request items or villagers when you are prepared to collect them.",
            type: "success",
            icon: "fa-solid fa-robot",
        },
        {
            num: "C8",
            title: "Order Only What You Need",
            desc: "Order items you actively need to keep queue wait times short and fair for all community members.",
            type: "warning",
            icon: "fa-solid fa-box-open",
        },
    ];

    const steps = [
        {
            num: "01",
            title: "Empty Pockets",
            desc: "Leave everything at home. You need all 40 empty slots to collect as much as possible. Tools, nets, rods, and shovels are provided on the island.",
            icon: "fa-solid fa-box-open",
        },
        {
            num: "02",
            title: "Find a Live Island",
            desc: "Visit the Chopaeng Treasure Islands page to check live island status, current visitor count, and featured items.",
            icon: "fa-solid fa-desktop",
        },
        {
            num: "03",
            title: "Talk to Orville",
            desc: "At Dodo Airlines: Speak to Orville → 'I want to fly' → 'Visit someone' → 'Online play' → 'Search via Dodo Code'.",
            icon: "fa-solid fa-plane-departure",
        },
        {
            num: "04",
            title: "Enter Dodo Code",
            desc: "Type the live code. If you receive 'Interference', retry immediately — someone is landing. If you get 'Communication Error', wait 60s for the island reboot.",
            icon: "fa-solid fa-keyboard",
        },
        {
            num: "05",
            title: "Arrival Cutscene",
            desc: "Wait for the arrival cutscene to complete fully before moving so all island items and terrain spawn properly.",
            icon: "fa-solid fa-location-dot",
        },
        {
            num: "06",
            title: "Collect & Fly Home",
            desc: "Pick up your desired items, tools, and recipes. When your 40 slots are full, always leave properly through the airport counter.",
            icon: "fa-solid fa-bag-shopping",
        },
    ];

    return (
        <div className="nook-os min-vh-100 p-3 p-lg-5 font-nunito d-flex flex-column align-items-center">
            <Helmet>
                <title>{seoTitle}</title>
                <meta name="description" content={seoDesc} />
                <link rel="canonical" href={`${site}/guides`} />
                <meta property="og:title" content={seoTitle} />
                <meta property="og:description" content={seoDesc} />
                <meta property="og:url" content={`${site}/guides`} />
                <meta property="og:image" content={`${site}/banner.png`} />
                <meta property="og:type" content="website" />
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content={seoTitle} />
                <meta name="twitter:description" content={seoDesc} />
                <meta name="twitter:image" content={`${site}/banner.png`} />
            </Helmet>

            <style>{`
                .guide-nav-group {
                    background: #f1f5f9;
                    border: 1px solid #e2e8f0;
                    padding: 4px;
                    border-radius: 999px;
                }
                .guide-nav-tab {
                    color: #475569;
                    font-size: 0.85rem;
                    font-weight: 700;
                    border: 1.5px solid transparent;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    white-space: nowrap;
                    padding: 0.45rem 1rem;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.4rem;
                }
                .guide-nav-tab:hover {
                    color: #0f172a;
                    background: #ffffff;
                    transform: translateY(-1px);
                    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
                }
                .guide-nav-tab.active {
                    background: linear-gradient(135deg, #16a34a 0%, #15803d 100%) !important;
                    color: #ffffff !important;
                    box-shadow: 0 3px 12px rgba(22, 163, 74, 0.3) !important;
                    border-color: #16a34a !important;
                    transform: translateY(-1px);
                }

                /* ═══════════════════════════════════════════════════════════
                   CELESTE THEME OVERRIDES (Guides.tsx)
                   ═══════════════════════════════════════════════════════════ */
                [data-theme="celeste"] .guide-nav-group {
                    background: #0f172a;
                    border-color: rgba(167, 139, 250, 0.25);
                }
                [data-theme="celeste"] .guide-nav-tab {
                    color: #cbd5e1;
                }
                [data-theme="celeste"] .guide-nav-tab:hover {
                    color: #f8fafc;
                    background: #2b3658;
                }
                [data-theme="celeste"] .guide-nav-tab.active {
                    background: #7c3aed !important;
                    color: #ffffff !important;
                    box-shadow: 0 3px 12px rgba(124, 58, 237, 0.45) !important;
                    border-color: #a78bfa !important;
                }
                [data-theme="celeste"] .content-card,
                [data-theme="celeste"] .guide-top-banner {
                    background-color: #1e293b !important;
                    border-color: rgba(167, 139, 250, 0.25) !important;
                }
                [data-theme="celeste"] .step-card-box {
                    background-color: #0f172a !important;
                    border-color: rgba(167, 139, 250, 0.2) !important;
                }
                [data-theme="celeste"] .dialogue-bubble {
                    background-color: #0f172a !important;
                    border-color: rgba(167, 139, 250, 0.25) !important;
                }
                [data-theme="celeste"] .dialogue-bubble p {
                    background-color: #1e293b !important;
                    border-color: rgba(167, 139, 250, 0.25) !important;
                    color: #4ade80 !important;
                }
                [data-theme="celeste"] .rule-icon-box {
                    background-color: #1e293b !important;
                }

                /* ═══════════════════════════════════════════════════════════
                   ROOST THEME OVERRIDES (Guides.tsx)
                   ═══════════════════════════════════════════════════════════ */
                [data-theme="roost"] .guide-nav-group {
                    background: #1c1917;
                    border-color: rgba(217, 119, 6, 0.25);
                }
                [data-theme="roost"] .guide-nav-tab {
                    color: #d1beaf;
                }
                [data-theme="roost"] .guide-nav-tab:hover {
                    color: #fafaf9;
                    background: #40362f;
                }
                [data-theme="roost"] .guide-nav-tab.active {
                    background: #a06b43 !important;
                    color: #ffffff !important;
                    box-shadow: 0 3px 12px rgba(160, 107, 67, 0.45) !important;
                    border-color: #f59e0b !important;
                }
                [data-theme="roost"] .content-card,
                [data-theme="roost"] .guide-top-banner {
                    background-color: #292524 !important;
                    border-color: rgba(217, 119, 6, 0.25) !important;
                }
                [data-theme="roost"] .step-card-box {
                    background-color: #1c1917 !important;
                    border-color: rgba(217, 119, 6, 0.2) !important;
                }
                [data-theme="roost"] .dialogue-bubble {
                    background-color: #1c1917 !important;
                    border-color: rgba(217, 119, 6, 0.25) !important;
                }
                [data-theme="roost"] .dialogue-bubble p {
                    background-color: #292524 !important;
                    border-color: rgba(217, 119, 6, 0.25) !important;
                    color: #fbbf24 !important;
                }
                [data-theme="roost"] .rule-icon-box {
                    background-color: #292524 !important;
                }

                /* ═══════════════════════════════════════════════════════════
                   SAKURA THEME OVERRIDES (Guides.tsx)
                   ═══════════════════════════════════════════════════════════ */
                [data-theme="sakura"] .guide-nav-group {
                    background: #fdf2f8;
                    border-color: rgba(236, 72, 153, 0.25);
                }
                [data-theme="sakura"] .guide-nav-tab {
                    color: #9d4e7f;
                }
                [data-theme="sakura"] .guide-nav-tab:hover {
                    color: #3b072c;
                    background: #ffffff;
                }
                [data-theme="sakura"] .guide-nav-tab.active {
                    background: #ec4899 !important;
                    color: #ffffff !important;
                    box-shadow: 0 3px 12px rgba(236, 72, 153, 0.45) !important;
                    border-color: #db2777 !important;
                }
                [data-theme="sakura"] .content-card,
                [data-theme="sakura"] .guide-top-banner {
                    background-color: #ffffff !important;
                    border-color: rgba(236, 72, 153, 0.25) !important;
                }
                [data-theme="sakura"] .step-card-box {
                    background-color: #fdf2f8 !important;
                    border-color: rgba(236, 72, 153, 0.2) !important;
                }
                [data-theme="sakura"] .dialogue-bubble {
                    background-color: #fdf2f8 !important;
                    border-color: rgba(236, 72, 153, 0.25) !important;
                }
                [data-theme="sakura"] .dialogue-bubble p {
                    background-color: #ffffff !important;
                    border-color: rgba(236, 72, 153, 0.25) !important;
                    color: #be185d !important;
                }
                [data-theme="sakura"] .rule-icon-box {
                    background-color: #ffffff !important;
                }

                /* ═══════════════════════════════════════════════════════════
                   DAL THEME OVERRIDES (Guides.tsx)
                   ═══════════════════════════════════════════════════════════ */
                [data-theme="dal"] .guide-nav-group {
                    background: #0f172a;
                    border-color: rgba(56, 189, 248, 0.28);
                }
                [data-theme="dal"] .guide-nav-tab {
                    color: #94a3b8;
                }
                [data-theme="dal"] .guide-nav-tab:hover {
                    color: #ffffff;
                    background: #1e293b;
                }
                [data-theme="dal"] .guide-nav-tab.active {
                    background: #0284c7 !important;
                    color: #ffffff !important;
                    box-shadow: 0 3px 12px rgba(2, 132, 199, 0.45) !important;
                    border-color: #38bdf8 !important;
                }
                [data-theme="dal"] .content-card,
                [data-theme="dal"] .guide-top-banner {
                    background-color: #1e293b !important;
                    border-color: rgba(56, 189, 248, 0.28) !important;
                }
                [data-theme="dal"] .step-card-box {
                    background-color: #0f172a !important;
                    border-color: rgba(56, 189, 248, 0.2) !important;
                }
                [data-theme="dal"] .dialogue-bubble {
                    background-color: #0f172a !important;
                    border-color: rgba(56, 189, 248, 0.28) !important;
                }
                [data-theme="dal"] .dialogue-bubble p {
                    background-color: #1e293b !important;
                    border-color: rgba(56, 189, 248, 0.28) !important;
                    color: #38bdf8 !important;
                }
                [data-theme="dal"] .rule-icon-box {
                    background-color: #1e293b !important;
                }

                /* ═══════════════════════════════════════════════════════════
                   NOOKLINK THEME OVERRIDES (Guides.tsx)
                   ═══════════════════════════════════════════════════════════ */
                [data-theme="nooklink"] .guide-nav-group {
                    background: #090d16;
                    border-color: rgba(16, 185, 129, 0.3);
                }
                [data-theme="nooklink"] .guide-nav-tab {
                    color: #94a3b8;
                }
                [data-theme="nooklink"] .guide-nav-tab:hover {
                    color: #ffffff;
                    background: #111827;
                }
                [data-theme="nooklink"] .guide-nav-tab.active {
                    background: #10b981 !important;
                    color: #ffffff !important;
                    box-shadow: 0 3px 12px rgba(16, 185, 129, 0.45) !important;
                    border-color: #34d399 !important;
                }
                [data-theme="nooklink"] .content-card,
                [data-theme="nooklink"] .guide-top-banner {
                    background-color: #111827 !important;
                    border-color: rgba(16, 185, 129, 0.3) !important;
                }
                [data-theme="nooklink"] .step-card-box {
                    background-color: #090d16 !important;
                    border-color: rgba(16, 185, 129, 0.2) !important;
                }
                [data-theme="nooklink"] .dialogue-bubble {
                    background-color: #090d16 !important;
                    border-color: rgba(16, 185, 129, 0.3) !important;
                }
                [data-theme="nooklink"] .dialogue-bubble p {
                    background-color: #111827 !important;
                    border-color: rgba(16, 185, 129, 0.3) !important;
                    color: #34d399 !important;
                }
                [data-theme="nooklink"] .rule-icon-box {
                    background-color: #111827 !important;
                }
            `}</style>

            <div className="app-container w-100" style={{ maxWidth: '960px' }}>
                {/* 1. APP HEADER */}
                <div className="d-flex align-items-center justify-content-between mb-4 px-2 flex-wrap gap-3">
                    <div className="d-flex align-items-center gap-3">
                        <div className="app-icon bg-success text-white shadow-sm rounded-4 p-3 d-flex align-items-center justify-content-center" style={{ width: 52, height: 52 }} aria-hidden="true">
                            <i className="fa-solid fa-book-open fs-4"></i>
                        </div>
                        <div>
                            <h1 className="h2 mb-0 ac-font fw-black text-dark lh-1">Island Guides & Rules</h1>
                            <p className="mb-0 small text-muted fw-bold text-uppercase tracking-wide">
                                Chopaeng Community Guidebook
                            </p>
                        </div>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                        <Link
                            to="/catalog"
                            className="btn btn-sm btn-outline-success rounded-pill fw-bold px-3 py-2 shadow-2xs d-flex align-items-center gap-1"
                            onClick={() => playChimeClick()}
                        >
                            <i className="fa-solid fa-book-bookmark" aria-hidden="true" />
                            <span>Browse Catalogue</span>
                        </Link>
                        <Link
                            to="/order"
                            className="btn btn-sm btn-nook text-white rounded-pill fw-bold px-3 py-2 shadow-2xs d-flex align-items-center gap-1"
                            onClick={() => playChimeClick()}
                        >
                            <i className="fa-solid fa-paper-plane" aria-hidden="true" />
                            <span>Order Bot</span>
                        </Link>
                    </div>
                </div>

                {/* Banner Pointing to Catalogue */}
                <div className="guide-top-banner bg-white p-3 p-md-4 rounded-4 border shadow-2xs mb-4 d-flex flex-column flex-md-row align-items-center justify-content-between gap-3 animate-up">
                    <div className="d-flex align-items-center gap-3">
                        <div className="rounded-circle bg-success-subtle text-success d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 48, height: 48 }}>
                            <i className="fa-solid fa-boxes-stacked fs-4" aria-hidden="true" />
                        </div>
                        <div>
                            <h2 className="h6 fw-black mb-1 text-dark">Looking for Items, DIY Recipes, or Villagers?</h2>
                            <p className="text-muted small mb-0 fw-bold">
                                Browse our full searchable database of 7,000+ items, crafting recipes, and 400+ villagers in the dedicated Catalogue.
                            </p>
                        </div>
                    </div>
                    <Link
                        to="/catalog"
                        className="btn btn-nook text-white rounded-pill px-4 py-2 fw-bold text-nowrap shadow-sm hover-scale"
                        onClick={() => playChimeClick()}
                    >
                        <i className="fa-solid fa-arrow-right me-1" aria-hidden="true" /> Open Catalogue
                    </Link>
                </div>

                {/* 2. NAVIGATION TABS */}
                <div className="guide-top-banner bg-white p-2 rounded-4 shadow-sm border mb-4">
                    <div
                        className="guide-nav-group d-flex flex-wrap gap-1 justify-content-center"
                        role="tablist"
                        aria-label="Island Guides and Rules navigation"
                    >
                        {[
                            { id: 'steps' as GuideTab, label: 'How to Join', icon: 'fa-solid fa-plane' },
                            { id: 'rules' as GuideTab, label: 'Sub Rules', icon: 'fa-solid fa-shield-halved' },
                            { id: 'chobot' as GuideTab, label: 'ChoBot Guide', icon: 'fa-solid fa-robot' },
                            { id: 'faq' as GuideTab, label: 'Help & FAQ', icon: 'fa-solid fa-comment-dots' },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                id={`guide-tab-${tab.id}`}
                                role="tab"
                                aria-selected={activeTab === tab.id}
                                aria-controls={`guide-panel-${tab.id}`}
                                onClick={() => handleTabChange(tab.id)}
                                className={`btn guide-nav-tab rounded-pill flex-grow-1 ${
                                    activeTab === tab.id ? 'active' : ''
                                }`}
                            >
                                <i className={`${tab.icon}`} aria-hidden="true" />
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* 3. CONTENT AREA */}
                <div
                    className="content-card bg-white rounded-4 shadow-sm border p-4 p-md-5 position-relative overflow-hidden"
                    role="tabpanel"
                    id={`guide-panel-${activeTab}`}
                    aria-labelledby={`guide-tab-${activeTab}`}
                >
                    {/* ════ TAB: STEPS ════ */}
                    {activeTab === 'steps' && (
                        <div className="animate-fade-in">
                            <h2 className="h4 ac-font fw-black mb-4 text-center text-dark">Ready for Takeoff?</h2>
                            <div className="d-flex flex-column gap-3">
                                {steps.map((step, i) => (
                                    <div
                                        key={i}
                                        className="step-card-box d-flex align-items-start gap-3 p-3 rounded-4 bg-light border border-transparent hover-border transition-all"
                                    >
                                        <div
                                            className="step-badge rounded-circle bg-success text-white fw-black d-flex align-items-center justify-content-center flex-shrink-0 shadow-sm"
                                            style={{ width: "42px", height: "42px", fontSize: "1rem" }}
                                            aria-hidden="true"
                                        >
                                            {step.num}
                                        </div>
                                        <div>
                                            <h3 className="h5 fw-black text-dark mb-1">{step.title}</h3>
                                            <p className="text-muted fw-bold mb-0 small lh-base">{step.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-4 p-3 bg-success bg-opacity-10 rounded-4 border border-success border-opacity-25 d-flex align-items-center gap-3">
                                <i className="fa-solid fa-piggy-bank text-success fs-2" aria-hidden="true"></i>
                                <div>
                                    <h4 className="h6 fw-black text-success mb-0">Looking for Bells?</h4>
                                    <p className="small text-success mb-0 fw-bold opacity-75">
                                        Visit our dedicated Bell islands or order Max Bells in the Order Bot.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ════ TAB: RULES ════ */}
                    {activeTab === 'rules' && (
                        <div className="animate-fade-in">
                            <h2 className="h4 ac-font fw-black mb-4 text-center text-dark">Island Sub Rules</h2>
                            <div className="row g-3 mb-4">
                                {rules.map((rule, i) => (
                                    <div key={i} className="col-12 col-md-6">
                                        <div
                                            className={`p-3 rounded-4 bg-${rule.type}-subtle border border-${rule.type} border-opacity-25 d-flex align-items-start gap-3 h-100`}
                                        >
                                            <div className={`rule-icon-box icon-box text-${rule.type} bg-white shadow-sm rounded-circle p-2 flex-shrink-0`} style={{ width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-hidden="true">
                                                <i className={`${rule.icon}`}></i>
                                            </div>
                                            <div>
                                                <div className="d-flex align-items-center gap-2 mb-1">
                                                    <span
                                                        className={`badge bg-${rule.type} bg-opacity-25 text-${rule.type} rounded-pill fw-black x-small`}
                                                    >
                                                        {rule.num}
                                                    </span>
                                                    <h3 className={`h6 fw-black text-${rule.type} mb-0`}>{rule.title}</h3>
                                                </div>
                                                <p className="small text-dark opacity-75 fw-bold mb-0">{rule.desc}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ════ TAB: CHOBOT ════ */}
                    {activeTab === 'chobot' && (
                        <div className="animate-fade-in">
                            <h2 className="h4 ac-font fw-black mb-2 text-center text-dark">
                                <i className="fa-solid fa-robot text-success me-2" aria-hidden="true" />What Is ChoBot?
                            </h2>
                            <p className="text-muted fw-bold small text-center mb-4">
                                ChoBot is Chopaeng's Discord bot that helps members coordinate item, DIY, and villager requests on our community islands.
                            </p>

                            <div className="p-3 bg-success bg-opacity-10 rounded-4 border border-success border-opacity-25 mb-4">
                                <h3 className="h6 fw-black text-success mb-2">
                                    <i className="fa-solid fa-circle-info me-2" aria-hidden="true" />Good to Know
                                </h3>
                                <ul className="mb-0 small fw-bold text-success d-flex flex-column gap-1 ps-3">
                                    <li>You need to be on the island before ChoBot can process your on-island drop request.</li>
                                    <li>ChoBot covers furniture, DIY recipes, materials, wallpaper/flooring, and villager requests.</li>
                                    <li>Garbage bins are available near the airport — use them for anything you don't keep.</li>
                                    <li>
                                        Full command syntax and tutorials are posted in our Discord's 🍄 chobot-how channel.
                                    </li>
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* ════ TAB: FAQ ════ */}
                    {activeTab === 'faq' && (
                        <div className="animate-fade-in">
                            <h2 className="h4 ac-font fw-black mb-4 text-center text-dark">Troubleshooting & Help</h2>
                            <div className="d-flex flex-column gap-3">
                                {[
                                    {
                                        q: "Wuh-oh! Interference?",
                                        a: "Someone is flying in or out of the island, or a visitor has a menu open. Keep pressing 'A' to retry — you'll be let in as soon as the interference clears, usually within a few seconds.",
                                    },
                                    {
                                        q: "Communication Error?",
                                        a: "The island crashed, most likely because a visitor pressed the minus button to quit instead of leaving through the airport. Wait about 60 seconds for the host to reboot the island.",
                                    },
                                    {
                                        q: "How do I request a specific item?",
                                        a: "Use our Command Builder or Order Bot right on the website, or join the Chopaeng Discord server for on-island bot requests.",
                                    },
                                    {
                                        q: "How do I request a specific villager?",
                                        a: "Look up your favorite villager in the Catalogue, copy their ID or load them in the Command Builder, and speak to them in boxes when you arrive.",
                                    },
                                ].map((item, i) => (
                                    <div key={i} className="dialogue-container">
                                        <div className="dialogue-bubble bg-light border p-3 rounded-4 position-relative">
                                            <span className="badge bg-dark text-white rounded-pill mb-2 px-3">Question</span>
                                            <h3 className="h6 fw-bold text-dark mb-2">{item.q}</h3>
                                            <p className="small text-success fw-bold mb-0 bg-white p-2 rounded-3 border">
                                                <i className="fa-solid fa-quote-left me-2" aria-hidden="true" />
                                                {item.a}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Guide;