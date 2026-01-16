"use client";

import { useState } from "react";
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
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Boxes,
  Copy,
  Check,
  Info,
  Code2,
  Wand2,
  Book,
  Layers,
  ChevronRight,
  Database,
  Settings,
  Tag,
  Clock
} from "lucide-react";

// =============================================================================
// EdgeX Foundry Meta Functions Reference
// =============================================================================

interface EdgeXMetaFunction {
  name: string;
  syntax: string;
  description: string;
  returnType: string;
  example: string;
  category: "device" | "reading" | "event" | "profile" | "resource";
}

const EDGEX_META_FUNCTIONS: EdgeXMetaFunction[] = [
  // Device Meta Functions
  {
    name: "meta(deviceName)",
    syntax: "meta(deviceName)",
    description: "Get the device name that generated the event",
    returnType: "string",
    example: "SELECT meta(deviceName) as device FROM edgex_stream",
    category: "device"
  },
  {
    name: "meta(id)",
    syntax: "meta(id)",
    description: "Get the unique event ID",
    returnType: "string",
    example: "SELECT meta(id) as event_id FROM edgex_stream",
    category: "event"
  },
  {
    name: "meta(profileName)",
    syntax: "meta(profileName)",
    description: "Get the device profile name",
    returnType: "string",
    example: "SELECT meta(profileName) as profile FROM edgex_stream",
    category: "profile"
  },
  {
    name: "meta(sourceName)",
    syntax: "meta(sourceName)",
    description: "Get the source/command name that triggered the reading",
    returnType: "string",
    example: "SELECT meta(sourceName) as source FROM edgex_stream",
    category: "reading"
  },
  {
    name: "meta(origin)",
    syntax: "meta(origin)",
    description: "Get the origin timestamp (nanoseconds since epoch)",
    returnType: "bigint",
    example: "SELECT meta(origin) / 1000000 as timestamp_ms FROM edgex_stream",
    category: "event"
  },
  {
    name: "meta(tags)",
    syntax: "meta(tags)",
    description: "Get the tags map associated with the event",
    returnType: "map[string]string",
    example: "SELECT meta(tags)->location as loc FROM edgex_stream",
    category: "event"
  },
  {
    name: "meta(created)",
    syntax: "meta(created)",
    description: "Get the creation timestamp",
    returnType: "bigint",
    example: "SELECT meta(created) as created_at FROM edgex_stream",
    category: "event"
  },
  {
    name: "meta(modified)",
    syntax: "meta(modified)",
    description: "Get the modification timestamp",
    returnType: "bigint",
    example: "SELECT meta(modified) as modified_at FROM edgex_stream",
    category: "event"
  },
  {
    name: "meta(pushed)",
    syntax: "meta(pushed)",
    description: "Get the push timestamp (when sent to export)",
    returnType: "bigint",
    example: "SELECT meta(pushed) as pushed_at FROM edgex_stream",
    category: "event"
  },
  {
    name: "meta(resourceName)",
    syntax: "meta(resourceName)",
    description: "Get the device resource name for the reading",
    returnType: "string",
    example: "SELECT value, meta(resourceName) as resource FROM edgex_stream",
    category: "resource"
  },
  {
    name: "meta(valueType)",
    syntax: "meta(valueType)",
    description: "Get the value type of the reading (Int32, Float64, etc.)",
    returnType: "string",
    example: "SELECT value, meta(valueType) as type FROM edgex_stream",
    category: "reading"
  },
  {
    name: "meta(mediaType)",
    syntax: "meta(mediaType)",
    description: "Get the media type for binary readings",
    returnType: "string",
    example: "SELECT meta(mediaType) as media FROM edgex_stream WHERE meta(valueType) = 'Binary'",
    category: "reading"
  },
];

// =============================================================================
// SQL Templates for EdgeX
// =============================================================================

interface EdgeXSQLTemplate {
  name: string;
  description: string;
  sql: string;
  sinkConfig?: Record<string, any>;
}

