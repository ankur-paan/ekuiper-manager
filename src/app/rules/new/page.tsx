"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useServerStore } from "@/stores/server-store";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Plus, Trash2, Save, Workflow, Code, Settings } from "lucide-react";
import { LoadingSpinner } from "@/components/common";
import { toast } from "sonner";

interface SinkAction {
  type: string;
  config: Record<string, string>;
}

const SINK_TYPES = [
  { value: "mqtt", label: "MQTT", fields: ["server", "topic"] },
  { value: "log", label: "Log", fields: [] },
  { value: "rest", label: "REST/HTTP", fields: ["url", "method"] },
  { value: "memory", label: "Memory", fields: ["topic"] },
  { value: "file", label: "File", fields: ["path"] },
  { value: "nop", label: "Nop (No-op)", fields: [] },
];

export default function NewRulePage() {
  const router = useRouter();
  const { servers, activeServerId } = useServerStore();
  const activeServer = servers.find((s) => s.id === activeServerId);

  const [ruleId, setRuleId] = React.useState("");
  const [sql, setSql] = React.useState("");
  const [actions, setActions] = React.useState<SinkAction[]>([{ type: "log", config: {} }]);
  const [sendMetaToSink, setSendMetaToSink] = React.useState(false);
  const [isEventTime, setIsEventTime] = React.useState(false);
  const [qos, setQos] = React.useState("0");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const addAction = () => {
    setActions([...actions, { type: "log", config: {} }]);
  };

  const removeAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  const updateActionType = (index: number, type: string) => {
    const newActions = [...actions];
    newActions[index] = { type, config: {} };
    setActions(newActions);
  };

  const updateActionConfig = (index: number, key: string, value: string) => {
    const newActions = [...actions];
    newActions[index] = {
      ...newActions[index],
      config: { ...newActions[index].config, [key]: value },
    };
    setActions(newActions);
  };

  const buildRuleJson = () => {
    const rule: Record<string, unknown> = {
      id: ruleId,
      sql,
      actions: actions.map((action) => {
        if (action.type === "log" || action.type === "nop") {
          return { [action.type]: {} };
        }
        return { [action.type]: action.config };
      }),
    };

    const options: Record<string, unknown> = {};
    if (sendMetaToSink) options.sendMetaToSink = true;
    if (isEventTime) options.isEventTime = true;
    if (qos !== "0") options.qos = parseInt(qos);

    if (Object.keys(options).length > 0) {
      rule.options = options;
    }

    return rule;
  };

  const handleSubmit = async () => {
    if (!activeServer) {
      setError("No server connected");
      return;
    }

    if (!ruleId.trim()) {
      setError("Rule ID is required");
      return;
    }

    if (!sql.trim()) {
      setError("SQL query is required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const ruleData = buildRuleJson();

      const response = await fetch("/api/ekuiper/rules", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-EKuiper-URL": activeServer.url,
        },
        body: JSON.stringify(ruleData),
      });

      if (!response.ok) {
        const errData = await response.text();
        throw new Error(errData || `Failed to create rule: ${response.status}`);
      }

      toast.success(`Rule "${ruleId}" created successfully`);
      router.push("/rules");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create rule");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout title="Create Rule">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/rules")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
              <Workflow className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Create Rule</h1>
              <p className="text-sm text-muted-foreground">
                Define a new stream processing rule
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
            {error}
          </div>
        )}

        <Tabs defaultValue="basic">
          <TabsList>
            <TabsTrigger value="basic">
              <Workflow className="mr-2 h-4 w-4" />
              Basic Info
            </TabsTrigger>
            <TabsTrigger value="actions">
              <Settings className="mr-2 h-4 w-4" />
              Actions
            </TabsTrigger>
            <TabsTrigger value="preview">
              <Code className="mr-2 h-4 w-4" />
              Preview JSON
            </TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4">
            {/* Rule ID */}
            <Card>
              <CardHeader>
                <CardTitle>Rule Configuration</CardTitle>
                <CardDescription>Basic rule information and SQL query</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ruleId">Rule ID</Label>
                  <Input
                    id="ruleId"
                    placeholder="my_rule"
                    value={ruleId}
                    onChange={(e) => setRuleId(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sql">SQL Query</Label>
                  <textarea
                    id="sql"
                    className="w-full h-32 rounded-lg border bg-muted p-4 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="SELECT * FROM my_stream WHERE temperature > 30"
                    value={sql}
                    onChange={(e) => setSql(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Use eKuiper SQL syntax. Reference your streams and apply transformations.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Options */}
            <Card>
              <CardHeader>
                <CardTitle>Rule Options</CardTitle>
                <CardDescription>Advanced processing options</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Send Metadata to Sink</Label>
                    <p className="text-xs text-muted-foreground">
                      Include message metadata in sink output
                    </p>
                  </div>
                  <Switch
                    checked={sendMetaToSink}
                    onCheckedChange={setSendMetaToSink}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Event Time Processing</Label>
                    <p className="text-xs text-muted-foreground">
                      Use event timestamps instead of processing time
                    </p>
                  </div>
                  <Switch
                    checked={isEventTime}
                    onCheckedChange={setIsEventTime}
                  />
                </div>
                <div className="space-y-2">
                  <Label>QoS Level</Label>
                  <Select value={qos} onValueChange={setQos}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">At most once (0)</SelectItem>
                      <SelectItem value="1">At least once (1)</SelectItem>
                      <SelectItem value="2">Exactly once (2)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="actions" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Sink Actions</CardTitle>
                  <CardDescription>
                    Define where processed data should be sent
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={addAction}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Action
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {actions.map((action, index) => {
                  const sinkDef = SINK_TYPES.find((s) => s.value === action.type);
                  return (
                    <div key={index} className="rounded-lg border p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <Label>Action {index + 1}</Label>
                        {actions.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeAction(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Sink Type</Label>
                          <Select
                            value={action.type}
                            onValueChange={(v) => updateActionType(index, v)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {SINK_TYPES.map((type) => (
                                <SelectItem key={type.value} value={type.value}>
                                  {type.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {sinkDef?.fields.map((field) => (
                          <div key={field} className="space-y-2">
                            <Label className="capitalize">{field}</Label>
                            <Input
                              placeholder={`Enter ${field}...`}
                              value={action.config[field] || ""}
                              onChange={(e) =>
                                updateActionConfig(index, field, e.target.value)
                              }
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Rule JSON Preview</CardTitle>
                <CardDescription>
                  The JSON that will be sent to eKuiper
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="rounded-lg bg-muted p-4 text-sm overflow-x-auto">
                  <code>{JSON.stringify(buildRuleJson(), null, 2)}</code>
                </pre>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={() => router.push("/rules")}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? (
              <LoadingSpinner size="sm" className="mr-2" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Create Rule
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
