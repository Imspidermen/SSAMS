import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { ProgressRow } from '@/components/ui/Progress';
import { attendanceTone, isBelowThreshold } from '@/utils/attendance';
import { formatPercent } from '@/utils/format';
import { cn } from '@/utils/cn';

export interface AttendanceIndicatorProps {
  percentage: number;
  /** From the backend policy - never hard-coded. */
  threshold: number;
  showBar?: boolean;
  compact?: boolean;
  className?: string;
}

/**
 * Percentage + threshold warning. When a student is below the configured
 * minimum the UI states the requirement explicitly ("Minimum required: 75%")
 * instead of relying on colour alone.
 */
export function AttendanceIndicator({
  percentage,
  threshold,
  showBar = false,
  compact = false,
  className,
}: AttendanceIndicatorProps) {
  const tone = attendanceTone(percentage, threshold);
  const below = isBelowThreshold(percentage, threshold);

  if (showBar) {
    return (
      <div className={cn('stack stack-2', className)}>
        <ProgressRow value={percentage} tone={tone} />
        {below ? (
          <p className="field__error" style={{ color: 'var(--warning-strong)' }}>
            <AlertTriangle size={13} aria-hidden="true" />
            <span>Low attendance · minimum required {formatPercent(threshold, 0)}</span>
          </p>
        ) : null}
      </div>
    );
  }

  if (compact) {
    return (
      <span className={cn('row', className)} style={{ gap: 'var(--space-2)' }}>
        <strong style={{ color: `var(--${tone === 'primary' ? 'primary' : tone})` }}>
          {formatPercent(percentage)}
        </strong>
        {below ? (
          <Badge tone="warning" title={`Below the ${formatPercent(threshold, 0)} minimum`}>
            <AlertTriangle size={12} aria-hidden="true" />
            Low
          </Badge>
        ) : null}
      </span>
    );
  }

  return (
    <Badge tone={below ? 'warning' : 'success'} className={className}>
      {below ? (
        <AlertTriangle size={12} aria-hidden="true" />
      ) : (
        <CheckCircle2 size={12} aria-hidden="true" />
      )}
      {formatPercent(percentage)}
      <span className="sr-only">
        {below
          ? ` - below the required ${formatPercent(threshold, 0)}`
          : ' - meets the requirement'}
      </span>
    </Badge>
  );
}
