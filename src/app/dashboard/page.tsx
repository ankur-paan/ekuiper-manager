'use client';

import * as React from 'react';
import Link from 'next/link';
import { Activity, ArrowRight, Database, RefreshCw, Server, Table2, Workflow } from 'lucide-react';
import { AppLayout } from '@/components/layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ekuiperClient } from '@/lib/ekuiper/client';
import { useServerStore } from '@/stores/server-store';

interface OverviewData {
  info: {
    version?: string;
    os?: string;
    arch?: string;
    upTimeSeconds?: number;
    cpuUsage?: string;
    memoryUsed?: string;
    memoryTotal?: string;
  };
  streams: number;
  tables: number;
  rules: Array<{ id: string; status?: string }>;
}

function formatUptime(seconds?: number): string {
  if (!seconds) return '—';
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  return days ? `${days}d ${hours}h` : `${hours}h ${Math.floor((seconds % 3_600) / 60)}m`;
}

export default function DashboardPage() {
  const { servers, activeServerId, fetchServers } = useServerStore();
  const activeNode = servers.find((node) => node.id === activeServerId);
  const [data, setData] = React.useState<OverviewData | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const load = React.useCallback(async () => {
    if (!activeNode) return;
    setLoading(true);
    setError('');
    try {
      const [info, streams, tables, rules, statuses] = await Promise.all([
        ekuiperClient.getInfo(),
        ekuiperClient.listStreams(),
        ekuiperClient.listTables(),
        ekuiperClient.listRules(),
        ekuiperClient.getAllRulesStatus().catch(() => ({})),
      ]);
      setData({
        info,
        streams: streams.length,
        tables: tables.length,
        rules: rules.map((rule) => ({
          id: rule.id,
          status: (statuses as Record<string, { status?: string }>)[rule.id]?.status ?? rule.status,
        })),
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to load eKuiper overview');
    } finally {
      setLoading(false);
    }
  }, [activeNode]);

  React.useEffect(() => { void load(); }, [load]);

  if (!activeNode) {
    return (
      <AppLayout title="Overview">
        <Card className="mx-auto max-w-xl border-dashed">
          <CardContent className="flex flex-col items-center py-14 text-center">
            <Server className="mb-4 h-10 w-10 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Add an eKuiper node</h2>
            <p className="mt-1 text-sm text-muted-foreground">The Manager needs one registered node before it can display or change eKuiper resources.</p>
            <Button asChild className="mt-5"><Link href="/nodes">Manage nodes</Link></Button>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  const running = data?.rules.filter((rule) => rule.status?.toLowerCase() === 'running').length ?? 0;
  const stopped = data?.rules.filter((rule) => rule.status?.toLowerCase() === 'stopped').length ?? 0;

  return (
    <AppLayout title="Overview">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold tracking-tight">{activeNode.name}</h2>
              <Badge variant={activeNode.status === 'connected' ? 'default' : 'secondary'}>{activeNode.status === 'connected' ? 'Online' : activeNode.status}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{activeNode.url}</p>
          </div>
          <Button variant="outline" onClick={() => { void fetchServers(); void load(); }} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
        </div>

        {error && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Streams</CardTitle><Database className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><p className="text-3xl font-semibold">{data?.streams ?? '—'}</p><Button asChild variant="link" className="mt-1 h-auto p-0"><Link href="/streams">Open streams <ArrowRight className="ml-1 h-3 w-3" /></Link></Button></CardContent></Card>
          <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Tables</CardTitle><Table2 className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><p className="text-3xl font-semibold">{data?.tables ?? '—'}</p><Button asChild variant="link" className="mt-1 h-auto p-0"><Link href="/tables">Open tables <ArrowRight className="ml-1 h-3 w-3" /></Link></Button></CardContent></Card>
          <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Rules</CardTitle><Workflow className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><p className="text-3xl font-semibold">{data?.rules.length ?? '—'}</p><p className="mt-1 text-xs text-muted-foreground">{running} running · {stopped} stopped</p></CardContent></Card>
          <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Uptime</CardTitle><Activity className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><p className="text-3xl font-semibold">{formatUptime(data?.info.upTimeSeconds)}</p><p className="mt-1 text-xs text-muted-foreground">eKuiper {data?.info.version ?? activeNode.version ?? '—'}</p></CardContent></Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Rule state</CardTitle><CardDescription>Authoritative status reported by the selected eKuiper node.</CardDescription></CardHeader>
            <CardContent>
              {!data?.rules.length ? <p className="py-8 text-center text-sm text-muted-foreground">No rules configured.</p> : <div className="divide-y">{data.rules.slice(0, 8).map((rule) => <Link key={rule.id} href={`/rules/${encodeURIComponent(rule.id)}`} className="flex items-center justify-between py-3 hover:text-primary"><span className="truncate font-medium">{rule.id}</span><Badge variant={rule.status?.toLowerCase() === 'running' ? 'default' : 'outline'}>{rule.status ?? 'unknown'}</Badge></Link>)}</div>}
              {data && data.rules.length > 8 && <Button asChild variant="link" className="mt-3 px-0"><Link href="/rules">View all {data.rules.length} rules</Link></Button>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>System</CardTitle><CardDescription>Current engine information.</CardDescription></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div><p className="text-xs text-muted-foreground">Version</p><p className="font-medium">{data?.info.version ?? '—'}</p></div>
              <div><p className="text-xs text-muted-foreground">Platform</p><p className="font-medium">{[data?.info.os, data?.info.arch].filter(Boolean).join(' / ') || '—'}</p></div>
              <div><p className="text-xs text-muted-foreground">CPU</p><p className="font-medium">{data?.info.cpuUsage ?? 'Not reported'}</p></div>
              <div><p className="text-xs text-muted-foreground">Memory</p><p className="font-medium">{data?.info.memoryUsed ?? 'Not reported'}{data?.info.memoryTotal ? ` / ${data.info.memoryTotal}` : ''}</p></div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
