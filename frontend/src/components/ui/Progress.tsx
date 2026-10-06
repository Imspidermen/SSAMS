import type { Tone } from '@/utils/attendance';
import { clampPercent } from '@/utils/format';
import { cn } from '@/utils/cn';

const TONE_CLASS: Partial<Record<Tone, string>> = {
  success: 'progress__bar--success',
  warning: 'progress__bar--warning',
  danger: 'progress__bar--danger',
};

export interface ProgressProps {
  value: number;
  tone?: Tone;
  size?: 'sm' | 'md' | 'lg';
  /** Shows the numeric value beside the bar. */
  label?: string;
  striped?: boolean;
  className?: string;
}

/** Linear progress bar. `label` is always rendered - never colour alone. */
export function Progress({
  value,
  tone = 'primary',
  size = 'md',
  label,
  striped = false,
  className,
}: ProgressProps) {
  const clamped = clampPercent(value);

  return (
    <div className={className}>
      {label ? (
        <div className="row row--between" style={{ marginBottom: 'var(--space-1)' }}>
          <span className="text-caption">{label}</span>
          <strong className="text-sm">{clamped.toFixed(1)}%</strong>
        </div>
      ) : null}
      <div
        className={cn('progress', size === 'sm' && 'progress--sm', size === 'lg' && 'progress--lg')}
        role="progressbar"
        aria-valuenow={Number(clamped.toFixed(1))}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Progress'}
      >
        <div
          className={cn('progress__bar', TONE_CLASS[tone], striped && 'progress__bar--striped')}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

export interface ProgressRowProps {
  value: number;
  tone?: Tone;
  className?: string;
}

/** Bar + right-aligned percentage, used inside table cells. */
export function ProgressRow({ value, tone = 'primary', className }: ProgressRowProps) {
  const clamped = clampPercent(value);
  return (
    <div className={cn('progress-row', className)}>
      <div
        className="progress progress--sm"
        style={{ flex: 1 }}
        role="progressbar"
        aria-valuenow={Number(clamped.toFixed(1))}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Attendance percentage"
      >
        <div className={cn('progress__bar', TONE_CLASS[tone])} style={{ width: `${clamped}%` }} />
      </div>
      <span className="progress-row__value">{clamped.toFixed(1)}%</span>
    </div>
  );
}

export interface GaugeProps {
  value: number;
  tone?: Tone;
  size?: number;
  strokeWidth?: number;
  caption?: string;
  /** Overrides the centre text (defaults to the percentage). */
  valueLabel?: string;
}

const TONE_STROKE: Record<Tone, string> = {
  success: 'var(--success)',
  warning: 'var(--warning)',
  danger: 'var(--danger)',
  info: 'var(--info)',
  neutral: 'var(--text-muted)',
  primary: 'var(--primary)',
};

/** Circular percentage gauge - the student dashboard headline metric. */
export function Gauge({
  value,
  tone = 'primary',
  size = 168,
  strokeWidth = 12,
  caption = 'Overall attendance',
  valueLabel,
}: GaugeProps) {
  const clamped = clampPercent(value);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  return (
    <div
      className="gauge"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${caption}: ${clamped.toFixed(1)} percent`}
    >
      <svg width={size} height={size} aria-hidden="true">
        <circle
          className="gauge__track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
        />
        <circle
          className="gauge__bar"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          stroke={TONE_STROKE[tone]}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="gauge__label">
        <span className="gauge__value" style={{ color: TONE_STROKE[tone] }}>
          {valueLabel ?? `${clamped.toFixed(1)}%`}
        </span>
        <span className="gauge__caption">{caption}</span>
      </span>
    </div>
  );
}
