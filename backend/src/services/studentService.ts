import { prisma } from '../db/prisma';
import { NotFoundError } from '../utils/errors';
import { getPolicy } from './adminService';
import { classesNeededForTarget, attendancePercentage } from '../utils/attendanceMath';

export async function getStudentByUserId(userId: string) {
  const student = await prisma.student.findUnique({
    where: { userId },
    include: { department: true, faceProfile: true, user: { select: { email: true } } },
  });
  if (!student) throw new NotFoundError('Student profile not found');
  return student;
}

export interface SubjectAttendanceSummary {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  present: number;
  absent: number;
  total: number;
  percentage: number;
  belowThreshold: boolean;
}

export async function getSubjectWiseAttendance(
  studentId: string,
): Promise<SubjectAttendanceSummary[]> {
  const policy = await getPolicy();
  const enrollments = await prisma.studentSubjectEnrollment.findMany({
    where: { studentId, active: true },
    include: { subject: true },
  });

  const results: SubjectAttendanceSummary[] = [];
  for (const enrollment of enrollments) {
    const records = await prisma.attendanceRecord.findMany({
      where: { studentId, session: { subjectId: enrollment.subjectId } },
      select: { status: true },
    });
    const total = records.length;
    const present = records.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;
    const absent = total - present;
    const percentage = total > 0 ? Math.round((present / total) * 1000) / 10 : 0;
    results.push({
      subjectId: enrollment.subjectId,
      subjectName: enrollment.subject.name,
      subjectCode: enrollment.subject.code,
      present,
      absent,
      total,
      percentage,
      belowThreshold: total > 0 && percentage < policy.minAttendancePercentage,
    });
  }
  return results;
}

export async function getOverallAttendance(studentId: string) {
  const [total, present] = await Promise.all([
    prisma.attendanceRecord.count({ where: { studentId } }),
    prisma.attendanceRecord.count({ where: { studentId, status: { in: ['PRESENT', 'LATE'] } } }),
  ]);
  const percentage = total > 0 ? Math.round((present / total) * 1000) / 10 : 0;
  return { total, present, absent: total - present, percentage };
}

export async function getAttendanceHistory(studentId: string, limit = 100) {
  return prisma.attendanceRecord.findMany({
    where: { studentId },
    include: {
      session: { include: { subject: true, classroom: true, teacher: true } },
    },
    orderBy: { markedAt: 'desc' },
    take: limit,
  });
}

export { classesNeededForTarget, attendancePercentage };
