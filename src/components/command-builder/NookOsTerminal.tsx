import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { playChimeClick } from '../../utils/kkAudioSynthesizer';
import type { CatalogEntity } from '../../data/commandBuilderData';
import { APP_VERSION } from '../../version';
import '../../assets/css/nook-os-terminal.css';

type PocketItem = CatalogEntity & {
    baseId?: string | number | null;
    variantId?: string | number | null;
    variantLabel?: string | null;
};

export type TerminalFormatMode = 'sysbot' | 'names' | 'hex' | 'json';
export type TerminalTheme = 'green' | 'celeste' | 'amber' | 'dal';

interface NookOsTerminalProps {
    orderPockets: Array<{ item: PocketItem; quantity: number }>;
    dropPockets: Array<{ item: PocketItem; quantity: number }>;
    unifiedOrderCmd: string;
    dropItemsOnlyCmd: string;
    dropVillagerOnlyCmd: string;
    orderCount: number;
    dropCount: number;
    copiedKey: string | null;
    onCopyCommand: (text: string, key: string, instructionType: 'order' | 'drop') => void;
    onFillRemaining?: (type: 'nmt' | 'crowns' | 'bells' | 'gold' | 'repeat') => void;
    onClearOrderPockets?: () => void;
    onClearDropPockets?: () => void;
    onSortPockets?: () => void;
    onFlipOrderAndDrop?: () => void;
    onOpenShareModal?: () => void;
    onOpenBatchImportModal?: () => void;
}

interface LogEntry {
    id: string;
    text: string;
    time: string;
    type: 'info' | 'success' | 'warn' | 'cmd';
}

