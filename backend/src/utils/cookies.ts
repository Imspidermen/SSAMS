import { Response } from 'express';
import { env } from '../config/env';

interface AuthCookiesInput {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
  accessTokenMaxAgeMs: number;
  refreshTokenMaxAgeMs: number;
}

const baseCookieOptions = {
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: 'lax' as const,
  path: '/',
};

export function setAuthCookies(res: Response, input: AuthCookiesInput): void {
  res.cookie('access_token', input.accessToken, {
    ...baseCookieOptions,
    maxAge: input.accessTokenMaxAgeMs,
  });
  res.cookie('refresh_token', input.refreshToken, {
    ...baseCookieOptions,
    maxAge: input.refreshTokenMaxAgeMs,
    path: '/api/auth',
  });
  // CSRF token must be readable by JS so it can be echoed back in a header.
  res.cookie('csrf_token', input.csrfToken, {
    httpOnly: false,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    maxAge: input.accessTokenMaxAgeMs,
    path: '/',
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie('access_token', { path: '/' });
  res.clearCookie('refresh_token', { path: '/api/auth' });
  res.clearCookie('csrf_token', { path: '/' });
}
