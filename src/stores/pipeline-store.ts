import { create } from "zustand";
import { DecisionTree, DecisionTreeNode, DecisionTreeEdge, Rule, Stream } from "@/lib/ekuiper/types";
import { Node, Edge, Connection, addEdge, applyNodeChanges, applyEdgeChanges, NodeChange, EdgeChange } from "reactflow";

// History state for undo/redo
interface HistoryState {
  nodes: Node[];
  edges: Edge[];
}

const MAX_HISTORY_LENGTH = 50;

// Convert DecisionTreeNode to React Flow Node
function toFlowNode(node: DecisionTreeNode): Node {
  return {
    id: node.id,
    type: node.type,
    position: node.position,
    data: node.data,
  };
}

// Convert DecisionTreeEdge to React Flow Edge
function toFlowEdge(edge: DecisionTreeEdge): Edge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    animated: edge.animated ?? true,
    label: edge.label,
    style: { stroke: "#58a6ff" },
    labelStyle: { fill: "#c9d1d9", fontSize: 12 },
  };
}

interface PipelineState {
  // Current pipeline
  nodes: Node[];
  edges: Edge[];
  
  // Pipeline metadata
  pipelineId: string | null;
  pipelineName: string;
  pipelineDescription: string;
  
  // Selection
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  
  // Edit mode
  isEditing: boolean;
  isDirty: boolean;
  
  // Undo/Redo history
  history: HistoryState[];
  historyIndex: number;
  canUndo: boolean;
  canRedo: boolean;
  
  // Actions
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  
  addNode: (node: DecisionTreeNode) => void;
  updateNode: (nodeId: string, data: Partial<DecisionTreeNode["data"]>) => void;
  removeNode: (nodeId: string) => void;
  
  selectNode: (nodeId: string | null) => void;
  selectEdge: (edgeId: string | null) => void;
  
  loadPipeline: (pipeline: DecisionTree) => void;
  newPipeline: () => void;
  setPipelineInfo: (name: string, description: string) => void;
  
  exportPipeline: () => DecisionTree;
  generateRules: () => Rule[];
  generateStreams: () => string[];
  
  // Undo/Redo actions
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;
}

