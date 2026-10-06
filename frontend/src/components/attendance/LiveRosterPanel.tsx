import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  CircleSlash,
  Clock,
  MapPin,
  PenLine,
  Radio,
  ShieldCheck,
  Timer,
  Users,
} from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Progress } from '@/components/ui/Progress';
import { SearchInput } from '@/components/common/SearchInput';
import { Avatar } from '@/components/ui/Avatar';
import { useCountdown, formatRemaining } from '@/hooks/useCountdown';
import {
  ATTENDANCE_STATUS_OPTIONS,
  attendanceStatusMeta,
  isCountedAsPresent,
  sessionStatusMeta,
} from '@/utils/attendance';
import { formatDistance, formatNumber, formatPercent, formatTime } from '@/utils/format';
import { cn } from '@/utils/cn';
import type { AttendanceSession, AttendanceStatus, RosterEntry } from '@/types';

type RosterFilter = 'ALL' | AttendanceStatus;

export interface LiveRosterPanelProps {
  session: AttendanceSession;
  roster: RosterEntry[];
  presentCount: number;
  totalCount: number;
  /** Whether the query is polling; drives the "live" indicator. */
  isLive: boolean;
  isFetching?: boolean;
  /** Called when a teacher corrects a record. Omitted when not permitted. */
  onCorrect?: (entry: RosterEntry) => void;
}

/**
 * The teacher's live view of one session: who has verified, who is still
 * outstanding, and how much time is left.
 *
 * Data comes from GET /attendance/sessions/:id/live, which is scoped to the
 * signed-in teacher's own sessions and keeps working after a session ends.
 * Students who have not verified are reported by the backend as ABSENT, so the
 * panel says "not marked yet" while the session is still open and "absent" once
 * it has closed.
 */
