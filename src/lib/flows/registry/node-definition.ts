export type FlowNodeCategory =
  | 'source'
  | 'transform'
  | 'streaming'
  | 'routing'
  | 'sink';

export type FlowPortKind = 'stream' | 'collection' | 'table' | 'any';

export type FlowIrNodeKind = 'source' | 'operator' | 'sink';

export interface FlowPortDefinition {
  id: string;
  label?: string;
  kind: FlowPortKind;
  required?: boolean;
  multiple?: boolean;
}

export interface FlowPropertyDefinition {
  key: string;
  label: string;
  type:
    | 'string'
    | 'number'
    | 'boolean'
    | 'select'
    | 'json'
    | 'expression'
    | 'secret-ref';
  required?: boolean;
  description?: string;
  options?: Array<{ label: string; value: string | number | boolean }>;
  defaultValue?: unknown;
}

export interface FlowNodeDefinition {
  type: string;
  version: number;
  displayName: string;
  description: string;
  category: FlowNodeCategory;
  inputs: FlowPortDefinition[];
  outputs: FlowPortDefinition[];
  properties: FlowPropertyDefinition[];
  /**
   * Internal-only runtime metadata consumed by the Flow-to-IR builder.
   *
   * Not part of the authoring contract: no target-specific property
   * mapping belongs here. `runtimeKind` is the IR node kind
   * (source/operator/sink) and `operation` names the runtime operation.
   * Optional so definitions that only participate in validation can omit
   * them; the IR builder reports a diagnostic instead of emitting a
   * partial unknown operation when they are absent.
   */
  runtimeKind?: FlowIrNodeKind;
  operation?: string;
}
