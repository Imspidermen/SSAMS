import axios, {
  AxiosError,
  AxiosHeaders,
  type InternalAxiosRequestConfig,
} from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_TIMEOUT_MS, VERIFICATION_TIMEOUT_MS } from '@/config/env';
import { checkLocation, verifyFace, verifyLiveness } from './attendance.service';
import {
  api,
  apiClient,
  clearTokens,
  getAccessToken,
  onSessionExpired,
  setTokens,
} from './api';

// Synthetic transport fixtures only; no camera, biometric data or real credentials.
const originalAdapter = apiClient.defaults.adapter;
const originalGlobalAdapter = axios.defaults.adapter;
const sessionExpired = vi.fn();
let unsubscribe: () => void;

function respond(config: InternalAxiosRequestConfig, status: number, data: unknown) {
  const response = { config, status, statusText: '', headers: new AxiosHeaders(), data };
  if (status >= 400) {
    throw new AxiosError('Request rejected', AxiosError.ERR_BAD_REQUEST, config, undefined, response);
  }
  return response;
}

function reject(config: InternalAxiosRequestConfig, code: string, status = 401) {
  return respond(config, status, { success: false, error: { code, message: 'Request rejected' } });
}

function succeed(config: InternalAxiosRequestConfig, data: unknown = { verified: true }) {
  return respond(config, 200, { success: true, data });
}

function rotated(config: InternalAxiosRequestConfig) {
  document.cookie = 'csrf_token=rotated-csrf; path=/';
  return succeed(config, {
    accessToken: 'rotated-access',
    csrfToken: 'rotated-csrf',
    user: { id: 'student', email: 'student@example.test', role: 'STUDENT', name: 'Student' },
  });
}

beforeEach(() => {
  clearTokens();
  sessionExpired.mockClear();
  unsubscribe = onSessionExpired(sessionExpired);
  document.cookie = 'csrf_token=current-csrf; path=/';
  setTokens({ accessToken: 'initial-access', csrfToken: 'current-csrf' });
});

afterEach(() => {
  unsubscribe();
  clearTokens();
  document.cookie = 'csrf_token=; Max-Age=0; path=/';
  apiClient.defaults.adapter = originalAdapter;
  axios.defaults.adapter = originalGlobalAdapter;
});

