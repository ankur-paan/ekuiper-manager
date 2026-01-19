"use client";

import * as React from "react";
import { AppLayout } from "@/components/layout";
import { useSystemInfo } from "@/hooks/use-system-info";
import { useHealthCheck } from "@/hooks/use-health-check";
import { useServerStore } from "@/stores/server-store";
import { ekuiperClient } from "@/lib/ekuiper/client";
import { BatchRequestItem } from "@/lib/ekuiper/types";
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
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  Send as SendIcon,
  MessageSquare,
  Sparkles,
  User,
  Loader2,
  CheckCircle2,
  Zap,
  ChevronRight,
  TrendingUp,
  BarChart3,
  Wifi,
  Radio,
  Terminal,
  X,
  ChevronDown,
  ChevronUp
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
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

  const formatBytes = (bytes: string | number | undefined) => {
    if (!bytes) return "-";
    const b = Number(bytes);
    if (isNaN(b)) return "-";
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let val = b;
    let uIndex = 0;
    while (val >= 1024 && uIndex < units.length - 1) {
      val /= 1024;
      uIndex++;
    }
    return `${val.toFixed(2)} ${units[uIndex]}`;
  };

  if (isLoading && !data) {
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

  if (error && !data) {
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

  if (!data) return null;

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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 pt-4">
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
              <p className="font-semibold">{data.os} / {data.arch}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
              <Clock className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Uptime</p>
              <p className="font-semibold">{formatUptime(data.upTimeSeconds)}</p>
            </div>
          </div>

          {/* New Fields */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10">
              <Cpu className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">CPU</p>
              <p className="font-semibold">{data.cpuUsage || "-"}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 xl:col-span-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10">
              <Database className="h-5 w-5 text-indigo-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Memory</p>
              <p className="font-semibold whitespace-nowrap">
                {formatBytes(data.memoryUsed)} / {formatBytes(data.memoryTotal)}
              </p>
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
        const requests: BatchRequestItem[] = [
          { method: "GET", path: "/streams" },
          { method: "GET", path: "/rules" },
          { method: "GET", path: "/tables" }
        ];

        const results = await ekuiperClient.batchRequest(requests);

        const streams = Array.isArray(results[0]?.response) ? results[0].response : [];
        const rules = Array.isArray(results[1]?.response) ? results[1].response : [];
        const tables = Array.isArray(results[2]?.response) ? results[2].response : [];

        setCounts({
          streams: streams.length,
          rules: rules.length,
          tables: tables.length,
        });
      } catch (e) {
        console.error("Failed to fetch counts", e);
      }
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

const LogTerminal = ({ data }: { data: any }) => {
  if (!data) return null;

  const getAttributes = (span: any) =>
    span?.Attribute || span?.attribute || span?.attributes || span?.tags || {};

  const flattenSpans = (span: any): any[] => {
    if (!span) return [];
    let results = [span];
    const children = span.ChildSpan || span.childSpan || span.children || [];
    if (Array.isArray(children)) {
      children.forEach((child: any) => {
        results = results.concat(flattenSpans(child));
      });
    }
    return results;
  };

  const decodeValue = (val: any) => {
    let str = String(val);
    try {
      // Try base64
      if (/^[A-Za-z0-9+/]*={0,2}$/.test(str) && str.length > 8) {
        const d = atob(str);
        if (/^[\x20-\x7E]*$/.test(d)) str = d;
      }
      // Try JSON
      const j = JSON.parse(str);
      return JSON.stringify(j, null, 2);
    } catch (e) { }
    return str;
  };

  return (
    <div className="bg-slate-950 border-t border-slate-800 p-4 font-mono text-[11px] h-[300px] overflow-y-auto custom-scrollbar shadow-inner relative">
      <div className="sticky top-0 right-0 flex justify-end z-10 gap-2">
        {Object.keys(data).length > 0 && (
          <div className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-[9px] uppercase tracking-tighter animate-pulse flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-cyan-400" />
            Live Buffer Active
          </div>
        )}
        <div className="px-2 py-0.5 rounded-full bg-slate-900/80 text-slate-400 border border-slate-700 text-[9px] uppercase tracking-tighter backdrop-blur-sm">Payload Sync</div>
      </div>
      {Object.entries(data).map(([ruleId, traces]: any) => (
        <div key={ruleId} className="mb-6">
          <div className="text-purple-400 font-bold mb-2 border-b border-purple-500/20 pb-1 flex items-center gap-2 sticky top-0 bg-slate-950 py-1 z-10">
            <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            Rule Trace: {ruleId}
          </div>
          {traces.map((traceTree: any, tIdx: number) => {
            const allSpans = flattenSpans(traceTree);
            const dataSpans = allSpans.filter(s => Object.keys(getAttributes(s)).length > 0);

            if (dataSpans.length === 0) return null;

            return (
              <div key={tIdx} className="mb-4 border-l-2 border-slate-800 pl-4 py-1">
                <div className="text-slate-500 text-[9px] mb-2 uppercase tracking-widest font-black flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  {new Date((traceTree.StartTime || Date.now() * 1000000) / 1000000).toLocaleTimeString()}
                  <span className="text-slate-700">|</span>
                  Trace ID: {traceTree.TraceID || "N/A"}
                </div>
                {dataSpans.map((span, sIdx) => (
                  <div key={sIdx} className="mb-3 last:mb-0">
                    <div className="text-cyan-600 text-[10px] font-bold mb-1 opacity-80 flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full bg-cyan-600" />
                      Step: {span.Name || span.name || "Unknown"}
                    </div>
                    <div className="grid gap-1">
                      {Object.entries(getAttributes(span)).map(([k, v]) => (
                        <div key={k} className="bg-slate-900/40 p-2 rounded border border-white/5 min-w-0">
                          <span className="text-slate-500 mr-2 shrink-0">{k}:</span>
                          <pre className="whitespace-pre-wrap break-all [overflow-wrap:anywhere] text-cyan-50/90 leading-relaxed block overflow-x-hidden">
                            {decodeValue(v)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ))}
      {!Object.keys(data).length && (
        <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
          <Terminal className="h-8 w-8 opacity-20" />
          <p>No telemetry data in buffer. Run a capture to populate.</p>
        </div>
      )}
    </div>
  );
};

export default function DashboardPage() {
  const { servers, activeServerId } = useServerStore();
  const activeServer = servers.find((s) => s.id === activeServerId);

  // --- Master AI Chat Implementation ---
  const [isChatOpen, setIsChatOpen] = React.useState(false);
  const [chatInput, setChatInput] = React.useState("");
  const [messages, setMessages] = React.useState<any[]>([]);
  const [isThinking, setIsThinking] = React.useState(false);
  const [isCapturingLogs, setIsCapturingLogs] = React.useState(false);
  const [capturedTrace, setCapturedTrace] = React.useState<any>(null);
  const [showTerminal, setShowTerminal] = React.useState(false);
  const [modelName, setModelName] = React.useState("gemini-1.5-pro");
  const [captureRuleId, setCaptureRuleId] = React.useState<string>("auto");
  const [runningRuleIds, setRunningRuleIds] = React.useState<string[]>([]);
  const [availableModels, setAvailableModels] = React.useState<{ id: string, name: string }[]>([]);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    fetch('/api/ai/models')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setAvailableModels(data);
      })
      .catch(() => { });
  }, []);

  React.useEffect(() => {
    if (isChatOpen && activeServer) {
      ekuiperClient.listRules()
        .then(rules => {
          const running = rules.filter((r: any) => r.status?.includes('running')).map((r: any) => r.id);
          setRunningRuleIds(running);
        })
        .catch(() => { });
    }
  }, [isChatOpen, activeServer]);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isThinking]);

  const handleCaptureLogs = async () => {
    if (!activeServer) return;
    setIsCapturingLogs(true);
    setCapturedTrace({}); // Clear previous to show "Waiting" state
    setShowTerminal(true);
    toast.info("Opening 10-second live data recording window...");

    try {
      // 1. Get/Validate targets
      let targetRules: string[] = [];

      if (captureRuleId === 'auto') {
        const rules = await ekuiperClient.listRules();
        targetRules = rules.filter((r: any) => r.status?.includes('running')).map((r: any) => r.id).slice(0, 2);
      } else {
        targetRules = [captureRuleId];
      }

      if (targetRules.length === 0) {
        toast.error("No active rules found to capture telemetry from.");
        setIsCapturingLogs(false);
        return;
      }

      // 2. Take a snapshot of "pre-existing" trace IDs
      const preCaptureSnapshots: Record<string, Set<string>> = {};
      await Promise.all(targetRules.map(async id => {
        const ids = await ekuiperClient.getRuleTraceIds(id).catch(() => []);
        preCaptureSnapshots[id] = new Set(Array.isArray(ids) ? ids : []);
      }));

      // 3. Start Tracing (The "Button Press")
      await Promise.all(targetRules.map(id =>
        ekuiperClient.startRuleTrace(id, "always").catch(() => { })
      ));

      // 4. Poll for new IDs during the 10s window (Polling 5 times every 2s)
      const capturedMap: Record<string, any[]> = {};
      const knownNewIds: Record<string, Set<string>> = {};
      targetRules.forEach(id => {
        capturedMap[id] = [];
        knownNewIds[id] = new Set();
      });

      for (let i = 0; i < 5; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000));

        await Promise.all(targetRules.map(async id => {
          try {
            const currentIds = await ekuiperClient.getRuleTraceIds(id);
            if (!Array.isArray(currentIds)) return;

            // Find IDs that are NOT in the pre-snapshot and NOT already processed
            const newIds = currentIds.filter(tId =>
              !preCaptureSnapshots[id].has(tId) && !knownNewIds[id].has(tId)
            );

            if (newIds.length > 0) {
              const details = await Promise.all(
                newIds.slice(0, 5).map(tId => {
                  knownNewIds[id].add(tId);
                  return ekuiperClient.getTraceDetail(tId).catch(() => null);
                })
              );

              const validDetails = details.filter(Boolean);
              if (validDetails.length > 0) {
                capturedMap[id] = [...capturedMap[id], ...validDetails].slice(-20); // Keep last 20
                setCapturedTrace({ ...capturedMap }); // Live reactor - update UI
              }
            }
          } catch (e) { }
        }));
      }

      // 5. Cleanup: Stop Tracing
      await Promise.all(targetRules.map(id =>
        ekuiperClient.stopRuleTrace(id).catch(() => { })
      ));

      toast.success("Telemetry capture complete.");

      // Notify the AI in the chat
      setMessages(prev => [...prev, {
        role: 'system',
        content: `PROCESSED LIVE TELEMETRY: Captured ${Object.values(capturedMap).flat().length} message spans from ${targetRules.join(', ')}. Context updated.`
      }]);
    } catch (err: any) {
      toast.error("Capture System Failure: " + err.message);
    } finally {
      setIsCapturingLogs(false);
    }
  };

  const handleChatSubmit = async () => {
    if (!chatInput.trim() || !activeServer) return;

    const userMessage = { role: 'user', content: chatInput };
    setMessages(prev => [...prev, userMessage]);
    setChatInput("");
    setIsThinking(true);

    try {
      // 1. Fetch Basic Lists, System Info, and Metadata (Parallel Standard Requests)
      const [streamsRaw, rulesRaw, tablesRaw, systemInfo, sourcesMeta, sinksMeta, services] = await Promise.all([
        ekuiperClient.listStreams().catch(e => { console.warn("List streams failed", e); return []; }),
        ekuiperClient.listRules().catch(e => { console.warn("List rules failed", e); return []; }),
        ekuiperClient.listTables().catch(e => { console.warn("List tables failed", e); return []; }),
        ekuiperClient.getInfo().catch(e => { console.warn("Get info failed", e); return {}; }),
        ekuiperClient.listSourceMetadata().catch(e => { console.warn("Get sources meta failed", e); return []; }),
        ekuiperClient.listSinkMetadata().catch(e => { console.warn("Get sinks meta failed", e); return []; }),
        ekuiperClient.listServices().catch(e => { console.warn("Get services failed", e); return []; })
      ]);

      // 2. Normalize lists (handle string vs object return types)
      const rulesNorm = (Array.isArray(rulesRaw) ? rulesRaw : []).map((r: any) => ({
        id: typeof r === 'string' ? r : r.id,
        status: typeof r === 'string' ? 'unknown' : r.status
      }));

      const streamsNorm = (Array.isArray(streamsRaw) ? streamsRaw : []).map((s: any) => ({
        name: typeof s === 'string' ? s : s.name
      }));

      const tablesNorm = (Array.isArray(tablesRaw) ? tablesRaw : []).map((t: any) => ({
        name: typeof t === 'string' ? t : t.name
      }));

      // 3. Fetch Full Details (Parallel)
      const [fullRules, fullStreams, fullTables] = await Promise.all([
        Promise.all(rulesNorm.map((r: any) => ekuiperClient.getRule(r.id).catch(() => ({ id: r.id, error: "Failed fetch" })))),
        Promise.all(streamsNorm.map((s: any) => ekuiperClient.getStream(s.name).catch(() => ({ name: s.name, error: "Failed fetch" })))),
        Promise.all(tablesNorm.map((t: any) => ekuiperClient.getTable(t.name).catch(() => ({ name: t.name, error: "Failed fetch" }))))
      ]);

      // 4. Fetch Configurations for used types (confKeys resolution)
      const sourceConfigs: Record<string, any> = {};
      // Identify used source types from streams
      const usedSourceTypes = new Set(fullStreams.map((s: any) => {
        // Options.type or Options.TYPE or default/implied
        return s.Options?.TYPE || s.Options?.type || "mqtt";
      }).filter(t => typeof t === 'string'));

      await Promise.all(Array.from(usedSourceTypes).map(async (type) => {
        sourceConfigs[type as string] = await ekuiperClient.getSourceConfig(type as string).catch(() => ({}));
      }));

      const res = await fetch('/api/ai/master-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          modelName,
          context: {
            streams: fullStreams,
            rules: fullRules,
            tables: fullTables,
            systemInfo,
            statuses: rulesNorm,
            traceData: (() => {
              if (!capturedTrace) return null;
              // Simple pruning to avoid "Context Length Exceeded" (400)
              const MAX_SPANS = 5;
              const MAX_STR_LEN = 500;

              const pruneLoop = (obj: any): any => {
                if (typeof obj === 'string') {
                  return obj.length > MAX_STR_LEN ? obj.substring(0, MAX_STR_LEN) + "...[TRUNCATED]" : obj;
                }
                if (Array.isArray(obj)) return obj.map(pruneLoop);
                if (typeof obj === 'object' && obj !== null) {
                  const res: any = {};
                  for (const k in obj) {
                    res[k] = pruneLoop(obj[k]);
                  }
                  return res;
                }
                return obj;
              };

              // Take last 5 spans per rule
              const prunedLogs: Record<string, any[]> = {};
              for (const [rid, spans] of Object.entries(capturedTrace)) {
                if (Array.isArray(spans)) {
                  // Try to take the most interesting spans (usually start or end)
                  // We'll take the last few as they might be most recent additions
                  const subset = spans.slice(-MAX_SPANS);
                  prunedLogs[rid] = subset.map(pruneLoop);
                }
              }
              return prunedLogs;
            })(),
            meta: {
              sources: sourcesMeta,
              sinks: sinksMeta,
              services: services,
              configs: {
                sources: sourceConfigs
              }
            }
          }
        })
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
    } catch (err: any) {
      toast.error("AI Assistant Error: " + err.message);
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <AppLayout title="Dashboard">
      <div className="space-y-6 relative min-h-full">
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

            {/* Floating Master AI Assistant Button */}
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="fixed bottom-8 right-8 z-50"
            >
              <Button
                onClick={() => setIsChatOpen(true)}
                className="h-16 w-16 rounded-full bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-500 shadow-[0_0_20px_rgba(124,58,237,0.5)] border-2 border-white/20 hover:border-white/40 transition-all group overflow-hidden"
              >
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <Sparkles className="h-8 w-8 text-white group-hover:rotate-12 transition-transform duration-300" />
              </Button>
            </motion.div>

            {/* Master AI Assistant Drawer */}
            <Sheet open={isChatOpen} onOpenChange={setIsChatOpen}>
              <SheetContent className="w-full sm:max-w-[500px] border-l-0 p-0 flex flex-col bg-slate-50/95 backdrop-blur-xl shadow-2xl overflow-hidden ring-1 ring-white/10">
                <div className="absolute top-0 left-0 w-1 bg-gradient-to-b from-purple-500 via-indigo-500 to-blue-500 h-full" />

                <SheetHeader className="p-6 pb-2 border-b border-slate-200 bg-white/50 backdrop-blur-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-2 opacity-5 pointer-events-none">
                    <Bot className="h-24 w-24 text-purple-900" />
                  </div>
                  <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg transform -rotate-3 border border-white/30">
                        <Sparkles className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <SheetTitle className="text-2xl font-black tracking-tight text-slate-800">Master Assistant</SheetTitle>
                        <SheetDescription className="text-xs font-bold text-purple-500 uppercase tracking-widest flex items-center gap-1.5 mt-0.5">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
                          </span>
                          Architect-Grade Intelligence
                        </SheetDescription>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <Select value={modelName} onValueChange={setModelName}>
                        <SelectTrigger className="w-[160px] h-8 text-[10px] font-bold uppercase tracking-wider bg-white border-slate-200 text-slate-700 focus:ring-purple-500 rounded-full shadow-sm">
                          <SelectValue placeholder="Model" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-slate-200 rounded-xl shadow-xl max-h-[300px]">
                          {availableModels.length > 0 ? (
                            availableModels.map(m => (
                              <SelectItem key={m.id} value={m.id} className="text-xs font-semibold text-slate-700">
                                {m.name}
                              </SelectItem>
                            ))
                          ) : (
                            <>
                              <SelectItem value="gemini-1.5-flash" className="text-xs font-semibold text-slate-700">Gemini Flash</SelectItem>
                              <SelectItem value="gemini-1.5-pro" className="text-xs font-semibold text-slate-700">Gemini Pro</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </SheetHeader>

                <div className="flex-1 overflow-hidden relative group/chat">
                  <ScrollArea className="h-full w-full">
                    <div className="px-6 py-8 space-y-8 flex flex-col">
                      {messages.length === 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex flex-col items-center justify-center text-center py-12 px-8 space-y-6"
                        >
                          <div className="bg-white/80 backdrop-blur-sm p-10 rounded-[2.5rem] ring-1 ring-slate-200 shadow-xl space-y-4 max-w-[340px] relative overflow-hidden group">
                            <div className="absolute top-0 right-0 h-24 w-24 bg-purple-500/5 rounded-full -translate-y-12 translate-x-12 blur-2xl group-hover:bg-purple-500/10 transition-colors" />
                            <div className="bg-purple-600 w-16 h-16 rounded-[1.25rem] flex items-center justify-center mx-auto ring-4 ring-purple-100 shadow-lg transform rotate-3 transition-transform group-hover:rotate-0">
                              <Bot className="h-8 w-8 text-white" />
                            </div>
                            <div className="space-y-3">
                              <p className="text-xl font-black text-slate-800 tracking-tight">System Oracle Active.</p>
                              <p className="text-[13px] text-slate-500 leading-relaxed font-medium">
                                I have access to your entire eKuiper fleet. Ask me to:
                              </p>
                              <div className="grid gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                <div className="flex items-center gap-2 justify-center bg-slate-50 py-1.5 rounded-lg border border-slate-100">
                                  <Wifi className="h-3 w-3" /> Connectivity Audit
                                </div>
                                <div className="flex items-center gap-2 justify-center bg-slate-50 py-1.5 rounded-lg border border-slate-100">
                                  <BarChart3 className="h-3 w-3" /> Load Balancing
                                </div>
                                <div className="flex items-center gap-2 justify-center bg-slate-50 py-1.5 rounded-lg border border-slate-100">
                                  <Zap className="h-3 w-3" /> Fault Detection
                                </div>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {messages.map((m, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, scale: 0.95, y: 10, x: m.role === 'user' ? 20 : -20 }}
                          animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
                          className={cn("flex gap-3 min-w-0 w-full", m.role === 'user' ? "flex-row-reverse" : "flex-row")}
                        >
                          <div className={cn("mt-1 p-2 rounded-xl flex-shrink-0 ring-1 shadow-sm h-fit",
                            m.role === 'user' ? "bg-white ring-slate-200" : "bg-purple-600 ring-purple-500")}>
                            {m.role === 'user' ? <User className="h-4 w-4 text-slate-600" /> : <Bot className="h-4 w-4 text-white" />}
                          </div>
                          <div className={cn("max-w-[85%] min-w-0 rounded-[2rem] px-5 py-4 text-sm leading-relaxed shadow-sm break-words [overflow-wrap:anywhere]",
                            m.role === 'user'
                              ? "bg-slate-800 text-white rounded-tr-none shadow-md font-medium"
                              : "bg-white text-slate-700 rounded-tl-none ring-1 ring-slate-100 ring-offset-0")}>
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                p: ({ node, ...props }) => <p className="mb-2 last:mb-0 break-words [overflow-wrap:anywhere]" {...props} />,
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
                                          <code className={className || ""} {...props}>
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
                          <div className="bg-white rounded-full px-5 py-2.5 text-[10px] font-black text-purple-400 uppercase tracking-[0.2em] flex items-center justify-center border border-purple-100 shadow-sm">
                            Querying System Knowledge...
                          </div>
                        </motion.div>
                      )}
                      <div ref={scrollRef} />
                    </div>
                  </ScrollArea>
                </div>

                {/* Log Terminal */}
                {capturedTrace && (
                  <div className="flex flex-col border-t border-slate-200 bg-slate-950">
                    <button
                      onClick={() => setShowTerminal(!showTerminal)}
                      className="flex items-center justify-between px-6 py-2 bg-slate-900 border-b border-slate-800 hover:bg-slate-800 transition-colors group"
                    >
                      <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <Terminal className="h-3 w-3 text-cyan-500" />
                        Captured Telemetry Terminal
                      </div>
                      {showTerminal ? <ChevronDown className="h-3 w-3 text-slate-500" /> : <ChevronUp className="h-3 w-3 text-slate-500" />}
                    </button>
                    {showTerminal && <LogTerminal data={capturedTrace} />}
                  </div>
                )}

                <div className="p-6 bg-white/80 backdrop-blur-md border-t border-slate-200 flex flex-col gap-4 relative shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.05)]">
                  <div className="flex items-center gap-3 w-full">
                    <Textarea
                      placeholder="Ask about system architecture, load, or faults..."
                      className="flex-1 min-h-[60px] max-h-[120px] resize-none border-slate-200 focus-visible:ring-purple-500 transition-all rounded-2xl bg-slate-50/50 p-4 shadow-inner text-slate-800 placeholder:text-slate-400 font-semibold"
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
                      size="icon"
                      onClick={handleChatSubmit}
                      disabled={!chatInput.trim() || isThinking}
                      className="h-[60px] w-[60px] rounded-2xl bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-600/20 text-white transition-all transform active:scale-95 flex-shrink-0"
                    >
                      <SendIcon className="h-6 w-6" />
                    </Button>
                  </div>
                  <div className="flex justify-between items-center px-2 gap-2">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCaptureLogs}
                        disabled={isCapturingLogs || isThinking}
                        className={cn(
                          "h-8 text-[10px] font-black uppercase tracking-widest rounded-full border-slate-200 bg-white shadow-sm transition-all flex-shrink-0",
                          isCapturingLogs ? "bg-purple-50 border-purple-200 text-purple-600 px-4" : "hover:bg-slate-50"
                        )}
                      >
                        {isCapturingLogs ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin mr-2" />
                            Capturing...
                          </>
                        ) : (
                          <>
                            <Radio className="h-3 w-3 mr-2 text-red-500 animate-pulse" />
                            Capture Logs
                          </>
                        )}
                      </Button>

                      <Select value={captureRuleId} onValueChange={setCaptureRuleId}>
                        <SelectTrigger className="h-8 w-[140px] text-[9px] font-bold uppercase tracking-wider rounded-full bg-slate-50 border-slate-200">
                          <SelectValue placeholder="Target" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-slate-200 rounded-xl shadow-xl">
                          <SelectItem value="auto" className="text-[10px] uppercase font-bold text-indigo-600">Auto (Top Active)</SelectItem>
                          {runningRuleIds.map(id => (
                            <SelectItem key={id} value={id} className="text-[10px] font-medium">{id}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="hidden sm:block text-[9px] text-slate-400 font-bold uppercase tracking-widest">Global Assist Mode</p>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </>
        )}
      </div>
    </AppLayout>
  );
}

