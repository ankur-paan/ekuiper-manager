"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Activity, 
  Zap, 
  Clock, 
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  XCircle,
  Pause,
  Play,
  BarChart3,
  ChevronDown,
  ChevronUp,
  WifiOff
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EKuiperClient, RuleStatus, RuleTopology, RuleMetrics } from "@/lib/ekuiper";

interface MetricPoint {
  time: string;
  timestamp: number;
  messagesIn: number;      // Throughput (delta per interval)
  messagesOut: number;     // Throughput (delta per interval)
  latency: number;         // Current latency in microseconds
  errors: number;          // Errors (delta per interval)
  totalIn?: number;        // Cumulative total (for reference)
  totalOut?: number;       // Cumulative total (for reference)
}

interface ErrorEntry {
  ruleId: string;
  timestamp: string;
  source: string;          // e.g., "source_all_sensors_stream_0", "sink_log_0_0"
  message: string;
  count: number;
  exceptionTime?: number;  // Unix timestamp of last exception
  connectionStatus?: number; // -1 = disconnected, 1 = connected
  disconnectMessage?: string; // Connection last disconnected message
}

interface RuleMetricsData {
  ruleId: string;
  status: RuleMetrics | null;
  topology: RuleTopology | null;
  history: MetricPoint[];
  lastTotals?: {           // Track last totals for delta calculation
    messagesIn: number;
    messagesOut: number;
    errors: number;
  };
}

interface MetricsDashboardProps {
  client: EKuiperClient;
  ruleIds?: string[];
  refreshInterval?: number;
}

const CHART_COLORS = {
  messagesIn: "#3b82f6",
  messagesOut: "#22c55e",
  latency: "#f59e0b",
  errors: "#ef4444",
};

