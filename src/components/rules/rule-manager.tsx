'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Activity,
  ArrowLeft,
  Copy,
  FileCode2,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  RotateCw,
  Search,
  Square,
  Tags,
  Trash2,
  Workflow,
} from 'lucide-react';
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ekuiperClient } from '@/lib/ekuiper/client';
import { duplicateRule as buildDuplicateRule } from '@/lib/ekuiper/rule-designer';
import { useServerStore } from '@/stores/server-store';

interface RuleListRecord {
  id: string;
  name?: string;
  status?: string;
  version?: number;
  tags?: string[];
  trace?: boolean;
}

function running(status?: string): boolean {
  return status?.toLowerCase() === 'running';
}

function stopped(status?: string): boolean {
  return status?.toLowerCase() === 'stopped';
}

export function RuleList() {
  const router = useRouter();
  const { servers, activeServerId } = useServerStore();
  const active = servers.find((node) => node.id === activeServerId);
  const [rules, setRules] = React.useState<RuleListRecord[]>([]);
  const [search, setSearch] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [deleteRule, setDeleteRule] = React.useState<RuleListRecord | null>(null);
  const [duplicateSource, setDuplicateSource] = React.useState<RuleListRecord | null>(null);
  const [duplicateId, setDuplicateId] = React.useState('');
  const [duplicateError, setDuplicateError] = React.useState('');
  const [duplicating, setDuplicating] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!active) return;
    setLoading(true);
    setError('');
    try {
      const response = await ekuiperClient.listRules();
      setRules((Array.isArray(response) ? response : []).map((item) =>
        typeof item === 'string' ? { id: item } : item as RuleListRecord,
      ));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to load rules');
    } finally {
      setLoading(false);
    }
  }, [active]);
  React.useEffect(() => { void load(); }, [load]);

  const control = async (rule: RuleListRecord, action: 'start' | 'stop' | 'restart') => {
    setBusy(rule.id);
    try {
      if (action === 'start') await ekuiperClient.startRule(rule.id);
      else if (action === 'stop') await ekuiperClient.stopRule(rule.id);
      else await ekuiperClient.restartRule(rule.id);
      toast.success(`${rule.id} ${action} requested`);
      await load();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : `Failed to ${action} rule`);
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!deleteRule) return;
    try {
      await ekuiperClient.deleteRule(deleteRule.id);
      toast.success('Rule deleted');
      setDeleteRule(null);
      await load();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Failed to delete rule');
    }
  };

  const openDuplicate = (rule: RuleListRecord) => {
    setDuplicateSource(rule);
    setDuplicateId(`${rule.id}_copy`);
    setDuplicateError('');
  };

  const duplicate = async () => {
    if (!duplicateSource) return;
    const nextId = duplicateId.trim();
    if (!/^[A-Za-z0-9_-]+$/.test(nextId)) {
      setDuplicateError('Rule ID may contain letters, numbers, hyphen, and underscore');
      return;
    }
    if (rules.some((rule) => rule.id === nextId)) {
      setDuplicateError('A rule with this ID already exists');
      return;
    }
    setDuplicating(true);
    setDuplicateError('');
    try {
      const source = await ekuiperClient.getRule(duplicateSource.id);
      await ekuiperClient.createRule(buildDuplicateRule(source, nextId));
      toast.success(`Created stopped copy ${nextId}`);
      setDuplicateSource(null);
      await load();
      router.push(`/rules/${encodeURIComponent(nextId)}/edit`);
    } catch (reason) {
      setDuplicateError(reason instanceof Error ? reason.message : 'Failed to duplicate rule');
    } finally {
      setDuplicating(false);
    }
  };

  const visible = rules.filter((rule) =>
    `${rule.id} ${rule.name ?? ''} ${(rule.tags ?? []).join(' ')}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <AppLayout title="Rules">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div><h2 className="text-2xl font-semibold tracking-tight">Rules</h2><p className="mt-1 text-muted-foreground">Create and operate rules on {active?.name ?? 'the selected eKuiper node'}.</p></div>
          <div className="flex gap-2"><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Button><Button asChild><Link href="/rules/new"><Plus className="mr-2 h-4 w-4" />Create rule</Link></Button></div>
        </div>
        <div className="relative max-w-sm"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search rules or tags" className="pl-9" /></div>
        {error && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}
        {!active ? <Card className="border-dashed"><CardContent className="py-12 text-center text-sm text-muted-foreground">Select an eKuiper node first.</CardContent></Card> : !loading && !visible.length ? <Card className="border-dashed"><CardContent className="flex flex-col items-center py-14 text-center"><Workflow className="mb-4 h-10 w-10 text-muted-foreground" /><h3 className="font-semibold">{search ? 'No matching rules' : 'No rules yet'}</h3>{!search && <Button asChild className="mt-5"><Link href="/rules/new">Create first rule</Link></Button>}</CardContent></Card> : <Card><CardContent className="divide-y p-0">{visible.map((rule) => <div key={rule.id} className="flex items-center gap-4 px-6 py-4"><span className={`h-2.5 w-2.5 rounded-full ${running(rule.status) ? 'bg-emerald-500' : stopped(rule.status) ? 'bg-slate-400' : 'bg-amber-500'}`} aria-hidden="true" /><Link href={`/rules/${encodeURIComponent(rule.id)}`} className="min-w-0 flex-1"><span className="block truncate font-medium hover:text-primary">{rule.name || rule.id}</span>{rule.name && <span className="block truncate text-xs text-muted-foreground">{rule.id}</span>}<span className="mt-1 flex flex-wrap gap-1">{(rule.tags ?? []).map((tag) => <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>)}</span></Link><Badge variant={running(rule.status) ? 'default' : 'secondary'}>{rule.status ?? 'unknown'}</Badge><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" disabled={busy === rule.id} aria-label={`Actions for ${rule.id}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">{!running(rule.status) && <DropdownMenuItem onSelect={() => void control(rule, 'start')}><Play className="mr-2 h-4 w-4" />Start</DropdownMenuItem>}{running(rule.status) && <DropdownMenuItem onSelect={() => void control(rule, 'stop')}><Square className="mr-2 h-4 w-4" />Stop</DropdownMenuItem>}<DropdownMenuItem onSelect={() => void control(rule, 'restart')}><RotateCw className="mr-2 h-4 w-4" />Restart</DropdownMenuItem><DropdownMenuItem asChild><Link href={`/rules/${encodeURIComponent(rule.id)}/edit`}><Pencil className="mr-2 h-4 w-4" />Edit</Link></DropdownMenuItem><DropdownMenuItem onSelect={() => openDuplicate(rule)}><Copy className="mr-2 h-4 w-4" />Duplicate</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem className="text-destructive" onSelect={() => setDeleteRule(rule)}><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>)}</CardContent></Card>}
      </div>
      <Dialog open={Boolean(duplicateSource)} onOpenChange={(open) => { if (!open) { setDuplicateSource(null); setDuplicateError(''); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Duplicate rule</DialogTitle><DialogDescription>Create a stopped copy of {duplicateSource?.id}. Runtime state and status are not copied.</DialogDescription></DialogHeader>
          <div className="space-y-2 py-2"><Label htmlFor="duplicate-rule-id">New rule ID</Label><Input id="duplicate-rule-id" value={duplicateId} onChange={(event) => { setDuplicateId(event.target.value); setDuplicateError(''); }} autoFocus />{duplicateError && <p role="alert" className="text-sm text-destructive">{duplicateError}</p>}</div>
          <DialogFooter><Button variant="outline" onClick={() => setDuplicateSource(null)} disabled={duplicating}>Cancel</Button><Button onClick={() => void duplicate()} disabled={duplicating || !duplicateId.trim()}>{duplicating ? 'Duplicating…' : 'Duplicate stopped'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={Boolean(deleteRule)} onOpenChange={(open) => !open && setDeleteRule(null)} title="Delete rule?" description={`Delete ${deleteRule?.id ?? 'this rule'} from eKuiper? This cannot be undone.`} confirmLabel="Delete rule" variant="danger" onConfirm={remove} />
    </AppLayout>
  );
}

type RuleTab = 'definition' | 'status' | 'topology' | 'schema' | 'explain' | 'trace';
const tabs: Array<{ id: RuleTab; label: string }> = [
  { id: 'definition', label: 'Definition' }, { id: 'status', label: 'Status' },
  { id: 'topology', label: 'Topology' }, { id: 'schema', label: 'Output schema' },
  { id: 'explain', label: 'Explain' }, { id: 'trace', label: 'Trace' },
];

export function RuleWorkspace({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = (tabs.some((item) => item.id === searchParams.get('tab')) ? searchParams.get('tab') : 'definition') as RuleTab;
  const { servers, activeServerId } = useServerStore();
  const active = servers.find((node) => node.id === activeServerId);
  const [rule, setRule] = React.useState<Record<string, unknown> | null>(null);
  const [status, setStatus] = React.useState<Record<string, unknown> | null>(null);
  const [tabData, setTabData] = React.useState<unknown>(null);
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!active) return;
    setLoading(true); setError('');
    try {
      const [definition, ruleStatus] = await Promise.all([
        ekuiperClient.getRule(id), ekuiperClient.getRuleStatus(id).catch(() => ({})),
      ]);
      setRule(definition as unknown as Record<string, unknown>);
      setStatus(ruleStatus as unknown as Record<string, unknown>);
      if (tab === 'topology') setTabData(await ekuiperClient.getRuleTopology(id));
      else if (tab === 'schema') setTabData(await ekuiperClient.getRuleSchema(id));
      else if (tab === 'explain') setTabData(await ekuiperClient.getRuleExplain(id));
      else if (tab === 'trace') setTabData(await ekuiperClient.getRuleTraceIds(id));
      else setTabData(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Failed to load rule'); }
    finally { setLoading(false); }
  }, [active, id, tab]);
  React.useEffect(() => { void load(); }, [load]);

  const control = async (action: 'start' | 'stop' | 'restart') => {
    try { if (action === 'start') await ekuiperClient.startRule(id); else if (action === 'stop') await ekuiperClient.stopRule(id); else await ekuiperClient.restartRule(id); toast.success(`${action} requested`); await load(); } catch (reason) { toast.error(reason instanceof Error ? reason.message : 'Rule control failed'); }
  };
  const remove = async () => { await ekuiperClient.deleteRule(id); toast.success('Rule deleted'); router.push('/rules'); };
  const setTab = (next: RuleTab) => router.replace(`/rules/${encodeURIComponent(id)}?tab=${next}`);
  const trace = async (action: 'start' | 'stop') => { if (action === 'start') await ekuiperClient.startRuleTrace(id, 'always'); else await ekuiperClient.stopRuleTrace(id); toast.success(`Trace ${action} requested`); await load(); };
  const statusValue = String(status?.status ?? 'unknown');

  return (
    <AppLayout title="Rule">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end"><div className="flex items-center gap-3"><Button variant="ghost" size="icon" asChild><Link href="/rules" aria-label="Back to rules"><ArrowLeft className="h-5 w-5" /></Link></Button><div><div className="flex items-center gap-2"><h2 className="text-2xl font-semibold tracking-tight">{String(rule?.name ?? id)}</h2><Badge variant={running(statusValue) ? 'default' : 'secondary'}>{statusValue}</Badge></div>{Boolean(rule?.name) && <p className="mt-1 text-sm text-muted-foreground">{id}</p>}</div></div><div className="flex flex-wrap gap-2">{running(statusValue) ? <Button variant="outline" onClick={() => void control('stop')}><Square className="mr-2 h-4 w-4" />Stop</Button> : <Button variant="outline" onClick={() => void control('start')}><Play className="mr-2 h-4 w-4" />Start</Button>}<Button variant="outline" onClick={() => void control('restart')}><RotateCw className="mr-2 h-4 w-4" />Restart</Button><Button asChild><Link href={`/rules/${encodeURIComponent(id)}/edit`}><Pencil className="mr-2 h-4 w-4" />Edit</Link></Button><Button variant="destructive" size="icon" onClick={() => setDeleteOpen(true)} aria-label="Delete rule"><Trash2 className="h-4 w-4" /></Button></div></div>
        <div className="flex gap-1 overflow-x-auto border-b" role="tablist">{tabs.map((item) => <button key={item.id} role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)} className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium ${tab === item.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>{item.label}</button>)}</div>
        {error && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}
        {loading && !rule ? <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">Loading rule…</CardContent></Card> : tab === 'definition' ? <div className="grid gap-4 lg:grid-cols-2"><Card className="lg:col-span-2"><CardHeader><CardTitle>SQL</CardTitle></CardHeader><CardContent><pre className="whitespace-pre-wrap rounded-md bg-muted p-4 font-mono text-sm">{String(rule?.sql ?? 'Graph rule')}</pre></CardContent></Card><Card><CardHeader><CardTitle>Actions</CardTitle></CardHeader><CardContent><pre className="max-h-96 overflow-auto rounded-md bg-muted p-4 text-xs">{JSON.stringify(rule?.actions ?? [], null, 2)}</pre></CardContent></Card><Card><CardHeader><CardTitle>Options and tags</CardTitle></CardHeader><CardContent className="space-y-4"><pre className="max-h-72 overflow-auto rounded-md bg-muted p-4 text-xs">{JSON.stringify(rule?.options ?? {}, null, 2)}</pre><div className="flex flex-wrap gap-1">{((rule?.tags as string[] | undefined) ?? []).map((item) => <Badge key={item} variant="outline"><Tags className="mr-1 h-3 w-3" />{item}</Badge>)}</div></CardContent></Card></div> : tab === 'status' ? <Card><CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" />Runtime status</CardTitle><CardDescription>Native values from eKuiper&apos;s v2 rule-status endpoint.</CardDescription></CardHeader><CardContent><pre className="max-h-[36rem] overflow-auto rounded-md bg-muted p-4 text-xs">{JSON.stringify(status ?? {}, null, 2)}</pre></CardContent></Card> : tab === 'trace' ? <Card><CardHeader><CardTitle>Rule trace</CardTitle><CardDescription>Start or stop always-sampled tracing and inspect trace identifiers.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="flex gap-2"><Button onClick={() => void trace('start')}><Play className="mr-2 h-4 w-4" />Start trace</Button><Button variant="outline" onClick={() => void trace('stop')}><Square className="mr-2 h-4 w-4" />Stop trace</Button></div><pre className="max-h-96 overflow-auto rounded-md bg-muted p-4 text-xs">{JSON.stringify(tabData ?? [], null, 2)}</pre></CardContent></Card> : <Card><CardHeader><CardTitle className="flex items-center gap-2"><FileCode2 className="h-5 w-5" />{tabs.find((item) => item.id === tab)?.label}</CardTitle><CardDescription>Authoritative response from the selected eKuiper node.</CardDescription></CardHeader><CardContent><pre className="max-h-[40rem] overflow-auto whitespace-pre-wrap rounded-md bg-muted p-4 text-xs">{typeof tabData === 'string' ? tabData : JSON.stringify(tabData ?? {}, null, 2)}</pre></CardContent></Card>}
      </div>
      <ConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen} title="Delete rule?" description={`Delete ${id} from eKuiper? This cannot be undone.`} confirmLabel="Delete rule" variant="danger" onConfirm={remove} />
    </AppLayout>
  );
}
