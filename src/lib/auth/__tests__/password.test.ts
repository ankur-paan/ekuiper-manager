import {
  generateTemporaryPassword,
  hashPassword,
  validatePassword,
  verifyPassword,
} from '@/lib/auth/password';

describe('password security', () => {
  it('hashes and verifies without retaining plaintext', async () => {
    const password = 'correct horse battery staple';
    const hash = await hashPassword(password);
    expect(hash).toMatch(/^scrypt\$/);
    expect(hash).not.toContain(password);
    await expect(verifyPassword(password, hash)).resolves.toBe(true);
    await expect(verifyPassword('incorrect password', hash)).resolves.toBe(false);
  });

  it('rejects malformed hashes without throwing', async () => {
    await expect(verifyPassword('anything', 'not-a-hash')).resolves.toBe(false);
  });

  it('enforces the documented password length', () => {
    expect(validatePassword('short')).toContain('12');
    expect(validatePassword('a'.repeat(129))).toContain('128');
    expect(validatePassword('twelve-chars!')).toBeNull();
  });

  it('generates a valid one-time password', () => {
    const first = generateTemporaryPassword();
    const second = generateTemporaryPassword();
    expect(validatePassword(first)).toBeNull();
    expect(first).not.toBe(second);
  });
});
