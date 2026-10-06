import type { ReactNode } from 'react';

export interface LiveRegionProps {
  children: ReactNode;
  politeness?: 'polite' | 'assertive';
  className?: string;
}

/**
 * Visually hidden `aria-live` region for announcing transient state changes
 * ("Attendance saved", "3 students verified") without stealing focus.
 */
export function LiveRegion({ children, politeness = 'polite', className }: LiveRegionProps) {
  return (
    <div className={className ?? 'sr-only'} role="status" aria-live={politeness} aria-atomic="true">
      {children}
    </div>
  );
}
