import { Router } from 'express';
import * as studentController from '../controllers/studentController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate, authorize('STUDENT'));
router.get('/me', studentController.me);
router.get('/me/attendance', studentController.myAttendance);
router.get('/me/attendance/history', studentController.myHistory);

export default router;
