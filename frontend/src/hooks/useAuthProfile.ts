import { useEffect } from 'react';
import { useMyProfile } from './queries/useStudentQueries';
import { useTeacherDashboard } from './queries/useTeacherQueries';
import { useAuth } from './useAuth';

/**
 * Resolves the signed-in user's role profile and keeps the display name in the
 * auth context in sync.
 *
 * Why: `GET /auth/me` echoes the JWT payload (`id`, `role`, `email` only). The
 * full name lives on the Student/Teacher/Admin rows, so once the session is
 * known we pull the role's own profile endpoint (which the dashboards need
 * anyway - the query is shared, not duplicated) and merge the name upward.
 */
export function useAuthProfile() {
  const { user, role, isAuthenticated, patchUser } = useAuth();

  const studentQuery = useMyProfile(isAuthenticated && role === 'STUDENT');
  const teacherQuery = useTeacherDashboard(isAuthenticated && role === 'TEACHER');

  useEffect(() => {
    if (!user) return;
    if (
      role === 'STUDENT' &&
      studentQuery.data?.fullName &&
      studentQuery.data.fullName !== user.name
    ) {
      patchUser({ name: studentQuery.data.fullName });
    }
    if (
      role === 'TEACHER' &&
      teacherQuery.data?.teacher?.fullName &&
      teacherQuery.data.teacher.fullName !== user.name
    ) {
      patchUser({ name: teacherQuery.data.teacher.fullName });
    }
  }, [role, user, patchUser, studentQuery.data, teacherQuery.data]);

  return {
    student: role === 'STUDENT' ? (studentQuery.data ?? null) : null,
    teacher: role === 'TEACHER' ? (teacherQuery.data?.teacher ?? null) : null,
    isProfileLoading:
      role === 'STUDENT'
        ? studentQuery.isPending
        : role === 'TEACHER'
          ? teacherQuery.isPending
          : false,
  };
}
