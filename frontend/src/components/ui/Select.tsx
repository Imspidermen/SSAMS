import { forwardRef } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  'children'
> {
  invalid?: boolean;
  options: readonly SelectOption[];
  /** Placeholder option rendered first with an empty value. */
  placeholder?: string;
  className?: string;
}

/** Native `<select>` - keeps platform pickers (and mobile UX) intact. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { invalid = false, options, placeholder, className, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn('select', className)}
      {...rest}
    >
      {placeholder ? <option value="">{placeholder}</option> : null}
      {options.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </select>
  );
});

export interface SelectWithChildrenProps extends Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  'children'
> {
  invalid?: boolean;
  children: ReactNode;
}

/** Escape hatch when options need grouping (`<optgroup>`). */
export const RawSelect = forwardRef<HTMLSelectElement, SelectWithChildrenProps>(function RawSelect(
  { invalid = false, className, children, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn('select', className)}
      {...rest}
    >
      {children}
    </select>
  );
});
