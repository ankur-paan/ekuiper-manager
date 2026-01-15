"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, AlertCircle, Info, RefreshCw, Zap, Clock, XCircle, ArrowDown } from "lucide-react";
import { useState, useEffect } from "react";
import type { RuleMetrics, SystemMetrics } from "./PerformanceProfiler";

interface Bottleneck {
  id: string;
  ruleId: string;
  type: "latency" | "throughput" | "error" | "memory" | "cpu";
  severity: "critical" | "warning" | "info";
  message: string;
  value: number;
  threshold: number;
  suggestion: string;
}

interface BottleneckDetectorProps {
  ruleMetrics: RuleMetrics[];
  systemMetrics: SystemMetrics;
  onRefresh?: () => void;
}

export function BottleneckDetector({ 
  ruleMetrics, 
  systemMetrics,
  onRefresh 
}: BottleneckDetectorProps) {
  const [bottlenecks, setBottlenecks] = useState<Bottleneck[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Thresholds for bottleneck detection
  const THRESHOLDS = {
    latency: { warning: 100, critical: 500 }, // ms
    throughput: { warning: 10, critical: 5 }, // msg/s
    errorRate: { warning: 1, critical: 5 }, // %
    cpu: { warning: 70, critical: 90 }, // %
    memory: { warning: 70, critical: 90 }, // %
  };

  useEffect(() => {
    analyzeBottlenecks();
  }, [ruleMetrics, systemMetrics]);

  const analyzeBottlenecks = () => {
    setIsAnalyzing(true);
    const detected: Bottleneck[] = [];

    // Analyze each rule
    ruleMetrics.forEach((rule) => {
      // High latency detection
      if (rule.processLatency > THRESHOLDS.latency.critical) {
        detected.push({
          id: `${rule.ruleId}-latency-critical`,
          ruleId: rule.ruleId,
          type: "latency",
          severity: "critical",
          message: `Rule "${rule.ruleName}" has critically high latency`,
          value: rule.processLatency,
          threshold: THRESHOLDS.latency.critical,
          suggestion: "Consider simplifying the SQL query or reducing data volume",
        });
      } else if (rule.processLatency > THRESHOLDS.latency.warning) {
        detected.push({
          id: `${rule.ruleId}-latency-warning`,
          ruleId: rule.ruleId,
          type: "latency",
          severity: "warning",
          message: `Rule "${rule.ruleName}" has elevated latency`,
          value: rule.processLatency,
          threshold: THRESHOLDS.latency.warning,
          suggestion: "Monitor closely and optimize if latency increases",
        });
      }

      // Low throughput detection
      if (rule.throughput < THRESHOLDS.throughput.critical) {
        detected.push({
          id: `${rule.ruleId}-throughput-critical`,
          ruleId: rule.ruleId,
          type: "throughput",
          severity: "critical",
          message: `Rule "${rule.ruleName}" has very low throughput`,
          value: rule.throughput,
          threshold: THRESHOLDS.throughput.critical,
          suggestion: "Check source connectivity and data ingestion rate",
        });
      } else if (rule.throughput < THRESHOLDS.throughput.warning) {
        detected.push({
          id: `${rule.ruleId}-throughput-warning`,
          ruleId: rule.ruleId,
          type: "throughput",
          severity: "warning",
          message: `Rule "${rule.ruleName}" has low throughput`,
          value: rule.throughput,
          threshold: THRESHOLDS.throughput.warning,
          suggestion: "Verify data source is producing expected volume",
        });
      }

      // High error rate detection
      const errorRate = (rule.exceptions / (rule.recordsIn || 1)) * 100;
      if (errorRate > THRESHOLDS.errorRate.critical) {
        detected.push({
          id: `${rule.ruleId}-error-critical`,
          ruleId: rule.ruleId,
          type: "error",
          severity: "critical",
          message: `Rule "${rule.ruleName}" has critical error rate (${errorRate.toFixed(1)}%)`,
          value: errorRate,
          threshold: THRESHOLDS.errorRate.critical,
          suggestion: "Review rule SQL and sink configuration for errors",
        });
      } else if (errorRate > THRESHOLDS.errorRate.warning) {
        detected.push({
          id: `${rule.ruleId}-error-warning`,
          ruleId: rule.ruleId,
          type: "error",
          severity: "warning",
          message: `Rule "${rule.ruleName}" has elevated error rate (${errorRate.toFixed(1)}%)`,
          value: errorRate,
          threshold: THRESHOLDS.errorRate.warning,
          suggestion: "Check logs for error details and patterns",
        });
      }
    });

    // System-level bottlenecks
    if (systemMetrics.cpuUsage > THRESHOLDS.cpu.critical) {
      detected.push({
        id: "system-cpu-critical",
        ruleId: "system",
        type: "cpu",
        severity: "critical",
        message: "CPU usage is critically high",
        value: systemMetrics.cpuUsage,
        threshold: THRESHOLDS.cpu.critical,
        suggestion: "Consider scaling horizontally or reducing active rules",
      });
    } else if (systemMetrics.cpuUsage > THRESHOLDS.cpu.warning) {
      detected.push({
        id: "system-cpu-warning",
        ruleId: "system",
        type: "cpu",
        severity: "warning",
        message: "CPU usage is elevated",
        value: systemMetrics.cpuUsage,
        threshold: THRESHOLDS.cpu.warning,
        suggestion: "Monitor for further increases",
      });
    }

    const memoryPercent = (systemMetrics.memoryUsage / systemMetrics.memoryTotal) * 100;
    if (memoryPercent > THRESHOLDS.memory.critical) {
      detected.push({
        id: "system-memory-critical",
        ruleId: "system",
        type: "memory",
        severity: "critical",
        message: "Memory usage is critically high",
        value: memoryPercent,
        threshold: THRESHOLDS.memory.critical,
        suggestion: "Increase memory allocation or reduce data retention",
      });
    } else if (memoryPercent > THRESHOLDS.memory.warning) {
      detected.push({
        id: "system-memory-warning",
        ruleId: "system",
        type: "memory",
        severity: "warning",
        message: "Memory usage is elevated",
        value: memoryPercent,
        threshold: THRESHOLDS.memory.warning,
        suggestion: "Consider optimizing memory-intensive operations",
      });
    }

    // Sort by severity
    detected.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    setBottlenecks(detected);
    setIsAnalyzing(false);
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical":
        return <Badge variant="destructive">Critical</Badge>;
      case "warning":
        return <Badge className="bg-amber-500">Warning</Badge>;
      default:
        return <Badge variant="secondary">Info</Badge>;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "latency":
        return <Clock className="h-4 w-4" />;
      case "throughput":
        return <ArrowDown className="h-4 w-4" />;
      case "error":
        return <AlertCircle className="h-4 w-4" />;
      case "cpu":
      case "memory":
        return <Zap className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const criticalCount = bottlenecks.filter((b) => b.severity === "critical").length;
  const warningCount = bottlenecks.filter((b) => b.severity === "warning").length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Bottleneck Detection
          </CardTitle>
          <div className="flex items-center gap-2">
            {criticalCount > 0 && (
              <Badge variant="destructive">{criticalCount} Critical</Badge>
            )}
            {warningCount > 0 && (
              <Badge className="bg-amber-500">{warningCount} Warning</Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                analyzeBottlenecks();
                onRefresh?.();
              }}
              disabled={isAnalyzing}
            >
              <RefreshCw className={`h-4 w-4 ${isAnalyzing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {bottlenecks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Zap className="h-8 w-8 mb-2 text-green-500" />
            <p className="text-sm">No bottlenecks detected</p>
            <p className="text-xs">System is running optimally</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {bottlenecks.map((bottleneck) => (
              <div
                key={bottleneck.id}
                className="border rounded-lg p-3 space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {getSeverityIcon(bottleneck.severity)}
                    <span className="font-medium text-sm">{bottleneck.message}</span>
                  </div>
                  {getSeverityBadge(bottleneck.severity)}
                </div>
                
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    {getTypeIcon(bottleneck.type)}
                    <span className="capitalize">{bottleneck.type}</span>
                  </div>
                  <span>
                    Value: <span className="font-mono">{bottleneck.value.toFixed(1)}</span>
                  </span>
                  <span>
                    Threshold: <span className="font-mono">{bottleneck.threshold}</span>
                  </span>
                </div>

                <div className="bg-muted/50 rounded p-2 text-xs">
                  <span className="font-medium">Suggestion:</span>{" "}
                  {bottleneck.suggestion}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
