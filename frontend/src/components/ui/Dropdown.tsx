import { useCallback, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useOnClickOutside } from '@/hooks/useOnClickOutside';
import { cn } from '@/utils/cn';

export interface DropdownProps {
  trigger: (props: {
    open: boolean;
    toggle: () => void;
    ref: React.Ref<HTMLButtonElement>;
    ariaExpanded: boolean;
    ariaHasPopup: true;
    id: string;
  }) => ReactNode;
  children: (props: { close: () => void }) => ReactNode;
  align?: 'left' | 'right';
  className?: string;
  menuClassName?: string;
  ariaLabel?: string;
}

/**
 * Popover menu with click-outside/Escape dismissal and `aria-expanded`
 * wiring. Items are plain buttons or links supplied by the caller.
 */
export function Dropdown({
  trigger,
  children,
  align = 'right',
  className,
  menuClassName,
  ariaLabel,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const id = useId();

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((value) => !value), []);

  useOnClickOutside(containerRef, close, open);

  return (
    <div className={cn('dropdown', className)} ref={containerRef} aria-label={ariaLabel}>
      {trigger({ open, toggle, ref: buttonRef, ariaExpanded: open, ariaHasPopup: true, id })}
      {open ? (
        <div
          className={cn(
            'dropdown__menu',
            align === 'left' && 'dropdown__menu--left',
            menuClassName,
          )}
          role="menu"
          aria-labelledby={id}
        >
          {children({ close })}
        </div>
      ) : null}
    </div>
  );
}

export interface DropdownItemProps {
  children: ReactNode;
  icon?: ReactNode;
  onSelect?: () => void;
  tone?: 'default' | 'danger';
  disabled?: boolean;
  type?: 'button' | 'submit';
}

export function DropdownItem({
  children,
  icon,
  onSelect,
  tone = 'default',
  disabled = false,
  type = 'button',
}: DropdownItemProps) {
  return (
    <button
      type={type}
      role="menuitem"
      disabled={disabled}
      onClick={onSelect}
      className={cn('dropdown__item', tone === 'danger' && 'dropdown__item--danger')}
    >
      {icon ? (
        <span className="dropdown__item-icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      {children}
    </button>
  );
}

export interface DropdownLinkProps {
  to: string;
  children: ReactNode;
  icon?: ReactNode;
  onSelect?: () => void;
  tone?: 'default' | 'danger';
}

export function DropdownLink({
  to,
  children,
  icon,
  onSelect,
  tone = 'default',
}: DropdownLinkProps) {
  return (
    <a
      href={to}
      role="menuitem"
      onClick={onSelect}
      className={cn('dropdown__item', tone === 'danger' && 'dropdown__item--danger')}
    >
      {icon ? (
        <span className="dropdown__item-icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      {children}
    </a>
  );
}

export function DropdownLabel({ children }: { children: ReactNode }) {
  return <p className="dropdown__label">{children}</p>;
}

export function DropdownSeparator() {
  return <div className="dropdown__separator" role="separator" />;
}
