import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, isPasswordStrongEnough } from '../src/utils/password';

describe('password hashing (argon2id)', () => {
  it('hashes and verifies a correct password', async () => {
    const hash = await hashPassword('CorrectHorse123');
    expect(hash).not.toBe('CorrectHorse123');
    expect(await verifyPassword(hash, 'CorrectHorse123')).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('CorrectHorse123');
    expect(await verifyPassword(hash, 'WrongPassword')).toBe(false);
  });

  it('never stores the password in plaintext form', async () => {
    const hash = await hashPassword('PlainTextPassword1');
    expect(hash.includes('PlainTextPassword1')).toBe(false);
    expect(hash.startsWith('$argon2id$')).toBe(true);
  });
});

describe('isPasswordStrongEnough', () => {
  it('rejects short passwords', () => {
    expect(isPasswordStrongEnough('abc123')).toBe(false);
  });
  it('rejects passwords without numbers', () => {
    expect(isPasswordStrongEnough('abcdefgh')).toBe(false);
  });
  it('accepts a reasonably strong password', () => {
    expect(isPasswordStrongEnough('abcdef12')).toBe(true);
  });
});
