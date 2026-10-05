import { prisma } from '../db/prisma';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
import { getPolicy } from './adminService';

export interface StartSessionInput {
  teacherUserId: string;
  subjectId: string;
  classroomId: string;
  semester: number;
  section: string;
  durationMinutes?: number;
  geofenceRadiusM?: number;
  livenessRequired?: boolean;
  blinkRequired?: boolean;
}

export async function startSession(input: StartSessionInput) {
  const teacher = await prisma.teacher.findUnique({ where: { userId: input.teacherUserId } });
  if (!teacher) throw new NotFoundError('Teacher profile not found');

  const assignment = await prisma.teacherSubject.findFirst({
    where: { teacherId: teacher.id, subjectId: input.subjectId },
  });
  if (!assignment) {
    throw new ForbiddenError('You are not assigned to teach this subject', 'NOT_ASSIGNED');
  }

  const classroom = await prisma.classroom.findUnique({ where: { id: input.classroomId } });
  if (!classroom) throw new NotFoundError('Classroom not found');

  const policy = await getPolicy();
  const duration = input.durationMinutes ?? policy.defaultSessionDurationMin;
  if (duration < 1 || duration > 240) {
    throw new ValidationError('Session duration must be between 1 and 240 minutes');
  }

  const startTime = new Date();
  const endTime = new Date(startTime.getTime() + duration * 60_000);

  return prisma.attendanceSession.create({
    data: {
      subjectId: input.subjectId,
      teacherId: teacher.id,
      classroomId: input.classroomId,
      semester: input.semester,
      section: input.section,
      startTime,
      endTime,
      status: 'ACTIVE',
      geofenceRadiusM: input.geofenceRadiusM ?? classroom.radiusMeters,
      livenessRequired: input.livenessRequired ?? policy.livenessMandatory,
      blinkRequired: input.blinkRequired ?? policy.blinkMandatory,
      maxAttempts: policy.maxVerificationAttempts,
    },
    include: { subject: true, classroom: true },
  });
}

export async function stopSession(sessionId: string, teacherUserId: string) {
  const teacher = await prisma.teacher.findUnique({ where: { userId: teacherUserId } });
  if (!teacher) throw new NotFoundError('Teacher profile not found');

  const session = await prisma.attendanceSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new NotFoundError('Session not found');
  if (session.teacherId !== teacher.id) throw new ForbiddenError('This is not your session');

  return prisma.attendanceSession.update({
    where: { id: sessionId },
    data: { status: 'ENDED', endTime: new Date() },
  });
}

export async function getActiveSessionsForStudent(studentId: string) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { enrollments: true },
  });
  if (!student) throw new NotFoundError('Student not found');

  const subjectIds = student.enrollments.filter((e) => e.active).map((e) => e.subjectId);

  // Auto-expire sessions whose endTime has passed.
  await prisma.attendanceSession.updateMany({
    where: { status: 'ACTIVE', endTime: { lt: new Date() } },
    data: { status: 'ENDED' },
  });

  const sessions = await prisma.attendanceSession.findMany({
    where: {
      status: 'ACTIVE',
      subjectId: { in: subjectIds },
      semester: student.semester,
      section: student.section,
      endTime: { gt: new Date() },
    },
    include: { subject: true, classroom: true, teacher: true },
    orderBy: { startTime: 'desc' },
  });

  const existingRecords = await prisma.attendanceRecord.findMany({
    where: { studentId, sessionId: { in: sessions.map((s) => s.id) } },
    select: { sessionId: true },
  });
  const alreadyMarked = new Set(existingRecords.map((r) => r.sessionId));

  return sessions.map((s) => ({ ...s, alreadyMarked: alreadyMarked.has(s.id) }));
}

export async function getTeacherSessions(teacherUserId: string, filter: { status?: string } = {}) {
  const teacher = await prisma.teacher.findUnique({ where: { userId: teacherUserId } });
  if (!teacher) throw new NotFoundError('Teacher profile not found');

  await prisma.attendanceSession.updateMany({
    where: { status: 'ACTIVE', endTime: { lt: new Date() } },
    data: { status: 'ENDED' },
  });

  return prisma.attendanceSession.findMany({
    where: { teacherId: teacher.id, ...(filter.status ? { status: filter.status as never } : {}) },
    include: {
      subject: true,
      classroom: true,
      _count: { select: { attendanceRecords: true } },
    },
    orderBy: { startTime: 'desc' },
    take: 100,
  });
}

export async function correctAttendance(input: {
  attendanceId: string;
  newStatus: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  reason: string;
  teacherUserId: string;
}) {
  const teacher = await prisma.teacher.findUnique({ where: { userId: input.teacherUserId } });
  if (!teacher) throw new NotFoundError('Teacher profile not found');

  const record = await prisma.attendanceRecord.findUnique({
    where: { id: input.attendanceId },
    include: { session: true },
  });
  if (!record) throw new NotFoundError('Attendance record not found');
  if (record.session.teacherId !== teacher.id) {
    throw new ForbiddenError('You can only correct attendance for your own sessions');
  }

  const [updated] = await prisma.$transaction([
    prisma.attendanceRecord.update({
      where: { id: record.id },
      data: { status: input.newStatus },
    }),
    prisma.attendanceCorrection.create({
      data: {
        attendanceId: record.id,
        originalStatus: record.status,
        newStatus: input.newStatus,
        reason: input.reason,
        correctedByTeacherId: teacher.id,
      },
    }),
  ]);

  return updated;
}

export async function getSessionLiveAttendance(sessionId: string, teacherUserId: string) {
  const teacher = await prisma.teacher.findUnique({ where: { userId: teacherUserId } });
  if (!teacher) throw new NotFoundError('Teacher profile not found');

  const session = await prisma.attendanceSession.findUnique({
    where: { id: sessionId },
    include: { subject: true, classroom: true },
  });
  if (!session) throw new NotFoundError('Session not found');
  if (session.teacherId !== teacher.id) throw new ForbiddenError('This is not your session');

  const eligibleStudents = await prisma.student.findMany({
    where: {
      semester: session.semester,
      section: session.section,
      status: 'ACTIVE',
      enrollments: { some: { subjectId: session.subjectId, active: true } },
    },
    orderBy: { rollNumber: 'asc' },
  });

  const records = await prisma.attendanceRecord.findMany({ where: { sessionId } });
  const byStudent = new Map(records.map((r) => [r.studentId, r]));

  const roster = eligibleStudents.map((s) => ({
    studentId: s.id,
    studentCode: s.studentCode,
    rollNumber: s.rollNumber,
    fullName: s.fullName,
    status: byStudent.get(s.id)?.status ?? 'ABSENT',
    markedAt: byStudent.get(s.id)?.markedAt ?? null,
  }));

  const presentCount = roster.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;

  return { session, roster, presentCount, totalCount: roster.length };
}
