import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as studentService from '../services/studentService';
import { NotFoundError } from '../utils/errors';
import { prisma } from '../db/prisma';
import { getPolicy } from '../services/adminService';

export const me = asyncHandler(async (req: Request, res: Response) => {
  const student = await studentService.getStudentByUserId(req.user!.id);
  res.json({ success: true, data: student });
});

export const myAttendance = asyncHandler(async (req: Request, res: Response) => {
  const student = await studentService.getStudentByUserId(req.user!.id);
  const [overall, subjectWise, history, policy] = await Promise.all([
    studentService.getOverallAttendance(student.id),
    studentService.getSubjectWiseAttendance(student.id),
    studentService.getAttendanceHistory(student.id, 200),
    getPolicy(student.departmentId),
  ]);

  const subjectWiseWithProjection = subjectWise.map((s) => ({
    ...s,
    classesNeededForTarget: studentService.classesNeededForTarget(
      s.present,
      s.total,
      policy.minAttendancePercentage,
    ),
  }));

  res.json({
    success: true,
    data: {
      overall,
      subjectWise: subjectWiseWithProjection,
      history,
      minAttendancePercentage: policy.minAttendancePercentage,
    },
  });
});

export const myHistory = asyncHandler(async (req: Request, res: Response) => {
  const student = await prisma.student.findUnique({ where: { userId: req.user!.id } });
  if (!student) throw new NotFoundError('Student profile not found');
  const history = await studentService.getAttendanceHistory(student.id, 500);
  res.json({ success: true, data: history });
});
