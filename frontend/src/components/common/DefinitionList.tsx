import type { ReactNode } from 'react';
import { EM_DASH } from '@/utils/format';
import { cn } from '@/utils/cn';

export interface DefinitionItem {
  term: string;
  value: ReactNode;
  /** Spans both columns (used for long values on wide layouts). */
  mono?: boolean;
}

export interface DefinitionListProps {
  items: DefinitionItem[];
  stacked?: boolean;
  className?: string;
}

/** Label/value grid for profile and detail panels. Empty values render an em dash. */
export function DefinitionList({ items, stacked = false, className }: DefinitionListProps) {
  return (
    <dl className={cn('dl', stacked && 'dl--stacked', className)}>
      {items.map((item) => (
        <div key={item.term} className="dl__row" style={{ display: 'contents' }}>
          <dt className="dl__term">{item.term}</dt>
          <dd className={cn('dl__value', item.mono && 'text-mono')}>
            {item.value === null || item.value === undefined || item.value === ''
              ? EM_DASH
              : item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
