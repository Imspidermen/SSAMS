import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarClock, RefreshCw, Square } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/StateBlock';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { PageHeader } from '@/components/common/PageHeader';
import { LiveRegion } from '@/components/common/LiveRegion';
import { LiveRosterPanel } from '@/components/attendance/LiveRosterPanel';
import { CorrectionDialog } from '@/components/attendance/CorrectionDialog';
import { useToast } from '@/hooks/useToast';
import {
  useCorrectAttendance,
  useLiveAttendance,
  useStopSession,
} from '@/hooks/queries/useTeacherQueries';
import { paths } from '@/routes/paths';
import { describeApiError } from '@/utils/apiError';
import { formatDateTime, formatNumber, formatPercent } from '@/utils/format';
import type { AttendanceStatus, RosterEntry } from '@/types';

/**
 * One session's live roster.
 *
 * GET /attendance/sessions/:id/live is scoped to the signed-in teacher (403 for
 * anyone else's session) and keeps working after the session ends, so this page
 * doubles as the post-class record. It polls while the session is ACTIVE and
 * stops polling once it ends.
 */
export function SessionDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [polling, setPolling] = useState(true);
  const live = useLiveAttendance(id, polling);
  const stopSession = useStopSession();
  const correctAttendance = useCorrectAttendance();

  const [stopping, setStopping] = useState(false);
  const [correcting, setCorrecting] = useState<RosterEntry | null>(null);

  const session = live.data?.session;
  const status = session?.status;

  useEffect(() => {
    if (!status) return;
    // Keep polling only while students can still verify.
    setPolling(status === 'ACTIVE' || status === 'SCHEDULED');
  }, [status]);

  const handleStop = async () => {
    try {
      await stopSession.mutateAsync(id);
      setStopping(false);
      toast.success('Session ended', 'The roster is now final.');
    } catch (error) {
      toast.error('Could not stop the session', describeApiError(error));
    }
  };

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

  if (live.isPending) {
    return (
      <>
        <PageHeader title="Session roster" subtitle="Loading the live roster…" />
        <Card>
          <CardBody className="stack stack-4">
            <Skeleton width="40%" height="1.5rem" />
            <Skeleton width="100%" height="1rem" />
            <Skeleton width="100%" height="4rem" />
            <Skeleton width="100%" height="4rem" />
            <Skeleton width="100%" height="4rem" />
          </CardBody>
        </Card>
      </>
    );
  }

  if (live.isError) {
    return (
      <>
        <PageHeader
          title="Session roster"
          subtitle="This session could not be opened."
          actions={
            <ButtonLink
              to={paths.teacher.attendance}
              variant="secondary"
              icon={<ArrowLeft size={16} />}
            >
              Back to sessions
            </ButtonLink>
          }
        />
        <Card>
          <ErrorState
            error={live.error}
            onRetry={() => void live.refetch()}
            title="Roster unavailable"
            hint="You can only open rosters for sessions you started. If this session belongs to another teacher the backend rejects the request."
          />
        </Card>
      </>
    );
  }

  if (!live.data || !session) {
    return (
      <>
        <PageHeader title="Session roster" />
        <Alert tone="error" title="No session data">
          The backend returned no session for this identifier.
        </Alert>
      </>
    );
  }

  const { roster, presentCount, totalCount } = live.data;
  const percentage = totalCount > 0 ? Math.round((presentCount / totalCount) * 1000) / 10 : 0;

  return (
    <>
      <PageHeader
        title={session.subject?.name ?? 'Session roster'}
        subtitle={`Semester ${session.semester} · Section ${session.section} · started ${formatDateTime(session.startTime)}`}
        actions={
          <div className="row">
            <Button
              variant="secondary"
              icon={<RefreshCw size={16} />}
              onClick={() => void live.refetch()}
              isLoading={live.isFetching}
              loadingText="Refreshing…"
            >
              Refresh
            </Button>
            {session.status === 'ACTIVE' ? (
              <Button
                variant="danger"
                icon={<Square size={16} />}
                onClick={() => setStopping(true)}
              >
                Stop session
              </Button>
            ) : null}
            <ButtonLink
              to={paths.teacher.attendance}
              variant="ghost"
              icon={<ArrowLeft size={16} />}
            >
              All sessions
            </ButtonLink>
          </div>
        }
      />

      {session.status === 'ENDED' ? (
        <Alert tone="neutral" title="This session has ended" icon={<CalendarClock size={17} />}>
          The roster below is final. Students who did not complete verification are recorded as
          absent by the backend.
        </Alert>
      ) : null}

      <Card>
        <CardBody>
          <LiveRosterPanel
            session={session}
            roster={roster}
            presentCount={presentCount}
            totalCount={totalCount}
            isLive={polling}
            isFetching={live.isFetching}
            onCorrect={(entry) => setCorrecting(entry)}
          />
        </CardBody>
      </Card>

      <Card style={{ marginTop: 'var(--space-4)' }}>
        <CardBody>
          <p className="text-caption">
            <strong>{formatNumber(presentCount)}</strong> of{' '}
            <strong>{formatNumber(totalCount)}</strong> expected students verified (
            {formatPercent(percentage, 1)}). These figures are computed by the backend from the
            session roster, so they match what students see on their own dashboards.
          </p>
        </CardBody>
      </Card>

      <LiveRegion>
        {`${formatNumber(presentCount)} of ${formatNumber(totalCount)} students verified.`}
      </LiveRegion>

      <CorrectionDialog
        open={correcting !== null}
        entry={correcting}
        isSubmitting={correctAttendance.isPending}
        error={correctAttendance.isError ? correctAttendance.error : null}
        onClose={() => !correctAttendance.isPending && setCorrecting(null)}
        onSubmit={(values) => void handleCorrect(values)}
      />

      <ConfirmDialog
        open={stopping}
        title="End this session?"
        message="Students who have not verified will be recorded as absent and no further marks can be added."
        confirmLabel="End session"
        tone="danger"
        isPending={stopSession.isPending}
        pendingLabel="Ending session…"
        onConfirm={() => void handleStop()}
        onCancel={() => setStopping(false)}
      />

      <p className="text-caption" style={{ textAlign: 'center', marginTop: 'var(--space-4)' }}>
        Need the permanent record?{' '}
        <ButtonLink to={paths.teacher.attendanceHistory} variant="ghost" size="sm">
          Open attendance history
        </ButtonLink>{' '}
        or navigate back with{' '}
        <Button variant="ghost" size="sm" onClick={() => navigate(paths.teacher.attendance)}>
          All sessions
        </Button>
        .
      </p>
    </>
  );
}
