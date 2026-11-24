import { AppShell } from './AppShell';
import { adminNavigation } from '@/routes/navigation';
import { paths } from '@/routes/paths';

export function AdminLayout() {
  return <AppShell role="ADMIN" navigation={adminNavigation} profilePath={paths.admin.profile} />;
}
