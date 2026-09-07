import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { playChimeClick } from '../../utils/kkAudioSynthesizer';
import type { CatalogEntity } from '../../data/commandBuilderData';

type PocketItem = CatalogEntity & {
    baseId?: string | number | null;
    variantId?: string | number | null;
    variantLabel?: string | null;
};

interface ChoPaengDispatchCardProps {
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

export const ChoPaengDispatchCard: React.FC<ChoPaengDispatchCardProps> = ({
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
    const [selectedTab, setSelectedTab] = useState<'order' | 'drop' | 'all'>('order');
    const totalCount = orderCount + dropCount;

    const villagerInDrop = dropPockets.some((p) => p.item.entityType === 'villager');

    return (
        <div className="card rounded-4 border shadow-sm p-3 p-sm-4 mb-3 bg-white position-relative">
            {/* 1. Header */}
            <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom flex-wrap gap-2">
                <div className="d-flex align-items-center gap-2.5">
                    <div
                        className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                        style={{
                            width: '38px',
                            height: '38px',
                            backgroundColor: '#e8f7ec',
                            color: '#16a34a',
                        }}
                    >
                        <i className="fa-solid fa-paper-plane fs-6" />
                    </div>
                    <div>
                        <h3 className="h6 fw-bold mb-0 ac-font text-dark" style={{ fontSize: '1.05rem' }}>
                            Ready to Order & Deliver
                        </h3>
                        <p className="tiny-text text-muted mb-0">
                            Copy bot commands or jump straight to the Order Bot queue.
                        </p>
                    </div>
                </div>

                <div className="d-flex align-items-center gap-1.5">
                    <span
                        className="badge rounded-pill bg-success-subtle text-success border border-success-subtle px-2.5 py-1 fw-bold"
                        style={{ fontSize: '0.72rem' }}
                    >
                        🌿 {totalCount} {totalCount === 1 ? 'item' : 'items'} in pockets
                    </span>
                </div>
            </div>

            {/* 2. Delivery Mode Selector (Clean ChoPaeng Pill Control) */}
            <div
                className="d-flex p-1 rounded-pill mb-3 border"
                style={{
                    backgroundColor: '#f8fafc',
                    borderColor: '#e2e8f0',
                }}
            >
                <button
                    type="button"
                    onClick={() => {
                        setSelectedTab('order');
                        playChimeClick();
                    }}
                    className={`btn btn-sm rounded-pill flex-grow-1 py-1.5 px-2 fw-bold transition-all d-flex align-items-center justify-content-center gap-1.5 ${
                        selectedTab === 'order'
                            ? 'bg-success text-white shadow-xs'
                            : 'text-secondary border-0 bg-transparent'
                    }`}
                    style={{ fontSize: '0.78rem' }}
                >
                    <i className="fa-brands fa-discord" />
                    <span>Order Bot</span>
                    {orderCount > 0 && (
                        <span
                            className={`badge rounded-pill px-1.5 py-0 ms-0.5 ${
                                selectedTab === 'order' ? 'bg-white text-success' : 'bg-success text-white'
                            }`}
                            style={{ fontSize: '0.65rem' }}
                        >
                            {orderCount}
                        </span>
                    )}
                </button>

                <button
                    type="button"
                    onClick={() => {
                        setSelectedTab('drop');
                        playChimeClick();
                    }}
                    className={`btn btn-sm rounded-pill flex-grow-1 py-1.5 px-2 fw-bold transition-all d-flex align-items-center justify-content-center gap-1.5 ${
                        selectedTab === 'drop'
                            ? 'text-white shadow-xs'
                            : 'text-secondary border-0 bg-transparent'
                    }`}
                    style={{
                        fontSize: '0.78rem',
                        backgroundColor: selectedTab === 'drop' ? '#0284c7' : 'transparent',
                    }}
                >
                    <i className="fa-solid fa-umbrella-beach" />
                    <span>Drop Bot</span>
                    {dropCount > 0 && (
                        <span
                            className={`badge rounded-pill px-1.5 py-0 ms-0.5 ${
                                selectedTab === 'drop' ? 'bg-white text-primary' : 'text-white'
                            }`}
                            style={{
                                fontSize: '0.65rem',
                                backgroundColor: selectedTab === 'drop' ? undefined : '#0284c7',
                            }}
                        >
                            {dropCount}
                        </span>
                    )}
                </button>

                <button
                    type="button"
                    onClick={() => {
                        setSelectedTab('all');
                        playChimeClick();
                    }}
                    className={`btn btn-sm rounded-pill flex-grow-1 py-1.5 px-2 fw-bold transition-all d-flex align-items-center justify-content-center gap-1.5 ${
                        selectedTab === 'all'
                            ? 'bg-dark text-white shadow-xs'
                            : 'text-secondary border-0 bg-transparent'
                    }`}
                    style={{ fontSize: '0.78rem' }}
                >
                    <i className="fa-solid fa-list-check" />
                    <span>All Commands</span>
                </button>
            </div>

            {/* 3. ORDER BOT CARD */}
            {(selectedTab === 'order' || selectedTab === 'all') && (
                <div
                    className="p-3 rounded-4 border mb-3"
                    style={{
                        backgroundColor: '#f9fdfa',
                        borderColor: '#bbf7d0',
                    }}
                >
                    <div className="d-flex align-items-center justify-content-between mb-2 flex-wrap gap-1">
                        <div className="d-flex align-items-center gap-1.5">
                            <span
                                className="badge rounded-pill bg-success text-white fw-bold px-2 py-0.5"
                                style={{ fontSize: '0.72rem' }}
                            >
                                <i className="fa-brands fa-discord me-1" />
                                Order Bot (Discord)
                            </span>
                            <span className="tiny-text text-muted">
                                40 Slots Max • {orderCount}/40 filled
                            </span>
                        </div>
                        <span className="tiny-text fw-semibold text-success d-flex align-items-center gap-1">
                            <i className="fa-solid fa-shield-check" />
                            Direct Delivery
                        </span>
                    </div>

                    {/* Helpful Steps Banner */}
                    <div
                        className="p-2 rounded-3 mb-2.5"
                        style={{ backgroundColor: '#ffffff', border: '1px solid #dcfce7', fontSize: '0.76rem' }}
                    >
                        <div className="text-dark fw-semibold mb-0.5 d-flex align-items-center gap-1.5">
                            <i className="fa-solid fa-circle-info text-success" />
                            <span>How it works:</span>
                        </div>
                        <span className="text-muted">
                            1. Copy command &rarr; 2. Paste in Discord <strong>#order-bot</strong> channel &rarr; 3.
                            Bot will DM you a private Dodo Code to fly!
                        </span>
                    </div>

                    {/* Command Preview Box */}
                    <div
                        className="p-2.5 rounded-3 mb-3 select-all position-relative"
                        style={{
                            backgroundColor: '#ffffff',
                            border: '1px solid #d1d5db',
                            fontSize: '0.8rem',
                            minHeight: '44px',
                            maxHeight: '84px',
                            overflowY: 'auto',
                            wordBreak: 'break-all',
                            color: '#1e293b',
                            fontFamily: 'SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                        }}
                    >
                        {unifiedOrderCmd || (
                            <span className="text-muted fst-italic">
                                Pockets are empty. Pick items from the catalog above to generate your !order command!
                            </span>
                        )}
                    </div>

                    {/* Action Buttons Row */}
                    <div className="d-flex flex-column flex-sm-row gap-2">
                        <button
                            type="button"
                            className="btn rounded-pill py-2 px-3 fw-bold shadow-sm d-flex align-items-center justify-content-center gap-2 flex-grow-1 transition-all text-white"
                            onClick={() => {
                                playChimeClick();
                                onCopyCommand(unifiedOrderCmd, 'orderUnified', 'order');
                            }}
                            disabled={!unifiedOrderCmd}
                            style={{
                                backgroundColor: copiedKey === 'orderUnified' ? '#15803d' : '#16a34a',
                                borderColor: '#16a34a',
                                fontSize: '0.85rem',
                            }}
                        >
                            <i
                                className={`fa-solid ${
                                    copiedKey === 'orderUnified' ? 'fa-check' : 'fa-copy'
                                }`}
                            />
                            <span>
                                {copiedKey === 'orderUnified'
                                    ? 'Copied Order Command!'
                                    : 'Copy Order Command'}
                            </span>
                        </button>

                        <Link
                            to="/order"
                            className="btn btn-outline-success rounded-pill py-2 px-3 fw-bold d-flex align-items-center justify-content-center gap-1.5 transition-all text-decoration-none"
                            style={{ fontSize: '0.85rem' }}
                            title="Go to ChoPaeng Order Bot web queue"
                        >
                            <i className="fa-solid fa-paper-plane" />
                            <span>Send to Order Bot &rarr;</span>
                        </Link>
                    </div>
                </div>
            )}

            {/* 4. DROP BOT CARD */}
            {(selectedTab === 'drop' || selectedTab === 'all') && (
                <div
                    className="p-3 rounded-4 border mb-3"
                    style={{
                        backgroundColor: '#f8fafc',
                        borderColor: '#bae6fd',
                    }}
                >
                    <div className="d-flex align-items-center justify-content-between mb-2 flex-wrap gap-1">
                        <div className="d-flex align-items-center gap-1.5">
                            <span
                                className="badge rounded-pill text-white fw-bold px-2 py-0.5"
                                style={{ backgroundColor: '#0284c7', fontSize: '0.72rem' }}
                            >
                                <i className="fa-solid fa-umbrella-beach me-1" />
                                Drop Bot (Treasure Island)
                            </span>
                            <span className="tiny-text text-muted">
                                9 Slots Max • For In-Game Chat
                            </span>
                        </div>
                        <span className="tiny-text fw-semibold text-primary d-flex align-items-center gap-1">
                            <i className="fa-solid fa-location-dot" />
                            On Island Ground
                        </span>
                    </div>

                    {/* Helpful Steps Banner */}
                    <div
                        className="p-2 rounded-3 mb-2.5"
                        style={{ backgroundColor: '#ffffff', border: '1px solid #e0f2fe', fontSize: '0.76rem' }}
                    >
                        <div className="text-dark fw-semibold mb-0.5 d-flex align-items-center gap-1.5">
                            <i className="fa-solid fa-circle-info text-primary" />
                            <span>How it works:</span>
                        </div>
                        <span className="text-muted">
                            Fly to a Treasure Island, stand on open ground (3×3 space), and send this command in
                            in-game chat. Items drop right at your feet!
                        </span>
                    </div>

                    {/* Items Command */}
                    <div className="mb-3">
                        <div className="d-flex align-items-center justify-content-between mb-1">
                            <span className="tiny-text fw-bold text-secondary">
                                <i className="fa-solid fa-boxes-packing me-1 text-primary" />
                                Ground Items ({Math.min(dropCount, 9)}/9)
                            </span>
                        </div>
                        <div
                            className="p-2.5 rounded-3 mb-2 select-all"
                            style={{
                                backgroundColor: '#ffffff',
                                border: '1px solid #d1d5db',
                                fontSize: '0.8rem',
                                minHeight: '44px',
                                maxHeight: '84px',
                                overflowY: 'auto',
                                wordBreak: 'break-all',
                                color: '#1e293b',
                                fontFamily: 'SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                            }}
                        >
                            {dropItemsOnlyCmd || (
                                <span className="text-muted fst-italic">
                                    No items in drop list. Add items to generate !drop command...
                                </span>
                            )}
                        </div>
                        <button
                            type="button"
                            className="btn w-100 rounded-pill py-2 px-3 fw-bold text-white shadow-sm d-flex align-items-center justify-content-center gap-2 transition-all"
                            onClick={() => {
                                playChimeClick();
                                onCopyCommand(dropItemsOnlyCmd, 'dropItems', 'drop');
                            }}
                            disabled={!dropItemsOnlyCmd}
                            style={{
                                backgroundColor: copiedKey === 'dropItems' ? '#0369a1' : '#0284c7',
                                borderColor: '#0284c7',
                                fontSize: '0.85rem',
                            }}
                        >
                            <i className={`fa-solid ${copiedKey === 'dropItems' ? 'fa-check' : 'fa-copy'}`} />
                            <span>
                                {copiedKey === 'dropItems'
                                    ? 'Copied !drop Command!'
                                    : 'Copy !drop Items Command'}
                            </span>
                        </button>
                    </div>

                    {/* Villager Injection Command (if any villager) */}
                    {villagerInDrop && (
                        <div className="pt-2 border-top">
                            <div className="d-flex align-items-center justify-content-between mb-1">
                                <span className="tiny-text fw-bold text-danger">
                                    <i className="fa-solid fa-paw me-1" />
                                    Villager Injection Command
                                </span>
                            </div>
                            <div
                                className="p-2.5 rounded-3 mb-2 select-all"
                                style={{
                                    backgroundColor: '#ffffff',
                                    border: '1px solid #fecdd3',
                                    fontSize: '0.8rem',
                                    minHeight: '40px',
                                    wordBreak: 'break-all',
                                    color: '#e11d48',
                                    fontFamily: 'SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                                }}
                            >
                                {dropVillagerOnlyCmd || (
                                    <span className="text-muted fst-italic">
                                        Add a villager to generate injection command...
                                    </span>
                                )}
                            </div>
                            <button
                                type="button"
                                className="btn w-100 rounded-pill py-2 px-3 fw-bold text-white shadow-sm d-flex align-items-center justify-content-center gap-2 transition-all"
                                onClick={() => {
                                    playChimeClick();
                                    onCopyCommand(dropVillagerOnlyCmd, 'dropVillager', 'drop');
                                }}
                                disabled={!dropVillagerOnlyCmd}
                                style={{
                                    backgroundColor: copiedKey === 'dropVillager' ? '#be123c' : '#e11d48',
                                    borderColor: '#e11d48',
                                    fontSize: '0.85rem',
                                }}
                            >
                                <i
                                    className={`fa-solid ${
                                        copiedKey === 'dropVillager' ? 'fa-check' : 'fa-syringe'
                                    }`}
                                />
                                <span>
                                    {copiedKey === 'dropVillager'
                                        ? 'Copied Villager Command!'
                                        : 'Copy Villager Command'}
                                </span>
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* 5. Quick Pocket Actions Bar */}
            <div className="d-flex align-items-center gap-1.5 flex-wrap pt-2 border-top">
                <span className="tiny-text fw-bold text-muted me-1">
                    <i className="fa-solid fa-wand-magic-sparkles me-1 text-warning" />
                    Quick Actions:
                </span>

                {onFillRemaining && (
                    <button
                        type="button"
                        onClick={() => {
                            playChimeClick();
                            onFillRemaining('nmt');
                        }}
                        className="btn btn-xs btn-light border rounded-pill fw-bold text-dark px-2.5 py-1 d-flex align-items-center gap-1 shadow-none"
                        title="Fill remaining empty pocket slots with Nook Miles Tickets"
                        style={{ fontSize: '0.74rem' }}
                    >
                        <i className="fa-solid fa-ticket text-success" />
                        <span>Fill NMT</span>
                    </button>
                )}

                {onFillRemaining && (
                    <button
                        type="button"
                        onClick={() => {
                            playChimeClick();
                            onFillRemaining('crowns');
                        }}
                        className="btn btn-xs btn-light border rounded-pill fw-bold text-dark px-2.5 py-1 d-flex align-items-center gap-1 shadow-none"
                        title="Fill remaining empty pocket slots with Royal Crowns"
                        style={{ fontSize: '0.74rem' }}
                    >
                        <i className="fa-solid fa-crown text-warning" />
                        <span>Fill Crowns</span>
                    </button>
                )}

                {onSortPockets && (
                    <button
                        type="button"
                        onClick={() => {
                            playChimeClick();
                            onSortPockets();
                        }}
                        className="btn btn-xs btn-light border rounded-pill fw-bold text-dark px-2.5 py-1 d-flex align-items-center gap-1 shadow-none"
                        title="Sort pockets neatly by category and name"
                        style={{ fontSize: '0.74rem' }}
                    >
                        <i className="fa-solid fa-arrow-down-a-z text-info" />
                        <span>Sort</span>
                    </button>
                )}

                {onFlipOrderAndDrop && (
                    <button
                        type="button"
                        onClick={() => {
                            playChimeClick();
                            onFlipOrderAndDrop();
                        }}
                        className="btn btn-xs btn-light border rounded-pill fw-bold text-dark px-2.5 py-1 d-flex align-items-center gap-1 shadow-none"
                        title="Swap items between Order Bot and Drop Bot pockets"
                        style={{ fontSize: '0.74rem' }}
                    >
                        <i className="fa-solid fa-arrows-rotate text-primary" />
                        <span>Swap</span>
                    </button>
                )}

                {onOpenShareModal && (
                    <button
                        type="button"
                        onClick={() => {
                            playChimeClick();
                            onOpenShareModal();
                        }}
                        className="btn btn-xs btn-light border rounded-pill fw-bold text-dark px-2.5 py-1 d-flex align-items-center gap-1 shadow-none ms-auto"
                        title="Share or Export Pocket Loadout"
                        style={{ fontSize: '0.74rem' }}
                    >
                        <i className="fa-solid fa-share-nodes text-success" />
                        <span>Share</span>
                    </button>
                )}

                {onOpenBatchImportModal && (
                    <button
                        type="button"
                        onClick={() => {
                            playChimeClick();
                            onOpenBatchImportModal();
                        }}
                        className="btn btn-xs btn-light border rounded-pill fw-bold text-dark px-2.5 py-1 d-flex align-items-center gap-1 shadow-none"
                        title="Import items or raw codes"
                        style={{ fontSize: '0.74rem' }}
                    >
                        <i className="fa-solid fa-file-import text-info" />
                        <span>Import</span>
                    </button>
                )}

                {(onClearOrderPockets || onClearDropPockets) && (
                    <button
                        type="button"
                        onClick={() => {
                            playChimeClick();
                            if (onClearOrderPockets) onClearOrderPockets();
                            if (onClearDropPockets) onClearDropPockets();
                        }}
                        className="btn btn-xs btn-light border rounded-pill fw-bold text-danger px-2.5 py-1 d-flex align-items-center gap-1 shadow-none"
                        title="Clear all pocket slots"
                        style={{ fontSize: '0.74rem' }}
                    >
                        <i className="fa-solid fa-trash-can" />
                        <span>Clear</span>
                    </button>
                )}
            </div>
        </div>
    );
};
export default ChoPaengDispatchCard;
