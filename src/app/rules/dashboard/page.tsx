"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useServerStore } from "@/stores/server-store";
import { AppLayout } from "@/components/layout";
import { LoadingPage, ErrorState, EmptyState } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    RefreshCw,
    Cpu,
    Activity,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    Play,
    Square,
    TrendingUp,
    Gauge,
    BarChart3,
    Eye,
} from "lucide-react";
import { toast } from "sonner";

interface RuleStatus {
    id: string;
    status: string;
    recordsIn: number;
    recordsOut: number;
    exceptions: number;
    latencyMs: number;
    cpuMs?: number;
}

interface RuleMetricData {
    status: string;
    lastStartTimestamp?: number;
    lastStopTimestamp?: number;
    [key: string]: any;
}

export default function RulesDashboardPage() {
    const router = useRouter();
    const { servers, activeServerId } = useServerStore();
    const activeServer = servers.find((s) => s.id === activeServerId);

    const [rulesStatus, setRulesStatus] = React.useState<Record<string, RuleMetricData>>({});
    const [cpuUsage, setCpuUsage] = React.useState<Record<string, number>>({});
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [autoRefresh, setAutoRefresh] = React.useState(false);

    const fetchData = React.useCallback(async () => {
        if (!activeServer) return;

        try {
            // Fetch bulk status
            const statusResponse = await fetch("/api/ekuiper/rules/status/all", {
                headers: { "X-EKuiper-URL": activeServer.url },
            });
            if (statusResponse.ok) {
                const statusData = await statusResponse.json();
                setRulesStatus(statusData || {});
            }

            // Fetch CPU usage
            const cpuResponse = await fetch("/api/ekuiper/rules/usage/cpu", {
                headers: { "X-EKuiper-URL": activeServer.url },
            });
            if (cpuResponse.ok) {
                const cpuData = await cpuResponse.json();
                setCpuUsage(cpuData || {});
            }

            setError(null);
        } catch (err) {
            if (!error) {
                setError(err instanceof Error ? err.message : "Failed to fetch data");
            }
        } finally {
            setLoading(false);
        }
    }, [activeServer, error]);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Auto-refresh every 5 seconds if enabled
    React.useEffect(() => {
        if (!autoRefresh) return;
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, [autoRefresh, fetchData]);

    // Parse rule metrics from bulk status
    const parseRuleMetrics = (ruleId: string, data: RuleMetricData): RuleStatus => {
        let recordsIn = 0;
        let recordsOut = 0;
        let exceptions = 0;
        let latencySum = 0;
        let latencyCount = 0;

        // Parse metrics from keys like source_X_records_in_total, op_X_records_out_total, sink_X_...
        Object.keys(data).forEach((key) => {
            if (key.includes("records_in_total")) {
                recordsIn += Number(data[key]) || 0;
            }
            if (key.includes("records_out_total")) {
                recordsOut += Number(data[key]) || 0;
            }
            if (key.includes("exceptions_total")) {
                exceptions += Number(data[key]) || 0;
            }
            if (key.includes("process_latency")) {
                latencySum += Number(data[key]) || 0;
                latencyCount++;
            }
        });

        return {
            id: ruleId,
            status: data.status || "unknown",
            recordsIn,
            recordsOut,
            exceptions,
            latencyMs: latencyCount > 0 ? latencySum / latencyCount / 1000 : 0,
            cpuMs: cpuUsage[ruleId],
        };
    };

    const rules = Object.entries(rulesStatus).map(([id, data]) => parseRuleMetrics(id, data));
    const totalRules = rules.length;
    const runningRules = rules.filter((r) => r.status === "running").length;
    const stoppedRules = rules.filter((r) => r.status !== "running" && !r.status.includes("error")).length;
    const errorRules = rules.filter((r) => r.status.includes("error")).length;
    const totalCPU = Object.values(cpuUsage).reduce((sum, cpu) => sum + cpu, 0);

    // Sort rules by CPU usage for the chart
    const sortedByCPU = [...rules].sort((a, b) => (b.cpuMs || 0) - (a.cpuMs || 0));

    if (!activeServer) {
        return (
            <AppLayout title="Rules Dashboard">
                <EmptyState
                    title="No Server Connected"
                    description="Connect to an eKuiper server to view the rules dashboard."
                />
            </AppLayout>
        );
    }

    if (loading) {
        return (
            <AppLayout title="Rules Dashboard">
                <LoadingPage label="Loading dashboard..." />
            </AppLayout>
        );
    }

    return (
        <AppLayout title="Rules Dashboard">
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">Rules Dashboard</h2>
                        <p className="text-muted-foreground">
                            Real-time overview of all rules and resource usage
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant={autoRefresh ? "default" : "outline"}
                            size="sm"
                            onClick={() => setAutoRefresh(!autoRefresh)}
                        >
                            <Activity className={`mr-2 h-4 w-4 ${autoRefresh ? "animate-pulse" : ""}`} />
                            {autoRefresh ? "Auto-Refresh On" : "Auto-Refresh"}
                        </Button>
                        <Button variant="outline" size="icon" onClick={fetchData}>
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid gap-4 md:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Rules</CardTitle>
                            <BarChart3 className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalRules}</div>
                            <p className="text-xs text-muted-foreground">
                                Active rules in the system
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Running</CardTitle>
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-600">{runningRules}</div>
                            <Progress value={(runningRules / totalRules) * 100} className="mt-2 h-2" />
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Stopped</CardTitle>
                            <Square className="h-4 w-4 text-gray-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-gray-600">{stoppedRules}</div>
                            <p className="text-xs text-muted-foreground">
                                Intentionally stopped
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Errors</CardTitle>
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-red-600">{errorRules}</div>
                            <p className="text-xs text-muted-foreground">
                                Rules with errors
                            </p>
                        </CardContent>
                    </Card>
                </div>

                <Tabs defaultValue="status">
                    <TabsList>
                        <TabsTrigger value="status">
                            <Activity className="mr-2 h-4 w-4" />
                            Status Overview
                        </TabsTrigger>
                        <TabsTrigger value="cpu">
                            <Cpu className="mr-2 h-4 w-4" />
                            CPU Usage
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="status" className="space-y-4">
                        {/* Rules Status Grid */}
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {rules.map((rule) => (
                                <Card key={rule.id} className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => router.push(`/rules/${rule.id}/status`)}>
                                    <CardHeader className="pb-2">
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-sm font-medium">{rule.id}</CardTitle>
                                            <Badge
                                                variant={
                                                    rule.status === "running"
                                                        ? "default"
                                                        : rule.status.includes("error")
                                                            ? "destructive"
                                                            : "secondary"
                                                }
                                            >
                                                {rule.status === "running" ? (
                                                    <><Play className="mr-1 h-3 w-3" /> Running</>
                                                ) : rule.status.includes("error") ? (
                                                    <><XCircle className="mr-1 h-3 w-3" /> Error</>
                                                ) : (
                                                    <><Square className="mr-1 h-3 w-3" /> Stopped</>
                                                )}
                                            </Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                            <div>
                                                <p className="text-muted-foreground">Records In</p>
                                                <p className="font-medium">{rule.recordsIn.toLocaleString()}</p>
                                            </div>
                                            <div>
                                                <p className="text-muted-foreground">Records Out</p>
                                                <p className="font-medium">{rule.recordsOut.toLocaleString()}</p>
                                            </div>
                                            <div>
                                                <p className="text-muted-foreground">Exceptions</p>
                                                <p className={`font-medium ${rule.exceptions > 0 ? "text-red-500" : ""}`}>
                                                    {rule.exceptions}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-muted-foreground">Latency</p>
                                                <p className="font-medium">{rule.latencyMs.toFixed(2)} ms</p>
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="sm" className="w-full mt-2">
                                            <Eye className="mr-2 h-4 w-4" />
                                            View Details
                                        </Button>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </TabsContent>

                    <TabsContent value="cpu" className="space-y-4">
                        {/* CPU Usage */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Cpu className="h-5 w-5" />
                                    CPU Usage (Last 30 seconds)
                                </CardTitle>
                                <CardDescription>
                                    Total CPU time: {totalCPU.toLocaleString()} ms
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {Object.keys(cpuUsage).length === 0 ? (
                                    <p className="text-muted-foreground text-center py-8">
                                        No CPU usage data available. Make sure rules are running.
                                    </p>
                                ) : (
                                    <div className="space-y-4">
                                        {sortedByCPU.map((rule) => {
                                            const cpuPercent = totalCPU > 0 ? ((rule.cpuMs || 0) / totalCPU) * 100 : 0;
                                            return (
                                                <div key={rule.id} className="space-y-1">
                                                    <div className="flex items-center justify-between text-sm">
                                                        <span className="font-medium">{rule.id}</span>
                                                        <span className="text-muted-foreground">
                                                            {(rule.cpuMs || 0).toLocaleString()} ms ({cpuPercent.toFixed(1)}%)
                                                        </span>
                                                    </div>
                                                    <div className="h-4 bg-muted rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all"
                                                            style={{ width: `${Math.min(100, cpuPercent)}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Resource Alerts */}
                        {sortedByCPU.some((r) => (r.cpuMs || 0) > 1000) && (
                            <Card className="border-amber-500/50">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-amber-600">
                                        <AlertTriangle className="h-5 w-5" />
                                        Resource Alerts
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ul className="space-y-2">
                                        {sortedByCPU
                                            .filter((r) => (r.cpuMs || 0) > 1000)
                                            .map((r) => (
                                                <li key={r.id} className="flex items-center gap-2 text-sm">
                                                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                                                    <span>
                                                        <strong>{r.id}</strong> is consuming high CPU ({(r.cpuMs || 0).toLocaleString()} ms)
                                                    </span>
                                                </li>
                                            ))}
                                    </ul>
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>
                </Tabs>
            </div>
        </AppLayout>
    );
}
