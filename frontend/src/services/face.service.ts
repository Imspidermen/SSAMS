/**
 * Face enrolment / status.
 *
 * The backend forwards captured frames to the internal CV microservice and
 * stores ONLY the resulting numeric embeddings - raw images are never
 * persisted and never returned. There is therefore no profile-photo endpoint:
 * the enrolled face profile IS the student's biometric identity.
 */
import type { FaceStatus } from '@/types';
import { VERIFICATION_TIMEOUT_MS } from '@/config/env';
import { api } from './api';

/** POST /face/enroll - 3..10 base64 frames captured from the camera. */
export function enrollFace(images: string[]): Promise<{ status: string; sampleCount: number }> {
  return api.post<{ status: string; sampleCount: number }>(
    '/face/enroll',
    { images },
    { timeout: VERIFICATION_TIMEOUT_MS },
  );
}

/** GET /face/status */
export function getFaceStatus(): Promise<FaceStatus> {
  return api.get<FaceStatus>('/face/status');
}

/** POST /face/reset/:studentId (ADMIN) - clears embeddings so a student can re-enrol. */
export function resetFaceProfile(studentId: string): Promise<{ status: string }> {
  return api.post<{ status: string }>(`/face/reset/${studentId}`);
}
