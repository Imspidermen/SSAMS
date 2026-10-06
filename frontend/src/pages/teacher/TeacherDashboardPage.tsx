import { useState } from 'react';
import {
  BookOpen,
  CalendarClock,
  Fingerprint,
  MapPin,
  Play,
  Radio,
  ScanFace,
  TrendingDown,
  Users,
} from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Progress } from '@/components/ui/Progress';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/StateBlock';
import { Avatar } from '@/components/ui/Avatar';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { LiveRegion } from '@/components/common/LiveRegion';
import { AttendanceTrendChart } from '@/components/dashboard/AttendanceTrendChart';
import { StatusBreakdownChart } from '@/components/dashboard/StatusBreakdownChart';
import { SubjectAttendanceChart } from '@/components/dashboard/SubjectAttendanceChart';
import { SessionCard } from '@/components/attendance/SessionCard';
import { StartSessionModal } from '@/components/attendance/StartSessionModal';
import { useAuth } from '@/hooks/useAuth';
import { useTeacherDashboard, useTeacherSubjects } from '@/hooks/queries/useTeacherQueries';
import { usePolicy } from '@/hooks/queries/useAdminQueries';
import { useReportAnalytics } from '@/hooks/queries/useReportAnalytics';
import { useHealth } from '@/hooks/queries/useHealthQuery';
import { paths } from '@/routes/paths';
import { describeApiError } from '@/utils/apiError';
import { FALLBACK_MIN_ATTENDANCE_PERCENTAGE } from '@/utils/constants';
import { formatDateTime, formatNumber, formatPercent, formatTimeAgo } from '@/utils/format';

const TREND_DAYS = 14;

const VERIFICATION_STEPS = [
  {
    icon: <MapPin size={17} />,
    title: 'Location check',
    detail: 'The student’s device position is measured against the classroom geofence.',
  },
  {
    icon: <ScanFace size={17} />,
    title: 'Face match',
    detail: 'A camera frame is matched against the student’s enrolled face profile.',
  },
  {
    icon: <Fingerprint size={17} />,
    title: 'Liveness & blink',
    detail: 'A head-turn challenge and a natural blink prove a real person is present.',
  },
  {
    icon: <CalendarClock size={17} />,
    title: 'Marked',
    detail: 'The backend writes the record; you watch the roster fill up in real time.',
  },
];

/**
 * Teacher home.
 *
 *   GET /teacher/dashboard      -> profile, active/today counts, recent sessions
 *   GET /teacher/subjects       -> assigned subjects
 *   GET /reports/attendance     -> 14-day analytics scoped to this teacher
 *   GET /admin/policy           -> the institutional minimum attendance
 *   GET /health                 -> whether face verification can run at all
 */
