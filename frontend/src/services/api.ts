/**
 * Centralised HTTP client for the SSAMS REST API.
 *
 * Authentication strategy (matches `backend/src/middleware/auth.ts`):
 *
 *   1. The backend issues an httpOnly `access_token` cookie (15 min) plus an
 *      httpOnly `refresh_token` cookie scoped to `/api/auth`, and returns both
 *      tokens in the JSON body of /auth/login and /auth/refresh.
 *   2. The access token is kept IN MEMORY ONLY - never in localStorage - so it
 *      cannot be read by an XSS payload after a reload. Every request also
 *      carries cookies (`withCredentials`), which means a page reload stays
 *      authenticated purely through the httpOnly cookie.
 *   3. A 401 triggers exactly one silent `POST /auth/refresh` (single-flight,
 *      all concurrent requests wait on the same promise), then retries. If the
 *      refresh fails the session is torn down and listeners are notified so the
 *      router can bounce the user to /login.
 *   4. When the request is authenticated by cookie (no Authorization header)
 *      the backend enforces the double-submit CSRF pattern, so `X-CSRF-Token`
 *      is always sent from the JS-readable `csrf_token` cookie.
 */
import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
  type Method,
} from 'axios';
import { API_TIMEOUT_MS, appConfig } from '@/config/env';
import type { ApiErrorResponse, ApiResponse } from '@/types';
import { ApiError } from '@/utils/apiError';

/* ------------------------------------------------------------------------- */
/* In-memory token store                                                      */
/* ------------------------------------------------------------------------- */

interface TokenState {
  accessToken: string | null;
  csrfToken: string | null;
}

const tokenState: TokenState = { accessToken: null, csrfToken: null };

export function setTokens(tokens: {
  accessToken?: string | null;
  csrfToken?: string | null;
}): void {
  if (tokens.accessToken !== undefined) tokenState.accessToken = tokens.accessToken;
  if (tokens.csrfToken !== undefined) tokenState.csrfToken = tokens.csrfToken;
}

export function clearTokens(): void {
  tokenState.accessToken = null;
  tokenState.csrfToken = null;
}

export function getAccessToken(): string | null {
  return tokenState.accessToken;
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

/** CSRF token from memory, falling back to the JS-readable cookie. */
function resolveCsrfToken(): string | null {
  return tokenState.csrfToken ?? readCookie('csrf_token');
}

/* ------------------------------------------------------------------------- */
/* Session-expired broadcast                                                  */
/* ------------------------------------------------------------------------- */

type SessionExpiredListener = (reason: string) => void;
const sessionExpiredListeners = new Set<SessionExpiredListener>();

/**
 * Subscribe to hard session terminations (refresh token revoked/expired,
 * account deactivated, explicit logout from another tab is not covered).
 * Returns an unsubscribe function.
 */
export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
}

function emitSessionExpired(reason: string): void {
  sessionExpiredListeners.forEach((listener) => listener(reason));
}

/* ------------------------------------------------------------------------- */
/* Client                                                                     */
/* ------------------------------------------------------------------------- */

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retriedAfterRefresh?: boolean;
  _skipAuthRefresh?: boolean;
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: appConfig.apiUrl,
  timeout: API_TIMEOUT_MS,
  withCredentials: true,
  headers: { Accept: 'application/json' },
});

const AUTH_REFRESH_PATHS = ['/auth/login', '/auth/refresh'];

function isAuthRefreshPath(url?: string): boolean {
  if (!url) return false;
  return AUTH_REFRESH_PATHS.some((path) => url === path || url.startsWith(`${path}?`));
}

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const typed = config as RetryableConfig;
  if (tokenState.accessToken) {
    typed.headers.set('Authorization', `Bearer ${tokenState.accessToken}`);
  }
  const csrf = resolveCsrfToken();
  if (csrf) {
    typed.headers.set('X-CSRF-Token', csrf);
  }
  return typed;
});

/* ------------------------------------------------------------------------- */
/* Silent refresh (single-flight)                                             */
/* ------------------------------------------------------------------------- */

let refreshPromise: Promise<boolean> | null = null;

/**
 * Attempts to rotate the refresh token. Resolves `true` when a new access
 * token was obtained. Never throws - callers treat `false` as "logged out".
 */
export function refreshSession(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      // Bare axios call: bypasses the interceptors so a failing refresh cannot
      // recurse into another refresh attempt.
      const response = await axios.post<ApiResponse<AuthPayload>>(
        `${appConfig.apiUrl}/auth/refresh`,
        {},
        { withCredentials: true, timeout: API_TIMEOUT_MS, headers: { Accept: 'application/json' } },
      );
      const payload = response.data?.data;
      if (!payload?.accessToken) return false;
      tokenState.accessToken = payload.accessToken;
      tokenState.csrfToken = payload.csrfToken ?? tokenState.csrfToken;
      refreshListeners.forEach((listener) => listener(payload));
      return true;
    } catch {
      return false;
    } finally {
      // Clear on the next tick so queued callers share the same result.
      queueMicrotask(() => {
        refreshPromise = null;
      });
    }
  })();

  return refreshPromise;
}

