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
