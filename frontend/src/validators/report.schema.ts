import { z } from 'zod';

/** Client-side validation for the report filter bar. */
export const reportFilterSchema = z
  .object({
    from: z.string().optional().or(z.literal('')),
    to: z.string().optional().or(z.literal('')),
    subjectId: z.string().optional().or(z.literal('')),
    departmentId: z.string().optional().or(z.literal('')),
    studentId: z.string().optional().or(z.literal('')),
    teacherId: z.string().optional().or(z.literal('')),
  })
  .refine((values) => !values.from || !values.to || values.from <= values.to, {
    message: 'The "from" date must not be after the "to" date',
    path: ['to'],
  });

/**
 * The UI's filter state type lives in `utils/reportFilters.ts` (it also carries
 * the browser-side `status`/`search` fields); this schema only validates the
 * values that are sent to the backend.
 */
export type ReportFilterSchemaValues = z.infer<typeof reportFilterSchema>;
