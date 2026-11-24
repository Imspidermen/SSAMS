import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    error: { code: 'ROUTE_NOT_FOUND', message: `No route for ${req.method} ${req.path}` },
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const parserError = err as { type?: string };
  if (parserError?.type === 'entity.parse.failed') {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_JSON', message: 'Request body contains invalid JSON.' },
    });
    return;
  }

  if (parserError?.type === 'entity.too.large') {
    res.status(413).json({
      success: false,
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body exceeds the allowed size.' },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(422).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: err.flatten(),
      },
    });
    return;
  }

  // Convert expected database constraint failures into stable client errors.
  // Without this, invalid but well-formed foreign keys leak Prisma internals
  // through a development 500 response and look like an application outage.
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const databaseErrors: Record<string, { status: number; code: string; message: string }> = {
      P2000: {
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'One or more values exceed the allowed length.',
      },
      P2002: {
        status: 409,
        code: 'DUPLICATE_RESOURCE',
        message: 'A record with these values already exists.',
      },
      P2003: {
        status: 422,
        code: 'INVALID_REFERENCE',
        message: 'A referenced record does not exist.',
      },
      P2011: {
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'A required field is missing.',
      },
      P2025: {
        status: 404,
        code: 'NOT_FOUND',
        message: 'The requested record was not found.',
      },
    };
    const mapped = databaseErrors[err.code];
    if (mapped) {
      res.status(mapped.status).json({
        success: false,
        error: { code: mapped.code, message: mapped.message },
      });
      return;
    }
  }

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, path: req.path }, 'Application error');
    }
    res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  logger.error({ err, path: req.path }, 'Unhandled error');

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred. Please try again later.',
    },
  });
}
