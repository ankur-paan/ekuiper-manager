"use client";

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import ReactFlow, {
    Node,
    Edge,
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    MarkerType,
    NodeTypes,
    Handle,
    Position
} from 'reactflow';
import 'reactflow/dist/style.css';

import { useParams, useRouter } from "next/navigation";
import { useServerStore } from "@/stores/server-store";
import { ekuiperClient } from "@/lib/ekuiper/client";
import { AppLayout } from "@/components/layout";
import { LoadingPage, ErrorState } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Workflow, RefreshCw, Activity, Wifi, Server, Database, Box, Layers, Filter, FileCode, Clock, GitMerge, Calculator, ArrowDownUp, FunctionSquare, Globe, Sparkles, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// ... existing code ...



// --- Custom Node Component for OT View ---
const OTNode = ({ data }: { data: any }) => {
    let Icon = Box;
    const lowerLabel = data.label.toLowerCase();
    let opDescription = "Generic Processing";

    // Auto-detect meaningful icons and descriptions
    if (data.type === 'source') {
        Icon = Wifi;
        opDescription = "Data Ingestion";
    } else if (data.type === 'sink') {
        Icon = Server;
        opDescription = "Data Destination";
    } else {
        // Operator Logic Parsing
        if (lowerLabel.includes('filter') || lowerLabel.includes('where')) {
            Icon = Filter;
            opDescription = "Filter (Conditions)";
        } else if (lowerLabel.includes('project') || lowerLabel.includes('select')) {
            Icon = FileCode;
            opDescription = "Transform (Format)";
        } else if (lowerLabel.includes('window')) {
            Icon = Clock;
            opDescription = "Time Window";
        } else if (lowerLabel.includes('join') || lowerLabel.includes('lookup')) {
            Icon = GitMerge;
            opDescription = "Merge / Join";
        } else if (lowerLabel.includes('agg') || lowerLabel.includes('group')) {
            Icon = Calculator;
            opDescription = "Aggregation (Math)";
        } else if (lowerLabel.includes('order')) {
            Icon = ArrowDownUp;
            opDescription = "Sorting";
        } else if (lowerLabel.includes('func')) {
            Icon = FunctionSquare;
            opDescription = "Function Call";
        }
    }

    if (lowerLabel.includes('mqtt')) { Icon = Wifi; if (data.type === 'source') opDescription = "MQTT Broker"; }
    else if (lowerLabel.includes('http') || lowerLabel.includes('rest')) { Icon = Globe; if (data.type === 'source') opDescription = "HTTP Stream"; }
    else if (lowerLabel.includes('db') || lowerLabel.includes('sql')) { Icon = Database; if (data.type === 'sink') opDescription = "SQL Database"; }
    else if (lowerLabel.includes('file') || lowerLabel.includes('log')) { Icon = Layers; if (data.type === 'sink') opDescription = "File System"; }

    // Status Color
    const isOnline = true; // Rules are generally "running" if valid

    return (
        <TooltipProvider>
            <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                    <div className={cn("rounded-xl border-[3px] shadow-sm min-w-[220px] bg-white transition-all hover:shadow-md cursor-help group",
                        data.type === 'source' ? "border-blue-100" :
                            data.type === 'sink' ? "border-green-100" : "border-amber-100",
                        data.summary ? "ring-2 ring-purple-100 border-purple-200" : ""
                    )}>
                        {/* Header */}
                        <div className={cn("flex items-center gap-3 p-3 border-b bg-gradient-to-r",
                            data.summary ? "from-purple-50 to-transparent border-purple-100" :
                                data.type === 'source' ? "from-blue-50 to-transparent border-blue-50" :
                                    data.type === 'sink' ? "from-green-50 to-transparent border-green-50" : "from-amber-50 to-transparent border-amber-50"
                        )}>
                            <div className={cn("p-2.5 rounded-lg shadow-sm ring-1 ring-inset relative",
                                data.type === 'source' ? "bg-white text-blue-600 ring-blue-100" :
                                    data.type === 'sink' ? "bg-white text-green-600 ring-green-100" : "bg-white text-amber-600 ring-amber-100"
                            )}>
                                <Icon size={18} strokeWidth={2} />
                                {data.summary && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-purple-500 rounded-full border-2 border-white" />}
                            </div>
                            <div className="flex flex-col text-left">
                                <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">{opDescription}</span>
                                <span className="font-bold text-sm text-foreground/80 break-all">{data.label}</span>
                            </div>
                        </div>

                        {/* Body / Metrics */}
                        <div className="p-4 space-y-3 bg-white rounded-b-xl">
                            {data.summary ? (
                                <div className="text-xs text-purple-700 bg-purple-50 p-2 rounded border border-purple-100 italic">
                                    "{data.summary}"
                                </div>
                            ) : (
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-muted-foreground font-medium">Status</span>
                                    <span className="flex items-center gap-1.5 text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                        </span>
                                        Active
                                    </span>
                                </div>
                            )}

                            {typeof data.count === 'number' && (
                                <div className="flex justify-between items-center text-xs pt-1 border-t border-dashed">
                                    <span className="text-muted-foreground font-medium">Messages</span>
                                    <span className="font-mono font-bold text-foreground bg-slate-100 px-1.5 py-0.5 rounded">{data.count.toLocaleString()}</span>
                                </div>
                            )}
                        </div>

                        <Handle type="target" position={Position.Top} className="!bg-slate-400 !w-3 !h-3 !border-2 !border-white" />
                        <Handle type="source" position={Position.Bottom} className="!bg-slate-400 !w-3 !h-3 !border-2 !border-white" />
                    </div>
                </TooltipTrigger>
                {data.summary && (
                    <TooltipContent side="right" className="max-w-xs bg-slate-900 border-slate-800 text-slate-100 p-3 shadow-xl">
                        <div className="flex items-start gap-2">
                            <Bot className="w-4 h-4 text-purple-400 mt-1 shrink-0" />
                            <div>
                                <p className="font-bold text-xs text-purple-300 mb-1">AI Automated Analysis</p>
                                <p className="text-sm leading-relaxed">{data.summary}</p>
                            </div>
                        </div>
                    </TooltipContent>
                )}
            </Tooltip>
        </TooltipProvider>
    );
};

interface RuleTopology {
    sources: string[];
    edges: Record<string, string[]>;
}

export default function RuleTopologyPage() {
    const params = useParams();
    const router = useRouter();
    const ruleId = params.id as string;
    const { servers, activeServerId } = useServerStore();
    const activeServer = servers.find((s) => s.id === activeServerId);

    const [topology, setTopology] = useState<RuleTopology | null>(null);
    const [metrics, setMetrics] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // AI State
    const [aiSummary, setAiSummary] = useState<Record<string, string>>({});
    const [analyzing, setAnalyzing] = useState(false);
    const [aiModels, setAiModels] = useState<{ id: string, name: string }[]>([]);
    const [selectedModel, setSelectedModel] = useState<string>("");

    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    const nodeTypes = useMemo(() => ({ custom: OTNode }), []);

    const fetchAiModels = useCallback(async () => {
        try {
            const res = await fetch('/api/ai/models');
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) {
                    setAiModels(data);
                    // Default to first usually flash or pro
                    const def = data.find((m: any) => m.id.includes('1.5-flash')) || data.find((m: any) => m.id.includes('flash')) || data[0];
                    if (def) setSelectedModel(def.id);
                }
            }
        } catch (e) { console.error("Failed to list models", e); }
    }, []);

    const fetchTopology = useCallback(async () => {
        if (!activeServer || !ruleId) return;

        setLoading(true);
        setError(null);
        ekuiperClient.setBaseUrl(activeServer.url);

        try {
            // 1. Fetch Topology
            const topoData = await ekuiperClient.getRuleTopology(ruleId);

            // 2. Fetch Metrics (Status)
            let metricsData = {};
            try {
                metricsData = await ekuiperClient.getRuleStatus(ruleId);
            } catch (e) { console.warn("Metrics fetch failed", e); }

            setTopology(topoData as any); // Type cast if necessary as Topology type might differ slightly from raw response
            setMetrics(metricsData);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to fetch topology");
        } finally {
            setLoading(false);
        }
    }, [activeServer, ruleId]);

    const analyzeWithAI = async () => {
        if (!activeServer || !ruleId) return;
        setAnalyzing(true);
        try {
            const res = await fetch('/api/ai/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ruleId,
                    ekuiperUrl: activeServer.url,
                    modelName: selectedModel
                })
            });
            if (!res.ok) {
                let errorMsg = "Analysis request failed";
                try {
                    const errData = await res.json();
                    errorMsg = errData.error || errorMsg;
                } catch (e) { /* ignore json parse error */ }
                throw new Error(errorMsg);
            }
            const data = await res.json();
            setAiSummary(data);
            toast.success("AI Analysis Complete: Rules Decoded");
        } catch (e: any) {
            toast.error(`AI Error: ${e.message}`);
            console.error(e);
        } finally {
            setAnalyzing(false);
        }
    };

    useEffect(() => {
        fetchTopology();
        fetchAiModels();
    }, [fetchTopology, fetchAiModels]);

    // Inject AI Summary into nodes when available
    useEffect(() => {
        if (Object.keys(aiSummary).length > 0) {
            setNodes((nds) => nds.map((n) => ({
                ...n,
                data: { ...n.data, summary: aiSummary[n.id] }
            })));
        }
    }, [aiSummary, setNodes]);

    // Build graph
    useEffect(() => {
        if (!topology) return;

        const allNodes = new Set<string>();
        const sinkNodes = new Set<string>();
        const localEdges: { from: string; to: string }[] = [];

        // Collect nodes
        topology.sources.forEach((source) => allNodes.add(source));
        Object.keys(topology.edges).forEach((from) => {
            allNodes.add(from);
            topology.edges[from].forEach((to) => {
                allNodes.add(to);
                localEdges.push({ from, to });
            });
        });

        // Find sinks
        Object.values(topology.edges).flat().forEach((to) => {
            if (!topology.edges[to]) sinkNodes.add(to);
        });

        // Categorize & Metrics Matching
        const sourceSet = new Set(topology.sources);
        const categorized = Array.from(allNodes).map((id) => {
            let type: "source" | "operator" | "sink" = "operator";
            if (sourceSet.has(id)) type = "source";
            else if (sinkNodes.has(id)) type = "sink";

            // Find metric count
            let count: number | undefined = undefined;
            if (type === 'source') {
                // Try source_<id>_records_in_total or _out_total
                const inKey = Object.keys(metrics).find(k => k.includes(`source_${id}`) && k.endsWith('records_in_total'));
                if (inKey) count = metrics[inKey];
            } else if (type === 'sink') {
                // Try sink_<id>_records_in_total
                const inKey = Object.keys(metrics).find(k => k.includes(`sink_${id}`) && k.endsWith('records_in_total'));
                if (inKey) count = metrics[inKey];
            } else {
                // Operator
                const matchKey = Object.keys(metrics).find(k => k.includes(`op_${id}`) && k.endsWith('records_out_total'));
                if (matchKey) count = metrics[matchKey];
            }

            return { id, type, count };
        });

        // Layout (Same Layer Logic)
        const layers: string[][] = [];
        const visited = new Set<string>();
        let currentLayer = [...topology.sources];
        let safety = 0;

        while (currentLayer.length > 0 && safety < 100) {
            layers.push(currentLayer);
            currentLayer.forEach((n) => visited.add(n));
            const nextLayer: string[] = [];
            currentLayer.forEach((node) => {
                (topology.edges[node] || []).forEach((next) => {
                    if (!visited.has(next) && !nextLayer.includes(next)) nextLayer.push(next);
                });
            });
            currentLayer = nextLayer;
            safety++;
        }

        const unvisited = Array.from(allNodes).filter(n => !visited.has(n));
        if (unvisited.length > 0) layers.push(unvisited);

        // ReactFlow Nodes
        const rfNodes: Node[] = [];
        const nodeWidth = 220; // Wilder for OT card
        const layerGap = 200;
        const nodeGap = 50;

        layers.forEach((layer, layerIndex) => {
            const totalWidth = layer.length * nodeWidth + (layer.length - 1) * nodeGap;
            const startX = -(totalWidth / 2);

            layer.forEach((nodeId, nodeIndex) => {
                const cat = categorized.find(c => c.id === nodeId);
                const x = startX + nodeIndex * (nodeWidth + nodeGap);
                const y = layerIndex * layerGap + 50;

                rfNodes.push({
                    id: nodeId,
                    position: { x, y },
                    // Note: We check if aiSummary already has data for this id (re-render conservation)
                    data: { label: nodeId, type: cat?.type, count: cat?.count, summary: aiSummary[nodeId] },
                    type: 'custom',
                });
            });
        });

        const rfEdges: Edge[] = localEdges.map((e, i) => ({
            id: `e-${e.from}-${e.to}`,
            source: e.from,
            target: e.to,
            type: 'smoothstep',
            animated: true,
            style: { stroke: '#94a3b8', strokeWidth: 3 }, // Thicker lines
            markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
        }));

        setNodes(rfNodes);
        setEdges(rfEdges);

    }, [topology, metrics, aiSummary, setNodes, setEdges]); // Depend on aiSummary to re-build nodes with summary

    if (loading) return <AppLayout title="Topology"><LoadingPage label="Analyzing process flow..." /></AppLayout>;
    if (error || !topology) {
        return (
            <AppLayout title="Topology">
                <ErrorState title="Process Visualization Failed" description={error || "Topology unavailable"} onRetry={fetchTopology} />
            </AppLayout>
        );
    }

    return (
        <AppLayout title={`Process Map: ${ruleId}`}>
            <div className="space-y-6 h-[calc(100vh-140px)] flex flex-col">
                <div className="flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => router.push(`/rules/${ruleId}`)}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">Process Flow</h1>
                            <p className="text-sm text-muted-foreground">Operational View • {ruleId}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {aiModels.length > 0 && (
                            <Select value={selectedModel} onValueChange={setSelectedModel}>
                                <SelectTrigger className="w-[180px] h-8 text-xs bg-white">
                                    <SelectValue placeholder="Select Model" />
                                </SelectTrigger>
                                <SelectContent>
                                    {aiModels.map(m => (
                                        <SelectItem key={m.id} value={m.id} className="text-xs">
                                            {m.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                        <Button
                            variant="default"
                            size="sm"
                            onClick={analyzeWithAI}
                            disabled={analyzing || Object.keys(aiSummary).length > 0}
                            className={cn("bg-purple-600 hover:bg-purple-700 text-white", analyzing ? "opacity-80" : "")}
                        >
                            <Sparkles className={cn("mr-2 h-4 w-4", analyzing ? "animate-spin" : "")} />
                            {analyzing ? "Analyzing Logic..." : Object.keys(aiSummary).length > 0 ? "AI Analysis Active" : "Analyze with AI"}
                        </Button>
                        <Button variant="outline" size="sm" onClick={fetchTopology} className="gap-2">
                            <RefreshCw className="h-4 w-4" /> Refresh
                        </Button>
                    </div>
                </div>

                <Card className="flex-1 overflow-hidden flex flex-col border-none shadow-none bg-transparent">
                    <CardContent className="flex-1 p-0 relative min-h-[400px] border rounded-2xl bg-slate-50 overflow-hidden shadow-inner">
                        <ReactFlow
                            nodes={nodes}
                            edges={edges}
                            onNodesChange={onNodesChange}
                            onEdgesChange={onEdgesChange}
                            nodeTypes={nodeTypes}
                            fitView
                            attributionPosition="bottom-right"
                            minZoom={0.5}
                        >
                            <Background color="#cbd5e1" gap={24} size={2} />
                            <Controls className="bg-white border-none shadow-md rounded-lg p-1" />
                            <MiniMap
                                style={{ height: 100, borderRadius: 8, background: 'rgba(255,255,255,0.8)' }}
                                zoomable pannable
                                nodeColor={n => {
                                    if (n.data.type === 'source') return '#3b82f6';
                                    if (n.data.type === 'sink') return '#22c55e';
                                    return '#f59e0b';
                                }}
                            />
                        </ReactFlow>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
