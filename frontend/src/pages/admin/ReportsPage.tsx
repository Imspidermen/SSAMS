import { useEffect, useMemo, useState } from 'react';
import { CalendarRange, Download, FileSpreadsheet, Gauge, TrendingDown, Users } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { Progress } from '@/components/ui/Progress';
import { Tabs } from '@/components/ui/Tabs';
import { EmptyState } from '@/components/ui/StateBlock';
import { Skeleton } from '@/components/ui/Skeleton';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { LiveRegion } from '@/components/common/LiveRegion';
import { AttendanceTrendChart } from '@/components/dashboard/AttendanceTrendChart';
import { StatusBreakdownChart } from '@/components/dashboard/StatusBreakdownChart';
import { SubjectAttendanceChart } from '@/components/dashboard/SubjectAttendanceChart';
import { ReportFilterBar } from '@/components/reports/ReportFilterBar';
import { EMPTY_REPORT_FILTERS } from '@/utils/reportFilters';
import { useToast } from '@/hooks/useToast';
import { useDepartments, useSubjects } from '@/hooks/queries/useAdminQueries';
import { usePolicy } from '@/hooks/queries/useAdminQueries';
import { useReportAnalytics, type StudentAggregate } from '@/hooks/queries/useReportAnalytics';
import { downloadAttendanceReport } from '@/services/report.service';
import { describeApiError } from '@/utils/apiError';
import { FALLBACK_MIN_ATTENDANCE_PERCENTAGE } from '@/utils/constants';
import { daysAgoInputValue, toEndOfDayIso, toStartOfDayIso, todayInputValue } from '@/utils/date';
import { formatDate, formatNumber, formatPercent } from '@/utils/format';

type ReportTab = 'charts' | 'students';

/**
 * Reports.
 *
 * The backend genuinely supports this: GET /reports/attendance returns computed
 * rows (ADMIN + TEACHER) and the same endpoint with `format=csv` streams a real
 * CSV attachment, so export is wired end-to-end. PDF export does not exist in
 * the backend and is therefore not offered (see API_CONTRACT.md).
 *
 * Every number on this page is aggregated from those rows - nothing is
 * estimated, sampled or hard-coded. The low-attendance threshold comes from the
 * policy endpoint.
 */
