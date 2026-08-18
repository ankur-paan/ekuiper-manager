const SECRET_FIELD =
  /password|passphrase|passwd|token|authorization|credential|client[_-]?secret|api[_-]?key|access[_-]?key|private[_-]?key/i;

const JSON_SECRET =
  /("(?:password|passphrase|passwd|token|authorization|credential|client[_-]?secret|api[_-]?key|access[_-]?key|private[_-]?key)"\s*:\s*)"(?:\\.|[^"\\])*"/gi;
const ASSIGNMENT_SECRET =
  /((?:password|passphrase|passwd|token|credential|client[_-]?secret|api[_-]?key|access[_-]?key|private[_-]?key)\s*[:=]\s*)([^\s,;}\]]+)/gi;
const AUTHORIZATION_VALUE = /(\bauthorization\s*[:=]\s*)(?:Bearer\s+)?[^\s,;}\]]+/gi;
const BEARER_TOKEN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const URL_CREDENTIAL = /(https?:\/\/[^\s:/]+:)([^@\s/]+)(@)/gi;

export function isSecretField(value: string): boolean {
  return SECRET_FIELD.test(value);
}

export function redactAssistantText(value: string): string {
  return value
    .replace(JSON_SECRET, '$1"[redacted]"')
    .replace(AUTHORIZATION_VALUE, '$1[redacted]')
    .replace(ASSIGNMENT_SECRET, '$1[redacted]')
    .replace(BEARER_TOKEN, 'Bearer [redacted]')
    .replace(URL_CREDENTIAL, '$1[redacted]$3');
}

function redactStructure(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactStructure);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        isSecretField(key) ? '[redacted]' : redactStructure(item),
      ]),
    );
  }
  return typeof value === 'string' ? redactAssistantText(value) : value;
}

export function redactAssistantValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  try {
    return JSON.stringify(redactStructure(JSON.parse(trimmed)));
  } catch {
    return redactAssistantText(trimmed);
  }
}
