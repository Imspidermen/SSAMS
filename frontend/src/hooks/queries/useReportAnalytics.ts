import { useMemo } from 'react';
import { useAttendanceReport } from './useReportQueries';
import {
  groupReportByDate,
  groupReportBySubject,
  summariseReport,
} from '@/services/report.service';
import type { SubjectBar } from '@/components/dashboard/SubjectAttendanceChart';
import type { TrendPoint } from '@/components/dashboard/AttendanceTrendChart';
import type { AttendanceStatus, ReportFilters, ReportRow } from '@/types';
import { daysAgoInputValue, toEndOfDayIso, toStartOfDayIso, todayInputValue } from '@/utils/date';

export interface StudentAggregate {
  /**
   * Report rows carry no student UUID - only the human-readable student code -
   * so the code is the aggregate key. Do not mistake it for `Student.id`.
   */
  studentCode: string;
  studentName: string;
  rollNumber: string;
  department: string;
  present: number;
  total: number;
  percentage: number;
  belowThreshold: boolean;
}

export interface ReportAnalytics {
  rows: ReportRow[];
  filters: ReportFilters;
  summary: ReturnType<typeof summariseReport>;
  byDate: TrendPoint[];
  bySubject: SubjectBar[];
  byStudent: StudentAggregate[];
  lowAttendance: StudentAggregate[];
  statusCounts: Record<AttendanceStatus, number>;
  isPending: boolean;
  isFetching: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
}

/**
 * Aggregates the real report rows (computed by the backend from PostgreSQL) into
 * the shapes the dashboard charts and low-attendance panels need.
 *
 * Nothing is synthesised: with no rows every aggregate is empty and the UI shows
 * its empty state.
 */
export function useReportAnalytics(
  baseFilters: ReportFilters | undefined,
  options: { rangeDays?: number; threshold: number; enabled?: boolean },
): ReportAnalytics {
  const { rangeDays = 30, threshold, enabled = true } = options;

  const filters = useMemo<ReportFilters>(
    () => ({
      from: toStartOfDayIso(daysAgoInputValue(rangeDays - 1)) ?? undefined,
      to: toEndOfDayIso(todayInputValue()) ?? undefined,
      ...baseFilters,
    }),
    [baseFilters, rangeDays],
  );

  const query = useAttendanceReport(filters, enabled);
  // Wrapped so the derived aggregates below keep a stable dependency.
  const rows = useMemo(() => query.data ?? [], [query.data]);

  const byDate = useMemo(() => groupReportByDate(rows), [rows]);
  const bySubject = useMemo(
    () =>
      groupReportBySubject(rows).map((entry) => ({
        label: entry.subject,
        code: entry.code,
        percentage: entry.percentage,
        present: entry.present,
        total: entry.total,
      })),
    [rows],
  );
  const summary = useMemo(() => summariseReport(rows), [rows]);

  const statusCounts = useMemo<Record<AttendanceStatus, number>>(() => {
    const counts: Record<AttendanceStatus, number> = {
      PRESENT: 0,
      ABSENT: 0,
      LATE: 0,
      EXCUSED: 0,
    };
    for (const row of rows) counts[row.status] = (counts[row.status] ?? 0) + 1;
    return counts;
  }, [rows]);

  const byStudent = useMemo<StudentAggregate[]>(() => {
    const buckets = new Map<string, StudentAggregate>();

    for (const row of rows) {
      const key = row.studentCode;
      const bucket =
        buckets.get(key) ??
        ({
          studentCode: row.studentCode,
          studentName: row.studentName,
          rollNumber: row.rollNumber,
          department: row.department,
          present: 0,
          total: 0,
          percentage: 0,
          belowThreshold: false,
        } satisfies StudentAggregate);

      bucket.total += 1;
      if (row.status === 'PRESENT' || row.status === 'LATE') bucket.present += 1;
      buckets.set(key, bucket);
    }

    return [...buckets.values()]
      .map((entry) => {
        const percentage =
          entry.total > 0 ? Math.round((entry.present / entry.total) * 1000) / 10 : 0;
        return { ...entry, percentage, belowThreshold: entry.total > 0 && percentage < threshold };
      })
      .sort((a, b) => a.percentage - b.percentage);
  }, [rows, threshold]);

  const lowAttendance = useMemo(
    () => byStudent.filter((entry) => entry.belowThreshold),
    [byStudent],
  );

  return {
    rows,
    filters,
    summary,
    byDate,
    bySubject,
    byStudent,
    lowAttendance,
    statusCounts,
    isPending: query.isPending,
    isFetching: query.isFetching,
    isSuccess: query.isSuccess,
    isError: query.isError,
    error: query.error,
    refetch: () => void query.refetch(),
  };
}
