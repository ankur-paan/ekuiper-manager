import { randomUUID } from 'node:crypto';
import { query } from '@/lib/db';

const SECRET_KEY = /password|token|authorization|secret|credential/i;

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        SECRET_KEY.test(key) ? '[redacted]' : redact(item),
      ]),
    );
  }
  return value;
}

export async function recordAudit(event: {
  actorId?: string;
  nodeId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  success: boolean;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await query(
    `INSERT INTO audit_events
       (id, actor_id, node_id, action, resource_type, resource_id, success, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
    [
      randomUUID(),
      event.actorId ?? null,
      event.nodeId ?? null,
      event.action,
      event.resourceType,
      event.resourceId ?? null,
      event.success,
      JSON.stringify(redact(event.metadata ?? {})),
    ],
  );
}

export function recordAuditSafely(event: Parameters<typeof recordAudit>[0]): void {
  void recordAudit(event).catch((error) => console.error('Failed to record audit event', error));
}
