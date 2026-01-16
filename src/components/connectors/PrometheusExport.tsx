"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  BarChart3,
  Plus,
  Edit,
  Trash2,
  MoreHorizontal,
  RefreshCw,
  ExternalLink,
  Copy,
  Activity,
  Clock,
  TrendingUp,
  Gauge,
} from "lucide-react";

export interface PrometheusExportConfig {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  port: number;
  path: string; // e.g., /metrics
  namespace: string;
  subsystem?: string;
  labels: Record<string, string>;
  includeRuleMetrics: boolean;
  includeSystemMetrics: boolean;
  scrapeInterval: number; // seconds
  createdAt: string;
  updatedAt: string;
}

export interface PrometheusMetric {
  name: string;
  type: "counter" | "gauge" | "histogram" | "summary";
  help: string;
  labels: string[];
  value: number;
  timestamp: number;
}

// Demo export configs
const DEMO_EXPORTS: PrometheusExportConfig[] = [
  {
    id: "prom-1",
    name: "Main Metrics Endpoint",
    description: "Primary Prometheus metrics export",
    enabled: true,
    port: 9091,
    path: "/metrics",
    namespace: "ekuiper",
    subsystem: "rules",
    labels: { instance: "production", cluster: "main" },
    includeRuleMetrics: true,
    includeSystemMetrics: true,
    scrapeInterval: 15,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "prom-2",
    name: "Custom Business Metrics",
    description: "Business-specific metrics export",
    enabled: true,
    port: 9092,
    path: "/metrics/custom",
    namespace: "ekuiper_custom",
    labels: { team: "data-platform" },
    includeRuleMetrics: true,
    includeSystemMetrics: false,
    scrapeInterval: 30,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Generate demo metrics time series
function generateMetricsData() {
  const data = [];
  const now = Date.now();
  for (let i = 29; i >= 0; i--) {
    data.push({
      time: new Date(now - i * 60000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      throughput: Math.floor(500 + Math.random() * 200),
      latency: Math.floor(20 + Math.random() * 30),
      errorRate: Math.random() * 2,
      activeRules: Math.floor(8 + Math.random() * 3),
    });
  }
  return data;
}

// Demo current metrics
const DEMO_METRICS: PrometheusMetric[] = [
  {
    name: "ekuiper_rules_messages_total",
    type: "counter",
    help: "Total number of messages processed",
    labels: ["rule_id", "status"],
    value: 1245890,
    timestamp: Date.now(),
  },
  {
    name: "ekuiper_rules_processing_latency_seconds",
    type: "histogram",
    help: "Rule processing latency in seconds",
    labels: ["rule_id", "quantile"],
    value: 0.025,
    timestamp: Date.now(),
  },
  {
    name: "ekuiper_rules_active",
    type: "gauge",
    help: "Number of currently active rules",
    labels: [],
    value: 10,
    timestamp: Date.now(),
  },
  {
    name: "ekuiper_memory_usage_bytes",
    type: "gauge",
    help: "Current memory usage in bytes",
    labels: [],
    value: 256000000,
    timestamp: Date.now(),
  },
  {
    name: "ekuiper_cpu_usage_percent",
    type: "gauge",
    help: "Current CPU usage percentage",
    labels: [],
    value: 35.5,
    timestamp: Date.now(),
  },
  {
    name: "ekuiper_errors_total",
    type: "counter",
    help: "Total number of errors",
    labels: ["type", "rule_id"],
    value: 42,
    timestamp: Date.now(),
  },
];

export function PrometheusExport() {
  const [exports, setExports] = useState<PrometheusExportConfig[]>(DEMO_EXPORTS);
  const [metricsData, setMetricsData] = useState(generateMetricsData());
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingExport, setEditingExport] = useState<PrometheusExportConfig | null>(null);

  // Simulate live metrics updates
  useEffect(() => {
    const interval = setInterval(() => {
      setMetricsData((prev) => {
        const newData = [...prev.slice(1)];
        const now = new Date();
        newData.push({
          time: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          throughput: Math.floor(500 + Math.random() * 200),
          latency: Math.floor(20 + Math.random() * 30),
          errorRate: Math.random() * 2,
          activeRules: Math.floor(8 + Math.random() * 3),
        });
        return newData;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleToggleEnabled = (exportId: string) => {
    setExports((prev) =>
      prev.map((e) =>
        e.id === exportId
          ? { ...e, enabled: !e.enabled, updatedAt: new Date().toISOString() }
          : e
      )
    );
  };

  const handleDeleteExport = (exportId: string) => {
    setExports((prev) => prev.filter((e) => e.id !== exportId));
  };

  const getEndpointUrl = (exp: PrometheusExportConfig) => {
    return `http://localhost:${exp.port}${exp.path}`;
  };

  const activeExports = exports.filter((e) => e.enabled).length;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Export Endpoints
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{exports.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeExports}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Metrics Count
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{DEMO_METRICS.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Scrape Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {exports.reduce((sum, e) => sum + (e.enabled ? 60 / e.scrapeInterval : 0), 0).toFixed(1)}/m
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Live Metrics Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Live Metrics Preview
          </CardTitle>
          <CardDescription>
            Real-time metrics being exported to Prometheus
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="text-sm font-medium mb-2">Throughput & Active Rules</div>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={metricsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="throughput"
                      stroke="#3b82f6"
                      fill="#3b82f6"
                      fillOpacity={0.3}
                      name="Throughput (msg/s)"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="activeRules"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      dot={false}
                      name="Active Rules"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div>
              <div className="text-sm font-medium mb-2">Latency & Error Rate</div>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metricsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="latency"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={false}
                      name="Latency (ms)"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="errorRate"
                      stroke="#ef4444"
                      strokeWidth={2}
                      dot={false}
                      name="Error Rate (%)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-6">
        {/* Export Endpoints */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Export Endpoints
                </CardTitle>
                <CardDescription>
                  Configure Prometheus metrics endpoints
                </CardDescription>
              </div>
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Prometheus Export</DialogTitle>
                    <DialogDescription>
                      Configure a new Prometheus metrics endpoint
                    </DialogDescription>
                  </DialogHeader>
                  <ExportForm
                    onSubmit={(exp) => {
                      setExports((prev) => [
                        ...prev,
                        {
                          ...exp,
                          id: `prom-${Date.now()}`,
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
              {exports.map((exp) => (
                <div
                  key={exp.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{exp.name}</span>
                      {exp.enabled ? (
                        <Badge className="bg-green-500">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Disabled</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <code className="bg-muted px-1 rounded">
                        :{exp.port}{exp.path}
                      </code>
                      <span>·</span>
                      <span className="flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        {exp.scrapeInterval}s
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigator.clipboard.writeText(getEndpointUrl(exp))}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
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
                        <DropdownMenuItem onClick={() => setEditingExport(exp)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Open Endpoint
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => handleDeleteExport(exp.id)}
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

        {/* Current Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="h-5 w-5" />
              Available Metrics
            </CardTitle>
            <CardDescription>
              Metrics being exported to Prometheus
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Metric</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {DEMO_METRICS.map((metric, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <div className="font-mono text-xs">{metric.name}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {metric.help}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {metric.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {metric.type === "gauge" && metric.value > 1000000
                          ? (metric.value / 1000000).toFixed(1) + "M"
                          : metric.value.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog
        open={!!editingExport}
        onOpenChange={(open) => !open && setEditingExport(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Prometheus Export</DialogTitle>
          </DialogHeader>
          {editingExport && (
            <ExportForm
              exportConfig={editingExport}
              onSubmit={(updated) => {
                setExports((prev) =>
                  prev.map((e) =>
                    e.id === editingExport.id
                      ? { ...e, ...updated, updatedAt: new Date().toISOString() }
                      : e
                  )
                );
                setEditingExport(null);
              }}
              onCancel={() => setEditingExport(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface ExportFormProps {
  exportConfig?: PrometheusExportConfig;
  onSubmit: (exp: Omit<PrometheusExportConfig, "id" | "createdAt" | "updatedAt">) => void;
  onCancel: () => void;
}

function ExportForm({ exportConfig, onSubmit, onCancel }: ExportFormProps) {
  const [formData, setFormData] = useState({
    name: exportConfig?.name || "",
    description: exportConfig?.description || "",
    port: exportConfig?.port || 9091,
    path: exportConfig?.path || "/metrics",
    namespace: exportConfig?.namespace || "ekuiper",
    subsystem: exportConfig?.subsystem || "",
    labels: Object.entries(exportConfig?.labels || {})
      .map(([k, v]) => `${k}=${v}`)
      .join(", "),
    includeRuleMetrics: exportConfig?.includeRuleMetrics ?? true,
    includeSystemMetrics: exportConfig?.includeSystemMetrics ?? true,
    scrapeInterval: exportConfig?.scrapeInterval || 15,
    enabled: exportConfig?.enabled ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Parse labels
    const labels: Record<string, string> = {};
    formData.labels.split(",").forEach((pair) => {
      const [key, value] = pair.split("=").map((s) => s.trim());
      if (key && value) {
        labels[key] = value;
      }
    });

    onSubmit({
      name: formData.name,
      description: formData.description || undefined,
      port: formData.port,
      path: formData.path,
      namespace: formData.namespace,
      subsystem: formData.subsystem || undefined,
      labels,
      includeRuleMetrics: formData.includeRuleMetrics,
      includeSystemMetrics: formData.includeSystemMetrics,
      scrapeInterval: formData.scrapeInterval,
      enabled: formData.enabled,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Endpoint Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="Main Metrics Endpoint"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          value={formData.description}
          onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
          placeholder="Optional description"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="port">Port</Label>
          <Input
            id="port"
            type="number"
            min={1024}
            max={65535}
            value={formData.port}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, port: parseInt(e.target.value) || 9091 }))
            }
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="path">Path</Label>
          <Input
            id="path"
            value={formData.path}
            onChange={(e) => setFormData((prev) => ({ ...prev, path: e.target.value }))}
            placeholder="/metrics"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="namespace">Namespace</Label>
          <Input
            id="namespace"
            value={formData.namespace}
            onChange={(e) => setFormData((prev) => ({ ...prev, namespace: e.target.value }))}
            placeholder="ekuiper"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="subsystem">Subsystem (optional)</Label>
          <Input
            id="subsystem"
            value={formData.subsystem}
            onChange={(e) => setFormData((prev) => ({ ...prev, subsystem: e.target.value }))}
            placeholder="rules"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="labels">Default Labels</Label>
        <Input
          id="labels"
          value={formData.labels}
          onChange={(e) => setFormData((prev) => ({ ...prev, labels: e.target.value }))}
          placeholder="instance=production, cluster=main"
        />
        <p className="text-xs text-muted-foreground">
          Comma-separated key=value pairs
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="scrapeInterval">Scrape Interval (seconds)</Label>
        <Select
          value={String(formData.scrapeInterval)}
          onValueChange={(v) =>
            setFormData((prev) => ({ ...prev, scrapeInterval: parseInt(v) }))
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="5">5 seconds</SelectItem>
            <SelectItem value="10">10 seconds</SelectItem>
            <SelectItem value="15">15 seconds</SelectItem>
            <SelectItem value="30">30 seconds</SelectItem>
            <SelectItem value="60">60 seconds</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Included Metrics</Label>
        <div className="flex items-center gap-6">
          <div className="flex items-center space-x-2">
            <Switch
              id="ruleMetrics"
              checked={formData.includeRuleMetrics}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({ ...prev, includeRuleMetrics: checked }))
              }
            />
            <Label htmlFor="ruleMetrics">Rule metrics</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="systemMetrics"
              checked={formData.includeSystemMetrics}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({ ...prev, includeSystemMetrics: checked }))
              }
            />
            <Label htmlFor="systemMetrics">System metrics</Label>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="enabled"
          checked={formData.enabled}
          onCheckedChange={(checked) =>
            setFormData((prev) => ({ ...prev, enabled: checked }))
          }
        />
        <Label htmlFor="enabled">Enable endpoint</Label>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!formData.name || !formData.namespace}>
          {exportConfig ? "Update" : "Create"} Export
        </Button>
      </DialogFooter>
    </form>
  );
}
