import { prisma } from '../db/prisma';

export interface ReportFilter {
  from?: Date;
  to?: Date;
  subjectId?: string;
  departmentId?: string;
  studentId?: string;
  teacherId?: string;
}

/** Builds attendance rows directly from PostgreSQL - never synthetic data. */
export async function buildAttendanceReport(filter: ReportFilter) {
  const records = await prisma.attendanceRecord.findMany({
    where: {
      markedAt: {
        gte: filter.from,
        lte: filter.to,
      },
      studentId: filter.studentId,
      session: {
        subjectId: filter.subjectId,
        teacherId: filter.teacherId,
        subject: filter.departmentId ? { departmentId: filter.departmentId } : undefined,
      },
    },
    include: {
      student: { include: { department: true } },
      session: { include: { subject: true, classroom: true, teacher: true } },
    },
    orderBy: { markedAt: 'desc' },
    take: 5000,
  });

  return records.map((r) => ({
    date: r.markedAt.toISOString().slice(0, 10),
    time: r.markedAt.toISOString().slice(11, 19),
    studentCode: r.student.studentCode,
    rollNumber: r.student.rollNumber,
    studentName: r.student.fullName,
    department: r.student.department.name,
    subjectCode: r.session.subject.code,
    subjectName: r.session.subject.name,
    classroom: r.session.classroom.name,
    teacher: r.session.teacher.fullName,
    status: r.status,
    faceVerified: r.faceVerified,
    livenessVerified: r.livenessVerified,
    blinkVerified: r.blinkVerified,
    locationVerified: r.locationVerified,
    faceScore: r.faceScore ?? '',
    distanceFromCenterM: r.distanceFromCenterM ?? '',
  }));
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    const str = String(value ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(','));
  }
  return lines.join('\n');
}