const EDGEX_SQL_TEMPLATES: EdgeXSQLTemplate[] = [
  {
    name: "Device Filter",
    description: "Filter events by specific device name",
    sql: `SELECT *, meta(deviceName) as device
FROM edgex_stream
WHERE meta(deviceName) = 'Random-Integer-Device'`,
  },
  {
    name: "Temperature Alert",
    description: "Alert when temperature exceeds threshold with device info",
    sql: `SELECT
  meta(deviceName) as device,
  meta(profileName) as profile,
  temperature as value,
  meta(origin) as timestamp
FROM edgex_stream
WHERE temperature > 30`,
  },
  {
    name: "Multi-Device Aggregation",
    description: "Aggregate readings across devices with metadata",
    sql: `SELECT
  meta(deviceName) as device,
  meta(resourceName) as resource,
  AVG(value) as avg_value,
  COUNT(*) as reading_count,
  MIN(meta(origin)) as start_time,
  MAX(meta(origin)) as end_time
FROM edgex_stream
GROUP BY meta(deviceName), meta(resourceName), TUMBLINGWINDOW(ss, 60)`,
  },
  {
    name: "Profile-Based Routing",
    description: "Route events based on device profile",
    sql: `SELECT
  meta(deviceName) as device,
  meta(profileName) as profile,
  *
FROM edgex_stream
WHERE meta(profileName) IN ('Temperature-Profile', 'Humidity-Profile')`,
  },
  {
    name: "Event Enrichment",
    description: "Enrich events with all metadata for export",
    sql: `SELECT
  meta(id) as event_id,
  meta(deviceName) as device,
  meta(profileName) as profile,
  meta(sourceName) as source,
  meta(resourceName) as resource,
  meta(valueType) as value_type,
  meta(origin) / 1000000 as timestamp_ms,
  *
FROM edgex_stream`,
  },
  {
    name: "Tag-Based Filter",
    description: "Filter by event tags",
    sql: `SELECT *
FROM edgex_stream
WHERE meta(tags)->location = 'building-a'
  AND meta(tags)->floor = '1'`,
  },
  {
    name: "Latest Reading Per Device",
    description: "Get the latest reading for each device",
    sql: `SELECT
  meta(deviceName) as device,
  LAST_VALUE(value) as latest_value,
  LAST_VALUE(meta(origin)) as last_timestamp
FROM edgex_stream
GROUP BY meta(deviceName), SESSIONWINDOW(ss, 5, 30)`,
  },
  {
    name: "Event Deduplication",
    description: "Remove duplicate events within a time window",
    sql: `SELECT
  meta(id) as event_id,
  meta(deviceName) as device,
  value
FROM edgex_stream
GROUP BY meta(id), TUMBLINGWINDOW(ss, 10)
HAVING COUNT(*) = 1`,
  },
];

// =============================================================================
// EdgeX Stream Configuration
// =============================================================================

interface EdgeXSourceConfig {
  protocol: "redis" | "mqtt" | "zeromq";
  host: string;
  port: number;
  topic: string;
  messageType: "event" | "request";
  serviceServer?: string;
}

const DEFAULT_EDGEX_CONFIG: EdgeXSourceConfig = {
  protocol: "redis",
  host: "localhost",
  port: 6379,
  topic: "edgex-events",
  messageType: "event",
  serviceServer: "http://localhost:59881",
};

// =============================================================================
// Main Component
// =============================================================================

