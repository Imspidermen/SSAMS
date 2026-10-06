import { CalendarClock, Clock3, DoorOpen, Eye, Square, Users } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Progress } from '@/components/ui/Progress';
import { useCountdown, formatRemaining } from '@/hooks/useCountdown';
import { sessionStatusMeta } from '@/utils/attendance';
import { formatDistance, formatNumber, formatPercent, formatTime } from '@/utils/format';
import { cn } from '@/utils/cn';
import type { AttendanceSession } from '@/types';

export interface SessionCardProps {
  session: AttendanceSession;
  /** Live roster link. Omitted for compact variants. */
  detailPath?: string;
  /** Present when the teacher may still stop this session. */
  onStop?: () => void;
  isStopping?: boolean;
  /** Roster tallies, when known (the live endpoint or `_count`). */
  presentCount?: number;
  totalCount?: number;
  compact?: boolean;
}

/**
 * One attendance session: what it covers, how long is left and how many
 * students have verified. All values come from the session object returned by
 * the backend - nothing is inferred or faked.
 */
export function SessionCard({
  session,
  detailPath,
  onStop,
  isStopping = false,
  presentCount,
  totalCount,
  compact = false,
}: SessionCardProps) {
  const statusMeta = sessionStatusMeta(session.status);
  const isActive = session.status === 'ACTIVE';
  const remainingMs = useCountdown(session.endTime, isActive);
  const known =
    typeof presentCount === 'number' && typeof totalCount === 'number' && totalCount > 0;
  const percentage = known
    ? Math.round(((presentCount as number) / (totalCount as number)) * 1000) / 10
    : 0;
  const records = session._count?.attendanceRecords;

  return (
    <Card className={cn('session-card', isActive && 'session-card--active')} as="article">
      <CardBody>
        <div className="session-card__row">
          <div className="session-card__main">
            <div className="row" style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              <Badge tone={statusMeta.tone} dot>
                {statusMeta.label}
              </Badge>
              {isActive ? (
                <Badge
                  tone={remainingMs < 60_000 ? 'danger' : 'success'}
                  icon={<Clock3 size={12} />}
                >
                  {formatRemaining(remainingMs)} left
                </Badge>
              ) : null}
              {typeof records === 'number' ? (
                <Badge tone="neutral" icon={<Users size={12} />}>
                  {formatNumber(records)} marks
                </Badge>
              ) : null}
            </div>

            <h3 className="session-card__title">
              {session.subject?.name ?? 'Session'}
              {session.subject?.code ? (
                <span className="text-caption"> · {session.subject.code}</span>
              ) : null}
            </h3>

            <p className="session-card__meta">
              <span className="row" style={{ gap: 'var(--space-1)' }}>
                <DoorOpen size={13} aria-hidden="true" />
                {session.classroom?.name ?? 'Classroom'}
                {session.geofenceRadiusM ? ` · ${formatDistance(session.geofenceRadiusM)}` : ''}
              </span>
              <span className="row" style={{ gap: 'var(--space-1)' }}>
                <Users size={13} aria-hidden="true" />
                Semester {session.semester} · Section {session.section}
              </span>
              <span className="row" style={{ gap: 'var(--space-1)' }}>
                <CalendarClock size={13} aria-hidden="true" />
                {formatTime(session.startTime)} – {formatTime(session.endTime)}
              </span>
            </p>

            {!compact ? (
              <p className="session-card__meta">
                <span className="row" style={{ gap: 'var(--space-1)' }}>
                  Checks:
                  <Badge tone="info">Geofence</Badge>
                  <Badge tone="info">Face match</Badge>
                  {session.livenessRequired ? <Badge tone="info">Liveness</Badge> : null}
                  {session.blinkRequired ? <Badge tone="info">Blink</Badge> : null}
                </span>
                <span>Up to {session.maxAttempts} verification attempts</span>
              </p>
            ) : null}

            {known ? (
              <div className="session-card__progress">
                <Progress
                  value={percentage}
                  tone={percentage >= 75 ? 'success' : percentage >= 50 ? 'warning' : 'danger'}
                  label={`${formatNumber(presentCount)} verified of ${formatNumber(totalCount)} expected`}
                />
                <span className="text-caption">{formatPercent(percentage, 1)} attended</span>
              </div>
            ) : null}
          </div>

          <div className="session-card__actions">
            {detailPath ? (
              <ButtonLink to={detailPath} variant="secondary" size="sm" icon={<Eye size={15} />}>
                {isActive ? 'Live roster' : 'View roster'}
              </ButtonLink>
            ) : null}
            {onStop && isActive ? (
              <Button
                variant="danger"
                size="sm"
                icon={<Square size={15} />}
                onClick={onStop}
                isLoading={isStopping}
                loadingText="Stopping…"
              >
                Stop session
              </Button>
            ) : null}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
