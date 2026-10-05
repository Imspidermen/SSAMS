import { prisma } from '../db/prisma';
import { hashPassword, verifyPassword } from '../utils/password';
import {
  generateOpaqueToken,
  hashToken,
  signAccessToken,
  generateCsrfToken,
} from '../utils/tokens';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';
import { env } from '../config/env';
import ms from '../utils/ms';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export interface AuthResult {
  user: {
    id: string;
    email: string;
    role: string;
    name: string;
  };
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
  accessTokenMaxAgeMs: number;
  refreshTokenMaxAgeMs: number;
}

async function resolveDisplayName(userId: string, role: string): Promise<string> {
  if (role === 'STUDENT') {
    const s = await prisma.student.findUnique({ where: { userId } });
    return s?.fullName ?? 'Student';
  }
  if (role === 'TEACHER') {
    const t = await prisma.teacher.findUnique({ where: { userId } });
    return t?.fullName ?? 'Teacher';
  }
  const a = await prisma.admin.findUnique({ where: { userId } });
  return a?.fullName ?? 'Administrator';
}

export async function login(email: string, password: string, ip?: string): Promise<AuthResult> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

  if (!user) {
    throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new ForbiddenError(
      `Account temporarily locked due to repeated failed logins. Try again after ${user.lockedUntil.toLocaleTimeString()}.`,
      'ACCOUNT_LOCKED',
    );
  }

  if (!user.isActive) {
    throw new ForbiddenError(
      'Your account has been deactivated. Contact an administrator.',
      'ACCOUNT_INACTIVE',
    );
  }

  const passwordOk = await verifyPassword(user.passwordHash, password);

  if (!passwordOk) {
    const failedCount = user.failedLoginCount + 1;
    const shouldLock = failedCount >= MAX_FAILED_ATTEMPTS;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: shouldLock ? 0 : failedCount,
        lockedUntil: shouldLock
          ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000)
          : user.lockedUntil,
      },
    });
    throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  const accessToken = signAccessToken({ sub: user.id, role: user.role, email: user.email });
  const refreshToken = generateOpaqueToken();
  const csrfToken = generateCsrfToken();

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + ms(env.JWT_REFRESH_EXPIRES_IN)),
      createdByIp: ip,
    },
  });

  const name = await resolveDisplayName(user.id, user.role);

  return {
    user: { id: user.id, email: user.email, role: user.role, name },
    accessToken,
    refreshToken,
    csrfToken,
    accessTokenMaxAgeMs: ms(env.JWT_ACCESS_EXPIRES_IN),
    refreshTokenMaxAgeMs: ms(env.JWT_REFRESH_EXPIRES_IN),
  };
}

export async function rotateRefreshToken(oldToken: string, ip?: string): Promise<AuthResult> {
  const tokenHash = hashToken(oldToken);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw new UnauthorizedError('Session expired. Please log in again.', 'REFRESH_INVALID');
  }

  const user = await prisma.user.findUnique({ where: { id: stored.userId } });
  if (!user || !user.isActive) {
    throw new UnauthorizedError('Account unavailable. Please log in again.', 'REFRESH_INVALID');
  }

  const newRefreshToken = generateOpaqueToken();
  const newAccessToken = signAccessToken({ sub: user.id, role: user.role, email: user.email });
  const csrfToken = generateCsrfToken();

  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date(), replacedByToken: hashToken(newRefreshToken) },
    }),
    prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(newRefreshToken),
        expiresAt: new Date(Date.now() + ms(env.JWT_REFRESH_EXPIRES_IN)),
        createdByIp: ip,
      },
    }),
  ]);

  const name = await resolveDisplayName(user.id, user.role);

  return {
    user: { id: user.id, email: user.email, role: user.role, name },
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    csrfToken,
    accessTokenMaxAgeMs: ms(env.JWT_ACCESS_EXPIRES_IN),
    refreshTokenMaxAgeMs: ms(env.JWT_REFRESH_EXPIRES_IN),
  };
}

export async function logout(refreshToken?: string): Promise<void> {
  if (!refreshToken) return;
  const tokenHash = hashToken(refreshToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const ok = await verifyPassword(user.passwordHash, currentPassword);
  if (!ok) {
    throw new UnauthorizedError('Current password is incorrect', 'INVALID_CREDENTIALS');
  }
  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, mustChangePassword: false },
  });
}
