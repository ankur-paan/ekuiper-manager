"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
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
import { ArrowLeft, Plus, Trash2, Save, Workflow, Code, Settings, RefreshCw, Eye, EyeOff } from "lucide-react";
import { LoadingSpinner, ErrorState, EmptyState } from "@/components/common";
import { toast } from "sonner";

interface SinkAction {
  type: string;
  config: Record<string, string>;
}

interface RuleDetails {
  id?: string;
  sql: string;
  actions: Array<Record<string, unknown>>;
  options?: Record<string, unknown>;
  triggered?: boolean;
}

const SINK_TYPES = [
  { value: "mqtt", label: "MQTT", fields: ["connectionSelector", "server", "topic", "username", "password", "clientid", "qos", "retained", "insecureSkipVerify", "certificationPath", "privateKeyPath"] },
  { value: "log", label: "Log", fields: [] },
  { value: "rest", label: "REST/HTTP", fields: ["url", "method", "headers", "bodyType", "timeout", "insecureSkipVerify"] },
  { value: "memory", label: "Memory", fields: ["topic", "keyField"] },
  { value: "file", label: "File", fields: ["path", "fileType", "delimiter", "hasHeader"] },
  { value: "influx", label: "InfluxDB", fields: ["addr", "measurement", "database", "username", "password", "precision"] },
  { value: "influx2", label: "InfluxDB v2", fields: ["addr", "measurement", "bucket", "org", "token", "precision"] },
  { value: "nop", label: "Nop (No-op)", fields: [] },
];

const PasswordInput = ({ value, onChange, placeholder }: { value: string, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, placeholder?: string }) => {
  const [show, setShow] = React.useState(false);
  return (
    <div className="relative">
      <Input
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="pr-10"
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent text-muted-foreground"
        onClick={() => setShow(!show)}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </Button>
    </div>
  );
};

