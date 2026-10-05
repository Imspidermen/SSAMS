import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as teacherService from '../services/teacherService';

export const dashboard = asyncHandler(async (req: Request, res: Response) => {
  const data = await teacherService.getTeacherDashboard(req.user!.id);
  res.json({ success: true, data });
});

export const subjects = asyncHandler(async (req: Request, res: Response) => {
  const data = await teacherService.getAssignedSubjects(req.user!.id);
  res.json({ success: true, data });
});
