'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
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
import { FlowCanvas, flowNodeTypes, type FlowCanvasNodeDragStopMove, type FlowCanvasSelection } from './canvas/flow-canvas';
import { toReactFlow } from './canvas/to-react-flow';
import { buildFlowDirtyBaseline, computeFlowDirtyState, type FlowDirtyBaseline } from '@/lib/flows/model/flow-dirty-state';
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

  const canvasView = React.useMemo(
    () => (canvasSource ? toReactFlow(canvasSource) : null),
    [canvasSource],
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
  React.useEffect(() => {
    setSavedBaseline(null);
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
  }, []);

  // FS-0047: debounced draft autosave. Fires only for committed store
  // changes while dirty, PUTs {spec,layout} to the Manager draft API (never
  // eKuiper), and clears dirty state via handleAutosaved on success. The
  // autosave status is mapped to header display below (FS-0048).
  const autosave = useFlowAutosave({
    flowId,
    spec: storeDocument?.spec ?? null,
    layout: storeDocument?.layout ?? null,
    baseline,
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
  const handleCanvasSelectionChange = React.useCallback(
    (selection: FlowCanvasSelection) => {
      setSelection({ nodeIds: selection.nodeIds, edgeIds: selection.edgeIds });
    },
    [setSelection],
  );

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
          palette={<NodePalette />}
          canvas={
            canvasView ? (
              <FlowCanvas
                edges={canvasView.edges}
                nodes={canvasView.nodes}
                selectedNodeIds={selectedNodeIds}
                selectedEdgeIds={selectedEdgeIds}
                nodeTypes={flowNodeTypes}
                onNodeDragStop={handleCanvasNodeDragStop}
                onSelectionChange={handleCanvasSelectionChange}
              />
            ) : (
              <div className="flex h-full items-center justify-center p-6">
                <p className="text-center text-sm text-muted-foreground">Loading canvas…</p>
              </div>
            )
          }
          inspector={<NodeInspector selectedNodeId={null} />}
        />
      </div>
    );
  }, [flowQuery, draftQuery, canvasView, dirtyState, autosave.status, autosave.error, handleCanvasNodeDragStop, selectedNodeIds, selectedEdgeIds, handleCanvasSelectionChange]);

  return (
    <AppLayout title={flowQuery.data ? flowQuery.data.name : 'Flow Studio'}>{body}</AppLayout>
  );
}
