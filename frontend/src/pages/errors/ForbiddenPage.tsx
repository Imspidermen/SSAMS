import { ShieldAlert } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { homePathFor } from '@/routes/paths';
import { ROLE_LABELS } from '@/utils/constants';
import type { Role } from '@/types';

export interface ForbiddenPageProps {
  /** Roles that are allowed on the attempted route (used in the explanation). */
  requiredRoles?: Role[];
}

/**
 * 403 for an authenticated user who reached another role's area.
 *
 * Frontend route guards are UX only - the backend re-checks the JWT role on
 * every request, so a hand-edited URL never exposes data.
 */
export function ForbiddenPage({ requiredRoles }: ForbiddenPageProps) {
  const { role, user } = useAuth();
  const destination = homePathFor(role);

  const required = requiredRoles?.length
    ? requiredRoles.map((entry) => ROLE_LABELS[entry] ?? entry).join(' or ')
    : null;

  return (
    <div className="full-state">
      <div className="card full-state__card">
        <div className="card__body stack stack-5">
          <div className="stack stack-3" style={{ alignItems: 'center' }}>
            <span className="state-block__icon state-block__icon--danger" aria-hidden="true">
              <ShieldAlert size={22} />
            </span>
            <h1 className="page-title">You do not have permission to access this page</h1>
            <p className="text-body">
              {required
                ? `This area is restricted to ${required} accounts.`
                : 'This area is restricted to specific roles.'}{' '}
              You are signed in{user?.name ? ` as ${user.name}` : ''}
              {role ? ` (${ROLE_LABELS[role] ?? role})` : ''}. If you believe you should have
              access, contact your administrator.
            </p>
          </div>

          <div className="row" style={{ justifyContent: 'center' }}>
            <ButtonLink to={destination}>Back to my dashboard</ButtonLink>
          </div>
        </div>
      </div>
    </div>
  );
}
