"use client";

import * as React from "react";
import { useServerStore } from "@/stores/server-store";
import { ekuiperClient } from "@/lib/ekuiper/client";
import { AppLayout } from "@/components/layout";
import { EmptyState, LoadingSpinner } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CodeEditor } from "@/components/ui/code-editor";
import { FileAutocomplete } from "@/components/uploads/file-autocomplete";
import {
  ArrowLeft,
  Loader2,
  Plus,
  FileCode,
  FileBox,
  FileText,
  Sparkles,
  Info,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

const DEFAULT_PROTO_TEMPLATE = `syntax = "proto3";

package sensor;

message Metric {
  string id = 1;
  int64 timestamp = 2;
  double temperature = 3;
  double humidity = 4;
}
`;

function CreateSchemaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialType = searchParams.get("type") === "custom" ? "custom" : "protobuf";

  const { servers, activeServerId } = useServerStore();
  const activeServer = servers.find((s) => s.id === activeServerId);

  const [type, setType] = React.useState<"protobuf" | "custom">(initialType);
  const [name, setName] = React.useState("");
  const [contentMode, setContentMode] = React.useState<"text" | "file">("text");
  const [protoContent, setProtoContent] = React.useState(DEFAULT_PROTO_TEMPLATE);
  const [protoFileUri, setProtoFileUri] = React.useState("");
  const [soFileUri, setSoFileUri] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const handleSave = async () => {
    if (!activeServer) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Schema name is required");
      return;
    }

    if (type === "custom") {
      if (!soFileUri.trim()) {
        toast.error("Custom schemas require a shared-library (.so) file path");
        return;
      }
    } else {
      if (contentMode === "text" && !protoContent.trim()) {
        toast.error("Protobuf definition content cannot be empty");
        return;
      }
      if (contentMode === "file" && !protoFileUri.trim()) {
        toast.error("Protobuf .proto file path is required");
        return;
      }
    }

    setSaving(true);
    try {
      const payload: { name: string; content?: string; file?: string; soFile?: string } = {
        name: trimmedName,
      };

      if (type === "custom") {
        payload.soFile = soFileUri.trim();
      } else {
        if (contentMode === "text") {
          payload.content = protoContent;
        } else {
          payload.file = protoFileUri.trim();
        }
        if (soFileUri.trim()) {
          payload.soFile = soFileUri.trim();
        }
      }

      await ekuiperClient.createSchema(type, payload);
      toast.success(`Schema "${trimmedName}" created successfully`);
      router.push("/schemas");
    } catch (err) {
      toast.error(
        `Failed to create schema: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      setSaving(false);
    }
  };

  if (!activeServer) {
    return (
      <AppLayout title="Create Schema">
        <EmptyState
          title="No Server Connected"
          description="Connect to an eKuiper server to manage schemas."
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Create Schema">
      <div className="flex flex-col h-[calc(100vh-140px)] gap-6">
        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/schemas")}
              aria-label="Back to schemas"
            >
              <ArrowLeft className="size-5" />
            </Button>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Create Schema</h2>
              <p className="text-muted-foreground">
                Register a Protobuf or custom dynamic-library schema for binary stream decoding
              </p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Create Schema
          </Button>
        </div>

        {/* Editor Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full min-h-0">
          {/* Sidebar Config (4 cols) */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Schema Metadata</CardTitle>
                <CardDescription className="text-xs">
                  Basic definition parameters for eKuiper catalog
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="schema-type" className="text-xs font-medium">
                    Schema Type
                  </Label>
                  <Select
                    value={type}
                    onValueChange={(v) => setType(v as "protobuf" | "custom")}
                  >
                    <SelectTrigger id="schema-type" className="h-8 text-xs font-mono">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="protobuf" className="text-xs">
                          Protobuf (Protocol Buffers)
                        </SelectItem>
                        <SelectItem value="custom" className="text-xs">
                          Custom (.so Binary Plugin)
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="schema-name" className="text-xs font-medium">
                    Schema Name
                  </Label>
                  <Input
                    id="schema-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. sensor_v1"
                    className="font-mono text-xs h-8"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Identifier referenced in stream definitions (`SCHEMA = "name"`).
                  </p>
                </div>

                {/* Custom SO File or Optional Proto SO */}
                <div className="flex flex-col gap-1.5 pt-2 border-t border-border">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">
                      {type === "custom" ? "Binary File (.so) *" : "Compiled Library (.so, optional)"}
                    </Label>
                  </div>
                  <FileAutocomplete
                    value={soFileUri}
                    onChange={setSoFileUri}
                    placeholder="file:///tmp/ekuiper/schema/custom.so"
                    accept=".so"
                    modalTitle="Upload Shared Library (.so)"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {type === "custom"
                      ? "Custom decode logic compiled into a Go/C shared object."
                      : "Optional pre-compiled proto descriptor library for high performance."}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-muted/20 border-border">
              <CardContent className="p-3.5 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                  <Info className="size-4 text-primary shrink-0" />
                  Stream Integration
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  After creating this schema, you can bind it to any stream or table by setting
                  <code className="mx-1 px-1 py-0.5 rounded bg-muted font-mono text-[10px]">
                    FORMAT = &quot;protobuf&quot;
                  </code>
                  and
                  <code className="mx-1 px-1 py-0.5 rounded bg-muted font-mono text-[10px]">
                    SCHEMA = &quot;{name || 'my_schema'}&quot;
                  </code>
                  in the Stream Visual Editor.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Editor Area (8 cols) */}
          <div className="lg:col-span-8 h-full flex flex-col min-h-0">
            {type === "protobuf" ? (
              <div className="flex flex-col h-full border rounded-lg overflow-hidden bg-card">
                <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/40 shrink-0">
                  <Tabs
                    value={contentMode}
                    onValueChange={(v) => setContentMode(v as "text" | "file")}
                  >
                    <TabsList className="h-7 bg-muted/80 p-0.5">
                      <TabsTrigger
                        value="text"
                        className="text-xs px-2.5 h-6 data-[state=active]:bg-background flex items-center gap-1.5"
                      >
                        <FileText className="size-3" />
                        Inline Definition
                      </TabsTrigger>
                      <TabsTrigger
                        value="file"
                        className="text-xs px-2.5 h-6 data-[state=active]:bg-background flex items-center gap-1.5"
                      >
                        <FileCode className="size-3" />
                        File Reference
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>

                  {contentMode === "text" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setProtoContent(DEFAULT_PROTO_TEMPLATE)}
                      className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                    >
                      <Sparkles className="size-3.5" />
                      Reset to Starter
                    </Button>
                  )}
                </div>

                {contentMode === "text" ? (
                  <div className="flex-1 min-h-0 bg-[#1e1e1e]">
                    <CodeEditor
                      value={protoContent}
                      onChange={setProtoContent}
                      language="proto"
                    />
                  </div>
                ) : (
                  <div className="p-6 flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs font-medium">
                        Proto File Path / URI (.proto)
                      </Label>
                      <FileAutocomplete
                        value={protoFileUri}
                        onChange={setProtoFileUri}
                        placeholder="file:///tmp/ekuiper/schema/sensor.proto"
                        accept=".proto"
                        modalTitle="Upload .proto File"
                      />
                      <p className="text-xs text-muted-foreground">
                        Select an uploaded proto file from the node or enter a file:// URI.
                      </p>
                    </div>

                    <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground bg-muted/10 flex flex-col gap-2">
                      <FileCode className="size-8 mx-auto text-muted-foreground/60" />
                      <p>
                        Referencing a server file allows eKuiper to parse the .proto file directly from the filesystem.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col h-full border rounded-lg p-6 bg-card justify-center items-center text-center gap-4">
                <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <FileBox className="size-8" />
                </div>
                <div className="max-w-md flex flex-col gap-1.5">
                  <h3 className="font-semibold text-base">Custom Binary Plugin Schema</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Custom schemas bypass protobuf reflection and use a compiled Go/C shared object (.so) for raw high-speed binary deserialization. Configure the .so file path in the left panel.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

export default function CreateSchemaPage() {
  return (
    <React.Suspense fallback={<LoadingSpinner />}>
      <CreateSchemaContent />
    </React.Suspense>
  );
}
