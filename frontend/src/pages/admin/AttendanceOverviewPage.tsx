import { useMemo, useState } from 'react';
import { CalendarClock, Clock, Eye, Radio, TrendingUp, Users, UserX } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { buildPaginationMeta } from '@/utils/pagination';
import { Avatar } from '@/components/ui/Avatar';
import { Skeleton } from '@/components/ui/Skeleton';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { LiveRegion } from '@/components/common/LiveRegion';
import { StatusBreakdownChart } from '@/components/dashboard/StatusBreakdownChart';
import { SubjectAttendanceChart } from '@/components/dashboard/SubjectAttendanceChart';
import { ReportRowDetailsModal } from '@/components/reports/RecordDetailsModal';
import { useAdminDashboard, usePolicy } from '@/hooks/queries/useAdminQueries';
import { useAttendanceReport } from '@/hooks/queries/useReportQueries';
import { paginateRows, summariseReport } from '@/services/report.service';
import { paths } from '@/routes/paths';
import { attendanceStatusMeta } from '@/utils/attendance';
import { DEFAULT_PAGE_SIZE, FALLBACK_MIN_ATTENDANCE_PERCENTAGE } from '@/utils/constants';
import { toEndOfDayIso, toStartOfDayIso, todayInputValue } from '@/utils/date';
import { formatDate, formatNumber, formatPercent } from '@/utils/format';
import type { ReportRow } from '@/types';

/**
 * Today's attendance at a glance.
 *
 * Counts come from GET /admin/dashboard (active sessions, marks recorded today)
 * and the detail rows from GET /reports/attendance restricted to today.
 *
 * BACKEND GAP: there is no admin endpoint that lists *which* sessions are
 * currently active - only a count. Rather than inventing a live session list,
 * this page shows the count plus today's recorded marks, and the gap is
 * documented in API_CONTRACT.md.
 */
