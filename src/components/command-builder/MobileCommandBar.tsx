import React from 'react';
import { useNavigate } from 'react-router-dom';
import { playChimeClick } from '../../utils/kkAudioSynthesizer';

export type MobileTab = 'catalog' | 'pockets' | 'command' | 'order';

interface MobileCommandBarProps {
    activeTab: MobileTab;
    onTabChange: (tab: MobileTab) => void;
    orderCount: number;
    dropCount: number;
    hasCommand: boolean;
}

const COLORS = {
    primary: '#16a34a',
    primaryText: '#15803d',
    inactiveText: '#64748b',
    primaryTint: 'rgba(22, 163, 74, 0.12)',
    pocketsBadge: '#16a34a',
    commandBadge: '#d97706',
    orderBotBadge: '#2563eb',
};

export const MobileCommandBar: React.FC<MobileCommandBarProps> = ({
    activeTab,
    onTabChange,
    orderCount,
    dropCount,
    hasCommand,
}) => {
    const navigate = useNavigate();
    const totalCount = orderCount + dropCount;

    const tabs: {
        id: MobileTab;
        icon: string;
        label: string;
        badge?: number | string;
        badgeColor?: string;
        badgeDescription?: string;
        isActionLink?: boolean;
        href?: string;
    }[] = [
        {
            id: 'catalog',
            icon: 'fa-magnifying-glass',
            label: 'Browse',
        },
        {
            id: 'pockets',
            icon: 'fa-boxes-stacked',
            label: 'Pockets',
            badge: totalCount > 0 ? (totalCount > 99 ? '99+' : totalCount) : undefined,
            badgeColor: COLORS.pocketsBadge,
            badgeDescription: `${totalCount} item${totalCount === 1 ? '' : 's'} in pocket`,
        },
        {
            id: 'command',
            icon: 'fa-clipboard-check',
            label: 'Command',
            badge: hasCommand ? '!' : undefined,
            badgeColor: COLORS.commandBadge,
            badgeDescription: 'Generated bot command',
        },
        {
            id: 'order',
            icon: 'fa-paper-plane',
            label: 'Order Bot',
            badge: orderCount > 0 ? `${orderCount}` : undefined,
            badgeColor: '#16a34a',
            badgeDescription: 'Open Order Bot dispatch',
            isActionLink: true,
            href: '/order',
        },
    ];

    const handleTabClick = (tab: typeof tabs[0]) => {
        playChimeClick();
        if (tab.isActionLink && tab.href) {
            navigate(tab.href);
            return;
        }
        onTabChange(tab.id);
    };

    const activeLabel = tabs.find((t) => t.id === activeTab)?.label ?? '';

    return (
        <>
            <style>{`
                @keyframes mcb-badge-pop {
                    0% { transform: scale(0); opacity: 0; }
                    60% { transform: scale(1.15); opacity: 1; }
                    100% { transform: scale(1); }
                }
                @keyframes mcb-order-pulse {
                    0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.4); }
                    50% { transform: scale(1.05); box-shadow: 0 0 0 5px rgba(22, 163, 74, 0); }
                }
                .mcb-tab {
                    -webkit-tap-highlight-color: transparent;
                    touch-action: manipulation;
                    position: relative;
                }
                .mcb-tab:active { background: rgba(15, 23, 42, 0.05); }
                .mcb-tab:active .mcb-icon-wrap { transform: scale(0.92); }
                .mcb-tab:focus-visible {
                    outline: 2px solid ${COLORS.primaryText};
                    outline-offset: -3px;
                    border-radius: 12px;
                }
                .mcb-label {
                    transition: transform 0.18s ease, font-weight 0.18s ease;
                    font-family: 'Outfit', sans-serif;
                }
                .mcb-tab[aria-selected="true"] .mcb-label {
                    transform: translateY(-1px);
                    font-weight: 800;
                }
                @media (prefers-reduced-motion: reduce) {
                    .mcb-tab, .mcb-icon-wrap, .mcb-pill, .mcb-badge, .mcb-label {
                        transition: none !important;
                        animation: none !important;
                    }
                }
            `}</style>

            {/* Screen-reader announcement when the active tab changes */}
            <span className="visually-hidden" aria-live="polite">
                {activeLabel} tab selected
            </span>

            {/* Bottom Tab Bar */}
            <nav
                className="d-lg-none position-fixed bottom-0 start-0 end-0 border-top"
                role="tablist"
                aria-label="Command Builder mobile navigation"
                style={{
                    zIndex: 1050,
                    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                    background: 'rgba(255, 255, 255, 0.94)',
                    backdropFilter: 'blur(16px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(16px) saturate(180%)',
                    borderColor: 'rgba(226, 232, 240, 0.9)',
                    boxShadow: '0 -4px 24px rgba(15, 23, 42, 0.08)',
                }}
            >
                <div className="d-flex align-items-stretch" style={{ height: '64px' }}>
                    {tabs.map((tab) => {
                        const isActive = activeTab === tab.id;
                        const fullLabel = tab.badge !== undefined ? `${tab.label}, ${tab.badgeDescription}` : tab.label;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                role="tab"
                                aria-selected={isActive}
                                aria-current={isActive ? 'page' : undefined}
                                aria-label={fullLabel}
                                tabIndex={isActive ? 0 : -1}
                                onClick={() => handleTabClick(tab)}
                                className="mcb-tab flex-fill d-flex flex-column align-items-center justify-content-center gap-1 border-0 bg-transparent"
                                style={{
                                    color: isActive ? COLORS.primaryText : COLORS.inactiveText,
                                    fontSize: '0.62rem',
                                    fontWeight: isActive ? 800 : 600,
                                    letterSpacing: '0.02em',
                                    transition: 'color 0.18s ease, background 0.15s ease',
                                    cursor: 'pointer',
                                    padding: 0,
                                }}
                            >
                                {/* Active indicator pill */}
                                <span
                                    className="mcb-pill position-absolute top-0 start-50"
                                    style={{
                                        transform: isActive ? 'translate(-50%, 0) scaleX(1)' : 'translate(-50%, 0) scaleX(0)',
                                        transition: 'transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)',
                                        width: '32px',
                                        height: '3px',
                                        borderRadius: '0 0 4px 4px',
                                        background: COLORS.primary,
                                    }}
                                    aria-hidden="true"
                                />

                                {/* Icon */}
                                <div
                                    className="mcb-icon-wrap position-relative d-flex align-items-center justify-content-center"
                                    style={{
                                        width: '34px',
                                        height: '34px',
                                        borderRadius: '10px',
                                        background: isActive ? COLORS.primaryTint : 'transparent',
                                        transition: 'background 0.18s ease, transform 0.15s ease',
                                    }}
                                >
                                    <i
                                        className={`fa-solid ${tab.icon}`}
                                        aria-hidden="true"
                                        style={{ fontSize: '1rem', color: tab.id === 'order' && orderCount > 0 ? '#16a34a' : undefined }}
                                    />
                                    {/* Badge */}
                                    {tab.badge !== undefined && (
                                        <span
                                            className="mcb-badge position-absolute d-flex align-items-center justify-content-center text-white fw-bold"
                                            aria-hidden="true"
                                            style={{
                                                fontSize: '0.55rem',
                                                top: '-4px',
                                                right: '-6px',
                                                minWidth: '16px',
                                                height: '16px',
                                                padding: '0 4px',
                                                borderRadius: '999px',
                                                background: tab.badgeColor,
                                                border: '2px solid #fff',
                                                lineHeight: 1,
                                                animation:
                                                    'mcb-badge-pop 0.25s ease-out' +
                                                    (tab.id === 'order' && orderCount > 0 ? ', mcb-order-pulse 2s ease-in-out infinite' : ''),
                                            }}
                                        >
                                            {tab.badge}
                                        </span>
                                    )}
                                </div>
                                <span className="mcb-label">{tab.label}</span>
                            </button>
                        );
                    })}
                </div>
            </nav>

            {/* Bottom spacer so content isn't hidden behind the fixed nav */}
            <div className="d-lg-none" style={{ height: '72px' }} aria-hidden="true" />
        </>
    );
};

export default MobileCommandBar;