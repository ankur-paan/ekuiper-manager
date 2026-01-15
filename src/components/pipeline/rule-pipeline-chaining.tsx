"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ReactFlow, {
  Node,
  Edge,
  Connection,
  addEdge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  Position,
  NodeProps,
} from "reactflow";
import "reactflow/dist/style.css";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  GitBranch,
  Plus,
  Trash2,
  Save,
  Play,
  Square,
  RefreshCw,
  Download,
  Upload,
  Workflow,
  Database,
  ArrowRight,
  Zap,
  Settings,
  Info,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Copy,
  Link2,
  Unlink
} from "lucide-react";
import { EKuiperClient, Rule, RuleListItem, Stream, StreamListItem } from "@/lib/ekuiper";

// =============================================================================
// Types
// =============================================================================

interface PipelineNode {
  id: string;
  type: "source" | "rule" | "sink";
  data: {
    label: string;
    streamName?: string;
    ruleId?: string;
    sql?: string;
    memoryTopic?: string;
    config?: Record<string, any>;
  };
}

interface PipelineEdge {
  id: string;
  source: string;
  target: string;
  memoryTopic: string;
}

interface Pipeline {
  id: string;
  name: string;
  description?: string;
  nodes: PipelineNode[];
  edges: PipelineEdge[];
}

interface RulePipelineProps {
  client: EKuiperClient;
}

// =============================================================================
// Custom Nodes
// =============================================================================

const SourceNode = ({ data, selected }: NodeProps) => (
  <div
    className={cn(
      "px-4 py-3 rounded-lg border-2 bg-background shadow-lg min-w-[180px]",
      selected ? "border-sota-blue ring-2 ring-sota-blue/20" : "border-green-500"
    )}
  >
    <Handle type="source" position={Position.Right} className="w-3 h-3 !bg-green-500" />
    <div className="flex items-center gap-2">
      <Database className="h-5 w-5 text-green-500" />
      <div>
        <p className="font-semibold text-sm">{data.label}</p>
        <p className="text-xs text-muted-foreground">Source Stream</p>
        {data.streamName && (
          <Badge variant="outline" className="mt-1 text-xs">
            {data.streamName}
          </Badge>
        )}
      </div>
    </div>
  </div>
);

const RuleNode = ({ data, selected }: NodeProps) => (
  <div
    className={cn(
      "px-4 py-3 rounded-lg border-2 bg-background shadow-lg min-w-[200px]",
      selected ? "border-sota-blue ring-2 ring-sota-blue/20" : "border-sota-purple"
    )}
  >
    <Handle type="target" position={Position.Left} className="w-3 h-3 !bg-sota-purple" />
    <Handle type="source" position={Position.Right} className="w-3 h-3 !bg-sota-purple" />
    <div className="flex items-center gap-2">
      <Workflow className="h-5 w-5 text-sota-purple" />
      <div>
        <p className="font-semibold text-sm">{data.label}</p>
        <p className="text-xs text-muted-foreground">Processing Rule</p>
        {data.ruleId && (
          <Badge variant="outline" className="mt-1 text-xs">
            {data.ruleId}
          </Badge>
        )}
        {data.memoryTopic && (
          <div className="flex items-center gap-1 mt-1">
            <Link2 className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{data.memoryTopic}</span>
          </div>
        )}
      </div>
    </div>
  </div>
);

const SinkNode = ({ data, selected }: NodeProps) => (
  <div
    className={cn(
      "px-4 py-3 rounded-lg border-2 bg-background shadow-lg min-w-[180px]",
      selected ? "border-sota-blue ring-2 ring-sota-blue/20" : "border-orange-500"
    )}
  >
    <Handle type="target" position={Position.Left} className="w-3 h-3 !bg-orange-500" />
    <div className="flex items-center gap-2">
      <ArrowRight className="h-5 w-5 text-orange-500" />
      <div>
        <p className="font-semibold text-sm">{data.label}</p>
        <p className="text-xs text-muted-foreground">Final Sink</p>
        {data.config?.type && (
          <Badge variant="outline" className="mt-1 text-xs">
            {data.config.type}
          </Badge>
        )}
      </div>
    </div>
  </div>
);

