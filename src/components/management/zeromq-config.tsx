"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { EKuiperClient } from "@/lib/ekuiper/client";
import {
  Zap,
  Plus,
  Trash2,
  Copy,
  Check,
  Info,
  Code2,
  Save,
  Play,
  RefreshCw,
  Download,
  Upload,
  ArrowRightLeft,
  Server,
  Radio,
  Settings,
  Loader2,
  AlertCircle,
  CheckCircle,
  BookOpen
} from "lucide-react";

// =============================================================================
// Types
// =============================================================================

type ZMQSocketType = "SUB" | "PULL" | "PUB" | "PUSH" | "REQ" | "REP" | "PAIR";

interface ZMQSourceConfig {
  server: string;
  topic?: string;
  format: "json" | "binary" | "protobuf";
  socketType?: ZMQSocketType;
}

interface ZMQSinkConfig {
  server: string;
  topic?: string;
  socketType?: ZMQSocketType;
}

// =============================================================================
// Configuration Presets
// =============================================================================

const SOCKET_TYPES: { value: ZMQSocketType; label: string; description: string; role: "source" | "sink" | "both" }[] = [
  { value: "SUB", label: "SUB (Subscriber)", description: "Receives messages from PUB socket", role: "source" },
  { value: "PULL", label: "PULL", description: "Receives messages from PUSH socket (load balancing)", role: "source" },
  { value: "PUB", label: "PUB (Publisher)", description: "Sends messages to all SUB sockets", role: "sink" },
  { value: "PUSH", label: "PUSH", description: "Sends messages to PULL sockets (load balancing)", role: "sink" },
  { value: "REQ", label: "REQ (Request)", description: "Request-reply pattern (client)", role: "both" },
  { value: "REP", label: "REP (Reply)", description: "Request-reply pattern (server)", role: "both" },
  { value: "PAIR", label: "PAIR", description: "Exclusive peer-to-peer connection", role: "both" },
];

const ZMQ_PATTERNS = [
  {
    name: "Pub/Sub",
    description: "One-to-many broadcasting",
    sourceType: "SUB" as ZMQSocketType,
    sinkType: "PUB" as ZMQSocketType,
    diagram: "PUB ──→ SUB (many)",
  },
  {
    name: "Push/Pull (Pipeline)",
    description: "Load-balanced work distribution",
    sourceType: "PULL" as ZMQSocketType,
    sinkType: "PUSH" as ZMQSocketType,
    diagram: "PUSH ──→ PULL (many)",
  },
  {
    name: "Request/Reply",
    description: "Synchronous request-response",
    sourceType: "REP" as ZMQSocketType,
    sinkType: "REQ" as ZMQSocketType,
    diagram: "REQ ←──→ REP",
  },
  {
    name: "Pair",
    description: "Exclusive bidirectional",
    sourceType: "PAIR" as ZMQSocketType,
    sinkType: "PAIR" as ZMQSocketType,
    diagram: "PAIR ←──→ PAIR",
  },
];

// =============================================================================
// Example Configurations
// =============================================================================

const SOURCE_EXAMPLES = [
  {
    name: "Basic Subscriber",
    description: "Subscribe to a topic from a ZMQ publisher",
    config: {
      server: "tcp://127.0.0.1:5555",
      topic: "sensor-data",
      format: "json",
    },
    sql: `CREATE STREAM zmq_stream () WITH (
  FORMAT = "json",
  TYPE = "zmq",
  DATASOURCE = "tcp://127.0.0.1:5555",
  CONF_KEY = "zmq_default"
);`,
  },
  {
    name: "Pipeline Worker",
    description: "Pull tasks from a work queue",
    config: {
      server: "tcp://127.0.0.1:5556",
      format: "json",
    },
    sql: `CREATE STREAM zmq_worker () WITH (
  FORMAT = "json",
  TYPE = "zmq",
  DATASOURCE = "tcp://127.0.0.1:5556"
);`,
  },
  {
    name: "Binary Data",
    description: "Receive binary messages (images, files)",
    config: {
      server: "tcp://127.0.0.1:5557",
      format: "binary",
    },
    sql: `CREATE STREAM zmq_binary () WITH (
  FORMAT = "binary",
  TYPE = "zmq",
  DATASOURCE = "tcp://127.0.0.1:5557"
);`,
  },
];

