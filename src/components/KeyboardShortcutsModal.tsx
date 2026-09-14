import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { playChimeClick } from '../utils/kkAudioSynthesizer';
import { cycleTheme } from '../utils/theme';
import { hourlyBgm } from '../utils/hourlyBgmEngine';

export default function KeyboardShortcutsModal() {
    const [isOpen, setIsOpen] = useState(false);
    const navigate = useNavigate();

    const closeModal = useCallback(() => {
        setIsOpen(false);
    }, []);

    const openModal = useCallback(() => {
        playChimeClick();
        setIsOpen(true);
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if user is inside an input, textarea, or contenteditable element
            const activeEl = document.activeElement;
            const isInput =
                activeEl &&
                (activeEl.tagName === 'INPUT' ||
                    activeEl.tagName === 'TEXTAREA' ||
                    activeEl.getAttribute('contenteditable') === 'true');

            // Toggle modal with '?' or 'Ctrl+K' / 'Cmd+K'
            if ((e.key === '?' || (e.key === 'k' && (e.ctrlKey || e.metaKey))) && !isInput) {
                e.preventDefault();
                setIsOpen((prev) => !prev);
                playChimeClick();
                return;
            }

            if (e.key === 'Escape' && isOpen) {
                closeModal();
                return;
            }

            if (isInput) return;

            // Direct keyboard navigation shortcuts
            switch (e.key) {
                case '1':
                    playChimeClick();
                    navigate('/');
                    closeModal();
                    break;
                case '2':
                    playChimeClick();
                    navigate('/islands');
                    closeModal();
                    break;
                case '3':
                    playChimeClick();
                    navigate('/order');
                    closeModal();
                    break;
                case '4':
                    playChimeClick();
                    navigate('/drop');
                    closeModal();
                    break;
                case '5':
                    playChimeClick();
                    navigate('/trip-planner');
                    closeModal();
                    break;
                case '6':
                    playChimeClick();
                    navigate('/catalog');
                    closeModal();
                    break;
                case '7':
                    playChimeClick();
                    navigate('/pockets');
                    closeModal();
                    break;
                case 't':
                case 'T':
                    playChimeClick();
                    cycleTheme();
                    break;
                case 'm':
                case 'M':
                    playChimeClick();
                    hourlyBgm.togglePlay();
                    break;
                case 'j':
                case 'J':
                    playChimeClick();
                    window.dispatchEvent(new CustomEvent('chopaeng_toggle_jukebox'));
                    break;
                case '/':
                    e.preventDefault();
                    playChimeClick();
                    window.dispatchEvent(new CustomEvent('chopaeng_open_search'));
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('chopaeng_open_shortcuts_modal', openModal);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('chopaeng_open_shortcuts_modal', openModal);
        };
    }, [isOpen, navigate, closeModal, openModal]);

    if (!isOpen) return null;

    const navShortcuts = [
        { key: '1', label: 'Home Landing', path: '/' },
        { key: '2', label: 'Treasure Islands', path: '/islands' },
        { key: '3', label: 'Order Bot', path: '/order' },
        { key: '4', label: 'Drop Bot', path: '/drop' },
        { key: '5', label: 'Island Trip Planner', path: '/trip-planner' },
        { key: '6', label: 'Item Catalogue', path: '/catalog' },
        { key: '7', label: 'Pocket Inventory', path: '/pockets' },
    ];

    const actionShortcuts = [
        { key: 'T', label: 'Cycle Site Theme', desc: 'Nook / Celeste / Roost / Sakura / DAL' },
        { key: 'M', label: 'Toggle 24h Island BGM', desc: 'Real-time weather & hourly tracks' },
        { key: 'J', label: 'K.K. Slider Jukebox', desc: 'Live guitar synthesizer' },
        { key: '/', label: 'Quick Item Search', desc: 'Focus instant search palette' },
        { key: '?', label: 'Open Shortcuts Menu', desc: 'View this cheat sheet' },
        { key: 'Esc', label: 'Close Windows', desc: 'Dismiss active dialogs & modals' },
    ];

    return (
        <div
            className="modal fade show d-block"
            tabIndex={-1}
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.65)', zIndex: 1090 }}
            onClick={closeModal}
        >
            <style>{`
                .chopaeng-kbd {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    min-width: 26px;
                    height: 26px;
                    padding: 0 6px;
                    font-size: 0.75rem;
                    font-weight: 800;
                    font-family: monospace;
                    color: var(--text-dark, #1e293b);
                    background: var(--kbd-bg, #f1f5f9);
                    border: 1px solid var(--kbd-border, #cbd5e1);
                    border-bottom-width: 2px;
                    border-radius: 6px;
                    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
                }
                [data-theme="celeste"] .chopaeng-kbd {
                    color: #f8fafc;
                    background: #1e1b4b;
                    border-color: #4338ca;
                }
                [data-theme="roost"] .chopaeng-kbd {
                    color: #fafaf9;
                    background: #292524;
                    border-color: #78350f;
                }
            `}</style>

            <div
                className="modal-dialog modal-dialog-centered modal-lg"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="modal-content rounded-4 border shadow-2xl overflow-hidden">
                    {/* Header */}
                    <div className="modal-header bg-light border-bottom px-4 py-3">
                        <div className="d-flex align-items-center gap-2">
                            <span className="fs-5">⌨️</span>
                            <div>
                                <h2 className="modal-title h6 fw-black mb-0">Keyboard Navigation Shortcuts</h2>
                                <div className="tiny-text text-muted">Press keys anytime to navigate quickly across ChoPaeng</div>
                            </div>
                        </div>
                        <button
                            type="button"
                            className="btn-close"
                            onClick={closeModal}
                            aria-label="Close"
                        />
                    </div>

                    {/* Body */}
                    <div className="modal-body p-4">
                        <div className="row g-4">
                            {/* Navigation Column */}
                            <div className="col-md-6">
                                <h3 className="h6 fw-black text-uppercase text-muted tracking-wider mb-3">
                                    <i className="fa-solid fa-compass text-primary me-1" /> Quick Navigation
                                </h3>
                                <div className="d-flex flex-column gap-2">
                                    {navShortcuts.map((s) => (
                                        <div
                                            key={s.key}
                                            className="p-2 rounded-3 border bg-light bg-opacity-50 d-flex justify-content-between align-items-center"
                                            onClick={() => {
                                                playChimeClick();
                                                navigate(s.path);
                                                closeModal();
                                            }}
                                            role="button"
                                            tabIndex={0}
                                        >
                                            <span className="fw-bold x-small">{s.label}</span>
                                            <kbd className="chopaeng-kbd">{s.key}</kbd>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Utilities Column */}
                            <div className="col-md-6">
                                <h3 className="h6 fw-black text-uppercase text-muted tracking-wider mb-3">
                                    <i className="fa-solid fa-sliders text-success me-1" /> Controls &amp; Actions
                                </h3>
                                <div className="d-flex flex-column gap-2">
                                    {actionShortcuts.map((s) => (
                                        <div
                                            key={s.key}
                                            className="p-2 rounded-3 border bg-light bg-opacity-50 d-flex justify-content-between align-items-center"
                                        >
                                            <div>
                                                <div className="fw-bold x-small">{s.label}</div>
                                                <div className="tiny-text text-muted">{s.desc}</div>
                                            </div>
                                            <kbd className="chopaeng-kbd">{s.key}</kbd>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="modal-footer bg-light border-top px-4 py-2.5 justify-content-between">
                        <span className="tiny-text text-muted">
                            Tip: Press <kbd className="chopaeng-kbd">?</kbd> anywhere to toggle this menu.
                        </span>
                        <button
                            type="button"
                            onClick={closeModal}
                            className="btn btn-sm btn-dark rounded-pill fw-bold px-3"
                        >
                            Got It
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
