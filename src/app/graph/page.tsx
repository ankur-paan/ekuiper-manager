"use client";

import * as React from "react";
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    Node,
    Edge,
    useNodesState,
    useEdgesState,
    MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";

import { useServerStore } from "@/stores/server-store";
import { ekuiperClient } from "@/lib/ekuiper/client";
import { AppLayout } from "@/components/layout";
import { EmptyState, LoadingSpinner } from "@/components/common";
import { toast } from "sonner";
import { Rule } from "@/lib/ekuiper/types";

// Helper to extract sources from SQL
const extractSources = (sql: string): string[] => {
    const sources: string[] = [];
    const fromMatch = sql.match(/FROM\s+([^\s;]+)/i);
    if (fromMatch) sources.push(fromMatch[1]);

    const joinMatches = sql.matchAll(/JOIN\s+([^\s]+)/gi);
    for (const match of joinMatches) {
        sources.push(match[1]);
    }
    return sources; // Simplistic
};

export default function DependencyGraphPage() {
    const { servers, activeServerId } = useServerStore();
    const activeServer = servers.find((s) => s.id === activeServerId);

    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [loading, setLoading] = React.useState(true);

    const buildGraph = React.useCallback(async () => {
        if (!activeServer) return;
        setLoading(true);
        ekuiperClient.setBaseUrl(activeServer.url);

        try {
            const rules = await ekuiperClient.listRules(); // Returns ListItem
            // We need rule details for SQL and Actions. Parallel fetch.
            const fullRules = await Promise.all(
                rules.map(r => ekuiperClient.getRule(r.id).catch(() => null))
            );

            const validRules = fullRules.filter(r => r !== null) as Rule[];

            const newNodes: Node[] = [];
            const newEdges: Edge[] = [];
            const sourceSet = new Set<string>();
            const sinkSet = new Set<string>();

            // Process Rules
            validRules.forEach((rule, index) => {
                // Rule Node
                newNodes.push({
                    id: `rule-${rule.id}`,
                    data: { label: `Rule: ${rule.id}` },
                    position: { x: 400, y: index * 150 },
                    style: { border: '1px solid #777', padding: 10, borderRadius: 5, background: '#eef' },
                    type: 'default'
                });

                // Sources
                const sources = extractSources(rule.sql);
                sources.forEach(src => {
                    if (!sourceSet.has(src)) {
                        sourceSet.add(src);
                        // Position will be assigned later or now
                    }
                    newEdges.push({
                        id: `e-${src}-${rule.id}`,
                        source: `source-${src}`,
                        target: `rule-${rule.id}`,
                        animated: true,
                        markerEnd: { type: MarkerType.ArrowClosed },
                    });
                });

                // Sinks
                if (rule.actions) {
                    rule.actions.forEach((action, i) => {
                        const sinkType = Object.keys(action)[0];
                        const sinkId = `sink-${rule.id}-${sinkType}-${i}`; // Unique per rule usage
                        newNodes.push({
                            id: sinkId,
                            data: { label: `Sink: ${sinkType}` },
                            position: { x: 800, y: index * 150 + (i * 50) },
                            style: { background: '#efe' },
                            type: 'output'
                        });
                        newEdges.push({
                            id: `e-${rule.id}-${sinkId}`,
                            source: `rule-${rule.id}`,
                            target: sinkId,
                            markerEnd: { type: MarkerType.ArrowClosed },
                        });
                    });
                }
            });

            // Create Source Nodes
            Array.from(sourceSet).forEach((src, index) => {
                newNodes.push({
                    id: `source-${src}`,
                    data: { label: `Stream/Table: ${src}` },
                    position: { x: 0, y: index * 100 },
                    type: 'input',
                    style: { background: '#fee' }
                });
            });

            setNodes(newNodes);
            setEdges(newEdges);

        } catch (err) {
            toast.error("Failed to build graph");
        } finally {
            setLoading(false);
        }
    }, [activeServer, setNodes, setEdges]);

    React.useEffect(() => {
        if (activeServer) buildGraph();
    }, [buildGraph, activeServer]);

    if (!activeServer) {
        return <AppLayout title="Dependency Graph"><EmptyState title="No Server" description="Connect to server." /></AppLayout>;
    }

    return (
        <AppLayout title="Dependency Graph">
            <div className="h-[calc(100vh-140px)] border rounded-lg bg-card overflow-hidden relative">
                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center z-10 bg-background/50 backdrop-blur-sm">
                        <LoadingSpinner />
                    </div>
                )}
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    fitView
                >
                    <Background />
                    <Controls />
                    <MiniMap />
                </ReactFlow>
            </div>
        </AppLayout>
    );
}
