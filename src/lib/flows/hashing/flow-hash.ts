import { createHash } from 'node:crypto';

import type { FlowLayout, FlowSpec } from '../model/flow-document';

import { canonicalJson } from './canonical-json';

function sha256Hex(canonical: string): string {
  // FS-0157: fail loudly instead of hashing a wrong value. `canonicalJson`
  // must always return a non-empty string; a minifier regression once made it
  // return `undefined` for objects in production builds, and hashing that
  // would either throw a confusing TypeError or, worse, hash the wrong
  // input. Jest cannot execute the production bundle, so this assertion is
  // the executable regression guard for that failure mode.
  if (typeof canonical !== 'string' || canonical.length === 0) {
    throw new Error(
      'flow-hash: refusing to hash empty or non-string canonical JSON (internal error)',
    );
  }
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/**
 * Hash the semantic Flow spec (nodes + edges).
 *
 * Layout/viewport input must never affect this value; moving a node on the
 * canvas keeps the semantic hash stable.
 */
export function hashFlowSemantic(spec: FlowSpec): string {
  return sha256Hex(canonicalJson(spec));
}

/**
 * Hash the visual Flow layout (node coordinates + viewport).
 *
 * Semantic edits (node config, edges) must never affect this value.
 */
export function hashFlowLayout(layout: FlowLayout): string {
  return sha256Hex(canonicalJson(layout));
}
