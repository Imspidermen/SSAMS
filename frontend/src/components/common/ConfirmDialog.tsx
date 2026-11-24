import { AlertTriangle } from 'lucide-react';
import type { ReactNode } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary' | 'warning';
  /** Disables the confirm button and shows a spinner while pending. */
  isPending?: boolean;
  pendingLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Extra content, e.g. the record being deleted. */
  children?: ReactNode;
}

/**
 * Reusable confirmation for destructive or consequential actions (deactivate a
 * student, stop a live session, reset a face profile). Browser `alert()` and
 * `confirm()` are never used in this product.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  isPending = false,
  pendingLabel,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  const variant = tone === 'danger' ? 'danger' : tone === 'warning' ? 'secondary' : 'primary';

  return (
    <Modal
      open={open}
      onClose={isPending ? () => undefined : onCancel}
      title={title}
      size="sm"
      dismissible={!isPending}
      hideClose={isPending}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={isPending}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant}
            onClick={onConfirm}
            isLoading={isPending}
            loadingText={pendingLabel ?? confirmLabel}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="stack stack-3">
        <div className="row" style={{ gap: 'var(--space-3)', alignItems: 'flex-start' }}>
          <span
            className="state-block__icon state-block__icon--danger"
            style={{ width: '2.25rem', height: '2.25rem' }}
            aria-hidden="true"
          >
            <AlertTriangle size={18} />
          </span>
          <div className="text-body" style={{ color: 'var(--text-secondary)' }}>
            {message}
          </div>
        </div>
        {children}
      </div>
    </Modal>
  );
}
