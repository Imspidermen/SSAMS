/**
 * Central TanStack Query key registry.
 *
 * Keeping keys in one place makes cache invalidation explicit and prevents the
 * "stale sibling view" bug (e.g. updating a student must refresh the list, the
 * detail view AND the dashboard counters).
 */
import type { ReportFilters, StudentListParams } from '@/types';

export const queryKeys = {
  session: ['session'] as const,
  health: ['health'] as const,

  notifications: {
    all: ['notifications'] as const,
  },

  admin: {
    dashboard: ['admin', 'dashboard'] as const,
    departments: ['admin', 'departments'] as const,
    courses: ['admin', 'courses'] as const,
    classrooms: ['admin', 'classrooms'] as const,
    subjects: (filters?: { departmentId?: string; semester?: number }) =>
      ['admin', 'subjects', filters ?? {}] as const,
    subjectsAll: ['admin', 'subjects'] as const,
    students: (params?: StudentListParams) => ['admin', 'students', params ?? {}] as const,
    studentsAll: ['admin', 'students'] as const,
    student: (id: string) => ['admin', 'students', 'detail', id] as const,
    teachers: (params?: { page?: number; pageSize?: number; search?: string }) =>
      ['admin', 'teachers', params ?? {}] as const,
    teachersAll: ['admin', 'teachers'] as const,
    policy: (departmentId?: string) => ['admin', 'policy', departmentId ?? 'GLOBAL'] as const,
    policyAll: ['admin', 'policy'] as const,
    auditLogs: (params?: { page?: number; pageSize?: number }) =>
      ['admin', 'audit-logs', params ?? {}] as const,
  },

  teacher: {
    dashboard: ['teacher', 'dashboard'] as const,
    subjects: ['teacher', 'subjects'] as const,
    sessions: (status?: string) => ['teacher', 'sessions', status ?? 'ALL'] as const,
    sessionsAll: ['teacher', 'sessions'] as const,
    liveAttendance: (sessionId: string) => ['teacher', 'sessions', sessionId, 'live'] as const,
  },

  student: {
    profile: ['student', 'profile'] as const,
    attendance: ['student', 'attendance'] as const,
    history: ['student', 'history'] as const,
    activeSessions: ['student', 'active-sessions'] as const,
    faceStatus: ['student', 'face-status'] as const,
  },

  reports: {
    /** Prefix used to invalidate every cached report filter combination. */
    attendanceAll: ['reports', 'attendance'] as const,
    attendance: (filters?: ReportFilters) => ['reports', 'attendance', filters ?? {}] as const,
  },
} as const;

/**
 * Keys that must be refreshed whenever attendance data changes (a session is
 * started/stopped, a record is marked or corrected).
 */
export const attendanceAffectedKeys = [
  queryKeys.admin.dashboard,
  queryKeys.teacher.dashboard,
  queryKeys.teacher.sessionsAll,
  queryKeys.student.attendance,
  queryKeys.student.history,
  queryKeys.student.activeSessions,
  queryKeys.reports.attendanceAll,
] as const;
