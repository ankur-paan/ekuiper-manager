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
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  Send as SendIcon,
  MessageSquare,
  Sparkles,
  User,
  Loader2,
  RefreshCw,
  CheckCircle2,
  ArrowLeft,
  Activity,
  Play,
  Square,
  RotateCcw,
  TrendingUp,
  Send,
  Timer,
  AlertTriangle,
  AlertCircle,
  BarChart3,
  Database,
  ChevronRight,
  Clock,
  Wifi,
  WifiOff,
  XCircle,
  Zap
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { parseNodeId } from "@/lib/ekuiper/formatters";

interface RuleDetails {
  id: string;
  sql: string;
  actions: Array<Record<string, unknown>>;
  options?: Record<string, unknown>;
}

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
  const [rule, setRule] = React.useState<RuleDetails | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [autoRefresh, setAutoRefresh] = React.useState(false);

  // AI State
  const [isChatOpen, setIsChatOpen] = React.useState(false);
  const [chatInput, setChatInput] = React.useState("");
  const [messages, setMessages] = React.useState<any[]>([]);
  const [isThinking, setIsThinking] = React.useState(false);
  const [aiModels, setAiModels] = React.useState<{ id: string, name: string }[]>([]);
  const [selectedModel, setSelectedModel] = React.useState("gemini-1.5-flash");

  React.useEffect(() => {
    fetch('/api/ai/models')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setAiModels(data);
          const flash = data.find(m => m.id.includes('flash')) || data[0];
          if (flash) setSelectedModel(flash.id);
        }
      });
  }, []);

  const handleChatSubmit = async () => {
    if (!chatInput.trim()) return;

    const userMsg = { role: 'user', content: chatInput };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setChatInput("");
    setIsThinking(true);

    try {
      const res = await fetch('/api/ai/rule-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          context: { rule, status },
          modelName: selectedModel
        })
      });

      if (!res.ok) throw new Error("AI failed to respond");
      const data = await res.json();
      setMessages([...newMessages, { role: 'assistant', content: data.message }]);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsThinking(false);
    }
  };

  const fetchStatus = React.useCallback(async (showLoading = true) => {
    if (!activeServer || !ruleId) return;

    if (showLoading) setLoading(true);
    setRefreshing(true);
    setError(null);

    try {
      const [statusRes, ruleRes] = await Promise.all([
        fetch(`/api/ekuiper/rules/${encodeURIComponent(ruleId)}/status`, {
          headers: { "X-EKuiper-URL": activeServer.url },
        }),
        fetch(`/api/ekuiper/rules/${encodeURIComponent(ruleId)}`, {
          headers: { "X-EKuiper-URL": activeServer.url },
        }).catch(() => null)
      ]);

      if (!statusRes.ok) {
        throw new Error(`Failed to fetch status: ${statusRes.status}`);
      }

      const statusData = await statusRes.json();
      setStatus(statusData);

      if (ruleRes && ruleRes.ok) {
        const ruleData = await ruleRes.json();
        setRule(ruleData);
      }
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

  const parseMetricNodes = (statusData: RuleStatus): MetricNode[] => {
    const nodes: MetricNode[] = [];
    const seenPrefixes = new Set<string>();

    Object.keys(statusData).forEach((key) => {
      if (!key.endsWith("_records_in_total")) return;

      // Use Official Formatter
      const info = parseNodeId(key);
      if (seenPrefixes.has(info.rawId)) return;
      seenPrefixes.add(info.rawId);

      // Map back to Metrics naming conventions if needed, or just use info
      // The original code detected type via prefix. Our parser does too.
      // prefix here is actually the full metric ID prefix e.g. "op_filter_0"

      // Wait, 'key' is "op_filter_0_records_in_total".
      // Our parser expects "op_filter_0".

      const prefix = key.replace("_records_in_total", "");
      const { type, label, iconKey } = parseNodeId(prefix);

      const displayName = label;
      const name = prefix; // Keep original ID for detailed tracking if needed

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

  const totalIn = sources.reduce((sum, n) => sum + n.recordsIn, 0);
  const totalOut = sinks.reduce((sum, n) => sum + n.recordsOut, 0);
  const totalExceptions = nodes.reduce((sum, n) => sum + n.exceptionsTotal, 0);
  const avgLatency = nodes.length > 0
    ? nodes.reduce((sum, n) => sum + n.processLatencyUs, 0) / nodes.length
    : 0;

  return (
    <AppLayout title={`Rule Status: ${ruleId}`}>
      <div className="space-y-6">
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
              variant="outline"
              onClick={() => setIsChatOpen(true)}
              className="gap-2 border-purple-500/50 hover:bg-purple-50 text-purple-700 transition-all font-semibold shadow-sm mr-2"
              size="sm"
            >
              <Sparkles className="h-4 w-4 text-purple-600" />
              Live AI Analysis
            </Button>
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

        {status.message && (
          <Card className="border-red-500/50 bg-red-500/5">
            <CardContent className="py-3 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-500">{status.message}</p>
            </CardContent>
          </Card>
        )}

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

      <Sheet open={isChatOpen} onOpenChange={setIsChatOpen}>
        <SheetContent side="right" className="sm:max-w-[500px] w-full p-0 flex flex-col border-l-purple-500/20 shadow-2xl overflow-hidden glass-morphism">
          <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] -z-10 pointer-events-none opacity-20" />

          <SheetHeader className="p-6 bg-gradient-to-br from-purple-600 to-indigo-700 text-white border-b border-white/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl opacity-50" />
            <div className="flex items-center gap-4 relative z-10">
              <div className="p-3 rounded-2xl bg-white/20 backdrop-blur-md ring-1 ring-white/30 shadow-inner">
                <Bot className="h-6 w-6 text-white animate-pulse" />
              </div>
              <div className="flex-1 text-left">
                <SheetTitle className="text-2xl font-black tracking-tight text-white leading-tight">Insight <span className="text-purple-200">Engineer</span></SheetTitle>
                <SheetDescription className="text-purple-100/80 font-medium text-xs uppercase tracking-widest mt-0.5">Rule Metrics Copilot</SheetDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => { setMessages([]); }} className="text-white/60 hover:text-white hover:bg-white/10">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </SheetHeader>

          <div className="flex-1 flex flex-col overflow-hidden bg-slate-100/30 backdrop-blur-sm">
            <ScrollArea className="flex-1 px-6 pt-6">
              <div className="space-y-6 pb-6">
                <AnimatePresence initial={false}>
                  {messages.length === 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-center py-16 px-4"
                    >
                      <div className="bg-white/80 backdrop-blur-sm p-8 rounded-3xl ring-1 ring-slate-200 shadow-sm space-y-4 max-w-[320px] mx-auto">
                        <div className="bg-purple-600/10 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto ring-1 ring-purple-600/20">
                          <Activity className="h-8 w-8 text-purple-600" />
                        </div>
                        <div className="space-y-2">
                          <p className="text-lg font-bold text-slate-800 tracking-tight">Telemetry Stream Linked.</p>
                          <p className="text-xs text-slate-500 italic leading-relaxed font-medium text-center">
                            I have access to real-time metrics for <b>&quot;{ruleId}&quot;</b>. Ask me to identify bottlenecks, explain source latencies, or diagnose connectivity issues.
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                  {messages.map((m, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0.95, y: 10, x: m.role === 'user' ? 20 : -20 }}
                      animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
                      transition={{ type: "spring", stiffness: 300, damping: 25 }}
                      className={cn("flex gap-3 min-w-0 w-full", m.role === 'user' ? "flex-row-reverse" : "flex-row")}
                    >
                      <div className={cn("mt-1 p-2 rounded-xl flex-shrink-0 ring-1 shadow-sm h-fit",
                        m.role === 'user' ? "bg-white ring-slate-200" : "bg-purple-600 ring-purple-500")}>
                        {m.role === 'user' ? <User className="h-4 w-4 text-slate-600" /> : <Bot className="h-4 w-4 text-white" />}
                      </div>
                      <div className={cn("max-w-[85%] min-w-0 rounded-[2rem] px-5 py-4 text-sm leading-relaxed shadow-sm break-words overflow-hidden",
                        m.role === 'user'
                          ? "bg-slate-800 text-white rounded-tr-none shadow-md font-medium"
                          : "bg-white text-slate-700 rounded-tl-none ring-1 ring-slate-100")}>
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: ({ node, ...props }) => <p className="mb-2 last:mb-0 break-words" {...props} />,
                            ul: ({ node, ...props }) => <ul className="list-disc pl-4 mb-2 space-y-1" {...props} />,
                            ol: ({ node, ...props }) => <ol className="list-decimal pl-4 mb-2 space-y-1" {...props} />,
                            li: ({ node, ...props }) => <li className="mb-1 leading-normal" {...props} />,
                            h1: ({ node, ...props }) => <h1 className="text-lg font-black mb-2" {...props} />,
                            h2: ({ node, ...props }) => <h2 className="text-md font-black mb-2" {...props} />,
                            h3: ({ node, ...props }) => <h3 className="text-sm font-black mb-1" {...props} />,
                            code: ({ node, className, children, ...props }: any) => {
                              const match = /language-(\w+)/.exec(className || '');
                              const isBlock = match || String(children).includes('\n');

                              if (isBlock) {
                                return (
                                  <div className="relative w-full overflow-hidden my-3">
                                    <pre className="bg-slate-950 text-slate-300 p-4 rounded-xl overflow-x-auto text-[13px] font-mono border border-slate-800 shadow-2xl custom-scrollbar" style={{ maxWidth: '100%' }}>
                                      <code className={className} {...props}>
                                        {children}
                                      </code>
                                    </pre>
                                  </div>
                                );
                              }

                              return (
                                <code className="bg-purple-100/80 text-purple-700 px-1.5 py-0.5 rounded-md text-[13px] font-bold border border-purple-200/50" {...props}>
                                  {children}
                                </code>
                              );
                            },
                            strong: ({ node, ...props }) => <strong className="font-extrabold text-slate-900" {...props} />,
                          }}
                        >
                          {m.content}
                        </ReactMarkdown>
                      </div>
                    </motion.div>
                  ))}

                  {isThinking && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex gap-3 px-2"
                    >
                      <div className="mt-1 p-2 rounded-xl bg-purple-100 ring-1 ring-purple-200">
                        <Loader2 className="h-4 w-4 text-purple-600 animate-spin" />
                      </div>
                      <div className="bg-white rounded-full px-4 py-2 text-[10px] font-bold text-purple-400 uppercase tracking-widest flex items-center justify-center border border-purple-100 shadow-sm">
                        Deconstructing Telemetry...
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </ScrollArea>
          </div>

          <div className="p-6 bg-slate-100/90 backdrop-blur-md border-t border-slate-300 flex flex-col gap-4 relative shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.1)]">
            <div className="flex items-center gap-3 w-full">
              <Textarea
                placeholder="Ask about telemetry and bottlenecks..."
                className="flex-1 min-h-[60px] max-h-[120px] resize-none border-slate-400 focus-visible:ring-purple-500 transition-all rounded-2xl bg-white p-4 shadow-sm text-slate-900 placeholder:text-slate-500 font-medium"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleChatSubmit();
                  }
                }}
              />
              <Button
                onClick={handleChatSubmit}
                className="h-[60px] w-[60px] rounded-2xl bg-purple-600 hover:bg-purple-700 text-white shadow-xl transition-all active:scale-95 flex-shrink-0"
                disabled={isThinking || !chatInput.trim()}
              >
                <SendIcon className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex items-center justify-between px-1">
              {aiModels.length > 0 && (
                <div className="flex items-center gap-3 bg-white/50 p-1 px-3 rounded-full border border-slate-300">
                  <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest leading-none">AI Model</span>
                  <Select value={selectedModel} onValueChange={setSelectedModel}>
                    <SelectTrigger className="h-7 w-[140px] text-[10px] border-slate-400 bg-white hover:bg-slate-50 transition-colors uppercase font-black tracking-wider shadow-none rounded-full px-4 text-purple-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-slate-200 shadow-2xl">
                      {aiModels.map(m => (
                        <SelectItem key={m.id} value={m.id} className="text-[10px] font-bold uppercase py-2">
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <p className="text-[9px] text-slate-600 font-extrabold uppercase tracking-[0.2em] bg-white/40 px-3 py-1.5 rounded-full border border-slate-300/50">Industrial Copilot</p>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}

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
