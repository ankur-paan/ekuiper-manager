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
import { ArrowLeft, Plus, Trash2, Save, Database, Code, RefreshCw } from "lucide-react";
import { LoadingSpinner, ErrorState, EmptyState } from "@/components/common";

interface StreamField {
  name: string;
  type: string;
}

interface StreamDetails {
  Name: string;
  StreamFields?: Array<{ Name: string; FieldType: string }>;
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
  { value: "mqtt", label: "MQTT" },
  { value: "httppull", label: "HTTP Pull" },
  { value: "httppush", label: "HTTP Push" },
  { value: "memory", label: "Memory" },
  { value: "neuron", label: "Neuron" },
  { value: "edgex", label: "EdgeX" },
  { value: "file", label: "File" },
  { value: "redis", label: "Redis" },
];

export default function EditStreamPage() {
  const router = useRouter();
  const params = useParams();
  const streamName = params.name as string;
  const { servers, activeServerId } = useServerStore();
  const activeServer = servers.find((s) => s.id === activeServerId);

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [stream, setStream] = React.useState<StreamDetails | null>(null);

  const [mode, setMode] = React.useState<"form" | "sql">("sql");
  const [name, setName] = React.useState("");
  const [sourceType, setSourceType] = React.useState("mqtt");
  const [fields, setFields] = React.useState<StreamField[]>([]);
  const [datasource, setDatasource] = React.useState("");
  const [format, setFormat] = React.useState("json");
  const [sqlStatement, setSqlStatement] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  // Helper to reconstruct SQL from stream data (since eKuiper doesn't return the original Statement)
  const reconstructSQL = React.useCallback((data: StreamDetails, parsedFields: StreamField[], opts: Record<string, unknown>): string => {
    const streamName = data.Name;
    
    // Build schema part - eKuiper REQUIRES parentheses even for schemaless streams
    // Correct: CREATE STREAM name () WITH (...)
    // Wrong: CREATE STREAM name WITH (...)
    let schemaStr = "()";
    if (parsedFields.length > 0) {
      schemaStr = `(\n  ${parsedFields.map(f => `${f.name} ${f.type}`).join(",\n  ")}\n)`;
    }
    
    // Build WITH options
    const withParts: string[] = [];
    
    // Extract all option values first (handle both uppercase and lowercase keys)
    const typeVal = opts.TYPE || opts.type || opts.Type;
    const dsVal = opts.DATASOURCE || opts.datasource || opts.Datasource;
    const fmtVal = opts.FORMAT || opts.format || opts.Format;
    const confKeyVal = opts.CONF_KEY || opts.confKey || opts.ConfKey;
    const sharedVal = opts.SHARED || opts.shared || opts.Shared;
    const schemaIdVal = opts.SCHEMAID || opts.schemaId || opts.SchemaId;
    const tsVal = opts.TIMESTAMP || opts.timestamp || opts.Timestamp;
    const tsFmtVal = opts.TIMESTAMP_FORMAT || opts.timestampFormat || opts.TimestampFormat;
    
    // Add options in standard order
    if (typeVal) withParts.push(`TYPE = "${typeVal}"`);
    if (dsVal) withParts.push(`DATASOURCE = "${dsVal}"`);
    if (fmtVal) withParts.push(`FORMAT = "${fmtVal}"`);
    if (confKeyVal) withParts.push(`CONF_KEY = "${confKeyVal}"`);
    if (sharedVal) withParts.push(`SHARED = "${sharedVal}"`);
    if (schemaIdVal) withParts.push(`SCHEMAID = "${schemaIdVal}"`);
    if (tsVal) withParts.push(`TIMESTAMP = "${tsVal}"`);
    if (tsFmtVal) withParts.push(`TIMESTAMP_FORMAT = "${tsFmtVal}"`);
    
    const withStr = withParts.length > 0 ? `WITH (\n  ${withParts.join(",\n  ")}\n)` : "";
    
    return `CREATE STREAM ${streamName} ${schemaStr} ${withStr};`;
  }, []);

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
      console.log("Stream data received:", JSON.stringify(data, null, 2));
      setStream(data);

      // Initialize form fields from stream data
      setName(data.Name || streamName);
      
      // Parse fields from StreamFields
      // eKuiper can return StreamFields as null for schemaless streams
      // or as array: [{ Name: "fieldName", FieldType: { Type: 2 } }, ...] where Type is numeric
      // or as array: [{ Name: "fieldName", FieldType: "bigint" }, ...]
      let parsedFields: StreamField[] = [];
      if (data.StreamFields && Array.isArray(data.StreamFields) && data.StreamFields.length > 0) {
        parsedFields = data.StreamFields.map((f: { Name: string; FieldType: string | { Type: number } }) => {
          let fieldType = "string";
          if (typeof f.FieldType === "string") {
            fieldType = f.FieldType.toLowerCase();
          } else if (f.FieldType && typeof f.FieldType === "object" && "Type" in f.FieldType) {
            // Map numeric type to string: 1=bigint, 2=float, 3=string, 4=datetime, 5=boolean, 6=bytea
            const typeMap: Record<number, string> = { 1: "bigint", 2: "float", 3: "string", 4: "datetime", 5: "boolean", 6: "bytea" };
            fieldType = typeMap[f.FieldType.Type] || "string";
          }
          return { name: f.Name || "", type: fieldType };
        });
        console.log("Parsed fields:", parsedFields);
        setFields(parsedFields);
      } else {
        setFields([]);
      }

      // Parse options - eKuiper returns lowercase keys
      const opts = data.Options || {};
      console.log("Options received:", opts);
      
      // TYPE (lowercase in actual API response)
      const typeVal = opts.TYPE || opts.type || opts.Type;
      if (typeVal) setSourceType(String(typeVal).toLowerCase());
      
      // DATASOURCE
      const dsVal = opts.DATASOURCE || opts.datasource || opts.Datasource;
      if (dsVal) setDatasource(String(dsVal));
      
      // FORMAT
      const fmtVal = opts.FORMAT || opts.format || opts.Format;
      if (fmtVal) setFormat(String(fmtVal).toLowerCase());

      // eKuiper does NOT return the original Statement (it's null)
      // So we need to reconstruct the SQL from the stream data
      const reconstructedSQL = reconstructSQL(data, parsedFields, opts);
      console.log("Reconstructed SQL:", reconstructedSQL);
      setSqlStatement(reconstructedSQL);
      
    } catch (err) {
      console.error("Error fetching stream:", err);
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
    // eKuiper REQUIRES parentheses even for schemaless streams
    // Correct: CREATE STREAM name () WITH (...)
    // Wrong: CREATE STREAM name WITH (...)
    const schemaStr = fields.length > 0
      ? `(${fields.map((f) => `${f.name} ${f.type}`).join(", ")})`
      : "()";

    const optionsArr = [];
    optionsArr.push(`TYPE = "${sourceType}"`);
    if (datasource) optionsArr.push(`DATASOURCE = "${datasource}"`);
    if (format) optionsArr.push(`FORMAT = "${format}"`);

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
      // eKuiper uses PUT to update a stream
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push(`/streams/${streamName}`)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                <Database className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Edit Stream</h1>
                <p className="text-sm text-muted-foreground">
                  Modify stream: {streamName}
                </p>
              </div>
            </div>
          </div>
          <Button variant="outline" size="icon" onClick={fetchStream}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {saveError && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
            {saveError}
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
                    <Label htmlFor="name">Stream Name</Label>
                    <Input
                      id="name"
                      placeholder="my_stream"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled
                    />
                    <p className="text-xs text-muted-foreground">
                      Stream name cannot be changed. Create a new stream if you need a different name.
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

            {/* Options */}
            <Card>
              <CardHeader>
                <CardTitle>Stream Options</CardTitle>
                <CardDescription>Configure stream source options</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
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
                        <SelectItem value="json">JSON</SelectItem>
                        <SelectItem value="binary">Binary</SelectItem>
                        <SelectItem value="protobuf">Protobuf</SelectItem>
                        <SelectItem value="delimited">Delimited</SelectItem>
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
                  <CardTitle>Generated SQL</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="rounded-lg bg-muted p-4 text-sm overflow-x-auto">
                    <code>{generateSQL()}</code>
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
                  Edit the CREATE STREAM SQL statement directly
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
  FORMAT="json"
);`}
                  value={sqlStatement}
                  onChange={(e) => setSqlStatement(e.target.value)}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={() => router.push(`/streams/${streamName}`)}>
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
