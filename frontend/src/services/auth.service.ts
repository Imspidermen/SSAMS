import type { AuthTokens, ChangePasswordRequest, LoginRequest, SessionUser } from '@/types';
import { api, clearTokens, setTokens } from './api';

/**
 * POST /auth/login - the backend sets httpOnly `access_token` / `refresh_token`
 * cookies and returns the access + CSRF tokens in the body.
 */
export async function login(credentials: LoginRequest): Promise<AuthTokens> {
  const data = await api.post<AuthTokens>('/auth/login', credentials, {
    // A failed login must not trigger the silent-refresh interceptor.
    skipAuthRefresh: true,
  });
  setTokens({ accessToken: data.accessToken, csrfToken: data.csrfToken });
  return data;
}

/** POST /auth/refresh - rotates the refresh token cookie and returns new tokens. */
export async function refreshSession(): Promise<AuthTokens> {
  const data = await api.post<AuthTokens>('/auth/refresh', {}, { skipAuthRefresh: true });
  setTokens({ accessToken: data.accessToken, csrfToken: data.csrfToken });
  return data;
}

/** GET /auth/me - lightweight session probe used to bootstrap the app. */
export async function getCurrentUser(): Promise<SessionUser> {
  const data = await api.get<{ user: SessionUser }>('/auth/me');
  return data.user;
}

/** POST /auth/logout - revokes the refresh token server-side and clears cookies. */
export async function logout(): Promise<{ message: string }> {
  try {
    return await api.post<{ message: string }>('/auth/logout');
  } finally {
    // Client state is always cleared, even if the network call fails.
    clearTokens();
  }
}

/** POST /auth/change-password */
export async function changePassword(payload: ChangePasswordRequest): Promise<{ message: string }> {
  return api.post<{ message: string }>('/auth/change-password', payload);
}
