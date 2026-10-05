import { z } from 'zod';

export const createDepartmentSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2).max(10).toUpperCase(),
});

export const createCourseSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2).toUpperCase(),
  departmentId: z.string().uuid(),
  durationSemesters: z.number().int().min(1).max(12).default(6),
});

export const createSubjectSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2).toUpperCase(),
  departmentId: z.string().uuid(),
  courseId: z.string().uuid().optional(),
  semester: z.number().int().min(1).max(12),
  credits: z.number().int().min(1).max(10).default(4),
});

export const createClassroomSchema = z.object({
  name: z.string().min(1),
  building: z.string().optional(),
  floor: z.string().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusMeters: z.number().int().min(5).max(2000).default(100),
});

export const createStudentSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).optional(),
  studentCode: z.string().min(2),
  rollNumber: z.string().min(1),
  fullName: z.string().min(2),
  phone: z.string().optional(),
  departmentId: z.string().uuid(),
  semester: z.number().int().min(1).max(12),
  section: z.string().min(1),
  academicYear: z.string().min(4),
});

export const updateStudentSchema = createStudentSchema.partial().extend({
  status: z.enum(['ACTIVE', 'INACTIVE', 'GRADUATED', 'SUSPENDED']).optional(),
});

export const createTeacherSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).optional(),
  employeeCode: z.string().min(2),
  fullName: z.string().min(2),
  phone: z.string().optional(),
  departmentId: z.string().uuid(),
  designation: z.string().optional(),
});

export const updateTeacherSchema = createTeacherSchema.partial();

export const assignTeacherSubjectSchema = z.object({
  teacherId: z.string().uuid(),
  subjectId: z.string().uuid(),
  section: z.string().optional(),
});

export const enrollStudentSubjectSchema = z.object({
  studentId: z.string().uuid(),
  subjectId: z.string().uuid(),
});

export const updatePolicySchema = z.object({
  scope: z.enum(['GLOBAL', 'DEPARTMENT']).default('GLOBAL'),
  departmentId: z.string().uuid().optional(),
  minAttendancePercentage: z.number().min(0).max(100).optional(),
  defaultGeofenceRadiusM: z.number().int().min(5).max(2000).optional(),
  defaultSessionDurationMin: z.number().int().min(1).max(240).optional(),
  maxVerificationAttempts: z.number().int().min(1).max(10).optional(),
  livenessMandatory: z.boolean().optional(),
  blinkMandatory: z.boolean().optional(),
  faceMatchThreshold: z.number().min(0.1).max(1).optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
});
