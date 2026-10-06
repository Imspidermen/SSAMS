import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { useChangePassword } from '@/hooks/queries/useStudentQueries';
import { useToast } from '@/hooks/useToast';
import { changePasswordSchema, type ChangePasswordFormValues } from '@/validators/auth.schema';
import { describeApiError } from '@/utils/apiError';

/**
 * Change-password form (all roles) backed by POST /auth/change-password.
 *
 * The backend requires the current password, so this is a real credential
 * change rather than a reset flow. On success the form clears and the session
 * keeps working (the backend rotates nothing here, cookies stay valid).
 */
export function ChangePasswordForm() {
  const toast = useToast();
  const changePassword = useChangePassword();
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
    mode: 'onBlur',
  });

  const toggle = (field: string) =>
    setRevealed((current) => ({ ...current, [field]: !current[field] }));

  const onSubmit = async (values: ChangePasswordFormValues) => {
    setServerError(null);
    try {
      await changePassword.mutateAsync({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      reset();
      toast.success('Password changed', 'Use your new password the next time you sign in.');
    } catch (error) {
      const message = describeApiError(error);
      setServerError(message);
      toast.error('Password not changed', message);
    }
  };

  return (
    <form
      className="stack stack-4"
      noValidate
      onSubmit={handleSubmit((values) => void onSubmit(values))}
    >
      {serverError ? (
        <Alert tone="error" title="Could not change your password">
          {serverError}
        </Alert>
      ) : null}

      <Alert tone="neutral" title="Requirements">
        At least 8 characters, including a letter and a number. You must know your current password.
      </Alert>

      <div className="form-grid">
        <div className="form-grid__full">
          <Field
            label="Current password"
            htmlFor="current-password"
            error={errors.currentPassword?.message}
            required
          >
            <div className="input-group">
              <Input
                id="current-password"
                type={revealed.currentPassword ? 'text' : 'password'}
                autoComplete="current-password"
                invalid={Boolean(errors.currentPassword)}
                disabled={changePassword.isPending}
                {...register('currentPassword')}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={
                  revealed.currentPassword ? 'Hide current password' : 'Show current password'
                }
                aria-pressed={Boolean(revealed.currentPassword)}
                icon={revealed.currentPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                onClick={() => toggle('currentPassword')}
                disabled={changePassword.isPending}
              />
            </div>
          </Field>
        </div>

        <Field
          label="New password"
          htmlFor="new-password"
          error={errors.newPassword?.message}
          required
        >
          <div className="input-group">
            <Input
              id="new-password"
              type={revealed.newPassword ? 'text' : 'password'}
              autoComplete="new-password"
              invalid={Boolean(errors.newPassword)}
              disabled={changePassword.isPending}
              {...register('newPassword')}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={revealed.newPassword ? 'Hide new password' : 'Show new password'}
              aria-pressed={Boolean(revealed.newPassword)}
              icon={revealed.newPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              onClick={() => toggle('newPassword')}
              disabled={changePassword.isPending}
            />
          </div>
        </Field>

        <Field
          label="Confirm new password"
          htmlFor="confirm-password"
          error={errors.confirmPassword?.message}
          required
        >
          <Input
            id="confirm-password"
            type={revealed.confirmPassword ? 'text' : 'password'}
            autoComplete="new-password"
            invalid={Boolean(errors.confirmPassword)}
            disabled={changePassword.isPending}
            {...register('confirmPassword')}
          />
        </Field>
      </div>

      <div className="form-actions">
        <Button
          type="button"
          variant="ghost"
          onClick={() => reset()}
          disabled={!isDirty || changePassword.isPending}
        >
          Clear
        </Button>
        <Button
          type="submit"
          icon={<KeyRound size={16} />}
          isLoading={changePassword.isPending}
          loadingText="Updating password…"
          disabled={!isDirty}
        >
          Change password
        </Button>
      </div>
    </form>
  );
}
