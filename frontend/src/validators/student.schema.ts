import { z } from 'zod';

/**
 * Mirrors `createStudentSchema` / `updateStudentSchema` in
 * `backend/src/validators/adminValidators.ts`, with `z.coerce` on numerics so
 * values arriving from `<input type="number">` (strings) validate correctly.
 */
export const studentSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Full name must be at least 2 characters')
    .max(120, 'Full name is too long'),
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
  studentCode: z
    .string()
    .trim()
    .min(2, 'Student ID must be at least 2 characters')
    .max(40, 'Student ID is too long'),
  rollNumber: z
    .string()
    .trim()
    .min(1, 'Roll number is required')
    .max(20, 'Roll number is too long'),
  phone: z
    .string()
    .trim()
    .max(20, 'Phone number is too long')
    .regex(/^[0-9+\-\s()]*$/, 'Enter a valid phone number')
    .optional()
    .or(z.literal('')),
  departmentId: z.string().min(1, 'Select a department'),
  semester: z.coerce
    .number({ invalid_type_error: 'Semester is required' })
    .int('Semester must be a whole number')
    .min(1, 'Semester must be between 1 and 12')
    .max(12, 'Semester must be between 1 and 12'),
  section: z.string().trim().min(1, 'Section is required').max(10, 'Section is too long'),
  academicYear: z
    .string()
    .trim()
    .min(4, 'Academic year is required, e.g. 2024-2025')
    .regex(/^\d{4}-\d{4}$/, 'Use the format YYYY-YYYY'),
  /**
   * Optional initial password. When omitted the backend generates a temporary
   * one and returns it in the response - the UI surfaces it once.
   */
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .optional()
    .or(z.literal('')),
});

export type StudentFormValues = z.infer<typeof studentSchema>;

export const studentStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'GRADUATED', 'SUSPENDED']);

/** Payload shaping: drops empty optional strings the backend would reject. */
export function toStudentPayload(values: StudentFormValues) {
  return {
    fullName: values.fullName.trim(),
    email: values.email.trim().toLowerCase(),
    studentCode: values.studentCode.trim(),
    rollNumber: values.rollNumber.trim(),
    phone: values.phone?.trim() ? values.phone.trim() : undefined,
    departmentId: values.departmentId,
    semester: Number(values.semester),
    section: values.section.trim().toUpperCase(),
    academicYear: values.academicYear.trim(),
    password: values.password ? values.password : undefined,
  };
}
