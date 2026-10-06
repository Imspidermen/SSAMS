import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Info, Play, Users, UserX } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { RawSelect } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/StateBlock';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { LiveRegion } from '@/components/common/LiveRegion';
import { LiveRosterPanel } from '@/components/attendance/LiveRosterPanel';
import { CorrectionDialog } from '@/components/attendance/CorrectionDialog';
import { StartSessionModal } from '@/components/attendance/StartSessionModal';
import { useToast } from '@/hooks/useToast';
import {
  useCorrectAttendance,
  useLiveAttendance,
  useTeacherSessions,
  useTeacherSubjects,
} from '@/hooks/queries/useTeacherQueries';
import { paths } from '@/routes/paths';
import { sessionStatusMeta } from '@/utils/attendance';
import { describeApiError } from '@/utils/apiError';
import { formatDate, formatNumber, formatPercent, formatTime } from '@/utils/format';
import type { AttendanceStatus, RosterEntry } from '@/types';

/**
 * Class rosters for the signed-in teacher.
 *
 * The authoritative roster (expected students, who verified, who did not) comes
 * from GET /attendance/sessions/:id/live, which works for ended sessions too and
 * is restricted to the teacher's own sessions. The session list comes from
 * GET /attendance/sessions/teacher.
 *
 * BACKEND GAP: there is no teacher endpoint that lists the students enrolled in
 * a subject outside of a session (e.g. `GET /teacher/students?subjectId=`), so
 * rosters are always shown per session. That requirement is documented in
 * API_CONTRACT.md instead of being filled with invented data.
 */
