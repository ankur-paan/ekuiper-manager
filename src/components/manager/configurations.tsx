"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JsonEditor } from "@/components/editor/json-editor";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { 
  Settings,
  RefreshCw,
  Save,
  Plus,
  Trash2,
  Edit,
  Radio,
  Globe,
  Database,
  FileText,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Zap,
  XCircle,
  AlertTriangle
} from "lucide-react";
import { EKuiperManagerClient } from "@/lib/ekuiper/manager-client";
import { validateSourceConfig, validateSinkConfig, ConnectionTestResult } from "@/components/common/connection-tester";

interface ConfigurationsManagerProps {
  client: EKuiperManagerClient;
}

const SOURCE_TYPES = [
  { id: "mqtt", name: "MQTT", icon: Radio, description: "MQTT message broker" },
  { id: "httppull", name: "HTTP Pull", icon: Globe, description: "HTTP polling source" },
  { id: "httppush", name: "HTTP Push", icon: Globe, description: "HTTP webhook receiver" },
  { id: "memory", name: "Memory", icon: Database, description: "In-memory source" },
  { id: "file", name: "File", icon: FileText, description: "File-based source" },
  { id: "redis", name: "Redis", icon: Database, description: "Redis pub/sub" },
  { id: "sql", name: "SQL", icon: Database, description: "SQL database" },
];

const SINK_TYPES = [
  { id: "mqtt", name: "MQTT", icon: Radio, description: "MQTT message broker" },
  { id: "rest", name: "REST", icon: Globe, description: "HTTP REST API" },
  { id: "memory", name: "Memory", icon: Database, description: "In-memory sink" },
  { id: "log", name: "Log", icon: FileText, description: "Console logging" },
  { id: "file", name: "File", icon: FileText, description: "File output" },
  { id: "redis", name: "Redis", icon: Database, description: "Redis sink" },
  { id: "influx", name: "InfluxDB", icon: Database, description: "InfluxDB time-series" },
  { id: "tdengine", name: "TDengine", icon: Database, description: "TDengine time-series" },
];

const DEFAULT_CONFIGS: Record<string, Record<string, any>> = {
  mqtt: {
    server: "tcp://localhost:1883",
    username: "",
    password: "",
    clientId: "",
    protocolVersion: "3.1.1",
    qos: 0,
    retained: false,
  },
  httppull: {
    url: "http://localhost:8080/api/data",
    method: "GET",
    interval: 10000,
    timeout: 5000,
    headers: {},
    bodyType: "json",
  },
  rest: {
    url: "http://localhost:8080/api/sink",
    method: "POST",
    timeout: 5000,
    headers: {
      "Content-Type": "application/json",
    },
    sendSingle: true,
  },
  redis: {
    address: "localhost:6379",
    password: "",
    db: 0,
  },
  influx: {
    addr: "http://localhost:8086",
    token: "",
    org: "",
    bucket: "",
    measurement: "",
  },
  sql: {
    url: "mysql://user:password@localhost:3306/database",
  },
};

