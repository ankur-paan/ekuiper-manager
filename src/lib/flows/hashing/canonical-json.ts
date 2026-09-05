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

  switch (typeof value) {
    case 'string': {
      return JSON.stringify(value) as string;
    }
    case 'number': {
      const serialized = JSON.stringify(value);
      if (typeof serialized !== 'string') {
        throw new Error(
          `canonicalJson: unsupported number value (${String(value)})`,
        );
      }
      return serialized;
    }
    case 'boolean': {
      return value ? 'true' : 'false';
    }
    case 'undefined':
    case 'function':
    case 'symbol':
    case 'bigint': {
      throw new Error(
        `canonicalJson: unsupported value of type ${typeof value}`,
      );
    }
    case 'object': {
      break;
    }
    default: {
      throw new Error(
        `canonicalJson: unsupported value of type ${typeof value}`,
      );
    }
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
