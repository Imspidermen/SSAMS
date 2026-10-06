import { AppShell } from './AppShell';
import { teacherNavigation } from '@/routes/navigation';
import { paths } from '@/routes/paths';

export function TeacherLayout() {
  return (
    <AppShell role="TEACHER" navigation={teacherNavigation} profilePath={paths.teacher.profile} />
  );
}
