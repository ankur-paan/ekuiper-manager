'use client';

import * as React from 'react';
import { CheckCircle2, MoreHorizontal, Plus, RefreshCw, Server, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout';
import { ConfirmDialog } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useServerStore } from '@/stores/server-store';

interface NodeRecord {
  id: string;
  name: string;
  baseUrl: string;
  description: string | null;
  hasAuthorization: boolean;
  isDefault: boolean;
  status: 'UNKNOWN' | 'ONLINE' | 'OFFLINE' | 'INCOMPATIBLE';
  version: string | null;
  lastCheckedAt: string | null;
  lastError: string | null;
}

interface FormState {
  name: string;
  baseUrl: string;
  description: string;
  authorization: string;
}

const emptyForm: FormState = {
  name: '',
  baseUrl: 'http://',
  description: '',
  authorization: '',
};

async function getError(response: Response): Promise<string> {
  const payload = await response.json().catch(() => null);
  return payload?.error?.message ?? `Request failed (${response.status})`;
}

function statusBadge(node: NodeRecord) {
  if (node.status === 'ONLINE') return <Badge className="bg-emerald-600">Online</Badge>;
  if (node.status === 'INCOMPATIBLE') return <Badge variant="secondary">Incompatible</Badge>;
  if (node.status === 'OFFLINE') return <Badge variant="destructive">Offline</Badge>;
  return <Badge variant="outline">Not checked</Badge>;
}

