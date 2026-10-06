import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import type { Tone } from '@/utils/attendance';
import { cn } from '@/utils/cn';

const TONE_CLASS: Record<Tone, string> = {
  primary: '',
  success: 'stat__icon--success',
  danger: 'stat__icon--danger',
  warning: 'stat__icon--warning',
  info: 'stat__icon--info',
  neutral: 'stat__icon--neutral',
};

export interface StatCardProps {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  tone?: Tone;
  meta?: ReactNode;
  /** Makes the whole card a link to a related screen. */
  to?: string;
  isLoading?: boolean;
  /** Accessible description of the value, e.g. "12 percent". */
  valueLabel?: string;
}

/** Dashboard KPI tile. Values always come from the API - never hard-coded. */
export function StatCard({
  label,
  value,
  icon,
  tone = 'primary',
  meta,
  to,
  isLoading = false,
  valueLabel,
}: StatCardProps) {
  const content = (
    <>
      <span className={cn('stat__icon', TONE_CLASS[tone])} aria-hidden="true">
        {icon}
      </span>
      <span className="stat__content">
        <span className="stat__label">{label}</span>
        {isLoading ? (
          <Skeleton variant="title" width="3.5rem" />
        ) : (
          <span className="stat__value" aria-label={valueLabel}>
            {value}
          </span>
        )}
        {meta ? <span className="stat__meta">{meta}</span> : null}
      </span>
      {to ? <ChevronRight className="stat__link" size={16} aria-hidden="true" /> : null}
    </>
  );

  if (to) {
    return (
      <Link to={to} className="stat" aria-label={`${label}: ${valueLabel ?? ''} - view details`}>
        {content}
      </Link>
    );
  }

  return <div className="stat">{content}</div>;
}
