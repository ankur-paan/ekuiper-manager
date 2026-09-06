import type { TargetCapabilityProfile } from '../capabilities/types';
import type { FlowDiagnostic } from '../model/diagnostic';
import type { FlowDocument } from '../model/flow-document';
import type { NodeRegistry } from '../registry/node-registry';
import { validateFlowCapabilities } from './capability-validation';
import { validateFlowJoinTopology } from './join-validation';
import {
  validateFlowEdgePorts,
  validateFlowSourceSinkPresence,
  validateFlowUnknownNodeTypes,
} from './registry-validation';
import {
  validateFlowPropertyTypes,
  validateFlowRequiredProperties,
} from './property-validation';
import { validateFlowStructure } from './structural';

/**
 * Named editor validation pipeline for v1alpha1 Flow documents (defect R4).
 *
 * Composes the existing client validators in one place instead of spreading
 * the list across the React page, and includes the join topology validator
 * that the editor previously never invoked. Join's `right` port is
 * intentionally kind `any`, so the generic port-compatibility check always
 * accepts a Window `collection` output into it; only
 * `validateFlowJoinTopology` rejects that edge.
 *
 * Stage order mirrors ARCHITECTURE_CONTRACT validation stages:
 * structural (stage 2), node-property (stage 3), port/semantic including
 * join topology (stage 4), then source/sink presence and capability
 * (stage 5).
 *
 * Lives under `src/lib/flows/validation/` (no React import) so later
 * server-side validation (FS-0081) can reuse it. Pure read: calls the
 * existing validators only, never throws for well-typed input, and never
 * mutates its inputs or the registry. Returns every diagnostic in one pass,
 * including document-level diagnostics without nodeId/edgeId scope (cycle,
 * no source, no sink); callers must surface those separately from
 * node-scoped presentation instead of silently discarding them.
 */
export function validateFlowForEditor(
  document: FlowDocument,
  registry: NodeRegistry,
  capabilityProfile: TargetCapabilityProfile,
): FlowDiagnostic[] {
  return [
    ...validateFlowStructure(document),
    ...validateFlowUnknownNodeTypes(document, registry),
    ...validateFlowEdgePorts(document, registry),
    ...validateFlowRequiredProperties(document, registry),
    ...validateFlowPropertyTypes(document, registry),
    ...validateFlowJoinTopology(document, registry),
    ...validateFlowSourceSinkPresence(document, registry),
    ...validateFlowCapabilities(document, registry, capabilityProfile),
  ];
}
