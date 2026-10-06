import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/context/ThemeProvider';
import { ToastProvider } from '@/context/ToastProvider';
import { createTestQueryClient } from '@/test/renderWithProviders';
import { homePathFor } from './paths';
import { AppRoutes } from './AppRoutes';
import type { AuthContextValue } from '@/context/AuthContext';
import type { AuthUser, NotificationList } from '@/types';

const mocks = vi.hoisted(() => ({
  state: { current: {} as Record<string, unknown> },
  notifications: { current: { items: [], unreadCount: 0 } as unknown },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mocks.state.current as unknown as AuthContextValue,
}));

// The notification feed is polled by the topbar bell; stub it so route tests
// never touch the network.
// The login page probes GET /health on mount; keep the router test offline.
vi.mock('@/services/health.service', () => ({
  getHealth: () =>
    Promise.resolve({ status: 'ok', dependencies: { database: 'ok', aiService: 'ok' } }),
}));

vi.mock('@/services/notification.service', () => ({
  listNotifications: () => Promise.resolve(mocks.notifications.current as NotificationList),
  markNotificationRead: () => Promise.resolve({ message: 'ok' }),
  markAllNotificationsRead: () => Promise.resolve({ message: 'ok' }),
}));

const users: Record<string, AuthUser> = {
  admin: { id: 'u-admin', email: 'admin@ssams.dev', role: 'ADMIN', name: 'Site Admin' },
  teacher: {
    id: 'u-teacher',
    email: 'teacher@ssams.dev',
    role: 'TEACHER',
    name: 'Dr. Ritu Sharma',
  },
  student: { id: 'u-student', email: 'aarav@ssams.dev', role: 'STUDENT', name: 'Aarav Mehta' },
};

function signInAs(who: keyof typeof users | null) {
  const user = who ? users[who] : null;
  mocks.state.current = {
    user,
    status: user ? 'authenticated' : 'unauthenticated',
    role: user?.role ?? null,
    isAuthenticated: Boolean(user),
    isInitialising: false,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
    patchUser: vi.fn(),
    sessionExpiredReason: null,
    clearSessionExpiredReason: vi.fn(),
  };
}

/** Renders the full route table at a path, exactly as the app does in a browser. */
function renderRoute(path: string) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <MemoryRouter initialEntries={[path]}>
            <AppRoutes />
          </MemoryRouter>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  signInAs(null);
  mocks.notifications.current = { items: [], unreadCount: 0 };
});

describe('route guards', () => {
  it('sends an unauthenticated visitor to the login form', async () => {
    renderRoute('/admin/students');
    expect(await screen.findByRole('button', { name: /login|signing in/i })).toBeInTheDocument();
    expect(screen.queryByText(/^Students$/)).not.toBeInTheDocument();
  });

  it('blocks a student from the admin portal with an explicit 403', async () => {
    signInAs('student');
    renderRoute('/admin/students');

    expect(
      await screen.findByRole('heading', { name: /you do not have permission/i }),
    ).toBeInTheDocument();
  });

  it('blocks a teacher from the student portal', async () => {
    signInAs('teacher');
    renderRoute('/student/attendance');

    expect(
      await screen.findByRole('heading', { name: /you do not have permission/i }),
    ).toBeInTheDocument();
  });

  it('blocks an admin from the teacher portal', async () => {
    signInAs('admin');
    renderRoute('/teacher/attendance');

    expect(
      await screen.findByRole('heading', { name: /you do not have permission/i }),
    ).toBeInTheDocument();
  });

  it('renders a protected admin screen for an admin', async () => {
    signInAs('admin');
    renderRoute('/admin/profile');

    expect(await screen.findByRole('heading', { name: /my profile/i })).toBeInTheDocument();
    expect(screen.getByText(/administrator account/i)).toBeInTheDocument();
  });

  it('renders a protected student screen for a student', async () => {
    signInAs('student');
    mocks.notifications.current = { items: [], unreadCount: 0 };
    renderRoute('/notifications');

    expect(await screen.findByRole('heading', { name: /notifications/i })).toBeInTheDocument();
    expect(await screen.findByText(/no notifications yet/i)).toBeInTheDocument();
  });

  it('shows the 404 page for an unknown address', async () => {
    signInAs('admin');
    renderRoute('/admin/does-not-exist');

    expect(await screen.findByRole('heading', { name: /page not found/i })).toBeInTheDocument();
  });
});

describe('homePathFor', () => {
  it('maps every role to its own landing page', () => {
    expect(homePathFor('ADMIN')).toBe('/admin');
    expect(homePathFor('TEACHER')).toBe('/teacher');
    expect(homePathFor('STUDENT')).toBe('/student');
    expect(homePathFor(null)).toBe('/login');
  });
});
