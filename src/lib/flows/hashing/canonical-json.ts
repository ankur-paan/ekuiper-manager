/**
 * Deterministic JSON serialization for JSON-compatible values.
 *
 * Rules:
 * - object keys are sorted lexicographically (UTF-16 code-unit order);
 * - arrays preserve element order;
 * - primitives follow `JSON.stringify` semantics;
 * - nesting is canonicalized recursively.
 *
 * Unsupported values (undefined, function, symbol, bigint, non-plain
 * objects such as Date/Map/Set, and cyclic input) are rejected with an
 * internal error instead of being silently coerced, so hash inputs can
 * never collide through lossy serialization.
 *
 * Plain objects only: prototype must be `Object.prototype` or `null`.
 * `toJSON` methods are intentionally ignored so output depends only on
 * own enumerable properties.
 */
export function canonicalJson(value: unknown): string {
  return serializeValue(value, []);
}

function serializeValue(value: unknown, stack: object[]): string {
  if (value === null) {
    return 'null';
  }

  // NOTE (FS-0157): this intentionally uses an if/else chain instead of
  // `switch (typeof value)` with `case 'object': break`. That construct was
  // miscompiled by the production minifier (SWC): `case 'object': { break; }`
  // caused everything after the switch (array/object canonicalization) to be
  // dropped from the bundle, so `canonicalJson` returned `undefined` for any
  // object in production while working in dev. Do not reintroduce a
  // switch-break-to-continue pattern here.
  const valueType = typeof value;
  if (valueType === 'string') {
    return JSON.stringify(value) as string;
  }
  if (valueType === 'number') {
    const serialized = JSON.stringify(value);
    if (typeof serialized !== 'string') {
      throw new Error(
        `canonicalJson: unsupported number value (${String(value)})`,
      );
    }
    return serialized;
  }
  if (valueType === 'boolean') {
    return (value as boolean) ? 'true' : 'false';
  }
  if (valueType !== 'object') {
    throw new Error(
      `canonicalJson: unsupported value of type ${valueType}`,
    );
  }

  const input = value as object;

  if (stack.includes(input)) {
    throw new Error('canonicalJson: cyclic input is not supported');
  }

  if (Array.isArray(input)) {
    stack.push(input);
    try {
      const parts = input.map((item) => serializeValue(item, stack));
      return `[${parts.join(',')}]`;
    } finally {
      stack.pop();
    }
  }

  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(
      'canonicalJson: unsupported object value (only plain JSON-compatible objects are allowed)',
    );
  }

  stack.push(input);
  try {
    const keys = Object.keys(input).sort();
    const parts = keys.map((key) => {
      const entry = (input as Record<string, unknown>)[key];
      return `${JSON.stringify(key)}:${serializeValue(entry, stack)}`;
    });
    return `{${parts.join(',')}}`;
  } finally {
    stack.pop();
  }
}
