import { z } from 'zod';

/** Mirrors `startSessionSchema` and `correctionSchema` in the backend. */

export const startSessionSchema = z.object({
  subjectId: z.string().min(1, 'Select a subject'),
  classroomId: z.string().min(1, 'Select a classroom'),
  semester: z.coerce
    .number({ invalid_type_error: 'Semester is required' })
    .int('Semester must be a whole number')
    .min(1, 'Semester must be between 1 and 12')
    .max(12, 'Semester must be between 1 and 12'),
  section: z.string().trim().min(1, 'Section is required').max(10),
  durationMinutes: z.coerce
    .number()
    .int('Duration must be a whole number of minutes')
    .min(1, 'Duration must be between 1 and 240 minutes')
    .max(240, 'Duration must be between 1 and 240 minutes'),
  geofenceRadiusM: z.coerce
    .number()
    .int('Radius must be a whole number of metres')
    .min(5, 'Radius must be at least 5 m')
    .max(2000, 'Radius must be 2000 m or less')
    .optional()
    .or(z.literal('')),
  livenessRequired: z.boolean(),
  blinkRequired: z.boolean(),
});

export type StartSessionFormValues = z.infer<typeof startSessionSchema>;

export function toStartSessionPayload(values: StartSessionFormValues) {
  return {
    subjectId: values.subjectId,
    classroomId: values.classroomId,
    semester: Number(values.semester),
    section: values.section.trim().toUpperCase(),
    durationMinutes: Number(values.durationMinutes),
    geofenceRadiusM:
      values.geofenceRadiusM === '' || values.geofenceRadiusM === undefined
        ? undefined
        : Number(values.geofenceRadiusM),
    livenessRequired: values.livenessRequired,
    blinkRequired: values.blinkRequired,
  };
}

export const correctionSchema = z.object({
  newStatus: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'], {
    required_error: 'Select the corrected status',
  }),
  /** The backend requires an audited reason of at least 5 characters. */
  reason: z
    .string()
    .trim()
    .min(5, 'A reason of at least 5 characters is required')
    .max(280, 'Reason is too long'),
});

export type CorrectionFormValues = z.infer<typeof correctionSchema>;
