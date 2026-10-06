import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { RawSelect } from '@/components/ui/Select';
import {
  assignTeacherSubjectSchema,
  type AssignTeacherSubjectFormValues,
} from '@/validators/academic.schema';
import { SECTIONS } from '@/utils/constants';
import { describeApiError } from '@/utils/apiError';
import type { Subject, Teacher } from '@/types';

export interface AssignTeacherDialogProps {
  open: boolean;
  subject: Subject | null;
  teachers: Teacher[];
  isLoadingTeachers?: boolean;
  isSubmitting?: boolean;
  error?: unknown;
  onClose: () => void;
  onSubmit: (values: { teacherId: string; subjectId: string; section?: string }) => void;
}

/**
 * Assigns a teacher to a subject (optionally for one section) via
 * POST /admin/subjects/assign-teacher. The backend upserts, so re-assigning is
 * safe and idempotent.
 */
export function AssignTeacherDialog({
  open,
  subject,
  teachers,
  isLoadingTeachers = false,
  isSubmitting = false,
  error,
  onClose,
  onSubmit,
}: AssignTeacherDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AssignTeacherSubjectFormValues>({
    resolver: zodResolver(assignTeacherSubjectSchema),
    defaultValues: { teacherId: '', subjectId: '', section: '' },
  });

  useEffect(() => {
    if (open) reset({ teacherId: '', subjectId: subject?.id ?? '', section: '' });
  }, [open, subject, reset]);

  if (!subject) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Assign teacher to subject"
      description={`${subject.name} (${subject.code}) · Semester ${subject.semester}`}
      size="sm"
      dismissible={!isSubmitting}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="assign-teacher-form"
            isLoading={isSubmitting}
            loadingText="Assigning…"
          >
            Assign teacher
          </Button>
        </>
      }
    >
      <form
        id="assign-teacher-form"
        className="stack stack-4"
        noValidate
        onSubmit={handleSubmit((values) =>
          onSubmit({
            teacherId: values.teacherId,
            subjectId: values.subjectId,
            section: values.section?.trim() ? values.section.trim().toUpperCase() : undefined,
          }),
        )}
      >
        {error ? <Alert tone="error">{describeApiError(error)}</Alert> : null}

        <Field
          label="Teacher"
          htmlFor="assign-teacherId"
          error={errors.teacherId?.message}
          required
        >
          <RawSelect
            id="assign-teacherId"
            disabled={isLoadingTeachers}
            invalid={Boolean(errors.teacherId)}
            {...register('teacherId')}
          >
            <option value="">{isLoadingTeachers ? 'Loading teachers…' : 'Select a teacher'}</option>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.fullName}
                {teacher.designation ? ` · ${teacher.designation}` : ''} ({teacher.employeeCode})
              </option>
            ))}
          </RawSelect>
        </Field>

        <Field
          label="Section"
          htmlFor="assign-section"
          error={errors.section?.message}
          hint="Optional. Leave empty to assign for all sections of this subject."
        >
          <RawSelect id="assign-section" invalid={Boolean(errors.section)} {...register('section')}>
            <option value="">All sections</option>
            {SECTIONS.map((section) => (
              <option key={section} value={section}>
                Section {section}
              </option>
            ))}
          </RawSelect>
        </Field>
      </form>
    </Modal>
  );
}
