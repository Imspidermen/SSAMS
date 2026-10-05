import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as faceService from '../services/faceService';
import { prisma } from '../db/prisma';
import { NotFoundError } from '../utils/errors';
import { recordAudit } from '../services/auditService';

async function studentIdFromUser(userId: string): Promise<string> {
  const student = await prisma.student.findUnique({ where: { userId } });
  if (!student) throw new NotFoundError('Student profile not found');
  return student.id;
}

export const enroll = asyncHandler(async (req: Request, res: Response) => {
  const studentId = await studentIdFromUser(req.user!.id);
  const result = await faceService.enrollFace(studentId, req.body.images);
  await recordAudit({
    userId: req.user!.id,
    action: 'FACE_ENROLLED',
    entityType: 'FaceProfile',
    entityId: studentId,
  });
  res.status(201).json({ success: true, data: result });
});

export const status = asyncHandler(async (req: Request, res: Response) => {
  const studentId = await studentIdFromUser(req.user!.id);
  const result = await faceService.getFaceProfileStatus(studentId);
  res.json({ success: true, data: result });
});

export const resetProfile = asyncHandler(async (req: Request, res: Response) => {
  const result = await faceService.resetFaceProfile(req.params.studentId, req.user!.id);
  await recordAudit({
    userId: req.user!.id,
    action: 'FACE_PROFILE_RESET',
    entityType: 'FaceProfile',
    entityId: req.params.studentId,
  });
  res.json({ success: true, data: result });
});
