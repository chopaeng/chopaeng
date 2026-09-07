import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { HowItWorksExplainer, DODO_DECRYPTOR_EXPLAINER_CONFIG } from "../components/HowItWorksExplainer";

const DODO_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXY0123456789';

const DodoDecryptor: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    // Check if hash exists in URL initially
    const hasHashInUrl = !!searchParams.get("hash");

    const [hashInput, setHashInput] = useState("");
    const [passInput, setPassInput] = useState("");
    const [resultCode, setResultCode] = useState<string | null>(null);
    const [isDeciphered, setIsDeciphered] = useState(false);

    const mod = (n: number, m: number) => ((n % m) + m) % m;

    const extractHash = (msg: string) => {
        const lookup = 'Your dodo hash is ';
        const index = msg.indexOf(lookup);
        if (index === -1) return msg;
        return msg.substring(index + lookup.length).split(" ")[0];
    };

    useEffect(() => {
        const hsh = searchParams.get("hash");
        if (hsh) {
            setHashInput(hsh.replace(/_/g, '/').replace(/-/g, '+'));
        }
    }, [searchParams]);

    const handleDecrypt = () => {
        const cleanHash = extractHash(hashInput);
        const pasHash = parseInt(passInput);

        if (isNaN(pasHash) || !cleanHash) return;

        try {
            const decHash = atob(cleanHash);
            let dodostr = "";
            const encryptShift = Math.floor(pasHash / 100);

            for (let i = 0; i < decHash.length; i++) {
                const extraShift = i % 2 === 0 ? encryptShift : -encryptShift;
                const bit = mod((decHash.charCodeAt(i) - pasHash - extraShift), 33);
                dodostr += DODO_CHARS[parseInt(bit.toString())];
            }

            setResultCode(dodostr);
            setIsDeciphered(true);
        } catch (e) {
            console.error("Invalid Hash Base64", e);
            alert("Invalid hash format!");
        }
    };

    const title = hasHashInUrl
        ? "Dodo Translator – Decrypt Code | Chopaeng"
        : "Dodo Translator | Chopaeng";

    const desc = hasHashInUrl
        ? "Decrypt a Chopaeng Dodo hash using your Whisper Key to reveal the destination code."
        : "Paste your encrypted Dodo hash and enter the Whisper Key to reveal the destination code.";

    return (
        <div className="nook-os min-vh-100 py-5 font-nunito position-relative overflow-hidden d-flex flex-column justify-content-center">
            <Helmet>
                <title>{title}</title>
                <meta name="description" content={desc} />
                <link rel="canonical" href="https://www.chopaeng.com/dodo" />
                <meta property="og:type" content="website" />
                <meta property="og:site_name" content="Chopaeng" />
                <meta property="og:url" content="https://www.chopaeng.com/dodo" />
                <meta property="og:title" content={title} />
                <meta property="og:description" content={desc} />
                <meta property="og:image" content="https://www.chopaeng.com/banner.png" />
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content={title} />
                <meta name="twitter:description" content={desc} />
                <meta name="twitter:image" content="https://www.chopaeng.com/banner.png" />
            </Helmet>

            {/* Background Decoration */}
            <div className="position-absolute top-0 end-0 opacity-10 p-5 d-none d-lg-block pointer-events-none">
                <i className="fa-solid fa-leaf text-success" style={{ fontSize: '30rem', transform: 'rotate(45deg)' }}></i>
            </div>
            <div className="position-absolute bottom-0 start-0 opacity-10 p-5 pointer-events-none">
                <i className="fa-solid fa-plane text-info" style={{ fontSize: '20rem', transform: 'rotate(-15deg)' }}></i>
            </div>

            <div className="container position-relative z-1" style={{ maxWidth: "680px" }}>

                {/* ── REUSABLE HOW IT WORKS EXPLAINER ── */}
                <HowItWorksExplainer {...DODO_DECRYPTOR_EXPLAINER_CONFIG} className="mb-4" defaultExpanded={false} />

                {/* Header */}
                <div className="d-flex align-items-center justify-content-between mb-4">
                    <button onClick={() => navigate(-1)} className="btn btn-white rounded-pill px-4 py-2 shadow-sm text-muted fw-bold transform-active border-0">
                        <i className="fa-solid fa-arrow-left me-2"></i> Back
                    </button>
                    <div className="d-flex align-items-center gap-2 px-3 py-2 rounded-pill bg-white border border-success border-opacity-25 shadow-sm">
                        <span className="live-dot"></span>
                        <span className="text-success fw-bold x-small text-uppercase tracking-wider">DAL Secure Line</span>
                    </div>
                </div>

                <div className="card rounded-5 shadow-lg border-0 overflow-hidden position-relative animate-up">
                    <div className="p-4 p-md-5">

                        <div className="text-center mb-5">
                            <h1 className="display-5 fw-black ac-font mb-2">Dodo Translator</h1>
                            <p className="text-muted fw-bold">
                                {hasHashInUrl ? "Signal received! Enter the Whisper Key to decrypt." : "Enter your encrypted hash to reveal the destination."}
                            </p>
                        </div>

                        <div className="row g-4 mb-4">
                            {/* Conditionally hide hash field */}
                            {!hasHashInUrl && (
                                <div className="col-12 animate-fade-in">
                                    <label className="text-uppercase x-small fw-black text-muted ms-3 mb-2 tracking-widest">
                                        Encrypted Message
                                    </label>
                                    <textarea
                                        className="form-control form-control-lg rounded-4 bg-light border-0 fw-bold text-dark p-3 shadow-inner"
                                        rows={3}
                                        placeholder="Paste the hash here..."
                                        style={{ fontSize: '0.9rem', resize: 'none' }}
                                        value={hashInput}
                                        onChange={(e) => setHashInput(e.target.value)}
                                    />
                                </div>
                            )}

                            <div className="col-12">
                                <label className="text-uppercase x-small fw-black text-muted ms-3 mb-2 tracking-widest">
                                    Whisper Key
                                </label>
                                <div className="position-relative">
                                    <input
                                        type="number"
                                        className="form-control form-control-lg rounded-pill bg-light border-0 fw-black text-center text-primary shadow-inner py-3"
                                        placeholder="0000"
                                        style={{ fontSize: '1.5rem', letterSpacing: '2px' }}
                                        value={passInput}
                                        onChange={(e) => setPassInput(e.target.value)}
                                        autoFocus={hasHashInUrl}
                                    />
                                    <div className="position-absolute top-50 end-0 translate-middle-y me-4 text-muted opacity-50">
                                        <i className="fa-solid fa-lock"></i>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleDecrypt}
                            disabled={!hashInput || !passInput}
                            className={`btn btn-nook-primary w-100 rounded-pill py-3 fw-black shadow-sm d-flex align-items-center justify-content-center gap-2 transform-active ${(!hashInput || !passInput) ? 'opacity-50' : ''}`}
                            style={{ fontSize: '1.2rem' }}
                        >
                            <i className="fa-solid fa-plane-arrival"></i> Get Dodo Code
                        </button>
                    </div>

                    {/* Result Ticket */}
                    {isDeciphered && resultCode && (
                        <div className="bg-cream border-top border-2 border-dashed p-5 text-center position-relative">
                            <div className="tape-strip"></div>
                            <span className="badge bg-warning text-dark rounded-pill fw-bold px-3 py-1 mb-3 shadow-sm border border-warning border-opacity-50">
                                <i className="fa-solid fa-check me-1"></i> Ready for Takeoff
                            </span>
                            <div className="ticket-cutout bg-white p-4 rounded-4 shadow-sm border border-light mx-auto position-relative" style={{ maxWidth: '400px' }}>
                                <div className="ticket-notch notch-left"></div>
                                <div className="ticket-notch notch-right"></div>
                                <p className="text-uppercase x-small fw-bold text-muted mb-1 tracking-widest">Dodo Code</p>
                                <h2 className="display-4 fw-black text-nook ac-font m-0 tracking-widest">
                                    {resultCode}
                                </h2>
                            </div>
                            <div className="small text-muted fw-bold mt-3 d-flex align-items-center justify-content-center gap-1.5">
                                <i className="fa-solid fa-plane-departure text-nook"></i>
                                <span>Enter code at DAL Airport on your Nintendo Switch</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                /* ... All your existing styles remain the same ... */
                
                .animate-fade-in {
                    animation: fadeIn 0.3s ease-out forwards;
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .font-nunito { font-family: 'Nunito', sans-serif; }
                .ac-font { font-family: 'Fredoka One', cursive; letter-spacing: 0.5px; }
                .fw-black { font-weight: 900; }
                .text-nook { color: var(--nook-green, #37b06d); }
                .bg-cream { background-color: var(--card-bg, #fffdf0); }
                .nook-os { background-color: var(--nook-bg, #f2f4e6); background-image: radial-gradient(var(--pattern-dot, #dce2c8) 15%, transparent 16%); background-size: 30px 30px; }
                .pointer-events-none { pointer-events: none; }
                .opacity-10 { opacity: 0.1; }
                .x-small { font-size: 0.75rem; }
                .tracking-widest { letter-spacing: 0.2em; }
                .tracking-wider { letter-spacing: 0.1em; }
                .shadow-inner { box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.05); }
                .btn-nook-primary { background-color: #37b06d; color: white; border: 2px solid rgba(255, 255, 255, 0.4); transition: all 0.2s; }
                .btn-nook-primary:hover { background-color: #2ea466; transform: translateY(-3px); box-shadow: 0 8px 20px rgba(55, 176, 109, 0.4) !important; }
                .btn-white { background: white; transition: all 0.2s; }
                .btn-white:hover { transform: translateY(-3px); }
                .transform-active:active { transform: scale(0.95) !important; }
                .live-dot { width: 8px; height: 8px; background: #37b06d; border-radius: 50%; display: inline-block; animation: pulse 2s infinite; }
                @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(55, 176, 109, 0.7); } 70% { box-shadow: 0 0 0 6px rgba(55, 176, 109, 0); } 100% { box-shadow: 0 0 0 0 rgba(55, 176, 109, 0); } }
                .tape-strip { position: absolute; top: -18px; left: 50%; transform: translateX(-50%); width: 100px; height: 35px; background-color: rgba(230, 230, 230, 0.6); border-left: 2px dashed rgba(0,0,0,0.1); border-right: 2px dashed rgba(0,0,0,0.1); box-shadow: 0 2px 5px rgba(0,0,0,0.05); backdrop-filter: blur(2px); z-index: 5; }
                .ticket-notch { position: absolute; top: 50%; transform: translateY(-50%); width: 20px; height: 20px; background-color: #fffdf0; border-radius: 50%; }
                .notch-left { left: -10px; box-shadow: inset -2px 0 3px rgba(0,0,0,0.05); }
                .notch-right { right: -10px; box-shadow: inset 2px 0 3px rgba(0,0,0,0.05); }
                .animate-up { animation: fadeInUp 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
                @keyframes fadeInUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
};

export default DodoDecryptor;