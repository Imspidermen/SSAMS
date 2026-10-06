import { useMemo } from 'react';
import {
  AlertTriangle,
  CalendarCheck2,
  CalendarX2,
  CheckCircle2,
  Fingerprint,
  Play,
  Radio,
  ScanFace,
  TrendingDown,
} from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Gauge, Progress } from '@/components/ui/Progress';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/StateBlock';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { AttendanceIndicator } from '@/components/common/AttendanceIndicator';
import { LiveRegion } from '@/components/common/LiveRegion';
import { StatusBreakdownChart } from '@/components/dashboard/StatusBreakdownChart';
import { SubjectAttendanceChart } from '@/components/dashboard/SubjectAttendanceChart';
import { useAuth } from '@/hooks/useAuth';
import { useMyProfile } from '@/hooks/queries/useStudentQueries';
import {
  useActiveSessions,
  useFaceStatus,
  useMyAttendance,
} from '@/hooks/queries/useStudentQueries';
import { useHealth } from '@/hooks/queries/useHealthQuery';
import { paths } from '@/routes/paths';
import { attendanceStatusMeta, attendanceTone, faceStatusMeta } from '@/utils/attendance';
import { describeApiError } from '@/utils/apiError';
import { formatDateTime, formatNumber, formatPercent, formatTimeAgo } from '@/utils/format';

/**
 * Student home.
 *
 *   GET /students/me              -> profile
 *   GET /students/me/attendance   -> overall %, subject-wise %, history, minimum
 *   GET /attendance/sessions      -> sessions the student is eligible for now
 *   GET /face/status              -> whether verification can run at all
 *   GET /health                   -> whether the CV service is reachable
 *
 * Every figure is the backend's own arithmetic; the minimum attendance
 * percentage is whatever the institution configured, never a hard-coded 75.
 */
