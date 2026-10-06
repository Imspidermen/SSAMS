import { useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export interface TabItem<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
  count?: number;
  disabled?: boolean;
}

export interface TabsProps<T extends string> {
  items: ReadonlyArray<TabItem<T>>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}

/**
 * ARIA tablist with roving tabindex and arrow-key navigation. Panels are
 * rendered by the caller (this keeps lazy data fetching straightforward).
 */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  className,
}: TabsProps<T>) {
  const baseId = useId();
  const listRef = useRef<HTMLDivElement>(null);

  const enabled = items.filter((item) => !item.disabled);
  const activeIndex = enabled.findIndex((item) => item.value === value);

  const move = (delta: number) => {
    if (enabled.length === 0) return;
    const nextIndex = (activeIndex + delta + enabled.length) % enabled.length;
    const next = enabled[nextIndex];
    onChange(next.value);

    const button = listRef.current?.querySelector<HTMLButtonElement>(
      `[data-tab-id="${baseId}-${next.value}"]`,
    );
    button?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        move(1);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        move(-1);
        break;
      case 'Home':
        event.preventDefault();
        if (enabled[0]) onChange(enabled[0].value);
        break;
      case 'End':
        event.preventDefault();
        if (enabled.length > 0) onChange(enabled[enabled.length - 1].value);
        break;
      default:
        break;
    }
  };

  return (
    <div
      className={cn('tabs', className)}
      role="tablist"
      aria-label={ariaLabel}
      ref={listRef}
      onKeyDown={onKeyDown}
    >
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            id={`${baseId}-${item.value}`}
            data-tab-id={`${baseId}-${item.value}`}
            aria-selected={selected}
            aria-controls={`${baseId}-panel-${item.value}`}
            tabIndex={selected ? 0 : -1}
            disabled={item.disabled}
            className="tab"
            onClick={() => onChange(item.value)}
          >
            {item.icon ? <span aria-hidden="true">{item.icon}</span> : null}
            {item.label}
            {typeof item.count === 'number' ? (
              <span className="tab__count">{item.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export interface TabPanelProps {
  active: boolean;
  id: string;
  children: ReactNode;
}

export function TabPanel({ active, id, children }: TabPanelProps) {
  if (!active) return null;
  return (
    <div role="tabpanel" id={id} tabIndex={0}>
      {children}
    </div>
  );
}
