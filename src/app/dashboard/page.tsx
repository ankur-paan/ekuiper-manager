"use client";

import * as React from "react";
import { AppLayout } from "@/components/layout";
import { useSystemInfo } from "@/hooks/use-system-info";
import { useHealthCheck } from "@/hooks/use-health-check";
import { useServerStore } from "@/stores/server-store";
import { ekuiperClient } from "@/lib/ekuiper/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, ErrorState, EmptyState } from "@/components/common";
import {
  Server,
  Clock,
  Cpu,
  HardDrive,
  Activity,
  RefreshCw,
  Database,
  Workflow,
  Layers,
} from "lucide-react";
import Link from "next/link";
import { MetricsSection } from "./metrics-section";

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);

  return parts.length > 0 ? parts.join(" ") : "< 1m";
}

function SystemInfoCard() {
  const { data, error, isLoading, refetch } = useSystemInfo({
    refetchInterval: 30000,
  });
  const { isHealthy, isChecking } = useHealthCheck({ interval: 15000 });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            System Info
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-[200px]" />
          <Skeleton className="h-4 w-[150px]" />
          <Skeleton className="h-4 w-[180px]" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            System Info
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorState title="Connection Error" description={error} onRetry={refetch} />
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return <Card><CardContent><EmptyState title="No Data" description="Check connection." /></CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            System Info
          </CardTitle>
          <CardDescription>eKuiper server status</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge
            status={isHealthy ? "running" : "error"}
            label={isHealthy ? "Connected" : "Disconnected"}
          />
          <Button variant="ghost" size="icon" onClick={refetch} disabled={isChecking}>
            <RefreshCw className={`h-4 w-4 ${isChecking ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 pt-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Version</p>
              <p className="font-semibold">{data.version}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
              <HardDrive className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">OS</p>
              <p className="font-semibold">{data.os}</p>
            </div>
          </div>
          {data.arch && (
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                <Cpu className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Arch</p>
                <p className="font-semibold">{data.arch}</p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
              <Clock className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Uptime</p>
              <p className="font-semibold">{formatUptime(data.upTimeSeconds)}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ResourceSummary() {
  const { activeServerId, servers } = useServerStore();
  const activeServer = servers.find(s => s.id === activeServerId);

  const [counts, setCounts] = React.useState({ streams: 0, rules: 0, tables: 0 });

  React.useEffect(() => {
    if (!activeServer) return;
    ekuiperClient.setBaseUrl(activeServer.url);

    const fetchCounts = async () => {
      try {
        const [s, r, t] = await Promise.all([
          ekuiperClient.listStreams(),
          ekuiperClient.listRules(),
          ekuiperClient.listTables(),
        ]);
        setCounts({
          streams: Math.max(0, s.length),
          rules: Math.max(0, r.length),
          tables: Math.max(0, t.length),
        });
      } catch (e) { }
    };
    fetchCounts();
  }, [activeServer]);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Defined Streams</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold flex items-center gap-2">
            <Database className="h-5 w-5" /> {counts.streams}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Running Rules</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold flex items-center gap-2">
            <Workflow className="h-5 w-5" /> {counts.rules}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Lookup Tables</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold flex items-center gap-2">
            <Layers className="h-5 w-5" /> {counts.tables}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function DashboardPage() {
  const { servers, activeServerId } = useServerStore();
  const activeServer = servers.find((s) => s.id === activeServerId);

  return (
    <AppLayout title="Dashboard">
      <div className="space-y-6">
        {/* Server Status */}
        {!activeServer ? (
          <Card>
            <CardContent className="py-8">
              <EmptyState
                title="No Server Connected"
                description="Add an eKuiper server to get started."
                actionLabel="Add Server"
                icon={Server}
              />
            </CardContent>
          </Card>
        ) : (
          <>
            <SystemInfoCard />

            {/* Dynamic Counters */}
            <div>
              <h2 className="mb-4 text-lg font-semibold">Resources Overview</h2>
              <ResourceSummary />
            </div>

            {/* Real-Time Metrics */}
            <div>
              <h2 className="mb-4 text-lg font-semibold">Real-Time Metrics</h2>
              <MetricsSection />
            </div>

            {/* Quick Actions (Keep same as before or simplified) */}
          </>
        )}
      </div>
    </AppLayout>
  );
}
