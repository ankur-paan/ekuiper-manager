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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { EKuiperClient } from "@/lib/ekuiper/client";
import {
  Table2,
  Plus,
  Trash2,
  Copy,
  Check,
  Info,
  Code2,
  Wand2,
  Book,
  Database,
  Play,
  RefreshCw,
  Link2,
  Key,
  Loader2,
  AlertCircle,
  Eye
} from "lucide-react";

// =============================================================================
// Types
// =============================================================================

interface LookupTable {
  name: string;
  type: "sql" | "redis" | "memory" | "file";
  fields: TableField[];
  keyField: string;
  config: Record<string, any>;
}

interface TableField {
  name: string;
  type: "string" | "bigint" | "float" | "boolean" | "datetime" | "array" | "struct";
  isKey?: boolean;
}

interface JoinConfig {
  streamName: string;
  tableName: string;
  joinType: "inner" | "left" | "right" | "full" | "cross";
  streamField: string;
  tableField: string;
  selectFields: string[];
}

// =============================================================================
// Table Type Configurations
// =============================================================================

interface TableTypeConfig {
  name: string;
  description: string;
  icon: React.ReactNode;
  configFields: { name: string; label: string; type: "text" | "number" | "password"; required: boolean; placeholder: string }[];
}

const TABLE_TYPES: Record<string, TableTypeConfig> = {
  sql: {
    name: "SQL Database",
    description: "Connect to MySQL, PostgreSQL, or SQL Server",
    icon: <Database className="h-5 w-5" />,
    configFields: [
      { name: "url", label: "Connection URL", type: "text", required: true, placeholder: "mysql://user:pass@localhost:3306/db" },
      { name: "table", label: "Table Name", type: "text", required: true, placeholder: "users" },
    ],
  },
  redis: {
    name: "Redis",
    description: "High-performance key-value lookup",
    icon: <Database className="h-5 w-5 text-red-500" />,
    configFields: [
      { name: "addr", label: "Redis Address", type: "text", required: true, placeholder: "localhost:6379" },
      { name: "password", label: "Password", type: "password", required: false, placeholder: "" },
      { name: "db", label: "Database Number", type: "number", required: false, placeholder: "0" },
      { name: "dataType", label: "Data Type", type: "text", required: true, placeholder: "string|list|hash" },
    ],
  },
  memory: {
    name: "Memory Table",
    description: "In-memory lookup populated from another rule",
    icon: <Table2 className="h-5 w-5 text-blue-500" />,
    configFields: [
      { name: "topic", label: "Memory Topic", type: "text", required: true, placeholder: "my_lookup_data" },
    ],
  },
  file: {
    name: "File Lookup",
    description: "Read from CSV or JSON files",
    icon: <Table2 className="h-5 w-5 text-green-500" />,
    configFields: [
      { name: "path", label: "File Path", type: "text", required: true, placeholder: "/data/lookup.csv" },
      { name: "fileType", label: "File Type", type: "text", required: true, placeholder: "csv|json" },
      { name: "hasHeader", label: "Has Header (CSV)", type: "text", required: false, placeholder: "true|false" },
    ],
  },
};

// =============================================================================
// SQL Examples
// =============================================================================

const JOIN_EXAMPLES = [
  {
    name: "User Enrichment",
    description: "Join sensor data with user information",
    sql: `SELECT s.temperature, s.humidity, t.username, t.department
FROM sensor_stream s
INNER JOIN user_table t ON s.user_id = t.id`,
  },
  {
    name: "Device Lookup",
    description: "Enrich readings with device metadata",
    sql: `SELECT s.*, t.location, t.type, t.manufacturer
FROM readings s
LEFT JOIN device_table t ON s.device_id = t.device_id`,
  },
  {
    name: "Threshold Lookup",
    description: "Dynamic thresholds from a table",
    sql: `SELECT s.sensor_id, s.value, t.min_threshold, t.max_threshold,
  CASE WHEN s.value > t.max_threshold THEN 'HIGH'
       WHEN s.value < t.min_threshold THEN 'LOW'
       ELSE 'NORMAL' END as status
FROM sensor_stream s
INNER JOIN threshold_table t ON s.sensor_type = t.sensor_type`,
  },
  {
    name: "Redis Cache Lookup",
    description: "Fast lookup from Redis cache",
    sql: `SELECT s.order_id, s.product_id, t.product_name, t.price
FROM orders s
INNER JOIN redis_product_cache t ON s.product_id = t.id`,
  },
];

