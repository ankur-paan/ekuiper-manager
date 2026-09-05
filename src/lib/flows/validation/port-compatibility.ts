import type { FlowPortKind } from '../registry/node-definition';

/**
 * Pure port-kind compatibility check for v1alpha1 Flow edges.
 *
 * Rules:
 * - `any` on either side accepts anything;
 * - equal kinds connect;
 * - `stream` and `collection` never connect to each other;
 * - `table` only connects to `table` or `any`.
 *
 * This helper performs no registry lookup and has no side effects.
 * Window/join inference is intentionally out of scope.
 */
export function canConnect(
  sourceKind: FlowPortKind,
  targetKind: FlowPortKind,
): boolean {
  if (sourceKind === 'any' || targetKind === 'any') {
    return true;
  }
  return sourceKind === targetKind;
}
