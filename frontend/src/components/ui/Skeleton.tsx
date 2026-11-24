import { cn } from '@/utils/cn';

export interface SkeletonProps {
  className?: string;
  width?: number | string;
  height?: number | string;
  variant?: 'text' | 'title' | 'circle' | 'rect';
}

export function Skeleton({ className, width, height, variant = 'text' }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={cn('skeleton', variant !== 'text' && `skeleton--${variant}`, className)}
      style={{ width, height }}
    />
  );
}

/** Placeholder block shown while a page's first query resolves. */
export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="card">
      <div className="card__header">
        <Skeleton variant="title" />
      </div>
      <div className="card__body stack stack-3" role="status" aria-label="Loading content">
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton key={index} width={`${85 - index * 9}%`} />
        ))}
        <span className="sr-only">Loading…</span>
      </div>
    </div>
  );
}

/** Placeholder KPI tiles for dashboards. */
export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-stats" role="status" aria-label="Loading statistics">
      {Array.from({ length: count }, (_, index) => (
        <div className="stat" key={index}>
          <Skeleton variant="circle" width="2.5rem" height="2.5rem" />
          <div className="stack stack-2" style={{ flex: 1 }}>
            <Skeleton width="55%" />
            <Skeleton variant="title" width="40%" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading statistics…</span>
    </div>
  );
}

/** Placeholder rows for a data table. */
export function SkeletonTableRows({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <tbody>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <tr key={rowIndex}>
          {Array.from({ length: columns }, (_, colIndex) => (
            <td key={colIndex}>
              <Skeleton width={colIndex === 0 ? '70%' : '45%'} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}
