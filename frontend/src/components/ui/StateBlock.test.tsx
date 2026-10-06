import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EmptyState, ErrorState, StateBlock } from './StateBlock';
import { ApiError } from '@/utils/apiError';

describe('ErrorState', () => {
  it.each([
    [403, 'FORBIDDEN', 'Access denied', /you do not have permission to perform this action/i],
    [404, 'NOT_FOUND', 'Not found', /the requested resource could not be found/i],
    [409, 'ALREADY_EXISTS', 'Already exists', /that action conflicts with existing data/i],
    [422, 'VALIDATION_ERROR', 'Invalid input', /some of the submitted values are invalid/i],
    [429, 'TOO_MANY_ATTEMPTS', 'Too many requests', /too many attempts\. please wait a moment/i],
    [500, 'INTERNAL_ERROR', 'Server error', /the server encountered an error/i],
    [0, 'NETWORK_ERROR', 'Connection failed', /cannot reach the server/i],
  ])('maps HTTP %s to actionable copy', (status, code, expectedTitle, expectedMessage) => {
    render(<ErrorState error={new ApiError({ message: '', status, code })} />);

    expect(screen.getByText(expectedTitle)).toBeInTheDocument();
    expect(screen.getByText(expectedMessage)).toBeInTheDocument();
    expect(screen.getByText(status ? `${code} · HTTP ${status}` : code)).toBeInTheDocument();
  });

  it('prefers the backend message when it is useful', () => {
    render(
      <ErrorState
        error={
          new ApiError({
            message: 'You are outside the classroom geofence.',
            status: 403,
            code: 'OUTSIDE_GEOFENCE',
          })
        }
      />,
    );

    expect(screen.getByText(/outside the classroom geofence/i)).toBeInTheDocument();
    expect(screen.getByText(/OUTSIDE_GEOFENCE · HTTP 403/)).toBeInTheDocument();
  });

  it('never exposes a 401 backend message and always offers to sign in again', () => {
    render(
      <ErrorState
        error={new ApiError({ message: 'Invalid token', status: 401, code: 'UNAUTHORIZED' })}
      />,
    );

    expect(screen.getByText('Session expired')).toBeInTheDocument();
    expect(screen.getByText(/your session has expired\. please log in again/i)).toBeInTheDocument();
    expect(screen.queryByText(/invalid token/i)).not.toBeInTheDocument();
  });

  it('handles a non-API failure with a neutral title and no status line', () => {
    render(<ErrorState error={new TypeError('cannot read property x of undefined')} />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    // No HTTP status or backend code exists for a client-side failure.
    expect(screen.queryByText(/HTTP \d+/)).not.toBeInTheDocument();
  });

  it('is announced to assistive technology as an alert', () => {
    render(<ErrorState error={new ApiError({ message: '', status: 500, code: 'X' })} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('calls the retry handler and renders an extra hint', () => {
    const onRetry = vi.fn();
    render(
      <ErrorState
        error={new ApiError({ message: '', status: 500, code: 'X' })}
        onRetry={onRetry}
        hint="Reports are cached for a minute."
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/cached for a minute/i)).toBeInTheDocument();
  });

  it('renders no retry button when retrying is impossible', () => {
    render(<ErrorState error={new ApiError({ message: '', status: 404, code: 'NOT_FOUND' })} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('EmptyState', () => {
  it('explains a no-results search and offers a reset', () => {
    const onAction = vi.fn();
    render(
      <EmptyState
        variant="search"
        title="No students match that search"
        message="Try a different name, code or roll number."
        actionLabel="Clear search"
        onAction={onAction}
      />,
    );

    expect(screen.getByText(/no students match that search/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /clear search/i }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('defaults to a neutral message with no action', () => {
    render(<EmptyState />);
    expect(screen.getByText(/nothing here yet/i)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('StateBlock', () => {
  it('renders title, message, details and actions together', () => {
    render(
      <StateBlock
        title="Access denied"
        message="Ask an administrator."
        details="FORBIDDEN · HTTP 403"
        tone="danger"
        actions={<button type="button">Go back</button>}
      />,
    );

    expect(screen.getByText(/access denied/i)).toBeInTheDocument();
    expect(screen.getByText(/ask an administrator/i)).toBeInTheDocument();
    expect(screen.getByText(/FORBIDDEN · HTTP 403/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument();
  });
});
