import { z } from 'zod';

/** Mirrors `createTeacherSchema` in the backend admin validators. */
export const teacherSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(120),
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
  employeeCode: z
    .string()
    .trim()
    .min(2, 'Employee ID must be at least 2 characters')
    .max(40, 'Employee ID is too long'),
  phone: z
    .string()
    .trim()
    .max(20, 'Phone number is too long')
    .regex(/^[0-9+\-\s()]*$/, 'Enter a valid phone number')
    .optional()
    .or(z.literal('')),
  departmentId: z.string().min(1, 'Select a department'),
  designation: z.string().trim().max(80, 'Designation is too long').optional().or(z.literal('')),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .optional()
    .or(z.literal('')),
});

export type TeacherFormValues = z.infer<typeof teacherSchema>;

export function toTeacherPayload(values: TeacherFormValues) {
  return {
    fullName: values.fullName.trim(),
    email: values.email.trim().toLowerCase(),
    employeeCode: values.employeeCode.trim(),
    phone: values.phone?.trim() ? values.phone.trim() : undefined,
    departmentId: values.departmentId,
    designation: values.designation?.trim() ? values.designation.trim() : undefined,
    password: values.password ? values.password : undefined,
  };
}
