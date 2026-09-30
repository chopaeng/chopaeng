import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
    children: ReactNode;
    /** Optional custom fallback UI */
    fallback?: ReactNode;
    /** Human-readable label used in error messages */
    label?: string;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

/**
 * AppErrorBoundary — wraps any subtree and catches render-time errors.
 * Without this, a single error in any page will blank the entire app.
 *
 * Usage:
 *   <AppErrorBoundary label="OrderBot">
 *     <OrderBot />
 *   </AppErrorBoundary>
 */
export class AppErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error(`[AppErrorBoundary] ${this.props.label ?? 'Page'} crashed:`, error, info);
    }

    private handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback;

            return (
                <div
                    className="d-flex flex-column align-items-center justify-content-center text-center py-5 px-4"
                    style={{ minHeight: '50vh' }}
                    role="alert"
                >
                    <div className="mb-3 text-danger" style={{ fontSize: '3rem' }}>
                        <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />
                    </div>
                    <h2 className="h4 fw-black text-dark mb-2 ac-font">
                        Oops! Something went wrong
                    </h2>
                    <p className="text-muted fw-bold mb-4" style={{ maxWidth: 420 }}>
                        {this.props.label
                            ? `The ${this.props.label} page ran into an unexpected error.`
                            : 'This page ran into an unexpected error.'}
                        {' '}Please try refreshing, or click below to recover.
                    </p>
                    <div className="d-flex gap-2 flex-wrap justify-content-center">
                        <button
                            type="button"
                            className="btn btn-nook-primary rounded-pill fw-bold px-4"
                            onClick={this.handleReset}
                        >
                            <i className="fa-solid fa-rotate-right me-2" aria-hidden="true" />
                            Try Again
                        </button>
                        <button
                            type="button"
                            className="btn btn-outline-secondary rounded-pill fw-bold px-4"
                            onClick={() => window.location.reload()}
                        >
                            <i className="fa-solid fa-arrows-rotate me-2" aria-hidden="true" />
                            Reload Page
                        </button>
                    </div>
                    {import.meta.env.DEV && this.state.error && (
                        <details className="mt-4 text-start w-100" style={{ maxWidth: 640 }}>
                            <summary className="text-muted small fw-bold" style={{ cursor: 'pointer' }}>
                                Developer info
                            </summary>
                            <pre
                                className="mt-2 p-3 rounded-3 bg-dark text-danger small overflow-auto"
                                style={{ maxHeight: 220, fontSize: '0.72rem' }}
                            >
                                {this.state.error.stack}
                            </pre>
                        </details>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}
