"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Activity,
  Database,
  Workflow,
  Table,
  Package,
  Server,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  Zap,
  Cpu,
  Radio,
  BarChart3,
  Globe
} from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";
import { EKuiperManagerClient } from "@/lib/ekuiper/manager-client";
import { GlassCard } from "@/components/ui/glass-card";
import { HealthRing } from "@/components/ui/health-ring";
import { motion } from "framer-motion";
import { Activity as ActivityIcon } from "lucide-react"; // Renamed for clarity vs Activity component

interface ManagerOverviewProps {
  client: EKuiperManagerClient;
  onNavigate?: (view: string) => void;
}

function MetricTile({
  title,
  value,
  subValue,
  icon: Icon,
  trend,
  trendValue,
  onClick,
  variant = "gradient",
  color = "blue"
}: {
  title: string;
  value: string | number;
  subValue?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: "up" | "down";
  trendValue?: string;
  onClick?: () => void;
  variant?: "default" | "gradient" | "neon-blue" | "neon-purple" | "neon-green";
  color?: "blue" | "purple" | "green" | "orange";
}) {
  const colorStyles = {
    blue: "text-blue-500 bg-blue-500/10",
    purple: "text-purple-500 bg-purple-500/10",
    green: "text-green-500 bg-green-500/10",
    orange: "text-orange-500 bg-orange-500/10",
    red: "text-red-500 bg-red-500/10",
  };

  return (
    <GlassCard
      variant={variant}
      hoverEffect={!!onClick}
      onClick={onClick}
      className="p-6 flex flex-col justify-between h-auto min-h-[140px]"
    >
      <div className="flex justify-between items-start">
        <div className={cn("p-2 rounded-xl", colorStyles[color])}>
          <Icon className="h-6 w-6" />
        </div>
        {trend && (
          <Badge variant="outline" className={cn(
            "gap-1 border-0",
            trend === "up" ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
          )}>
            <TrendingUp className={cn("h-3 w-3", trend === "down" && "rotate-180")} />
            {trendValue}
          </Badge>
        )}
      </div>

      <div className="mt-4">
        <h3 className="text-3xl font-bold tracking-tight">{value}</h3>
        <div className="flex items-center gap-2 mt-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {subValue && <span className="text-xs text-muted-foreground/60">• {subValue}</span>}
        </div>
      </div>
    </GlassCard>
  );
}

