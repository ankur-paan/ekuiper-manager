"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Cpu, HardDrive, Clock, Layers } from "lucide-react";
import type { SystemMetrics } from "./PerformanceProfiler";

interface ResourceMonitorProps {
  systemMetrics: SystemMetrics;
}

export function ResourceMonitor({ systemMetrics }: ResourceMonitorProps) {
  const formatUptime = (uptimeMs: number) => {
    const now = Date.now();
    const uptime = now - uptimeMs;
    const hours = Math.floor(uptime / 3600000);
    const minutes = Math.floor((uptime % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  const getUsageColor = (usage: number) => {
    if (usage < 50) return "text-green-500";
    if (usage < 80) return "text-amber-500";
    return "text-red-500";
  };

  const memoryPercent = (systemMetrics.memoryUsage / systemMetrics.memoryTotal) * 100;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">System Resources</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* CPU */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-sm">
              <Cpu className="h-4 w-4 text-violet-500" />
              <span>CPU Usage</span>
            </div>
            <span className={`font-mono ${getUsageColor(systemMetrics.cpuUsage)}`}>
              {systemMetrics.cpuUsage.toFixed(1)}%
            </span>
          </div>
          <Progress value={systemMetrics.cpuUsage} className="h-2" />
        </div>

        {/* Memory */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-sm">
              <HardDrive className="h-4 w-4 text-blue-500" />
              <span>Memory</span>
            </div>
            <span className={`font-mono ${getUsageColor(memoryPercent)}`}>
              {systemMetrics.memoryUsage.toFixed(0)} / {systemMetrics.memoryTotal} MB
            </span>
          </div>
          <Progress value={memoryPercent} className="h-2" />
        </div>

        {/* Goroutines */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Layers className="h-4 w-4 text-green-500" />
            <span>Goroutines</span>
          </div>
          <span className="font-mono text-green-500">
            {systemMetrics.goroutines}
          </span>
        </div>

        {/* Uptime */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-amber-500" />
            <span>Uptime</span>
          </div>
          <span className="font-mono text-amber-500">
            {formatUptime(systemMetrics.uptime)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
