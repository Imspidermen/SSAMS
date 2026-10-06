import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ban, Eye, Pencil, Plus, RotateCcw, ScanFace, UserCheck, X } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink, IconButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { buildPaginationMeta } from '@/utils/pagination';
import { RawSelect } from '@/components/ui/Select';
import { Avatar } from '@/components/ui/Avatar';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { PageHeader } from '@/components/common/PageHeader';
import { SearchInput } from '@/components/common/SearchInput';
import { LiveRegion } from '@/components/common/LiveRegion';
import { useToast } from '@/hooks/useToast';
import {
  useDepartments,
  useResetStudentFace,
  useSetStudentActiveState,
  useStudents,
} from '@/hooks/queries/useAdminQueries';
import { useReportAnalytics } from '@/hooks/queries/useReportAnalytics';
import { usePolicy } from '@/hooks/queries/useAdminQueries';
import { paths } from '@/routes/paths';
import { DEFAULT_PAGE_SIZE, SEMESTERS, SECTIONS } from '@/utils/constants';
import { describeApiError } from '@/utils/apiError';
import { formatNumber, formatPercent } from '@/utils/format';
import { faceStatusMeta, studentStatusMeta } from '@/utils/attendance';
import type { Student } from '@/types';

interface StudentFilters {
  search: string;
  departmentId: string;
  semester: string;
  section: string;
}

const EMPTY_FILTERS: StudentFilters = {
  search: '',
  departmentId: '',
  semester: '',
  section: '',
};

const ATTENDANCE_WINDOW_DAYS = 90;

/**
 * Admin student management: server-side search, filters, pagination and the
 * row actions the backend actually supports (view, edit, deactivate/reactivate,
 * reset face profile).
 *
 * Search and filters are sent as query parameters - the browser never loads the
 * whole table to filter it locally.
 */
