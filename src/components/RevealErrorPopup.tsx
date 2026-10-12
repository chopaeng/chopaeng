import React, { useEffect, useState } from 'react';
import { getStoredTheme, type ThemeMode } from '../utils/theme';

interface RevealErrorPopupProps {
    message: string;
    onClose: () => void;
}

const THEME_STYLES: Record<ThemeMode, {
    cardBg: string;
    border: string;
    textPrimary: string;
    textMuted: string;
    iconBg: string;
    iconColor: string;
    btnBg: string;
    btnText: string;
}> = {
    nook: {
        cardBg: '#ffffff',
        border: 'rgba(55, 176, 109, 0.25)',
        textPrimary: '#1e293b',
        textMuted: '#64748b',
        iconBg: 'rgba(239, 68, 68, 0.12)',
        iconColor: '#ef4444',
        btnBg: '#ef4444',
        btnText: '#ffffff',
    },
    celeste: {
        cardBg: '#1e1b4b',
        border: 'rgba(167, 139, 250, 0.3)',
        textPrimary: '#f8fafc',
        textMuted: '#cbd5e1',
        iconBg: 'rgba(239, 68, 68, 0.2)',
        iconColor: '#f87171',
        btnBg: '#e11d48',
        btnText: '#ffffff',
    },
    roost: {
        cardBg: '#2a221b',
        border: 'rgba(217, 119, 6, 0.3)',
        textPrimary: '#fef3c7',
        textMuted: '#d97706',
        iconBg: 'rgba(239, 68, 68, 0.2)',
        iconColor: '#f87171',
        btnBg: '#d97706',
        btnText: '#ffffff',
    },
    sakura: {
        cardBg: '#fff5f7',
        border: 'rgba(244, 114, 182, 0.35)',
        textPrimary: '#831843',
        textMuted: '#9d174d',
        iconBg: 'rgba(239, 68, 68, 0.12)',
        iconColor: '#e11d48',
        btnBg: '#db2777',
        btnText: '#ffffff',
    },
    dal: {
        cardBg: '#0f2744',
        border: 'rgba(56, 189, 248, 0.35)',
        textPrimary: '#f0f9ff',
        textMuted: '#bae6fd',
        iconBg: 'rgba(239, 68, 68, 0.2)',
        iconColor: '#f87171',
        btnBg: '#0284c7',
        btnText: '#ffffff',
    },
    nooklink: {
        cardBg: '#090d16',
        border: 'rgba(16, 185, 129, 0.35)',
        textPrimary: '#ecfdf5',
        textMuted: '#a7f3d0',
        iconBg: 'rgba(239, 68, 68, 0.2)',
        iconColor: '#f87171',
        btnBg: '#059669',
        btnText: '#ffffff',
    },
};

/**
 * Safely parses string messages that might contain HTML links (e.g. <a href="...">#sub-rules</a>)
 * or markdown links [text](url) and transforms them into interactive React components.
 */
function renderParsedMessage(rawMessage: string, onClose: () => void): React.ReactNode {
    if (!rawMessage) return null;

    // Convert any Markdown links to standard HTML tags for consistent tokenization
    const mdLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g;
    const normalized = rawMessage.replace(mdLinkRegex, '<a href="$2">$1</a>');

    // Tokenize on <a ... href="..." ...>...</a>
    const linkRegex = /<a\s+[^>]*?href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(normalized)) !== null) {
        const textBefore = normalized.slice(lastIndex, match.index);
        if (textBefore) {
            // Strip any leftover stray angle brackets/tags
            parts.push(textBefore.replace(/<\/?[^>]+(>|$)/g, ''));
        }

        const href = match[1];
        const label = match[2] ? match[2].replace(/<\/?[^>]+(>|$)/g, '') : href;
        const isInternal = href.startsWith('/') || href.startsWith('#');
        const isDiscord = !isInternal && (href.includes('discord.com') || href.includes('discord.gg'));

        parts.push(
            <a
                key={`err-link-${match.index}`}
                href={href}
                target={isInternal ? undefined : '_blank'}
                rel={isInternal ? undefined : 'noopener noreferrer'}
                className="d-inline-flex align-items-center gap-1 px-2.5 py-1 mx-1 rounded-pill text-decoration-none fw-bold shadow-sm transition-all"
                style={{
                    backgroundColor: isDiscord ? '#5865F2' : 'var(--ac-primary, #16a34a)',
                    color: '#ffffff',
                    fontSize: '0.9em',
                    verticalAlign: 'middle',
                    lineHeight: 1.2,
                }}
                onClick={isInternal ? () => onClose() : undefined}
            >
                {isDiscord ? (
                    <i className="fa-brands fa-discord"></i>
                ) : isInternal ? (
                    <i className="fa-solid fa-address-card fa-xs"></i>
                ) : (
                    <i className="fa-solid fa-arrow-up-right-from-square fa-xs"></i>
                )}
                <span>{label}</span>
            </a>
        );

        lastIndex = match.index + match[0].length;
    }

    const textAfter = normalized.slice(lastIndex);
    if (textAfter) {
        parts.push(textAfter.replace(/<\/?[^>]+(>|$)/g, ''));
    }

    return parts.length > 0 ? parts : rawMessage.replace(/<\/?[^>]+(>|$)/g, '');
}

