"use client";

import * as React from "react";
import { useServerStore } from "@/stores/server-store";
import { AppLayout } from "@/components/layout";
import { useSystemInfo } from "@/hooks/use-system-info";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, EmptyState } from "@/components/common";
import {
  Server,
  Clock,
  Cpu,
  HardDrive,
  Activity,
  RefreshCw,
} from "lucide-react";

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days} days`);
  if (hours > 0) parts.push(`${hours} hours`);
  if (minutes > 0) parts.push(`${minutes} minutes`);
  if (secs > 0) parts.push(`${secs} seconds`);

  return parts.length > 0 ? parts.join(", ") : "< 1 second";
}

export default function SystemPage() {
  const { servers, activeServerId } = useServerStore();
  const activeServer = servers.find((s) => s.id === activeServerId);
  const { data, error, isLoading, refetch } = useSystemInfo({ refetchInterval: 10000 });

  if (!activeServer) {
    return (
      <AppLayout title="System Info">
        <EmptyState
          title="No Server Connected"
          description="Connect to an eKuiper server to view system information."
        />
      </AppLayout>
    );
  }

  if (isLoading) {
    return (
      <AppLayout title="System Info">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">System Information</h2>
              <p className="text-muted-foreground">eKuiper server status and details</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-32" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout title="System Info">
        <ErrorState
          title="Connection Error"
          description={error}
          onRetry={refetch}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="System Info">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">System Information</h2>
            <p className="text-muted-foreground">
              Connected to: {activeServer.name} ({activeServer.url})
            </p>
          </div>
          <Button variant="outline" onClick={refetch}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Version</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data?.version || "N/A"}</div>
              <p className="text-xs text-muted-foreground">eKuiper version</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Operating System</CardTitle>
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data?.os || "N/A"}</div>
              <p className="text-xs text-muted-foreground">Host OS</p>
            </CardContent>
          </Card>

          {data?.arch && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Architecture</CardTitle>
                <Cpu className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.arch}</div>
                <p className="text-xs text-muted-foreground">CPU architecture</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Uptime</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data?.upTimeSeconds ? formatUptime(data.upTimeSeconds) : "N/A"}
              </div>
              <p className="text-xs text-muted-foreground">Server uptime</p>
            </CardContent>
          </Card>
        </div>

        {/* Connection Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Connection Details
            </CardTitle>
            <CardDescription>Current server connection information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">Server Name</p>
                  <p className="font-semibold">{activeServer.name}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">Server URL</p>
                  <p className="font-mono text-sm">{activeServer.url}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">Status</p>
                  <p className="font-semibold capitalize">{activeServer.status}</p>
                </div>
                {activeServer.description && (
                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-muted-foreground">Description</p>
                    <p className="font-semibold">{activeServer.description}</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Raw System Info */}
        {data && (
          <Card>
            <CardHeader>
              <CardTitle>Raw Response</CardTitle>
              <CardDescription>Complete system info from eKuiper API</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="rounded-lg bg-muted p-4 text-sm overflow-x-auto">
                <code>{JSON.stringify(data, null, 2)}</code>
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
