import { z } from 'zod';

export const startSessionSchema = z.object({
  subjectId: z.string().uuid(),
  classroomId: z.string().uuid(),
  semester: z.number().int().min(1).max(12),
  section: z.string().min(1),
  durationMinutes: z.number().int().min(1).max(240).optional(),
  geofenceRadiusM: z.number().int().min(5).max(2000).optional(),
  livenessRequired: z.boolean().optional(),
  blinkRequired: z.boolean().optional(),
});

export const locationCheckSchema = z.object({
  sessionId: z.string().uuid(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyMeters: z.number().positive(),
  timestamp: z.number(),
});

export const faceVerifySchema = z.object({
  verificationId: z.string().uuid(),
  image: z.string().min(100), // base64 data
});

export const livenessSchema = z.object({
  verificationId: z.string().uuid(),
  frames: z.array(z.string().min(100)).min(3).max(40),
});

export const blinkSchema = z.object({
  verificationId: z.string().uuid(),
  frames: z.array(z.string().min(100)).min(3).max(40),
});

export const markAttendanceSchema = z.object({
  verificationId: z.string().uuid(),
});

export const correctionSchema = z.object({
  attendanceId: z.string().uuid(),
  newStatus: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']),
  reason: z.string().min(5, 'A reason of at least 5 characters is required'),
});

export const faceEnrollSchema = z.object({
  images: z.array(z.string().min(100)).min(3).max(10),
});