export function TeacherDashboardPage() {
  const { user } = useAuth();
  const dashboard = useTeacherDashboard();
  const subjects = useTeacherSubjects();
  const policy = usePolicy();
  const health = useHealth();
  const [startOpen, setStartOpen] = useState(false);

  const teacherId = dashboard.data?.teacher?.id;
  const threshold = policy.data?.minAttendancePercentage ?? FALLBACK_MIN_ATTENDANCE_PERCENTAGE;

  const analytics = useReportAnalytics(
    { teacherId },
    { rangeDays: TREND_DAYS, threshold, enabled: Boolean(teacherId) },
  );

  const recent = dashboard.data?.recentSessions ?? [];
  const marksInRecent = recent.reduce(
    (total, session) => total + (session._count?.attendanceRecords ?? 0),
    0,
  );
  const hasSubjects = (subjects.data ?? []).length > 0;
  const greeting = user?.name ? `Welcome back, ${user.name.split(' ')[0]}` : 'Welcome back';

  return (
    <>
      <PageHeader
        title={greeting}
        subtitle="Open a session for the class in front of you and watch verified attendance build up live."
        actions={
          <div className="row">
            <ButtonLink
              to={paths.teacher.attendance}
              variant="secondary"
              icon={<Radio size={16} />}
            >
              My sessions
            </ButtonLink>
            <Button
              icon={<Play size={16} />}
              onClick={() => setStartOpen(true)}
              disabled={!hasSubjects}
            >
              Start session
            </Button>
          </div>
        }
      />

      {dashboard.isError ? (
        <Alert tone="error" title="Dashboard unavailable">
          {describeApiError(dashboard.error)}
        </Alert>
      ) : null}

      {health.data?.dependencies.aiService === 'down' ? (
        <Alert tone="warning" title="Face verification service is down">
          Students cannot complete the face, liveness or blink steps right now, so new sessions will
          record no marks. The location check still works. Wait for the service to recover before
          opening a session.
        </Alert>
      ) : null}

      {health.data?.dependencies.database === 'down' ? (
        <Alert tone="error" title="Database unreachable">
          The backend cannot read or write attendance. Nothing you do now will be recorded.
        </Alert>
      ) : null}

      {!hasSubjects && !subjects.isPending ? (
        <Alert tone="warning" title="No subjects assigned yet">
          Ask an administrator to assign you a subject (
          <strong>Admin → Subjects → Assign teacher</strong>). The backend rejects session creation
          with <code className="text-mono">NOT_ASSIGNED</code> until then.
        </Alert>
      ) : null}

      <div className="stat-grid">
        <StatCard
          label="Active sessions"
          value={formatNumber(dashboard.data?.activeSessions ?? 0)}
          icon={<Radio size={18} />}
          tone={(dashboard.data?.activeSessions ?? 0) > 0 ? 'success' : 'neutral'}
          isLoading={dashboard.isPending}
          to={paths.teacher.attendance}
          meta="Open for student verification now"
        />
        <StatCard
          label="Sessions today"
          value={formatNumber(dashboard.data?.totalSessionsToday ?? 0)}
          icon={<CalendarClock size={18} />}
          isLoading={dashboard.isPending}
          to={paths.teacher.attendance}
          meta="Started since midnight"
        />
        <StatCard
          label="Subjects assigned"
          value={formatNumber(dashboard.data?.subjectCount ?? 0)}
          icon={<BookOpen size={18} />}
          isLoading={dashboard.isPending}
          to={paths.teacher.subjects}
          meta="Classes you can run attendance for"
        />
        <StatCard
          label="Marks in your last sessions"
          value={formatNumber(marksInRecent)}
          icon={<Users size={18} />}
          tone="primary"
          isLoading={dashboard.isPending}
          to={paths.teacher.attendanceHistory}
          meta={`Across ${formatNumber(recent.length)} recent sessions`}
        />
      </div>

      <Card style={{ marginTop: 'var(--space-5)' }}>
        <CardHeader
          title="How attendance is captured"
          subtitle="Students verify themselves - you never type a mark, so records cannot be entered by mistake."
          headingLevel={2}
        />
        <CardBody>
          <ol className="stepper">
            {VERIFICATION_STEPS.map((step, index) => (
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
        </CardBody>
      </Card>

      <div className="charts-grid" style={{ marginTop: 'var(--space-4)' }}>
        <Card>
          <CardHeader
            title={`Your last ${TREND_DAYS} days`}
            subtitle="Attendance percentage across the sessions you ran."
            headingLevel={2}
            actions={
              <Badge tone="neutral">{formatNumber(analytics.summary.totalRecords)} marks</Badge>
            }
          />
          <CardBody>
            {analytics.isPending ? (
              <Skeleton width="100%" height="17rem" />
            ) : analytics.isError ? (
              <Alert tone="error">{describeApiError(analytics.error)}</Alert>
            ) : (
              <AttendanceTrendChart data={analytics.byDate} threshold={threshold} />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Status breakdown"
            subtitle="Every mark from your sessions in this period."
            headingLevel={2}
          />
          <CardBody>
            {analytics.isPending ? (
              <Skeleton width="100%" height="15rem" />
            ) : (
              <StatusBreakdownChart counts={analytics.statusCounts} />
            )}
          </CardBody>
        </Card>
      </div>

      <Card style={{ marginTop: 'var(--space-4)' }}>
        <CardHeader
          title="Attendance by subject"
          subtitle={`Your subjects, flagged below the ${formatPercent(threshold, 0)} institutional minimum.`}
          headingLevel={2}
        />
        <CardBody>
          {analytics.isPending ? (
            <Skeleton width="100%" height="14rem" />
          ) : (
            <SubjectAttendanceChart data={analytics.bySubject} threshold={threshold} />
          )}
        </CardBody>
      </Card>

      <div className="dashboard-split" style={{ marginTop: 'var(--space-4)' }}>
        <Card>
          <CardHeader
            title="Recent sessions"
            subtitle="Your last sessions with the marks each one recorded."
            headingLevel={2}
            actions={
              <ButtonLink to={paths.teacher.attendance} variant="ghost" size="sm">
                All sessions
              </ButtonLink>
            }
          />
          <CardBody>
            {dashboard.isPending ? (
              <div className="stack stack-3">
                <Skeleton width="100%" height="4rem" />
                <Skeleton width="100%" height="4rem" />
              </div>
            ) : recent.length === 0 ? (
              <EmptyState
                title="No sessions yet"
                message="Start your first session and it will appear here with its roster and attendance count."
                actionLabel={hasSubjects ? 'Start session' : undefined}
                onAction={hasSubjects ? () => setStartOpen(true) : undefined}
              />
            ) : (
              <ul className="session-list">
                {recent.map((session) => (
                  <li key={session.id}>
                    <SessionCard
                      session={session}
                      compact
                      detailPath={paths.teacher.sessionDetail(session.id)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Students below the minimum"
            subtitle={`Under ${formatPercent(threshold, 0)} in your sessions over the last ${TREND_DAYS} days.`}
            headingLevel={2}
            actions={
              <Badge tone={analytics.lowAttendance.length > 0 ? 'danger' : 'success'} dot>
                {formatNumber(analytics.lowAttendance.length)}
              </Badge>
            }
          />
          <CardBody>
            {analytics.isPending ? (
              <div className="stack stack-3">
                <Skeleton width="100%" height="3rem" />
                <Skeleton width="100%" height="3rem" />
              </div>
            ) : analytics.lowAttendance.length === 0 ? (
              <EmptyState
                title="Everyone is above the minimum"
                message={`No student in your classes dropped below ${formatPercent(threshold, 0)} in this period.`}
              />
            ) : (
              <ul className="card-list">
                {analytics.lowAttendance.slice(0, 8).map((student) => (
                  <li className="card-list__item" key={student.studentCode}>
                    <div className="table-identity">
                      <Avatar name={student.studentName} size="sm" />
                      <div className="table-identity__text">
                        <div className="table-identity__name">{student.studentName}</div>
                        <div className="table-identity__meta text-mono">{student.studentCode}</div>
                      </div>
                    </div>
                    <div className="stat-line">
                      <Progress
                        value={student.percentage}
                        tone="danger"
                        size="sm"
                        label={`${student.present} of ${student.total} classes`}
                      />
                      <Badge tone="danger">{formatPercent(student.percentage, 1)}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-caption" style={{ marginTop: 'var(--space-3)' }}>
              <TrendingDown size={13} aria-hidden="true" /> Measured against the institutional
              policy, which you can review under{' '}
              <ButtonLink to={paths.teacher.attendanceHistory} variant="ghost" size="sm">
                attendance history
              </ButtonLink>
              .
            </p>
          </CardBody>
        </Card>
      </div>

      <LiveRegion>
        {dashboard.data
          ? `${formatNumber(dashboard.data.activeSessions)} active sessions, ${formatNumber(
              dashboard.data.totalSessionsToday,
            )} today.`
          : ''}
      </LiveRegion>

      <Card style={{ marginTop: 'var(--space-4)' }}>
        <CardBody>
          <p className="text-caption">
            Last refreshed {formatDateTime(new Date().toISOString())} · session lists update
            automatically every 15 seconds while this page is open
            {recent[0] ? ` · most recent session ${formatTimeAgo(recent[0].startTime)}` : ''}.
          </p>
        </CardBody>
      </Card>

      <StartSessionModal open={startOpen} onClose={() => setStartOpen(false)} />
    </>
  );
}
