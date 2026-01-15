"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Bell,
  Plus,
  Edit,
  Trash2,
  MoreHorizontal,
  AlertTriangle,
  AlertCircle,
  Info,
  TestTube,
  RefreshCw,
  Zap,
} from "lucide-react";

export type AlertSeverity = "critical" | "warning" | "info";
export type AlertMetric = "error_count" | "latency" | "throughput" | "rule_status" | "memory_usage" | "cpu_usage";
export type AlertOperator = ">" | "<" | "==" | "!=" | ">=" | "<=";

export interface AlertCondition {
  metric: AlertMetric;
  operator: AlertOperator;
  threshold: number;
  duration?: number; // seconds
}

export interface AlertRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  severity: AlertSeverity;
  conditions: AlertCondition[];
  ruleFilter?: string; // Optional rule ID to monitor
  channels: string[]; // Webhook channel IDs
  cooldown: number; // minutes between alerts
  createdAt: string;
  updatedAt: string;
  lastTriggered?: string;
  triggerCount: number;
}

// Demo alert rules
const DEMO_ALERTS: AlertRule[] = [
  {
    id: "alert-1",
    name: "High Latency Alert",
    description: "Trigger when rule processing latency exceeds 500ms",
    enabled: true,
    severity: "warning",
    conditions: [
      { metric: "latency", operator: ">", threshold: 500, duration: 60 },
    ],
    channels: ["webhook-1"],
    cooldown: 15,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastTriggered: new Date(Date.now() - 3600000).toISOString(),
    triggerCount: 5,
  },
  {
    id: "alert-2",
    name: "Rule Failure Alert",
    description: "Trigger when a rule stops unexpectedly",
    enabled: true,
    severity: "critical",
    conditions: [
      { metric: "rule_status", operator: "==", threshold: 0 },
    ],
    channels: ["webhook-1", "webhook-2"],
    cooldown: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    triggerCount: 2,
  },
  {
    id: "alert-3",
    name: "Low Throughput Warning",
    description: "Trigger when throughput drops below threshold",
    enabled: false,
    severity: "info",
    conditions: [
      { metric: "throughput", operator: "<", threshold: 10, duration: 300 },
    ],
    channels: ["webhook-1"],
    cooldown: 30,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    triggerCount: 0,
  },
  {
    id: "alert-4",
    name: "High Error Rate",
    description: "Trigger when error count exceeds limit",
    enabled: true,
    severity: "critical",
    conditions: [
      { metric: "error_count", operator: ">", threshold: 100, duration: 300 },
    ],
    channels: ["webhook-2"],
    cooldown: 10,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastTriggered: new Date(Date.now() - 86400000).toISOString(),
    triggerCount: 8,
  },
];

