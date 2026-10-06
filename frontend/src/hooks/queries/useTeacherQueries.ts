import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as attendanceService from '@/services/attendance.service';
import * as teacherService from '@/services/teacher.service';
import { queryKeys } from '@/services/queryKeys';
import { LIVE_ROSTER_REFETCH_MS, SESSION_LIST_REFETCH_MS } from '@/utils/constants';
import type { CorrectAttendanceRequest, StartSessionRequest } from '@/types';

export function useTeacherDashboard(enabled = true) {
  return useQuery({
    queryKey: queryKeys.teacher.dashboard,
    queryFn: teacherService.getTeacherDashboard,
    staleTime: 30_000,
    enabled,
  });
}

export function useTeacherSubjects(enabled = true) {
  return useQuery({
    queryKey: queryKeys.teacher.subjects,
    queryFn: teacherService.getMySubjects,
    staleTime: 2 * 60_000,
    enabled,
  });
}

export function useTeacherSessions(status?: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.teacher.sessions(status),
    queryFn: () => attendanceService.listTeacherSessions(status),
    staleTime: 10_000,
    refetchInterval: SESSION_LIST_REFETCH_MS,
    refetchIntervalInBackground: false,
    enabled,
  });
}

/**
 * Live roster for a running session. Polls while the session is active so the
 * teacher sees students verified in real time; polling stops once it ends.
 */
export function useLiveAttendance(sessionId: string | undefined, active: boolean) {
  return useQuery({
    queryKey: queryKeys.teacher.liveAttendance(sessionId ?? ''),
    queryFn: () => attendanceService.getLiveAttendance(sessionId as string),
    enabled: Boolean(sessionId) && active,
    refetchInterval: active ? LIVE_ROSTER_REFETCH_MS : false,
    refetchIntervalInBackground: false,
    staleTime: 2000,
  });
}

export function useStartSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: StartSessionRequest) => attendanceService.startSession(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.teacher.sessionsAll });
      void queryClient.invalidateQueries({ queryKey: queryKeys.teacher.dashboard });
      void queryClient.invalidateQueries({ queryKey: queryKeys.student.activeSessions });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.dashboard });
    },
  });
}

export function useStopSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => attendanceService.stopSession(sessionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.teacher.sessionsAll });
      void queryClient.invalidateQueries({ queryKey: queryKeys.teacher.dashboard });
      void queryClient.invalidateQueries({ queryKey: queryKeys.student.activeSessions });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.dashboard });
    },
  });
}

export function useCorrectAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CorrectAttendanceRequest) => attendanceService.correctAttendance(payload),
    onSuccess: (record) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.teacher.liveAttendance(record.sessionId),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.teacher.sessionsAll });
      void queryClient.invalidateQueries({ queryKey: queryKeys.teacher.dashboard });
      void queryClient.invalidateQueries({ queryKey: queryKeys.student.attendance });
      void queryClient.invalidateQueries({ queryKey: queryKeys.student.history });
      void queryClient.invalidateQueries({ queryKey: queryKeys.reports.attendanceAll });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.dashboard });
    },
  });
}