const RevealErrorPopup: React.FC<RevealErrorPopupProps> = ({ message, onClose }) => {
    const [theme, setTheme] = useState<ThemeMode>(getStoredTheme);

    useEffect(() => {
        const handleThemeUpdate = (e: any) => {
            if (e.detail?.theme) setTheme(e.detail.theme);
        };
        window.addEventListener('chopaeng_theme_updated', handleThemeUpdate);

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('chopaeng_theme_updated', handleThemeUpdate);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    const activeStyle = THEME_STYLES[theme] || THEME_STYLES.nook;
    const isCharReq = /character|ign|island name/i.test(message);

    return (
        <div
            className="position-fixed top-0 start-0 end-0 bottom-0 d-flex align-items-center justify-content-center p-3 animate-fade-in"
            style={{
                zIndex: 1080,
                background: 'rgba(15, 23, 42, 0.65)',
                backdropFilter: 'blur(6px)',
            }}
            onClick={onClose}
        >
            <div
                className="rounded-4 shadow-2xl border overflow-hidden animate-scale-up"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="reveal-error-title"
                style={{
                    maxWidth: 460,
                    width: '100%',
                    backgroundColor: activeStyle.cardBg,
                    borderColor: isCharReq ? 'rgba(55, 176, 109, 0.4)' : activeStyle.border,
                    boxShadow: '0 20px 40px rgba(0,0,0,0.35)',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-4 text-center">
                    <div
                        className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3 shadow-sm"
                        style={{
                            width: 64,
                            height: 64,
                            backgroundColor: isCharReq ? 'rgba(16, 185, 129, 0.15)' : activeStyle.iconBg,
                            color: isCharReq ? '#10b981' : activeStyle.iconColor,
                            fontSize: '1.5rem',
                        }}
                    >
                        <i className={`fa-solid ${isCharReq ? 'fa-id-card-clip' : 'fa-triangle-exclamation'}`}></i>
                    </div>

                    <h2
                        id="reveal-error-title"
                        className="h5 fw-black mb-2"
                        style={{ color: activeStyle.textPrimary, letterSpacing: '-0.02em' }}
                    >
                        {isCharReq ? 'In-Game Character Required' : 'Dodo code unavailable'}
                    </h2>

                    <div
                        className="fw-medium mb-4 lh-base"
                        style={{
                            color: activeStyle.textMuted,
                            fontSize: '0.95rem',
                            wordBreak: 'break-word',
                        }}
                    >
                        {renderParsedMessage(message, onClose)}
                    </div>

                    <div className="d-flex align-items-center justify-content-center gap-2 flex-wrap">
                        {isCharReq && (
                            <a
                                href="/profile"
                                className="btn btn-success text-white rounded-pill fw-black px-4 py-2 shadow-sm transition-all text-decoration-none d-inline-flex align-items-center gap-1.5"
                                onClick={() => onClose()}
                            >
                                <i className="fa-solid fa-user-pen"></i>
                                <span>Go to Profile</span>
                            </a>
                        )}
                        <button
                            type="button"
                            className="btn rounded-pill fw-black px-4 py-2 shadow-sm transition-all"
                            style={{
                                backgroundColor: isCharReq ? '#f1f5f9' : activeStyle.btnBg,
                                borderColor: isCharReq ? '#cbd5e1' : activeStyle.btnBg,
                                color: isCharReq ? '#475569' : activeStyle.btnText,
                            }}
                            onClick={onClose}
                            autoFocus={!isCharReq}
                        >
                            {isCharReq ? 'Cancel' : 'OK'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RevealErrorPopup;
