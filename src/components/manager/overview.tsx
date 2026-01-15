"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Activity, 
  Database, 
  Workflow, 
  Table,
  Package,
  Server,
  Cpu,
  HardDrive,
  Clock,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ArrowUpRight,
  Zap,
  Radio
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EKuiperManagerClient } from "@/lib/ekuiper/manager-client";
import type { SystemInfo, ServerMetrics } from "@/lib/ekuiper/manager-types";

interface ManagerOverviewProps {
  client: EKuiperManagerClient;
  onNavigate?: (view: string) => void;
}

function MetricCard({
  title,
  value,
  subValue,
  icon: Icon,
  trend,
  trendValue,
  onClick,
  variant = "default",
}: {
  title: string;
  value: string | number;
  subValue?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  onClick?: () => void;
  variant?: "default" | "success" | "warning" | "error";
}) {
  const variantStyles = {
    default: "border-border",
    success: "border-green-500/30 bg-green-500/5",
    warning: "border-yellow-500/30 bg-yellow-500/5",
    error: "border-red-500/30 bg-red-500/5",
  };

  return (
    <Card 
      className={cn(
        "transition-all",
        variantStyles[variant],
        onClick && "cursor-pointer hover:border-primary"
      )}
      onClick={onClick}
    >
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold">{value}</p>
              {subValue && (
                <span className="text-sm text-muted-foreground">{subValue}</span>
              )}
            </div>
            {trend && trendValue && (
              <div className={cn(
                "flex items-center gap-1 text-xs",
                trend === "up" ? "text-green-500" : 
                trend === "down" ? "text-red-500" : 
                "text-muted-foreground"
              )}>
                {trend === "up" ? <TrendingUp className="h-3 w-3" /> : 
                 trend === "down" ? <TrendingDown className="h-3 w-3" /> : null}
                {trendValue}
              </div>
            )}
          </div>
          <div className={cn(
            "p-2 rounded-lg",
            variant === "success" ? "bg-green-500/10" :
            variant === "warning" ? "bg-yellow-500/10" :
            variant === "error" ? "bg-red-500/10" :
            "bg-muted"
          )}>
            <Icon className={cn(
              "h-5 w-5",
              variant === "success" ? "text-green-500" :
              variant === "warning" ? "text-yellow-500" :
              variant === "error" ? "text-red-500" :
              "text-muted-foreground"
            )} />
          </div>
        </div>
        {onClick && (
          <div className="mt-3 pt-3 border-t flex items-center justify-between text-sm text-muted-foreground">
            <span>View details</span>
            <ArrowUpRight className="h-4 w-4" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SystemResourceCard({ 
  label, 
  value, 
  max, 
  unit,
  icon: Icon 
}: { 
  label: string; 
  value: number; 
  max?: number;
  unit: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  // -1 indicates value is not available from API
  const isNotAvailable = value < 0 || (max !== undefined && max < 0);
  const percentage = isNotAvailable ? 0 : (max ? (value / max) * 100 : value);
  const displayValue = isNotAvailable 
    ? "N/A" 
    : (max ? `${value.toFixed(1)} / ${max.toFixed(1)} ${unit}` : `${value.toFixed(1)} ${unit}`);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span>{label}</span>
        </div>
        <span className="font-mono text-muted-foreground">
          {displayValue}
        </span>
      </div>
      {!isNotAvailable && (
        <Progress 
          value={percentage} 
          className={cn(
            "h-2",
            percentage > 90 ? "[&>div]:bg-red-500" :
            percentage > 70 ? "[&>div]:bg-yellow-500" :
            "[&>div]:bg-green-500"
          )}
        />
      )}
    </div>
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
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  return (
    <div className="h-full overflow-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Server className="h-7 w-7" />
            eKuiper Manager
          </h1>
          <p className="text-muted-foreground mt-1">
            System overview and monitoring
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge 
            variant={isConnected ? "success" : "destructive"}
            className="gap-1"
          >
            {isConnected ? (
              <>
                <CheckCircle2 className="h-3 w-3" />
                Connected
              </>
            ) : (
              <>
                <XCircle className="h-3 w-3" />
                Disconnected
              </>
            )}
          </Badge>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              refetchConnection();
              refetchMetrics();
            }}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {!isConnected ? (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="py-8 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-yellow-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Cannot Connect to eKuiper</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Unable to connect to the eKuiper server. Please check that the server is running 
              and the URL is correct in the server settings.
            </p>
            <Button 
              className="mt-4"
              onClick={() => refetchConnection()}
            >
              Retry Connection
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* System Status */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Server className="h-4 w-4" />
                  Server Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Server className="h-4 w-4" />
                    <span>Version</span>
                  </div>
                  <Badge variant="outline">{systemInfo?.version && systemInfo.version !== "unknown" ? systemInfo.version : "N/A"}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Zap className="h-4 w-4" />
                    <span>OS</span>
                  </div>
                  <Badge variant="outline">{systemInfo?.os || "N/A"}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>Uptime</span>
                  </div>
                  <span className="font-mono">{systemInfo?.uptime && systemInfo.uptime > 0 ? formatUptime(systemInfo.uptime) : "N/A"}</span>
                </div>
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground">
                    Note: CPU/Memory metrics are not exposed by eKuiper API
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="lg:col-span-2 grid grid-cols-2 gap-4">
              <MetricCard
                title="Total Rules"
                value={metrics?.ruleCount || 0}
                subValue={`${metrics?.runningRules || 0} running`}
                icon={Workflow}
                onClick={() => onNavigate?.("manager-batch-rules")}
                variant={metrics?.runningRules === metrics?.ruleCount ? "success" : "warning"}
              />
              <MetricCard
                title="Streams"
                value={metrics?.streamCount || 0}
                icon={Database}
                onClick={() => onNavigate?.("streams")}
              />
              <MetricCard
                title="Messages Processed"
                value={(metrics?.totalMessagesIn || 0).toLocaleString()}
                subValue="total in"
                icon={Radio}
                trend="up"
                trendValue={`${(metrics?.totalMessagesOut || 0).toLocaleString()} out`}
              />
              <MetricCard
                title="Exceptions"
                value={metrics?.totalExceptions || 0}
                icon={AlertTriangle}
                variant={(metrics?.totalExceptions || 0) > 0 ? "error" : "success"}
              />
            </div>
          </div>

          {/* Quick Stats */}
          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => onNavigate?.("streams")}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Database className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{metrics?.streamCount || 0}</p>
                    <p className="text-sm text-muted-foreground">Streams</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => onNavigate?.("streams")}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/10">
                    <Table className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{metrics?.tableCount || 0}</p>
                    <p className="text-sm text-muted-foreground">Tables</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => onNavigate?.("plugins")}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <Package className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{metrics?.pluginCount || 0}</p>
                    <p className="text-sm text-muted-foreground">Plugins</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => onNavigate?.("plugins")}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-orange-500/10">
                    <Server className="h-5 w-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{metrics?.serviceCount || 0}</p>
                    <p className="text-sm text-muted-foreground">Services</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => onNavigate?.("manager-batch-rules")}>
                  <Workflow className="h-4 w-4 mr-2" />
                  Manage Rules
                </Button>
                <Button variant="outline" onClick={() => onNavigate?.("streams")}>
                  <Database className="h-4 w-4 mr-2" />
                  Manage Streams
                </Button>
                <Button variant="outline" onClick={() => onNavigate?.("manager-configurations")}>
                  <Server className="h-4 w-4 mr-2" />
                  Configurations
                </Button>
                <Button variant="outline" onClick={() => onNavigate?.("manager-import-export")}>
                  <Activity className="h-4 w-4 mr-2" />
                  Import/Export
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
