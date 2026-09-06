import { create } from 'zustand';

import type {
  FlowDocument,
  FlowEdge,
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

/** Maximum number of committed editor commands retained for undo. */
export const FLOW_EDITOR_HISTORY_LIMIT = 100;

interface FlowEditorState {
  document: FlowDocument | null;
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  viewport: FlowViewport;
  /** Committed document snapshots available for undo (oldest first). */
  past: FlowDocument[];
  /** Committed document snapshots available for redo (oldest first). */
  future: FlowDocument[];
  canUndo: boolean;
  canRedo: boolean;
  loadDocument: (doc: FlowDocument) => void;
  clearDocument: () => void;
  setSelection: (selection: FlowEditorSelection) => void;
  setViewport: (viewport: FlowViewport) => void;
  moveNode: (nodeId: string, position: FlowNodeLayout) => void;
  moveNodes: (moves: readonly FlowNodeMove[]) => void;
  updateNodeConfig: (nodeId: string, patch: Record<string, unknown>) => void;
  renameNode: (nodeId: string, name: string) => void;
  addEdge: (edge: FlowEdge) => void;
  removeEdges: (ids: readonly string[]) => void;
  removeNodes: (ids: readonly string[]) => void;
  deleteSelected: () => void;
  undo: () => void;
  redo: () => void;
}

function cloneViewport(viewport: FlowViewport): FlowViewport {
  return { x: viewport.x, y: viewport.y, zoom: viewport.zoom };
}

function cloneDocument(doc: FlowDocument): FlowDocument {
  return JSON.parse(JSON.stringify(doc)) as FlowDocument;
}

interface HistoryTransition {
  past: FlowDocument[];
  future: FlowDocument[];
  canUndo: boolean;
  canRedo: boolean;
}

function emptyHistory(): HistoryTransition {
  return { past: [], future: [], canUndo: false, canRedo: false };
}

/**
 * Capture the current document for undo before a committed mutation.
 * The redo stack is cleared because a new change branches history.
 */
function pushHistory(
  past: FlowDocument[],
  current: FlowDocument,
): HistoryTransition {
  const snapshot = cloneDocument(current);
  const nextPast =
    past.length >= FLOW_EDITOR_HISTORY_LIMIT
      ? [...past.slice(past.length - (FLOW_EDITOR_HISTORY_LIMIT - 1)), snapshot]
      : [...past, snapshot];
  return { past: nextPast, future: [], canUndo: true, canRedo: false };
}

export const useFlowEditorStore = create<FlowEditorState>((set) => ({
  document: null,
  selectedNodeIds: [],
  selectedEdgeIds: [],
  viewport: cloneViewport(DEFAULT_FLOW_VIEWPORT),
  past: [],
  future: [],
  canUndo: false,
  canRedo: false,

  loadDocument: (doc) =>
    set({
      document: cloneDocument(doc),
      selectedNodeIds: [],
      selectedEdgeIds: [],
      viewport: doc.layout.viewport
        ? cloneViewport(doc.layout.viewport)
        : cloneViewport(DEFAULT_FLOW_VIEWPORT),
      ...emptyHistory(),
    }),

  clearDocument: () =>
    set({
      document: null,
      selectedNodeIds: [],
      selectedEdgeIds: [],
      viewport: cloneViewport(DEFAULT_FLOW_VIEWPORT),
      ...emptyHistory(),
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
        ...pushHistory(state.past, state.document),
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
        ...pushHistory(state.past, state.document),
      };
    }),

  updateNodeConfig: (nodeId, patch) =>
    set((state) => {
      if (!state.document) {
        return state;
      }
      const index = state.document.spec.nodes.findIndex(
        (node) => node.id === nodeId,
      );
      if (index === -1) {
        return state;
      }
      const node = state.document.spec.nodes[index];
      const patchKeys = Object.keys(patch);
      if (patchKeys.length === 0) {
        return state;
      }
      let configChanged = false;
      for (const key of patchKeys) {
        if (!Object.is(node.config[key], patch[key])) {
          configChanged = true;
          break;
        }
      }
      if (!configChanged) {
        return state;
      }
      const nextNodes = [...state.document.spec.nodes];
      nextNodes[index] = {
        ...node,
        config: { ...node.config, ...patch },
      };
      return {
        document: {
          ...state.document,
          spec: {
            ...state.document.spec,
            nodes: nextNodes,
          },
        },
        ...pushHistory(state.past, state.document),
      };
    }),

  renameNode: (nodeId, name) =>
    set((state) => {
      if (!state.document) {
        return state;
      }
      const index = state.document.spec.nodes.findIndex(
        (node) => node.id === nodeId,
      );
      if (index === -1) {
        return state;
      }
      const node = state.document.spec.nodes[index];
      if (node.name === name) {
        return state;
      }
      const nextNodes = [...state.document.spec.nodes];
      nextNodes[index] = { ...node, name };
      return {
        document: {
          ...state.document,
          spec: {
            ...state.document.spec,
            nodes: nextNodes,
          },
        },
        ...pushHistory(state.past, state.document),
      };
    }),

  addEdge: (edge) =>
    set((state) => {
      if (!state.document) {
        return state;
      }
      if (state.document.spec.edges.some((entry) => entry.id === edge.id)) {
        throw new Error(`Duplicate flow edge id "${edge.id}".`);
      }
      return {
        document: {
          ...state.document,
          spec: {
            ...state.document.spec,
            edges: [...state.document.spec.edges, { ...edge }],
          },
        },
        ...pushHistory(state.past, state.document),
      };
    }),

  removeEdges: (ids) =>
    set((state) => {
      if (!state.document || ids.length === 0) {
        return state;
      }
      const remove = new Set(ids);
      const nextEdges = state.document.spec.edges.filter(
        (entry) => !remove.has(entry.id),
      );
      if (nextEdges.length === state.document.spec.edges.length) {
        return state;
      }
      return {
        document: {
          ...state.document,
          spec: {
            ...state.document.spec,
            edges: nextEdges,
          },
        },
        ...pushHistory(state.past, state.document),
      };
    }),

  // FS-0050: remove nodes plus incident edges and layout entries as a
  // single history command. Unknown IDs are a no-op without history.
  removeNodes: (ids) =>
    set((state) => {
      if (!state.document || ids.length === 0) {
        return state;
      }
      const existing = new Set(
        state.document.spec.nodes.map((entry) => entry.id),
      );
      const toRemove = new Set(ids.filter((id) => existing.has(id)));
      if (toRemove.size === 0) {
        return state;
      }
      const nextNodes = state.document.spec.nodes.filter(
        (entry) => !toRemove.has(entry.id),
      );
      const removedEdgeIds = new Set(
        state.document.spec.edges
          .filter(
            (entry) =>
              toRemove.has(entry.sourceNodeId) ||
              toRemove.has(entry.targetNodeId),
          )
          .map((entry) => entry.id),
      );
      const nextEdges = state.document.spec.edges.filter(
        (entry) => !removedEdgeIds.has(entry.id),
      );
      const nextLayoutNodes = { ...state.document.layout.nodes };
      for (const id of toRemove) {
        delete nextLayoutNodes[id];
      }
      return {
        document: {
          ...state.document,
          spec: {
            ...state.document.spec,
            nodes: nextNodes,
            edges: nextEdges,
          },
          layout: {
            ...state.document.layout,
            nodes: nextLayoutNodes,
          },
        },
        selectedNodeIds: state.selectedNodeIds.filter(
          (id) => !toRemove.has(id),
        ),
        selectedEdgeIds: state.selectedEdgeIds.filter(
          (id) => !removedEdgeIds.has(id),
        ),
        ...pushHistory(state.past, state.document),
      };
    }),

  // FS-0050: delete the current selection (selected nodes plus incident
  // edges plus explicitly selected edges) as one history command.
  // Selection/viewport stay out of the snapshot; selection is pruned for
  // removed ids and undo restores document content only.
  deleteSelected: () =>
    set((state) => {
      if (!state.document) {
        return state;
      }
      const existingNodes = new Set(
        state.document.spec.nodes.map((entry) => entry.id),
      );
      const existingEdges = new Set(
        state.document.spec.edges.map((entry) => entry.id),
      );
      const nodesToRemove = new Set(
        state.selectedNodeIds.filter((id) => existingNodes.has(id)),
      );
      const edgesToRemove = new Set(
        state.selectedEdgeIds.filter((id) => existingEdges.has(id)),
      );
      for (const entry of state.document.spec.edges) {
        if (
          nodesToRemove.has(entry.sourceNodeId) ||
          nodesToRemove.has(entry.targetNodeId)
        ) {
          edgesToRemove.add(entry.id);
        }
      }
      if (nodesToRemove.size === 0 && edgesToRemove.size === 0) {
        return state;
      }
      const nextNodes = state.document.spec.nodes.filter(
        (entry) => !nodesToRemove.has(entry.id),
      );
      const nextEdges = state.document.spec.edges.filter(
        (entry) => !edgesToRemove.has(entry.id),
      );
      if (
        nextNodes.length === state.document.spec.nodes.length &&
        nextEdges.length === state.document.spec.edges.length
      ) {
        return state;
      }
      const nextLayoutNodes = { ...state.document.layout.nodes };
      for (const id of nodesToRemove) {
        delete nextLayoutNodes[id];
      }
      return {
        document: {
          ...state.document,
          spec: {
            ...state.document.spec,
            nodes: nextNodes,
            edges: nextEdges,
          },
          layout: {
            ...state.document.layout,
            nodes: nextLayoutNodes,
          },
        },
        selectedNodeIds: state.selectedNodeIds.filter(
          (id) => !nodesToRemove.has(id),
        ),
        selectedEdgeIds: state.selectedEdgeIds.filter(
          (id) => !edgesToRemove.has(id),
        ),
        ...pushHistory(state.past, state.document),
      };
    }),

  undo: () =>
    set((state) => {
      if (!state.document || state.past.length === 0) {
        return state;
      }
      const previous = state.past[state.past.length - 1];
      const nextPast = state.past.slice(0, -1);
      const nextFuture = [...state.future, cloneDocument(state.document)];
      return {
        document: previous,
        past: nextPast,
        future: nextFuture,
        canUndo: nextPast.length > 0,
        canRedo: true,
      };
    }),

  redo: () =>
    set((state) => {
      if (!state.document || state.future.length === 0) {
        return state;
      }
      const next = state.future[state.future.length - 1];
      const nextFuture = state.future.slice(0, -1);
      const snapshot = cloneDocument(state.document);
      const nextPast =
        state.past.length >= FLOW_EDITOR_HISTORY_LIMIT
          ? [
              ...state.past.slice(
                state.past.length - (FLOW_EDITOR_HISTORY_LIMIT - 1),
              ),
              snapshot,
            ]
          : [...state.past, snapshot];
      return {
        document: next,
        past: nextPast,
        future: nextFuture,
        canUndo: true,
        canRedo: nextFuture.length > 0,
      };
    }),
}));
