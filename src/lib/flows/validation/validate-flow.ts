import type { TargetCapabilityProfile } from '../capabilities/types';
import type { FlowDiagnostic } from '../model/diagnostic';
import type { FlowDocument } from '../model/flow-document';
import type { NodeRegistry } from '../registry/node-registry';
import { validateFlowDocumentShape } from './document-shape';
import { validateFlowForEditor } from './editor-validation';

/**
 * Server-side Flow validation result (FS-0081).
 *
 * Matches the DATA_API_DEPLOYMENT_SPEC validation response shape:
 * user-correctable flow errors yield `{ valid: false, diagnostics }` over
 * HTTP success, never an HTTP error. Only malformed requests, auth
 * failures, missing flow/draft rows, or internal failures become HTTP
 * errors (handled by the route, not here).
 */
export interface FlowValidationResult {
  valid: boolean;
  diagnostics: FlowDiagnostic[];
}

export interface ValidateFlowServerSideInput {
  /**
   * Candidate document. Typed as unknown because the server rebuilds it
   * from separately stored spec/layout rows; shape validation gates
   * everything else.
   */
  document: unknown;
  registry: NodeRegistry;
  capabilityProfile: TargetCapabilityProfile;
}

/**
 * Authoritative server-side Flow validation (FS-0081, validation stages
 * 1-5 of ARCHITECTURE_CONTRACT).
 *
 * Stage order:
 * 1. document shape (`validateFlowDocumentShape`); when the envelope is
 *    malformed no later stage runs, since later validators assume a
 *    well-shaped FlowDocument;
 * 2. structural, registry, property, join, and capability validation via
 *    the shared `validateFlowForEditor` pipeline, so server verdicts agree
 *    with client diagnostics for the same document + registry + profile.
 *
 * `valid` is true only when no error-severity diagnostic exists; warnings
 * alone do not invalidate. Never calls eKuiper official rule validation
 * (a later deployment ticket owns that). Pure read: never throws for
 * JSON-compatible input and never mutates its inputs or the registry.
 */
export function validateFlowServerSide(
  input: ValidateFlowServerSideInput,
): FlowValidationResult {
  const shapeDiagnostics = validateFlowDocumentShape(input.document);
  if (shapeDiagnostics.length > 0) {
    return { valid: false, diagnostics: shapeDiagnostics };
  }
  const diagnostics = validateFlowForEditor(
    input.document as FlowDocument,
    input.registry,
    input.capabilityProfile,
  );
  const valid = diagnostics.every(
    (diagnostic) => diagnostic.severity !== 'error',
  );
  return { valid, diagnostics };
}
