"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Workflow,
  Plus,
  Edit,
  Trash2,
  MoreHorizontal,
  RefreshCw,
  ExternalLink,
  Activity,
  Clock,
  Layers,
  Network,
  CheckCircle,
  XCircle,
  ChevronRight,
  Zap,
} from "lucide-react";

export interface OTelExporterConfig {
  id: string;
  name: string;
  type: "otlp" | "jaeger" | "zipkin";
  enabled: boolean;
  endpoint: string;
  protocol: "grpc" | "http/protobuf" | "http/json";
  headers: Record<string, string>;
  compression: "none" | "gzip";
  timeout: number; // milliseconds
  retryEnabled: boolean;
  maxRetries: number;
  serviceName: string;
  serviceVersion: string;
  environment: string;
  samplingRate: number; // 0-100%
  createdAt: string;
  updatedAt: string;
}

export interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  serviceName: string;
  status: "ok" | "error" | "unset";
  startTime: number;
  duration: number; // ms
  attributes: Record<string, string | number | boolean>;
  events: { name: string; timestamp: number; attributes?: Record<string, string> }[];
}

// Demo exporter configs
const DEMO_EXPORTERS: OTelExporterConfig[] = [
  {
    id: "otel-1",
    name: "Production Collector",
    type: "otlp",
    enabled: true,
    endpoint: "http://otel-collector:4317",
    protocol: "grpc",
    headers: { "x-api-key": "***hidden***" },
    compression: "gzip",
    timeout: 30000,
    retryEnabled: true,
    maxRetries: 3,
    serviceName: "ekuiper-playground",
    serviceVersion: "1.0.0",
    environment: "production",
    samplingRate: 100,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "otel-2",
    name: "Jaeger Development",
    type: "jaeger",
    enabled: true,
    endpoint: "http://localhost:14268/api/traces",
    protocol: "http/protobuf",
    headers: {},
    compression: "none",
    timeout: 10000,
    retryEnabled: false,
    maxRetries: 0,
    serviceName: "ekuiper-dev",
    serviceVersion: "1.0.0-dev",
    environment: "development",
    samplingRate: 50,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Generate demo traces
function generateDemoTraces(): TraceSpan[] {
  const traces: TraceSpan[] = [];
  const operations = [
    "rule.execute",
    "source.mqtt.consume",
    "sink.kafka.produce",
    "transform.filter",
    "transform.aggregate",
    "lookup.sqlite",
  ];
  const now = Date.now();

  for (let i = 0; i < 10; i++) {
    const traceId = `trace-${Math.random().toString(36).substr(2, 16)}`;
    const baseTime = now - Math.random() * 3600000;
    
    // Root span
    traces.push({
      traceId,
      spanId: `span-${Math.random().toString(36).substr(2, 8)}`,
      operationName: "rule.execute",
      serviceName: "ekuiper-playground",
      status: Math.random() > 0.1 ? "ok" : "error",
      startTime: baseTime,
      duration: 50 + Math.random() * 200,
      attributes: {
        "rule.id": `rule_${i + 1}`,
        "rule.name": `DataProcessingRule${i + 1}`,
        "messages.count": Math.floor(Math.random() * 100),
      },
      events: [
        { name: "rule_started", timestamp: baseTime },
        { name: "processing_complete", timestamp: baseTime + 45 },
      ],
    });

    // Child spans
    for (let j = 0; j < 2 + Math.floor(Math.random() * 3); j++) {
      traces.push({
        traceId,
        spanId: `span-${Math.random().toString(36).substr(2, 8)}`,
        parentSpanId: traces[traces.length - 1 - j]?.spanId,
        operationName: operations[Math.floor(Math.random() * operations.length)],
        serviceName: "ekuiper-playground",
        status: Math.random() > 0.05 ? "ok" : "error",
        startTime: baseTime + j * 10,
        duration: 10 + Math.random() * 50,
        attributes: {
          "span.kind": j % 2 === 0 ? "producer" : "consumer",
        },
        events: [],
      });
    }
  }

  return traces;
}

const DEMO_TRACES = generateDemoTraces();

export function OpenTelemetryTracing() {
  const [activeTab, setActiveTab] = useState("exporters");
  const [exporters, setExporters] = useState<OTelExporterConfig[]>(DEMO_EXPORTERS);
  const [traces, setTraces] = useState<TraceSpan[]>(DEMO_TRACES);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingExporter, setEditingExporter] = useState<OTelExporterConfig | null>(null);
  const [selectedTrace, setSelectedTrace] = useState<string | null>(null);

  const activeExporters = exporters.filter((e) => e.enabled).length;
  const recentTraces = new Set(traces.map((t) => t.traceId)).size;
  const errorSpans = traces.filter((t) => t.status === "error").length;
  const avgDuration =
    traces.length > 0
      ? traces.reduce((sum, t) => sum + t.duration, 0) / traces.length
      : 0;

  const handleToggleEnabled = (exporterId: string) => {
    setExporters((prev) =>
      prev.map((e) =>
        e.id === exporterId
          ? { ...e, enabled: !e.enabled, updatedAt: new Date().toISOString() }
          : e
      )
    );
  };

  const handleDeleteExporter = (exporterId: string) => {
    setExporters((prev) => prev.filter((e) => e.id !== exporterId));
  };

  // Group spans by traceId
  const traceGroups = traces.reduce((acc, span) => {
    if (!acc[span.traceId]) {
      acc[span.traceId] = [];
    }
    acc[span.traceId].push(span);
    return acc;
  }, {} as Record<string, TraceSpan[]>);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Exporters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{exporters.length}</div>
            <p className="text-xs text-muted-foreground">{activeExporters} active</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Recent Traces
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{recentTraces}</div>
            <p className="text-xs text-muted-foreground">Last hour</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Spans
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{traces.length}</div>
            <p className="text-xs text-red-500">{errorSpans} errors</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Duration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{avgDuration.toFixed(1)}ms</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="exporters">
            <Network className="h-4 w-4 mr-2" />
            Exporters
          </TabsTrigger>
          <TabsTrigger value="traces">
            <Workflow className="h-4 w-4 mr-2" />
            Traces
          </TabsTrigger>
          <TabsTrigger value="configuration">
            <Layers className="h-4 w-4 mr-2" />
            Configuration
          </TabsTrigger>
        </TabsList>

        <TabsContent value="exporters" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>OpenTelemetry Exporters</CardTitle>
                  <CardDescription>
                    Configure trace exporters (OTLP, Jaeger, Zipkin)
                  </CardDescription>
                </div>
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Exporter
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Add Exporter</DialogTitle>
                      <DialogDescription>
                        Configure a new OpenTelemetry trace exporter
                      </DialogDescription>
                    </DialogHeader>
                    <ExporterForm
                      onSubmit={(exp) => {
                        setExporters((prev) => [
                          ...prev,
                          {
                            ...exp,
                            id: `otel-${Date.now()}`,
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                          },
                        ]);
                        setIsAddDialogOpen(false);
                      }}
                      onCancel={() => setIsAddDialogOpen(false)}
                    />
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {exporters.map((exp) => (
                  <div
                    key={exp.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{exp.name}</span>
                        <Badge variant="outline">{exp.type.toUpperCase()}</Badge>
                        {exp.enabled ? (
                          <Badge className="bg-green-500">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Disabled</Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {exp.endpoint}
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>Protocol: {exp.protocol}</span>
                        <span>Sampling: {exp.samplingRate}%</span>
                        <span>Service: {exp.serviceName}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={exp.enabled}
                        onCheckedChange={() => handleToggleEnabled(exp.id)}
                      />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingExporter(exp)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Zap className="mr-2 h-4 w-4" />
                            Test Connection
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => handleDeleteExporter(exp.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="traces" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent Traces</CardTitle>
                  <CardDescription>
                    View distributed traces from rule execution
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Trace ID</TableHead>
                      <TableHead>Root Operation</TableHead>
                      <TableHead>Spans</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(traceGroups)
                      .slice(0, 10)
                      .map(([traceId, spans]) => {
                        const rootSpan = spans.find((s) => !s.parentSpanId) || spans[0];
                        const hasError = spans.some((s) => s.status === "error");
                        const totalDuration = Math.max(
                          ...spans.map((s) => s.startTime + s.duration)
                        ) - Math.min(...spans.map((s) => s.startTime));

                        return (
                          <TableRow key={traceId}>
                            <TableCell>
                              <code className="text-xs bg-muted px-1 rounded">
                                {traceId.slice(0, 16)}...
                              </code>
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {rootSpan.operationName}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{spans.length} spans</Badge>
                            </TableCell>
                            <TableCell>{totalDuration.toFixed(1)}ms</TableCell>
                            <TableCell>
                              {hasError ? (
                                <div className="flex items-center text-red-500">
                                  <XCircle className="h-4 w-4 mr-1" />
                                  Error
                                </div>
                              ) : (
                                <div className="flex items-center text-green-500">
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  OK
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {new Date(rootSpan.startTime).toLocaleTimeString()}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setSelectedTrace(
                                    selectedTrace === traceId ? null : traceId
                                  )
                                }
                              >
                                <ChevronRight
                                  className={`h-4 w-4 transition-transform ${
                                    selectedTrace === traceId ? "rotate-90" : ""
                                  }`}
                                />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>

              {/* Span Detail */}
              {selectedTrace && traceGroups[selectedTrace] && (
                <div className="mt-4 p-4 border rounded-lg bg-muted/50">
                  <div className="font-medium mb-3">Trace Spans</div>
                  <div className="space-y-2">
                    {traceGroups[selectedTrace].map((span) => (
                      <div
                        key={span.spanId}
                        className={`p-3 border rounded bg-background ${
                          span.parentSpanId ? "ml-6" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm">
                              {span.operationName}
                            </span>
                            {span.status === "error" ? (
                              <Badge variant="destructive">Error</Badge>
                            ) : (
                              <Badge variant="outline" className="bg-green-50">
                                OK
                              </Badge>
                            )}
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {span.duration.toFixed(1)}ms
                          </span>
                        </div>
                        {Object.keys(span.attributes).length > 0 && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            {Object.entries(span.attributes).map(([k, v]) => (
                              <span key={k} className="mr-3">
                                <span className="font-medium">{k}:</span> {String(v)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="configuration" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Global Configuration</CardTitle>
              <CardDescription>
                Configure global OpenTelemetry settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Service Name</Label>
                  <Input defaultValue="ekuiper-playground" />
                </div>
                <div className="space-y-2">
                  <Label>Service Version</Label>
                  <Input defaultValue="1.0.0" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Environment</Label>
                  <Select defaultValue="development">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="development">Development</SelectItem>
                      <SelectItem value="staging">Staging</SelectItem>
                      <SelectItem value="production">Production</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Default Sampling Rate (%)</Label>
                  <Input type="number" min={0} max={100} defaultValue={100} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Resource Attributes</Label>
                <Textarea
                  className="font-mono text-sm"
                  rows={4}
                  defaultValue={`host.name=localhost
deployment.environment=development
service.namespace=ekuiper`}
                />
                <p className="text-xs text-muted-foreground">
                  One attribute per line in key=value format
                </p>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center space-x-2">
                  <Switch id="traceRules" defaultChecked />
                  <Label htmlFor="traceRules">Trace rule execution</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch id="traceSources" defaultChecked />
                  <Label htmlFor="traceSources">Trace sources</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch id="traceSinks" defaultChecked />
                  <Label htmlFor="traceSinks">Trace sinks</Label>
                </div>
              </div>

              <Button>Save Configuration</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog
        open={!!editingExporter}
        onOpenChange={(open) => !open && setEditingExporter(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Exporter</DialogTitle>
          </DialogHeader>
          {editingExporter && (
            <ExporterForm
              exporter={editingExporter}
              onSubmit={(updated) => {
                setExporters((prev) =>
                  prev.map((e) =>
                    e.id === editingExporter.id
                      ? { ...e, ...updated, updatedAt: new Date().toISOString() }
                      : e
                  )
                );
                setEditingExporter(null);
              }}
              onCancel={() => setEditingExporter(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface ExporterFormProps {
  exporter?: OTelExporterConfig;
  onSubmit: (exp: Omit<OTelExporterConfig, "id" | "createdAt" | "updatedAt">) => void;
  onCancel: () => void;
}

function ExporterForm({ exporter, onSubmit, onCancel }: ExporterFormProps) {
  const [formData, setFormData] = useState({
    name: exporter?.name || "",
    type: exporter?.type || "otlp",
    endpoint: exporter?.endpoint || "",
    protocol: exporter?.protocol || "grpc",
    headers: Object.entries(exporter?.headers || {})
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n"),
    compression: exporter?.compression || "gzip",
    timeout: exporter?.timeout || 30000,
    retryEnabled: exporter?.retryEnabled ?? true,
    maxRetries: exporter?.maxRetries ?? 3,
    serviceName: exporter?.serviceName || "ekuiper-playground",
    serviceVersion: exporter?.serviceVersion || "1.0.0",
    environment: exporter?.environment || "development",
    samplingRate: exporter?.samplingRate ?? 100,
    enabled: exporter?.enabled ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Parse headers
    const headers: Record<string, string> = {};
    formData.headers.split("\n").forEach((line) => {
      const [key, ...rest] = line.split(":");
      if (key && rest.length > 0) {
        headers[key.trim()] = rest.join(":").trim();
      }
    });

    onSubmit({
      name: formData.name,
      type: formData.type as OTelExporterConfig["type"],
      endpoint: formData.endpoint,
      protocol: formData.protocol as OTelExporterConfig["protocol"],
      headers,
      compression: formData.compression as OTelExporterConfig["compression"],
      timeout: formData.timeout,
      retryEnabled: formData.retryEnabled,
      maxRetries: formData.maxRetries,
      serviceName: formData.serviceName,
      serviceVersion: formData.serviceVersion,
      environment: formData.environment,
      samplingRate: formData.samplingRate,
      enabled: formData.enabled,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[60vh] overflow-y-auto">
      <div className="space-y-2">
        <Label htmlFor="name">Exporter Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="Production Collector"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Type</Label>
          <Select
            value={formData.type}
            onValueChange={(v) => setFormData((prev) => ({ ...prev, type: v as 'otlp' | 'jaeger' | 'zipkin' }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="otlp">OTLP</SelectItem>
              <SelectItem value="jaeger">Jaeger</SelectItem>
              <SelectItem value="zipkin">Zipkin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Protocol</Label>
          <Select
            value={formData.protocol}
            onValueChange={(v) => setFormData((prev) => ({ ...prev, protocol: v as 'grpc' | 'http/protobuf' | 'http/json' }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="grpc">gRPC</SelectItem>
              <SelectItem value="http/protobuf">HTTP/Protobuf</SelectItem>
              <SelectItem value="http/json">HTTP/JSON</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="endpoint">Endpoint</Label>
        <Input
          id="endpoint"
          value={formData.endpoint}
          onChange={(e) => setFormData((prev) => ({ ...prev, endpoint: e.target.value }))}
          placeholder="http://localhost:4317"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="headers">Headers</Label>
        <Textarea
          id="headers"
          value={formData.headers}
          onChange={(e) => setFormData((prev) => ({ ...prev, headers: e.target.value }))}
          placeholder="Authorization: Bearer token&#10;X-Custom-Header: value"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Compression</Label>
          <Select
            value={formData.compression}
            onValueChange={(v) => setFormData((prev) => ({ ...prev, compression: v as 'none' | 'gzip' }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="gzip">gzip</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Timeout (ms)</Label>
          <Input
            type="number"
            value={formData.timeout}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, timeout: parseInt(e.target.value) || 30000 }))
            }
            min={1000}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Service Name</Label>
          <Input
            value={formData.serviceName}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, serviceName: e.target.value }))
            }
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Service Version</Label>
          <Input
            value={formData.serviceVersion}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, serviceVersion: e.target.value }))
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Environment</Label>
          <Select
            value={formData.environment}
            onValueChange={(v) => setFormData((prev) => ({ ...prev, environment: v as 'development' | 'staging' | 'production' }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="development">Development</SelectItem>
              <SelectItem value="staging">Staging</SelectItem>
              <SelectItem value="production">Production</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Sampling Rate (%)</Label>
          <Input
            type="number"
            min={0}
            max={100}
            value={formData.samplingRate}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                samplingRate: parseInt(e.target.value) || 100,
              }))
            }
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center space-x-2">
          <Switch
            id="retryEnabled"
            checked={formData.retryEnabled}
            onCheckedChange={(checked) =>
              setFormData((prev) => ({ ...prev, retryEnabled: checked }))
            }
          />
          <Label htmlFor="retryEnabled">Enable retries</Label>
        </div>
        {formData.retryEnabled && (
          <div className="flex items-center gap-2">
            <Label>Max retries:</Label>
            <Input
              type="number"
              className="w-20"
              min={0}
              max={10}
              value={formData.maxRetries}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  maxRetries: parseInt(e.target.value) || 3,
                }))
              }
            />
          </div>
        )}
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="enabled"
          checked={formData.enabled}
          onCheckedChange={(checked) =>
            setFormData((prev) => ({ ...prev, enabled: checked }))
          }
        />
        <Label htmlFor="enabled">Enable exporter</Label>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!formData.name || !formData.endpoint}>
          {exporter ? "Update" : "Create"} Exporter
        </Button>
      </DialogFooter>
    </form>
  );
}
