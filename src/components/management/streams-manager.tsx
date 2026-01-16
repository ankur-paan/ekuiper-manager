"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SQLEditor } from "@/components/editor/sql-editor";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { 
  Plus, 
  Trash2, 
  Edit, 
  RefreshCw, 
  Database, 
  Table, 
  Search,
  ChevronRight,
  Info,
  Copy,
  Check,
  Zap
} from "lucide-react";
import { EKuiperClient, Stream, StreamListItem, Table as TableType } from "@/lib/ekuiper";
import { StreamSQLTester, ConnectionTestResult } from "@/components/common/connection-tester";

interface StreamsManagerProps {
  client: EKuiperClient;
}

const STREAM_TEMPLATES = [
  {
    name: "MQTT Stream",
    sql: `CREATE STREAM mqtt_stream (
  deviceId STRING,
  temperature FLOAT,
  humidity FLOAT,
  timestamp BIGINT
) WITH (
  DATASOURCE = "demo/sensor",
  FORMAT = "JSON",
  TYPE = "mqtt"
);`,
  },
  {
    name: "EdgeX Stream",
    sql: `CREATE STREAM edgex_stream () WITH (
  FORMAT = "JSON",
  TYPE = "edgex"
);`,
  },
  {
    name: "HTTP Pull Stream",
    sql: `CREATE STREAM http_stream (
  data ARRAY(STRUCT(id STRING, value FLOAT))
) WITH (
  DATASOURCE = "/api/data",
  FORMAT = "JSON",
  TYPE = "httppull",
  CONF_KEY = "default"
);`,
  },
  {
    name: "HTTP Push Stream",
    sql: `CREATE STREAM webhook_stream (
  event STRING,
  data STRUCT(id STRING, value FLOAT)
) WITH (
  DATASOURCE = "/webhook",
  FORMAT = "JSON",
  TYPE = "httppush"
);`,
  },
  {
    name: "Memory Stream",
    sql: `CREATE STREAM memory_stream (
  id STRING,
  value FLOAT
) WITH (
  DATASOURCE = "topic1",
  FORMAT = "JSON",
  TYPE = "memory"
);`,
  },
  {
    name: "Kafka Stream",
    sql: `CREATE STREAM kafka_stream (
  key STRING,
  value STRING,
  timestamp BIGINT
) WITH (
  DATASOURCE = "my-topic",
  FORMAT = "JSON",
  TYPE = "kafka",
  CONF_KEY = "default"
);`,
  },
  {
    name: "Redis Pub/Sub Stream",
    sql: `CREATE STREAM redis_stream (
  channel STRING,
  message STRING
) WITH (
  DATASOURCE = "my-channel",
  FORMAT = "JSON",
  TYPE = "redis",
  CONF_KEY = "default"
);`,
  },
  {
    name: "SQL Polling Stream",
    sql: `CREATE STREAM sql_stream (
  id BIGINT,
  name STRING,
  value FLOAT,
  created_at DATETIME
) WITH (
  DATASOURCE = "SELECT * FROM sensor_data WHERE id > {{.lastId}}",
  FORMAT = "JSON",
  TYPE = "sql",
  CONF_KEY = "mysql"
);`,
  },
  {
    name: "File Stream",
    sql: `CREATE STREAM file_stream (
  line STRING
) WITH (
  DATASOURCE = "/data/input.json",
  FORMAT = "JSON",
  TYPE = "file"
);`,
  },
  {
    name: "Video Stream",
    sql: `CREATE STREAM video_stream (
  image BYTEA,
  timestamp BIGINT
) WITH (
  DATASOURCE = "rtsp://localhost:8554/stream",
  FORMAT = "BINARY",
  TYPE = "video",
  CONF_KEY = "default"
);`,
  },
  {
    name: "ZeroMQ Stream",
    sql: `CREATE STREAM zmq_stream (
  data STRING
) WITH (
  DATASOURCE = "tcp://localhost:5563",
  FORMAT = "JSON",
  TYPE = "zmq"
);`,
  },
  {
    name: "Neuron Stream",
    sql: `CREATE STREAM neuron_stream (
  node STRING,
  group STRING,
  values STRUCT(tag1 FLOAT, tag2 FLOAT)
) WITH (
  FORMAT = "JSON",
  TYPE = "neuron"
);`,
  },
];

const TABLE_TEMPLATES = [
  {
    name: "Lookup Table",
    sql: `CREATE TABLE device_config (
  deviceId STRING,
  threshold FLOAT,
  alertEnabled BOOLEAN
) WITH (
  DATASOURCE = "config/devices",
  FORMAT = "JSON",
  TYPE = "file"
);`,
  },
  {
    name: "Memory Table",
    sql: `CREATE TABLE state_table (
  id STRING,
  lastValue FLOAT,
  count BIGINT
) WITH (
  DATASOURCE = "state",
  FORMAT = "JSON",
  TYPE = "memory",
  KIND = "lookup"
);`,
  },
];

