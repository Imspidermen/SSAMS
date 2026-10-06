import { useEffect, useState } from 'react';

/**
 * Subscribes to a CSS media query. Used to swap tables for card lists on
 * phones and to open the sidebar as a drawer below the desktop breakpoint.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const list = window.matchMedia(query);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);

    setMatches(list.matches);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

export const BREAKPOINTS = {
  /** Below this the sidebar becomes a drawer and tables become cards. */
  mobile: '(max-width: 767px)',
  /** Below this the desktop sidebar is hidden. */
  tablet: '(max-width: 1023px)',
  desktop: '(min-width: 1024px)',
} as const;

export function useIsMobile(): boolean {
  return useMediaQuery(BREAKPOINTS.mobile);
}

export function useIsCompact(): boolean {
  return useMediaQuery(BREAKPOINTS.tablet);
}
