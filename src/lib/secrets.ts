import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { ApiError } from '@/lib/api';

function getKey(): Buffer {
  const value = process.env.MANAGER_SECRET_KEY;
  if (!value) {
    throw new ApiError(
      503,
      'Manager secret key is not configured',
      'SECRET_KEY_NOT_CONFIGURED',
    );
  }
  const key = /^[a-fA-F0-9]{64}$/.test(value)
    ? Buffer.from(value, 'hex')
    : Buffer.from(value, 'base64url');
  if (key.length !== 32) {
    throw new ApiError(503, 'Manager secret key must contain 32 bytes', 'INVALID_SECRET_KEY');
  }
  return key;
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${ciphertext.toString('base64url')}`;
}

export function decryptSecret(envelope: string | null): string | null {
  if (!envelope) return null;
  const [version, ivValue, tagValue, ciphertextValue] = envelope.split('.');
  if (version !== 'v1' || !ivValue || !tagValue || !ciphertextValue) {
    throw new ApiError(500, 'Stored credential cannot be read', 'INVALID_SECRET_ENVELOPE');
  }
  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      getKey(),
      Buffer.from(ivValue, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextValue, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    throw new ApiError(500, 'Stored credential cannot be read', 'CREDENTIAL_DECRYPTION_FAILED');
  }
}
