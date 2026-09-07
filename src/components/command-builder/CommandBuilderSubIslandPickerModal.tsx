import { useState, useMemo } from 'react';
import type { PocketItem } from '../../hooks/useCommandBuilderPockets';
import { useIslandData } from '../../context/useIslandData';
import { useAuth } from '../../context/useAuth';

interface CommandBuilderSubIslandPickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    dropPockets: Array<{ item: PocketItem; quantity: number }>;
    dropCommandText: string;
}

export const CommandBuilderSubIslandPickerModal = ({
    isOpen,
    onClose,
    dropPockets,
    dropCommandText,
}: CommandBuilderSubIslandPickerModalProps) => {
    const { islands } = useIslandData();
    const { user, login } = useAuth();
    const [selectedIslandId, setSelectedIslandId] = useState<string>('');
    const [plotNumber, setPlotNumber] = useState<number>(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [resultNotice, setResultNotice] = useState<{ success: boolean; message: string } | null>(null);

    // Filter Sub Islands only (cat === 'member' or type === 'sub')
    const subIslands = useMemo(() => {
        return islands.filter((isl) => isl.cat === 'member' || isl.type?.toLowerCase().includes('sub'));
    }, [islands]);

    // Auto-select first online sub island
    useMemo(() => {
        if (!selectedIslandId && subIslands.length > 0) {
            const firstOnline = subIslands.find((isl) => isl.status === 'ONLINE') || subIslands[0];
            setSelectedIslandId(firstOnline.id);
        }
    }, [subIslands, selectedIslandId]);

    const filteredSubIslands = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        return subIslands.filter((isl) => !q || isl.name.toLowerCase().includes(q) || isl.theme.toLowerCase().includes(q));
    }, [subIslands, searchQuery]);

    const activeIsland = useMemo(() => {
        return subIslands.find((isl) => isl.id === selectedIslandId) || subIslands[0] || null;
    }, [subIslands, selectedIslandId]);

    // Check if Drop pockets contain a villager
    const villagerItem = useMemo(() => {
        return dropPockets.find((p) => p.item.entityType === 'villager')?.item || null;
    }, [dropPockets]);

    const totalDropItems = dropPockets.reduce((s, p) => s + p.quantity, 0);

    const handleConfirmDrop = () => {
        if (!activeIsland) return;
        if (!dropCommandText) {
            setResultNotice({ success: false, message: 'Drop pocket is empty.' });
            return;
        }

        navigator.clipboard.writeText(dropCommandText).catch(() => {});
        setResultNotice({
            success: true,
            message: `Copied drop command for ${activeIsland.name}! Opening Discord channel...`,
        });

        setTimeout(() => {
            const targetUrl = (activeIsland as any)?.channel_id
                ? `https://discord.com/channels/729590421478703135/${(activeIsland as any).channel_id}`
                : 'https://discord.gg/chopaeng';
            window.open(targetUrl, '_blank');
        }, 400);
    };

    const handleCopyOnly = () => {
        if (!dropCommandText) return;
        navigator.clipboard.writeText(dropCommandText).catch(() => {});
        setResultNotice({
            success: true,
            message: 'Copied drop command to clipboard! Paste it into the Discord bot channel.',
        });
    };

    if (!isOpen) return null;

    return (
        <div
            className="modal fade show d-block"
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(4px)', zIndex: 1060 }}
        >
            <div className="modal-dialog modal-lg modal-dialog-centered">
                <div className="modal-content rounded-5 border-0 shadow-lg overflow-hidden" style={{ backgroundColor: 'var(--paper, #fdfbf7)' }}>
                    
                    {/* Header */}
                    <div className="modal-header border-0 bg-white px-4 py-3 shadow-sm d-flex align-items-center justify-content-between">
                        <div className="d-flex align-items-center gap-2">
                            <div
                                className="rounded-circle d-flex align-items-center justify-content-center text-dark shadow-sm"
                                style={{ width: '42px', height: '42px', background: '#5bc0de' }}
                            >
                                <i className="fa-solid fa-box-open fs-5"></i>
                            </div>
                            <div>
                                <h2 className="modal-title h5 fw-black text-dark mb-0 ac-font">Send Drop to Sub Island</h2>
                                <p className="tiny-text text-muted mb-0">Select which VIP island to spawn items or inject villagers</p>
                            </div>
                        </div>

                        <button
                            type="button"
                            className="btn-close rounded-circle p-2"
                            onClick={onClose}
                            aria-label="Close"
                        />
                    </div>

                    {/* Notice */}
                    {resultNotice && (
                        <div className={`alert ${resultNotice.success ? 'alert-success' : 'alert-danger'} rounded-0 mb-0 py-3 px-4 text-center fw-bold small animate-fade`}>
                            <i className={`fa-solid ${resultNotice.success ? 'fa-circle-check' : 'fa-circle-exclamation'} me-2`} />
                            {resultNotice.message}
                            {resultNotice.success && (
                                <div className="tiny-text mt-1 text-muted">
                                    ChoBot has executed the request on {activeIsland?.name}. Fly in to collect!
                                </div>
                            )}
                        </div>
                    )}

                    {/* Body */}
                    <div className="modal-body p-4">
                        {!user ? (
                            <div className="bg-white rounded-4 border p-4 text-center">
                                <i className="fa-brands fa-discord fs-1 text-primary mb-3"></i>
                                <h3 className="h6 fw-bold text-dark">Discord Login Required</h3>
                                <p className="small text-muted mb-3">
                                    You must be logged in with Discord and have an active Subscriber/VIP role to send drops to sub islands.
                                </p>
                                <button type="button" className="btn btn-primary rounded-pill px-4 fw-bold" onClick={login}>
                                    <i className="fa-brands fa-discord me-2"></i>Login with Discord
                                </button>
                            </div>
                        ) : totalDropItems === 0 ? (
                            <div className="bg-white rounded-4 border p-4 text-center text-muted">
                                <i className="fa-solid fa-box-open fs-2 mb-2 opacity-50"></i>
                                <p className="small mb-0">Your Drop pockets are empty. Add up to 9 items or villagers to drop!</p>
                            </div>
                        ) : (
                            <div className="d-flex flex-column gap-3">
                                
                                {/* Target Island Selector */}
                                <div>
                                    <div className="d-flex align-items-center justify-content-between mb-2">
                                        <label className="form-label small fw-bold text-muted mb-0">Select Target Sub Island (20 VIP Islands)</label>
                                        <div className="position-relative" style={{ width: '180px' }}>
                                            <input
                                                type="text"
                                                className="form-control form-control-sm rounded-pill ps-3 border"
                                                placeholder="Search island..."
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    <div className="row g-2 overflow-auto" style={{ maxHeight: '200px' }}>
                                        {filteredSubIslands.map((isl) => {
                                            const isSelected = activeIsland?.id === isl.id;
                                            const isOnline = isl.status === 'ONLINE';

                                            return (
                                                <div key={isl.id} className="col-sm-6">
                                                    <div
                                                        onClick={() => setSelectedIslandId(isl.id)}
                                                        className={`d-flex align-items-center justify-content-between p-2 rounded-3 border transition-all cursor-pointer ${
                                                            isSelected
                                                                ? 'border-info bg-info-subtle shadow-sm'
                                                                : 'bg-white hover-shadow'
                                                        }`}
                                                        style={{ cursor: 'pointer' }}
                                                    >
                                                        <div className="d-flex align-items-center gap-2 text-truncate">
                                                            <span
                                                                className={`rounded-circle d-inline-block flex-shrink-0 ${
                                                                    isOnline ? 'bg-success' : 'bg-secondary'
                                                                }`}
                                                                style={{ width: '10px', height: '10px' }}
                                                            />
                                                            <strong className="small text-dark text-truncate ac-font">
                                                                {isl.name}
                                                            </strong>
                                                        </div>
                                                        <span className={`badge rounded-pill x-small ${isOnline ? 'bg-success text-white' : 'bg-light text-muted border'}`}>
                                                            {isl.status}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Villager Plot Selector (if villager present) */}
                                {villagerItem && (
                                    <div className="bg-warning-subtle border border-warning-subtle rounded-4 p-3 animate-up">
                                        <div className="d-flex align-items-center gap-2 mb-2">
                                            <i className="fa-solid fa-cat text-warning-emphasis fs-5"></i>
                                            <strong className="small text-dark">
                                                Villager Injection Detected: {villagerItem.name}
                                            </strong>
                                        </div>
                                        <p className="tiny-text text-muted mb-2">
                                            Select which house plot on <strong>{activeIsland?.name}</strong> to place {villagerItem.name} into before flying in:
                                        </p>
                                        <div className="d-flex flex-wrap gap-2">
                                            {Array.from({ length: 10 }).map((_, idx) => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    className={`btn btn-sm rounded-pill fw-bold px-3 ${
                                                        plotNumber === idx ? 'btn-dark text-white shadow-sm' : 'btn-white border text-dark'
                                                    }`}
                                                    onClick={() => setPlotNumber(idx)}
                                                >
                                                    Plot {idx}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Drop items preview */}
                                <div className="bg-white rounded-4 p-3 border shadow-sm">
                                    <div className="d-flex align-items-center justify-content-between mb-2">
                                        <span className="tiny-text fw-bold text-muted text-uppercase tracking-wider">
                                            Items to Drop ({totalDropItems} Total)
                                        </span>
                                        <span className="badge bg-info text-dark rounded-pill x-small">
                                            Max 9 slots
                                        </span>
                                    </div>
                                    <div className="d-flex flex-wrap gap-2">
                                        {dropPockets.map((p) => (
                                            <span key={p.item.id} className="badge bg-light text-dark border rounded-pill py-1 px-3 small">
                                                {p.item.name} ×{p.quantity}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="modal-footer border-0 bg-white px-4 py-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
                        <span className="tiny-text text-muted">
                            {activeIsland ? `Targeting: ${activeIsland.name}` : ''}
                        </span>
                        <div className="d-flex gap-2 flex-wrap">
                            <button type="button" className="btn btn-outline-secondary rounded-pill px-3 fw-bold btn-sm" onClick={onClose}>
                                Close
                            </button>
                            {totalDropItems > 0 && (
                                <>
                                    <button
                                        type="button"
                                        className="btn btn-outline-dark rounded-pill px-3 fw-bold btn-sm d-flex align-items-center gap-1.5"
                                        onClick={handleCopyOnly}
                                    >
                                        <i className="fa-solid fa-copy" /> Copy Command
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-success text-white rounded-pill px-3 fw-bold btn-sm shadow-sm border-0 d-flex align-items-center gap-1.5"
                                        onClick={handleConfirmDrop}
                                    >
                                        <i className="fa-brands fa-discord" /> Copy &amp; Open Discord
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
