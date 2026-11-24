import { Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';

interface SpinnerProps {
  size?: number;
  className?: string;
  label?: string;
}

/** Accessible loading indicator. `label` is exposed to screen readers. */
export function Spinner({ size = 16, className, label }: SpinnerProps) {
  return (
    <>
      <Loader2
        aria-hidden="true"
        className={cn('spinner', className)}
        style={{ width: size, height: size }}
      />
      {label ? <span className="sr-only">{label}</span> : null}
    </>
  );
}
