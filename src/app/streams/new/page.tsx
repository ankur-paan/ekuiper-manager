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
import { ArrowLeft, Plus, Trash2, Save, Database, Code } from "lucide-react";
import { LoadingSpinner } from "@/components/common";

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
  { value: "mqtt", label: "MQTT" },
  { value: "httppull", label: "HTTP Pull" },
  { value: "httppush", label: "HTTP Push" },
  { value: "memory", label: "Memory" },
  { value: "neuron", label: "Neuron" },
  { value: "edgex", label: "EdgeX" },
  { value: "file", label: "File" },
  { value: "redis", label: "Redis" },
];

export default function NewStreamPage() {
  const router = useRouter();
  const { servers, activeServerId } = useServerStore();
  const activeServer = servers.find((s) => s.id === activeServerId);

  const [mode, setMode] = React.useState<"form" | "sql">("form");
  const [name, setName] = React.useState("");
  const [sourceType, setSourceType] = React.useState("mqtt");
  const [fields, setFields] = React.useState<StreamField[]>([]);
  const [datasource, setDatasource] = React.useState("");
  const [format, setFormat] = React.useState("json");
  const [sqlStatement, setSqlStatement] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

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
      setError("No server connected");
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
                    <Label htmlFor="name">Stream Name</Label>
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
                    No fields defined. Click "Add Field" to define a schema, or leave empty for a schemaless stream.
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
