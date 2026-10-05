import { Router } from 'express';
import * as attendanceController from '../controllers/attendanceController';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  startSessionSchema,
  locationCheckSchema,
  faceVerifySchema,
  livenessSchema,
  blinkSchema,
  markAttendanceSchema,
  correctionSchema,
} from '../validators/attendanceValidators';
import { attendanceRateLimiter } from '../middleware/rateLimit';

const router = Router();
router.use(authenticate);

// Teacher session management
router.post(
  '/sessions',
  authorize('TEACHER'),
  validate({ body: startSessionSchema }),
  attendanceController.startSession,
);
router.post('/sessions/:id/stop', authorize('TEACHER'), attendanceController.stopSession);
router.get('/sessions', authorize('STUDENT'), attendanceController.listActiveSessionsForStudent);
router.get('/sessions/teacher', authorize('TEACHER'), attendanceController.listTeacherSessions);
router.get('/sessions/:id/live', authorize('TEACHER'), attendanceController.sessionLiveAttendance);
router.post(
  '/correct',
  authorize('TEACHER'),
  validate({ body: correctionSchema }),
  attendanceController.correctAttendance,
);

// Student verification pipeline
router.post(
  '/location-check',
  authorize('STUDENT'),
  attendanceRateLimiter,
  validate({ body: locationCheckSchema }),
  attendanceController.locationCheck,
);
router.post(
  '/face/verify',
  authorize('STUDENT'),
  attendanceRateLimiter,
  validate({ body: faceVerifySchema }),
  attendanceController.faceVerify,
);
router.post(
  '/liveness',
  authorize('STUDENT'),
  attendanceRateLimiter,
  validate({ body: livenessSchema }),
  attendanceController.livenessCheck,
);
router.post(
  '/blink',
  authorize('STUDENT'),
  attendanceRateLimiter,
  validate({ body: blinkSchema }),
  attendanceController.blinkCheck,
);
router.post(
  '/mark',
  authorize('STUDENT'),
  attendanceRateLimiter,
  validate({ body: markAttendanceSchema }),
  attendanceController.markAttendance,
);

export default router;
