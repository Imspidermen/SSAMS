import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { RawSelect } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Avatar } from '@/components/ui/Avatar';
import { correctionSchema, type CorrectionFormValues } from '@/validators/attendance.schema';
import { ATTENDANCE_STATUS_OPTIONS, attendanceStatusMeta } from '@/utils/attendance';
import { describeApiError } from '@/utils/apiError';
import { formatTime } from '@/utils/format';
import type { AttendanceStatus, RosterEntry } from '@/types';

export interface CorrectionDialogProps {
  open: boolean;
  entry: RosterEntry | null;
  isSubmitting?: boolean;
  error?: unknown;
  onClose: () => void;
  onSubmit: (values: { attendanceId: string; newStatus: AttendanceStatus; reason: string }) => void;
}

const REASON_PRESETS = [
  'Student was present but verification failed due to a device issue',
  'Student arrived after the session closed - confirmed in person',
  'Approved leave - student informed the department in advance',
  'Marked in error - student was not in this class',
];

/**
 * Correct one attendance record via POST /attendance/correct.
 *
 * The backend writes an AttendanceCorrection row with the original status, the
 * new status and an audited reason (minimum 5 characters), so a reason is
 * mandatory and cannot be skipped in the UI either.
 */
export function CorrectionDialog({
  open,
  entry,
  isSubmitting = false,
  error,
  onClose,
  onSubmit,
}: CorrectionDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CorrectionFormValues>({
    resolver: zodResolver(correctionSchema),
    defaultValues: { newStatus: 'PRESENT', reason: '' },
    mode: 'onBlur',
  });

  const selected = watch('newStatus');

  useEffect(() => {
    if (open && entry) {
      // Default to the opposite of the recorded status - the usual correction.
      reset({
        newStatus: entry.status === 'ABSENT' ? 'PRESENT' : 'ABSENT',
        reason: '',
      });
    }
  }, [open, entry, reset]);

  if (!entry) return null;

  const current = attendanceStatusMeta(entry.status);
  const next = attendanceStatusMeta(selected);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Correct attendance"
      description="This change is recorded permanently against your name with the reason you give."
      size="sm"
      dismissible={!isSubmitting}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="correction-form"
            isLoading={isSubmitting}
            loadingText="Saving correction…"
          >
            Save correction
          </Button>
        </>
      }
    >
      <form
        id="correction-form"
        className="stack stack-4"
        noValidate
        onSubmit={handleSubmit((values) =>
          onSubmit({
            attendanceId: entry.attendanceId as string,
            newStatus: values.newStatus,
            reason: values.reason.trim(),
          }),
        )}
      >
        {error ? <Alert tone="error">{describeApiError(error)}</Alert> : null}

        <div className="notification-card__row">
          <Avatar name={entry.fullName} size="md" />
          <div className="notification-card__body">
            <p className="notification-card__title">{entry.fullName}</p>
            <p className="text-caption text-mono">
              {entry.studentCode} · Roll {entry.rollNumber}
              {entry.markedAt ? ` · marked ${formatTime(entry.markedAt)}` : ' · not marked'}
            </p>
          </div>
        </div>

        <div className="row" style={{ gap: 'var(--space-2)', alignItems: 'center' }}>
          <span className="text-caption">Currently</span>
          <Badge tone={current.tone} dot>
            {current.label}
          </Badge>
          <span aria-hidden="true">→</span>
          <Badge tone={next.tone} dot>
            {next.label}
          </Badge>
        </div>

        <Field
          label="Corrected status"
          htmlFor="correction-status"
          error={errors.newStatus?.message}
          required
        >
          <RawSelect
            id="correction-status"
            invalid={Boolean(errors.newStatus)}
            {...register('newStatus')}
          >
            {ATTENDANCE_STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {attendanceStatusMeta(status).label}
              </option>
            ))}
          </RawSelect>
        </Field>

        <Field
          label="Reason"
          htmlFor="correction-reason"
          error={errors.reason?.message}
          required
          hint="At least 5 characters. Stored with the correction for auditing."
        >
          <Textarea
            id="correction-reason"
            rows={3}
            maxLength={280}
            placeholder="Why is this record being changed?"
            invalid={Boolean(errors.reason)}
            {...register('reason')}
          />
        </Field>

        <div className="stack stack-2">
          <span className="text-caption">Common reasons</span>
          <div className="row" style={{ flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            {REASON_PRESETS.map((preset) => (
              <Button
                key={preset}
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setValue('reason', preset, { shouldValidate: true })}
                disabled={isSubmitting}
              >
                {preset.length > 46 ? `${preset.slice(0, 46)}…` : preset}
              </Button>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}
