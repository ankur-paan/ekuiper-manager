"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Activity,
  Cpu,
  HardDrive,
  Gauge,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  RefreshCw,
  Download,
  Settings,
  Play,
  Pause,
  Zap,
  Clock,
  Database,
} from "lucide-react";
import { MetricsChart } from "./MetricsChart";
import { RuleProfiler } from "./RuleProfiler";
import { BottleneckDetector } from "./BottleneckDetector";
import { ResourceMonitor } from "./ResourceMonitor";

export interface PerformanceProfilerProps {
  connectionId: string;
}

export interface RuleMetrics {
  ruleId: string;
  ruleName: string;
  status: "running" | "stopped" | "error";
  recordsIn: number;
  recordsOut: number;
  exceptions: number;
  processLatency: number;
  throughput: number;
  lastError?: string;
  timestamp: Date;
}

export interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  memoryTotal: number;
  uptime: number;
  goroutines: number;
}

export function PerformanceProfiler({ connectionId }: PerformanceProfilerProps) {
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5000);
  const [ruleMetrics, setRuleMetrics] = useState<RuleMetrics[]>([]);
  const [metricsHistory, setMetricsHistory] = useState<Map<string, RuleMetrics[]>>(new Map());
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics>({
    cpuUsage: 0,
    memoryUsage: 0,
    memoryTotal: 0,
    uptime: 0,
    goroutines: 0,
  });
  const [selectedRule, setSelectedRule] = useState<string | null>(null);
  const [bottlenecks, setBottlenecks] = useState<string[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch metrics
  const fetchMetrics = useCallback(async () => {
    try {
      // In production, fetch from API
      // const response = await fetch(`/api/connections/${connectionId}/ekuiper/metrics`);
      // const data = await response.json();

      // Simulate metrics data
      const simulatedRules: RuleMetrics[] = [
        {
          ruleId: "rule-1",
          ruleName: "temp-alert",
          status: "running",
          recordsIn: Math.floor(Math.random() * 1000) + 500,
          recordsOut: Math.floor(Math.random() * 800) + 400,
          exceptions: Math.floor(Math.random() * 5),
          processLatency: Math.random() * 20 + 5,
          throughput: Math.random() * 200 + 100,
          timestamp: new Date(),
        },
        {
          ruleId: "rule-2",
          ruleName: "aggregator",
          status: "running",
          recordsIn: Math.floor(Math.random() * 500) + 200,
          recordsOut: Math.floor(Math.random() * 400) + 150,
          exceptions: Math.floor(Math.random() * 2),
          processLatency: Math.random() * 50 + 10,
          throughput: Math.random() * 100 + 50,
          timestamp: new Date(),
        },
        {
          ruleId: "rule-3",
          ruleName: "enricher",
          status: "running",
          recordsIn: Math.floor(Math.random() * 300) + 100,
          recordsOut: Math.floor(Math.random() * 250) + 80,
          exceptions: Math.floor(Math.random() * 10),
          processLatency: Math.random() * 100 + 30,
          throughput: Math.random() * 80 + 20,
          timestamp: new Date(),
        },
      ];

      setRuleMetrics(simulatedRules);

      // Update history
      setMetricsHistory((prev) => {
        const newHistory = new Map(prev);
        for (const rule of simulatedRules) {
          const history = newHistory.get(rule.ruleId) || [];
          history.push(rule);
          // Keep last 60 entries (5 minutes at 5s interval)
          if (history.length > 60) history.shift();
          newHistory.set(rule.ruleId, history);
        }
        return newHistory;
      });

      // Simulate system metrics
      setSystemMetrics({
        cpuUsage: Math.random() * 40 + 10,
        memoryUsage: Math.random() * 200 + 100,
        memoryTotal: 512,
        uptime: Date.now() - 86400000,
        goroutines: Math.floor(Math.random() * 50) + 20,
      });

      // Detect bottlenecks
      const newBottlenecks: string[] = [];
      for (const rule of simulatedRules) {
        if (rule.processLatency > 80) {
          newBottlenecks.push(`High latency in ${rule.ruleName}: ${rule.processLatency.toFixed(1)}ms`);
        }
        if (rule.exceptions > 5) {
          newBottlenecks.push(`High error rate in ${rule.ruleName}: ${rule.exceptions} exceptions`);
        }
        if (rule.recordsIn > 0 && rule.recordsOut / rule.recordsIn < 0.5) {
          newBottlenecks.push(`Low output ratio in ${rule.ruleName}: ${((rule.recordsOut / rule.recordsIn) * 100).toFixed(0)}%`);
        }
      }
      setBottlenecks(newBottlenecks);
    } catch (error) {
      console.error("Failed to fetch metrics:", error);
    }
  }, [connectionId]);

  // Start/stop monitoring
  useEffect(() => {
    if (isMonitoring) {
      fetchMetrics();
      intervalRef.current = setInterval(fetchMetrics, refreshInterval);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isMonitoring, refreshInterval, fetchMetrics]);

  // Calculate aggregates
  const totalThroughput = ruleMetrics.reduce((sum, r) => sum + r.throughput, 0);
  const avgLatency = ruleMetrics.length > 0
    ? ruleMetrics.reduce((sum, r) => sum + r.processLatency, 0) / ruleMetrics.length
    : 0;
  const totalExceptions = ruleMetrics.reduce((sum, r) => sum + r.exceptions, 0);
  const runningRules = ruleMetrics.filter((r) => r.status === "running").length;

  // Export metrics
  const exportMetrics = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      systemMetrics,
      ruleMetrics,
      history: Object.fromEntries(metricsHistory),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `performance-metrics-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5 text-sota-blue" />
                Performance Profiler
              </CardTitle>
              <Badge variant={isMonitoring ? "default" : "secondary"}>
                {isMonitoring ? (
                  <>
                    <Activity className="h-3 w-3 mr-1 animate-pulse" />
                    Monitoring
                  </>
                ) : (
                  <>
                    <Pause className="h-3 w-3 mr-1" />
                    Paused
                  </>
                )}
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <Select
                value={String(refreshInterval)}
                onValueChange={(v) => setRefreshInterval(Number(v))}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1000">1s</SelectItem>
                  <SelectItem value="5000">5s</SelectItem>
                  <SelectItem value="10000">10s</SelectItem>
                  <SelectItem value="30000">30s</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant={isMonitoring ? "outline" : "default"}
                size="sm"
                onClick={() => setIsMonitoring(!isMonitoring)}
              >
                {isMonitoring ? (
                  <Pause className="h-4 w-4 mr-2" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                {isMonitoring ? "Pause" : "Start"}
              </Button>

              <Button variant="outline" size="sm" onClick={fetchMetrics}>
                <RefreshCw className="h-4 w-4" />
              </Button>

              <Button variant="outline" size="sm" onClick={exportMetrics}>
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Quick stats */}
      <div className="grid grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Zap className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalThroughput.toFixed(0)}</p>
                <p className="text-xs text-muted-foreground">rec/s total</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Clock className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{avgLatency.toFixed(1)}ms</p>
                <p className="text-xs text-muted-foreground">avg latency</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Database className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{runningRules}/{ruleMetrics.length}</p>
                <p className="text-xs text-muted-foreground">rules running</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalExceptions}</p>
                <p className="text-xs text-muted-foreground">exceptions</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/10">
                <Cpu className="h-5 w-5 text-violet-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{systemMetrics.cpuUsage.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">CPU usage</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main content */}
      <div className="flex-1 grid grid-cols-3 gap-4 min-h-0">
        {/* Charts and rule profiler */}
        <div className="col-span-2 flex flex-col gap-4">
          <Tabs defaultValue="charts" className="flex-1 flex flex-col">
            <TabsList className="w-fit">
              <TabsTrigger value="charts">Metrics Charts</TabsTrigger>
              <TabsTrigger value="rules">Rule Profiler</TabsTrigger>
            </TabsList>

            <TabsContent value="charts" className="flex-1 m-0 mt-4">
              <MetricsChart
                metricsHistory={metricsHistory}
                selectedRule={selectedRule}
                onRuleSelect={setSelectedRule}
              />
            </TabsContent>

            <TabsContent value="rules" className="flex-1 m-0 mt-4">
              <RuleProfiler
                ruleMetrics={ruleMetrics}
                onRuleSelect={setSelectedRule}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          <ResourceMonitor systemMetrics={systemMetrics} />
          <BottleneckDetector ruleMetrics={ruleMetrics} systemMetrics={systemMetrics} />
        </div>
      </div>
    </div>
  );
}
