import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { storeAuthToken } from "../context/authToken";
import { useAuth } from "../context/useAuth";

const AuthCallback = () => {
    const navigate = useNavigate();
    const { refreshAuth, loginWithProvider } = useAuth();
    const [status, setStatus] = useState<"loading" | "error">("loading");
    const [errorMsg, setErrorMsg] = useState("");

    useEffect(() => {
        let isMounted = true;

        const handleAuth = async () => {
            const params = new URLSearchParams(window.location.search);
            const token = params.get("token");
            const error = params.get("error");

            if (error) {
                if (!isMounted) return;
                const messages: Record<string, string> = {
                    access_denied: "Discord sign-in was cancelled.",
                    discord_auth_failed: "Discord authorization failed. Please try again.",
                    roles_fetch_failed: "Could not fetch your Discord roles. Please try again.",
                    token_exchange_failed: "Authorization failed during token exchange. Please try again.",
                    invalid_state: "Invalid session state. Please try logging in again.",
                    not_a_member: "You are not an active member on Discord.",
                };
                setErrorMsg(messages[error] ?? `Authorization failed (${error}). Please try again with Discord.`);
                setStatus("error");
                return;
            }

            if (token) {
                storeAuthToken(token);
                const ok = await refreshAuth(token);
                if (!ok && isMounted) {
                    setErrorMsg("Failed to verify Discord session with the server. Please try again.");
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
                setErrorMsg("No token received from Discord. Please try logging in again.");
                setStatus("error");
            }
        };

        handleAuth();

        return () => {
            isMounted = false;
        };
    }, [navigate, refreshAuth]);

    const handleRetryDiscord = () => {
        let returnTo = "/islands";
        try {
            const saved = sessionStorage.getItem("chopaeng_auth_return_to");
            if (saved && saved.startsWith("/") && !saved.startsWith("/auth/")) {
                returnTo = saved;
            }
        } catch (_err) {
            // ignore
        }
        loginWithProvider("discord", returnTo);
    };

    if (status === "error") {
        return (
            <div className="min-vh-100 d-flex align-items-center justify-content-center nook-bg p-3">
                <div className="text-center p-4 p-md-5 rounded-5 shadow-lg bg-white border border-white animate-up" style={{ maxWidth: '440px', width: '100%' }}>
                    <div
                        className="mb-3 d-inline-flex align-items-center justify-content-center text-white rounded-circle shadow-sm"
                        style={{ width: '64px', height: '64px', backgroundColor: '#5865F2' }}
                    >
                        <i className="fa-brands fa-discord fa-2x"></i>
                    </div>

                    <h2 className="fw-black mb-2 ac-font h4 text-dark">Discord Sign-In Notice</h2>
                    <p className="text-muted mb-4 fs-6 fw-semibold" style={{ lineHeight: 1.5 }}>
                        {errorMsg}
                    </p>

                    <div className="d-flex flex-column gap-2 mb-3">
                        <button
                            type="button"
                            onClick={handleRetryDiscord}
                            className="btn fw-bold py-2.5 rounded-pill d-flex align-items-center justify-content-center gap-2 shadow-sm text-white"
                            style={{ backgroundColor: '#5865F2' }}
                        >
                            <i className="fa-brands fa-discord"></i>
                            Continue with Discord
                        </button>

                        <button 
                            type="button"
                            onClick={() => navigate("/islands")} 
                            className="btn btn-light border text-muted fw-bold py-2 rounded-pill w-100 shadow-2xs"
                        >
                            Back to Islands
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-vh-100 d-flex align-items-center justify-content-center nook-bg">
            <div className="text-center">
                <div className="spinner-border text-success mb-3" role="status" />
                <p className="fw-bold text-muted ac-font">Verifying Discord Credentials…</p>
            </div>
        </div>
    );
};

export default AuthCallback;

