/**
 * Subject operations.
 *
 * Subjects are owned by the admin surface (`/api/admin/subjects`); teachers get
 * a read-only view of their own assignments (`/api/teacher/subjects`). This
 * module re-exports both behind one subject-focused API so pages never have to
 * know which role-specific route they are hitting.
 */
import type {
  AssignTeacherSubjectRequest,
  EnrollStudentSubjectRequest,
  StudentSubjectEnrollment,
  Subject,
  TeacherSubject,
} from '@/types';
import { api, compactParams } from './api';
import * as teacherService from './teacher.service';

export function listSubjects(filters?: {
  departmentId?: string;
  semester?: number;
}): Promise<Subject[]> {
  return api.get<Subject[]>('/admin/subjects', { params: compactParams(filters) });
}

export function createSubject(payload: {
  name: string;
  code: string;
  departmentId: string;
  courseId?: string;
  semester: number;
  credits?: number;
}): Promise<Subject> {
  return api.post<Subject>('/admin/subjects', payload);
}

export function assignTeacher(payload: AssignTeacherSubjectRequest): Promise<TeacherSubject> {
  return api.post<TeacherSubject>('/admin/subjects/assign-teacher', payload);
}

export function enrollStudent(
  payload: EnrollStudentSubjectRequest,
): Promise<StudentSubjectEnrollment> {
  return api.post<StudentSubjectEnrollment>('/admin/subjects/enroll-student', payload);
}

export const listMySubjects = teacherService.getMySubjects;