const SINK_EXAMPLES = [
  {
    name: "Publisher",
    description: "Publish processed data to subscribers",
    config: {
      server: "tcp://127.0.0.1:5558",
      topic: "processed-data",
    },
    json: `{
  "zmq": {
    "server": "tcp://127.0.0.1:5558",
    "topic": "processed-data"
  }
}`,
  },
  {
    name: "Pipeline Pusher",
    description: "Push results to worker pool",
    config: {
      server: "tcp://127.0.0.1:5559",
    },
    json: `{
  "zmq": {
    "server": "tcp://127.0.0.1:5559"
  }
}`,
  },
];

// =============================================================================
// Props
// =============================================================================

interface ZeroMQConfigProps {
  connectionId: string;
}

// =============================================================================
// Main Component
// =============================================================================

export function ZeroMQConfig({ connectionId }: ZeroMQConfigProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"source" | "sink" | "patterns" | "docs">("source");
  const [copied, setCopied] = useState<string | null>(null);
  
  // Source Config
  const [sourceConfig, setSourceConfig] = useState<ZMQSourceConfig>({
    server: "tcp://127.0.0.1:5555",
    topic: "",
    format: "json",
    socketType: "SUB",
  });
  const [sourceName, setSourceName] = useState("zmq_stream");

  // Sink Config
  const [sinkConfig, setSinkConfig] = useState<ZMQSinkConfig>({
    server: "tcp://127.0.0.1:5558",
    topic: "",
    socketType: "PUB",
  });

  const client = new EKuiperClient(`/api/connections/${connectionId}/ekuiper`);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast({ title: "Copied", description: `${label} copied to clipboard` });
    setTimeout(() => setCopied(null), 2000);
  };

  const generateSourceSQL = () => {
    return `CREATE STREAM ${sourceName} () WITH (
  FORMAT = "${sourceConfig.format}",
  TYPE = "zmq",
  DATASOURCE = "${sourceConfig.server}"${sourceConfig.topic ? `,
  TOPIC = "${sourceConfig.topic}"` : ""}
);`;
  };

  const generateSinkJSON = () => {
    const config: Record<string, any> = {
      server: sinkConfig.server,
    };
    if (sinkConfig.topic) {
      config.topic = sinkConfig.topic;
    }
    return JSON.stringify({ zmq: config }, null, 2);
  };

  const generateYAMLConfig = () => {
    return `# zmq.yaml configuration
default:
  server: ${sourceConfig.server}
${sourceConfig.topic ? `  topic: ${sourceConfig.topic}` : ""}

# For sink
publisher:
  server: ${sinkConfig.server}
${sinkConfig.topic ? `  topic: ${sinkConfig.topic}` : ""}`;
  };

  const testConnection = async (server: string) => {
    toast({
      title: "Connection Test",
      description: `Testing connection to ${server}...`,
    });
    // In real implementation, this would test the ZMQ connection
    setTimeout(() => {
      toast({
        title: "Note",
        description: "ZMQ connection testing requires the eKuiper server",
      });
    }, 1000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="h-6 w-6 text-yellow-500" />
            ZeroMQ Configuration
          </h2>
          <p className="text-muted-foreground">
            High-performance messaging for eKuiper
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList>
          <TabsTrigger value="source" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Source
          </TabsTrigger>
          <TabsTrigger value="sink" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Sink
          </TabsTrigger>
          <TabsTrigger value="patterns" className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4" />
            Patterns
          </TabsTrigger>
          <TabsTrigger value="docs" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Documentation
          </TabsTrigger>
        </TabsList>

        <TabsContent value="source" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Source Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  ZMQ Source Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Stream Name</Label>
                  <Input
                    value={sourceName}
                    onChange={(e) => setSourceName(e.target.value)}
                    placeholder="zmq_stream"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Server Address</Label>
                  <div className="flex gap-2">
                    <Input
                      value={sourceConfig.server}
                      onChange={(e) => setSourceConfig({ ...sourceConfig, server: e.target.value })}
                      placeholder="tcp://127.0.0.1:5555"
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      onClick={() => testConnection(sourceConfig.server)}
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Formats: tcp://host:port, ipc:///path, inproc://name
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Topic (optional)</Label>
                  <Input
                    value={sourceConfig.topic}
                    onChange={(e) => setSourceConfig({ ...sourceConfig, topic: e.target.value })}
                    placeholder="sensor-data"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Message Format</Label>
                  <Select
                    value={sourceConfig.format}
                    onValueChange={(v) => setSourceConfig({ ...sourceConfig, format: v as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="json">JSON</SelectItem>
                      <SelectItem value="binary">Binary</SelectItem>
                      <SelectItem value="protobuf">Protobuf</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Socket Type</Label>
                  <Select
                    value={sourceConfig.socketType}
                    onValueChange={(v) => setSourceConfig({ ...sourceConfig, socketType: v as ZMQSocketType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SOCKET_TYPES.filter(s => s.role === "source" || s.role === "both").map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex flex-col">
                            <span>{type.label}</span>
                            <span className="text-xs text-muted-foreground">{type.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Generated SQL */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Code2 className="h-5 w-5" />
                    Generated SQL
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(generateSourceSQL(), "Source SQL")}
                  >
                    {copied === "Source SQL" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <pre className="p-4 bg-muted rounded-lg font-mono text-sm whitespace-pre-wrap">
                  {generateSourceSQL()}
                </pre>
              </CardContent>
            </Card>
          </div>

          {/* Source Examples */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {SOURCE_EXAMPLES.map((example) => (
              <Card
                key={example.name}
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => {
                  setSourceConfig(example.config as ZMQSourceConfig);
                  toast({ title: "Loaded", description: example.name });
                }}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{example.name}</CardTitle>
                  <CardDescription className="text-xs">{example.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs bg-muted p-2 rounded font-mono overflow-hidden max-h-24">
                    {example.sql}
                  </pre>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="sink" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sink Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  ZMQ Sink Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Server Address</Label>
                  <Input
                    value={sinkConfig.server}
                    onChange={(e) => setSinkConfig({ ...sinkConfig, server: e.target.value })}
                    placeholder="tcp://127.0.0.1:5558"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Topic (optional)</Label>
                  <Input
                    value={sinkConfig.topic}
                    onChange={(e) => setSinkConfig({ ...sinkConfig, topic: e.target.value })}
                    placeholder="output-topic"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Socket Type</Label>
                  <Select
                    value={sinkConfig.socketType}
                    onValueChange={(v) => setSinkConfig({ ...sinkConfig, socketType: v as ZMQSocketType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SOCKET_TYPES.filter(s => s.role === "sink" || s.role === "both").map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex flex-col">
                            <span>{type.label}</span>
                            <span className="text-xs text-muted-foreground">{type.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Generated Sink Config */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Code2 className="h-5 w-5" />
                    Sink Configuration
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(generateSinkJSON(), "Sink Config")}
                  >
                    {copied === "Sink Config" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <pre className="p-4 bg-muted rounded-lg font-mono text-sm whitespace-pre-wrap">
                  {generateSinkJSON()}
                </pre>
              </CardContent>
            </Card>
          </div>

          {/* Sink Examples */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SINK_EXAMPLES.map((example) => (
              <Card
                key={example.name}
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => {
                  setSinkConfig(example.config as ZMQSinkConfig);
                  toast({ title: "Loaded", description: example.name });
                }}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{example.name}</CardTitle>
                  <CardDescription className="text-xs">{example.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs bg-muted p-2 rounded font-mono">
                    {example.json}
                  </pre>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="patterns" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ZMQ_PATTERNS.map((pattern) => (
              <Card key={pattern.name}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ArrowRightLeft className="h-5 w-5 text-yellow-500" />
                    {pattern.name}
                  </CardTitle>
                  <CardDescription>{pattern.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-muted rounded-lg font-mono text-center text-lg">
                    {pattern.diagram}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Source Socket</Label>
                      <Badge variant="outline" className="w-full justify-center">
                        {pattern.sourceType}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Sink Socket</Label>
                      <Badge variant="outline" className="w-full justify-center">
                        {pattern.sinkType}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setSourceConfig(prev => ({ ...prev, socketType: pattern.sourceType }));
                      setSinkConfig(prev => ({ ...prev, socketType: pattern.sinkType }));
                      toast({ title: "Pattern Applied", description: pattern.name });
                    }}
                  >
                    Apply Pattern
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="docs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>ZeroMQ Plugin Documentation</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-6 pr-4">
                  {/* Installation */}
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Installation</h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      The ZeroMQ plugin is a native plugin that needs to be installed separately:
                    </p>
                    <pre className="p-3 bg-muted rounded-lg font-mono text-sm">
{`# Install ZMQ source plugin
bin/kuiper create plugin source zmq file:///tmp/zmq_source.zip

# Install ZMQ sink plugin
bin/kuiper create plugin sink zmq file:///tmp/zmq_sink.zip`}
                    </pre>
                  </div>

                  <Separator />

                  {/* Configuration File */}
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Configuration File (zmq.yaml)</h3>
                    <pre className="p-3 bg-muted rounded-lg font-mono text-sm">
                      {generateYAMLConfig()}
                    </pre>
                  </div>

                  <Separator />

                  {/* Source Usage */}
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Source Usage</h3>
                    <pre className="p-3 bg-muted rounded-lg font-mono text-sm">
{`-- Create ZMQ source stream
CREATE STREAM zmq_demo () WITH (
  FORMAT = "json",
  TYPE = "zmq",
  DATASOURCE = "tcp://127.0.0.1:5555"
);

-- Use with configuration key
CREATE STREAM zmq_demo () WITH (
  FORMAT = "json",
  TYPE = "zmq",
  CONF_KEY = "default"
);`}
                    </pre>
                  </div>

                  <Separator />

                  {/* Sink Usage */}
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Sink Usage</h3>
                    <pre className="p-3 bg-muted rounded-lg font-mono text-sm">
{`{
  "id": "rule_zmq",
  "sql": "SELECT * FROM source_stream",
  "actions": [{
    "zmq": {
      "server": "tcp://127.0.0.1:5558",
      "topic": "output"
    }
  }]
}`}
                    </pre>
                  </div>

                  <Separator />

                  {/* Address Formats */}
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Address Formats</h3>
                    <div className="space-y-2">
                      <div className="p-2 bg-muted/50 rounded">
                        <code className="font-mono font-bold">tcp://</code>
                        <span className="text-sm text-muted-foreground ml-2">
                          TCP transport (e.g., tcp://192.168.1.100:5555)
                        </span>
                      </div>
                      <div className="p-2 bg-muted/50 rounded">
                        <code className="font-mono font-bold">ipc://</code>
                        <span className="text-sm text-muted-foreground ml-2">
                          Inter-process (e.g., ipc:///tmp/zmq.sock)
                        </span>
                      </div>
                      <div className="p-2 bg-muted/50 rounded">
                        <code className="font-mono font-bold">inproc://</code>
                        <span className="text-sm text-muted-foreground ml-2">
                          In-process (e.g., inproc://myname)
                        </span>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Performance Tips */}
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Performance Tips</h3>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                      <li>Use <code>ipc://</code> for same-machine communication (faster than TCP)</li>
                      <li>Use <code>inproc://</code> for same-process communication (fastest)</li>
                      <li>Consider PUSH/PULL for load balancing across workers</li>
                      <li>PUB/SUB is best for broadcasting to multiple receivers</li>
                      <li>Use binary format for high-volume data to reduce parsing overhead</li>
                    </ul>
                  </div>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ZeroMQConfig;
