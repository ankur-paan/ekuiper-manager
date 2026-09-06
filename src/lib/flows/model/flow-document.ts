export const FLOW_DOCUMENT_VERSION =
  'flow.ekuiper-manager.io/v1alpha1' as const;

export interface FlowDocument {
  apiVersion: typeof FLOW_DOCUMENT_VERSION;
  metadata: FlowMetadata;
  spec: FlowSpec;
  layout: FlowLayout;
}

export interface FlowMetadata {
  id: string;
  name: string;
  description?: string;
}

export interface FlowSpec {
  nodes: FlowNode[];
  edges: FlowEdge[];
  /**
   * Optional eKuiper rule options (FS-0152, v1alpha1 conservative subset).
   *
   * Shape source: `public/ekuiper-openapi.json` (eKuiper 2.4.1) schema
   * `RuleOptions`. Only the owner-approved subset is exposed; scheduling
   * (`cron`, `duration`), operational (`debug`, `logFilename`) and
   * advanced (`sendNilField`, `disableBufferFullDiscard`, ...) keys stay
   * out of scope and are rejected by shape validation.
   *
   * Absent (or empty) options compile to a rule definition with NO
   * `options` key, preserving existing fixtures byte-for-byte. Present
   * options are semantic: they are part of `hashFlowSemantic` input, never
   * layout.
   */
  options?: FlowRuleOptions;
}

/**
 * Conservative v1alpha1 subset of eKuiper `RuleOptions` (FS-0152).
 *
 * Every field is optional and JSON-compatible. Dual int/string fields
 * (`checkpointInterval`, `lateTolerance`) accept a non-negative millisecond
 * integer or a non-empty duration string (e.g. `"5s"`); the compiler copies
 * the value verbatim and never interprets it.
 */
export interface FlowRuleOptions {
  concurrency?: number;
  bufferLength?: number;
  qos?: 0 | 1 | 2;
  checkpointInterval?: number | string;
  isEventTime?: boolean;
  lateTolerance?: number | string;
  sendMetaToSink?: boolean;
  sendError?: boolean;
}

export interface FlowNode {
  id: string;
  type: string;
  typeVersion: number;
  name: string;
  config: Record<string, unknown>;
}

export interface FlowEdge {
  id: string;
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
}

export interface FlowLayout {
  nodes: Record<string, FlowNodeLayout>;
  viewport?: FlowViewport;
}

export interface FlowNodeLayout {
  x: number;
  y: number;
}

export interface FlowViewport {
  x: number;
  y: number;
  zoom: number;
}
