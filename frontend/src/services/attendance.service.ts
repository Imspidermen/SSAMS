/**
 * Attendance sessions, the live roster, teacher corrections and the student
 * verification pipeline.
 *
 * The backend flow for marking attendance is:
 *
 *   TEACHER  POST /attendance/sessions          -> opens a timed, geofenced session
 *   STUDENT  POST /attendance/location-check    -> creates a verification attempt
 *   STUDENT  POST /attendance/face/verify       -> face match vs enrolled embedding
 *   STUDENT  POST /attendance/liveness          -> head-turn challenge
 *   STUDENT  POST /attendance/blink             -> blink detection
 *   STUDENT  POST /attendance/mark              -> atomically writes the record
 *   TEACHER  GET  /attendance/sessions/:id/live -> live roster while it runs
 *   TEACHER  POST /attendance/correct           -> audited manual correction
 *
 * A student can only reach `/mark` after the server has independently verified
 * every preceding step, so the client can never fabricate a present mark.
 */
import type {
  AttendanceRecord,
  AttendanceSession,
  CorrectAttendanceRequest,
  FaceVerifyResult,
  LiveAttendance,
  LocationCheckRequest,
  LocationCheckResult,
  StartSessionRequest,
  VerifiedStepResult,
} from '@/types';
import { VERIFICATION_TIMEOUT_MS } from '@/config/env';
import { api, compactParams } from './api';

/* ------------------------------ Teacher side ----------------------------- */

export function startSession(payload: StartSessionRequest): Promise<AttendanceSession> {
  return api.post<AttendanceSession>('/attendance/sessions', payload);
}

export function stopSession(sessionId: string): Promise<AttendanceSession> {
  return api.post<AttendanceSession>(`/attendance/sessions/${sessionId}/stop`);
}

export function listTeacherSessions(status?: string): Promise<AttendanceSession[]> {
  return api.get<AttendanceSession[]>('/attendance/sessions/teacher', {
    params: compactParams({ status }),
  });
}

export function getLiveAttendance(sessionId: string): Promise<LiveAttendance> {
  return api.get<LiveAttendance>(`/attendance/sessions/${sessionId}/live`);
}

export function correctAttendance(payload: CorrectAttendanceRequest): Promise<AttendanceRecord> {
  return api.post<AttendanceRecord>('/attendance/correct', payload);
}

/* ------------------------------ Student side ----------------------------- */

/** Active, geofenced sessions the signed-in student is eligible to join. */
export function listActiveSessions(): Promise<AttendanceSession[]> {
  return api.get<AttendanceSession[]>('/attendance/sessions');
}

/** Step 1 - geofence check; creates the server-side verification attempt. */
export function checkLocation(payload: LocationCheckRequest): Promise<LocationCheckResult> {
  return api.post<LocationCheckResult>('/attendance/location-check', payload, {
    timeout: VERIFICATION_TIMEOUT_MS,
  });
}

/** Step 2 - face match against the student's enrolled embedding. */
export function verifyFace(verificationId: string, imageBase64: string): Promise<FaceVerifyResult> {
  return api.post<FaceVerifyResult>(
    '/attendance/face/verify',
    { verificationId, image: imageBase64 },
    { timeout: VERIFICATION_TIMEOUT_MS },
  );
}

/** Step 3 - head-movement liveness challenge over a burst of frames. */
export function verifyLiveness(
  verificationId: string,
  frames: string[],
): Promise<VerifiedStepResult> {
  return api.post<VerifiedStepResult>(
    '/attendance/liveness',
    { verificationId, frames },
    { timeout: VERIFICATION_TIMEOUT_MS },
  );
}

/** Step 4 - eye-blink detection over a burst of frames. */
export function verifyBlink(verificationId: string, frames: string[]): Promise<VerifiedStepResult> {
  return api.post<VerifiedStepResult>(
    '/attendance/blink',
    { verificationId, frames },
    { timeout: VERIFICATION_TIMEOUT_MS },
  );
}

/** Final step - server writes the attendance record only if all checks passed. */
export function markAttendance(verificationId: string): Promise<AttendanceRecord> {
  return api.post<AttendanceRecord>(
    '/attendance/mark',
    { verificationId },
    { timeout: VERIFICATION_TIMEOUT_MS },
  );
}
