import { useEffect, useState } from 'react';
import { CalendarClock, CheckCircle2, Play, Radio, RefreshCw } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/StateBlock';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { LiveRegion } from '@/components/common/LiveRegion';
import { SessionCard } from '@/components/attendance/SessionCard';
import { StartSessionModal } from '@/components/attendance/StartSessionModal';
import { useToast } from '@/hooks/useToast';
import {
  useStopSession,
  useTeacherDashboard,
  useTeacherSessions,
  useTeacherSubjects,
} from '@/hooks/queries/useTeacherQueries';
import { usePolicy } from '@/hooks/queries/useAdminQueries';
import { useHealth } from '@/hooks/queries/useHealthQuery';
import { paths } from '@/routes/paths';
import { describeApiError } from '@/utils/apiError';
import { FALLBACK_MIN_ATTENDANCE_PERCENTAGE } from '@/utils/constants';
import { formatNumber } from '@/utils/format';
import type { AttendanceSession } from '@/types';

type SessionTab = 'ACTIVE' | 'ENDED' | 'ALL';

/**
 * The teacher's attendance control room: start a session, watch it fill up and
 * stop it.
 *
 * Endpoints used:
 *   GET  /teacher/subjects            -> what the teacher may run
 *   GET  /teacher/dashboard           -> rooms seen in recent sessions + counts
 *   GET  /attendance/sessions/teacher -> session lists by status (auto-refreshed)
 *   POST /attendance/sessions         -> start
 *   POST /attendance/sessions/:id/stop-> stop
 *
 * Attendance itself is never typed by the teacher: the backend builds the
 * expected roster from semester + section + enrolment and each student marks
 * themselves through geofence, face, liveness and blink verification.
 */
