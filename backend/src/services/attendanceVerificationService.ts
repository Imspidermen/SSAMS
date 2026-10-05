import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';
import { aiClient } from './aiClient';
import { getReferenceEmbeddings } from './faceService';
import { checkGeofence, isPlausibleLocation } from '../utils/geo';
import { AppError, ConflictError, ForbiddenError, NotFoundError } from '../utils/errors';
import { env } from '../config/env';
import { getPolicy } from './adminService';
import { createNotification } from './notificationService';
import { recordAudit } from './auditService';

const CHALLENGE_POOL = ['TURN_LEFT', 'TURN_RIGHT'] as const;

function buildChallengeSequence(): string[] {
  // Randomized per attempt so the sequence is not predictable/hard-coded.
  const shuffled = [...CHALLENGE_POOL].sort(() => Math.random() - 0.5);
  return [...shuffled, 'BLINK'];
}

async function assertSessionActiveAndEligible(sessionId: string, studentId: string) {
  const session = await prisma.attendanceSession.findUnique({
    where: { id: sessionId },
    include: { classroom: true, subject: true },
  });
  if (!session) throw new NotFoundError('Attendance session not found', 'SESSION_NOT_FOUND');

  if (session.status !== 'ACTIVE' || session.endTime < new Date()) {
    throw new AppError('SESSION_EXPIRED', 'This attendance session is no longer active.', 410);
  }

  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student || student.status !== 'ACTIVE') {
    throw new ForbiddenError(
      'Your account is not eligible to mark attendance.',
      'STUDENT_INELIGIBLE',
    );
  }

  if (student.semester !== session.semester || student.section !== session.section) {
    throw new ForbiddenError('You are not enrolled in the class for this session.', 'NOT_IN_CLASS');
  }

  const enrolled = await prisma.studentSubjectEnrollment.findUnique({
    where: { studentId_subjectId: { studentId, subjectId: session.subjectId } },
  });
  if (!enrolled || !enrolled.active) {
    throw new ForbiddenError('You are not enrolled in this subject.', 'NOT_ENROLLED');
  }

  const existing = await prisma.attendanceRecord.findUnique({
    where: { sessionId_studentId: { sessionId, studentId } },
  });
  if (existing) {
    throw new ConflictError('Attendance already recorded for this session.', 'ALREADY_ATTENDED');
  }

  return session;
}

/** STEP 1: Location / geofence verification. Creates the verification attempt. */
export async function checkLocation(input: {
  studentId: string;
  sessionId: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  timestamp: number;
}) {
  const session = await assertSessionActiveAndEligible(input.sessionId, input.studentId);

  const plausibility = isPlausibleLocation(
    input.latitude,
    input.longitude,
    input.accuracyMeters,
    input.timestamp,
  );
  if (!plausibility.valid) {
    throw new AppError(
      'LOCATION_INVALID',
      plausibility.reason ?? 'Location reading is invalid.',
      400,
    );
  }

  const radius = session.geofenceRadiusM ?? session.classroom.radiusMeters;
  const geofence = checkGeofence({
    studentLocation: { latitude: input.latitude, longitude: input.longitude },
    classroomLocation: {
      latitude: session.classroom.latitude,
      longitude: session.classroom.longitude,
    },
    radiusMeters: radius,
    accuracyMeters: input.accuracyMeters,
  });

  const policy = await getPolicy();
  const ttlMs = env.VERIFICATION_SESSION_TTL_MINUTES * 60_000;

  const verification = await prisma.attendanceVerificationSession.create({
    data: {
      sessionId: input.sessionId,
      studentId: input.studentId,
      status: 'IN_PROGRESS',
      challengeSequence: buildChallengeSequence() as unknown as Prisma.InputJsonValue,
      locationVerified: geofence.withinGeofence,
      locationVerifiedAt: geofence.withinGeofence ? new Date() : null,
      latitude: input.latitude,
      longitude: input.longitude,
      accuracyM: input.accuracyMeters,
      distanceM: geofence.distanceMeters,
      expiresAt: new Date(Date.now() + ttlMs),
    },
  });

  if (!geofence.withinGeofence) {
    throw new AppError(
      'OUTSIDE_GEOFENCE',
      'You are too far from the classroom attendance area.',
      403,
      {
        distanceMeters: Math.round(geofence.distanceMeters),
        allowedRadiusMeters: radius,
        verificationId: verification.id,
      },
    );
  }

  return {
    verificationId: verification.id,
    distanceMeters: Math.round(geofence.distanceMeters),
    allowedRadiusMeters: radius,
    challengeSequence: verification.challengeSequence,
    livenessRequired: session.livenessRequired,
    blinkRequired: session.blinkRequired,
    expiresAt: verification.expiresAt,
    faceMatchThreshold: policy.faceMatchThreshold,
  };
}

