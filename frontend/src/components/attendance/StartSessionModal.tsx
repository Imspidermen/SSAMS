import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { StartSessionForm, type SessionDefaults } from './StartSessionForm';
import { useToast } from '@/hooks/useToast';
import {
  useStartSession,
  useTeacherClassrooms,
  useTeacherSubjects,
} from '@/hooks/queries/useTeacherQueries';
import { usePolicy } from '@/hooks/queries/useAdminQueries';
import { describeApiError } from '@/utils/apiError';
import { formatTime } from '@/utils/format';
import type { AttendanceSession, StartSessionRequest } from '@/types';

export interface StartSessionModalProps {
  open: boolean;
  onClose: () => void;
  /** Pre-selects a subject when the teacher starts from a subject card. */
  presetSubjectId?: string;
  /** Called with the created session so callers can navigate or refresh. */
  onStarted?: (session: AttendanceSession) => void;
}

/**
 * "Start a session" dialog shared by the teacher dashboard, subjects and
 * attendance pages.
 *
 * It gathers assigned subjects (`GET /teacher/subjects`), available rooms
 * (`GET /teacher/classrooms`) and institutional defaults
 * (`GET /admin/policy`) - and posts to `POST /attendance/sessions`.
 */
export function StartSessionModal({
  open,
  onClose,
  presetSubjectId,
  onStarted,
}: StartSessionModalProps) {
  const toast = useToast();
  const subjects = useTeacherSubjects(open);
  const classrooms = useTeacherClassrooms(open);
  const policy = usePolicy(undefined, open);
  const startSession = useStartSession();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(open);
  }, [open]);

  const defaults: SessionDefaults = useMemo(
    () => ({
      durationMinutes: policy.data?.defaultSessionDurationMin ?? 15,
      geofenceRadiusM: policy.data?.defaultGeofenceRadiusM ?? 100,
      livenessRequired: policy.data?.livenessMandatory ?? true,
      blinkRequired: policy.data?.blinkMandatory ?? true,
    }),
    [policy.data],
  );

  const handleStart = async (payload: StartSessionRequest) => {
    try {
      const session = await startSession.mutateAsync(payload);
      toast.success(
        'Session started',
        `${session.subject?.name ?? 'The session'} is open until ${formatTime(session.endTime)}. Students can verify now.`,
      );
      onStarted?.(session);
      onClose();
    } catch (error) {
      toast.error('Could not start the session', describeApiError(error));
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => !startSession.isPending && onClose()}
      title="Start an attendance session"
      description="Students in the selected class verify themselves from their own devices."
      size="lg"
      dismissible={!startSession.isPending}
    >
      {mounted ? (
        <StartSessionForm
          key={presetSubjectId ?? 'default'}
          presetSubjectId={presetSubjectId}
          subjects={subjects.data ?? []}
          classrooms={classrooms.data ?? []}
          defaults={defaults}
          isSubmitting={startSession.isPending}
          error={startSession.isError ? startSession.error : null}
          onSubmit={(payload) => void handleStart(payload)}
          onCancel={onClose}
        />
      ) : null}
    </Modal>
  );
}
