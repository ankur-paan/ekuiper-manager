"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { SQLEditor } from "@/components/editor/sql-editor";
import { JsonEditor } from "@/components/editor/json-editor";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { 
  Plus, 
  Trash2, 
  Edit, 
  RefreshCw, 
  Workflow,
  Search,
  Play,
  Square,
  Pause,
  RotateCcw,
  Activity,
  Info,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Zap,
  CheckCircle2,
  XCircle,
  AlertTriangle
} from "lucide-react";
import { EKuiperClient, Rule, RuleListItem, RuleStatus, RuleMetrics, RuleOptions } from "@/lib/ekuiper";
import { validateSinkConfig, parseSinkConfig, ConnectionTestResult } from "@/components/common/connection-tester";

interface RulesManagerProps {
  client: EKuiperClient;
}

const RULE_TEMPLATES = [
  {
    name: "Simple Filter",
    rule: {
      id: "filter_rule",
      sql: "SELECT * FROM demo_stream WHERE temperature > 30",
      actions: [{ log: {} }],
    },
  },
  {
    name: "Aggregation",
    rule: {
      id: "agg_rule",
      sql: "SELECT deviceId, AVG(temperature) as avg_temp, COUNT(*) as count FROM demo_stream GROUP BY deviceId, TUMBLINGWINDOW(ss, 10)",
      actions: [{ log: {} }],
    },
  },
  {
    name: "MQTT Output",
    rule: {
      id: "mqtt_rule",
      sql: "SELECT * FROM demo_stream",
      actions: [{
        mqtt: {
          server: "tcp://localhost:1883",
          topic: "result/demo"
        }
      }],
    },
  },
  {
    name: "REST API",
    rule: {
      id: "rest_rule",
      sql: "SELECT * FROM demo_stream WHERE alert = true",
      actions: [{
        rest: {
          url: "http://localhost:8080/api/alerts",
          method: "POST",
          sendSingle: true
        }
      }],
    },
  },
  {
    name: "Multi-Action",
    rule: {
      id: "multi_rule",
      sql: "SELECT * FROM demo_stream",
      actions: [
        { log: {} },
        { memory: { topic: "processed" } }
      ],
    },
  },
];