export function TeacherStudentsPage() {
  const toast = useToast();
  const subjects = useTeacherSubjects();
  const sessions = useTeacherSessions();

  const [subjectFilter, setSubjectFilter] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [polling, setPolling] = useState(true);
  const [correcting, setCorrecting] = useState<RosterEntry | null>(null);
  const [startOpen, setStartOpen] = useState(false);

  const correctAttendance = useCorrectAttendance();

  const visibleSessions = useMemo(() => {
    const items = sessions.data ?? [];
    return subjectFilter ? items.filter((session) => session.subjectId === subjectFilter) : items;
  }, [sessions.data, subjectFilter]);

  // Default to the most recent session (the list is ordered newest first).
  useEffect(() => {
    if (sessionId && visibleSessions.some((session) => session.id === sessionId)) return;
    if (visibleSessions.length > 0) setSessionId(visibleSessions[0].id);
  }, [visibleSessions, sessionId]);

  const live = useLiveAttendance(sessionId || undefined, polling);
  const status = live.data?.session.status;

  useEffect(() => {
    if (!status) return;
    setPolling(status === 'ACTIVE' || status === 'SCHEDULED');
  }, [status]);

  const roster = live.data?.roster ?? [];
  const presentCount = live.data?.presentCount ?? 0;
  const totalCount = live.data?.totalCount ?? 0;
  const absentCount = Math.max(totalCount - presentCount, 0);
  const percentage = totalCount > 0 ? Math.round((presentCount / totalCount) * 1000) / 10 : 0;

  const handleCorrect = async (values: {
    attendanceId: string;
    newStatus: AttendanceStatus;
    reason: string;
  }) => {
    try {
      await correctAttendance.mutateAsync(values);
      setCorrecting(null);
      toast.success(
        'Attendance corrected',
        'The change and your reason were written to the audit trail.',
      );
    } catch (error) {
      toast.error('Correction failed', describeApiError(error));
    }
  };

  return (
    <>
      <PageHeader
        title="My class rosters"
        subtitle="The students expected in each class you ran, and what each of them did."
        actions={
          <div className="row">
            <ButtonLink
              to={paths.teacher.attendance}
              variant="secondary"
              icon={<CalendarClock size={16} />}
            >
              Sessions
            </ButtonLink>
            <Button
              icon={<Play size={16} />}
              onClick={() => setStartOpen(true)}
              disabled={(subjects.data ?? []).length === 0}
            >
              Start session
            </Button>
          </div>
        }
      />

      <Alert tone="info" title="Rosters are per session" icon={<Info size={17} />}>
        A roster is built by the backend from the semester, section and subject enrolment of one
        session, so it always matches exactly who was expected in that class. The API does not
        expose a subject-wide student list to teachers outside a session; the required endpoint is
        documented in <code className="text-mono">frontend/API_CONTRACT.md</code>.
      </Alert>

      <Card>
        <CardHeader
          title="Choose a session"
          subtitle="Newest first, including ended sessions."
          headingLevel={2}
        />
        <CardBody>
          {sessions.isPending ? (
            <Skeleton width="100%" height="2.5rem" />
          ) : sessions.isError ? (
            <ErrorState error={sessions.error} onRetry={() => void sessions.refetch()} />
          ) : visibleSessions.length === 0 ? (
            <EmptyState
              title={subjectFilter ? 'No sessions for this subject' : 'No sessions yet'}
              message={
                subjectFilter
                  ? 'Clear the subject filter, or run a session for this subject first.'
                  : 'Start a session and the expected roster appears here automatically.'
              }
              actionLabel={subjectFilter ? 'Clear filter' : undefined}
              onAction={subjectFilter ? () => setSubjectFilter('') : undefined}
            />
          ) : (
            <div className="toolbar">
              <div className="toolbar__group">
                <label className="field__label" htmlFor="roster-session">
                  Session
                </label>
                <RawSelect
                  id="roster-session"
                  value={sessionId}
                  onChange={(event) => {
                    setSessionId(event.target.value);
                    setPolling(true);
                  }}
                >
                  {visibleSessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {formatDate(session.startTime)} · {formatTime(session.startTime)} —{' '}
                      {session.subject?.name ?? 'Subject'} · Sem {session.semester} Sec{' '}
                      {session.section} · {sessionStatusMeta(session.status).label}
                    </option>
                  ))}
                </RawSelect>
              </div>

              <div className="toolbar__group">
                <label className="field__label" htmlFor="roster-subject-filter">
                  Subject
                </label>
                <RawSelect
                  id="roster-subject-filter"
                  value={subjectFilter}
                  onChange={(event) => {
                    setSubjectFilter(event.target.value);
                    setSessionId('');
                  }}
                >
                  <option value="">All subjects</option>
                  {(subjects.data ?? []).map((assignment) => (
                    <option key={assignment.id} value={assignment.subjectId}>
                      {assignment.subject?.name ?? 'Subject'}
                      {assignment.subject?.code ? ` (${assignment.subject.code})` : ''}
                    </option>
                  ))}
                </RawSelect>
              </div>

              <div className="toolbar__actions">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void live.refetch()}
                  isLoading={live.isFetching}
                  loadingText="Refreshing…"
                  disabled={!sessionId}
                >
                  Refresh roster
                </Button>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {sessionId ? (
        <>
          <div className="stat-grid" style={{ marginTop: 'var(--space-4)' }}>
            <StatCard
              label="Expected in class"
              value={formatNumber(totalCount)}
              icon={<Users size={18} />}
              isLoading={live.isPending}
              meta="Students enrolled in this semester, section and subject"
            />
            <StatCard
              label="Verified present"
              value={formatNumber(presentCount)}
              icon={<Users size={18} />}
              tone="success"
              isLoading={live.isPending}
              meta={formatPercent(percentage, 1)}
            />
            <StatCard
              label="Not verified"
              value={formatNumber(absentCount)}
              icon={<UserX size={18} />}
              tone={absentCount > 0 ? 'danger' : 'success'}
              isLoading={live.isPending}
              meta={
                status === 'ACTIVE'
                  ? 'Still able to verify while the session is open'
                  : 'Recorded as absent for this session'
              }
            />
            <StatCard
              label="Attendance rate"
              value={formatPercent(percentage, 1)}
              icon={<CalendarClock size={18} />}
              tone={percentage >= 75 ? 'success' : percentage >= 50 ? 'warning' : 'danger'}
              isLoading={live.isPending}
              to={paths.teacher.sessionDetail(sessionId)}
              meta="For this session only"
            />
          </div>

          <Card style={{ marginTop: 'var(--space-4)' }}>
            <CardBody>
              {live.isPending ? (
                <div className="stack stack-3">
                  <Skeleton width="45%" height="1.5rem" />
                  <Skeleton width="100%" height="3rem" />
                  <Skeleton width="100%" height="3rem" />
                  <Skeleton width="100%" height="3rem" />
                </div>
              ) : live.isError ? (
                <ErrorState
                  error={live.error}
                  onRetry={() => void live.refetch()}
                  title="Roster unavailable"
                  hint="Rosters are only visible for sessions you started."
                />
              ) : live.data ? (
                <LiveRosterPanel
                  session={live.data.session}
                  roster={roster}
                  presentCount={presentCount}
                  totalCount={totalCount}
                  isLive={polling}
                  isFetching={live.isFetching}
                  onCorrect={(entry) => setCorrecting(entry)}
                />
              ) : null}
            </CardBody>
          </Card>

          <LiveRegion>
            {live.isSuccess
              ? `${formatNumber(presentCount)} of ${formatNumber(totalCount)} students verified for the selected session.`
              : ''}
          </LiveRegion>
        </>
      ) : null}

      <CorrectionDialog
        open={correcting !== null}
        entry={correcting}
        isSubmitting={correctAttendance.isPending}
        error={correctAttendance.isError ? correctAttendance.error : null}
        onClose={() => !correctAttendance.isPending && setCorrecting(null)}
        onSubmit={(values) => void handleCorrect(values)}
      />

      <StartSessionModal open={startOpen} onClose={() => setStartOpen(false)} />
    </>
  );
}
