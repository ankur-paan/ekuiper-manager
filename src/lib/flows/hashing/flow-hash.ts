import { createHash } from 'node:crypto';

import type { FlowLayout, FlowSpec } from '../model/flow-document';

import { canonicalJson } from './canonical-json';

function sha256Hex(canonical: string): string {
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