export function StudentsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [filters, setFilters] = useState<StudentFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [pendingDeactivate, setPendingDeactivate] = useState<Student | null>(null);
  const [pendingFaceReset, setPendingFaceReset] = useState<Student | null>(null);

  const departments = useDepartments();
  const policy = usePolicy();
  const threshold = policy.data?.minAttendancePercentage ?? 75;

  const students = useStudents({
    page,
    pageSize,
    search: filters.search || undefined,
    departmentId: filters.departmentId || undefined,
    semester: filters.semester ? Number(filters.semester) : undefined,
    section: filters.section || undefined,
  });

  // Attendance percentages for the visible students, aggregated from real
  // report rows over the last 90 days (the student list endpoint does not
  // return attendance data).
  const analytics = useReportAnalytics(undefined, {
    rangeDays: ATTENDANCE_WINDOW_DAYS,
    threshold,
  });

  const attendanceByCode = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of analytics.byStudent) map.set(entry.studentCode, entry.percentage);
    return map;
  }, [analytics.byStudent]);

  const setActive = useSetStudentActiveState();
  const resetFace = useResetStudentFace();

  // Any filter change resets pagination to page 1.
  const updateFilter = useCallback(
    <K extends keyof StudentFilters>(key: K, value: StudentFilters[K]) => {
      setFilters((current) => ({ ...current, [key]: value }));
      setPage(1);
    },
    [],
  );

  useEffect(() => {
    setPage(1);
  }, [pageSize]);

  const hasActiveFilters =
    filters.search !== '' ||
    filters.departmentId !== '' ||
    filters.semester !== '' ||
    filters.section !== '';

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setPage(1);
  };

  const rows = students.data?.items ?? [];
  const meta = buildPaginationMeta({
    total: students.data?.total ?? 0,
    page: students.data?.page ?? page,
    pageSize: students.data?.pageSize ?? pageSize,
  });

  const handleDeactivate = async () => {
    if (!pendingDeactivate) return;
    const student = pendingDeactivate;
    const nextActive = student.status !== 'ACTIVE';
    try {
      await setActive.mutateAsync({ id: student.id, active: nextActive });
      toast.success(
        nextActive ? 'Student reactivated' : 'Student deactivated',
        `${student.fullName} is now ${nextActive ? 'active' : 'inactive'}.`,
      );
    } catch (error) {
      toast.error('Action failed', describeApiError(error));
    } finally {
      setPendingDeactivate(null);
    }
  };

  const handleResetFace = async () => {
    if (!pendingFaceReset) return;
    const student = pendingFaceReset;
    try {
      await resetFace.mutateAsync(student.id);
      toast.success(
        'Face profile reset',
        `${student.fullName} must re-enrol before marking attendance.`,
      );
    } catch (error) {
      toast.error('Reset failed', describeApiError(error));
    } finally {
      setPendingFaceReset(null);
    }
  };

  const columns: DataTableColumn<Student>[] = [
    {
      id: 'student',
      header: 'Student',
      cell: (student) => (
        <div className="table-identity">
          <Avatar name={student.fullName} size="sm" />
          <div className="table-identity__text">
            <div className="table-identity__name">{student.fullName}</div>
            <div className="table-identity__meta">{student.user?.email}</div>
          </div>
        </div>
      ),
    },
    {
      id: 'roll',
      header: 'Roll no',
      cell: (student) => <span className="text-mono">{student.rollNumber}</span>,
    },
    {
      id: 'code',
      header: 'Student ID',
      cell: (student) => <span className="text-mono">{student.studentCode}</span>,
    },
    {
      id: 'class',
      header: 'Class',
      cell: (student) => (
        <span>
          {student.department?.code ?? '—'} · Sem {student.semester} · Sec {student.section}
        </span>
      ),
      hideOn: 'tablet',
    },
    {
      id: 'attendance',
      header: 'Attendance',
      align: 'right',
      cell: (student) => {
        const percentage = attendanceByCode.get(student.studentCode);
        if (percentage === undefined) {
          return <span className="text-caption">No records</span>;
        }
        return (
          <span className="row" style={{ gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
            <strong>{formatPercent(percentage)}</strong>
            {percentage < threshold ? <Badge tone="warning">Low</Badge> : null}
          </span>
        );
      },
      hideOn: 'tablet',
    },
    {
      id: 'face',
      header: 'Face profile',
      cell: (student) => {
        const status = student.faceProfile?.status ?? 'NOT_ENROLLED';
        const faceMeta = faceStatusMeta(status);
        return (
          <Badge
            tone={faceMeta.tone}
            dot
            title={`Samples stored: ${student.faceProfile?.sampleCount ?? 0}`}
          >
            {status === 'ENROLLED'
              ? 'Enrolled'
              : status === 'RESET'
                ? 'Needs re-enrolment'
                : 'Not enrolled'}
          </Badge>
        );
      },
      hideOn: 'tablet',
    },
    {
      id: 'status',
      header: 'Status',
      cell: (student) => {
        const statusMeta = studentStatusMeta(student.status);
        return (
          <Badge tone={statusMeta.tone} dot>
            {statusMeta.label}
          </Badge>
        );
      },
    },
    {
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      className: 'cell-actions',
      cell: (student) => {
        const isActive = student.status === 'ACTIVE';
        const faceStatus = student.faceProfile?.status ?? 'NOT_ENROLLED';
        return (
          <div className="row-actions" onClick={(event) => event.stopPropagation()}>
            <IconButton
              size="sm"
              variant="bordered"
              icon={<Eye size={15} />}
              label={`View ${student.fullName}`}
              onClick={() => navigate(paths.admin.studentDetail(student.id))}
            />
            <IconButton
              size="sm"
              variant="bordered"
              icon={<Pencil size={15} />}
              label={`Edit ${student.fullName}`}
              onClick={() => navigate(paths.admin.studentEdit(student.id))}
            />
            {faceStatus === 'ENROLLED' ? (
              <IconButton
                size="sm"
                variant="bordered"
                icon={<ScanFace size={15} />}
                label={`Reset face profile for ${student.fullName}`}
                onClick={() => setPendingFaceReset(student)}
              />
            ) : null}
            <IconButton
              size="sm"
              variant={isActive ? 'danger' : 'bordered'}
              icon={isActive ? <Ban size={15} /> : <UserCheck size={15} />}
              label={`${isActive ? 'Deactivate' : 'Reactivate'} ${student.fullName}`}
              onClick={() => setPendingDeactivate(student)}
            />
          </div>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Students"
        subtitle="Search, filter and manage student records, their class allocation and face-enrolment status."
        actions={
          <ButtonLink to={paths.admin.studentNew} icon={<Plus size={16} />}>
            Add student
          </ButtonLink>
        }
      />

      {students.isError ? <Alert tone="error">{describeApiError(students.error)}</Alert> : null}

      <Card flush>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(student) => student.id}
          isLoading={students.isPending}
          isFetching={students.isFetching}
          error={students.isError ? students.error : null}
          onRetry={() => void students.refetch()}
          caption="Students"
          onRowClick={(student) => navigate(paths.admin.studentDetail(student.id))}
          emptyVariant={hasActiveFilters ? 'search' : 'default'}
          emptyTitle={hasActiveFilters ? 'No students match your filters' : 'No students yet'}
          emptyMessage={
            hasActiveFilters
              ? 'Try a different name, roll number or student ID, or clear the filters.'
              : 'Add your first student to start recording attendance.'
          }
          emptyActionLabel={hasActiveFilters ? 'Clear filters' : 'Add student'}
          onEmptyAction={hasActiveFilters ? clearFilters : () => navigate(paths.admin.studentNew)}
          toolbar={
            <div className="toolbar">
              <SearchInput
                className="toolbar__group"
                label="Search students"
                placeholder="Search by name, roll number or student ID…"
                value={filters.search}
                onChange={(value) => updateFilter('search', value)}
              />

              <div className="toolbar__group">
                <label className="field__label" htmlFor="filter-department">
                  Department
                </label>
                <RawSelect
                  id="filter-department"
                  value={filters.departmentId}
                  onChange={(event) => updateFilter('departmentId', event.target.value)}
                >
                  <option value="">All departments</option>
                  {(departments.data ?? []).map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </RawSelect>
              </div>

              <div className="toolbar__group">
                <label className="field__label" htmlFor="filter-semester">
                  Semester
                </label>
                <RawSelect
                  id="filter-semester"
                  value={filters.semester}
                  onChange={(event) => updateFilter('semester', event.target.value)}
                >
                  <option value="">All semesters</option>
                  {SEMESTERS.map((semester) => (
                    <option key={semester} value={semester}>
                      Semester {semester}
                    </option>
                  ))}
                </RawSelect>
              </div>

              <div className="toolbar__group">
                <label className="field__label" htmlFor="filter-section">
                  Section
                </label>
                <RawSelect
                  id="filter-section"
                  value={filters.section}
                  onChange={(event) => updateFilter('section', event.target.value)}
                >
                  <option value="">All sections</option>
                  {SECTIONS.map((section) => (
                    <option key={section} value={section}>
                      Section {section}
                    </option>
                  ))}
                </RawSelect>
              </div>

              <div className="toolbar__actions">
                {hasActiveFilters ? (
                  <Button variant="ghost" size="sm" icon={<X size={15} />} onClick={clearFilters}>
                    Clear
                  </Button>
                ) : null}
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<RotateCcw size={15} />}
                  onClick={() => void students.refetch()}
                  isLoading={students.isFetching}
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
              isLoading={students.isFetching}
              itemLabel="students"
            />
          }
          renderMobileCard={(student) => {
            const percentage = attendanceByCode.get(student.studentCode);
            const statusMeta = studentStatusMeta(student.status);
            const face = faceStatusMeta(student.faceProfile?.status ?? 'NOT_ENROLLED');
            return (
              <>
                <div className="card-list__header">
                  <div className="table-identity">
                    <Avatar name={student.fullName} size="md" />
                    <div className="table-identity__text">
                      <div className="table-identity__name">{student.fullName}</div>
                      <div className="table-identity__meta">{student.user?.email}</div>
                    </div>
                  </div>
                  <Badge tone={statusMeta.tone} dot>
                    {statusMeta.label}
                  </Badge>
                </div>

                <dl className="card-list__meta">
                  <div>
                    <dt>Roll no</dt>
                    <dd>{student.rollNumber}</dd>
                  </div>
                  <div>
                    <dt>Student ID</dt>
                    <dd>{student.studentCode}</dd>
                  </div>
                  <div>
                    <dt>Class</dt>
                    <dd>
                      {student.department?.code ?? '—'} · Sem {student.semester} · Sec{' '}
                      {student.section}
                    </dd>
                  </div>
                  <div>
                    <dt>Attendance</dt>
                    <dd>{percentage === undefined ? 'No records' : formatPercent(percentage)}</dd>
                  </div>
                </dl>

                <div className="row" style={{ marginTop: 'var(--space-3)' }}>
                  <Badge tone={face.tone} dot>
                    {face.label}
                  </Badge>
                </div>

                <div className="card-list__actions">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Eye size={15} />}
                    onClick={() => navigate(paths.admin.studentDetail(student.id))}
                  >
                    View
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Pencil size={15} />}
                    onClick={() => navigate(paths.admin.studentEdit(student.id))}
                  >
                    Edit
                  </Button>
                  <Button
                    variant={student.status === 'ACTIVE' ? 'dangerOutline' : 'secondary'}
                    size="sm"
                    icon={student.status === 'ACTIVE' ? <Ban size={15} /> : <UserCheck size={15} />}
                    onClick={() => setPendingDeactivate(student)}
                  >
                    {student.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate'}
                  </Button>
                </div>
              </>
            );
          }}
        />
      </Card>

      <LiveRegion>
        {students.isSuccess
          ? `${formatNumber(students.data?.total ?? 0)} students, page ${meta.page} of ${meta.totalPages}.`
          : ''}
      </LiveRegion>

      <ConfirmDialog
        open={pendingDeactivate !== null}
        title={
          pendingDeactivate?.status === 'ACTIVE'
            ? 'Deactivate this student?'
            : 'Reactivate this student?'
        }
        message={
          pendingDeactivate?.status === 'ACTIVE' ? (
            <>
              <strong>{pendingDeactivate?.fullName}</strong> will no longer be able to sign in or
              mark attendance. Existing records are kept. You can reactivate them at any time.
            </>
          ) : (
            <>
              <strong>{pendingDeactivate?.fullName}</strong> will be able to sign in and mark
              attendance again.
            </>
          )
        }
        confirmLabel={pendingDeactivate?.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate'}
        tone={pendingDeactivate?.status === 'ACTIVE' ? 'danger' : 'primary'}
        isPending={setActive.isPending}
        pendingLabel={pendingDeactivate?.status === 'ACTIVE' ? 'Deactivating…' : 'Reactivating…'}
        onConfirm={() => void handleDeactivate()}
        onCancel={() => setPendingDeactivate(null)}
      />

      <ConfirmDialog
        open={pendingFaceReset !== null}
        title="Reset face profile?"
        message={
          <>
            This clears every stored face embedding for{' '}
            <strong>{pendingFaceReset?.fullName}</strong>. They will not be able to mark attendance
            until they re-enrol their face. Use this when the enrolled profile no longer matches
            (e.g. after a significant appearance change) or if enrolment was done incorrectly.
          </>
        }
        confirmLabel="Reset face profile"
        isPending={resetFace.isPending}
        pendingLabel="Resetting…"
        onConfirm={() => void handleResetFace()}
        onCancel={() => setPendingFaceReset(null)}
      />
    </>
  );
}
