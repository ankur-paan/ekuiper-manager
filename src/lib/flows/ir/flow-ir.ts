export interface FlowIr {
  nodes: FlowIrNode[];
  edges: FlowIrEdge[];
}

export interface FlowIrNode {
  id: string;
  kind: 'source' | 'operator' | 'sink';
  operation: string;
  config: Record<string, unknown>;
}

export interface FlowIrEdge {
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
}
