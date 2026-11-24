import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { AuthContext, type AuthContextValue, type AuthStatus } from './AuthContext';
import * as authService from '@/services/auth.service';
import { clearTokens, onSessionExpired, setTokens } from '@/services/api';
import type { AuthUser, LoginRequest } from '@/types';
import { deriveDisplayName } from '@/utils/displayName';

/**
 * Owns the authenticated session.
 *
 * Bootstrapping prefers POST /auth/refresh because it is the only endpoint that
 * returns the user's real display name together with fresh tokens. If the
 * refresh cookie is unusable we fall back to GET /auth/me (which validates the
 * httpOnly access cookie) so a user with a still-valid access token is not
 * logged out spuriously.
 *
 * No tokens are written to localStorage: the access token lives in memory and
 * the refresh token stays in an httpOnly cookie owned by the backend.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [sessionExpiredReason, setSessionExpiredReason] = useState<string | null>(null);
  const bootstrapped = useRef(false);

  const resetClientState = useCallback(() => {
    clearTokens();
    // Wipes every cached private query (students, attendance, notifications…).
    queryClient.clear();
  }, [queryClient]);

  const bootstrap = useCallback(async () => {
    try {
      const session = await authService.refreshSession();
      setUser(session.user);
      setStatus('authenticated');
      return;
    } catch {
      // Fall through to the access-cookie probe.
    }

    try {
      const sessionUser = await authService.getCurrentUser();
      setUser({
        id: sessionUser.id,
        email: sessionUser.email,
        role: sessionUser.role,
        name: deriveDisplayName(sessionUser.email),
      });
      setStatus('authenticated');
    } catch {
      resetClientState();
      setUser(null);
      setStatus('unauthenticated');
    }
  }, [resetClientState]);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    void bootstrap();
  }, [bootstrap]);

  // A failed silent refresh means the session is truly over: clear everything
  // so ProtectedRoute bounces to /login and no private cache survives.
  useEffect(() => {
    return onSessionExpired((reason) => {
      resetClientState();
      setUser(null);
      setStatus('unauthenticated');
      setSessionExpiredReason(reason);
    });
  }, [resetClientState]);

  const login = useCallback(async (credentials: LoginRequest) => {
    const session = await authService.login(credentials);
    setUser(session.user);
    setStatus('authenticated');
    setSessionExpiredReason(null);
    return session.user;
  }, []);

  const logout = useCallback(
    async (options?: { redirect?: boolean; reason?: string }) => {
      try {
        await authService.logout();
      } catch {
        // The backend call is best-effort; local state must always be cleared.
      } finally {
        resetClientState();
        setUser(null);
        setStatus('unauthenticated');
        if (options?.reason) setSessionExpiredReason(options.reason);
      }
    },
    [resetClientState],
  );

  const refreshUser = useCallback(async () => {
    try {
      const session = await authService.refreshSession();
      setTokens({ accessToken: session.accessToken, csrfToken: session.csrfToken });
      setUser(session.user);
      setStatus('authenticated');
    } catch {
      const sessionUser = await authService.getCurrentUser();
      setUser({
        id: sessionUser.id,
        email: sessionUser.email,
        role: sessionUser.role,
        name: deriveDisplayName(sessionUser.email),
      });
      setStatus('authenticated');
    }
  }, []);

  const patchUser = useCallback((patch: Partial<AuthUser>) => {
    setUser((current) => (current ? { ...current, ...patch } : current));
  }, []);

  const clearSessionExpiredReason = useCallback(() => setSessionExpiredReason(null), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      role: user?.role ?? null,
      isAuthenticated: status === 'authenticated' && user !== null,
      isInitialising: status === 'loading',
      login,
      logout,
      refreshUser,
      patchUser,
      sessionExpiredReason,
      clearSessionExpiredReason,
    }),
    [
      user,
      status,
      login,
      logout,
      refreshUser,
      patchUser,
      sessionExpiredReason,
      clearSessionExpiredReason,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