async function loadActiveVerification(verificationId: string, studentId: string) {
  const v = await prisma.attendanceVerificationSession.findUnique({
    where: { id: verificationId },
  });
  if (!v || v.studentId !== studentId) throw new NotFoundError('Verification attempt not found');
  if (v.status !== 'IN_PROGRESS') {
    throw new AppError(
      'VERIFICATION_SESSION_CLOSED',
      'This verification attempt is no longer active. Please restart.',
      410,
    );
  }
  if (v.expiresAt < new Date()) {
    await prisma.attendanceVerificationSession.update({
      where: { id: v.id },
      data: { status: 'EXPIRED' },
    });
    throw new AppError(
      'VERIFICATION_EXPIRED',
      'Verification timed out. Please restart the attendance process.',
      410,
    );
  }
  if (!v.locationVerified) {
    throw new AppError(
      'LOCATION_NOT_VERIFIED',
      'Location must be verified before continuing.',
      400,
    );
  }
  return v;
}

/** STEP 2: Face detection + recognition against the enrolled profile. */
export async function verifyFaceStep(input: {
  studentId: string;
  verificationId: string;
  image: string;
}) {
  const verification = await loadActiveVerification(input.verificationId, input.studentId);

  const detection = await aiClient.detectFace(input.image);
  if (detection.faceCount === 0) {
    throw new AppError(
      'NO_FACE',
      'No face detected. Please position your face in the camera.',
      400,
    );
  }
  if (detection.faceCount > 1) {
    throw new AppError('MULTIPLE_FACES', 'Only one person should be visible in the camera.', 400);
  }

  const policy = await getPolicy();
  const referenceEmbeddings = await getReferenceEmbeddings(input.studentId);
  const result = await aiClient.verifyFace(
    input.image,
    referenceEmbeddings,
    policy.faceMatchThreshold,
  );

  await prisma.attendanceVerificationSession.update({
    where: { id: verification.id },
    data: {
      faceVerified: result.match,
      faceVerifiedAt: result.match ? new Date() : null,
      faceScore: result.similarity,
      attempts: { increment: result.match ? 0 : 1 },
    },
  });

  if (!result.match) {
    await enforceAttemptLimit(verification.id, input.studentId);
    throw new AppError(
      'FACE_NOT_RECOGNIZED',
      'Face could not be verified against your enrolled profile.',
      401,
      {
        similarity: result.similarity,
        threshold: result.threshold,
      },
    );
  }

  return { verified: true, similarity: result.similarity, threshold: result.threshold };
}

async function enforceAttemptLimit(verificationId: string, studentId: string) {
  const session = await prisma.attendanceVerificationSession.findUnique({
    where: { id: verificationId },
  });
  const policy = await getPolicy();
  if (session && session.attempts >= policy.maxVerificationAttempts) {
    await prisma.attendanceVerificationSession.update({
      where: { id: verificationId },
      data: { status: 'FAILED' },
    });
    await recordAudit({
      userId: undefined,
      action: 'ATTENDANCE_VERIFICATION_FAILED_MAX_ATTEMPTS',
      entityType: 'AttendanceVerificationSession',
      entityId: verificationId,
      metadata: { studentId },
    });
  }
}

/** STEP 3: Liveness challenge - head movement across a short burst of frames. */
export async function verifyLivenessStep(input: {
  studentId: string;
  verificationId: string;
  frames: string[];
}) {
  const verification = await loadActiveVerification(input.verificationId, input.studentId);
  if (!verification.faceVerified) {
    throw new AppError(
      'FACE_NOT_VERIFIED',
      'Face identity must be verified before the liveness challenge.',
      400,
    );
  }

  const challenge = (verification.challengeSequence as string[]).filter((c) => c !== 'BLINK');
  const result = await aiClient.analyzeLiveness(input.frames, challenge);

  await prisma.attendanceVerificationSession.update({
    where: { id: verification.id },
    data: {
      livenessVerified: result.live,
      livenessVerifiedAt: result.live ? new Date() : null,
      attempts: { increment: result.live ? 0 : 1 },
    },
  });

  if (!result.live) {
    await enforceAttemptLimit(verification.id, input.studentId);
    throw new AppError(
      'LIVENESS_FAILED',
      result.reason || 'Live face verification failed. Please move your face and try again.',
      401,
    );
  }

  return { verified: true };
}

