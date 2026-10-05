import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  APP_TIMEZONE: z.string().default('Asia/Kolkata'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  FRONTEND_URL: z.string().default('http://localhost:5173'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  AI_SERVICE_URL: z.string().default('http://localhost:8000'),
  AI_SERVICE_TIMEOUT_MS: z.coerce.number().default(8000),

  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be set and non-trivial'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be set and non-trivial'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  COOKIE_SECURE: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  COOKIE_DOMAIN: z.string().optional(),

  ATTENDANCE_DEFAULT_RADIUS: z.coerce.number().default(100),
  MIN_ATTENDANCE_PERCENTAGE: z.coerce.number().default(75),
  FACE_MATCH_THRESHOLD: z.coerce.number().default(0.62),
  VERIFICATION_SESSION_TTL_MINUTES: z.coerce.number().default(5),
  MAX_VERIFICATION_ATTEMPTS: z.coerce.number().default(3),

  LOGIN_RATE_LIMIT_MAX: z.coerce.number().default(8),
  LOGIN_RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().default(15),
  ATTENDANCE_RATE_LIMIT_MAX: z.coerce.number().default(20),
  ATTENDANCE_RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().default(10),

  LOG_LEVEL: z.string().default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration. Check your .env file against .env.example');
}

export const env = parsed.data;
export type Env = typeof env;
