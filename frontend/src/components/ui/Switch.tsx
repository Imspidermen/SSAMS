import type { Tone } from '@/utils/attendance';
import { cn } from '@/utils/cn';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  description?: string;
}

/** Accessible checkbox with a visible label. */
export function Checkbox({ label, description, className, id, ...rest }: CheckboxProps) {
  return (
    <label className={cn('choice', className)} htmlFor={id}>
      <input type="checkbox" id={id} {...rest} />
      <span>
        {label}
        {description ? <span className="field__hint">{description}</span> : null}
      </span>
    </label>
  );
}

export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  description?: string;
}

/** Toggle switch - a styled checkbox, so it stays keyboard/screen-reader safe. */
export function Switch({ label, description, className, id, ...rest }: SwitchProps) {
  return (
    <label className={cn('switch', className)} htmlFor={id}>
      <input type="checkbox" id={id} {...rest} />
      <span className="switch__track" aria-hidden="true">
        <span className="switch__thumb" />
      </span>
      <span className="switch__label">
        {label}
        {description ? <span className="field__hint">{description}</span> : null}
      </span>
    </label>
  );
}

export interface SegmentedProps<T extends string> {
  value: T;
  options: ReadonlyArray<{ value: T; label: string; icon?: React.ReactNode; tone?: Tone }>;
  onChange: (value: T) => void;
  name: string;
  disabled?: boolean;
  block?: boolean;
  size?: 'sm' | 'md';
  ariaLabel?: string;
}

/**
 * Segmented toggle (e.g. Present / Absent / Late). Implemented as a group of
 * `aria-pressed` buttons so the selected state is announced, not just coloured.
 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  name,
  disabled = false,
  block = false,
  size = 'md',
  ariaLabel,
}: SegmentedProps<T>) {
  const toneClass: Record<Tone, string> = {
    success: 'segmented__option--success',
    danger: 'segmented__option--danger',
    warning: 'segmented__option--warning',
    info: '',
    neutral: '',
    primary: '',
  };

  return (
    <div
      className={cn('segmented', block && 'segmented--block')}
      role="group"
      aria-label={ariaLabel ?? name}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            name={name}
            disabled={disabled}
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'segmented__option',
              size === 'sm' && 'segmented__option--sm',
              option.tone ? toneClass[option.tone] : undefined,
            )}
          >
            {option.icon ? <span aria-hidden="true">{option.icon}</span> : null}
            {option.label}
            {selected ? <span className="sr-only"> (selected)</span> : null}
          </button>
        );
      })}
    </div>
  );
}
