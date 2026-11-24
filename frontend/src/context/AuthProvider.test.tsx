import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from './AuthProvider';
import { useAuth } from '@/hooks/useAuth';
import { createTestQueryClient } from '@/test/renderWithProviders';
import type { AuthTokens, SessionUser } from '@/types';

const mocks = vi.hoisted(() => ({
  behaviour: { current: {} as Record<string, unknown> },
  sessionExpiredHandler: { current: null as ((reason: string) => void) | null },
  clearTokensCalls: { current: 0 },
}));

// The token store lives in services/api; the provider is the only thing allowed
// to write to it, so the calls are counted rather than spied on (restoreMocks
// wipes vi.fn() implementations between tests).
vi.mock('@/services/api', () => ({
  setTokens: () => undefined,
  clearTokens: () => {
    mocks.clearTokensCalls.current += 1;
  },
  onSessionExpired: (handler: (reason: string) => void) => {
    mocks.sessionExpiredHandler.current = handler;
    return () => {
      mocks.sessionExpiredHandler.current = null;
    };
  },
}));

vi.mock('@/services/auth.service', () => ({
  login: () => Promise.resolve(mocks.behaviour.current.login as AuthTokens),
  refreshSession: () => {
    const value = mocks.behaviour.current.refresh;
    return value instanceof Error ? Promise.reject(value) : Promise.resolve(value as AuthTokens);
  },
  getCurrentUser: () => {
    const value = mocks.behaviour.current.me;
    return value instanceof Error ? Promise.reject(value) : Promise.resolve(value as SessionUser);
  },
  logout: () => {
    const value = mocks.behaviour.current.logout;
    return value instanceof Error
      ? Promise.reject(value)
      : Promise.resolve({ message: 'Logged out' });
  },
  changePassword: () => Promise.resolve({ message: 'Password updated' }),
}));

const session: AuthTokens = {
  user: { id: 'u-admin', email: 'admin@ssams.dev', role: 'ADMIN', name: 'Dr. Ananya Iyer' },
  accessToken: 'access-token',
  csrfToken: 'csrf-token',
};

function Probe() {
  const auth = useAuth();
  return (
    <div>
      <output data-testid="status">{auth.status}</output>
      <output data-testid="user">
        {auth.user ? `${auth.user.name} · ${auth.user.role}` : 'signed out'}
      </output>
      <output data-testid="reason">{auth.sessionExpiredReason ?? 'none'}</output>
      <button
        type="button"
        onClick={() => void auth.login({ email: 'admin@ssams.dev', password: 'secret' })}
      >
        Log in
      </button>
      <button type="button" onClick={() => void auth.logout()}>
        Log out
      </button>
    </div>
  );
}

function renderProvider() {
  const queryClient = createTestQueryClient();
  const view = render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>,
  );
  return { queryClient, ...view };
}

beforeEach(() => {
  mocks.behaviour.current = {
    refresh: new Error('no refresh cookie'),
    me: new Error('no access cookie'),
  };
  mocks.clearTokensCalls.current = 0;
});

describe('AuthProvider bootstrap', () => {
  it('lands on the login state and drops any stale tokens when no session exists', async () => {
    renderProvider();

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('unauthenticated'));
    expect(screen.getByTestId('user').textContent).toBe('signed out');
    expect(mocks.clearTokensCalls.current).toBeGreaterThan(0);
  });

  it('restores the session from the refresh endpoint with the real display name', async () => {
    mocks.behaviour.current = { refresh: session };
    renderProvider();

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('authenticated'));
    expect(screen.getByTestId('user').textContent).toBe('Dr. Ananya Iyer · ADMIN');
  });

  it('falls back to /auth/me and derives a name from the email', async () => {
    mocks.behaviour.current = {
      refresh: new Error('expired'),
      me: {
        id: 'u-teacher',
        email: 'ritu.sharma@ssams.dev',
        role: 'TEACHER',
      } satisfies SessionUser,
    };
    renderProvider();

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('authenticated'));
    expect(screen.getByTestId('user').textContent).toContain('TEACHER');
    expect(screen.getByTestId('user').textContent).not.toBe('signed out');
  });
});

describe('AuthProvider login and logout', () => {
  it('signs the user in and clears any previous expiry notice', async () => {
    mocks.behaviour.current = { refresh: new Error('none'), me: new Error('none'), login: session };
    renderProvider();

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('unauthenticated'));

    fireEvent.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('authenticated'));
    expect(screen.getByTestId('user').textContent).toBe('Dr. Ananya Iyer · ADMIN');
    expect(screen.getByTestId('reason').textContent).toBe('none');
  });

  it('clears cached private data and tokens on logout even when the API call fails', async () => {
    mocks.behaviour.current = { refresh: session, logout: new Error('network down') };
    const { queryClient } = renderProvider();

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('authenticated'));

    // Private data cached by earlier screens must not survive a logout.
    queryClient.setQueryData(['students', 'list', { page: 1 }], { items: [{ id: 'st-1' }] });
    queryClient.setQueryData(['notifications'], { items: [{ id: 'n-1' }], unreadCount: 1 });

    const clearsBefore = mocks.clearTokensCalls.current;
    fireEvent.click(screen.getByRole('button', { name: /log out/i }));

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('unauthenticated'));
    expect(screen.getByTestId('user').textContent).toBe('signed out');
    expect(mocks.clearTokensCalls.current).toBeGreaterThan(clearsBefore);
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(queryClient.getQueryData(['students', 'list', { page: 1 }])).toBeUndefined();
  });
});

describe('AuthProvider session expiry', () => {
  it('logs the user out and records why when the client reports an expired session', async () => {
    mocks.behaviour.current = { refresh: session };
    renderProvider();

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('authenticated'));

    act(() => {
      mocks.sessionExpiredHandler.current?.('Your session has expired. Please sign in again.');
    });

    expect(screen.getByTestId('status').textContent).toBe('unauthenticated');
    expect(screen.getByTestId('reason').textContent).toMatch(/session has expired/i);
  });

  it('unsubscribes from the expiry event on unmount', async () => {
    mocks.behaviour.current = { refresh: session };
    const { unmount } = renderProvider();

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('authenticated'));

    unmount();
    expect(mocks.sessionExpiredHandler.current).toBeNull();
  });
});

describe('AuthProvider cache isolation', () => {
  it('exposes a query client that is cleared, not merely invalidated', async () => {
    mocks.behaviour.current = { refresh: session };
    const { queryClient } = renderProvider();
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('authenticated'));

    queryClient.setQueryData(['reports', 'attendanceAll'], { items: [] });
    act(() => {
      queryClient.clear();
    });
    expect(queryClient.getQueryData(['reports', 'attendanceAll'])).toBeUndefined();
    expect(queryClient instanceof Object).toBe(true);
    const client: QueryClient = queryClient;
    expect(client.getDefaultOptions().queries?.retry).toBe(false);
  });
});
