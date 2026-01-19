"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useServerStore } from "@/stores/server-store";
import { AppLayout } from "@/components/layout";
import { LoadingPage, ErrorState } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Database,
  Pencil,
  Trash2,
  Copy,
  Code,
  Sparkles,
  Bot,
  Loader2
} from "lucide-react";
import { ConfirmDialog } from "@/components/common";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface StreamDetails {
  Name: string;
  StreamFields: Array<{ Name: string; FieldType: string }> | null;
  Options: Record<string, unknown>;
  Statement?: string;
}

// Inferred schema type from /streams/{name}/schema endpoint
interface StreamSchemaField {
  type: string;
  optional?: boolean;
  properties?: Record<string, StreamSchemaField>;
  items?: StreamSchemaField;
}

// Component to display inferred schema
function InferredSchemaCard({ streamName, activeServer }: { streamName: string; activeServer: { url: string } | undefined }) {
  const [schema, setSchema] = React.useState<Record<string, StreamSchemaField> | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fetchSchema = React.useCallback(async () => {
    if (!activeServer || !streamName) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/ekuiper/streams/${streamName}/schema`, {
        headers: { "X-EKuiper-URL": activeServer.url },
      });
      if (!response.ok) {
        if (response.status === 404) {
          setError("Schema endpoint not available on this version");
          return;
        }
        throw new Error(`Status ${response.status}`);
      }
      const data = await response.json();
      setSchema(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch schema");
    } finally {
      setLoading(false);
    }
  }, [activeServer, streamName]);

  React.useEffect(() => {
    fetchSchema();
  }, [fetchSchema]);

  // Get color for type
  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      string: "bg-green-500/10 text-green-600 border-green-500/20",
      bigint: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      float: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
      boolean: "bg-amber-500/10 text-amber-600 border-amber-500/20",
      datetime: "bg-purple-500/10 text-purple-600 border-purple-500/20",
      bytea: "bg-orange-500/10 text-orange-600 border-orange-500/20",
      array: "bg-pink-500/10 text-pink-600 border-pink-500/20",
      struct: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
    };
    return colors[type?.toLowerCase()] || "bg-gray-500/10 text-gray-600 border-gray-500/20";
  };

  // Render schema field recursively
  const renderField = (name: string, field: StreamSchemaField, depth = 0) => {
    if (!field) return null;
    return (
      <div key={name} className={cn("rounded-lg border p-3", depth > 0 && "ml-4 mt-2 border-dashed")}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-medium">{name}</span>
            {field.optional && <span className="text-xs text-muted-foreground">(optional)</span>}
          </div>
          <Badge variant="outline" className={getTypeColor(field.type)}>
            {field.type}
          </Badge>
        </div>
        {field.properties && (
          <div className="mt-2 space-y-2">
            {Object.entries(field.properties).map(([k, v]) => renderField(k, v, depth + 1))}
          </div>
        )}
        {field.items && (
          <div className="mt-2 pl-4 border-l-2 border-dashed border-muted-foreground/30">
            <span className="text-xs text-muted-foreground mb-1 block">Array items:</span>
            {renderField("[]", field.items, depth + 1)}
          </div>
        )}
      </div>
    );
  };

  if (error) return null; // Silently hide if not available

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Inferred Schema
          <Badge variant="secondary" className="text-xs font-normal">Runtime</Badge>
        </CardTitle>
        <CardDescription>
          Schema derived from physical and logical definitions at runtime
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading schema...</span>
          </div>
        ) : schema && Object.keys(schema).length > 0 ? (
          <div className="space-y-2">
            {Object.entries(schema).map(([name, field]) => renderField(name, field))}
          </div>
        ) : (
          <p className="text-muted-foreground">
            No inferred schema available (schema-less stream)
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function StreamDetailPage() {
  const params = useParams();
  const router = useRouter();
  const streamName = params.name as string;
  const { servers, activeServerId } = useServerStore();
  const activeServer = servers.find((s) => s.id === activeServerId);

  const [stream, setStream] = React.useState<StreamDetails | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [showDelete, setShowDelete] = React.useState(false);

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

  const fetchStream = React.useCallback(async () => {
    if (!activeServer || !streamName) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/ekuiper/streams/${streamName}`, {
        headers: {
          "X-EKuiper-URL": activeServer.url,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch stream: ${response.status}`);
      }

      const data = await response.json();
      setStream(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch stream");
    } finally {
      setLoading(false);
    }
  }, [activeServer, streamName]);

  React.useEffect(() => {
    fetchStream();
  }, [fetchStream]);

  const handleDelete = async () => {
    if (!activeServer) return;

    try {
      const response = await fetch(`/api/ekuiper/streams/${streamName}`, {
        method: "DELETE",
        headers: {
          "X-EKuiper-URL": activeServer.url,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to delete stream: ${response.status}`);
      }

      router.push("/streams");
    } catch (err) {
      console.error("Failed to delete stream:", err);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (loading) {
    return (
      <AppLayout title={`Stream: ${streamName}`}>
        <LoadingPage label="Loading stream details..." />
      </AppLayout>
    );
  }

  if (error || !stream) {
    return (
      <AppLayout title={`Stream: ${streamName}`}>
        <ErrorState
          title="Error Loading Stream"
          description={error || "Stream not found"}
          onRetry={fetchStream}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout title={`Stream: ${streamName}`}>
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
                <h1 className="text-2xl font-bold">{stream.Name}</h1>
                <p className="text-sm text-muted-foreground">Stream Details</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
              onClick={handleExplain}
              disabled={explaining}
              className="gap-2 border-purple-200 hover:bg-purple-50 text-purple-700 transition-all shadow-sm"
            >
              {explaining ? (
                <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
              ) : (
                <Sparkles className="h-4 w-4 text-purple-600" />
              )}
              {explaining ? "Thinking..." : "Understand with AI"}
            </Button>
            <Separator orientation="vertical" className="h-6 mx-1" />
            <Button variant="outline" onClick={() => router.push(`/streams/${streamName}/edit`)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
            <Button variant="destructive" onClick={() => setShowDelete(true)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>

        {/* AI Insight Card */}
        {aiSummary && (
          <Card className="border-purple-500/20 bg-gradient-to-br from-purple-50/50 to-white shadow-sm ring-1 ring-purple-500/5 overflow-hidden">
            <CardHeader className="pb-3 border-b border-purple-100/50">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-purple-100">
                  <Bot className="h-4 w-4 text-purple-600" />
                </div>
                <CardTitle className="text-sm font-bold text-purple-900 uppercase tracking-wider">AI Industrial Insight</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <p className="text-sm text-slate-700 leading-relaxed font-medium italic">
                &quot;{aiSummary}&quot;
              </p>
            </CardContent>
          </Card>
        )}

        {/* Stream Schema */}
        <Card>
          <CardHeader>
            <CardTitle>Schema</CardTitle>
            <CardDescription>Stream field definitions</CardDescription>
          </CardHeader>
          <CardContent>
            {stream.StreamFields && stream.StreamFields.length > 0 ? (
              <div className="space-y-2">
                {stream.StreamFields.map((field, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <span className="font-medium">{field.Name}</span>
                    <Badge variant="outline">{field.FieldType}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">
                Schema-less stream (dynamic schema)
              </p>
            )}
          </CardContent>
        </Card>

        {/* Inferred Schema Card */}
        <InferredSchemaCard streamName={streamName} activeServer={activeServer} />

        {/* Stream Options */}
        <Card>
          <CardHeader>
            <CardTitle>Options</CardTitle>
            <CardDescription>Stream configuration options</CardDescription>
          </CardHeader>
          <CardContent>
            {stream.Options && Object.keys(stream.Options).length > 0 ? (
              <div className="space-y-2">
                {Object.entries(stream.Options).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <span className="font-medium">{key}</span>
                    <code className="text-sm bg-muted px-2 py-1 rounded">
                      {JSON.stringify(value)}
                    </code>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No options configured</p>
            )}
          </CardContent>
        </Card>

        {/* SQL Statement */}
        {stream.Statement && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  SQL Statement
                </CardTitle>
                <CardDescription>Stream definition SQL</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(stream.Statement || "")}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy
              </Button>
            </CardHeader>
            <CardContent>
              <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm">
                <code>{stream.Statement}</code>
              </pre>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        title="Delete Stream"
        description={`Are you sure you want to delete the stream "${streamName}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
      />
    </AppLayout>
  );
}
