'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import type { Connection, Edge } from '@xyflow/react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  FLOW_DOCUMENT_VERSION,
  type FlowDocument,
  type FlowLayout,
  type FlowSpec,
} from '@/lib/flows/model/flow-document';
import { FlowStudioShell } from './flow-studio-shell';
import { FlowStudioHeader, type FlowStudioSaveStatus } from './shell/flow-studio-header';
import { NodeInspector } from './inspector/node-inspector';
import { NodePalette } from './palette/node-palette';
import { FlowCanvas, flowNodeTypes, type FlowCanvasEmptyDoubleClick, type FlowCanvasNodeDragStopMove, type FlowCanvasSelection, type FlowPaletteDrop } from './canvas/flow-canvas';
import { FlowBottomPanel } from './panels/flow-bottom-panel';
import { QuickNodePicker } from './palette/quick-node-picker';
import type { FlowNodeDefinition } from '@/lib/flows/registry/node-definition';
import { toFlowCanvasPresentation, toReactFlow } from './canvas/to-react-flow';
import { generateFlowNodeId } from '@/lib/flows/model/create-flow-node';
import { createFlowEdgeForConnection, generateFlowEdgeId } from '@/lib/flows/model/create-flow-edge';
import { buildFlowDirtyBaseline, computeFlowDirtyState, type FlowDirtyBaseline } from '@/lib/flows/model/flow-dirty-state';
import { createBuiltinNodeRegistry } from '@/lib/flows/registry/builtin-registry';
import { resolveTargetCapabilities } from '@/lib/flows/capabilities/resolve-capabilities';
import { canConnect } from '@/lib/flows/validation/port-compatibility';
import { validateFlowForEditor } from '@/lib/flows/validation/editor-validation';
import { isDefinitionSupportedByCapabilities } from '@/lib/flows/validation/capability-validation';
import type { FlowDiagnostic } from '@/lib/flows/model/diagnostic';
import { useFlowAutosave, type FlowAutosaveSaved, type FlowAutosaveStatus } from './hooks/use-flow-autosave';
import { useFlowEditorStore } from '@/stores/flow-editor-store';

interface FlowSummary {
  id: string;
  name: string;
  description: string | null;
  targetNodeId: string | null;
}

interface FlowDraftPayload {
  flowId: string;
  semanticDocument: FlowSpec;
  layoutDocument: FlowLayout;
  semanticHash: string;
  layoutHash: string;
}

class FlowPageError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'FlowPageError';
    this.status = status;
  }
}

/**
 * Shared built-in definition source for the palette (FS-0063).
 *
 * The registry clones definitions on retrieval, so one module-level
 * instance is safe to share across renders without leaking mutable state.
 * The palette renders whatever this registry lists, so registry additions
 * appear without palette source edits. No drag/drop payload is built here.
 */
const builtinRegistry = createBuiltinNodeRegistry();

async function readErrorMessage(response: Response): Promise<string> {
  const payload: unknown = await response.json().catch(() => null);
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const record = payload as Record<string, unknown>;
    const nested = record['error'];
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      const message = (nested as Record<string, unknown>)['message'];
      if (typeof message === 'string' && message.length > 0) return message;
    }
  }
  return `Request failed (${response.status})`;
}

async function fetchFlow(flowId: string): Promise<FlowSummary> {
  const response = await fetch(`/api/flows/${encodeURIComponent(flowId)}`, {
    cache: 'no-store',
  });
  if (!response.ok) throw new FlowPageError(response.status, await readErrorMessage(response));
  const payload = (await response.json()) as { flow: FlowSummary };
  return payload.flow;
}

async function fetchDraft(flowId: string): Promise<FlowDraftPayload | null> {
  const response = await fetch(`/api/flows/${encodeURIComponent(flowId)}/draft`, {
    cache: 'no-store',
  });
  // No saved draft yet is an expected state, not an error: the caller
  // builds an empty in-memory document instead. Only other failures surface.
  if (response.status === 404) return null;
  if (!response.ok) throw new FlowPageError(response.status, await readErrorMessage(response));
  const payload = (await response.json()) as { draft: FlowDraftPayload };
  return payload.draft;
}

