import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as attendanceService from '@/services/attendance.service';
import * as authService from '@/services/auth.service';
import * as faceService from '@/services/face.service';
import * as studentService from '@/services/student.service';
import { queryKeys } from '@/services/queryKeys';
import type { ChangePasswordRequest, LocationCheckRequest } from '@/types';

export function useMyProfile(enabled = true) {
  return useQuery({
    queryKey: queryKeys.student.profile,
    queryFn: studentService.getMyProfile,
    staleTime: 60_000,
    enabled,
  });
}

export function useMyAttendance(enabled = true) {
  return useQuery({
    queryKey: queryKeys.student.attendance,
    queryFn: studentService.getMyAttendance,
    staleTime: 30_000,
    enabled,
  });
}

export function useMyHistory(enabled = true) {
  return useQuery({
    queryKey: queryKeys.student.history,
    queryFn: studentService.getMyHistory,
    staleTime: 30_000,
    enabled,
  });
}

/** Active sessions the student may join. Polled while the screen is visible. */
export function useActiveSessions(enabled = true, pollMs = 20_000) {
  return useQuery({
    queryKey: queryKeys.student.activeSessions,
    queryFn: attendanceService.listActiveSessions,
    enabled,
    refetchInterval: pollMs,
    refetchIntervalInBackground: false,
    staleTime: 5000,
  });
}

export function useFaceStatus(enabled = true) {
  return useQuery({
    queryKey: queryKeys.student.faceStatus,
    queryFn: faceService.getFaceStatus,
    staleTime: 60_000,
    enabled,
  });
}

/* ---------------------------- Verification steps --------------------------- */

export function useLocationCheck() {
  return useMutation({
    mutationFn: (payload: LocationCheckRequest) => attendanceService.checkLocation(payload),
  });
}

export function useFaceVerify() {
  return useMutation({
    mutationFn: ({ verificationId, image }: { verificationId: string; image: string }) =>
      attendanceService.verifyFace(verificationId, image),
  });
}

export function useLivenessVerify() {
  return useMutation({
    mutationFn: ({ verificationId, frames }: { verificationId: string; frames: string[] }) =>
      attendanceService.verifyLiveness(verificationId, frames),
  });
}

export function useBlinkVerify() {
  return useMutation({
    mutationFn: ({ verificationId, frames }: { verificationId: string; frames: string[] }) =>
      attendanceService.verifyBlink(verificationId, frames),
  });
}

/** Final step: refreshes every view that depends on the student's attendance. */
export function useMarkAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (verificationId: string) => attendanceService.markAttendance(verificationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.student.attendance });
      void queryClient.invalidateQueries({ queryKey: queryKeys.student.history });
      void queryClient.invalidateQueries({ queryKey: queryKeys.student.activeSessions });
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.dashboard });
      void queryClient.invalidateQueries({ queryKey: queryKeys.teacher.sessionsAll });
      void queryClient.invalidateQueries({ queryKey: queryKeys.teacher.dashboard });
      void queryClient.invalidateQueries({ queryKey: queryKeys.reports.attendanceAll });
    },
  });
}

export function useEnrollFace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (images: string[]) => faceService.enrollFace(images),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.student.faceStatus });
      void queryClient.invalidateQueries({ queryKey: queryKeys.student.profile });
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (payload: ChangePasswordRequest) => authService.changePassword(payload),
  });
}
