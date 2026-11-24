import { Logo } from './Logo';
import { Spinner } from '@/components/ui/Spinner';

/**
 * Shown while the session bootstrap resolves. Deliberately not a blank screen
 * and not a flash of the login form for already-signed-in users.
 */
export function BootScreen() {
  return (
    <div className="full-state">
      <div className="full-state__card stack stack-5" style={{ alignItems: 'center' }}>
        <Logo size={48} />
        <div className="stack stack-2" style={{ alignItems: 'center' }}>
          <p className="section-title">Restoring your session</p>
          <p className="text-caption">Verifying your credentials with the server…</p>
        </div>
        <span role="status" aria-live="polite" className="row" style={{ gap: 'var(--space-2)' }}>
          <Spinner size={18} />
          <span className="text-caption">Loading</span>
        </span>
      </div>
    </div>
  );
}
