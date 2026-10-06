import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Save } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { RawSelect } from '@/components/ui/Select';
import {
  studentSchema,
  toStudentPayload,
  type StudentFormValues,
} from '@/validators/student.schema';
import { SEMESTERS, SECTIONS, academicYearOptions } from '@/utils/constants';
import type { Department, Student } from '@/types';

export interface StudentFormProps {
  mode: 'create' | 'edit';
  departments: Department[];
  isDepartmentsLoading?: boolean;
  /** Existing record when editing. */
  student?: Student | null;
  onSubmit: (payload: ReturnType<typeof toStudentPayload>) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  submitLabel?: string;
  /** Field-level messages from a 422 VALIDATION_ERROR response. */
  serverFieldErrors?: Record<string, string>;
  /** Page-level failure message rendered above the actions. */
  serverError?: string | null;
}

function defaultValuesFor(mode: 'create' | 'edit', student?: Student | null): StudentFormValues {
  const years = academicYearOptions();
  if (mode === 'edit' && student) {
    return {
      fullName: student.fullName,
      email: student.user?.email ?? '',
      studentCode: student.studentCode,
      rollNumber: student.rollNumber,
      phone: student.phone ?? '',
      departmentId: student.departmentId,
      semester: student.semester,
      section: student.section,
      academicYear: student.academicYear,
      password: '',
    };
  }
  return {
    fullName: '',
    email: '',
    studentCode: '',
    rollNumber: '',
    phone: '',
    departmentId: '',
    semester: 1,
    section: 'A',
    academicYear: years[0],
    password: '',
  };
}

/**
 * Create / edit student form.
 *
 * Field set and validation mirror the backend contract exactly
 * (`createStudentSchema`): a student is identified by `studentCode` (the
 * enrolment/ID number), `rollNumber`, department, semester, section and
 * academic year. There is no profile-photo or parent/blood-group field in the
 * schema - identity is a face *embedding* captured on the student's own
 * "Face Enrolment" screen. See API_CONTRACT.md for the full mapping.
 */
