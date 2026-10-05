import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as reportService from '../services/reportService';

export const attendanceReport = asyncHandler(async (req: Request, res: Response) => {
  const { from, to, subjectId, departmentId, studentId, teacherId, format } = req.query as Record<
    string,
    string | undefined
  >;

  const rows = await reportService.buildAttendanceReport({
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
    subjectId,
    departmentId,
    studentId,
    teacherId,
  });

  if (format === 'csv') {
    const csv = reportService.toCsv(rows as unknown as Record<string, unknown>[]);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="attendance-report.csv"`);
    res.send(csv);
    return;
  }

  res.json({ success: true, data: rows });
});
