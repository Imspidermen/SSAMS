import { Router } from 'express';
import authRoutes from './authRoutes';
import studentRoutes from './studentRoutes';
import teacherRoutes from './teacherRoutes';
import adminRoutes from './adminRoutes';
import faceRoutes from './faceRoutes';
import attendanceRoutes from './attendanceRoutes';
import notificationRoutes from './notificationRoutes';
import reportRoutes from './reportRoutes';
import { aiClient } from '../services/aiClient';
import { prisma } from '../db/prisma';

const router = Router();

router.get('/health', async (_req, res) => {
  let dbOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    dbOk = false;
  }
  const aiOk = await aiClient.health();
  res.json({
    status: 'ok',
    dependencies: { database: dbOk ? 'ok' : 'down', aiService: aiOk ? 'ok' : 'down' },
  });
});

router.use('/auth', authRoutes);
router.use('/students', studentRoutes);
router.use('/teacher', teacherRoutes);
router.use('/admin', adminRoutes);
router.use('/face', faceRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/notifications', notificationRoutes);
router.use('/reports', reportRoutes);

export default router;
