import React from 'react';

/**
 * PageSkeleton — shared loading skeleton for full pages.
 * Use this as the Suspense fallback or data-fetching loading state.
 *
 * Usage:
 *   if (loading) return <PageSkeleton />;
 */
export const PageSkeleton: React.FC<{ rows?: number }> = ({ rows = 6 }) => (
    <div className="container py-5" aria-busy="true" aria-label="Loading page content">
        {/* Hero skeleton */}
        <div className="mb-5">
            <div className="placeholder-glow text-center">
                <span className="placeholder col-3 rounded-pill mb-3" style={{ height: 28 }} />
                <div className="placeholder col-7 rounded-3 mb-3 d-block mx-auto" style={{ height: 48 }} />
                <div className="placeholder col-5 rounded-3 d-block mx-auto" style={{ height: 20 }} />
            </div>
        </div>

        {/* Card grid skeleton */}
        <div className="row g-3">
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="col-12 col-sm-6 col-lg-4">
                    <div className="card rounded-4 border shadow-2xs p-3 bg-white">
                        <div className="placeholder-glow">
                            <span className="placeholder col-12 rounded-3 mb-3" style={{ height: 120 }} />
                            <span className="placeholder col-8 rounded-pill mb-2" />
                            <span className="placeholder col-5 rounded-pill" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    </div>
);

/**
 * SectionSkeleton — lighter skeleton for a single data-fetching section.
 * Drop-in replacement for per-section spinners.
 *
 * Usage:
 *   if (loading) return <SectionSkeleton rows={3} />;
 */
export const SectionSkeleton: React.FC<{ rows?: number; className?: string }> = ({
    rows = 3,
    className = '',
}) => (
    <div className={`placeholder-glow ${className}`} aria-busy="true" aria-label="Loading">
        {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="d-flex align-items-center gap-3 p-3 rounded-4 bg-light border mb-2">
                <span className="placeholder rounded-circle flex-shrink-0" style={{ width: 48, height: 48 }} />
                <div className="flex-grow-1">
                    <span className="placeholder col-7 rounded-pill d-block mb-2" />
                    <span className="placeholder col-4 rounded-pill d-block" />
                </div>
            </div>
        ))}
    </div>
);

/**
 * CardSkeleton — minimal single card placeholder.
 */
export const CardSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
    <div className={`card rounded-4 border shadow-2xs p-3 bg-white placeholder-glow ${className}`}>
        <span className="placeholder col-12 rounded-3 mb-3" style={{ height: 120 }} />
        <span className="placeholder col-8 rounded-pill mb-2 d-block" />
        <span className="placeholder col-5 rounded-pill d-block" />
    </div>
);
