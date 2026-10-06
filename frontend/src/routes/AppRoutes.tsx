import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminLayout } from '@/layouts/AdminLayout';
import { AuthLayout } from '@/layouts/AuthLayout';
import { RoleShell } from '@/layouts/RoleShell';
import { StudentLayout } from '@/layouts/StudentLayout';
import { TeacherLayout } from '@/layouts/TeacherLayout';
import { BootScreen } from '@/components/common/BootScreen';
import { ProtectedRoute } from './ProtectedRoute';
import { RoleRoute } from './RoleRoute';
import { homePathFor, paths } from './paths';
import { useAuth } from '@/hooks/useAuth';

/* Every page is a separate chunk so the login screen never pays for the admin
   reporting bundle. */
const LoginPage = lazy(() =>
  import('@/pages/auth/LoginPage').then((m) => ({ default: m.LoginPage })),
);
const NotFoundPage = lazy(() =>
  import('@/pages/errors/NotFoundPage').then((m) => ({ default: m.NotFoundPage })),
);
const ServiceUnavailablePage = lazy(() =>
  import('@/pages/errors/ServiceUnavailablePage').then((m) => ({
    default: m.ServiceUnavailablePage,
  })),
);

const AdminDashboardPage = lazy(() =>
  import('@/pages/admin/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })),
);
const StudentsPage = lazy(() =>
  import('@/pages/admin/StudentsPage').then((m) => ({ default: m.StudentsPage })),
);
const StudentDetailPage = lazy(() =>
  import('@/pages/admin/StudentDetailPage').then((m) => ({ default: m.StudentDetailPage })),
);
const NewStudentPage = lazy(() =>
  import('@/pages/admin/StudentFormPage').then((m) => ({ default: m.NewStudentPage })),
);
const EditStudentPage = lazy(() =>
  import('@/pages/admin/StudentFormPage').then((m) => ({ default: m.EditStudentPage })),
);
const TeachersPage = lazy(() =>
  import('@/pages/admin/TeachersPage').then((m) => ({ default: m.TeachersPage })),
);
const SubjectsPage = lazy(() =>
  import('@/pages/admin/SubjectsPage').then((m) => ({ default: m.SubjectsPage })),
);
const ClassroomsPage = lazy(() =>
  import('@/pages/admin/ClassroomsPage').then((m) => ({ default: m.ClassroomsPage })),
);
const AttendanceOverviewPage = lazy(() =>
  import('@/pages/admin/AttendanceOverviewPage').then((m) => ({
    default: m.AttendanceOverviewPage,
  })),
);
const ReportsPage = lazy(() =>
  import('@/pages/admin/ReportsPage').then((m) => ({ default: m.ReportsPage })),
);
const SettingsPage = lazy(() =>
  import('@/pages/admin/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);
const AuditLogPage = lazy(() =>
  import('@/pages/admin/AuditLogPage').then((m) => ({ default: m.AuditLogPage })),
);

const TeacherDashboardPage = lazy(() =>
  import('@/pages/teacher/TeacherDashboardPage').then((m) => ({ default: m.TeacherDashboardPage })),
);
const TeacherSubjectsPage = lazy(() =>
  import('@/pages/teacher/TeacherSubjectsPage').then((m) => ({ default: m.TeacherSubjectsPage })),
);
const TeacherStudentsPage = lazy(() =>
  import('@/pages/teacher/TeacherStudentsPage').then((m) => ({ default: m.TeacherStudentsPage })),
);
const TeacherAttendancePage = lazy(() =>
  import('@/pages/teacher/TeacherAttendancePage').then((m) => ({
    default: m.TeacherAttendancePage,
  })),
);
const SessionDetailPage = lazy(() =>
  import('@/pages/teacher/SessionDetailPage').then((m) => ({ default: m.SessionDetailPage })),
);

const StudentDashboardPage = lazy(() =>
  import('@/pages/student/StudentDashboardPage').then((m) => ({ default: m.StudentDashboardPage })),
);
const StudentAttendancePage = lazy(() =>
  import('@/pages/student/StudentAttendancePage').then((m) => ({
    default: m.StudentAttendancePage,
  })),
);
const StudentAttendanceHistoryPage = lazy(() =>
  import('@/pages/student/StudentAttendanceHistoryPage').then((m) => ({
    default: m.StudentAttendanceHistoryPage,
  })),
);
const FaceEnrollmentPage = lazy(() =>
  import('@/pages/student/FaceEnrollmentPage').then((m) => ({ default: m.FaceEnrollmentPage })),
);

const NotificationsPage = lazy(() =>
  import('@/pages/common/NotificationsPage').then((m) => ({ default: m.NotificationsPage })),
);
const ProfilePage = lazy(() =>
  import('@/pages/common/ProfilePage').then((m) => ({ default: m.ProfilePage })),
);
const AttendanceHistoryPage = lazy(() =>
  import('@/pages/common/AttendanceHistoryPage').then((m) => ({
    default: m.AttendanceHistoryPage,
  })),
);

/** Sends `/` to the signed-in user's own dashboard, or to the login page. */
function RootRedirect() {
  const { role, isInitialising, isAuthenticated } = useAuth();
  if (isInitialising) return <BootScreen />;
  if (!isAuthenticated) return <Navigate to={paths.login} replace />;
  return <Navigate to={homePathFor(role)} replace />;
}

/**
 * The whole route table.
 *
 * Guards are layered: `ProtectedRoute` requires a session (and forwards the
 * attempted URL so login can return to it), `RoleRoute` restricts a portal to
 * its own role and renders an explicit 403 for everyone else. Both are UX only -
 * the backend re-checks the JWT role on every request and remains the security
 * boundary.
 */
export function AppRoutes() {
  return (
    <Suspense fallback={<BootScreen />}>
      <Routes>
        <Route path={paths.login} element={<AuthLayout />}>
          <Route index element={<LoginPage />} />
        </Route>

        <Route path="/" element={<RootRedirect />} />

        {/* Shared authenticated screens, in a shell that matches the user's role. */}
        <Route
          element={
            <ProtectedRoute>
              <RoleShell />
            </ProtectedRoute>
          }
        >
          <Route path={paths.notifications} element={<NotificationsPage />} />
        </Route>

        {/* ------------------------------- ADMIN ------------------------------- */}
        <Route
          path={paths.admin.root}
          element={
            <ProtectedRoute>
              <RoleRoute roles={['ADMIN']}>
                <AdminLayout />
              </RoleRoute>
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboardPage />} />
          <Route path={paths.admin.students} element={<StudentsPage />} />
          <Route path={paths.admin.studentNew} element={<NewStudentPage />} />
          <Route path={paths.admin.studentDetail(':id')} element={<StudentDetailPage />} />
          <Route path={paths.admin.studentEdit(':id')} element={<EditStudentPage />} />
          <Route path={paths.admin.teachers} element={<TeachersPage />} />
          <Route path={paths.admin.subjects} element={<SubjectsPage />} />
          <Route path={paths.admin.classrooms} element={<ClassroomsPage />} />
          <Route path={paths.admin.attendance} element={<AttendanceOverviewPage />} />
          <Route
            path={paths.admin.attendanceHistory}
            element={<AttendanceHistoryPage role="ADMIN" />}
          />
          <Route path={paths.admin.reports} element={<ReportsPage />} />
          <Route path={paths.admin.settings} element={<SettingsPage />} />
          <Route path={paths.admin.audit} element={<AuditLogPage />} />
          <Route path={paths.admin.profile} element={<ProfilePage />} />
        </Route>

        {/* ------------------------------ TEACHER ------------------------------ */}
        <Route
          path={paths.teacher.root}
          element={
            <ProtectedRoute>
              <RoleRoute roles={['TEACHER']}>
                <TeacherLayout />
              </RoleRoute>
            </ProtectedRoute>
          }
        >
          <Route index element={<TeacherDashboardPage />} />
          <Route path={paths.teacher.subjects} element={<TeacherSubjectsPage />} />
          <Route path={paths.teacher.students} element={<TeacherStudentsPage />} />
          <Route path={paths.teacher.attendance} element={<TeacherAttendancePage />} />
          <Route
            path={paths.teacher.attendanceHistory}
            element={<AttendanceHistoryPage role="TEACHER" />}
          />
          <Route path={paths.teacher.sessionDetail(':id')} element={<SessionDetailPage />} />
          <Route path={paths.teacher.profile} element={<ProfilePage />} />
        </Route>

        {/* ------------------------------ STUDENT ------------------------------ */}
        <Route
          path={paths.student.root}
          element={
            <ProtectedRoute>
              <RoleRoute roles={['STUDENT']}>
                <StudentLayout />
              </RoleRoute>
            </ProtectedRoute>
          }
        >
          <Route index element={<StudentDashboardPage />} />
          <Route path={paths.student.attendance} element={<StudentAttendancePage />} />
          <Route
            path={paths.student.attendanceHistory}
            element={<StudentAttendanceHistoryPage />}
          />
          <Route path={paths.student.face} element={<FaceEnrollmentPage />} />
          <Route path={paths.student.profile} element={<ProfilePage />} />
        </Route>

        <Route path="/unavailable" element={<ServiceUnavailablePage />} />
        <Route path={paths.notFound} element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
