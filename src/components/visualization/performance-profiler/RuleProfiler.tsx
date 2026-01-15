"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Play,
  Square,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Zap,
  Clock,
} from "lucide-react";
import type { RuleMetrics } from "./PerformanceProfiler";

interface RuleProfilerProps {
  ruleMetrics: RuleMetrics[];
  onRuleSelect: (ruleId: string) => void;
}

export function RuleProfiler({ ruleMetrics, onRuleSelect }: RuleProfilerProps) {
  const maxThroughput = Math.max(...ruleMetrics.map((r) => r.throughput), 1);
  const maxLatency = Math.max(...ruleMetrics.map((r) => r.processLatency), 1);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "running":
        return <Play className="h-3 w-3 fill-green-500 text-green-500" />;
      case "stopped":
        return <Square className="h-3 w-3 text-gray-500" />;
      case "error":
        return <AlertTriangle className="h-3 w-3 text-red-500" />;
      default:
        return null;
    }
  };

  const getLatencyColor = (latency: number) => {
    if (latency < 20) return "text-green-500";
    if (latency < 50) return "text-amber-500";
    return "text-red-500";
  };

  const getExceptionColor = (exceptions: number) => {
    if (exceptions === 0) return "text-green-500";
    if (exceptions < 5) return "text-amber-500";
    return "text-red-500";
  };

  if (ruleMetrics.length === 0) {
    return (
      <Card className="h-full flex items-center justify-center">
        <p className="text-muted-foreground">No rules to profile</p>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Rule Performance</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        <ScrollArea className="h-full">
          <div className="space-y-4">
            {ruleMetrics.map((rule) => (
              <div
                key={rule.ruleId}
                className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => onRuleSelect(rule.ruleId)}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(rule.status)}
                    <span className="font-medium">{rule.ruleName}</span>
                    <Badge
                      variant={rule.status === "running" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {rule.status}
                    </Badge>
                  </div>
                  {rule.lastError && (
                    <Badge variant="destructive" className="text-xs">
                      Error
                    </Badge>
                  )}
                </div>

                {/* Metrics grid */}
                <div className="grid grid-cols-4 gap-4 text-sm">
                  {/* Throughput */}
                  <div>
                    <div className="flex items-center gap-1 text-muted-foreground mb-1">
                      <Zap className="h-3 w-3" />
                      <span className="text-xs">Throughput</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sota-blue">
                        {rule.throughput.toFixed(0)}
                      </span>
                      <span className="text-xs text-muted-foreground">rec/s</span>
                    </div>
                    <Progress
                      value={(rule.throughput / maxThroughput) * 100}
                      className="h-1 mt-1"
                    />
                  </div>

                  {/* Latency */}
                  <div>
                    <div className="flex items-center gap-1 text-muted-foreground mb-1">
                      <Clock className="h-3 w-3" />
                      <span className="text-xs">Latency</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`font-mono ${getLatencyColor(rule.processLatency)}`}>
                        {rule.processLatency.toFixed(1)}
                      </span>
                      <span className="text-xs text-muted-foreground">ms</span>
                    </div>
                    <Progress
                      value={(rule.processLatency / maxLatency) * 100}
                      className="h-1 mt-1"
                    />
                  </div>

                  {/* Records */}
                  <div>
                    <div className="flex items-center gap-1 text-muted-foreground mb-1">
                      <TrendingUp className="h-3 w-3" />
                      <span className="text-xs">Records</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-green-500">{rule.recordsIn}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="text-blue-500">{rule.recordsOut}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {((rule.recordsOut / Math.max(rule.recordsIn, 1)) * 100).toFixed(0)}% output
                    </div>
                  </div>

                  {/* Exceptions */}
                  <div>
                    <div className="flex items-center gap-1 text-muted-foreground mb-1">
                      <AlertTriangle className="h-3 w-3" />
                      <span className="text-xs">Exceptions</span>
                    </div>
                    <span className={`font-mono ${getExceptionColor(rule.exceptions)}`}>
                      {rule.exceptions}
                    </span>
                  </div>
                </div>

                {/* Error message */}
                {rule.lastError && (
                  <div className="mt-3 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400">
                    {rule.lastError}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