function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  trendValue,
  variant = "default",
}: {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  trend?: "up" | "down";
  trendValue?: string;
  variant?: "default" | "success" | "warning" | "error";
}) {
  const variantClasses = {
    default: "bg-card",
    success: "bg-green-500/10 border-green-500/30",
    warning: "bg-yellow-500/10 border-yellow-500/30",
    error: "bg-red-500/10 border-red-500/30",
  };

  return (
    <Card className={cn(variantClasses[variant])}>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {trend && trendValue && (
              <div className={cn(
                "flex items-center gap-1 text-xs mt-1",
                trend === "up" ? "text-green-500" : "text-red-500"
              )}>
                {trend === "up" ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {trendValue}
              </div>
            )}
          </div>
          <Icon className="h-8 w-8 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}

function RuleStatusBadge({ status }: { status: string }) {
  const variants: Record<string, "success" | "destructive" | "secondary" | "outline"> = {
    running: "success",
    stopped: "secondary",
    paused: "outline",
  };

  return (
    <Badge variant={variants[status] || "secondary"}>
      {status}
    </Badge>
  );
}

export function MetricsDashboard({ 
  client, 
  ruleIds = [], 
  refreshInterval = 2000 
}: MetricsDashboardProps) {
  const [metrics, setMetrics] = useState<Map<string, RuleMetricsData>>(new Map());
  const [isPolling, setIsPolling] = useState(true);
  const [selectedRule, setSelectedRule] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeWindow, setTimeWindow] = useState<number>(60); // seconds to display
  const [errorEntries, setErrorEntries] = useState<ErrorEntry[]>([]);
  const [showErrorDetails, setShowErrorDetails] = useState(false);

  // Time window options (in seconds)
  const TIME_WINDOW_OPTIONS = [
    { label: "30s", value: 15 },   // 15 data points at 2s interval
    { label: "1m", value: 30 },    // 30 data points
    { label: "2m", value: 60 },    // 60 data points
    { label: "5m", value: 150 },   // 150 data points
    { label: "10m", value: 300 },  // 300 data points
  ];

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const historyLimitRef = useRef(300); // Keep last 300 data points (10 minutes max)
  // Track last known exception counts to avoid duplicate error logging
  const lastExceptionCountsRef = useRef<Map<string, number>>(new Map());

  const fetchMetrics = useCallback(async () => {
    try {
      // If no ruleIds provided, fetch all rules
      let rules = ruleIds;
      if (rules.length === 0) {
        const allRules = await client.listRules();
        rules = allRules.map(r => r.id);
      }

      const newMetrics = new Map(metrics);

      await Promise.all(
        rules.map(async (ruleId) => {
          try {
            const [status, topology] = await Promise.all([
              client.getRuleStatus(ruleId),
              client.getRuleTopology(ruleId),
            ]);

            console.log(`[Metrics] Rule ${ruleId} status:`, status);
            console.log(`[Metrics] Rule ${ruleId} topology:`, topology);

            const now = new Date();
            const timeStr = now.toLocaleTimeString();

            const existing = newMetrics.get(ruleId);
            const history = existing?.history || [];

            // Parse metrics from status
            // eKuiper status format has dynamic keys like:
            // source_<name>_0_records_in_total, sink_<name>_0_records_out_total, etc.
            // These are CUMULATIVE totals, so we need to calculate delta for throughput
            const totalMessagesIn = sumMetricsBySuffix(status, "records_in_total", "source_");
            const totalMessagesOut = sumMetricsBySuffix(status, "records_out_total", "sink_") || 
                               sumMetricsBySuffix(status, "records_out_total", "source_");
            const latency = maxMetricBySuffix(status, "process_latency_us");
            const totalErrors = sumMetricsBySuffix(status, "exceptions_total");

            // Extract error details but only log NEW errors (when count increases)
            const extractedErrors = extractErrorDetails(status, ruleId, timeStr, lastExceptionCountsRef.current);
            if (extractedErrors.length > 0) {
              console.error(`[Metrics] ⚠️ New errors detected for rule ${ruleId}:`, extractedErrors);
              // Append new errors to the error entries (keep last 100)
              setErrorEntries(prev => [...prev, ...extractedErrors].slice(-100));
            }

            // Get previous totals to calculate delta (throughput)
            const lastTotals = existing?.lastTotals || { messagesIn: totalMessagesIn, messagesOut: totalMessagesOut, errors: totalErrors };
            
            // Calculate throughput as delta from last poll
            const messagesIn = Math.max(0, totalMessagesIn - lastTotals.messagesIn);
            const messagesOut = Math.max(0, totalMessagesOut - lastTotals.messagesOut);
            const errors = Math.max(0, totalErrors - lastTotals.errors);

            // Log new errors
            if (errors > 0) {
              console.error(`[Metrics] 🔴 New errors for rule ${ruleId}: ${errors} new error(s) this interval. Total: ${totalErrors}`);
            }

            console.log(`[Metrics] Extracted values for ${ruleId}:`, {
              totalMessagesIn,
              totalMessagesOut,
              messagesIn,
              messagesOut,
              latency,
              errors,
              lastTotals,
            });

            const newPoint: MetricPoint = {
              time: timeStr,
              timestamp: now.getTime(),
              messagesIn,
              messagesOut,
              latency,
              errors,
              totalIn: totalMessagesIn,
              totalOut: totalMessagesOut,
            };

            const newHistory = [...history, newPoint].slice(-historyLimitRef.current);

            // Store new totals for next delta calculation
            const newLastTotals = {
              messagesIn: totalMessagesIn,
              messagesOut: totalMessagesOut,
              errors: totalErrors,
            };

            newMetrics.set(ruleId, {
              ruleId,
              status,
              topology,
              history: newHistory,
              lastTotals: newLastTotals,
            });
          } catch (err) {
            console.error(`Failed to fetch metrics for rule ${ruleId}:`, err);
          }
        })
      );

      setMetrics(newMetrics);
      setLoading(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch metrics");
      setLoading(false);
    }
  }, [client, ruleIds, metrics]);

  // Sum all metrics that end with a suffix and optionally start with a prefix
  function sumMetricsBySuffix(status: RuleMetrics | null, suffix: string, prefix?: string): number {
    if (!status) return 0;
    
    let sum = 0;
    for (const [key, value] of Object.entries(status)) {
      if (key.endsWith(suffix) && (!prefix || key.startsWith(prefix))) {
        if (typeof value === "number") {
          sum += value;
        } else if (typeof value === "string") {
          sum += parseFloat(value) || 0;
        }
      }
    }
    return sum;
  }

  // Get the max value of metrics that end with a suffix
  function maxMetricBySuffix(status: RuleMetrics | null, suffix: string): number {
    if (!status) return 0;
    
    let max = 0;
    for (const [key, value] of Object.entries(status)) {
      if (key.endsWith(suffix)) {
        const numValue = typeof value === "number" ? value : parseFloat(String(value)) || 0;
        if (numValue > max) {
          max = numValue;
        }
      }
    }
    return max;
  }

  // Extract error details from status - only returns NEW errors when exception count increases
  function extractErrorDetails(
    status: RuleMetrics | null, 
    ruleId: string, 
    timestamp: string,
    lastCounts: Map<string, number>
  ): ErrorEntry[] {
    if (!status) return [];
    
    const errors: ErrorEntry[] = [];
    const processed = new Set<string>();
    
    // Find all unique component prefixes by looking for exceptions_total keys
    for (const [key, value] of Object.entries(status)) {
      if (key.endsWith("_exceptions_total") && typeof value === "number" && value > 0) {
        // Extract component prefix like "source_all_sensors_stream_0" from "source_all_sensors_stream_0_exceptions_total"
        const sourceMatch = key.match(/^(.+)_exceptions_total$/);
        const source = sourceMatch ? sourceMatch[1] : key;
        const sourceKey = `${ruleId}:${source}`;
        
        // Check if exception count has increased since last poll
        const lastCount = lastCounts.get(sourceKey) || 0;
        const newExceptions = value - lastCount;
        
        // Update the tracked count
        lastCounts.set(sourceKey, value);
        
        // Only add entry if there are NEW exceptions
        if (newExceptions > 0 && !processed.has(source)) {
          processed.add(source);
          
          // Get all related fields for this component
          const lastException = status[`${source}_last_exception`];
          const lastExceptionTime = status[`${source}_last_exception_time`];
          const connectionStatus = status[`${source}_connection_status`];
          const disconnectMessage = status[`${source}_connection_last_disconnected_message`];
          
          // Build meaningful error message
          let message = "";
          if (typeof lastException === "string" && lastException) {
            message = lastException;
          } else if (typeof disconnectMessage === "string" && disconnectMessage) {
            message = `Connection error: ${disconnectMessage}`;
          } else {
            message = `${newExceptions} new exception(s)`;
          }
          
          errors.push({
            ruleId,
            timestamp,
            source,
            message,
            count: newExceptions, // Show new exceptions, not total
            exceptionTime: typeof lastExceptionTime === "number" ? lastExceptionTime : undefined,
            connectionStatus: typeof connectionStatus === "number" ? connectionStatus : undefined,
            disconnectMessage: typeof disconnectMessage === "string" ? disconnectMessage : undefined,
          });
        }
      }
    }
    
    // Note: We no longer add entries for disconnected status without new exceptions
    // as this would cause duplicates every poll
    
    return errors;
  }

  // Extract numeric metric from status object (legacy)
  function extractMetric(status: RuleMetrics | null, key: string): number {
    if (!status) return 0;
    
    // Try to get direct property access first
    const value = status[key];
    if (typeof value === "number") return value;
    if (typeof value === "string") return parseFloat(value) || 0;
    
    // Fallback: parse from stringified status
    const statusStr = JSON.stringify(status);
    const regex = new RegExp(`"${key}":\\s*([\\d.]+)`);
    const match = statusStr.match(regex);
    
    return match ? parseFloat(match[1]) : 0;
  }

  // Polling effect
  useEffect(() => {
    if (isPolling) {
      fetchMetrics();
      pollingRef.current = setInterval(fetchMetrics, refreshInterval);
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [isPolling, refreshInterval, fetchMetrics]);

  // Auto-select first rule
  useEffect(() => {
    if (!selectedRule && metrics.size > 0) {
      const firstKey = metrics.keys().next().value;
      if (firstKey) {
        setSelectedRule(firstKey);
      }
    }
  }, [metrics, selectedRule]);

  const togglePolling = () => setIsPolling(!isPolling);

  const selectedMetrics = selectedRule ? metrics.get(selectedRule) : null;
  
  // Filter history based on selected time window
  const filteredHistory = selectedMetrics?.history 
    ? selectedMetrics.history.slice(-timeWindow) 
    : [];

  // Helper to count disconnected sources in a rule status
  function countDisconnectedSources(status: RuleMetrics | null): number {
    if (!status) return 0;
    let count = 0;
    for (const [key, value] of Object.entries(status)) {
      if (key.endsWith("_connection_status") && value === -1) {
        count++;
      }
    }
    return count;
  }

  // Calculate aggregate stats - use cumulative totals, not per-interval deltas
  const aggregateStats = {
    totalRules: metrics.size,
    runningRules: Array.from(metrics.values()).filter(
      m => m.status?.status === "running"
    ).length,
    // Use cumulative totals (totalIn/totalOut) not per-interval (messagesIn/messagesOut)
    totalMessagesIn: Array.from(metrics.values()).reduce(
      (sum, m) => sum + (m.history[m.history.length - 1]?.totalIn || 0),
      0
    ),
    totalMessagesOut: Array.from(metrics.values()).reduce(
      (sum, m) => sum + (m.history[m.history.length - 1]?.totalOut || 0),
      0
    ),
    totalErrors: Array.from(metrics.values()).reduce(
      (sum, m) => sum + (m.lastTotals?.errors || 0),
      0
    ),
    disconnectedSources: Array.from(metrics.values()).reduce(
      (sum, m) => sum + countDisconnectedSources(m.status),
      0
    ),
  };

  if (loading && metrics.size === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Loading metrics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4 p-4 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Rule Metrics Dashboard
          </h2>
          <p className="text-sm text-muted-foreground">
            Real-time monitoring of eKuiper rule performance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchMetrics}>
            <RefreshCw className={cn("h-4 w-4 mr-1", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={togglePolling}>
            {isPolling ? (
              <>
                <Pause className="h-4 w-4 mr-1" />
                Pause
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-1" />
                Resume
              </>
            )}
          </Button>
          
          {/* Time Window Selector */}
          <div className="flex items-center gap-1 border rounded-md p-1">
            <Clock className="h-4 w-4 text-muted-foreground ml-1" />
            {TIME_WINDOW_OPTIONS.map((option) => (
              <Button
                key={option.value}
                variant={timeWindow === option.value ? "default" : "ghost"}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setTimeWindow(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <Card className="bg-red-500/10 border-red-500/30">
          <CardContent className="py-3">
            <div className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Aggregate Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard
          title="Total Rules"
          value={aggregateStats.totalRules}
          icon={Activity}
        />
        <StatCard
          title="Running"
          value={aggregateStats.runningRules}
          icon={CheckCircle2}
          variant="success"
        />
        {aggregateStats.disconnectedSources > 0 && (
          <StatCard
            title="Disconnected"
            value={aggregateStats.disconnectedSources}
            icon={WifiOff}
            variant="warning"
          />
        )}
        <StatCard
          title="Messages In (Total)"
          value={aggregateStats.totalMessagesIn.toLocaleString()}
          icon={Zap}
        />
        <StatCard
          title="Messages Out (Total)"
          value={aggregateStats.totalMessagesOut.toLocaleString()}
          icon={TrendingUp}
        />
        {/* Expandable Error Card */}
        <Card 
          className={cn(
            "cursor-pointer transition-colors hover:bg-accent/50",
            aggregateStats.totalErrors > 0 ? "bg-red-500/10 border-red-500/30" : "bg-card"
          )}
          onClick={() => aggregateStats.totalErrors > 0 && setShowErrorDetails(!showErrorDetails)}
        >
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Errors</p>
                <p className="text-2xl font-bold">{aggregateStats.totalErrors}</p>
                {aggregateStats.totalErrors > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">Click to {showErrorDetails ? 'hide' : 'view'} details</p>
                )}
              </div>
              <div className="flex flex-col items-center gap-1">
                <XCircle className="h-8 w-8 text-muted-foreground" />
                {aggregateStats.totalErrors > 0 && (
                  showErrorDetails ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Expandable Error Details Panel */}
      {showErrorDetails && errorEntries.length > 0 && (
        <Card className="bg-red-500/5 border-red-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-red-400">
              <AlertTriangle className="h-4 w-4" />
              Error Details ({errorEntries.length} entries)
            </CardTitle>
            <CardDescription className="text-xs">
              Recent exceptions and connection issues from rule processing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {errorEntries.slice().reverse().map((entry, idx) => (
                <div 
                  key={`${entry.ruleId}-${entry.timestamp}-${idx}`}
                  className="p-3 bg-red-500/10 rounded border border-red-500/20 text-sm"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-red-400">{entry.ruleId}</span>
                      {entry.connectionStatus !== undefined && (
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-xs px-1.5 py-0",
                            entry.connectionStatus === -1 
                              ? "border-red-500 text-red-400" 
                              : "border-green-500 text-green-400"
                          )}
                        >
                          {entry.connectionStatus === -1 ? "Disconnected" : "Connected"}
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{entry.timestamp}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mb-1">
                    <span className="text-red-300 font-mono">{entry.source}</span>
                    {entry.count > 0 && (
                      <span className="ml-2 px-1.5 py-0.5 bg-red-500/20 rounded">
                        {entry.count} exception{entry.count !== 1 ? 's' : ''}
                      </span>
                    )}
                    {entry.exceptionTime && entry.exceptionTime > 0 && (
                      <span className="ml-2 text-muted-foreground">
                        @ {new Date(entry.exceptionTime).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-red-200 font-mono break-all bg-red-500/5 p-1.5 rounded mt-1">
                    {entry.message}
                  </div>
                  {entry.disconnectMessage && entry.disconnectMessage !== entry.message && (
                    <div className="text-xs text-orange-300 mt-1">
                      Disconnect reason: {entry.disconnectMessage}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="mt-2 w-full text-red-400 hover:text-red-300"
              onClick={(e) => {
                e.stopPropagation();
                setErrorEntries([]);
              }}
            >
              Clear Error Log
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Rule Selector */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Rules</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Array.from(metrics.values()).map(({ ruleId, status }) => (
              <Button
                key={ruleId}
                variant={selectedRule === ruleId ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedRule(ruleId)}
                className="gap-2"
              >
                {status?.status === "running" ? (
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                ) : (
                  <XCircle className="h-3 w-3 text-gray-500" />
                )}
                {ruleId}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Selected Rule Details */}
      {selectedMetrics && (
        <Card className="flex-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{selectedMetrics.ruleId}</CardTitle>
                <CardDescription>
                  Rule performance metrics
                </CardDescription>
              </div>
              <RuleStatusBadge status={selectedMetrics.status?.status || "unknown"} />
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="throughput">
              <TabsList>
                <TabsTrigger value="throughput">Throughput</TabsTrigger>
                <TabsTrigger value="totals">Totals</TabsTrigger>
                <TabsTrigger value="latency">Latency</TabsTrigger>
                <TabsTrigger value="errors">Errors</TabsTrigger>
                <TabsTrigger value="topology">Topology</TabsTrigger>
              </TabsList>

              <TabsContent value="throughput" className="h-64">
                <p className="text-xs text-muted-foreground mb-2">Messages processed per 2-second interval</p>
                <ResponsiveContainer width="100%" height="90%">
                  <AreaChart data={filteredHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis 
                      dataKey="time" 
                      stroke="#666"
                      tick={{ fill: "#888", fontSize: 11 }}
                    />
                    <YAxis 
                      stroke="#666"
                      tick={{ fill: "#888", fontSize: 11 }}
                      domain={[0, (dataMax: number) => Math.max(dataMax, 1)]}
                      allowDecimals={false}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "#1a1a1a", 
                        border: "1px solid #333" 
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="messagesIn"
                      stroke={CHART_COLORS.messagesIn}
                      fill={CHART_COLORS.messagesIn}
                      fillOpacity={0.3}
                      name="Messages In"
                      isAnimationActive={false}
                      dot={{ r: 2, fill: CHART_COLORS.messagesIn }}
                    />
                    <Area
                      type="monotone"
                      dataKey="messagesOut"
                      stroke={CHART_COLORS.messagesOut}
                      fill={CHART_COLORS.messagesOut}
                      fillOpacity={0.3}
                      name="Messages Out"
                      isAnimationActive={false}
                      dot={{ r: 2, fill: CHART_COLORS.messagesOut }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </TabsContent>

              <TabsContent value="totals" className="h-64">
                <p className="text-xs text-muted-foreground mb-2">Cumulative message totals over time</p>
                <ResponsiveContainer width="100%" height="90%">
                  <LineChart data={filteredHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis 
                      dataKey="time" 
                      stroke="#666"
                      tick={{ fill: "#888", fontSize: 11 }}
                    />
                    <YAxis 
                      stroke="#666"
                      tick={{ fill: "#888", fontSize: 11 }}
                      domain={[0, 'dataMax']}
                      allowDecimals={false}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "#1a1a1a", 
                        border: "1px solid #333" 
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="totalIn"
                      stroke={CHART_COLORS.messagesIn}
                      strokeWidth={2}
                      name="Total In"
                      isAnimationActive={false}
                      dot={{ r: 2, fill: CHART_COLORS.messagesIn }}
                    />
                    <Line
                      type="monotone"
                      dataKey="totalOut"
                      stroke={CHART_COLORS.messagesOut}
                      strokeWidth={2}
                      name="Total Out"
                      isAnimationActive={false}
                      dot={{ r: 2, fill: CHART_COLORS.messagesOut }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </TabsContent>

              <TabsContent value="latency" className="h-64">
                <p className="text-xs text-muted-foreground mb-2">Processing latency in microseconds</p>
                <ResponsiveContainer width="100%" height="90%">
                  <LineChart data={filteredHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis 
                      dataKey="time" 
                      stroke="#666"
                      tick={{ fill: "#888", fontSize: 11 }}
                    />
                    <YAxis 
                      stroke="#666"
                      tick={{ fill: "#888", fontSize: 11 }}
                      domain={[0, (dataMax: number) => Math.max(dataMax, 10)]}
                      allowDecimals={false}
                      label={{ 
                        value: 'μs', 
                        angle: -90, 
                        position: 'insideLeft',
                        fill: "#888"
                      }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "#1a1a1a", 
                        border: "1px solid #333" 
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="latency"
                      stroke={CHART_COLORS.latency}
                      strokeWidth={2}
                      dot={{ r: 2, fill: CHART_COLORS.latency }}
                      name="Process Latency (μs)"
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </TabsContent>

              <TabsContent value="errors" className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={filteredHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis 
                      dataKey="time" 
                      stroke="#666"
                      tick={{ fill: "#888", fontSize: 11 }}
                    />
                    <YAxis 
                      stroke="#666"
                      tick={{ fill: "#888", fontSize: 11 }}
                      domain={[0, 'dataMax']}
                      allowDecimals={false}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "#1a1a1a", 
                        border: "1px solid #333" 
                      }}
                    />
                    <Bar
                      dataKey="errors"
                      fill={CHART_COLORS.errors}
                      name="Errors (per interval)"
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </TabsContent>

              <TabsContent value="topology">
                <div className="space-y-4">
                  {/* Topology Visual Summary */}
                  {selectedMetrics.topology && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                      {/* Sources */}
                      <Card className="bg-blue-500/10 border-blue-500/30">
                        <CardContent className="p-3">
                          <p className="text-xs text-blue-400 mb-1">Sources</p>
                          <p className="font-medium text-blue-300">
                            {selectedMetrics.topology.sources?.join(", ") || "N/A"}
                          </p>
                        </CardContent>
                      </Card>
                      
                      {/* Sinks */}
                      <Card className="bg-green-500/10 border-green-500/30">
                        <CardContent className="p-3">
                          <p className="text-xs text-green-400 mb-1">Sinks</p>
                          <p className="font-medium text-green-300">
                            {selectedMetrics.topology.edges 
                              ? Object.values(selectedMetrics.topology.edges)
                                  .flat()
                                  .filter((n: string) => n.startsWith("sink_"))
                                  .join(", ") || "N/A"
                              : "N/A"}
                          </p>
                        </CardContent>
                      </Card>

                      {/* Operators */}
                      <Card className="bg-yellow-500/10 border-yellow-500/30">
                        <CardContent className="p-3">
                          <p className="text-xs text-yellow-400 mb-1">Operators</p>
                          <p className="font-medium text-yellow-300">
                            {selectedMetrics.topology.edges 
                              ? Object.keys(selectedMetrics.topology.edges).length
                              : 0}
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {/* Sink Metrics Detail */}
                  {selectedMetrics.status && (
                    <Card className="mb-4">
                      <CardHeader className="py-2">
                        <CardTitle className="text-sm">Sink Metrics</CardTitle>
                      </CardHeader>
                      <CardContent className="py-2">
                        {(() => {
                          const sinkMetrics = Object.entries(selectedMetrics.status)
                            .filter(([key]) => key.startsWith("sink_") && key.endsWith("_records_in_total"))
                            .map(([key, value]) => {
                              const sinkName = key.replace("_records_in_total", "");
                              const recordsOut = selectedMetrics.status?.[`${sinkName}_records_out_total`] || 0;
                              const status = selectedMetrics.status?.[`${sinkName}_connection_status`];
                              return { sinkName, recordsIn: value, recordsOut, status };
                            });

                          if (sinkMetrics.length === 0) {
                            return <p className="text-sm text-muted-foreground">No sink data available</p>;
                          }

                          return (
                            <div className="space-y-2">
                              {sinkMetrics.map((sink) => (
                                <div key={sink.sinkName} className="flex items-center justify-between text-sm">
                                  <span className="font-mono text-xs">{sink.sinkName}</span>
                                  <div className="flex items-center gap-4">
                                    <span>In: {String(sink.recordsIn)}</span>
                                    <span>Out: {String(sink.recordsOut)}</span>
                                    <Badge variant={sink.status === 1 ? "success" : "secondary"}>
                                      {sink.status === 1 ? "Connected" : "Disconnected"}
                                    </Badge>
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </CardContent>
                    </Card>
                  )}

                  {/* Raw Topology JSON */}
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground mb-2">Raw Topology:</p>
                    <pre className="text-sm overflow-auto max-h-48">
                      {selectedMetrics.topology 
                        ? JSON.stringify(selectedMetrics.topology, null, 2)
                        : "No topology data available"
                      }
                    </pre>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
