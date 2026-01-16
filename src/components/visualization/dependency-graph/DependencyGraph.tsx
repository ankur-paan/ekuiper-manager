"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  Panel,
  NodeTypes,
  EdgeTypes,
  ConnectionMode,
} from "reactflow";
import "reactflow/dist/style.css";
import { toPng } from "html-to-image";
import { GlassCard } from "@/components/ui/glass-card";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Network,
  RefreshCw,
  Download,
  ZoomIn,
  ZoomOut,
  Maximize,
  Filter,
  Search,
  Settings,
  Layout,
  Layers,
} from "lucide-react";
import { StreamNode } from "./nodes/StreamNode";
import { RuleNode } from "./nodes/RuleNode";
import { TableNode } from "./nodes/TableNode";
import { PluginNode } from "./nodes/PluginNode";
import { SinkNode } from "./nodes/SinkNode";
import { DependencyAnalyzer, type ResourceInfo, type DependencyInfo } from "./DependencyAnalyzer";

// Custom node types
const nodeTypes: NodeTypes = {
  stream: StreamNode,
  rule: RuleNode,
  table: TableNode,
  plugin: PluginNode,
  sink: SinkNode,
};

export interface DependencyGraphProps {
  connectionId: string;
  onNodeClick?: (nodeType: string, nodeName: string) => void;
}

