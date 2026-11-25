import { beforeEach, describe, expect, it, vi } from 'vitest';
import express, { type ErrorRequestHandler } from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import jwt from 'jsonwebtoken';

vi.mock('../src/config/env', () => ({
  env: { JWT_ACCESS_SECRET: 'synthetic-test-signing-key', JWT_ACCESS_EXPIRES_IN: '15m' },
}));
vi.mock('../src/db/prisma', () => ({
  prisma: {
    attendanceVerificationSession: { findUnique: vi.fn(), update: vi.fn() },
  },
}));
vi.mock('../src/services/aiClient', () => ({ aiClient: { analyzeLiveness: vi.fn() } }));
vi.mock('../src/services/faceService', () => ({ getReferenceEmbeddings: vi.fn() }));
vi.mock('../src/services/adminService', () => ({ getPolicy: vi.fn() }));
vi.mock('../src/services/auditService', () => ({ recordAudit: vi.fn() }));
vi.mock('../src/services/notificationService', () => ({ createNotification: vi.fn() }));

import { authenticate, csrfProtection } from '../src/middleware/auth';
import { verifyLivenessStep } from '../src/services/attendanceVerificationService';
import { prisma } from '../src/db/prisma';
import { aiClient } from '../src/services/aiClient';
import { getPolicy } from '../src/services/adminService';
import { signAccessToken } from '../src/utils/tokens';
import { AppError } from '../src/utils/errors';

// Focused HTTP harness: real middleware in production order and real liveness
// service, with database and AI I/O stubbed. No server logs or real biometrics.
function harness() {
  const app = express();
  const refresh = vi.fn();
  app.use(express.json(), cookieParser(), csrfProtection);
  app.post('/api/attendance/liveness', authenticate, (req, res, next) => {
    verifyLivenessStep({ studentId: req.user!.id, ...req.body })
      .then((data) => res.json({ success: true, data }))
      .catch(next);
  });
  app.post('/api/auth/refresh', (_req, res) => {
    refresh();
    res.json({ success: true });
  });
  const errors: ErrorRequestHandler = (err: AppError, _req, res, _next) => {
    res.status(err.statusCode).json({ success: false, error: { code: err.code } });
  };
  app.use(errors);
  return { app, refresh };
}

const payload = { sub: 'student', role: 'STUDENT' as const, email: 'student@example.test' };
const syntheticFrames = ['synthetic-frame'];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.attendanceVerificationSession.findUnique).mockResolvedValue({
    id: 'attempt', studentId: 'student', status: 'IN_PROGRESS',
    locationVerified: true, faceVerified: true, attempts: 1,
    challengeSequence: ['TURN_LEFT', 'TURN_RIGHT', 'BLINK'],
    expiresAt: new Date(Date.now() + 60_000),
  } as never);
  vi.mocked(getPolicy).mockResolvedValue({ maxVerificationAttempts: 3 } as never);
});

describe('attendance 401 versus authentication 401', () => {
  it('reproduces AI success with live=false -> LIVENESS_FAILED, then headerless refresh -> CSRF_INVALID', async () => {
    const { app, refresh } = harness();
    const access = signAccessToken(payload);
    const cookies = [`access_token=${access}`, 'csrf_token=synthetic-csrf', 'refresh_token=synthetic-refresh'];
    vi.mocked(aiClient.analyzeLiveness).mockResolvedValue({ live: false, reason: 'Challenge rejected' } as never);

    const result = await request(app).post('/api/attendance/liveness')
      .set('Cookie', cookies).set('Authorization', `Bearer ${access}`)
      .send({ verificationId: 'attempt', frames: syntheticFrames });
    expect(result.status).toBe(401);
    expect(result.body.error.code).toBe('LIVENESS_FAILED');
    expect(vi.mocked(aiClient.analyzeLiveness).mock.calls.length).toBe(1);
    // Liveness rejection is still recorded; no attendance requirement is bypassed.
    const update = vi.mocked(prisma.attendanceVerificationSession.update).mock.calls[0][0];
    expect(update.data).toMatchObject({ livenessVerified: false, attempts: { increment: 1 } });

    const rejectedRefresh = await request(app).post('/api/auth/refresh').set('Cookie', cookies).send({});
    expect(rejectedRefresh.status).toBe(403);
    expect(rejectedRefresh.body.error.code).toBe('CSRF_INVALID');
    expect(refresh.mock.calls.length).toBe(0);

    const validRefresh = await request(app).post('/api/auth/refresh')
      .set('Cookie', cookies).set('X-CSRF-Token', 'synthetic-csrf').send({});
    expect(validRefresh.status).toBe(200);
    expect(refresh.mock.calls.length).toBe(1);
  });

  it('rejects a mismatched CSRF header before the refresh handler', async () => {
    const { app, refresh } = harness();
    const result = await request(app).post('/api/auth/refresh')
      .set('Cookie', [`access_token=${signAccessToken(payload)}`, 'csrf_token=synthetic-csrf'])
      .set('X-CSRF-Token', 'different-synthetic-csrf').send({});
    expect(result.status).toBe(403);
    expect(result.body.error.code).toBe('CSRF_INVALID');
    expect(refresh.mock.calls.length).toBe(0);
  });

  it('rejects an expired access token before calling the AI service', async () => {
    const { app } = harness();
    const expired = jwt.sign(payload, 'synthetic-test-signing-key', { expiresIn: -1 });
    const result = await request(app).post('/api/attendance/liveness')
      .set('Authorization', `Bearer ${expired}`)
      .send({ verificationId: 'attempt', frames: syntheticFrames });
    expect(result.status).toBe(401);
    expect(result.body.error.code).toBe('TOKEN_INVALID');
    expect(vi.mocked(aiClient.analyzeLiveness).mock.calls.length).toBe(0);
  });

  it('distinguishes missing access credentials from a biometric failure', async () => {
    const { app } = harness();
    const result = await request(app).post('/api/attendance/liveness')
      .send({ verificationId: 'attempt', frames: syntheticFrames });
    expect(result.status).toBe(401);
    expect(result.body.error.code).toBe('UNAUTHORIZED');
    expect(vi.mocked(aiClient.analyzeLiveness).mock.calls.length).toBe(0);
  });
});
