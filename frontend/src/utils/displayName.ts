/**
 * Fallback display name derived from an email address.
 *
 * GET /auth/me returns only `{ id, role, email }` (it echoes the JWT payload),
 * while /auth/login and /auth/refresh return the real full name resolved from
 * the Student/Teacher/Admin tables. If a session is restored from the access
 * cookie alone - without a usable refresh token - we have no name, so the UI
 * falls back to a readable form of the email rather than inventing one.
 */
export function deriveDisplayName(email: string | null | undefined): string {
  if (!email) return 'User';
  const local = email.split('@')[0] ?? '';
  if (!local) return 'User';

  return local
    .split(/[._\-+]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