const nodeTypes = {
  source: SourceNode,
  rule: RuleNode,
  sink: SinkNode,
};

// =============================================================================
// Pipeline Builder Component
// =============================================================================

export function RulePipelineChaining({ client }: RulePipelineProps) {
  const queryClient = useQueryClient();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isSaveOpen, setIsSaveOpen] = useState(false);
  const [pipelineName, setPipelineName] = useState("");
  const [pipelineDescription, setPipelineDescription] = useState("");
  const [isDeploying, setIsDeploying] = useState(false);

  // Node configuration state
  const [nodeConfig, setNodeConfig] = useState({
    label: "",
    streamName: "",
    ruleId: "",
    sql: "SELECT * FROM ",
    memoryTopic: "",
    sinkType: "log",
    sinkConfig: {},
  });

  // Queries
  const { data: streams = [] } = useQuery({
    queryKey: ["streams"],
    queryFn: () => client.listStreams(),
  });

  const { data: rules = [] } = useQuery({
    queryKey: ["rules"],
    queryFn: () => client.listRules(),
  });

  // Generate unique memory topic for pipeline chaining
  const generateMemoryTopic = (sourceNode: string, targetNode: string): string => {
    return `pipeline_${sourceNode}_to_${targetNode}`.toLowerCase().replace(/[^a-z0-9_]/g, "_");
  };

  // Handle edge connections
  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;

      const memoryTopic = generateMemoryTopic(connection.source, connection.target);

      const newEdge: Edge = {
        id: `e-${connection.source}-${connection.target}`,
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
        type: "smoothstep",
        animated: true,
        style: { stroke: "#8b5cf6", strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#8b5cf6" },
        label: memoryTopic,
        labelStyle: { fontSize: 10, fill: "#666" },
        data: { memoryTopic },
      };

      setEdges((eds) => addEdge(newEdge, eds));

      // Update the source node to output to memory sink
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === connection.source && node.type === "rule") {
            return {
              ...node,
              data: {
                ...node.data,
                memoryTopic,
              },
            };
          }
          return node;
        })
      );

      toast({
        title: "Nodes Connected",
        description: `Memory topic "${memoryTopic}" created for pipeline`,
      });
    },
    [setEdges, setNodes]
  );

  // Add node to canvas
  const addNode = (type: "source" | "rule" | "sink") => {
    const id = `${type}_${Date.now()}`;
    const position = {
      x: type === "source" ? 50 : type === "rule" ? 300 : 550,
      y: nodes.length * 100 + 50,
    };

    const newNode: Node = {
      id,
      type,
      position,
      data: {
        label: type === "source" ? "Stream Source" : type === "rule" ? "Processing Rule" : "Output Sink",
        streamName: "",
        ruleId: "",
        sql: "",
        memoryTopic: "",
        config: {},
      },
    };

    setNodes((nds) => [...nds, newNode]);
  };

  // Delete selected node
  const deleteSelectedNode = () => {
    if (selectedNode) {
      setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
      setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
      setSelectedNode(null);
    }
  };

  // Open configuration panel for selected node
  const configureNode = () => {
    if (selectedNode) {
      setNodeConfig({
        label: selectedNode.data.label || "",
        streamName: selectedNode.data.streamName || "",
        ruleId: selectedNode.data.ruleId || "",
        sql: selectedNode.data.sql || "SELECT * FROM ",
        memoryTopic: selectedNode.data.memoryTopic || "",
        sinkType: selectedNode.data.config?.type || "log",
        sinkConfig: selectedNode.data.config || {},
      });
      setIsConfigOpen(true);
    }
  };

  // Save node configuration
  const saveNodeConfig = () => {
    if (selectedNode) {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === selectedNode.id) {
            return {
              ...node,
              data: {
                ...node.data,
                label: nodeConfig.label,
                streamName: nodeConfig.streamName,
                ruleId: nodeConfig.ruleId,
                sql: nodeConfig.sql,
                memoryTopic: nodeConfig.memoryTopic,
                config: { type: nodeConfig.sinkType, ...nodeConfig.sinkConfig },
              },
            };
          }
          return node;
        })
      );
      setIsConfigOpen(false);
      toast({
        title: "Configuration Saved",
        description: "Node configuration updated",
      });
    }
  };

  // Generate pipeline deployment
  const deployPipeline = async () => {
    if (!pipelineName) {
      toast({
        title: "Error",
        description: "Please provide a pipeline name",
        variant: "destructive",
      });
      return;
    }

    setIsDeploying(true);

    try {
      const sortedNodes = topologicalSort(nodes, edges);
      const createdRules: string[] = [];
      const createdStreams: string[] = [];

      for (let i = 0; i < sortedNodes.length; i++) {
        const node = sortedNodes[i];
        const incomingEdges = edges.filter((e) => e.target === node.id);
        const outgoingEdges = edges.filter((e) => e.source === node.id);

        if (node.type === "source") {
          // Check if stream exists, if not create it
          const streamName = node.data.streamName;
          if (streamName) {
            const exists = streams.some((s) => s.name === streamName);
            if (!exists) {
              // Create a memory stream for chaining
              const memoryTopic = outgoingEdges[0]?.data?.memoryTopic || `${pipelineName}_${streamName}`;
              await client.createStream(
                `CREATE STREAM ${streamName} () WITH (DATASOURCE="${memoryTopic}", FORMAT="JSON", TYPE="memory")`
              );
              createdStreams.push(streamName);
            }
          }
        } else if (node.type === "rule") {
          // Create rule with memory sink for chaining
          const ruleId = node.data.ruleId || `${pipelineName}_rule_${i}`;
          const incomingTopic = incomingEdges[0]?.data?.memoryTopic;
          const outgoingTopic = outgoingEdges[0]?.data?.memoryTopic;

          // Build SQL - use memory stream if coming from another rule
          let sql = node.data.sql || "SELECT * FROM ";
          if (incomingTopic && node.type === "rule") {
            // Check if we need to create an intermediate memory stream
            const memoryStreamName = `${pipelineName}_mem_${i}`;
            const streamExists = streams.some((s) => s.name === memoryStreamName);
            if (!streamExists) {
              await client.createStream(
                `CREATE STREAM ${memoryStreamName} () WITH (DATASOURCE="${incomingTopic}", FORMAT="JSON", TYPE="memory")`
              );
              createdStreams.push(memoryStreamName);
            }
            if (!sql.includes("FROM")) {
              sql = `SELECT * FROM ${memoryStreamName}`;
            } else {
              sql = sql.replace(/FROM\s+\w+/, `FROM ${memoryStreamName}`);
            }
          }

          // Build actions
          const actions: any[] = [];

          // Add memory sink for chaining if there are downstream nodes
          if (outgoingTopic) {
            actions.push({ memory: { topic: outgoingTopic } });
          }

          // Add final sink if this is a sink node or last rule
          if (node.data.config?.type && node.data.config.type !== "memory") {
            const sinkType = node.data.config.type;
            const sinkConfig = { ...node.data.config };
            delete sinkConfig.type;
            actions.push({ [sinkType]: sinkConfig });
          }

          // Default to log if no actions
          if (actions.length === 0) {
            actions.push({ log: {} });
          }

          const rule: Rule = {
            id: ruleId,
            sql,
            actions,
          };

          await client.createRule(rule);
          createdRules.push(ruleId);
        } else if (node.type === "sink") {
          // Create final rule with sink
          const ruleId = node.data.ruleId || `${pipelineName}_sink_${i}`;
          const incomingTopic = incomingEdges[0]?.data?.memoryTopic;

          if (incomingTopic) {
            // Create memory stream to consume from
            const memoryStreamName = `${pipelineName}_sink_stream_${i}`;
            await client.createStream(
              `CREATE STREAM ${memoryStreamName} () WITH (DATASOURCE="${incomingTopic}", FORMAT="JSON", TYPE="memory")`
            );
            createdStreams.push(memoryStreamName);

            // Create sink rule
            const sinkType = node.data.config?.type || "log";
            const sinkConfig = { ...node.data.config };
            delete sinkConfig.type;

            const rule: Rule = {
              id: ruleId,
              sql: `SELECT * FROM ${memoryStreamName}`,
              actions: [{ [sinkType]: sinkConfig }],
            };

            await client.createRule(rule);
            createdRules.push(ruleId);
          }
        }
      }

      // Start all created rules
      for (const ruleId of createdRules) {
        await client.startRule(ruleId);
      }

      toast({
        title: "Pipeline Deployed",
        description: `Created ${createdRules.length} rules and ${createdStreams.length} streams`,
      });

      setIsSaveOpen(false);
      queryClient.invalidateQueries({ queryKey: ["rules"] });
      queryClient.invalidateQueries({ queryKey: ["streams"] });
    } catch (error: any) {
      toast({
        title: "Deployment Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsDeploying(false);
    }
  };

  // Topological sort for deployment order
  const topologicalSort = (nodes: Node[], edges: Edge[]): Node[] => {
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    nodes.forEach((node) => {
      inDegree.set(node.id, 0);
      adjacency.set(node.id, []);
    });

    edges.forEach((edge) => {
      adjacency.get(edge.source)?.push(edge.target);
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    });

    const queue: string[] = [];
    inDegree.forEach((degree, nodeId) => {
      if (degree === 0) queue.push(nodeId);
    });

    const sorted: Node[] = [];
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      const node = nodes.find((n) => n.id === nodeId);
      if (node) sorted.push(node);

      adjacency.get(nodeId)?.forEach((neighbor) => {
        const newDegree = (inDegree.get(neighbor) || 1) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) queue.push(neighbor);
      });
    }

    return sorted;
  };

  // Export pipeline as JSON
  const exportPipeline = () => {
    const pipeline: Pipeline = {
      id: `pipeline_${Date.now()}`,
      name: pipelineName || "Untitled Pipeline",
      description: pipelineDescription,
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.type as "source" | "rule" | "sink",
        data: n.data,
      })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        memoryTopic: e.data?.memoryTopic || "",
      })),
    };

    const blob = new Blob([JSON.stringify(pipeline, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${pipeline.name.replace(/\s+/g, "_")}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <GitBranch className="h-6 w-6 text-sota-purple" />
            Rule Pipeline Builder
          </h2>
          <p className="text-muted-foreground">
            Chain rules together using memory topics for complex data flows
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportPipeline}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => setIsSaveOpen(true)}>
            <Save className="h-4 w-4 mr-2" />
            Deploy Pipeline
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-muted-foreground">Add Node:</span>
            <Button variant="outline" size="sm" onClick={() => addNode("source")}>
              <Database className="h-4 w-4 mr-2 text-green-500" />
              Source
            </Button>
            <Button variant="outline" size="sm" onClick={() => addNode("rule")}>
              <Workflow className="h-4 w-4 mr-2 text-sota-purple" />
              Rule
            </Button>
            <Button variant="outline" size="sm" onClick={() => addNode("sink")}>
              <ArrowRight className="h-4 w-4 mr-2 text-orange-500" />
              Sink
            </Button>

            <Separator orientation="vertical" className="h-8" />

            <Button
              variant="outline"
              size="sm"
              onClick={configureNode}
              disabled={!selectedNode}
            >
              <Settings className="h-4 w-4 mr-2" />
              Configure
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={deleteSelectedNode}
              disabled={!selectedNode}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Canvas */}
      <Card className="h-[600px]">
        <CardContent className="p-0 h-full">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => setSelectedNode(node)}
            onPaneClick={() => setSelectedNode(null)}
            nodeTypes={nodeTypes}
            fitView
            snapToGrid
            snapGrid={[15, 15]}
          >
            <Background gap={15} size={1} />
            <Controls />
            <MiniMap
              nodeColor={(node) => {
                switch (node.type) {
                  case "source":
                    return "#22c55e";
                  case "rule":
                    return "#8b5cf6";
                  case "sink":
                    return "#f97316";
                  default:
                    return "#94a3b8";
                }
              }}
            />
          </ReactFlow>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <Info className="h-5 w-5 text-sota-blue mt-0.5" />
            <div className="space-y-2 text-sm text-muted-foreground">
              <p><strong>How it works:</strong></p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Add <Badge variant="outline" className="text-green-500">Source</Badge> nodes for input streams</li>
                <li>Add <Badge variant="outline" className="text-sota-purple">Rule</Badge> nodes for SQL processing</li>
                <li>Add <Badge variant="outline" className="text-orange-500">Sink</Badge> nodes for output destinations</li>
                <li>Connect nodes by dragging from one handle to another</li>
                <li>Memory topics are auto-generated for each connection</li>
                <li>Click <strong>Deploy Pipeline</strong> to create all rules and streams</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Node Configuration Dialog */}
      <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configure Node
            </DialogTitle>
            <DialogDescription>
              Set up the node properties for your pipeline
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Label</Label>
              <Input
                value={nodeConfig.label}
                onChange={(e) => setNodeConfig({ ...nodeConfig, label: e.target.value })}
              />
            </div>

            {selectedNode?.type === "source" && (
              <div className="space-y-2">
                <Label>Stream Name</Label>
                <Select
                  value={nodeConfig.streamName}
                  onValueChange={(v) => setNodeConfig({ ...nodeConfig, streamName: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select or create stream" />
                  </SelectTrigger>
                  <SelectContent>
                    {streams.map((stream) => (
                      <SelectItem key={stream.name} value={stream.name}>
                        {stream.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedNode?.type === "rule" && (
              <>
                <div className="space-y-2">
                  <Label>Rule ID</Label>
                  <Input
                    value={nodeConfig.ruleId}
                    onChange={(e) => setNodeConfig({ ...nodeConfig, ruleId: e.target.value })}
                    placeholder="my_rule"
                  />
                </div>
                <div className="space-y-2">
                  <Label>SQL Query</Label>
                  <Textarea
                    value={nodeConfig.sql}
                    onChange={(e) => setNodeConfig({ ...nodeConfig, sql: e.target.value })}
                    rows={4}
                    className="font-mono text-sm"
                    placeholder="SELECT * FROM stream WHERE condition"
                  />
                </div>
              </>
            )}

            {selectedNode?.type === "sink" && (
              <div className="space-y-2">
                <Label>Sink Type</Label>
                <Select
                  value={nodeConfig.sinkType}
                  onValueChange={(v) => setNodeConfig({ ...nodeConfig, sinkType: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="log">Log</SelectItem>
                    <SelectItem value="mqtt">MQTT</SelectItem>
                    <SelectItem value="rest">REST API</SelectItem>
                    <SelectItem value="memory">Memory</SelectItem>
                    <SelectItem value="influx">InfluxDB</SelectItem>
                    <SelectItem value="redis">Redis</SelectItem>
                    <SelectItem value="file">File</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfigOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveNodeConfig}>
              Save Configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deploy Pipeline Dialog */}
      <Dialog open={isSaveOpen} onOpenChange={setIsSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="h-5 w-5" />
              Deploy Pipeline
            </DialogTitle>
            <DialogDescription>
              This will create all streams, rules, and connections
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Pipeline Name</Label>
              <Input
                value={pipelineName}
                onChange={(e) => setPipelineName(e.target.value)}
                placeholder="my_data_pipeline"
              />
            </div>

            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                value={pipelineDescription}
                onChange={(e) => setPipelineDescription(e.target.value)}
                placeholder="Describe your pipeline..."
                rows={3}
              />
            </div>

            <div className="bg-muted p-4 rounded-lg space-y-2">
              <p className="text-sm font-medium">Pipeline Summary:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-green-500" />
                  {nodes.filter((n) => n.type === "source").length} Source nodes
                </li>
                <li className="flex items-center gap-2">
                  <Workflow className="h-4 w-4 text-sota-purple" />
                  {nodes.filter((n) => n.type === "rule").length} Rule nodes
                </li>
                <li className="flex items-center gap-2">
                  <ArrowRight className="h-4 w-4 text-orange-500" />
                  {nodes.filter((n) => n.type === "sink").length} Sink nodes
                </li>
                <li className="flex items-center gap-2">
                  <Link2 className="h-4 w-4" />
                  {edges.length} Memory connections
                </li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSaveOpen(false)}>
              Cancel
            </Button>
            <Button onClick={deployPipeline} disabled={isDeploying || !pipelineName}>
              {isDeploying ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Deploying...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Deploy
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default RulePipelineChaining;
