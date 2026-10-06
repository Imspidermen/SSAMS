import { describe, expect, it } from 'vitest';
import { ApiError, describeApiError, describeApiErrorTitle, isApiError } from './apiError';

/**
 * Every HTTP status the backend can return must map to copy a user can act on -
 * this is the contract the error states across the app depend on.
 */
describe('apiError mapping', () => {
  it('identifies ApiError instances', () => {
    const error = new ApiError({ message: 'Nope', status: 404, code: 'NOT_FOUND' });
    expect(isApiError(error)).toBe(true);
    expect(isApiError(new Error('plain'))).toBe(false);
    expect(isApiError(null)).toBe(false);
  });

  it('exposes status helpers', () => {
    expect(new ApiError({ message: '', status: 401, code: 'UNAUTHORIZED' }).isUnauthorized).toBe(
      true,
    );
    expect(new ApiError({ message: '', status: 403, code: 'FORBIDDEN' }).isForbidden).toBe(true);
    expect(new ApiError({ message: '', status: 404, code: 'NOT_FOUND' }).isNotFound).toBe(true);
    expect(new ApiError({ message: '', status: 500, code: 'X' }).isServerError).toBe(true);
    expect(new ApiError({ message: '', status: 0, code: 'NETWORK_ERROR' }).isNetworkError).toBe(
      true,
    );
  });

  it('flattens Zod 422 details into per-field errors', () => {
    // The backend returns `error.flatten()` from Zod: arrays of messages per field.
    const error = new ApiError({
      message: 'Validation failed',
      status: 422,
      code: 'VALIDATION_ERROR',
      details: {
        formErrors: [],
        fieldErrors: {
          email: ['Enter a valid email address'],
          semester: ['Semester must be between 1 and 12', 'Second message'],
        },
      },
    });

    expect(error.fieldErrors.email).toBe('Enter a valid email address');
    // Only the first message per field is surfaced, matching React Hook Form.
    expect(error.fieldErrors.semester).toBe('Semester must be between 1 and 12');
  });

  it('ignores details that are not Zod output', () => {
    const error = new ApiError({
      message: 'Validation failed',
      status: 422,
      code: 'VALIDATION_ERROR',
      details: { distanceMeters: 420 },
    });
    expect(error.fieldErrors).toEqual({});
  });

  it('describes each status with actionable copy', () => {
    const cases: Array<[number, string, RegExp]> = [
      [400, 'BAD_REQUEST', /request/i],
      [401, 'UNAUTHORIZED', /sign in|session/i],
      [403, 'FORBIDDEN', /permission|not allowed|access/i],
      [404, 'NOT_FOUND', /found|exist/i],
      [409, 'ALREADY_ATTENDED', /already|conflict/i],
      [422, 'VALIDATION_ERROR', /check|invalid|valid/i],
      [429, 'TOO_MANY_ATTEMPTS', /too many|try again|wait/i],
      [500, 'INTERNAL_ERROR', /server|unexpected|try again/i],
      [0, 'NETWORK_ERROR', /connection|network|offline/i],
    ];

    for (const [status, code, pattern] of cases) {
      // An empty message exercises the status-appropriate fallback copy.
      const described = describeApiError(new ApiError({ message: '', status, code }));
      expect(described, `status ${status}`).toMatch(pattern);
    }
  });

  it('keeps the fixed 401 copy so session expiry is unambiguous', () => {
    const described = describeApiError(
      new ApiError({ message: 'Invalid token', status: 401, code: 'UNAUTHORIZED' }),
    );
    expect(described).toMatch(/session has expired/i);
  });

  it('prefers the backend message when it is meaningful', () => {
    const error = new ApiError({
      message: 'Account locked for 15 minutes after 5 failed attempts',
      status: 423,
      code: 'ACCOUNT_LOCKED',
    });
    expect(describeApiError(error)).toContain('Account locked');
  });

  it('gives status-appropriate titles', () => {
    expect(
      describeApiErrorTitle(new ApiError({ message: '', status: 403, code: 'FORBIDDEN' })),
    ).toBeTruthy();
    expect(describeApiErrorTitle(new Error('boom'))).toBeTruthy();
  });

  it('handles non-Error values safely', () => {
    expect(typeof describeApiError('string failure')).toBe('string');
    expect(typeof describeApiError(undefined)).toBe('string');
  });
});
