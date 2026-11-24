/**
 * Display formatting. All functions are defensive: the UI must never render
 * "NaN", "Invalid Date" or "undefined" for missing backend data.
 */

const DASH = '\u2014';

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return DASH;
  return new Intl.NumberFormat('en-IN').format(value);
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return DASH;
  return `${value.toFixed(digits)}%`;
}

export function formatDate(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return DASH;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatTime(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return DASH;
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return DASH;
  return `${formatDate(date)}, ${formatTime(date)}`;
}

/** "Today", "Yesterday" or a short date - used in history tables. */
export function formatRelativeDay(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return DASH;

  const today = startOfToday();
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.round((today - target) / 86_400_000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays === -1) return 'Tomorrow';
  return formatDate(date);
}

/** Compact "3h ago" / "2d ago" for notifications and audit logs. */
export function formatTimeAgo(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return DASH;

  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 45) return 'just now';

  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['minute', 60],
    ['hour', 3600],
    ['day', 86_400],
    ['week', 604_800],
    ['month', 2_592_000],
    ['year', 31_536_000],
  ];

  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  let chosen: [Intl.RelativeTimeFormatUnit, number] = ['year', 31_536_000];
  for (const unit of units) {
    if (Math.abs(seconds) < unit[1]) {
      chosen = unit;
      break;
    }
    chosen = unit;
  }
  return formatter.format(-Math.round(seconds / chosen[1]), chosen[0]);
}

export function formatDuration(startTime: string | Date, endTime: string | Date): string {
  const start = toDate(startTime);
  const end = toDate(endTime);
  if (!start || !end) return DASH;
  const minutes = Math.round((end.getTime() - start.getTime()) / 60_000);
  if (minutes <= 0) return 'Ended';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}

/** Counts down to a target instant; returns a negative number once elapsed. */
export function formatCountdown(target: string | Date | null | undefined): string {
  const date = toDate(target);
  if (!date) return DASH;
  const remainingMs = date.getTime() - Date.now();
  if (remainingMs <= 0) return 'Expired';

  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function formatDistance(meters: number | null | undefined): string {
  if (meters === null || meters === undefined || Number.isNaN(meters)) return DASH;
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

export function formatScore(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return DASH;
  return value.toFixed(2);
}

/** "Dr. Ritu Sharma" -> "RS"; "aarav" -> "A". Deterministic initials avatar. */
export function getInitials(name: string | null | undefined, fallback = '?'): string {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return fallback;

  const parts = trimmed
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter((part) => /[a-z0-9]/i.test(part));
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/** Sentence-cases backend enum values: "NOT_ENROLLED" -> "Not enrolled". */
export function humaniseEnum(value: string | null | undefined): string {
  if (!value) return DASH;
  return value
    .toLowerCase()
    .split('_')
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ');
}

export function pluralise(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural ?? `${singular}s`);
}

/** `value` clamped to 0..100 for progress bars and gauges. */
export function clampPercent(value: number | null | undefined): number {
  if (value === null || value === undefined || Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

/* ------------------------------- internals ------------------------------- */

function toDate(value: string | Date | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfToday(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

export { DASH as EM_DASH };