export function AlertManager() {
  const [alerts, setAlerts] = useState<AlertRule[]>(DEMO_ALERTS);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingAlert, setEditingAlert] = useState<AlertRule | null>(null);

  const handleToggleEnabled = (alertId: string) => {
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === alertId
          ? { ...a, enabled: !a.enabled, updatedAt: new Date().toISOString() }
          : a
      )
    );
  };

  const handleDeleteAlert = (alertId: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
  };

  const getSeverityIcon = (severity: AlertSeverity) => {
    switch (severity) {
      case "critical":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getSeverityBadge = (severity: AlertSeverity) => {
    switch (severity) {
      case "critical":
        return <Badge variant="destructive">Critical</Badge>;
      case "warning":
        return <Badge className="bg-amber-500">Warning</Badge>;
      default:
        return <Badge variant="secondary">Info</Badge>;
    }
  };

  const formatCondition = (condition: AlertCondition): string => {
    const metricLabels: Record<AlertMetric, string> = {
      error_count: "Error Count",
      latency: "Latency (ms)",
      throughput: "Throughput (msg/s)",
      rule_status: "Rule Status",
      memory_usage: "Memory (%)",
      cpu_usage: "CPU (%)",
    };
    return `${metricLabels[condition.metric]} ${condition.operator} ${condition.threshold}${
      condition.duration ? ` for ${condition.duration}s` : ""
    }`;
  };

  const activeCount = alerts.filter((a) => a.enabled).length;
  const criticalCount = alerts.filter((a) => a.severity === "critical" && a.enabled).length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{alerts.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Critical Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{criticalCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Triggers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {alerts.reduce((sum, a) => sum + a.triggerCount, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alert List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Alert Rules
              </CardTitle>
              <CardDescription>
                Configure alerts based on metrics and thresholds
              </CardDescription>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Alert
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create Alert Rule</DialogTitle>
                  <DialogDescription>
                    Configure conditions and notifications for this alert
                  </DialogDescription>
                </DialogHeader>
                <AlertForm
                  onSubmit={(alert) => {
                    setAlerts((prev) => [
                      ...prev,
                      {
                        ...alert,
                        id: `alert-${Date.now()}`,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        triggerCount: 0,
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
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead>Alert</TableHead>
                  <TableHead>Conditions</TableHead>
                  <TableHead>Channels</TableHead>
                  <TableHead>Cooldown</TableHead>
                  <TableHead>Triggers</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map((alert) => (
                  <TableRow key={alert.id}>
                    <TableCell>{getSeverityIcon(alert.severity)}</TableCell>
                    <TableCell>
                      <div className="font-medium">{alert.name}</div>
                      {alert.description && (
                        <div className="text-xs text-muted-foreground">
                          {alert.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {alert.conditions.map((cond, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {formatCondition(cond)}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {alert.channels.length} webhook(s)
                      </Badge>
                    </TableCell>
                    <TableCell>{alert.cooldown}m</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Zap className="h-3 w-3 text-amber-500" />
                        {alert.triggerCount}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={alert.enabled}
                        onCheckedChange={() => handleToggleEnabled(alert.id)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => setEditingAlert(alert)}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <TestTube className="mr-2 h-4 w-4" />
                            Test Alert
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => handleDeleteAlert(alert.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog
        open={!!editingAlert}
        onOpenChange={(open) => !open && setEditingAlert(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Alert Rule</DialogTitle>
            <DialogDescription>
              Modify the alert configuration
            </DialogDescription>
          </DialogHeader>
          {editingAlert && (
            <AlertForm
              alert={editingAlert}
              onSubmit={(updated) => {
                setAlerts((prev) =>
                  prev.map((a) =>
                    a.id === editingAlert.id
                      ? { ...a, ...updated, updatedAt: new Date().toISOString() }
                      : a
                  )
                );
                setEditingAlert(null);
              }}
              onCancel={() => setEditingAlert(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface AlertFormProps {
  alert?: AlertRule;
  onSubmit: (alert: Omit<AlertRule, "id" | "createdAt" | "updatedAt" | "triggerCount">) => void;
  onCancel: () => void;
}

function AlertForm({ alert, onSubmit, onCancel }: AlertFormProps) {
  const [formData, setFormData] = useState({
    name: alert?.name || "",
    description: alert?.description || "",
    severity: alert?.severity || "warning" as AlertSeverity,
    enabled: alert?.enabled ?? true,
    conditions: alert?.conditions || [
      { metric: "latency" as AlertMetric, operator: ">" as AlertOperator, threshold: 100 },
    ],
    channels: alert?.channels || [],
    cooldown: alert?.cooldown || 15,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const addCondition = () => {
    setFormData((prev) => ({
      ...prev,
      conditions: [
        ...prev.conditions,
        { metric: "latency" as AlertMetric, operator: ">" as AlertOperator, threshold: 100 },
      ],
    }));
  };

  const removeCondition = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      conditions: prev.conditions.filter((_, i) => i !== index),
    }));
  };

  const updateCondition = (index: number, field: string, value: unknown) => {
    setFormData((prev) => ({
      ...prev,
      conditions: prev.conditions.map((c, i) =>
        i === index ? { ...c, [field]: value } : c
      ),
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Alert Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="High Latency Alert"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="severity">Severity</Label>
          <Select
            value={formData.severity}
            onValueChange={(v: AlertSeverity) =>
              setFormData((prev) => ({ ...prev, severity: v }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="info">Info</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, description: e.target.value }))
          }
          placeholder="Optional description for this alert"
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Conditions</Label>
          <Button type="button" variant="outline" size="sm" onClick={addCondition}>
            <Plus className="h-4 w-4 mr-1" />
            Add Condition
          </Button>
        </div>
        <div className="space-y-2">
          {formData.conditions.map((condition, idx) => (
            <div key={idx} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
              <Select
                value={condition.metric}
                onValueChange={(v) => updateCondition(idx, "metric", v)}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="latency">Latency (ms)</SelectItem>
                  <SelectItem value="throughput">Throughput</SelectItem>
                  <SelectItem value="error_count">Error Count</SelectItem>
                  <SelectItem value="rule_status">Rule Status</SelectItem>
                  <SelectItem value="memory_usage">Memory (%)</SelectItem>
                  <SelectItem value="cpu_usage">CPU (%)</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={condition.operator}
                onValueChange={(v) => updateCondition(idx, "operator", v)}
              >
                <SelectTrigger className="w-[80px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value=">">&gt;</SelectItem>
                  <SelectItem value="<">&lt;</SelectItem>
                  <SelectItem value="==">=</SelectItem>
                  <SelectItem value="!=">≠</SelectItem>
                  <SelectItem value=">=">≥</SelectItem>
                  <SelectItem value="<=">≤</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                value={condition.threshold}
                onChange={(e) =>
                  updateCondition(idx, "threshold", parseFloat(e.target.value))
                }
                className="w-[100px]"
              />
              <Input
                type="number"
                value={condition.duration || ""}
                onChange={(e) =>
                  updateCondition(
                    idx,
                    "duration",
                    e.target.value ? parseInt(e.target.value) : undefined
                  )
                }
                placeholder="Duration (s)"
                className="w-[120px]"
              />
              {formData.conditions.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeCondition(idx)}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="cooldown">Cooldown (minutes)</Label>
        <Input
          id="cooldown"
          type="number"
          min={1}
          value={formData.cooldown}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, cooldown: parseInt(e.target.value) || 15 }))
          }
        />
        <p className="text-xs text-muted-foreground">
          Minimum time between repeated alerts
        </p>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="enabled"
          checked={formData.enabled}
          onCheckedChange={(checked) =>
            setFormData((prev) => ({ ...prev, enabled: checked }))
          }
        />
        <Label htmlFor="enabled">Enable alert immediately</Label>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!formData.name}>
          {alert ? "Update" : "Create"} Alert
        </Button>
      </DialogFooter>
    </form>
  );
}
