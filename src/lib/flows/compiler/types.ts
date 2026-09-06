import type { FlowDiagnostic } from '../model/diagnostic';

/**
 * eKuiper compiler contract (FS-0072).
 *
 * Locked decisions applied here:
 * - Manager is control plane only; compile targets eKuiper Graph Rules.
 * - Flow semantic state and visual layout state are separate: layout is
 *   never sent to eKuiper, so the artifact carries no layout field.
 * - Compiler output must be deterministic for the same Flow document +
 *   target capabilities + extension versions: no randomness, clock reads,
 *   or process state may influence the artifact.
 *
 * Shape source: DATA_API_DEPLOYMENT_SPEC.md section 7 ("Compilation").
 * The exact eKuiper graph JSON placed inside `ruleDefinition` is NOT
 * defined here; it arrives in FS-0073/FS-0074 after verification against
 * the audited `public/ekuiper-openapi.json` (eKuiper 2.4.1) contract.
 * Until then `ruleDefinition` stays an opaque record.
 */

/**
 * Current compiler version. Producers must set
 * `FlowDeploymentArtifact.compilerVersion` to this constant so that a
 * recorded artifact always identifies the compiler that produced it
 * (see ARCHITECTURE_CONTRACT.md section 5: determinism inputs include
 * the compiler version).
 */
export const FLOW_COMPILER_VERSION = 1 as const;

/**
 * Immutable record of what was compiled for deployment to one eKuiper
 * node: the compiled rule definition plus the metadata needed to map it
 * back to the authoring Flow document.
 *
 * - `semanticHash`: canonical hash of the semantic Flow document only
 *   (see `hashFlowSemantic`); layout is excluded by construction.
 * - `ruleId`: deterministic eKuiper-safe rule identifier derived from the
 *   Flow metadata ID (conversion centralized in the later compile ticket).
 * - `ruleDefinition`: opaque compiled eKuiper rule payload. Exact graph
 *   shape is defined by a later ticket; do not place guessed fields here.
 * - `runtimeNodeMap`: Flow node ID -> deterministic runtime operator ID
 *   (see `createRuntimeId`). Used to map runtime status back to Flow nodes.
 *
 * There is intentionally no layout field: visual layout must never reach
 * eKuiper.
 */
export interface FlowDeploymentArtifact {
  compilerVersion: number;
  semanticHash: string;
  ruleId: string;
  ruleDefinition: Record<string, unknown>;
  runtimeNodeMap: Record<string, string>;
}

/**
 * Successful compilation carrying the deployment artifact.
 */
export interface CompileFlowSuccess {
  ok: true;
  artifact: FlowDeploymentArtifact;
  diagnostics: FlowDiagnostic[];
}

/**
 * Failed compilation. No partial artifact is produced; callers must
 * surface `diagnostics` (structured `FlowDiagnostic` entries, never
 * generic thrown strings across the API boundary).
 */
export interface CompileFlowFailure {
  ok: false;
  artifact: undefined;
  diagnostics: FlowDiagnostic[];
}

/**
 * Compile result union: either a deployment artifact or diagnostics.
 */
export type CompileFlowResult = CompileFlowSuccess | CompileFlowFailure;
