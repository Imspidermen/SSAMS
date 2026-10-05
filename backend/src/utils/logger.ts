import pino from 'pino';
import { env } from '../config/env';

/**
 * Structured logger. In development it prints human-readable logs; in
 * production it emits structured JSON suitable for log aggregation.
 * NEVER log passwords, tokens, or biometric data (face embeddings/images).
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  transport:
    env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
      : undefined,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      'passwordHash',
      '*.password',
      '*.passwordHash',
      '*.embedding',
      '*.vector',
      '*.faceImage',
      '*.frame',
      '*.frames',
    ],
    remove: true,
  },
});