function buildDocument(flow: FlowSummary, draft: FlowDraftPayload | null): FlowDocument {
  const metadata =
    flow.description === null || flow.description === undefined
      ? { id: flow.id, name: flow.name }
      : { id: flow.id, name: flow.name, description: flow.description };
  if (draft) {
    return {
      apiVersion: FLOW_DOCUMENT_VERSION,
      metadata,
      spec: draft.semanticDocument,
      layout: draft.layoutDocument,
    };
  }
  // No draft exists: construct an empty v1alpha1 document in client state
  // only. It is persisted by the autosave hook below once it observes the
  // missing server baseline.
  return {
    apiVersion: FLOW_DOCUMENT_VERSION,
    metadata,
    spec: { nodes: [], edges: [] },
    layout: { nodes: {} },
  };
}

/**
 * FS-0050: editing shortcuts must not fire while typing. Inputs,
 * textareas, selects, contenteditable regions, and Monaco (which renders
 * a textarea inside `.monaco-editor`) all opt out so Backspace/Z keys
 * edit text instead of mutating the graph.
 */
function isFlowStudioEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  ) {
    return true;
  }
  if (target.isContentEditable) return true;
  if (
    target.closest(
      '[contenteditable="true"], [contenteditable=""], .monaco-editor',
    )
  ) {
    return true;
  }
  return false;
}

/**
 * Order-insensitive selection equality for the store mirror above.
 */
function sameFlowSelectionIds(
  current: readonly string[],
  next: readonly string[],
): boolean {
  if (current.length !== next.length) return false;
  const members = new Set(current);
  for (const id of next) {
    if (!members.has(id)) return false;
  }
  return true;
}

/**
 * Map the FS-0047 autosave hook status to the FS-0048 header display.
 * Covers both semantic and layout-only dirty states because the hook
 * reports pending/saving for either domain. Never reports deployment
 * state here; deploy affordances remain disabled until the deployment phase.
 */
function resolveFlowSaveDisplay(status: FlowAutosaveStatus): {
  text: string;
  status: FlowStudioSaveStatus;
} {
  switch (status) {
    case 'error':
      return { text: 'Save failed', status: 'error' };
    case 'saving':
      return { text: 'Saving…', status: 'saving' };
    case 'pending':
      return { text: 'Unsaved changes', status: 'unsaved' };
    case 'idle':
    default:
      return { text: 'Saved', status: 'saved' };
  }
}

