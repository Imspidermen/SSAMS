import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  BellOff,
  CalendarCheck2,
  CheckCheck,
  Clock3,
  Info,
  Radio,
  ScanFace,
  XCircle,
} from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/StateBlock';
import { Tabs } from '@/components/ui/Tabs';
import { PageHeader } from '@/components/common/PageHeader';
import { LiveRegion } from '@/components/common/LiveRegion';
import { useToast } from '@/hooks/useToast';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/hooks/queries/useNotificationQueries';
import { describeApiError } from '@/utils/apiError';
import { formatDateTime, formatNumber, formatTimeAgo } from '@/utils/format';
import { cn } from '@/utils/cn';
import type { Tone } from '@/utils/attendance';
import type { AppNotification, NotificationType } from '@/types';

const TYPE_META: Record<NotificationType, { tone: Tone; icon: JSX.Element; label: string }> = {
  ATTENDANCE_SUCCESS: {
    tone: 'success',
    icon: <CalendarCheck2 size={17} />,
    label: 'Attendance marked',
  },
  ATTENDANCE_FAILED: { tone: 'danger', icon: <XCircle size={17} />, label: 'Attendance failed' },
  LOW_ATTENDANCE: { tone: 'warning', icon: <AlertTriangle size={17} />, label: 'Low attendance' },
  ATTENDANCE_REMINDER: { tone: 'info', icon: <Clock3 size={17} />, label: 'Reminder' },
  SESSION_STARTED: { tone: 'info', icon: <Radio size={17} />, label: 'Session started' },
  SESSION_ENDING: { tone: 'warning', icon: <Clock3 size={17} />, label: 'Session ending' },
  SYSTEM_NOTIFICATION: { tone: 'neutral', icon: <Info size={17} />, label: 'System' },
};

type FeedFilter = 'all' | 'unread';

/**
 * Full notification feed. Backed by GET /notifications (the same feed the topbar
 * bell polls), POST /notifications/:id/read and POST /notifications/read-all.
 *
 * The backend returns the 50 most recent notifications with an unread count and
 * accepts no filter or pagination parameters, so the All/Unread switch filters
 * the returned feed in the browser. That limit is documented in
 * API_CONTRACT.md - it is not presented as a complete archive.
 */
export function NotificationsPage() {
  const toast = useToast();
  const notifications = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const [filter, setFilter] = useState<FeedFilter>('all');

  const items = useMemo(() => notifications.data?.items ?? [], [notifications.data]);
  const unread = notifications.data?.unreadCount ?? 0;

  const visible = useMemo(
    () => (filter === 'unread' ? items.filter((item) => !item.isRead) : items),
    [items, filter],
  );

  const handleMarkRead = async (notification: AppNotification) => {
    try {
      await markRead.mutateAsync(notification.id);
    } catch (error) {
      toast.error('Could not update the notification', describeApiError(error));
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllRead.mutateAsync();
      toast.success('All caught up', 'Every notification in your feed is marked as read.');
    } catch (error) {
      toast.error('Could not mark all as read', describeApiError(error));
    }
  };

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="Attendance results, session activity and system messages for your account."
        actions={
          <Button
            variant="secondary"
            icon={<CheckCheck size={16} />}
            onClick={() => void handleMarkAllRead()}
            disabled={unread === 0}
            isLoading={markAllRead.isPending}
            loadingText="Updating…"
          >
            Mark all read
          </Button>
        }
      />

      <Tabs<FeedFilter>
        ariaLabel="Notification filters"
        value={filter}
        onChange={setFilter}
        items={[
          {
            value: 'all',
            label: `All (${formatNumber(items.length)})`,
            icon: <Bell size={15} />,
          },
          {
            value: 'unread',
            label: `Unread (${formatNumber(unread)})`,
            icon: <BellOff size={15} />,
          },
        ]}
      />

      <div className="stack stack-3" style={{ marginTop: 'var(--space-4)' }}>
        {notifications.isPending ? (
          <>
            <NotificationSkeleton />
            <NotificationSkeleton />
            <NotificationSkeleton />
          </>
        ) : notifications.isError ? (
          <Card>
            <ErrorState
              error={notifications.error}
              onRetry={() => void notifications.refetch()}
              title="Notifications could not be loaded"
            />
          </Card>
        ) : visible.length === 0 ? (
          <EmptyState
            variant={filter === 'unread' ? 'search' : 'default'}
            title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            message={
              filter === 'unread'
                ? 'You have read everything in your feed.'
                : 'You will be notified when attendance is marked, when a session starts and when your percentage drops below the minimum.'
            }
            actionLabel={filter === 'unread' ? 'Show all' : undefined}
            onAction={filter === 'unread' ? () => setFilter('all') : undefined}
          />
        ) : (
          <ul className="notification-feed">
            {visible.map((item) => {
              const meta = TYPE_META[item.type];
              return (
                <li key={item.id}>
                  <Card
                    className={cn('notification-card', !item.isRead && 'notification-card--unread')}
                  >
                    <CardBody>
                      <div className="notification-card__row">
                        <span
                          className={cn(
                            'notification-card__icon',
                            `notification-card__icon--${meta.tone}`,
                          )}
                          aria-hidden="true"
                        >
                          {meta.icon}
                        </span>
                        <div className="notification-card__body">
                          <div className="row row--between notification-card__heading">
                            <p className="notification-card__title">{item.title}</p>
                            {item.isRead ? null : <Badge tone="primary">New</Badge>}
                          </div>
                          <p className="notification-card__message">{item.message}</p>
                          <p className="notification-card__meta">
                            <Badge tone={meta.tone}>{meta.label}</Badge>
                            <span className="text-caption" title={formatDateTime(item.createdAt)}>
                              {formatTimeAgo(item.createdAt)}
                            </span>
                          </p>
                        </div>
                        {item.isRead ? null : (
                          <div className="notification-card__actions">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => void handleMarkRead(item)}
                              isLoading={markRead.isPending && markRead.variables === item.id}
                              disabled={markRead.isPending && markRead.variables !== item.id}
                            >
                              Mark read
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardBody>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {notifications.isSuccess && items.length >= 50 ? (
        <Alert tone="info" title="Showing your 50 most recent notifications">
          The notification endpoint caps the feed at 50 entries and offers no pagination, so older
          notifications are not reachable from this screen. This is recorded as a required backend
          addition in <code className="text-mono">frontend/API_CONTRACT.md</code>.
        </Alert>
      ) : null}

      {notifications.isError ? (
        <Alert tone="error" title="Feed unavailable">
          {describeApiError(notifications.error)}
        </Alert>
      ) : null}

      <LiveRegion>
        {notifications.isSuccess
          ? `${formatNumber(visible.length)} notifications shown, ${formatNumber(unread)} unread.`
          : ''}
      </LiveRegion>

      <p className="text-caption row" style={{ gap: 'var(--space-2)', justifyContent: 'center' }}>
        <ScanFace size={13} aria-hidden="true" />
        Notifications are delivered by polling the API while this tab is open - the backend has no
        push channel yet.
      </p>
    </>
  );
}

function NotificationSkeleton() {
  return (
    <Card>
      <CardBody>
        <div className="notification-card__row">
          <Skeleton variant="circle" width="2.5rem" height="2.5rem" />
          <div className="notification-card__body stack stack-2" style={{ flex: 1 }}>
            <Skeleton width="40%" height="0.9rem" />
            <Skeleton width="90%" height="0.8rem" />
            <Skeleton width="25%" height="0.8rem" />
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
