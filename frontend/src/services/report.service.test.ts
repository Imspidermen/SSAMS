import { describe, expect, it } from 'vitest';
import {
  groupReportByDate,
  groupReportBySubject,
  paginateRows,
  summariseReport,
} from './report.service';
import type { AttendanceStatus, ReportRow } from '@/types';

/** Builds a report row exactly as GET /reports/attendance returns it. */
function row(overrides: Partial<ReportRow> = {}): ReportRow {
  return {
    date: '2026-02-10',
    time: '09:15',
    studentCode: 'BCA2024001',
    rollNumber: '01',
    studentName: 'Aarav Mehta',
    department: 'Computer Applications',
    subjectCode: 'BCA301',
    subjectName: 'Data Structures',
    classroom: 'Room 204',
    teacher: 'Dr. Ritu Sharma',
    status: 'PRESENT',
    faceVerified: true,
    livenessVerified: true,
    blinkVerified: true,
    locationVerified: true,
    faceScore: 0.83,
    distanceFromCenterM: 12.4,
    ...overrides,
  };
}

describe('summariseReport', () => {
  it('returns zeroes for an empty report instead of inventing data', () => {
    const summary = summariseReport([]);
    expect(summary).toMatchObject({
      totalRecords: 0,
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
      attendancePercentage: 0,
      uniqueStudents: 0,
    });
  });

  it('counts LATE as attended, matching the backend rule', () => {
    const summary = summariseReport([
      row({ status: 'PRESENT' }),
      row({ status: 'LATE', studentCode: 'BCA2024002' }),
      row({ status: 'ABSENT', studentCode: 'BCA2024003' }),
      row({ status: 'EXCUSED', studentCode: 'BCA2024004' }),
    ]);

    expect(summary.totalRecords).toBe(4);
    expect(summary.present).toBe(1);
    expect(summary.late).toBe(1);
    expect(summary.absent).toBe(1);
    expect(summary.excused).toBe(1);
    // 2 attended of 4 = 50%
    expect(summary.attendancePercentage).toBe(50);
    expect(summary.uniqueStudents).toBe(4);
  });

  it('counts a student with several records once', () => {
    const summary = summariseReport([
      row({ subjectCode: 'BCA301' }),
      row({ subjectCode: 'BCA302', date: '2026-02-11' }),
    ]);
    expect(summary.uniqueStudents).toBe(1);
    expect(summary.totalRecords).toBe(2);
  });

  it('rounds to one decimal like the backend does', () => {
    const rows = [
      row({ status: 'PRESENT' }),
      row({ status: 'PRESENT', studentCode: 'B2' }),
      row({ status: 'ABSENT', studentCode: 'B3' }),
    ];
    // 2/3 = 66.666... -> 66.7
    expect(summariseReport(rows).attendancePercentage).toBe(66.7);
  });
});

describe('groupReportByDate', () => {
  it('produces one ascending point per day with present/total counts', () => {
    const points = groupReportByDate([
      row({ date: '2026-02-11', status: 'ABSENT' }),
      row({ date: '2026-02-10', status: 'PRESENT' }),
      row({ date: '2026-02-10', status: 'LATE', studentCode: 'B2' }),
    ]);

    expect(points.map((point) => point.date)).toEqual(['2026-02-10', '2026-02-11']);
    expect(points[0]).toMatchObject({ present: 2, absent: 0, total: 2, percentage: 100 });
    expect(points[1]).toMatchObject({ present: 0, absent: 1, total: 1, percentage: 0 });
  });

  it('returns an empty array when there are no rows', () => {
    expect(groupReportByDate([])).toEqual([]);
  });
});

describe('groupReportBySubject', () => {
  it('aggregates per subject and sorts by percentage', () => {
    const groups = groupReportBySubject([
      row({ subjectCode: 'BCA301', subjectName: 'Data Structures', status: 'PRESENT' }),
      row({ subjectCode: 'BCA302', subjectName: 'DBMS', status: 'ABSENT' }),
      row({ subjectCode: 'BCA302', subjectName: 'DBMS', status: 'PRESENT', studentCode: 'B2' }),
    ]);

    expect(groups[0].subject).toBe('Data Structures');
    expect(groups[0].percentage).toBe(100);
    expect(groups[1]).toMatchObject({
      subject: 'DBMS',
      code: 'BCA302',
      present: 1,
      total: 2,
      percentage: 50,
    });
  });
});

describe('paginateRows', () => {
  const items = Array.from({ length: 25 }, (_, index) => index + 1);

  it('slices the requested page and reports the real total', () => {
    const first = paginateRows(items, 1, 10);
    expect(first.items).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(first.total).toBe(25);
    expect(first.page).toBe(1);

    const last = paginateRows(items, 3, 10);
    expect(last.items).toEqual([21, 22, 23, 24, 25]);
  });

  it('returns an empty page beyond the end rather than wrapping', () => {
    expect(paginateRows(items, 9, 10).items).toEqual([]);
  });

  it('handles an empty list', () => {
    const page = paginateRows<number[]>([], 1, 10);
    expect(page.items).toEqual([]);
    expect(page.total).toBe(0);
  });
});

describe('status coverage', () => {
  it('keeps every backend status distinguishable in the aggregates', () => {
    const statuses: AttendanceStatus[] = ['PRESENT', 'LATE', 'ABSENT', 'EXCUSED'];
    const summary = summariseReport(
      statuses.map((status, index) => row({ status, studentCode: `S${index}` })),
    );
    expect(summary.present + summary.late + summary.absent + summary.excused).toBe(
      summary.totalRecords,
    );
  });
});