export interface AuthPayload {
  user: { id: string; email: string; role: string; name: string };
  accessToken: string;
  csrfToken: string;
}

type RefreshListener = (payload: AuthPayload) => void;
const refreshListeners = new Set<RefreshListener>();

/** Lets AuthContext keep the displayed user in sync after a silent refresh. */
export function onTokenRefreshed(listener: RefreshListener): () => void {
  refreshListeners.add(listener);
  return () => {
    refreshListeners.delete(listener);
  };
}

/* ------------------------------------------------------------------------- */
/* Error normalisation                                                        */
/* ------------------------------------------------------------------------- */

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (error instanceof AxiosError) {
    const status = error.response?.status ?? 0;
    const body = error.response?.data as ApiErrorResponse | undefined;

    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return new ApiError({
        message: 'The server took too long to respond.',
        status: 408,
        code: 'TIMEOUT',
      });
    }

    if (!error.response) {
      return new ApiError({
        message: 'Unable to reach the attendance server.',
        status: 0,
        code: 'NETWORK_ERROR',
      });
    }

    const apiError = body?.error;
    return new ApiError({
      message: apiError?.message ?? `Request failed with status ${status}`,
      status,
      code: apiError?.code ?? 'HTTP_ERROR',
      details: apiError?.details,
    });
  }

  if (error instanceof Error) {
    return new ApiError({ message: error.message, status: 0, code: 'CLIENT_ERROR' });
  }

  return new ApiError({ message: 'An unexpected error occurred.', status: 0, code: 'UNKNOWN' });
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    const axiosError = error instanceof AxiosError ? error : null;
    const config = axiosError?.config as RetryableConfig | undefined;

    if (axiosError?.response?.status === 401 && config && !config._retriedAfterRefresh) {
      const url = typeof config.url === 'string' ? config.url : '';
      const skipRefresh = config._skipAuthRefresh === true || isAuthRefreshPath(url);

      if (!skipRefresh) {
        config._retriedAfterRefresh = true;
        const refreshed = await refreshSession();
        if (refreshed) {
          return apiClient.request(config);
        }
        // Refresh failed -> the session is genuinely over.
        clearTokens();
        emitSessionExpired('Your session has expired. Please log in again.');
      }
    }

    throw toApiError(error);
  },
);

/* ------------------------------------------------------------------------- */
/* Typed request helpers - unwrap `{ success, data }` for callers             */
/* ------------------------------------------------------------------------- */

async function request<T>(method: Method, url: string, options?: RequestOptions): Promise<T> {
  const config: AxiosRequestConfig = {
    method,
    url,
    timeout: options?.timeout ?? API_TIMEOUT_MS,
    signal: options?.signal,
    params: options?.params,
    ...(options?.skipAuthRefresh ? { _skipAuthRefresh: true } : {}),
  };

  if (options?.body !== undefined) config.data = options.body;
  if (options?.responseType) config.responseType = options.responseType;
  if (options?.headers) config.headers = options.headers;

  const response = await apiClient.request<ApiResponse<T>>(config);
  return response.data.data;
}

export interface RequestOptions {
  params?: Record<string, unknown>;
  body?: unknown;
  signal?: AbortSignal;
  timeout?: number;
  headers?: Record<string, string>;
  responseType?: 'json' | 'blob' | 'text';
  /** Set for /auth/login and /auth/refresh so a 401 does not self-recurse. */
  skipAuthRefresh?: boolean;
}

/** Strips `undefined` values so they are not serialised as `?key=undefined`. */
export function compactParams<T extends object>(
  params: T | undefined,
): Record<string, unknown> | undefined {
  if (!params) return undefined;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    result[key] = value;
  }
  return result;
}

export const api = {
  get: <T>(url: string, options?: RequestOptions) => request<T>('GET', url, options),
  post: <T>(url: string, body?: unknown, options?: RequestOptions) =>
    request<T>('POST', url, { ...options, body }),
  patch: <T>(url: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PATCH', url, { ...options, body }),
  put: <T>(url: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PUT', url, { ...options, body }),
  delete: <T>(url: string, options?: RequestOptions) => request<T>('DELETE', url, options),
};

/**
 * Downloads a binary/CSV response (used by the report export, which the
 * backend serves with `Content-Disposition: attachment`).
 */
export async function apiDownload(
  url: string,
  params: Record<string, unknown> | undefined,
  signal?: AbortSignal,
): Promise<Blob> {
  const response = await apiClient.request<Blob>({
    method: 'GET',
    url,
    params: compactParams(params),
    responseType: 'blob',
    signal,
    timeout: 120_000,
  });
  return response.data;
}

export { emitSessionExpired };
