import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  BookOpen,
  Building2,
  CalendarCheck2,
  CircleUserRound,
  FileBarChart,
  Radio,
  RefreshCw,
  UserCheck,
  Users,
} from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { SkeletonStats } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/StateBlock';
import { EmptyState } from '@/components/ui/StateBlock';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { AttendanceIndicator } from '@/components/common/AttendanceIndicator';
import { AttendanceTrendChart } from '@/components/dashboard/AttendanceTrendChart';
import { StatusBreakdownChart } from '@/components/dashboard/StatusBreakdownChart';
import { SubjectAttendanceChart } from '@/components/dashboard/SubjectAttendanceChart';
import { useAdminDashboard, usePolicy } from '@/hooks/queries/useAdminQueries';
import { useReportAnalytics } from '@/hooks/queries/useReportAnalytics';
import { useHealth } from '@/hooks/queries/useHealthQuery';
import { paths } from '@/routes/paths';
import { FALLBACK_MIN_ATTENDANCE_PERCENTAGE } from '@/utils/constants';
import { formatDateTime, formatNumber, formatPercent, formatTimeAgo } from '@/utils/format';
import { attendanceStatusMeta } from '@/utils/attendance';

const TREND_DAYS = 30;

/**
 * Admin overview. Every number comes from the API:
 *   GET /admin/dashboard     -> institution counters
 *   GET /admin/policy        -> configured minimum attendance threshold
 *   GET /reports/attendance  -> real rows used for the trend/status/subject charts
 * Nothing on this screen is hard-coded or estimated.
 */
