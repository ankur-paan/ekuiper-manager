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
  Webhook,
  Plus,
  Edit,
  Trash2,
  MoreHorizontal,
  TestTube,
  Copy,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
} from "lucide-react";

export type WebhookMethod = "POST" | "PUT" | "PATCH";
export type WebhookAuthType = "none" | "basic" | "bearer" | "api_key";
export type WebhookStatus = "active" | "failing" | "disabled";

export interface WebhookHeader {
  key: string;
  value: string;
}

export interface WebhookEndpoint {
  id: string;
  name: string;
  description?: string;
  url: string;
  method: WebhookMethod;
  headers: WebhookHeader[];
  authType: WebhookAuthType;
  authCredentials?: {
    username?: string;
    password?: string;
    token?: string;
    apiKey?: string;
    apiKeyHeader?: string;
  };
  payloadTemplate?: string;
  enabled: boolean;
  retryCount: number;
  retryDelay: number; // seconds
  timeout: number; // seconds
  status: WebhookStatus;
  lastSuccess?: string;
  lastError?: string;
  successCount: number;
  errorCount: number;
  createdAt: string;
  updatedAt: string;
}

// Demo webhooks
const DEMO_WEBHOOKS: WebhookEndpoint[] = [
  {
    id: "webhook-1",
    name: "Slack Notifications",
    description: "Send alerts to #alerts channel",
    url: "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXX",
    method: "POST",
    headers: [{ key: "Content-Type", value: "application/json" }],
    authType: "none",
    payloadTemplate: JSON.stringify({
      text: "{{alert.name}}: {{alert.message}}",
      blocks: [
        {
          type: "section",
          text: { type: "mrkdwn", text: "*{{alert.severity}}*: {{alert.message}}" },
        },
      ],
    }, null, 2),
    enabled: true,
    retryCount: 3,
    retryDelay: 5,
    timeout: 30,
    status: "active",
    lastSuccess: new Date(Date.now() - 3600000).toISOString(),
    successCount: 145,
    errorCount: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "webhook-2",
    name: "PagerDuty Integration",
    description: "Critical alerts to PagerDuty",
    url: "https://events.pagerduty.com/v2/enqueue",
    method: "POST",
    headers: [
      { key: "Content-Type", value: "application/json" },
    ],
    authType: "api_key",
    authCredentials: {
      apiKey: "pd-api-key-xxxx",
      apiKeyHeader: "X-Routing-Key",
    },
    payloadTemplate: JSON.stringify({
      routing_key: "{{routing_key}}",
      event_action: "trigger",
      payload: {
        summary: "{{alert.name}}: {{alert.message}}",
        severity: "{{alert.severity}}",
        source: "ekuiper-playground",
      },
    }, null, 2),
    enabled: true,
    retryCount: 5,
    retryDelay: 10,
    timeout: 60,
    status: "active",
    lastSuccess: new Date(Date.now() - 86400000).toISOString(),
    successCount: 23,
    errorCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "webhook-3",
    name: "Custom Alerting API",
    description: "Internal alerting system",
    url: "https://api.internal.example.com/alerts",
    method: "POST",
    headers: [{ key: "Content-Type", value: "application/json" }],
    authType: "bearer",
    authCredentials: { token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." },
    enabled: false,
    retryCount: 3,
    retryDelay: 5,
    timeout: 30,
    status: "disabled",
    lastError: "Connection refused",
    successCount: 50,
    errorCount: 15,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export function WebhookConfig() {
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>(DEMO_WEBHOOKS);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookEndpoint | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const handleToggleEnabled = (webhookId: string) => {
    setWebhooks((prev) =>
      prev.map((w) =>
        w.id === webhookId
          ? {
              ...w,
              enabled: !w.enabled,
              status: !w.enabled ? "active" : "disabled",
              updatedAt: new Date().toISOString(),
            }
          : w
      )
    );
  };

  const handleDeleteWebhook = (webhookId: string) => {
    setWebhooks((prev) => prev.filter((w) => w.id !== webhookId));
  };

  const handleTestWebhook = async (webhookId: string) => {
    setTestingId(webhookId);
    // Simulate test delay
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setTestingId(null);
    // In production, make actual test request
  };

  const getStatusBadge = (webhook: WebhookEndpoint) => {
    if (!webhook.enabled) {
      return <Badge variant="secondary">Disabled</Badge>;
    }
    switch (webhook.status) {
      case "active":
        return <Badge className="bg-green-500">Active</Badge>;
      case "failing":
        return <Badge variant="destructive">Failing</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const getAuthLabel = (authType: WebhookAuthType): string => {
    switch (authType) {
      case "basic":
        return "Basic Auth";
      case "bearer":
        return "Bearer Token";
      case "api_key":
        return "API Key";
      default:
        return "None";
    }
  };

  const activeCount = webhooks.filter((w) => w.enabled).length;
  const failingCount = webhooks.filter((w) => w.status === "failing").length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Webhooks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{webhooks.length}</div>
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
              Failing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{failingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Deliveries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {webhooks.reduce((sum, w) => sum + w.successCount, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Webhook List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Webhook className="h-5 w-5" />
                Webhook Endpoints
              </CardTitle>
              <CardDescription>
                Configure webhook destinations for alert notifications
              </CardDescription>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Webhook
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create Webhook Endpoint</DialogTitle>
                  <DialogDescription>
                    Configure a new webhook destination for alert notifications
                  </DialogDescription>
                </DialogHeader>
                <WebhookForm
                  onSubmit={(webhook) => {
                    setWebhooks((prev) => [
                      ...prev,
                      {
                        ...webhook,
                        id: `webhook-${Date.now()}`,
                        status: webhook.enabled ? "active" : "disabled",
                        successCount: 0,
                        errorCount: 0,
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
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Webhook</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Auth</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Deliveries</TableHead>
                  <TableHead>Last Success</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {webhooks.map((webhook) => (
                  <TableRow key={webhook.id}>
                    <TableCell>
                      <div className="font-medium">{webhook.name}</div>
                      {webhook.description && (
                        <div className="text-xs text-muted-foreground">
                          {webhook.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{webhook.method}</Badge>
                        <span className="text-xs font-mono truncate max-w-[150px]">
                          {webhook.url.replace(/^https?:\/\//, "").split("/")[0]}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => navigator.clipboard.writeText(webhook.url)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {getAuthLabel(webhook.authType)}
                      </Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(webhook)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="flex items-center text-green-600">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          {webhook.successCount}
                        </span>
                        <span className="flex items-center text-red-600">
                          <XCircle className="h-3 w-3 mr-1" />
                          {webhook.errorCount}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {webhook.lastSuccess ? (
                        <div className="flex items-center text-xs text-muted-foreground">
                          <Clock className="h-3 w-3 mr-1" />
                          {new Date(webhook.lastSuccess).toLocaleDateString()}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Never</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={webhook.enabled}
                        onCheckedChange={() => handleToggleEnabled(webhook.id)}
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
                            onClick={() => setEditingWebhook(webhook)}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleTestWebhook(webhook.id)}
                            disabled={testingId === webhook.id}
                          >
                            {testingId === webhook.id ? (
                              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <TestTube className="mr-2 h-4 w-4" />
                            )}
                            Test Webhook
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => handleDeleteWebhook(webhook.id)}
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
        open={!!editingWebhook}
        onOpenChange={(open) => !open && setEditingWebhook(null)}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Webhook Endpoint</DialogTitle>
            <DialogDescription>
              Modify the webhook configuration
            </DialogDescription>
          </DialogHeader>
          {editingWebhook && (
            <WebhookForm
              webhook={editingWebhook}
              onSubmit={(updated) => {
                setWebhooks((prev) =>
                  prev.map((w) =>
                    w.id === editingWebhook.id
                      ? {
                          ...w,
                          ...updated,
                          status: updated.enabled ? "active" : "disabled",
                          updatedAt: new Date().toISOString(),
                        }
                      : w
                  )
                );
                setEditingWebhook(null);
              }}
              onCancel={() => setEditingWebhook(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface WebhookFormProps {
  webhook?: WebhookEndpoint;
  onSubmit: (webhook: Omit<WebhookEndpoint, "id" | "createdAt" | "updatedAt" | "status" | "successCount" | "errorCount">) => void;
  onCancel: () => void;
}

function WebhookForm({ webhook, onSubmit, onCancel }: WebhookFormProps) {
  const [formData, setFormData] = useState({
    name: webhook?.name || "",
    description: webhook?.description || "",
    url: webhook?.url || "",
    method: webhook?.method || "POST" as WebhookMethod,
    headers: webhook?.headers || [{ key: "Content-Type", value: "application/json" }],
    authType: webhook?.authType || "none" as WebhookAuthType,
    authCredentials: webhook?.authCredentials || {},
    payloadTemplate: webhook?.payloadTemplate || "",
    enabled: webhook?.enabled ?? true,
    retryCount: webhook?.retryCount || 3,
    retryDelay: webhook?.retryDelay || 5,
    timeout: webhook?.timeout || 30,
  });

  const [showSecret, setShowSecret] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const addHeader = () => {
    setFormData((prev) => ({
      ...prev,
      headers: [...prev.headers, { key: "", value: "" }],
    }));
  };

  const removeHeader = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      headers: prev.headers.filter((_, i) => i !== index),
    }));
  };

  const updateHeader = (index: number, field: "key" | "value", value: string) => {
    setFormData((prev) => ({
      ...prev,
      headers: prev.headers.map((h, i) =>
        i === index ? { ...h, [field]: value } : h
      ),
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Webhook Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Slack Notifications"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="method">HTTP Method</Label>
          <Select
            value={formData.method}
            onValueChange={(v: WebhookMethod) =>
              setFormData((prev) => ({ ...prev, method: v }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="POST">POST</SelectItem>
              <SelectItem value="PUT">PUT</SelectItem>
              <SelectItem value="PATCH">PATCH</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="url">Webhook URL</Label>
        <Input
          id="url"
          type="url"
          value={formData.url}
          onChange={(e) => setFormData((prev) => ({ ...prev, url: e.target.value }))}
          placeholder="https://hooks.slack.com/services/..."
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, description: e.target.value }))
          }
          placeholder="Optional description"
          rows={2}
        />
      </div>

      {/* Authentication */}
      <div className="space-y-2">
        <Label>Authentication</Label>
        <Select
          value={formData.authType}
          onValueChange={(v: WebhookAuthType) =>
            setFormData((prev) => ({ ...prev, authType: v, authCredentials: {} }))
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="basic">Basic Auth</SelectItem>
            <SelectItem value="bearer">Bearer Token</SelectItem>
            <SelectItem value="api_key">API Key</SelectItem>
          </SelectContent>
        </Select>

        {formData.authType === "basic" && (
          <div className="grid grid-cols-2 gap-4 pt-2">
            <Input
              placeholder="Username"
              value={formData.authCredentials.username || ""}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  authCredentials: { ...prev.authCredentials, username: e.target.value },
                }))
              }
            />
            <div className="relative">
              <Input
                type={showSecret ? "text" : "password"}
                placeholder="Password"
                value={formData.authCredentials.password || ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    authCredentials: { ...prev.authCredentials, password: e.target.value },
                  }))
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                onClick={() => setShowSecret(!showSecret)}
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}

        {formData.authType === "bearer" && (
          <div className="relative pt-2">
            <Input
              type={showSecret ? "text" : "password"}
              placeholder="Bearer Token"
              value={formData.authCredentials.token || ""}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  authCredentials: { ...prev.authCredentials, token: e.target.value },
                }))
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0 mt-1"
              onClick={() => setShowSecret(!showSecret)}
            >
              {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        )}

        {formData.authType === "api_key" && (
          <div className="grid grid-cols-2 gap-4 pt-2">
            <Input
              placeholder="Header Name (e.g., X-API-Key)"
              value={formData.authCredentials.apiKeyHeader || ""}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  authCredentials: { ...prev.authCredentials, apiKeyHeader: e.target.value },
                }))
              }
            />
            <div className="relative">
              <Input
                type={showSecret ? "text" : "password"}
                placeholder="API Key Value"
                value={formData.authCredentials.apiKey || ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    authCredentials: { ...prev.authCredentials, apiKey: e.target.value },
                  }))
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                onClick={() => setShowSecret(!showSecret)}
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Headers */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Custom Headers</Label>
          <Button type="button" variant="outline" size="sm" onClick={addHeader}>
            <Plus className="h-4 w-4 mr-1" />
            Add Header
          </Button>
        </div>
        <div className="space-y-2">
          {formData.headers.map((header, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Input
                placeholder="Header name"
                value={header.key}
                onChange={(e) => updateHeader(idx, "key", e.target.value)}
                className="flex-1"
              />
              <Input
                placeholder="Value"
                value={header.value}
                onChange={(e) => updateHeader(idx, "value", e.target.value)}
                className="flex-1"
              />
              {formData.headers.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeHeader(idx)}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Payload Template */}
      <div className="space-y-2">
        <Label htmlFor="payload">Payload Template (JSON)</Label>
        <Textarea
          id="payload"
          value={formData.payloadTemplate}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, payloadTemplate: e.target.value }))
          }
          placeholder='{"text": "{{alert.message}}"}'
          className="font-mono text-sm"
          rows={5}
        />
        <p className="text-xs text-muted-foreground">
          Use &#123;&#123;alert.name&#125;&#125;, &#123;&#123;alert.severity&#125;&#125;, &#123;&#123;alert.message&#125;&#125; for dynamic values
        </p>
      </div>

      {/* Retry Settings */}
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="retryCount">Retry Count</Label>
          <Input
            id="retryCount"
            type="number"
            min={0}
            max={10}
            value={formData.retryCount}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, retryCount: parseInt(e.target.value) || 0 }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="retryDelay">Retry Delay (sec)</Label>
          <Input
            id="retryDelay"
            type="number"
            min={1}
            max={60}
            value={formData.retryDelay}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, retryDelay: parseInt(e.target.value) || 5 }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="timeout">Timeout (sec)</Label>
          <Input
            id="timeout"
            type="number"
            min={5}
            max={300}
            value={formData.timeout}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, timeout: parseInt(e.target.value) || 30 }))
            }
          />
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
        <Label htmlFor="enabled">Enable webhook immediately</Label>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!formData.name || !formData.url}>
          {webhook ? "Update" : "Create"} Webhook
        </Button>
      </DialogFooter>
    </form>
  );
}
