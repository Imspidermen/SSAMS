/**
 * Dashboard aggregations. Each role has its own server-computed payload - the
 * frontend never derives statistics locally from unrelated lists, and never
 * invents numbers.
 */
import type { AdminDashboard, StudentAttendanceOverview, TeacherDashboard } from '@/types';
import { api } from './api';
import * as studentService from './student.service';

export function getAdminDashboard(): Promise<AdminDashboard> {
  return api.get<AdminDashboard>('/admin/dashboard');
}

export function getTeacherDashboard(): Promise<TeacherDashboard> {
  return api.get<TeacherDashboard>('/teacher/dashboard');
}

export function getStudentDashboard(): Promise<StudentAttendanceOverview> {
  return studentService.getMyAttendance();
}
