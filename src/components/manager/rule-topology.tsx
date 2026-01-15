"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  RefreshCw,
  Database,
  GitBranch,
  Workflow,
  ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EKuiperManagerClient } from "@/lib/ekuiper/manager-client";
import type { Rule, RuleStatus, RuleTopology } from "@/lib/ekuiper";

interface RuleTopologyViewerProps {
  client: EKuiperManagerClient;
  ruleId: string;
}

// Helper to extract metrics for a node from status object
function getNodeMetrics(status: Record<string, any> | undefined, nodeId: string): { 
  recordsIn: number; 
  recordsOut: number; 
  latency: number; 
  exceptions: number;
} {
  if (!status) return { recordsIn: 0, recordsOut: 0, latency: 0, exceptions: 0 };
  
  // eKuiper status keys follow pattern: {nodeId}_records_in_total, {nodeId}_records_out_total, etc.
  // The nodeId may have underscores replaced, so we look for keys starting with nodeId
  let recordsIn = 0;
  let recordsOut = 0;
  let latency = 0;
  let exceptions = 0;
  
  for (const [key, value] of Object.entries(status)) {
    if (typeof value !== 'number') continue;
    
    // Match keys that start with the node id (case-insensitive, handling underscores)
    const normalizedKey = key.toLowerCase();
    const normalizedNodeId = nodeId.toLowerCase().replace(/-/g, '_');
    
    if (normalizedKey.startsWith(normalizedNodeId) || normalizedKey.includes(`_${normalizedNodeId}_`)) {
      if (key.includes('records_in_total')) recordsIn = value;
      if (key.includes('records_out_total')) recordsOut = value;
      if (key.includes('process_latency_us') || key.includes('process_latency_ms')) latency = value;
      if (key.includes('exceptions_total')) exceptions = value;
    }
  }
  
  return { recordsIn, recordsOut, latency, exceptions };
}

// Custom node types
function SourceNodeComponent({ data }: { data: any }) {
  return (
    <div className="px-4 py-2 rounded-lg border-2 border-green-500 bg-green-500/10 text-center min-w-[120px]">
      <div className="flex items-center justify-center gap-2 text-sm font-medium text-green-500">
        <Database className="h-4 w-4" />
        {data.label}
      </div>
      {data.metrics && (
        <div className="text-xs text-muted-foreground mt-1">
          {data.metrics.recordsIn} in / {data.metrics.recordsOut} out
        </div>
      )}
    </div>
  );
}

function OperatorNodeComponent({ data }: { data: any }) {
  return (
    <div className="px-4 py-2 rounded-lg border-2 border-blue-500 bg-blue-500/10 text-center min-w-[120px]">
      <div className="flex items-center justify-center gap-2 text-sm font-medium text-blue-500">
        <GitBranch className="h-4 w-4" />
        {data.label}
      </div>
      {data.metrics && (
        <div className="text-xs text-muted-foreground mt-1">
          {data.metrics.recordsIn} in / {data.metrics.latency}μs
        </div>
      )}
    </div>
  );
}

function SinkNodeComponent({ data }: { data: any }) {
  return (
    <div className="px-4 py-2 rounded-lg border-2 border-purple-500 bg-purple-500/10 text-center min-w-[120px]">
      <div className="flex items-center justify-center gap-2 text-sm font-medium text-purple-500">
        <ExternalLink className="h-4 w-4" />
        {data.label}
      </div>
      {data.metrics && (
        <div className="text-xs text-muted-foreground mt-1">
          {data.metrics.recordsOut} out
        </div>
      )}
    </div>
  );
}

const nodeTypes = {
  source: SourceNodeComponent,
  operator: OperatorNodeComponent,
  sink: SinkNodeComponent,
};

