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
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ConnectorIcon } from '@/components/connectors/connector-icon';
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
  const [tableFilter, setTableFilter] = React.useState<'all' | 'scan' | 'lookup'>('all');

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

  const displayedItems = React.useMemo(() => {
    if (kind !== 'table' || tableFilter === 'all') return items;
    return items.filter((item) => {
      const opts = (item.Options || item.options || {}) as Record<string, any>;
      const isLookup = String(opts.KIND || opts.kind || item.kind || '').toLowerCase() === 'lookup';
      return tableFilter === 'lookup' ? isLookup : !isLookup;
    });
  }, [items, kind, tableFilter]);

  const Icon = kind === 'stream' ? Database : Table2;
  return (
    <AppLayout title={title(kind) + 's'}>
      <div className="mx-auto max-w-6xl flex flex-col gap-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div><h2 className="text-2xl font-semibold tracking-tight">{title(kind)}s</h2><p className="mt-1 text-muted-foreground">Definitions on {active?.name ?? 'the selected eKuiper node'}.</p></div>
          <div className="flex gap-2"><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 size-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Button><Button asChild><Link href={`/${plural(kind)}/new`}><Plus className="mr-2 size-4" />Create {kind}</Link></Button></div>
        </div>

        {kind === 'table' && (
          <div className="flex items-center gap-1 border-b pb-2">
            <Button
              variant={tableFilter === 'all' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setTableFilter('all')}
            >
              All Tables ({items.length})
            </Button>
            <Button
              variant={tableFilter === 'scan' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setTableFilter('scan')}
            >
              Scan / Streaming
            </Button>
            <Button
              variant={tableFilter === 'lookup' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setTableFilter('lookup')}
            >
              Lookup Tables
            </Button>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {!active ? (
          <Card className="border-dashed"><CardContent className="py-12 text-center text-sm text-muted-foreground">Select an eKuiper node first.</CardContent></Card>
        ) : !loading && !displayedItems.length ? (
          <Card className="border-dashed"><CardContent className="flex flex-col items-center py-14 text-center"><Icon className="mb-4 size-10 text-muted-foreground" /><h3 className="font-semibold">No {tableFilter !== 'all' ? `${tableFilter} ` : ''}{plural(kind)} yet</h3><p className="mt-1 text-sm text-muted-foreground">Create the first {kind} definition for this node.</p><Button asChild className="mt-5"><Link href={`/${plural(kind)}/new`}>Create {kind}</Link></Button></CardContent></Card>
        ) : (
          <Card>
            <CardContent className="divide-y p-0">
              {displayedItems.map((item) => {
                const name = resourceName(item);
                const opts = (item.Options || item.options || {}) as Record<string, any>;
                const type = String(item.type ?? item.Type ?? opts.TYPE ?? opts.type ?? '');
                const format = String(item.format ?? item.Format ?? opts.FORMAT ?? opts.format ?? '');
                const isLookup = String(opts.KIND || opts.kind || item.kind || '').toLowerCase() === 'lookup';

                return (
                  <div key={name} className="flex items-center gap-4 px-6 py-4">
                    <ConnectorIcon
                      type={type}
                      className="size-5 shrink-0"
                      fallback={<Icon className="size-5 text-muted-foreground shrink-0" />}
                    />
                    <Link href={`/${plural(kind)}/${encodeURIComponent(name)}`} className="min-w-0 flex-1">
                      <span className="block truncate font-medium hover:text-primary" title={name}>{name}</span>
                      <span className="text-xs text-muted-foreground">
                        {[type, format].filter(Boolean).join(' · ') || `${title(kind)} definition`}
                      </span>
                    </Link>
                    <div className="hidden gap-1.5 sm:flex items-center">
                      {kind === 'table' && (
                        <Badge variant="outline" className={`text-[10px] uppercase font-mono ${isLookup ? 'border-primary text-primary' : ''}`}>
                          {isLookup ? 'LOOKUP' : 'SCAN'}
                        </Badge>
                      )}
                      {type && (
                        <Badge variant="secondary" className="text-[10px] font-mono gap-1">
                          <ConnectorIcon type={type} className="size-2.5" />
                          {type}
                        </Badge>
                      )}
                      {format && <Badge variant="outline" className="text-[10px] uppercase font-mono">{format}</Badge>}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={`Actions for ${name}`}>
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuGroup>
                          <DropdownMenuItem asChild>
                            <Link href={`/${plural(kind)}/${encodeURIComponent(name)}/edit`}>
                              <Pencil className="mr-2 size-4" />Edit
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onSelect={() => setDeleting(name)}>
                            <Trash2 className="mr-2 size-4" />Delete
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>
      <ConfirmDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)} title={`Delete ${kind}?`} description={`Delete ${deleting ?? `this ${kind}`} from eKuiper? Rules that depend on it may stop working.`} confirmLabel={`Delete ${kind}`} variant="danger" onConfirm={remove} />
    </AppLayout>
  );
}

import { StreamVisualEditor, parseFieldsFromEkuiper } from './stream-visual-editor';
import { FieldsTable } from '@/components/connectors/fields-table';

export function SqlResourceEditor({ kind, name }: { kind: ResourceKind; name?: string }) {
  return <StreamVisualEditor kind={kind} name={name} />;
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

  const rawFields = (value?.StreamFields ?? value?.streamFields) as any[];
  const fieldNodes = React.useMemo(() => {
    return Array.isArray(rawFields) ? parseFieldsFromEkuiper(rawFields) : [];
  }, [rawFields]);

  const options = (value?.Options ?? value?.options) as Record<string, any> | undefined;

  return (
    <AppLayout title={title(kind)}>
      <div className="mx-auto max-w-5xl flex flex-col gap-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link href={`/${plural(kind)}`} aria-label={`Back to ${plural(kind)}`}>
                <ArrowLeft className="size-5" />
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-semibold tracking-tight">{name}</h2>
                <Badge variant="outline" className="text-xs uppercase">
                  {kind}
                </Badge>
                {options?.TYPE && (
                  <Badge variant="secondary" className="font-mono text-xs gap-1.5">
                    <ConnectorIcon type={String(options.TYPE)} className="size-3.5" />
                    {String(options.TYPE)}
                  </Badge>
                )}
                {options?.FORMAT && (
                  <Badge variant="outline" className="text-xs uppercase">
                    {String(options.FORMAT)}
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-muted-foreground">
                {title(kind)} definition on {active?.name ?? 'eKuiper'}.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="mr-2 size-4" />Delete
            </Button>
            <Button asChild>
              <Link href={`/${plural(kind)}/${encodeURIComponent(name)}/edit`}>
                <Pencil className="mr-2 size-4" />Edit
              </Link>
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Options Overview */}
        {options && Object.keys(options).length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Options & Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
                {Object.entries(options).map(([k, v]) => (
                  <div key={k} className="rounded-md border p-2.5 bg-muted/20">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                      {k}
                    </span>
                    <span className="font-mono text-xs font-medium text-foreground mt-0.5 block truncate" title={String(v)}>
                      {String(v)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Schema Fields */}
        {fieldNodes.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Schema Columns ({fieldNodes.length})</CardTitle>
              <CardDescription className="text-xs">
                Strongly-typed fields recognized by eKuiper SQL for this {kind}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldsTable fields={fieldNodes} onChange={() => {}} disabled={true} />
            </CardContent>
          </Card>
        )}

        {/* SQL Statement */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">SQL statement</CardTitle>
            <CardDescription className="text-xs">The definition reported by eKuiper.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-muted p-4 font-mono text-xs leading-relaxed">
              {value ? resourceStatement(value) || 'Statement not reported' : 'Loading…'}
            </pre>
          </CardContent>
        </Card>

        {/* Resolved definition */}
        {value && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Resolved definition</CardTitle>
              <CardDescription className="text-xs">Raw JSON returned by eKuiper node.</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="max-h-[28rem] overflow-auto rounded-md bg-muted p-4 font-mono text-xs">
                {JSON.stringify(value, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${kind}?`}
        description={`Delete ${name} from eKuiper? Dependent rules may fail.`}
        confirmLabel={`Delete ${kind}`}
        variant="danger"
        onConfirm={remove}
      />
    </AppLayout>
  );
}
