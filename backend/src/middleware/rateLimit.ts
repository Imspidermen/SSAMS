import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

function jsonRateLimitResponse(code: string, message: string) {
  return (req: unknown, res: import('express').Response) => {
    res.status(429).json({ success: false, error: { code, message } });
  };
}

export const loginRateLimiter = rateLimit({
  windowMs: env.LOGIN_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
  max: env.LOGIN_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: undefined,
  handler: jsonRateLimitResponse(
    'TOO_MANY_LOGIN_ATTEMPTS',
    'Too many login attempts. Please wait before trying again.',
  ),
  keyGenerator: (req) => `${req.ip}:${(req.body?.email || '').toLowerCase()}`,
});

export const passwordResetRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonRateLimitResponse(
    'TOO_MANY_RESET_ATTEMPTS',
    'Too many password reset attempts. Please wait before trying again.',
  ),
});

export const attendanceRateLimiter = rateLimit({
  windowMs: env.ATTENDANCE_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
  max: env.ATTENDANCE_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonRateLimitResponse(
    'TOO_MANY_ATTEMPTS',
    'Too many verification attempts. Please wait before trying again.',
  ),
  keyGenerator: (req) => `${req.ip}:${req.user?.id ?? 'anon'}`,
});

export const generalApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
