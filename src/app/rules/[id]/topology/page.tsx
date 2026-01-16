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
    Workflow,
    RefreshCw,
    Database,
    Cpu,
    Send,
    ArrowRight,
    ZoomIn,
    ZoomOut,
    Maximize2,
} from "lucide-react";

interface RuleTopology {
    sources: string[];
    edges: Record<string, string[]>;
}

interface NodePosition {
    id: string;
    x: number;
    y: number;
    type: "source" | "operator" | "sink";
    label: string;
}

interface Edge {
    from: string;
    to: string;
}

export default function RuleTopologyPage() {
    const params = useParams();
    const router = useRouter();
    const ruleId = params.id as string;
    const { servers, activeServerId } = useServerStore();
    const activeServer = servers.find((s) => s.id === activeServerId);

    const [topology, setTopology] = React.useState<RuleTopology | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [zoom, setZoom] = React.useState(1);

    const fetchTopology = React.useCallback(async () => {
        if (!activeServer || !ruleId) return;

        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/ekuiper/rules/${encodeURIComponent(ruleId)}/topo`, {
                headers: {
                    "X-EKuiper-URL": activeServer.url,
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch topology: ${response.status}`);
            }

            const data = await response.json();
            setTopology(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to fetch topology");
        } finally {
            setLoading(false);
        }
    }, [activeServer, ruleId]);

    React.useEffect(() => {
        fetchTopology();
    }, [fetchTopology]);

    // Build graph from topology
    const buildGraph = React.useCallback((): { nodes: NodePosition[]; edges: Edge[] } => {
        if (!topology) return { nodes: [], edges: [] };

        const nodes: NodePosition[] = [];
        const edges: Edge[] = [];
        const allNodes = new Set<string>();
        const sinkNodes = new Set<string>();

        // Collect all nodes
        topology.sources.forEach((source) => allNodes.add(source));
        Object.keys(topology.edges).forEach((from) => {
            allNodes.add(from);
            topology.edges[from].forEach((to) => {
                allNodes.add(to);
                edges.push({ from, to });
            });
        });

        // Find sink nodes (nodes that are not in any "from" position but are in "to")
        Object.values(topology.edges).flat().forEach((to) => {
            if (!topology.edges[to]) {
                sinkNodes.add(to);
            }
        });

        // Categorize nodes
        const sourceSet = new Set(topology.sources);
        const categorized = Array.from(allNodes).map((id) => {
            let type: "source" | "operator" | "sink" = "operator";
            if (sourceSet.has(id)) type = "source";
            else if (sinkNodes.has(id)) type = "sink";
            return { id, type };
        });

        // Layer-based layout
        const layers: string[][] = [];
        const visited = new Set<string>();

        // BFS to determine layers
        let currentLayer = [...topology.sources];
        while (currentLayer.length > 0) {
            layers.push(currentLayer);
            currentLayer.forEach((n) => visited.add(n));
            const nextLayer: string[] = [];
            currentLayer.forEach((node) => {
                (topology.edges[node] || []).forEach((next) => {
                    if (!visited.has(next) && !nextLayer.includes(next)) {
                        nextLayer.push(next);
                    }
                });
            });
            currentLayer = nextLayer;
        }

        // Position nodes
        const nodeWidth = 180;
        const nodeHeight = 80;
        const layerGap = 200;
        const nodeGap = 100;

        layers.forEach((layer, layerIndex) => {
            const layerWidth = layer.length * nodeWidth + (layer.length - 1) * nodeGap;
            const startX = (800 - layerWidth) / 2;

            layer.forEach((nodeId, nodeIndex) => {
                const cat = categorized.find((c) => c.id === nodeId);
                nodes.push({
                    id: nodeId,
                    x: startX + nodeIndex * (nodeWidth + nodeGap),
                    y: 50 + layerIndex * layerGap,
                    type: cat?.type || "operator",
                    label: nodeId,
                });
            });
        });

        return { nodes, edges };
    }, [topology]);

    const { nodes, edges } = buildGraph();

    // SVG canvas refs
    const canvasWidth = 800;
    const canvasHeight = Math.max(500, (nodes.length / 3) * 200 + 100);

    if (loading) {
        return (
            <AppLayout title={`Rule Topology: ${ruleId}`}>
                <LoadingPage label="Loading topology..." />
            </AppLayout>
        );
    }

    if (error || !topology) {
        return (
            <AppLayout title={`Rule Topology: ${ruleId}`}>
                <ErrorState
                    title="Error Loading Topology"
                    description={error || "Topology not found"}
                    onRetry={fetchTopology}
                />
            </AppLayout>
        );
    }

    return (
        <AppLayout title={`Rule Topology: ${ruleId}`}>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => router.push(`/rules/${ruleId}`)}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10">
                                <Workflow className="h-5 w-5 text-indigo-500" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold">Rule Topology</h1>
                                <p className="text-sm text-muted-foreground">
                                    Visual flow for rule: {ruleId}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}>
                            <ZoomOut className="h-4 w-4" />
                        </Button>
                        <span className="text-sm text-muted-foreground w-12 text-center">{Math.round(zoom * 100)}%</span>
                        <Button variant="outline" size="icon" onClick={() => setZoom((z) => Math.min(2, z + 0.1))}>
                            <ZoomIn className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" onClick={() => setZoom(1)}>
                            <Maximize2 className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" onClick={fetchTopology}>
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Legend */}
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-blue-500" />
                        <span className="text-sm">Source</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-amber-500" />
                        <span className="text-sm">Operator</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-green-500" />
                        <span className="text-sm">Sink</span>
                    </div>
                </div>

                {/* Topology Diagram */}
                <Card>
                    <CardHeader>
                        <CardTitle>Data Flow Topology</CardTitle>
                        <CardDescription>
                            {topology.sources.length} source(s) → {Object.keys(topology.edges).length} operator(s) → sinks
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-auto border rounded-lg bg-muted/30" style={{ maxHeight: "600px" }}>
                            <svg
                                width={canvasWidth * zoom}
                                height={canvasHeight * zoom}
                                viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
                                className="min-w-full"
                            >
                                {/* Define arrow marker */}
                                <defs>
                                    <marker
                                        id="arrowhead"
                                        markerWidth="10"
                                        markerHeight="7"
                                        refX="9"
                                        refY="3.5"
                                        orient="auto"
                                    >
                                        <polygon points="0 0, 10 3.5, 0 7" fill="hsl(var(--muted-foreground))" />
                                    </marker>
                                </defs>

                                {/* Draw edges */}
                                {edges.map((edge, i) => {
                                    const fromNode = nodes.find((n) => n.id === edge.from);
                                    const toNode = nodes.find((n) => n.id === edge.to);
                                    if (!fromNode || !toNode) return null;

                                    const x1 = fromNode.x + 90;
                                    const y1 = fromNode.y + 40;
                                    const x2 = toNode.x + 90;
                                    const y2 = toNode.y;

                                    return (
                                        <line
                                            key={`edge-${i}`}
                                            x1={x1}
                                            y1={y1}
                                            x2={x2}
                                            y2={y2 - 5}
                                            stroke="hsl(var(--muted-foreground))"
                                            strokeWidth="2"
                                            markerEnd="url(#arrowhead)"
                                            opacity={0.6}
                                        />
                                    );
                                })}

                                {/* Draw nodes */}
                                {nodes.map((node) => {
                                    const colors = {
                                        source: { bg: "#3b82f6", text: "white" },
                                        operator: { bg: "#f59e0b", text: "white" },
                                        sink: { bg: "#22c55e", text: "white" },
                                    };
                                    const color = colors[node.type];

                                    return (
                                        <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                                            <rect
                                                width="180"
                                                height="40"
                                                rx="8"
                                                fill={color.bg}
                                                className="drop-shadow-md"
                                            />
                                            <text
                                                x="90"
                                                y="25"
                                                textAnchor="middle"
                                                fill={color.text}
                                                fontSize="12"
                                                fontWeight="500"
                                            >
                                                {node.label.length > 20 ? node.label.slice(0, 17) + "..." : node.label}
                                            </text>
                                        </g>
                                    );
                                })}
                            </svg>
                        </div>
                    </CardContent>
                </Card>

                {/* Raw Topology Data */}
                <Card>
                    <CardHeader>
                        <CardTitle>Topology JSON</CardTitle>
                        <CardDescription>Raw topology data from eKuiper</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <pre className="rounded-lg bg-muted p-4 text-sm overflow-x-auto max-h-48">
                            <code>{JSON.stringify(topology, null, 2)}</code>
                        </pre>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