export function ManagerOverview({ client, onNavigate }: ManagerOverviewProps) {
  const [isConnected, setIsConnected] = useState(false);

  // Check connection
  const { data: connectionStatus, refetch: refetchConnection } = useQuery({
    queryKey: ["connection-test"],
    queryFn: () => client.testConnection(),
    refetchInterval: 10000,
  });

  // Get system info
  const { data: systemInfo, isLoading: loadingSystem } = useQuery({
    queryKey: ["system-info"],
    queryFn: () => client.getSystemInfo(),
    refetchInterval: 5000,
    enabled: connectionStatus?.success === true,
  });

  // Get server metrics
  const { data: metrics, isLoading: loadingMetrics, refetch: refetchMetrics } = useQuery({
    queryKey: ["server-metrics"],
    queryFn: () => client.getServerMetrics(),
    refetchInterval: 5000,
    enabled: connectionStatus?.success === true,
  });

  useEffect(() => {
    setIsConnected(connectionStatus?.success === true);
  }, [connectionStatus]);

  const formatUptime = (seconds: number): string => {
    if (!seconds) return "N/A";
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    return days > 0 ? `${days}d ${hours}h` : `${hours}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 }
  };

  // Calculate generic health score based on rules running vs total, and errors
  const calculateHealth = () => {
    if (!metrics) return 0;
    if (metrics.ruleCount === 0) return 100; // No rules, good health?

    const ruleHealth = (metrics.runningRules / (metrics.ruleCount || 1)) * 100;
    const errorPenalty = Math.min((metrics.totalExceptions || 0) * 5, 20); // Penalty for exceptions
    return Math.max(Math.round(ruleHealth - errorPenalty), 0);
  };

  return (
    <div className="h-full overflow-y-auto p-6 md:p-8 space-y-8 bg-gradient-to-br from-background via-background to-muted/20">

      {/* Header Section */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-1"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-sota-blue to-purple-600 shadow-lg shadow-purple-500/20">
              <Server className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
              Dashboard
            </h1>
          </div>
          <p className="text-muted-foreground pl-14">
            Monitor your event streaming pipelines
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
        >
          <div className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-full border backdrop-blur-sm",
            isConnected ? "bg-green-500/10 border-green-500/20 text-green-500" : "bg-red-500/10 border-red-500/20 text-red-500"
          )}>
            <div className={cn("w-2 h-2 rounded-full animate-pulse", isConnected ? "bg-green-500" : "bg-red-500")} />
            <span className="text-sm font-medium">{isConnected ? "System Online" : "System Offline"}</span>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => { refetchConnection(); refetchMetrics(); }}
            className="rounded-full hover:bg-muted/50 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </motion.div>
      </div>

      {!isConnected ? (
        <GlassCard variant="neon-purple" className="flex flex-col items-center justify-center py-16 text-center">
          <div className="p-4 rounded-full bg-red-500/10 mb-4">
            <AlertTriangle className="h-12 w-12 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Connection Lost</h2>
          <p className="text-muted-foreground max-w-md mb-6">
            Use "localhost:9081" or check your connection settings.
          </p>
          <Button onClick={() => refetchConnection()} size="lg" className="rounded-full px-8">
            Retry Connection
          </Button>
        </GlassCard>
      ) : (
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 lg:grid-cols-12 gap-6"
        >

          {/* Main Stats Row */}
          <motion.div variants={item} className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            <MetricTile
              title="Active Rules"
              value={metrics?.runningRules || 0}
              subValue={`of ${metrics?.ruleCount || 0} total`}
              icon={Workflow}
              color="green"
              variant="neon-green"
              onClick={() => onNavigate?.("manager-batch-rules")}
            />
            <MetricTile
              title="Events Processed"
              value={(metrics?.totalMessagesIn || 0).toLocaleString()}
              icon={Activity}
              color="blue"
              variant="neon-blue"
              trend="up"
              trendValue={`${(metrics?.totalMessagesOut || 0).toLocaleString()} out`}
            />
            <MetricTile
              title="Data Streams"
              value={metrics?.streamCount || 0}
              icon={Database}
              color="purple"
              onClick={() => onNavigate?.("streams")}
            />
            <MetricTile
              title="Active Plugins"
              value={metrics?.pluginCount || 0}
              icon={Package}
              color="orange"
              onClick={() => onNavigate?.("plugins")}
            />
          </motion.div>

          {/* System Health Column */}
          <motion.div variants={item} className="lg:col-span-4">
            <GlassCard className="h-full min-h-[300px] flex flex-col justify-center items-center p-6 relative">
              <div className="absolute top-4 right-4">
                <Badge variant="outline" className="font-mono text-xs">{systemInfo?.version || "v1.0.0"}</Badge>
              </div>
              <HealthRing score={calculateHealth()} label="System Health" subLabel={`Uptime: ${formatUptime(systemInfo?.uptime || 0)}`} />

              <div className="w-full mt-8 space-y-4">
                {/* CPU Usage */}
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-2"><Cpu className="h-4 w-4" /> CPU Load</span>
                    <span className="font-medium font-mono">{systemInfo?.cpuUsage || "0%"}</span>
                  </div>
                  {/* Visual bar for CPU */}
                  <div className="h-1.5 w-full bg-secondary/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-500"
                      style={{ width: systemInfo?.cpuUsage || "0%" }}
                    />
                  </div>
                </div>

                {/* Memory Usage */}
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-2"><ActivityIcon className="h-4 w-4" /> Memory</span>
                    <span className="font-medium font-mono">
                      {systemInfo?.memoryUsed ? formatBytes(parseInt(systemInfo.memoryUsed)) : "0 B"} / {systemInfo?.memoryTotal ? formatBytes(parseInt(systemInfo.memoryTotal)) : "0 B"}
                    </span>
                  </div>
                  {/* Visual bar for Memory */}
                  <div className="h-1.5 w-full bg-secondary/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 rounded-full transition-all duration-500"
                      style={{
                        width: systemInfo?.memoryUsed && systemInfo?.memoryTotal
                          ? `${(parseInt(systemInfo.memoryUsed) / parseInt(systemInfo.memoryTotal)) * 100}%`
                          : "0%"
                      }}
                    />
                  </div>
                </div>

                <div className="flex justify-between text-sm pt-2 border-t border-border/40">
                  <span className="text-muted-foreground flex items-center gap-2"><Cpu className="h-4 w-4" /> OS / Arch</span>
                  <span className="font-medium">{systemInfo?.os || "-"} / {systemInfo?.arch || "-"}</span>
                </div>
              </div>
            </GlassCard>
          </motion.div>

          {/* Quick Actions Row */}
          <motion.div variants={item} className="lg:col-span-12">
            <h3 className="text-lg font-semibold mb-4 px-1">Quick Actions</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Create Rule", icon: Workflow, view: "manager-batch-rules", desc: "Define logic" },
                { label: "Add Stream", icon: Radio, view: "streams", desc: "Connect data source" },
                { label: "Server Config", icon: Server, view: "manager-configurations", desc: "System settings" },
                { label: "Extensions", icon: Package, view: "plugins", desc: "Manage plugins" },
                { label: "API Docs", icon: Globe, view: "api-docs", desc: "Swagger Reference" },
              ].map((action, i) => (
                <GlassCard
                  key={i}
                  hoverEffect
                  onClick={() => onNavigate?.(action.view)}
                  className="p-4 flex items-center gap-4 cursor-pointer group"
                >
                  <div className="p-3 rounded-full bg-secondary group-hover:bg-primary/20 transition-colors">
                    <action.icon className="h-5 w-5 group-hover:text-primary transition-colors" />
                  </div>
                  <div>
                    <p className="font-medium group-hover:text-primary transition-colors">{action.label}</p>
                    <p className="text-xs text-muted-foreground">{action.desc}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 ml-auto opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all text-primary" />
                </GlassCard>
              ))}
            </div>
          </motion.div>

          {/* Activity Chart Area (Placeholder for now, keeping it clean) */}
          <motion.div variants={item} className="lg:col-span-12">
            <GlassCard className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold">Throughput History</h3>
                  <p className="text-sm text-muted-foreground">Incoming vs Outgoing messages</p>
                </div>
              </div>
              <div className="h-[200px] w-full flex items-center justify-center border-2 border-dashed border-muted rounded-lg bg-muted/5">
                <div className="text-center text-muted-foreground">
                  <BarChart3 className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>Real-time chart visualization coming soon</p>
                </div>
              </div>
            </GlassCard>
          </motion.div>

        </motion.div>
      )}
    </div>
  );
}

