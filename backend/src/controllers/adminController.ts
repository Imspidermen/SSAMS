import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as adminService from '../services/adminService';
import * as faceService from '../services/faceService';
import { recordAudit } from '../services/auditService';
import { prisma } from '../db/prisma';

export const dashboard = asyncHandler(async (req: Request, res: Response) => {
  const data = await adminService.getAdminDashboard();
  res.json({ success: true, data });
});

// Departments
export const createDepartment = asyncHandler(async (req: Request, res: Response) => {
  const dept = await adminService.createDepartment(req.body);
  await recordAudit({
    userId: req.user!.id,
    action: 'DEPARTMENT_CREATED',
    entityType: 'Department',
    entityId: dept.id,
  });
  res.status(201).json({ success: true, data: dept });
});
export const listDepartments = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await adminService.listDepartments() });
});

// Courses
export const createCourse = asyncHandler(async (req: Request, res: Response) => {
  const course = await adminService.createCourse(req.body);
  await recordAudit({
    userId: req.user!.id,
    action: 'COURSE_CREATED',
    entityType: 'Course',
    entityId: course.id,
  });
  res.status(201).json({ success: true, data: course });
});
export const listCourses = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await adminService.listCourses() });
});

// Subjects
export const createSubject = asyncHandler(async (req: Request, res: Response) => {
  const subject = await adminService.createSubject(req.body);
  await recordAudit({
    userId: req.user!.id,
    action: 'SUBJECT_CREATED',
    entityType: 'Subject',
    entityId: subject.id,
  });
  res.status(201).json({ success: true, data: subject });
});
export const listSubjects = asyncHandler(async (req: Request, res: Response) => {
  const departmentId = req.query.departmentId as string | undefined;
  const semester = req.query.semester ? Number(req.query.semester) : undefined;
  res.json({ success: true, data: await adminService.listSubjects({ departmentId, semester }) });
});
export const assignTeacherSubject = asyncHandler(async (req: Request, res: Response) => {
  const assignment = await adminService.assignTeacherSubject(req.body);
  await recordAudit({
    userId: req.user!.id,
    action: 'TEACHER_SUBJECT_ASSIGNED',
    entityType: 'TeacherSubject',
    entityId: assignment.id,
  });
  res.status(201).json({ success: true, data: assignment });
});
export const enrollStudentSubject = asyncHandler(async (req: Request, res: Response) => {
  const enrollment = await adminService.enrollStudentInSubject(req.body);
  await recordAudit({
    userId: req.user!.id,
    action: 'STUDENT_ENROLLED',
    entityType: 'StudentSubjectEnrollment',
    entityId: enrollment.id,
  });
  res.status(201).json({ success: true, data: enrollment });
});

// Classrooms
export const createClassroom = asyncHandler(async (req: Request, res: Response) => {
  const classroom = await adminService.createClassroom(req.body);
  await recordAudit({
    userId: req.user!.id,
    action: 'CLASSROOM_CREATED',
    entityType: 'Classroom',
    entityId: classroom.id,
  });
  res.status(201).json({ success: true, data: classroom });
});
export const listClassrooms = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await adminService.listClassrooms() });
});
export const updateClassroom = asyncHandler(async (req: Request, res: Response) => {
  const classroom = await adminService.updateClassroom(req.params.id, req.body);
  await recordAudit({
    userId: req.user!.id,
    action: 'CLASSROOM_UPDATED',
    entityType: 'Classroom',
    entityId: classroom.id,
  });
  res.json({ success: true, data: classroom });
});

// Students
export const createStudent = asyncHandler(async (req: Request, res: Response) => {
  const result = await adminService.createStudent(req.body);
  await recordAudit({
    userId: req.user!.id,
    action: 'STUDENT_CREATED',
    entityType: 'Student',
    entityId: result.student.id,
  });
  res.status(201).json({ success: true, data: result });
});
export const listStudents = asyncHandler(async (req: Request, res: Response) => {
  const { page, pageSize, search } = req.query as unknown as {
    page: number;
    pageSize: number;
    search?: string;
  };
  const departmentId = req.query.departmentId as string | undefined;
  const semester = req.query.semester ? Number(req.query.semester) : undefined;
  const section = req.query.section as string | undefined;
  const result = await adminService.listStudents({
    page,
    pageSize,
    search,
    departmentId,
    semester,
    section,
  });
  res.json({ success: true, data: result });
});
export const updateStudent = asyncHandler(async (req: Request, res: Response) => {
  const student = await adminService.updateStudent(req.params.id, req.body);
  await recordAudit({
    userId: req.user!.id,
    action: 'STUDENT_UPDATED',
    entityType: 'Student',
    entityId: student.id,
  });
  res.json({ success: true, data: student });
});
export const deactivateStudent = asyncHandler(async (req: Request, res: Response) => {
  const student = await adminService.deactivateStudent(req.params.id);
  await recordAudit({
    userId: req.user!.id,
    action: 'STUDENT_DEACTIVATED',
    entityType: 'Student',
    entityId: student.id,
  });
  res.json({ success: true, data: student });
});
export const reactivateStudent = asyncHandler(async (req: Request, res: Response) => {
  const student = await adminService.reactivateStudent(req.params.id);
  await recordAudit({
    userId: req.user!.id,
    action: 'STUDENT_REACTIVATED',
    entityType: 'Student',
    entityId: student.id,
  });
  res.json({ success: true, data: student });
});
export const resetStudentFace = asyncHandler(async (req: Request, res: Response) => {
  const result = await faceService.resetFaceProfile(req.params.id, req.user!.id);
  await recordAudit({
    userId: req.user!.id,
    action: 'FACE_PROFILE_RESET',
    entityType: 'Student',
    entityId: req.params.id,
  });
  res.json({ success: true, data: result });
});

// Teachers
export const createTeacher = asyncHandler(async (req: Request, res: Response) => {
  const result = await adminService.createTeacher(req.body);
  await recordAudit({
    userId: req.user!.id,
    action: 'TEACHER_CREATED',
    entityType: 'Teacher',
    entityId: result.teacher.id,
  });
  res.status(201).json({ success: true, data: result });
});
export const listTeachers = asyncHandler(async (req: Request, res: Response) => {
  const { page, pageSize, search } = req.query as unknown as {
    page: number;
    pageSize: number;
    search?: string;
  };
  res.json({ success: true, data: await adminService.listTeachers({ page, pageSize, search }) });
});

// Policy
export const getPolicy = asyncHandler(async (req: Request, res: Response) => {
  const departmentId = req.query.departmentId as string | undefined;
  res.json({ success: true, data: await adminService.getPolicy(departmentId) });
});
export const updatePolicy = asyncHandler(async (req: Request, res: Response) => {
  const policy = await adminService.upsertPolicy(req.body);
  await recordAudit({
    userId: req.user!.id,
    action: 'POLICY_UPDATED',
    entityType: 'AttendanceRule',
    entityId: policy.id,
    metadata: req.body,
  });
  res.json({ success: true, data: policy });
});

// Audit logs
export const auditLogs = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(req.query.page ?? 1);
  const pageSize = Math.min(Number(req.query.pageSize ?? 50), 200);
  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { user: { select: { email: true, role: true } } },
    }),
    prisma.auditLog.count(),
  ]);
  res.json({ success: true, data: { items, total, page, pageSize } });
});
