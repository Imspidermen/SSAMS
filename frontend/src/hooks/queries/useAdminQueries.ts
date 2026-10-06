import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as adminService from '@/services/admin.service';
import { queryKeys } from '@/services/queryKeys';
import type {
  AssignTeacherSubjectRequest,
  CreateClassroomRequest,
  CreateCourseRequest,
  CreateDepartmentRequest,
  CreateStudentRequest,
  CreateSubjectRequest,
  CreateTeacherRequest,
  EnrollStudentSubjectRequest,
  StudentListParams,
  UpdateClassroomRequest,
  UpdatePolicyRequest,
  UpdateStudentRequest,
} from '@/types';

const STALE_MS = 60_000;

/* --------------------------------- Reads --------------------------------- */

export function useAdminDashboard(enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.dashboard,
    queryFn: adminService.getAdminDashboard,
    staleTime: STALE_MS,
    enabled,
  });
}

export function useDepartments(enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.departments,
    queryFn: adminService.listDepartments,
    staleTime: 5 * 60_000,
    enabled,
  });
}

export function useCourses(enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.courses,
    queryFn: adminService.listCourses,
    staleTime: 5 * 60_000,
    enabled,
  });
}

export function useClassrooms(enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.classrooms,
    queryFn: adminService.listClassrooms,
    staleTime: 5 * 60_000,
    enabled,
  });
}

export function useSubjects(
  filters?: { departmentId?: string; semester?: number },
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.admin.subjects(filters),
    queryFn: () => adminService.listSubjects(filters),
    staleTime: 2 * 60_000,
    enabled,
  });
}

export function useStudents(params: StudentListParams, enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.students(params),
    queryFn: () => adminService.listStudents(params),
    placeholderData: (previous) => previous, // keeps the table stable while paging
    enabled,
  });
}

export function useStudent(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.student(id ?? ''),
    queryFn: () => adminService.getStudent(id as string),
    enabled: enabled && Boolean(id),
  });
}

export function useTeachers(
  params?: { page?: number; pageSize?: number; search?: string },
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.admin.teachers(params),
    queryFn: () => adminService.listTeachers(params),
    placeholderData: (previous) => previous,
    enabled,
  });
}

export function usePolicy(departmentId?: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.policy(departmentId),
    queryFn: () => adminService.getPolicy(departmentId),
    staleTime: 5 * 60_000,
    enabled,
  });
}

export function useAuditLogs(params?: { page?: number; pageSize?: number }, enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.auditLogs(params),
    queryFn: () => adminService.listAuditLogs(params),
    placeholderData: (previous) => previous,
    enabled,
  });
}

/* -------------------------------- Writes --------------------------------- */

export function useCreateStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateStudentRequest) => adminService.createStudent(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.studentsAll });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.dashboard });
    },
  });
}

export function useUpdateStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateStudentRequest }) =>
      adminService.updateStudent(id, payload),
    onSuccess: (student) => {
      queryClient.setQueryData(queryKeys.admin.student(student.id), student);
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.studentsAll });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.dashboard });
    },
  });
}

export function useSetStudentActiveState() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      active ? adminService.reactivateStudent(id) : adminService.deactivateStudent(id),
    onSuccess: (student) => {
      queryClient.setQueryData(queryKeys.admin.student(student.id), student);
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.studentsAll });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.dashboard });
    },
  });
}

export function useResetStudentFace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (studentId: string) => adminService.resetStudentFace(studentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.studentsAll });
      void queryClient.invalidateQueries({ queryKey: queryKeys.student.faceStatus });
    },
  });
}

export function useCreateTeacher() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTeacherRequest) => adminService.createTeacher(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.teachersAll });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.dashboard });
    },
  });
}

export function useCreateSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSubjectRequest) => adminService.createSubject(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.subjectsAll });
      void queryClient.invalidateQueries({ queryKey: queryKeys.teacher.subjects });
    },
  });
}

export function useAssignTeacherSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AssignTeacherSubjectRequest) =>
      adminService.assignTeacherSubject(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.subjectsAll });
      void queryClient.invalidateQueries({ queryKey: queryKeys.teacher.subjects });
      void queryClient.invalidateQueries({ queryKey: queryKeys.teacher.dashboard });
    },
  });
}

export function useEnrollStudentSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: EnrollStudentSubjectRequest) =>
      adminService.enrollStudentInSubject(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.studentsAll });
      void queryClient.invalidateQueries({ queryKey: queryKeys.student.attendance });
    },
  });
}

export function useCreateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateDepartmentRequest) => adminService.createDepartment(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.departments });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.dashboard });
    },
  });
}

export function useCreateCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCourseRequest) => adminService.createCourse(payload),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.admin.courses }),
  });
}

export function useCreateClassroom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateClassroomRequest) => adminService.createClassroom(payload),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.admin.classrooms }),
  });
}

export function useUpdateClassroom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateClassroomRequest }) =>
      adminService.updateClassroom(id, payload),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.admin.classrooms }),
  });
}

export function useUpdatePolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdatePolicyRequest) => adminService.updatePolicy(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.policyAll });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.dashboard });
      void queryClient.invalidateQueries({ queryKey: queryKeys.student.attendance });
    },
  });
}
