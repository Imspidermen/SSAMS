import { useContext } from 'react';
import { AuthContext, type AuthContextValue } from '@/context/AuthContext';
import type { Role } from '@/types';

/** Access the authenticated session. Throws outside <AuthProvider>. */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return context;
}

/** True when the signed-in user has one of the given roles. */
export function useHasRole(...roles: Role[]): boolean {
  const { role } = useAuth();
  return role !== null && roles.includes(role);
}
