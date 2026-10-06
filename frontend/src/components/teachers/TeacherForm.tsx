import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { RawSelect } from '@/components/ui/Select';
import {
  teacherSchema,
  toTeacherPayload,
  type TeacherFormValues,
} from '@/validators/teacher.schema';
import type { Department } from '@/types';

export interface TeacherFormProps {
  departments: Department[];
  isDepartmentsLoading?: boolean;
  onSubmit: (payload: ReturnType<typeof toTeacherPayload>) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  serverFieldErrors?: Record<string, string>;
  autoFocusFirstField?: boolean;
}

/**
 * Create-teacher form. Field set and rules mirror `createTeacherSchema` in the
 * backend. The password is optional: when omitted the backend generates a
 * temporary one and returns it, and the caller displays it exactly once.
 */
export function TeacherForm({
  departments,
  isDepartmentsLoading = false,
  onSubmit,
  onCancel,
  isSubmitting = false,
  autoFocusFirstField = true,
}: TeacherFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TeacherFormValues>({
    resolver: zodResolver(teacherSchema),
    defaultValues: {
      fullName: '',
      email: '',
      employeeCode: '',
      phone: '',
      departmentId: '',
      designation: '',
      password: '',
    },
    mode: 'onBlur',
  });

  return (
    <form
      className="form-section stack stack-4"
      onSubmit={handleSubmit((values) => onSubmit(toTeacherPayload(values)))}
      noValidate
    >
      <div className="form-grid">
        <div className="form-grid__full">
          <Field
            label="Full name"
            htmlFor="teacher-fullName"
            error={errors.fullName?.message}
            required
          >
            <Input
              id="teacher-fullName"
              autoComplete="name"
              placeholder="e.g. Dr. Ritu Sharma"
              autoFocus={autoFocusFirstField}
              invalid={Boolean(errors.fullName)}
              {...register('fullName')}
            />
          </Field>
        </div>

        <Field
          label="Email"
          htmlFor="teacher-email"
          error={errors.email?.message}
          required
          hint="Used to sign in. Must be unique."
        >
          <Input
            id="teacher-email"
            type="email"
            autoComplete="email"
            placeholder="teacher@college.edu"
            invalid={Boolean(errors.email)}
            {...register('email')}
          />
        </Field>

        <Field
          label="Employee ID"
          htmlFor="teacher-employeeCode"
          error={errors.employeeCode?.message}
          required
          hint="Unique staff number, e.g. EMP001."
        >
          <Input
            id="teacher-employeeCode"
            placeholder="EMP001"
            invalid={Boolean(errors.employeeCode)}
            {...register('employeeCode')}
          />
        </Field>

        <Field
          label="Department"
          htmlFor="teacher-departmentId"
          error={errors.departmentId?.message}
          required
        >
          <RawSelect
            id="teacher-departmentId"
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
          label="Designation"
          htmlFor="teacher-designation"
          error={errors.designation?.message}
          hint="Optional, e.g. Assistant Professor."
        >
          <Input
            id="teacher-designation"
            placeholder="Assistant Professor"
            invalid={Boolean(errors.designation)}
            {...register('designation')}
          />
        </Field>

        <Field label="Phone" htmlFor="teacher-phone" error={errors.phone?.message}>
          <Input
            id="teacher-phone"
            type="tel"
            autoComplete="tel"
            placeholder="+91 98765 43210"
            invalid={Boolean(errors.phone)}
            {...register('phone')}
          />
        </Field>

        <div className="form-grid__full">
          <Field
            label="Temporary password"
            htmlFor="teacher-password"
            error={errors.password?.message}
            hint="Leave blank to let the backend generate one and show it after creation."
          >
            <Input
              id="teacher-password"
              type="text"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              invalid={Boolean(errors.password)}
              {...register('password')}
            />
          </Field>
        </div>
      </div>

      <Alert tone="info" title="After creation">
        Assign subjects from the row action <strong>Assign subject</strong>. A teacher can only open
        attendance sessions for subjects assigned to them.
      </Alert>

      <div className="form-actions">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isSubmitting} loadingText="Creating teacher…">
          Create teacher
        </Button>
      </div>
    </form>
  );
}
