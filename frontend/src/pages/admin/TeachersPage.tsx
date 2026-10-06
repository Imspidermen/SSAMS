import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Check, Copy, Info, RotateCcw, UserPlus } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { buildPaginationMeta } from '@/utils/pagination';
import { Avatar } from '@/components/ui/Avatar';
import { DefinitionList } from '@/components/common/DefinitionList';
import { PageHeader } from '@/components/common/PageHeader';
import { SearchInput } from '@/components/common/SearchInput';
import { TeacherForm } from '@/components/teachers/TeacherForm';
import { useToast } from '@/hooks/useToast';
import {
  useAssignTeacherSubject,
  useCreateTeacher,
  useDepartments,
  useSubjects,
  useTeachers,
} from '@/hooks/queries/useAdminQueries';
import { DEFAULT_PAGE_SIZE } from '@/utils/constants';
import { describeApiError, isApiError } from '@/utils/apiError';
import { formatDate, formatNumber } from '@/utils/format';
import type { Teacher } from '@/types';

/**
 * Teacher management.
 *
 * Backed by POST /admin/teachers and GET /admin/teachers (search + pagination).
 * Subject assignment uses POST /admin/subjects/assign-teacher.
 *
 * BACKEND GAP: there is no `PATCH /admin/teachers/:id` and no deactivate
 * endpoint (the validator `updateTeacherSchema` exists but is not routed), so
 * this page offers view + assign only. Editing/deactivating teachers is listed
 * in API_CONTRACT.md - no non-functional buttons are rendered here.
 */
