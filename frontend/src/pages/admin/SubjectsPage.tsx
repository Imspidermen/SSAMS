import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Plus, RotateCcw, UserCog, Users, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button, IconButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { RawSelect } from '@/components/ui/Select';
import { PageHeader } from '@/components/common/PageHeader';
import { SearchInput } from '@/components/common/SearchInput';
import { AssignTeacherDialog } from '@/components/subjects/AssignTeacherDialog';
import { useToast } from '@/hooks/useToast';
import {
  useAssignTeacherSubject,
  useCourses,
  useCreateSubject,
  useDepartments,
  useEnrollStudentSubject,
  useStudents,
  useSubjects,
  useTeachers,
} from '@/hooks/queries/useAdminQueries';
import { SEMESTERS } from '@/utils/constants';
import { describeApiError } from '@/utils/apiError';
import { formatNumber } from '@/utils/format';
import {
  subjectSchema,
  toSubjectPayload,
  type SubjectFormValues,
} from '@/validators/academic.schema';
import type { Subject } from '@/types';

/**
 * Subject management: create subjects, assign the teacher who can run their
 * sessions, and enrol students so sessions include them.
 *
 * GET /admin/subjects supports `departmentId` and `semester` filters (used
 * here) but no text search, so the name/code search filters the returned list
 * locally. Subject counts per institution are small; the list is never used to
 * paginate a large dataset.
 */
