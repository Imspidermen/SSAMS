import { Router } from 'express';
import * as teacherController from '../controllers/teacherController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate, authorize('TEACHER'));
router.get('/dashboard', teacherController.dashboard);
router.get('/subjects', teacherController.subjects);
router.get('/classrooms', teacherController.classrooms);

export default router;