export default function EditRulePage() {
  const router = useRouter();
  const params = useParams();
  const ruleId = params.id as string;
  const { servers, activeServerId } = useServerStore();
  const activeServer = servers.find((s) => s.id === activeServerId);

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [rule, setRule] = React.useState<RuleDetails | null>(null);
  // Track if we have already loaded the rule to prevent overwriting edits on server refresh
  const [initialLoadComplete, setInitialLoadComplete] = React.useState(false);

  const [sql, setSql] = React.useState("");
  const [actions, setActions] = React.useState<SinkAction[]>([{ type: "log", config: {} }]);
  const [sendMetaToSink, setSendMetaToSink] = React.useState(false);
  const [isEventTime, setIsEventTime] = React.useState(false);
  const [qos, setQos] = React.useState("0");
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [connections, setConnections] = React.useState<any[]>([]);

  // Parse actions from rule data
  const parseActions = (ruleActions: Array<Record<string, unknown>>): SinkAction[] => {
    return ruleActions.map((action) => {
      const type = Object.keys(action)[0];
      const configObj = action[type] as Record<string, unknown>;
      const config: Record<string, string> = {};

      if (configObj && typeof configObj === "object") {
        Object.entries(configObj).forEach(([key, value]) => {
          if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
            config[key] = String(value);
          }
        });
      }

      return { type, config };
    });
  };

  const fetchRule = React.useCallback(async () => {
    // If we've already loaded the rule for this ID, don't re-fetch/overwrite
    if (!activeServer || initialLoadComplete) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/ekuiper/rules/${encodeURIComponent(ruleId)}`, {
        headers: {
          "X-EKuiper-URL": activeServer.url,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch rule: ${response.status}`);
      }

      const data = await response.json();
      console.log("Rule data received:", JSON.stringify(data, null, 2));
      setRule(data);

      // Initialize form fields from rule data
      setSql(data.sql || "");

      // Parse actions
      if (data.actions && Array.isArray(data.actions)) {
        const parsedActions = parseActions(data.actions);
        setActions(parsedActions.length > 0 ? parsedActions : [{ type: "log", config: {} }]);
      }

      // Parse options
      if (data.options) {
        if (data.options.sendMetaToSink) setSendMetaToSink(true);
        if (data.options.isEventTime) setIsEventTime(true);
        if (data.options.qos) setQos(String(data.options.qos));
      }

      setInitialLoadComplete(true);
    } catch (err) {
      console.error("Error fetching rule:", err);
      setError(err instanceof Error ? err.message : "Failed to load rule");
    } finally {
      setLoading(false);
    }
  }, [activeServer, ruleId, initialLoadComplete]);

  React.useEffect(() => {
    fetchRule();

    // Reset load state if ruleId changes (navigating to different rule)
    return () => {
      // We don't reset here because unmount handles it, but if we stay on page and ID changes...
    };
  }, [fetchRule]);

  // Effect to reset initialLoad if ruleID changes drastically (though usually component remounts)
  React.useEffect(() => {
    setInitialLoadComplete(false);
  }, [ruleId]);

  // Fetch connections
  React.useEffect(() => {
    if (!activeServer) return;
    const fetchConnections = async () => {
      try {
        const response = await fetch(`/api/ekuiper/connections`, {
          headers: {
            "X-EKuiper-URL": activeServer.url,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setConnections(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error("Failed to fetch connections:", err);
      }
    };
    fetchConnections();
  }, [activeServer]);

  const addAction = () => {
    setActions([...actions, { type: "log", config: {} }]);
  };

  const removeAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  const updateActionType = (index: number, type: string) => {
    const newActions = [...actions];
    const config: Record<string, string> = {};

    // Prefill server name for MQTT as requested
    if (type === "mqtt") {
      config.server = "sundar pichai";
    }

    newActions[index] = { type, config };
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
    const ruleData: Record<string, unknown> = {
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
      ruleData.options = options;
    }

    return ruleData;
  };

  const handleSubmit = async () => {
    if (!activeServer) {
      setSaveError("No server connected");
      return;
    }

    if (!sql.trim()) {
      setSaveError("SQL query is required");
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      const ruleData = buildRuleJson();

      // Use PUT for upsert (update or create)
      const response = await fetch(`/api/ekuiper/rules/${encodeURIComponent(ruleId)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-EKuiper-URL": activeServer.url,
        },
        body: JSON.stringify(ruleData),
      });

      if (!response.ok) {
        const errData = await response.text();
        throw new Error(errData || `Failed to update rule: ${response.status}`);
      }

      toast.success(`Rule "${ruleId}" updated successfully`);
      router.push(`/rules/${encodeURIComponent(ruleId)}`);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to update rule");
    } finally {
      setSaving(false);
    }
  };

  if (!activeServer) {
    return (
      <AppLayout title={`Edit Rule: ${ruleId}`}>
        <EmptyState
          title="No Server Connected"
          description="Connect to an eKuiper server to edit rules."
        />
      </AppLayout>
    );
  }

  if (loading) {
    return (
      <AppLayout title={`Edit Rule: ${ruleId}`}>
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      </AppLayout>
    );
  }

  if (error || !rule) {
    return (
      <AppLayout title={`Edit Rule: ${ruleId}`}>
        <ErrorState
          title="Error Loading Rule"
          description={error || "Rule not found"}
          onRetry={fetchRule}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout title={`Edit Rule: ${ruleId}`}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push(`/rules/${ruleId}`)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                <Workflow className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Edit Rule</h1>
                <p className="text-sm text-muted-foreground">
                  Modify rule: {ruleId}
                </p>
              </div>
            </div>
          </div>
          <Button variant="outline" size="icon" onClick={fetchRule}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {saveError && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
            {saveError}
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
                    value={ruleId}
                    disabled
                  />
                  <p className="text-xs text-muted-foreground">
                    Rule ID cannot be changed. Create a new rule if you need a different ID.
                  </p>
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

                        {/* Standard Fields */}
                        {sinkDef?.fields.map((field) => {
                          const hasConnectionSelector = !!action.config.connectionSelector;
                          const isAuthField = ["server", "username", "password", "clientid", "certificationPath", "privateKeyPath", "insecureSkipVerify"].includes(field);

                          if (hasConnectionSelector && isAuthField) {
                            return null;
                          }

                          const isPassword = field.toLowerCase().includes("password") || field.toLowerCase().includes("token") || field.toLowerCase().includes("key");
                          const isBoolean = field === "retained" || field === "insecureSkipVerify" || field === "hasHeader" || field === "sendMetaToSink";
                          const isSelect = field === "method" || field === "qos" || field === "precision";

                          if (field === "connectionSelector") {
                            const availableForType = connections.filter(c => c.typ === action.type);

                            return (
                              <div key={field} className="space-y-2">
                                <Label className="capitalize text-blue-700 flex items-center gap-2">
                                  Connection Profile
                                  <span className="text-xs font-normal text-muted-foreground">(Optional)</span>
                                </Label>
                                <Select
                                  value={action.config[field] || "none"}
                                  onValueChange={(v) => {
                                    const val = v === "none" ? "" : v;
                                    updateActionConfig(index, field, val);
                                  }}
                                >
                                  <SelectTrigger className="border-blue-200 focus-visible:ring-blue-500 bg-blue-50/10">
                                    <SelectValue placeholder="Select a connection..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">
                                      <span className="text-muted-foreground italic">No shared connection (Configure manually)</span>
                                    </SelectItem>
                                    {availableForType.map((conn) => (
                                      <SelectItem key={conn.id} value={conn.id}>
                                        <div className="flex flex-col text-left">
                                          <span className="font-medium">{conn.id}</span>
                                          {conn.props?.server && <span className="text-xs text-muted-foreground">{conn.props.server}</span>}
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {action.config[field] && (
                                  <p className="text-xs text-blue-600/80">
                                    Using shared connection profile. Server and credentials are managed centrally.
                                  </p>
                                )}
                              </div>
                            );
                          }

                          return (
                            <div key={field} className="space-y-2">
                              <Label className="capitalize">{field.replace(/([A-Z])/g, ' $1').trim()}</Label>

                              {isBoolean ? (
                                <div className="flex items-center h-10">
                                  <Switch
                                    checked={action.config[field] === "true"}
                                    onCheckedChange={(c) => updateActionConfig(index, field, String(c))}
                                  />
                                  <span className="ml-2 text-sm text-muted-foreground">{action.config[field] === "true" ? "Enabled" : "Disabled"}</span>
                                </div>
                              ) : isSelect ? (
                                <Select
                                  value={action.config[field] || (field === "qos" ? "0" : "")}
                                  onValueChange={(v) => updateActionConfig(index, field, v)}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder={`Select ${field}`} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {field === "method" && ["POST", "PUT", "GET", "DELETE"].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                                    {field === "qos" && ["0", "1", "2"].map(q => <SelectItem key={q} value={q}>{q}</SelectItem>)}
                                    {field === "precision" && ["ms", "s", "us", "ns"].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              ) : isPassword ? (
                                <PasswordInput
                                  value={action.config[field] || ""}
                                  onChange={(e) => updateActionConfig(index, field, e.target.value)}
                                  placeholder={`Enter ${field}...`}
                                />
                              ) : (
                                <Input
                                  type="text"
                                  placeholder={`Enter ${field}...`}
                                  value={action.config[field] || ""}
                                  onChange={(e) => updateActionConfig(index, field, e.target.value)}
                                />
                              )}
                            </div>
                          );
                        })}

                        {/* Custom/Extra Properties */}
                        {Object.keys(action.config)
                          .filter(key => !sinkDef?.fields.includes(key))
                          .map(key => (
                            <div key={key} className="space-y-2 relative group">
                              <div className="flex justify-between">
                                <Label className="capitalize text-blue-600">{key}</Label>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-4 w-4 text-destructive opacity-0 group-hover:opacity-100"
                                  onClick={() => {
                                    const newConfig = { ...action.config };
                                    delete newConfig[key];
                                    const newActions = [...actions];
                                    newActions[index].config = newConfig;
                                    setActions(newActions);
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                              <Input
                                value={action.config[key] || ""}
                                onChange={(e) => updateActionConfig(index, key, e.target.value)}
                              />
                            </div>
                          ))
                        }

                        {/* Add Property Button */}
                        <div className="col-span-full pt-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-muted-foreground dashed-border w-full"
                            onClick={() => {
                              const key = prompt("Enter property name:");
                              if (key) updateActionConfig(index, key, "");
                            }}
                          >
                            <Plus className="mr-2 h-3 w-3" /> Add Custom Property
                          </Button>
                        </div>
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
          <Button variant="outline" onClick={() => router.push(`/rules/${ruleId}`)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? (
              <LoadingSpinner size="sm" className="mr-2" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Update Rule
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