export function SubjectsPage() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [semester, setSemester] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<Subject | null>(null);
  const [enrollTarget, setEnrollTarget] = useState<Subject | null>(null);
  const [enrollStudentId, setEnrollStudentId] = useState('');
  const [enrollSearch, setEnrollSearch] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const subjects = useSubjects({
    departmentId: departmentId || undefined,
    semester: semester ? Number(semester) : undefined,
  });
  const departments = useDepartments();
  const courses = useCourses();
  const teachers = useTeachers({ page: 1, pageSize: 100 });
  const students = useStudents({ page: 1, pageSize: 100, search: enrollSearch || undefined });

  const createSubject = useCreateSubject();
  const assignSubject = useAssignTeacherSubject();
  const enrollStudent = useEnrollStudentSubject();

  useEffect(() => {
    if (!enrollTarget) {
      setEnrollStudentId('');
      setEnrollSearch('');
    }
  }, [enrollTarget]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SubjectFormValues>({
    resolver: zodResolver(subjectSchema),
    defaultValues: {
      name: '',
      code: '',
      departmentId: '',
      courseId: '',
      semester: 1,
      credits: 4,
    },
    mode: 'onBlur',
  });

  useEffect(() => {
    if (createOpen) {
      reset({
        name: '',
        code: '',
        departmentId: departmentId || '',
        courseId: '',
        semester: semester ? Number(semester) : 1,
        credits: 4,
      });
      setFormError(null);
    }
  }, [createOpen, departmentId, semester, reset]);

  const filtered = useMemo(() => {
    const items = subjects.data ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter(
      (subject) =>
        subject.name.toLowerCase().includes(term) || subject.code.toLowerCase().includes(term),
    );
  }, [subjects.data, search]);

  const columns: DataTableColumn<Subject>[] = [
    {
      id: 'code',
      header: 'Code',
      cell: (subject) => <span className="text-mono text-strong">{subject.code}</span>,
    },
    {
      id: 'name',
      header: 'Subject',
      cell: (subject) => (
        <div>
          <div className="cell-primary">{subject.name}</div>
          <div className="cell-sub">{subject.department?.name ?? '—'}</div>
        </div>
      ),
    },
    {
      id: 'semester',
      header: 'Semester',
      align: 'right',
      cell: (subject) => `Sem ${subject.semester}`,
    },
    {
      id: 'credits',
      header: 'Credits',
      align: 'right',
      cell: (subject) => subject.credits,
      hideOn: 'tablet',
    },
    {
      id: 'course',
      header: 'Course',
      cell: (subject) => subject.course?.code ?? <span className="text-caption">—</span>,
      hideOn: 'tablet',
    },
    {
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      className: 'cell-actions',
      cell: (subject) => (
        <div className="row-actions">
          <Button
            size="sm"
            variant="secondary"
            icon={<UserCog size={14} />}
            onClick={() => setAssignTarget(subject)}
          >
            Assign teacher
          </Button>
          <Button
            size="sm"
            variant="soft"
            icon={<Users size={14} />}
            onClick={() => setEnrollTarget(subject)}
          >
            Enrol student
          </Button>
        </div>
      ),
    },
  ];

  const handleCreate = async (values: SubjectFormValues) => {
    setFormError(null);
    try {
      const created = await createSubject.mutateAsync(toSubjectPayload(values));
      toast.success('Subject created', `${created.name} (${created.code}) is now available.`);
      setCreateOpen(false);
    } catch (error) {
      setFormError(describeApiError(error));
    }
  };

  const handleAssign = async (values: {
    teacherId: string;
    subjectId: string;
    section?: string;
  }) => {
    try {
      await assignSubject.mutateAsync(values);
      const teacher = (teachers.data?.items ?? []).find((entry) => entry.id === values.teacherId);
      toast.success(
        'Teacher assigned',
        `${teacher?.fullName ?? 'The teacher'} can now run sessions for ${assignTarget?.name ?? 'this subject'}.`,
      );
      setAssignTarget(null);
    } catch (error) {
      toast.error('Assignment failed', describeApiError(error));
    }
  };

  const handleEnroll = async () => {
    if (!enrollTarget || !enrollStudentId) return;
    try {
      await enrollStudent.mutateAsync({ studentId: enrollStudentId, subjectId: enrollTarget.id });
      const student = (students.data?.items ?? []).find((entry) => entry.id === enrollStudentId);
      toast.success(
        'Student enrolled',
        `${student?.fullName ?? 'The student'} will now appear in ${enrollTarget.name} sessions.`,
      );
      setEnrollStudentId('');
    } catch (error) {
      toast.error('Enrolment failed', describeApiError(error));
    }
  };

  const hasFilters = search !== '' || departmentId !== '' || semester !== '';

  return (
    <>
      <PageHeader
        title="Subjects"
        subtitle="Create subjects, assign the teacher responsible for them and enrol the students who attend."
        actions={
          <Button icon={<Plus size={16} />} onClick={() => setCreateOpen(true)}>
            Add subject
          </Button>
        }
      />

      <Card flush>
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(subject) => subject.id}
          isLoading={subjects.isPending}
          isFetching={subjects.isFetching}
          error={subjects.isError ? subjects.error : null}
          onRetry={() => void subjects.refetch()}
          caption="Subjects"
          emptyVariant={hasFilters ? 'search' : 'default'}
          emptyTitle={hasFilters ? 'No subjects match your filters' : 'No subjects yet'}
          emptyMessage={
            hasFilters
              ? 'Try a different code or name, or clear the filters.'
              : 'Create a subject so teachers can open attendance sessions for it.'
          }
          emptyActionLabel={hasFilters ? undefined : 'Add subject'}
          onEmptyAction={hasFilters ? undefined : () => setCreateOpen(true)}
          toolbar={
            <div className="toolbar">
              <SearchInput
                className="toolbar__group"
                label="Search subjects"
                placeholder="Search by subject name or code…"
                value={search}
                onChange={setSearch}
              />
              <div className="toolbar__group">
                <label className="field__label" htmlFor="subject-filter-department">
                  Department
                </label>
                <RawSelect
                  id="subject-filter-department"
                  value={departmentId}
                  onChange={(event) => setDepartmentId(event.target.value)}
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
                <label className="field__label" htmlFor="subject-filter-semester">
                  Semester
                </label>
                <RawSelect
                  id="subject-filter-semester"
                  value={semester}
                  onChange={(event) => setSemester(event.target.value)}
                >
                  <option value="">All semesters</option>
                  {SEMESTERS.map((entry) => (
                    <option key={entry} value={entry}>
                      Semester {entry}
                    </option>
                  ))}
                </RawSelect>
              </div>
              <div className="toolbar__actions">
                {hasFilters ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<X size={15} />}
                    onClick={() => {
                      setSearch('');
                      setDepartmentId('');
                      setSemester('');
                    }}
                  >
                    Clear
                  </Button>
                ) : null}
                <IconButton
                  variant="bordered"
                  icon={<RotateCcw size={16} />}
                  label="Refresh subjects"
                  onClick={() => void subjects.refetch()}
                  disabled={subjects.isFetching}
                />
              </div>
            </div>
          }
          renderMobileCard={(subject) => (
            <>
              <div className="card-list__header">
                <div>
                  <p className="card-list__title">{subject.name}</p>
                  <p className="text-caption text-mono">{subject.code}</p>
                </div>
                <Badge tone="primary">Sem {subject.semester}</Badge>
              </div>
              <dl className="card-list__meta">
                <div>
                  <dt>Department</dt>
                  <dd>{subject.department?.name ?? '—'}</dd>
                </div>
                <div>
                  <dt>Credits</dt>
                  <dd>{subject.credits}</dd>
                </div>
              </dl>
              <div className="card-list__actions">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<UserCog size={14} />}
                  onClick={() => setAssignTarget(subject)}
                >
                  Assign teacher
                </Button>
                <Button
                  variant="soft"
                  size="sm"
                  icon={<Users size={14} />}
                  onClick={() => setEnrollTarget(subject)}
                >
                  Enrol student
                </Button>
              </div>
            </>
          )}
        />
      </Card>

      {/* Create subject */}
      <Modal
        open={createOpen}
        onClose={() => !createSubject.isPending && setCreateOpen(false)}
        title="Add subject"
        description="Subject codes are stored upper-case and must be unique."
        dismissible={!createSubject.isPending}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setCreateOpen(false)}
              disabled={createSubject.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="subject-form"
              isLoading={createSubject.isPending}
              loadingText="Creating…"
            >
              Create subject
            </Button>
          </>
        }
      >
        <form
          id="subject-form"
          className="stack stack-4"
          noValidate
          onSubmit={handleSubmit((values) => void handleCreate(values))}
        >
          {formError ? <Alert tone="error">{formError}</Alert> : null}

          <div className="form-grid">
            <Field
              label="Subject name"
              htmlFor="subject-name"
              error={errors.name?.message}
              required
            >
              <Input
                id="subject-name"
                placeholder="Data Structures"
                invalid={Boolean(errors.name)}
                {...register('name')}
              />
            </Field>
            <Field
              label="Subject code"
              htmlFor="subject-code"
              error={errors.code?.message}
              required
            >
              <Input
                id="subject-code"
                placeholder="BCA301"
                invalid={Boolean(errors.code)}
                {...register('code')}
              />
            </Field>
            <Field
              label="Department"
              htmlFor="subject-departmentId"
              error={errors.departmentId?.message}
              required
            >
              <RawSelect
                id="subject-departmentId"
                invalid={Boolean(errors.departmentId)}
                {...register('departmentId')}
              >
                <option value="">Select a department</option>
                {(departments.data ?? []).map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </RawSelect>
            </Field>
            <Field
              label="Course"
              htmlFor="subject-courseId"
              error={errors.courseId?.message}
              hint="Optional."
            >
              <RawSelect id="subject-courseId" {...register('courseId')}>
                <option value="">No specific course</option>
                {(courses.data ?? []).map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.code} · {course.name}
                  </option>
                ))}
              </RawSelect>
            </Field>
            <Field
              label="Semester"
              htmlFor="subject-semester"
              error={errors.semester?.message}
              required
            >
              <RawSelect
                id="subject-semester"
                invalid={Boolean(errors.semester)}
                {...register('semester')}
              >
                {SEMESTERS.map((entry) => (
                  <option key={entry} value={entry}>
                    Semester {entry}
                  </option>
                ))}
              </RawSelect>
            </Field>
            <Field
              label="Credits"
              htmlFor="subject-credits"
              error={errors.credits?.message}
              required
            >
              <Input
                id="subject-credits"
                type="number"
                min={1}
                max={10}
                invalid={Boolean(errors.credits)}
                {...register('credits')}
              />
            </Field>
          </div>
        </form>
      </Modal>

      <AssignTeacherDialog
        open={assignTarget !== null}
        subject={assignTarget}
        teachers={teachers.data?.items ?? []}
        isLoadingTeachers={teachers.isPending}
        isSubmitting={assignSubject.isPending}
        error={assignSubject.isError ? assignSubject.error : null}
        onClose={() => setAssignTarget(null)}
        onSubmit={(values) => void handleAssign(values)}
      />

      {/* Enrol student */}
      <Modal
        open={enrollTarget !== null}
        onClose={() => !enrollStudent.isPending && setEnrollTarget(null)}
        title={`Enrol a student in ${enrollTarget?.name ?? ''}`}
        description="Only enrolled students are included when a session for this subject is opened."
        size="md"
        dismissible={!enrollStudent.isPending}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setEnrollTarget(null)}
              disabled={enrollStudent.isPending}
            >
              Close
            </Button>
            <Button
              onClick={() => void handleEnroll()}
              disabled={!enrollStudentId}
              isLoading={enrollStudent.isPending}
              loadingText="Enrolling…"
            >
              Enrol student
            </Button>
          </>
        }
      >
        <div className="stack stack-4">
          <SearchInput
            label="Search students"
            placeholder="Search by name, roll number or student ID…"
            value={enrollSearch}
            onChange={setEnrollSearch}
          />

          <div className="field">
            <label className="field__label" htmlFor="enroll-student">
              Student
              <span className="field__required" aria-hidden="true">
                *
              </span>
            </label>
            <RawSelect
              id="enroll-student"
              value={enrollStudentId}
              onChange={(event) => setEnrollStudentId(event.target.value)}
              disabled={students.isPending}
            >
              <option value="">
                {students.isPending
                  ? 'Loading students…'
                  : `${formatNumber(students.data?.total ?? 0)} students available`}
              </option>
              {(students.data?.items ?? []).map((student) => (
                <option key={student.id} value={student.id}>
                  {student.fullName} · {student.studentCode} · Sem {student.semester} Sec{' '}
                  {student.section}
                </option>
              ))}
            </RawSelect>
            {students.isError ? (
              <p className="field__error">{describeApiError(students.error)}</p>
            ) : null}
            <p className="field__hint">
              Enrolment is idempotent - re-enrolling an existing student simply reactivates them.
            </p>
          </div>

          <Alert tone="info" title="Matching class rules" icon={<BookOpen size={17} />}>
            A session only includes students whose semester and section match the session, and who
            are enrolled in the subject. Enrolling a student from a different class will not add
            them to that session’s roster.
          </Alert>
        </div>
      </Modal>
    </>
  );
}
