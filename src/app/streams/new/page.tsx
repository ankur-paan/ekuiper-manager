"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useServerStore } from "@/stores/server-store";
import { ekuiperClient } from "@/lib/ekuiper/client";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowLeft, Plus, Trash2, Save, Database, Code, Link2, Settings2, Info, RefreshCw, Loader2, Sparkles, Bot } from "lucide-react";
import { LoadingSpinner } from "@/components/common";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface StreamField {
  name: string;
  type: string;
}

const DATA_TYPES = [
  "bigint",
  "float",
  "string",
  "boolean",
  "datetime",
  "bytea",
  "array",
  "struct",
];

const SOURCE_TYPES = [
  { value: "mqtt", label: "MQTT", description: "Subscribe to MQTT topics" },
  { value: "httppull", label: "HTTP Pull", description: "Pull data from HTTP endpoints" },
  { value: "httppush", label: "HTTP Push", description: "Receive HTTP push data" },
  { value: "memory", label: "Memory", description: "In-memory topic for rule pipelines" },
  { value: "neuron", label: "Neuron", description: "Neuron industrial gateway" },
  { value: "edgex", label: "EdgeX", description: "EdgeX Foundry message bus" },
  { value: "file", label: "File", description: "Read from files" },
  { value: "redis", label: "Redis", description: "Redis pub/sub" },
  { value: "simulator", label: "Simulator", description: "Generate mock data for testing" },
];

const FORMAT_TYPES = [
  { value: "json", label: "JSON", description: "JavaScript Object Notation" },
  { value: "binary", label: "Binary", description: "Raw binary data" },
  { value: "protobuf", label: "Protobuf", description: "Protocol Buffers" },
  { value: "delimited", label: "Delimited", description: "CSV or custom delimiter" },
];

