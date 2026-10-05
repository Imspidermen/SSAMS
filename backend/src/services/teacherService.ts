import { prisma } from '../db/prisma';
import { NotFoundError } from '../utils/errors';

export async function getTeacherByUserId(userId: string) {
  const teacher = await prisma.teacher.findUnique({
    where: { userId },
    include: { department: true, user: { select: { email: true } } },
  });
  if (!teacher) throw new NotFoundError('Teacher profile not found');
  return teacher;
}

export async function getAssignedSubjects(userId: string) {
  const teacher = await getTeacherByUserId(userId);
  return prisma.teacherSubject.findMany({
    where: { teacherId: teacher.id },
    include: { subject: { include: { department: true } } },
  });
}

export async function getTeacherDashboard(userId: string) {
  const teacher = await getTeacherByUserId(userId);

  const [activeSessions, totalSessionsToday, subjects] = await Promise.all([
    prisma.attendanceSession.count({ where: { teacherId: teacher.id, status: 'ACTIVE' } }),
    prisma.attendanceSession.count({
      where: {
        teacherId: teacher.id,
        startTime: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    }),
    prisma.teacherSubject.count({ where: { teacherId: teacher.id } }),
  ]);

  const recentSessions = await prisma.attendanceSession.findMany({
    where: { teacherId: teacher.id },
    include: { subject: true, classroom: true, _count: { select: { attendanceRecords: true } } },
    orderBy: { startTime: 'desc' },
    take: 10,
  });

  return { teacher, activeSessions, totalSessionsToday, subjectCount: subjects, recentSessions };
}