export function EdgeXMetaFunctions() {
  const [activeTab, setActiveTab] = useState<"reference" | "builder" | "templates">("reference");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [copied, setCopied] = useState<string | null>(null);
  const [generatedSQL, setGeneratedSQL] = useState("");
  
  // SQL Builder State
  const [builderConfig, setBuilderConfig] = useState({
    selectFields: [] as string[],
    metaFields: [] as string[],
    filterDevice: "",
    filterProfile: "",
    windowType: "none" as "none" | "tumbling" | "hopping" | "sliding" | "session",
    windowSize: 10,
    groupByDevice: false,
    groupByResource: false,
  });

  const categories = ["all", "device", "event", "reading", "profile", "resource"];
  
  const filteredFunctions = selectedCategory === "all"
    ? EDGEX_META_FUNCTIONS
    : EDGEX_META_FUNCTIONS.filter(f => f.category === selectedCategory);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast({ title: "Copied", description: `${label} copied to clipboard` });
    setTimeout(() => setCopied(null), 2000);
  };

  const toggleMetaField = (field: string) => {
    setBuilderConfig(prev => ({
      ...prev,
      metaFields: prev.metaFields.includes(field)
        ? prev.metaFields.filter(f => f !== field)
        : [...prev.metaFields, field]
    }));
  };

  const generateSQL = () => {
    let selectParts: string[] = [];
    
    // Add meta fields
    builderConfig.metaFields.forEach(field => {
      const func = EDGEX_META_FUNCTIONS.find(f => f.syntax === field);
      if (func) {
        const alias = field.replace("meta(", "").replace(")", "");
        selectParts.push(`${field} as ${alias}`);
      }
    });
    
    // Add wildcard if no specific fields
    if (selectParts.length === 0) {
      selectParts.push("*");
    } else {
      selectParts.push("*");
    }

    let sql = `SELECT\n  ${selectParts.join(",\n  ")}\nFROM edgex_stream`;

    // Add WHERE clause
    const whereClauses: string[] = [];
    if (builderConfig.filterDevice) {
      whereClauses.push(`meta(deviceName) = '${builderConfig.filterDevice}'`);
    }
    if (builderConfig.filterProfile) {
      whereClauses.push(`meta(profileName) = '${builderConfig.filterProfile}'`);
    }
    if (whereClauses.length > 0) {
      sql += `\nWHERE ${whereClauses.join("\n  AND ")}`;
    }

    // Add GROUP BY
    const groupByParts: string[] = [];
    if (builderConfig.groupByDevice) {
      groupByParts.push("meta(deviceName)");
    }
    if (builderConfig.groupByResource) {
      groupByParts.push("meta(resourceName)");
    }
    if (builderConfig.windowType !== "none") {
      const windowFunc = builderConfig.windowType.toUpperCase() + "WINDOW";
      groupByParts.push(`${windowFunc}(ss, ${builderConfig.windowSize})`);
    }
    if (groupByParts.length > 0) {
      sql += `\nGROUP BY ${groupByParts.join(", ")}`;
    }

    setGeneratedSQL(sql);
  };

  const loadTemplate = (template: EdgeXSQLTemplate) => {
    setGeneratedSQL(template.sql);
    setActiveTab("builder");
    toast({
      title: "Template Loaded",
      description: template.name,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Boxes className="h-6 w-6 text-purple-500" />
            EdgeX Meta Functions
          </h2>
          <p className="text-muted-foreground">
            Access EdgeX Foundry event metadata in SQL queries
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList>
          <TabsTrigger value="reference" className="flex items-center gap-2">
            <Book className="h-4 w-4" />
            Function Reference
          </TabsTrigger>
          <TabsTrigger value="builder" className="flex items-center gap-2">
            <Wand2 className="h-4 w-4" />
            SQL Builder
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reference" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Meta Functions</CardTitle>
                  <CardDescription>
                    Access event and reading metadata from EdgeX Foundry
                  </CardDescription>
                </div>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat} value={cat}>
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {filteredFunctions.map((func) => (
                    <div
                      key={func.name}
                      className="p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <code className="font-mono font-bold text-purple-500">
                            {func.syntax}
                          </code>
                          <Badge variant="outline" className="text-xs">
                            {func.category}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            → {func.returnType}
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(func.syntax, func.name)}
                        >
                          {copied === func.name ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {func.description}
                      </p>
                      <div className="bg-background p-2 rounded font-mono text-xs">
                        {func.example}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="builder" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Builder Options */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Query Builder
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Meta Fields Selection */}
                <div className="space-y-2">
                  <Label>Include Meta Fields</Label>
                  <div className="flex flex-wrap gap-2">
                    {EDGEX_META_FUNCTIONS.slice(0, 8).map((func) => (
                      <Badge
                        key={func.syntax}
                        variant={builderConfig.metaFields.includes(func.syntax) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => toggleMetaField(func.syntax)}
                      >
                        {func.syntax.replace("meta(", "").replace(")", "")}
                      </Badge>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Filters */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      Device Name
                    </Label>
                    <Input
                      placeholder="Random-Integer-Device"
                      value={builderConfig.filterDevice}
                      onChange={(e) => setBuilderConfig({
                        ...builderConfig,
                        filterDevice: e.target.value
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Tag className="h-4 w-4" />
                      Profile Name
                    </Label>
                    <Input
                      placeholder="Temperature-Profile"
                      value={builderConfig.filterProfile}
                      onChange={(e) => setBuilderConfig({
                        ...builderConfig,
                        filterProfile: e.target.value
                      })}
                    />
                  </div>
                </div>

                <Separator />

                {/* Window & Grouping */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Window Type
                      </Label>
                      <Select
                        value={builderConfig.windowType}
                        onValueChange={(v) => setBuilderConfig({
                          ...builderConfig,
                          windowType: v as any
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="tumbling">Tumbling</SelectItem>
                          <SelectItem value="hopping">Hopping</SelectItem>
                          <SelectItem value="sliding">Sliding</SelectItem>
                          <SelectItem value="session">Session</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {builderConfig.windowType !== "none" && (
                      <div className="space-y-2">
                        <Label>Window Size (seconds)</Label>
                        <Input
                          type="number"
                          value={builderConfig.windowSize}
                          onChange={(e) => setBuilderConfig({
                            ...builderConfig,
                            windowSize: parseInt(e.target.value) || 10
                          })}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={builderConfig.groupByDevice}
                        onChange={(e) => setBuilderConfig({
                          ...builderConfig,
                          groupByDevice: e.target.checked
                        })}
                        className="rounded"
                      />
                      <span className="text-sm">Group by Device</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={builderConfig.groupByResource}
                        onChange={(e) => setBuilderConfig({
                          ...builderConfig,
                          groupByResource: e.target.checked
                        })}
                        className="rounded"
                      />
                      <span className="text-sm">Group by Resource</span>
                    </label>
                  </div>
                </div>

                <Button onClick={generateSQL} className="w-full">
                  <Wand2 className="h-4 w-4 mr-2" />
                  Generate SQL
                </Button>
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
                    onClick={() => copyToClipboard(generatedSQL, "SQL")}
                    disabled={!generatedSQL}
                  >
                    {copied === "SQL" ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {generatedSQL ? (
                  <pre className="p-4 bg-muted rounded-lg font-mono text-sm whitespace-pre-wrap">
                    {generatedSQL}
                  </pre>
                ) : (
                  <div className="h-48 flex items-center justify-center text-muted-foreground">
                    Configure options and click Generate SQL
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {EDGEX_SQL_TEMPLATES.map((template) => (
              <Card
                key={template.name}
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => loadTemplate(template)}
              >
                <CardHeader>
                  <CardTitle className="text-lg">{template.name}</CardTitle>
                  <CardDescription>{template.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs bg-muted p-3 rounded-lg overflow-hidden max-h-32 font-mono">
                    {template.sql}
                  </pre>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* EdgeX Stream Configuration Info */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <Info className="h-5 w-5 text-purple-500 mt-0.5" />
            <div className="space-y-2 text-sm text-muted-foreground">
              <p><strong>EdgeX Stream Configuration:</strong></p>
              <pre className="bg-muted p-3 rounded-lg font-mono text-xs">
{`CREATE STREAM edgex_stream () WITH (
  FORMAT = "JSON",
  TYPE = "edgex",
  CONF_KEY = "default"
);

-- edgex.yaml configuration:
default:
  protocol: redis
  server: localhost
  port: 6379
  topic: edgex-events
  messageType: event
  serviceServer: http://localhost:59881`}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default EdgeXMetaFunctions;