export function TeachersPage() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [createOpen, setCreateOpen] = useState(false);
  const [viewing, setViewing] = useState<Teacher | null>(null);
  const [assigning, setAssigning] = useState<Teacher | null>(null);
  const [assignSubjectId, setAssignSubjectId] = useState<string>('');
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formFieldErrors, setFormFieldErrors] = useState<Record<string, string> | undefined>();

  const teachers = useTeachers({ page, pageSize, search: search || undefined });
  const departments = useDepartments();
  const subjects = useSubjects();
  const allTeachers = useTeachers({ page: 1, pageSize: 100 });

  const createTeacher = useCreateTeacher();
  const assignSubject = useAssignTeacherSubject();

  useEffect(() => {
    setPage(1);
  }, [search, pageSize]);

  const departmentName = useMemo(() => {
    const map = new Map((departments.data ?? []).map((d) => [d.id, d.name]));
    return (id: string) => map.get(id) ?? '—';
  }, [departments.data]);

  const rows = teachers.data?.items ?? [];
  const meta = buildPaginationMeta({
    total: teachers.data?.total ?? 0,
    page: teachers.data?.page ?? page,
    pageSize: teachers.data?.pageSize ?? pageSize,
  });

  const columns: DataTableColumn<Teacher>[] = [
    {
      id: 'teacher',
      header: 'Teacher',
      cell: (teacher) => (
        <div className="table-identity">
          <Avatar name={teacher.fullName} size="sm" />
          <div className="table-identity__text">
            <div className="table-identity__name">{teacher.fullName}</div>
            <div className="table-identity__meta">{teacher.user?.email}</div>
          </div>
        </div>
      ),
    },
    {
      id: 'employeeCode',
      header: 'Employee ID',
      cell: (teacher) => <span className="text-mono">{teacher.employeeCode}</span>,
    },
    {
      id: 'department',
      header: 'Department',
      cell: (teacher) => teacher.department?.name ?? departmentName(teacher.departmentId),
      hideOn: 'tablet',
    },
    {
      id: 'designation',
      header: 'Designation',
      cell: (teacher) => teacher.designation ?? <span className="text-caption">Not set</span>,
      hideOn: 'tablet',
    },
    {
      id: 'status',
      header: 'Status',
      cell: (teacher) => (
        <Badge tone={teacher.user?.isActive === false ? 'danger' : 'success'} dot>
          {teacher.user?.isActive === false ? 'Inactive' : 'Active'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      className: 'cell-actions',
      cell: (teacher) => (
        <div className="row-actions">
          <Button size="sm" variant="secondary" onClick={() => setViewing(teacher)}>
            View
          </Button>
          <Button
            size="sm"
            variant="soft"
            icon={<BookOpen size={14} />}
            onClick={() => {
              setAssigning(teacher);
              setAssignSubjectId('');
            }}
          >
            Assign subject
          </Button>
        </div>
      ),
    },
  ];

  const handleCreate = async (payload: Parameters<typeof createTeacher.mutateAsync>[0]) => {
    setFormError(null);
    setFormFieldErrors(undefined);
    try {
      const result = await createTeacher.mutateAsync(payload);
      if (result.temporaryPassword) {
        setTemporaryPassword(result.temporaryPassword);
      }
      toast.success('Teacher created', `${result.teacher.fullName} can now sign in.`);
      setCreateOpen(false);
    } catch (error) {
      if (isApiError(error) && Object.keys(error.fieldErrors).length > 0) {
        setFormFieldErrors(error.fieldErrors);
      }
      setFormError(describeApiError(error));
    }
  };

  const handleAssign = async () => {
    if (!assigning || !assignSubjectId) return;
    try {
      await assignSubject.mutateAsync({
        teacherId: assigning.id,
        subjectId: assignSubjectId,
      });
      const subject = (subjects.data ?? []).find((entry) => entry.id === assignSubjectId);
      toast.success(
        'Subject assigned',
        `${assigning.fullName} can now run sessions for ${subject?.name ?? 'this subject'}.`,
      );
      setAssigning(null);
      setAssignSubjectId('');
    } catch (error) {
      toast.error('Assignment failed', describeApiError(error));
    }
  };

  const copyPassword = async () => {
    if (!temporaryPassword) return;
    try {
      await navigator.clipboard.writeText(temporaryPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Copy failed', 'Select the password and copy it manually.');
    }
  };

  return (
    <>
      <PageHeader
        title="Teachers"
        subtitle="Create teaching staff accounts and assign them the subjects they can run attendance for."
        actions={
          <Button icon={<UserPlus size={16} />} onClick={() => setCreateOpen(true)}>
            Add teacher
          </Button>
        }
      />

      <Alert tone="info" title="Editing and deactivating teachers" icon={<Info size={17} />}>
        The backend currently exposes create, list and subject-assignment for teachers only. Edit
        and deactivate endpoints are documented as required additions in{' '}
        <code className="text-mono">frontend/API_CONTRACT.md</code>, so those controls are not shown
        here rather than pretending to work.
      </Alert>

      <Card flush>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(teacher) => teacher.id}
          isLoading={teachers.isPending}
          isFetching={teachers.isFetching}
          error={teachers.isError ? teachers.error : null}
          onRetry={() => void teachers.refetch()}
          caption="Teachers"
          emptyVariant={search ? 'search' : 'default'}
          emptyTitle={search ? 'No teachers match your search' : 'No teachers yet'}
          emptyMessage={
            search
              ? 'Try a different name or employee ID.'
              : 'Add your first teacher so subjects can be assigned and sessions started.'
          }
          emptyActionLabel={search ? undefined : 'Add teacher'}
          onEmptyAction={search ? undefined : () => setCreateOpen(true)}
          toolbar={
            <div className="toolbar">
              <SearchInput
                className="toolbar__group"
                label="Search teachers"
                placeholder="Search by name or employee ID…"
                value={search}
                onChange={setSearch}
              />
              <div className="toolbar__actions">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<RotateCcw size={15} />}
                  onClick={() => void teachers.refetch()}
                  isLoading={teachers.isFetching}
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
              isLoading={teachers.isFetching}
              itemLabel="teachers"
            />
          }
          renderMobileCard={(teacher) => (
            <>
              <div className="card-list__header">
                <div className="table-identity">
                  <Avatar name={teacher.fullName} size="md" />
                  <div className="table-identity__text">
                    <div className="table-identity__name">{teacher.fullName}</div>
                    <div className="table-identity__meta">{teacher.user?.email}</div>
                  </div>
                </div>
                <Badge tone={teacher.user?.isActive === false ? 'danger' : 'success'} dot>
                  {teacher.user?.isActive === false ? 'Inactive' : 'Active'}
                </Badge>
              </div>
              <dl className="card-list__meta">
                <div>
                  <dt>Employee ID</dt>
                  <dd>{teacher.employeeCode}</dd>
                </div>
                <div>
                  <dt>Department</dt>
                  <dd>{teacher.department?.name ?? departmentName(teacher.departmentId)}</dd>
                </div>
                <div>
                  <dt>Designation</dt>
                  <dd>{teacher.designation ?? '—'}</dd>
                </div>
                <div>
                  <dt>Phone</dt>
                  <dd>{teacher.phone ?? '—'}</dd>
                </div>
              </dl>
              <div className="card-list__actions">
                <Button variant="secondary" size="sm" onClick={() => setViewing(teacher)}>
                  View
                </Button>
                <Button
                  variant="soft"
                  size="sm"
                  icon={<BookOpen size={14} />}
                  onClick={() => setAssigning(teacher)}
                >
                  Assign subject
                </Button>
              </div>
            </>
          )}
        />
      </Card>

      {/* Create teacher */}
      <Modal
        open={createOpen}
        onClose={() => {
          if (createTeacher.isPending) return;
          setCreateOpen(false);
          setFormError(null);
          setFormFieldErrors(undefined);
        }}
        title="Add teacher"
        description="Creates a staff login and academic profile."
        size="lg"
        dismissible={!createTeacher.isPending}
      >
        {formError ? (
          <Alert tone="error" title="Could not create teacher">
            {formError}
          </Alert>
        ) : null}
        {Object.keys(formFieldErrors ?? {}).length > 0 ? (
          <Alert tone="error" title="The server rejected some values">
            {Object.entries(formFieldErrors ?? {})
              .map(([field, message]) => `${field}: ${message}`)
              .join(' · ')}
          </Alert>
        ) : null}
        <TeacherForm
          departments={departments.data ?? []}
          isDepartmentsLoading={departments.isPending}
          isSubmitting={createTeacher.isPending}
          onSubmit={(payload) => void handleCreate(payload)}
          onCancel={() => setCreateOpen(false)}
        />
      </Modal>

      {/* View teacher */}
      <Modal
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title={viewing?.fullName ?? 'Teacher'}
        description={viewing?.designation ?? undefined}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setViewing(null)}>
              Close
            </Button>
            <Button
              icon={<BookOpen size={16} />}
              onClick={() => {
                const teacher = viewing;
                setViewing(null);
                setAssigning(teacher);
              }}
            >
              Assign subject
            </Button>
          </>
        }
      >
        {viewing ? (
          <div className="stack stack-4">
            <div className="profile-hero">
              <Avatar name={viewing.fullName} size="lg" />
              <div className="stack stack-2" style={{ alignItems: 'center' }}>
                <p className="section-title">{viewing.fullName}</p>
                <p className="text-caption text-mono">{viewing.employeeCode}</p>
                <Badge tone={viewing.user?.isActive === false ? 'danger' : 'success'} dot>
                  {viewing.user?.isActive === false ? 'Inactive' : 'Active'}
                </Badge>
              </div>
            </div>
            <DefinitionList
              stacked
              items={[
                { term: 'Email', value: viewing.user?.email },
                { term: 'Phone', value: viewing.phone },
                {
                  term: 'Department',
                  value: viewing.department?.name ?? departmentName(viewing.departmentId),
                },
                { term: 'Designation', value: viewing.designation },
                {
                  term: 'Employee ID',
                  value: <span className="text-mono">{viewing.employeeCode}</span>,
                },
                { term: 'Added on', value: formatDate(viewing.createdAt) },
              ]}
            />
          </div>
        ) : null}
      </Modal>

      {/* Assign subject */}
      <Modal
        open={assigning !== null}
        onClose={() => !assignSubject.isPending && setAssigning(null)}
        title={`Assign a subject to ${assigning?.fullName ?? ''}`}
        description="Only assigned subjects can be used to open attendance sessions."
        size="sm"
        dismissible={!assignSubject.isPending}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setAssigning(null)}
              disabled={assignSubject.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleAssign()}
              disabled={!assignSubjectId}
              isLoading={assignSubject.isPending}
              loadingText="Assigning…"
            >
              Assign subject
            </Button>
          </>
        }
      >
        <div className="stack stack-3">
          <div className="field">
            <label className="field__label" htmlFor="assign-subject-select">
              Subject
              <span className="field__required" aria-hidden="true">
                *
              </span>
            </label>
            <select
              id="assign-subject-select"
              className="select"
              value={assignSubjectId}
              onChange={(event) => setAssignSubjectId(event.target.value)}
              disabled={subjects.isPending}
            >
              <option value="">
                {subjects.isPending ? 'Loading subjects…' : 'Select a subject'}
              </option>
              {(subjects.data ?? []).map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.code} · {subject.name} (Sem {subject.semester})
                </option>
              ))}
            </select>
            {subjects.isError ? (
              <p className="field__error">{describeApiError(subjects.error)}</p>
            ) : null}
          </div>
          <p className="text-caption">
            {formatNumber(allTeachers.data?.total ?? 0)} teaching staff available institution-wide.
          </p>
        </div>
      </Modal>

      {/* Temporary password */}
      <Modal
        open={temporaryPassword !== null}
        onClose={() => setTemporaryPassword(null)}
        title="Teacher created — share this password now"
        description="Generated by the backend and shown only once. It is not stored in the browser."
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              icon={copied ? <Check size={16} /> : <Copy size={16} />}
              onClick={() => void copyPassword()}
            >
              {copied ? 'Copied' : 'Copy password'}
            </Button>
            <Button onClick={() => setTemporaryPassword(null)}>Done</Button>
          </>
        }
      >
        <p className="password-reveal text-mono" aria-label="Temporary password">
          {temporaryPassword}
        </p>
      </Modal>
    </>
  );
}
