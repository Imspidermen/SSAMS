import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { homePathFor } from '@/routes/paths';
import type { Role } from '@/types';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Current role, so "Return to dashboard" goes to the right place. */
  role?: Role | null;
  /** Optional custom fallback. */
  fallback?: (args: { reset: () => void; error: Error }) => ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Last line of defence against a blank screen. Any render error in the tree
 * below shows an actionable recovery screen instead.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Reported to the console in a structured way; wire to your APM here.
    console.error('[SSAMS] Unhandled render error', error, info.componentStack);
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback({ reset: this.reset, error });

    const destination = homePathFor(this.props.role ?? null);

    return (
      <div className="full-state">
        <div className="card full-state__card">
          <div className="card__body stack stack-4" style={{ textAlign: 'center' }}>
            <div className="stack stack-2">
              <h1 className="page-title">Something went wrong</h1>
              <p className="text-body">
                An unexpected error occurred while rendering this page. Your data is safe - please
                refresh the page or return to your dashboard.
              </p>
            </div>

            <pre
              className="state-block__details"
              style={{ textAlign: 'left', whiteSpace: 'pre-wrap' }}
            >
              {error.message}
            </pre>

            <div className="row" style={{ justifyContent: 'center' }}>
              <Button variant="secondary" onClick={() => window.location.reload()}>
                Refresh page
              </Button>
              <Button
                onClick={() => {
                  this.reset();
                  window.location.assign(destination);
                }}
              >
                Return to dashboard
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
