import React from 'react';
import type { CatalogEntity } from '../../data/commandBuilderData';
import { playChimeClick } from '../../utils/kkAudioSynthesizer';

interface DropBotHouseGridProps {
    selectedVillager: CatalogEntity | null;
    activePlot: number;
    onSelectPlot: (plot: number) => void;
    injectedHouses: Record<number, CatalogEntity | null>;
    onAssignVillagerToPlot: (plot: number, villager: CatalogEntity | null) => void;
    onClearPlot: (plot: number) => void;
    onClearAllPlots: () => void;
    onCopyCommand?: (cmd: string, label?: string) => void;
    onCopyAndOpenDiscord?: (cmd: string, label?: string) => void;
}

export const DropBotHouseGrid: React.FC<DropBotHouseGridProps> = ({
    selectedVillager,
    activePlot,
    onSelectPlot,
    injectedHouses,
    onAssignVillagerToPlot,
    onClearPlot,
    onClearAllPlots,
    onCopyCommand,
    onCopyAndOpenDiscord,
}) => {
    const playSound = () => {
        try {
            playChimeClick();
        } catch {
            // Audio synthesizer fallback
        }
    };

    // Calculate assigned count
    const assignedCount = Object.values(injectedHouses).filter(Boolean).length;

    // Single active plot command
    const activeVillager = injectedHouses[activePlot] || selectedVillager;
    const singleCommand = activeVillager
        ? `!injectvillager ${activeVillager.name} ${activePlot}`
        : '';

    // Multi-villager injection command (SysBot !mvi <villager1> <plot1> ...)
    const multiCommand = Object.entries(injectedHouses)
        .filter(([, v]) => !!v)
        .map(([plot, v]) => `${v!.name} ${plot}`)
        .join(' ');
    const fullMviCommand = multiCommand ? `!mvi ${multiCommand}` : '';

    const handleCopy = (text: string, label = 'command') => {
        if (!text) return;
        if (onCopyCommand) {
            onCopyCommand(text, label);
        } else {
            navigator.clipboard.writeText(text).catch(() => {});
            playSound();
        }
    };

    const handleCopyDiscord = (text: string, label = 'command') => {
        if (!text) return;
        if (onCopyAndOpenDiscord) {
            onCopyAndOpenDiscord(text, label);
        } else {
            navigator.clipboard.writeText(text).catch(() => {});
            playSound();
            window.open('https://discord.gg/chopaeng', '_blank');
        }
    };

    return (
        <div className="bg-white rounded-4 border border-light p-3 p-md-4 shadow-sm">
            {/* Header */}
            <div className="d-flex align-items-center justify-content-between mb-3 pb-3 border-bottom flex-wrap gap-2">
                <div className="d-flex align-items-center gap-3">
                    <div
                        className="rounded-circle d-flex align-items-center justify-content-center text-white"
                        style={{ width: 42, height: 42, background: 'linear-gradient(135deg, #10b981, #059669)', fontSize: '1.15rem' }}
                    >
                        <i className="fa-solid fa-house-chimney" />
                    </div>
                    <div>
                        <h2 className="h6 fw-bold mb-0 text-dark" style={{ fontFamily: 'var(--font-heading, "Nunito", sans-serif)' }}>
                            Villager House Plots (0 – 9)
                        </h2>
                        <p className="text-muted mb-0" style={{ fontSize: '0.78rem' }}>
                            Select a plot to inject your chosen villager into on the island.
                        </p>
                    </div>
                </div>

                <div className="d-flex align-items-center gap-2">
                    <span className="badge rounded-pill bg-success-subtle text-success-emphasis border border-success-subtle px-3 py-1 fw-bold" style={{ fontSize: '0.75rem' }}>
                        {assignedCount} / 10 Plots Assigned
                    </span>
                    {assignedCount > 0 && (
                        <button
                            type="button"
                            className="btn btn-sm btn-outline-danger rounded-pill px-2 py-0 border-0"
                            style={{ fontSize: '0.75rem' }}
                            onClick={() => {
                                playSound();
                                onClearAllPlots();
                            }}
                            title="Reset all assigned plots"
                        >
                            <i className="fa-solid fa-rotate-left me-1" /> Reset All
                        </button>
                    )}
                </div>
            </div>

            {/* Selected Villager Action Bar */}
            {selectedVillager && (
                <div
                    className="p-3 mb-3 rounded-4 d-flex align-items-center justify-content-between gap-3 flex-wrap"
                    style={{ background: '#f0fdf4', border: '1.5px solid #86efac' }}
                >
                    <div className="d-flex align-items-center gap-3">
                        <img
                            src={selectedVillager.image}
                            alt={selectedVillager.name}
                            className="rounded-circle border bg-white shadow-2xs"
                            style={{ width: 44, height: 44, objectFit: 'contain' }}
                            onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src =
                                    'https://dodo.ac/np/images/4/43/Nook_Miles_Ticket_NH_Inv_Icon.png';
                            }}
                        />
                        <div>
                            <div className="d-flex align-items-center gap-2">
                                <span className="fw-black text-dark" style={{ fontSize: '0.95rem' }}>
                                    {selectedVillager.name}
                                </span>
                                {selectedVillager.category && (
                                    <span className="badge bg-white text-muted border rounded-pill" style={{ fontSize: '0.7rem' }}>
                                        {selectedVillager.category}
                                    </span>
                                )}
                            </div>
                            <span className="text-muted" style={{ fontSize: '0.78rem' }}>
                                Target: <strong>Plot #{activePlot}</strong>
                            </span>
                        </div>
                    </div>

                    <div className="d-flex align-items-center gap-2 flex-wrap">
                        <button
                            type="button"
                            className="btn btn-sm btn-success rounded-pill fw-bold px-3 shadow-2xs"
                            style={{ fontSize: '0.82rem' }}
                            onClick={() => {
                                playSound();
                                onAssignVillagerToPlot(activePlot, selectedVillager);
                            }}
                        >
                            <i className="fa-solid fa-check me-1" /> Assign to Plot #{activePlot}
                        </button>
                        <button
                            type="button"
                            className="btn btn-sm btn-dark rounded-pill fw-bold px-3 shadow-2xs d-flex align-items-center gap-1.5"
                            style={{ fontSize: '0.82rem' }}
                            onClick={() => {
                                handleCopyDiscord(`!injectvillager ${selectedVillager.name} ${activePlot}`, `!injectvillager ${selectedVillager.name}`);
                            }}
                            title="Copy command and open Discord"
                        >
                            <i className="fa-brands fa-discord text-primary" /> Copy &amp; Open Discord
                        </button>
                    </div>
                </div>
            )}

            {/* 10 Cottage Plots Grid (0 to 9) */}
            <div className="row g-2 mb-3">
                {Array.from({ length: 10 }).map((_, index) => {
                    const plotVillager = injectedHouses[index] || null;
                    const isActive = activePlot === index;

                    return (
                        <div key={index} className="col-6 col-sm-4 col-md-3 col-lg-2-4" style={{ flex: '0 0 20%', maxWidth: '20%' }}>
                            <div
                                onClick={() => {
                                    playSound();
                                    onSelectPlot(index);
                                }}
                                className={`h-100 p-2 rounded-4 text-center cursor-pointer transition-all position-relative ${
                                    isActive
                                        ? 'bg-success-subtle border-2 border-success shadow-sm'
                                        : plotVillager
                                        ? 'bg-white border-2 border-primary-subtle shadow-2xs'
                                        : 'bg-light border border-light-subtle'
                                }`}
                                style={{
                                    cursor: 'pointer',
                                    transition: 'all 0.18s ease-in-out',
                                    minHeight: 120,
                                }}
                            >
                                {/* Plot Badge */}
                                <div className="d-flex align-items-center justify-content-between mb-1">
                                    <span
                                        className={`badge rounded-pill fw-black ${
                                            isActive
                                                ? 'bg-success text-white'
                                                : plotVillager
                                                ? 'bg-primary-subtle text-primary'
                                                : 'bg-secondary-subtle text-secondary'
                                        }`}
                                        style={{ fontSize: '0.68rem', letterSpacing: '0.02em' }}
                                    >
                                        House {index}
                                    </span>
                                    {plotVillager && (
                                        <button
                                            type="button"
                                            className="btn btn-link p-0 text-muted hover-text-danger border-0"
                                            style={{ fontSize: '0.72rem', lineHeight: 1 }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                playSound();
                                                onClearPlot(index);
                                            }}
                                            title={`Clear House ${index}`}
                                        >
                                            <i className="fa-solid fa-xmark" />
                                        </button>
                                    )}
                                </div>

                                {/* Plot Center Visual */}
                                {plotVillager ? (
                                    <div className="d-flex flex-column align-items-center justify-content-center py-1">
                                        <img
                                            src={plotVillager.image}
                                            alt={plotVillager.name}
                                            className="rounded-circle border mb-1 shadow-2xs bg-white"
                                            style={{ width: 44, height: 44, objectFit: 'contain' }}
                                            onError={(e) => {
                                                (e.currentTarget as HTMLImageElement).src =
                                                    'https://dodo.ac/np/images/4/43/Nook_Miles_Ticket_NH_Inv_Icon.png';
                                            }}
                                        />
                                        <span className="fw-bold text-dark text-truncate w-100" style={{ fontSize: '0.78rem' }}>
                                            {plotVillager.name}
                                        </span>
                                    </div>
                                ) : (
                                    <div className="d-flex flex-column align-items-center justify-content-center py-2 text-muted">
                                        <div
                                            className="rounded-circle d-flex align-items-center justify-content-center mb-1"
                                            style={{
                                                width: 38,
                                                height: 38,
                                                background: isActive ? '#dcfce7' : '#f1f5f9',
                                                color: isActive ? '#16a34a' : '#94a3b8',
                                            }}
                                        >
                                            <i className="fa-solid fa-house-user" style={{ fontSize: '0.95rem' }} />
                                        </div>
                                        <span className="text-secondary fw-semibold" style={{ fontSize: '0.72rem' }}>
                                            Empty Plot
                                        </span>
                                    </div>
                                )}

                                {isActive && (
                                    <span
                                        className="position-absolute bottom-0 start-50 translate-middle-x badge bg-success text-white rounded-pill px-2"
                                        style={{ fontSize: '0.62rem', transform: 'translate(-50%, 50%)', zIndex: 1 }}
                                    >
                                        Active
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Live Command Dispatch Box */}
            <div className="bg-light rounded-4 p-3 border">
                <div className="d-flex align-items-center justify-content-between mb-2">
                    <span className="text-muted fw-bold text-uppercase tracking-wider" style={{ fontSize: '0.72rem' }}>
                        <i className="fa-solid fa-terminal text-success me-1" />
                        SysBot Injection Command Preview
                    </span>
                    <span className="badge bg-white text-muted border rounded-pill" style={{ fontSize: '0.7rem' }}>
                        {assignedCount > 1 ? 'Multi-Villager (!mvi)' : 'Single Plot (!injectvillager)'}
                    </span>
                </div>

                {assignedCount === 0 && !singleCommand ? (
                    <p className="text-muted mb-0 fst-italic" style={{ fontSize: '0.8rem' }}>
                        Select a villager from the catalog and assign them to a plot (0–9) to generate commands.
                    </p>
                ) : (
                    <div className="d-flex flex-column gap-2">
                        {/* Single command */}
                        {singleCommand && (
                            <div className="d-flex align-items-center justify-content-between bg-white rounded-3 p-2 px-3 border gap-2 flex-wrap">
                                <span className="font-monospace text-dark text-truncate" style={{ fontSize: '0.82rem' }}>
                                    {singleCommand}
                                </span>
                                <div className="d-flex align-items-center gap-1.5 flex-shrink-0">
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-secondary rounded-pill px-2.5 py-1 d-flex align-items-center gap-1"
                                        style={{ fontSize: '0.75rem' }}
                                        onClick={() => handleCopy(singleCommand, `!injectvillager #${activePlot}`)}
                                        title="Copy command to clipboard"
                                    >
                                        <i className="fa-solid fa-copy" /> Copy
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-dark rounded-pill px-2.5 py-1 d-flex align-items-center gap-1"
                                        style={{ fontSize: '0.75rem' }}
                                        onClick={() => handleCopyDiscord(singleCommand, `!injectvillager #${activePlot}`)}
                                        title="Copy and open Discord"
                                    >
                                        <i className="fa-brands fa-discord text-primary" /> Discord
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Multi-villager command if multiple plots assigned */}
                        {assignedCount > 1 && fullMviCommand && (
                            <div className="d-flex align-items-center justify-content-between bg-white rounded-3 p-2 px-3 border gap-2 flex-wrap">
                                <span className="font-monospace text-success text-truncate fw-semibold" style={{ fontSize: '0.82rem' }}>
                                    {fullMviCommand}
                                </span>
                                <div className="d-flex align-items-center gap-1.5 flex-shrink-0">
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-success rounded-pill px-2.5 py-1 d-flex align-items-center gap-1"
                                        style={{ fontSize: '0.75rem' }}
                                        onClick={() => handleCopy(fullMviCommand, 'Batch !mvi command')}
                                        title="Copy multi-villager batch command"
                                    >
                                        <i className="fa-solid fa-copy" /> Copy Batch
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-success text-white rounded-pill px-2.5 py-1 d-flex align-items-center gap-1"
                                        style={{ fontSize: '0.75rem' }}
                                        onClick={() => handleCopyDiscord(fullMviCommand, 'Batch !mvi command')}
                                        title="Copy batch and open Discord"
                                    >
                                        <i className="fa-brands fa-discord" /> Copy !mvi &amp; Open Discord
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
