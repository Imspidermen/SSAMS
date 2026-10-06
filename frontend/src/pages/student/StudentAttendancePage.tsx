import { useEffect, useMemo, useState } from 'react';
import {
  CalendarCheck2,
  CheckCircle2,
  Clock3,
  DoorOpen,
  Eye,
  Fingerprint,
  Info,
  MapPin,
  Play,
  Radio,
  ScanFace,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/StateBlock';
import { PageHeader } from '@/components/common/PageHeader';
import { LiveRegion } from '@/components/common/LiveRegion';
import { VerificationPipeline } from '@/components/attendance/VerificationPipeline';
import { useToast } from '@/hooks/useToast';
import {
  useActiveSessions,
  useFaceStatus,
  useMyAttendance,
} from '@/hooks/queries/useStudentQueries';
import { useHealth } from '@/hooks/queries/useHealthQuery';
import { useCountdown, formatRemaining } from '@/hooks/useCountdown';
import { paths } from '@/routes/paths';
import { describeApiError } from '@/utils/apiError';
import { formatDistance, formatNumber, formatPercent, formatTime } from '@/utils/format';
import { cn } from '@/utils/cn';
import type { AttendanceRecord, AttendanceSession } from '@/types';

/**
 * Mark attendance.
 *
 * GET /attendance/sessions returns only the sessions this student is genuinely
 * eligible for (matching semester, section, subject enrolment, active window),
 * each flagged with `alreadyMarked`. Selecting one runs the real verification
 * pipeline; the backend decides every outcome.
 */
export function StudentAttendancePage() {
  const toast = useToast();
  const sessions = useActiveSessions();
  const face = useFaceStatus();
  const health = useHealth();
  const attendance = useMyAttendance();

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const items = useMemo(() => sessions.data ?? [], [sessions.data]);
  const open = useMemo(() => items.filter((session) => !session.alreadyMarked), [items]);
  const done = useMemo(() => items.filter((session) => session.alreadyMarked), [items]);

  // Auto-select the session that closes soonest - the one at risk of being missed.
  useEffect(() => {
    if (selectedId && open.some((session) => session.id === selectedId)) return;
    if (open.length > 0) {
      const soonest = [...open].sort(
        (a, b) => new Date(a.endTime).getTime() - new Date(b.endTime).getTime(),
      )[0];
      setSelectedId(soonest.id);
    } else {
      setSelectedId(null);
    }
  }, [open, selectedId]);

  const selected = open.find((session) => session.id === selectedId) ?? null;
  const enrolled = face.data?.status === 'ENROLLED';
  const overview = attendance.data;

  const handleCompleted = (record: AttendanceRecord) => {
    toast.success(
      'Attendance marked',
      `${record.status} recorded at ${formatTime(record.markedAt)}.`,
    );
    setSelectedId(null);
  };

  const handleClosed = (reason: string) => {
    toast.info('Session closed', reason);
    setSelectedId(null);
  };

  return (
    <>
      <PageHeader
        title="Mark attendance"
        subtitle="Verify that you are physically in the room - the backend records the mark for you."
        actions={
          <ButtonLink
            to={paths.student.attendanceHistory}
            variant="secondary"
            icon={<CalendarCheck2 size={16} />}
          >
            My history
          </ButtonLink>
        }
      />

      {health.data?.dependencies.aiService === 'down' ? (
        <Alert tone="error" title="Verification service unavailable">
          The face-analysis service is not responding, so verification cannot complete. Your
          location check will still be recorded by the backend, but attendance needs every required
          check to pass. Try again in a few minutes and tell your teacher if it persists.
        </Alert>
      ) : null}

      {!enrolled && !face.isPending ? (
        <Alert tone="warning" title="Enrol your face first" icon={<Fingerprint size={17} />}>
          Attendance verification always includes a face match, and the backend rejects it with{' '}
          <code className="text-mono">FACE_NOT_ENROLLED</code> until you enrol. It takes about a
          minute.
          <div style={{ marginTop: 'var(--space-3)' }}>
            <ButtonLink to={paths.student.face} size="sm" icon={<ScanFace size={15} />}>
              Go to face enrolment
            </ButtonLink>
          </div>
        </Alert>
      ) : null}

      <div className="profile-columns">
        <div className="stack stack-4">
          <Card>
            <CardHeader
              title="Sessions open for you"
              subtitle="Only classes you belong to, while their window is open."
              headingLevel={2}
              actions={
                <Badge tone={open.length > 0 ? 'success' : 'neutral'} dot>
                  {formatNumber(open.length)} open
                </Badge>
              }
            />
            <CardBody>
              {sessions.isPending ? (
                <div className="stack stack-3">
                  <SessionSkeleton />
                  <SessionSkeleton />
                </div>
              ) : sessions.isError ? (
                <ErrorState
                  error={sessions.error}
                  onRetry={() => void sessions.refetch()}
                  hint="This list is refreshed automatically while the page is open."
                />
              ) : items.length === 0 ? (
                <EmptyState
                  title="No session is open right now"
                  message="When your teacher starts a class you will see it here and can verify immediately. The list refreshes automatically."
                />
              ) : (
                <div className="stack stack-3">
                  <ul className="session-picker">
                    {items.map((session) => (
                      <SessionOption
                        key={session.id}
                        session={session}
                        selected={session.id === selectedId}
                        onSelect={() => setSelectedId(session.id)}
                      />
                    ))}
                  </ul>

                  {done.length > 0 ? (
                    <p className="text-caption">
                      {formatNumber(done.length)} of these classes are already marked for you. The
                      backend allows one record per student per session.
                    </p>
                  ) : null}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="How verification works"
              subtitle="Four backend checks - none of them happen in your browser."
              headingLevel={2}
              actions={<Info size={17} aria-hidden="true" />}
            />
            <CardBody>
              <ol className="stepper">
                {[
                  {
                    icon: <MapPin size={17} />,
                    title: 'Location',
                    detail: 'Your coordinates are measured against the classroom geofence.',
                  },
                  {
                    icon: <ScanFace size={17} />,
                    title: 'Face match',
                    detail: 'A camera frame is compared with your enrolled face profile.',
                  },
                  {
                    icon: <ShieldCheck size={17} />,
                    title: 'Liveness',
                    detail: 'A head-turn challenge proves a real person is present.',
                  },
                  {
                    icon: <Eye size={17} />,
                    title: 'Blink',
                    detail: 'A natural blink is detected from a short burst of frames.',
                  },
                ].map((step, index) => (
                  <li className="stepper__item" key={step.title}>
                    <span className="stepper__index" aria-hidden="true">
                      {index + 1}
                    </span>
                    <span className="stepper__icon" aria-hidden="true">
                      {step.icon}
                    </span>
                    <span className="stepper__body">
                      <strong>{step.title}</strong>
                      <span className="text-caption">{step.detail}</span>
                    </span>
                  </li>
                ))}
              </ol>
              <p className="text-caption">
                Only after every required check passes does the backend write your attendance
                record. Failed attempts are limited per session, and the whole verification expires
                after a few minutes so it cannot be reused.
              </p>
            </CardBody>
          </Card>
        </div>

        <div className="stack stack-4">
          {selected ? (
            <Card>
              <CardHeader
                title={selected.subject?.name ?? 'Session'}
                subtitle={`${selected.classroom?.name ?? 'Classroom'} · Semester ${selected.semester} · Section ${selected.section}`}
                headingLevel={2}
                actions={<SessionCountdown session={selected} />}
              />
              <CardBody>
                {!enrolled ? (
                  <Alert tone="warning" title="Face enrolment required">
                    Complete enrolment first - the face step cannot pass without it.
                  </Alert>
                ) : null}
                <VerificationPipeline
                  session={selected}
                  onCompleted={handleCompleted}
                  onClosed={handleClosed}
                />
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardBody>
                <EmptyState
                  title={open.length === 0 ? 'Nothing to mark right now' : 'Choose a session'}
                  message={
                    open.length === 0
                      ? 'Pick a class from the list when your teacher opens one. Already-marked classes cannot be marked twice.'
                      : 'Select an open session on the left to start verifying.'
                  }
                />
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader
              title="Your standing"
              subtitle="Updated as soon as a mark is recorded."
              headingLevel={2}
            />
            <CardBody>
              {attendance.isPending ? (
                <div className="stack stack-3">
                  <Skeleton width="60%" height="1.5rem" />
                  <Skeleton width="100%" height="1rem" />
                </div>
              ) : attendance.isError ? (
                <Alert tone="error">{describeApiError(attendance.error)}</Alert>
              ) : (
                <dl className="stat-lines">
                  <div className="stat-line">
                    <dt>Overall attendance</dt>
                    <dd>
                      <strong>{formatPercent(overview?.overall.percentage ?? 0, 1)}</strong>
                      <span className="text-caption">
                        {formatNumber(overview?.overall.present ?? 0)}/
                        {formatNumber(overview?.overall.total ?? 0)} classes
                      </span>
                    </dd>
                  </div>
                  <div className="stat-line">
                    <dt>Minimum required</dt>
                    <dd>
                      <strong>{formatPercent(overview?.minAttendancePercentage ?? 0, 0)}</strong>
                      <span className="text-caption">set by your institution</span>
                    </dd>
                  </div>
                  <div className="stat-line">
                    <dt>Subjects below minimum</dt>
                    <dd>
                      <strong>
                        {formatNumber(
                          (overview?.subjectWise ?? []).filter((entry) => entry.belowThreshold)
                            .length,
                        )}
                      </strong>
                      <span className="text-caption">need attention</span>
                    </dd>
                  </div>
                </dl>
              )}
              <div style={{ marginTop: 'var(--space-3)' }}>
                <ButtonLink to={paths.student.attendanceHistory} variant="secondary" size="sm">
                  Subject-wise breakdown
                </ButtonLink>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      <LiveRegion>
        {sessions.isSuccess
          ? `${formatNumber(open.length)} sessions open, ${formatNumber(done.length)} already marked.`
          : ''}
      </LiveRegion>
    </>
  );
}

function SessionOption({
  session,
  selected,
  onSelect,
}: {
  session: AttendanceSession;
  selected: boolean;
  onSelect: () => void;
}) {
  const marked = Boolean(session.alreadyMarked);

  return (
    <li>
      <button
        type="button"
        className={cn('session-option', selected && 'session-option--selected')}
        onClick={onSelect}
        aria-pressed={selected}
        disabled={marked}
      >
        <span className="session-option__icon" aria-hidden="true">
          {marked ? <CheckCircle2 size={17} /> : <Radio size={17} />}
        </span>
        <span className="session-option__body">
          <span className="session-option__title">
            {session.subject?.name ?? 'Class'}
            {session.subject?.code ? (
              <span className="text-caption"> · {session.subject.code}</span>
            ) : null}
          </span>
          <span className="session-option__meta">
            <span className="row" style={{ gap: 'var(--space-1)' }}>
              <DoorOpen size={12} aria-hidden="true" />
              {session.classroom?.name ?? 'Room'}
              {session.geofenceRadiusM ? ` · ${formatDistance(session.geofenceRadiusM)}` : ''}
            </span>
            <span className="row" style={{ gap: 'var(--space-1)' }}>
              <Clock3 size={12} aria-hidden="true" />
              {formatTime(session.startTime)} – {formatTime(session.endTime)}
            </span>
            <span className="row" style={{ gap: 'var(--space-1)' }}>
              <Users size={12} aria-hidden="true" />
              Sem {session.semester} · Sec {session.section}
            </span>
          </span>
        </span>
        <span className="session-option__action">
          {marked ? (
            <Badge tone="success" dot>
              Already marked
            </Badge>
          ) : selected ? (
            <Badge tone="primary">Selected</Badge>
          ) : (
            <span className="text-caption row" style={{ gap: 'var(--space-1)' }}>
              <Play size={12} aria-hidden="true" />
              Verify
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

function SessionCountdown({ session }: { session: AttendanceSession }) {
  const remaining = useCountdown(session.endTime, true);
  const urgent = remaining < 120_000;

  return (
    <Badge tone={urgent ? 'danger' : 'info'} icon={<Clock3 size={12} />}>
      {urgent ? 'Closing soon · ' : ''}
      {formatRemaining(remaining)} left
    </Badge>
  );
}

function SessionSkeleton() {
  return (
    <div className="session-option" aria-hidden="true">
      <Skeleton variant="circle" width="2.25rem" height="2.25rem" />
      <span className="session-option__body">
        <Skeleton width="55%" height="0.95rem" />
        <Skeleton width="80%" height="0.8rem" />
      </span>
    </div>
  );
}
