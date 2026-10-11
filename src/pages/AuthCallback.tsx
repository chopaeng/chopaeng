import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { storeAuthToken } from "../context/authToken";
import { useAuth } from "../context/useAuth";

const AuthCallback = () => {
    const navigate = useNavigate();
    const { refreshAuth, loginWithProvider } = useAuth();
    const [status, setStatus] = useState<"loading" | "error">("loading");
    const [errorMsg, setErrorMsg] = useState("");
    const [errorCode, setErrorCode] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        const handleAuth = async () => {
            const params = new URLSearchParams(window.location.search);
            const token = params.get("token");
            const error = params.get("error");

            if (error) {
                if (!isMounted) return;
                setErrorCode(error);
                const messages: Record<string, string> = {
                    discord_login_disabled: "Discord login is temporarily disabled. Please log in using Twitch, Patreon, or YouTube.",
                    twitch_auth_failed: "Twitch authorization failed. Please try again.",
                    patreon_auth_failed: "Patreon authorization failed. Please verify your membership and try again.",
                    youtube_auth_failed: "YouTube channel membership authorization failed. Please try again.",
                    not_a_member: "You are not an active member on the selected platform.",
                    roles_fetch_failed: "Could not fetch your subscription roles. Please try again.",
                    token_exchange_failed: "Authorization failed during token exchange. Please try again.",
                    invalid_state: "Invalid session state. Please try again.",
                };
                setErrorMsg(messages[error] ?? `Authorization failed (${error}). Please try again.`);
                setStatus("error");
                return;
            }

            if (token) {
                storeAuthToken(token);
                const ok = await refreshAuth(token);
                if (!ok && isMounted) {
                    setErrorMsg("Failed to verify user session with the server. Please try again.");
                    setStatus("error");
                    return;
                }

                // Redirect back to return_to destination or /islands
                let returnTo = "/islands";
                try {
                    const saved = sessionStorage.getItem("chopaeng_auth_return_to");
                    if (saved && saved.startsWith("/") && !saved.startsWith("/auth/")) {
                        returnTo = saved;
                    }
                    sessionStorage.removeItem("chopaeng_auth_return_to");
                } catch (_err) {
                    // ignore sessionStorage retrieval error
                }

                navigate(returnTo, { replace: true });
            } else {
                if (!isMounted) return;
                setErrorMsg("No token received from login provider. Please try again.");
                setStatus("error");
            }
        };

        handleAuth();

        return () => {
            isMounted = false;
        };
    }, [navigate, refreshAuth]);

    if (status === "error") {
        const isDiscordDisabled = errorCode === "discord_login_disabled";
        return (
            <div className="min-vh-100 d-flex align-items-center justify-content-center nook-bg p-3">
                <div className="text-center p-4 p-md-5 rounded-5 shadow-lg bg-white border border-white animate-up" style={{ maxWidth: '480px' }}>
                    {isDiscordDisabled ? (
                        <>
                            <div className="mb-3 d-inline-flex align-items-center justify-content-center text-white rounded-circle shadow-sm" style={{ width: '72px', height: '72px', backgroundColor: '#5865F2' }}>
                                <i className="fa-brands fa-discord fa-2x"></i>
                            </div>
                            <h2 className="fw-black mb-2 ac-font h4 text-dark">Discord Login Disabled</h2>
                        </>
                    ) : (
                        <>
                            <i className="fa-solid fa-circle-xmark fa-3x text-danger mb-3"></i>
                            <h2 className="fw-black mb-2 ac-font h4 text-dark">Login Notice</h2>
                        </>
                    )}
                    
                    <p className="text-muted mb-4 fs-6 fw-bold" style={{ lineHeight: 1.5 }}>{errorMsg}</p>
                    
                    {/* Retry Buttons with active providers */}
                    <div className="d-flex flex-column gap-2 mb-3">
                        <button
                            type="button"
                            onClick={() => loginWithProvider("twitch")}
                            className="btn fw-bold py-2.5 rounded-pill d-flex align-items-center justify-content-center gap-2 shadow-sm text-white"
                            style={{ backgroundColor: '#9146FF' }}
                        >
                            <i className="fa-brands fa-twitch"></i>
                            Log in with Twitch (ChoTato Club)
                        </button>

                        <button
                            type="button"
                            onClick={() => loginWithProvider("patreon")}
                            className="btn fw-bold py-2.5 rounded-pill d-flex align-items-center justify-content-center gap-2 shadow-sm text-white"
                            style={{ backgroundColor: '#FF424D' }}
                        >
                            <i className="fa-brands fa-patreon"></i>
                            Log in with Patreon
                        </button>

                        <button
                            type="button"
                            onClick={() => loginWithProvider("youtube")}
                            className="btn fw-bold py-2.5 rounded-pill d-flex align-items-center justify-content-center gap-2 shadow-sm text-white"
                            style={{ backgroundColor: '#FF0000' }}
                        >
                            <i className="fa-brands fa-youtube"></i>
                            Log in with YouTube
                        </button>
                    </div>

                    <button 
                        onClick={() => window.location.href = "/islands"} 
                        className="btn btn-light border text-muted fw-bold py-2 rounded-pill w-100 shadow-2xs"
                    >
                        Back to Islands
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-vh-100 d-flex align-items-center justify-content-center nook-bg">
            <div className="text-center">
                <div className="spinner-border text-success mb-3" role="status" />
                <p className="fw-bold text-muted ac-font">Verifying Resident Credentials…</p>
            </div>
        </div>
    );
};

export default AuthCallback;
