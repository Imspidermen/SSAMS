import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, Eye, History, Info } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { buildPaginationMeta } from '@/utils/pagination';
import { Avatar } from '@/components/ui/Avatar';
import { PageHeader } from '@/components/common/PageHeader';
import { LiveRegion } from '@/components/common/LiveRegion';
import { ReportFilterBar } from '@/components/reports/ReportFilterBar';
import { EMPTY_REPORT_FILTERS, type ReportFilterValues } from '@/utils/reportFilters';
import { ReportRowDetailsModal } from '@/components/reports/RecordDetailsModal';
import { useToast } from '@/hooks/useToast';
import { useAttendanceReport } from '@/hooks/queries/useReportQueries';
import { useDepartments, useSubjects } from '@/hooks/queries/useAdminQueries';
import { useTeacherDashboard, useTeacherSubjects } from '@/hooks/queries/useTeacherQueries';
import { downloadAttendanceReport, paginateRows } from '@/services/report.service';
import { describeApiError } from '@/utils/apiError';
import { attendanceStatusMeta } from '@/utils/attendance';
import { DEFAULT_PAGE_SIZE } from '@/utils/constants';
import { daysAgoInputValue, toEndOfDayIso, toStartOfDayIso, todayInputValue } from '@/utils/date';
import { formatDate, formatNumber } from '@/utils/format';
import type { ReportRow, Role } from '@/types';

export interface AttendanceHistoryPageProps {
  role: Extract<Role, 'ADMIN' | 'TEACHER'>;
}

const DEFAULT_RANGE_DAYS = 30;

/**
 * Attendance history for admins and teachers.
 *
 * Data source: GET /reports/attendance (ADMIN + TEACHER), which the backend
 * computes from PostgreSQL and caps at 5000 rows. Date range, subject,
 * department and teacher are server-side filters; status and free-text search
 * are applied to the returned rows because the endpoint does not accept them.
 * A teacher's view is pinned to their own `teacherId`, so they can only ever
 * request their own records.
 */