export function RuleTopologyViewer({ client, ruleId }: RuleTopologyViewerProps) {
  // Fetch rule topology
  const { data: topology, isLoading, refetch } = useQuery({
    queryKey: ["rule-topology", ruleId],
    queryFn: () => client.getRuleTopology(ruleId),
    refetchInterval: 5000,
  });

  // Fetch rule status (metrics)
  const { data: status } = useQuery({
    queryKey: ["rule-status", ruleId],
    queryFn: () => client.getRuleStatus(ruleId),
    refetchInterval: 5000,
  });

  // Convert topology to React Flow nodes and edges
  const { nodes, edges } = useMemo(() => {
    if (!topology) {
      return { nodes: [], edges: [] };
    }

    const topoNodes: Node[] = [];
    const topoEdges: Edge[] = [];

    // eKuiper topology format:
    // sources: string[] - array of source node names
    // edges: Record<string, string[]> - map of node -> connected nodes
    
    const sourceNames = topology.sources || [];
    const edgesMap = topology.edges || {};
    
    // Collect all unique nodes from edges
    const allNodes = new Set<string>();
    sourceNames.forEach(s => allNodes.add(s));
    
    for (const [from, toList] of Object.entries(edgesMap)) {
      allNodes.add(from);
      if (Array.isArray(toList)) {
        toList.forEach(to => allNodes.add(to));
      }
    }
    
    // Determine node type based on naming convention
    // Sources: start with "source_"
    // Sinks: start with "sink_"
    // Operators: start with "op_"
    const getNodeType = (name: string): "source" | "operator" | "sink" => {
      if (name.startsWith("source_")) return "source";
      if (name.startsWith("sink_")) return "sink";
      // Check if it's a sink by checking if it appears only as a target and contains sink-like names
      const lowerName = name.toLowerCase();
      if (lowerName.includes('log') || lowerName.includes('mqtt') || lowerName.includes('rest') || 
          lowerName.includes('kafka') || lowerName.includes('file') || lowerName.includes('memory') ||
          lowerName.includes('influx') || lowerName.includes('redis') || lowerName.includes('sql')) {
        // Check if it's in edges as a source - if not, it's likely a sink
        if (!edgesMap[name]) return "sink";
      }
      return "operator";
    };
    
    // Create human-friendly label from internal node name
    const getDisplayLabel = (name: string): string => {
      // Mapping of common SQL/eKuiper operator names to friendly names
      const operatorLabels: Record<string, string> = {
        'decoder': 'Decode',
        'decode': 'Decode',
        'window': 'Time Window',
        'tumblingwindow': 'Tumbling Window',
        'slidingwindow': 'Sliding Window',
        'sessionwindow': 'Session Window',
        'countwindow': 'Count Window',
        'having': 'Filter (HAVING)',
        'filter': 'Filter',
        'where': 'Filter (WHERE)',
        'project': 'Select Fields',
        'select': 'Select Fields',
        'join': 'Join',
        'aggregate': 'Aggregate',
        'agg': 'Aggregate',
        'groupby': 'Group By',
        'orderby': 'Order By',
        'order': 'Order By',
        'transform': 'Transform',
        'encode': 'Encode',
        'compress': 'Compress',
        'decompress': 'Decompress',
        'pick': 'Pick Fields',
        'unnest': 'Unnest',
        'watermark': 'Watermark',
        'switchnode': 'Switch',
        'switch': 'Switch',
      };
      
      // Mapping for sink types
      const sinkLabels: Record<string, string> = {
        'log': 'Log Output',
        'mqtt': 'MQTT Output',
        'rest': 'REST API',
        'kafka': 'Kafka Output',
        'file': 'File Output',
        'memory': 'Memory Output',
        'influx': 'InfluxDB',
        'redis': 'Redis Output',
        'sql': 'Database',
        'nop': 'No-Op',
        'out': 'Output',
      };
      
      // First, clean the name
      let cleanName = name
        .replace(/^source_/i, '')
        .replace(/^op_/i, '')
        .replace(/^sink_/i, '')
        .replace(/_\d+(_\d+)*$/g, '')  // Remove trailing _0, _0_0, _0_1 etc
        .replace(/^\d+_/g, '');         // Remove leading numbers like "2_", "3_"
      
      // Check if it matches a known operator
      const lowerClean = cleanName.toLowerCase();
      
      // Check for sink labels first
      for (const [key, label] of Object.entries(sinkLabels)) {
        if (lowerClean.includes(key)) {
          return label;
        }
      }
      
      // Check for operator labels
      for (const [key, label] of Object.entries(operatorLabels)) {
        if (lowerClean === key || lowerClean.includes(key)) {
          return label;
        }
      }
      
      // If it's a stream/source name (typically more readable), format nicely
      // Replace underscores with spaces and capitalize each word
      const formatted = cleanName
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase())
        .trim();
      
      return formatted || name;
    };
    
    // Calculate node levels (topological sort) for better layout
    const nodeLevels = new Map<string, number>();
    const calculateLevels = () => {
      // Sources are level 0
      sourceNames.forEach(s => nodeLevels.set(s, 0));
      
      // BFS to assign levels
      let changed = true;
      let maxIterations = allNodes.size;
      while (changed && maxIterations > 0) {
        changed = false;
        maxIterations--;
        
        for (const [from, toList] of Object.entries(edgesMap)) {
          const fromLevel = nodeLevels.get(from) ?? 0;
          if (Array.isArray(toList)) {
            toList.forEach(to => {
              const currentLevel = nodeLevels.get(to);
              if (currentLevel === undefined || currentLevel <= fromLevel) {
                nodeLevels.set(to, fromLevel + 1);
                changed = true;
              }
            });
          }
        }
      }
    };
    calculateLevels();
    
    // Group nodes by level
    const levelGroups = new Map<number, string[]>();
    allNodes.forEach(node => {
      const level = nodeLevels.get(node) ?? 0;
      if (!levelGroups.has(level)) {
        levelGroups.set(level, []);
      }
      levelGroups.get(level)!.push(node);
    });
    
    // Create nodes with proper positioning
    const nodeSpacingX = 200;
    const nodeSpacingY = 100;
    const startX = 50;
    const startY = 50;
    
    levelGroups.forEach((nodesInLevel, level) => {
      nodesInLevel.forEach((nodeName, index) => {
        const nodeType = getNodeType(nodeName);
        // Get human-friendly display label
        const displayLabel = getDisplayLabel(nodeName);
        
        const metrics = getNodeMetrics(status as Record<string, any>, nodeName);
        
        topoNodes.push({
          id: nodeName,
          type: nodeType,
          position: { 
            x: startX + index * nodeSpacingX, 
            y: startY + level * nodeSpacingY 
          },
          data: { 
            label: displayLabel, 
            metrics 
          },
        });
      });
    });
    
    // Create edges from the edges map
    for (const [from, toList] of Object.entries(edgesMap)) {
      if (Array.isArray(toList)) {
        toList.forEach((to, i) => {
          const fromType = getNodeType(from);
          const toType = getNodeType(to);
          
          // Color based on target type
          let strokeColor = "#3b82f6"; // blue for operators
          if (toType === "sink") strokeColor = "#9333ea"; // purple for sinks
          if (fromType === "source") strokeColor = "#22c55e"; // green from sources
          
          topoEdges.push({
            id: `edge-${from}-${to}-${i}`,
            source: from,
            target: to,
            markerEnd: { type: MarkerType.ArrowClosed },
            style: { stroke: strokeColor },
            animated: true,
          });
        });
      }
    }
    
    // If no topology data, create a placeholder
    if (topoNodes.length === 0) {
      topoNodes.push(
        { id: "no-data", type: "operator", position: { x: 200, y: 100 }, data: { label: "No topology data" } }
      );
    }

    return { nodes: topoNodes, edges: topoEdges };
  }, [topology, status]);

  // Calculate aggregate metrics from status
  const aggregateMetrics = useMemo(() => {
    if (!status || typeof status !== 'object') {
      return { recordsIn: 0, recordsOut: 0, latency: 0, exceptions: 0 };
    }
    
    let totalRecordsIn = 0;
    let totalRecordsOut = 0;
    let totalLatency = 0;
    let totalExceptions = 0;
    let latencyCount = 0;
    
    for (const [key, value] of Object.entries(status)) {
      if (typeof value !== 'number') continue;
      
      if (key.includes('records_in_total') && key.startsWith('source_')) {
        totalRecordsIn += value;
      }
      if (key.includes('records_out_total') && key.startsWith('sink_')) {
        totalRecordsOut += value;
      }
      if (key.includes('process_latency_us')) {
        totalLatency += value;
        latencyCount++;
      }
      if (key.includes('exceptions_total')) {
        totalExceptions += value;
      }
    }
    
    return { 
      recordsIn: totalRecordsIn, 
      recordsOut: totalRecordsOut, 
      latency: latencyCount > 0 ? Math.round(totalLatency / latencyCount) : 0,
      exceptions: totalExceptions 
    };
  }, [status]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h3 className="font-medium flex items-center gap-2">
            <Workflow className="h-4 w-4" />
            Rule Topology: {ruleId}
          </h3>
          <Badge variant={status?.status === "running" ? "success" : "secondary"}>
            {status?.status || "unknown"}
          </Badge>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Refresh
        </Button>
      </div>

      {/* Topology Graph */}
      <div className="flex-1 min-h-[300px]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          attributionPosition="bottom-left"
          defaultEdgeOptions={{ animated: true }}
        >
          <Controls />
          <MiniMap 
            nodeColor={(node) => {
              if (node.type === "source") return "#22c55e";
              if (node.type === "sink") return "#9333ea";
              return "#3b82f6";
            }}
          />
          <Background color="#333" gap={20} />
        </ReactFlow>
      </div>

      {/* Metrics */}
      <div className="p-4 border-t">
        <div className="grid grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Records In</p>
            <p className="font-mono text-lg">{aggregateMetrics.recordsIn}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Records Out</p>
            <p className="font-mono text-lg">{aggregateMetrics.recordsOut}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Avg Latency</p>
            <p className="font-mono text-lg">{aggregateMetrics.latency}μs</p>
          </div>
          <div>
            <p className="text-muted-foreground">Exceptions</p>
            <p className="font-mono text-lg text-red-500">{aggregateMetrics.exceptions}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