export function FlowStudioPage({ flowId }: { flowId: string }) {
  const flowQuery = useQuery({
    queryKey: ['flow', flowId],
    queryFn: () => fetchFlow(flowId),
    staleTime: 5 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const draftQuery = useQuery({
    queryKey: ['flow-draft', flowId],
    queryFn: () => fetchDraft(flowId),
    enabled: flowQuery.isSuccess,
    staleTime: 5 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const loadDocument = useFlowEditorStore((state) => state.loadDocument);
  const storeDocument = useFlowEditorStore((state) => state.document);
  const moveNodes = useFlowEditorStore((state) => state.moveNodes);
  const addNode = useFlowEditorStore((state) => state.addNode);
  const addEdge = useFlowEditorStore((state) => state.addEdge);
  const selectedNodeIds = useFlowEditorStore((state) => state.selectedNodeIds);
  const selectedEdgeIds = useFlowEditorStore((state) => state.selectedEdgeIds);
  const setSelection = useFlowEditorStore((state) => state.setSelection);

  const document = React.useMemo<FlowDocument | null>(() => {
    if (!flowQuery.isSuccess || !draftQuery.isSuccess) return null;
    return buildDocument(flowQuery.data, draftQuery.data ?? null);
  }, [flowQuery.isSuccess, flowQuery.data, draftQuery.isSuccess, draftQuery.data]);

  const documentKey = React.useMemo<string | null>(() => {
    if (!document) return null;
    return `${document.metadata.id}::${JSON.stringify({ spec: document.spec, layout: document.layout })}`;
  }, [document]);

  const loadedKeyRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!document || !documentKey) return;
    if (loadedKeyRef.current === documentKey) return;
    loadedKeyRef.current = documentKey;
    loadDocument(document);
  }, [document, documentKey, loadDocument]);

  const canvasSource =
    storeDocument && storeDocument.metadata.id === flowId ? storeDocument : document;

  // R1: resolve the exact (type, typeVersion) definition at the page/view
  // boundary and attach only presentation fields (category, display name,
  // input/output ports) to canvas node data. The adapter stays pure; this
  // closure owns the only registry lookup. Unknown types resolve to
  // undefined so the adapter marks them unsupported without crashing.
  const canvasView = React.useMemo(
    () =>
      canvasSource
        ? toReactFlow(canvasSource, (type, version) => {
            const definition = builtinRegistry.get(type, version);
            if (!definition) return undefined;
            return toFlowCanvasPresentation(definition);
          })
        : null,
    [canvasSource],
  );

  // FS-0063: palette is driven by the built-in registry, not a hard-coded
  // catalog. list() is already deterministically ordered; grouping and
  // display order are owned by NodePalette.
  const paletteDefinitions = React.useMemo(() => builtinRegistry.list(), []);

  // FS-0080: normalized target capability profile for palette gating and
  // capability validation. Temporary audited 2.4.1 reachable baseline until
  // live target probe wiring lands in a later ticket: every current
  // built-in stays available, so existing flows remain viewable/editable
  // and no version comparison leaks into palette or page code (the
  // resolver owns the only semver check).
  const capabilityProfile = React.useMemo(
    () => resolveTargetCapabilities({ version: '2.4.1', reachable: true }),
    [],
  );

  // FS-0068: editor validation derived from committed store state via the
  // single named pipeline in src/lib/flows/validation/editor-validation.ts
  // (defect R4: previously the page composed validators inline and never
  // invoked join topology validation). Pure read: never mutates the
  // document, never writes diagnostics into store state, and therefore
  // never alters the semantic hash. Diagnostics stay in memo state only;
  // only counts flow to node chrome while messages render in the inspector.
  const flowDiagnostics = React.useMemo<FlowDiagnostic[]>(() => {
    if (!storeDocument || storeDocument.metadata.id !== flowId) return [];
    return validateFlowForEditor(storeDocument, builtinRegistry, capabilityProfile);
  }, [storeDocument, flowId, capabilityProfile]);

  // FS-0068: collapse diagnostics to per-node error/warning counts for the
  // canvas. Diagnostics carrying nodeId count directly; edge-only
  // diagnostics (e.g. incompatible ports) attribute to both endpoint
  // nodes so the badge reflects connection problems. Document-level
  // diagnostics without node or edge scope are inspector-agnostic and
  // excluded from chrome counts.
  const nodeValidationCounts = React.useMemo(
    () => {
      const counts = new Map<string, { errors: number; warnings: number }>();
      if (!storeDocument) return counts;
      const edgesById = new Map(
        storeDocument.spec.edges.map((edge) => [edge.id, edge]),
      );
      const bump = (nodeId: string, severity: FlowDiagnostic['severity']) => {
        const entry = counts.get(nodeId) ?? { errors: 0, warnings: 0 };
        if (severity === 'error') {
          entry.errors += 1;
        } else if (severity === 'warning') {
          entry.warnings += 1;
        } else {
          return;
        }
        counts.set(nodeId, entry);
      };
      for (const diagnostic of flowDiagnostics) {
        if (diagnostic.nodeId) {
          bump(diagnostic.nodeId, diagnostic.severity);
        } else if (diagnostic.edgeId) {
          const edge = edgesById.get(diagnostic.edgeId);
          if (!edge) continue;
          bump(edge.sourceNodeId, diagnostic.severity);
          if (edge.targetNodeId !== edge.sourceNodeId) {
            bump(edge.targetNodeId, diagnostic.severity);
          }
        }
      }
      return counts;
    },
    [flowDiagnostics, storeDocument],
  );

  // FS-0068: enrich the pure toReactFlow view with per-node counts only.
  // Messages never enter canvas node data, keeping canvas chrome bounded
  // per UI_PERFORMANCE_SPEC. Derived from committed store state so fixing
  // a property clears the badge on the next render without reload.
  const canvasViewWithValidation = React.useMemo(() => {
    if (!canvasView) return null;
    if (nodeValidationCounts.size === 0) return canvasView;
    return {
      edges: canvasView.edges,
      nodes: canvasView.nodes.map((node) => {
        const counts = nodeValidationCounts.get(node.id);
        if (!counts) return node;
        return {
          ...node,
          data: {
            ...node.data,
            validationErrorCount: counts.errors,
            validationWarningCount: counts.warnings,
          },
        };
      }),
    };
  }, [canvasView, nodeValidationCounts]);

  // FS-0068: detailed messages for the currently selected node. Includes
  // diagnostics scoped directly to the node plus edge diagnostics for
  // incident edges (e.g. incompatible ports carry only edgeId).
  const inspectorDiagnostics = React.useMemo<FlowDiagnostic[]>(() => {
    const selectedNodeId = selectedNodeIds[0] ?? null;
    if (!selectedNodeId || !storeDocument) return [];
    const edgesById = new Map(
      storeDocument.spec.edges.map((edge) => [edge.id, edge]),
    );
    return flowDiagnostics.filter((diagnostic) => {
      if (diagnostic.nodeId === selectedNodeId) return true;
      if (!diagnostic.nodeId && diagnostic.edgeId) {
        const edge = edgesById.get(diagnostic.edgeId);
        return (
          edge !== undefined &&
          (edge.sourceNodeId === selectedNodeId ||
            edge.targetNodeId === selectedNodeId)
        );
      }
      return false;
    });
  }, [flowDiagnostics, selectedNodeIds, storeDocument]);

  // Defect R4: document-level diagnostics carry neither nodeId nor edgeId
  // scope (cycle, no source, no sink) and are therefore invisible to the
  // node-only presentation above. They are surfaced separately in the
  // inspector instead of being silently discarded; canvas chrome counts
  // stay node-scoped per UI_PERFORMANCE_SPEC.
  const documentDiagnostics = React.useMemo<FlowDiagnostic[]>(
    () =>
      flowDiagnostics.filter(
        (diagnostic) => !diagnostic.nodeId && !diagnostic.edgeId,
      ),
    [flowDiagnostics],
  );

  // FS-0046: compare current editor canonical snapshots against the last
  // server draft documents, each domain independently and never by object
  // identity. The baseline is built client-side from the loaded draft
  // documents with the pure canonical serializer, so no `node:crypto`
  // import reaches this browser component; server sha256 hashes stay
  // server-side only. Computed from committed store state only, so
  // high-frequency drag pointer events never recompute snapshots (drag
  // commits land once per drag stop via FS-0042). The FS-0047 autosave
  // hook below consumes the effective baseline; the data attributes on the
  // shell container expose dirty/autosave state for instrumentation without
  // changing save-state display (FS-0048 owns that mapping).
  const queryBaseline = React.useMemo(() => {
    const draft = draftQuery.data ?? null;
    if (!draft) return null;
    return buildFlowDirtyBaseline(draft.semanticDocument, draft.layoutDocument);
  }, [draftQuery.data]);
  // FS-0047: baseline of the most recently autosaved document. Advanced
  // from the PUT response without reloading the document or refetching the
  // draft; reset whenever a different flow is opened.
  const [savedBaseline, setSavedBaseline] = React.useState<FlowDirtyBaseline | null>(null);
  // R3: server hashes of the most recently autosaved draft, chained as the
  // optimistic-concurrency predicate for the next PUT.
  const [savedHashes, setSavedHashes] = React.useState<{
    semanticHash: string;
    layoutHash: string;
  } | null>(null);
  React.useEffect(() => {
    setSavedBaseline(null);
    setSavedHashes(null);
  }, [flowId]);

  // FS-0070: quick node picker opened by double-clicking empty canvas.
  // Holds the clicked flow coordinate (node creation point) plus the
  // viewport client coordinate (picker placement). Null means closed;
  // closing never mutates the document. Reset per flow so a stale picker
  // never creates a node in a different flow.
  const [quickPicker, setQuickPicker] = React.useState<FlowCanvasEmptyDoubleClick | null>(null);
  React.useEffect(() => {
    setQuickPicker(null);
  }, [flowId]);
  const baseline = savedBaseline ?? queryBaseline;
  const dirtyState = React.useMemo(() => {
    if (!storeDocument || !baseline) {
      return { semanticDirty: false, layoutDirty: false };
    }
    return computeFlowDirtyState(
      storeDocument.spec,
      storeDocument.layout,
      baseline,
    );
  }, [storeDocument, baseline]);

  const handleAutosaved = React.useCallback((saved: FlowAutosaveSaved) => {
    setSavedBaseline(buildFlowDirtyBaseline(saved.spec, saved.layout));
    setSavedHashes({ semanticHash: saved.semanticHash, layoutHash: saved.layoutHash });
  }, []);

  // R3: predicate for the next draft PUT. Prefer the chained hashes from the
  // last successful autosave; otherwise use the loaded draft hashes so a
  // stale tab cannot silently replace newer edits (409 surfaces instead).
  const baselineHashes = React.useMemo(() => {
    if (savedHashes) return savedHashes;
    const draft = draftQuery.data ?? null;
    if (!draft) return null;
    return { semanticHash: draft.semanticHash, layoutHash: draft.layoutHash };
  }, [savedHashes, draftQuery.data]);

  // FS-0047: debounced draft autosave. Fires only for committed store
  // changes while dirty, PUTs {spec,layout} to the Manager draft API (never
  // eKuiper), and clears dirty state via handleAutosaved on success. The
  // autosave status is mapped to header display below (FS-0048).
  const autosave = useFlowAutosave({
    flowId,
    spec: storeDocument?.spec ?? null,
    layout: storeDocument?.layout ?? null,
    baseline,
    baselineHashes,
    disabled:
      !draftQuery.isSuccess ||
      !storeDocument ||
      storeDocument.metadata.id !== flowId,
    onSaved: handleAutosaved,
  });

  // Commit one layout-only move per drag stop. High-frequency drag updates
  // stay inside FlowCanvas view state; no draft PUT happens here (FS-0047).
  const handleCanvasNodeDragStop = React.useCallback(
    (moves: FlowCanvasNodeDragStopMove[]) => {
      if (moves.length === 0) return;
      moveNodes(
        moves.map((move) => ({
          nodeId: move.nodeId,
          position: { x: move.position.x, y: move.position.y },
        })),
      );
    },
    [moveNodes],
  );

  // Mirror XYFlow selection into ephemeral editor state only (FS-0045).
  // Selection never touches the FlowDocument, so hashes are unaffected.
  // Loading a flow calls loadDocument, which clears this selection.
  // Redundant reports (same id sets, possibly reordered) are ignored so the
  // controlled canvas props cannot fight the store in a render loop.
  const handleCanvasSelectionChange = React.useCallback(
    (selection: FlowCanvasSelection) => {
      const current = useFlowEditorStore.getState();
      if (
        sameFlowSelectionIds(current.selectedNodeIds, selection.nodeIds) &&
        sameFlowSelectionIds(current.selectedEdgeIds, selection.edgeIds)
      ) {
        return;
      }
      setSelection({ nodeIds: selection.nodeIds, edgeIds: selection.edgeIds });
    },
    [setSelection],
  );

  // FS-0066: create one node from a palette drop. The payload carries only
  // the registry identity (type+version); the definition is resolved here
  // and the node is created via the editor-store addNode action as a single
  // history entry. Unknown types are ignored without mutation.
  // FS-0080: drops for capability-unavailable definitions are rejected so
  // an unavailable node cannot be newly added from the palette; loaded
  // unavailable nodes already in the document remain untouched.
  const handlePaletteDrop = React.useCallback(
    (drop: FlowPaletteDrop) => {
      const definition = builtinRegistry.get(drop.type, drop.version);
      if (!definition) return;
      if (!isDefinitionSupportedByCapabilities(definition, capabilityProfile).supported) {
        return;
      }
      addNode({
        id: generateFlowNodeId(),
        definition,
        position: { x: drop.position.x, y: drop.position.y },
      });
    },
    [addNode, capabilityProfile],
  );

  // FS-0067: preflight validation shared by connect creation and the
  // canvas isValidConnection preview. Pure read of committed store state:
  // no server call, no mutation, no toast. Rejects missing handles,
  // self-edges, duplicate identical connections, unknown nodes/ports, and
  // incompatible port kinds via registry definitions plus canConnect.
  const isFlowConnectionValid = React.useCallback(
    (connection: Edge | Connection): boolean => {
      const current = useFlowEditorStore.getState().document;
      if (!current || current.metadata.id !== flowId) return false;
      const sourceNodeId = connection.source;
      const targetNodeId = connection.target;
      const sourcePortId = connection.sourceHandle;
      const targetPortId = connection.targetHandle;
      if (!sourceNodeId || !targetNodeId || !sourcePortId || !targetPortId) {
        return false;
      }
      if (sourceNodeId === targetNodeId) return false;
      const duplicate = current.spec.edges.some(
        (entry) =>
          entry.sourceNodeId === sourceNodeId &&
          entry.sourcePortId === sourcePortId &&
          entry.targetNodeId === targetNodeId &&
          entry.targetPortId === targetPortId,
      );
      if (duplicate) return false;
      const sourceNode = current.spec.nodes.find(
        (entry) => entry.id === sourceNodeId,
      );
      const targetNode = current.spec.nodes.find(
        (entry) => entry.id === targetNodeId,
      );
      if (!sourceNode || !targetNode) return false;
      const sourceDefinition = builtinRegistry.get(
        sourceNode.type,
        sourceNode.typeVersion,
      );
      const targetDefinition = builtinRegistry.get(
        targetNode.type,
        targetNode.typeVersion,
      );
      if (!sourceDefinition || !targetDefinition) return false;
      const sourcePort = sourceDefinition.outputs.find(
        (port) => port.id === sourcePortId,
      );
      const targetPort = targetDefinition.inputs.find(
        (port) => port.id === targetPortId,
      );
      if (!sourcePort || !targetPort) return false;
      return canConnect(sourcePort.kind, targetPort.kind);
    },
    [flowId],
  );

  // FS-0067: create one semantic FlowEdge from an XYFlow connect event after
  // preflight port validation. The edge ID is a fresh authoring UUID via the
  // injected/browser boundary; compiler runtime IDs remain unrelated. Invalid
  // connections (missing handles, unknown nodes/ports, incompatible kinds,
  // self-edges, duplicates) are rejected with concise sonner toast feedback
  // and leave the document unaltered. One valid connection is one history
  // entry via the editor-store addEdge action. No server call.
  const handleConnect = React.useCallback(
    (connection: Connection) => {
      const current = useFlowEditorStore.getState().document;
      if (!current || current.metadata.id !== flowId) return;
      const sourceNodeId = connection.source;
      const targetNodeId = connection.target;
      const sourcePortId = connection.sourceHandle;
      const targetPortId = connection.targetHandle;
      if (!sourceNodeId || !targetNodeId || !sourcePortId || !targetPortId) {
        toast.error('Select source and target handles to connect.');
        return;
      }
      if (sourceNodeId === targetNodeId) {
        toast.error('Cannot connect a node to itself.');
        return;
      }
      const duplicate = current.spec.edges.some(
        (entry) =>
          entry.sourceNodeId === sourceNodeId &&
          entry.sourcePortId === sourcePortId &&
          entry.targetNodeId === targetNodeId &&
          entry.targetPortId === targetPortId,
      );
      if (duplicate) {
        toast.error('This connection already exists.');
        return;
      }
      const sourceNode = current.spec.nodes.find(
        (entry) => entry.id === sourceNodeId,
      );
      const targetNode = current.spec.nodes.find(
        (entry) => entry.id === targetNodeId,
      );
      if (!sourceNode || !targetNode) {
        toast.error('Cannot connect: node not found.');
        return;
      }
      const sourceDefinition = builtinRegistry.get(
        sourceNode.type,
        sourceNode.typeVersion,
      );
      const targetDefinition = builtinRegistry.get(
        targetNode.type,
        targetNode.typeVersion,
      );
      if (!sourceDefinition || !targetDefinition) {
        toast.error('Cannot connect: unknown node type.');
        return;
      }
      const sourcePort = sourceDefinition.outputs.find(
        (port) => port.id === sourcePortId,
      );
      const targetPort = targetDefinition.inputs.find(
        (port) => port.id === targetPortId,
      );
      if (!sourcePort || !targetPort) {
        toast.error('Cannot connect: unknown port.');
        return;
      }
      if (!canConnect(sourcePort.kind, targetPort.kind)) {
        toast.error(
          `Incompatible ports: ${sourcePort.kind} cannot connect to ${targetPort.kind}.`,
        );
        return;
      }
      addEdge(
        createFlowEdgeForConnection({
          id: generateFlowEdgeId(),
          sourceNodeId,
          sourcePortId,
          targetNodeId,
          targetPortId,
        }),
      );
    },
    [addEdge, flowId],
  );

  // FS-0070: open the searchable compact picker at/near the cursor when
  // empty canvas is double-clicked. No document mutation happens here; the
  // picker selection below performs the single creation. Double-clicks on
  // existing nodes never reach this handler (filtered in FlowCanvas).
  const handleEmptyCanvasDoubleClick = React.useCallback(
    (event: FlowCanvasEmptyDoubleClick) => {
      setQuickPicker(event);
    },
    [],
  );

  const handleQuickPickerClose = React.useCallback(() => {
    setQuickPicker(null);
  }, []);

  // FS-0070: create one node at the clicked flow coordinate from a picker
  // selection. The definition comes from the registry-driven picker list,
  // so no catalog is duplicated here. addNode appends the node plus its
  // initial layout entry as a single history entry with a fresh authoring
  // UUID; compiler runtime IDs remain unrelated.
  const handleQuickPickerSelect = React.useCallback(
    (definition: FlowNodeDefinition) => {
      const placement = quickPicker;
      if (!placement) return;
      addNode({
        id: generateFlowNodeId(),
        definition,
        position: { x: placement.position.x, y: placement.position.y },
      });
      setQuickPicker(null);
    },
    [addNode, quickPicker],
  );

  // FS-0050: keyboard undo/redo and delete. Ctrl/Cmd+Z undoes,
  // Ctrl/Cmd+Shift+Z redoes, and Delete/Backspace removes the current
  // selection (nodes plus incident edges plus selected edges) as one
  // history command via the editor store. Editable targets opt out so
  // typing never mutates the graph. Capture phase plus stopPropagation
  // keeps XYFlow's built-in delete key handling from double-deleting.
  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const mod = event.ctrlKey || event.metaKey;
      if (mod && event.key.toLowerCase() === 'z') {
        if (isFlowStudioEditableTarget(event.target)) return;
        event.preventDefault();
        event.stopPropagation();
        if (event.shiftKey) {
          useFlowEditorStore.getState().redo();
        } else {
          useFlowEditorStore.getState().undo();
        }
        return;
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (isFlowStudioEditableTarget(event.target)) return;
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        event.preventDefault();
        event.stopPropagation();
        useFlowEditorStore.getState().deleteSelected();
      }
    }
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, []);

  const body = React.useMemo(() => {
    if (flowQuery.isPending) {
      return (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            Loading flow…
          </CardContent>
        </Card>
      );
    }
    if (flowQuery.isError) {
      const status = flowQuery.error instanceof FlowPageError ? flowQuery.error.status : undefined;
      if (status === 404) {
        return (
          <Card>
            <CardContent className="flex flex-col items-center py-14 text-center">
              <h3 className="font-semibold">Flow not found</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                This flow does not exist or you do not have access to it.
              </p>
              <Button asChild className="mt-5">
                <Link href="/rules">Back to rules</Link>
              </Button>
            </CardContent>
          </Card>
        );
      }
      return (
        <div className="space-y-4">
          <div
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
          >
            {flowQuery.error instanceof Error ? flowQuery.error.message : 'Failed to load flow'}
          </div>
          <Button variant="outline" onClick={() => void flowQuery.refetch()}>
            Retry
          </Button>
        </div>
      );
    }
    if (draftQuery.isPending) {
      return (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            Loading draft…
          </CardContent>
        </Card>
      );
    }
    if (draftQuery.isError) {
      return (
        <div className="space-y-4">
          <div
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
          >
            {draftQuery.error instanceof Error ? draftQuery.error.message : 'Failed to load draft'}
          </div>
          <Button variant="outline" onClick={() => void draftQuery.refetch()}>
            Retry
          </Button>
        </div>
      );
    }

    const flow = flowQuery.data;
    // FS-0048: header save-state display is derived solely from the autosave
    // hook status so semantic edits and layout-only moves share the same
    // Saved / Saving… / Unsaved changes / Save failed states. A failed save
    // stays visible as "Save failed" and is never shown as Saved.
    const saveDisplay = resolveFlowSaveDisplay(autosave.status);

    return (
      <div
        className="h-[calc(100vh-10rem)] min-h-[480px]"
        data-semantic-dirty={dirtyState.semanticDirty ? 'true' : 'false'}
        data-layout-dirty={dirtyState.layoutDirty ? 'true' : 'false'}
        data-autosave-status={autosave.status}
        data-autosave-error={autosave.error ?? ''}
      >
        <FlowStudioShell
          header={
            <FlowStudioHeader
              flowName={flow.name}
              saveState={saveDisplay.text}
              saveStatus={saveDisplay.status}
              deployDisabled
            />
          }
          palette={<NodePalette definitions={paletteDefinitions} capabilities={capabilityProfile} />}
          canvas={
            canvasViewWithValidation ? (
              <div className="flex h-full min-h-0 flex-col" data-testid="flow-studio-canvas-column">
                <div className="relative min-h-0 flex-1">
                  <FlowCanvas
                    edges={canvasViewWithValidation.edges}
                    nodes={canvasViewWithValidation.nodes}
                    selectedNodeIds={selectedNodeIds}
                    selectedEdgeIds={selectedEdgeIds}
                    nodeTypes={flowNodeTypes}
                    onNodeDragStop={handleCanvasNodeDragStop}
                    onSelectionChange={handleCanvasSelectionChange}
                    onPaletteDrop={handlePaletteDrop}
                    onConnect={handleConnect}
                    isValidConnection={isFlowConnectionValid}
                    onEmptyDoubleClick={handleEmptyCanvasDoubleClick}
                  />
                  {quickPicker ? (
                    <QuickNodePicker
                      definitions={paletteDefinitions}
                      position={quickPicker.screenPosition}
                      onSelect={handleQuickPickerSelect}
                      onClose={handleQuickPickerClose}
                    />
                  ) : null}
                </div>
                <FlowBottomPanel flowId={flowId} clientDiagnostics={flowDiagnostics} />
              </div>
            ) : (
              <div className="flex h-full items-center justify-center p-6">
                <p className="text-center text-sm text-muted-foreground">Loading canvas…</p>
              </div>
            )
          }
          inspector={<NodeInspector selectedNodeId={selectedNodeIds[0] ?? null} diagnostics={inspectorDiagnostics} documentDiagnostics={documentDiagnostics} />}
        />
      </div>
    );
  }, [flowQuery, draftQuery, canvasViewWithValidation, paletteDefinitions, capabilityProfile, dirtyState, autosave.status, autosave.error, handleCanvasNodeDragStop, selectedNodeIds, selectedEdgeIds, handleCanvasSelectionChange, handlePaletteDrop, handleConnect, isFlowConnectionValid, flowDiagnostics, inspectorDiagnostics, documentDiagnostics, quickPicker, handleEmptyCanvasDoubleClick, handleQuickPickerSelect, handleQuickPickerClose]);

  return (
    <AppLayout title={flowQuery.data ? flowQuery.data.name : 'Flow Studio'}>{body}</AppLayout>
  );
}
