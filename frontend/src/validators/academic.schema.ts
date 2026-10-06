import { z } from 'zod';

/** Subjects, departments, courses, classrooms - all mirror backend validators. */

export const subjectSchema = z.object({
  name: z.string().trim().min(2, 'Subject name must be at least 2 characters').max(120),
  code: z
    .string()
    .trim()
    .min(2, 'Subject code must be at least 2 characters')
    .max(20, 'Subject code is too long')
    .transform((value) => value.toUpperCase()),
  departmentId: z.string().min(1, 'Select a department'),
  courseId: z.string().optional().or(z.literal('')),
  semester: z.coerce
    .number({ invalid_type_error: 'Semester is required' })
    .int('Semester must be a whole number')
    .min(1, 'Semester must be between 1 and 12')
    .max(12, 'Semester must be between 1 and 12'),
  credits: z.coerce
    .number({ invalid_type_error: 'Credits are required' })
    .int('Credits must be a whole number')
    .min(1, 'Credits must be between 1 and 10')
    .max(10, 'Credits must be between 1 and 10'),
});

export type SubjectFormValues = z.infer<typeof subjectSchema>;

export function toSubjectPayload(values: SubjectFormValues) {
  return {
    name: values.name.trim(),
    code: values.code.trim().toUpperCase(),
    departmentId: values.departmentId,
    courseId: values.courseId ? values.courseId : undefined,
    semester: Number(values.semester),
    credits: Number(values.credits),
  };
}

export const departmentSchema = z.object({
  name: z.string().trim().min(2, 'Department name must be at least 2 characters').max(120),
  code: z
    .string()
    .trim()
    .min(2, 'Department code must be at least 2 characters')
    .max(10, 'Department code must be 10 characters or fewer')
    .transform((value) => value.toUpperCase()),
});

export type DepartmentFormValues = z.infer<typeof departmentSchema>;

export const courseSchema = z.object({
  name: z.string().trim().min(2, 'Course name must be at least 2 characters').max(120),
  code: z
    .string()
    .trim()
    .min(2, 'Course code must be at least 2 characters')
    .max(20)
    .transform((value) => value.toUpperCase()),
  departmentId: z.string().min(1, 'Select a department'),
  durationSemesters: z.coerce
    .number()
    .int('Duration must be a whole number')
    .min(1, 'Duration must be between 1 and 12 semesters')
    .max(12, 'Duration must be between 1 and 12 semesters'),
});

export type CourseFormValues = z.infer<typeof courseSchema>;

export const classroomSchema = z.object({
  name: z.string().trim().min(1, 'Classroom name is required').max(80),
  building: z.string().trim().max(80).optional().or(z.literal('')),
  floor: z.string().trim().max(40).optional().or(z.literal('')),
  latitude: z.coerce
    .number({ invalid_type_error: 'Latitude is required' })
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90'),
  longitude: z.coerce
    .number({ invalid_type_error: 'Longitude is required' })
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180'),
  radiusMeters: z.coerce
    .number()
    .int('Radius must be a whole number of metres')
    .min(5, 'Geofence radius must be at least 5 m')
    .max(2000, 'Geofence radius must be 2000 m or less'),
});

export type ClassroomFormValues = z.infer<typeof classroomSchema>;

export function toClassroomPayload(values: ClassroomFormValues) {
  return {
    name: values.name.trim(),
    building: values.building?.trim() ? values.building.trim() : undefined,
    floor: values.floor?.trim() ? values.floor.trim() : undefined,
    latitude: Number(values.latitude),
    longitude: Number(values.longitude),
    radiusMeters: Number(values.radiusMeters),
  };
}

export const assignTeacherSubjectSchema = z.object({
  teacherId: z.string().min(1, 'Select a teacher'),
  subjectId: z.string().min(1, 'Select a subject'),
  section: z.string().trim().max(10).optional().or(z.literal('')),
});

export type AssignTeacherSubjectFormValues = z.infer<typeof assignTeacherSubjectSchema>;

export const enrollStudentSubjectSchema = z.object({
  studentId: z.string().min(1, 'Select a student'),
  subjectId: z.string().min(1, 'Select a subject'),
});

export type EnrollStudentSubjectFormValues = z.infer<typeof enrollStudentSubjectSchema>;
