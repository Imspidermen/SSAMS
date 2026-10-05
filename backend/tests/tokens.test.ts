import { describe, it, expect } from 'vitest';
import ms from '../src/utils/ms';
import { generateOpaqueToken, hashToken, generateCsrfToken } from '../src/utils/tokens';

describe('ms duration parser', () => {
  it('parses minutes', () => expect(ms('15m')).toBe(15 * 60_000));
  it('parses days', () => expect(ms('7d')).toBe(7 * 86_400_000));
  it('parses seconds', () => expect(ms('30s')).toBe(30_000));
  it('throws on invalid input', () => expect(() => ms('bogus')).toThrow());
});

describe('token generation', () => {
  it('generates high-entropy unique opaque tokens', () => {
    const a = generateOpaqueToken();
    const b = generateOpaqueToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(64);
  });

  it('hashes tokens deterministically (for DB lookup) but irreversibly', () => {
    const token = generateOpaqueToken();
    const h1 = hashToken(token);
    const h2 = hashToken(token);
    expect(h1).toBe(h2);
    expect(h1).not.toBe(token);
  });

  it('generates distinct CSRF tokens', () => {
    expect(generateCsrfToken()).not.toBe(generateCsrfToken());
  });
});
