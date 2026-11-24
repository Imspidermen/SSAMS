import { NavLink } from 'react-router-dom';
import type { NavItem } from '@/routes/navigation';
import { useNotifications } from '@/hooks/queries/useNotificationQueries';
import { cn } from '@/utils/cn';

export interface MobileNavProps {
  items: NavItem[];
}

/**
 * Bottom tab bar for phones: the role's primary actions stay within thumb
 * reach, and the bar is hidden on tablet/desktop where the sidebar is used.
 */
export function MobileNav({ items }: MobileNavProps) {
  const { data: notifications } = useNotifications(true);
  const unread = notifications?.unreadCount ?? 0;

  return (
    <nav className="mobile-nav no-print" aria-label="Quick navigation">
      {items.map((item) => {
        const Icon = item.icon;
        const badge = item.badge === 'notifications' && unread > 0 ? unread : null;
        return (
          <NavLink
            key={item.to + item.label}
            to={item.to}
            end={item.end}
            className={({ isActive }) => cn('mobile-nav__item', isActive && 'is-active')}
          >
            <Icon size={19} strokeWidth={1.9} aria-hidden="true" />
            <span>{item.label}</span>
            {badge ? (
              <span className="mobile-nav__badge" aria-label={`${badge} unread notifications`}>
                {badge > 9 ? '9+' : badge}
              </span>
            ) : null}
          </NavLink>
        );
      })}
    </nav>
  );
}
