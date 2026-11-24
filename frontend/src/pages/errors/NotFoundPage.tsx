import { Compass } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { homePathFor, paths } from '@/routes/paths';

/**
 * 404. "Go to dashboard" resolves to the signed-in role's own dashboard, and to
 * the login page for visitors who are not authenticated.
 */
export function NotFoundPage() {
  const { role, isAuthenticated } = useAuth();
  const destination = isAuthenticated ? homePathFor(role) : paths.login;

  return (
    <div className="full-state">
      <div className="card full-state__card">
        <div className="card__body stack stack-5">
          <div className="stack stack-2">
            <p className="full-state__code" aria-hidden="true">
              404
            </p>
            <h1 className="page-title">Page not found</h1>
            <p className="text-body">
              The page you are looking for doesn’t exist, or it may have been moved. Check the
              address, or head back to your dashboard.
            </p>
          </div>

          <div className="row" style={{ justifyContent: 'center' }}>
            <ButtonLink to={destination} icon={<Compass size={17} />}>
              {isAuthenticated ? 'Go to dashboard' : 'Go to sign in'}
            </ButtonLink>
          </div>
        </div>
      </div>
    </div>
  );
}
