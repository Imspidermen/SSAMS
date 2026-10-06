import { useCallback, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { MobileNav } from './MobileNav';
import { useAuth } from '@/hooks/useAuth';
import { useAuthProfile } from '@/hooks/useAuthProfile';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useIsCompact } from '@/hooks/useMediaQuery';
import { mobileNavigation, resolveContextLabel, roleDescriptor } from '@/routes/navigation';
import type { NavSection } from '@/routes/navigation';
import type { Role } from '@/types';

export interface AppShellProps {
  role: Role;
  navigation: NavSection[];
  profilePath: string;
}

/**
 * The single authenticated shell: fixed sidebar (desktop) / drawer (mobile),
 * sticky topbar with page context, theme + notification controls and the
 * profile menu, and a scrollable main region.
 *
 * One implementation is shared by all three roles - only the navigation model
 * and the profile route differ, so the chrome never drifts between portals.
 */
export function AppShell({ role, navigation, profilePath }: AppShellProps) {
  const { user } = useAuth();
  useAuthProfile();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isCompact = useIsCompact();

  useBodyScrollLock(drawerOpen);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const openDrawer = useCallback(() => setDrawerOpen(true), []);

  // Keep the display name fresh in the document title for tab identification.
  const contextLabel = resolveContextLabel(role, location.pathname);
  const descriptor = roleDescriptor[role];

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <Sidebar navigation={navigation} role={role} />

      {drawerOpen ? (
        <>
          <div className="drawer-backdrop" onClick={closeDrawer} aria-hidden="true" />
          <div role="dialog" aria-modal="true" aria-label="Navigation menu">
            <Sidebar
              navigation={navigation}
              role={role}
              variant="drawer"
              onNavigate={closeDrawer}
            />
          </div>
        </>
      ) : null}

      <div className="app-body">
        <Topbar
          contextLabel={contextLabel}
          contextBlurb={descriptor.blurb}
          role={role}
          profilePath={profilePath}
          onOpenDrawer={openDrawer}
          showDrawerButton={isCompact}
        />

        <main className="app-main" id="main-content" tabIndex={-1}>
          <Outlet context={{ user, role }} />
        </main>

        <MobileNav items={mobileNavigation[role]} />
      </div>
    </div>
  );
}