export function TeacherAttendancePage() {
  const toast = useToast();
  const health = useHealth();

  const dashboard = useTeacherDashboard();
  const subjects = useTeacherSubjects();
  const policy = usePolicy();

  const [tab, setTab] = useState<SessionTab>('ACTIVE');
  const sessions = useTeacherSessions(tab === 'ALL' ? undefined : tab);

  const [startOpen, setStartOpen] = useState(false);
  const [stopping, setStopping] = useState<AttendanceSession | null>(null);

  const stopSession = useStopSession();

  useEffect(() => {
    if (health.data?.dependencies.aiService === 'down') {
      toast.warning(
        'Face verification service is down',
        'Students will not be able to complete verification until the AI service is back. You can still open a session.',
      );
    }
  }, [health.data?.dependencies.aiService, toast]);

  const handleStop = async () => {
    if (!stopping) return;
    try {
      await stopSession.mutateAsync(stopping.id);
      toast.success('Session ended', 'No further verifications will be accepted for this class.');
      setStopping(null);
    } catch (error) {
      toast.error('Could not stop the session', describeApiError(error));
    }
  };

  const items = sessions.data ?? [];
  const activeCount = dashboard.data?.activeSessions ?? 0;
  const subjectCount = dashboard.data?.subjectCount ?? 0;
  const hasSubjects = (subjects.data ?? []).length > 0;

  return (
    <>
      <PageHeader
        title="Attendance sessions"
        subtitle="Open a session for your class, watch students verify in real time and close it when the period ends."
        actions={
          <div className="row">
            <Button
              variant="secondary"
              icon={<RefreshCw size={16} />}
              onClick={() => void sessions.refetch()}
              isLoading={sessions.isFetching}
              loadingText="Refreshing…"
            >
              Refresh
            </Button>
            <Button
              icon={<Play size={16} />}
              onClick={() => setStartOpen(true)}
              disabled={!hasSubjects}
              title={hasSubjects ? undefined : 'You need an assigned subject first'}
            >
              Start session
            </Button>
          </div>
        }
      />

      {health.data?.dependencies.aiService === 'down' ? (
        <Alert tone="warning" title="Face verification service unavailable">
          The AI service that performs face matching, liveness and blink analysis is not responding.
          Students will be blocked at the verification step with a clear message. Sessions you start
          now will still record the geofence check.
        </Alert>
      ) : null}

      {!hasSubjects && !subjects.isPending ? (
        <Alert tone="warning" title="No subjects assigned to you">
          An administrator assigns subjects from <strong>Admin → Subjects → Assign teacher</strong>.
          Until then the backend rejects every attempt to open a session with{' '}
          <code className="text-mono">NOT_ASSIGNED</code>.
        </Alert>
      ) : null}

      <div className="stat-grid">
        <StatCard
          label="Active now"
          value={formatNumber(activeCount)}
          icon={<Radio size={18} />}
          tone={activeCount > 0 ? 'success' : 'neutral'}
          isLoading={dashboard.isPending}
          meta="Sessions currently open for verification"
        />
        <StatCard
          label="Sessions today"
          value={formatNumber(dashboard.data?.totalSessionsToday ?? 0)}
          icon={<CalendarClock size={18} />}
          isLoading={dashboard.isPending}
          meta="Started since midnight"
        />
        <StatCard
          label="Subjects assigned"
          value={formatNumber(subjectCount)}
          icon={<CheckCircle2 size={18} />}
          isLoading={dashboard.isPending}
          to={paths.teacher.subjects}
          meta="Subjects you may run sessions for"
        />
        <StatCard
          label="Marks in recent sessions"
          value={formatNumber(
            (dashboard.data?.recentSessions ?? []).reduce(
              (total, session) => total + (session._count?.attendanceRecords ?? 0),
              0,
            ),
          )}
          icon={<CheckCircle2 size={18} />}
          isLoading={dashboard.isPending}
          tone="primary"
          to={paths.teacher.attendanceHistory}
          meta={`Across your last ${formatNumber(dashboard.data?.recentSessions?.length ?? 0)} sessions`}
        />
      </div>

      <Tabs<SessionTab>
        ariaLabel="Sessions by status"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'ACTIVE', label: 'Active', icon: <Radio size={15} /> },
          { value: 'ENDED', label: 'Ended', icon: <CalendarClock size={15} /> },
          { value: 'ALL', label: 'All recent', icon: <CheckCircle2 size={15} /> },
        ]}
      />

      <div className="stack stack-3" style={{ marginTop: 'var(--space-4)' }}>
        {sessions.isPending ? (
          <>
            <SessionSkeleton />
            <SessionSkeleton />
          </>
        ) : sessions.isError ? (
          <Card>
            <ErrorState
              error={sessions.error}
              onRetry={() => void sessions.refetch()}
              title="Sessions could not be loaded"
            />
          </Card>
        ) : items.length === 0 ? (
          <EmptyState
            title={tab === 'ACTIVE' ? 'No session is running' : 'No sessions found'}
            message={
              tab === 'ACTIVE'
                ? 'Start a session for the class you are teaching now. Students get notified and can verify from their phones.'
                : 'Sessions you start will be listed here with their rosters.'
            }
            actionLabel={hasSubjects ? 'Start session' : undefined}
            onAction={hasSubjects ? () => setStartOpen(true) : undefined}
          />
        ) : (
          items.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              detailPath={paths.teacher.sessionDetail(session.id)}
              onStop={() => setStopping(session)}
              isStopping={stopSession.isPending && stopSession.variables === session.id}
            />
          ))
        )}
      </div>

      <LiveRegion>
        {sessions.isSuccess
          ? `${formatNumber(items.length)} ${tab.toLowerCase()} sessions. ${formatNumber(
              activeCount,
            )} currently active.`
          : ''}
      </LiveRegion>

      <Card style={{ marginTop: 'var(--space-4)' }}>
        <CardBody>
          <p className="text-caption">
            Minimum attendance for your students is set by the institution policy
            {policy.data
              ? ` (currently ${policy.data.minAttendancePercentage}%).`
              : ` (using the ${FALLBACK_MIN_ATTENDANCE_PERCENTAGE}% default until the policy loads).`}{' '}
            Sessions automatically expire when their end time passes, so you never leave a class
            open by accident.
          </p>
        </CardBody>
      </Card>

      <StartSessionModal
        open={startOpen}
        onClose={() => setStartOpen(false)}
        onStarted={() => setTab('ACTIVE')}
      />

      <ConfirmDialog
        open={stopping !== null}
        title="End this session?"
        message={
          stopping
            ? `${stopping.subject?.name ?? 'This session'} for semester ${stopping.semester}, section ${stopping.section} will close immediately. Students who have not verified will be recorded as absent.`
            : ''
        }
        confirmLabel="End session"
        tone="danger"
        isPending={stopSession.isPending}
        pendingLabel="Ending session…"

        onConfirm={() => void handleStop()}
        onCancel={() => setStopping(null)}
      />
    </>
  );
}

function SessionSkeleton() {
  return (
    <Card>
      <CardBody>
        <div className="stack stack-3">
          <Skeleton width="8rem" height="1.25rem" />
          <Skeleton width="45%" height="1rem" />
          <Skeleton width="70%" height="0.85rem" />
          <Skeleton width="100%" height="0.5rem" />
        </div>
      </CardBody>
    </Card>
  );
}
