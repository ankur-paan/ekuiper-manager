"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Cloud,
  Plus,
  Trash2,
  Edit,
  RefreshCw,
  Search,
  Copy,
  Check,
  Zap,
  Server,
  Code2,
  FileCode,
  Link2,
  Settings,
  PlayCircle,
  ChevronRight,
  Info,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Upload,
  Download,
  Globe,
  Key,
  Lock
} from "lucide-react";
import { EKuiperClient, Service, ExternalFunction } from "@/lib/ekuiper";

// =============================================================================
// Types
// =============================================================================

type ServiceProtocol = "grpc" | "rest" | "msgpack-rpc";
type SchemaType = "protobuf";

interface ServiceConfig {
  name: string;
  protocol: ServiceProtocol;
  address: string;
  schemaType: SchemaType;
  schemaFile: string;
  schemaContent?: string;
  description?: string;
  author?: string;
  functions: FunctionMapping[];
  options?: {
    headers?: Record<string, string>;
    insecureSkipVerify?: boolean;
  };
}

interface FunctionMapping {
  name: string;
  serviceName: string;
  description?: string;
}

interface ExternalFunctionsProps {
  client: EKuiperClient;
}

// =============================================================================
// Sample Protobuf Templates
// =============================================================================

const PROTO_TEMPLATES = {
  simple: `syntax = "proto3";

package myservice;

// Simple calculation service
service Calculator {
  // Add two numbers
  rpc Add(AddRequest) returns (AddResponse) {}
  
  // Multiply two numbers
  rpc Multiply(MultiplyRequest) returns (MultiplyResponse) {}
}

message AddRequest {
  double a = 1;
  double b = 2;
}

message AddResponse {
  double result = 1;
}

message MultiplyRequest {
  double a = 1;
  double b = 2;
}

message MultiplyResponse {
  double result = 1;
}
`,

  ml: `syntax = "proto3";

package ml;

// Machine Learning inference service
service MLInference {
  // Run prediction on input data
  rpc Predict(PredictRequest) returns (PredictResponse) {}
  
  // Get model metadata
  rpc GetModelInfo(ModelInfoRequest) returns (ModelInfoResponse) {}
}

message PredictRequest {
  string model_name = 1;
  repeated double features = 2;
}

message PredictResponse {
  repeated double predictions = 1;
  double confidence = 2;
  string label = 3;
}

message ModelInfoRequest {
  string model_name = 1;
}

message ModelInfoResponse {
  string name = 1;
  string version = 2;
  repeated string feature_names = 3;
  repeated string label_names = 4;
}
`,

  transform: `syntax = "proto3";

package transform;

// Data transformation service
service DataTransform {
  // Transform JSON data
  rpc TransformJSON(TransformRequest) returns (TransformResponse) {}
  
  // Enrich data with external sources
  rpc EnrichData(EnrichRequest) returns (EnrichResponse) {}
  
  // Validate data against schema
  rpc ValidateData(ValidateRequest) returns (ValidateResponse) {}
}

message TransformRequest {
  string data = 1;  // JSON string
  string template = 2;
}

message TransformResponse {
  string result = 1;  // Transformed JSON
  bool success = 2;
  string error = 3;
}

message EnrichRequest {
  string data = 1;
  repeated string enrichment_sources = 2;
}

message EnrichResponse {
  string enriched_data = 1;
  map<string, string> metadata = 2;
}

message ValidateRequest {
  string data = 1;
  string schema = 2;
}

message ValidateResponse {
  bool valid = 1;
  repeated string errors = 2;
}
`
};

// =============================================================================
// Helper Components
// =============================================================================

function ProtocolBadge({ protocol }: { protocol: ServiceProtocol }) {
  const colors: Record<ServiceProtocol, string> = {
    grpc: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    rest: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    "msgpack-rpc": "bg-orange-500/10 text-orange-500 border-orange-500/20",
  };

  return (
    <Badge variant="outline" className={cn("uppercase text-xs", colors[protocol])}>
      {protocol}
    </Badge>
  );
}

