import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as authService from '../services/authService';
import { setAuthCookies, clearAuthCookies } from '../utils/cookies';
import { recordAudit } from '../services/auditService';
import { UnauthorizedError } from '../utils/errors';

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  try {
    const result = await authService.login(email, password, req.ip);
    setAuthCookies(res, result);
    await recordAudit({
      userId: result.user.id,
      action: 'LOGIN_SUCCESS',
      entityType: 'User',
      entityId: result.user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.json({
      success: true,
      data: {
        user: result.user,
        accessToken: result.accessToken,
        csrfToken: result.csrfToken,
      },
    });
  } catch (err) {
    await recordAudit({
      action: 'LOGIN_FAILED',
      entityType: 'User',
      metadata: { email },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    throw err;
  }
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.refresh_token || req.body?.refreshToken;
  if (!token) throw new UnauthorizedError('No refresh token provided', 'REFRESH_MISSING');
  const result = await authService.rotateRefreshToken(token, req.ip);
  setAuthCookies(res, result);
  res.json({
    success: true,
    data: { user: result.user, accessToken: result.accessToken, csrfToken: result.csrfToken },
  });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.refresh_token;
  await authService.logout(token);
  clearAuthCookies(res);
  if (req.user) {
    await recordAudit({ userId: req.user.id, action: 'LOGOUT', ipAddress: req.ip });
  }
  res.json({ success: true, data: { message: 'Logged out successfully' } });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: { user: req.user } });
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  await authService.changePassword(req.user!.id, currentPassword, newPassword);
  await recordAudit({ userId: req.user!.id, action: 'PASSWORD_CHANGED', ipAddress: req.ip });
  res.json({ success: true, data: { message: 'Password updated successfully' } });
});
