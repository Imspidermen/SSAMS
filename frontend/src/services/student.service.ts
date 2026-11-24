/**
 * Student self-service endpoints (`/api/students/*`, STUDENT role only).
 * The backend derives the student from the authenticated user id, so no
 * student id is ever sent by the client.
 */
import type { AttendanceRecord, Student, StudentAttendanceOverview } from '@/types';
import { api } from './api';

/** GET /students/me - profile incl. department, face profile and email. */
export function getMyProfile(): Promise<Student> {
  return api.get<Student>('/students/me');
}

/**
 * GET /students/me/attendance - overall %, subject-wise %, recent history and
 * the configured minimum attendance threshold (never hard-coded in the UI).
 */
export function getMyAttendance(): Promise<StudentAttendanceOverview> {
  return api.get<StudentAttendanceOverview>('/students/me/attendance');
}

/** GET /students/me/attendance/history - up to 500 most recent records. */
export function getMyHistory(): Promise<AttendanceRecord[]> {
  return api.get<AttendanceRecord[]>('/students/me/attendance/history');
}
