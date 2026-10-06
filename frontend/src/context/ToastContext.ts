import { createContext } from 'react';

export type ToastTone = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  tone: ToastTone;
  title: string;
  message?: string;
  /** Auto-dismiss delay in ms. `0` keeps the toast until dismissed manually. */
  duration: number;
}

export interface ToastInput {
  tone?: ToastTone;
  title: string;
  message?: string;
  duration?: number;
}

export interface ToastContextValue {
  toasts: ToastItem[];
  push: (toast: ToastInput) => string;
  dismiss: (id: string) => void;
  success: (title: string, message?: string) => string;
  error: (title: string, message?: string) => string;
  warning: (title: string, message?: string) => string;
  info: (title: string, message?: string) => string;
}

export const ToastContext = createContext<ToastContextValue | null>(null);