export const NookOsTerminal: React.FC<NookOsTerminalProps> = ({
    orderPockets,
    dropPockets,
    unifiedOrderCmd,
    dropItemsOnlyCmd,
    dropVillagerOnlyCmd,
    orderCount,
    dropCount,
    copiedKey,
    onCopyCommand,
    onFillRemaining,
    onClearOrderPockets,
    onClearDropPockets,
    onSortPockets,
    onFlipOrderAndDrop,
    onOpenShareModal,
    onOpenBatchImportModal,
}) => {
    const [targetBot, setTargetBot] = useState<'all' | 'order' | 'drop'>('all');
    const [formatMode, setFormatMode] = useState<TerminalFormatMode>('sysbot');
    const [theme, setTheme] = useState<TerminalTheme>('green');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [hasScanlines, setHasScanlines] = useState(false);
    const [cliInput, setCliInput] = useState('');
    const [commandHistory, setCommandHistory] = useState<string[]>([]);
    const [historyIndex, setHistoryIndex] = useState<number>(-1);
    const [logs, setLogs] = useState<LogEntry[]>([
        {
            id: 'init-1',
            text: `Nook-OS v${APP_VERSION} initialized. SysBot daemon ready on localhost:3000`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            type: 'info',
        },
    ]);

    const logContainerRef = useRef<HTMLDivElement>(null);
    const cliInputRef = useRef<HTMLInputElement>(null);

    // Auto-scroll terminal logs
    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [logs]);

    const addLog = (text: string, type: 'info' | 'success' | 'warn' | 'cmd' = 'info') => {
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLogs((prev) => [...prev.slice(-40), { id: `${Date.now()}-${Math.random()}`, text, time, type }]);
    };

    // Format Generators
    const plainTextOrder = useMemo(() => {
        if (orderPockets.length === 0) return '';
        return orderPockets.map((p) => `${p.quantity}x ${p.item.name}${p.item.variantLabel ? ` (${p.item.variantLabel})` : ''}`).join(', ');
    }, [orderPockets]);

    const plainTextDrop = useMemo(() => {
        if (dropPockets.length === 0) return '';
        return dropPockets.map((p) => `${p.quantity}x ${p.item.name}`).join(', ');
    }, [dropPockets]);

    const hexArrayOrder = useMemo(() => {
        if (orderPockets.length === 0) return '[]';
        const hexes: string[] = [];
        orderPockets.forEach((p) => {
            const hex = p.item.entityType === 'villager' ? `villager:${p.item.id}` : p.item.id;
            for (let i = 0; i < p.quantity; i++) hexes.push(hex);
        });
        return JSON.stringify(hexes, null, 2);
    }, [orderPockets]);

    const jsonPayload = useMemo(() => {
        return JSON.stringify(
            {
                version: '2.0',
                engine: 'chopaeng-sysbot',
                createdAt: new Date().toISOString(),
                orderPockets: orderPockets.map((p) => ({
                    id: p.item.id,
                    name: p.item.name,
                    variant: p.item.variantLabel || null,
                    quantity: p.quantity,
                    category: p.item.category || null,
                })),
                dropPockets: dropPockets.map((p) => ({
                    id: p.item.id,
                    name: p.item.name,
                    quantity: p.quantity,
                })),
            },
            null,
            2
        );
    }, [orderPockets, dropPockets]);

    // Active Display Text based on format and selected target bot
    const activeFormattedCode = useMemo(() => {
        if (formatMode === 'json') return jsonPayload;
        if (formatMode === 'hex') return hexArrayOrder;
        if (formatMode === 'names') {
            if (targetBot === 'drop') return plainTextDrop || 'No items in Drop Bot pocket.';
            if (targetBot === 'order') return plainTextOrder || 'No items in Order Bot pocket.';
            return `ORDER: ${plainTextOrder || 'None'}\nDROP: ${plainTextDrop || 'None'}`;
        }
        // SysBot default
        if (targetBot === 'drop') return dropItemsOnlyCmd || 'No items in Drop Bot pocket.';
        if (targetBot === 'order') return unifiedOrderCmd || 'No items in Order Bot pocket.';
        return [
            unifiedOrderCmd ? `# Order Bot (Discord):\n${unifiedOrderCmd}` : null,
            dropItemsOnlyCmd ? `# Drop Bot (Island):\n${dropItemsOnlyCmd}` : null,
            dropVillagerOnlyCmd ? `# Villager Inject:\n${dropVillagerOnlyCmd}` : null,
        ].filter(Boolean).join('\n\n') || 'Pockets empty. Add items from the catalog above.';
    }, [formatMode, targetBot, jsonPayload, hexArrayOrder, plainTextOrder, plainTextDrop, unifiedOrderCmd, dropItemsOnlyCmd, dropVillagerOnlyCmd]);

    // Handle CLI Execution
    const handleCliSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const raw = cliInput.trim();
        if (!raw) return;

        playChimeClick();
        addLog(`$ ${raw}`, 'cmd');
        setCommandHistory((prev) => [...prev, raw]);
        setHistoryIndex(-1);
        setCliInput('');

        const tokens = raw.toLowerCase().split(/\s+/);
        const command = tokens[0];
        const arg = tokens[1];

        switch (command) {
            case 'help':
            case '?':
                addLog('Available commands:', 'info');
                addLog('  help                     - Show this cheat sheet', 'info');
                addLog('  stats                    - View payload telemetry & slot usage', 'info');
                addLog('  fill [nmt|crowns|bells]  - Smart fill empty pocket slots', 'info');
                addLog('  sort                     - Sort pockets by category & name', 'info');
                addLog('  flip                     - Swap Order and Drop pockets', 'info');
                addLog('  format [sysbot|names|hex|json] - Switch code representation', 'info');
                addLog('  theme [green|celeste|amber|dal] - Change CRT phosphor palette', 'info');
                addLog('  scanlines                - Toggle retro CRT scanline effect', 'info');
                addLog('  copy [order|drop]        - Copy active payload to clipboard', 'info');
                addLog('  cls / clear              - Clear terminal console logs', 'info');
                break;

            case 'cls':
                setLogs([]);
                break;

            case 'clear':
            case 'reset':
                if (arg === 'order' && onClearOrderPockets) {
                    onClearOrderPockets();
                    addLog('Cleared Order Bot pockets.', 'success');
                } else if (arg === 'drop' && onClearDropPockets) {
                    onClearDropPockets();
                    addLog('Cleared Drop Bot pockets.', 'success');
                } else if (onClearOrderPockets && onClearDropPockets) {
                    onClearOrderPockets();
                    onClearDropPockets();
                    addLog('Cleared all pockets.', 'success');
                } else {
                    setLogs([]);
                }
                break;

            case 'share':
            case 'export':
                if (onOpenShareModal) {
                    onOpenShareModal();
                    addLog('Opened Share & Export modal.', 'success');
                } else {
                    addLog('Share modal handler not available.', 'warn');
                }
                break;

            case 'stats':
                addLog(`Order Slots: ${orderCount}/40 (${Math.round((orderCount / 40) * 100)}% capacity)`, 'success');
                addLog(`Drop Slots: ${dropCount}/9 (${Math.round((dropCount / 9) * 100)}% capacity)`, 'success');
                addLog(`Discord Payload Size: ${unifiedOrderCmd.length} chars (Max safe: 2000)`, 'info');
                break;

            case 'fill':
                if (onFillRemaining) {
                    const fillType = arg === 'crowns' ? 'crowns' : arg === 'bells' ? 'bells' : arg === 'gold' ? 'gold' : 'nmt';
                    onFillRemaining(fillType);
                    addLog(`Filled empty slots with ${fillType.toUpperCase()}`, 'success');
                } else {
                    addLog('Smart fill handler not available.', 'warn');
                }
                break;

            case 'sort':
                if (onSortPockets) {
                    onSortPockets();
                    addLog('Pockets sorted by category & name.', 'success');
                }
                break;

            case 'flip':
                if (onFlipOrderAndDrop) {
                    onFlipOrderAndDrop();
                    addLog('Swapped Order Bot and Drop Bot pockets.', 'success');
                }
                break;

            case 'format':
                if (arg === 'sysbot' || arg === 'names' || arg === 'hex' || arg === 'json') {
                    setFormatMode(arg);
                    addLog(`Output format switched to [${arg.toUpperCase()}]`, 'success');
                } else {
                    addLog('Invalid format. Options: sysbot, names, hex, json', 'warn');
                }
                break;

            case 'theme':
                if (arg === 'green' || arg === 'celeste' || arg === 'amber' || arg === 'dal') {
                    setTheme(arg);
                    addLog(`Terminal theme changed to [${arg.toUpperCase()}]`, 'success');
                } else {
                    addLog('Invalid theme. Options: green, celeste, amber, dal', 'warn');
                }
                break;

            case 'scanlines':
            case 'crt':
                setHasScanlines((prev) => !prev);
                addLog(`CRT scanlines effect: ${!hasScanlines ? 'ENABLED' : 'DISABLED'}`, 'info');
                break;

            case 'copy':
                if (arg === 'drop' && dropItemsOnlyCmd) {
                    onCopyCommand(dropItemsOnlyCmd, 'dropItems', 'drop');
                    addLog('Copied !drop command to clipboard!', 'success');
                } else if (unifiedOrderCmd) {
                    onCopyCommand(unifiedOrderCmd, 'orderUnified', 'order');
                    addLog('Copied !order command to clipboard!', 'success');
                } else {
                    addLog('No commands to copy in active pockets.', 'warn');
                }
                break;

            default:
                addLog(`Unknown command '${command}'. Type 'help' for commands.`, 'warn');
                break;
        }
    };

    // CLI History Keyboard Navigation
    const handleCliKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (commandHistory.length === 0) return;
            const nextIdx = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
            setHistoryIndex(nextIdx);
            setCliInput(commandHistory[nextIdx]);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndex === -1) return;
            const nextIdx = historyIndex + 1;
            if (nextIdx >= commandHistory.length) {
                setHistoryIndex(-1);
                setCliInput('');
            } else {
                setHistoryIndex(nextIdx);
                setCliInput(commandHistory[nextIdx]);
            }
        }
    };

    // Main Terminal Content Structure
    const terminalWindowContent = (
        <div
            className={`nook-terminal-window ${isFullscreen ? 'fullscreen' : ''} ${hasScanlines ? 'scanlines' : ''}`}
            data-term-theme={theme}
        >
            {/* Top Window Bar */}
            <div className="nook-terminal-header">
                <div className="d-flex align-items-center gap-2">
                    <div className="d-flex gap-1.5 align-items-center">
                        <button
                            type="button"
                            className="nook-terminal-dot red"
                            onClick={() => { playChimeClick(); addLog('Console cleared.', 'info'); setLogs([]); }}
                            title="Clear console logs"
                            aria-label="Clear logs"
                        />
                        <button
                            type="button"
                            className="nook-terminal-dot yellow"
                            onClick={() => { playChimeClick(); setHasScanlines(prev => !prev); }}
                            title="Toggle retro CRT scanlines"
                            aria-label="Toggle scanlines"
                        />
                        <button
                            type="button"
                            className="nook-terminal-dot green"
                            onClick={() => { playChimeClick(); setIsFullscreen(prev => !prev); }}
                            title={isFullscreen ? 'Exit Fullscreen' : 'Expand Fullscreen Terminal'}
                            aria-label="Toggle fullscreen"
                        />
                    </div>
                    <span className="font-monospace fw-bold ms-2 text-truncate" style={{ fontSize: '0.78rem', color: 'var(--term-prompt)' }}>
                        <i className="fa-solid fa-terminal me-1.5" />nook-os v{APP_VERSION} (SysBot CLI)
                    </span>
                    <span className="nook-terminal-badge d-none d-sm-inline-flex">
                        <span className="ob-pulse green" style={{ width: 6, height: 6 }} /> ONLINE
                    </span>
                </div>

                {/* Right Header Controls */}
                <div className="d-flex align-items-center gap-1.5 flex-wrap">
                    {/* Theme Selector Capsule */}
                    <div className="d-inline-flex bg-black bg-opacity-40 p-0.5 rounded-pill border border-white border-opacity-10">
                        {(['green', 'celeste', 'amber', 'dal'] as TerminalTheme[]).map((t) => (
                            <button
                                key={t}
                                type="button"
                                onClick={() => { playChimeClick(); setTheme(t); addLog(`Switched theme: ${t.toUpperCase()}`, 'info'); }}
                                className={`btn btn-xs rounded-pill px-1.5 py-0.5 border-0 ${theme === t ? 'bg-white bg-opacity-20 text-white fw-bold' : 'text-white-50'}`}
                                style={{ fontSize: '0.62rem' }}
                                title={`Theme: ${t}`}
                            >
                                <i
                                    className="fa-solid fa-circle"
                                    style={{
                                        color: t === 'green' ? '#22c55e' : t === 'celeste' ? '#a855f7' : t === 'amber' ? '#f59e0b' : '#38bdf8',
                                        fontSize: '0.62rem',
                                    }}
                                    aria-hidden="true"
                                />
                            </button>
                        ))}
                    </div>

                    {/* Scanlines Toggle */}
                    <button
                        type="button"
                        onClick={() => { playChimeClick(); setHasScanlines(prev => !prev); }}
                        className={`btn btn-xs rounded-pill px-2 py-0.5 border border-white border-opacity-10 ${hasScanlines ? 'text-warning fw-bold' : 'text-white-50'}`}
                        style={{ fontSize: '0.65rem' }}
                        title="Toggle CRT Scanline Overlay"
                    >
                        <i className="fa-solid fa-tv me-1" />CRT
                    </button>

                    {/* Fullscreen Button */}
                    <button
                        type="button"
                        onClick={() => { playChimeClick(); setIsFullscreen(prev => !prev); }}
                        className="btn btn-xs rounded-pill px-2 py-0.5 text-white-50 hover-text-white border border-white border-opacity-10"
                        style={{ fontSize: '0.65rem' }}
                        title={isFullscreen ? 'Exit Fullscreen' : 'Expand Fullscreen'}
                    >
                        <i className={`fa-solid ${isFullscreen ? 'fa-compress' : 'fa-expand'}`} />
                    </button>
                </div>
            </div>

            {/* Terminal Body */}
            <div className="p-3 d-flex flex-column gap-2.5">
                {/* Format Mode & Target Selector */}
                <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap">
                    {/* Bot Target Filter */}
                    <div className="d-inline-flex bg-black bg-opacity-50 p-1 rounded-3 border border-white border-opacity-10 gap-1">
                        <button
                            type="button"
                            onClick={() => { playChimeClick(); setTargetBot('all'); }}
                            className={`btn btn-xs rounded-2 px-2 py-1 font-monospace fw-bold ${targetBot === 'all' ? 'bg-white bg-opacity-20 text-white' : 'text-white-50'}`}
                            style={{ fontSize: '0.7rem' }}
                        >
                            All ({orderCount + dropCount})
                        </button>
                        <button
                            type="button"
                            onClick={() => { playChimeClick(); setTargetBot('order'); }}
                            className={`btn btn-xs rounded-2 px-2 py-1 font-monospace fw-bold ${targetBot === 'order' ? 'bg-success text-white' : 'text-white-50'}`}
                            style={{ fontSize: '0.7rem' }}
                        >
                            <i className="fa-brands fa-discord me-1" />Order ({orderCount}/40)
                        </button>
                        <button
                            type="button"
                            onClick={() => { playChimeClick(); setTargetBot('drop'); }}
                            className={`btn btn-xs rounded-2 px-2 py-1 font-monospace fw-bold ${targetBot === 'drop' ? 'bg-info text-white' : 'text-white-50'}`}
                            style={{ fontSize: '0.7rem' }}
                        >
                            <i className="fa-solid fa-plane-arrival me-1" />Drop ({dropCount}/9)
                        </button>
                    </div>

                    {/* Output Format Switcher */}
                    <div className="d-inline-flex bg-black bg-opacity-50 p-1 rounded-3 border border-white border-opacity-10 gap-1">
                        {(['sysbot', 'names', 'hex', 'json'] as TerminalFormatMode[]).map((fmt) => (
                            <button
                                key={fmt}
                                type="button"
                                onClick={() => { playChimeClick(); setFormatMode(fmt); addLog(`Format: ${fmt.toUpperCase()}`, 'info'); }}
                                className={`btn btn-xs rounded-2 px-2 py-1 font-monospace fw-bold ${formatMode === fmt ? 'bg-white bg-opacity-25 text-white' : 'text-white-50'}`}
                                style={{ fontSize: '0.68rem' }}
                            >
                                {fmt === 'sysbot' ? '!order Hex' : fmt === 'names' ? 'Item Names' : fmt === 'hex' ? 'Hex Array' : 'JSON'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Primary Code Display Box */}
                <div className="nook-terminal-code-box">
                    <pre className="m-0 font-monospace" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                        {activeFormattedCode}
                    </pre>
                </div>

                {/* Telemetry Stats Bar */}
                <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap font-monospace" style={{ fontSize: '0.7rem' }}>
                    <div className="d-flex align-items-center gap-2 text-white-50">
                        <span><i className="fa-solid fa-layer-group me-1 text-success" />{orderCount} Order Slots</span>
                        <span>•</span>
                        <span><i className="fa-solid fa-umbrella-beach me-1 text-info" />{dropCount} Drop Slots</span>
                        <span>•</span>
                        <span>{activeFormattedCode.length} bytes</span>
                    </div>

                    {/* Discord Safety Token */}
                    <span className="nook-terminal-badge d-inline-flex align-items-center gap-1">
                        {activeFormattedCode.length <= 2000 ? (
                            <>
                                <i className="fa-solid fa-shield-check text-success" aria-hidden="true" />
                                <span>Discord Safe (&lt;2000c)</span>
                            </>
                        ) : (
                            <>
                                <i className="fa-solid fa-triangle-exclamation text-warning" aria-hidden="true" />
                                <span>Exceeds 2000 chars</span>
                            </>
                        )}
                    </span>
                </div>

                {/* Direct Action Toolbar */}
                <div className="d-flex align-items-center gap-2 flex-wrap">
                    {/* Primary Copy Button */}
                    <button
                        type="button"
                        onClick={() => onCopyCommand(
                            targetBot === 'drop' ? dropItemsOnlyCmd : unifiedOrderCmd,
                            targetBot === 'drop' ? 'dropItems' : 'orderUnified',
                            targetBot === 'drop' ? 'drop' : 'order'
                        )}
                        disabled={!activeFormattedCode}
                        className={`btn flex-grow-1 rounded-pill py-2 font-monospace fw-bold btn-sm shadow-sm transition-all d-flex align-items-center justify-content-center gap-2 text-white ${
                            copiedKey ? 'btn-success' : 'btn-nook'
                        }`}
                        style={{ fontSize: '0.8rem' }}
                    >
                        <i className={`fa-solid ${copiedKey ? 'fa-check' : 'fa-copy'}`} />
                        <span>{copiedKey ? 'Copied to Clipboard!' : 'Copy Active Command'}</span>
                    </button>

                    {/* Direct Teleport to /order Bot */}
                    <Link
                        to="/order"
                        className="btn btn-outline-light rounded-pill py-2 px-3 font-monospace fw-bold btn-sm d-flex align-items-center gap-2"
                        style={{ fontSize: '0.8rem' }}
                        title="Send pockets directly to ChoPaeng Order Bot"
                    >
                        <i className="fa-solid fa-paper-plane text-success" />
                        <span>Send to Order Bot →</span>
                    </Link>

                    {/* Share / Export Trigger */}
                    {onOpenShareModal && (
                        <button
                            type="button"
                            onClick={() => { playChimeClick(); onOpenShareModal(); }}
                            className="btn btn-outline-secondary rounded-pill py-2 px-3 font-monospace fw-bold btn-sm text-light"
                            style={{ fontSize: '0.78rem' }}
                            title="Share or Export Pocket Loadout"
                        >
                            <i className="fa-solid fa-share-nodes me-1" />Share
                        </button>
                    )}

                    {/* Batch Import Trigger */}
                    {onOpenBatchImportModal && (
                        <button
                            type="button"
                            onClick={() => { playChimeClick(); onOpenBatchImportModal(); }}
                            className="btn btn-outline-secondary rounded-pill py-2 px-3 font-monospace fw-bold btn-sm text-light"
                            style={{ fontSize: '0.78rem' }}
                            title="Paste raw hex strings or !order commands"
                        >
                            <i className="fa-solid fa-file-import me-1" />Import
                        </button>
                    )}
                </div>

                {/* Interactive CLI Console Bar */}
                <form onSubmit={handleCliSubmit} className="nook-terminal-cli-bar">
                    <span className="nook-terminal-cli-prompt">
                        <i className="fa-solid fa-angle-right me-1" />nook@sysbot:~$
                    </span>
                    <input
                        ref={cliInputRef}
                        type="text"
                        className="nook-terminal-cli-input"
                        placeholder="Type 'help', 'stats', 'fill nmt', 'sort', 'flip', 'copy'..."
                        value={cliInput}
                        onChange={(e) => setCliInput(e.target.value)}
                        onKeyDown={handleCliKeyDown}
                    />
                    <button
                        type="submit"
                        className="btn btn-xs rounded-pill px-2 text-success font-monospace fw-bold border-0"
                        title="Execute CLI command"
                    >
                        RUN ↵
                    </button>
                </form>

                {/* Console Log Activity Drawer */}
                <div ref={logContainerRef} className="nook-terminal-log">
                    {logs.map((log) => (
                        <div key={log.id} className="nook-terminal-log-entry">
                            <span className="nook-terminal-log-time">{log.time}</span>
                            <span
                                style={{
                                    color:
                                        log.type === 'success'
                                            ? '#4ade80'
                                            : log.type === 'warn'
                                            ? '#f59e0b'
                                            : log.type === 'cmd'
                                            ? '#38bdf8'
                                            : 'var(--term-text-dim)',
                                }}
                            >
                                {log.text}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    return (
        <>
            {/* Embedded Inline Terminal */}
            <div className="mb-3">
                {terminalWindowContent}
            </div>

            {/* Fullscreen Backdrop Modal when Maximized */}
            {isFullscreen && (
                <div
                    className="nook-terminal-modal-backdrop"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setIsFullscreen(false);
                    }}
                >
                    {terminalWindowContent}
                </div>
            )}
        </>
    );
};
