'use client';

import * as React from 'react';
import { MoreHorizontal, Network, Plus, RefreshCw, Trash2 } from 'lucide-react';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ekuiperClient } from '@/lib/ekuiper/client';
import { useServerStore } from '@/stores/server-store';

interface SharedConnection {
  id: string;
  typ: string;
  props: Record<string, unknown>;
  status?: string;
  err?: string;
  refCount?: number;
}

interface MetadataRecord {
  name?: string;
  type?: string;
  description?: string;
  [key: string]: unknown;
}

function containsRedaction(value: unknown): boolean {
  if (value === '[redacted]') return true;
  if (Array.isArray(value)) return value.some(containsRedaction);
  if (value && typeof value === 'object') return Object.values(value).some(containsRedaction);
  return false;
}

export default function ConnectionsPage() {
  const { servers, activeServerId } = useServerStore();
  const active = servers.find((node) => node.id === activeServerId);
  const [connections, setConnections] = React.useState<SharedConnection[]>([]);
  const [sources, setSources] = React.useState<MetadataRecord[]>([]);
  const [sinks, setSinks] = React.useState<MetadataRecord[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SharedConnection | null>(null);
  const [id, setId] = React.useState('');
  const [type, setType] = React.useState('');
  const [props, setProps] = React.useState('{}');
  const [deleteConnection, setDeleteConnection] = React.useState<SharedConnection | null>(null);

  const load = React.useCallback(async () => {
    if (!active) return;
    setLoading(true);
    try {
      const [connectionData, sourceData, sinkData] = await Promise.all([
        ekuiperClient.listConnections(),
        ekuiperClient.listSourceMetadata(),
        ekuiperClient.listSinkMetadata(),
      ]);
      setConnections(Array.isArray(connectionData) ? connectionData : []);
      setSources(Array.isArray(sourceData) ? sourceData as unknown as MetadataRecord[] : []);
      setSinks(Array.isArray(sinkData) ? sinkData as unknown as MetadataRecord[] : []);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Failed to load connector resources');
    } finally {
      setLoading(false);
    }
  }, [active]);
  React.useEffect(() => { void load(); }, [load]);

  const openCreate = () => { setEditing(null); setId(''); setType(''); setProps('{}'); setDialogOpen(true); };
  const openEdit = async (connection: SharedConnection) => {
    try {
      const detail = await ekuiperClient.getConnection(connection.id);
      setEditing(connection);
      setId(connection.id);
      setType(detail.typ ?? connection.typ);
      setProps(JSON.stringify(detail.props ?? {}, null, 2));
      setDialogOpen(true);
    } catch (reason) { toast.error(reason instanceof Error ? reason.message : 'Failed to load connection'); }
  };

  const save = async () => {
    try {
      const parsed = JSON.parse(props);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Properties must be a JSON object');
      if (containsRedaction(parsed)) throw new Error('Replace every [redacted] value before saving');
      const payload = { id, typ: type, props: parsed };
      if (editing) await ekuiperClient.updateConnection(editing.id, payload);
      else await ekuiperClient.createConnection(payload);
      toast.success(`Connection ${editing ? 'updated' : 'created'}`);
      setDialogOpen(false);
      await load();
    } catch (reason) { toast.error(reason instanceof Error ? reason.message : 'Failed to save connection'); }
  };

  const remove = async () => {
    if (!deleteConnection) return;
    try { await ekuiperClient.deleteConnection(deleteConnection.id); toast.success('Connection deleted'); setDeleteConnection(null); await load(); }
    catch (reason) { toast.error(reason instanceof Error ? reason.message : 'Failed to delete connection'); }
  };

  return (
    <AppLayout title="Connections">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h2 className="text-2xl font-semibold tracking-tight">Connections and connectors</h2><p className="mt-1 text-muted-foreground">Shared connections and installed metadata from {active?.name ?? 'eKuiper'}.</p></div><div className="flex gap-2"><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Button><Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Create connection</Button></div></div>
        <Tabs defaultValue="connections">
          <TabsList><TabsTrigger value="connections">Shared connections</TabsTrigger><TabsTrigger value="sources">Sources</TabsTrigger><TabsTrigger value="sinks">Sinks</TabsTrigger></TabsList>
          <TabsContent value="connections" className="mt-4"><Card><CardContent className="divide-y p-0">{!connections.length ? <p className="p-10 text-center text-sm text-muted-foreground">No shared connections configured.</p> : connections.map((connection) => <div key={connection.id} className="flex items-center gap-4 px-6 py-4"><Network className="h-5 w-5 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="truncate font-medium">{connection.id}</p><p className="text-xs text-muted-foreground">{connection.typ}</p>{connection.err && <p className="mt-1 text-xs text-destructive">{connection.err}</p>}</div>{connection.status && <Badge variant={connection.status === 'connected' ? 'default' : 'secondary'}>{connection.status}</Badge>}<DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Actions for ${connection.id}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => void openEdit(connection)}>Edit</DropdownMenuItem><DropdownMenuItem className="text-destructive" onSelect={() => setDeleteConnection(connection)}><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>)}</CardContent></Card></TabsContent>
          <TabsContent value="sources" className="mt-4"><MetadataGrid title="Source connectors" items={sources} /></TabsContent>
          <TabsContent value="sinks" className="mt-4"><MetadataGrid title="Sink connectors" items={sinks} /></TabsContent>
        </Tabs>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent><DialogHeader><DialogTitle>{editing ? 'Edit shared connection' : 'Create shared connection'}</DialogTitle><DialogDescription>Connector properties are passed to eKuiper. Secret values are never read back into an editable form.</DialogDescription></DialogHeader><div className="space-y-4 py-2"><div className="space-y-2"><Label htmlFor="connection-id">ID</Label><Input id="connection-id" value={id} onChange={(event) => setId(event.target.value)} disabled={Boolean(editing)} /></div><div className="space-y-2"><Label htmlFor="connection-type">Connector type</Label><Input id="connection-type" value={type} onChange={(event) => setType(event.target.value)} placeholder="mqtt" /></div><div className="space-y-2"><Label htmlFor="connection-properties">Properties</Label><Textarea id="connection-properties" value={props} onChange={(event) => setProps(event.target.value)} className="min-h-64 font-mono text-sm" spellCheck={false} /></div></div><DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button onClick={() => void save()} disabled={!id || !type}>Save connection</Button></DialogFooter></DialogContent></Dialog>
      <ConfirmDialog open={Boolean(deleteConnection)} onOpenChange={(open) => !open && setDeleteConnection(null)} title="Delete shared connection?" description={`Delete ${deleteConnection?.id ?? 'this connection'} from eKuiper? Resources that reference it may fail.`} confirmLabel="Delete connection" variant="danger" onConfirm={remove} />
    </AppLayout>
  );
}

function MetadataGrid({ title, items }: { title: string; items: MetadataRecord[] }) {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{items.map((item, index) => { const name = String(item.name ?? item.type ?? `Connector ${index + 1}`); return <Card key={`${name}-${index}`}><CardHeader><CardTitle className="text-base">{name}</CardTitle><CardDescription>{String(item.description ?? 'Installed eKuiper connector')}</CardDescription></CardHeader><CardContent><pre className="max-h-56 overflow-auto rounded-md bg-muted p-3 text-[11px]">{JSON.stringify(item, null, 2)}</pre></CardContent></Card>; })}{!items.length && <Card className="border-dashed sm:col-span-2 xl:col-span-3"><CardContent className="py-12 text-center text-sm text-muted-foreground">No connector metadata reported.</CardContent></Card>}</div>;
}
