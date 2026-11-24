import { NavLink, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import type { NavSection } from '@/routes/navigation';
import { paths } from '@/routes/paths';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/queries/useNotificationQueries';
import { Logo } from '@/components/common/Logo';
import { Avatar } from '@/components/ui/Avatar';
import { ROLE_LABELS } from '@/utils/constants';
import { cn } from '@/utils/cn';

export interface SidebarProps {
  navigation: NavSection[];
  role: 'ADMIN' | 'TEACHER' | 'STUDENT';
  /** Closes the drawer after navigation (mobile). */
  onNavigate?: () => void;
  variant?: 'static' | 'drawer';
}

export function Sidebar({ navigation, role, onNavigate, variant = 'static' }: SidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { data: notifications } = useNotifications(true);
  const unread = notifications?.unreadCount ?? 0;

  const badgeFor = (key?: string) => {
    if (key === 'notifications' && unread > 0) return unread;
    return null;
  };

  const handleLogout = async () => {
    onNavigate?.();
    await logout();
    navigate(paths.login, { replace: true });
  };

  return (
    <div className={cn(variant === 'drawer' ? 'drawer' : 'app-sidebar')} id="app-sidebar">
      <div className="sidebar__brand">
        <Logo size={32} withWordmark sublabel={`${role} portal`} />
      </div>

      <nav className="sidebar__scroll" aria-label="Main navigation">
        {navigation.map((section) => (
          <div className="sidebar__section" key={section.label ?? 'general'}>
            {section.label ? (
              <p className="sidebar__section-label" id={`nav-${section.label}`}>
                {section.label}
              </p>
            ) : null}
            <div
              className="sidebar__nav"
              role="list"
              aria-labelledby={section.label ? `nav-${section.label}` : undefined}
            >
              {section.items.map((item) => {
                const Icon = item.icon;
                const badge = badgeFor(item.badge);
                return (
                  <NavLink
                    key={item.to + item.label}
                    to={item.to}
                    end={item.end}
                    role="listitem"
                    onClick={onNavigate}
                    className={({ isActive }) => cn('nav-link', isActive && 'is-active')}
                  >
                    <span className="nav-link__icon" aria-hidden="true">
                      <Icon size={18} strokeWidth={1.9} />
                    </span>
                    <span className="nav-link__label">{item.label}</span>
                    {badge ? (
                      <span className="nav-link__badge" aria-label={`${badge} unread`}>
                        {badge > 9 ? '9+' : badge}
                      </span>
                    ) : null}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}

        <div className="sidebar__section">
          <div className="sidebar__nav">
            <button type="button" className="nav-link nav-link--danger" onClick={handleLogout}>
              <span className="nav-link__icon" aria-hidden="true">
                <LogOut size={18} strokeWidth={1.9} />
              </span>
              <span className="nav-link__label">Logout</span>
            </button>
          </div>
        </div>
      </nav>

      <div className="sidebar__footer">
        <div className="sidebar__user">
          <Avatar name={user?.name ?? user?.email} size="sm" />
          <div className="sidebar__user-text">
            <p className="sidebar__user-name">{user?.name ?? 'Signed in'}</p>
            <p className="sidebar__user-role">{ROLE_LABELS[role] ?? role}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
