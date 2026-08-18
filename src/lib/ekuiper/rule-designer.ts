import type { MetadataProperty, Rule, Sink } from './types';

export type JsonObject = Record<string, unknown>;

export type SinkFieldKind = 'string' | 'secret' | 'number' | 'boolean' | 'string-list' | 'json';

export interface SinkFieldDefinition {
  key: string;
  label: string;
  kind: SinkFieldKind;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  hint?: string;
}

export interface ActionDraft {
  key: string;
  type: string;
  config: JsonObject;
  outer: JsonObject;
}

export interface QueryDraft {
  fields: string;
  source: string;
  where: string;
  groupBy: string;
  having: string;
  orderBy: string;
  limit: string;
}

const SECRET_KEY = /(password|passwd|secret|token|private.?key|client.?secret|certification)/i;

const COMMON_ACTION_KEYS = new Set([
  'sendSingle',
  'dataTemplate',
  'concurrency',
  'bufferLength',
  'retryInterval',
  'retryCount',
  'cacheLength',
  'cacheSaveInterval',
  'omitIfEmpty',
]);

const COMMON_FIELDS: SinkFieldDefinition[] = [
  { key: 'sendSingle', label: 'Send each row separately', kind: 'boolean', hint: 'Emit one sink message per result row.' },
  { key: 'omitIfEmpty', label: 'Omit empty results', kind: 'boolean' },
  { key: 'dataTemplate', label: 'Data template', kind: 'string', placeholder: '{{json .}}' },
];

export const BUILTIN_SINKS: Array<{ type: string; label: string; description: string }> = [
  { type: 'log', label: 'Log', description: 'Write result rows to the eKuiper log.' },
  { type: 'nop', label: 'No-op', description: 'Discard output; useful for testing processing cost.' },
  { type: 'mqtt', label: 'MQTT', description: 'Publish results to an MQTT topic or shared connection.' },
  { type: 'rest', label: 'HTTP', description: 'Send results to an HTTP endpoint.' },
  { type: 'memory', label: 'Memory', description: 'Publish results to an in-memory topic.' },
  { type: 'file', label: 'File', description: 'Write results to a file managed by eKuiper.' },
  { type: 'sql', label: 'SQL', description: 'Insert results into a SQL table.' },
  { type: 'edgex', label: 'EdgeX', description: 'Publish results to an installed EdgeX sink.' },
];

const KNOWN_FIELDS: Record<string, SinkFieldDefinition[]> = {
  log: [],
  nop: [{ key: 'log', label: 'Log discarded rows', kind: 'boolean' }],
  mqtt: [
    { key: 'connectionSelector', label: 'Shared connection', kind: 'string', placeholder: 'connection id' },
    { key: 'server', label: 'Broker URL', kind: 'string', placeholder: 'tcp://broker:1883' },
    { key: 'topic', label: 'Topic', kind: 'string', required: true, placeholder: 'factory/alerts' },
    { key: 'clientId', label: 'Client ID', kind: 'string' },
    { key: 'username', label: 'Username', kind: 'string' },
    { key: 'password', label: 'Password', kind: 'secret' },
    { key: 'qos', label: 'QoS', kind: 'number', options: ['0', '1', '2'] },
    { key: 'retained', label: 'Retain message', kind: 'boolean' },
    { key: 'insecureSkipVerify', label: 'Skip TLS verification', kind: 'boolean' },
    { key: 'certificationPath', label: 'CA certificate path', kind: 'string' },
    { key: 'privateKeyPath', label: 'Private key path', kind: 'secret' },
  ],
  rest: [
    { key: 'url', label: 'URL', kind: 'string', required: true, placeholder: 'https://example.test/events' },
    { key: 'method', label: 'Method', kind: 'string', options: ['POST', 'PUT', 'PATCH', 'GET', 'DELETE'] },
    { key: 'bodyType', label: 'Body type', kind: 'string', options: ['json', 'text', 'form'] },
    { key: 'headers', label: 'Headers', kind: 'json', placeholder: '{"Authorization":"..."}' },
    { key: 'timeout', label: 'Timeout (ms)', kind: 'number' },
    { key: 'insecureSkipVerify', label: 'Skip TLS verification', kind: 'boolean' },
  ],
  memory: [
    { key: 'topic', label: 'Topic', kind: 'string', required: true },
    { key: 'keyField', label: 'Key field', kind: 'string' },
  ],
  file: [
    { key: 'path', label: 'Path', kind: 'string', required: true },
    { key: 'fileType', label: 'File type', kind: 'string', options: ['json', 'csv', 'lines'] },
    { key: 'delimiter', label: 'Delimiter', kind: 'string' },
    { key: 'hasHeader', label: 'Write header', kind: 'boolean' },
  ],
  sql: [
    { key: 'dburl', label: 'Database URL', kind: 'secret', required: true, placeholder: 'connection string or DSN' },
    { key: 'table', label: 'Table', kind: 'string', required: true },
    { key: 'fields', label: 'Fields', kind: 'string-list', hint: 'One field per line or comma-separated.' },
    { key: 'sendSingle', label: 'Insert rows separately', kind: 'boolean' },
  ],
  edgex: [
    { key: 'connectionSelector', label: 'Shared connection', kind: 'string' },
    { key: 'protocol', label: 'Protocol', kind: 'string' },
    { key: 'host', label: 'Host', kind: 'string' },
    { key: 'port', label: 'Port', kind: 'number' },
    { key: 'topic', label: 'Topic', kind: 'string' },
    { key: 'topicPrefix', label: 'Topic prefix', kind: 'string' },
    { key: 'contentType', label: 'Content type', kind: 'string' },
    { key: 'messageType', label: 'Message type', kind: 'string' },
    { key: 'metadata', label: 'Metadata', kind: 'json' },
    { key: 'profileName', label: 'Profile name', kind: 'string' },
    { key: 'deviceName', label: 'Device name', kind: 'string' },
    { key: 'sourceName', label: 'Source name', kind: 'string' },
  ],
};

