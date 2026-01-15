"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { RuleMetrics } from "./PerformanceProfiler";

interface MetricsChartProps {
  metricsHistory: Map<string, RuleMetrics[]>;
  selectedRule: string | null;
  onRuleSelect: (ruleId: string | null) => void;
}

const CHART_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
];

export function MetricsChart({
  metricsHistory,
  selectedRule,
  onRuleSelect,
}: MetricsChartProps) {
  const ruleIds = Array.from(metricsHistory.keys());

  // Prepare throughput chart data
  const throughputData = useMemo(() => {
    if (metricsHistory.size === 0) return [];

    const maxLength = Math.max(
      ...Array.from(metricsHistory.values()).map((h) => h.length)
    );

    const data: Record<string, any>[] = [];
    for (let i = 0; i < maxLength; i++) {
      const point: Record<string, any> = { index: i };

      for (const [ruleId, history] of metricsHistory) {
        const metric = history[i];
        if (metric) {
          point[ruleId] = metric.throughput;
          point.time = new Date(metric.timestamp).toLocaleTimeString();
        }
      }

      data.push(point);
    }

    return data;
  }, [metricsHistory]);

  // Prepare latency chart data
  const latencyData = useMemo(() => {
    if (metricsHistory.size === 0) return [];

    const maxLength = Math.max(
      ...Array.from(metricsHistory.values()).map((h) => h.length)
    );

    const data: Record<string, any>[] = [];
    for (let i = 0; i < maxLength; i++) {
      const point: Record<string, any> = { index: i };

      for (const [ruleId, history] of metricsHistory) {
        const metric = history[i];
        if (metric) {
          point[ruleId] = metric.processLatency;
          point.time = new Date(metric.timestamp).toLocaleTimeString();
        }
      }

      data.push(point);
    }

    return data;
  }, [metricsHistory]);

  // Get rule name from history
  const getRuleName = (ruleId: string): string => {
    const history = metricsHistory.get(ruleId);
    return history?.[0]?.ruleName || ruleId;
  };

  if (metricsHistory.size === 0) {
    return (
      <Card className="h-full flex items-center justify-center">
        <p className="text-muted-foreground">Waiting for metrics data...</p>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Metrics Over Time</CardTitle>
          <div className="flex gap-2">
            {ruleIds.map((ruleId, index) => (
              <Badge
                key={ruleId}
                variant={selectedRule === ruleId ? "default" : "outline"}
                className="cursor-pointer"
                style={{
                  borderColor: CHART_COLORS[index % CHART_COLORS.length],
                  backgroundColor: selectedRule === ruleId
                    ? CHART_COLORS[index % CHART_COLORS.length]
                    : "transparent",
                }}
                onClick={() =>
                  onRuleSelect(selectedRule === ruleId ? null : ruleId)
                }
              >
                {getRuleName(ruleId)}
              </Badge>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1">
        <Tabs defaultValue="throughput" className="h-full flex flex-col">
          <TabsList className="w-fit">
            <TabsTrigger value="throughput">Throughput</TabsTrigger>
            <TabsTrigger value="latency">Latency</TabsTrigger>
          </TabsList>

          <TabsContent value="throughput" className="flex-1 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={throughputData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                <XAxis
                  dataKey="time"
                  stroke="#9ca3af"
                  fontSize={11}
                  tickLine={false}
                />
                <YAxis
                  stroke="#9ca3af"
                  fontSize={11}
                  tickLine={false}
                  label={{ value: "rec/s", angle: -90, position: "insideLeft" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1f2937",
                    border: "1px solid #374151",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                {ruleIds
                  .filter((id) => !selectedRule || id === selectedRule)
                  .map((ruleId, index) => (
                    <Line
                      key={ruleId}
                      type="monotone"
                      dataKey={ruleId}
                      name={getRuleName(ruleId)}
                      stroke={CHART_COLORS[index % CHART_COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  ))}
              </LineChart>
            </ResponsiveContainer>
          </TabsContent>

          <TabsContent value="latency" className="flex-1 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={latencyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                <XAxis
                  dataKey="time"
                  stroke="#9ca3af"
                  fontSize={11}
                  tickLine={false}
                />
                <YAxis
                  stroke="#9ca3af"
                  fontSize={11}
                  tickLine={false}
                  label={{ value: "ms", angle: -90, position: "insideLeft" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1f2937",
                    border: "1px solid #374151",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                {ruleIds
                  .filter((id) => !selectedRule || id === selectedRule)
                  .map((ruleId, index) => (
                    <Line
                      key={ruleId}
                      type="monotone"
                      dataKey={ruleId}
                      name={getRuleName(ruleId)}
                      stroke={CHART_COLORS[index % CHART_COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  ))}
              </LineChart>
            </ResponsiveContainer>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
