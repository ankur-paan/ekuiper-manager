'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Database, MoreHorizontal, Pencil, Plus, RefreshCw, Table2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout';
import { ConfirmDialog } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ekuiperClient } from '@/lib/ekuiper/client';
import { useServerStore } from '@/stores/server-store';

type ResourceKind = 'stream' | 'table';

function plural(kind: ResourceKind): 'streams' | 'tables' {
  return kind === 'stream' ? 'streams' : 'tables';
}

function title(kind: ResourceKind): string {
  return kind === 'stream' ? 'Stream' : 'Table';
}

function resourceName(value: unknown): string {
  if (typeof value === 'string') return value;
  const item = value as Record<string, unknown>;
  return String(item?.name ?? item?.Name ?? '');
}

function resourceStatement(value: unknown): string {
  const item = value as Record<string, unknown>;
  return String(item?.Statement ?? item?.statement ?? item?.sql ?? '');
}

function createdResourceName(sql: string, kind: ResourceKind): string | null {
  const keyword = kind === 'stream' ? 'STREAM' : 'TABLE';
  const match = sql.match(new RegExp(`^\\s*CREATE\\s+${keyword}\\s+(?:\`([^\`]+)\`|([A-Za-z0-9_-]+))`, 'i'));
  return match?.[1] ?? match?.[2] ?? null;
}

export function SqlResourceList({ kind }: { kind: ResourceKind }) {
  const { servers, activeServerId } = useServerStore();
  const active = servers.find((node) => node.id === activeServerId);
  const [items, setItems] = React.useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [deleting, setDeleting] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!active) return;
    setLoading(true);
    setError('');
    try {
      const response = kind === 'stream'
        ? await ekuiperClient.listStreamDetails()
        : await ekuiperClient.listTableDetails();
      setItems((Array.isArray(response) ? response : []).map((item) =>
        typeof item === 'string' ? { name: item } : item as unknown as Record<string, unknown>,
      ));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : `Failed to load ${plural(kind)}`);
    } finally {
      setLoading(false);
    }
  }, [active, kind]);

  React.useEffect(() => { void load(); }, [load]);

  const remove = async () => {
    if (!deleting) return;
    try {
      if (kind === 'stream') await ekuiperClient.deleteStream(deleting);
      else await ekuiperClient.deleteTable(deleting);
      toast.success(`${title(kind)} deleted`);
      setDeleting(null);
      await load();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : `Failed to delete ${kind}`);
    }
  };

  const Icon = kind === 'stream' ? Database : Table2;
  return (
    <AppLayout title={title(kind) + 's'}>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div><h2 className="text-2xl font-semibold tracking-tight">{title(kind)}s</h2><p className="mt-1 text-muted-foreground">Definitions on {active?.name ?? 'the selected eKuiper node'}.</p></div>
          <div className="flex gap-2"><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Button><Button asChild><Link href={`/${plural(kind)}/new`}><Plus className="mr-2 h-4 w-4" />Create {kind}</Link></Button></div>
        </div>
        {error && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}
        {!active ? (
          <Card className="border-dashed"><CardContent className="py-12 text-center text-sm text-muted-foreground">Select an eKuiper node first.</CardContent></Card>
        ) : !loading && !items.length ? (
          <Card className="border-dashed"><CardContent className="flex flex-col items-center py-14 text-center"><Icon className="mb-4 h-10 w-10 text-muted-foreground" /><h3 className="font-semibold">No {plural(kind)} yet</h3><p className="mt-1 text-sm text-muted-foreground">Create the first {kind} definition for this node.</p><Button asChild className="mt-5"><Link href={`/${plural(kind)}/new`}>Create {kind}</Link></Button></CardContent></Card>
        ) : (
          <Card>
            <CardContent className="divide-y p-0">
              {items.map((item) => {
                const name = resourceName(item);
                const type = String(item.type ?? item.Type ?? '');
                const format = String(item.format ?? item.Format ?? '');
                return <div key={name} className="flex items-center gap-4 px-6 py-4"><Icon className="h-5 w-5 text-muted-foreground" /><Link href={`/${plural(kind)}/${encodeURIComponent(name)}`} className="min-w-0 flex-1"><span className="block truncate font-medium hover:text-primary">{name}</span><span className="text-xs text-muted-foreground">{[type, format].filter(Boolean).join(' · ') || `${title(kind)} definition`}</span></Link><div className="hidden gap-2 sm:flex">{type && <Badge variant="secondary">{type}</Badge>}{format && <Badge variant="outline">{format}</Badge>}</div><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Actions for ${name}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem asChild><Link href={`/${plural(kind)}/${encodeURIComponent(name)}/edit`}><Pencil className="mr-2 h-4 w-4" />Edit</Link></DropdownMenuItem><DropdownMenuItem className="text-destructive" onSelect={() => setDeleting(name)}><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>;
              })}
            </CardContent>
          </Card>
        )}
      </div>
      <ConfirmDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)} title={`Delete ${kind}?`} description={`Delete ${deleting ?? `this ${kind}`} from eKuiper? Rules that depend on it may stop working.`} confirmLabel={`Delete ${kind}`} variant="danger" onConfirm={remove} />
    </AppLayout>
  );
}

