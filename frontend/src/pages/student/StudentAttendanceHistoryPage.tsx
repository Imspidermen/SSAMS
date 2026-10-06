import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarDays, Download, Eye, Filter, X } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { Gauge, Progress } from '@/components/ui/Progress';
import { Pagination } from '@/components/ui/Pagination';
import { buildPaginationMeta } from '@/utils/pagination';
import { RawSelect } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { SearchInput } from '@/components/common/SearchInput';
import { PageHeader } from '@/components/common/PageHeader';
import { LiveRegion } from '@/components/common/LiveRegion';
import { AttendanceIndicator } from '@/components/common/AttendanceIndicator';
import { AttendanceRecordDetailsModal } from '@/components/reports/RecordDetailsModal';
import { SubjectAttendanceChart } from '@/components/dashboard/SubjectAttendanceChart';
import { useMyAttendance, useMyHistory } from '@/hooks/queries/useStudentQueries';
import { attendanceStatusMeta, attendanceTone } from '@/utils/attendance';
import { describeApiError } from '@/utils/apiError';
import { DEFAULT_PAGE_SIZE } from '@/utils/constants';
import { paginateRows } from '@/services/report.service';
import { formatDate, formatNumber, formatPercent, formatTime } from '@/utils/format';
import type { AttendanceRecord } from '@/types';

/**
 * My attendance: overall percentage, subject-wise breakdown and every recorded
 * class.
 *
 *   GET /students/me/attendance          -> overall, subjectWise, minimum
 *   GET /students/me/attendance/history  -> full records incl. session details
 *
 * Both endpoints are student-scoped and accept no filter parameters (the history
 * is capped at 500 rows, newest first), so the search/status/date controls below
 * narrow the returned records in the browser. That is stated in the UI and in
 * API_CONTRACT.md rather than implied to be server-side.
 */
