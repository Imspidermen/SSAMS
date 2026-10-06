import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, MapPin, Play } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { RawSelect } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import {
  startSessionSchema,
  toStartSessionPayload,
  type StartSessionFormValues,
} from '@/validators/attendance.schema';
import { describeApiError } from '@/utils/apiError';
import { formatDistance } from '@/utils/format';
import type { Classroom, StartSessionRequest, TeacherSubject } from '@/types';

export interface SessionDefaults {
  durationMinutes: number;
  geofenceRadiusM: number;
  livenessRequired: boolean;
  blinkRequired: boolean;
}

export interface StartSessionFormProps {
  /** Subjects assigned to the signed-in teacher (GET /teacher/subjects). */
  subjects: TeacherSubject[];
  /**
   * Classrooms the teacher can choose from.
   *
   * BACKEND GAP: listing classrooms is admin-only (`GET /admin/classrooms`),
   * while starting a session requires a `classroomId`. The teacher page
   * therefore derives this list from the classrooms attached to their own
   * recent sessions (`GET /teacher/dashboard`), which is real backend data.
   * When it is empty the form falls back to entering a classroom ID directly
   * and points at the documented missing endpoint.
   */
  classrooms: Classroom[];
  defaults: SessionDefaults;
  isSubmitting?: boolean;
  error?: unknown;
  onSubmit: (payload: StartSessionRequest) => void;
  onCancel?: () => void;
  /** Pre-selects a subject (e.g. when starting from a subject card). */
  presetSubjectId?: string;
}

/**
 * Opens an attendance session (POST /attendance/sessions).
 *
 * The teacher picks the subject and room; the backend derives the expected
 * roster from semester + section + subject enrolment and enforces the geofence,
 * face match, liveness and blink rules. Students then verify themselves - the
 * teacher never types attendance manually.
 */