function StreamCard({
  stream,
  onDescribe,
  onDelete,
}: {
  stream: StreamListItem;
  onDescribe: () => void;
  onDelete: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(stream.name);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="group hover:border-primary/50 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Database className="h-5 w-5 text-sota-blue" />
            <div>
              <div className="font-medium flex items-center gap-2">
                {stream.name}
                <button
                  onClick={copyToClipboard}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {copied ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3 text-muted-foreground" />
                  )}
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="sm" onClick={onDescribe}>
              <Info className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onDelete} className="text-red-500 hover:text-red-600">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CreateStreamDialog({
  open,
  onOpenChange,
  onSubmit,
  type = "stream",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (sql: string) => void;
  type?: "stream" | "table";
}) {
  const templates = type === "stream" ? STREAM_TEMPLATES : TABLE_TEMPLATES;
  const [sql, setSql] = useState(templates[0].sql);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = () => {
    setIsCreating(true);
    onSubmit(sql);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh]">
        <DialogHeader>
          <DialogTitle>Create {type === "stream" ? "Stream" : "Table"}</DialogTitle>
          <DialogDescription>
            Define your {type} using eKuiper SQL syntax. Test the configuration before creating.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          <div className="flex gap-2 flex-wrap">
            {templates.map((template) => (
              <Button
                key={template.name}
                variant="outline"
                size="sm"
                onClick={() => {
                  setSql(template.sql);
                  setTestResult(null);
                }}
              >
                {template.name}
              </Button>
            ))}
          </div>

          <div className="flex-1 min-h-0">
            <SQLEditor
              value={sql}
              onChange={(value) => {
                setSql(value);
                setTestResult(null);
              }}
              height="300px"
            />
          </div>

          {/* Connection Tester */}
          <div className="border-t pt-4">
            <StreamSQLTester 
              sql={sql} 
              onResult={setTestResult}
            />
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {testResult?.success ? (
              <span className="text-green-500 flex items-center gap-1">
                <Zap className="h-4 w-4" />
                Configuration verified
              </span>
            ) : testResult ? (
              <span className="text-red-500">Fix configuration issues before creating</span>
            ) : (
              <span>Test configuration before creating</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={isCreating || (testResult !== null && !testResult.success)}
            >
              {isCreating ? "Creating..." : "Create"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DescribeDialog({
  open,
  onOpenChange,
  name,
  schema,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  schema: Record<string, any> | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{name} Schema</DialogTitle>
        </DialogHeader>
        <div className="bg-muted p-4 rounded-lg overflow-auto max-h-[400px]">
          <pre className="text-sm">
            {schema ? JSON.stringify(schema, null, 2) : "Loading..."}
          </pre>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function StreamsManager({ client }: StreamsManagerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createType, setCreateType] = useState<"stream" | "table">("stream");
  const [describeTarget, setDescribeTarget] = useState<{
    name: string;
    type: "stream" | "table";
  } | null>(null);
  const [describeSchema, setDescribeSchema] = useState<Record<string, any> | null>(null);

  const queryClient = useQueryClient();

  // Fetch streams - with retry and error handling
  const { data: streams = [], isLoading: loadingStreams, error: streamsError, refetch: refetchStreams } = useQuery({
    queryKey: ["streams"],
    queryFn: async () => {
      const result = await client.listStreams();
      console.log('Streams API result:', result);
      // Ensure we return an array
      return Array.isArray(result) ? result : [];
    },
    retry: 1,
    retryDelay: 1000,
    refetchOnWindowFocus: false,
    staleTime: 30000, // Don't refetch for 30 seconds
  });

  // Fetch tables - with retry and error handling
  const { data: tables = [], isLoading: loadingTables, error: tablesError, refetch: refetchTables } = useQuery({
    queryKey: ["tables"],
    queryFn: async () => {
      const result = await client.listTables();
      console.log('Tables API result:', result);
      // Ensure we return an array
      return Array.isArray(result) ? result : [];
    },
    retry: 1,
    retryDelay: 1000,
    refetchOnWindowFocus: false,
    staleTime: 30000, // Don't refetch for 30 seconds
  });

  // Create stream mutation
  const createStream = useMutation({
    mutationFn: (sql: string) => client.createStream(sql),
    onSuccess: () => {
      toast({ title: "Stream created successfully" });
      queryClient.invalidateQueries({ queryKey: ["streams"] });
      setCreateDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create stream",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Create table mutation
  const createTable = useMutation({
    mutationFn: (sql: string) => client.createTable(sql),
    onSuccess: () => {
      toast({ title: "Table created successfully" });
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      setCreateDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create table",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete stream mutation
  const deleteStream = useMutation({
    mutationFn: (name: string) => client.deleteStream(name),
    onSuccess: () => {
      toast({ title: "Stream deleted" });
      queryClient.invalidateQueries({ queryKey: ["streams"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete stream",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete table mutation
  const deleteTable = useMutation({
    mutationFn: (name: string) => client.deleteTable(name),
    onSuccess: () => {
      toast({ title: "Table deleted" });
      queryClient.invalidateQueries({ queryKey: ["tables"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete table",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Describe stream/table
  useEffect(() => {
    if (describeTarget) {
      setDescribeSchema(null);
      const fetchSchema = async () => {
        try {
          const schema = describeTarget.type === "stream"
            ? await client.getStream(describeTarget.name)
            : await client.getTable(describeTarget.name);
          setDescribeSchema(schema);
        } catch (error) {
          setDescribeSchema({ error: "Failed to load schema" });
        }
      };
      fetchSchema();
    }
  }, [describeTarget, client]);

  const handleCreate = (sql: string) => {
    if (createType === "stream") {
      createStream.mutate(sql);
    } else {
      createTable.mutate(sql);
    }
  };

  const openCreateDialog = (type: "stream" | "table") => {
    setCreateType(type);
    setCreateDialogOpen(true);
  };

  const filteredStreams = streams.filter((s: StreamListItem) => {
    if (!s || typeof s !== 'object') return false;
    const name = s.name || '';
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const filteredTables = tables.filter((t: StreamListItem) => {
    if (!t || typeof t !== 'object') return false;
    const name = t.name || '';
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Show connection error state
  const hasConnectionError = streamsError || tablesError;
  const connectionErrorMessage = (streamsError as Error)?.message || (tablesError as Error)?.message;

  if (hasConnectionError && !loadingStreams && !loadingTables) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8">
        <Card className="max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <Database className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle>Connection Failed</CardTitle>
            <CardDescription>
              Unable to connect to the eKuiper server
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 bg-red-50 rounded-lg text-sm text-red-700">
              {connectionErrorMessage || "Could not reach the eKuiper server. Please check your connection settings."}
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => {
                  refetchStreams();
                  refetchTables();
                }}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Streams & Tables</h2>
          <p className="text-sm text-muted-foreground">
            Manage your eKuiper data sources
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => {
            refetchStreams();
            refetchTables();
          }}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button onClick={() => openCreateDialog("stream")}>
            <Plus className="h-4 w-4 mr-1" />
            New Stream
          </Button>
          <Button variant="outline" onClick={() => openCreateDialog("table")}>
            <Plus className="h-4 w-4 mr-1" />
            New Table
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search streams and tables..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Content */}
      <Tabs defaultValue="streams" className="flex-1">
        <TabsList>
          <TabsTrigger value="streams" className="gap-2">
            <Database className="h-4 w-4" />
            Streams ({streams.length})
          </TabsTrigger>
          <TabsTrigger value="tables" className="gap-2">
            <Table className="h-4 w-4" />
            Tables ({tables.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="streams" className="flex-1 overflow-auto">
          {loadingStreams ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredStreams.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? "No streams match your search" : "No streams created yet"}
            </div>
          ) : (
            <div className="grid gap-2 mt-4">
              {filteredStreams.map((stream: StreamListItem) => (
                <StreamCard
                  key={stream.name}
                  stream={stream}
                  onDescribe={() => setDescribeTarget({ name: stream.name, type: "stream" })}
                  onDelete={() => deleteStream.mutate(stream.name)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="tables" className="flex-1 overflow-auto">
          {loadingTables ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTables.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? "No tables match your search" : "No tables created yet"}
            </div>
          ) : (
            <div className="grid gap-2 mt-4">
              {filteredTables.map((table: StreamListItem) => (
                <Card key={table.name} className="group hover:border-primary/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Table className="h-5 w-5 text-sota-purple" />
                        <span className="font-medium">{table.name}</span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="sm" onClick={() => setDescribeTarget({ name: table.name, type: "table" })}>
                          <Info className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteTable.mutate(table.name)} className="text-red-500 hover:text-red-600">
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
      </Tabs>

      {/* Create Dialog */}
      <CreateStreamDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSubmit={handleCreate}
        type={createType}
      />

      {/* Describe Dialog */}
      <DescribeDialog
        open={!!describeTarget}
        onOpenChange={(open) => !open && setDescribeTarget(null)}
        name={describeTarget?.name || ""}
        schema={describeSchema}
      />
    </div>
  );
}
