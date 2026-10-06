import { z } from 'zod';

/** Mirrors `updatePolicySchema` in the backend admin validators. */
export const policySchema = z.object({
  scope: z.enum(['GLOBAL', 'DEPARTMENT']),
  departmentId: z.string().optional().or(z.literal('')),
  minAttendancePercentage: z.coerce
    .number()
    .min(0, 'Must be between 0 and 100')
    .max(100, 'Must be between 0 and 100'),
  defaultGeofenceRadiusM: z.coerce
    .number()
    .int('Must be a whole number')
    .min(5, 'Must be between 5 and 2000 metres')
    .max(2000, 'Must be between 5 and 2000 metres'),
  defaultSessionDurationMin: z.coerce
    .number()
    .int('Must be a whole number')
    .min(1, 'Must be between 1 and 240 minutes')
    .max(240, 'Must be between 1 and 240 minutes'),
  maxVerificationAttempts: z.coerce
    .number()
    .int('Must be a whole number')
    .min(1, 'Must be between 1 and 10 attempts')
    .max(10, 'Must be between 1 and 10 attempts'),
  livenessMandatory: z.boolean(),
  blinkMandatory: z.boolean(),
  faceMatchThreshold: z.coerce
    .number()
    .min(0.1, 'Must be between 0.1 and 1.0')
    .max(1, 'Must be between 0.1 and 1.0'),
});

export type PolicyFormValues = z.infer<typeof policySchema>;

export function toPolicyPayload(values: PolicyFormValues) {
  return {
    scope: values.scope,
    departmentId:
      values.scope === 'DEPARTMENT' && values.departmentId ? values.departmentId : undefined,
    minAttendancePercentage: Number(values.minAttendancePercentage),
    defaultGeofenceRadiusM: Number(values.defaultGeofenceRadiusM),
    defaultSessionDurationMin: Number(values.defaultSessionDurationMin),
    maxVerificationAttempts: Number(values.maxVerificationAttempts),
    livenessMandatory: values.livenessMandatory,
    blinkMandatory: values.blinkMandatory,
    faceMatchThreshold: Number(values.faceMatchThreshold),
  };
}
