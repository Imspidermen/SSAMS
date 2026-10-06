import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { IconButton } from './Button';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { cn } from '@/utils/cn';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Hide the default close button (e.g. blocking confirmations). */
  hideClose?: boolean;
  /** Disable backdrop/Escape dismissal for destructive confirmations. */
  dismissible?: boolean;
  labelledBy?: string;
}

const SIZE_CLASS: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'modal--sm',
  md: '',
  lg: 'modal--lg',
  xl: 'modal--xl',
};

/**
 * Accessible dialog: focus trapped, Escape to dismiss, background scroll
 * locked, focus restored to the trigger on close, `aria-modal` + labelled by
 * its own title. Rendered through a portal so nested stacking contexts cannot
 * clip it.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  hideClose = false,
  dismissible = true,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useBodyScrollLock(open);
  useFocusTrap(dialogRef, open);

  useEffect(() => {
    if (!open || !dismissible) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, dismissible, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (dismissible && event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={cn('modal', SIZE_CLASS[size])}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        <div className="modal__header">
          <div>
            <h2 className="modal__title" id={titleId}>
              {title}
            </h2>
            {description ? (
              <p className="modal__description" id={descriptionId}>
                {description}
              </p>
            ) : null}
          </div>
          {!hideClose ? (
            <IconButton
              className="modal__close"
              icon={<X size={18} />}
              label="Close dialog"
              onClick={onClose}
            />
          ) : null}
        </div>

        {children ? <div className="modal__body">{children}</div> : null}
        {footer ? <div className="modal__footer">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
