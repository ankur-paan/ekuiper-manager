"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { JsonEditor } from "@/components/editor/json-editor";
import { toast } from "@/hooks/use-toast";
import { 
  Plus, 
  Search, 
  RefreshCw, 
  FileCode,
  Trash2,
  Edit,
  Box,
  Code,
  File,
  FileJson,
  Copy,
  Check
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EKuiperManagerClient } from "@/lib/ekuiper/manager-client";
import type { SchemaDefinition } from "@/lib/ekuiper/manager-types";

interface SchemaRegistryProps {
  client: EKuiperManagerClient;
}

const SCHEMA_TYPES = [
  { id: "protobuf", name: "Protocol Buffers", icon: Code, description: "Google's language-neutral, platform-neutral data format" },
  { id: "json", name: "JSON Schema", icon: FileJson, description: "JSON document structure validation" },
  { id: "custom", name: "Custom", icon: File, description: "User-defined schema format" },
];

const SAMPLE_SCHEMAS = {
  protobuf: `syntax = "proto3";

message SensorData {
  string device_id = 1;
  double temperature = 2;
  double humidity = 3;
  int64 timestamp = 4;
}`,
  json: `{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "device_id": { "type": "string" },
    "temperature": { "type": "number" },
    "humidity": { "type": "number" },
    "timestamp": { "type": "integer" }
  },
  "required": ["device_id", "temperature", "timestamp"]
}`,
  custom: `// Custom schema definition
type: struct
fields:
  - name: device_id
    type: string
  - name: temperature
    type: float64
  - name: timestamp
    type: int64`,
};

export function SchemaRegistry({ client }: SchemaRegistryProps) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedSchema, setSelectedSchema] = useState<SchemaDefinition | null>(null);
  const [copied, setCopied] = useState(false);

  // Form state
  const [newSchema, setNewSchema] = useState({
    name: "",
    type: "protobuf" as "protobuf" | "json" | "custom",
    content: SAMPLE_SCHEMAS.protobuf,
  });

  // Fetch schemas
  const { data: schemas = [], isLoading, refetch } = useQuery({
    queryKey: ["schemas"],
    queryFn: () => client.listSchemas(),
  });

  // Create schema mutation
  const createMutation = useMutation({
    mutationFn: (schema: { name: string; type: string; content: string }) =>
      client.createSchema(schema.name, schema.type, schema.content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schemas"] });
      setCreateDialogOpen(false);
      setNewSchema({ name: "", type: "protobuf", content: SAMPLE_SCHEMAS.protobuf });
      toast({ title: "Schema created successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create schema",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete schema mutation
  const deleteMutation = useMutation({
    mutationFn: (name: string) =>
      client.deleteResource(`/schemas/${name}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schemas"] });
      toast({ title: "Schema deleted successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete schema",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Filter schemas - schemas is string[] of schema names
  const filteredSchemas = schemas.filter((schemaName: string) => {
    return schemaName.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const handleCopy = async (content: string) => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-full flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <FileCode className="h-5 w-5" />
            Schema Registry
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage Protobuf, JSON, and custom schemas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            New Schema
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search schemas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedType} onValueChange={setSelectedType}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="protobuf">Protobuf</SelectItem>
            <SelectItem value="json">JSON</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Schema Type Cards */}
      <div className="grid grid-cols-3 gap-4">
        {SCHEMA_TYPES.map((type) => {
          // Count based on naming convention (e.g., schema names containing the type)
          const count = type.id === "all" ? schemas.length : 0;
          return (
            <Card 
              key={type.id}
              className={cn(
                "cursor-pointer transition-colors",
                selectedType === type.id && "ring-2 ring-primary"
              )}
              onClick={() => setSelectedType(selectedType === type.id ? "all" : type.id)}
            >
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <type.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{type.name}</p>
                    <p className="text-xs text-muted-foreground">{type.description}</p>
                  </div>
                  <Badge variant="secondary">{count}</Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Schemas List */}
      <Card className="flex-1">
        <CardHeader className="py-3">
          <CardTitle className="text-sm">
            Schemas ({filteredSchemas.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
          ) : filteredSchemas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileCode className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No schemas found</p>
              <p className="text-sm mt-1">Create your first schema to get started</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredSchemas.map((schemaName: string) => (
                <div
                  key={schemaName}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded bg-muted">
                      <FileCode className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium">{schemaName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedSchema({ 
                          name: schemaName, 
                          type: "protobuf", 
                          content: "",
                          createdAt: new Date().toISOString(),
                          updatedAt: new Date().toISOString()
                        });
                        setViewDialogOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm(`Delete schema "${schemaName}"?`)) {
                          deleteMutation.mutate(schemaName);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Schema Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Create Schema</DialogTitle>
            <DialogDescription>
              Define a new schema for data serialization
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 flex flex-col gap-4 overflow-hidden">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  placeholder="my_schema"
                  value={newSchema.name}
                  onChange={(e) => setNewSchema({ ...newSchema, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={newSchema.type}
                  onValueChange={(value: "protobuf" | "json" | "custom") => {
                    setNewSchema({
                      ...newSchema,
                      type: value,
                      content: SAMPLE_SCHEMAS[value],
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="protobuf">Protocol Buffers</SelectItem>
                    <SelectItem value="json">JSON Schema</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex-1 min-h-0">
              <Label>Schema Definition</Label>
              <div className="h-full mt-2">
                {newSchema.type === "json" ? (
                  <JsonEditor
                    value={newSchema.content}
                    onChange={(val) => setNewSchema({ ...newSchema, content: val })}
                    height="100%"
                  />
                ) : (
                  <Textarea
                    value={newSchema.content}
                    onChange={(e) => setNewSchema({ ...newSchema, content: e.target.value })}
                    className="h-full font-mono text-sm resize-none"
                    placeholder="Enter schema definition..."
                  />
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate(newSchema)}
              disabled={!newSchema.name || !newSchema.content || createMutation.isPending}
            >
              {createMutation.isPending && <RefreshCw className="h-4 w-4 mr-1 animate-spin" />}
              Create Schema
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Schema Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>{selectedSchema?.name}</DialogTitle>
                <DialogDescription>
                  {selectedSchema?.type} schema
                </DialogDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => selectedSchema && handleCopy(selectedSchema.content || "")}
              >
                {copied ? (
                  <Check className="h-4 w-4 mr-1" />
                ) : (
                  <Copy className="h-4 w-4 mr-1" />
                )}
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0">
            {selectedSchema?.type === "json" ? (
              <JsonEditor
                value={selectedSchema?.content || ""}
                onChange={() => {}} // Read-only view
                height="100%"
              />
            ) : (
              <pre className="h-full p-4 bg-muted rounded-lg overflow-auto font-mono text-sm">
                {selectedSchema?.content}
              </pre>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
