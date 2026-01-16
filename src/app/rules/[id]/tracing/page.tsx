"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useServerStore } from "@/stores/server-store";
import { AppLayout } from "@/components/layout";
import { LoadingPage, ErrorState, EmptyState } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
    ArrowLeft,
    Activity,
    RefreshCw,
    Play,
    Square,
    Zap,
    Clock,
    ChevronRight,
    ChevronDown,
    Database,
    Cpu,
    Send,
    Radio,
} from "lucide-react";
import { toast } from "sonner";

interface TraceSpan {
    Name: string;
    TraceID: string;
    SpanID: string;
    ParentSpanID: string;
    Attribute?: Record<string, string>;
    StartTime: string;
    EndTime: string;
    ChildSpan: TraceSpan[];
}

export default function RuleTracingPage() {
    const params = useParams();
    const router = useRouter();
    const ruleId = params.id as string;
    const { servers, activeServerId } = useServerStore();
    const activeServer = servers.find((s) => s.id === activeServerId);

    const [traceIds, setTraceIds] = React.useState<string[]>([]);
    const [selectedTraceId, setSelectedTraceId] = React.useState<string | null>(null);
    const [traceDetail, setTraceDetail] = React.useState<TraceSpan | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [traceLoading, setTraceLoading] = React.useState(false);
    const [isTracing, setIsTracing] = React.useState(false);
    const [strategy, setStrategy] = React.useState<"always" | "head">("always");
    const [error, setError] = React.useState<string | null>(null);
    const [expandedSpans, setExpandedSpans] = React.useState<Set<string>>(new Set());

    const fetchTraceIds = React.useCallback(async () => {
        if (!activeServer || !ruleId) return;

        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/ekuiper/trace/rule/${encodeURIComponent(ruleId)}`, {
                headers: { "X-EKuiper-URL": activeServer.url },
            });

            if (response.ok) {
                const data = await response.json();
                setTraceIds(Array.isArray(data) ? data : []);
            } else {
                setTraceIds([]);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to fetch traces");
        } finally {
            setLoading(false);
        }
    }, [activeServer, ruleId]);

    React.useEffect(() => {
        fetchTraceIds();
    }, [fetchTraceIds]);

    const fetchTraceDetail = async (traceId: string) => {
        if (!activeServer) return;

        setTraceLoading(true);
        try {
            const response = await fetch(`/api/ekuiper/trace/${encodeURIComponent(traceId)}`, {
                headers: { "X-EKuiper-URL": activeServer.url },
            });

            if (response.ok) {
                const data = await response.json();
                setTraceDetail(data);
                // Expand all spans by default
                const allSpanIds = collectSpanIds(data);
                setExpandedSpans(new Set(allSpanIds));
            }
        } catch (err) {
            toast.error("Failed to fetch trace details");
        } finally {
            setTraceLoading(false);
        }
    };

    const collectSpanIds = (span: TraceSpan): string[] => {
        if (!span) return [];
        const ids = [span.SpanID];
        span.ChildSpan?.forEach((child) => {
            ids.push(...collectSpanIds(child));
        });
        return ids;
    };

    const handleStartTracing = async () => {
        if (!activeServer) return;

        try {
            const response = await fetch(`/api/ekuiper/rules/${encodeURIComponent(ruleId)}/trace/start`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-EKuiper-URL": activeServer.url,
                },
                body: JSON.stringify({ strategy }),
            });

            if (response.ok) {
                setIsTracing(true);
                toast.success(`Tracing started with "${strategy}" strategy`);
            } else {
                throw new Error("Failed to start tracing");
            }
        } catch (err) {
            toast.error("Failed to start tracing");
        }
    };

    const handleStopTracing = async () => {
        if (!activeServer) return;

        try {
            const response = await fetch(`/api/ekuiper/rules/${encodeURIComponent(ruleId)}/trace/stop`, {
                method: "POST",
                headers: { "X-EKuiper-URL": activeServer.url },
            });

            if (response.ok) {
                setIsTracing(false);
                toast.success("Tracing stopped");
                fetchTraceIds();
            } else {
                throw new Error("Failed to stop tracing");
            }
        } catch (err) {
            toast.error("Failed to stop tracing");
        }
    };

    const toggleSpan = (spanId: string) => {
        setExpandedSpans((prev) => {
            const next = new Set(prev);
            if (next.has(spanId)) {
                next.delete(spanId);
            } else {
                next.add(spanId);
            }
            return next;
        });
    };

    const calculateDuration = (start: string, end: string): string => {
        if (!start || !end) return "unknown";
        const startTime = new Date(start).getTime();
        const endTime = new Date(end).getTime();
        if (isNaN(startTime) || isNaN(endTime)) return "unknown";
        const durationMs = endTime - startTime;
        if (durationMs < 1) return "<1ms";
        if (durationMs < 1000) return `${durationMs.toFixed(2)}ms`;
        return `${(durationMs / 1000).toFixed(2)}s`;
    };

    const getSpanIcon = (name: string) => {
        if (!name) return <Cpu className="h-4 w-4 text-amber-500" />;
        const lowerName = name.toLowerCase();
        if (lowerName.includes("source") || lowerName.includes("demo")) return <Database className="h-4 w-4 text-blue-500" />;
        if (lowerName.includes("sink") || lowerName.includes("log") || lowerName.includes("mqtt")) return <Send className="h-4 w-4 text-green-500" />;
        return <Cpu className="h-4 w-4 text-amber-500" />;
    };

    const renderSpan = (span: TraceSpan, depth: number = 0): React.ReactNode => {
        if (!span) return null;
        const isExpanded = expandedSpans.has(span.SpanID);
        const hasChildren = span.ChildSpan && span.ChildSpan.length > 0;

        return (
            <div key={span.SpanID} className={`${depth > 0 ? "ml-6 border-l-2 border-muted pl-4" : ""}`}>
                <div
                    className="flex items-start gap-2 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => hasChildren && toggleSpan(span.SpanID)}
                >
                    {hasChildren && (
                        <button className="mt-1">
                            {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                        </button>
                    )}
                    {!hasChildren && <div className="w-4" />}

                    {getSpanIcon(span.Name)}

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{span.Name}</span>
                            <Badge variant="outline" className="text-xs">
                                {calculateDuration(span.StartTime, span.EndTime)}
                            </Badge>
                        </div>
                        {span.Attribute && Object.keys(span.Attribute).length > 0 && (
                            <div className="mt-1">
                                {Object.entries(span.Attribute).map(([key, value]) => (
                                    <div key={key} className="text-xs text-muted-foreground">
                                        <span className="font-medium">{key}:</span>{" "}
                                        <code className="bg-muted px-1 rounded text-xs max-w-[300px] truncate inline-block align-bottom">
                                            {String(value).length > 50 ? String(value).slice(0, 50) + "..." : String(value)}
                                        </code>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {isExpanded && hasChildren && (
                    <div className="space-y-1">
                        {span.ChildSpan.map((child) => renderSpan(child, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    if (!activeServer) {
        return (
            <AppLayout title="Rule Tracing">
                <EmptyState
                    title="No Server Connected"
                    description="Connect to an eKuiper server to view traces."
                />
            </AppLayout>
        );
    }

    if (loading) {
        return (
            <AppLayout title={`Tracing: ${ruleId}`}>
                <LoadingPage label="Loading traces..." />
            </AppLayout>
        );
    }

    return (
        <AppLayout title={`Tracing: ${ruleId}`}>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => router.push(`/rules/${ruleId}`)}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/10">
                                <Activity className="h-5 w-5 text-cyan-500" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold">Rule Tracing</h1>
                                <p className="text-sm text-muted-foreground">
                                    Data flow tracing for rule: {ruleId}
                                </p>
                            </div>
                        </div>
                    </div>
                    <Button variant="outline" size="icon" onClick={fetchTraceIds}>
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                </div>

                {/* Tracing Controls */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Radio className={`h-5 w-5 ${isTracing ? "text-red-500 animate-pulse" : "text-muted-foreground"}`} />
                            Tracing Controls
                        </CardTitle>
                        <CardDescription>
                            Enable data tracing to capture message flow through the rule pipeline
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-end gap-4">
                            <div className="space-y-2">
                                <Label>Strategy</Label>
                                <Select value={strategy} onValueChange={(v) => setStrategy(v as "always" | "head")} disabled={isTracing}>
                                    <SelectTrigger className="w-48">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="always">Always (all messages)</SelectItem>
                                        <SelectItem value="head">Head (with context only)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {isTracing ? (
                                <Button variant="destructive" onClick={handleStopTracing}>
                                    <Square className="mr-2 h-4 w-4" />
                                    Stop Tracing
                                </Button>
                            ) : (
                                <Button onClick={handleStartTracing}>
                                    <Play className="mr-2 h-4 w-4" />
                                    Start Tracing
                                </Button>
                            )}
                        </div>
                        {isTracing && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Zap className="h-4 w-4 text-amber-500 animate-pulse" />
                                Tracing is active. Messages are being captured.
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Trace List */}
                <Card>
                    <CardHeader>
                        <CardTitle>Captured Traces</CardTitle>
                        <CardDescription>
                            {traceIds.length} trace(s) found
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {traceIds.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <Activity className="h-12 w-12 mx-auto mb-4 opacity-30" />
                                <p>No traces captured yet.</p>
                                <p className="text-sm">Start tracing and send some data through the rule.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {traceIds.map((traceId) => (
                                    <Button
                                        key={traceId}
                                        variant={selectedTraceId === traceId ? "default" : "outline"}
                                        className="w-full justify-start font-mono text-sm"
                                        onClick={() => {
                                            setSelectedTraceId(traceId);
                                            fetchTraceDetail(traceId);
                                        }}
                                    >
                                        <Clock className="mr-2 h-4 w-4" />
                                        {traceId}
                                    </Button>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Trace Detail */}
                {selectedTraceId && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Trace Detail</CardTitle>
                            <CardDescription>
                                Span hierarchy for trace: {selectedTraceId.slice(0, 16)}...
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {traceLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : traceDetail ? (
                                <div className="space-y-1">
                                    {renderSpan(traceDetail)}
                                </div>
                            ) : (
                                <p className="text-center py-8 text-muted-foreground">
                                    Failed to load trace details.
                                </p>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>
        </AppLayout>
    );
}
