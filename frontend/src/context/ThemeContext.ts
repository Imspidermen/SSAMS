import { createContext } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export interface ThemeContextValue {
  preference: ThemePreference;
  /** The theme actually applied to <html data-theme>. */
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
  toggle: () => void;
}

export const THEME_STORAGE_KEY = 'ssams.theme';

export const ThemeContext = createContext<ThemeContextValue | null>(null);
