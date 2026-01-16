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
} from "lucide-react";
import { ConfirmDialog } from "@/components/common";

interface StreamDetails {
  Name: string;
  StreamFields: Array<{ Name: string; FieldType: string }> | null;
  Options: Record<string, unknown>;
  Statement?: string;
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
