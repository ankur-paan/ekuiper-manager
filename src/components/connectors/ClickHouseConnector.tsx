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
  Database,
  Plus,
  Edit,
  Trash2,
  MoreHorizontal,
  TestTube,
  RefreshCw,
  Play,
  Table as TableIcon,
  BarChart3,
  Settings,
  Clock,
} from "lucide-react";

export interface ClickHouseConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password?: string;
  secure: boolean;
  cluster?: string;
  enabled: boolean;
  status: "connected" | "disconnected" | "error";
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClickHouseTable {
  connectionId: string;
  database: string;
  name: string;
  engine: string;
  rowCount: number;
  columns: Array<{
    name: string;
    type: string;
    defaultKind?: string;
  }>;
}

export interface ClickHouseSinkConfig {
  id: string;
  connectionId: string;
  table: string;
  batchSize: number;
  flushInterval: number; // seconds
  columns: string[]; // Mapped columns
  asyncInsert: boolean;
  compressionMethod: "none" | "lz4" | "zstd";
  enabled: boolean;
}

export interface ClickHouseQuery {
  id: string;
  connectionId: string;
  name: string;
  query: string;
  lastRun?: string;
  avgDuration?: number;
  enabled: boolean;
}

// Demo data
const DEMO_CONNECTIONS: ClickHouseConnection[] = [
  {
    id: "ch-1",
    name: "Production Analytics",
    host: "clickhouse.prod.example.com",
    port: 9440,
    database: "analytics",
    username: "ekuiper",
    secure: true,
    cluster: "production",
    enabled: true,
    status: "connected",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "ch-2",
    name: "Local Development",
    host: "localhost",
    port: 9000,
    database: "default",
    username: "default",
    secure: false,
    enabled: true,
    status: "connected",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const DEMO_TABLES: ClickHouseTable[] = [
  {
    connectionId: "ch-1",
    database: "analytics",
    name: "sensor_data",
    engine: "MergeTree",
    rowCount: 1245890,
    columns: [
      { name: "timestamp", type: "DateTime64(3)" },
      { name: "sensor_id", type: "String" },
      { name: "temperature", type: "Float64" },
      { name: "humidity", type: "Float64" },
      { name: "pressure", type: "Float64" },
    ],
  },
  {
    connectionId: "ch-1",
    database: "analytics",
    name: "events",
    engine: "ReplacingMergeTree",
    rowCount: 856234,
    columns: [
      { name: "event_time", type: "DateTime" },
      { name: "event_type", type: "LowCardinality(String)" },
      { name: "payload", type: "String" },
    ],
  },
  {
    connectionId: "ch-2",
    database: "default",
    name: "test_data",
    engine: "MergeTree",
    rowCount: 1000,
    columns: [
      { name: "id", type: "UInt64" },
      { name: "value", type: "Float64" },
    ],
  },
];

const DEMO_SINKS: ClickHouseSinkConfig[] = [
  {
    id: "sink-1",
    connectionId: "ch-1",
    table: "sensor_data",
    batchSize: 10000,
    flushInterval: 5,
    columns: ["timestamp", "sensor_id", "temperature", "humidity", "pressure"],
    asyncInsert: true,
    compressionMethod: "lz4",
    enabled: true,
  },
];

export function ClickHouseConnector() {
  const [connections, setConnections] = useState<ClickHouseConnection[]>(DEMO_CONNECTIONS);
  const [tables] = useState<ClickHouseTable[]>(DEMO_TABLES);
  const [sinks, setSinks] = useState<ClickHouseSinkConfig[]>(DEMO_SINKS);
  const [isAddConnectionOpen, setIsAddConnectionOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<ClickHouseConnection | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [queryResult, setQueryResult] = useState<string | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null);
  const [testQuery, setTestQuery] = useState("SELECT 1");

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
    setSinks((prev) => prev.filter((s) => s.connectionId !== connId));
  };

  const handleTestConnection = async (connId: string) => {
    setTestingId(connId);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setTestingId(null);
  };

  const handleRunQuery = async () => {
    if (!selectedConnection || !testQuery) return;
    // Simulate query execution
    await new Promise((resolve) => setTimeout(resolve, 500));
    setQueryResult(JSON.stringify([{ result: 1 }], null, 2));
  };

  const getStatusBadge = (status: ClickHouseConnection["status"]) => {
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
              Connections
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
              Tables
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{tables.length}</div>
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
          <TabsTrigger value="tables">Tables</TabsTrigger>
          <TabsTrigger value="sinks">Sinks</TabsTrigger>
          <TabsTrigger value="query">Query</TabsTrigger>
        </TabsList>

        <TabsContent value="connections">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    ClickHouse Connections
                  </CardTitle>
                  <CardDescription>
                    Manage ClickHouse database connections
                  </CardDescription>
                </div>
                <Dialog open={isAddConnectionOpen} onOpenChange={setIsAddConnectionOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Connection
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add ClickHouse Connection</DialogTitle>
                      <DialogDescription>
                        Configure connection to a ClickHouse server
                      </DialogDescription>
                    </DialogHeader>
                    <ConnectionForm
                      onSubmit={(conn) => {
                        setConnections((prev) => [
                          ...prev,
                          {
                            ...conn,
                            id: `ch-${Date.now()}`,
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
                      <TableHead>Host</TableHead>
                      <TableHead>Database</TableHead>
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
                            {conn.host}:{conn.port}
                          </div>
                          {conn.secure && (
                            <Badge variant="outline" className="text-xs mt-1">
                              SSL
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{conn.database}</TableCell>
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

        <TabsContent value="tables">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TableIcon className="h-5 w-5" />
                Available Tables
              </CardTitle>
              <CardDescription>
                Browse ClickHouse tables and schemas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Connection</TableHead>
                      <TableHead>Database</TableHead>
                      <TableHead>Table</TableHead>
                      <TableHead>Engine</TableHead>
                      <TableHead>Rows</TableHead>
                      <TableHead>Columns</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tables.map((table, idx) => {
                      const conn = connections.find((c) => c.id === table.connectionId);
                      return (
                        <TableRow key={idx}>
                          <TableCell>{conn?.name || "Unknown"}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {table.database}
                          </TableCell>
                          <TableCell className="font-mono">{table.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{table.engine}</Badge>
                          </TableCell>
                          <TableCell>
                            {table.rowCount.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{table.columns.length}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm">
                              <BarChart3 className="h-4 w-4" />
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
                    <Database className="h-5 w-5" />
                    ClickHouse Sinks
                  </CardTitle>
                  <CardDescription>
                    Configure data sinks to ClickHouse tables
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
                      <TableHead>Connection</TableHead>
                      <TableHead>Table</TableHead>
                      <TableHead>Batch Size</TableHead>
                      <TableHead>Flush Interval</TableHead>
                      <TableHead>Compression</TableHead>
                      <TableHead>Enabled</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sinks.map((sink) => {
                      const conn = connections.find((c) => c.id === sink.connectionId);
                      return (
                        <TableRow key={sink.id}>
                          <TableCell>{conn?.name || "Unknown"}</TableCell>
                          <TableCell className="font-mono">{sink.table}</TableCell>
                          <TableCell>{sink.batchSize.toLocaleString()}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {sink.flushInterval}s
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{sink.compressionMethod}</Badge>
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

        <TabsContent value="query">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="h-5 w-5" />
                Query Editor
              </CardTitle>
              <CardDescription>
                Execute queries against ClickHouse
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <Select
                  value={selectedConnection || ""}
                  onValueChange={setSelectedConnection}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select connection" />
                  </SelectTrigger>
                  <SelectContent>
                    {connections
                      .filter((c) => c.status === "connected")
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleRunQuery}
                  disabled={!selectedConnection || !testQuery}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Run Query
                </Button>
              </div>

              <Textarea
                value={testQuery}
                onChange={(e) => setTestQuery(e.target.value)}
                placeholder="SELECT * FROM table LIMIT 10"
                className="font-mono"
                rows={5}
              />

              {queryResult && (
                <div className="border rounded-lg p-4 bg-muted/50">
                  <div className="text-sm font-medium mb-2">Result</div>
                  <pre className="text-xs font-mono overflow-auto max-h-[200px]">
                    {queryResult}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog
        open={!!editingConnection}
        onOpenChange={(open) => !open && setEditingConnection(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit ClickHouse Connection</DialogTitle>
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
  connection?: ClickHouseConnection;
  onSubmit: (conn: Omit<ClickHouseConnection, "id" | "createdAt" | "updatedAt" | "status">) => void;
  onCancel: () => void;
}

function ConnectionForm({ connection, onSubmit, onCancel }: ConnectionFormProps) {
  const [formData, setFormData] = useState({
    name: connection?.name || "",
    host: connection?.host || "",
    port: connection?.port || 9000,
    database: connection?.database || "default",
    username: connection?.username || "default",
    password: connection?.password || "",
    secure: connection?.secure || false,
    cluster: connection?.cluster || "",
    enabled: connection?.enabled ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      cluster: formData.cluster || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Connection Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="Production Analytics"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="host">Host</Label>
          <Input
            id="host"
            value={formData.host}
            onChange={(e) => setFormData((prev) => ({ ...prev, host: e.target.value }))}
            placeholder="localhost"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="port">Port</Label>
          <Input
            id="port"
            type="number"
            value={formData.port}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, port: parseInt(e.target.value) || 9000 }))
            }
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="database">Database</Label>
        <Input
          id="database"
          value={formData.database}
          onChange={(e) => setFormData((prev) => ({ ...prev, database: e.target.value }))}
          placeholder="default"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            value={formData.username}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, username: e.target.value }))
            }
            placeholder="default"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={formData.password}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, password: e.target.value }))
            }
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="cluster">Cluster (optional)</Label>
        <Input
          id="cluster"
          value={formData.cluster}
          onChange={(e) => setFormData((prev) => ({ ...prev, cluster: e.target.value }))}
          placeholder="production"
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Switch
            id="secure"
            checked={formData.secure}
            onCheckedChange={(checked) =>
              setFormData((prev) => ({ ...prev, secure: checked }))
            }
          />
          <Label htmlFor="secure">Use SSL/TLS</Label>
        </div>
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
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!formData.name || !formData.host}>
          {connection ? "Update" : "Create"} Connection
        </Button>
      </DialogFooter>
    </form>
  );
}
