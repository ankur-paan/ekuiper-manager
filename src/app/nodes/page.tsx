'use client';

import * as React from 'react';
import { CheckCircle2, Download, Loader2, MoreHorizontal, Plus, RefreshCw, Server, Star, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout';
import { ConfirmDialog } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useServerStore } from '@/stores/server-store';
import { ImportNodeRulesetModal } from '@/components/nodes/import-node-ruleset-modal';

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
  const [importRulesetNode, setImportRulesetNode] = React.useState<NodeRecord | null>(null);
  const [exportingId, setExportingId] = React.useState<string | null>(null);
  const [probingId, setProbingId] = React.useState<string | null>(null);

  const exportNodeRuleset = async (node: NodeRecord) => {
    setExportingId(node.id);
    try {
      const res = await fetch(`/api/nodes/${encodeURIComponent(node.id)}/ruleset`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${node.name.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}-ruleset.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Exported ruleset for ${node.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to export ruleset');
    } finally {
      setExportingId(null);
    }
  };

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
    setProbingId(node.id);
    try {
      const response = await fetch(`/api/nodes/${encodeURIComponent(node.id)}/probe`, { method: 'POST' });
      if (!response.ok) toast.error(await getError(response));
      else {
        toast.success('Connection check complete');
        await Promise.all([load(), refreshStore()]);
      }
    } finally {
      setProbingId(null);
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
      <div className="mx-auto max-w-6xl flex flex-col gap-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">eKuiper nodes</h2>
            <p className="mt-1 text-muted-foreground">Registered destinations used by every Manager operation.</p>
          </div>
          {isOwner && <Button onClick={openAdd}><Plus className="mr-2 size-4" aria-hidden="true" />Add node</Button>}
        </div>

        {loading ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-56 rounded-xl" />
            <Skeleton className="h-56 rounded-xl" />
          </div>
        ) : !nodes.length ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center py-14 text-center">
              <Server className="mb-4 size-10 text-muted-foreground" aria-hidden="true" />
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
                        <span className="truncate" title={node.name}>{node.name}</span>
                        {node.id === activeServerId && <Badge>Selected</Badge>}
                        {node.isDefault && <Star className="size-4 fill-amber-400 text-amber-400" aria-label="Default node" />}
                      </CardTitle>
                      <CardDescription className="mt-1 truncate" title={node.baseUrl}>{node.baseUrl}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {statusBadge(node)}
                      {isOwner && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Actions for ${node.name}`} className="touch-manipulation"><MoreHorizontal className="size-4" aria-hidden="true" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuGroup>
                              <DropdownMenuItem onSelect={() => openEdit(node)}>Edit</DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => void exportNodeRuleset(node)}>
                                <Download className="mr-2 size-4" aria-hidden="true" />
                                Export ruleset
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => setImportRulesetNode(node)}>
                                <Upload className="mr-2 size-4" aria-hidden="true" />
                                Import ruleset
                              </DropdownMenuItem>
                              {!node.isDefault && <DropdownMenuItem onSelect={() => void makeDefault(node)}><Star className="mr-2 size-4" aria-hidden="true" />Make default</DropdownMenuItem>}
                            </DropdownMenuGroup>
                            <DropdownMenuSeparator />
                            <DropdownMenuGroup>
                              <DropdownMenuItem className="text-destructive" onSelect={() => setDeleteNode(node)}><Trash2 className="mr-2 size-4" aria-hidden="true" />Remove</DropdownMenuItem>
                            </DropdownMenuGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {node.description && <p className="text-sm text-muted-foreground">{node.description}</p>}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><p className="text-xs text-muted-foreground">Version</p><p className="font-medium">{node.version ?? 'Not detected'}</p></div>
                    <div><p className="text-xs text-muted-foreground">Authorization</p><p className="font-medium">{node.hasAuthorization ? 'Configured' : 'Not configured'}</p></div>
                  </div>
                  {node.lastError && <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">{node.lastError}</div>}
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" disabled={node.id === activeServerId} onClick={() => setActiveServer(node.id)} className="touch-manipulation">
                      {node.id === activeServerId ? 'In use' : 'Use this node'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void probe(node)}
                      disabled={probingId === node.id}
                      className="touch-manipulation"
                    >
                      <RefreshCw className={`mr-2 size-4 ${probingId === node.id ? 'animate-spin' : ''}`} aria-hidden="true" />
                      {probingId === node.id ? 'Checking…' : 'Check connection'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void exportNodeRuleset(node)}
                      disabled={exportingId === node.id}
                      className="text-xs gap-1 touch-manipulation"
                    >
                      <Download className={`size-3.5 ${exportingId === node.id ? 'animate-bounce' : ''}`} aria-hidden="true" />
                      {exportingId === node.id ? 'Exporting…' : 'Export ruleset'}
                    </Button>
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
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2"><Label htmlFor="node-name">Name</Label><Input id="node-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Production eKuiper" /></div>
            <div className="flex flex-col gap-2"><Label htmlFor="node-url">REST URL</Label><Input id="node-url" value={form.baseUrl} onChange={(event) => setForm({ ...form, baseUrl: event.target.value })} placeholder="https://ekuiper.example.com:9081" /></div>
            <div className="flex flex-col gap-2"><Label htmlFor="node-description">Description</Label><Textarea id="node-description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} /></div>
            <div className="flex flex-col gap-2"><Label htmlFor="node-authorization">Authorization value</Label><Input id="node-authorization" type="password" autoComplete="off" value={form.authorization} onChange={(event) => setForm({ ...form, authorization: event.target.value })} placeholder={editing?.hasAuthorization ? 'Leave blank to keep current value' : 'Optional'} /><p className="text-xs text-muted-foreground">Enter the raw eKuiper Authorization header value when authentication is enabled.</p></div>
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="touch-manipulation">Cancel</Button>
            <Button onClick={() => void save()} disabled={saving || !form.name || !form.baseUrl} className="touch-manipulation">
              {saving && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />}
              {saving ? 'Saving…' : 'Save node'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={Boolean(deleteNode)} onOpenChange={(open) => !open && setDeleteNode(null)} title="Remove eKuiper node?" description={`Remove ${deleteNode?.name ?? 'this node'} from the Manager? This does not stop or delete the eKuiper installation.`} confirmLabel="Remove node" variant="danger" onConfirm={confirmDelete} />

      <ImportNodeRulesetModal
        node={importRulesetNode}
        open={Boolean(importRulesetNode)}
        onOpenChange={(open) => !open && setImportRulesetNode(null)}
        onSuccess={() => void load()}
      />
    </AppLayout>
  );
}