// RuleOptionsEditor component with form-based editing
function RuleOptionsEditor({
  options,
  onChange,
}: {
  options: RuleOptions;
  onChange: (options: RuleOptions) => void;
}) {
  const updateOption = <K extends keyof RuleOptions>(key: K, value: RuleOptions[K]) => {
    onChange({ ...options, [key]: value });
  };

  const updateRestartStrategy = (key: keyof NonNullable<RuleOptions["restartStrategy"]>, value: number) => {
    onChange({
      ...options,
      restartStrategy: {
        ...options.restartStrategy,
        [key]: value,
      },
    });
  };

  return (
    <div className="space-y-6 overflow-auto max-h-[350px] pr-2">
      {/* Processing Options */}
      <div className="space-y-4">
        <h4 className="font-medium text-sm flex items-center gap-2">
          Processing Options
        </h4>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="isEventTime">Event Time</Label>
              <p className="text-xs text-muted-foreground">Use event time instead of processing time</p>
            </div>
            <Switch
              id="isEventTime"
              checked={options.isEventTime || false}
              onCheckedChange={(checked) => updateOption("isEventTime", checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="sendMetaToSink">Send Meta to Sink</Label>
              <p className="text-xs text-muted-foreground">Include metadata in sink output</p>
            </div>
            <Switch
              id="sendMetaToSink"
              checked={options.sendMetaToSink || false}
              onCheckedChange={(checked) => updateOption("sendMetaToSink", checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="sendError">Send Errors</Label>
              <p className="text-xs text-muted-foreground">Send runtime errors to sinks</p>
            </div>
            <Switch
              id="sendError"
              checked={options.sendError !== false}
              onCheckedChange={(checked) => updateOption("sendError", checked)}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Performance Options */}
      <div className="space-y-4">
        <h4 className="font-medium text-sm">Performance</h4>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="concurrency">Concurrency</Label>
            <Input
              id="concurrency"
              type="number"
              min={1}
              value={options.concurrency || 1}
              onChange={(e) => updateOption("concurrency", parseInt(e.target.value) || 1)}
              placeholder="1"
            />
            <p className="text-xs text-muted-foreground">Instances per plan (default: 1)</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bufferLength">Buffer Length</Label>
            <Input
              id="bufferLength"
              type="number"
              min={1}
              value={options.bufferLength || 1024}
              onChange={(e) => updateOption("bufferLength", parseInt(e.target.value) || 1024)}
              placeholder="1024"
            />
            <p className="text-xs text-muted-foreground">Messages buffered in memory</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="lateTolerance">Late Tolerance (ms)</Label>
            <Input
              id="lateTolerance"
              type="number"
              min={0}
              value={options.lateTolerance || 0}
              onChange={(e) => updateOption("lateTolerance", parseInt(e.target.value) || 0)}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground">Tolerance for late events</p>
          </div>
        </div>
      </div>

      <Separator />

      {/* QoS Options */}
      <div className="space-y-4">
        <h4 className="font-medium text-sm">Quality of Service (QoS)</h4>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="qos">QoS Level</Label>
            <Select
              value={String(options.qos || 0)}
              onValueChange={(v) => updateOption("qos", parseInt(v) as 0 | 1 | 2)}
            >
              <SelectTrigger id="qos">
                <SelectValue placeholder="Select QoS" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">0 - At most once</SelectItem>
                <SelectItem value="1">1 - At least once</SelectItem>
                <SelectItem value="2">2 - Exactly once</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Message delivery guarantee</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="checkpointInterval">Checkpoint Interval (ms)</Label>
            <Input
              id="checkpointInterval"
              type="number"
              min={1000}
              step={1000}
              value={options.checkpointInterval || 300000}
              onChange={(e) => updateOption("checkpointInterval", parseInt(e.target.value) || 300000)}
              placeholder="300000"
              disabled={!options.qos}
            />
            <p className="text-xs text-muted-foreground">State save interval (QoS &gt; 0)</p>
          </div>
        </div>
      </div>

      <Separator />

      {/* Restart Strategy */}
      <div className="space-y-4">
        <h4 className="font-medium text-sm">Restart Strategy</h4>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="restartAttempts">Max Attempts</Label>
            <Input
              id="restartAttempts"
              type="number"
              min={0}
              value={options.restartStrategy?.attempts || 0}
              onChange={(e) => updateRestartStrategy("attempts", parseInt(e.target.value) || 0)}
              placeholder="0 (no restart)"
            />
            <p className="text-xs text-muted-foreground">0 = no auto-restart</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="restartDelay">Delay (ms)</Label>
            <Input
              id="restartDelay"
              type="number"
              min={0}
              value={options.restartStrategy?.delay || 1000}
              onChange={(e) => updateRestartStrategy("delay", parseInt(e.target.value) || 1000)}
              placeholder="1000"
            />
            <p className="text-xs text-muted-foreground">Initial delay before restart</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="restartMultiplier">Multiplier</Label>
            <Input
              id="restartMultiplier"
              type="number"
              min={1}
              step={0.1}
              value={options.restartStrategy?.multiplier || 2}
              onChange={(e) => updateRestartStrategy("multiplier", parseFloat(e.target.value) || 2)}
              placeholder="2"
            />
            <p className="text-xs text-muted-foreground">Delay multiplier per attempt</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="restartMaxDelay">Max Delay (ms)</Label>
            <Input
              id="restartMaxDelay"
              type="number"
              min={0}
              value={options.restartStrategy?.maxDelay || 30000}
              onChange={(e) => updateRestartStrategy("maxDelay", parseInt(e.target.value) || 30000)}
              placeholder="30000"
            />
            <p className="text-xs text-muted-foreground">Maximum delay cap</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="jitterFactor">Jitter Factor</Label>
            <Input
              id="jitterFactor"
              type="number"
              min={0}
              max={1}
              step={0.1}
              value={options.restartStrategy?.jitterFactor || 0}
              onChange={(e) => updateRestartStrategy("jitterFactor", parseFloat(e.target.value) || 0)}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground">Random jitter (0-1) to prevent thundering herd</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// SinkOptionsEditor component for common sink properties
interface SinkOptionsEditorProps {
  sinkType: string;
  config: Record<string, any>;
  onChange: (config: Record<string, any>) => void;
}

function SinkOptionsEditor({ sinkType, config, onChange }: SinkOptionsEditorProps) {
  const updateConfig = (key: string, value: any) => {
    onChange({ ...config, [key]: value });
  };

  const sinkConfig = config[sinkType] || {};
  const commonOptions = {
    sendSingle: config.sendSingle,
    dataTemplate: config.dataTemplate,
    concurrency: config.concurrency,
    bufferLength: config.bufferLength,
    retryInterval: config.retryInterval,
    retryCount: config.retryCount,
    cacheLength: config.cacheLength,
    cacheSaveInterval: config.cacheSaveInterval,
    omitIfEmpty: config.omitIfEmpty,
  };

  const updateSinkConfig = (key: string, value: any) => {
    onChange({ 
      ...config, 
      [sinkType]: { ...sinkConfig, [key]: value } 
    });
  };

  return (
    <div className="space-y-4">
      {/* Sink-specific options */}
      {sinkType === "mqtt" && (
        <div className="space-y-3">
          <h5 className="text-sm font-medium">MQTT Settings</h5>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="mqtt-server">Server *</Label>
              <Input
                id="mqtt-server"
                value={sinkConfig.server || ""}
                onChange={(e) => updateSinkConfig("server", e.target.value)}
                placeholder="tcp://localhost:1883"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="mqtt-topic">Topic *</Label>
              <Input
                id="mqtt-topic"
                value={sinkConfig.topic || ""}
                onChange={(e) => updateSinkConfig("topic", e.target.value)}
                placeholder="result/topic"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="mqtt-qos">QoS</Label>
              <Select
                value={String(sinkConfig.qos || 0)}
                onValueChange={(v) => updateSinkConfig("qos", parseInt(v))}
              >
                <SelectTrigger id="mqtt-qos">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0 - At most once</SelectItem>
                  <SelectItem value="1">1 - At least once</SelectItem>
                  <SelectItem value="2">2 - Exactly once</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="mqtt-clientId">Client ID</Label>
              <Input
                id="mqtt-clientId"
                value={sinkConfig.clientId || ""}
                onChange={(e) => updateSinkConfig("clientId", e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="mqtt-username">Username</Label>
              <Input
                id="mqtt-username"
                value={sinkConfig.username || ""}
                onChange={(e) => updateSinkConfig("username", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="mqtt-password">Password</Label>
              <Input
                id="mqtt-password"
                type="password"
                value={sinkConfig.password || ""}
                onChange={(e) => updateSinkConfig("password", e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between col-span-2">
              <Label htmlFor="mqtt-retained">Retained Message</Label>
              <Switch
                id="mqtt-retained"
                checked={sinkConfig.retained || false}
                onCheckedChange={(checked) => updateSinkConfig("retained", checked)}
              />
            </div>
          </div>
        </div>
      )}

      {sinkType === "rest" && (
        <div className="space-y-3">
          <h5 className="text-sm font-medium">REST Settings</h5>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 col-span-2">
              <Label htmlFor="rest-url">URL *</Label>
              <Input
                id="rest-url"
                value={sinkConfig.url || ""}
                onChange={(e) => updateSinkConfig("url", e.target.value)}
                placeholder="http://localhost:8080/api"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rest-method">Method</Label>
              <Select
                value={sinkConfig.method || "POST"}
                onValueChange={(v) => updateSinkConfig("method", v)}
              >
                <SelectTrigger id="rest-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem>
                  <SelectItem value="PATCH">PATCH</SelectItem>
                  <SelectItem value="DELETE">DELETE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="rest-bodyType">Body Type</Label>
              <Select
                value={sinkConfig.bodyType || "json"}
                onValueChange={(v) => updateSinkConfig("bodyType", v)}
              >
                <SelectTrigger id="rest-bodyType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="form">Form</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="rest-timeout">Timeout (ms)</Label>
              <Input
                id="rest-timeout"
                type="number"
                min={0}
                value={sinkConfig.timeout || 5000}
                onChange={(e) => updateSinkConfig("timeout", parseInt(e.target.value))}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="rest-insecure">Skip TLS Verify</Label>
              <Switch
                id="rest-insecure"
                checked={sinkConfig.insecureSkipVerify || false}
                onCheckedChange={(checked) => updateSinkConfig("insecureSkipVerify", checked)}
              />
            </div>
          </div>
        </div>
      )}

      {sinkType === "memory" && (
        <div className="space-y-3">
          <h5 className="text-sm font-medium">Memory Settings</h5>
          <div className="space-y-1">
            <Label htmlFor="memory-topic">Topic *</Label>
            <Input
              id="memory-topic"
              value={sinkConfig.topic || ""}
              onChange={(e) => updateSinkConfig("topic", e.target.value)}
              placeholder="processed"
            />
          </div>
        </div>
      )}

      {sinkType === "log" && (
        <div className="p-3 bg-muted rounded text-sm text-muted-foreground">
          Log sink outputs to eKuiper logs. No additional configuration needed.
        </div>
      )}

      {sinkType === "nop" && (
        <div className="p-3 bg-muted rounded text-sm text-muted-foreground">
          No-op sink discards all data. Used for testing.
        </div>
      )}

      <Separator />

      {/* Common Sink Options */}
      <div className="space-y-3">
        <h5 className="text-sm font-medium">Common Options</h5>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="sendSingle">Send Single</Label>
              <p className="text-xs text-muted-foreground">Send results one by one</p>
            </div>
            <Switch
              id="sendSingle"
              checked={commonOptions.sendSingle || false}
              onCheckedChange={(checked) => updateConfig("sendSingle", checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="omitIfEmpty">Omit If Empty</Label>
              <p className="text-xs text-muted-foreground">Skip empty results</p>
            </div>
            <Switch
              id="omitIfEmpty"
              checked={commonOptions.omitIfEmpty || false}
              onCheckedChange={(checked) => updateConfig("omitIfEmpty", checked)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="concurrency">Concurrency</Label>
            <Input
              id="concurrency"
              type="number"
              min={1}
              value={commonOptions.concurrency || 1}
              onChange={(e) => updateConfig("concurrency", parseInt(e.target.value) || 1)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="bufferLength">Buffer Length</Label>
            <Input
              id="bufferLength"
              type="number"
              min={1}
              value={commonOptions.bufferLength || 1024}
              onChange={(e) => updateConfig("bufferLength", parseInt(e.target.value) || 1024)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="retryCount">Retry Count</Label>
            <Input
              id="retryCount"
              type="number"
              min={0}
              value={commonOptions.retryCount || 0}
              onChange={(e) => updateConfig("retryCount", parseInt(e.target.value) || 0)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="retryInterval">Retry Interval (ms)</Label>
            <Input
              id="retryInterval"
              type="number"
              min={0}
              value={commonOptions.retryInterval || 1000}
              onChange={(e) => updateConfig("retryInterval", parseInt(e.target.value) || 1000)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="cacheLength">Cache Length</Label>
            <Input
              id="cacheLength"
              type="number"
              min={0}
              value={commonOptions.cacheLength || 1024}
              onChange={(e) => updateConfig("cacheLength", parseInt(e.target.value) || 1024)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="cacheSaveInterval">Cache Save Interval (ms)</Label>
            <Input
              id="cacheSaveInterval"
              type="number"
              min={100}
              value={commonOptions.cacheSaveInterval || 1000}
              onChange={(e) => updateConfig("cacheSaveInterval", parseInt(e.target.value) || 1000)}
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="dataTemplate">Data Template (Go template)</Label>
          <Input
            id="dataTemplate"
            value={commonOptions.dataTemplate || ""}
            onChange={(e) => updateConfig("dataTemplate", e.target.value)}
            placeholder='e.g. {"content":{{json .}}}'
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Use Go template syntax to format output data
          </p>
        </div>
      </div>
    </div>
  );
}

// Action Editor Dialog for individual sinks
function ActionEditorDialog({
  open,
  onOpenChange,
  action,
  index,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: Record<string, any>;
  index: number;
  onSave: (index: number, newAction: Record<string, any>) => void;
}) {
  const [editedAction, setEditedAction] = useState(action);
  const [mode, setMode] = useState<"form" | "json">("form");
  const [jsonValue, setJsonValue] = useState(JSON.stringify(action, null, 2));

  useEffect(() => {
    setEditedAction(action);
    setJsonValue(JSON.stringify(action, null, 2));
  }, [action]);

  const sinkType = Object.keys(action).find(k => 
    ["log", "mqtt", "rest", "memory", "nop", "file", "influx", "redis", "kafka", "neuron"].includes(k)
  ) || Object.keys(action)[0];

  const handleSave = () => {
    try {
      const finalAction = mode === "json" ? JSON.parse(jsonValue) : editedAction;
      onSave(index, finalAction);
      onOpenChange(false);
    } catch {
      toast({
        title: "Invalid JSON",
        description: "Please check the JSON syntax",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit {sinkType?.toUpperCase()} Sink</DialogTitle>
          <DialogDescription>
            Configure sink options for action #{index + 1}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-end gap-2 mb-3">
          <Button
            variant={mode === "form" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setMode("form");
              try {
                setEditedAction(JSON.parse(jsonValue));
              } catch {}
            }}
          >
            Form
          </Button>
          <Button
            variant={mode === "json" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setMode("json");
              setJsonValue(JSON.stringify(editedAction, null, 2));
            }}
          >
            JSON
          </Button>
        </div>

        {mode === "form" ? (
          <SinkOptionsEditor
            sinkType={sinkType || "log"}
            config={editedAction}
            onChange={setEditedAction}
          />
        ) : (
          <JsonEditor
            value={jsonValue}
            onChange={setJsonValue}
            height="300px"
          />
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RuleCard({
  rule,
  status,
  client,
  onStart,
  onStop,
  onRestart,
  onDelete,
  onEdit,
  onViewStatus,
  isExpanded,
  onToggleExpand,
}: {
  rule: RuleListItem;
  status?: RuleMetrics;
  client: EKuiperClient;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onViewStatus: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [ruleDetails, setRuleDetails] = useState<Rule | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const ruleStatus = status?.status || rule.status || "unknown";

  // Fetch full rule details when expanded
  useEffect(() => {
    if (isExpanded && !ruleDetails && !loadingDetails) {
      setLoadingDetails(true);
      client.getRule(rule.id)
        .then(setRuleDetails)
        .catch(() => setRuleDetails(null))
        .finally(() => setLoadingDetails(false));
    }
  }, [isExpanded, rule.id, ruleDetails, loadingDetails, client]);

  // Reset when collapsed
  useEffect(() => {
    if (!isExpanded) {
      setRuleDetails(null);
    }
  }, [isExpanded]);

  const copyId = () => {
    navigator.clipboard.writeText(rule.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusVariant: Record<string, "success" | "destructive" | "secondary" | "outline"> = {
    running: "success",
    stopped: "secondary",
    paused: "outline",
  };

  return (
    <Card className="group">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <Workflow className="h-5 w-5 text-sota-blue" />
            <div className="flex-1 min-w-0">
              <div className="font-medium flex items-center gap-2">
                {rule.id}
                <button
                  onClick={copyId}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {copied ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3 text-muted-foreground" />
                  )}
                </button>
              </div>
              <p className="text-sm text-muted-foreground truncate">
                Status: {ruleStatus}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant={statusVariant[ruleStatus] || "secondary"}>
              {ruleStatus}
            </Badge>

            {/* Control buttons */}
            <div className="flex items-center gap-1">
              {ruleStatus === "running" ? (
                <Button variant="ghost" size="sm" onClick={onStop} title="Stop">
                  <Square className="h-4 w-4" />
                </Button>
              ) : (
                <Button variant="ghost" size="sm" onClick={onStart} title="Start">
                  <Play className="h-4 w-4" />
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={onRestart} title="Restart">
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={onViewStatus} title="View Status">
                <Activity className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={onEdit} title="Edit">
                <Edit className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onDelete} 
                title="Delete"
                className="text-red-500 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={onToggleExpand}>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Expanded details - shows rule details and status metrics */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t space-y-4">
            {loadingDetails ? (
              <div className="flex items-center justify-center py-4">
                <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : ruleDetails ? (
              <>
                {/* SQL */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">SQL Query</label>
                  <pre className="text-sm bg-muted p-2 rounded mt-1 overflow-x-auto">
                    {ruleDetails.sql}
                  </pre>
                </div>

                {/* Actions Summary */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Actions ({ruleDetails.actions?.length || 0})</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {ruleDetails.actions?.map((action, idx) => {
                      const sinkType = Object.keys(action)[0];
                      return (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {sinkType}
                        </Badge>
                      );
                    })}
                  </div>
                </div>

                {/* Options */}
                {ruleDetails.options && Object.keys(ruleDetails.options).length > 0 && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Rule Options</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-1">
                      {ruleDetails.options.qos !== undefined && ruleDetails.options.qos > 0 && (
                        <div className="bg-muted rounded p-2">
                          <span className="text-xs text-muted-foreground">QoS</span>
                          <p className="text-sm font-medium">{ruleDetails.options.qos}</p>
                        </div>
                      )}
                      {ruleDetails.options.concurrency !== undefined && ruleDetails.options.concurrency > 1 && (
                        <div className="bg-muted rounded p-2">
                          <span className="text-xs text-muted-foreground">Concurrency</span>
                          <p className="text-sm font-medium">{ruleDetails.options.concurrency}</p>
                        </div>
                      )}
                      {ruleDetails.options.bufferLength !== undefined && ruleDetails.options.bufferLength !== 1024 && (
                        <div className="bg-muted rounded p-2">
                          <span className="text-xs text-muted-foreground">Buffer Length</span>
                          <p className="text-sm font-medium">{ruleDetails.options.bufferLength}</p>
                        </div>
                      )}
                      {ruleDetails.options.checkpointInterval !== undefined && (
                        <div className="bg-muted rounded p-2">
                          <span className="text-xs text-muted-foreground">Checkpoint</span>
                          <p className="text-sm font-medium">{ruleDetails.options.checkpointInterval}ms</p>
                        </div>
                      )}
                      {ruleDetails.options.isEventTime && (
                        <div className="bg-muted rounded p-2">
                          <span className="text-xs text-muted-foreground">Event Time</span>
                          <p className="text-sm font-medium">
                            <CheckCircle2 className="h-4 w-4 text-green-500 inline" />
                          </p>
                        </div>
                      )}
                      {ruleDetails.options.sendMetaToSink && (
                        <div className="bg-muted rounded p-2">
                          <span className="text-xs text-muted-foreground">Send Meta</span>
                          <p className="text-sm font-medium">
                            <CheckCircle2 className="h-4 w-4 text-green-500 inline" />
                          </p>
                        </div>
                      )}
                      {ruleDetails.options.lateTolerance !== undefined && ruleDetails.options.lateTolerance > 0 && (
                        <div className="bg-muted rounded p-2">
                          <span className="text-xs text-muted-foreground">Late Tolerance</span>
                          <p className="text-sm font-medium">{ruleDetails.options.lateTolerance}ms</p>
                        </div>
                      )}
                    </div>
                    
                    {/* Restart Strategy */}
                    {ruleDetails.options.restartStrategy && ruleDetails.options.restartStrategy.attempts && ruleDetails.options.restartStrategy.attempts > 0 && (
                      <div className="mt-2">
                        <span className="text-xs text-muted-foreground">Restart Strategy</span>
                        <div className="flex flex-wrap gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">
                            {ruleDetails.options.restartStrategy.attempts} attempts
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {ruleDetails.options.restartStrategy.delay || 1000}ms delay
                          </Badge>
                          {ruleDetails.options.restartStrategy.multiplier && (
                            <Badge variant="secondary" className="text-xs">
                              {ruleDetails.options.restartStrategy.multiplier}x multiplier
                            </Badge>
                          )}
                          {ruleDetails.options.restartStrategy.jitterFactor && (
                            <Badge variant="secondary" className="text-xs">
                              {ruleDetails.options.restartStrategy.jitterFactor} jitter
                            </Badge>
                          )}
                          {ruleDetails.options.restartStrategy.maxDelay && (
                            <Badge variant="secondary" className="text-xs">
                              max {ruleDetails.options.restartStrategy.maxDelay}ms
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Status Metrics */}
                {status && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status Metrics</label>
                    <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto max-h-32">
                      {JSON.stringify(status, null, 2)}
                    </pre>
                  </div>
                )}
              </>
            ) : status ? (
              <div>
                <label className="text-xs text-muted-foreground">Status Metrics</label>
                <pre className="text-sm bg-muted p-2 rounded mt-1 overflow-x-auto max-h-48">
                  {JSON.stringify(status, null, 2)}
                </pre>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No details available</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CreateRuleDialog({
  open,
  onOpenChange,
  onSubmit,
  editRule,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (rule: Rule) => void;
  editRule?: Rule | null;
}) {
  const [activeTab, setActiveTab] = useState<"sql" | "actions" | "options">("sql");
  const [ruleId, setRuleId] = useState(editRule?.id || "new_rule");
  const [sql, setSql] = useState(editRule?.sql || "SELECT * FROM demo_stream");
  const [actionsJson, setActionsJson] = useState(
    JSON.stringify(editRule?.actions || [{ log: {} }], null, 2)
  );
  const [options, setOptions] = useState<RuleOptions>(editRule?.options || {});
  const [optionsMode, setOptionsMode] = useState<"form" | "json">("form");
  const [optionsJson, setOptionsJson] = useState(
    JSON.stringify(editRule?.options || {}, null, 2)
  );
  const [sinkTestResults, setSinkTestResults] = useState<Record<number, ConnectionTestResult>>({});
  const [testingAll, setTestingAll] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  // Action Editor state
  const [editingActionIndex, setEditingActionIndex] = useState<number | null>(null);
  const [editingAction, setEditingAction] = useState<Record<string, any> | null>(null);

  // Reset form when editRule changes (e.g., when editing a different rule)
  useEffect(() => {
    if (editRule) {
      setRuleId(editRule.id);
      setSql(editRule.sql || "SELECT * FROM demo_stream");
      setActionsJson(JSON.stringify(editRule.actions || [{ log: {} }], null, 2));
      setOptions(editRule.options || {});
      setOptionsJson(JSON.stringify(editRule.options || {}, null, 2));
      setSinkTestResults({});
      setActiveTab("sql");
    } else {
      // Reset to defaults for new rule
      setRuleId("new_rule");
      setSql("SELECT * FROM demo_stream");
      setActionsJson(JSON.stringify([{ log: {} }], null, 2));
      setOptions({});
      setOptionsJson(JSON.stringify({}, null, 2));
      setSinkTestResults({});
      setActiveTab("sql");
    }
  }, [editRule]);

  // Sync options between form and JSON modes
  const handleOptionsChange = (newOptions: RuleOptions) => {
    setOptions(newOptions);
    setOptionsJson(JSON.stringify(newOptions, null, 2));
  };

  const handleOptionsJsonChange = (json: string) => {
    setOptionsJson(json);
    try {
      const parsed = JSON.parse(json);
      setOptions(parsed);
    } catch {
      // Invalid JSON, don't update options object
    }
  };

  // Handle action edit
  const handleEditAction = (index: number) => {
    try {
      const actions = JSON.parse(actionsJson);
      if (actions[index]) {
        setEditingActionIndex(index);
        setEditingAction(actions[index]);
      }
    } catch {
      // Invalid JSON
    }
  };

  const handleSaveAction = (index: number, newAction: Record<string, any>) => {
    try {
      const actions = JSON.parse(actionsJson);
      actions[index] = newAction;
      setActionsJson(JSON.stringify(actions, null, 2));
      setSinkTestResults({});
    } catch {
      // Invalid JSON
    }
    setEditingActionIndex(null);
    setEditingAction(null);
  };

  const handleAddAction = (type: string) => {
    try {
      const actions = JSON.parse(actionsJson);
      const newAction: Record<string, any> = {};
      
      switch (type) {
        case "log":
          newAction.log = {};
          break;
        case "mqtt":
          newAction.mqtt = { server: "tcp://localhost:1883", topic: "result" };
          break;
        case "rest":
          newAction.rest = { url: "http://localhost:8080/api", method: "POST" };
          break;
        case "memory":
          newAction.memory = { topic: "processed" };
          break;
        case "nop":
          newAction.nop = {};
          break;
        default:
          newAction[type] = {};
      }
      
      actions.push(newAction);
      setActionsJson(JSON.stringify(actions, null, 2));
      setSinkTestResults({});
    } catch {
      // Invalid JSON
    }
  };

  const handleDeleteAction = (index: number) => {
    try {
      const actions = JSON.parse(actionsJson);
      actions.splice(index, 1);
      setActionsJson(JSON.stringify(actions, null, 2));
      setSinkTestResults({});
    } catch {
      // Invalid JSON
    }
  };

  const selectTemplate = (template: typeof RULE_TEMPLATES[0]) => {
    setRuleId(template.rule.id);
    setSql(template.rule.sql);
    setActionsJson(JSON.stringify(template.rule.actions, null, 2));
    setSinkTestResults({});
  };

  // Test all sinks
  const testAllSinks = async () => {
    setTestingAll(true);
    setSinkTestResults({});
    
    try {
      const actions = JSON.parse(actionsJson);
      if (!Array.isArray(actions)) {
        toast({
          title: "Invalid actions",
          description: "Actions must be an array",
          variant: "destructive",
        });
        setTestingAll(false);
        return;
      }

      const results: Record<number, ConnectionTestResult> = {};
      
      for (let i = 0; i < actions.length; i++) {
        const parsed = parseSinkConfig(actions[i]);
        if (parsed) {
          // Add small delay for UX
          await new Promise(resolve => setTimeout(resolve, 200));
          results[i] = validateSinkConfig(parsed.type, parsed.config);
        }
      }

      setSinkTestResults(results);
    } catch (error) {
      toast({
        title: "Invalid JSON",
        description: "Please check your actions JSON syntax",
        variant: "destructive",
      });
    }
    
    setTestingAll(false);
  };

  // Check if all sinks are valid
  const allSinksValid = () => {
    const results = Object.values(sinkTestResults);
    return results.length > 0 && results.every(r => r.success);
  };

  // Get parsed actions for display
  const getParsedActions = (): Array<{ index: number; type: string; config: Record<string, any> }> => {
    try {
      const actions = JSON.parse(actionsJson);
      if (!Array.isArray(actions)) return [];
      return actions.map((action, index) => {
        const parsed = parseSinkConfig(action);
        return {
          index,
          type: parsed?.type || "unknown",
          config: parsed?.config || {},
        };
      });
    } catch {
      return [];
    }
  };

  const handleSubmit = () => {
    try {
      const actions = JSON.parse(actionsJson);
      
      // Use options from state (synced between form and JSON modes)
      // Filter out empty/default values
      const cleanOptions: RuleOptions = {};
      if (options.isEventTime) cleanOptions.isEventTime = options.isEventTime;
      if (options.lateTolerance && options.lateTolerance > 0) cleanOptions.lateTolerance = options.lateTolerance;
      if (options.concurrency && options.concurrency > 1) cleanOptions.concurrency = options.concurrency;
      if (options.bufferLength && options.bufferLength !== 1024) cleanOptions.bufferLength = options.bufferLength;
      if (options.sendMetaToSink) cleanOptions.sendMetaToSink = options.sendMetaToSink;
      if (options.sendError === false) cleanOptions.sendError = false;
      if (options.qos && options.qos > 0) cleanOptions.qos = options.qos;
      if (options.checkpointInterval && options.checkpointInterval !== 300000) cleanOptions.checkpointInterval = options.checkpointInterval;
      if (options.restartStrategy && options.restartStrategy.attempts && options.restartStrategy.attempts > 0) {
        cleanOptions.restartStrategy = options.restartStrategy;
      }

      const rule: Rule = {
        id: ruleId,
        sql,
        actions,
        options: Object.keys(cleanOptions).length > 0 ? cleanOptions : undefined,
      };

      onSubmit(rule);
    } catch (error) {
      toast({
        title: "Invalid JSON",
        description: "Please check your actions JSON",
        variant: "destructive",
      });
    }
  };

  return (
  <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh]">
        <DialogHeader>
          <DialogTitle>{editRule ? "Edit Rule" : "Create Rule"}</DialogTitle>
          <DialogDescription>
            Define your rule SQL and actions
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Templates */}
          {!editRule && (
            <div className="flex gap-2 flex-wrap">
              {RULE_TEMPLATES.map((template) => (
                <Button
                  key={template.name}
                  variant="outline"
                  size="sm"
                  onClick={() => selectTemplate(template)}
                >
                  {template.name}
                </Button>
              ))}
            </div>
          )}

          {/* Rule ID */}
          <div>
            <label className="text-sm font-medium mb-1 block">Rule ID</label>
            <Input
              value={ruleId}
              onChange={(e) => setRuleId(e.target.value)}
              placeholder="my_rule"
              disabled={!!editRule}
            />
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col">
            <TabsList>
              <TabsTrigger value="sql">SQL</TabsTrigger>
              <TabsTrigger value="actions">Actions</TabsTrigger>
              <TabsTrigger value="options">Options</TabsTrigger>
            </TabsList>

            <TabsContent value="sql" className="flex-1 min-h-0">
              <SQLEditor
                value={sql}
                onChange={setSql}
                height="250px"
              />
            </TabsContent>

            <TabsContent value="actions" className="flex-1 min-h-0 flex flex-col gap-3 overflow-auto">
              {/* Action List with Edit/Delete buttons */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Actions ({getParsedActions().length})</span>
                  <div className="flex gap-1">
                    <Select onValueChange={handleAddAction}>
                      <SelectTrigger className="w-32 h-8">
                        <SelectValue placeholder="Add Sink" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="log">Log</SelectItem>
                        <SelectItem value="mqtt">MQTT</SelectItem>
                        <SelectItem value="rest">REST</SelectItem>
                        <SelectItem value="memory">Memory</SelectItem>
                        <SelectItem value="nop">Nop</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {getParsedActions().map(({ index, type }) => {
                  const result = sinkTestResults[index];
                  return (
                    <div
                      key={index}
                      className={cn(
                        "flex items-center justify-between p-3 rounded border",
                        result?.success === true && "border-green-500/50 bg-green-500/5",
                        result?.success === false && "border-red-500/50 bg-red-500/5",
                        !result && "border-border"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{type.toUpperCase()}</Badge>
                        <span className="text-sm text-muted-foreground">Action #{index + 1}</span>
                        {result && (
                          result.success ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <span className="text-red-500 text-xs flex items-center gap-1">
                              <XCircle className="h-4 w-4" />
                              {result.message}
                            </span>
                          )
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditAction(index)}
                          title="Edit Sink Options"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteAction(index)}
                          className="text-red-500 hover:text-red-600"
                          title="Delete Action"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}

                {getParsedActions().length === 0 && (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    No actions defined. Add a sink to get started.
                  </div>
                )}
              </div>

              <Separator />

              {/* JSON Editor for advanced editing */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">JSON Editor</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={testAllSinks}
                    disabled={testingAll}
                  >
                    {testingAll ? "Testing..." : "Test All Sinks"}
                  </Button>
                </div>
                <JsonEditor
                  value={actionsJson}
                  onChange={(value) => {
                    setActionsJson(value);
                    setSinkTestResults({});
                  }}
                  height="150px"
                />
                <p className="text-xs text-muted-foreground">
                  Edit raw JSON or use the visual editor above
                </p>
              </div>
            </TabsContent>

            <TabsContent value="options" className="flex-1 min-h-0 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">Rule Options</span>
                <div className="flex items-center gap-2">
                  <Button
                    variant={optionsMode === "form" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setOptionsMode("form")}
                  >
                    Form
                  </Button>
                  <Button
                    variant={optionsMode === "json" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setOptionsMode("json")}
                  >
                    JSON
                  </Button>
                </div>
              </div>
              
              {optionsMode === "form" ? (
                <RuleOptionsEditor
                  options={options}
                  onChange={handleOptionsChange}
                />
              ) : (
                <div className="flex-1">
                  <JsonEditor
                    value={optionsJson}
                    onChange={handleOptionsJsonChange}
                    height="300px"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Edit raw JSON for advanced options
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {Object.keys(sinkTestResults).length > 0 ? (
              allSinksValid() ? (
                <span className="text-green-500 flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" />
                  All sinks verified
                </span>
              ) : (
                <span className="text-red-500 flex items-center gap-1">
                  <XCircle className="h-4 w-4" />
                  Fix sink configuration issues
                </span>
              )
            ) : (
              <span>Test sink configurations before creating</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              type="button"
              onClick={handleSubmit}
              disabled={isCreating}
            >
              {isCreating ? "Processing..." : editRule ? "Update" : "Create"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Action Editor Dialog - Must be outside the main Dialog */}
    {editingActionIndex !== null && editingAction !== null && (
      <ActionEditorDialog
        open={true}
        onOpenChange={(open) => {
          if (!open) {
            setEditingActionIndex(null);
            setEditingAction(null);
          }
        }}
        action={editingAction}
        index={editingActionIndex}
        onSave={handleSaveAction}
      />
    )}
  </>
  );
}

function StatusDialog({
  open,
  onOpenChange,
  ruleId,
  status,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ruleId: string;
  status: RuleMetrics | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Rule Status: {ruleId}</DialogTitle>
        </DialogHeader>
        <div className="bg-muted p-4 rounded-lg overflow-auto max-h-[400px]">
          <pre className="text-sm">
            {status ? JSON.stringify(status, null, 2) : "Loading..."}
          </pre>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function RulesManager({ client }: RulesManagerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editRule, setEditRule] = useState<Rule | null>(null);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<RuleMetrics | null>(null);
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());

  const queryClient = useQueryClient();

  // Fetch rules - with retry and error handling
  const { data: rules = [], isLoading, error: rulesError, refetch } = useQuery({
    queryKey: ["rules"],
    queryFn: () => client.listRules(),
    retry: 1,
    retryDelay: 1000,
    refetchOnWindowFocus: false,
    staleTime: 30000,
  });

  // Fetch statuses for all rules - only when connected
  const { data: statuses = {} } = useQuery({
    queryKey: ["rule-statuses", rules.map((r: RuleListItem) => r.id)],
    queryFn: async () => {
      const statusMap: Record<string, RuleMetrics> = {};
      await Promise.all(
        rules.map(async (rule: RuleListItem) => {
          try {
            statusMap[rule.id] = await client.getRuleStatus(rule.id);
          } catch {
            // Ignore errors
          }
        })
      );
      return statusMap;
    },
    enabled: rules.length > 0 && !rulesError,
    refetchInterval: rules.length > 0 && !rulesError ? 5000 : false,
  });

  // Create rule mutation
  const createRule = useMutation({
    mutationFn: (rule: Rule) => client.createRule(rule),
    onSuccess: () => {
      toast({ title: "Rule created successfully" });
      queryClient.invalidateQueries({ queryKey: ["rules"] });
      setCreateDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create rule",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update rule mutation
  const updateRule = useMutation({
    mutationFn: ({ id, rule }: { id: string; rule: Rule }) => {
      // eKuiper API requires the rule body WITHOUT the id (id is in URL path)
      const { id: _ruleId, ...ruleWithoutId } = rule;
      return client.updateRule(id, ruleWithoutId);
    },
    onSuccess: () => {
      toast({ title: "Rule updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["rules"] });
      setCreateDialogOpen(false);
      setEditRule(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update rule",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete rule mutation
  const deleteRule = useMutation({
    mutationFn: (id: string) => client.deleteRule(id),
    onSuccess: () => {
      toast({ title: "Rule deleted" });
      queryClient.invalidateQueries({ queryKey: ["rules"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete rule",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Control mutations
  const startRule = useMutation({
    mutationFn: (id: string) => client.startRule(id),
    onSuccess: (_, id) => {
      toast({ title: `Rule ${id} started` });
      queryClient.invalidateQueries({ queryKey: ["rule-statuses"] });
    },
  });

  const stopRule = useMutation({
    mutationFn: (id: string) => client.stopRule(id),
    onSuccess: (_, id) => {
      toast({ title: `Rule ${id} stopped` });
      queryClient.invalidateQueries({ queryKey: ["rule-statuses"] });
    },
  });

  const restartRule = useMutation({
    mutationFn: (id: string) => client.restartRule(id),
    onSuccess: (_, id) => {
      toast({ title: `Rule ${id} restarted` });
      queryClient.invalidateQueries({ queryKey: ["rule-statuses"] });
    },
  });

  const handleSubmit = (rule: Rule) => {
    console.log('[RulesManager] handleSubmit called', { editRule, ruleId: rule.id });
    if (editRule) {
      console.log('[RulesManager] Updating rule:', editRule.id);
      updateRule.mutate({ id: editRule.id, rule });
    } else {
      console.log('[RulesManager] Creating new rule:', rule.id);
      createRule.mutate(rule);
    }
  };

  const handleEdit = async (ruleId: string) => {
    try {
      const fullRule = await client.getRule(ruleId);
      setEditRule(fullRule);
      setCreateDialogOpen(true);
    } catch (error) {
      toast({
        title: "Failed to load rule",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleViewStatus = async (ruleId: string) => {
    setSelectedRuleId(ruleId);
    setSelectedStatus(null);
    setStatusDialogOpen(true);

    try {
      const status = await client.getRuleStatus(ruleId);
      setSelectedStatus(status);
    } catch (error) {
      setSelectedStatus({ status: "error" } as RuleMetrics);
    }
  };

  const toggleExpand = (ruleId: string) => {
    setExpandedRules((prev) => {
      const next = new Set(prev);
      if (next.has(ruleId)) {
        next.delete(ruleId);
      } else {
        next.add(ruleId);
      }
      return next;
    });
  };

  const filteredRules = rules.filter((r: RuleListItem) => {
    if (!r || typeof r !== 'object') return false;
    const id = r.id || '';
    return id.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Count by status
  const runningCount = Object.values(statuses).filter((s: RuleMetrics) => s?.status === "running").length;
  const stoppedCount = rules.length - runningCount;

  // Show connection error state
  if (rulesError && !isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8">
        <Card className="max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <Workflow className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle>Connection Failed</CardTitle>
            <CardDescription>
              Unable to connect to the eKuiper server
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 bg-red-50 rounded-lg text-sm text-red-700">
              {(rulesError as Error)?.message || "Could not reach the eKuiper server. Please check your connection settings."}
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => refetch()}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Rules</h2>
          <p className="text-sm text-muted-foreground">
            {rules.length} total • {runningCount} running • {stoppedCount} stopped
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button onClick={() => {
            setEditRule(null);
            setCreateDialogOpen(true);
          }}>
            <Plus className="h-4 w-4 mr-1" />
            New Rule
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search rules..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Rules List */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredRules.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchTerm ? "No rules match your search" : "No rules created yet"}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredRules.map((rule: RuleListItem) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                status={(statuses as Record<string, RuleMetrics>)[rule.id]}
                client={client}
                onStart={() => startRule.mutate(rule.id)}
                onStop={() => stopRule.mutate(rule.id)}
                onRestart={() => restartRule.mutate(rule.id)}
                onDelete={() => deleteRule.mutate(rule.id)}
                onEdit={() => handleEdit(rule.id)}
                onViewStatus={() => handleViewStatus(rule.id)}
                isExpanded={expandedRules.has(rule.id)}
                onToggleExpand={() => toggleExpand(rule.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <CreateRuleDialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          console.log('[RulesManager] Dialog onOpenChange:', open, 'current editRule:', editRule?.id);
          setCreateDialogOpen(open);
          if (!open) setEditRule(null);
        }}
        onSubmit={handleSubmit}
        editRule={editRule}
      />

      {/* Status Dialog */}
      <StatusDialog
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
        ruleId={selectedRuleId || ""}
        status={selectedStatus}
      />
    </div>
  );
}