export function AttendanceOverviewPage() {
  const dashboard = useAdminDashboard();
  const policy = usePolicy();
  const threshold = policy.data?.minAttendancePercentage ?? FALLBACK_MIN_ATTENDANCE_PERCENTAGE;

  const today = todayInputValue();
  const report = useAttendanceReport({
    from: toStartOfDayIso(today),
    to: toEndOfDayIso(today),
  });

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [selected, setSelected] = useState<ReportRow | null>(null);

  const rows = useMemo(() => report.data ?? [], [report.data]);
  const summary = useMemo(() => summariseReport(rows), [rows]);
  const bySubject = useMemo(() => {
    const buckets = new Map<string, { code: string; present: number; total: number }>();
    for (const row of rows) {
      const bucket = buckets.get(row.subjectName) ?? {
        code: row.subjectCode,
        present: 0,
        total: 0,
      };
      bucket.total += 1;
      if (row.status === 'PRESENT' || row.status === 'LATE') bucket.present += 1;
      buckets.set(row.subjectName, bucket);
    }
    return [...buckets.entries()]
      .map(([subject, value]) => ({
        label: subject,
        code: value.code,
        present: value.present,
        total: value.total,
        percentage: value.total > 0 ? Math.round((value.present / value.total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.percentage - a.percentage);
  }, [rows]);

  const statusCounts = useMemo(
    () => ({
      PRESENT: summary.present,
      LATE: summary.late,
      ABSENT: summary.absent,
      EXCUSED: summary.excused,
    }),
    [summary],
  );

  const absentees = useMemo(
    () => rows.filter((row) => row.status === 'ABSENT').slice(0, 8),
    [rows],
  );

  const paged = useMemo(() => paginateRows(rows, page, pageSize), [rows, page, pageSize]);
  const meta = buildPaginationMeta({ total: rows.length, page, pageSize });

  const columns: DataTableColumn<ReportRow>[] = [
    {
      id: 'time',
      header: 'Time',
      cell: (row) => <span className="text-mono cell-primary">{row.time}</span>,
    },
    {
      id: 'student',
      header: 'Student',
      cell: (row) => (
        <div className="table-identity">
          <Avatar name={row.studentName} size="sm" />
          <div className="table-identity__text">
            <div className="table-identity__name">{row.studentName}</div>
            <div className="table-identity__meta">
              Roll {row.rollNumber} · {row.studentCode}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'subject',
      header: 'Subject',
      cell: (row) => (
        <div>
          <div className="cell-primary">{row.subjectName}</div>
          <div className="cell-sub">{row.classroom}</div>
        </div>
      ),
      hideOn: 'tablet',
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => {
        const statusMeta = attendanceStatusMeta(row.status);
        return (
          <Badge tone={statusMeta.tone} dot>
            {statusMeta.label}
          </Badge>
        );
      },
    },
    {
      id: 'teacher',
      header: 'Teacher',
      cell: (row) => row.teacher,
      hideOn: 'tablet',
    },
    {
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      className: 'cell-actions',
      cell: (row) => (
        <Button size="sm" variant="ghost" icon={<Eye size={15} />} onClick={() => setSelected(row)}>
          Details
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Attendance today"
        subtitle={`Recorded marks for ${formatDate(toStartOfDayIso(today))}.`}
        actions={
          <ButtonLink
            to={paths.admin.attendanceHistory}
            variant="secondary"
            icon={<CalendarClock size={16} />}
          >
            Full history
          </ButtonLink>
        }
      />

      <div className="stat-grid">
        <StatCard
          label="Active sessions now"
          value={dashboard.data ? formatNumber(dashboard.data.activeSessions) : '—'}
          icon={<Radio size={18} />}
          tone={dashboard.data && dashboard.data.activeSessions > 0 ? 'success' : 'neutral'}
          isLoading={dashboard.isPending}
          meta="Teachers with an open attendance session"
        />
        <StatCard
          label="Marks recorded today"
          value={dashboard.data ? formatNumber(dashboard.data.todayAttendance) : '—'}
          icon={<Clock size={18} />}
          isLoading={dashboard.isPending}
          meta="Attendance rows written since midnight"
        />
        <StatCard
          label="Present today"
          value={formatPercent(summary.attendancePercentage, 1)}
          icon={<TrendingUp size={18} />}
          tone={summary.attendancePercentage >= threshold ? 'success' : 'warning'}
          isLoading={report.isPending}
          meta={`${formatNumber(summary.present + summary.late)} of ${formatNumber(summary.totalRecords)} marks`}
        />
        <StatCard
          label="Absent today"
          value={formatNumber(summary.absent)}
          icon={<UserX size={18} />}
          tone={summary.absent > 0 ? 'danger' : 'success'}
          isLoading={report.isPending}
          to={paths.admin.attendanceHistory}
          valueLabel={`${summary.absent} students marked absent today`}
        />
      </div>

      {report.isError ? (
        <Alert tone="error" title="Today's records could not be loaded">
          The report endpoint did not respond. Use Refresh to try again.
        </Alert>
      ) : null}

      <div className="charts-grid" style={{ marginTop: 'var(--space-5)' }}>
        <Card>
          <CardHeader
            title="Today's status breakdown"
            subtitle="How every mark recorded so far today was classified."
            headingLevel={2}
            actions={<Badge tone="neutral">{formatNumber(summary.totalRecords)} marks</Badge>}
          />
          <CardBody>
            {report.isPending ? (
              <Skeleton width="100%" height="15rem" />
            ) : (
              <StatusBreakdownChart counts={statusCounts} />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Attendance by subject"
            subtitle={`Today's marks per subject, flagged below ${formatPercent(threshold, 0)}.`}
            headingLevel={2}
          />
          <CardBody>
            {report.isPending ? (
              <Skeleton width="100%" height="15rem" />
            ) : (
              <SubjectAttendanceChart data={bySubject} threshold={threshold} />
            )}
          </CardBody>
        </Card>
      </div>

      {absentees.length > 0 ? (
        <Card style={{ marginTop: 'var(--space-4)' }}>
          <CardHeader
            title="Marked absent today"
            subtitle="The most recent students recorded as absent."
            headingLevel={2}
            actions={
              <Badge tone="danger" dot>
                {formatNumber(summary.absent)} absent
              </Badge>
            }
          />
          <CardBody>
            <ul className="card-list card-list--grid">
              {absentees.map((row) => (
                <li className="card-list__item" key={`${row.time}-${row.studentCode}`}>
                  <div className="table-identity">
                    <Avatar name={row.studentName} size="sm" />
                    <div className="table-identity__text">
                      <div className="table-identity__name">{row.studentName}</div>
                      <div className="table-identity__meta">
                        {row.subjectName} · {row.time}
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Eye size={14} />}
                    onClick={() => setSelected(row)}
                  >
                    Details
                  </Button>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      <Card flush style={{ marginTop: 'var(--space-4)' }}>
        <DataTable
          columns={columns}
          rows={paged.items}
          rowKey={(row) => `${row.date}-${row.time}-${row.studentCode}-${row.subjectCode}`}
          isLoading={report.isPending}
          isFetching={report.isFetching}
          error={report.isError ? report.error : null}
          onRetry={() => void report.refetch()}
          caption="Attendance recorded today"
          onRowClick={(row) => setSelected(row)}
          emptyTitle="Nothing recorded yet today"
          emptyMessage="Marks appear here as soon as students complete verification in a live session."
          emptyActionLabel="Open full history"
          toolbar={
            <div className="toolbar">
              <div className="toolbar__group">
                <span className="row" style={{ gap: 'var(--space-2)' }}>
                  <Users size={15} aria-hidden="true" />
                  <strong className="text-sm">
                    {formatNumber(summary.uniqueStudents)} students with records today
                  </strong>
                </span>
              </div>
              <div className="toolbar__actions">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void report.refetch()}
                  isLoading={report.isFetching}
                  loadingText="Loading…"
                >
                  Refresh
                </Button>
              </div>
            </div>
          }
          footer={
            <Pagination
              meta={meta}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              isLoading={report.isFetching}
              itemLabel="marks"
            />
          }
          renderMobileCard={(row) => {
            const statusMeta = attendanceStatusMeta(row.status);
            return (
              <>
                <div className="card-list__header">
                  <div className="table-identity">
                    <Avatar name={row.studentName} size="md" />
                    <div className="table-identity__text">
                      <div className="table-identity__name">{row.studentName}</div>
                      <div className="table-identity__meta">
                        {row.subjectName} · <span className="text-mono">{row.time}</span>
                      </div>
                    </div>
                  </div>
                  <Badge tone={statusMeta.tone} dot>
                    {statusMeta.label}
                  </Badge>
                </div>
                <div className="card-list__actions">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Eye size={14} />}
                    onClick={() => setSelected(row)}
                  >
                    View details
                  </Button>
                </div>
              </>
            );
          }}
        />
      </Card>

      <LiveRegion>
        {report.isSuccess
          ? `${formatNumber(summary.totalRecords)} marks recorded today: ${formatNumber(
              summary.present,
            )} present, ${formatNumber(summary.late)} late, ${formatNumber(summary.absent)} absent.`
          : ''}
      </LiveRegion>

      <ReportRowDetailsModal
        open={selected !== null}
        row={selected}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
