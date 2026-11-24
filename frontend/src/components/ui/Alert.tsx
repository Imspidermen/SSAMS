import type { CSSProperties, ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { IconButton } from './Button';
import { cn } from '@/utils/cn';

export type AlertTone = 'success' | 'error' | 'warning' | 'info' | 'neutral';

const ICONS: Record<Exclude<AlertTone, 'neutral'>, ReactNode> = {
  success: <CheckCircle2 size={17} />,
  error: <XCircle size={17} />,
  warning: <AlertTriangle size={17} />,
  info: <Info size={17} />,
};

export interface AlertProps {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  onClose?: () => void;
  className?: string;
  icon?: ReactNode;
  style?: CSSProperties;
}

/** Persistent inline message (form-level API errors, policy notices, etc.). */
export function Alert({
  tone = 'info',
  title,
  children,
  onClose,
  className,
  icon,
  style,
}: AlertProps) {
  const resolvedIcon = icon ?? (tone === 'neutral' ? null : ICONS[tone]);

  return (
    <div
      className={cn('alert', tone !== 'neutral' && `alert--${tone}`, className)}
      style={style}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      {resolvedIcon ? (
        <span className="alert__icon" aria-hidden="true">
          {resolvedIcon}
        </span>
      ) : null}
      <div className="alert__content">
        {title ? <p className="alert__title">{title}</p> : null}
        {children ? <div>{children}</div> : null}
      </div>
      {onClose ? (
        <IconButton
          className="alert__close"
          icon={<XCircle size={16} />}
          label="Dismiss message"
          size="sm"
          onClick={onClose}
        />
      ) : null}
    </div>
  );
}
