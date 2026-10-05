import { Router } from 'express';
import * as faceController from '../controllers/faceController';
import * as attendanceController from '../controllers/attendanceController';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { faceEnrollSchema, faceVerifySchema } from '../validators/attendanceValidators';
import { attendanceRateLimiter } from '../middleware/rateLimit';

const router = Router();

router.use(authenticate);
router.post(
  '/enroll',
  authorize('STUDENT'),
  attendanceRateLimiter,
  validate({ body: faceEnrollSchema }),
  faceController.enroll,
);
router.get('/status', authorize('STUDENT'), faceController.status);
router.post('/reset/:studentId', authorize('ADMIN'), faceController.resetProfile);

// Alias of /api/attendance/face/verify kept here to match the documented
// `/api/face/verify` endpoint shape - operates on an active verification
// attempt created by /api/attendance/location-check.
router.post(
  '/verify',
  authorize('STUDENT'),
  attendanceRateLimiter,
  validate({ body: faceVerifySchema }),
  attendanceController.faceVerify,
);

export default router;
