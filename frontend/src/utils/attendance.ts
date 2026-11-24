/**
 * Attendance presentation helpers. Status semantics live here so every screen
 * colours and labels a record identically.
 *
 * `tone` drives the CSS class; `label` is always rendered next to it because
 * colour alone must never carry meaning (WCAG 1.4.1).
 */
import type { AttendanceStatus, FaceProfileStatus, SessionStatus, StudentStatus } from '@/types';

export type Tone = 'success' | 'danger' | 'warning' | 'info' | 'neutral' | 'primary';

interface StatusMeta {
  label: string;
  tone: Tone;
}

const ATTENDANCE_STATUS: Record<AttendanceStatus, StatusMeta> = {
  PRESENT: { label: 'Present', tone: 'success' },
  ABSENT: { label: 'Absent', tone: 'danger' },
  LATE: { label: 'Late', tone: 'warning' },
  EXCUSED: { label: 'Excused', tone: 'neutral' },
};

export function attendanceStatusMeta(status: AttendanceStatus): StatusMeta {
  return ATTENDANCE_STATUS[status] ?? { label: status, tone: 'neutral' };
}

export const ATTENDANCE_STATUS_OPTIONS: AttendanceStatus[] = [
  'PRESENT',
  'ABSENT',
  'LATE',
  'EXCUSED',
];

const STUDENT_STATUS: Record<StudentStatus, StatusMeta> = {
  ACTIVE: { label: 'Active', tone: 'success' },
  INACTIVE: { label: 'Inactive', tone: 'neutral' },
  GRADUATED: { label: 'Graduated', tone: 'info' },
  SUSPENDED: { label: 'Suspended', tone: 'danger' },
};

export function studentStatusMeta(status: StudentStatus): StatusMeta {
  return STUDENT_STATUS[status] ?? { label: status, tone: 'neutral' };
}

const SESSION_STATUS: Record<SessionStatus, StatusMeta> = {
  SCHEDULED: { label: 'Scheduled', tone: 'info' },
  ACTIVE: { label: 'Live', tone: 'success' },
  ENDED: { label: 'Ended', tone: 'neutral' },
  CANCELLED: { label: 'Cancelled', tone: 'danger' },
};

export function sessionStatusMeta(status: SessionStatus): StatusMeta {
  return SESSION_STATUS[status] ?? { label: status, tone: 'neutral' };
}

const FACE_STATUS: Record<FaceProfileStatus, StatusMeta> = {
  NOT_ENROLLED: { label: 'Not enrolled', tone: 'warning' },
  PENDING: { label: 'Pending', tone: 'info' },
  ENROLLED: { label: 'Enrolled', tone: 'success' },
  RESET: { label: 'Reset - re-enrolment required', tone: 'warning' },
};

export function faceStatusMeta(status: FaceProfileStatus): StatusMeta {
  return FACE_STATUS[status] ?? { label: status, tone: 'neutral' };
}

/**
 * Tone for a percentage against the configured threshold. The threshold comes
 * from the backend policy endpoint - it is never hard-coded here.
 */
export function attendanceTone(percentage: number, threshold: number): Tone {
  if (percentage >= threshold) return 'success';
  if (percentage >= threshold - 10) return 'warning';
  return 'danger';
}

export function isBelowThreshold(percentage: number, threshold: number): boolean {
  return percentage < threshold;
}

/** Present-like statuses counted as "attended" by the backend maths. */
export function isCountedAsPresent(status: AttendanceStatus): boolean {
  return status === 'PRESENT' || status === 'LATE';
}