export function StudentAttendanceHistoryPage() {
  const overview = useMyAttendance();
  const history = useMyHistory();
  const [searchParams] = useSearchParams();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [subjectId, setSubjectId] = useState(searchParams.get('subjectId') ?? '');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [selected, setSelected] = useState<AttendanceRecord | null>(null);

  const minimum = overview.data?.minAttendancePercentage ?? 0;
  const records = useMemo(() => history.data ?? [], [history.data]);

  useEffect(() => {
    setPage(1);
  }, [search, status, from, to, subjectId, pageSize]);

  const subjects = useMemo(() => {
    const map = new Map<string, string>();
    for (const record of records) {
      const subject = record.session?.subject;
      if (subject) map.set(subject.id, subject.name);
    }
    for (const entry of overview.data?.subjectWise ?? [])
      map.set(entry.subjectId, entry.subjectName);
    return [...map.entries()];
  }, [records, overview.data?.subjectWise]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return records.filter((record) => {
      if (status && record.status !== status) return false;
      if (subjectId && record.session?.subjectId !== subjectId) return false;

      const day = record.markedAt.slice(0, 10);
      if (from && day < from) return false;
      if (to && day > to) return false;

      if (!term) return true;
      return (
        (record.session?.subject?.name ?? '').toLowerCase().includes(term) ||
        (record.session?.subject?.code ?? '').toLowerCase().includes(term) ||
        (record.session?.classroom?.name ?? '').toLowerCase().includes(term) ||
        (record.session?.teacher?.fullName ?? '').toLowerCase().includes(term)
      );
    });
  }, [records, search, status, subjectId, from, to]);

  const paged = useMemo(() => paginateRows(filtered, page, pageSize), [filtered, page, pageSize]);
  const meta = buildPaginationMeta({ total: filtered.length, page, pageSize });

  const subjectBars = useMemo(
    () =>
      (overview.data?.subjectWise ?? []).map((entry) => ({
        label: entry.subjectName,
        code: entry.subjectCode,
        percentage: entry.percentage,
        present: entry.present,
        total: entry.total,
      })),
    [overview.data?.subjectWise],
  );

  const columns: DataTableColumn<AttendanceRecord>[] = [
    {
      id: 'date',
      header: 'Date',
      cell: (record) => (
        <div>
          <div className="cell-primary">{formatDate(record.markedAt)}</div>
          <div className="cell-sub text-mono">{formatTime(record.markedAt)}</div>
        </div>
      ),
    },
    {
      id: 'subject',
      header: 'Subject',
      cell: (record) => (
        <div>
          <div className="cell-primary">{record.session?.subject?.name ?? 'Class'}</div>
          <div className="cell-sub text-mono">{record.session?.subject?.code ?? '—'}</div>
        </div>
      ),
    },
    {
      id: 'classroom',
      header: 'Room',
      cell: (record) => record.session?.classroom?.name ?? '—',
      hideOn: 'tablet',
    },
    {
      id: 'teacher',
      header: 'Teacher',
      cell: (record) => record.session?.teacher?.fullName ?? '—',
      hideOn: 'tablet',
    },
    {
      id: 'status',
      header: 'Status',
      cell: (record) => {
        const recordMeta = attendanceStatusMeta(record.status);
        return (
          <Badge tone={recordMeta.tone} dot>
            {recordMeta.label}
          </Badge>
        );
      },
    },
    {
      id: 'verification',
      header: 'Checks',
      cell: (record) => {
        const passed = [
          record.locationVerified,
          record.faceVerified,
          record.livenessVerified,
          record.blinkVerified,
        ].filter(Boolean).length;
        return (
          <Badge
            tone={passed === 4 ? 'success' : 'warning'}
            title={`${passed} of 4 verification checks passed`}
          >
            {passed}/4
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
      cell: (record) => (
        <Button
          size="sm"
          variant="ghost"
          icon={<Eye size={15} />}
          onClick={() => setSelected(record)}
        >
          Details
        </Button>
      ),
    },
  ];

  const hasFilters = search !== '' || status !== '' || from !== '' || to !== '' || subjectId !== '';
  const overall = overview.data?.overall;

  return (
    <>
      <PageHeader
        title="My attendance"
        subtitle="Your overall percentage, every subject, and the full record of classes you attended."
      />

      <div className="dashboard-split">
        <Card>
          <CardHeader
            title="Overall"
            subtitle={`Institutional minimum ${formatPercent(minimum, 0)}.`}
            headingLevel={2}
            actions={
              overall ? (
                <AttendanceIndicator percentage={overall.percentage} threshold={minimum} compact />
              ) : undefined
            }
          />
          <CardBody>
            {overview.isPending ? (
              <div className="stack stack-3" style={{ alignItems: 'center' }}>
                <Skeleton variant="circle" width="10.5rem" height="10.5rem" />
                <Skeleton width="60%" height="1rem" />
              </div>
            ) : overview.isError ? (
              <Alert tone="error" title="Attendance could not be loaded">
                {describeApiError(overview.error)}
              </Alert>
            ) : (
              <div className="stack stack-4" style={{ alignItems: 'center' }}>
                <Gauge
                  value={overall?.percentage ?? 0}
                  tone={attendanceTone(overall?.percentage ?? 0, minimum)}
                  caption="Overall attendance"
                />
                <dl className="stat-lines">
                  <div className="stat-line">
                    <dt>Attended</dt>
                    <dd>
                      <strong>{formatNumber(overall?.present ?? 0)}</strong>
                      <span className="text-caption">classes</span>
                    </dd>
                  </div>
                  <div className="stat-line">
                    <dt>Missed</dt>
                    <dd>
                      <strong>{formatNumber(overall?.absent ?? 0)}</strong>
                      <span className="text-caption">classes</span>
                    </dd>
                  </div>
                  <div className="stat-line">
                    <dt>Total held</dt>
                    <dd>
                      <strong>{formatNumber(overall?.total ?? 0)}</strong>
                      <span className="text-caption">classes</span>
                    </dd>
                  </div>
                </dl>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Subject-wise"
            subtitle="Percentage per subject, with how many classes you need to recover."
            headingLevel={2}
          />
          <CardBody>
            {overview.isPending ? (
              <div className="stack stack-3">
                <Skeleton width="100%" height="2rem" />
                <Skeleton width="100%" height="2rem" />
                <Skeleton width="100%" height="2rem" />
              </div>
            ) : (overview.data?.subjectWise ?? []).length === 0 ? (
              <p className="text-caption">
                No subject records yet. Attendance appears here after your first verified session.
              </p>
            ) : (
              <ul className="card-list">
                {(overview.data?.subjectWise ?? []).map((entry) => (
                  <li className="card-list__item" key={entry.subjectId}>
                    <div className="stat-line">
                      <div>
                        <p className="card-list__title">{entry.subjectName}</p>
                        <p className="text-caption text-mono">
                          {entry.subjectCode} · {formatNumber(entry.present)} attended ·{' '}
                          {formatNumber(entry.absent)} missed of {formatNumber(entry.total)}
                        </p>
                      </div>
                      <Badge tone={entry.belowThreshold ? 'danger' : 'success'}>
                        {formatPercent(entry.percentage, 1)}
                      </Badge>
                    </div>
                    <Progress
                      value={entry.percentage}
                      tone={entry.belowThreshold ? 'danger' : 'success'}
                      size="sm"
                      label={
                        entry.belowThreshold
                          ? `Attend the next ${formatNumber(entry.classesNeededForTarget)} classes to reach ${formatPercent(minimum, 0)}`
                          : `Above the ${formatPercent(minimum, 0)} minimum`
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <Card style={{ marginTop: 'var(--space-4)' }}>
        <CardHeader title="Attendance by subject" headingLevel={2} />
        <CardBody>
          {overview.isPending ? (
            <Skeleton width="100%" height="14rem" />
          ) : (
            <SubjectAttendanceChart data={subjectBars} threshold={minimum} />
          )}
        </CardBody>
      </Card>

      <Card flush style={{ marginTop: 'var(--space-4)' }}>
        <DataTable
          columns={columns}
          rows={paged.items}
          rowKey={(record) => record.id}
          isLoading={history.isPending}
          isFetching={history.isFetching}
          error={history.isError ? history.error : null}
          onRetry={() => void history.refetch()}
          caption="My attendance records"
          onRowClick={(record) => setSelected(record)}
          emptyVariant={hasFilters ? 'search' : 'default'}
          emptyTitle={hasFilters ? 'No records match your filters' : 'No attendance records yet'}
          emptyMessage={
            hasFilters
              ? 'Clear a filter or widen the date range to see more classes.'
              : 'Your first verified session will appear here with the checks that passed.'
          }
          emptyActionLabel={hasFilters ? 'Clear filters' : undefined}
          onEmptyAction={
            hasFilters
              ? () => {
                  setSearch('');
                  setStatus('');
                  setSubjectId('');
                  setFrom('');
                  setTo('');
                }
              : undefined
          }
          toolbar={
            <div className="toolbar">
              <SearchInput
                className="toolbar__group"
                label="Search my records"
                placeholder="Search subject, room or teacher…"
                value={search}
                onChange={setSearch}
              />
              <div className="toolbar__group">
                <label className="field__label" htmlFor="history-subject">
                  Subject
                </label>
                <RawSelect
                  id="history-subject"
                  value={subjectId}
                  onChange={(event) => setSubjectId(event.target.value)}
                >
                  <option value="">All subjects</option>
                  {subjects.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </RawSelect>
              </div>
              <div className="toolbar__group">
                <label className="field__label" htmlFor="history-status">
                  Status
                </label>
                <RawSelect
                  id="history-status"
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                >
                  <option value="">All statuses</option>
                  <option value="PRESENT">Present</option>
                  <option value="LATE">Late</option>
                  <option value="ABSENT">Absent</option>
                  <option value="EXCUSED">Excused</option>
                </RawSelect>
              </div>
              <div className="toolbar__group">
                <label className="field__label" htmlFor="history-from">
                  From
                </label>
                <input
                  id="history-from"
                  className="input"
                  type="date"
                  value={from}
                  max={to || undefined}
                  onChange={(event) => setFrom(event.target.value)}
                />
              </div>
              <div className="toolbar__group">
                <label className="field__label" htmlFor="history-to">
                  To
                </label>
                <input
                  id="history-to"
                  className="input"
                  type="date"
                  value={to}
                  min={from || undefined}
                  onChange={(event) => setTo(event.target.value)}
                />
              </div>
              <div className="toolbar__actions">
                {hasFilters ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<X size={15} />}
                    onClick={() => {
                      setSearch('');
                      setStatus('');
                      setSubjectId('');
                      setFrom('');
                      setTo('');
                    }}
                  >
                    Clear
                  </Button>
                ) : (
                  <span className="text-caption row" style={{ gap: 'var(--space-1)' }}>
                    <Filter size={13} aria-hidden="true" />
                    Newest first
                  </span>
                )}
              </div>
            </div>
          }
          footer={
            <Pagination
              meta={meta}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              isLoading={history.isFetching}
              itemLabel="records"
            />
          }
          renderMobileCard={(record) => {
            const recordMeta = attendanceStatusMeta(record.status);
            const passed = [
              record.locationVerified,
              record.faceVerified,
              record.livenessVerified,
              record.blinkVerified,
            ].filter(Boolean).length;
            return (
              <>
                <div className="card-list__header">
                  <div>
                    <p className="card-list__title">{record.session?.subject?.name ?? 'Class'}</p>
                    <p className="text-caption">
                      {formatDate(record.markedAt)} ·{' '}
                      <span className="text-mono">{formatTime(record.markedAt)}</span>
                    </p>
                  </div>
                  <Badge tone={recordMeta.tone} dot>
                    {recordMeta.label}
                  </Badge>
                </div>
                <dl className="card-list__meta">
                  <div>
                    <dt>Room</dt>
                    <dd>{record.session?.classroom?.name ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Teacher</dt>
                    <dd>{record.session?.teacher?.fullName ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Checks passed</dt>
                    <dd>{passed}/4</dd>
                  </div>
                </dl>
                <div className="card-list__actions">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Eye size={14} />}
                    onClick={() => setSelected(record)}
                  >
                    View details
                  </Button>
                </div>
              </>
            );
          }}
        />
      </Card>

      <Alert tone="info" title="About this list" icon={<CalendarDays size={17} />}>
        Your history endpoint returns your {formatNumber(records.length)} most recent records with
        no server-side filters, so the search, status, subject and date controls narrow that list in
        the browser. Exports are an administrative function (
        <code className="text-mono">GET /api/reports/attendance?format=csv</code> is restricted to
        admins and teachers), so there is no download button on this screen.
      </Alert>

      {records.length >= 500 ? (
        <Alert tone="warning" title="Showing your 500 most recent records">
          The backend caps this endpoint at 500 rows. Older records still count towards your
          percentage, which is calculated server-side over everything.
        </Alert>
      ) : null}

      <LiveRegion>
        {history.isSuccess
          ? `${formatNumber(filtered.length)} records shown. Overall attendance ${formatPercent(
              overall?.percentage ?? 0,
              1,
            )} percent.`
          : ''}
      </LiveRegion>

      <AttendanceRecordDetailsModal
        open={selected !== null}
        record={selected}
        onClose={() => setSelected(null)}
      />

      <p className="text-caption row" style={{ gap: 'var(--space-2)', justifyContent: 'center' }}>
        <Download size={13} aria-hidden="true" />
        Need an official statement? Ask your department office - administrators can export the same
        records as CSV.
      </p>
    </>
  );
}
