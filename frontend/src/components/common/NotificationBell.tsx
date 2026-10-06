import { Bell, BellOff, CheckCheck, Inbox } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Dropdown, DropdownLabel, DropdownSeparator } from '@/components/ui/Dropdown';
import { IconButton } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/hooks/queries/useNotificationQueries';
import { paths } from '@/routes/paths';
import { formatTimeAgo } from '@/utils/format';
import { cn } from '@/utils/cn';
import type { NotificationType } from '@/types';

const TYPE_TONE: Record<NotificationType, 'success' | 'danger' | 'warning' | 'info' | 'neutral'> = {
  ATTENDANCE_SUCCESS: 'success',
  ATTENDANCE_FAILED: 'danger',
  LOW_ATTENDANCE: 'warning',
  ATTENDANCE_REMINDER: 'info',
  SESSION_STARTED: 'info',
  SESSION_ENDING: 'warning',
  SYSTEM_NOTIFICATION: 'neutral',
};

/**
 * Topbar notification area. Backed by GET /notifications (polled while the tab
 * is visible); marking read calls the real endpoints and invalidates the cache.
 */
export function NotificationBell() {
  const { data, isPending, isError, refetch } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const unread = data?.unreadCount ?? 0;
  const items = data?.items ?? [];

  return (
    <Dropdown
      ariaLabel="Notifications"
      menuClassName="notification-menu"
      trigger={({ toggle, ref, ariaExpanded, id }) => (
        <span className="notification-trigger">
          <IconButton
            ref={ref}
            id={id}
            icon={<Bell size={18} />}
            label={
              unread > 0 ? `Notifications, ${unread} unread. Open list` : 'Notifications. Open list'
            }
            aria-expanded={ariaExpanded}
            aria-haspopup="true"
            onClick={toggle}
          />
          {unread > 0 ? (
            <span className="notification-trigger__badge" aria-hidden="true">
              {unread > 9 ? '9+' : unread}
            </span>
          ) : null}
        </span>
      )}
    >
      {({ close }) => (
        <>
          <div className="notification-menu__header">
            <DropdownLabel>Notifications</DropdownLabel>
            {unread > 0 ? (
              <button
                type="button"
                className="notification-menu__action"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
              >
                <CheckCheck size={14} aria-hidden="true" />
                Mark all read
              </button>
            ) : null}
          </div>

          <div className="notification-menu__list">
            {isPending ? (
              <p className="notification-menu__state">
                <Spinner size={15} /> Loading notifications…
              </p>
            ) : isError ? (
              <p className="notification-menu__state">
                <BellOff size={15} aria-hidden="true" />
                Could not load notifications.
                <button type="button" className="link-btn" onClick={() => void refetch()}>
                  Retry
                </button>
              </p>
            ) : items.length === 0 ? (
              <p className="notification-menu__state">
                <Inbox size={15} aria-hidden="true" />
                No notifications yet.
              </p>
            ) : (
              items.slice(0, 8).map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  className={cn(
                    'notification-item',
                    !notification.isRead && 'notification-item--unread',
                  )}
                  onClick={() => {
                    if (!notification.isRead) markRead.mutate(notification.id);
                    close();
                  }}
                >
                  <span className="notification-item__dot" aria-hidden="true">
                    <Badge tone={TYPE_TONE[notification.type] ?? 'neutral'} dot>
                      <span className="sr-only">{notification.type.replace(/_/g, ' ')}</span>
                    </Badge>
                  </span>
                  <span className="notification-item__body">
                    <span className="notification-item__title">{notification.title}</span>
                    <span className="notification-item__message">{notification.message}</span>
                    <span className="notification-item__time">
                      {formatTimeAgo(notification.createdAt)}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>

          <DropdownSeparator />
          <Link to={paths.notifications} className="dropdown__item" onClick={close}>
            <span className="dropdown__item-icon" aria-hidden="true">
              <Inbox size={15} />
            </span>
            Open notification centre
          </Link>
        </>
      )}
    </Dropdown>
  );
}
