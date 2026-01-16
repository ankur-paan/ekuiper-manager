"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useServerStore } from "@/stores/server-store";
import { AppLayout } from "@/components/layout";
import { LoadingSpinner, ErrorState, EmptyState } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  RefreshCw,
  Play,
  Square,
  RotateCcw,
  Activity,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Zap,
  Database,
  Send,
  TrendingUp,
  Timer,
  AlertTriangle,
  Wifi,
  WifiOff,
  ChevronRight,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";

interface RuleStatus {
  status: string;
  message?: string;
  lastStartTimestamp?: number;
  lastStopTimestamp?: number;
  nextStartTimestamp?: number;
  [key: string]: unknown;
}

interface MetricNode {
  id: string;
  name: string;
  displayName: string;
  type: "source" | "operator" | "sink";
  recordsIn: number;
  recordsOut: number;
  messagesProcessed: number;
  processLatencyUs: number;
  bufferLength: number;
  exceptionsTotal: number;
  lastException: string;
  lastExceptionTime: number;
  lastInvocation: number;
  connectionStatus?: number;
  connectionLastConnected?: number;
  connectionLastDisconnected?: number;
  connectionLastDisconnectedMessage?: string;
}

export default function RuleStatusPage() {
  const params = useParams();
  const router = useRouter();
  const ruleId = params.id as string;
  const { servers, activeServerId } = useServerStore();
  const activeServer = servers.find((s) => s.id === activeServerId);

  const [status, setStatus] = React.useState<RuleStatus | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [autoRefresh, setAutoRefresh] = React.useState(false);

  const fetchStatus = React.useCallback(async (showLoading = true) => {
    if (!activeServer || !ruleId) return;

    if (showLoading) setLoading(true);
    setRefreshing(true);
    setError(null);

    try {
      const response = await fetch(`/api/ekuiper/rules/${encodeURIComponent(ruleId)}/status`, {
        headers: { "X-EKuiper-URL": activeServer.url },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch status: ${response.status}`);
      }

      const data = await response.json();
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch status");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeServer, ruleId]);

  React.useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  React.useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => fetchStatus(false), 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchStatus]);

  const handleRuleAction = async (action: "start" | "stop" | "restart") => {
    if (!activeServer) return;

    try {
      const response = await fetch(`/api/ekuiper/rules/${encodeURIComponent(ruleId)}/${action}`, {
        method: "POST",
        headers: { "X-EKuiper-URL": activeServer.url },
      });

      if (!response.ok) {
        throw new Error(`Failed to ${action} rule`);
      }

      toast.success(`Rule ${action}ed successfully`);
      setTimeout(() => fetchStatus(false), 1000);
    } catch (err) {
      toast.error(`Failed to ${action} rule`);
    }
  };

  // Parse all metric nodes from status
  const parseMetricNodes = (statusData: RuleStatus): MetricNode[] => {
    const nodes: MetricNode[] = [];
    const seenPrefixes = new Set<string>();

    Object.keys(statusData).forEach((key) => {
      if (!key.endsWith("_records_in_total")) return;

      const prefix = key.replace("_records_in_total", "");
      if (seenPrefixes.has(prefix)) return;
      seenPrefixes.add(prefix);

      let type: "source" | "operator" | "sink" = "operator";
      let name = prefix;
      let displayName = prefix;

      if (prefix.startsWith("source_")) {
        type = "source";
        name = prefix.replace("source_", "").replace(/_\d+$/, "");
        displayName = name.replace(/_/g, " ");
      } else if (prefix.startsWith("sink_")) {
        type = "sink";
        name = prefix.replace("sink_", "").replace(/_\d+$/, "");
        displayName = name.replace(/_/g, " ");
      } else if (prefix.startsWith("op_")) {
        type = "operator";
        // Parse operator names like op_2_decoder_0, op_log_0_1_encode_0
        const parts = prefix.replace("op_", "").split("_");
        // Find the meaningful name part
        const meaningfulParts = parts.filter(p => isNaN(Number(p)));
        displayName = meaningfulParts.join(" ");
        name = meaningfulParts.join("_");
      }

      nodes.push({
        id: prefix,
        name,
        displayName: displayName || name,
        type,
        recordsIn: (statusData[`${prefix}_records_in_total`] as number) || 0,
        recordsOut: (statusData[`${prefix}_records_out_total`] as number) || 0,
        messagesProcessed: (statusData[`${prefix}_messages_processed_total`] as number) || 0,
        processLatencyUs: (statusData[`${prefix}_process_latency_us`] as number) || 0,
        bufferLength: (statusData[`${prefix}_buffer_length`] as number) || 0,
        exceptionsTotal: (statusData[`${prefix}_exceptions_total`] as number) || 0,
        lastException: (statusData[`${prefix}_last_exception`] as string) || "",
        lastExceptionTime: (statusData[`${prefix}_last_exception_time`] as number) || 0,
        lastInvocation: (statusData[`${prefix}_last_invocation`] as number) || 0,
        connectionStatus: statusData[`${prefix}_connection_status`] as number | undefined,
        connectionLastConnected: statusData[`${prefix}_connection_last_connected_time`] as number | undefined,
        connectionLastDisconnected: statusData[`${prefix}_connection_last_disconnected_time`] as number | undefined,
        connectionLastDisconnectedMessage: statusData[`${prefix}_connection_last_disconnected_message`] as string | undefined,
      });
    });

    // Sort: sources first, then operators, then sinks
    const typeOrder = { source: 0, operator: 1, sink: 2 };
    return nodes.sort((a, b) => typeOrder[a.type] - typeOrder[b.type]);
  };

  const formatTimestamp = (ts: number) => {
    if (!ts) return "—";
    return new Date(ts).toLocaleString();
  };

  const formatRelativeTime = (ts: number) => {
    if (!ts) return "Never";
    const diff = Date.now() - ts;
    if (diff < 1000) return "Just now";
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const formatLatency = (us: number) => {
    if (us < 1000) return `${us}µs`;
    if (us < 1000000) return `${(us / 1000).toFixed(1)}ms`;
    return `${(us / 1000000).toFixed(2)}s`;
  };

  const getStatusColor = (statusStr?: string) => {
    if (!statusStr) return "bg-gray-500";
    const s = statusStr.toLowerCase();
    if (s.includes("running")) return "bg-green-500";
    if (s.includes("stopped") && !s.includes("error")) return "bg-yellow-500";
    if (s.includes("error") || s.includes("fail")) return "bg-red-500";
    return "bg-gray-500";
  };

  if (!activeServer) {
    return (
      <AppLayout title={`Rule Status: ${ruleId}`}>
        <EmptyState
          title="No Server Connected"
          description="Connect to an eKuiper server to view rule status."
        />
      </AppLayout>
    );
  }

  if (loading) {
    return (
      <AppLayout title={`Rule Status: ${ruleId}`}>
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      </AppLayout>
    );
  }

  if (error || !status) {
    return (
      <AppLayout title={`Rule Status: ${ruleId}`}>
        <ErrorState
          title="Error Loading Status"
          description={error || "Status not found"}
          onRetry={() => fetchStatus()}
        />
      </AppLayout>
    );
  }

  const nodes = parseMetricNodes(status);
  const sources = nodes.filter(n => n.type === "source");
  const operators = nodes.filter(n => n.type === "operator");
  const sinks = nodes.filter(n => n.type === "sink");
  
  const isRunning = status.status?.toLowerCase().includes("running");
  const hasErrors = nodes.some(n => n.exceptionsTotal > 0);
  
  // Calculate totals
  const totalIn = sources.reduce((sum, n) => sum + n.recordsIn, 0);
  const totalOut = sinks.reduce((sum, n) => sum + n.recordsOut, 0);
  const totalExceptions = nodes.reduce((sum, n) => sum + n.exceptionsTotal, 0);
  const avgLatency = nodes.length > 0 
    ? nodes.reduce((sum, n) => sum + n.processLatencyUs, 0) / nodes.length 
    : 0;

  return (
    <AppLayout title={`Rule Status: ${ruleId}`}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push(`/rules/${ruleId}`)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-3">
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${getStatusColor(status.status)}/10`}>
                <Activity className={`h-6 w-6 ${isRunning ? "text-green-500" : hasErrors ? "text-red-500" : "text-yellow-500"}`} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold">{ruleId}</h1>
                  <Badge 
                    variant={isRunning ? "default" : "secondary"}
                    className={isRunning ? "bg-green-500" : hasErrors ? "bg-red-500" : ""}
                  >
                    <span className={`mr-1.5 h-2 w-2 rounded-full ${isRunning ? "bg-white animate-pulse" : "bg-gray-400"}`} />
                    {status.status || "Unknown"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Last active: {formatRelativeTime(status.lastStartTimestamp || 0)}
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant={autoRefresh ? "default" : "outline"}
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={autoRefresh ? "bg-green-600 hover:bg-green-700" : ""}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? "animate-spin" : ""}`} />
              {autoRefresh ? "Live" : "Auto"}
            </Button>
            <Button variant="outline" size="icon" onClick={() => fetchStatus(false)} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
            <Separator orientation="vertical" className="h-8" />
            {isRunning ? (
              <>
                <Button size="sm" variant="outline" onClick={() => handleRuleAction("stop")}>
                  <Square className="h-4 w-4 mr-2" />
                  Stop
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleRuleAction("restart")}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Restart
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={() => handleRuleAction("start")} className="bg-green-600 hover:bg-green-700">
                <Play className="h-4 w-4 mr-2" />
                Start
              </Button>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Records In</p>
                  <p className="text-2xl font-bold text-blue-500">{totalIn.toLocaleString()}</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Records Out</p>
                  <p className="text-2xl font-bold text-green-500">{totalOut.toLocaleString()}</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <Send className="h-5 w-5 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Latency</p>
                  <p className="text-2xl font-bold text-purple-500">{formatLatency(avgLatency)}</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <Timer className="h-5 w-5 text-purple-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`bg-gradient-to-br ${totalExceptions > 0 ? "from-red-500/10 to-red-600/5 border-red-500/20" : "from-gray-500/10 to-gray-600/5 border-gray-500/20"}`}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Exceptions</p>
                  <p className={`text-2xl font-bold ${totalExceptions > 0 ? "text-red-500" : "text-gray-500"}`}>
                    {totalExceptions.toLocaleString()}
                  </p>
                </div>
                <div className={`h-10 w-10 rounded-lg ${totalExceptions > 0 ? "bg-red-500/20" : "bg-gray-500/20"} flex items-center justify-center`}>
                  <AlertTriangle className={`h-5 w-5 ${totalExceptions > 0 ? "text-red-500" : "text-gray-500"}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Error Message Banner */}
        {status.message && (
          <Card className="border-red-500/50 bg-red-500/5">
            <CardContent className="py-3 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-500">{status.message}</p>
            </CardContent>
          </Card>
        )}

        {/* Pipeline Flow Visualization */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Pipeline Flow
            </CardTitle>
            <CardDescription>Data flow through source → operators → sinks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-2 overflow-x-auto pb-4">
              {/* Sources */}
              <div className="flex flex-col gap-2 min-w-[200px]">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-1">
                  <Database className="h-3.5 w-3.5 text-blue-500" />
                  Sources ({sources.length})
                </div>
                {sources.map(node => (
                  <PipelineNode key={node.id} node={node} formatLatency={formatLatency} formatRelativeTime={formatRelativeTime} />
                ))}
              </div>

              <div className="flex items-center self-center px-2">
                <ChevronRight className="h-6 w-6 text-muted-foreground" />
              </div>

              {/* Operators */}
              <div className="flex flex-col gap-2 min-w-[200px] flex-1">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-1">
                  <Zap className="h-3.5 w-3.5 text-yellow-500" />
                  Operators ({operators.length})
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {operators.map(node => (
                    <PipelineNode key={node.id} node={node} formatLatency={formatLatency} formatRelativeTime={formatRelativeTime} />
                  ))}
                </div>
              </div>

              <div className="flex items-center self-center px-2">
                <ChevronRight className="h-6 w-6 text-muted-foreground" />
              </div>

              {/* Sinks */}
              <div className="flex flex-col gap-2 min-w-[200px]">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-1">
                  <Send className="h-3.5 w-3.5 text-green-500" />
                  Sinks ({sinks.length})
                </div>
                {sinks.map(node => (
                  <PipelineNode key={node.id} node={node} formatLatency={formatLatency} formatRelativeTime={formatRelativeTime} />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Detailed Metrics Tabs */}
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">All Nodes ({nodes.length})</TabsTrigger>
            <TabsTrigger value="sources">Sources ({sources.length})</TabsTrigger>
            <TabsTrigger value="operators">Operators ({operators.length})</TabsTrigger>
            <TabsTrigger value="sinks">Sinks ({sinks.length})</TabsTrigger>
            {totalExceptions > 0 && (
              <TabsTrigger value="errors" className="text-red-500">
                Errors ({totalExceptions})
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            <MetricsTable nodes={nodes} formatLatency={formatLatency} formatTimestamp={formatTimestamp} />
          </TabsContent>

          <TabsContent value="sources" className="space-y-4">
            <MetricsTable nodes={sources} formatLatency={formatLatency} formatTimestamp={formatTimestamp} />
          </TabsContent>

          <TabsContent value="operators" className="space-y-4">
            <MetricsTable nodes={operators} formatLatency={formatLatency} formatTimestamp={formatTimestamp} />
          </TabsContent>

          <TabsContent value="sinks" className="space-y-4">
            <MetricsTable nodes={sinks} formatLatency={formatLatency} formatTimestamp={formatTimestamp} />
          </TabsContent>

          {totalExceptions > 0 && (
            <TabsContent value="errors" className="space-y-4">
              <div className="space-y-3">
                {nodes.filter(n => n.exceptionsTotal > 0).map(node => (
                  <Card key={node.id} className="border-red-500/30">
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="h-8 w-8 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <AlertCircle className="h-4 w-4 text-red-500" />
                          </div>
                          <div>
                            <p className="font-medium">{node.displayName}</p>
                            <p className="text-sm text-muted-foreground capitalize">{node.type}</p>
                            <p className="text-sm text-red-500 mt-2">{node.lastException}</p>
                            {node.lastExceptionTime > 0 && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Last occurred: {formatTimestamp(node.lastExceptionTime)}
                              </p>
                            )}
                          </div>
                        </div>
                        <Badge variant="destructive">{node.exceptionsTotal} errors</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          )}
        </Tabs>

        {/* Timeline */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" />
              Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-muted-foreground">Started:</span>
                <span className="font-medium">{formatTimestamp(status.lastStartTimestamp || 0)}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-yellow-500" />
                <span className="text-muted-foreground">Stopped:</span>
                <span className="font-medium">{formatTimestamp(status.lastStopTimestamp || 0)}</span>
              </div>
              {status.nextStartTimestamp && status.nextStartTimestamp > 0 && (
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-blue-500" />
                  <span className="text-muted-foreground">Next Start:</span>
                  <span className="font-medium">{formatTimestamp(status.nextStartTimestamp)}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {nodes.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-medium mb-1">No Metrics Available</h3>
              <p className="text-sm text-muted-foreground">
                The rule may not have processed any data yet. Start the rule and wait for data to flow.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

// Pipeline Node Component
function PipelineNode({ 
  node, 
  formatLatency, 
  formatRelativeTime 
}: { 
  node: MetricNode; 
  formatLatency: (us: number) => string;
  formatRelativeTime: (ts: number) => string;
}) {
  const hasActivity = node.recordsIn > 0 || node.recordsOut > 0;
  const hasErrors = node.exceptionsTotal > 0;
  const isConnected = node.connectionStatus === 1;
  const isDisconnected = node.connectionStatus === -1;

  return (
    <div className={`
      rounded-lg border p-3 text-sm transition-all
      ${hasErrors ? "border-red-500/50 bg-red-500/5" : hasActivity ? "border-green-500/30 bg-green-500/5" : "border-border bg-card"}
      hover:shadow-md
    `}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {node.type === "source" && <Database className="h-4 w-4 text-blue-500 flex-shrink-0" />}
          {node.type === "operator" && <Zap className="h-4 w-4 text-yellow-500 flex-shrink-0" />}
          {node.type === "sink" && <Send className="h-4 w-4 text-green-500 flex-shrink-0" />}
          <span className="font-medium truncate capitalize">{node.displayName}</span>
        </div>
        {node.connectionStatus !== undefined && (
          isConnected ? (
            <Wifi className="h-4 w-4 text-green-500 flex-shrink-0" />
          ) : isDisconnected ? (
            <WifiOff className="h-4 w-4 text-red-500 flex-shrink-0" />
          ) : null
        )}
      </div>
      
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">In:</span>
          <span className="font-mono">{node.recordsIn.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Out:</span>
          <span className="font-mono">{node.recordsOut.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Latency:</span>
          <span className="font-mono">{formatLatency(node.processLatencyUs)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Buffer:</span>
          <span className="font-mono">{node.bufferLength}</span>
        </div>
      </div>

      {hasErrors && (
        <div className="mt-2 pt-2 border-t border-red-500/30">
          <div className="flex items-center gap-1.5 text-xs text-red-500">
            <AlertCircle className="h-3 w-3" />
            <span>{node.exceptionsTotal} error{node.exceptionsTotal > 1 ? "s" : ""}</span>
          </div>
          {node.lastException && (
            <p className="text-xs text-red-400 mt-1 truncate">{node.lastException}</p>
          )}
        </div>
      )}

      {node.lastInvocation > 0 && (
        <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
          Active {formatRelativeTime(node.lastInvocation)}
        </div>
      )}
    </div>
  );
}

// Metrics Table Component
function MetricsTable({ 
  nodes, 
  formatLatency, 
  formatTimestamp 
}: { 
  nodes: MetricNode[]; 
  formatLatency: (us: number) => string;
  formatTimestamp: (ts: number) => string;
}) {
  if (nodes.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No nodes in this category
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">Node</th>
              <th className="text-left p-3 font-medium">Type</th>
              <th className="text-right p-3 font-medium">In</th>
              <th className="text-right p-3 font-medium">Out</th>
              <th className="text-right p-3 font-medium">Processed</th>
              <th className="text-right p-3 font-medium">Latency</th>
              <th className="text-right p-3 font-medium">Buffer</th>
              <th className="text-right p-3 font-medium">Errors</th>
              <th className="text-center p-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {nodes.map(node => (
              <tr key={node.id} className="hover:bg-muted/30 transition-colors">
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    {node.type === "source" && <Database className="h-4 w-4 text-blue-500" />}
                    {node.type === "operator" && <Zap className="h-4 w-4 text-yellow-500" />}
                    {node.type === "sink" && <Send className="h-4 w-4 text-green-500" />}
                    <span className="font-medium capitalize">{node.displayName}</span>
                  </div>
                </td>
                <td className="p-3 capitalize text-muted-foreground">{node.type}</td>
                <td className="p-3 text-right font-mono">{node.recordsIn.toLocaleString()}</td>
                <td className="p-3 text-right font-mono">{node.recordsOut.toLocaleString()}</td>
                <td className="p-3 text-right font-mono">{node.messagesProcessed.toLocaleString()}</td>
                <td className="p-3 text-right font-mono">{formatLatency(node.processLatencyUs)}</td>
                <td className="p-3 text-right font-mono">{node.bufferLength}</td>
                <td className="p-3 text-right">
                  {node.exceptionsTotal > 0 ? (
                    <Badge variant="destructive" className="font-mono">
                      {node.exceptionsTotal}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </td>
                <td className="p-3 text-center">
                  {node.connectionStatus === 1 ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                  ) : node.connectionStatus === -1 ? (
                    <XCircle className="h-4 w-4 text-red-500 mx-auto" />
                  ) : node.recordsIn > 0 || node.recordsOut > 0 ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
