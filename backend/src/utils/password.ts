import argon2 from 'argon2';

/**
 * Password hashing using Argon2id (memory-hard, resistant to GPU attacks).
 * Chosen because it has a pure-JS-free but cross-platform native binding
 * (`argon2` npm package ships prebuilt binaries for Windows/Linux/macOS -
 * no system package manager / CUDA / Linux-only dependency required).
 */
export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

const PASSWORD_MIN_LENGTH = 8;

export function isPasswordStrongEnough(password: string): boolean {
  if (password.length < PASSWORD_MIN_LENGTH) return false;
  const hasLetter = /[A-Za-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  return hasLetter && hasNumber;
}
