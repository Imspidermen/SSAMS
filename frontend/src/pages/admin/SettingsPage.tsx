import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Building2, GraduationCap, Save, Settings2 } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { RawSelect } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { Tabs } from '@/components/ui/Tabs';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/StateBlock';
import { PageHeader } from '@/components/common/PageHeader';
import { useToast } from '@/hooks/useToast';
import {
  useCourses,
  useCreateCourse,
  useCreateDepartment,
  useDepartments,
  usePolicy,
  useUpdatePolicy,
} from '@/hooks/queries/useAdminQueries';
import {
  courseSchema,
  departmentSchema,
  type CourseFormValues,
  type DepartmentFormValues,
} from '@/validators/academic.schema';
import { policySchema, toPolicyPayload, type PolicyFormValues } from '@/validators/policy.schema';
import { describeApiError } from '@/utils/apiError';
import { formatDate, formatPercent } from '@/utils/format';
import type { Course, Department, PolicyScope } from '@/types';

type SettingsTab = 'policy' | 'structure';

/**
 * Institution settings.
 *
 * Policy tab: GET/PUT /admin/policy - the attendance threshold, geofence and
 * verification rules the whole product reads from (never hard-coded).
 * Structure tab: departments and courses that subjects and people belong to.
 */
export function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>('policy');

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Configure the attendance policy and the academic structure every other screen depends on."
      />

      <Tabs<SettingsTab>
        ariaLabel="Settings sections"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'policy', label: 'Attendance policy', icon: <Settings2 size={15} /> },
          { value: 'structure', label: 'Academic structure', icon: <Building2 size={15} /> },
        ]}
      />

      <div style={{ marginTop: 'var(--space-5)' }}>
        {tab === 'policy' ? <PolicyPanel /> : <StructurePanel />}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------------- */
/* Attendance policy                                                          */
/* ------------------------------------------------------------------------- */

