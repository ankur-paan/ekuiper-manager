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
import { FlowStudioHeader } from './shell/flow-studio-header';
import { NodeInspector } from './inspector/node-inspector';
import { NodePalette } from './palette/node-palette';

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
  // only. Nothing is persisted until the later autosave ticket.
  return {
    apiVersion: FLOW_DOCUMENT_VERSION,
    metadata,
    spec: { nodes: [], edges: [] },
    layout: { nodes: {} },
  };
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
    const draft = draftQuery.data ?? null;
    const document = buildDocument(flow, draft);

    return (
      <div className="h-[calc(100vh-10rem)] min-h-[480px]">
        <FlowStudioShell
          header={
            <FlowStudioHeader
              flowName={flow.name}
              saveState={draft ? 'Draft loaded' : 'No saved draft yet'}
              deployDisabled
            />
          }
          palette={<NodePalette />}
          canvas={
            <div className="flex h-full items-center justify-center p-6">
              <p className="text-center text-sm text-muted-foreground">
                {document.spec.nodes.length === 0 && document.spec.edges.length === 0
                  ? 'Empty flow — canvas binding arrives next.'
                  : `Draft with ${document.spec.nodes.length} nodes — canvas binding arrives next.`}
              </p>
            </div>
          }
          inspector={<NodeInspector selectedNodeId={null} />}
        />
      </div>
    );
  }, [flowQuery, draftQuery]);

  return (
    <AppLayout title={flowQuery.data ? flowQuery.data.name : 'Flow Studio'}>{body}</AppLayout>
  );
}
