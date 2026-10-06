import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, LogIn, Mail, ShieldCheck } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button, IconButton } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { Logo } from '@/components/common/Logo';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { loginSchema, type LoginFormValues } from '@/validators/auth.schema';
import { homePathFor } from '@/routes/paths';
import { describeApiError, isApiError } from '@/utils/apiError';
import { appConfig } from '@/config/env';
import type { RedirectState } from '@/routes/ProtectedRoute';

/**
 * Sign-in screen.
 *
 * The backend deliberately returns the same "Invalid email or password" message
 * (code INVALID_CREDENTIALS) whether or not the account exists, so this UI never
 * reveals account existence. Lockout and deactivation messages are surfaced
 * verbatim because the backend sends them explicitly.
 */
export function LoginPage() {
  const {
    login,
    user,
    isAuthenticated,
    isInitialising,
    sessionExpiredReason,
    clearSessionExpiredReason,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const redirectState = location.state as RedirectState | null;
  const intendedPath = redirectState?.from;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onBlur',
  });

  // An already-authenticated user must never see the login form.
  useEffect(() => {
    if (isAuthenticated && user) {
      clearSessionExpiredReason();
      navigate(intendedPath ?? homePathFor(user.role), { replace: true });
    }
  }, [isAuthenticated, user, intendedPath, navigate, clearSessionExpiredReason]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const signedIn = await login({ email: values.email.trim(), password: values.password });
      toast.success(`Welcome back, ${signedIn.name.split(' ')[0]}`, 'You are signed in.');
      clearSessionExpiredReason();
      navigate(intendedPath ?? homePathFor(signedIn.role), { replace: true });
    } catch (error) {
      // Surface backend field-level validation (422) next to the inputs.
      if (isApiError(error) && Object.keys(error.fieldErrors).length > 0) {
        for (const [field, message] of Object.entries(error.fieldErrors)) {
          if (field === 'email' || field === 'password') {
            setError(field, { type: 'server', message });
          }
        }
        setFormError(describeApiError(error));
        return;
      }
      setFormError(describeApiError(error));
    }
  });

  return (
    <div className="auth-page">
      <aside className="auth-aside" aria-hidden="true">
        <div className="row" style={{ gap: 'var(--space-3)' }}>
          <Logo size={40} withWordmark sublabel="Student Attendance System" />
        </div>

        <h2 className="auth-aside__title">Attendance you can actually verify.</h2>
        <p className="auth-aside__text">
          A geofenced, face-verified attendance pipeline for colleges — with live sessions for
          teachers, audited corrections, and honest percentages for students.
        </p>

        <div className="auth-aside__list">
          <span className="auth-aside__item">
            <span className="auth-aside__icon">
              <ShieldCheck size={15} />
            </span>
            Multi-factor verification: location, face match, liveness and blink
          </span>
          <span className="auth-aside__item">
            <span className="auth-aside__icon">
              <Lock size={15} />
            </span>
            Role-scoped dashboards for administrators, teachers and students
          </span>
          <span className="auth-aside__item">
            <span className="auth-aside__icon">
              <ShieldCheck size={15} />
            </span>
            Low-attendance warnings driven by configurable institutional policy
          </span>
        </div>
      </aside>

      <main className="auth-main">
        <div className="auth-topbar no-print">
          <ThemeToggle />
        </div>

        <div className="auth-card">
          <div className="auth-card__brand">
            <Logo size={48} />
            <div className="stack stack-1">
              <h1 className="auth-card__title">{appConfig.appName}</h1>
              <p className="auth-card__subtitle">Manage attendance smarter. Sign in to continue.</p>
            </div>
          </div>

          <div className="stack stack-3">
            {sessionExpiredReason ? (
              <Alert tone="warning" title="Session ended">
                {sessionExpiredReason}
              </Alert>
            ) : null}

            {formError ? (
              <Alert tone="error" title="Unable to sign in">
                {formError}
              </Alert>
            ) : null}

            {isInitialising ? <Alert tone="info">Restoring your session…</Alert> : null}
          </div>

          <form className="auth-card__form" onSubmit={onSubmit} noValidate>
            <Field label="Email" htmlFor="login-email" error={errors.email?.message} required>
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="you@college.edu"
                leadingIcon={<Mail size={16} />}
                invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'login-email-error' : undefined}
                {...register('email')}
              />
            </Field>

            <Field
              label="Password"
              htmlFor="login-password"
              error={errors.password?.message}
              required
            >
              <Input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Enter your password"
                leadingIcon={<Lock size={16} />}
                invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? 'login-password-error' : undefined}
                trailing={
                  <IconButton
                    size="sm"
                    type="button"
                    icon={showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((value) => !value)}
                  />
                }
                {...register('password')}
              />
            </Field>

            <Button
              type="submit"
              size="lg"
              block
              isLoading={isSubmitting}
              loadingText="Signing in…"
              icon={<LogIn size={17} />}
            >
              Login
            </Button>
          </form>

          <div className="auth-card__footer">
            <ShieldCheck size={14} aria-hidden="true" />
            <span>Secure attendance management · Sessions expire automatically</span>
          </div>
        </div>
      </main>
    </div>
  );
}
