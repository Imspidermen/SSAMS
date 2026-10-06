/** Date helpers for filters, `<input type="date">` values and report ranges. */

/** Local-date -> `YYYY-MM-DD` (never UTC-shifted, unlike `toISOString`). */
export function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayInputValue(): string {
  return toDateInputValue(new Date());
}

/** Parses `YYYY-MM-DD` as a LOCAL date so range filters behave as expected. */
export function fromDateInputValue(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Start-of-day ISO string, inclusive lower bound for a date-range filter. */
export function toStartOfDayIso(value: string): string | undefined {
  const date = fromDateInputValue(value);
  if (!date) return undefined;
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

/** End-of-day ISO string, inclusive upper bound for a date-range filter. */
export function toEndOfDayIso(value: string): string | undefined {
  const date = fromDateInputValue(value);
  if (!date) return undefined;
  date.setHours(23, 59, 59, 999);
  return date.toISOString();
}

export function daysAgoInputValue(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return toDateInputValue(date);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Weekday labels for chart axes: "Mon", "Tue", ... */
export function weekdayLabel(date: string | Date): string {
  const parsed = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(parsed);
}