export function LiveRosterPanel({
  session,
  roster,
  presentCount,
  totalCount,
  isLive,
  isFetching = false,
  onCorrect,
}: LiveRosterPanelProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<RosterFilter>('ALL');

  const isActive = session.status === 'ACTIVE';
  const remainingMs = useCountdown(session.endTime, isActive);
  const percentage = totalCount > 0 ? Math.round((presentCount / totalCount) * 1000) / 10 : 0;

  const counts = useMemo(() => {
    const base: Record<RosterFilter, number> = {
      ALL: roster.length,
      PRESENT: 0,
      LATE: 0,
      ABSENT: 0,
      EXCUSED: 0,
    };
    for (const entry of roster) base[entry.status] += 1;
    return base;
  }, [roster]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return roster.filter((entry) => {
      if (filter !== 'ALL' && entry.status !== filter) return false;
      if (!term) return true;
      return (
        entry.fullName.toLowerCase().includes(term) ||
        entry.studentCode.toLowerCase().includes(term) ||
        entry.rollNumber.toLowerCase().includes(term)
      );
    });
  }, [roster, search, filter]);

  // Corrections are keyed by attendanceId, which the live roster does not
  // currently expose. Detect that instead of rendering a control that cannot
  // work - the panel lights up automatically once the backend adds the field.
  const correctionsAvailable =
    Boolean(onCorrect) && roster.some((entry) => Boolean(entry.attendanceId));

  const statusMeta = sessionStatusMeta(session.status);

  return (
    <div className="stack stack-4">
      <div className="roster-header">
        <div className="stack stack-2">
          <div className="row" style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <Badge tone={statusMeta.tone} dot>
              {statusMeta.label}
            </Badge>
            {isLive && isActive ? (
              <Badge tone="success" icon={<Radio size={12} />}>
                Live · updating
              </Badge>
            ) : null}
            {isFetching ? <span className="text-caption">Refreshing roster…</span> : null}
          </div>
          <h2 className="section-title">
            {session.subject?.name ?? 'Session'}
            {session.subject?.code ? ` · ${session.subject.code}` : ''}
          </h2>
          <p className="text-caption row" style={{ gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <span className="row" style={{ gap: 'var(--space-1)' }}>
              <MapPin size={13} aria-hidden="true" />
              {session.classroom?.name ?? 'Classroom'}
              {session.geofenceRadiusM
                ? ` · ${formatDistance(session.geofenceRadiusM)} radius`
                : ''}
            </span>
            <span className="row" style={{ gap: 'var(--space-1)' }}>
              <Users size={13} aria-hidden="true" />
              Semester {session.semester} · Section {session.section}
            </span>
            <span className="row" style={{ gap: 'var(--space-1)' }}>
              <Clock size={13} aria-hidden="true" />
              {formatTime(session.startTime)} – {formatTime(session.endTime)}
            </span>
          </p>
        </div>

        <div className="roster-header__timer">
          {isActive ? (
            <>
              <span className="roster-header__timer-label">Time remaining</span>
              <span
                className={cn(
                  'roster-header__timer-value',
                  remainingMs < 60_000 && 'roster-header__timer-value--urgent',
                )}
                role="timer"
                aria-live="off"
              >
                <Timer size={16} aria-hidden="true" />
                {formatRemaining(remainingMs)}
              </span>
              <span className="text-caption sr-only" aria-live="polite">
                {remainingMs < 60_000 ? 'Less than one minute left to verify.' : ''}
              </span>
            </>
          ) : (
            <>
              <span className="roster-header__timer-label">Session ended</span>
              <span className="roster-header__timer-value">
                <CircleSlash size={16} aria-hidden="true" />
                {formatTime(session.endTime)}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="roster-progress">
        <Progress
          value={percentage}
          tone={percentage >= 75 ? 'success' : percentage >= 50 ? 'warning' : 'danger'}
          label={`Present ${formatNumber(presentCount)} of ${formatNumber(totalCount)}`}
        />
        <p className="text-caption">
          <strong>{formatPercent(percentage, 1)}</strong> of the expected class has verified.{' '}
          {formatNumber(Math.max(totalCount - presentCount, 0))} still outstanding.
        </p>
      </div>

      {roster.length === 0 ? (
        <Alert tone="warning" title="No students are expected in this class">
          The roster is built from students in semester {session.semester}, section{' '}
          {session.section} who are enrolled in {session.subject?.name ?? 'this subject'} and are
          active. Enrol students from the Subjects page to include them.
        </Alert>
      ) : null}

      {roster.length > 0 && !correctionsAvailable && onCorrect ? (
        <Alert tone="info" title="Corrections are not available for this session yet">
          Changing a mark calls <code className="text-mono">POST /api/attendance/correct</code>,
          which is keyed by an attendance record ID. The live roster endpoint returns status and
          time only, not record IDs, so there is nothing to key the correction on. The required
          addition (include <code className="text-mono">attendanceId</code> in each roster entry) is
          documented in <code className="text-mono">frontend/API_CONTRACT.md</code>; the control
          appears here automatically once the backend provides it.
        </Alert>
      ) : null}

      <div className="toolbar">
        <SearchInput
          className="toolbar__group"
          label="Search roster"
          placeholder="Search by name, student ID or roll number…"
          value={search}
          onChange={setSearch}
        />
        <div className="toolbar__actions" role="group" aria-label="Filter roster by status">
          <Button
            type="button"
            size="sm"
            variant={filter === 'ALL' ? 'primary' : 'secondary'}
            aria-pressed={filter === 'ALL'}
            onClick={() => setFilter('ALL')}
          >
            All ({counts.ALL})
          </Button>
          {ATTENDANCE_STATUS_OPTIONS.map((status) => (
            <Button
              key={status}
              type="button"
              size="sm"
              variant={filter === status ? 'primary' : 'secondary'}
              aria-pressed={filter === status}
              onClick={() => setFilter(status)}
            >
              {attendanceStatusMeta(status).label} ({counts[status]})
            </Button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="text-caption" style={{ textAlign: 'center', padding: 'var(--space-6) 0' }}>
          No students match this filter.
        </p>
      ) : (
        <ul className="roster">
          {visible.map((entry) => {
            const entryMeta = attendanceStatusMeta(entry.status);
            const attended = isCountedAsPresent(entry.status);
            const marked = entry.markedAt !== null;
            return (
              <li className="roster__item" key={entry.studentId}>
                <Avatar name={entry.fullName} size="sm" />
                <div className="roster__identity">
                  <span className="roster__name">{entry.fullName}</span>
                  <span className="text-caption text-mono">
                    {entry.studentCode} · Roll {entry.rollNumber}
                  </span>
                </div>
                <div className="roster__status">
                  <Badge tone={entryMeta.tone} dot>
                    {marked ? entryMeta.label : isActive ? 'Not marked yet' : entryMeta.label}
                  </Badge>
                  <span className="text-caption">
                    {marked
                      ? formatTime(entry.markedAt as string)
                      : isActive
                        ? 'Awaiting verification'
                        : 'Did not verify'}
                  </span>
                </div>
                {correctionsAvailable && marked ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<PenLine size={14} />}
                    onClick={() => onCorrect?.(entry)}
                  >
                    Correct
                  </Button>
                ) : null}
                <span className="sr-only">
                  {attended ? 'Counted as attended' : 'Not counted as attended'}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-caption row" style={{ gap: 'var(--space-2)', justifyContent: 'center' }}>
        {correctionsAvailable ? (
          <PenLine size={13} aria-hidden="true" />
        ) : (
          <ShieldCheck size={13} aria-hidden="true" />
        )}
        Every mark here was produced by the student’s own verification: geofence, face match,
        liveness and blink checks recorded by the backend.
        {roster.some((entry) => entry.status === 'PRESENT' || entry.status === 'LATE') ? (
          <CheckCircle2 size={13} aria-hidden="true" />
        ) : null}
      </p>

      {/* Screen-reader alternative to the visual status badges. */}
      <table className="sr-only">
        <caption>
          Roster for {session.subject?.name ?? 'session'} on {formatTime(session.startTime)}
        </caption>
        <thead>
          <tr>
            <th scope="col">Student</th>
            <th scope="col">Roll number</th>
            <th scope="col">Status</th>
            <th scope="col">Marked at</th>
          </tr>
        </thead>
        <tbody>
          {roster.map((entry) => (
            <tr key={entry.studentId}>
              <td>{entry.fullName}</td>
              <td>{entry.rollNumber}</td>
              <td>{attendanceStatusMeta(entry.status).label}</td>
              <td>{entry.markedAt ? formatTime(entry.markedAt) : 'not marked'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
