import { ServerCrash } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useHealth } from '@/hooks/queries/useHealthQuery';

/**
 * Shown when the API itself cannot be reached during app bootstrap. Reports the
 * real dependency status from GET /api/health instead of guessing.
 */
export function ServiceUnavailablePage({ onRetry }: { onRetry?: () => void }) {
  const { data, isFetching, refetch } = useHealth();

  return (
    <div className="full-state">
      <div className="card full-state__card">
        <div className="card__body stack stack-5">
          <div className="stack stack-3" style={{ alignItems: 'center' }}>
            <span className="state-block__icon state-block__icon--danger" aria-hidden="true">
              <ServerCrash size={22} />
            </span>
            <h1 className="page-title">Cannot reach the attendance server</h1>
            <p className="text-body">
              The frontend could not contact the backend API. Start the Node server (
              <code className="text-mono">npm run dev</code> in{' '}
              <code className="text-mono">backend/</code>) and make sure{' '}
              <code className="text-mono">VITE_API_URL</code> points at it.
            </p>
          </div>

          {data ? (
            <ul className="stack stack-2" style={{ textAlign: 'left' }}>
              <li className="row row--between">
                <span className="text-caption">API</span>
                <strong className="text-sm">{data.status}</strong>
              </li>
              <li className="row row--between">
                <span className="text-caption">Database</span>
                <strong className="text-sm">{data.dependencies.database}</strong>
              </li>
              <li className="row row--between">
                <span className="text-caption">AI verification service</span>
                <strong className="text-sm">{data.dependencies.aiService}</strong>
              </li>
            </ul>
          ) : null}

          <div className="row" style={{ justifyContent: 'center' }}>
            <Button
              variant="secondary"
              isLoading={isFetching}
              loadingText="Checking…"
              onClick={() => {
                void refetch();
                onRetry?.();
              }}
            >
              Check again
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
