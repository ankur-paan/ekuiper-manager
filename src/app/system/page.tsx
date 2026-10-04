'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Cpu,
  Clock,
  Layers,
  Network,
  RefreshCw,
  Server,
  Terminal,
  Copy,
  Check,
  Zap,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ekuiperClient } from '@/lib/ekuiper/client';
import type { EKuiperInfo } from '@/lib/ekuiper/types';
import { useServerStore } from '@/stores/server-store';

function formatDetailedUptime(seconds?: number): string {
  if (seconds === undefined || seconds === null) return '—';
  const sec = Math.floor(seconds);
  const days = Math.floor(sec / 86_400);
  const hours = Math.floor((sec % 86_400) / 3_600);
  const mins = Math.floor((sec % 3_600) / 60);
  const remSec = sec % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  if (mins > 0 || hours > 0 || days > 0) parts.push(`${mins}m`);
  parts.push(`${remSec}s`);
  return parts.join(' ');
}

export default function SystemPage() {
  const { servers, activeServerId } = useServerStore();
  const activeNode = servers.find((node) => node.id === activeServerId);

  const [info, setInfo] = React.useState<EKuiperInfo | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [lastRefreshed, setLastRefreshed] = React.useState<Date | null>(null);
  const [autoPoll, setAutoPoll] = React.useState(true);
  const [pollInterval, setPollInterval] = React.useState<1000 | 5000>(1000);
  const [copied, setCopied] = React.useState(false);
  const [uptimeLocal, setUptimeLocal] = React.useState<number | null>(null);

  const fetchSystemInfo = React.useCallback(async () => {
    if (!activeNode) return;
    try {
      const data = await ekuiperClient.getInfo();
      setInfo(data);
      setUptimeLocal(data.upTimeSeconds);
      setLastRefreshed(new Date());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retrieve system telemetry');
    } finally {
      setLoading(false);
    }
  }, [activeNode]);

  React.useEffect(() => {
    setLoading(true);
    void fetchSystemInfo();
  }, [fetchSystemInfo]);

  // Local second ticker to keep uptime counter fluid between polls
  React.useEffect(() => {
    if (uptimeLocal === null) return;
    const interval = setInterval(() => {
      setUptimeLocal((prev) => (prev !== null ? prev + 1 : null));
    }, 1000);
    return () => clearInterval(interval);
  }, [uptimeLocal]);

  // Auto poll timer
  React.useEffect(() => {
    if (!autoPoll || !activeNode) return;
    const interval = setInterval(() => {
      void fetchSystemInfo();
    }, pollInterval);
    return () => clearInterval(interval);
  }, [autoPoll, pollInterval, activeNode, fetchSystemInfo]);

  const copyPayload = () => {
    if (!info) return;
    navigator.clipboard.writeText(JSON.stringify(info, null, 2));
    setCopied(true);
    toast.success('System telemetry copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  if (!activeNode) {
    return (
      <AppLayout title="System">
        <Card className="mx-auto max-w-xl border-dashed">
          <CardContent className="flex flex-col items-center py-14 text-center">
            <Server className="mb-4 size-10 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Select an eKuiper node</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              To inspect hardware architecture and system telemetry, select or register a node.
            </p>
            <Button asChild className="mt-5">
              <Link href="/nodes">Manage nodes</Link>
            </Button>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="System">
      <div className="mx-auto max-w-7xl flex flex-col gap-6">
        {/* Header bar */}
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-semibold tracking-tight">System Telemetry</h2>
              <Badge variant="outline" className="font-mono text-xs">
                {activeNode.name}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Real-time hardware runtime, engine architecture, and operating parameters.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/60 bg-muted/20 text-xs">
              <Label htmlFor="auto-poll" className="cursor-pointer text-xs text-muted-foreground">
                Live Refresh
              </Label>
              <Switch
                id="auto-poll"
                checked={autoPoll}
                onCheckedChange={setAutoPoll}
                className="scale-75"
              />
              {autoPoll && (
                <button
                  type="button"
                  onClick={() => setPollInterval((prev) => (prev === 1000 ? 5000 : 1000))}
                  className="font-mono text-[10px] text-primary hover:underline px-1 min-h-[24px] min-w-[24px] inline-flex items-center justify-center rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  aria-label={`Toggle polling interval, currently ${pollInterval === 1000 ? '1 second' : '5 seconds'}`}
                >
                  {pollInterval === 1000 ? '1s' : '5s'}
                </button>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => void fetchSystemInfo()}
              disabled={loading}
              className="text-xs"
            >
              <RefreshCw className={`mr-1.5 size-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              Refresh
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={copyPayload}
              disabled={!info}
              className="text-xs"
            >
              {copied ? (
                <Check className="mr-1.5 size-3.5 text-emerald-500" />
              ) : (
                <Copy className="mr-1.5 size-3.5 text-muted-foreground" />
              )}
              {copied ? 'Copied' : 'Copy JSON'}
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* 4 Core Industrial Telemetry Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Version */}
          <Card className="relative overflow-hidden border-border/60 bg-card hover:border-emerald-500/40 transition-colors">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-400" />
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Engine Version
                </span>
                <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="size-4" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              <div className="text-2xl font-mono font-bold tracking-tight text-foreground">
                {info?.version || '—'}
              </div>
              <p className="text-[11px] text-muted-foreground font-mono">
                LF Edge eKuiper Stream Engine
              </p>
            </CardContent>
          </Card>

          {/* Card 2: Operating System */}
          <Card className="relative overflow-hidden border-border/60 bg-card hover:border-blue-500/40 transition-colors">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Host Platform
                </span>
                <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Terminal className="size-4" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              <div className="text-2xl font-mono font-bold tracking-tight text-foreground capitalize">
                {info?.os || '—'}
              </div>
              <p className="text-[11px] text-muted-foreground font-mono">
                Target Execution Host OS
              </p>
            </CardContent>
          </Card>

          {/* Card 3: Architecture */}
          <Card className="relative overflow-hidden border-border/60 bg-card hover:border-cyan-500/40 transition-colors">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 to-sky-400" />
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Architecture
                </span>
                <div className="p-1.5 rounded-md bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                  <Cpu className="size-4" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              <div className="text-2xl font-mono font-bold tracking-tight text-foreground uppercase">
                {info?.arch || '—'}
              </div>
              <p className="text-[11px] text-muted-foreground font-mono">
                CPU Instruction Set
              </p>
            </CardContent>
          </Card>

          {/* Card 4: Live Uptime */}
          <Card className="relative overflow-hidden border-border/60 bg-card hover:border-purple-500/40 transition-colors">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-violet-400" />
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  System Uptime
                </span>
                <div className="p-1.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <Clock className="size-4" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              <div className="text-2xl font-mono font-bold tracking-tight text-foreground flex items-center gap-2">
                <span>{formatDetailedUptime(uptimeLocal ?? undefined)}</span>
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <p className="text-[11px] text-muted-foreground font-mono">
                {uptimeLocal !== null ? `${uptimeLocal.toLocaleString()} total seconds` : '—'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Node Connectivity & Environment Diagnostics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Active Node Environment</CardTitle>
              <CardDescription className="text-xs">
                Active endpoint binding and telemetry heartbeat status.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-xs font-mono">
              <div className="divide-y divide-border/60 rounded-lg border border-border/60 overflow-hidden bg-card">
                <div className="flex items-center justify-between p-3">
                  <span className="text-muted-foreground">Node Identifier</span>
                  <span className="font-semibold text-foreground">{activeNode.id}</span>
                </div>
                <div className="flex items-center justify-between p-3">
                  <span className="text-muted-foreground">Display Name</span>
                  <span className="font-semibold text-foreground">{activeNode.name}</span>
                </div>
                <div className="flex items-center justify-between p-3">
                  <span className="text-muted-foreground">REST Endpoint URL</span>
                  <span className="font-semibold text-foreground">{activeNode.url}</span>
                </div>
                <div className="flex items-center justify-between p-3">
                  <span className="text-muted-foreground">Connection Status</span>
                  <Badge variant={activeNode.status === 'connected' ? 'default' : 'secondary'} className="text-[10px]">
                    {activeNode.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3">
                  <span className="text-muted-foreground">Last Heartbeat</span>
                  <span className="text-foreground">
                    {lastRefreshed ? lastRefreshed.toLocaleTimeString() : '—'}
                  </span>
                </div>
              </div>

              {/* Resource Utilization (if reported by eKuiper) */}
              {(info?.memoryUsed || info?.cpuUsage) && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="p-3 rounded-lg border border-border/60 bg-muted/20">
                    <span className="text-[11px] text-muted-foreground block font-sans">Memory Used</span>
                    <span className="text-sm font-semibold text-foreground">
                      {info.memoryUsed} {info.memoryTotal ? `/ ${info.memoryTotal}` : ''}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg border border-border/60 bg-muted/20">
                    <span className="text-[11px] text-muted-foreground block font-sans">CPU Usage</span>
                    <span className="text-sm font-semibold text-foreground">{info.cpuUsage}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions & Navigation */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Shortcuts</CardTitle>
              <CardDescription className="text-xs">
                Jump to corresponding management views.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button asChild variant="outline" className="w-full justify-between text-xs h-9">
                <Link href="/nodes">
                  <span className="flex items-center gap-2">
                    <Server className="size-3.5 text-blue-500" />
                    Manage Registered Nodes
                  </span>
                  <ArrowRight className="size-3.5 text-muted-foreground" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-between text-xs h-9">
                <Link href="/rules">
                  <span className="flex items-center gap-2">
                    <Zap className="size-3.5 text-amber-500" />
                    Inspect Rule Alarms & Topology
                  </span>
                  <ArrowRight className="size-3.5 text-muted-foreground" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-between text-xs h-9">
                <Link href="/connections">
                  <span className="flex items-center gap-2">
                    <Network className="size-3.5 text-emerald-500" />
                    Shared Connection Pools
                  </span>
                  <ArrowRight className="size-3.5 text-muted-foreground" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-between text-xs h-9">
                <Link href="/plugins">
                  <span className="flex items-center gap-2">
                    <Layers className="size-3.5 text-purple-500" />
                    Extensions & Plugins
                  </span>
                  <ArrowRight className="size-3.5 text-muted-foreground" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
