import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  THEME_STORAGE_KEY,
  ThemeContext,
  type ResolvedTheme,
  type ThemeContextValue,
  type ThemePreference,
} from './ThemeContext';

const VALID: ThemePreference[] = ['light', 'dark', 'system'];

function readStoredPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored && VALID.includes(stored as ThemePreference)
      ? (stored as ThemePreference)
      : 'system';
  } catch {
    // Private browsing modes can throw on localStorage access.
    return 'system';
  }
}

function systemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolve(preference: ThemePreference): ResolvedTheme {
  return preference === 'system' ? systemTheme() : preference;
}

function applyTheme(theme: ResolvedTheme): void {
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0d1117' : '#1d4ed8');
}

/**
 * Light/dark/system theming.
 *
 * Only the *preference* is persisted (a UI setting, not application data) -
 * every business record still lives in PostgreSQL. The resolved theme is
 * applied to `<html data-theme>` so all CSS variables swap atomically.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    resolve(readStoredPreference()),
  );

  useEffect(() => {
    const next = resolve(preference);
    setResolvedTheme(next);
    applyTheme(next);
  }, [preference]);

  // Follow the OS while the user has not chosen explicitly.
  useEffect(() => {
    if (preference !== 'system' || typeof window === 'undefined' || !window.matchMedia) return;
    const list = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => {
      const next: ResolvedTheme = event.matches ? 'dark' : 'light';
      setResolvedTheme(next);
      applyTheme(next);
    };
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Non-fatal: theming simply will not persist in this browser mode.
    }
  }, []);

  const toggle = useCallback(() => {
    setPreference(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, setPreference]);

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, resolvedTheme, setPreference, toggle }),
    [preference, resolvedTheme, setPreference, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
