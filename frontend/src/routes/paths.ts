/**
 * Single source of truth for every route in the app. Pages and navigation
 * import these constants instead of hard-coding strings, so a route change can
 * never silently break a link.
 */
import type { Role } from '@/types';

export const paths = {
  login: '/login',
  notifications: '/notifications',
  notFound: '*',

  admin: {
    root: '/admin',
    dashboard: '/admin',
    students: '/admin/students',
    studentNew: '/admin/students/new',
    studentDetail: (id: string) => `/admin/students/${id}`,
    studentEdit: (id: string) => `/admin/students/${id}/edit`,
    teachers: '/admin/teachers',
    subjects: '/admin/subjects',
    classrooms: '/admin/classrooms',
    attendance: '/admin/attendance',
    attendanceHistory: '/admin/attendance/history',
    reports: '/admin/reports',
    settings: '/admin/settings',
    audit: '/admin/audit',
    profile: '/admin/profile',
  },

  teacher: {
    root: '/teacher',
    dashboard: '/teacher',
    subjects: '/teacher/subjects',
    students: '/teacher/students',
    attendance: '/teacher/attendance',
    attendanceHistory: '/teacher/attendance/history',
    sessionDetail: (id: string) => `/teacher/attendance/sessions/${id}`,
    profile: '/teacher/profile',
  },

  student: {
    root: '/student',
    dashboard: '/student',
    profile: '/student/profile',
    face: '/student/face',
    attendance: '/student/attendance',
    attendanceHistory: '/student/attendance/history',
  },
} as const;

/** Landing route per role - used by `/`, the 404 page and post-login redirect. */
export function homePathFor(role: Role | null | undefined): string {
  switch (role) {
    case 'ADMIN':
      return paths.admin.dashboard;
    case 'TEACHER':
      return paths.teacher.dashboard;
    case 'STUDENT':
      return paths.student.dashboard;
    default:
      return paths.login;
  }
}

/** Route prefix per role, used by the role guard. */
export const roleBasePath: Record<Role, string> = {
  ADMIN: '/admin',
  TEACHER: '/teacher',
  STUDENT: '/student',
};