export function StartSessionForm({
  subjects,
  classrooms,
  defaults,
  isSubmitting = false,
  error,
  onSubmit,
  onCancel,
  presetSubjectId,
}: StartSessionFormProps) {
  const [manualClassroom, setManualClassroom] = useState(classrooms.length === 0);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<StartSessionFormValues>({
    resolver: zodResolver(startSessionSchema),
    defaultValues: {
      subjectId: presetSubjectId ?? '',
      classroomId: '',
      semester: 1,
      section: '',
      durationMinutes: defaults.durationMinutes,
      geofenceRadiusM: defaults.geofenceRadiusM,
      livenessRequired: defaults.livenessRequired,
      blinkRequired: defaults.blinkRequired,
    },
    mode: 'onBlur',
  });

  // Keep policy-derived defaults in sync while the form is untouched.
  useEffect(() => {
    setValue('durationMinutes', defaults.durationMinutes, { shouldDirty: false });
    setValue('livenessRequired', defaults.livenessRequired, { shouldDirty: false });
    setValue('blinkRequired', defaults.blinkRequired, { shouldDirty: false });
    setValue('geofenceRadiusM', defaults.geofenceRadiusM, { shouldDirty: false });
  }, [defaults, setValue]);

  const selectedSubjectId = watch('subjectId');
  const selectedClassroomId = watch('classroomId');

  const selectedSubject = useMemo(
    () => subjects.find((assignment) => assignment.subjectId === selectedSubjectId),
    [subjects, selectedSubjectId],
  );

  const selectedClassroom = useMemo(
    () => classrooms.find((room) => room.id === selectedClassroomId),
    [classrooms, selectedClassroomId],
  );

  // Choosing a subject pre-fills the class it belongs to, which is what decides
  // the expected roster.
  useEffect(() => {
    if (!selectedSubject?.subject) return;
    setValue('semester', selectedSubject.subject.semester, { shouldValidate: true });
    if (selectedSubject.section) {
      setValue('section', selectedSubject.section, { shouldValidate: true });
    }
  }, [selectedSubject, setValue]);

  // A room's configured radius is the sensible geofence default.
  useEffect(() => {
    if (!selectedClassroom) return;
    setValue('geofenceRadiusM', selectedClassroom.radiusMeters, { shouldValidate: true });
  }, [selectedClassroom, setValue]);

  return (
    <form
      className="stack stack-4"
      noValidate
      onSubmit={handleSubmit((values) => {
        const payload = toStartSessionPayload(values);
        if (manualClassroom) {
          payload.classroomId = values.classroomId.trim();
        }
        onSubmit(payload);
      })}
    >
      {error ? (
        <Alert tone="error" title="Session could not be started">
          {describeApiError(error)}
        </Alert>
      ) : null}

      <div className="form-grid">
        <div className="form-grid__full">
          <Field
            label="Subject"
            htmlFor="session-subject"
            error={errors.subjectId?.message}
            required
            hint="Only subjects assigned to you can be used."
          >
            <RawSelect
              id="session-subject"
              invalid={Boolean(errors.subjectId)}
              {...register('subjectId')}
            >
              <option value="">Select a subject</option>
              {subjects.map((assignment) => (
                <option key={assignment.id} value={assignment.subjectId}>
                  {assignment.subject?.name ?? 'Subject'}
                  {assignment.subject?.code ? ` (${assignment.subject.code})` : ''}
                  {assignment.section ? ` · Section ${assignment.section}` : ' · All sections'}
                </option>
              ))}
            </RawSelect>
          </Field>
        </div>

        <div className="form-grid__full">
          <Field
            label="Classroom"
            htmlFor="session-classroom"
            error={manualClassroom ? errors.classroomId?.message : undefined}
            required
            hint={
              manualClassroom
                ? 'Enter the classroom ID from your administrator.'
                : 'Rooms you have used before. The room sets the geofence centre.'
            }
          >
            {manualClassroom ? (
              <Input
                id="session-classroom"
                placeholder="Classroom ID (UUID)"
                className="text-mono"
                invalid={Boolean(errors.classroomId)}
                {...register('classroomId')}
              />
            ) : (
              <RawSelect
                id="session-classroom"
                invalid={Boolean(errors.classroomId)}
                {...register('classroomId')}
              >
                <option value="">Select a classroom</option>
                {classrooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                    {room.building ? ` · ${room.building}` : ''} (
                    {formatDistance(room.radiusMeters)} geofence)
                  </option>
                ))}
              </RawSelect>
            )}
          </Field>

          {classrooms.length === 0 ? (
            <Alert
              tone="warning"
              title="No classrooms available to you"
              icon={<AlertTriangle size={17} />}
            >
              Listing classrooms is restricted to administrators (
              <code className="text-mono">GET /api/admin/classrooms</code>), but starting a session
              needs a <code className="text-mono">classroomId</code>. Until a teacher-readable
              classroom endpoint exists, paste the ID your administrator gives you. Rooms appear
              here automatically once you have run a session in them. The missing endpoint is
              documented in <code className="text-mono">frontend/API_CONTRACT.md</code>.
            </Alert>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              icon={<MapPin size={14} />}
              onClick={() => {
                setManualClassroom((current) => !current);
                setValue('classroomId', '', { shouldValidate: false });
              }}
              disabled={isSubmitting}
            >
              {manualClassroom ? 'Choose from my rooms' : 'Enter a classroom ID instead'}
            </Button>
          )}
        </div>

        <Field
          label="Semester"
          htmlFor="session-semester"
          error={errors.semester?.message}
          required
          hint="Pre-filled from the subject."
        >
          <Input
            id="session-semester"
            type="number"
            min={1}
            max={12}
            inputMode="numeric"
            invalid={Boolean(errors.semester)}
            {...register('semester')}
          />
        </Field>

        <Field
          label="Section"
          htmlFor="session-section"
          error={errors.section?.message}
          required
          hint="Students in this semester and section form the expected roster."
        >
          <Input
            id="session-section"
            placeholder="A"
            maxLength={10}
            invalid={Boolean(errors.section)}
            {...register('section')}
          />
        </Field>

        <Field
          label="Duration (minutes)"
          htmlFor="session-duration"
          error={errors.durationMinutes?.message}
          required
          hint="How long students have to verify. 1–240."
        >
          <Input
            id="session-duration"
            type="number"
            min={1}
            max={240}
            inputMode="numeric"
            invalid={Boolean(errors.durationMinutes)}
            {...register('durationMinutes')}
          />
        </Field>

        <Field
          label="Geofence radius (m)"
          htmlFor="session-radius"
          error={errors.geofenceRadiusM?.message}
          hint="Optional override. Leave blank to use the classroom or policy value."
        >
          <Input
            id="session-radius"
            type="number"
            min={5}
            max={2000}
            step={5}
            inputMode="numeric"
            placeholder={String(defaults.geofenceRadiusM)}
            invalid={Boolean(errors.geofenceRadiusM)}
            {...register('geofenceRadiusM')}
          />
        </Field>
      </div>

      <div className="stack stack-3">
        <h3 className="section-title">Verification requirements for this session</h3>
        <div className="row" style={{ gap: 'var(--space-6)', flexWrap: 'wrap' }}>
          <Switch
            id="session-liveness"
            label="Liveness challenge"
            description="Students must complete a head-turn check."
            disabled={isSubmitting}
            {...register('livenessRequired')}
          />
          <Switch
            id="session-blink"
            label="Blink detection"
            description="Students must blink naturally on camera."
            disabled={isSubmitting}
            {...register('blinkRequired')}
          />
        </div>
        <p className="text-caption">
          Face matching and the geofence check always apply - they cannot be disabled for a session.
        </p>
      </div>

      <div className="form-actions">
        {onCancel ? (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        ) : null}
        <Button
          type="submit"
          icon={<Play size={16} />}
          isLoading={isSubmitting}
          loadingText="Starting session…"
        >
          Start session
        </Button>
      </div>
    </form>
  );
}
