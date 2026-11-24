import { createContext } from 'react';
import type { AuthUser, LoginRequest, Role } from '@/types';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthContextValue {
  /** The signed-in user, or null. `name` is resolved by the backend. */
  user: AuthUser | null;
  status: AuthStatus;
  role: Role | null;
  isAuthenticated: boolean;
  isInitialising: boolean;
  login: (credentials: LoginRequest) => Promise<AuthUser>;
  logout: (options?: { redirect?: boolean; reason?: string }) => Promise<void>;
  /** Re-reads the session (used after a password change). */
  refreshUser: () => Promise<void>;
  /** Merges partial user data, e.g. a display name resolved from a profile call. */
  patchUser: (patch: Partial<AuthUser>) => void;
  /** Set when the session ended without an explicit logout (expired / revoked). */
  sessionExpiredReason: string | null;
  clearSessionExpiredReason: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
