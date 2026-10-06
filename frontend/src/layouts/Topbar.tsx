import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Menu, Settings2, UserSquare2 } from 'lucide-react';
import { Dropdown, DropdownItem, DropdownLabel, DropdownSeparator } from '@/components/ui/Dropdown';
import { IconButton } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { NotificationBell } from '@/components/common/NotificationBell';
import { useAuth } from '@/hooks/useAuth';
import { paths } from '@/routes/paths';
import { ROLE_LABELS } from '@/utils/constants';
import type { Role } from '@/types';

export interface TopbarProps {
  /** Current section name, shown as page context. */
  contextLabel: string;
  /** Supporting line describing the role's area. */
  contextBlurb?: string;
  role: Role;
  profilePath: string;
  onOpenDrawer: () => void;
  showDrawerButton: boolean;
}

export function Topbar({
  contextLabel,
  contextBlurb,
  role,
  profilePath,
  onOpenDrawer,
  showDrawerButton,
}: TopbarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  const settingsPath = role === 'ADMIN' ? paths.admin.settings : null;

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
      navigate(paths.login, { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <header className="app-topbar">
      {showDrawerButton ? (
        <IconButton icon={<Menu size={20} />} label="Open navigation menu" onClick={onOpenDrawer} />
      ) : null}

      <div className="topbar__context">
        <span className="topbar__title">{contextLabel}</span>
        {contextBlurb ? <span className="topbar__crumb">{contextBlurb}</span> : null}
      </div>

      <span className="topbar__spacer" />

      <div className="topbar__actions">
        <ThemeToggle />
        <NotificationBell />

        <Dropdown
          ariaLabel="Account menu"
          trigger={({ toggle, ref, ariaExpanded, ariaHasPopup, id }) => (
            <button
              ref={ref}
              type="button"
              id={id}
              className="profile-trigger"
              onClick={toggle}
              aria-expanded={ariaExpanded}
              aria-haspopup={ariaHasPopup}
            >
              <Avatar name={user?.name ?? user?.email} size="sm" />
              <span className="profile-trigger__text">
                <span className="profile-trigger__name">{user?.name ?? 'Signed in'}</span>
                <span className="profile-trigger__role">{ROLE_LABELS[role] ?? role}</span>
              </span>
            </button>
          )}
        >
          {({ close }) => (
            <>
              <div className="profile-menu__header">
                <Avatar name={user?.name ?? user?.email} size="md" />
                <div>
                  <p className="profile-menu__name">{user?.name ?? 'Signed in'}</p>
                  <p className="profile-menu__email">{user?.email}</p>
                </div>
              </div>

              <DropdownLabel>Account</DropdownLabel>
              <Link to={profilePath} className="dropdown__item" onClick={close}>
                <span className="dropdown__item-icon" aria-hidden="true">
                  <UserSquare2 size={15} />
                </span>
                My Profile
              </Link>

              {settingsPath ? (
                <Link to={settingsPath} className="dropdown__item" onClick={close}>
                  <span className="dropdown__item-icon" aria-hidden="true">
                    <Settings2 size={15} />
                  </span>
                  Settings
                </Link>
              ) : null}

              <DropdownSeparator />
              <DropdownItem
                icon={<LogOut size={15} />}
                tone="danger"
                disabled={loggingOut}
                onSelect={() => void handleLogout()}
              >
                {loggingOut ? 'Logging out…' : 'Logout'}
              </DropdownItem>
            </>
          )}
        </Dropdown>
      </div>
    </header>
  );
}