function FunctionCard({
  func,
  onCopy,
}: {
  func: ExternalFunction;
  onCopy: (text: string) => void;
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
      <div className="flex items-center gap-3">
        <Code2 className="h-4 w-4 text-sota-blue" />
        <div>
          <p className="font-medium text-sm">{func.name}</p>
          <p className="text-xs text-muted-foreground">
            {func.serviceName} / {func.interfaceName}
          </p>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onCopy(`SELECT ${func.name}(arg) FROM stream`)}
      >
        <Copy className="h-4 w-4" />
      </Button>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function ExternalFunctions({ client }: ExternalFunctionsProps) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"services" | "functions" | "create">("services");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingService, setEditingService] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Form state for creating/editing services
  const [serviceConfig, setServiceConfig] = useState<ServiceConfig>({
    name: "",
    protocol: "grpc",
    address: "localhost:50051",
    schemaType: "protobuf",
    schemaFile: "",
    schemaContent: PROTO_TEMPLATES.simple,
    description: "",
    author: "",
    functions: [],
    options: {
      insecureSkipVerify: false,
    },
  });

  // Queries
  const { data: services = [], isLoading: servicesLoading, refetch: refetchServices } = useQuery({
    queryKey: ["services"],
    queryFn: () => client.listServices(),
  });

  const { data: externalFunctions = [], isLoading: functionsLoading, refetch: refetchFunctions } = useQuery({
    queryKey: ["externalFunctions"],
    queryFn: () => client.listExternalFunctions(),
  });

  // Mutations
  const createServiceMutation = useMutation({
    mutationFn: async (config: ServiceConfig) => {
      // Create service definition file
      const serviceDefinition: Service = {
        name: config.name,
        about: {
          author: {
            name: config.author,
          },
          description: {
            en_US: config.description,
          },
        },
        interfaces: {
          [config.name]: {
            address: config.address,
            protocol: config.protocol,
            schemaType: config.schemaType,
            schemaFile: config.schemaFile,
            options: config.options,
            functions: config.functions.map((f) => ({
              name: f.name,
              serviceName: f.serviceName,
            })),
          },
        },
      };

      // For now, we'll create via API (in production, you'd upload the schema file)
      await client.createService({
        name: config.name,
        file: `file:///tmp/${config.name}.json`,
      });
    },
    onSuccess: () => {
      toast({
        title: "Service Created",
        description: "External service registered successfully",
      });
      setIsCreateOpen(false);
      refetchServices();
      refetchFunctions();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteServiceMutation = useMutation({
    mutationFn: (name: string) => client.deleteService(name),
    onSuccess: () => {
      toast({
        title: "Service Deleted",
        description: "External service removed successfully",
      });
      refetchServices();
      refetchFunctions();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handlers
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ title: "Copied", description: "SQL copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  const parseFunctionsFromProto = (protoContent: string): FunctionMapping[] => {
    const functions: FunctionMapping[] = [];
    const rpcPattern = /rpc\s+(\w+)\s*\(/g;
    const servicePattern = /service\s+(\w+)\s*\{/g;

    let serviceName = "default";
    const serviceMatch = servicePattern.exec(protoContent);
    if (serviceMatch) {
      serviceName = serviceMatch[1];
    }

    let match;
    while ((match = rpcPattern.exec(protoContent)) !== null) {
      functions.push({
        name: match[1].toLowerCase(),
        serviceName: serviceName,
        description: "",
      });
    }

    return functions;
  };

  const handleProtoChange = (content: string) => {
    setServiceConfig((prev) => ({
      ...prev,
      schemaContent: content,
      functions: parseFunctionsFromProto(content),
    }));
  };

  const filteredServices = services.filter((s: string) =>
    s.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredFunctions = externalFunctions.filter((f) =>
    f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.serviceName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Cloud className="h-6 w-6 text-sota-blue" />
            External Functions
          </h2>
          <p className="text-muted-foreground">
            Call external gRPC/REST services from SQL queries
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              refetchServices();
              refetchFunctions();
            }}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Register Service
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search services or functions..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList>
          <TabsTrigger value="services" className="flex items-center gap-2">
            <Server className="h-4 w-4" />
            Services ({services.length})
          </TabsTrigger>
          <TabsTrigger value="functions" className="flex items-center gap-2">
            <Code2 className="h-4 w-4" />
            Functions ({externalFunctions.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="services" className="space-y-4">
          {servicesLoading ? (
            <div className="flex items-center justify-center h-48">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredServices.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                <Server className="h-12 w-12 mb-4 opacity-50" />
                <p>No external services registered</p>
                <Button
                  variant="link"
                  onClick={() => setIsCreateOpen(true)}
                  className="mt-2"
                >
                  Register your first service
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredServices.map((serviceName: string) => (
                <Card key={serviceName} className="group">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-sota-blue to-sota-purple flex items-center justify-center">
                          <Server className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{serviceName}</h3>
                          <p className="text-sm text-muted-foreground">
                            External service
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteServiceMutation.mutate(serviceName)}
                          className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="functions" className="space-y-4">
          {functionsLoading ? (
            <div className="flex items-center justify-center h-48">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredFunctions.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                <Code2 className="h-12 w-12 mb-4 opacity-50" />
                <p>No external functions available</p>
                <p className="text-sm">Register a service to expose functions</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Available Functions</CardTitle>
                <CardDescription>
                  Use these functions in your SQL queries
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {filteredFunctions.map((func) => (
                  <FunctionCard
                    key={func.name}
                    func={func}
                    onCopy={copyToClipboard}
                  />
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Service Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Register External Service
            </DialogTitle>
            <DialogDescription>
              Configure a gRPC, REST, or msgpack-rpc service for SQL function calls
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[70vh] pr-4">
            <div className="space-y-6">
              {/* Basic Configuration */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Service Configuration
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Service Name</Label>
                    <Input
                      placeholder="my_service"
                      value={serviceConfig.name}
                      onChange={(e) =>
                        setServiceConfig({ ...serviceConfig, name: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Protocol</Label>
                    <Select
                      value={serviceConfig.protocol}
                      onValueChange={(v) =>
                        setServiceConfig({ ...serviceConfig, protocol: v as ServiceProtocol })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="grpc">
                          <div className="flex items-center gap-2">
                            <Zap className="h-4 w-4 text-purple-500" />
                            gRPC
                          </div>
                        </SelectItem>
                        <SelectItem value="rest">
                          <div className="flex items-center gap-2">
                            <Globe className="h-4 w-4 text-blue-500" />
                            REST
                          </div>
                        </SelectItem>
                        <SelectItem value="msgpack-rpc">
                          <div className="flex items-center gap-2">
                            <Server className="h-4 w-4 text-orange-500" />
                            msgpack-rpc
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Service Address</Label>
                  <Input
                    placeholder="localhost:50051"
                    value={serviceConfig.address}
                    onChange={(e) =>
                      setServiceConfig({ ...serviceConfig, address: e.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    {serviceConfig.protocol === "grpc" && "host:port format for gRPC"}
                    {serviceConfig.protocol === "rest" && "Full URL for REST API"}
                    {serviceConfig.protocol === "msgpack-rpc" && "host:port format"}
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    checked={serviceConfig.options?.insecureSkipVerify}
                    onCheckedChange={(checked) =>
                      setServiceConfig({
                        ...serviceConfig,
                        options: { ...serviceConfig.options, insecureSkipVerify: checked },
                      })
                    }
                  />
                  <Label>Skip TLS Verification</Label>
                </div>
              </div>

              <Separator />

              {/* Schema Configuration */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <FileCode className="h-4 w-4" />
                  Protocol Buffer Schema
                </h3>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Schema Content (.proto)</Label>
                    <div className="flex gap-2">
                      <Select
                        onValueChange={(template) => {
                          const content = PROTO_TEMPLATES[template as keyof typeof PROTO_TEMPLATES];
                          handleProtoChange(content);
                        }}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="Templates" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="simple">Calculator</SelectItem>
                          <SelectItem value="ml">ML Inference</SelectItem>
                          <SelectItem value="transform">Data Transform</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Textarea
                    className="font-mono text-sm h-64"
                    placeholder="Enter your .proto schema..."
                    value={serviceConfig.schemaContent}
                    onChange={(e) => handleProtoChange(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Schema File Path (on eKuiper server)</Label>
                  <Input
                    placeholder="/etc/kuiper/services/my_service.proto"
                    value={serviceConfig.schemaFile}
                    onChange={(e) =>
                      setServiceConfig({ ...serviceConfig, schemaFile: e.target.value })
                    }
                  />
                </div>
              </div>

              <Separator />

              {/* Detected Functions */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Code2 className="h-4 w-4" />
                  Detected Functions
                </h3>

                {serviceConfig.functions.length === 0 ? (
                  <div className="p-4 bg-muted rounded-lg text-center text-muted-foreground">
                    <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No functions detected. Add RPC definitions to your schema.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {serviceConfig.functions.map((func, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <Zap className="h-4 w-4 text-sota-blue" />
                          <div>
                            <p className="font-medium">{func.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Service: {func.serviceName}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline">
                          SELECT {func.name}(...)
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* Metadata */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Metadata (Optional)
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Author</Label>
                    <Input
                      placeholder="Your Name"
                      value={serviceConfig.author}
                      onChange={(e) =>
                        setServiceConfig({ ...serviceConfig, author: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input
                      placeholder="Service description"
                      value={serviceConfig.description}
                      onChange={(e) =>
                        setServiceConfig({ ...serviceConfig, description: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createServiceMutation.mutate(serviceConfig)}
              disabled={!serviceConfig.name || !serviceConfig.address || createServiceMutation.isPending}
            >
              {createServiceMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Registering...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Register Service
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ExternalFunctions;
