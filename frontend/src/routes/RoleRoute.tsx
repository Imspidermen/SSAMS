import { Navigate, useLocation } from 'react-router-dom';
import type { ReactElement, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { Role } from '@/types';
import { paths } from './paths';
import { BootScreen } from '@/components/common/BootScreen';
import { ForbiddenPage } from '@/pages/errors/ForbiddenPage';

interface RoleRouteProps {
  roles: Role[];
  children: ReactNode;
}

/**
 * Restricts a subtree to specific roles.
 *
 * An authenticated user who lands on another role's area sees an explicit 403
 * screen with a way back to their own dashboard, rather than being silently
 * redirected (which hides mistakes and can loop). Unauthenticated visitors are
 * sent to /login with a return path.
 */
export function RoleRoute({ roles, children }: RoleRouteProps): ReactElement {
  const { isAuthenticated, isInitialising, role } = useAuth();
  const location = useLocation();

  if (isInitialising) return <BootScreen />;

  if (!isAuthenticated) {
    return (
      <Navigate
        to={paths.login}
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  if (!role || !roles.includes(role)) {
    return <ForbiddenPage requiredRoles={roles} />;
  }

  return <>{children}</>;
}
