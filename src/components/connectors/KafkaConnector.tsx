"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Server,
  Plus,
  Edit,
  Trash2,
  MoreHorizontal,
  TestTube,
  CheckCircle,
  XCircle,
  RefreshCw,
  Zap,
  ArrowUpDown,
  Settings,
} from "lucide-react";

export type KafkaSecurityProtocol = "plaintext" | "ssl" | "sasl_plaintext" | "sasl_ssl";
export type KafkaSaslMechanism = "plain" | "scram-sha-256" | "scram-sha-512";

export interface KafkaConnection {
  id: string;
  name: string;
  bootstrapServers: string[];
  securityProtocol: KafkaSecurityProtocol;
  saslMechanism?: KafkaSaslMechanism;
  saslUsername?: string;
  saslPassword?: string;
  sslCertPath?: string;
  sslKeyPath?: string;
  sslCaPath?: string;
  enabled: boolean;
  status: "connected" | "disconnected" | "error";
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface KafkaTopic {
  connectionId: string;
  name: string;
  partitions: number;
  replicationFactor: number;
  configs?: Record<string, string>;
}

export interface KafkaSourceConfig {
  id: string;
  connectionId: string;
  topic: string;
  groupId: string;
  offsetReset: "earliest" | "latest";
  keyDeserializer: "string" | "json" | "avro";
  valueDeserializer: "string" | "json" | "avro";
  schemaRegistryUrl?: string;
  maxPollRecords?: number;
  enabled: boolean;
}

export interface KafkaSinkConfig {
  id: string;
  connectionId: string;
  topic: string;
  keySerializer: "string" | "json" | "avro";
  valueSerializer: "string" | "json" | "avro";
  schemaRegistryUrl?: string;
  acks: "0" | "1" | "all";
  compression: "none" | "gzip" | "snappy" | "lz4" | "zstd";
  batchSize?: number;
  lingerMs?: number;
  enabled: boolean;
}

// Demo connections
const DEMO_CONNECTIONS: KafkaConnection[] = [
  {
    id: "kafka-1",
    name: "Production Cluster",
    bootstrapServers: ["kafka-1.prod.example.com:9092", "kafka-2.prod.example.com:9092"],
    securityProtocol: "sasl_ssl",
    saslMechanism: "scram-sha-256",
    saslUsername: "ekuiper-prod",
    enabled: true,
    status: "connected",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "kafka-2",
    name: "Development Cluster",
    bootstrapServers: ["localhost:9092"],
    securityProtocol: "plaintext",
    enabled: true,
    status: "connected",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "kafka-3",
    name: "Staging Cluster",
    bootstrapServers: ["kafka.staging.example.com:9093"],
    securityProtocol: "ssl",
    enabled: false,
    status: "disconnected",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const DEMO_SOURCES: KafkaSourceConfig[] = [
  {
    id: "source-1",
    connectionId: "kafka-1",
    topic: "sensor-data",
    groupId: "ekuiper-sensors",
    offsetReset: "latest",
    keyDeserializer: "string",
    valueDeserializer: "json",
    maxPollRecords: 500,
    enabled: true,
  },
  {
    id: "source-2",
    connectionId: "kafka-2",
    topic: "events",
    groupId: "ekuiper-events",
    offsetReset: "earliest",
    keyDeserializer: "string",
    valueDeserializer: "json",
    enabled: true,
  },
];

const DEMO_SINKS: KafkaSinkConfig[] = [
  {
    id: "sink-1",
    connectionId: "kafka-1",
    topic: "processed-data",
    keySerializer: "string",
    valueSerializer: "json",
    acks: "all",
    compression: "gzip",
    batchSize: 16384,
    lingerMs: 5,
    enabled: true,
  },
];

export function KafkaConnector() {
  const [connections, setConnections] = useState<KafkaConnection[]>(DEMO_CONNECTIONS);
  const [sources, setSources] = useState<KafkaSourceConfig[]>(DEMO_SOURCES);
  const [sinks, setSinks] = useState<KafkaSinkConfig[]>(DEMO_SINKS);
  const [isAddConnectionOpen, setIsAddConnectionOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<KafkaConnection | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const handleToggleConnection = (connId: string) => {
    setConnections((prev) =>
      prev.map((c) =>
        c.id === connId
          ? {
              ...c,
              enabled: !c.enabled,
              status: !c.enabled ? "connected" : "disconnected",
              updatedAt: new Date().toISOString(),
            }
          : c
      )
    );
  };

  const handleDeleteConnection = (connId: string) => {
    setConnections((prev) => prev.filter((c) => c.id !== connId));
    setSources((prev) => prev.filter((s) => s.connectionId !== connId));
    setSinks((prev) => prev.filter((s) => s.connectionId !== connId));
  };

  const handleTestConnection = async (connId: string) => {
    setTestingId(connId);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setTestingId(null);
  };

  const getStatusBadge = (status: KafkaConnection["status"]) => {
    switch (status) {
      case "connected":
        return <Badge className="bg-green-500">Connected</Badge>;
      case "error":
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="secondary">Disconnected</Badge>;
    }
  };

  const connectedCount = connections.filter((c) => c.status === "connected").length;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Kafka Clusters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{connections.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Connected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{connectedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Sources
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {sources.filter((s) => s.enabled).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Sinks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {sinks.filter((s) => s.enabled).length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="connections" className="space-y-4">
        <TabsList>
          <TabsTrigger value="connections">Connections</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="sinks">Sinks</TabsTrigger>
        </TabsList>

        <TabsContent value="connections">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="h-5 w-5" />
                    Kafka Connections
                  </CardTitle>
                  <CardDescription>
                    Manage Kafka cluster connections
                  </CardDescription>
                </div>
                <Dialog open={isAddConnectionOpen} onOpenChange={setIsAddConnectionOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Connection
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Add Kafka Connection</DialogTitle>
                      <DialogDescription>
                        Configure connection to a Kafka cluster
                      </DialogDescription>
                    </DialogHeader>
                    <ConnectionForm
                      onSubmit={(conn) => {
                        setConnections((prev) => [
                          ...prev,
                          {
                            ...conn,
                            id: `kafka-${Date.now()}`,
                            status: "disconnected",
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                          },
                        ]);
                        setIsAddConnectionOpen(false);
                      }}
                      onCancel={() => setIsAddConnectionOpen(false)}
                    />
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Bootstrap Servers</TableHead>
                      <TableHead>Security</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Enabled</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {connections.map((conn) => (
                      <TableRow key={conn.id}>
                        <TableCell className="font-medium">{conn.name}</TableCell>
                        <TableCell>
                          <div className="text-xs font-mono">
                            {conn.bootstrapServers[0]}
                            {conn.bootstrapServers.length > 1 && (
                              <span className="text-muted-foreground">
                                {" "}+{conn.bootstrapServers.length - 1} more
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {conn.securityProtocol.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>{getStatusBadge(conn.status)}</TableCell>
                        <TableCell>
                          <Switch
                            checked={conn.enabled}
                            onCheckedChange={() => handleToggleConnection(conn.id)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => setEditingConnection(conn)}
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleTestConnection(conn.id)}
                                disabled={testingId === conn.id}
                              >
                                {testingId === conn.id ? (
                                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <TestTube className="mr-2 h-4 w-4" />
                                )}
                                Test Connection
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => handleDeleteConnection(conn.id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sources">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ArrowUpDown className="h-5 w-5" />
                    Kafka Sources
                  </CardTitle>
                  <CardDescription>
                    Configure Kafka topic consumers
                  </CardDescription>
                </div>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Source
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Topic</TableHead>
                      <TableHead>Connection</TableHead>
                      <TableHead>Consumer Group</TableHead>
                      <TableHead>Offset</TableHead>
                      <TableHead>Format</TableHead>
                      <TableHead>Enabled</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sources.map((source) => {
                      const conn = connections.find((c) => c.id === source.connectionId);
                      return (
                        <TableRow key={source.id}>
                          <TableCell className="font-mono">{source.topic}</TableCell>
                          <TableCell>{conn?.name || "Unknown"}</TableCell>
                          <TableCell className="text-xs">{source.groupId}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{source.offsetReset}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{source.valueDeserializer}</Badge>
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={source.enabled}
                              onCheckedChange={() =>
                                setSources((prev) =>
                                  prev.map((s) =>
                                    s.id === source.id ? { ...s, enabled: !s.enabled } : s
                                  )
                                )
                              }
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm">
                              <Settings className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sinks">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    Kafka Sinks
                  </CardTitle>
                  <CardDescription>
                    Configure Kafka topic producers
                  </CardDescription>
                </div>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Sink
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Topic</TableHead>
                      <TableHead>Connection</TableHead>
                      <TableHead>Acks</TableHead>
                      <TableHead>Compression</TableHead>
                      <TableHead>Format</TableHead>
                      <TableHead>Enabled</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sinks.map((sink) => {
                      const conn = connections.find((c) => c.id === sink.connectionId);
                      return (
                        <TableRow key={sink.id}>
                          <TableCell className="font-mono">{sink.topic}</TableCell>
                          <TableCell>{conn?.name || "Unknown"}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{sink.acks}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{sink.compression}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{sink.valueSerializer}</Badge>
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={sink.enabled}
                              onCheckedChange={() =>
                                setSinks((prev) =>
                                  prev.map((s) =>
                                    s.id === sink.id ? { ...s, enabled: !s.enabled } : s
                                  )
                                )
                              }
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm">
                              <Settings className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog
        open={!!editingConnection}
        onOpenChange={(open) => !open && setEditingConnection(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Kafka Connection</DialogTitle>
          </DialogHeader>
          {editingConnection && (
            <ConnectionForm
              connection={editingConnection}
              onSubmit={(updated) => {
                setConnections((prev) =>
                  prev.map((c) =>
                    c.id === editingConnection.id
                      ? { ...c, ...updated, updatedAt: new Date().toISOString() }
                      : c
                  )
                );
                setEditingConnection(null);
              }}
              onCancel={() => setEditingConnection(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface ConnectionFormProps {
  connection?: KafkaConnection;
  onSubmit: (conn: Omit<KafkaConnection, "id" | "createdAt" | "updatedAt" | "status">) => void;
  onCancel: () => void;
}

function ConnectionForm({ connection, onSubmit, onCancel }: ConnectionFormProps) {
  const [formData, setFormData] = useState({
    name: connection?.name || "",
    bootstrapServers: connection?.bootstrapServers.join(", ") || "",
    securityProtocol: connection?.securityProtocol || "plaintext" as KafkaSecurityProtocol,
    saslMechanism: connection?.saslMechanism || "plain" as KafkaSaslMechanism,
    saslUsername: connection?.saslUsername || "",
    saslPassword: connection?.saslPassword || "",
    sslCertPath: connection?.sslCertPath || "",
    sslKeyPath: connection?.sslKeyPath || "",
    sslCaPath: connection?.sslCaPath || "",
    enabled: connection?.enabled ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name: formData.name,
      bootstrapServers: formData.bootstrapServers.split(",").map((s) => s.trim()).filter(Boolean),
      securityProtocol: formData.securityProtocol,
      saslMechanism: formData.securityProtocol.includes("sasl") ? formData.saslMechanism : undefined,
      saslUsername: formData.securityProtocol.includes("sasl") ? formData.saslUsername : undefined,
      saslPassword: formData.securityProtocol.includes("sasl") ? formData.saslPassword : undefined,
      sslCertPath: formData.securityProtocol.includes("ssl") ? formData.sslCertPath : undefined,
      sslKeyPath: formData.securityProtocol.includes("ssl") ? formData.sslKeyPath : undefined,
      sslCaPath: formData.securityProtocol.includes("ssl") ? formData.sslCaPath : undefined,
      enabled: formData.enabled,
    });
  };

  const showSaslOptions = formData.securityProtocol.includes("sasl");
  const showSslOptions = formData.securityProtocol.includes("ssl");

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Connection Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="Production Cluster"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="servers">Bootstrap Servers</Label>
        <Textarea
          id="servers"
          value={formData.bootstrapServers}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, bootstrapServers: e.target.value }))
          }
          placeholder="kafka-1:9092, kafka-2:9092"
          rows={2}
          required
        />
        <p className="text-xs text-muted-foreground">Comma-separated list of brokers</p>
      </div>

      <div className="space-y-2">
        <Label>Security Protocol</Label>
        <Select
          value={formData.securityProtocol}
          onValueChange={(v: KafkaSecurityProtocol) =>
            setFormData((prev) => ({ ...prev, securityProtocol: v }))
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="plaintext">Plaintext</SelectItem>
            <SelectItem value="ssl">SSL</SelectItem>
            <SelectItem value="sasl_plaintext">SASL Plaintext</SelectItem>
            <SelectItem value="sasl_ssl">SASL SSL</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {showSaslOptions && (
        <>
          <div className="space-y-2">
            <Label>SASL Mechanism</Label>
            <Select
              value={formData.saslMechanism}
              onValueChange={(v: KafkaSaslMechanism) =>
                setFormData((prev) => ({ ...prev, saslMechanism: v }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="plain">PLAIN</SelectItem>
                <SelectItem value="scram-sha-256">SCRAM-SHA-256</SelectItem>
                <SelectItem value="scram-sha-512">SCRAM-SHA-512</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="username">SASL Username</Label>
              <Input
                id="username"
                value={formData.saslUsername}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, saslUsername: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">SASL Password</Label>
              <Input
                id="password"
                type="password"
                value={formData.saslPassword}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, saslPassword: e.target.value }))
                }
              />
            </div>
          </div>
        </>
      )}

      {showSslOptions && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sslCa">CA Certificate Path</Label>
            <Input
              id="sslCa"
              value={formData.sslCaPath}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, sslCaPath: e.target.value }))
              }
              placeholder="/etc/ssl/kafka/ca.pem"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sslCert">Client Certificate Path</Label>
            <Input
              id="sslCert"
              value={formData.sslCertPath}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, sslCertPath: e.target.value }))
              }
              placeholder="/etc/ssl/kafka/client.pem"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sslKey">Client Key Path</Label>
            <Input
              id="sslKey"
              value={formData.sslKeyPath}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, sslKeyPath: e.target.value }))
              }
              placeholder="/etc/ssl/kafka/client-key.pem"
            />
          </div>
        </div>
      )}

      <div className="flex items-center space-x-2">
        <Switch
          id="enabled"
          checked={formData.enabled}
          onCheckedChange={(checked) =>
            setFormData((prev) => ({ ...prev, enabled: checked }))
          }
        />
        <Label htmlFor="enabled">Enable connection</Label>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!formData.name || !formData.bootstrapServers}>
          {connection ? "Update" : "Create"} Connection
        </Button>
      </DialogFooter>
    </form>
  );
}
