import { useState, useEffect } from 'react';
import { pollOrderStatus, type OrderStatusResponse } from '../../utils/orderBotApi';
import { getAuthToken } from '../../context/authToken';

interface CommandBuilderOrderStatusModalProps {
    isOpen: boolean;
    onClose: () => void;
    orderId: string | null;
    initialQueuePosition?: number;
    initialEstimatedMinutes?: number;
}

export const CommandBuilderOrderStatusModal = ({
    isOpen,
    onClose,
    orderId,
    initialQueuePosition = 1,
    initialEstimatedMinutes = 2,
}: CommandBuilderOrderStatusModalProps) => {
    const [statusData, setStatusData] = useState<OrderStatusResponse>({
        status: 'queued',
        queuePosition: initialQueuePosition,
        estimatedMinutes: initialEstimatedMinutes,
        islandName: 'Sinta',
    });

    useEffect(() => {
        if (!isOpen || !orderId) return;

        let isMounted = true;
        let timer: number;

        // Broadcast to NookPhone and tracker pills
        window.dispatchEvent(new CustomEvent('chopaeng_order_created', { detail: { orderId } }));
        window.dispatchEvent(new Event('storage'));

        const checkStatus = async () => {
            const data = await pollOrderStatus(orderId, getAuthToken());
            if (!isMounted) return;
            setStatusData(data);
        };

        checkStatus();
        timer = window.setInterval(checkStatus, 2500);

        return () => {
            isMounted = false;
            window.clearInterval(timer);
        };
    }, [isOpen, orderId]);

    if (!isOpen) return null;

    const isCancelled = statusData.status === 'cancelled';
    const isReady = (statusData.status === 'ready' || Boolean(statusData.dodoCode)) && !isCancelled;

    return (
        <div
            className="modal fade show d-block"
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(4px)', zIndex: 1060 }}
        >
            <div className="modal-dialog modal-md modal-dialog-centered">
                <div className="modal-content rounded-5 border-0 shadow-lg overflow-hidden" style={{ backgroundColor: 'var(--paper, #fdfbf7)' }}>
                    
                    {/* Header */}
                    <div className="modal-header border-0 px-4 py-3 shadow-sm d-flex align-items-center justify-content-between">
                        <div className="d-flex align-items-center gap-2">
                            <div
                                className="rounded-circle d-flex align-items-center justify-content-center text-white shadow-sm"
                                style={{ width: '42px', height: '42px', background: isCancelled ? '#dc3545' : isReady ? 'var(--nook-green, #2b8a3e)' : '#0d6efd' }}
                            >
                                <i className={`fa-solid ${isCancelled ? 'fa-circle-xmark' : isReady ? 'fa-plane-departure' : 'fa-hourglass-half'} fs-5`}></i>
                            </div>
                            <div>
                                <h2 className="modal-title h5 fw-black text-dark mb-0 ac-font">Order Bot Status</h2>
                                <p className="tiny-text text-muted mb-0">Live delivery tracking for {statusData.islandName || 'Sinta'}</p>
                            </div>
                        </div>

                        <button
                            type="button"
                            className="btn-close rounded-circle p-2 shadow-none"
                            onClick={onClose}
                            aria-label="Close"
                        />
                    </div>

                    {/* Body */}
                    <div className="modal-body p-4 text-center">
                        {isCancelled ? (
                            <div className="animate-up">
                                <div className="icon-circle bg-danger-subtle text-danger mx-auto mb-3" style={{ width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <i className="fa-solid fa-plane-slash fs-2"></i>
                                </div>
                                <h3 className="h5 fw-black text-dark mb-1 ac-font">Flight Gate Expired</h3>
                                <p className="small text-muted mb-4">
                                    {statusData.message || 'The flight arrival window has ended or the order was cancelled. You can easily re-order your items anytime!'}
                                </p>
                            </div>
                        ) : isReady ? (
                            <div className="animate-up">
                                <div className="icon-circle bg-success-subtle text-success mx-auto mb-3" style={{ width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <i className="fa-solid fa-plane-arrival fs-2"></i>
                                </div>
                                <h3 className="h5 fw-black text-dark mb-1 ac-font">Your Order is Ready!</h3>
                                <p className="small text-muted mb-4">
                                    Head to Dodo Airlines airport on your Nintendo Switch and enter this Dodo code:
                                </p>

                                {/* Dodo Code Card */}
                                <div className="card rounded-4 border p-3 mb-4 shadow-sm">
                                    <span className="tiny-text fw-bold text-muted text-uppercase tracking-widest d-block mb-1">
                                        Island: {statusData.islandName || 'Sinta'}
                                    </span>
                                    <div className="d-flex align-items-center justify-content-center gap-2 mb-2">
                                        <span className="fs-1 fw-black font-monospace text-success tracking-widest" style={{ letterSpacing: '6px' }}>
                                            {statusData.dodoCode}
                                        </span>
                                    </div>
                                    <div className="tiny-text text-muted fw-bold d-flex align-items-center justify-content-center gap-1">
                                        <i className="fa-solid fa-plane-departure text-success"></i>
                                        <span>Enter code at DAL Airport on your Nintendo Switch</span>
                                    </div>
                                </div>

                                <div className="alert alert-warning-subtle border border-warning-subtle rounded-3 py-2 px-3 small text-start">
                                    <i className="fa-solid fa-triangle-exclamation text-warning me-2"></i>
                                    <strong>Important:</strong> Only the account that ordered may fly in. Empty your pockets before traveling and leave via airport or Joy-Con (<code>-</code>) button!
                                </div>
                            </div>
                        ) : (
                            <div>
                                <div className="spinner-border text-primary mb-3" style={{ width: '48px', height: '48px' }} role="status"></div>
                                <h3 className="h5 fw-black text-dark mb-1 ac-font">
                                    {statusData.status === 'preparing' ? 'Preparing Items on Island' : 'Queued in Order Bot'}
                                </h3>
                                <p className="small text-muted mb-4">
                                    {statusData.status === 'preparing'
                                        ? 'Your order is currently being placed on the island ground. Dodo code arriving shortly!'
                                        : 'ChoBot has submitted your order. Please wait while the Switch prepares your island.'}
                                </p>

                                {/* Queue Cards */}
                                <div className="row g-3 mb-4">
                                    <div className="col-6">
                                        <div className="card rounded-4 border p-3 shadow-sm">
                                            <span className="tiny-text fw-bold text-muted text-uppercase d-block mb-1">Queue Position</span>
                                            <span className="h3 fw-black text-dark mb-0 ac-font">
                                                {statusData.status === 'preparing' ? 'Up Next' : `#${statusData.queuePosition ?? 1}`}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="col-6">
                                        <div className="card rounded-4 border p-3 shadow-sm">
                                            <span className="tiny-text fw-bold text-muted text-uppercase d-block mb-1">Est. Wait</span>
                                            <span className="h3 fw-black text-primary mb-0 ac-font">
                                                {statusData.eta || `~${statusData.estimatedMinutes ?? 2}m`}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="d-flex align-items-center justify-content-center gap-2 text-muted small">
                                    <span className="spinner-grow spinner-grow-sm text-success" role="status" />
                                    <span>
                                        {statusData.status === 'preparing'
                                            ? 'Dropping items on island...'
                                            : 'Waiting in queue for next slot...'}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="modal-footer border-0 px-4 py-3 d-flex justify-content-end">
                        <button type="button" className="btn btn-outline-secondary rounded-pill px-4 fw-bold btn-sm" onClick={onClose}>
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