describe('live attendance session recovery', () => {
  it.each(['LIVENESS_FAILED', 'FACE_NOT_RECOGNIZED', 'BLINK_NOT_DETECTED'])(
    'preserves the session and does not replay a biometric rejection (%s)',
    async (code) => {
      const refresh = vi.fn(async (config: InternalAxiosRequestConfig) =>
        reject(config, 'CSRF_INVALID', 403),
      );
      axios.defaults.adapter = refresh;
      const calls: string[] = [];
      let rejected = false;
      apiClient.defaults.adapter = async (config) => {
        calls.push(config.url ?? '');
        if (config.url === '/attendance/liveness' && !rejected) {
          rejected = true;
          return reject(config, code);
        }
        return succeed(config);
      };

      await checkLocation({ sessionId: 'session', latitude: 0, longitude: 0, accuracyMeters: 1, timestamp: Date.now() });
      await verifyFace('attempt', 'synthetic-frame');
      await expect(verifyLiveness('attempt', ['synthetic-frame'])).rejects.toMatchObject({ status: 401, code });
      // A student can retry the failed challenge, and authenticated requests still work.
      await verifyLiveness('attempt', ['synthetic-frame']);
      await api.get('/students/me');

      expect(calls).toEqual([
        '/attendance/location-check', '/attendance/face/verify',
        '/attendance/liveness', '/attendance/liveness', '/students/me',
      ]);
      expect(refresh).not.toHaveBeenCalled();
      expect(sessionExpired).not.toHaveBeenCalled();
      expect(getAccessToken() !== null).toBe(true);
    },
  );

  it.each(['TOKEN_INVALID', 'UNAUTHORIZED'])(
    'refreshes an actual auth failure (%s) and replays the captured request once',
    async (code) => {
      // Another tab has rotated cookies; memory must not override the cookie's CSRF value.
      setTokens({ csrfToken: 'stale-csrf' });
      const refresh = vi.fn(async (config: InternalAxiosRequestConfig) => {
        expect(config.withCredentials).toBe(true);
        expect(config.timeout).toBe(API_TIMEOUT_MS);
        expect(config.headers.has('Authorization')).toBe(false);
        if (config.headers.get('X-CSRF-Token') !== 'current-csrf') {
          return reject(config, 'CSRF_INVALID', 403);
        }
        return rotated(config);
      });
      axios.defaults.adapter = refresh;
      const requests: InternalAxiosRequestConfig[] = [];
      apiClient.defaults.adapter = async (config) => {
        requests.push(config);
        if (requests.length === 1) return reject(config, code);
        expect(config.headers.get('Authorization') === 'Bearer rotated-access').toBe(true);
        expect(config.headers.get('X-CSRF-Token') === 'rotated-csrf').toBe(true);
        return succeed(config);
      };

      await expect(verifyLiveness('attempt', ['synthetic-frame'])).resolves.toEqual({ verified: true });
      expect(refresh).toHaveBeenCalledTimes(1);
      expect(requests).toHaveLength(2);
      expect(requests[1].data === requests[0].data).toBe(true);
      expect(requests.every((config) => config.withCredentials && config.timeout === VERIFICATION_TIMEOUT_MS)).toBe(true);
      expect(sessionExpired).not.toHaveBeenCalled();
    },
  );

  it('shares one refresh across overlapping auth failures, including a late old-token response', async () => {
    let finishRefresh!: () => void;
    const refreshGate = new Promise<void>((resolve) => { finishRefresh = resolve; });
    let releaseLate!: () => void;
    const lateGate = new Promise<void>((resolve) => { releaseLate = resolve; });
    const refresh = vi.fn(async (config: InternalAxiosRequestConfig) => {
      await refreshGate;
      return rotated(config);
    });
    axios.defaults.adapter = refresh;
    const attempts = new Map<string, number>();
    apiClient.defaults.adapter = async (config) => {
      const url = config.url ?? '';
      const attempt = (attempts.get(url) ?? 0) + 1;
      attempts.set(url, attempt);
      if (attempt === 1) {
        if (url === '/students/me') await lateGate;
        return reject(config, 'TOKEN_INVALID');
      }
      return succeed(config);
    };

    const first = verifyLiveness('attempt', ['synthetic-frame']);
    const overlapping = api.get('/face/status');
    const late = api.get('/students/me');
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    finishRefresh();
    await Promise.all([first, overlapping]);
    // The original request was sent before rotation but its 401 arrives afterward.
    releaseLate();
    await late;
    expect(refresh).toHaveBeenCalledTimes(1);
    expect([...attempts.values()]).toEqual([2, 2, 2]);
    expect(sessionExpired).not.toHaveBeenCalled();
  });

  it('does not refresh or replay a retried request again if it still returns 401', async () => {
    const refresh = vi.fn(async (config: InternalAxiosRequestConfig) => rotated(config));
    axios.defaults.adapter = refresh;
    const send = vi.fn(async (config: InternalAxiosRequestConfig) => reject(config, 'TOKEN_INVALID'));
    apiClient.defaults.adapter = send;
    await expect(verifyLiveness('attempt', ['synthetic-frame'])).rejects.toMatchObject({ code: 'TOKEN_INVALID' });
    expect(send).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('still terminates a genuinely invalid refresh session without recursion', async () => {
    const refresh = vi.fn(async (config: InternalAxiosRequestConfig) => reject(config, 'REFRESH_INVALID'));
    axios.defaults.adapter = refresh;
    const send = vi.fn(async (config: InternalAxiosRequestConfig) => reject(config, 'TOKEN_INVALID'));
    apiClient.defaults.adapter = send;
    await expect(verifyLiveness('attempt', ['synthetic-frame'])).rejects.toMatchObject({ code: 'TOKEN_INVALID' });
    expect(send).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(sessionExpired).toHaveBeenCalledTimes(1);
    expect(getAccessToken() === null).toBe(true);
  });
});
