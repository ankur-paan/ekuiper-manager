import { create } from 'zustand';

import type {
  FlowDocument,
  FlowNodeLayout,
  FlowViewport,
} from '@/lib/flows/model/flow-document';

export const DEFAULT_FLOW_VIEWPORT: FlowViewport = { x: 0, y: 0, zoom: 1 };

export interface FlowEditorSelection {
  nodeIds: string[];
  edgeIds: string[];
}

export interface FlowNodeMove {
  nodeId: string;
  position: FlowNodeLayout;
}

interface FlowEditorState {
  document: FlowDocument | null;
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  viewport: FlowViewport;
  loadDocument: (doc: FlowDocument) => void;
  clearDocument: () => void;
  setSelection: (selection: FlowEditorSelection) => void;
  setViewport: (viewport: FlowViewport) => void;
  moveNode: (nodeId: string, position: FlowNodeLayout) => void;
  moveNodes: (moves: readonly FlowNodeMove[]) => void;
}

function cloneViewport(viewport: FlowViewport): FlowViewport {
  return { x: viewport.x, y: viewport.y, zoom: viewport.zoom };
}

function cloneDocument(doc: FlowDocument): FlowDocument {
  return JSON.parse(JSON.stringify(doc)) as FlowDocument;
}

export const useFlowEditorStore = create<FlowEditorState>((set) => ({
  document: null,
  selectedNodeIds: [],
  selectedEdgeIds: [],
  viewport: cloneViewport(DEFAULT_FLOW_VIEWPORT),

  loadDocument: (doc) =>
    set({
      document: cloneDocument(doc),
      selectedNodeIds: [],
      selectedEdgeIds: [],
      viewport: doc.layout.viewport
        ? cloneViewport(doc.layout.viewport)
        : cloneViewport(DEFAULT_FLOW_VIEWPORT),
    }),

  clearDocument: () =>
    set({
      document: null,
      selectedNodeIds: [],
      selectedEdgeIds: [],
      viewport: cloneViewport(DEFAULT_FLOW_VIEWPORT),
    }),

  setSelection: (selection) =>
    set({
      selectedNodeIds: [...selection.nodeIds],
      selectedEdgeIds: [...selection.edgeIds],
    }),

  setViewport: (viewport) => set({ viewport: cloneViewport(viewport) }),

  moveNode: (nodeId, position) =>
    set((state) => {
      if (!state.document) {
        return state;
      }
      const current = state.document.layout.nodes[nodeId];
      if (current && current.x === position.x && current.y === position.y) {
        return state;
      }
      return {
        document: {
          ...state.document,
          layout: {
            ...state.document.layout,
            nodes: {
              ...state.document.layout.nodes,
              [nodeId]: { x: position.x, y: position.y },
            },
          },
        },
      };
    }),

  moveNodes: (moves) =>
    set((state) => {
      if (!state.document || moves.length === 0) {
        return state;
      }
      const nextNodes = { ...state.document.layout.nodes };
      let changed = false;
      for (const move of moves) {
        const current = nextNodes[move.nodeId];
        if (
          !current ||
          current.x !== move.position.x ||
          current.y !== move.position.y
        ) {
          nextNodes[move.nodeId] = {
            x: move.position.x,
            y: move.position.y,
          };
          changed = true;
        }
      }
      if (!changed) {
        return state;
      }
      return {
        document: {
          ...state.document,
          layout: {
            ...state.document.layout,
            nodes: nextNodes,
          },
        },
      };
    }),
}));
