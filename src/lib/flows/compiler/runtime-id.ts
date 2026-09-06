import { createHash } from 'node:crypto';

/**
 * Deterministic eKuiper-safe runtime operator ID helper.
 *
 * Locked decisions applied here:
 * - Stable Flow node IDs are immutable authoring identifiers; runtime
 *   operator IDs are deterministic compiler output mapped back to them.
 * - Compiler output must be deterministic for the same Flow document.
 *
 * Design:
 * - Input is only the Flow node ID plus a caller-supplied kind prefix.
 *   Display renames (`FlowNode.name`) and `FlowNode.config` are never
 *   consulted, so renames cannot change the runtime ID.
 * - The node ID is hashed with SHA-256 and truncated to a 12-hex-char
 *   (48-bit) prefix. Birthday-bound collision probability stays negligible
 *   for realistic flows (e.g. ~1.8e-7 for 10k nodes in one rule), while
 *   keeping generated operator IDs short enough to read in eKuiper output.
 * - No randomness, clock, or process state is used: same input always
 *   yields the same output.
 * - Output charset is conservative ASCII letters/digits/underscore and
 *   always starts with a letter, which is safe for eKuiper operator IDs.
 */
const HASH_PREFIX_LENGTH = 12;

const SAFE_ID_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;

function sanitizeKindPrefix(kind: string): string {
  const sanitized = kind.replace(/[^A-Za-z0-9_]/g, '_');
  if (sanitized.length === 0 || /^[0-9_]/.test(sanitized)) {
    return `n_${sanitized}`;
  }
  return sanitized;
}

/**
 * Derive an eKuiper-safe runtime operator ID from a Flow node ID.
 *
 * @param kind - caller-supplied kind prefix (e.g. node type short name).
 *   Unsafe characters are replaced with `_`.
 * @param flowNodeId - stable authoring Flow node ID (never a display name).
 */
export function createRuntimeId(kind: string, flowNodeId: string): string {
  if (kind.length === 0) {
    throw new Error('createRuntimeId: kind prefix must not be empty');
  }
  if (flowNodeId.length === 0) {
    throw new Error('createRuntimeId: flow node ID must not be empty');
  }
  const prefix = sanitizeKindPrefix(kind);
  const digest = createHash('sha256')
    .update(flowNodeId, 'utf8')
    .digest('hex')
    .slice(0, HASH_PREFIX_LENGTH);
  return `${prefix}_${digest}`;
}

/**
 * Safe-charset pattern for runtime IDs produced by {@link createRuntimeId}.
 */
export function isSafeRuntimeId(value: string): boolean {
  return SAFE_ID_PATTERN.test(value);
}
