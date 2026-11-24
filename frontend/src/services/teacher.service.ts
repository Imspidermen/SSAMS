/** Teacher-scoped read endpoints (`/api/teacher/*`, TEACHER role only). */
import type { Classroom, TeacherDashboard, TeacherSubject } from '@/types';
import { api } from './api';

/**
 * GET /teacher/dashboard - teacher profile, active/today session counts,
 * assigned subject count and the 10 most recent sessions.
 */
export function getTeacherDashboard(): Promise<TeacherDashboard> {
  return api.get<TeacherDashboard>('/teacher/dashboard');
}

/** GET /teacher/subjects - subjects assigned to the signed-in teacher. */
export function getMySubjects(): Promise<TeacherSubject[]> {
  return api.get<TeacherSubject[]>('/teacher/subjects');
}

/** GET /teacher/classrooms - rooms available for session geofencing. */
export function getMyClassrooms(): Promise<Classroom[]> {
  return api.get<Classroom[]>('/teacher/classrooms');
}
