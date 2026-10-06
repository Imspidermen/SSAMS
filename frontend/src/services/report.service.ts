/**
 * Reports (`/api/reports`, ADMIN + TEACHER).
 *
 * GET /reports/attendance returns rows computed directly from PostgreSQL.
 * Appending `format=csv` streams a real attachment - the export button in the
 * UI is therefore genuinely functional, not decorative.
 */
import type { Paginated, ReportFilters, ReportRow } from '@/types';
import { api, apiDownload, compactParams } from './api';
import { saveBlob } from '@/utils/download';

export function getAttendanceReport(filters?: ReportFilters): Promise<ReportRow[]> {
  return api.get<ReportRow[]>('/reports/attendance', { params: compactParams(filters) });
}

/** Downloads the same report as CSV through the backend's attachment response. */
export async function downloadAttendanceReport(
  filters: ReportFilters | undefined,
  signal?: AbortSignal,
): Promise<void> {
  const blob = await apiDownload('/reports/attendance', { ...filters, format: 'csv' }, signal);
  saveBlob(blob, buildReportFilename(filters));
}

function buildReportFilename(filters?: ReportFilters): string {
  const parts = ['attendance-report'];
  if (filters?.from) parts.push(`from-${filters.from}`);
  if (filters?.to) parts.push(`to-${filters.to}`);
  return `${parts.join('_')}.csv`;
}

/* ------------------------------------------------------------------------- */
/* Client-side aggregation over the real report rows.                          */
/* No synthetic data is ever generated here - empty input yields empty output. */
/* ------------------------------------------------------------------------- */

export interface ReportSummary {
  totalRecords: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendancePercentage: number;
  faceVerified: number;
  uniqueStudents: number;
}

export function summariseReport(rows: ReportRow[]): ReportSummary {
  const present = rows.filter((r) => r.status === 'PRESENT').length;
  const late = rows.filter((r) => r.status === 'LATE').length;
  const absent = rows.filter((r) => r.status === 'ABSENT').length;
  const excused = rows.filter((r) => r.status === 'EXCUSED').length;
  const attended = present + late;
  const uniqueStudents = new Set(rows.map((r) => r.studentCode)).size;

  return {
    totalRecords: rows.length,
    present,
    absent,
    late,
    excused,
    attendancePercentage: rows.length > 0 ? Math.round((attended / rows.length) * 1000) / 10 : 0,
    faceVerified: rows.filter((r) => r.faceVerified === true).length,
    uniqueStudents,
  };
}

/** Groups rows by date (YYYY-MM-DD) for the trend chart. */
export function groupReportByDate(
  rows: ReportRow[],
): Array<{ date: string; present: number; absent: number; total: number; percentage: number }> {
  const buckets = new Map<string, { present: number; absent: number; total: number }>();

  for (const row of rows) {
    const bucket = buckets.get(row.date) ?? { present: 0, absent: 0, total: 0 };
    bucket.total += 1;
    if (row.status === 'PRESENT' || row.status === 'LATE') bucket.present += 1;
    else bucket.absent += 1;
    buckets.set(row.date, bucket);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({
      date,
      present: value.present,
      absent: value.absent,
      total: value.total,
      percentage: value.total > 0 ? Math.round((value.present / value.total) * 1000) / 10 : 0,
    }));
}

/** Groups rows by subject for the subject-wise bar chart. */
export function groupReportBySubject(
  rows: ReportRow[],
): Array<{ subject: string; code: string; present: number; total: number; percentage: number }> {
  const buckets = new Map<string, { code: string; present: number; total: number }>();

  for (const row of rows) {
    const bucket = buckets.get(row.subjectName) ?? { code: row.subjectCode, present: 0, total: 0 };
    bucket.total += 1;
    if (row.status === 'PRESENT' || row.status === 'LATE') bucket.present += 1;
    buckets.set(row.subjectName, bucket);
  }

  return [...buckets.entries()]
    .map(([subject, value]) => ({
      subject,
      code: value.code,
      present: value.present,
      total: value.total,
      percentage: value.total > 0 ? Math.round((value.present / value.total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.percentage - a.percentage);
}

/**
 * Paginates an already-fetched report client-side. The report endpoint caps at
 * 5000 rows and has no server pagination - see API_CONTRACT.md.
 */
export function paginateRows<T>(items: T[], page: number, pageSize: number): Paginated<T> {
  const total = items.length;
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    total,
    page,
    pageSize,
  };
}