function ConfigTypeCard({
  id,
  name,
  icon: Icon,
  description,
  isSelected,
  onClick,
}: {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <Card
      className={cn(
        "cursor-pointer transition-all",
        isSelected ? "border-primary bg-primary/5" : "hover:border-primary/50"
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-lg",
            isSelected ? "bg-primary/10" : "bg-muted"
          )}>
            <Icon className={cn(
              "h-5 w-5",
              isSelected ? "text-primary" : "text-muted-foreground"
            )} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium">{name}</p>
            <p className="text-xs text-muted-foreground truncate">{description}</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}

export function ConfigurationsManager({ client }: ConfigurationsManagerProps) {
  const [activeTab, setActiveTab] = useState<"sources" | "sinks" | "connections">("sources");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [configKey, setConfigKey] = useState("default");
  const [configJson, setConfigJson] = useState("{}");
  const [isEditing, setIsEditing] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [testing, setTesting] = useState(false);

  const queryClient = useQueryClient();

  // Fetch source types
  const { data: sourceTypes = [] } = useQuery({
    queryKey: ["source-types"],
    queryFn: () => client.getSourceTypes(),
  });

  // Fetch sink types
  const { data: sinkTypes = [] } = useQuery({
    queryKey: ["sink-types"],
    queryFn: () => client.getSinkTypes(),
  });

  // Fetch config for selected type
  const { data: currentConfig, isLoading: loadingConfig, refetch: refetchConfig } = useQuery({
    queryKey: ["config", activeTab, selectedType],
    queryFn: async () => {
      if (!selectedType) return null;
      if (activeTab === "sources") {
        return client.getSourceConfigs(selectedType);
      } else if (activeTab === "sinks") {
        return client.getSinkConfigs(selectedType);
      }
      return null;
    },
    enabled: !!selectedType,
  });

  // Save config mutation
  const saveConfig = useMutation({
    mutationFn: async () => {
      if (!selectedType) throw new Error("No type selected");
      const config = JSON.parse(configJson);
      
      if (activeTab === "sources") {
        await client.updateSourceConfig(selectedType, configKey, config);
      } else if (activeTab === "sinks") {
        await client.updateSinkConfig(selectedType, configKey, config);
      }
    },
    onSuccess: () => {
      toast({ title: "Configuration saved" });
      setConfigDialogOpen(false);
      refetchConfig();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to save configuration",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleTypeSelect = (type: string) => {
    setSelectedType(type);
  };

  const handleNewConfig = () => {
    const defaultConfig = selectedType ? DEFAULT_CONFIGS[selectedType] || {} : {};
    setConfigKey("default");
    setConfigJson(JSON.stringify(defaultConfig, null, 2));
    setIsEditing(false);
    setTestResult(null);
    setConfigDialogOpen(true);
  };

  const handleEditConfig = (key: string, config: any) => {
    setConfigKey(key);
    setConfigJson(JSON.stringify(config, null, 2));
    setIsEditing(true);
    setTestResult(null);
    setConfigDialogOpen(true);
  };

  const handleTestConfig = async () => {
    if (!selectedType) return;
    setTesting(true);
    setTestResult(null);

    try {
      const config = JSON.parse(configJson);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const result = activeTab === "sources"
        ? validateSourceConfig(selectedType, config)
        : validateSinkConfig(selectedType, config);
      
      setTestResult(result);
    } catch {
      setTestResult({
        success: false,
        message: "Invalid JSON configuration",
      });
    }

    setTesting(false);
  };

  const types = activeTab === "sources" ? SOURCE_TYPES : SINK_TYPES;

  return (
    <div className="h-full flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurations
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage source and sink configuration templates
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => {
        setActiveTab(v as any);
        setSelectedType(null);
      }} className="flex-1 flex flex-col">
        <TabsList>
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="sinks">Sinks</TabsTrigger>
          <TabsTrigger value="connections">Connections</TabsTrigger>
        </TabsList>

        <TabsContent value="sources" className="flex-1 flex gap-4">
          {/* Type List */}
          <div className="w-72 space-y-2">
            {SOURCE_TYPES.map((type) => (
              <ConfigTypeCard
                key={type.id}
                {...type}
                isSelected={selectedType === type.id}
                onClick={() => handleTypeSelect(type.id)}
              />
            ))}
          </div>

          {/* Config Panel */}
          <div className="flex-1">
            {selectedType ? (
              <Card className="h-full">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{selectedType.toUpperCase()} Source Config</CardTitle>
                      <CardDescription>
                        Configure connection templates for {selectedType} sources
                      </CardDescription>
                    </div>
                    <Button onClick={handleNewConfig}>
                      <Plus className="h-4 w-4 mr-1" />
                      New Config
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingConfig ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin" />
                    </div>
                  ) : currentConfig ? (
                    <div className="space-y-3">
                      {Object.entries(currentConfig).map(([key, value]) => (
                        <Card key={key} className="hover:bg-muted/50 transition-colors">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">{key}</p>
                                <p className="text-xs text-muted-foreground font-mono truncate max-w-md">
                                  {JSON.stringify(value).slice(0, 100)}...
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditConfig(key, value)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No configurations found</p>
                      <Button className="mt-4" onClick={handleNewConfig}>
                        Create First Config
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="h-full flex items-center justify-center">
                <CardContent className="text-center text-muted-foreground">
                  <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Select a source type to view configurations</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="sinks" className="flex-1 flex gap-4">
          {/* Type List */}
          <div className="w-72 space-y-2">
            {SINK_TYPES.map((type) => (
              <ConfigTypeCard
                key={type.id}
                {...type}
                isSelected={selectedType === type.id}
                onClick={() => handleTypeSelect(type.id)}
              />
            ))}
          </div>

          {/* Config Panel */}
          <div className="flex-1">
            {selectedType ? (
              <Card className="h-full">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{selectedType.toUpperCase()} Sink Config</CardTitle>
                      <CardDescription>
                        Configure output templates for {selectedType} sinks
                      </CardDescription>
                    </div>
                    <Button onClick={handleNewConfig}>
                      <Plus className="h-4 w-4 mr-1" />
                      New Config
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingConfig ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin" />
                    </div>
                  ) : currentConfig ? (
                    <div className="space-y-3">
                      {Object.entries(currentConfig).map(([key, value]) => (
                        <Card key={key} className="hover:bg-muted/50 transition-colors">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">{key}</p>
                                <p className="text-xs text-muted-foreground font-mono truncate max-w-md">
                                  {JSON.stringify(value).slice(0, 100)}
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditConfig(key, value)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No configurations found</p>
                      <Button className="mt-4" onClick={handleNewConfig}>
                        Create First Config
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="h-full flex items-center justify-center">
                <CardContent className="text-center text-muted-foreground">
                  <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Select a sink type to view configurations</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="connections" className="flex-1">
          <Card className="h-full flex items-center justify-center">
            <CardContent className="text-center text-muted-foreground">
              <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">Shared Connections</p>
              <p className="text-sm max-w-md">
                Create reusable connection configurations that can be referenced 
                across multiple streams and rules.
              </p>
              <Button className="mt-4" variant="outline">
                Coming Soon
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Config Edit Dialog */}
      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="max-w-2xl h-[75vh]">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Edit" : "New"} {selectedType?.toUpperCase()} Configuration
            </DialogTitle>
            <DialogDescription>
              Configure the connection parameters. Test before saving.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-4 overflow-hidden">
            <div>
              <label className="text-sm font-medium mb-1 block">Configuration Key</label>
              <Input
                value={configKey}
                onChange={(e) => {
                  setConfigKey(e.target.value);
                  setTestResult(null);
                }}
                placeholder="default"
                disabled={isEditing}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use this key to reference this config in stream definitions
              </p>
            </div>

            <div className="flex-1 min-h-0">
              <label className="text-sm font-medium mb-1 block">Configuration</label>
              <JsonEditor
                value={configJson}
                onChange={(val) => {
                  setConfigJson(val);
                  setTestResult(null);
                }}
                height="250px"
              />
            </div>

            {/* Test Section */}
            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestConfig}
                  disabled={testing}
                >
                  {testing ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-2" />
                      Test Configuration
                    </>
                  )}
                </Button>

                {testResult && (
                  <Badge
                    variant={testResult.success ? "default" : "destructive"}
                    className={testResult.success ? "bg-green-500/20 text-green-500" : ""}
                  >
                    {testResult.success ? (
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                    ) : (
                      <XCircle className="h-3 w-3 mr-1" />
                    )}
                    {testResult.success ? "Valid" : "Invalid"}
                  </Badge>
                )}
              </div>

              {testResult && !testResult.success && (
                <div className="p-2 rounded bg-red-500/10 border border-red-500/30">
                  <p className="text-sm text-red-500">{testResult.message}</p>
                </div>
              )}

              {testResult?.warnings && testResult.warnings.length > 0 && (
                <div className="p-2 rounded bg-yellow-500/10 border border-yellow-500/30 space-y-1">
                  {testResult.warnings.map((warning, i) => (
                    <div key={i} className="flex items-center gap-1 text-sm text-yellow-500">
                      <AlertTriangle className="h-3 w-3" />
                      {warning}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {testResult?.success ? (
                <span className="text-green-500 flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" />
                  Configuration verified
                </span>
              ) : testResult ? (
                <span className="text-red-500">Fix issues before saving</span>
              ) : (
                <span>Test configuration before saving</span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setConfigDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => saveConfig.mutate()}
                disabled={testResult !== null && !testResult.success}
              >
                <Save className="h-4 w-4 mr-1" />
                Save Configuration
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
