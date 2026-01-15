"use client";

import { useState } from "react";
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
  MessageSquare,
  Mail,
  Plus,
  Edit,
  Trash2,
  MoreHorizontal,
  TestTube,
  CheckCircle,
  XCircle,
  Slack,
  Send,
  RefreshCw,
  Hash,
} from "lucide-react";

export type ChannelType = "slack" | "teams" | "email" | "discord" | "telegram" | "custom";

export interface NotificationChannel {
  id: string;
  name: string;
  type: ChannelType;
  enabled: boolean;
  config: {
    // Slack
    webhookUrl?: string;
    channel?: string;
    // Teams
    teamsWebhookUrl?: string;
    // Email
    smtpHost?: string;
    smtpPort?: number;
    smtpUser?: string;
    smtpPassword?: string;
    recipients?: string[];
    fromAddress?: string;
    // Discord
    discordWebhookUrl?: string;
    // Telegram
    telegramBotToken?: string;
    telegramChatId?: string;
    // Custom
    customWebhookUrl?: string;
  };
  alertRuleIds: string[]; // Which alert rules use this channel
  lastSuccess?: string;
  lastError?: string;
  successCount: number;
  errorCount: number;
  createdAt: string;
  updatedAt: string;
}

// Demo channels
const DEMO_CHANNELS: NotificationChannel[] = [
  {
    id: "channel-1",
    name: "Slack #alerts",
    type: "slack",
    enabled: true,
    config: {
      webhookUrl: "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXX",
      channel: "#alerts",
    },
    alertRuleIds: ["alert-1", "alert-2"],
    lastSuccess: new Date(Date.now() - 3600000).toISOString(),
    successCount: 234,
    errorCount: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "channel-2",
    name: "Microsoft Teams",
    type: "teams",
    enabled: true,
    config: {
      teamsWebhookUrl: "https://outlook.office.com/webhook/xxx/IncomingWebhook/xxx",
    },
    alertRuleIds: ["alert-1"],
    lastSuccess: new Date(Date.now() - 86400000).toISOString(),
    successCount: 45,
    errorCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "channel-3",
    name: "DevOps Email",
    type: "email",
    enabled: true,
    config: {
      smtpHost: "smtp.example.com",
      smtpPort: 587,
      smtpUser: "alerts@example.com",
      recipients: ["devops@example.com", "oncall@example.com"],
      fromAddress: "alerts@example.com",
    },
    alertRuleIds: ["alert-2", "alert-4"],
    lastSuccess: new Date(Date.now() - 7200000).toISOString(),
    successCount: 156,
    errorCount: 8,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "channel-4",
    name: "Discord Alerts",
    type: "discord",
    enabled: false,
    config: {
      discordWebhookUrl: "https://discord.com/api/webhooks/xxx/xxx",
    },
    alertRuleIds: [],
    successCount: 0,
    errorCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export function NotificationChannels() {
  const [channels, setChannels] = useState<NotificationChannel[]>(DEMO_CHANNELS);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<NotificationChannel | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const handleToggleEnabled = (channelId: string) => {
    setChannels((prev) =>
      prev.map((c) =>
        c.id === channelId
          ? { ...c, enabled: !c.enabled, updatedAt: new Date().toISOString() }
          : c
      )
    );
  };

  const handleDeleteChannel = (channelId: string) => {
    setChannels((prev) => prev.filter((c) => c.id !== channelId));
  };

  const handleTestChannel = async (channelId: string) => {
    setTestingId(channelId);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setTestingId(null);
  };

  const getChannelIcon = (type: ChannelType) => {
    switch (type) {
      case "slack":
        return <Slack className="h-4 w-4" />;
      case "teams":
        return <MessageSquare className="h-4 w-4" />;
      case "email":
        return <Mail className="h-4 w-4" />;
      case "discord":
        return <Hash className="h-4 w-4" />;
      case "telegram":
        return <Send className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getChannelLabel = (type: ChannelType): string => {
    const labels: Record<ChannelType, string> = {
      slack: "Slack",
      teams: "Microsoft Teams",
      email: "Email (SMTP)",
      discord: "Discord",
      telegram: "Telegram",
      custom: "Custom Webhook",
    };
    return labels[type];
  };

  const activeCount = channels.filter((c) => c.enabled).length;
  const totalDeliveries = channels.reduce((sum, c) => sum + c.successCount, 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Channels
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{channels.length}</div>
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
              Total Deliveries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{totalDeliveries}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Errors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {channels.reduce((sum, c) => sum + c.errorCount, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Channels List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Notification Channels
              </CardTitle>
              <CardDescription>
                Configure where alert notifications are sent
              </CardDescription>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Channel
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Add Notification Channel</DialogTitle>
                  <DialogDescription>
                    Configure a new notification destination
                  </DialogDescription>
                </DialogHeader>
                <ChannelForm
                  onSubmit={(channel) => {
                    setChannels((prev) => [
                      ...prev,
                      {
                        ...channel,
                        id: `channel-${Date.now()}`,
                        alertRuleIds: [],
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
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Alert Rules</TableHead>
                  <TableHead>Deliveries</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {channels.map((channel) => (
                  <TableRow key={channel.id}>
                    <TableCell>{getChannelIcon(channel.type)}</TableCell>
                    <TableCell>
                      <div className="font-medium">{channel.name}</div>
                      {channel.type === "slack" && channel.config.channel && (
                        <div className="text-xs text-muted-foreground">
                          {channel.config.channel}
                        </div>
                      )}
                      {channel.type === "email" && channel.config.recipients && (
                        <div className="text-xs text-muted-foreground">
                          {channel.config.recipients.length} recipient(s)
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{getChannelLabel(channel.type)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {channel.alertRuleIds.length} rule(s)
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="flex items-center text-green-600">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          {channel.successCount}
                        </span>
                        <span className="flex items-center text-red-600">
                          <XCircle className="h-3 w-3 mr-1" />
                          {channel.errorCount}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {channel.lastSuccess ? (
                        <span className="text-xs text-muted-foreground">
                          {new Date(channel.lastSuccess).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Never</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={channel.enabled}
                        onCheckedChange={() => handleToggleEnabled(channel.id)}
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
                            onClick={() => setEditingChannel(channel)}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleTestChannel(channel.id)}
                            disabled={testingId === channel.id}
                          >
                            {testingId === channel.id ? (
                              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <TestTube className="mr-2 h-4 w-4" />
                            )}
                            Send Test
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => handleDeleteChannel(channel.id)}
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
        open={!!editingChannel}
        onOpenChange={(open) => !open && setEditingChannel(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Notification Channel</DialogTitle>
            <DialogDescription>
              Modify channel configuration
            </DialogDescription>
          </DialogHeader>
          {editingChannel && (
            <ChannelForm
              channel={editingChannel}
              onSubmit={(updated) => {
                setChannels((prev) =>
                  prev.map((c) =>
                    c.id === editingChannel.id
                      ? { ...c, ...updated, updatedAt: new Date().toISOString() }
                      : c
                  )
                );
                setEditingChannel(null);
              }}
              onCancel={() => setEditingChannel(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface ChannelFormProps {
  channel?: NotificationChannel;
  onSubmit: (channel: Omit<NotificationChannel, "id" | "createdAt" | "updatedAt" | "alertRuleIds" | "successCount" | "errorCount">) => void;
  onCancel: () => void;
}

function ChannelForm({ channel, onSubmit, onCancel }: ChannelFormProps) {
  const [formData, setFormData] = useState({
    name: channel?.name || "",
    type: channel?.type || "slack" as ChannelType,
    enabled: channel?.enabled ?? true,
    config: channel?.config || {},
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const updateConfig = (key: string, value: unknown) => {
    setFormData((prev) => ({
      ...prev,
      config: { ...prev.config, [key]: value },
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Channel Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="Slack #alerts"
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Channel Type</Label>
        <Select
          value={formData.type}
          onValueChange={(v: ChannelType) =>
            setFormData((prev) => ({ ...prev, type: v, config: {} }))
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="slack">Slack</SelectItem>
            <SelectItem value="teams">Microsoft Teams</SelectItem>
            <SelectItem value="email">Email (SMTP)</SelectItem>
            <SelectItem value="discord">Discord</SelectItem>
            <SelectItem value="telegram">Telegram</SelectItem>
            <SelectItem value="custom">Custom Webhook</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Slack Config */}
      {formData.type === "slack" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="webhookUrl">Webhook URL</Label>
            <Input
              id="webhookUrl"
              type="url"
              value={formData.config.webhookUrl || ""}
              onChange={(e) => updateConfig("webhookUrl", e.target.value)}
              placeholder="https://hooks.slack.com/services/..."
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="channel">Channel (optional)</Label>
            <Input
              id="channel"
              value={formData.config.channel || ""}
              onChange={(e) => updateConfig("channel", e.target.value)}
              placeholder="#alerts"
            />
          </div>
        </div>
      )}

      {/* Teams Config */}
      {formData.type === "teams" && (
        <div className="space-y-2">
          <Label htmlFor="teamsWebhookUrl">Webhook URL</Label>
          <Input
            id="teamsWebhookUrl"
            type="url"
            value={formData.config.teamsWebhookUrl || ""}
            onChange={(e) => updateConfig("teamsWebhookUrl", e.target.value)}
            placeholder="https://outlook.office.com/webhook/..."
            required
          />
        </div>
      )}

      {/* Email Config */}
      {formData.type === "email" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="smtpHost">SMTP Host</Label>
              <Input
                id="smtpHost"
                value={formData.config.smtpHost || ""}
                onChange={(e) => updateConfig("smtpHost", e.target.value)}
                placeholder="smtp.example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtpPort">Port</Label>
              <Input
                id="smtpPort"
                type="number"
                value={formData.config.smtpPort || 587}
                onChange={(e) => updateConfig("smtpPort", parseInt(e.target.value))}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="smtpUser">Username</Label>
              <Input
                id="smtpUser"
                value={formData.config.smtpUser || ""}
                onChange={(e) => updateConfig("smtpUser", e.target.value)}
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtpPassword">Password</Label>
              <Input
                id="smtpPassword"
                type="password"
                value={formData.config.smtpPassword || ""}
                onChange={(e) => updateConfig("smtpPassword", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="fromAddress">From Address</Label>
            <Input
              id="fromAddress"
              type="email"
              value={formData.config.fromAddress || ""}
              onChange={(e) => updateConfig("fromAddress", e.target.value)}
              placeholder="alerts@example.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="recipients">Recipients (comma-separated)</Label>
            <Input
              id="recipients"
              value={(formData.config.recipients || []).join(", ")}
              onChange={(e) =>
                updateConfig(
                  "recipients",
                  e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                )
              }
              placeholder="devops@example.com, oncall@example.com"
              required
            />
          </div>
        </div>
      )}

      {/* Discord Config */}
      {formData.type === "discord" && (
        <div className="space-y-2">
          <Label htmlFor="discordWebhookUrl">Webhook URL</Label>
          <Input
            id="discordWebhookUrl"
            type="url"
            value={formData.config.discordWebhookUrl || ""}
            onChange={(e) => updateConfig("discordWebhookUrl", e.target.value)}
            placeholder="https://discord.com/api/webhooks/..."
            required
          />
        </div>
      )}

      {/* Telegram Config */}
      {formData.type === "telegram" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="telegramBotToken">Bot Token</Label>
            <Input
              id="telegramBotToken"
              value={formData.config.telegramBotToken || ""}
              onChange={(e) => updateConfig("telegramBotToken", e.target.value)}
              placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="telegramChatId">Chat ID</Label>
            <Input
              id="telegramChatId"
              value={formData.config.telegramChatId || ""}
              onChange={(e) => updateConfig("telegramChatId", e.target.value)}
              placeholder="-1001234567890"
              required
            />
          </div>
        </div>
      )}

      {/* Custom Webhook Config */}
      {formData.type === "custom" && (
        <div className="space-y-2">
          <Label htmlFor="customWebhookUrl">Webhook URL</Label>
          <Input
            id="customWebhookUrl"
            type="url"
            value={formData.config.customWebhookUrl || ""}
            onChange={(e) => updateConfig("customWebhookUrl", e.target.value)}
            placeholder="https://api.example.com/webhooks/alerts"
            required
          />
        </div>
      )}

      <div className="flex items-center space-x-2">
        <Switch
          id="enabled"
          checked={formData.enabled}
          onCheckedChange={(checked) =>
            setFormData((prev) => ({ ...prev, enabled: checked }))
          }
        />
        <Label htmlFor="enabled">Enable channel immediately</Label>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!formData.name}>
          {channel ? "Update" : "Create"} Channel
        </Button>
      </DialogFooter>
    </form>
  );
}