function PolicyPanel() {
  const toast = useToast();
  const [scope, setScope] = useState<PolicyScope>('GLOBAL');
  const [departmentId, setDepartmentId] = useState('');

  const departments = useDepartments();
  const policy = usePolicy(scope === 'DEPARTMENT' ? departmentId || undefined : undefined);
  const updatePolicy = useUpdatePolicy();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<PolicyFormValues>({
    resolver: zodResolver(policySchema),
    defaultValues: {
      scope: 'GLOBAL',
      departmentId: '',
      minAttendancePercentage: 75,
      defaultGeofenceRadiusM: 100,
      defaultSessionDurationMin: 15,
      maxVerificationAttempts: 3,
      livenessMandatory: true,
      blinkMandatory: true,
      faceMatchThreshold: 0.62,
    },
  });

  // Load the fetched policy into the form whenever the scope/department changes.
  useEffect(() => {
    if (!policy.data) return;
    reset({
      scope: policy.data.scope,
      departmentId: policy.data.departmentId ?? '',
      minAttendancePercentage: policy.data.minAttendancePercentage,
      defaultGeofenceRadiusM: policy.data.defaultGeofenceRadiusM,
      defaultSessionDurationMin: policy.data.defaultSessionDurationMin,
      maxVerificationAttempts: policy.data.maxVerificationAttempts,
      livenessMandatory: policy.data.livenessMandatory,
      blinkMandatory: policy.data.blinkMandatory,
      faceMatchThreshold: policy.data.faceMatchThreshold,
    });
  }, [policy.data, reset]);

  const effectiveScope = watch('scope');

  const onSubmit = async (values: PolicyFormValues) => {
    try {
      const saved = await updatePolicy.mutateAsync(toPolicyPayload(values));
      toast.success(
        'Policy saved',
        `Minimum attendance is now ${formatPercent(saved.minAttendancePercentage, 0)} for ${
          saved.scope === 'GLOBAL' ? 'the whole institution' : 'this department'
        }.`,
      );
    } catch (error) {
      toast.error('Could not save policy', describeApiError(error));
    }
  };

  if (policy.isPending) {
    return (
      <Card>
        <CardBody className="stack stack-4">
          <Skeleton variant="title" />
          <Skeleton width="100%" height="2.5rem" />
          <Skeleton width="100%" height="2.5rem" />
          <Skeleton width="70%" height="2.5rem" />
        </CardBody>
      </Card>
    );
  }

  if (policy.isError) {
    return (
      <Card>
        <ErrorState error={policy.error} onRetry={() => void policy.refetch()} />
      </Card>
    );
  }

  return (
    <div className="stack stack-4">
      <Alert tone="info" title="These values drive the whole product">
        The minimum attendance percentage is what flags students as low-attendance on every
        dashboard; the geofence radius and verification toggles decide what a student must complete
        before attendance can be marked. Changing them affects all future sessions.
      </Alert>

      <Card>
        <CardHeader
          title="Attendance policy"
          subtitle={
            policy.data.scope === 'GLOBAL'
              ? 'Applies institution-wide'
              : `Applies to ${policy.data.departmentId ? 'a department' : 'the institution'}`
          }
          headingLevel={2}
          actions={<Badge tone="neutral">Last updated {formatDate(policy.data.updatedAt)}</Badge>}
        />
        <CardBody>
          <form
            className="stack stack-5"
            noValidate
            onSubmit={handleSubmit((values) => void onSubmit(values))}
          >
            <div className="form-grid">
              <Field label="Scope" htmlFor="policy-scope" error={errors.scope?.message} required>
                <RawSelect
                  id="policy-scope"
                  value={scope}
                  onChange={(event) => {
                    const next = event.target.value as PolicyScope;
                    setScope(next);
                    if (next === 'GLOBAL') setDepartmentId('');
                  }}
                >
                  <option value="GLOBAL">Institution-wide (global)</option>
                  <option value="DEPARTMENT">Department-specific</option>
                </RawSelect>
              </Field>

              {scope === 'DEPARTMENT' ? (
                <Field label="Department" htmlFor="policy-department" required>
                  <RawSelect
                    id="policy-department"
                    value={departmentId}
                    onChange={(event) => setDepartmentId(event.target.value)}
                  >
                    <option value="">Select a department</option>
                    {(departments.data ?? []).map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </RawSelect>
                  <input type="hidden" {...register('departmentId')} />
                </Field>
              ) : null}

              <Field
                label="Minimum attendance (%)"
                htmlFor="policy-min"
                error={errors.minAttendancePercentage?.message}
                required
                hint="Students below this are flagged as low attendance."
              >
                <Input
                  id="policy-min"
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  inputMode="decimal"
                  invalid={Boolean(errors.minAttendancePercentage)}
                  {...register('minAttendancePercentage')}
                />
              </Field>

              <Field
                label="Default geofence radius (m)"
                htmlFor="policy-radius"
                error={errors.defaultGeofenceRadiusM?.message}
                required
                hint="Used when a classroom has no override."
              >
                <Input
                  id="policy-radius"
                  type="number"
                  min={5}
                  max={2000}
                  step={5}
                  inputMode="numeric"
                  invalid={Boolean(errors.defaultGeofenceRadiusM)}
                  {...register('defaultGeofenceRadiusM')}
                />
              </Field>

              <Field
                label="Default session duration (minutes)"
                htmlFor="policy-duration"
                error={errors.defaultSessionDurationMin?.message}
                required
                hint="How long a session stays open for verification."
              >
                <Input
                  id="policy-duration"
                  type="number"
                  min={1}
                  max={240}
                  inputMode="numeric"
                  invalid={Boolean(errors.defaultSessionDurationMin)}
                  {...register('defaultSessionDurationMin')}
                />
              </Field>

              <Field
                label="Max verification attempts"
                htmlFor="policy-attempts"
                error={errors.maxVerificationAttempts?.message}
                required
                hint="After this many failures the attempt is closed."
              >
                <Input
                  id="policy-attempts"
                  type="number"
                  min={1}
                  max={10}
                  inputMode="numeric"
                  invalid={Boolean(errors.maxVerificationAttempts)}
                  {...register('maxVerificationAttempts')}
                />
              </Field>

              <Field
                label="Face match threshold"
                htmlFor="policy-threshold"
                error={errors.faceMatchThreshold?.message}
                required
                hint="Similarity (0.1–1.0) required to accept a face match. Higher is stricter."
              >
                <Input
                  id="policy-threshold"
                  type="number"
                  min={0.1}
                  max={1}
                  step={0.01}
                  inputMode="decimal"
                  invalid={Boolean(errors.faceMatchThreshold)}
                  {...register('faceMatchThreshold')}
                />
              </Field>
            </div>

            <div className="stack stack-3">
              <h3 className="section-title">Verification requirements</h3>
              <div className="row" style={{ gap: 'var(--space-6)' }}>
                <Switch
                  id="policy-liveness"
                  label="Liveness challenge mandatory"
                  description="Require the head-turn check on every session."
                  {...register('livenessMandatory')}
                />
                <Switch
                  id="policy-blink"
                  label="Blink detection mandatory"
                  description="Require a natural blink on every session."
                  {...register('blinkMandatory')}
                />
              </div>
            </div>

            <div className="form-actions">
              <Button
                type="button"
                variant="ghost"
                onClick={() => reset()}
                disabled={!isDirty || updatePolicy.isPending}
              >
                Discard changes
              </Button>
              <Button
                type="submit"
                icon={<Save size={16} />}
                isLoading={updatePolicy.isPending}
                loadingText="Saving policy…"
                disabled={!isDirty}
              >
                Save policy
              </Button>
            </div>
            <span className="sr-only" aria-live="polite">
              {effectiveScope === 'DEPARTMENT'
                ? 'Editing a department policy'
                : 'Editing the global policy'}
            </span>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Academic structure                                                         */
/* ------------------------------------------------------------------------- */

function StructurePanel() {
  const toast = useToast();
  const departments = useDepartments();
  const courses = useCourses();
  const createDepartment = useCreateDepartment();
  const createCourse = useCreateCourse();

  const [departmentError, setDepartmentError] = useState<string | null>(null);
  const [courseError, setCourseError] = useState<string | null>(null);

  const departmentForm = useForm<DepartmentFormValues>({
    resolver: zodResolver(departmentSchema),
    defaultValues: { name: '', code: '' },
    mode: 'onBlur',
  });

  const courseForm = useForm<CourseFormValues>({
    resolver: zodResolver(courseSchema),
    defaultValues: { name: '', code: '', departmentId: '', durationSemesters: 6 },
    mode: 'onBlur',
  });

  const departmentColumns: DataTableColumn<Department>[] = [
    {
      id: 'name',
      header: 'Department',
      cell: (d) => <span className="cell-primary">{d.name}</span>,
    },
    { id: 'code', header: 'Code', cell: (d) => <span className="text-mono">{d.code}</span> },
    { id: 'created', header: 'Added', cell: (d) => formatDate(d.createdAt), hideOn: 'tablet' },
  ];

  const courseColumns: DataTableColumn<Course>[] = [
    { id: 'name', header: 'Course', cell: (c) => <span className="cell-primary">{c.name}</span> },
    { id: 'code', header: 'Code', cell: (c) => <span className="text-mono">{c.code}</span> },
    {
      id: 'department',
      header: 'Department',
      cell: (c) => c.department?.name ?? '—',
      hideOn: 'tablet',
    },
    {
      id: 'duration',
      header: 'Duration',
      align: 'right',
      cell: (c) => `${c.durationSemesters} semesters`,
      hideOn: 'tablet',
    },
  ];

  const submitDepartment = async (values: DepartmentFormValues) => {
    setDepartmentError(null);
    try {
      const created = await createDepartment.mutateAsync({
        name: values.name.trim(),
        code: values.code.trim().toUpperCase(),
      });
      toast.success('Department created', `${created.name} (${created.code}) is available.`);
      departmentForm.reset({ name: '', code: '' });
    } catch (error) {
      setDepartmentError(describeApiError(error));
    }
  };

  const submitCourse = async (values: CourseFormValues) => {
    setCourseError(null);
    try {
      const created = await createCourse.mutateAsync({
        name: values.name.trim(),
        code: values.code.trim().toUpperCase(),
        departmentId: values.departmentId,
        durationSemesters: Number(values.durationSemesters),
      });
      toast.success('Course created', `${created.name} (${created.code}) is available.`);
      courseForm.reset({ name: '', code: '', departmentId: '', durationSemesters: 6 });
    } catch (error) {
      setCourseError(describeApiError(error));
    }
  };

  return (
    <div className="stack stack-4">
      <Card flush>
        <CardHeader
          title="Departments"
          subtitle="Top-level academic units. Students, teachers and subjects all belong to one."
          headingLevel={2}
        />
        <CardBody>
          <form
            className="toolbar"
            noValidate
            onSubmit={departmentForm.handleSubmit((values) => void submitDepartment(values))}
          >
            <div className="toolbar__group" style={{ flex: '1 1 14rem' }}>
              <Field
                label="Name"
                htmlFor="dept-name"
                error={departmentForm.formState.errors.name?.message}
                required
              >
                <Input
                  id="dept-name"
                  placeholder="Computer Applications"
                  invalid={Boolean(departmentForm.formState.errors.name)}
                  {...departmentForm.register('name')}
                />
              </Field>
            </div>
            <div className="toolbar__group" style={{ flex: '0 1 10rem' }}>
              <Field
                label="Code"
                htmlFor="dept-code"
                error={departmentForm.formState.errors.code?.message}
                required
              >
                <Input
                  id="dept-code"
                  placeholder="CA"
                  maxLength={10}
                  invalid={Boolean(departmentForm.formState.errors.code)}
                  {...departmentForm.register('code')}
                />
              </Field>
            </div>
            <div className="toolbar__actions" style={{ alignItems: 'flex-end' }}>
              <Button
                type="submit"
                icon={<Building2 size={16} />}
                isLoading={createDepartment.isPending}
                loadingText="Adding…"
              >
                Add department
              </Button>
            </div>
          </form>

          {departmentError ? (
            <Alert tone="error" style={{ marginTop: 'var(--space-3)' }}>
              {departmentError}
            </Alert>
          ) : null}
        </CardBody>

        <DataTable
          columns={departmentColumns}
          rows={departments.data ?? []}
          rowKey={(department) => department.id}
          isLoading={departments.isPending}
          error={departments.isError ? departments.error : null}
          onRetry={() => void departments.refetch()}
          caption="Departments"
          emptyTitle="No departments yet"
          emptyMessage="Add a department before creating courses, subjects or people."
        />
      </Card>

      <Card flush>
        <CardHeader
          title="Courses"
          subtitle="Programmes offered within a department, e.g. BCA."
          headingLevel={2}
        />
        <CardBody>
          <form
            className="toolbar"
            noValidate
            onSubmit={courseForm.handleSubmit((values) => void submitCourse(values))}
          >
            <div className="toolbar__group" style={{ flex: '1 1 14rem' }}>
              <Field
                label="Name"
                htmlFor="course-name"
                error={courseForm.formState.errors.name?.message}
                required
              >
                <Input
                  id="course-name"
                  placeholder="Bachelor of Computer Applications"
                  invalid={Boolean(courseForm.formState.errors.name)}
                  {...courseForm.register('name')}
                />
              </Field>
            </div>
            <div className="toolbar__group" style={{ flex: '0 1 9rem' }}>
              <Field
                label="Code"
                htmlFor="course-code"
                error={courseForm.formState.errors.code?.message}
                required
              >
                <Input
                  id="course-code"
                  placeholder="BCA"
                  invalid={Boolean(courseForm.formState.errors.code)}
                  {...courseForm.register('code')}
                />
              </Field>
            </div>
            <div className="toolbar__group" style={{ flex: '0 1 12rem' }}>
              <Field
                label="Department"
                htmlFor="course-department"
                error={courseForm.formState.errors.departmentId?.message}
                required
              >
                <RawSelect
                  id="course-department"
                  invalid={Boolean(courseForm.formState.errors.departmentId)}
                  {...courseForm.register('departmentId')}
                >
                  <option value="">Select…</option>
                  {(departments.data ?? []).map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </RawSelect>
              </Field>
            </div>
            <div className="toolbar__group" style={{ flex: '0 1 9rem' }}>
              <Field
                label="Semesters"
                htmlFor="course-duration"
                error={courseForm.formState.errors.durationSemesters?.message}
                required
              >
                <Input
                  id="course-duration"
                  type="number"
                  min={1}
                  max={12}
                  invalid={Boolean(courseForm.formState.errors.durationSemesters)}
                  {...courseForm.register('durationSemesters')}
                />
              </Field>
            </div>
            <div className="toolbar__actions" style={{ alignItems: 'flex-end' }}>
              <Button
                type="submit"
                icon={<GraduationCap size={16} />}
                isLoading={createCourse.isPending}
                loadingText="Adding…"
              >
                Add course
              </Button>
            </div>
          </form>

          {courseError ? (
            <Alert tone="error" style={{ marginTop: 'var(--space-3)' }}>
              {courseError}
            </Alert>
          ) : null}
        </CardBody>

        <DataTable
          columns={courseColumns}
          rows={courses.data ?? []}
          rowKey={(course) => course.id}
          isLoading={courses.isPending}
          error={courses.isError ? courses.error : null}
          onRetry={() => void courses.refetch()}
          caption="Courses"
          emptyTitle="No courses yet"
          emptyMessage="Courses are optional - subjects can exist without one."
        />
      </Card>
    </div>
  );
}
