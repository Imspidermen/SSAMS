import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Spinner } from './Spinner';
import { cn } from '@/utils/cn';

type ButtonVariant =
  'primary' | 'secondary' | 'ghost' | 'soft' | 'danger' | 'dangerOutline' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'btn--primary',
  secondary: 'btn--secondary',
  ghost: 'btn--ghost',
  soft: 'btn--soft',
  danger: 'btn--danger',
  dangerOutline: 'btn--danger-outline',
  success: 'btn--success',
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'btn--sm',
  md: '',
  lg: 'btn--lg',
};

interface BaseProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  /** Shows a spinner and disables the button - use while a mutation is pending. */
  isLoading?: boolean;
  loadingText?: string;
  className?: string;
  children?: ReactNode;
}

export interface ButtonProps
  extends BaseProps, Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof BaseProps> {
  type?: 'button' | 'submit' | 'reset';
}

/**
 * Primary button. Renders a real `<button>` (or a router `<Link>` via
 * `ButtonLink`) so keyboard and screen-reader semantics stay correct.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    block = false,
    icon,
    iconPosition = 'left',
    isLoading = false,
    loadingText,
    className,
    children,
    disabled,
    type = 'button',
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || isLoading;

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={isLoading || undefined}
      className={cn(
        'btn',
        VARIANT_CLASS[variant],
        SIZE_CLASS[size],
        block && 'btn--block',
        className,
      )}
      {...rest}
    >
      {isLoading ? (
        <Spinner size={size === 'sm' ? 14 : 16} className="btn__spinner" />
      ) : icon && iconPosition === 'left' ? (
        <span aria-hidden="true" className="btn__icon">
          {icon}
        </span>
      ) : null}
      <span>{isLoading && loadingText ? loadingText : children}</span>
      {!isLoading && icon && iconPosition === 'right' ? (
        <span aria-hidden="true" className="btn__icon">
          {icon}
        </span>
      ) : null}
    </button>
  );
});

export interface ButtonLinkProps extends BaseProps {
  to: string;
  /** Opens in a new tab with a safe `rel`. */
  external?: boolean;
  ariaLabel?: string;
}

/** Router-aware button. Used for "Go to dashboard" style navigation actions. */
export function ButtonLink({
  to,
  variant = 'primary',
  size = 'md',
  block = false,
  icon,
  iconPosition = 'left',
  className,
  children,
  external = false,
  ariaLabel,
}: ButtonLinkProps) {
  const classes = cn(
    'btn',
    VARIANT_CLASS[variant],
    SIZE_CLASS[size],
    block && 'btn--block',
    className,
  );

  const content = (
    <>
      {icon && iconPosition === 'left' ? (
        <span aria-hidden="true" className="btn__icon">
          {icon}
        </span>
      ) : null}
      <span>{children}</span>
      {icon && iconPosition === 'right' ? (
        <span aria-hidden="true" className="btn__icon">
          {icon}
        </span>
      ) : null}
    </>
  );

  if (external) {
    return (
      <a
        href={to}
        className={classes}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={ariaLabel}
      >
        {content}
      </a>
    );
  }

  return (
    <Link to={to} className={classes} aria-label={ariaLabel}>
      {content}
    </Link>
  );
}

export interface IconButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'children'
> {
  icon: ReactNode;
  /** REQUIRED: icon buttons must expose a text alternative. */
  label: string;
  variant?: 'default' | 'bordered' | 'danger';
  size?: 'sm' | 'md';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, variant = 'default', size = 'md', className, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'icon-btn',
        variant === 'bordered' && 'icon-btn--bordered',
        variant === 'danger' && 'icon-btn--danger',
        size === 'sm' && 'icon-btn--sm',
        className,
      )}
      {...rest}
    >
      <span aria-hidden="true">{icon}</span>
    </button>
  );
});
