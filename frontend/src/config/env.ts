/**
 * Typed access to the public build-time environment.
 *
 * IMPORTANT: every `VITE_*` variable is inlined into the browser bundle and is
 * therefore PUBLIC. Only non-secret configuration belongs here - never
 * database credentials, JWT signing secrets or any other backend secret.
 */

const raw = import.meta.env;

function normaliseBaseUrl(value: string | undefined): string {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return '/api';
  // Relative paths are left untouched so the Vite proxy (dev) or a reverse
  // proxy (production) keeps auth cookies first-party.
  if (trimmed.startsWith('/')) return trimmed.replace(/\/+$/, '');
  return trimmed.replace(/\/+$/, '');
}

export const appConfig = {
  /** Base URL of the backend REST API. */
  apiUrl: normaliseBaseUrl(raw.VITE_API_URL),
  /** Product name shown on the login page, sidebar and document title. */
  appName: (raw.VITE_APP_NAME ?? 'Smart Attendance').trim() || 'Smart Attendance',
  isDev: Boolean(raw.DEV),
  mode: raw.MODE,
} as const;

/** Request timeout for ordinary API calls (ms). */
export const API_TIMEOUT_MS = 20_000;

/**
 * Longer timeout for the biometric pipeline: face frames are uploaded as
 * base64 and forwarded by the backend to the CV microservice.
 */
export const VERIFICATION_TIMEOUT_MS = 60_000;
