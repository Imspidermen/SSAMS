import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/context/ThemeProvider';
import { ToastProvider } from '@/context/ToastProvider';
import { ApiError } from '@/utils/apiError';
import { createTestQueryClient } from '@/test/renderWithProviders';
import { LoginPage } from './LoginPage';
import type { AuthContextValue } from '@/context/AuthContext';
import type { AuthUser } from '@/types';

const student: AuthUser = {
  id: 'u-1',
  email: 'aarav@ssams.dev',
  role: 'STUDENT',
  name: 'Aarav Mehta',
};
const admin: AuthUser = { id: 'u-2', email: 'admin@ssams.dev', role: 'ADMIN', name: 'Site Admin' };

/** Hoisted so the vi.mock factory never touches test-module scope. */
const mocks = vi.hoisted(() => {
  const state = {
    current: {} as {
      user: unknown;
      isAuthenticated: boolean;
      isInitialising: boolean;
      sessionExpiredReason: string | null;
      login: unknown;
      clearSessionExpiredReason: unknown;
    },
  };
  return { state };
});

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mocks.state.current as unknown as AuthContextValue,
}));

const login = vi.fn();
const clearSessionExpiredReason = vi.fn();

function setAuth(overrides: Partial<typeof mocks.state.current> = {}) {
  mocks.state.current = {
    user: null,
    isAuthenticated: false,
    isInitialising: false,
    sessionExpiredReason: null,
    login,
    clearSessionExpiredReason,
    ...overrides,
  };
}

function renderLogin(initialEntry = '/login', state?: { from?: string }) {
  const queryClient = createTestQueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <MemoryRouter initialEntries={[{ pathname: initialEntry, state }]}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/student" element={<p>student dashboard</p>} />
              <Route path="/admin" element={<p>admin dashboard</p>} />
              <Route path="/admin/students" element={<p>students list</p>} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  login.mockReset();
  clearSessionExpiredReason.mockReset();
  setAuth();
});

describe('LoginPage', () => {
  it('renders labelled email and password fields', () => {
    renderLogin();
    expect(screen.getByLabelText(/^email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login|signing in/i })).toBeInTheDocument();
  });

  it('blocks an empty submit with inline validation and no API call', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByRole('button', { name: /login|signing in/i }));

    expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
    expect(await screen.findByText(/password is required/i)).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('rejects an invalid email format before calling the API', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText(/^email/i), 'not-an-email');
    await user.type(screen.getByLabelText(/^password/i), 'DevPass#2026');
    await user.click(screen.getByRole('button', { name: /login|signing in/i }));

    expect(await screen.findByText(/enter a valid email address/i)).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('signs in a student and routes to the student dashboard', async () => {
    login.mockResolvedValue(student);
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText(/^email/i), 'aarav@ssams.dev');
    await user.type(screen.getByLabelText(/^password/i), 'DevPass#2026');
    await user.click(screen.getByRole('button', { name: /login|signing in/i }));

    expect(await screen.findByText('student dashboard')).toBeInTheDocument();
    expect(login).toHaveBeenCalledWith({ email: 'aarav@ssams.dev', password: 'DevPass#2026' });
  });

  it('sends an admin to the admin dashboard', async () => {
    login.mockResolvedValue(admin);
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText(/^email/i), 'admin@ssams.dev');
    await user.type(screen.getByLabelText(/^password/i), 'DevPass#2026');
    await user.click(screen.getByRole('button', { name: /login|signing in/i }));

    expect(await screen.findByText('admin dashboard')).toBeInTheDocument();
  });

  it('returns the user to the page they were bounced from', async () => {
    login.mockResolvedValue(admin);
    const user = userEvent.setup();
    renderLogin('/login', { from: '/admin/students' });

    await user.type(screen.getByLabelText(/^email/i), 'admin@ssams.dev');
    await user.type(screen.getByLabelText(/^password/i), 'DevPass#2026');
    await user.click(screen.getByRole('button', { name: /login|signing in/i }));

    expect(await screen.findByText('students list')).toBeInTheDocument();
  });

  it('shows the backend message when credentials are rejected', async () => {
    login.mockRejectedValue(
      new ApiError({
        message: 'Invalid email or password',
        status: 401,
        code: 'INVALID_CREDENTIALS',
      }),
    );
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText(/^email/i), 'aarav@ssams.dev');
    await user.type(screen.getByLabelText(/^password/i), 'wrong-password');
    await user.click(screen.getByRole('button', { name: /login|signing in/i }));

    expect(await screen.findByText(/unable to sign in/i)).toBeInTheDocument();
    expect(screen.queryByText('student dashboard')).not.toBeInTheDocument();
  });

  it('surfaces a lockout message from the backend', async () => {
    login.mockRejectedValue(
      new ApiError({
        message: 'Account locked for 15 minutes after 5 failed attempts',
        status: 423,
        code: 'ACCOUNT_LOCKED',
      }),
    );
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText(/^email/i), 'aarav@ssams.dev');
    await user.type(screen.getByLabelText(/^password/i), 'wrong-password');
    await user.click(screen.getByRole('button', { name: /login|signing in/i }));

    expect(await screen.findByText(/account locked for 15 minutes/i)).toBeInTheDocument();
  });

  it('maps 422 field errors onto the matching inputs', async () => {
    login.mockRejectedValue(
      new ApiError({
        message: 'Validation failed',
        status: 422,
        code: 'VALIDATION_ERROR',
        details: { formErrors: [], fieldErrors: { email: ['That email address is not valid'] } },
      }),
    );
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText(/^email/i), 'aarav@ssams.dev');
    await user.type(screen.getByLabelText(/^password/i), 'DevPass#2026');
    await user.click(screen.getByRole('button', { name: /login|signing in/i }));

    expect(await screen.findByText(/that email address is not valid/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^email/i)).toHaveAttribute('aria-invalid', 'true');
  });

  it('tells the user when the previous session expired', () => {
    setAuth({ sessionExpiredReason: 'Your session has expired. Please log in again.' });
    renderLogin();
    expect(screen.getByText(/session ended/i)).toBeInTheDocument();
    expect(screen.getByText(/your session has expired/i)).toBeInTheDocument();
  });

  it('never shows the form to an already signed-in user', async () => {
    setAuth({ user: student, isAuthenticated: true });
    renderLogin();
    expect(await screen.findByText('student dashboard')).toBeInTheDocument();
    expect(clearSessionExpiredReason).toHaveBeenCalled();
  });

  it('shows a restoring-session notice while bootstrapping', () => {
    setAuth({ isInitialising: true });
    renderLogin();
    expect(screen.getByText(/restoring your session/i)).toBeInTheDocument();
  });

  it('disables the submit button while signing in', async () => {
    let resolveLogin: (value: AuthUser) => void = () => undefined;
    login.mockImplementation(
      () =>
        new Promise<AuthUser>((resolve) => {
          resolveLogin = resolve;
        }),
    );
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText(/^email/i), 'aarav@ssams.dev');
    await user.type(screen.getByLabelText(/^password/i), 'DevPass#2026');
    await user.click(screen.getByRole('button', { name: /login|signing in/i }));

    await waitFor(() => {
      const button = screen.getByRole('button', { name: /signing in|login/i });
      expect(button).toBeDisabled();
    });

    resolveLogin(student);
    expect(await screen.findByText('student dashboard')).toBeInTheDocument();
  });
});
