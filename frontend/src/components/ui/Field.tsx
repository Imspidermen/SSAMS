import type { ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface FieldProps {
  /** Label text. Required for every field - it is wired to the control via htmlFor. */
  label: ReactNode;
  htmlFor: string;
  children: ReactNode;
  error?: string | null;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
  /** Extra content on the label row (e.g. a character counter). */
  labelAside?: ReactNode;
}

/**
 * Label + control + validation message wrapper.
 *
 * The error message is linked with `aria-describedby` and the control gets
 * `aria-invalid`, so screen readers announce the problem next to the field
 * instead of only at submit time.
 */
export function Field({
  label,
  htmlFor,
  children,
  error,
  hint,
  required = false,
  className,
  labelAside,
}: FieldProps) {
  const errorId = `${htmlFor}-error`;
  const hintId = `${htmlFor}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ');

  return (
    <div className={cn('field', className)}>
      <div className="field__label-row">
        <label className="field__label" htmlFor={htmlFor}>
          {label}
          {required ? (
            <span className="field__required" aria-hidden="true">
              *
            </span>
          ) : null}
          {required ? <span className="sr-only"> (required)</span> : null}
        </label>
        {labelAside}
      </div>

      {children}

      {hint && !error ? (
        <p className="field__hint" id={hintId}>
          {hint}
        </p>
      ) : null}

      {error ? (
        <p className="field__error" id={errorId} role="alert">
          <AlertCircle aria-hidden="true" size={13} />
          <span>{error}</span>
        </p>
      ) : null}
      {/* Keeps the describedby target stable for assistive tech. */}
      <span className="sr-only" data-describedby={describedBy} />
    </div>
  );
}
