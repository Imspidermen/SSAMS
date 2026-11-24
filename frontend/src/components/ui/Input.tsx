import { forwardRef } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  leadingIcon?: ReactNode;
  trailing?: ReactNode;
}

/** Text/number/email/password/date input. Forwards its ref for RHF register(). */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid = false, leadingIcon, trailing, className, ...rest },
  ref,
) {
  const describedBy = rest['aria-describedby'];

  const input = (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        'input',
        leadingIcon && 'input--with-icon-left',
        trailing && 'input--with-icon-right',
        className,
      )}
      {...rest}
      aria-describedby={describedBy}
    />
  );

  if (!leadingIcon && !trailing) return input;

  return (
    <div className="field__control">
      {leadingIcon ? (
        <span className="field__leading-icon" aria-hidden="true">
          {leadingIcon}
        </span>
      ) : null}
      {input}
      {trailing ? <span className="field__trailing">{trailing}</span> : null}
    </div>
  );
});
