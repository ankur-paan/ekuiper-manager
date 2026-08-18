import { randomBytes } from 'node:crypto';
import { decryptSecret, encryptSecret } from '@/lib/secrets';

describe('node credential encryption', () => {
  const original = process.env.MANAGER_SECRET_KEY;

  beforeEach(() => {
    process.env.MANAGER_SECRET_KEY = randomBytes(32).toString('base64url');
  });

  afterAll(() => {
    process.env.MANAGER_SECRET_KEY = original;
  });

  it('round-trips a secret through a versioned authenticated envelope', () => {
    const envelope = encryptSecret('raw-jwt-value');
    expect(envelope).toMatch(/^v1\./);
    expect(envelope).not.toContain('raw-jwt-value');
    expect(decryptSecret(envelope)).toBe('raw-jwt-value');
  });

  it('rejects a tampered envelope', () => {
    const envelope = encryptSecret('raw-jwt-value');
    expect(() => decryptSecret(`${envelope}broken`)).toThrow();
  });

  it('returns null for an absent credential', () => {
    expect(decryptSecret(null)).toBeNull();
  });
});