export function DependencyGraph({
  connectionId,
  onNodeClick,
}: DependencyGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [layoutType, setLayoutType] = useState<"dagre" | "tree" | "radial">("dagre");
  const [showLabels, setShowLabels] = useState(true);
  const [showMinimap, setShowMinimap] = useState(true);
  const [highlightedNode, setHighlightedNode] = useState<string | null>(null);
  const [resourceStats, setResourceStats] = useState({
    streams: 0,
    rules: 0,
    tables: 0,
    plugins: 0,
    sinks: 0,
  });

  // Fetch and analyze dependencies
  const loadDependencies = useCallback(async () => {
    setLoading(true);
    try {
      // In production, fetch from API
      // const analyzer = new DependencyAnalyzer(connectionId);
      // const { nodes, edges, stats } = await analyzer.analyze();

      // Demo data for visualization
      const demoData = generateDemoData();
      setNodes(demoData.nodes);
      setEdges(demoData.edges);
      setResourceStats(demoData.stats);
    } catch (error) {
      console.error("Failed to load dependencies:", error);
    } finally {
      setLoading(false);
    }
  }, [connectionId]);

  useEffect(() => {
    loadDependencies();
  }, [loadDependencies]);

  // Generate demo data
  const generateDemoData = () => {
    const streams: Node[] = [
      {
        id: "stream-demo",
        type: "stream",
        position: { x: 100, y: 100 },
        data: { name: "demo", status: "active", schema: ["temperature", "humidity", "timestamp"] },
      },
      {
        id: "stream-sensor",
        type: "stream",
        position: { x: 100, y: 250 },
        data: { name: "sensor", status: "active", schema: ["device_id", "value", "type"] },
      },
      {
        id: "stream-events",
        type: "stream",
        position: { x: 100, y: 400 },
        data: { name: "events", status: "inactive", schema: ["event_type", "payload", "ts"] },
      },
    ];

    const tables: Node[] = [
      {
        id: "table-devices",
        type: "table",
        position: { x: 100, y: 550 },
        data: { name: "devices", type: "lookup", keys: ["device_id"] },
      },
    ];

    const rules: Node[] = [
      {
        id: "rule-temp-alert",
        type: "rule",
        position: { x: 400, y: 100 },
        data: {
          name: "temp-alert",
          status: "running",
          sql: "SELECT * FROM demo WHERE temperature > 30",
          metrics: { throughput: 150, latency: 5 },
        },
      },
      {
        id: "rule-aggregator",
        type: "rule",
        position: { x: 400, y: 250 },
        data: {
          name: "aggregator",
          status: "running",
          sql: "SELECT AVG(value) FROM sensor GROUP BY device_id",
          metrics: { throughput: 80, latency: 12 },
        },
      },
      {
        id: "rule-enricher",
        type: "rule",
        position: { x: 400, y: 400 },
        data: {
          name: "enricher",
          status: "stopped",
          sql: "SELECT * FROM events LEFT JOIN devices ON events.device_id = devices.device_id",
          metrics: { throughput: 0, latency: 0 },
        },
      },
    ];

    const sinks: Node[] = [
      {
        id: "sink-mqtt",
        type: "sink",
        position: { x: 700, y: 100 },
        data: { name: "mqtt-out", sinkType: "mqtt", config: { topic: "alerts" } },
      },
      {
        id: "sink-influx",
        type: "sink",
        position: { x: 700, y: 250 },
        data: { name: "influx-out", sinkType: "influx", config: { database: "metrics" } },
      },
      {
        id: "sink-log",
        type: "sink",
        position: { x: 700, y: 400 },
        data: { name: "log-out", sinkType: "log", config: {} },
      },
    ];

    const plugins: Node[] = [
      {
        id: "plugin-json",
        type: "plugin",
        position: { x: 400, y: 550 },
        data: { name: "json", pluginType: "function", status: "loaded" },
      },
    ];

    const nodeList = [...streams, ...tables, ...rules, ...sinks, ...plugins];

    const edgeList: Edge[] = [
      // Stream to Rule
      {
        id: "e-demo-temp",
        source: "stream-demo",
        target: "rule-temp-alert",
        type: "smoothstep",
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: "#3b82f6" },
        label: "reads",
      },
      {
        id: "e-sensor-agg",
        source: "stream-sensor",
        target: "rule-aggregator",
        type: "smoothstep",
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: "#3b82f6" },
        label: "reads",
      },
      {
        id: "e-events-enrich",
        source: "stream-events",
        target: "rule-enricher",
        type: "smoothstep",
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: "#3b82f6" },
        label: "reads",
      },
      // Table to Rule
      {
        id: "e-devices-enrich",
        source: "table-devices",
        target: "rule-enricher",
        type: "smoothstep",
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: "#10b981", strokeDasharray: "5,5" },
        label: "joins",
      },
      // Rule to Sink
      {
        id: "e-temp-mqtt",
        source: "rule-temp-alert",
        target: "sink-mqtt",
        type: "smoothstep",
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: "#f59e0b" },
        label: "writes",
      },
      {
        id: "e-agg-influx",
        source: "rule-aggregator",
        target: "sink-influx",
        type: "smoothstep",
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: "#f59e0b" },
        label: "writes",
      },
      {
        id: "e-enrich-log",
        source: "rule-enricher",
        target: "sink-log",
        type: "smoothstep",
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: "#f59e0b" },
        label: "writes",
      },
      // Plugin usage
      {
        id: "e-json-enrich",
        source: "plugin-json",
        target: "rule-enricher",
        type: "smoothstep",
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: "#8b5cf6", strokeDasharray: "3,3" },
        label: "uses",
      },
    ];

    return {
      nodes: nodeList,
      edges: edgeList,
      stats: {
        streams: streams.length,
        rules: rules.length,
        tables: tables.length,
        plugins: plugins.length,
        sinks: sinks.length,
      },
    };
  };

  // Filter nodes by search
  const filteredNodes = useMemo(() => {
    if (!searchTerm) return nodes;
    return nodes.filter((node) =>
      node.data.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [nodes, searchTerm]);

  // Handle node click
  const handleNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      setHighlightedNode(node.id);
      onNodeClick?.(node.type || "unknown", node.data.name);
    },
    [onNodeClick]
  );

  // Export as image
  const exportImage = useCallback(() => {
    const selector = ".react-flow__viewport";
    const element = document.querySelector(selector) as HTMLElement;

    if (!element) return;

    toPng(element, {
      backgroundColor: "#1f2937", // dark background matching app theme
      style: {
        transform: "scale(2)", // high res
        transformOrigin: "top left",
        width: element.offsetWidth + "px",
        height: element.offsetHeight + "px",
      }
    })
      .then((dataUrl) => {
        const link = document.createElement("a");
        link.download = "ekuiper-topology.png";
        link.href = dataUrl;
        link.click();
      })
      .catch((err) => {
        console.error("Failed to export graph", err);
      });
  }, []);

  // Node color for minimap
  const nodeColor = (node: Node) => {
    switch (node.type) {
      case "stream":
        return "#3b82f6";
      case "rule":
        return "#10b981";
      case "table":
        return "#f59e0b";
      case "plugin":
        return "#8b5cf6";
      case "sink":
        return "#ef4444";
      default:
        return "#6b7280";
    }
  };

  return (
    <GlassCard className="h-full flex flex-col border-0 bg-background/50 backdrop-blur-sm" hoverEffect={false}>
      <CardHeader className="pb-3 border-b border-border/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Network className="h-5 w-5 text-sota-blue" />
              Dependency Graph
            </CardTitle>
            <div className="flex gap-2">
              <Badge variant="outline" className="bg-blue-500/10">
                {resourceStats.streams} Streams
              </Badge>
              <Badge variant="outline" className="bg-green-500/10">
                {resourceStats.rules} Rules
              </Badge>
              <Badge variant="outline" className="bg-amber-500/10">
                {resourceStats.tables} Tables
              </Badge>
              <Badge variant="outline" className="bg-violet-500/10">
                {resourceStats.plugins} Plugins
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search nodes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-48"
              />
            </div>
            <Button variant="outline" size="icon" onClick={loadDependencies}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button variant="outline" size="icon" onClick={() => setShowSettings(!showSettings)}>
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={exportImage}>
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Settings panel */}
        {showSettings && (
          <div className="mt-4 p-4 border rounded-lg bg-muted/30 grid grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Layout</Label>
              <Select value={layoutType} onValueChange={(v) => setLayoutType(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dagre">Dagre (Hierarchical)</SelectItem>
                  <SelectItem value="tree">Tree</SelectItem>
                  <SelectItem value="radial">Radial</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2 pt-6">
              <Switch
                id="labels"
                checked={showLabels}
                onCheckedChange={setShowLabels}
              />
              <Label htmlFor="labels">Show Labels</Label>
            </div>

            <div className="flex items-center space-x-2 pt-6">
              <Switch
                id="minimap"
                checked={showMinimap}
                onCheckedChange={setShowMinimap}
              />
              <Label htmlFor="minimap">Show Minimap</Label>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 min-h-0">
        <div className="h-full border rounded-lg overflow-hidden bg-background">
          <ReactFlow
            nodes={searchTerm ? filteredNodes : nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={handleNodeClick}
            nodeTypes={nodeTypes}
            connectionMode={ConnectionMode.Loose}
            fitView
            attributionPosition="bottom-left"
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#374151" gap={16} />
            <Controls />
            {showMinimap && (
              <MiniMap
                nodeColor={nodeColor}
                nodeStrokeWidth={3}
                zoomable
                pannable
              />
            )}

            {/* Legend */}
            <Panel position="bottom-right" className="bg-background/90 p-3 rounded-lg border">
              <div className="text-xs space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-blue-500" />
                  <span>Stream</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-green-500" />
                  <span>Rule</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-amber-500" />
                  <span>Table</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-violet-500" />
                  <span>Plugin</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-red-500" />
                  <span>Sink</span>
                </div>
              </div>
            </Panel>
          </ReactFlow>
        </div>
      </CardContent>
    </GlassCard >
  );
}