export function StudentForm({
  mode,
  departments,
  isDepartmentsLoading = false,
  student,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitLabel,
  serverFieldErrors,
  serverError,
}: StudentFormProps) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty },
  } = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema),
    defaultValues: defaultValuesFor(mode, student),
    mode: 'onBlur',
  });

  // Pre-fill once the record arrives (deep-linked edit page).
  useEffect(() => {
    if (mode === 'edit' && student && !isDirty) {
      reset(defaultValuesFor(mode, student));
    }
  }, [mode, student, isDirty, reset]);

  // Surface backend validation failures against the matching inputs.
  useEffect(() => {
    if (!serverFieldErrors) return;
    for (const [field, message] of Object.entries(serverFieldErrors)) {
      setError(field as keyof StudentFormValues, { type: 'server', message });
    }
  }, [serverFieldErrors, setError]);

  const years = academicYearOptions();

  const submit = handleSubmit(
    (values) => onSubmit(toStudentPayload(values)),
    () => undefined,
  );

  return (
    <form className="form-section stack stack-5" onSubmit={submit} noValidate>
      <section className="form-section">
        <h2 className="form-section__title">Personal details</h2>
        <div className="form-grid">
          <div className="form-grid__full">
            <Field
              label="Full name"
              htmlFor="student-fullName"
              error={errors.fullName?.message}
              required
            >
              <Input
                id="student-fullName"
                autoComplete="name"
                placeholder="e.g. Aarav Mehta"
                invalid={Boolean(errors.fullName)}
                {...register('fullName')}
              />
            </Field>
          </div>

          <Field
            label="Email"
            htmlFor="student-email"
            error={errors.email?.message}
            required
            hint="Used to sign in. Must be unique across all users."
          >
            <Input
              id="student-email"
              type="email"
              autoComplete="email"
              placeholder="student@college.edu"
              invalid={Boolean(errors.email)}
              {...register('email')}
            />
          </Field>

          <Field
            label="Phone"
            htmlFor="student-phone"
            error={errors.phone?.message}
            hint="Optional contact number."
          >
            <Input
              id="student-phone"
              type="tel"
              autoComplete="tel"
              placeholder="+91 98765 43210"
              invalid={Boolean(errors.phone)}
              {...register('phone')}
            />
          </Field>
        </div>
      </section>

      <section className="form-section">
        <h2 className="form-section__title">Academic identifiers</h2>
        <div className="form-grid">
          <Field
            label="Student ID / enrolment number"
            htmlFor="student-studentCode"
            error={errors.studentCode?.message}
            required
            hint="Unique across the institution, e.g. BCA2024001."
          >
            <Input
              id="student-studentCode"
              placeholder="BCA2024001"
              invalid={Boolean(errors.studentCode)}
              {...register('studentCode')}
            />
          </Field>

          <Field
            label="Roll number"
            htmlFor="student-rollNumber"
            error={errors.rollNumber?.message}
            required
            hint="Class roll number."
          >
            <Input
              id="student-rollNumber"
              placeholder="01"
              invalid={Boolean(errors.rollNumber)}
              {...register('rollNumber')}
            />
          </Field>

          <Field
            label="Department"
            htmlFor="student-departmentId"
            error={errors.departmentId?.message}
            required
          >
            <RawSelect
              id="student-departmentId"
              invalid={Boolean(errors.departmentId)}
              disabled={isDepartmentsLoading}
              {...register('departmentId')}
            >
              <option value="">
                {isDepartmentsLoading ? 'Loading departments…' : 'Select a department'}
              </option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name} ({department.code})
                </option>
              ))}
            </RawSelect>
          </Field>

          <Field
            label="Semester"
            htmlFor="student-semester"
            error={errors.semester?.message}
            required
          >
            <Controller
              control={control}
              name="semester"
              render={({ field }) => (
                <RawSelect
                  id="student-semester"
                  invalid={Boolean(errors.semester)}
                  value={String(field.value ?? '')}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                >
                  <option value="">Select semester</option>
                  {SEMESTERS.map((semester) => (
                    <option key={semester} value={semester}>
                      Semester {semester}
                    </option>
                  ))}
                </RawSelect>
              )}
            />
          </Field>

          <Field
            label="Section / class"
            htmlFor="student-section"
            error={errors.section?.message}
            required
            hint="Attendance sessions are opened per semester + section."
          >
            <RawSelect
              id="student-section"
              invalid={Boolean(errors.section)}
              {...register('section')}
            >
              {SECTIONS.map((section) => (
                <option key={section} value={section}>
                  Section {section}
                </option>
              ))}
            </RawSelect>
          </Field>

          <Field
            label="Academic year"
            htmlFor="student-academicYear"
            error={errors.academicYear?.message}
            required
            hint="Format YYYY-YYYY."
          >
            <RawSelect
              id="student-academicYear"
              invalid={Boolean(errors.academicYear)}
              {...register('academicYear')}
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </RawSelect>
          </Field>
        </div>
      </section>

      {mode === 'create' ? (
        <section className="form-section">
          <h2 className="form-section__title">Initial password</h2>
          <Alert tone="info" title="Optional">
            Leave blank and the backend generates a temporary password, which is shown once after
            the student is created. The account is then flagged to change it on first sign-in.
          </Alert>
          <div className="form-grid">
            <Field
              label="Temporary password"
              htmlFor="student-password"
              error={errors.password?.message}
              hint="At least 8 characters."
            >
              <Input
                id="student-password"
                type="text"
                autoComplete="new-password"
                placeholder="Leave blank to auto-generate"
                invalid={Boolean(errors.password)}
                {...register('password')}
              />
            </Field>
          </div>
        </section>
      ) : null}

      {mode === 'edit' ? (
        <Alert tone="warning" icon={<AlertTriangle size={17} />} title="Password changes">
          A student’s password cannot be changed from this form. The backend exposes
          <code className="text-mono"> POST /auth/change-password</code> for the account owner; an
          admin password-reset endpoint is listed as a gap in API_CONTRACT.md.
        </Alert>
      ) : null}

      {serverError ? (
        <Alert tone="error" title="Could not save">
          {serverError}
        </Alert>
      ) : null}

      <div className="form-actions">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          type="submit"
          icon={<Save size={17} />}
          isLoading={isSubmitting}
          loadingText={mode === 'create' ? 'Creating student…' : 'Saving changes…'}
        >
          {submitLabel ?? (mode === 'create' ? 'Create student' : 'Save changes')}
        </Button>
      </div>
    </form>
  );
}
