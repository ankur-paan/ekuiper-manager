import { create } from 'zustand';

import type { FlowDocument, FlowViewport } from '@/lib/flows/model/flow-document';

export const DEFAULT_FLOW_VIEWPORT: FlowViewport = { x: 0, y: 0, zoom: 1 };

export interface FlowEditorSelection {
  nodeIds: string[];
  edgeIds: string[];
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
}));
