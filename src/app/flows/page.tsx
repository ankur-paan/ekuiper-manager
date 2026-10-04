'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, RefreshCw, Search, Workflow } from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface FlowListRecord {
  id: string;
  name: string;
  description: string | null;
  targetNodeId: string | null;
  updatedAt: string;
}

function formatUpdated(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function FlowsPage() {
  const router = useRouter();
  const [flows, setFlows] = React.useState<FlowListRecord[]>([]);
  const [search, setSearch] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createName, setCreateName] = React.useState('');
  const [createError, setCreateError] = React.useState('');
  const [creating, setCreating] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/flows', { cache: 'no-store' });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message =
          payload && typeof payload === 'object' && 'error' in payload
            ? String((payload as { error: { message?: string } }).error?.message ?? 'Failed to load flows')
            : 'Failed to load flows';
        throw new Error(message);
      }
      const payload = (await response.json()) as { flows: FlowListRecord[] };
      setFlows(Array.isArray(payload.flows) ? payload.flows : []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to load flows');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    const name = createName.trim();
    if (name.length === 0) {
      setCreateError('Flow name is required');
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      const response = await fetch('/api/flows', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message =
          payload && typeof payload === 'object' && 'error' in payload
            ? String((payload as { error: { message?: string } }).error?.message ?? 'Failed to create flow')
            : 'Failed to create flow';
        throw new Error(message);
      }
      const payload = (await response.json()) as { flow: FlowListRecord };
      toast.success(`Created flow ${payload.flow.name}`);
      setCreateOpen(false);
      setCreateName('');
      router.push(`/flows/${encodeURIComponent(payload.flow.id)}`);
    } catch (reason) {
      setCreateError(reason instanceof Error ? reason.message : 'Failed to create flow');
    } finally {
      setCreating(false);
    }
  };

  const visible = flows.filter((flow) =>
    `${flow.name} ${flow.targetNodeId ?? ''}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <AppLayout title="Flows">
      <div className="mx-auto max-w-7xl flex flex-col gap-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Flows</h2>
            <p className="mt-1 text-muted-foreground">Visual stream-processing flows, deployed as eKuiper graph rules.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`mr-2 size-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              Refresh
            </Button>
            <Button onClick={() => { setCreateName(''); setCreateError(''); setCreateOpen(true); }}>
              <Plus className="mr-2 size-4" aria-hidden="true" />
              New flow
            </Button>
          </div>
        </div>
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" aria-hidden="true" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search flows"
            aria-label="Search flows"
            className="pl-9"
          />
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {loading ? (
          <Card>
            <CardContent className="divide-y p-0">
              {[1, 2, 3].map((n) => (
                <div key={n} className="flex items-center gap-4 px-6 py-4">
                  <Skeleton className="size-5 rounded shrink-0" />
                  <div className="flex-1 flex flex-col gap-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : !visible.length ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center py-14 text-center">
              <Workflow className="mb-4 size-10 text-muted-foreground" aria-hidden="true" />
              <h3 className="font-semibold">{search ? 'No matching flows' : 'No flows yet'}</h3>
              {!search && (
                <Button className="mt-5" onClick={() => { setCreateName(''); setCreateError(''); setCreateOpen(true); }}>
                  Create first flow
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="divide-y p-0">
              {visible.map((flow) => (
                <div key={flow.id} className="flex items-center gap-4 px-6 py-4">
                  <Workflow className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <Link href={`/flows/${encodeURIComponent(flow.id)}`} className="min-w-0 flex-1">
                    <span className="block truncate font-medium hover:text-primary" title={flow.name}>{flow.name}</span>
                    <span className="block truncate text-xs text-muted-foreground" title={`Target: ${flow.targetNodeId ?? '—'} · Updated: ${formatUpdated(flow.updatedAt)}`}>
                      Target: {flow.targetNodeId ?? '—'} · Updated: {formatUpdated(flow.updatedAt)}
                    </span>
                  </Link>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false);
            setCreateError('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New flow</DialogTitle>
            <DialogDescription>Create a flow, then design it in Flow Studio.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 py-2">
            <Label htmlFor="new-flow-name">Flow name</Label>
            <Input
              id="new-flow-name"
              value={createName}
              onChange={(event) => {
                setCreateName(event.target.value);
                setCreateError('');
              }}
              autoFocus
            />
            {createError && (
              <Alert variant="destructive">
                <AlertDescription>{createError}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating} className="touch-manipulation">
              Cancel
            </Button>
            <Button onClick={() => void create()} disabled={creating || !createName.trim()} className="touch-manipulation">
              {creating && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />}
              {creating ? 'Creating…' : 'Create flow'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