export function AttendanceHistoryPage({ role }: AttendanceHistoryPageProps) {
  const toast = useToast();
  const isTeacher = role === 'TEACHER';
  // Deep links such as /teacher/attendance/history?subjectId=... pre-apply a
  // server-side filter.
  const [searchParams] = useSearchParams();
  const initialSubjectId = searchParams.get('subjectId') ?? '';

  const teacherDashboard = useTeacherDashboard(isTeacher);
  const teacherSubjects = useTeacherSubjects(isTeacher);
  const departments = useDepartments(!isTeacher);
  const adminSubjects = useSubjects(undefined, !isTeacher);

  const [filters, setFilters] = useState<ReportFilterValues>(() => ({
    ...EMPTY_REPORT_FILTERS,
    from: daysAgoInputValue(DEFAULT_RANGE_DAYS - 1),
    to: todayInputValue(),
    subjectId: initialSubjectId,
  }));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [selected, setSelected] = useState<ReportRow | null>(null);
  const [exporting, setExporting] = useState(false);

  const teacherId = teacherDashboard.data?.teacher?.id;

  // Teachers must wait for their own id before querying, so they never fetch
  // institution-wide rows.
  const canQuery = !isTeacher || Boolean(teacherId);

  const serverFilters = useMemo(
    () => ({
      from: filters.from ? toStartOfDayIso(filters.from) : undefined,
      to: filters.to ? toEndOfDayIso(filters.to) : undefined,
      subjectId: filters.subjectId || undefined,
      departmentId: isTeacher ? undefined : filters.departmentId || undefined,
      teacherId: isTeacher ? teacherId : undefined,
    }),
    [filters.from, filters.to, filters.subjectId, filters.departmentId, isTeacher, teacherId],
  );

  const report = useAttendanceReport(serverFilters, canQuery);

  const subjects = useMemo(() => {
    if (!isTeacher) return adminSubjects.data ?? [];
    return (teacherSubjects.data ?? [])
      .map((assignment) => assignment.subject)
      .filter((subject): subject is NonNullable<typeof subject> => Boolean(subject));
  }, [isTeacher, adminSubjects.data, teacherSubjects.data]);

  const rows = useMemo(() => {
    const all = report.data ?? [];
    const term = filters.search.trim().toLowerCase();
    return all.filter((row) => {
      if (filters.status && row.status !== filters.status) return false;
      if (!term) return true;
      return (
        row.studentName.toLowerCase().includes(term) ||
        row.studentCode.toLowerCase().includes(term) ||
        row.rollNumber.toLowerCase().includes(term) ||
        row.subjectName.toLowerCase().includes(term) ||
        row.subjectCode.toLowerCase().includes(term) ||
        row.teacher.toLowerCase().includes(term)
      );
    });
  }, [report.data, filters.search, filters.status]);

  const paged = useMemo(() => paginateRows(rows, page, pageSize), [rows, page, pageSize]);
  const meta = buildPaginationMeta({ total: rows.length, page, pageSize });

  const updateFilters = useCallback((patch: Partial<ReportFilterValues>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  }, []);

  useEffect(() => {
    setPage(1);
  }, [pageSize]);

  const applyPreset = (days: number) => {
    updateFilters({ from: daysAgoInputValue(days - 1), to: todayInputValue() });
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadAttendanceReport(serverFilters);
      toast.success('Export started', 'The CSV download was generated by the backend.');
    } catch (error) {
      toast.error('Export failed', describeApiError(error));
    } finally {
      setExporting(false);
    }
  };

  const columns: DataTableColumn<ReportRow>[] = [
    {
      id: 'date',
      header: 'Date',
      cell: (row) => (
        <div>
          <div className="cell-primary">{formatDate(row.date)}</div>
          <div className="cell-sub text-mono">{row.time}</div>
        </div>
      ),
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
              {row.rollNumber} · {row.studentCode}
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
      header: 'Marked by',
      cell: (row) => row.teacher,
      hideOn: 'tablet',
    },
    {
      id: 'verification',
      header: 'Verified',
      cell: (row) => {
        const passed = [
          row.faceVerified,
          row.livenessVerified,
          row.blinkVerified,
          row.locationVerified,
        ].filter(Boolean).length;
        return (
          <Badge tone={passed === 4 ? 'success' : 'warning'} title={`${passed} of 4 checks passed`}>
            {passed}/4 checks
          </Badge>
        );
      },
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
        title="Attendance history"
        subtitle={
          isTeacher
            ? 'Every record from your own sessions, with the verification evidence behind each mark.'
            : 'Every recorded attendance mark across the institution, with verification evidence.'
        }
        actions={
          <Button
            variant="secondary"
            icon={<Download size={16} />}
            onClick={() => void handleExport()}
            isLoading={exporting}
            loadingText="Preparing CSV…"
            disabled={rows.length === 0}
          >
            Export CSV
          </Button>
        }
      />

      {isTeacher && teacherDashboard.isPending ? (
        <Alert tone="info">Loading your teaching profile…</Alert>
      ) : null}

      {isTeacher && teacherDashboard.isError ? (
        <Alert tone="error" title="Could not load your profile">
          {describeApiError(teacherDashboard.error)}
        </Alert>
      ) : null}

      <Alert tone="info" title="About these filters" icon={<Info size={17} />}>
        Date range, subject{isTeacher ? '' : ', department'} and teacher are applied by the backend.
        Status and text search narrow the returned rows in the browser, because the report endpoint
        does not accept those parameters. The CSV export always reflects the backend-side filters.
      </Alert>

      <Card flush>
        <DataTable
          columns={columns}
          rows={paged.items}
          rowKey={(row) => `${row.date}-${row.time}-${row.studentCode}-${row.subjectCode}`}
          isLoading={report.isPending && canQuery}
          isFetching={report.isFetching}
          error={report.isError ? report.error : null}
          onRetry={() => void report.refetch()}
          caption="Attendance history"
          onRowClick={(row) => setSelected(row)}
          emptyVariant={filters.search || filters.status ? 'search' : 'default'}
          emptyTitle={
            filters.search || filters.status
              ? 'No records match your filters'
              : 'No attendance records found'
          }
          emptyMessage={
            filters.search || filters.status
              ? 'Try clearing the status or search filter, or widen the date range.'
              : `Nothing was recorded between ${formatDate(serverFilters.from)} and ${formatDate(serverFilters.to)}. Try a wider date range.`
          }
          emptyActionLabel={filters.search || filters.status ? 'Clear filters' : undefined}
          onEmptyAction={
            filters.search || filters.status
              ? () => setFilters((current) => ({ ...current, search: '', status: '' }))
              : undefined
          }
          toolbar={
            <ReportFilterBar
              values={filters}
              onChange={updateFilters}
              onReset={() =>
                setFilters({
                  ...EMPTY_REPORT_FILTERS,
                  from: daysAgoInputValue(DEFAULT_RANGE_DAYS - 1),
                  to: todayInputValue(),
                })
              }
              subjects={subjects}
              departments={departments.data ?? []}
              showDepartments={!isTeacher}
              isLoading={report.isFetching}
              rangePresets={[
                { label: '7d', days: 7 },
                { label: '30d', days: 30 },
                { label: '90d', days: 90 },
              ]}
              onPreset={applyPreset}
            />
          }
          footer={
            <Pagination
              meta={meta}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              isLoading={report.isFetching}
              itemLabel="records"
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
                        Roll {row.rollNumber} · {row.studentCode}
                      </div>
                    </div>
                  </div>
                  <Badge tone={statusMeta.tone} dot>
                    {statusMeta.label}
                  </Badge>
                </div>
                <dl className="card-list__meta">
                  <div>
                    <dt>Date</dt>
                    <dd>
                      {formatDate(row.date)} · <span className="text-mono">{row.time}</span>
                    </dd>
                  </div>
                  <div>
                    <dt>Subject</dt>
                    <dd>{row.subjectName}</dd>
                  </div>
                  <div>
                    <dt>Classroom</dt>
                    <dd>{row.classroom}</dd>
                  </div>
                  <div>
                    <dt>Marked by</dt>
                    <dd>{row.teacher}</dd>
                  </div>
                </dl>
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
          ? `${formatNumber(rows.length)} records match the current filters; showing page ${meta.page} of ${meta.totalPages}.`
          : ''}
      </LiveRegion>

      <ReportRowDetailsModal
        open={selected !== null}
        row={selected}
        onClose={() => setSelected(null)}
      />

      {rows.length === 0 && !report.isPending && !report.isError ? (
        <p className="text-caption row" style={{ gap: 'var(--space-2)', justifyContent: 'center' }}>
          <History size={13} aria-hidden="true" />
          Records are created only when a student completes the verification pipeline in a live
          session.
        </p>
      ) : null}
    </>
  );
}