/** STEP 4: Eye-blink detection (OPEN -> CLOSED -> OPEN) during the challenge window. */
export async function verifyBlinkStep(input: {
  studentId: string;
  verificationId: string;
  frames: string[];
}) {
  const verification = await loadActiveVerification(input.verificationId, input.studentId);
  if (!verification.faceVerified) {
    throw new AppError(
      'FACE_NOT_VERIFIED',
      'Face identity must be verified before blink detection.',
      400,
    );
  }

  const result = await aiClient.analyzeBlink(input.frames);

  await prisma.attendanceVerificationSession.update({
    where: { id: verification.id },
    data: {
      blinkVerified: result.blinkDetected,
      blinkVerifiedAt: result.blinkDetected ? new Date() : null,
      attempts: { increment: result.blinkDetected ? 0 : 1 },
    },
  });

  if (!result.blinkDetected) {
    await enforceAttemptLimit(verification.id, input.studentId);
    throw new AppError(
      'BLINK_NOT_DETECTED',
      'Please blink your eyes naturally while looking at the camera.',
      401,
    );
  }

  return { verified: true };
}

/** FINAL STEP: Atomically creates the attendance record once every check has passed. */
export async function markAttendance(input: { studentId: string; verificationId: string }) {
  const verification = await loadActiveVerification(input.verificationId, input.studentId);

  const session = await prisma.attendanceSession.findUnique({
    where: { id: verification.sessionId },
  });
  if (!session) throw new NotFoundError('Session not found');
  if (session.status !== 'ACTIVE' || session.endTime < new Date()) {
    throw new AppError('SESSION_EXPIRED', 'This attendance session has ended.', 410);
  }

  if (!verification.locationVerified)
    throw new AppError('LOCATION_NOT_VERIFIED', 'Location was not verified.', 400);
  if (!verification.faceVerified)
    throw new AppError('FACE_NOT_VERIFIED', 'Face identity was not verified.', 400);
  if (session.livenessRequired && !verification.livenessVerified) {
    throw new AppError('LIVENESS_NOT_VERIFIED', 'Liveness challenge was not completed.', 400);
  }
  if (session.blinkRequired && !verification.blinkVerified) {
    throw new AppError('BLINK_NOT_VERIFIED', 'Blink detection was not completed.', 400);
  }

  try {
    const record = await prisma.$transaction(async (tx) => {
      // Re-check duplicate inside the transaction to close any race window;
      // the DB unique constraint (sessionId, studentId) is the final guard.
      const existing = await tx.attendanceRecord.findUnique({
        where: { sessionId_studentId: { sessionId: session.id, studentId: input.studentId } },
      });
      if (existing) {
        throw new ConflictError('Attendance already recorded.', 'ALREADY_ATTENDED');
      }

      const created = await tx.attendanceRecord.create({
        data: {
          sessionId: session.id,
          studentId: input.studentId,
          status: 'PRESENT',
          faceVerified: true,
          faceScore: verification.faceScore,
          livenessVerified: verification.livenessVerified,
          blinkVerified: verification.blinkVerified,
          locationVerified: true,
          locationAccuracyM: verification.accuracyM,
          distanceFromCenterM: verification.distanceM,
          verificationMetadata: {
            verificationId: verification.id,
            challengeSequence: verification.challengeSequence,
          } as unknown as Prisma.InputJsonValue,
        },
      });

      await tx.attendanceVerificationSession.update({
        where: { id: verification.id },
        data: { status: 'COMPLETED' },
      });

      return created;
    });

    const student = await prisma.student.findUnique({ where: { id: input.studentId } });
    if (student) {
      await createNotification({
        userId: student.userId,
        type: 'ATTENDANCE_SUCCESS',
        title: 'Attendance marked',
        message: 'Your attendance has been recorded successfully.',
        metadata: { sessionId: session.id },
      });
    }

    await recordAudit({
      userId: student?.userId,
      action: 'ATTENDANCE_MARKED',
      entityType: 'AttendanceRecord',
      entityId: record.id,
      metadata: { sessionId: session.id, studentId: input.studentId },
    });

    return record;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError('Attendance already recorded.', 'ALREADY_ATTENDED');
    }
    throw err;
  }
}
