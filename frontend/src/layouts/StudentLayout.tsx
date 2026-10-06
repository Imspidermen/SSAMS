import { AppShell } from './AppShell';
import { studentNavigation } from '@/routes/navigation';
import { paths } from '@/routes/paths';

export function StudentLayout() {
  return (
    <AppShell role="STUDENT" navigation={studentNavigation} profilePath={paths.student.profile} />
  );
}
