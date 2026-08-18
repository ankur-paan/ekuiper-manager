import { ApiError } from '@/lib/api';

const SECRET_KEY = /password|passwd|token|authorization|secret|credential|private.?key/i;

export function parseEKuiperJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(
      502,
      'eKuiper returned an invalid JSON response',
      'INVALID_UPSTREAM_RESPONSE',
    );
  }
}

export function parseEKuiperJsonObject(text: string): Record<string, unknown> {
  const value = parseEKuiperJson(text);
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(
      502,
      'eKuiper returned an unexpected response',
      'INVALID_UPSTREAM_RESPONSE',
    );
  }
  return value as Record<string, unknown>;
}

export function isSensitiveEKuiperPath(path: string): boolean {
  return (
    /^connections(?:\/|$)/.test(path) ||
    /^metadata\/(?:sources|sinks|connections)\/yaml\//.test(path) ||
    path === 'metadata/resource'
  );
}

export function redactEKuiperSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactEKuiperSecrets);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        SECRET_KEY.test(key) ? '[redacted]' : redactEKuiperSecrets(item),
      ]),
    );
  }
  return value;
}
