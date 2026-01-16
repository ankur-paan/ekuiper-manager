"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JsonEditor } from "@/components/editor/json-editor";
import { toast } from "@/hooks/use-toast";
import { 
  Plus, 
  Search, 
  RefreshCw, 
  Link2,
  Trash2,
  Edit,
  Play,
  CheckCircle2,
  XCircle,
  Radio,
  Database,
  Server,
  Wifi,
  Zap,
  AlertTriangle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { validateSourceConfig, ConnectionTestResult } from "@/components/common/connection-tester";
import { EKuiperManagerClient } from "@/lib/ekuiper/manager-client";
import type { SharedConnection } from "@/lib/ekuiper/manager-types";

interface ConnectionsManagerProps {
  client: EKuiperManagerClient;
}

const CONNECTION_TYPES = [
  { 
    id: "mqtt", 
    name: "MQTT", 
    icon: Radio, 
    color: "text-green-500",
    defaultConfig: {
      server: "tcp://broker.emqx.io:1883",
      username: "",
      password: "",
      clientId: "",
      protocolVersion: "3.1.1",
      qos: 1,
    }
  },
  { 
    id: "redis", 
    name: "Redis", 
    icon: Database, 
    color: "text-red-500",
    defaultConfig: {
      address: "localhost:6379",
      db: 0,
      password: "",
    }
  },
  { 
    id: "sql", 
    name: "SQL Database", 
    icon: Server, 
    color: "text-blue-500",
    defaultConfig: {
      url: "",
      driver: "mysql",
      table: "",
    }
  },
  { 
    id: "edgex", 
    name: "EdgeX", 
    icon: Wifi, 
    color: "text-purple-500",
    defaultConfig: {
      server: "localhost",
      port: 5563,
      protocol: "tcp",
      type: "zero",
    }
  },
];

export function ConnectionsManager({ client }: ConnectionsManagerProps) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [testingConnection, setTestingConnection] = useState<string | null>(null);
  const [connectionResults, setConnectionResults] = useState<Record<string, boolean>>({});

  // Form state
  const [newConnection, setNewConnection] = useState({
    id: "",
    type: "mqtt",
    props: JSON.stringify(CONNECTION_TYPES[0].defaultConfig, null, 2),
  });

  // Fetch connections
  const { data: connections = [], isLoading, refetch } = useQuery({
    queryKey: ["connections"],
    queryFn: () => client.listConnections(),
  });

  // Create connection mutation
  const createMutation = useMutation({
    mutationFn: (conn: { id: string; type: string; props: any }) =>
      client.createConnection(conn.id, conn.type, conn.props),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["connections"] });
      setCreateDialogOpen(false);
      setNewConnection({
        id: "",
        type: "mqtt",
        props: JSON.stringify(CONNECTION_TYPES[0].defaultConfig, null, 2),
      });
      toast({ title: "Connection created successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create connection",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete connection mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => client.deleteConnection(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["connections"] });
      toast({ title: "Connection deleted successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete connection",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Test connection mutation
  const testMutation = useMutation({
    mutationFn: async (conn: { type: string; config: any }) => {
      return client.testSharedConnection(conn.type, conn.config);
    },
    onSuccess: (result, variables) => {
      setConnectionResults((prev) => ({
        ...prev,
        [testingConnection!]: result.success,
      }));
      toast({
        title: result.success ? "Connection successful" : "Connection failed",
        description: result.message,
        variant: result.success ? "default" : "destructive",
      });
    },
    onError: (error: Error) => {
      setConnectionResults((prev) => ({
        ...prev,
        [testingConnection!]: false,
      }));
      toast({
        title: "Connection test failed",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setTestingConnection(null);
    },
  });

  // Filter connections
  const filteredConnections = connections.filter((conn: SharedConnection) => {
    const matchesSearch = conn.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === "all" || conn.type === selectedType;
    return matchesSearch && matchesType;
  });

  const getConnectionTypeInfo = (type: string) => 
    CONNECTION_TYPES.find((t) => t.id === type) || CONNECTION_TYPES[0];

  const handleCreate = () => {
    try {
      const props = JSON.parse(newConnection.props);
      createMutation.mutate({
        id: newConnection.id,
        type: newConnection.type,
        props,
      });
    } catch {
      toast({
        title: "Invalid configuration",
        description: "Please enter valid JSON",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="h-full flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Connection Management
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage shared connections for sources and sinks
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            New Connection
          </Button>
        </div>
      </div>

      {/* Connection Type Selector */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={selectedType === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedType("all")}
        >
          All
        </Button>
        {CONNECTION_TYPES.map((type) => (
          <Button
            key={type.id}
            variant={selectedType === type.id ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedType(type.id)}
            className="gap-2"
          >
            <type.icon className={cn("h-4 w-4", type.color)} />
            {type.name}
          </Button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search connections..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Connections Grid */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <RefreshCw className="h-6 w-6 animate-spin" />
          </div>
        ) : filteredConnections.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <Link2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No connections found</p>
              <p className="text-sm mt-1">Create a shared connection to get started</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredConnections.map((conn: SharedConnection) => {
              const typeInfo = getConnectionTypeInfo(conn.type);
              const testResult = connectionResults[conn.id];
              
              return (
                <Card key={conn.id} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn("p-2 rounded-lg bg-muted", typeInfo.color)}>
                          <typeInfo.icon className="h-5 w-5" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{conn.id}</CardTitle>
                          <CardDescription className="text-xs">
                            {typeInfo.name}
                          </CardDescription>
                        </div>
                      </div>
                      {testResult !== undefined && (
                        <Badge
                          variant={testResult ? "success" : "destructive"}
                          className={testResult ? "bg-green-500/10 text-green-500" : ""}
                        >
                          {testResult ? (
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                          ) : (
                            <XCircle className="h-3 w-3 mr-1" />
                          )}
                          {testResult ? "Connected" : "Failed"}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Config Summary */}
                    <div className="text-xs text-muted-foreground font-mono bg-muted p-2 rounded mb-3 overflow-hidden">
                      {conn.type === "mqtt" && conn.props?.server}
                      {conn.type === "redis" && conn.props?.address}
                      {conn.type === "sql" && `${conn.props?.driver}://${conn.props?.url}`}
                      {conn.type === "edgex" && `${conn.props?.server}:${conn.props?.port}`}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          setTestingConnection(conn.id);
                          testMutation.mutate({ type: conn.type, config: conn.props });
                        }}
                        disabled={testingConnection === conn.id}
                      >
                        {testingConnection === conn.id ? (
                          <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4 mr-1" />
                        )}
                        Test
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Delete connection "${conn.id}"?`)) {
                            deleteMutation.mutate(conn.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Connection Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl h-[75vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Create Shared Connection</DialogTitle>
            <DialogDescription>
              Create a reusable connection configuration. Test before saving.
            </DialogDescription>
          </DialogHeader>

          <CreateConnectionForm
            value={newConnection}
            onChange={setNewConnection}
            onSubmit={handleCreate}
            onCancel={() => setCreateDialogOpen(false)}
            isSubmitting={createMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Separate form component with testing
function CreateConnectionForm({
  value,
  onChange,
  onSubmit,
  onCancel,
  isSubmitting,
}: {
  value: { id: string; type: string; props: string };
  onChange: (value: { id: string; type: string; props: string }) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isSubmitting: boolean;
}) {
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [testing, setTesting] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const props = JSON.parse(value.props);
      await new Promise(resolve => setTimeout(resolve, 500));
      const result = validateSourceConfig(value.type, props);
      setTestResult(result);
    } catch {
      setTestResult({
        success: false,
        message: "Invalid JSON configuration",
      });
    }

    setTesting(false);
  };

  return (
    <>
      <div className="flex-1 flex flex-col gap-4 overflow-hidden">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Connection ID</Label>
            <Input
              placeholder="my_mqtt_connection"
              value={value.id}
              onChange={(e) => {
                onChange({ ...value, id: e.target.value });
                setTestResult(null);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select
              value={value.type}
              onValueChange={(val) => {
                const typeInfo = CONNECTION_TYPES.find((t) => t.id === val)!;
                onChange({
                  ...value,
                  type: val,
                  props: JSON.stringify(typeInfo.defaultConfig, null, 2),
                });
                setTestResult(null);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONNECTION_TYPES.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    <div className="flex items-center gap-2">
                      <type.icon className={cn("h-4 w-4", type.color)} />
                      {type.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col">
          <Label>Properties</Label>
          <div className="flex-1 mt-2">
            <JsonEditor
              value={value.props}
              onChange={(val) => {
                onChange({ ...value, props: val });
                setTestResult(null);
              }}
              height="100%"
            />
          </div>
        </div>

        {/* Test Section */}
        <div className="border-t pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={handleTest}
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
            <span className="text-red-500">Fix issues before creating</span>
          ) : (
            <span>Test configuration before creating</span>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={!value.id || isSubmitting || (testResult !== null && !testResult.success)}
          >
            {isSubmitting && <RefreshCw className="h-4 w-4 mr-1 animate-spin" />}
            Create Connection
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}
