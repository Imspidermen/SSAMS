import type {
  AdminDashboard,
  AssignTeacherSubjectRequest,
  AttendancePolicy,
  AuditLog,
  Classroom,
  Course,
  CreateClassroomRequest,
  CreateCourseRequest,
  CreateDepartmentRequest,
  CreateStudentRequest,
  CreateStudentResult,
  CreateSubjectRequest,
  CreateTeacherRequest,
  CreateTeacherResult,
  Department,
  EnrollStudentSubjectRequest,
  Paginated,
  Student,
  StudentListParams,
  StudentSubjectEnrollment,
  Subject,
  Teacher,
  TeacherSubject,
  UpdateClassroomRequest,
  UpdatePolicyRequest,
  UpdateStudentRequest,
} from '@/types';
import { ApiError } from '@/utils/apiError';
import { api, compactParams } from './api';

/* -------------------------------- Dashboard ------------------------------ */

export function getAdminDashboard(): Promise<AdminDashboard> {
  return api.get<AdminDashboard>('/admin/dashboard');
}

/* ------------------------------ Departments ------------------------------ */

export function listDepartments(): Promise<Department[]> {
  return api.get<Department[]>('/admin/departments');
}

export function createDepartment(payload: CreateDepartmentRequest): Promise<Department> {
  return api.post<Department>('/admin/departments', payload);
}

/* --------------------------------- Courses -------------------------------- */

export function listCourses(): Promise<Course[]> {
  return api.get<Course[]>('/admin/courses');
}

export function createCourse(payload: CreateCourseRequest): Promise<Course> {
  return api.post<Course>('/admin/courses', payload);
}

/* -------------------------------- Subjects -------------------------------- */

export function listSubjects(filters?: {
  departmentId?: string;
  semester?: number;
}): Promise<Subject[]> {
  return api.get<Subject[]>('/admin/subjects', { params: compactParams(filters) });
}

export function createSubject(payload: CreateSubjectRequest): Promise<Subject> {
  return api.post<Subject>('/admin/subjects', payload);
}

export function assignTeacherSubject(
  payload: AssignTeacherSubjectRequest,
): Promise<TeacherSubject> {
  return api.post<TeacherSubject>('/admin/subjects/assign-teacher', payload);
}

export function enrollStudentInSubject(
  payload: EnrollStudentSubjectRequest,
): Promise<StudentSubjectEnrollment> {
  return api.post<StudentSubjectEnrollment>('/admin/subjects/enroll-student', payload);
}

/* ------------------------------- Classrooms ------------------------------- */

export function listClassrooms(): Promise<Classroom[]> {
  return api.get<Classroom[]>('/admin/classrooms');
}

export function createClassroom(payload: CreateClassroomRequest): Promise<Classroom> {
  return api.post<Classroom>('/admin/classrooms', payload);
}

export function updateClassroom(id: string, payload: UpdateClassroomRequest): Promise<Classroom> {
  return api.patch<Classroom>(`/admin/classrooms/${id}`, payload);
}

/* -------------------------------- Students -------------------------------- */

export function listStudents(params?: StudentListParams): Promise<Paginated<Student>> {
  return api.get<Paginated<Student>>('/admin/students', { params: compactParams(params) });
}

export function createStudent(payload: CreateStudentRequest): Promise<CreateStudentResult> {
  return api.post<CreateStudentResult>('/admin/students', payload);
}

export function updateStudent(id: string, payload: UpdateStudentRequest): Promise<Student> {
  return api.patch<Student>(`/admin/students/${id}`, payload);
}

export function deactivateStudent(id: string): Promise<Student> {
  return api.post<Student>(`/admin/students/${id}/deactivate`);
}

export function reactivateStudent(id: string): Promise<Student> {
  return api.post<Student>(`/admin/students/${id}/reactivate`);
}

/** Clears a student's face embeddings so they can re-enrol (admin only). */
export function resetStudentFace(id: string): Promise<{ status: string }> {
  return api.post<{ status: string }>(`/admin/students/${id}/reset-face`);
}

/**
 * Fetches a single student by id.
 *
 * BACKEND GAP: the API exposes no `GET /admin/students/:id` route, so the
 * record is resolved by walking the paginated list endpoint (the largest page
 * size the backend accepts is 100) and matching on `id`. Results are usually
 * found on the first page because navigation into this screen comes from the
 * student table, which pre-seeds the cache.
 *
 * The required endpoint is documented in `frontend/API_CONTRACT.md` under
 * "Backend endpoints the frontend needs" - once it exists, only this function
 * has to change.
 */
export async function getStudent(id: string): Promise<Student> {
  const pageSize = 100;
  let page = 1;
  let totalPages = 1;

  do {
    const result = await listStudents({ page, pageSize });
    const match = result.items.find((student) => student.id === id);
    if (match) return match;

    totalPages = Math.max(1, Math.ceil(result.total / pageSize));
    page += 1;
  } while (page <= totalPages);

  throw new ApiError({
    message: 'The requested student could not be found.',
    status: 404,
    code: 'NOT_FOUND',
  });
}

/* -------------------------------- Teachers -------------------------------- */

export function listTeachers(params?: {
  page?: number;
  pageSize?: number;
  search?: string;
}): Promise<Paginated<Teacher>> {
  return api.get<Paginated<Teacher>>('/admin/teachers', { params: compactParams(params) });
}

export function createTeacher(payload: CreateTeacherRequest): Promise<CreateTeacherResult> {
  return api.post<CreateTeacherResult>('/admin/teachers', payload);
}

/* --------------------------------- Policy --------------------------------- */

export function getPolicy(departmentId?: string): Promise<AttendancePolicy> {
  return api.get<AttendancePolicy>('/admin/policy', { params: compactParams({ departmentId }) });
}

export function updatePolicy(payload: UpdatePolicyRequest): Promise<AttendancePolicy> {
  return api.put<AttendancePolicy>('/admin/policy', payload);
}

/* ------------------------------- Audit logs ------------------------------- */

export function listAuditLogs(params?: {
  page?: number;
  pageSize?: number;
}): Promise<Paginated<AuditLog>> {
  return api.get<Paginated<AuditLog>>('/admin/audit-logs', { params: compactParams(params) });
}
