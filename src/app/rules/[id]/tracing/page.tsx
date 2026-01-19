"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useServerStore } from "@/stores/server-store";
import { AppLayout } from "@/components/layout";
import { LoadingPage, EmptyState } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
    Info,
} from "lucide-react";
import { toast } from "sonner";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface TraceSpan {
    Name?: string;
    TraceID?: string;
    SpanID?: string;
    ParentSpanID?: string;
    Attribute?: Record<string, string>;
    StartTime?: string | number;
    EndTime?: string | number;
    ChildSpan?: TraceSpan[];
    [key: string]: any;
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

    const getSpanProp = (span: any, keys: string[]): any => {
        if (!span) return undefined;
        for (const k of keys) {
            if (span[k] !== undefined && span[k] !== null) return span[k];
        }
        return undefined;
    };

    const getName = (span: any) => getSpanProp(span, ['Name', 'name', 'label']) || "Unknown";
    const getSpanID = (span: any) => getSpanProp(span, ['SpanID', 'spanID', 'span_id', 'id']) || "unknown-id";
    const getChildren = (span: any) => getSpanProp(span, ['ChildSpan', 'childSpan', 'children', 'child_spans']) || [];
    const getAttributes = (span: any) => getSpanProp(span, ['Attribute', 'attribute', 'attributes', 'tags']);

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
                setTraceIds(Array.isArray(data) ? data.slice(0, 100) : []);
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
        const spanID = getSpanID(span);
        const children = getChildren(span);
        const ids = [spanID];
        if (Array.isArray(children)) {
            children.forEach((child: TraceSpan) => {
                ids.push(...collectSpanIds(child));
            });
        }
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

    const parseTime = (t: any): number => {
        if (!t) return NaN;
        const num = Number(t);
        if (!isNaN(num)) {
            if (num < 1e11) return num * 1000;
            if (num < 1e14) return num;
            return num / 1000000;
        }
        const d = new Date(t);
        return d.getTime();
    };

    const getSpanTime = (span: any, type: 'start' | 'end'): number => {
        const keys = type === 'start'
            ? ['StartTime', 'startTime', 'start_time']
            : ['EndTime', 'endTime', 'end_time'];
        return parseTime(getSpanProp(span, keys));
    };

    const formatTime = (ts: number): string => {
        if (isNaN(ts)) return "N/A";
        return new Date(ts).toISOString().split('T')[1].replace('Z', '');
    };

    const calculateDuration = (span: TraceSpan): string => {
        const s = getSpanTime(span, 'start');
        const e = getSpanTime(span, 'end');

        if (isNaN(s) || isNaN(e)) return "-";

        const durationMs = e - s;
        if (durationMs === 0) return "Instant";
        if (durationMs < 0.1) return "Instant";
        if (durationMs < 1) return "< 1ms";
        if (durationMs < 1000) return `${durationMs.toFixed(2)}ms`;
        return `${(durationMs / 1000).toFixed(2)}s`;
    };

    const getSpanIcon = (name: string) => {
        if (!name) return <Cpu className="h-4 w-4 text-amber-500" />;
        const lowerName = name.toLowerCase();
        if (lowerName.includes("source")) return <Database className="h-4 w-4 text-blue-500" />;
        if (lowerName.includes("sink") || lowerName.includes("log") || lowerName.includes("mqtt")) return <Send className="h-4 w-4 text-green-500" />;
        return <Cpu className="h-4 w-4 text-amber-500" />;
    };

    const formatSpanName = (name: string): string => {
        if (!name || name === "Unknown") return "Unknown Step";
        const parts = name.split('_');
        if (name.startsWith("source_")) {
            return `Source: ${parts.slice(1, -1).join('_')}`;
        }
        if (name.startsWith("sink_")) {
            return `Sink: ${parts.slice(1, -1).join('_')}`;
        }
        if (name.startsWith("op_")) {
            return `Operation: ${parts[1]}`;
        }
        return name;
    }

    const tryDecodeBase64 = (str: string): string | null => {
        try {
            // Check if string looks like base64
            if (!/^[A-Za-z0-9+/]*={0,2}$/.test(str) || str.length % 4 !== 0 || str.length < 4) return null;
            const decoded = atob(str);
            // Check if decoded is printable
            if (/^[\x20-\x7E]*$/.test(decoded)) return decoded;
            return null;
        } catch {
            return null;
        }
    }

    const renderSpan = (span: TraceSpan, depth: number = 0, index: number = 0): React.ReactNode => {
        if (!span) return null;

        const name = getName(span);
        const spanID = getSpanID(span);
        const children = getChildren(span);
        const attributes = getAttributes(span);
        const startTime = getSpanTime(span, 'start');
        const endTime = getSpanTime(span, 'end');
        const duration = calculateDuration(span);
        const formattedName = formatSpanName(name);

        const isExpanded = expandedSpans.has(spanID);
        const hasChildren = Array.isArray(children) && children.length > 0;
        const uniqueKey = `${spanID}-${index}`;

        return (
            <div key={uniqueKey} className={`${depth > 0 ? "ml-6 border-l-2 border-muted pl-4" : ""}`}>
                <div
                    className="flex items-start gap-2 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => hasChildren && toggleSpan(spanID)}
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

                    {getSpanIcon(name)}

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">{formattedName}</span>
                            {formattedName !== name && (
                                <span className="text-xs text-muted-foreground font-mono bg-muted px-1 rounded">
                                    {name}
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Badge variant="outline" className="text-xs font-normal cursor-help gap-1">
                                            <Clock className="h-3 w-3" />
                                            {duration}
                                        </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <div className="text-xs space-y-1">
                                            <p>Start: {formatTime(startTime)}</p>
                                            <p>End: {formatTime(endTime)}</p>
                                        </div>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>

                            {hasChildren && <span className="flex items-center gap-1"><Info className="h-3 w-3" /> {children.length} sub-steps</span>}
                        </div>

                        {attributes && Object.keys(attributes).length > 0 && (
                            <div className="mt-1 bg-muted/40 p-2 rounded text-xs space-y-1">
                                {Object.entries(attributes).map(([key, value]) => {
                                    const strValue = String(value);
                                    const decoded = tryDecodeBase64(strValue);

                                    return (
                                        <div key={key} className="grid grid-cols-[100px_1fr] gap-2">
                                            <span className="font-medium text-muted-foreground">{key}:</span>
                                            <div className="min-w-0">
                                                <code className="break-all block">{strValue}</code>
                                                {decoded && (
                                                    <div className="text-green-600 dark:text-green-400 font-mono mt-0.5 ml-2 border-l-2 border-green-500 pl-2">
                                                        = {decoded}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {isExpanded && hasChildren && (
                    <div className="space-y-1 mt-1">
                        {children.map((child: TraceSpan, idx: number) => renderSpan(child, depth + 1, idx))}
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
            <div className="flex flex-col h-[calc(100vh-100px)] space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between shrink-0">
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
                                    Debugging data flow for: {ruleId}
                                </p>
                            </div>
                        </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={fetchTraceIds}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh List
                    </Button>
                </div>

                {/* Controls */}
                <Card className="shrink-0">
                    <CardContent className="py-4">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="space-y-1">
                                    <Label>Strategy</Label>
                                    <div className="flex items-center gap-2">
                                        <Select value={strategy} onValueChange={(v) => setStrategy(v as "always" | "head")} disabled={isTracing}>
                                            <SelectTrigger className="w-32 h-8">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="always">Always</SelectItem>
                                                <SelectItem value="head">Head</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <span className="text-xs text-muted-foreground">
                                            {strategy === "always" ? "Capture all messages" : "Sample messages"}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                {isTracing && (
                                    <div className="flex items-center gap-2 text-sm text-red-500 animate-pulse">
                                        <Radio className="h-4 w-4" />
                                        Recording...
                                    </div>
                                )}
                                {isTracing ? (
                                    <Button variant="destructive" size="sm" onClick={handleStopTracing}>
                                        <Square className="mr-2 h-4 w-4" />
                                        Stop Recording
                                    </Button>
                                ) : (
                                    <Button size="sm" onClick={handleStartTracing}>
                                        <Play className="mr-2 h-4 w-4" />
                                        Start Recording
                                    </Button>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Split View Content */}
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
                    {/* Left: Trace List (4 cols) */}
                    <Card className="lg:col-span-4 flex flex-col overflow-hidden border-muted">
                        <CardHeader className="py-3 px-4 border-b shrink-0 bg-muted/20">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-medium">Trace History</CardTitle>
                                <Badge variant="secondary" className="text-xs">
                                    {traceIds.length} items
                                </Badge>
                            </div>
                        </CardHeader>
                        <ScrollArea className="flex-1">
                            <div className="p-2 space-y-1">
                                {traceIds.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground text-sm">
                                        <p>No traces found.</p>
                                        <p>Start recording to capture data.</p>
                                    </div>
                                ) : (
                                    traceIds.map((traceId, idx) => (
                                        <Button
                                            key={`${traceId}-${idx}`}
                                            variant={selectedTraceId === traceId ? "secondary" : "ghost"}
                                            className={`w-full justify-start font-mono text-xs h-9 ${selectedTraceId === traceId ? "bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-700 dark:text-cyan-400" : ""}`}
                                            onClick={() => {
                                                setSelectedTraceId(traceId);
                                                fetchTraceDetail(traceId);
                                            }}
                                        >
                                            <Clock className="mr-2 h-3 w-3 opacity-70" />
                                            <span className="truncate">{traceId}</span>
                                        </Button>
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                    </Card>

                    {/* Right: Detail View (8 cols) */}
                    <Card className="lg:col-span-8 flex flex-col overflow-hidden border-muted shadow-sm">
                        <CardHeader className="py-3 px-4 border-b shrink-0 bg-muted/20">
                            <CardTitle className="text-sm font-medium">
                                {selectedTraceId ? "Trace Execution Tree" : "Details"}
                            </CardTitle>
                        </CardHeader>
                        <ScrollArea className="flex-1">
                            <div className="p-4">
                                {traceLoading ? (
                                    <div className="flex items-center justify-center py-12">
                                        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground opacity-50" />
                                    </div>
                                ) : traceDetail ? (
                                    <div className="space-y-1">
                                        {renderSpan(traceDetail)}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground opacity-50">
                                        <Activity className="h-12 w-12 mb-4" />
                                        <p>Select a trace from the list to view details.</p>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </Card>
                </div>
            </div>
        </AppLayout>
    );
}
