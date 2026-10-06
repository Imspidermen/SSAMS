import { useCallback, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  ToastContext,
  type ToastContextValue,
  type ToastInput,
  type ToastItem,
  type ToastTone,
} from './ToastContext';

const DEFAULT_DURATION: Record<ToastTone, number> = {
  success: 4000,
  error: 7000,
  warning: 6000,
  info: 5000,
};

const ICONS: Record<ToastTone, ReactNode> = {
  success: <CheckCircle2 size={18} />,
  error: <XCircle size={18} />,
  warning: <AlertTriangle size={18} />,
  info: <Info size={18} />,
};

const MAX_VISIBLE = 4;

/**
 * Application-wide toast host. Mount once, near the root.
 *
 * Toasts are reserved for outcomes the user cannot otherwise see (mutation
 * results, background failures) - never for routine interactions.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [leaving, setLeaving] = useState<Set<string>>(new Set());
  const counter = useRef(0);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setLeaving((current) => new Set(current).add(id));
    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
      setLeaving((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }, 180);
  }, []);

  const push = useCallback(
    (input: ToastInput) => {
      counter.current += 1;
      const tone = input.tone ?? 'info';
      const id = `toast-${counter.current}`;
      const item: ToastItem = {
        id,
        tone,
        title: input.title,
        message: input.message,
        duration: input.duration ?? DEFAULT_DURATION[tone],
      };

      setToasts((current) => [...current.slice(-(MAX_VISIBLE - 1)), item]);

      if (item.duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), item.duration),
        );
      }
      return id;
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toasts,
      push,
      dismiss,
      success: (title, message) => push({ tone: 'success', title, message }),
      error: (title, message) => push({ tone: 'error', title, message }),
      warning: (title, message) => push({ tone: 'warning', title, message }),
      info: (title, message) => push({ tone: 'info', title, message }),
    }),
    [toasts, push, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport" role="region" aria-label="Notifications" aria-live="polite">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast toast--${toast.tone}${leaving.has(toast.id) ? ' is-leaving' : ''}`}
            role={toast.tone === 'error' ? 'alert' : 'status'}
          >
            <span className="toast__icon" aria-hidden="true">
              {ICONS[toast.tone]}
            </span>
            <div className="toast__content">
              <p className="toast__title">{toast.title}</p>
              {toast.message ? <p className="toast__message">{toast.message}</p> : null}
            </div>
            <button
              type="button"
              className="icon-btn icon-btn--sm toast__close"
              onClick={() => dismiss(toast.id)}
              aria-label={`Dismiss notification: ${toast.title}`}
            >
              <X size={15} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