export function SqlResourceEditor({ kind, name }: { kind: ResourceKind; name?: string }) {
  const router = useRouter();
  const { servers, activeServerId } = useServerStore();
  const active = servers.find((node) => node.id === activeServerId);
  const [sql, setSql] = React.useState('');
  const [loading, setLoading] = React.useState(Boolean(name));
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!active || !name) return;
    setLoading(true);
    const operation = kind === 'stream' ? ekuiperClient.getStream(name) : ekuiperClient.getTable(name);
    operation.then((value) => setSql(resourceStatement(value))).catch((reason) => toast.error(reason.message)).finally(() => setLoading(false));
  }, [active, kind, name]);

  const save = async () => {
    if (!sql.trim()) { toast.error('SQL definition is required'); return; }
    setSaving(true);
    try {
      if (kind === 'stream') {
        if (name) await ekuiperClient.updateStream(name, sql.trim());
        else await ekuiperClient.createStream(sql.trim());
      } else if (name) await ekuiperClient.updateTable(name, sql.trim());
      else await ekuiperClient.createTable(sql.trim());
      toast.success(`${title(kind)} ${name ? 'updated' : 'created'}`);
      const destinationName = name ?? createdResourceName(sql, kind);
      router.push(
        `/${plural(kind)}${destinationName ? `/${encodeURIComponent(destinationName)}` : ''}`,
      );
      router.refresh();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : `Failed to save ${kind}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout title={`${name ? 'Edit' : 'Create'} ${kind}`}>
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center gap-3"><Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Go back"><ArrowLeft className="h-5 w-5" /></Button><div><h2 className="text-2xl font-semibold tracking-tight">{name ? `Edit ${name}` : `Create ${kind}`}</h2><p className="mt-1 text-sm text-muted-foreground">Submit one complete eKuiper SQL definition.</p></div></div>
        <Card><CardHeader><CardTitle>Definition</CardTitle><CardDescription>The Manager sends this SQL unchanged to the selected eKuiper node.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="space-y-2"><Label htmlFor="resource-sql">eKuiper SQL</Label><Textarea id="resource-sql" value={sql} onChange={(event) => setSql(event.target.value)} className="min-h-80 font-mono text-sm" spellCheck={false} disabled={loading} placeholder={kind === 'stream' ? 'CREATE STREAM sensor (deviceId STRING, value FLOAT) WITH (TYPE="memory", DATASOURCE="sensor", FORMAT="json");' : 'CREATE TABLE devices (deviceId STRING, site STRING) WITH (TYPE="memory", DATASOURCE="devices", KIND="lookup");'} /></div><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => router.back()}>Cancel</Button><Button onClick={() => void save()} disabled={saving || loading || !active}>{saving ? 'Saving…' : `Save ${kind}`}</Button></div></CardContent></Card>
      </div>
    </AppLayout>
  );
}

export function SqlResourceDetail({ kind, name }: { kind: ResourceKind; name: string }) {
  const router = useRouter();
  const { servers, activeServerId } = useServerStore();
  const active = servers.find((node) => node.id === activeServerId);
  const [value, setValue] = React.useState<Record<string, unknown> | null>(null);
  const [error, setError] = React.useState('');
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!active) return;
    try {
      const response = kind === 'stream' ? await ekuiperClient.getStream(name) : await ekuiperClient.getTable(name);
      setValue(response as unknown as Record<string, unknown>);
      setError('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : `Failed to load ${kind}`); }
  }, [active, kind, name]);
  React.useEffect(() => { void load(); }, [load]);

  const remove = async () => {
    if (kind === 'stream') await ekuiperClient.deleteStream(name); else await ekuiperClient.deleteTable(name);
    toast.success(`${title(kind)} deleted`);
    router.push(`/${plural(kind)}`);
  };

  return (
    <AppLayout title={title(kind)}>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div className="flex items-center gap-3"><Button variant="ghost" size="icon" asChild><Link href={`/${plural(kind)}`} aria-label={`Back to ${plural(kind)}`}><ArrowLeft className="h-5 w-5" /></Link></Button><div><h2 className="text-2xl font-semibold tracking-tight">{name}</h2><p className="mt-1 text-muted-foreground">{title(kind)} definition on {active?.name ?? 'eKuiper'}.</p></div></div><div className="flex gap-2"><Button variant="outline" onClick={() => setConfirmDelete(true)}><Trash2 className="mr-2 h-4 w-4" />Delete</Button><Button asChild><Link href={`/${plural(kind)}/${encodeURIComponent(name)}/edit`}><Pencil className="mr-2 h-4 w-4" />Edit</Link></Button></div></div>
        {error && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}
        <Card><CardHeader><CardTitle>SQL statement</CardTitle><CardDescription>The definition reported by eKuiper.</CardDescription></CardHeader><CardContent><pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-muted p-4 font-mono text-sm">{value ? resourceStatement(value) || 'Statement not reported' : 'Loading…'}</pre></CardContent></Card>
        {value && <Card><CardHeader><CardTitle>Resolved definition</CardTitle><CardDescription>Fields and options returned by eKuiper.</CardDescription></CardHeader><CardContent><pre className="max-h-[32rem] overflow-auto rounded-md bg-muted p-4 text-xs">{JSON.stringify(value, null, 2)}</pre></CardContent></Card>}
      </div>
      <ConfirmDialog open={confirmDelete} onOpenChange={setConfirmDelete} title={`Delete ${kind}?`} description={`Delete ${name} from eKuiper? Dependent rules may fail.`} confirmLabel={`Delete ${kind}`} variant="danger" onConfirm={remove} />
    </AppLayout>
  );
}
