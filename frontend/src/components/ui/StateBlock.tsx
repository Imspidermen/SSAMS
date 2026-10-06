import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, SearchX, ServerCrash, ShieldAlert } from 'lucide-react';
import { Button } from './Button';
import { describeApiError, describeApiErrorTitle, isApiError } from '@/utils/apiError';
import { cn } from '@/utils/cn';

export interface StateBlockProps {
  icon?: ReactNode;
  title: string;
  message?: ReactNode;
  actions?: ReactNode;
  /** Monospace detail line (error code / HTTP status) for support. */
  details?: string;
  tone?: 'neutral' | 'danger';
  className?: string;
  /**
   * Live-region role. Error blocks pass `alert` so assistive technology
   * announces a failure the moment a screen switches to it.
   */
  role?: 'status' | 'alert';
}

/** Shared shell for empty / error / unauthorised states. */
export function StateBlock({
  icon,
  title,
  message,
  actions,
  details,
  tone = 'neutral',
  className,
  role,
}: StateBlockProps) {
  return (
    <div className={cn('state-block', className)} role={role}>
      <div
        className={cn('state-block__icon', tone === 'danger' && 'state-block__icon--danger')}
        aria-hidden="true"
      >
        {icon ?? <Inbox size={22} />}
      </div>
      <p className="state-block__title">{title}</p>
      {message ? <div className="state-block__message">{message}</div> : null}
      {details ? <p className="state-block__details">{details}</p> : null}
      {actions ? <div className="state-block__actions">{actions}</div> : null}
    </div>
  );
}

export interface EmptyStateProps {
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** `search` shows a "no matches" icon instead of the generic inbox. */
  variant?: 'default' | 'search';
}

export function EmptyState({
  title = 'Nothing here yet',
  message,
  actionLabel,
  onAction,
  variant = 'default',
}: EmptyStateProps) {
  return (
    <StateBlock
      icon={variant === 'search' ? <SearchX size={22} /> : <Inbox size={22} />}
      title={title}
      message={message}
      actions={
        actionLabel && onAction ? (
          <Button variant="secondary" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null
      }
    />
  );
}

export interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  title?: string;
  retryLabel?: string;
  /** Extra context-specific guidance rendered under the mapped error copy. */
  hint?: ReactNode;
}

/**
 * Renders any API/network failure with actionable copy for 400/401/403/404/409/
 * 422/429/500 and offline cases, plus the error code for support.
 */
export function ErrorState({
  error,
  onRetry,
  title,
  retryLabel = 'Try again',
  hint,
}: ErrorStateProps) {
  const apiError = isApiError(error) ? error : null;

  const icon = apiError?.isForbidden ? (
    <ShieldAlert size={22} />
  ) : apiError?.isServerError || apiError?.isNetworkError ? (
    <ServerCrash size={22} />
  ) : (
    <AlertTriangle size={22} />
  );

  return (
    <StateBlock
      tone="danger"
      role="alert"
      icon={icon}
      title={title ?? describeApiErrorTitle(error)}
      message={
        hint ? (
          <>
            {describeApiError(error)}
            <p className="state-block__hint">{hint}</p>
          </>
        ) : (
          describeApiError(error)
        )
      }
      details={
        apiError
          ? `${apiError.code}${apiError.status ? ` · HTTP ${apiError.status}` : ''}`
          : undefined
      }
      actions={
        onRetry ? (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            {retryLabel}
          </Button>
        ) : null
      }
    />
  );
}

export interface UnauthorizedStateProps {
  title?: string;
  message?: string;
  action?: ReactNode;
}

export function UnauthorizedState({
  title = 'You do not have permission to access this page',
  message = 'Your role does not include access to this area. If you believe this is a mistake, contact an administrator.',
  action,
}: UnauthorizedStateProps) {
  return (
    <StateBlock
      tone="danger"
      icon={<ShieldAlert size={22} />}
      title={title}
      message={message}
      actions={action}
    />
  );
}