export function StudentDashboardPage() {
  const { user } = useAuth();
  const profile = useMyProfile();
  const attendance = useMyAttendance();
  const sessions = useActiveSessions();
  const face = useFaceStatus();
  const health = useHealth();

  const overview = attendance.data;
  const minimum = overview?.minAttendancePercentage ?? 0;
  const overall = overview?.overall;
  const percentage = overall?.percentage ?? 0;
  const belowMinimum = overview ? percentage < minimum : false;

  const statusCounts = useMemo(() => {
    const counts = { PRESENT: 0, LATE: 0, ABSENT: 0, EXCUSED: 0 };
    for (const record of overview?.history ?? []) counts[record.status] += 1;
    return counts;
  }, [overview?.history]);

  const subjectBars = useMemo(
    () =>
      (overview?.subjectWise ?? []).map((entry) => ({
        label: entry.subjectName,
        code: entry.subjectCode,
        percentage: entry.percentage,
        present: entry.present,
        total: entry.total,
      })),
    [overview?.subjectWise],
  );

  const weakSubjects = useMemo(
    () => (overview?.subjectWise ?? []).filter((entry) => entry.belowThreshold),
    [overview?.subjectWise],
  );

  const recent = (overview?.history ?? []).slice(0, 6);
  const eligibleSessions = (sessions.data ?? []).filter((session) => !session.alreadyMarked);
  const faceStatus = face.data?.status ?? 'NOT_ENROLLED';
  const firstName = user?.name ? user.name.split(' ')[0] : 'there';

  return (
    <>
      <PageHeader
        title={`Hello, ${firstName}`}
        subtitle="Your attendance, your classes and anything that needs marking right now."
        actions={
          <ButtonLink
            to={paths.student.attendance}
            variant="primary"
            icon={<CalendarCheck2 size={16} />}
          >
            Mark attendance
          </ButtonLink>
        }
      />

      {health.data?.dependencies.aiService === 'down' ? (
        <Alert tone="error" title="Face verification is temporarily unavailable">
          The service that checks your face is not responding, so attendance cannot be marked right
          now. Your existing records are unaffected - try again shortly or tell your teacher.
        </Alert>
      ) : null}

      {faceStatus !== 'ENROLLED' && !face.isPending ? (
        <Alert
          tone="warning"
          title={`Face enrolment ${faceStatusMeta(faceStatus).label.toLowerCase()}`}
          icon={<Fingerprint size={17} />}
        >
          You cannot mark attendance until your face is enrolled - the backend rejects verification
          with <code className="text-mono">FACE_NOT_ENROLLED</code>. It takes about a minute.
          <div style={{ marginTop: 'var(--space-3)' }}>
            <ButtonLink to={paths.student.face} size="sm" icon={<ScanFace size={15} />}>
              Enrol my face
            </ButtonLink>
          </div>
        </Alert>
      ) : null}

      {eligibleSessions.length > 0 ? (
        <Alert tone="success" title="A session is open for you now" icon={<Radio size={17} />}>
          {eligibleSessions.length === 1
            ? `${eligibleSessions[0].subject?.name ?? 'A class'} is taking attendance until ${formatDateTime(
                eligibleSessions[0].endTime,
              )}.`
            : `${formatNumber(eligibleSessions.length)} classes are taking attendance right now.`}
          <div style={{ marginTop: 'var(--space-3)' }}>
            <ButtonLink to={paths.student.attendance} size="sm" icon={<Play size={15} />}>
              Verify and mark
            </ButtonLink>
          </div>
        </Alert>
      ) : null}

      <div className="dashboard-split">
        <Card>
          <CardHeader
            title="Overall attendance"
            subtitle={`Institutional minimum is ${formatPercent(minimum, 0)}.`}
            headingLevel={2}
            actions={
              overall ? (
                <AttendanceIndicator percentage={percentage} threshold={minimum} compact />
              ) : undefined
            }
          />
          <CardBody>
            {attendance.isPending ? (
              <div className="stack stack-3" style={{ alignItems: 'center' }}>
                <Skeleton variant="circle" width="10.5rem" height="10.5rem" />
                <Skeleton width="60%" height="1rem" />
              </div>
            ) : attendance.isError ? (
              <ErrorState
                error={attendance.error}
                onRetry={() => void attendance.refetch()}
                hint="Your attendance is computed by the backend from your verified records."
              />
            ) : (
              <div className="stack stack-4" style={{ alignItems: 'center' }}>
                <Gauge
                  value={percentage}
                  tone={attendanceTone(percentage, minimum)}
                  caption="Overall attendance"
                />

                <dl className="stat-lines">
                  <div className="stat-line">
                    <dt>Classes attended</dt>
                    <dd>
                      <strong>{formatNumber(overall?.present ?? 0)}</strong>
                      <span className="text-caption">
                        of {formatNumber(overall?.total ?? 0)} held
                      </span>
                    </dd>
                  </div>
                  <div className="stat-line">
                    <dt>Classes missed</dt>
                    <dd>
                      <strong>{formatNumber(overall?.absent ?? 0)}</strong>
                      <span className="text-caption">marked absent</span>
                    </dd>
                  </div>
                  <div className="stat-line">
                    <dt>Required minimum</dt>
                    <dd>
                      <strong>{formatPercent(minimum, 0)}</strong>
                      <span className="text-caption">set by your institution</span>
                    </dd>
                  </div>
                </dl>

                {belowMinimum ? (
                  <Alert
                    tone="error"
                    title="You are below the required minimum"
                    icon={<TrendingDown size={17} />}
                  >
                    Attend your next classes consistently - the subject list below shows exactly how
                    many you need in each one to get back above {formatPercent(minimum, 0)}.
                  </Alert>
                ) : (
                  <Alert
                    tone="success"
                    title="You meet the attendance requirement"
                    icon={<CheckCircle2 size={17} />}
                  >
                    Keep it up - your percentage is {formatPercent(percentage - minimum, 1)} above
                    the minimum.
                  </Alert>
                )}

                <div
                  className="row"
                  style={{ gap: 'var(--space-2)', flexWrap: 'wrap', justifyContent: 'center' }}
                >
                  <ButtonLink to={paths.student.attendanceHistory} variant="secondary" size="sm">
                    Full history
                  </ButtonLink>
                  <ButtonLink to={paths.student.profile} variant="ghost" size="sm">
                    My profile
                  </ButtonLink>
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        <div className="stack stack-4">
          <div className="stat-grid stat-grid--two">
            <StatCard
              label="Classes attended"
              value={formatNumber(overall?.present ?? 0)}
              icon={<CalendarCheck2 size={18} />}
              tone="success"
              isLoading={attendance.isPending}
              meta={`Out of ${formatNumber(overall?.total ?? 0)} held`}
            />
            <StatCard
              label="Classes missed"
              value={formatNumber(overall?.absent ?? 0)}
              icon={<CalendarX2 size={18} />}
              tone={(overall?.absent ?? 0) > 0 ? 'danger' : 'neutral'}
              isLoading={attendance.isPending}
              meta="Marked absent by the system"
            />
            <StatCard
              label="Subjects below minimum"
              value={formatNumber(weakSubjects.length)}
              icon={<AlertTriangle size={18} />}
              tone={weakSubjects.length > 0 ? 'warning' : 'success'}
              isLoading={attendance.isPending}
              to={paths.student.attendanceHistory}
              meta={`Under ${formatPercent(minimum, 0)}`}
            />
            <StatCard
              label="Face profile"
              value={faceStatusMeta(faceStatus).label}
              icon={<Fingerprint size={18} />}
              tone={faceStatus === 'ENROLLED' ? 'success' : 'warning'}
              isLoading={face.isPending}
              to={paths.student.face}
              meta={
                face.data?.sampleCount
                  ? `${formatNumber(face.data.sampleCount)} samples stored`
                  : 'Required to mark attendance'
              }
            />
          </div>

          <Card>
            <CardHeader
              title="Recent classes"
              subtitle="Your latest verified attendance records."
              headingLevel={2}
              actions={
                <ButtonLink to={paths.student.attendanceHistory} variant="ghost" size="sm">
                  See all
                </ButtonLink>
              }
            />
            <CardBody>
              {attendance.isPending ? (
                <div className="stack stack-3">
                  <Skeleton width="100%" height="2.5rem" />
                  <Skeleton width="100%" height="2.5rem" />
                  <Skeleton width="100%" height="2.5rem" />
                </div>
              ) : recent.length === 0 ? (
                <EmptyState
                  title="No attendance recorded yet"
                  message="Once you verify in a live session your records appear here with the checks that passed."
                />
              ) : (
                <ul className="activity-list">
                  {recent.map((record) => {
                    const meta = attendanceStatusMeta(record.status);
                    return (
                      <li className="activity-list__item" key={record.id}>
                        <span
                          className={`activity-list__dot activity-list__dot--${meta.tone}`}
                          aria-hidden="true"
                        />
                        <span className="activity-list__body">
                          <strong>{record.session?.subject?.name ?? 'Class'}</strong>
                          <span className="text-caption">
                            {record.session?.classroom?.name ?? 'Room'} ·{' '}
                            {formatTimeAgo(record.markedAt)}
                          </span>
                        </span>
                        <Badge tone={meta.tone} dot>
                          {meta.label}
                        </Badge>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {weakSubjects.length > 0 ? (
        <Card style={{ marginTop: 'var(--space-4)' }}>
          <CardHeader
            title="Subjects that need attention"
            subtitle={`Below the ${formatPercent(minimum, 0)} minimum, with the classes you need to recover.`}
            headingLevel={2}
            actions={
              <Badge tone="danger" dot>
                {formatNumber(weakSubjects.length)}
              </Badge>
            }
          />
          <CardBody>
            <ul className="card-list">
              {weakSubjects.map((subject) => (
                <li className="card-list__item" key={subject.subjectId}>
                  <div className="stat-line">
                    <div>
                      <p className="card-list__title">{subject.subjectName}</p>
                      <p className="text-caption text-mono">
                        {subject.subjectCode} · {formatNumber(subject.present)} of{' '}
                        {formatNumber(subject.total)} classes
                      </p>
                    </div>
                    <Badge tone="danger">{formatPercent(subject.percentage, 1)}</Badge>
                  </div>
                  <Progress
                    value={subject.percentage}
                    tone="danger"
                    size="sm"
                    label={`Needs ${formatNumber(subject.classesNeededForTarget)} more consecutive classes to reach ${formatPercent(minimum, 0)}`}
                  />
                </li>
              ))}
            </ul>
            <p className="text-caption">
              “Classes needed” is calculated by the backend from your current totals and the
              institutional minimum - it is not an estimate made in the browser.
            </p>
          </CardBody>
        </Card>
      ) : null}

      <div className="charts-grid" style={{ marginTop: 'var(--space-4)' }}>
        <Card>
          <CardHeader
            title="Subject-wise attendance"
            subtitle="Each subject you have records in."
            headingLevel={2}
          />
          <CardBody>
            {attendance.isPending ? (
              <Skeleton width="100%" height="15rem" />
            ) : (
              <SubjectAttendanceChart data={subjectBars} threshold={minimum} />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Status breakdown"
            subtitle="How your recorded classes were classified."
            headingLevel={2}
          />
          <CardBody>
            {attendance.isPending ? (
              <Skeleton width="100%" height="15rem" />
            ) : (
              <StatusBreakdownChart counts={statusCounts} />
            )}
          </CardBody>
        </Card>
      </div>

      {profile.isError ? (
        <Alert tone="error" title="Profile unavailable">
          {describeApiError(profile.error)}
        </Alert>
      ) : null}

      <LiveRegion>
        {overview
          ? `Overall attendance ${formatPercent(percentage, 1)} percent, minimum required ${formatPercent(
              minimum,
              0,
            )} percent. ${formatNumber(eligibleSessions.length)} sessions open now.`
          : ''}
      </LiveRegion>
    </>
  );
}
