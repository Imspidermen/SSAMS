import { useMemo } from 'react';
import { useTheme } from '@/hooks/useTheme';

export interface ChartTheme {
  present: string;
  absent: string;
  late: string;
  excused: string;
  grid: string;
  axis: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  series: [string, string, string];
  primary: string;
}

function readVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/**
 * Resolves chart colours from the CSS design tokens so Recharts output follows
 * light/dark mode automatically. Re-computed whenever the theme changes.
 */
export function useChartTheme(): ChartTheme {
  const { resolvedTheme } = useTheme();

  return useMemo<ChartTheme>(() => {
    void resolvedTheme;
    return {
      present: readVar('--chart-present', '#16a34a'),
      absent: readVar('--chart-absent', '#dc2626'),
      late: readVar('--chart-late', '#f59e0b'),
      excused: readVar('--chart-excused', '#64748b'),
      grid: readVar('--chart-grid', '#e2e6ed'),
      axis: readVar('--chart-axis', '#7b879c'),
      surface: readVar('--surface', '#ffffff'),
      text: readVar('--text-primary', '#0f172a'),
      textSecondary: readVar('--text-secondary', '#52607a'),
      border: readVar('--border', '#e2e6ed'),
      primary: readVar('--chart-series-1', '#1d4ed8'),
      series: [
        readVar('--chart-series-1', '#1d4ed8'),
        readVar('--chart-series-2', '#0e7490'),
        readVar('--chart-series-3', '#7c3aed'),
      ],
    };
  }, [resolvedTheme]);
}
