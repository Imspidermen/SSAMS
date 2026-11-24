import { useEffect, useState } from 'react';

/**
 * Delays propagation of a rapidly-changing value (search boxes) so a query is
 * not fired on every keystroke. Always returns the first value immediately to
 * avoid a blank initial render.
 */
export function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
