import { ScanFace } from 'lucide-react';
import { appConfig } from '@/config/env';
import { cn } from '@/utils/cn';

export interface LogoProps {
  size?: number;
  className?: string;
  withWordmark?: boolean;
  /** Small uppercase role/system label under the product name. */
  sublabel?: string;
}

/** Product mark. Used on the login page, the sidebar and the boot screen. */
export function Logo({ size = 32, className, withWordmark = false, sublabel }: LogoProps) {
  const mark = (
    <span className="sidebar__logo" style={{ width: size, height: size }} aria-hidden="true">
      <ScanFace size={Math.round(size * 0.62)} strokeWidth={2.1} />
    </span>
  );

  if (!withWordmark) return mark;

  return (
    <span className={cn('row', className)} style={{ gap: 'var(--space-3)' }}>
      {mark}
      <span className="sidebar__brand-text">
        <span className="sidebar__brand-name">{appConfig.appName}</span>
        <span className="sidebar__brand-sub">{sublabel ?? 'Attendance System'}</span>
      </span>
    </span>
  );
}
