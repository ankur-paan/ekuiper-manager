"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useServerStore } from "@/stores/server-store";
import { AppLayout } from "@/components/layout";
import { LoadingPage, ErrorState } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    ArrowLeft,
    FileCode,
    RefreshCw,
    Copy,
    ArrowDown,
    Database,
    Filter,
    Layers,
    Send,
    ChevronDown,
    ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

interface ExplainNode {
    type: string;
    info: string;
    children?: ExplainNode[];
}

export default function RuleExplainPage() {
    const params = useParams();
    const router = useRouter();
    const ruleId = params.id as string;
    const { servers, activeServerId } = useServerStore();
    const activeServer = servers.find((s) => s.id === activeServerId);

    const [explainData, setExplainData] = React.useState<string | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    const fetchExplain = React.useCallback(async () => {
        if (!activeServer || !ruleId) return;

        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/ekuiper/rules/${encodeURIComponent(ruleId)}/explain`, {
                headers: {
                    "X-EKuiper-URL": activeServer.url,
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch explain: ${response.status}`);
            }

            const data = await response.text();
            setExplainData(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to fetch query plan");
        } finally {
            setLoading(false);
        }
    }, [activeServer, ruleId]);

    React.useEffect(() => {
        fetchExplain();
    }, [fetchExplain]);

    const copyToClipboard = () => {
        if (explainData) {
            navigator.clipboard.writeText(explainData);
            toast.success("Copied to clipboard");
        }
    };

    // Parse the explain output into visual tree nodes
    const parseExplainTree = (text: string): ExplainNode[] => {
        // Simple parsing - eKuiper explain format varies, this handles basic format
        const lines = text.split("\n").filter((l) => l.trim());
        const nodes: ExplainNode[] = [];

        lines.forEach((line) => {
            const trimmed = line.trim();
            if (trimmed.startsWith("DataSourcePlan") || trimmed.includes("source")) {
                nodes.push({ type: "source", info: trimmed });
            } else if (
                trimmed.startsWith("ProjectPlan") ||
                trimmed.startsWith("FilterPlan") ||
                trimmed.includes("operator") ||
                trimmed.includes("Op")
            ) {
                nodes.push({ type: "operator", info: trimmed });
            } else if (trimmed.includes("Sink") || trimmed.includes("sink")) {
                nodes.push({ type: "sink", info: trimmed });
            } else if (trimmed) {
                nodes.push({ type: "info", info: trimmed });
            }
        });

        return nodes;
    };

    const getNodeIcon = (type: string) => {
        switch (type) {
            case "source":
                return <Database className="h-4 w-4 text-blue-500" />;
            case "operator":
                return <Filter className="h-4 w-4 text-amber-500" />;
            case "sink":
                return <Send className="h-4 w-4 text-green-500" />;
            default:
                return <Layers className="h-4 w-4 text-gray-500" />;
        }
    };

    const getNodeColor = (type: string) => {
        switch (type) {
            case "source":
                return "border-blue-500/50 bg-blue-500/5";
            case "operator":
                return "border-amber-500/50 bg-amber-500/5";
            case "sink":
                return "border-green-500/50 bg-green-500/5";
            default:
                return "border-gray-500/50 bg-gray-500/5";
        }
    };

    if (loading) {
        return (
            <AppLayout title={`Query Plan: ${ruleId}`}>
                <LoadingPage label="Loading query plan..." />
            </AppLayout>
        );
    }

    if (error) {
        return (
            <AppLayout title={`Query Plan: ${ruleId}`}>
                <ErrorState
                    title="Error Loading Query Plan"
                    description={error}
                    onRetry={fetchExplain}
                />
            </AppLayout>
        );
    }

    const nodes = explainData ? parseExplainTree(explainData) : [];

    return (
        <AppLayout title={`Query Plan: ${ruleId}`}>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => router.push(`/rules/${ruleId}`)}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
                                <FileCode className="h-5 w-5 text-violet-500" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold">Query Plan</h1>
                                <p className="text-sm text-muted-foreground">
                                    Execution plan for rule: {ruleId}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={copyToClipboard}>
                            <Copy className="mr-2 h-4 w-4" />
                            Copy
                        </Button>
                        <Button variant="outline" size="icon" onClick={fetchExplain}>
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Visual Execution Tree */}
                <Card>
                    <CardHeader>
                        <CardTitle>Execution Plan</CardTitle>
                        <CardDescription>
                            Visual representation of the query execution flow
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {nodes.length === 0 ? (
                                <p className="text-muted-foreground text-center py-8">
                                    No execution plan nodes found. The rule may not have a complex query.
                                </p>
                            ) : (
                                <div className="space-y-1">
                                    {nodes.map((node, index) => (
                                        <div key={index}>
                                            <div
                                                className={`flex items-start gap-3 p-3 rounded-lg border ${getNodeColor(node.type)}`}
                                            >
                                                <div className="mt-0.5">{getNodeIcon(node.type)}</div>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <Badge
                                                            variant="outline"
                                                            className={
                                                                node.type === "source"
                                                                    ? "border-blue-500 text-blue-500"
                                                                    : node.type === "operator"
                                                                        ? "border-amber-500 text-amber-500"
                                                                        : node.type === "sink"
                                                                            ? "border-green-500 text-green-500"
                                                                            : ""
                                                            }
                                                        >
                                                            {node.type.toUpperCase()}
                                                        </Badge>
                                                    </div>
                                                    <pre className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                                                        {node.info}
                                                    </pre>
                                                </div>
                                            </div>
                                            {index < nodes.length - 1 && (
                                                <div className="flex justify-center py-1">
                                                    <ArrowDown className="h-4 w-4 text-muted-foreground" />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Performance Hints */}
                <Card>
                    <CardHeader>
                        <CardTitle>Performance Hints</CardTitle>
                        <CardDescription>Suggestions for optimizing this rule</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-2 text-sm">
                            <li className="flex items-start gap-2">
                                <ChevronRight className="h-4 w-4 mt-0.5 text-blue-500" />
                                <span>
                                    <strong>Source Optimization:</strong> Make sure source connectors have appropriate buffer sizes.
                                </span>
                            </li>
                            <li className="flex items-start gap-2">
                                <ChevronRight className="h-4 w-4 mt-0.5 text-amber-500" />
                                <span>
                                    <strong>Filter Early:</strong> Place WHERE clauses before heavy transformations to reduce data volume.
                                </span>
                            </li>
                            <li className="flex items-start gap-2">
                                <ChevronRight className="h-4 w-4 mt-0.5 text-green-500" />
                                <span>
                                    <strong>Sink Batching:</strong> Consider using sendSingle=false for batch sinks to improve throughput.
                                </span>
                            </li>
                        </ul>
                    </CardContent>
                </Card>

                {/* Raw Output */}
                <Card>
                    <CardHeader>
                        <CardTitle>Raw Explain Output</CardTitle>
                        <CardDescription>Direct output from eKuiper explain API</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <pre className="rounded-lg bg-muted p-4 text-sm overflow-x-auto whitespace-pre-wrap max-h-64">
                            {explainData || "No explain data available"}
                        </pre>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
