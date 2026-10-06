import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SearchInput } from './SearchInput';

/** Mirrors how the list pages use the field: local filter state + server query. */
function Harness({ debounceMs = 300 }: { debounceMs?: number }) {
  const [value, setValue] = useState('');
  return (
    <div>
      <SearchInput
        value={value}
        onChange={setValue}
        debounceMs={debounceMs}
        label="Search students"
      />
      <output data-testid="query">{value}</output>
    </div>
  );
}

function queryValue() {
  return screen.getByTestId('query').textContent ?? '';
}

function input() {
  return screen.getByLabelText(/search students/i);
}

describe('SearchInput', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not push a query to the API layer on every keystroke', () => {
    vi.useFakeTimers();
    render(<Harness />);

    fireEvent.change(input(), { target: { value: 'aar' } });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(queryValue()).toBe('');

    act(() => {
      vi.advanceTimersByTime(120);
    });
    expect(queryValue()).toBe('aar');
  });

  it('applies the search immediately when Enter is pressed', () => {
    vi.useFakeTimers();
    render(<Harness />);

    fireEvent.change(input(), { target: { value: 'diya' } });
    fireEvent.keyDown(input(), { key: 'Enter' });

    expect(queryValue()).toBe('diya');
  });

  it('clears the search on Escape and hides the clear button', () => {
    vi.useFakeTimers();
    render(<Harness />);

    fireEvent.change(input(), { target: { value: 'kabir' } });
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(queryValue()).toBe('kabir');

    fireEvent.keyDown(input(), { key: 'Escape' });
    expect(queryValue()).toBe('');
    expect(screen.queryByRole('button', { name: /clear search/i })).not.toBeInTheDocument();
  });

  it('resets instantly through the clear button', () => {
    vi.useFakeTimers();
    render(<Harness />);

    fireEvent.change(input(), { target: { value: 'ritu' } });
    fireEvent.keyDown(input(), { key: 'Enter' });

    fireEvent.click(screen.getByRole('button', { name: /clear search/i }));

    expect(queryValue()).toBe('');
    expect((input() as HTMLInputElement).value).toBe('');
  });

  it('stays in sync when filters are reset from outside the field', async () => {
    vi.useFakeTimers();
    const { rerender } = render(<Harness />);

    fireEvent.change(input(), { target: { value: 'stale' } });
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(queryValue()).toBe('stale');

    // A parent "Clear all filters" action pushes an empty value down.
    rerender(<Harness key="reset" />);
    expect((input() as HTMLInputElement).value).toBe('');
  });

  it('is disabled while a request is in flight when asked to be', () => {
    render(<SearchInput value="" onChange={() => undefined} disabled label="Search students" />);
    expect(input()).toBeDisabled();
  });
});
