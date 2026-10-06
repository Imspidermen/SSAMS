import { AppShell } from './AppShell';
import { BootScreen } from '@/components/common/BootScreen';
import { useAuth } from '@/hooks/useAuth';
import { adminNavigation, studentNavigation, teacherNavigation } from '@/routes/navigation';
import type { NavSection } from '@/routes/navigation';
import { paths } from '@/routes/paths';
import type { Role } from '@/types';

const SHELLS: Record<Role, { navigation: NavSection[]; profilePath: string }> = {
  ADMIN: { navigation: adminNavigation, profilePath: paths.admin.profile },
  TEACHER: { navigation: teacherNavigation, profilePath: paths.teacher.profile },
  STUDENT: { navigation: studentNavigation, profilePath: paths.student.profile },
};

/**
 * App shell that adapts to whoever is signed in.
 *
 * Used for screens that are shared by every role (notifications), so the chrome
 * and navigation always match the current user instead of being duplicated per
 * portal. Role-specific areas keep their own explicit layout so a wrong-role
 * visit is caught by `RoleRoute` before any navigation is rendered.
 */
export function RoleShell() {
  const { role, isInitialising } = useAuth();

  if (isInitialising || !role) return <BootScreen />;

  const shell = SHELLS[role];
  return <AppShell role={role} navigation={shell.navigation} profilePath={shell.profilePath} />;
}
