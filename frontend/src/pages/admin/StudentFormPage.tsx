import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, Copy, KeyRound } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/StateBlock';
import { PageHeader } from '@/components/common/PageHeader';
import { StudentForm } from '@/components/students/StudentForm';
import { useToast } from '@/hooks/useToast';
import {
  useCreateStudent,
  useDepartments,
  useStudent,
  useUpdateStudent,
} from '@/hooks/queries/useAdminQueries';
import { paths } from '@/routes/paths';
import { describeApiError, isApiError } from '@/utils/apiError';
import type { StudentFormValues } from '@/validators/student.schema';
import type { CreateStudentRequest, UpdateStudentRequest } from '@/types';

export interface StudentFormPageProps {
  mode: 'create' | 'edit';
}

/**
 * Add / edit student.
 *
 * Create surfaces the backend-generated temporary password exactly once (it is
 * never stored client-side). Edit pre-fills from the record and refreshes the
 * list + detail caches through query invalidation - no page reloads.
 */
export function StudentFormPage({ mode }: StudentFormPageProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const departments = useDepartments();

  const studentQuery = useStudent(mode === 'edit' ? id : undefined, mode === 'edit');
  const createStudent = useCreateStudent();
  const updateStudent = useUpdateStudent();

  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [createdStudentId, setCreatedStudentId] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverFieldErrors, setServerFieldErrors] = useState<Record<string, string> | undefined>();
  const [copied, setCopied] = useState(false);

  const isEdit = mode === 'edit';
  const isMutating = createStudent.isPending || updateStudent.isPending;

  useEffect(() => {
    if (isEdit && studentQuery.isError) {
      setServerError(describeApiError(studentQuery.error));
    }
  }, [isEdit, studentQuery.isError, studentQuery.error]);

  const handleSubmit = async (
    payload: Omit<StudentFormValues, 'semester'> & { semester: number },
  ) => {
    setServerError(null);
    setServerFieldErrors(undefined);

    try {
      if (isEdit && id) {
        const updatePayload: UpdateStudentRequest = { ...payload };
        // The backend ignores `password` on update; omit it to stay explicit.
        delete updatePayload.password;
        const updated = await updateStudent.mutateAsync({ id, payload: updatePayload });
        toast.success('Student updated', `${updated.fullName}’s details were saved.`);
        navigate(paths.admin.studentDetail(updated.id), { replace: true });
        return;
      }

      const result = await createStudent.mutateAsync(payload as CreateStudentRequest);
      if (result.temporaryPassword) {
        setTemporaryPassword(result.temporaryPassword);
        setCreatedStudentId(result.student.id);
        return;
      }
      toast.success('Student created', `${result.student.fullName} can now sign in.`);
      navigate(paths.admin.studentDetail(result.student.id), { replace: true });
    } catch (error) {
      if (isApiError(error)) {
        setServerError(describeApiError(error));
        if (Object.keys(error.fieldErrors).length > 0) {
          setServerFieldErrors(error.fieldErrors);
        }
        if (error.code === 'EMAIL_TAKEN' || error.code === 'STUDENT_CODE_TAKEN') {
          toast.error('Duplicate record', error.message);
        }
        return;
      }
      setServerError(describeApiError(error));
    }
  };

  const copyPassword = async () => {
    if (!temporaryPassword) return;
    try {
      await navigator.clipboard.writeText(temporaryPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Copy failed', 'Select the password text and copy it manually.');
    }
  };

  if (isEdit && studentQuery.isPending) {
    return (
      <>
        <PageHeader
          title="Edit student"
          breadcrumbs={[{ label: 'Students', to: paths.admin.students }, { label: 'Edit' }]}
        />
        <Card>
          <CardBody className="stack stack-4">
            <Skeleton variant="title" />
            <Skeleton width="100%" height="2.5rem" />
            <Skeleton width="100%" height="2.5rem" />
            <Skeleton width="60%" height="2.5rem" />
          </CardBody>
        </Card>
      </>
    );
  }

  if (isEdit && studentQuery.isError) {
    return (
      <>
        <PageHeader
          title="Edit student"
          breadcrumbs={[{ label: 'Students', to: paths.admin.students }, { label: 'Edit' }]}
        />
        <Card>
          <ErrorState
            error={studentQuery.error}
            onRetry={() => void studentQuery.refetch()}
            title="This student could not be loaded"
          />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={isEdit ? 'Edit student' : 'Add student'}
        subtitle={
          isEdit
            ? `Update the record for ${studentQuery.data?.fullName ?? 'this student'}. Changes apply immediately across lists and dashboards.`
            : 'Create a student account with their academic identifiers. They sign in with the email you provide.'
        }
        breadcrumbs={[
          { label: 'Students', to: paths.admin.students },
          { label: isEdit ? 'Edit' : 'New' },
        ]}
      />

      <div className="split">
        <Card>
          <CardHeader
            title={isEdit ? 'Student details' : 'New student'}
            subtitle="All fields are validated against the same rules the backend enforces."
            headingLevel={2}
          />
          <CardBody>
            <StudentForm
              mode={mode}
              departments={departments.data ?? []}
              isDepartmentsLoading={departments.isPending}
              student={isEdit ? (studentQuery.data ?? null) : null}
              onSubmit={handleSubmit}
              onCancel={() =>
                navigate(isEdit && id ? paths.admin.studentDetail(id) : paths.admin.students)
              }
              isSubmitting={isMutating}
              serverError={serverError}
              serverFieldErrors={serverFieldErrors}
            />
          </CardBody>
        </Card>

        <div className="stack stack-4">
          <Card>
            <CardHeader title="What happens next" headingLevel={2} />
            <CardBody>
              <ol className="checklist">
                <li className="checklist__item">
                  <span className="checklist__index" aria-hidden="true">
                    1
                  </span>
                  <span>
                    A login account with role <strong>Student</strong> is created alongside the
                    academic record.
                  </span>
                </li>
                <li className="checklist__item">
                  <span className="checklist__index" aria-hidden="true">
                    2
                  </span>
                  <span>
                    A face profile is initialised as <strong>Not enrolled</strong>. The student must
                    complete face enrolment before they can mark attendance.
                  </span>
                </li>
                <li className="checklist__item">
                  <span className="checklist__index" aria-hidden="true">
                    3
                  </span>
                  <span>
                    Enrol the student in subjects from <strong>Subjects → Enrol student</strong>,
                    otherwise no session will include them.
                  </span>
                </li>
              </ol>
            </CardBody>
          </Card>

          {isEdit && studentQuery.data ? (
            <Card>
              <CardHeader title="Current record" headingLevel={2} />
              <CardBody className="stack stack-2">
                <p className="text-caption">
                  Student ID <strong className="text-mono">{studentQuery.data.studentCode}</strong>
                </p>
                <p className="text-caption">
                  Status <strong>{studentQuery.data.status}</strong>
                </p>
                <p className="text-caption">
                  Face profile{' '}
                  <strong>{studentQuery.data.faceProfile?.status ?? 'NOT_ENROLLED'}</strong>
                </p>
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>

      <Modal
        open={temporaryPassword !== null}
        onClose={() => {
          setTemporaryPassword(null);
          if (createdStudentId)
            navigate(paths.admin.studentDetail(createdStudentId), { replace: true });
        }}
        title="Student created — share this password now"
        description="This temporary password is generated by the backend and is shown only once. It is not stored in the browser."
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
            <Button
              onClick={() => {
                setTemporaryPassword(null);
                if (createdStudentId)
                  navigate(paths.admin.studentDetail(createdStudentId), { replace: true });
              }}
            >
              View student
            </Button>
          </>
        }
      >
        <div className="stack stack-3">
          <Alert tone="warning" title="Action required" icon={<KeyRound size={17} />}>
            The student must change this password the first time they sign in.
          </Alert>
          <p className="password-reveal text-mono" aria-label="Temporary password">
            {temporaryPassword}
          </p>
        </div>
      </Modal>
    </>
  );
}

/** Route wrapper for /admin/students/new. */
export function NewStudentPage() {
  return <StudentFormPage mode="create" />;
}

/** Route wrapper for /admin/students/:id/edit. */
export function EditStudentPage() {
  return <StudentFormPage mode="edit" />;
}