function humanize(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, (letter) => letter.toUpperCase());
}

function metadataKind(property: MetadataProperty): SinkFieldKind {
  if (SECRET_KEY.test(property.name)) return 'secret';
  const value = `${property.type} ${property.control}`.toLowerCase();
  if (/bool|switch|checkbox/.test(value)) return 'boolean';
  if (/array|list/.test(value)) return 'string-list';
  if (/int|float|number|duration/.test(value)) return 'number';
  if (/json|object|map|keyvalue/.test(value)) return 'json';
  return 'string';
}

export function sinkFields(type: string, metadata: MetadataProperty[] = []): SinkFieldDefinition[] {
  const merged = new Map<string, SinkFieldDefinition>();
  for (const field of [...(KNOWN_FIELDS[type] ?? []), ...COMMON_FIELDS]) merged.set(field.key, field);
  for (const property of metadata) {
    const existing = merged.get(property.name);
    merged.set(property.name, {
      key: property.name,
      label: property.label || existing?.label || humanize(property.name),
      kind: existing?.kind ?? metadataKind(property),
      required: existing?.required ?? !property.optional,
      options: property.values?.map(String) ?? existing?.options,
      hint: property.hint || existing?.hint,
      placeholder: existing?.placeholder,
    });
  }
  return [...merged.values()];
}

export function coerceFieldValue(kind: SinkFieldKind, value: string | boolean): unknown {
  if (kind === 'boolean') return Boolean(value === true || value === 'true');
  const text = String(value);
  if (kind === 'number') {
    if (!text.trim()) return undefined;
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : text;
  }
  if (kind === 'string-list') {
    return text.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
  }
  if (kind === 'json') {
    if (!text.trim()) return undefined;
    return JSON.parse(text) as unknown;
  }
  return text;
}

export function displayFieldValue(kind: SinkFieldKind, value: unknown): string {
  if (value == null) return '';
  if (kind === 'string-list' && Array.isArray(value)) return value.map(String).join('\n');
  if (kind === 'json' && typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

export function decodeActions(actions: Sink[]): ActionDraft[] {
  return actions.map((action, index) => {
    const record = action as unknown as JsonObject;
    const type = Object.keys(record).find((key) => !COMMON_ACTION_KEYS.has(key) && typeof record[key] === 'object')
      ?? Object.keys(record)[0]
      ?? 'log';
    const value = record[type];
    const config = value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as JsonObject) } : {};
    const outer = Object.fromEntries(Object.entries(record).filter(([key]) => key !== type));
    return { key: `action-${index}-${type}`, type, config, outer };
  });
}

export function encodeActions(actions: ActionDraft[]): Sink[] {
  return actions.map(({ type, config, outer }) => ({ ...outer, [type]: config }) as Sink);
}

export function buildSql(query: QueryDraft): string {
  const fields = query.fields.trim() || '*';
  const source = query.source.trim();
  if (!source) return '';
  return [
    `SELECT ${fields} FROM ${source}`,
    query.where.trim() && `WHERE ${query.where.trim()}`,
    query.groupBy.trim() && `GROUP BY ${query.groupBy.trim()}`,
    query.having.trim() && `HAVING ${query.having.trim()}`,
    query.orderBy.trim() && `ORDER BY ${query.orderBy.trim()}`,
    query.limit.trim() && `LIMIT ${query.limit.trim()}`,
  ].filter(Boolean).join(' ');
}

export function parseSimpleSql(sql: string): QueryDraft | null {
  const normalized = sql.trim().replace(/;$/, '');
  const match = normalized.match(/^SELECT\s+([\s\S]+?)\s+FROM\s+([A-Za-z0-9_-]+)(?:\s+WHERE\s+([\s\S]*?))?(?:\s+GROUP\s+BY\s+([\s\S]*?))?(?:\s+HAVING\s+([\s\S]*?))?(?:\s+ORDER\s+BY\s+([\s\S]*?))?(?:\s+LIMIT\s+([^\s]+))?$/i);
  if (!match) return null;
  return {
    fields: match[1]?.trim() || '*',
    source: match[2]?.trim() || '',
    where: match[3]?.trim() || '',
    groupBy: match[4]?.trim() || '',
    having: match[5]?.trim() || '',
    orderBy: match[6]?.trim() || '',
    limit: match[7]?.trim() || '',
  };
}

export function redactSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as JsonObject).map(([key, entry]) => [
    key,
    SECRET_KEY.test(key) && entry !== '' && entry != null ? '••••••••' : redactSensitive(entry),
  ]));
}

export function duplicateRule(source: Rule, id: string): Rule {
  const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
  const rule: Rule = {
    id,
    triggered: false,
    actions: copy(source.actions ?? []),
  };
  if (source.sql != null) rule.sql = source.sql;
  if (source.graph != null) rule.graph = copy(source.graph);
  if (source.options != null) rule.options = copy(source.options);
  if (source.tags != null) rule.tags = [...source.tags];
  if (source.temp != null) rule.temp = source.temp;
  return rule;
}
