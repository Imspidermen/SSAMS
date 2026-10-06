/** Non-secret UI constants. Anything configurable lives in the backend policy. */

/** Semesters offered (BCA-style 6-semester programmes, extended to 8). */
export const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

/** Common section labels. Free-text entry is also allowed in the forms. */
export const SECTIONS = ['A', 'B', 'C', 'D'] as const;

/** Academic years offered in the student form (current + adjacent years). */
export function academicYearOptions(): string[] {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  // Indian academic years start in June/July.
  const startYear = currentMonth >= 6 ? currentYear : currentYear - 1;
  return Array.from({ length: 5 }, (_, index) => {
    const from = startYear - index;
    return `${from}-${from + 1}`;
  });
}

/**
 * Placeholder used ONLY while `GET /api/admin/policy` has not resolved yet.
 * The backend policy is the source of truth for the real minimum; this value is
 * never used for filtering or flagging once the policy has loaded.
 */
export const FALLBACK_MIN_ATTENDANCE_PERCENTAGE = 75;

/** Page sizes offered by the reusable pagination control. */
export const PAGE_SIZES = [10, 20, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 20;

/** Maximum base64 frames per verification burst (backend allows 3..40). */
export const LIVENESS_FRAME_COUNT = 12;
export const BLINK_FRAME_COUNT = 14;
/** Frame capture interval for the challenge bursts. */
export const FRAME_INTERVAL_MS = 160;
/** Samples required for face enrolment (backend requires 3..10). */
export const ENROLLMENT_SAMPLE_COUNT = 4;
/** JPEG quality used when encoding camera frames (keeps payloads small). */
export const FRAME_JPEG_QUALITY = 0.72;
/** Edge length frames are downscaled to before upload. */
export const FRAME_MAX_EDGE = 480;

/** How often the teacher's live roster and session timers refresh. */
export const LIVE_ROSTER_REFETCH_MS = 5000;
export const SESSION_LIST_REFETCH_MS = 15000;
export const NOTIFICATION_POLL_MS = 60000;

/** Debounce applied to search inputs before hitting the API. */
export const SEARCH_DEBOUNCE_MS = 350;

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrator',
  TEACHER: 'Teacher',
  STUDENT: 'Student',
} as const;
