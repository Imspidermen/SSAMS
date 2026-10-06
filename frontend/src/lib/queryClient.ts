import { QueryClient } from '@tanstack/react-query';
import { isApiError } from '@/utils/apiError';

/**
 * HTTP statuses that will not succeed on a retry: bad input, auth, not found,
 * conflicts and validation errors. Everything else (429, 5xx, network) is worth
 * one automatic retry with backoff.
 */
const NON_RETRYABLE_STATUS = new Set([400, 401, 403, 404, 405, 409, 410, 422]);

function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;
  if (isApiError(error)) {
    // A rate limit or a server/network fault may clear on its own.
    if (error.status === 429 || error.status >= 500 || error.status === 0) return true;
    return !NON_RETRYABLE_STATUS.has(error.status);
  }
  return true;
}

/**
 * The single TanStack Query client for the app.
 *
 * Server state lives here - never in localStorage - so signing out (or a session
 * expiring) can wipe every private cache with `queryClient.clear()`, which
 * AuthProvider does. Cache times are deliberately modest: attendance data
 * changes during a class and must not go stale on a screen left open.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: shouldRetry,
      // Refocusing a tab during a class should show fresh attendance.
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      // Writes are never retried automatically: a duplicated POST could create
      // a second student, teacher or session.
      retry: false,
    },
  },
});
