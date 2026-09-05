export type FlowNodeCategory =
  | 'source'
  | 'transform'
  | 'streaming'
  | 'routing'
  | 'sink';

export type FlowPortKind = 'stream' | 'collection' | 'table' | 'any';

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
}