export function AdminDashboardPage() {
  const dashboard = useAdminDashboard();
  const policy = usePolicy();
  const health = useHealth();
  const threshold = policy.data?.minAttendancePercentage ?? FALLBACK_MIN_ATTENDANCE_PERCENTAGE;

  const analytics = useReportAnalytics(undefined, {
    rangeDays: TREND_DAYS,
    threshold,
    enabled: dashboard.isSuccess || dashboard.isError,
  });

  const stats = dashboard.data;
  const recent = useMemo(() => analytics.rows.slice(0, 8), [analytics.rows]);
  const aiDown = health.data?.dependencies.aiService === 'down';
  const dbDown = health.data?.dependencies.database === 'down';

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`Institution-wide attendance at a glance. Charts cover the last ${TREND_DAYS} days of recorded sessions.`}
        actions={
          <>
            <Button
              variant="secondary"
              icon={<RefreshCw size={16} />}
              onClick={() => {
                void dashboard.refetch();
                void policy.refetch();
                analytics.refetch();
              }}
              isLoading={dashboard.isFetching || analytics.isFetching}
              loadingText="Refreshing…"
            >
              Refresh
            </Button>
            <ButtonLink to={paths.admin.reports} icon={<FileBarChart size={16} />}>
              Reports
            </ButtonLink>
          </>
        }
      />

      {dbDown ? (
        <Alert tone="error" title="Database unavailable">
          The backend reports its PostgreSQL connection is down. Counts and charts may fail to load
          until it is restored.
        </Alert>
      ) : null}

      {aiDown ? (
        <Alert tone="warning" title="Face verification service offline">
          The CV microservice is not responding, so students cannot complete face verification right
          now. Sessions can still be opened, but attendance marking will fail at the face step.
        </Alert>
      ) : null}

      {dashboard.isError ? (
        <Card>
          <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} />
        </Card>
      ) : (
        <div className="stack stack-5">
          <section aria-label="Key statistics">
            {dashboard.isPending ? (
              <SkeletonStats count={6} />
            ) : (
              <div className="grid grid-stats grid-stats--6">
                <StatCard
                  label="Total students"
                  value={formatNumber(stats?.totalStudents)}
                  valueLabel={`${formatNumber(stats?.totalStudents)} active students`}
                  icon={<Users size={20} />}
                  to={paths.admin.students}
                />
                <StatCard
                  label="Total teachers"
                  value={formatNumber(stats?.totalTeachers)}
                  valueLabel={`${formatNumber(stats?.totalTeachers)} teachers`}
                  icon={<CircleUserRound size={20} />}
                  tone="info"
                  to={paths.admin.teachers}
                />
                <StatCard
                  label="Departments"
                  value={formatNumber(stats?.totalDepartments)}
                  valueLabel={`${formatNumber(stats?.totalDepartments)} departments`}
                  icon={<Building2 size={20} />}
                  tone="neutral"
                  to={paths.admin.settings}
                />
                <StatCard
                  label="Live sessions"
                  value={formatNumber(stats?.activeSessions)}
                  valueLabel={`${formatNumber(stats?.activeSessions)} sessions running now`}
                  icon={<Radio size={20} />}
                  tone={stats?.activeSessions ? 'success' : 'neutral'}
                  meta={
                    stats?.activeSessions ? (
                      <Badge tone="success" dot>
                        In progress
                      </Badge>
                    ) : (
                      <span>No session running</span>
                    )
                  }
                  to={paths.admin.attendance}
                />
                <StatCard
                  label="Present today"
                  value={formatNumber(stats?.todayAttendance)}
                  valueLabel={`${formatNumber(stats?.todayAttendance)} present marks today`}
                  icon={<UserCheck size={20} />}
                  tone="success"
                  meta={<span>Verified PRESENT records</span>}
                  to={paths.admin.attendanceHistory}
                />
                <StatCard
                  label="Low attendance"
                  value={formatNumber(stats?.lowAttendanceStudents)}
                  valueLabel={`${formatNumber(stats?.lowAttendanceStudents)} students below ${threshold} percent`}
                  icon={<AlertTriangle size={20} />}
                  tone={stats?.lowAttendanceStudents ? 'warning' : 'neutral'}
                  meta={<span>Below {formatPercent(threshold, 0)} minimum</span>}
                  to={paths.admin.students}
                />
              </div>
            )}
          </section>

          <div className="grid grid-2">
            <Card>
              <CardHeader
                title="Attendance trend"
                subtitle={`Daily attendance rate across all departments · last ${TREND_DAYS} days`}
                headingLevel={2}
                actions={
                  <ButtonLink to={paths.admin.reports} variant="ghost" size="sm">
                    Open reports
                  </ButtonLink>
                }
              />
              <CardBody>
                {analytics.isPending ? (
                  <div className="chart-frame">
                    <div className="skeleton skeleton--rect" style={{ height: '100%' }} />
                  </div>
                ) : analytics.isError ? (
                  <ErrorState error={analytics.error} onRetry={analytics.refetch} />
                ) : (
                  <AttendanceTrendChart data={analytics.byDate} threshold={threshold} />
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Attendance status"
                subtitle="Distribution of every recorded status in the period"
                headingLevel={2}
              />
              <CardBody>
                {analytics.isPending ? (
                  <div className="chart-frame chart-frame--sm">
                    <div className="skeleton skeleton--rect" style={{ height: '100%' }} />
                  </div>
                ) : analytics.isError ? (
                  <ErrorState error={analytics.error} onRetry={analytics.refetch} />
                ) : (
                  <>
                    <StatusBreakdownChart counts={analytics.statusCounts} />
                    <div className="row" style={{ marginTop: 'var(--space-4)' }}>
                      <Badge tone="neutral">
                        {formatNumber(analytics.summary.uniqueStudents)} students recorded
                      </Badge>
                      <Badge tone="info">
                        {formatNumber(analytics.summary.totalRecords)} records
                      </Badge>
                    </div>
                  </>
                )}
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardHeader
              title="Subject attendance"
              subtitle="Average attendance per subject in the selected period"
              headingLevel={2}
              actions={<Badge tone="neutral">Minimum {formatPercent(threshold, 0)}</Badge>}
            />
            <CardBody>
              {analytics.isPending ? (
                <div className="chart-frame">
                  <div className="skeleton skeleton--rect" style={{ height: '100%' }} />
                </div>
              ) : analytics.isError ? (
                <ErrorState error={analytics.error} onRetry={analytics.refetch} />
              ) : (
                <SubjectAttendanceChart data={analytics.bySubject} threshold={threshold} />
              )}
            </CardBody>
          </Card>

          <div className="split split--reverse">
            <Card flush>
              <CardHeader
                title="Recent attendance activity"
                subtitle="Latest verified records across the institution"
                headingLevel={2}
                actions={
                  <ButtonLink to={paths.admin.attendanceHistory} variant="ghost" size="sm">
                    View all
                  </ButtonLink>
                }
              />
              {analytics.isPending ? (
                <CardBody>
                  <div className="stack stack-3">
                    {Array.from({ length: 5 }, (_, index) => (
                      <span
                        className="skeleton skeleton--text"
                        key={index}
                        style={{ width: '90%' }}
                      />
                    ))}
                  </div>
                </CardBody>
              ) : recent.length === 0 ? (
                <EmptyState
                  title="No attendance recorded yet"
                  message="Once a teacher opens a session and students verify, their records will appear here."
                  actionLabel="Go to attendance"
                  onAction={() => window.location.assign(paths.admin.attendance)}
                />
              ) : (
                <ul className="activity-list">
                  {recent.map((row) => {
                    const meta = attendanceStatusMeta(row.status);
                    return (
                      <li
                        className="activity-list__item"
                        key={`${row.studentCode}-${row.date}-${row.time}`}
                      >
                        <Avatar
                          name={row.studentName}
                          size="sm"
                          tone={meta.tone === 'primary' ? undefined : meta.tone}
                        />
                        <div className="activity-list__body">
                          <p className="activity-list__title">
                            {row.studentName}
                            <span className="activity-list__meta"> · {row.rollNumber}</span>
                          </p>
                          <p className="activity-list__subtitle">
                            {row.subjectName} ({row.subjectCode}) · {row.classroom}
                          </p>
                        </div>
                        <div className="activity-list__aside">
                          <Badge tone={meta.tone} dot>
                            {meta.label}
                          </Badge>
                          <span
                            className="text-caption"
                            title={formatDateTime(`${row.date}T${row.time}`)}
                          >
                            {formatTimeAgo(`${row.date}T${row.time}`)}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            <Card flush>
              <CardHeader
                title="Low attendance"
                subtitle={`Below the ${formatPercent(threshold, 0)} minimum in this period`}
                headingLevel={2}
              />
              {analytics.isPending ? (
                <CardBody>
                  <div className="stack stack-3">
                    {Array.from({ length: 4 }, (_, index) => (
                      <span
                        className="skeleton skeleton--text"
                        key={index}
                        style={{ width: '80%' }}
                      />
                    ))}
                  </div>
                </CardBody>
              ) : analytics.lowAttendance.length === 0 ? (
                <EmptyState
                  title="No students below the threshold"
                  message={`Every student with records in the last ${TREND_DAYS} days meets the ${formatPercent(threshold, 0)} requirement.`}
                />
              ) : (
                <ul className="activity-list">
                  {analytics.lowAttendance.slice(0, 6).map((entry) => (
                    <li className="activity-list__item" key={entry.studentCode}>
                      <Avatar name={entry.studentName} size="sm" tone="warning" />
                      <div className="activity-list__body">
                        <p className="activity-list__title">{entry.studentName}</p>
                        <p className="activity-list__subtitle">
                          {entry.studentCode} · {entry.department}
                        </p>
                      </div>
                      <div className="activity-list__aside">
                        <AttendanceIndicator
                          percentage={entry.percentage}
                          threshold={threshold}
                          compact
                        />
                      </div>
                    </li>
                  ))}
                  <li className="activity-list__footer">
                    <Link to={paths.admin.students} className="link-btn">
                      Manage students
                    </Link>
                    <span className="text-caption">
                      {formatNumber(stats?.lowAttendanceStudents ?? 0)} flagged institution-wide
                    </span>
                  </li>
                </ul>
              )}
            </Card>
          </div>

          <Card>
            <CardBody tight>
              <div className="row row--between">
                <div className="row" style={{ gap: 'var(--space-3)' }}>
                  <BookOpen size={18} aria-hidden="true" />
                  <span className="text-body">
                    Need to add people or subjects before sessions can run?
                  </span>
                </div>
                <div className="row">
                  <ButtonLink
                    to={paths.admin.students}
                    variant="secondary"
                    size="sm"
                    icon={<Users size={15} />}
                  >
                    Students
                  </ButtonLink>
                  <ButtonLink
                    to={paths.admin.subjects}
                    variant="secondary"
                    size="sm"
                    icon={<BookOpen size={15} />}
                  >
                    Subjects
                  </ButtonLink>
                  <ButtonLink
                    to={paths.admin.attendance}
                    size="sm"
                    icon={<CalendarCheck2 size={15} />}
                  >
                    Attendance
                  </ButtonLink>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </>
  );
}