export function ReportsPage() {
  const toast = useToast();
  const [tab, setTab] = useState<ReportTab>('charts');
  const [exporting, setExporting] = useState(false);
  const [filters, setFilters] = useState(() => ({
    ...EMPTY_REPORT_FILTERS,
    from: daysAgoInputValue(29),
    to: todayInputValue(),
  }));

  const policy = usePolicy();
  const threshold = policy.data?.minAttendancePercentage ?? FALLBACK_MIN_ATTENDANCE_PERCENTAGE;
  const departments = useDepartments();
  const subjects = useSubjects();

  const serverFilters = useMemo(
    () => ({
      from: filters.from ? toStartOfDayIso(filters.from) : undefined,
      to: filters.to ? toEndOfDayIso(filters.to) : undefined,
      subjectId: filters.subjectId || undefined,
      departmentId: filters.departmentId || undefined,
    }),
    [filters.from, filters.to, filters.subjectId, filters.departmentId],
  );

  const analytics = useReportAnalytics(serverFilters, { threshold });

  useEffect(() => {
    if (policy.isError) {
      toast.warning(
        'Using the default threshold',
        'The policy endpoint is unreachable, so low attendance is measured against the 75% default.',
      );
    }
    // Reported once per policy failure; the toast hook dedupes by key.
  }, [policy.isError, toast]);

  const studentColumns: DataTableColumn<StudentAggregate>[] = [
    {
      id: 'student',
      header: 'Student',
      cell: (student) => (
        <div>
          <div className="cell-primary">{student.studentName}</div>
          <div className="cell-sub text-mono">
            {student.studentCode} · Roll {student.rollNumber}
          </div>
        </div>
      ),
    },
    {
      id: 'department',
      header: 'Department',
      cell: (student) => student.department,
      hideOn: 'tablet',
    },
    {
      id: 'classes',
      header: 'Classes',
      align: 'right',
      cell: (student) => `${student.present}/${student.total} attended`,
      hideOn: 'tablet',
    },
    {
      id: 'percentage',
      header: 'Attendance',
      cell: (student) => (
        <div className="cell-progress">
          <Progress
            value={student.percentage}
            size="sm"
            tone={student.belowThreshold ? 'danger' : 'success'}
          />
          <span className="cell-progress__value">
            {formatPercent(student.percentage, 1)}
            {student.belowThreshold ? (
              <span className="sr-only"> (below the required minimum)</span>
            ) : null}
          </span>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (student) =>
        student.belowThreshold ? (
          <Badge tone="danger">Below {formatPercent(threshold, 0)}</Badge>
        ) : (
          <Badge tone="success">Meets minimum</Badge>
        ),
    },
  ];

  const renderTrend = () =>
    analytics.isPending ? (
      <Skeleton width="100%" height="17rem" />
    ) : (
      <AttendanceTrendChart data={analytics.byDate} threshold={threshold} />
    );

  const renderBreakdown = () =>
    analytics.isPending ? (
      <Skeleton width="100%" height="15rem" />
    ) : (
      <StatusBreakdownChart counts={analytics.statusCounts} />
    );

  const renderSubjects = () =>
    analytics.isPending ? (
      <Skeleton width="100%" height="15rem" />
    ) : (
      <SubjectAttendanceChart data={analytics.bySubject} threshold={threshold} />
    );

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadAttendanceReport(serverFilters);
      toast.success('Export started', 'Your browser is downloading the backend-generated CSV.');
    } catch (error) {
      toast.error('Export failed', describeApiError(error));
    } finally {
      setExporting(false);
    }
  };

  const rangeLabel = `${formatDate(serverFilters.from)} – ${formatDate(serverFilters.to)}`;
  const { summary } = analytics;

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle={`Attendance analytics computed by the backend for ${rangeLabel}.`}
        actions={
          <div className="row">
            <Button
              variant="secondary"
              icon={<FileSpreadsheet size={16} />}
              onClick={() => void handleExport()}
              isLoading={exporting}
              loadingText="Preparing CSV…"
              disabled={analytics.isPending || summary.totalRecords === 0}
            >
              Export CSV
            </Button>
          </div>
        }
      />

      {policy.data ? (
        <Alert
          tone="neutral"
          title={`Low-attendance threshold: ${formatPercent(policy.data.minAttendancePercentage, 0)}`}
          icon={<Gauge size={17} />}
        >
          Read live from <code className="text-mono">GET /api/admin/policy</code>. Students below it
          are flagged everywhere in this product.
        </Alert>
      ) : null}

      <Card flush>
        <ReportFilterBar
          values={filters}
          onChange={(patch) => setFilters((current) => ({ ...current, ...patch }))}
          onReset={() =>
            setFilters({
              ...EMPTY_REPORT_FILTERS,
              from: daysAgoInputValue(29),
              to: todayInputValue(),
            })
          }
          subjects={subjects.data ?? []}
          departments={departments.data ?? []}
          isLoading={analytics.isFetching}
          rangePresets={[
            { label: '7d', days: 7 },
            { label: '30d', days: 30 },
            { label: '90d', days: 90 },
          ]}
          onPreset={(days) =>
            setFilters((current) => ({
              ...current,
              from: daysAgoInputValue(days - 1),
              to: todayInputValue(),
            }))
          }
        />
      </Card>

      {analytics.isError ? (
        <Alert tone="error" title="Reports could not be loaded">
          {describeApiError(analytics.error)}
        </Alert>
      ) : null}

      <div className="stat-grid" style={{ marginTop: 'var(--space-5)' }}>
        <StatCard
          label="Records in range"
          value={formatNumber(summary.totalRecords)}
          icon={<CalendarRange size={18} />}
          isLoading={analytics.isPending}
          meta="Attendance rows returned by the report endpoint."
        />
        <StatCard
          label="Students covered"
          value={formatNumber(analytics.byStudent.length)}
          icon={<Users size={18} />}
          isLoading={analytics.isPending}
          tone="primary"
          meta="Distinct students with at least one record."
        />
        <StatCard
          label="Average attendance"
          value={formatPercent(summary.attendancePercentage, 1)}
          icon={<Gauge size={18} />}
          isLoading={analytics.isPending}
          tone={summary.attendancePercentage < threshold ? 'warning' : 'success'}
          meta={`${formatNumber(summary.present)} present of ${formatNumber(summary.totalRecords)} marks.`}
        />
        <StatCard
          label="Below minimum"
          value={formatNumber(analytics.lowAttendance.length)}
          icon={<TrendingDown size={18} />}
          isLoading={analytics.isPending}
          tone={analytics.lowAttendance.length > 0 ? 'danger' : 'success'}
          meta={`Under ${formatPercent(threshold, 0)} in this range.`}
        />
      </div>

      <Tabs<ReportTab>
        ariaLabel="Report views"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'charts', label: 'Trends & breakdown', icon: <TrendingDown size={15} /> },
          { value: 'students', label: 'Per student', icon: <Users size={15} /> },
        ]}
      />

      <div style={{ marginTop: 'var(--space-4)' }}>
        {tab === 'charts' ? (
          <div className="stack stack-4">
            <div className="charts-grid">
              <Card>
                <CardHeader
                  title="Attendance by date"
                  subtitle="Present versus absent marks for each day in the selected range."
                  headingLevel={2}
                />
                <CardBody>{renderTrend()}</CardBody>
              </Card>
              <Card>
                <CardHeader
                  title="Status breakdown"
                  subtitle="How every mark in this range was recorded."
                  headingLevel={2}
                />
                <CardBody>{renderBreakdown()}</CardBody>
              </Card>
            </div>
            <Card>
              <CardHeader
                title="Attendance by subject"
                subtitle={`Bars below ${formatPercent(threshold, 0)} are flagged.`}
                headingLevel={2}
              />
              <CardBody>{renderSubjects()}</CardBody>
            </Card>
          </div>
        ) : (
          <Card flush>
            <DataTable
              columns={studentColumns}
              rows={analytics.byStudent}
              rowKey={(student) => student.studentCode}
              isLoading={analytics.isPending}
              isFetching={analytics.isFetching}
              error={analytics.isError ? analytics.error : null}
              onRetry={analytics.refetch}
              caption="Per-student attendance in the selected range"
              emptyVariant="search"
              emptyTitle="No students in this range"
              emptyMessage="Widen the date range or clear the subject and department filters."
              renderMobileCard={(student) => (
                <>
                  <div className="card-list__header">
                    <div>
                      <p className="card-list__title">{student.studentName}</p>
                      <p className="text-caption text-mono">
                        {student.studentCode} · Roll {student.rollNumber}
                      </p>
                    </div>
                    <Badge tone={student.belowThreshold ? 'danger' : 'success'}>
                      {formatPercent(student.percentage, 1)}
                    </Badge>
                  </div>
                  <Progress
                    value={student.percentage}
                    size="sm"
                    tone={student.belowThreshold ? 'danger' : 'success'}
                  />
                  <div className="card-list__actions">
                    <span className="text-caption">
                      {student.present} of {student.total} marks · {student.department}
                    </span>
                  </div>
                </>
              )}
            />
          </Card>
        )}
      </div>

      {analytics.isSuccess && summary.totalRecords === 0 ? (
        <EmptyState
          variant="search"
          title="No records in this range"
          message="Attendance rows appear once students complete verification in a session."
          actionLabel="Reset to the last 30 days"
          onAction={() =>
            setFilters({
              ...EMPTY_REPORT_FILTERS,
              from: daysAgoInputValue(29),
              to: todayInputValue(),
            })
          }
        />
      ) : null}

      <LiveRegion>
        {analytics.isSuccess
          ? `${formatNumber(summary.totalRecords)} records for ${rangeLabel}. ${formatNumber(
              analytics.lowAttendance.length,
            )} students below the ${formatPercent(threshold, 0)} minimum.`
          : ''}
      </LiveRegion>

      <Alert tone="info" title="Exporting" icon={<Download size={17} />}>
        The CSV is generated by{' '}
        <code className="text-mono">GET /api/reports/attendance?format=csv</code> using the same
        date, subject and department filters as this page, and streams up to 5,000 rows. PDF export
        is not implemented by the backend, so it is deliberately not offered here.
      </Alert>
    </>
  );
}
