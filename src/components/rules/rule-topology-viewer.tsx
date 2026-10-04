"use client";

import * as React from "react";
import type { RuleTopology } from "@/lib/ekuiper/types";
import { ekuiperClient } from "@/lib/ekuiper/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Workflow,
  RefreshCw,
  Database,
  Filter,
  ArrowRight,
  Send,
  Code2,
  AlertTriangle,
  Play,
  Square,
  Activity,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface RuleTopologyViewerProps {
  ruleId: string;
  topology: RuleTopology | null;
  status?: Record<string, unknown> | null;
  isRunning: boolean;
  onRefresh?: () => void;
}

interface TopoNode {
  id: string;
  name: string;
  category: "source" | "operator" | "sink";
  level: number;
  order: number;
  recordsIn: number;
  recordsOut: number;
  exceptions: number;
}

interface TopoEdge {
  id: string;
  source: string;
  target: string;
}

function getNodeCategory(name: string, isSource: boolean, isSink: boolean): "source" | "operator" | "sink" {
  if (isSource || name.startsWith("source_") || name.startsWith("src_")) return "source";
  if (isSink || name.startsWith("sink_") || name.startsWith("target_")) return "sink";
  return "operator";
}

function getNodeIcon(category: "source" | "operator" | "sink") {
  switch (category) {
    case "source":
      return <Database className="h-4 w-4 text-emerald-500" />;
    case "operator":
      return <Filter className="h-4 w-4 text-cyan-500" />;
    case "sink":
      return <Send className="h-4 w-4 text-blue-500" />;
  }
}

