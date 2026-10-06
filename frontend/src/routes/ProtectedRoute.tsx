import { Navigate, useLocation } from 'react-router-dom';
import type { ReactElement, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { paths } from './paths';
import { BootScreen } from '@/components/common/BootScreen';

interface ProtectedRouteProps {
  children: ReactNode;
}

export interface RedirectState {
  /** Where the user was trying to go before being bounced to /login. */
  from?: string;
  reason?: string;
}

/**
 * Blocks unauthenticated access.
 *
 * While the session bootstrap is in flight a branded boot screen is shown -
 * never a flash of the login page for a user who is already signed in. The
 * attempted location is forwarded so login can return the user to it.
 *
 * NOTE: this is UX only. The real authorisation boundary is the backend, which
 * re-checks the JWT role on every request.
 */
export function ProtectedRoute({ children }: ProtectedRouteProps): ReactElement {
  const { isAuthenticated, isInitialising, role } = useAuth();
  const location = useLocation();

  if (isInitialising) return <BootScreen />;

  if (!isAuthenticated) {
    const state: RedirectState = { from: `${location.pathname}${location.search}` };
    return <Navigate to={paths.login} state={state} replace />;
  }

  // Authenticated but no role-specific home (should not happen) -> login.
  if (!role) return <Navigate to={paths.login} replace />;

  return <>{children}</>;
}
