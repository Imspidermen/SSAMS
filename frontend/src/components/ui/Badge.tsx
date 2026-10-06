import type { ReactNode } from 'react';
import type { Tone } from '@/utils/attendance';
import { cn } from '@/utils/cn';

const TONE_CLASS: Record<Tone, string> = {
  success: 'badge--success',
  danger: 'badge--danger',
  warning: 'badge--warning',
  info: 'badge--info',
  neutral: 'badge--neutral',
  primary: 'badge--primary',
};

export interface BadgeProps {
  tone?: Tone;
  children: ReactNode;
  /** Renders a leading colour dot. Purely decorative - the label carries meaning. */
  dot?: boolean;
  icon?: ReactNode;
  size?: 'sm' | 'lg';
  className?: string;
  title?: string;
}

/** Status pill. Always pairs a colour with a text label (WCAG 1.4.1). */
export function Badge({
  tone = 'neutral',
  children,
  dot = false,
  icon,
  size = 'sm',
  className,
  title,
}: BadgeProps) {
  return (
    <span
      className={cn('badge', TONE_CLASS[tone], size === 'lg' && 'badge--lg', className)}
      title={title}
    >
      {dot ? <span className="badge__dot" aria-hidden="true" /> : null}
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      {children}
    </span>
  );
}
