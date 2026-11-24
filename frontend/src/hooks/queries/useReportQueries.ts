import { useQuery } from '@tanstack/react-query';
import * as reportService from '@/services/report.service';
import { queryKeys } from '@/services/queryKeys';
import type { ReportFilters } from '@/types';

/**
 * Attendance report rows for ADMIN and TEACHER. The backend computes them from
 * PostgreSQL (capped at 5000 rows) and supports the same filters as the CSV
 * export, so the preview and the download always agree.
 */
export function useAttendanceReport(filters: ReportFilters | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.reports.attendance(filters),
    queryFn: () => reportService.getAttendanceReport(filters),
    enabled,
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });
}
