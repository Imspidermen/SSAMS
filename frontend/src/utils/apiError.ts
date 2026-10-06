import type { ApiErrorBody, ZodFlattenedError } from '@/types';

/** Normalised client-side representation of any API failure. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;
  /** Per-field messages extracted from a 422 VALIDATION_ERROR response. */
  readonly fieldErrors: Record<string, string>;

  constructor(options: { message: string; status: number; code: string; details?: unknown }) {
    super(options.message);
    this.name = 'ApiError';
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
    this.fieldErrors = extractFieldErrors(options.details);
  }

  get isNetworkError(): boolean {
    return this.code === 'NETWORK_ERROR';
  }

  get isTimeout(): boolean {
    return this.code === 'TIMEOUT';
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isConflict(): boolean {
    return this.status === 409;
  }

  get isRateLimited(): boolean {
    return this.status === 429;
  }

  get isServerError(): boolean {
    return this.status >= 500;
  }
}

function isZodFlattened(value: unknown): value is ZodFlattenedError {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return Array.isArray(candidate.formErrors) && typeof candidate.fieldErrors === 'object';
}

function extractFieldErrors(details: unknown): Record<string, string> {
  if (!isZodFlattened(details)) return {};
  const result: Record<string, string> = {};
  for (const [field, messages] of Object.entries(details.fieldErrors)) {
    if (messages && messages.length > 0) result[field] = messages[0];
  }
  return result;
}

/** Type guard usable inside TanStack Query `onError` handlers and components. */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function getApiErrorCode(error: unknown): string {
  return isApiError(error) ? error.code : 'UNKNOWN';
}

/**
 * Human readable, actionable copy for every error class the UI can hit.
 * The backend message is preferred when it is specific (it knows the domain);
 * otherwise we fall back to a status-appropriate explanation.
 */
export function describeApiError(error: unknown): string {
  if (isApiError(error)) {
    if (error.isNetworkError) {
      return 'Cannot reach the server. Check your internet connection and try again.';
    }
    if (error.isTimeout) {
      return 'The server took too long to respond. Please try again.';
    }
    switch (error.status) {
      case 400:
        return error.message || 'The request was rejected. Please check the submitted values.';
      case 401:
        return 'Your session has expired. Please log in again.';
      case 403:
        return error.message || 'You do not have permission to perform this action.';
      case 404:
        return error.message || 'The requested resource could not be found.';
      case 409:
        return error.message || 'That action conflicts with existing data.';
      case 410:
        return error.message || 'This operation is no longer available. Please start again.';
      case 422:
        return error.message || 'Some of the submitted values are invalid.';
      case 429:
        return error.message || 'Too many attempts. Please wait a moment and try again.';
      default:
        if (error.isServerError) {
          return 'The server encountered an error. Please try again in a moment.';
        }
        return error.message || 'Something went wrong. Please try again.';
    }
  }

  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong. Please try again.';
}

/** Short title to pair with `describeApiError` in toasts and error states. */
export function describeApiErrorTitle(error: unknown): string {
  if (!isApiError(error)) return 'Something went wrong';
  switch (error.status) {
    case 401:
      return 'Session expired';
    case 403:
      return 'Access denied';
    case 404:
      return 'Not found';
    case 409:
      return 'Already exists';
    case 422:
      return 'Invalid input';
    case 429:
      return 'Too many requests';
    default:
      if (error.isNetworkError) return 'Connection failed';
      if (error.isServerError) return 'Server error';
      return 'Request failed';
  }
}

export type { ApiErrorBody };
