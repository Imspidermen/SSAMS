import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as sessionService from '../services/attendanceSessionService';
import * as verificationService from '../services/attendanceVerificationService';
import { prisma } from '../db/prisma';
import { NotFoundError } from '../utils/errors';
import { recordAudit } from '../services/auditService';

async function studentIdFromUser(userId: string): Promise<string> {
  const student = await prisma.student.findUnique({ where: { userId } });
  if (!student) throw new NotFoundError('Student profile not found');
  return student.id;
}

export const startSession = asyncHandler(async (req: Request, res: Response) => {
  const session = await sessionService.startSession({ teacherUserId: req.user!.id, ...req.body });
  await recordAudit({
    userId: req.user!.id,
    action: 'ATTENDANCE_SESSION_STARTED',
    entityType: 'AttendanceSession',
    entityId: session.id,
  });
  res.status(201).json({ success: true, data: session });
});

export const stopSession = asyncHandler(async (req: Request, res: Response) => {
  const session = await sessionService.stopSession(req.params.id, req.user!.id);
  await recordAudit({
    userId: req.user!.id,
    action: 'ATTENDANCE_SESSION_STOPPED',
    entityType: 'AttendanceSession',
    entityId: session.id,
  });
  res.json({ success: true, data: session });
});

export const listActiveSessionsForStudent = asyncHandler(async (req: Request, res: Response) => {
  const studentId = await studentIdFromUser(req.user!.id);
  const sessions = await sessionService.getActiveSessionsForStudent(studentId);
  res.json({ success: true, data: sessions });
});

export const listTeacherSessions = asyncHandler(async (req: Request, res: Response) => {
  const sessions = await sessionService.getTeacherSessions(req.user!.id, {
    status: req.query.status as string,
  });
  res.json({ success: true, data: sessions });
});

export const sessionLiveAttendance = asyncHandler(async (req: Request, res: Response) => {
  const data = await sessionService.getSessionLiveAttendance(req.params.id, req.user!.id);
  res.json({ success: true, data });
});

export const locationCheck = asyncHandler(async (req: Request, res: Response) => {
  const studentId = await studentIdFromUser(req.user!.id);
  const result = await verificationService.checkLocation({ studentId, ...req.body });
  res.json({ success: true, data: result });
});

export const faceVerify = asyncHandler(async (req: Request, res: Response) => {
  const studentId = await studentIdFromUser(req.user!.id);
  const result = await verificationService.verifyFaceStep({
    studentId,
    verificationId: req.body.verificationId,
    image: req.body.image,
  });
  res.json({ success: true, data: result });
});

export const livenessCheck = asyncHandler(async (req: Request, res: Response) => {
  const studentId = await studentIdFromUser(req.user!.id);
  const result = await verificationService.verifyLivenessStep({
    studentId,
    verificationId: req.body.verificationId,
    frames: req.body.frames,
  });
  res.json({ success: true, data: result });
});

export const blinkCheck = asyncHandler(async (req: Request, res: Response) => {
  const studentId = await studentIdFromUser(req.user!.id);
  const result = await verificationService.verifyBlinkStep({
    studentId,
    verificationId: req.body.verificationId,
    frames: req.body.frames,
  });
  res.json({ success: true, data: result });
});

export const correctAttendance = asyncHandler(async (req: Request, res: Response) => {
  const updated = await sessionService.correctAttendance({
    attendanceId: req.body.attendanceId,
    newStatus: req.body.newStatus,
    reason: req.body.reason,
    teacherUserId: req.user!.id,
  });
  await recordAudit({
    userId: req.user!.id,
    action: 'ATTENDANCE_CORRECTED',
    entityType: 'AttendanceRecord',
    entityId: updated.id,
    metadata: { newStatus: req.body.newStatus, reason: req.body.reason },
  });
  res.json({ success: true, data: updated });
});

export const markAttendance = asyncHandler(async (req: Request, res: Response) => {
  const studentId = await studentIdFromUser(req.user!.id);
  const record = await verificationService.markAttendance({
    studentId,
    verificationId: req.body.verificationId,
  });
  res.status(201).json({ success: true, data: record });
});
