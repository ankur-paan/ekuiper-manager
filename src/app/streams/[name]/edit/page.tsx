"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
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
import { LoadingSpinner, ErrorState, EmptyState } from "@/components/common";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface StreamField {
  name: string;
  type: string;
}

interface StreamDetails {
  Name: string;
  StreamFields?: Array<{ Name: string; FieldType: string | { Type: number } }>;
  Options?: Record<string, unknown>;
  Statement?: string;
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
  { value: "json", label: "JSON" },
  { value: "binary", label: "Binary" },
  { value: "protobuf", label: "Protobuf" },
  { value: "delimited", label: "Delimited" },
];

export default function EditStreamPage() {
  const router = useRouter();
  const params = useParams();
  const streamName = decodeURIComponent(params.name as string);
  const { servers, activeServerId } = useServerStore();
  const activeServer = servers.find((s) => s.id === activeServerId);

  // Loading and error states
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [stream, setStream] = React.useState<StreamDetails | null>(null);

  // Mode
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
  const [originalSharedValue, setOriginalSharedValue] = React.useState(false); // Track original SHARED value - cannot be changed

  // Available configurations and connections
  const [confKeys, setConfKeys] = React.useState<string[]>([]);
  const [sharedConnections, setSharedConnections] = React.useState<{ id: string; typ: string }[]>([]);
  const [loadingConfigs, setLoadingConfigs] = React.useState(false);

  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  // AI State
  const [aiSummary, setAiSummary] = React.useState<string | null>(null);
  const [explaining, setExplaining] = React.useState(false);
  const [aiModels, setAiModels] = React.useState<{ id: string, name: string }[]>([]);
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

  const handleExplain = async () => {
    if (!stream) return;
    setExplaining(true);
    setAiSummary(null);
    try {
      const res = await fetch('/api/ai/stream-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          streamData: stream,
          modelName: selectedModel
        })
      });

      if (!res.ok) throw new Error("Explanation failed");
      const data = await res.json();
      setAiSummary(data.summary);
      toast.success("AI Insights generated");
    } catch (err) {
      toast.error("Failed to explain stream");
    } finally {
      setExplaining(false);
    }
  };

  // Fetch available configuration keys
  const fetchConfKeys = React.useCallback(async () => {
    if (!activeServer?.url) return;
    setLoadingConfigs(true);
    ekuiperClient.setBaseUrl(activeServer.url);

    try {
      const keys = await ekuiperClient.listConfKeys("sources", sourceType);
      setConfKeys(Array.isArray(keys) ? keys : []);
    } catch {
      setConfKeys([]);
    }

    try {
      const connections = await ekuiperClient.listConnections();
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

  // Helper to reconstruct SQL
  const reconstructSQL = React.useCallback((data: StreamDetails, parsedFields: StreamField[], opts: Record<string, unknown>): string => {
    const sName = data.Name;

    let schemaStr = "()";
    if (parsedFields.length > 0) {
      schemaStr = `(\n  ${parsedFields.map(f => `${f.name} ${f.type}`).join(",\n  ")}\n)`;
    }

    const withParts: string[] = [];

    const typeVal = opts.TYPE || opts.type || opts.Type;
    const dsVal = opts.DATASOURCE || opts.datasource || opts.Datasource;
    const fmtVal = opts.FORMAT || opts.format || opts.Format;
    const confKeyVal = opts.CONF_KEY || opts.confKey || opts.ConfKey;
    const sharedVal = opts.SHARED || opts.shared || opts.Shared;

    if (typeVal) withParts.push(`TYPE = "${typeVal}"`);
    if (dsVal) withParts.push(`DATASOURCE = "${dsVal}"`);
    if (fmtVal) withParts.push(`FORMAT = "${fmtVal}"`);
    if (confKeyVal) withParts.push(`CONF_KEY = "${confKeyVal}"`);
    if (sharedVal) withParts.push(`SHARED = "${sharedVal}"`);

    const withStr = withParts.length > 0 ? `WITH (\n  ${withParts.join(",\n  ")}\n)` : "";

    return `CREATE STREAM ${sName} ${schemaStr} ${withStr};`;
  }, []);

  // Fetch stream data
  const fetchStream = React.useCallback(async () => {
    if (!activeServer) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/ekuiper/streams/${encodeURIComponent(streamName)}`, {
        headers: {
          "X-EKuiper-URL": activeServer.url,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch stream: ${response.status}`);
      }

      const data = await response.json();
      setStream(data);

      // Initialize form fields
      setName(data.Name || streamName);

      // Parse fields
      let parsedFields: StreamField[] = [];
      if (data.StreamFields && Array.isArray(data.StreamFields) && data.StreamFields.length > 0) {
        parsedFields = data.StreamFields.map((f: { Name: string; FieldType: string | { Type: number } }) => {
          let fieldType = "string";
          if (typeof f.FieldType === "string") {
            fieldType = f.FieldType.toLowerCase();
          } else if (f.FieldType && typeof f.FieldType === "object" && "Type" in f.FieldType) {
            const typeMap: Record<number, string> = { 1: "bigint", 2: "float", 3: "string", 4: "datetime", 5: "boolean", 6: "bytea" };
            fieldType = typeMap[f.FieldType.Type] || "string";
          }
          return { name: f.Name || "", type: fieldType };
        });
        setFields(parsedFields);
      } else {
        setFields([]);
      }

      // Parse options
      const opts = data.Options || {};

      const typeVal = opts.TYPE || opts.type || opts.Type;
      if (typeVal) setSourceType(String(typeVal).toLowerCase());

      const dsVal = opts.DATASOURCE || opts.datasource || opts.Datasource;
      if (dsVal) setDatasource(String(dsVal));

      const fmtVal = opts.FORMAT || opts.format || opts.Format;
      if (fmtVal) setFormat(String(fmtVal).toLowerCase());

      // Check for CONF_KEY
      const confKeyVal = opts.CONF_KEY || opts.confKey || opts.ConfKey;
      if (confKeyVal) {
        setUseConfKey(true);
        setConfKey(String(confKeyVal));
      }

      // Check for shared connection - SHARED = "true" with a CONF_KEY
      // NOTE: eKuiper does NOT support changing SHARED option after stream creation
      const sharedVal = opts.SHARED || opts.shared || opts.Shared;
      const isShared = sharedVal && String(sharedVal).toLowerCase() === "true";
      setOriginalSharedValue(isShared);
      if (isShared) {
        setUseSharedConnection(true);
        // The CONF_KEY contains the connection reference when SHARED is true
        if (confKeyVal) {
          setSharedConnection(String(confKeyVal));
        }
      }

      // Reconstruct SQL
      const reconstructedSQL = reconstructSQL(data, parsedFields, opts);
      setSqlStatement(reconstructedSQL);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stream");
    } finally {
      setLoading(false);
    }
  }, [activeServer, streamName, reconstructSQL]);

  React.useEffect(() => {
    fetchStream();
  }, [fetchStream]);

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
    const schemaStr = fields.length > 0
      ? `(${fields.map((f) => `${f.name} ${f.type}`).join(", ")})`
      : "()";

    const optionsArr = [];
    optionsArr.push(`TYPE = "${sourceType}"`);
    if (datasource) optionsArr.push(`DATASOURCE = "${datasource}"`);
    if (format) optionsArr.push(`FORMAT = "${format}"`);

    if (useConfKey && confKey) {
      optionsArr.push(`CONF_KEY = "${confKey}"`);
    }

    // For shared connections, use CONF_KEY with SHARED = "true"
    if (useSharedConnection && sharedConnection) {
      optionsArr.push(`CONF_KEY = "${sharedConnection}"`);
      optionsArr.push(`SHARED = "true"`);
    }

    return `CREATE STREAM ${name} ${schemaStr} WITH (${optionsArr.join(", ")});`;
  };

  const handleSubmit = async () => {
    if (!activeServer) {
      setSaveError("No server connected");
      return;
    }

    const sql = mode === "sql" ? sqlStatement : generateSQL();

    if (!sql.trim()) {
      setSaveError("Please provide a valid SQL statement");
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      const response = await fetch(`/api/ekuiper/streams/${encodeURIComponent(streamName)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-EKuiper-URL": activeServer.url,
        },
        body: JSON.stringify({ sql }),
      });

      if (!response.ok) {
        const errData = await response.text();
        throw new Error(errData || `Failed to update stream: ${response.status}`);
      }

      toast.success("Stream updated successfully");
      router.push(`/streams/${encodeURIComponent(streamName)}`);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to update stream");
    } finally {
      setSaving(false);
    }
  };

  if (!activeServer) {
    return (
      <AppLayout title={`Edit Stream: ${streamName}`}>
        <EmptyState
          title="No Server Connected"
          description="Connect to an eKuiper server to edit streams."
        />
      </AppLayout>
    );
  }

  if (loading) {
    return (
      <AppLayout title={`Edit Stream: ${streamName}`}>
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      </AppLayout>
    );
  }

  if (error || !stream) {
    return (
      <AppLayout title={`Edit Stream: ${streamName}`}>
        <ErrorState
          title="Error Loading Stream"
          description={error || "Stream not found"}
          onRetry={fetchStream}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout title={`Edit Stream: ${streamName}`}>
      <div className="space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push(`/streams/${encodeURIComponent(streamName)}`)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                <Database className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold">Edit Stream</h1>
                <p className="text-sm text-muted-foreground">
                  Modify: {streamName}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-center">
            {aiModels.length > 0 && (
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="w-[140px] h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {aiModels.map(m => (
                    <SelectItem key={m.id} value={m.id} className="text-xs">
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExplain}
              disabled={explaining}
              className="gap-2 border-purple-200 hover:bg-purple-50 text-purple-700 transition-all shadow-sm h-9"
            >
              {explaining ? (
                <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
              ) : (
                <Sparkles className="h-4 w-4 text-purple-600" />
              )}
              {explaining ? "Thinking..." : "Understand with AI"}
            </Button>
            <Button variant="outline" size="sm" onClick={fetchStream} className="gap-2 h-9">
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>

        {/* AI Insight Card */}
        {aiSummary && (
          <Card className="border-purple-500/20 bg-gradient-to-br from-purple-50/50 to-white shadow-sm ring-1 ring-purple-500/5 overflow-hidden">
            <CardHeader className="pb-3 border-b border-purple-100/50 p-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-purple-100">
                  <Bot className="h-4 w-4 text-purple-600" />
                </div>
                <CardTitle className="text-sm font-bold text-purple-900 uppercase tracking-wider">AI Industrial Insight</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <p className="text-sm text-slate-700 leading-relaxed font-medium italic">
                &quot;{aiSummary}&quot;
              </p>
            </CardContent>
          </Card>
        )}

        {saveError && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive text-sm">
            {saveError}
          </div>
        )}

        <Tabs value={mode} onValueChange={(v) => setMode(v as "form" | "sql")} className="space-y-4">
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <TabsList className="w-full sm:w-auto inline-flex">
              <TabsTrigger value="form" className="gap-2 flex-1 sm:flex-none">
                <Database className="h-4 w-4" />
                Form Builder
              </TabsTrigger>
              <TabsTrigger value="sql" className="gap-2 flex-1 sm:flex-none">
                <Code className="h-4 w-4" />
                SQL Editor
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="form" className="space-y-4">
            {/* Basic Info */}
            <Card>
              <CardHeader className="p-4 md:p-6">
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>Stream name and source type</CardDescription>
              </CardHeader>
              <CardContent className="p-4 md:p-6 pt-0 md:pt-0 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Stream Name</Label>
                    <Input
                      id="name"
                      placeholder="my_stream"
                      value={name}
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">
                      Stream name cannot be changed
                    </p>
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
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Connection Configuration */}
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
              <CardHeader className="p-4 md:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
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
              <CardContent className="p-4 md:p-6 pt-0 md:pt-0 space-y-6">
                {/* Configuration Key */}
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
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
                            <p>Select a pre-defined configuration key (CONF_KEY)</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    {useConfKey && (
                      <Badge variant="secondary" className="gap-1 w-fit">
                        <Settings2 className="h-3 w-3" />
                        CONF_KEY
                      </Badge>
                    )}
                  </div>

                  {useConfKey && (
                    <div className="sm:pl-8 space-y-2">
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
                            Create one in Connections
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Shared Connection */}
                <div className="space-y-4 pt-4 border-t">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="use-shared"
                        checked={useSharedConnection}
                        disabled={true} // eKuiper does not support changing SHARED option after creation
                        onCheckedChange={(checked) => {
                          setUseSharedConnection(checked);
                          if (checked) setUseConfKey(false);
                        }}
                      />
                      <Label htmlFor="use-shared" className={cn("font-medium", "cursor-not-allowed opacity-70")}>
                        Use Shared Connection
                      </Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>Use a shared connection (CONF_KEY + SHARED=true)</p>
                            <p className="text-xs text-yellow-500 mt-1">Cannot be modified after creation</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    {useSharedConnection && (
                      <Badge variant="secondary" className="gap-1 w-fit">
                        <Link2 className="h-3 w-3" />
                        SHARED
                      </Badge>
                    )}
                  </div>

                  {useSharedConnection && (
                    <div className="sm:pl-8 space-y-2">
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
                            Create one in Connections
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
              <CardHeader className="p-4 md:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <CardTitle>Schema Definition</CardTitle>
                  <CardDescription>
                    Define the fields in your stream (optional)
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={addField}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Field
                </Button>
              </CardHeader>
              <CardContent className="p-4 md:p-6 pt-0 md:pt-0">
                {fields.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No fields defined (schemaless stream).
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
                          <SelectTrigger className="w-28 sm:w-40">
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
              <CardHeader className="p-4 md:p-6">
                <CardTitle>Stream Options</CardTitle>
                <CardDescription>Configure stream source options</CardDescription>
              </CardHeader>
              <CardContent className="p-4 md:p-6 pt-0 md:pt-0 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="datasource">Data Source</Label>
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
                            {fmt.label}
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
                <CardHeader className="p-4 md:p-6">
                  <CardTitle className="flex items-center gap-2">
                    <Code className="h-4 w-4" />
                    Generated SQL
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 md:p-6 pt-0 md:pt-0">
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
              <CardHeader className="p-4 md:p-6">
                <CardTitle>SQL Statement</CardTitle>
                <CardDescription>
                  Edit the CREATE STREAM SQL statement directly
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 md:p-6 pt-0 md:pt-0">
                <textarea
                  className="w-full h-48 rounded-lg border bg-muted p-4 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-y"
                  placeholder={`CREATE STREAM my_stream (
  temperature float,
  humidity float
) WITH (
  TYPE="mqtt",
  DATASOURCE="sensor/data",
  FORMAT="json",
  CONF_KEY="my_config"
);`}
                  value={sqlStatement}
                  onChange={(e) => setSqlStatement(e.target.value)}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2">
          <Button variant="outline" onClick={() => router.push(`/streams/${encodeURIComponent(streamName)}`)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? (
              <LoadingSpinner size="sm" className="mr-2" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Update Stream
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