export const usePipelineStore = create<PipelineState>((set, get) => ({
  nodes: [],
  edges: [],
  pipelineId: null,
  pipelineName: "New Pipeline",
  pipelineDescription: "",
  selectedNodeId: null,
  selectedEdgeId: null,
  isEditing: true,
  isDirty: false,
  
  // History state
  history: [],
  historyIndex: -1,
  canUndo: false,
  canRedo: false,
  
  // Push current state to history (for undo/redo)
  pushHistory: () => {
    const { nodes, edges, history, historyIndex } = get();
    const currentState: HistoryState = {
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
    };
    
    // Remove any redo history after current index
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(currentState);
    
    // Limit history length
    if (newHistory.length > MAX_HISTORY_LENGTH) {
      newHistory.shift();
    }
    
    set({
      history: newHistory,
      historyIndex: newHistory.length - 1,
      canUndo: newHistory.length > 1,
      canRedo: false,
    });
  },
  
  undo: () => {
    const { history, historyIndex, nodes, edges } = get();
    
    if (historyIndex <= 0) return;
    
    // If we're at the latest state, save current state first
    if (historyIndex === history.length - 1) {
      const currentState: HistoryState = {
        nodes: JSON.parse(JSON.stringify(nodes)),
        edges: JSON.parse(JSON.stringify(edges)),
      };
      const newHistory = [...history];
      newHistory[historyIndex] = currentState;
      set({ history: newHistory });
    }
    
    const newIndex = historyIndex - 1;
    const previousState = history[newIndex];
    
    set({
      nodes: JSON.parse(JSON.stringify(previousState.nodes)),
      edges: JSON.parse(JSON.stringify(previousState.edges)),
      historyIndex: newIndex,
      canUndo: newIndex > 0,
      canRedo: true,
      isDirty: true,
    });
  },
  
  redo: () => {
    const { history, historyIndex } = get();
    
    if (historyIndex >= history.length - 1) return;
    
    const newIndex = historyIndex + 1;
    const nextState = history[newIndex];
    
    set({
      nodes: JSON.parse(JSON.stringify(nextState.nodes)),
      edges: JSON.parse(JSON.stringify(nextState.edges)),
      historyIndex: newIndex,
      canUndo: true,
      canRedo: newIndex < history.length - 1,
      isDirty: true,
    });
  },
  
  setNodes: (nodes) => {
    get().pushHistory();
    set({ nodes, isDirty: true });
  },
  setEdges: (edges) => {
    get().pushHistory();
    set({ edges, isDirty: true });
  },
  
  onNodesChange: (changes) => {
    // Only push history for significant changes (not just selection or position during drag)
    const significantChanges = changes.filter(
      (c) => c.type === "remove" || c.type === "add"
    );
    if (significantChanges.length > 0) {
      get().pushHistory();
    }
    
    set({
      nodes: applyNodeChanges(changes, get().nodes),
      isDirty: true,
    });
  },
  
  onEdgesChange: (changes) => {
    const significantChanges = changes.filter(
      (c) => c.type === "remove" || c.type === "add"
    );
    if (significantChanges.length > 0) {
      get().pushHistory();
    }
    
    set({
      edges: applyEdgeChanges(changes, get().edges),
      isDirty: true,
    });
  },
  
  onConnect: (connection) => {
    get().pushHistory();
    set({
      edges: addEdge(
        {
          ...connection,
          animated: true,
          style: { stroke: "#58a6ff" },
        },
        get().edges
      ),
      isDirty: true,
    });
  },
  
  addNode: (node) => {
    get().pushHistory();
    set({
      nodes: [...get().nodes, toFlowNode(node)],
      isDirty: true,
    });
  },
  
  updateNode: (nodeId, data) => {
    get().pushHistory();
    set({
      nodes: get().nodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...data } }
          : node
      ),
      isDirty: true,
    });
  },
  
  removeNode: (nodeId) => {
    get().pushHistory();
    set({
      nodes: get().nodes.filter((node) => node.id !== nodeId),
      edges: get().edges.filter(
        (edge) => edge.source !== nodeId && edge.target !== nodeId
      ),
      selectedNodeId: get().selectedNodeId === nodeId ? null : get().selectedNodeId,
      isDirty: true,
    });
  },
  
  selectNode: (nodeId) => set({ selectedNodeId: nodeId, selectedEdgeId: null }),
  selectEdge: (edgeId) => set({ selectedEdgeId: edgeId, selectedNodeId: null }),
  
  loadPipeline: (pipeline) => {
    const nodes = pipeline.nodes.map(toFlowNode);
    const edges = pipeline.edges.map(toFlowEdge);
    
    // Initialize history with loaded state
    const initialState: HistoryState = {
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
    };
    
    set({
      nodes,
      edges,
      pipelineId: pipeline.id,
      pipelineName: pipeline.name,
      pipelineDescription: pipeline.description || "",
      isDirty: false,
      selectedNodeId: null,
      selectedEdgeId: null,
      history: [initialState],
      historyIndex: 0,
      canUndo: false,
      canRedo: false,
    });
  },
  
  newPipeline: () => {
    set({
      nodes: [],
      edges: [],
      pipelineId: null,
      pipelineName: "New Pipeline",
      pipelineDescription: "",
      isDirty: false,
      selectedNodeId: null,
      selectedEdgeId: null,
      history: [{ nodes: [], edges: [] }],
      historyIndex: 0,
      canUndo: false,
      canRedo: false,
    });
  },
  
  setPipelineInfo: (name, description) => {
    set({
      pipelineName: name,
      pipelineDescription: description,
      isDirty: true,
    });
  },
  
  exportPipeline: () => {
    const { nodes, edges, pipelineId, pipelineName, pipelineDescription } = get();
    
    return {
      id: pipelineId || `pipeline_${Date.now()}`,
      name: pipelineName,
      description: pipelineDescription,
      nodes: nodes.map((node) => ({
        id: node.id,
        type: node.type as "source" | "processor" | "sink",
        position: node.position,
        data: node.data,
      })),
      edges: edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        animated: edge.animated,
        label: edge.label as string | undefined,
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  },
  
  generateRules: () => {
    const { nodes, edges } = get();
    const rules: Rule[] = [];
    
    // Find processing nodes (they become rules)
    const processorNodes = nodes.filter((n) => n.type === "processor");
    
    processorNodes.forEach((processor) => {
      // Find source node connected to this processor
      const incomingEdge = edges.find((e) => e.target === processor.id);
      const sourceNode = incomingEdge
        ? nodes.find((n) => n.id === incomingEdge.source)
        : null;
      
      // Find outgoing edges (sinks or next processors)
      const outgoingEdges = edges.filter((e) => e.source === processor.id);
      const targetNodes = outgoingEdges
        .map((e) => nodes.find((n) => n.id === e.target))
        .filter(Boolean);
      
      // Determine the stream name from source
      const streamName = sourceNode?.data?.streamName || 
        sourceNode?.data?.memoryTopic?.replace(/\//g, "_") || 
        "input_stream";
      
      // Build SQL - replace FROM clause with actual stream name
      let sql = processor.data.sql || `SELECT * FROM ${streamName}`;
      if (!sql.toLowerCase().includes("from")) {
        sql = `${sql} FROM ${streamName}`;
      }
      
      // Build sinks
      const sinks: any[] = [];
      
      targetNodes.forEach((target) => {
        if (!target) return;
        
        if (target.type === "sink") {
          // External sink
          if (target.data.config) {
            sinks.push(target.data.config);
          } else {
            sinks.push({ log: {} });
          }
        } else if (target.type === "processor") {
          // Chain to next processor via memory
          const memoryTopic = `pipeline/${processor.id}/${target.id}`;
          sinks.push({ memory: { topic: memoryTopic } });
        }
      });
      
      // Default to log sink if no sinks configured
      if (sinks.length === 0) {
        sinks.push({ log: {} });
      }
      
      rules.push({
        id: processor.data.ruleId || `rule_${processor.id}`,
        sql,
        actions: sinks,
      });
    });
    
    return rules;
  },
  
  generateStreams: () => {
    const { nodes, edges } = get();
    const streams: string[] = [];
    
    // Source nodes become streams
    const sourceNodes = nodes.filter((n) => n.type === "source");
    
    sourceNodes.forEach((source) => {
      const streamName = source.data.streamName || `stream_${source.id}`;
      const datasource = source.data.memoryTopic || source.data.config?.datasource || "topic/data";
      const streamType = source.data.config?.type || "mqtt";
      
      streams.push(
        `CREATE STREAM ${streamName} () WITH (DATASOURCE="${datasource}", FORMAT="JSON", TYPE="${streamType}")`
      );
    });
    
    // Memory streams for processor chains
    const processorNodes = nodes.filter((n) => n.type === "processor");
    
    processorNodes.forEach((processor) => {
      const outgoingToProcessor = edges.filter((e) => {
        const target = nodes.find((n) => n.id === e.target);
        return e.source === processor.id && target?.type === "processor";
      });
      
      outgoingToProcessor.forEach((edge) => {
        const memoryTopic = `pipeline/${processor.id}/${edge.target}`;
        const streamName = `stream_${edge.target}`;
        
        streams.push(
          `CREATE STREAM ${streamName} () WITH (DATASOURCE="${memoryTopic}", FORMAT="JSON", TYPE="memory")`
        );
      });
    });
    
    return streams;
  },
}));