export function RuleTopologyViewer({
  ruleId,
  topology,
  status,
  isRunning,
  onRefresh,
}: RuleTopologyViewerProps) {
  const [autoPoll, setAutoPoll] = React.useState(true);
  const [liveStatus, setLiveStatus] = React.useState<Record<string, unknown> | null>(status ?? null);
  const [polling, setPolling] = React.useState(false);
  const [viewJson, setViewJson] = React.useState(false);

  React.useEffect(() => {
    setLiveStatus(status ?? null);
  }, [status]);

  // 5-second polling matching original teardown RuleTopo.vue
  React.useEffect(() => {
    if (!autoPoll || !isRunning) return;

    const interval = setInterval(async () => {
      setPolling(true);
      try {
        const nextStatus = await ekuiperClient.getRuleStatus(ruleId);
        setLiveStatus(nextStatus as unknown as Record<string, unknown>);
      } catch {
        // silent catch on background poll
      } finally {
        setPolling(false);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [autoPoll, isRunning, ruleId]);

  // Parse nodes and edges from topology
  const { nodes, edges, levels } = React.useMemo(() => {
    if (!topology) {
      return { nodes: [] as TopoNode[], edges: [] as TopoEdge[], levels: 0 };
    }

    const sources = Array.isArray(topology.sources) ? topology.sources : [];
    const edgeMap = topology.edges || {};

    // Collect all targets
    const allTargets = new Set<string>();
    Object.values(edgeMap).forEach((targetList) => {
      if (Array.isArray(targetList)) {
        targetList.forEach((t) => allTargets.add(t));
      }
    });

    // All distinct node names
    const allNodeNames = new Set<string>([...sources]);
    Object.keys(edgeMap).forEach((s) => allNodeNames.add(s));
    allTargets.forEach((t) => allNodeNames.add(t));

    // Sink candidates: nodes that have incoming edges but no outgoing edges
    const sinks = new Set<string>();
    allNodeNames.forEach((n) => {
      if (!sources.includes(n) && (!edgeMap[n] || edgeMap[n].length === 0)) {
        sinks.add(n);
      }
    });

    // Compute levels (topological breadth-first rank)
    const nodeLevelMap = new Map<string, number>();
    sources.forEach((s) => nodeLevelMap.set(s, 0));

    let queue = [...sources];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      const currLevel = nodeLevelMap.get(curr) ?? 0;
      const targets = edgeMap[curr] || [];
      for (const target of targets) {
        const existing = nodeLevelMap.get(target);
        if (existing === undefined || existing < currLevel + 1) {
          nodeLevelMap.set(target, currLevel + 1);
          queue.push(target);
        }
      }
    }

    // Default any disconnected node to level 0
    allNodeNames.forEach((n) => {
      if (!nodeLevelMap.has(n)) {
        nodeLevelMap.set(n, sinks.has(n) ? 2 : 1);
      }
    });

    const maxLevel = Math.max(0, ...Array.from(nodeLevelMap.values()));

    // Group nodes by level to assign order
    const levelGroups = new Map<number, string[]>();
    for (let l = 0; l <= maxLevel; l++) {
      levelGroups.set(l, []);
    }
    allNodeNames.forEach((n) => {
      const l = nodeLevelMap.get(n) || 0;
      levelGroups.get(l)?.push(n);
    });

    // Extract metrics from liveStatus
    const statusData = liveStatus || {};

    const getMetric = (nodeName: string, suffix: string): number => {
      for (const [k, v] of Object.entries(statusData)) {
        if (k.toLowerCase().includes(nodeName.toLowerCase()) && k.endsWith(suffix)) {
          return typeof v === "number" ? v : Number(v) || 0;
        }
      }
      return 0;
    };

    const parsedNodes: TopoNode[] = [];
    allNodeNames.forEach((name) => {
      const lvl = nodeLevelMap.get(name) || 0;
      const order = levelGroups.get(lvl)?.indexOf(name) || 0;
      const isSrc = sources.includes(name);
      const isSnk = sinks.has(name);

      parsedNodes.push({
        id: name,
        name,
        category: getNodeCategory(name, isSrc, isSnk),
        level: lvl,
        order,
        recordsIn: getMetric(name, "records_in_total"),
        recordsOut: getMetric(name, "records_out_total"),
        exceptions: getMetric(name, "exceptions_total"),
      });
    });

    const parsedEdges: TopoEdge[] = [];
    Object.entries(edgeMap).forEach(([src, targets]) => {
      if (Array.isArray(targets)) {
        targets.forEach((tgt) => {
          parsedEdges.push({
            id: `${src}->${tgt}`,
            source: src,
            target: tgt,
          });
        });
      }
    });

    return { nodes: parsedNodes, edges: parsedEdges, levels: maxLevel + 1 };
  }, [topology, liveStatus]);

  if (!topology || nodes.length === 0) {
    return (
      <Card className="border-border">
        <CardContent className="py-16 text-center text-sm text-muted-foreground flex flex-col items-center gap-3">
          <Workflow className="h-10 w-10 text-muted-foreground/50" />
          <p>No topology data available for rule &quot;{ruleId}&quot;.</p>
        </CardContent>
      </Card>
    );
  }

  // Layout calculations
  const colWidth = 260;
  const rowHeight = 120;
  const paddingX = 40;
  const paddingY = 40;

  const nodePositions = new Map<string, { x: number; y: number }>();
  nodes.forEach((node) => {
    nodePositions.set(node.id, {
      x: paddingX + node.level * colWidth,
      y: paddingY + node.order * rowHeight,
    });
  });

  const svgWidth = Math.max(700, paddingX * 2 + levels * colWidth);
  const maxRows = Math.max(...nodes.map((n) => n.order), 0) + 1;
  const svgHeight = Math.max(340, paddingY * 2 + maxRows * rowHeight);

  return (
    <div className="flex flex-col gap-4">
      {/* Control bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-border bg-card/60 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-mono">
            <span
              className={cn(
                "size-2 rounded-full",
                isRunning ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"
              )}
            />
            <span className="font-semibold text-foreground">
              {isRunning ? "Pipeline Active" : "Pipeline Idle"}
            </span>
          </div>

          <span className="text-border">|</span>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
            <Layers className="size-3.5" />
            <span>{nodes.length} Nodes</span>
            <span>·</span>
            <span>{edges.length} Channels</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              id="auto-poll-switch"
              checked={autoPoll}
              onCheckedChange={setAutoPoll}
              disabled={!isRunning}
            />
            <Label
              htmlFor="auto-poll-switch"
              className="text-xs font-mono cursor-pointer text-muted-foreground"
            >
              5s Live Poll
            </Label>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs font-mono gap-1"
            onClick={() => onRefresh?.()}
          >
            <RefreshCw className={cn("size-3", polling && "animate-spin")} />
            Poll Metrics
          </Button>

          <Button
            variant={viewJson ? "secondary" : "ghost"}
            size="sm"
            className="h-7 text-xs font-mono"
            onClick={() => setViewJson(!viewJson)}
          >
            <Code2 className="size-3.5 mr-1" />
            {viewJson ? "Hide JSON" : "Raw JSON"}
          </Button>
        </div>
      </div>

      {viewJson ? (
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-mono">Topology Wire Object</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[30rem] overflow-auto rounded bg-muted p-4 font-mono text-xs">
              {JSON.stringify({ topology, status: liveStatus }, null, 2)}
            </pre>
          </CardContent>
        </Card>
      ) : (
        /* Visual Topology Canvas */
        <Card className="border-border overflow-hidden bg-background">
          <div className="overflow-x-auto p-4">
            <div
              className="relative min-w-full"
              style={{ width: `${svgWidth}px`, height: `${svgHeight}px` }}
            >
              {/* SVG Edges connecting nodes */}
              <svg
                className="absolute inset-0 pointer-events-none"
                width={svgWidth}
                height={svgHeight}
              >
                <defs>
                  <marker
                    id="topo-arrow"
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="hsl(var(--muted-foreground))" opacity="0.6" />
                  </marker>
                  <marker
                    id="topo-arrow-active"
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="hsl(var(--primary))" opacity="0.9" />
                  </marker>
                </defs>

                {edges.map((edge) => {
                  const srcPos = nodePositions.get(edge.source);
                  const tgtPos = nodePositions.get(edge.target);
                  if (!srcPos || !tgtPos) return null;

                  // Node width ~ 200px, height ~ 84px
                  const startX = srcPos.x + 200;
                  const startY = srcPos.y + 42;
                  const endX = tgtPos.x;
                  const endY = tgtPos.y + 42;

                  const deltaX = endX - startX;
                  const cp1X = startX + deltaX * 0.5;
                  const cp1Y = startY;
                  const cp2X = startX + deltaX * 0.5;
                  const cp2Y = endY;

                  const pathD = `M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`;

                  return (
                    <g key={edge.id}>
                      <path
                        d={pathD}
                        fill="none"
                        stroke="hsl(var(--border))"
                        strokeWidth="2"
                        opacity="0.8"
                      />
                      <path
                        d={pathD}
                        fill="none"
                        stroke={isRunning ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"}
                        strokeWidth="1.5"
                        strokeDasharray={isRunning ? "6, 4" : "none"}
                        className={isRunning ? "animate-[dash_1s_linear_infinite]" : ""}
                        markerEnd={isRunning ? "url(#topo-arrow-active)" : "url(#topo-arrow)"}
                        opacity={isRunning ? "0.9" : "0.5"}
                      />
                    </g>
                  );
                })}
              </svg>

              {/* HTML Nodes positioned on canvas */}
              {nodes.map((node) => {
                const pos = nodePositions.get(node.id) || { x: 0, y: 0 };

                return (
                  <div
                    key={node.id}
                    style={{
                      transform: `translate(${pos.x}px, ${pos.y}px)`,
                      width: "200px",
                    }}
                    className={cn(
                      "absolute top-0 left-0 rounded-lg border bg-card p-3 shadow-beautiful-sm transition-shadow hover:shadow-beautiful-md select-none",
                      node.category === "source" && "border-emerald-500/30 hover:border-emerald-500/60",
                      node.category === "operator" && "border-cyan-500/30 hover:border-cyan-500/60",
                      node.category === "sink" && "border-blue-500/30 hover:border-blue-500/60"
                    )}
                  >
                    {/* Node Header */}
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1 rounded bg-muted/60 shrink-0">
                        {getNodeIcon(node.category)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-mono font-semibold truncate text-foreground" title={node.name}>
                          {node.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono">
                          {node.category}
                        </p>
                      </div>
                    </div>

                    {/* Live Metrics Row */}
                    <div className="grid grid-cols-3 gap-1 pt-1.5 border-t border-border/60 text-center font-mono text-[10px]">
                      <div className="bg-muted/30 rounded py-0.5" title="Total records in">
                        <span className="text-[9px] text-muted-foreground block">IN</span>
                        <span className="text-emerald-500 font-medium font-mono">{node.recordsIn}</span>
                      </div>
                      <div className="bg-muted/30 rounded py-0.5" title="Total records out">
                        <span className="text-[9px] text-muted-foreground block">OUT</span>
                        <span className="text-cyan-500 font-medium font-mono">{node.recordsOut}</span>
                      </div>
                      <div className="bg-muted/30 rounded py-0.5" title="Exceptions / Errors">
                        <span className="text-[9px] text-muted-foreground block">ERR</span>
                        <span className={cn("font-medium font-mono", node.exceptions > 0 ? "text-destructive" : "text-muted-foreground")}>
                          {node.exceptions}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
