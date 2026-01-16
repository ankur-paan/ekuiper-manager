"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useServerStore } from "@/stores/server-store";
import { AppLayout } from "@/components/layout";
import { LoadingPage, ErrorState, StatusBadge, ConfirmDialog } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Workflow,
  Pencil,
  Trash2,
  Copy,
  Code,
  Play,
  Square,
  RotateCcw,
  Activity,
  RefreshCw,
  TrendingUp,
  Clock,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

interface RuleDetails {
  id: string;
  sql: string;
  actions: Array<Record<string, unknown>>;
  options?: Record<string, unknown>;
}

interface RuleStatus {
  status: string;
  source_?: string;
  op_?: Array<Record<string, unknown>>;
  lastStartTimestamp?: number;
  lastStopTimestamp?: number;
  [key: string]: unknown;
}

export default function RuleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ruleId = params.id as string;
  const { servers, activeServerId } = useServerStore();
  const activeServer = servers.find((s) => s.id === activeServerId);

  const [rule, setRule] = React.useState<RuleDetails | null>(null);
  const [status, setStatus] = React.useState<RuleStatus | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [showDelete, setShowDelete] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);

  const fetchRule = React.useCallback(async () => {
    if (!activeServer || !ruleId) return;

    setLoading(true);
    setError(null);

    try {
      const [ruleRes, statusRes] = await Promise.all([
        fetch(`/api/ekuiper/rules/${ruleId}`, {
          headers: { "X-EKuiper-URL": activeServer.url },
        }),
        fetch(`/api/ekuiper/rules/${ruleId}/status`, {
          headers: { "X-EKuiper-URL": activeServer.url },
        }),
      ]);

      if (!ruleRes.ok) {
        throw new Error(`Failed to fetch rule: ${ruleRes.status}`);
      }

      const ruleData = await ruleRes.json();
      setRule(ruleData);

      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setStatus(statusData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch rule");
    } finally {
      setLoading(false);
    }
  }, [activeServer, ruleId]);

  const refreshStatus = async () => {
    if (!activeServer) return;
    setRefreshing(true);
    try {
      const res = await fetch(`/api/ekuiper/rules/${ruleId}/status`, {
        headers: { "X-EKuiper-URL": activeServer.url },
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } finally {
      setRefreshing(false);
    }
  };

  React.useEffect(() => {
    fetchRule();
  }, [fetchRule]);

  const handleRuleAction = async (action: "start" | "stop" | "restart") => {
    if (!activeServer) return;

    try {
      const response = await fetch(`/api/ekuiper/rules/${ruleId}/${action}`, {
        method: "POST",
        headers: { "X-EKuiper-URL": activeServer.url },
      });

      if (!response.ok) {
        throw new Error(`Failed to ${action} rule`);
      }

      toast.success(`Rule ${action}ed successfully`);
      refreshStatus();
    } catch (err) {
      toast.error(`Failed to ${action} rule`);
    }
  };

  const handleDelete = async () => {
    if (!activeServer) return;

    try {
      const response = await fetch(`/api/ekuiper/rules/${ruleId}`, {
        method: "DELETE",
        headers: { "X-EKuiper-URL": activeServer.url },
      });

      if (!response.ok) {
        throw new Error("Failed to delete rule");
      }

      toast.success("Rule deleted successfully");
      router.push("/rules");
    } catch (err) {
      toast.error("Failed to delete rule");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const isRunning = status?.status?.toLowerCase().includes("running");

  if (loading) {
    return (
      <AppLayout title={`Rule: ${ruleId}`}>
        <LoadingPage label="Loading rule details..." />
      </AppLayout>
    );
  }

  if (error || !rule) {
    return (
      <AppLayout title={`Rule: ${ruleId}`}>
        <ErrorState
          title="Error Loading Rule"
          description={error || "Rule not found"}
          onRetry={fetchRule}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout title={`Rule: ${ruleId}`}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push("/rules")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                <Workflow className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{rule.id}</h1>
                <div className="flex items-center gap-2">
                  <StatusBadge
                    status={isRunning ? "running" : "stopped"}
                    label={status?.status || "Unknown"}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isRunning ? (
              <Button variant="outline" onClick={() => handleRuleAction("stop")}>
                <Square className="mr-2 h-4 w-4" />
                Stop
              </Button>
            ) : (
              <Button variant="outline" onClick={() => handleRuleAction("start")}>
                <Play className="mr-2 h-4 w-4" />
                Start
              </Button>
            )}
            <Button variant="outline" onClick={() => handleRuleAction("restart")}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Restart
            </Button>
            <Button variant="outline" onClick={() => router.push(`/rules/${ruleId}/edit`)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
            <Button variant="destructive" onClick={() => setShowDelete(true)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
            <TabsTrigger value="actions">Actions</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {/* SQL Query */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Code className="h-4 w-4" />
                    SQL Query
                  </CardTitle>
                  <CardDescription>The rule&apos;s processing query</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(rule.sql)}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy
                </Button>
              </CardHeader>
              <CardContent>
                <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm">
                  <code>{rule.sql}</code>
                </pre>
              </CardContent>
            </Card>

            {/* Options */}
            {rule.options && Object.keys(rule.options).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Options</CardTitle>
                  <CardDescription>Rule configuration options</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(rule.options).map(([key, value]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <span className="font-medium">{key}</span>
                        <code className="text-sm bg-muted px-2 py-1 rounded">
                          {JSON.stringify(value)}
                        </code>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="metrics" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Runtime Metrics
                  </CardTitle>
                  <CardDescription>Real-time rule execution statistics</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refreshStatus}
                  disabled={refreshing}
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </CardHeader>
              <CardContent>
                {status ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <div className="flex items-center gap-3 rounded-lg border p-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                        <TrendingUp className="h-5 w-5 text-green-500" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Status</p>
                        <p className="font-semibold">{status.status}</p>
                      </div>
                    </div>
                    {status.lastStartTimestamp && (
                      <div className="flex items-center gap-3 rounded-lg border p-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                          <Clock className="h-5 w-5 text-blue-500" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Last Started</p>
                          <p className="font-semibold">
                            {new Date(status.lastStartTimestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    )}
                    {Object.entries(status).map(([key, value]) => {
                      if (["status", "lastStartTimestamp", "lastStopTimestamp"].includes(key)) return null;
                      if (typeof value === "object") return null;
                      return (
                        <div key={key} className="flex items-center gap-3 rounded-lg border p-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                            <AlertCircle className="h-5 w-5 text-purple-500" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">{key}</p>
                            <p className="font-semibold">{String(value)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No metrics available</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="actions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Sink Actions</CardTitle>
                <CardDescription>Output destinations for processed data</CardDescription>
              </CardHeader>
              <CardContent>
                {rule.actions && rule.actions.length > 0 ? (
                  <div className="space-y-4">
                    {rule.actions.map((action, index) => (
                      <div key={index} className="rounded-lg border p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">Action {index + 1}</Badge>
                          {Object.keys(action).map((sinkType) => (
                            <Badge key={sinkType}>{sinkType}</Badge>
                          ))}
                        </div>
                        <pre className="text-sm bg-muted p-3 rounded-lg overflow-x-auto">
                          <code>{JSON.stringify(action, null, 2)}</code>
                        </pre>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No actions configured</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        title="Delete Rule"
        description={`Are you sure you want to delete the rule "${ruleId}"? This will stop any running processing and cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
      />
    </AppLayout>
  );
}