export default function NodesPage() {
  const { activeServerId, fetchServers: refreshStore, setActiveServer } = useServerStore();
  const [nodes, setNodes] = React.useState<NodeRecord[]>([]);
  const [isOwner, setIsOwner] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<NodeRecord | null>(null);
  const [form, setForm] = React.useState<FormState>(emptyForm);
  const [saving, setSaving] = React.useState(false);
  const [deleteNode, setDeleteNode] = React.useState<NodeRecord | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [nodesResponse, sessionResponse] = await Promise.all([
        fetch('/api/nodes', { cache: 'no-store' }),
        fetch('/api/auth/session', { cache: 'no-store' }),
      ]);
      if (!nodesResponse.ok) throw new Error(await getError(nodesResponse));
      const payload = await nodesResponse.json();
      const session = sessionResponse.ok ? await sessionResponse.json() : null;
      setNodes(payload.nodes);
      setIsOwner(session?.user?.role === 'OWNER');
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Failed to load nodes');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (node: NodeRecord) => {
    setEditing(node);
    setForm({
      name: node.name,
      baseUrl: node.baseUrl,
      description: node.description ?? '',
      authorization: '',
    });
    setDialogOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const response = await fetch(editing ? `/api/nodes/${encodeURIComponent(editing.id)}` : '/api/nodes', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          baseUrl: form.baseUrl,
          description: form.description,
          ...(form.authorization ? { authorization: form.authorization } : {}),
        }),
      });
      if (!response.ok) throw new Error(await getError(response));
      const payload = await response.json();
      if (!editing) {
        const selection = await fetch(`/api/nodes/${encodeURIComponent(payload.node.id)}/select`, {
          method: 'POST',
        });
        if (!selection.ok) throw new Error(await getError(selection));
      }
      toast.success(editing ? 'Node updated' : 'Node added and selected');
      setDialogOpen(false);
      await Promise.all([load(), refreshStore()]);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Failed to save node');
    } finally {
      setSaving(false);
    }
  };

  const probe = async (node: NodeRecord) => {
    const response = await fetch(`/api/nodes/${encodeURIComponent(node.id)}/probe`, { method: 'POST' });
    if (!response.ok) toast.error(await getError(response));
    else {
      toast.success('Connection check complete');
      await Promise.all([load(), refreshStore()]);
    }
  };

  const makeDefault = async (node: NodeRecord) => {
    const response = await fetch(`/api/nodes/${encodeURIComponent(node.id)}/default`, { method: 'POST' });
    if (!response.ok) toast.error(await getError(response));
    else {
      toast.success('Default node updated');
      await Promise.all([load(), refreshStore()]);
    }
  };

  const confirmDelete = async () => {
    if (!deleteNode) return;
    const response = await fetch(`/api/nodes/${encodeURIComponent(deleteNode.id)}`, { method: 'DELETE' });
    if (!response.ok) toast.error(await getError(response));
    else {
      toast.success('Node removed');
      setDeleteNode(null);
      await Promise.all([load(), refreshStore()]);
    }
  };

  return (
    <AppLayout title="Nodes">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">eKuiper nodes</h2>
            <p className="mt-1 text-muted-foreground">Registered destinations used by every Manager operation.</p>
          </div>
          {isOwner && <Button onClick={openAdd}><Plus className="mr-2 h-4 w-4" />Add node</Button>}
        </div>

        {!loading && !nodes.length ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center py-14 text-center">
              <Server className="mb-4 h-10 w-10 text-muted-foreground" />
              <h3 className="font-semibold">No eKuiper node configured</h3>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">Add the REST address of the eKuiper node you want to manage.</p>
              {isOwner && <Button className="mt-5" onClick={openAdd}>Add first node</Button>}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {nodes.map((node) => (
              <Card key={node.id} data-testid="node-card">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="flex items-center gap-2">
                        <span className="truncate">{node.name}</span>
                        {node.id === activeServerId && <Badge>Selected</Badge>}
                        {node.isDefault && <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-label="Default node" />}
                      </CardTitle>
                      <CardDescription className="mt-1 truncate">{node.baseUrl}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {statusBadge(node)}
                      {isOwner && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Actions for ${node.name}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => openEdit(node)}>Edit</DropdownMenuItem>
                            {!node.isDefault && <DropdownMenuItem onSelect={() => void makeDefault(node)}><Star className="mr-2 h-4 w-4" />Make default</DropdownMenuItem>}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onSelect={() => setDeleteNode(node)}><Trash2 className="mr-2 h-4 w-4" />Remove</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {node.description && <p className="text-sm text-muted-foreground">{node.description}</p>}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><p className="text-xs text-muted-foreground">Version</p><p className="font-medium">{node.version ?? 'Not detected'}</p></div>
                    <div><p className="text-xs text-muted-foreground">Authorization</p><p className="font-medium">{node.hasAuthorization ? 'Configured' : 'Not configured'}</p></div>
                  </div>
                  {node.lastError && <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">{node.lastError}</div>}
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" disabled={node.id === activeServerId} onClick={() => setActiveServer(node.id)}>
                      {node.id === activeServerId ? 'In use' : 'Use this node'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => void probe(node)}><RefreshCw className="mr-2 h-4 w-4" />Check connection</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit eKuiper node' : 'Add eKuiper node'}</DialogTitle>
            <DialogDescription>The address is validated and stored by the Manager. It is never accepted from ordinary API calls.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label htmlFor="node-name">Name</Label><Input id="node-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Production eKuiper" /></div>
            <div className="space-y-2"><Label htmlFor="node-url">REST URL</Label><Input id="node-url" value={form.baseUrl} onChange={(event) => setForm({ ...form, baseUrl: event.target.value })} placeholder="https://ekuiper.example.com:9081" /></div>
            <div className="space-y-2"><Label htmlFor="node-description">Description</Label><Textarea id="node-description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} /></div>
            <div className="space-y-2"><Label htmlFor="node-authorization">Authorization value</Label><Input id="node-authorization" type="password" autoComplete="off" value={form.authorization} onChange={(event) => setForm({ ...form, authorization: event.target.value })} placeholder={editing?.hasAuthorization ? 'Leave blank to keep current value' : 'Optional'} /><p className="text-xs text-muted-foreground">Enter the raw eKuiper Authorization header value when authentication is enabled.</p></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button onClick={() => void save()} disabled={saving || !form.name || !form.baseUrl}>{saving ? 'Saving…' : 'Save node'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={Boolean(deleteNode)} onOpenChange={(open) => !open && setDeleteNode(null)} title="Remove eKuiper node?" description={`Remove ${deleteNode?.name ?? 'this node'} from the Manager? This does not stop or delete the eKuiper installation.`} confirmLabel="Remove node" variant="danger" onConfirm={confirmDelete} />
    </AppLayout>
  );
}
