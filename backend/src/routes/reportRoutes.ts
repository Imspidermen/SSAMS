import { Router } from 'express';
import * as reportController from '../controllers/reportController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate, authorize('ADMIN', 'TEACHER'));
router.get('/attendance', reportController.attendanceReport);

export default router;
