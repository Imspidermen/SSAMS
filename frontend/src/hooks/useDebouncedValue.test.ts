import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDebouncedValue } from './useDebouncedValue';

describe('useDebouncedValue', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the first value immediately so nothing renders blank', () => {
    const { result } = renderHook(() => useDebouncedValue('seed', 300));
    expect(result.current).toBe('seed');
  });

  it('waits for the delay before publishing a change', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: 'a' },
    });

    rerender({ value: 'ab' });
    expect(result.current).toBe('a');

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current).toBe('a');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe('ab');
  });

  it('collapses rapid typing into the final value only', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: '' },
    });

    for (const keystroke of ['s', 'st', 'stu', 'stud']) {
      rerender({ value: keystroke });
      act(() => {
        vi.advanceTimersByTime(100);
      });
    }

    // Only 400ms total elapsed since the first keystroke, and every keystroke
    // restarted the timer, so nothing has been published yet.
    expect(result.current).toBe('');

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe('stud');
  });
});