export default function NewStreamPage() {
  const router = useRouter();
  const { servers, activeServerId } = useServerStore();
  const activeServer = servers.find((s) => s.id === activeServerId);

  // Mode: form or raw SQL
  const [mode, setMode] = React.useState<"form" | "sql">("form");

  // Basic fields
  const [name, setName] = React.useState("");
  const [sourceType, setSourceType] = React.useState("mqtt");
  const [fields, setFields] = React.useState<StreamField[]>([]);
  const [datasource, setDatasource] = React.useState("");
  const [format, setFormat] = React.useState("json");
  const [sqlStatement, setSqlStatement] = React.useState("");

  // Connection & Configuration
  const [useConfKey, setUseConfKey] = React.useState(false);
  const [confKey, setConfKey] = React.useState("");
  const [useSharedConnection, setUseSharedConnection] = React.useState(false);
  const [sharedConnection, setSharedConnection] = React.useState("");

  // Available configurations and connections (fetched from server)
  const [confKeys, setConfKeys] = React.useState<string[]>([]);
  const [sharedConnections, setSharedConnections] = React.useState<{ id: string; typ: string }[]>([]);
  const [loadingConfigs, setLoadingConfigs] = React.useState(false);

  // State
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // AI State
  const [aiPrompt, setAiPrompt] = React.useState("");
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [aiModels, setAiModels] = React.useState<{ id: string; name: string }[]>([]);
  const [selectedModel, setSelectedModel] = React.useState("gemini-1.5-flash");

  // Fetch AI Models on mount
  React.useEffect(() => {
    fetch('/api/ai/models')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setAiModels(data);
          const flash = data.find(m => m.id.includes('flash')) || data[0];
          if (flash) setSelectedModel(flash.id);
        }
      })
      .catch(err => console.error("Failed to fetch AI models:", err));
  }, []);

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) {
      toast.error("Please provide a description");
      return;
    }

    setIsGenerating(true);
    try {
      const res = await fetch('/api/ai/stream-gen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: aiPrompt,
          modelName: selectedModel
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Generation failed");
      }

      const data = await res.json();

      // Map AI response to state
      if (data.name) setName(data.name);
      if (data.sourceType) setSourceType(data.sourceType);
      if (data.datasource) setDatasource(data.datasource);
      if (data.format) setFormat(data.format);
      if (Array.isArray(data.fields)) {
        setFields(data.fields);
      }

      setIsDialogOpen(false);
      setAiPrompt("");
      toast.success("AI Generation Success: Form populated!");
    } catch (err: any) {
      toast.error(`AI Error: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Fetch available configuration keys for the selected source type
  const fetchConfKeys = React.useCallback(async () => {
    if (!activeServer?.url) return;
    setLoadingConfigs(true);
    ekuiperClient.setBaseUrl(activeServer.url);

    try {
      // Fetch conf keys for the selected source type
      const keys = await ekuiperClient.listConfKeys("sources", sourceType);
      setConfKeys(Array.isArray(keys) ? keys : []);
    } catch {
      setConfKeys([]);
    }

    try {
      // Fetch shared connections
      const connections = await ekuiperClient.listConnections();
      // Filter connections that match the source type
      const filtered = Array.isArray(connections)
        ? connections.filter((c: any) => c.typ === sourceType || !c.typ)
        : [];
      setSharedConnections(filtered);
    } catch {
      setSharedConnections([]);
    }

    setLoadingConfigs(false);
  }, [activeServer?.url, sourceType]);

  React.useEffect(() => {
    fetchConfKeys();
  }, [fetchConfKeys]);

  const addField = () => {
    setFields([...fields, { name: "", type: "string" }]);
  };

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const updateField = (index: number, key: keyof StreamField, value: string) => {
    const newFields = [...fields];
    newFields[index] = { ...newFields[index], [key]: value };
    setFields(newFields);
  };

  const generateSQL = (): string => {
    // eKuiper REQUIRES parentheses even for schemaless streams
    const schemaStr = fields.length > 0
      ? `(${fields.map((f) => `${f.name} ${f.type}`).join(", ")})`
      : "()";

    const optionsArr = [];
    optionsArr.push(`TYPE = "${sourceType}"`);
    if (datasource) optionsArr.push(`DATASOURCE = "${datasource}"`);
    if (format) optionsArr.push(`FORMAT = "${format}"`);

    // Add CONF_KEY if using a configuration template
    if (useConfKey && confKey) {
      optionsArr.push(`CONF_KEY = "${confKey}"`);
    }

    // For shared connections, use CONF_KEY with SHARED = "true"
    // The connection ID becomes the CONF_KEY value
    if (useSharedConnection && sharedConnection) {
      optionsArr.push(`CONF_KEY = "${sharedConnection}"`);
      optionsArr.push(`SHARED = "true"`);
    }

    return `CREATE STREAM ${name} ${schemaStr} WITH (${optionsArr.join(", ")});`;
  };

  const handleSubmit = async () => {
    if (!activeServer) {
      setError("No server connected");
      return;
    }

    if (!name.trim()) {
      setError("Stream name is required");
      return;
    }

    const sql = mode === "sql" ? sqlStatement : generateSQL();

    if (!sql.trim()) {
      setError("Please provide a valid SQL statement");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/ekuiper/streams", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-EKuiper-URL": activeServer.url,
        },
        body: JSON.stringify({ sql }),
      });

      if (!response.ok) {
        const errData = await response.text();
        throw new Error(errData || `Failed to create stream: ${response.status}`);
      }

      toast.success("Stream created successfully");
      router.push("/streams");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create stream");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout title="Create Stream">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push("/streams")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                <Database className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Create Stream</h1>
                <p className="text-sm text-muted-foreground">
                  Define a new data source stream
                </p>
              </div>
            </div>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 border-purple-500/50 hover:bg-purple-50 hover:text-purple-600 transition-all shadow-sm">
                <Sparkles className="h-4 w-4 text-purple-600" />
                Generate with AI
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 rounded-lg bg-purple-100">
                    <Bot className="h-5 w-5 text-purple-600" />
                  </div>
                  <DialogTitle className="text-xl">AI Stream Architect</DialogTitle>
                </div>
                <DialogDescription>
                  Describe the source data you want to ingest. AI will automatically determine fields, source types, and formats.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>What data are you collecting?</Label>
                  <Textarea
                    placeholder="e.g. A temperature and humidity sensor sending data over MQTT topic 'factory/sensors/01' every second."
                    className="h-32 resize-none"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                  />
                </div>

                {aiModels.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Intelligence Model</Label>
                    <Select value={selectedModel} onValueChange={setSelectedModel}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {aiModels.map(m => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button
                  onClick={handleAiGenerate}
                  disabled={isGenerating}
                  className="bg-purple-600 hover:bg-purple-700 text-white gap-2 px-6"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Designing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Generate Definition
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
            {error}
          </div>
        )}

        <Tabs value={mode} onValueChange={(v) => setMode(v as "form" | "sql")}>
          <TabsList>
            <TabsTrigger value="form">
              <Database className="mr-2 h-4 w-4" />
              Form Builder
            </TabsTrigger>
            <TabsTrigger value="sql">
              <Code className="mr-2 h-4 w-4" />
              SQL Editor
            </TabsTrigger>
          </TabsList>

          <TabsContent value="form" className="space-y-4">
            {/* Basic Info */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>Stream name and source type</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Stream Name <span className="text-destructive">*</span></Label>
                    <Input
                      id="name"
                      placeholder="my_stream"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Source Type</Label>
                    <Select value={sourceType} onValueChange={setSourceType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SOURCE_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex items-center gap-2">
                              <span>{type.label}</span>
                              <span className="text-xs text-muted-foreground">- {type.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Connection Configuration - NEW SECTION */}
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-5 w-5 text-primary" />
                    <div>
                      <CardTitle>Connection Configuration</CardTitle>
                      <CardDescription>Use pre-defined configurations or shared connections</CardDescription>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={fetchConfKeys} disabled={loadingConfigs}>
                    {loadingConfigs ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Configuration Key */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="use-confkey"
                        checked={useConfKey}
                        onCheckedChange={(checked) => {
                          setUseConfKey(checked);
                          if (checked) setUseSharedConnection(false);
                        }}
                      />
                      <Label htmlFor="use-confkey" className="cursor-pointer font-medium">
                        Use Configuration Template
                      </Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>Select a pre-defined configuration key (CONF_KEY) from your source configurations. These are defined in Configuration Templates under Connections.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    {useConfKey && (
                      <Badge variant="secondary" className="gap-1">
                        <Settings2 className="h-3 w-3" />
                        CONF_KEY
                      </Badge>
                    )}
                  </div>

                  {useConfKey && (
                    <div className="pl-8 space-y-2">
                      <Label>Configuration Key</Label>
                      {confKeys.length > 0 ? (
                        <Select value={confKey} onValueChange={setConfKey}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a configuration..." />
                          </SelectTrigger>
                          <SelectContent>
                            {confKeys.map((key) => (
                              <SelectItem key={key} value={key}>
                                {key}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="text-sm text-muted-foreground p-3 rounded-lg bg-muted/50 border border-dashed">
                          No configuration keys found for <strong>{sourceType}</strong>.
                          <Button variant="link" className="px-1 h-auto" onClick={() => router.push("/connections")}>
                            Create one in Connections → Configuration Templates
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Shared Connection */}
                <div className="space-y-4 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="use-shared"
                        checked={useSharedConnection}
                        onCheckedChange={(checked) => {
                          setUseSharedConnection(checked);
                          if (checked) setUseConfKey(false);
                        }}
                      />
                      <Label htmlFor="use-shared" className="cursor-pointer font-medium">
                        Use Shared Connection
                      </Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>Use a shared connection (CONNECTION_SELECTOR) that can be reused across multiple streams. This enables connection pooling and better resource management.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    {useSharedConnection && (
                      <Badge variant="secondary" className="gap-1">
                        <Link2 className="h-3 w-3" />
                        SHARED
                      </Badge>
                    )}
                  </div>

                  {useSharedConnection && (
                    <div className="pl-8 space-y-2">
                      <Label>Shared Connection</Label>
                      {sharedConnections.length > 0 ? (
                        <Select value={sharedConnection} onValueChange={setSharedConnection}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a connection..." />
                          </SelectTrigger>
                          <SelectContent>
                            {sharedConnections.map((conn) => (
                              <SelectItem key={conn.id} value={conn.id}>
                                <div className="flex items-center gap-2">
                                  <span>{conn.id}</span>
                                  {conn.typ && <Badge variant="outline" className="text-xs">{conn.typ}</Badge>}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="text-sm text-muted-foreground p-3 rounded-lg bg-muted/50 border border-dashed">
                          No shared connections found.
                          <Button variant="link" className="px-1 h-auto" onClick={() => router.push("/connections")}>
                            Create one in Connections → Active Connections
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Schema Definition */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Schema Definition</CardTitle>
                  <CardDescription>
                    Define the fields in your stream (optional - leave empty for schemaless)
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={addField}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Field
                </Button>
              </CardHeader>
              <CardContent>
                {fields.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No fields defined. Click &quot;Add Field&quot; to define a schema, or leave empty for a schemaless stream.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {fields.map((field, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          placeholder="Field name"
                          value={field.name}
                          onChange={(e) => updateField(index, "name", e.target.value)}
                          className="flex-1"
                        />
                        <Select
                          value={field.type}
                          onValueChange={(v) => updateField(index, "type", v)}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DATA_TYPES.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeField(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Stream Options */}
            <Card>
              <CardHeader>
                <CardTitle>Stream Options</CardTitle>
                <CardDescription>Configure stream source options</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="datasource">Data Source</Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>For MQTT: topic name (e.g., sensor/data)<br />For HTTP: endpoint URL<br />For File: file path</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Input
                      id="datasource"
                      placeholder="e.g., topic/sensor for MQTT"
                      value={datasource}
                      onChange={(e) => setDatasource(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Format</Label>
                    <Select value={format} onValueChange={setFormat}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FORMAT_TYPES.map((fmt) => (
                          <SelectItem key={fmt.value} value={fmt.value}>
                            <div className="flex items-center gap-2">
                              <span>{fmt.label}</span>
                              <span className="text-xs text-muted-foreground">- {fmt.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Preview SQL */}
            {name && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Code className="h-4 w-4" />
                    Generated SQL
                  </CardTitle>
                  <CardDescription>This SQL statement will be executed to create the stream</CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="rounded-lg bg-muted p-4 text-sm overflow-x-auto font-mono">
                    <code className={cn(
                      "whitespace-pre-wrap break-all",
                      useConfKey && confKey && "text-primary",
                      useSharedConnection && sharedConnection && "text-green-600"
                    )}>{generateSQL()}</code>
                  </pre>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="sql" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>SQL Statement</CardTitle>
                <CardDescription>
                  Write your CREATE STREAM SQL statement directly
                </CardDescription>
              </CardHeader>
              <CardContent>
                <textarea
                  className="w-full h-48 rounded-lg border bg-muted p-4 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder={`CREATE STREAM my_stream (
  temperature float,
  humidity float,
  timestamp bigint
) WITH (
  TYPE="mqtt",
  DATASOURCE="sensor/data",
  FORMAT="json",
  CONF_KEY="my_mqtt_config"
);`}
                  value={sqlStatement}
                  onChange={(e) => setSqlStatement(e.target.value)}
                />
                <div className="mt-4 text-sm text-muted-foreground space-y-1">
                  <p><strong>Available options:</strong></p>
                  <ul className="list-disc list-inside space-y-1 pl-2">
                    <li><code className="text-xs bg-muted px-1 rounded">CONF_KEY="keyname"</code> - Use a pre-defined configuration</li>
                    <li><code className="text-xs bg-muted px-1 rounded">SHARED=TRUE, CONNECTION_SELECTOR="mqtt.connId"</code> - Use shared connection</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={() => router.push("/streams")}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? (
              <LoadingSpinner size="sm" className="mr-2" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Create Stream
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