// =============================================================================
// Component Props
// =============================================================================

interface LookupTablesUIProps {
  connectionId: string;
}

// =============================================================================
// Main Component
// =============================================================================

export function LookupTablesUI({ connectionId }: LookupTablesUIProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"tables" | "builder" | "examples">("tables");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  
  // New Table State
  const [newTable, setNewTable] = useState<Partial<LookupTable>>({
    name: "",
    type: "sql",
    fields: [],
    keyField: "",
    config: {},
  });

  // Join Builder State
  const [joinConfig, setJoinConfig] = useState<JoinConfig>({
    streamName: "",
    tableName: "",
    joinType: "inner",
    streamField: "",
    tableField: "",
    selectFields: [],
  });
  
  const [generatedSQL, setGeneratedSQL] = useState("");
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState<TableField["type"]>("string");

  // API Client
  const client = new EKuiperClient(`/api/connections/${connectionId}/ekuiper`);

  // Fetch existing tables
  const { data: tables, isLoading } = useQuery({
    queryKey: ["tables", connectionId],
    queryFn: async () => {
      const result = await client.listTables();
      return result.map(t => t.name);
    },
  });

  // Fetch streams for join builder
  const { data: streams } = useQuery({
    queryKey: ["streams", connectionId],
    queryFn: async () => {
      const result = await client.listStreams();
      return result.map(s => s.name);
    },
  });

  // Create table mutation
  const createTable = useMutation({
    mutationFn: async (table: Partial<LookupTable>) => {
      const sql = generateTableSQL(table);
      return client.createTable(sql);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables", connectionId] });
      setCreateDialogOpen(false);
      resetNewTable();
      toast({
        title: "Table Created",
        description: `Lookup table ${newTable.name} created successfully`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete table mutation
  const deleteTable = useMutation({
    mutationFn: async (name: string) => {
      return client.deleteTable(name);
    },
    onSuccess: (_, name) => {
      queryClient.invalidateQueries({ queryKey: ["tables", connectionId] });
      toast({
        title: "Table Deleted",
        description: `Table ${name} deleted`,
      });
    },
  });

  const resetNewTable = () => {
    setNewTable({
      name: "",
      type: "sql",
      fields: [],
      keyField: "",
      config: {},
    });
  };

  const addField = () => {
    if (!newFieldName) return;
    setNewTable(prev => ({
      ...prev,
      fields: [...(prev.fields || []), { name: newFieldName, type: newFieldType }],
    }));
    setNewFieldName("");
  };

  const removeField = (fieldName: string) => {
    setNewTable(prev => ({
      ...prev,
      fields: prev.fields?.filter(f => f.name !== fieldName) || [],
    }));
  };

  const generateTableSQL = (table: Partial<LookupTable>): string => {
    const fieldDefs = table.fields?.map(f => `${f.name} ${f.type.toUpperCase()}`).join(",\n  ") || "";
    
    const typeConfig = TABLE_TYPES[table.type || "sql"];
    const configParts: string[] = [
      `TYPE = "${table.type}"`,
      table.keyField ? `KEY = "${table.keyField}"` : "",
      `KIND = "lookup"`,
    ];

    // Add type-specific config
    if (table.config) {
      Object.entries(table.config).forEach(([key, value]) => {
        if (value) {
          configParts.push(`${key.toUpperCase()} = "${value}"`);
        }
      });
    }

    return `CREATE TABLE ${table.name} (
  ${fieldDefs}
) WITH (
  ${configParts.filter(Boolean).join(",\n  ")}
);`;
  };

  const generateJoinSQL = () => {
    const { streamName, tableName, joinType, streamField, tableField, selectFields } = joinConfig;
    
    const selectClause = selectFields.length > 0
      ? selectFields.join(", ")
      : `s.*, t.*`;

    const joinTypeUpper = joinType.toUpperCase();

    const sql = `SELECT ${selectClause}
FROM ${streamName} s
${joinTypeUpper} JOIN ${tableName} t ON s.${streamField} = t.${tableField}`;

    setGeneratedSQL(sql);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast({ title: "Copied", description: `${label} copied to clipboard` });
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Table2 className="h-6 w-6 text-green-500" />
            Lookup Tables
          </h2>
          <p className="text-muted-foreground">
            SQL joins with external data sources
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Table
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Lookup Table</DialogTitle>
              <DialogDescription>
                Define a lookup table for SQL joins
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Table Name */}
              <div className="space-y-2">
                <Label>Table Name</Label>
                <Input
                  value={newTable.name}
                  onChange={(e) => setNewTable({ ...newTable, name: e.target.value })}
                  placeholder="user_table"
                />
              </div>

              {/* Table Type */}
              <div className="space-y-2">
                <Label>Data Source Type</Label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(TABLE_TYPES).map(([type, config]) => (
                    <div
                      key={type}
                      className={cn(
                        "p-3 border rounded-lg cursor-pointer transition-colors",
                        newTable.type === type ? "border-primary bg-primary/5" : "hover:border-primary/50"
                      )}
                      onClick={() => setNewTable({ ...newTable, type: type as any, config: {} })}
                    >
                      <div className="flex items-center gap-2">
                        {config.icon}
                        <div>
                          <p className="font-medium text-sm">{config.name}</p>
                          <p className="text-xs text-muted-foreground">{config.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Type-specific configuration */}
              {newTable.type && (
                <div className="space-y-2">
                  <Label>Connection Configuration</Label>
                  <div className="grid gap-3 bg-muted/50 p-3 rounded-lg">
                    {TABLE_TYPES[newTable.type].configFields.map((field) => (
                      <div key={field.name} className="space-y-1">
                        <Label className="text-xs">{field.label}</Label>
                        <Input
                          type={field.type === "password" ? "password" : "text"}
                          placeholder={field.placeholder}
                          value={newTable.config?.[field.name] || ""}
                          onChange={(e) => setNewTable({
                            ...newTable,
                            config: { ...newTable.config, [field.name]: e.target.value }
                          })}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Schema Definition */}
              <div className="space-y-2">
                <Label>Schema Fields</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Field name"
                    value={newFieldName}
                    onChange={(e) => setNewFieldName(e.target.value)}
                  />
                  <Select value={newFieldType} onValueChange={(v) => setNewFieldType(v as any)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="string">String</SelectItem>
                      <SelectItem value="bigint">BigInt</SelectItem>
                      <SelectItem value="float">Float</SelectItem>
                      <SelectItem value="boolean">Boolean</SelectItem>
                      <SelectItem value="datetime">DateTime</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={addField}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {newTable.fields?.map((field) => (
                    <Badge key={field.name} variant="secondary" className="gap-1">
                      {field.name}: {field.type}
                      <button onClick={() => removeField(field.name)}>
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Key Field */}
              {newTable.fields && newTable.fields.length > 0 && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    Key Field
                  </Label>
                  <Select
                    value={newTable.keyField}
                    onValueChange={(v) => setNewTable({ ...newTable, keyField: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select key field" />
                    </SelectTrigger>
                    <SelectContent>
                      {newTable.fields.map((field) => (
                        <SelectItem key={field.name} value={field.name}>
                          {field.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Preview SQL */}
              {newTable.name && newTable.fields && newTable.fields.length > 0 && (
                <div className="space-y-2">
                  <Label>Generated SQL</Label>
                  <pre className="p-3 bg-muted rounded-lg text-xs font-mono whitespace-pre-wrap">
                    {generateTableSQL(newTable)}
                  </pre>
                </div>
              )}

              <Button
                onClick={() => createTable.mutate(newTable)}
                disabled={!newTable.name || !newTable.fields?.length || createTable.isPending}
                className="w-full"
              >
                {createTable.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Create Table
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList>
          <TabsTrigger value="tables" className="flex items-center gap-2">
            <Table2 className="h-4 w-4" />
            Tables ({tables?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="builder" className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Join Builder
          </TabsTrigger>
          <TabsTrigger value="examples" className="flex items-center gap-2">
            <Book className="h-4 w-4" />
            Examples
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tables" className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : tables && tables.length > 0 ? (
            <div className="grid gap-4">
              {tables.map((tableName) => (
                <Card key={tableName}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Table2 className="h-5 w-5 text-green-500" />
                        <CardTitle className="text-lg">{tableName}</CardTitle>
                        <Badge variant="outline">Lookup</Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4 mr-1" />
                          Describe
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteTable.mutate(tableName)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-muted-foreground">
                  <Table2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="font-medium">No lookup tables defined</p>
                  <p className="text-sm">Create a table to enable SQL joins</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="builder" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="h-5 w-5" />
                  Join Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Stream</Label>
                    <Select
                      value={joinConfig.streamName}
                      onValueChange={(v) => setJoinConfig({ ...joinConfig, streamName: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select stream" />
                      </SelectTrigger>
                      <SelectContent>
                        {streams?.map((stream) => (
                          <SelectItem key={stream} value={stream}>
                            {stream}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Table</Label>
                    <Select
                      value={joinConfig.tableName}
                      onValueChange={(v) => setJoinConfig({ ...joinConfig, tableName: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select table" />
                      </SelectTrigger>
                      <SelectContent>
                        {tables?.map((table) => (
                          <SelectItem key={table} value={table}>
                            {table}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Join Type</Label>
                  <div className="flex gap-2">
                    {["inner", "left", "right", "full", "cross"].map((type) => (
                      <Badge
                        key={type}
                        variant={joinConfig.joinType === type ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => setJoinConfig({ ...joinConfig, joinType: type as any })}
                      >
                        {type.toUpperCase()}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Stream Join Field</Label>
                    <Input
                      placeholder="user_id"
                      value={joinConfig.streamField}
                      onChange={(e) => setJoinConfig({ ...joinConfig, streamField: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Table Join Field</Label>
                    <Input
                      placeholder="id"
                      value={joinConfig.tableField}
                      onChange={(e) => setJoinConfig({ ...joinConfig, tableField: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Select Fields (comma-separated)</Label>
                  <Input
                    placeholder="s.*, t.name, t.department"
                    onChange={(e) => setJoinConfig({
                      ...joinConfig,
                      selectFields: e.target.value.split(",").map(f => f.trim()).filter(Boolean)
                    })}
                  />
                </div>

                <Button onClick={generateJoinSQL} className="w-full">
                  <Wand2 className="h-4 w-4 mr-2" />
                  Generate Join SQL
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Code2 className="h-5 w-5" />
                    Generated SQL
                  </CardTitle>
                  {generatedSQL && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(generatedSQL, "SQL")}
                    >
                      {copied === "SQL" ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {generatedSQL ? (
                  <pre className="p-4 bg-muted rounded-lg font-mono text-sm whitespace-pre-wrap">
                    {generatedSQL}
                  </pre>
                ) : (
                  <div className="h-48 flex items-center justify-center text-muted-foreground">
                    Configure the join and click Generate
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Join Type Reference */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <Info className="h-5 w-5 text-blue-500 mt-0.5" />
                <div className="space-y-2 text-sm">
                  <p><strong>Join Types:</strong></p>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-muted-foreground">
                    <li><Badge variant="secondary" className="mr-2">INNER</Badge>Returns only matching rows from both stream and table</li>
                    <li><Badge variant="secondary" className="mr-2">LEFT</Badge>Returns all stream rows, with table matches or NULL</li>
                    <li><Badge variant="secondary" className="mr-2">RIGHT</Badge>Returns all table rows, with stream matches or NULL</li>
                    <li><Badge variant="secondary" className="mr-2">FULL</Badge>Returns all rows from both, with matches or NULL</li>
                    <li><Badge variant="secondary" className="mr-2">CROSS</Badge>Returns Cartesian product of stream × table</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="examples" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {JOIN_EXAMPLES.map((example) => (
              <Card key={example.name} className="hover:border-primary transition-colors">
                <CardHeader>
                  <CardTitle className="text-lg">{example.name}</CardTitle>
                  <CardDescription>{example.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs bg-muted p-3 rounded-lg font-mono whitespace-pre-wrap">
                    {example.sql}
                  </pre>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => copyToClipboard(example.sql, example.name)}
                  >
                    {copied === example.name ? (
                      <Check className="h-4 w-4 mr-1" />
                    ) : (
                      <Copy className="h-4 w-4 mr-1" />
                    )}
                    Copy
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default LookupTablesUI;
