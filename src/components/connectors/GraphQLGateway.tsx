"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Network,
  Plus,
  Edit,
  Trash2,
  MoreHorizontal,
  Play,
  Copy,
  Activity,
  Code2,
  FileJson,
  Braces,
  Clock,
  Zap,
  AlertCircle,
  CheckCircle,
} from "lucide-react";

export interface GraphQLEndpointConfig {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  port: number;
  path: string;
  enablePlayground: boolean;
  enableIntrospection: boolean;
  maxDepth: number;
  maxComplexity: number;
  enableCaching: boolean;
  cacheTTL: number; // seconds
  authentication: "none" | "api_key" | "jwt";
  authConfig?: {
    apiKey?: string;
    jwtSecret?: string;
    jwtIssuer?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface GraphQLQuery {
  id: string;
  name: string;
  description?: string;
  query: string;
  variables?: Record<string, unknown>;
  createdAt: string;
}

export interface GraphQLResolverMapping {
  id: string;
  typeName: string;
  fieldName: string;
  source: "rule" | "stream" | "table" | "custom";
  sourceId: string;
  transform?: string;
}

// Demo endpoint configs
const DEMO_ENDPOINTS: GraphQLEndpointConfig[] = [
  {
    id: "gql-1",
    name: "Main API Gateway",
    description: "Primary GraphQL endpoint for rule data access",
    enabled: true,
    port: 4000,
    path: "/graphql",
    enablePlayground: true,
    enableIntrospection: true,
    maxDepth: 10,
    maxComplexity: 1000,
    enableCaching: true,
    cacheTTL: 60,
    authentication: "api_key",
    authConfig: { apiKey: "***hidden***" },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "gql-2",
    name: "Public Read API",
    description: "Public read-only GraphQL endpoint",
    enabled: true,
    port: 4001,
    path: "/graphql/public",
    enablePlayground: false,
    enableIntrospection: false,
    maxDepth: 5,
    maxComplexity: 500,
    enableCaching: true,
    cacheTTL: 300,
    authentication: "none",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Demo saved queries
const DEMO_QUERIES: GraphQLQuery[] = [
  {
    id: "q-1",
    name: "List All Rules",
    description: "Get all rules with their status",
    query: `query GetAllRules {
  rules {
    id
    name
    status
    sql
    metrics {
      throughput
      latency
    }
  }
}`,
    createdAt: new Date().toISOString(),
  },
  {
    id: "q-2",
    name: "Rule by ID",
    description: "Get a specific rule by ID",
    query: `query GetRule($id: ID!) {
  rule(id: $id) {
    id
    name
    status
    sql
    sources
    sinks {
      type
      config
    }
    metrics {
      throughput
      latency
      errors
    }
  }
}`,
    variables: { id: "rule_1" },
    createdAt: new Date().toISOString(),
  },
  {
    id: "q-3",
    name: "Stream Data",
    description: "Query latest stream data",
    query: `query StreamData($streamId: ID!, $limit: Int) {
  streamData(streamId: $streamId, limit: $limit) {
    timestamp
    payload
    metadata {
      source
      topic
    }
  }
}`,
    variables: { streamId: "mqtt_stream", limit: 100 },
    createdAt: new Date().toISOString(),
  },
];

// Demo resolver mappings
const DEMO_RESOLVERS: GraphQLResolverMapping[] = [
  {
    id: "r-1",
    typeName: "Query",
    fieldName: "rules",
    source: "rule",
    sourceId: "*",
  },
  {
    id: "r-2",
    typeName: "Query",
    fieldName: "rule",
    source: "rule",
    sourceId: "$id",
  },
  {
    id: "r-3",
    typeName: "Query",
    fieldName: "streams",
    source: "stream",
    sourceId: "*",
  },
  {
    id: "r-4",
    typeName: "Rule",
    fieldName: "metrics",
    source: "custom",
    sourceId: "getMetrics",
    transform: "{ throughput, latency, errors }",
  },
];

// Demo schema
const DEMO_SCHEMA = `type Query {
  rules: [Rule!]!
  rule(id: ID!): Rule
  streams: [Stream!]!
  stream(id: ID!): Stream
  streamData(streamId: ID!, limit: Int): [StreamMessage!]!
}

type Mutation {
  createRule(input: RuleInput!): Rule!
  updateRule(id: ID!, input: RuleInput!): Rule!
  deleteRule(id: ID!): Boolean!
  startRule(id: ID!): Rule!
  stopRule(id: ID!): Rule!
}

type Subscription {
  ruleStatusChanged(id: ID): Rule!
  streamData(streamId: ID!): StreamMessage!
}

type Rule {
  id: ID!
  name: String!
  status: RuleStatus!
  sql: String!
  sources: [String!]!
  sinks: [Sink!]!
  metrics: RuleMetrics
  createdAt: DateTime!
  updatedAt: DateTime!
}

type Sink {
  type: String!
  config: JSON
}

type RuleMetrics {
  throughput: Float!
  latency: Float!
  errors: Int!
}

type Stream {
  id: ID!
  name: String!
  type: String!
  format: String!
  config: JSON
}

type StreamMessage {
  timestamp: DateTime!
  payload: JSON!
  metadata: MessageMetadata
}

type MessageMetadata {
  source: String
  topic: String
}

enum RuleStatus {
  RUNNING
  STOPPED
  ERROR
}

input RuleInput {
  name: String!
  sql: String!
  sinks: [SinkInput!]!
}

input SinkInput {
  type: String!
  config: JSON
}

scalar DateTime
scalar JSON`;

export function GraphQLGateway() {
  const [activeTab, setActiveTab] = useState("endpoints");
  const [endpoints, setEndpoints] = useState<GraphQLEndpointConfig[]>(DEMO_ENDPOINTS);
  const [savedQueries, setSavedQueries] = useState<GraphQLQuery[]>(DEMO_QUERIES);
  const [resolvers, setResolvers] = useState<GraphQLResolverMapping[]>(DEMO_RESOLVERS);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingEndpoint, setEditingEndpoint] = useState<GraphQLEndpointConfig | null>(null);
  const [queryPlayground, setQueryPlayground] = useState({
    query: DEMO_QUERIES[0].query,
    variables: "{}",
    result: "",
    loading: false,
  });

  const activeEndpoints = endpoints.filter((e) => e.enabled).length;

  const handleToggleEnabled = (endpointId: string) => {
    setEndpoints((prev) =>
      prev.map((e) =>
        e.id === endpointId
          ? { ...e, enabled: !e.enabled, updatedAt: new Date().toISOString() }
          : e
      )
    );
  };

  const handleDeleteEndpoint = (endpointId: string) => {
    setEndpoints((prev) => prev.filter((e) => e.id !== endpointId));
  };

  const handleExecuteQuery = () => {
    setQueryPlayground((prev) => ({ ...prev, loading: true }));
    
    // Simulate query execution
    setTimeout(() => {
      setQueryPlayground((prev) => ({
        ...prev,
        loading: false,
        result: JSON.stringify(
          {
            data: {
              rules: [
                {
                  id: "rule_1",
                  name: "Temperature Monitor",
                  status: "RUNNING",
                  sql: "SELECT * FROM mqtt_stream WHERE temperature > 30",
                  metrics: { throughput: 150.5, latency: 12.3 },
                },
                {
                  id: "rule_2",
                  name: "Data Aggregator",
                  status: "RUNNING",
                  sql: "SELECT AVG(value) FROM sensor_data GROUP BY device_id",
                  metrics: { throughput: 89.2, latency: 25.1 },
                },
              ],
            },
          },
          null,
          2
        ),
      }));
    }, 500);
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Endpoints
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{endpoints.length}</div>
            <p className="text-xs text-muted-foreground">{activeEndpoints} active</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Saved Queries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{savedQueries.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Resolvers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{resolvers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Schema Types
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">12</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="endpoints">
            <Network className="h-4 w-4 mr-2" />
            Endpoints
          </TabsTrigger>
          <TabsTrigger value="schema">
            <Code2 className="h-4 w-4 mr-2" />
            Schema
          </TabsTrigger>
          <TabsTrigger value="resolvers">
            <Braces className="h-4 w-4 mr-2" />
            Resolvers
          </TabsTrigger>
          <TabsTrigger value="playground">
            <Play className="h-4 w-4 mr-2" />
            Playground
          </TabsTrigger>
        </TabsList>

        <TabsContent value="endpoints" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>GraphQL Endpoints</CardTitle>
                  <CardDescription>
                    Configure GraphQL API gateways for rule data access
                  </CardDescription>
                </div>
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Endpoint
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Add GraphQL Endpoint</DialogTitle>
                      <DialogDescription>
                        Configure a new GraphQL API endpoint
                      </DialogDescription>
                    </DialogHeader>
                    <EndpointForm
                      onSubmit={(ep) => {
                        setEndpoints((prev) => [
                          ...prev,
                          {
                            ...ep,
                            id: `gql-${Date.now()}`,
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                          },
                        ]);
                        setIsAddDialogOpen(false);
                      }}
                      onCancel={() => setIsAddDialogOpen(false)}
                    />
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {endpoints.map((ep) => (
                  <div
                    key={ep.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{ep.name}</span>
                        {ep.enabled ? (
                          <Badge className="bg-green-500">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Disabled</Badge>
                        )}
                        {ep.enablePlayground && (
                          <Badge variant="outline">Playground</Badge>
                        )}
                        <Badge variant="outline">{ep.authentication}</Badge>
                      </div>
                      {ep.description && (
                        <div className="text-sm text-muted-foreground mt-1">
                          {ep.description}
                        </div>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <code className="bg-muted px-1 rounded">
                          :{ep.port}{ep.path}
                        </code>
                        <span>Max depth: {ep.maxDepth}</span>
                        {ep.enableCaching && <span>Cache: {ep.cacheTTL}s</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          navigator.clipboard.writeText(
                            `http://localhost:${ep.port}${ep.path}`
                          )
                        }
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Switch
                        checked={ep.enabled}
                        onCheckedChange={() => handleToggleEnabled(ep.id)}
                      />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingEndpoint(ep)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          {ep.enablePlayground && (
                            <DropdownMenuItem>
                              <Play className="mr-2 h-4 w-4" />
                              Open Playground
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => handleDeleteEndpoint(ep.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schema" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>GraphQL Schema</CardTitle>
                  <CardDescription>
                    Auto-generated schema from rules, streams, and tables
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Schema
                  </Button>
                  <Button size="sm">
                    <Zap className="h-4 w-4 mr-2" />
                    Regenerate
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
                <pre className="whitespace-pre-wrap">{DEMO_SCHEMA}</pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resolvers" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Resolver Mappings</CardTitle>
                  <CardDescription>
                    Map GraphQL fields to data sources
                  </CardDescription>
                </div>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Resolver
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type.Field</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Source ID</TableHead>
                      <TableHead>Transform</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resolvers.map((resolver) => (
                      <TableRow key={resolver.id}>
                        <TableCell className="font-mono">
                          {resolver.typeName}.{resolver.fieldName}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{resolver.source}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {resolver.sourceId}
                        </TableCell>
                        <TableCell>
                          {resolver.transform ? (
                            <code className="text-xs bg-muted px-1 rounded">
                              {resolver.transform}
                            </code>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-red-600">
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

        <TabsContent value="playground" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Query Editor */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Query</CardTitle>
                  <Select
                    onValueChange={(id) => {
                      const q = savedQueries.find((sq) => sq.id === id);
                      if (q) {
                        setQueryPlayground((prev) => ({
                          ...prev,
                          query: q.query,
                          variables: JSON.stringify(q.variables || {}, null, 2),
                        }));
                      }
                    }}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Saved queries..." />
                    </SelectTrigger>
                    <SelectContent>
                      {savedQueries.map((q) => (
                        <SelectItem key={q.id} value={q.id}>
                          {q.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  className="font-mono text-sm min-h-[300px]"
                  value={queryPlayground.query}
                  onChange={(e) =>
                    setQueryPlayground((prev) => ({ ...prev, query: e.target.value }))
                  }
                  placeholder="Enter your GraphQL query..."
                />
                <div>
                  <Label className="text-sm">Variables</Label>
                  <Textarea
                    className="font-mono text-sm mt-1"
                    rows={4}
                    value={queryPlayground.variables}
                    onChange={(e) =>
                      setQueryPlayground((prev) => ({
                        ...prev,
                        variables: e.target.value,
                      }))
                    }
                    placeholder="{}"
                  />
                </div>
                <Button
                  onClick={handleExecuteQuery}
                  disabled={queryPlayground.loading}
                  className="w-full"
                >
                  {queryPlayground.loading ? (
                    <>
                      <Activity className="h-4 w-4 mr-2 animate-spin" />
                      Executing...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Execute Query
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Result */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Result</CardTitle>
                  {queryPlayground.result && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        navigator.clipboard.writeText(queryPlayground.result)
                      }
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-muted rounded-lg p-4 font-mono text-sm min-h-[400px] overflow-auto">
                  {queryPlayground.result ? (
                    <pre className="whitespace-pre-wrap">{queryPlayground.result}</pre>
                  ) : (
                    <div className="text-muted-foreground flex items-center justify-center h-full">
                      Execute a query to see results
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Saved Queries */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Saved Queries</CardTitle>
                <Button size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Save Current
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                {savedQueries.map((q) => (
                  <div
                    key={q.id}
                    className="p-3 border rounded-lg cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      setQueryPlayground((prev) => ({
                        ...prev,
                        query: q.query,
                        variables: JSON.stringify(q.variables || {}, null, 2),
                      }));
                    }}
                  >
                    <div className="font-medium text-sm">{q.name}</div>
                    {q.description && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {q.description}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog
        open={!!editingEndpoint}
        onOpenChange={(open) => !open && setEditingEndpoint(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit GraphQL Endpoint</DialogTitle>
          </DialogHeader>
          {editingEndpoint && (
            <EndpointForm
              endpoint={editingEndpoint}
              onSubmit={(updated) => {
                setEndpoints((prev) =>
                  prev.map((e) =>
                    e.id === editingEndpoint.id
                      ? { ...e, ...updated, updatedAt: new Date().toISOString() }
                      : e
                  )
                );
                setEditingEndpoint(null);
              }}
              onCancel={() => setEditingEndpoint(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface EndpointFormProps {
  endpoint?: GraphQLEndpointConfig;
  onSubmit: (ep: Omit<GraphQLEndpointConfig, "id" | "createdAt" | "updatedAt">) => void;
  onCancel: () => void;
}

function EndpointForm({ endpoint, onSubmit, onCancel }: EndpointFormProps) {
  const [formData, setFormData] = useState({
    name: endpoint?.name || "",
    description: endpoint?.description || "",
    port: endpoint?.port || 4000,
    path: endpoint?.path || "/graphql",
    enablePlayground: endpoint?.enablePlayground ?? true,
    enableIntrospection: endpoint?.enableIntrospection ?? true,
    maxDepth: endpoint?.maxDepth || 10,
    maxComplexity: endpoint?.maxComplexity || 1000,
    enableCaching: endpoint?.enableCaching ?? false,
    cacheTTL: endpoint?.cacheTTL || 60,
    authentication: endpoint?.authentication || "none",
    apiKey: endpoint?.authConfig?.apiKey || "",
    jwtSecret: endpoint?.authConfig?.jwtSecret || "",
    jwtIssuer: endpoint?.authConfig?.jwtIssuer || "",
    enabled: endpoint?.enabled ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const authConfig: GraphQLEndpointConfig["authConfig"] = {};
    if (formData.authentication === "api_key") {
      authConfig.apiKey = formData.apiKey;
    } else if (formData.authentication === "jwt") {
      authConfig.jwtSecret = formData.jwtSecret;
      authConfig.jwtIssuer = formData.jwtIssuer;
    }

    onSubmit({
      name: formData.name,
      description: formData.description || undefined,
      port: formData.port,
      path: formData.path,
      enablePlayground: formData.enablePlayground,
      enableIntrospection: formData.enableIntrospection,
      maxDepth: formData.maxDepth,
      maxComplexity: formData.maxComplexity,
      enableCaching: formData.enableCaching,
      cacheTTL: formData.cacheTTL,
      authentication: formData.authentication as GraphQLEndpointConfig["authentication"],
      authConfig: Object.keys(authConfig).length > 0 ? authConfig : undefined,
      enabled: formData.enabled,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[60vh] overflow-y-auto">
      <div className="space-y-2">
        <Label htmlFor="name">Endpoint Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="Main API Gateway"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          value={formData.description}
          onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
          placeholder="Optional description"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="port">Port</Label>
          <Input
            id="port"
            type="number"
            min={1024}
            max={65535}
            value={formData.port}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, port: parseInt(e.target.value) || 4000 }))
            }
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="path">Path</Label>
          <Input
            id="path"
            value={formData.path}
            onChange={(e) => setFormData((prev) => ({ ...prev, path: e.target.value }))}
            placeholder="/graphql"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Authentication</Label>
        <Select
          value={formData.authentication}
          onValueChange={(v) => setFormData((prev) => ({ ...prev, authentication: v as 'none' | 'api_key' | 'jwt' }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="api_key">API Key</SelectItem>
            <SelectItem value="jwt">JWT</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {formData.authentication === "api_key" && (
        <div className="space-y-2">
          <Label htmlFor="apiKey">API Key</Label>
          <Input
            id="apiKey"
            type="password"
            value={formData.apiKey}
            onChange={(e) => setFormData((prev) => ({ ...prev, apiKey: e.target.value }))}
            placeholder="Enter API key"
          />
        </div>
      )}

      {formData.authentication === "jwt" && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="jwtSecret">JWT Secret</Label>
            <Input
              id="jwtSecret"
              type="password"
              value={formData.jwtSecret}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, jwtSecret: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="jwtIssuer">JWT Issuer</Label>
            <Input
              id="jwtIssuer"
              value={formData.jwtIssuer}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, jwtIssuer: e.target.value }))
              }
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="maxDepth">Max Query Depth</Label>
          <Input
            id="maxDepth"
            type="number"
            min={1}
            max={50}
            value={formData.maxDepth}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, maxDepth: parseInt(e.target.value) || 10 }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="maxComplexity">Max Complexity</Label>
          <Input
            id="maxComplexity"
            type="number"
            min={100}
            value={formData.maxComplexity}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                maxComplexity: parseInt(e.target.value) || 1000,
              }))
            }
          />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center space-x-2">
          <Switch
            id="enablePlayground"
            checked={formData.enablePlayground}
            onCheckedChange={(checked) =>
              setFormData((prev) => ({ ...prev, enablePlayground: checked }))
            }
          />
          <Label htmlFor="enablePlayground">Enable playground</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Switch
            id="enableIntrospection"
            checked={formData.enableIntrospection}
            onCheckedChange={(checked) =>
              setFormData((prev) => ({ ...prev, enableIntrospection: checked }))
            }
          />
          <Label htmlFor="enableIntrospection">Introspection</Label>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center space-x-2">
          <Switch
            id="enableCaching"
            checked={formData.enableCaching}
            onCheckedChange={(checked) =>
              setFormData((prev) => ({ ...prev, enableCaching: checked }))
            }
          />
          <Label htmlFor="enableCaching">Enable caching</Label>
        </div>
        {formData.enableCaching && (
          <div className="flex items-center gap-2">
            <Label>TTL (seconds):</Label>
            <Input
              type="number"
              className="w-20"
              min={1}
              value={formData.cacheTTL}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  cacheTTL: parseInt(e.target.value) || 60,
                }))
              }
            />
          </div>
        )}
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="enabled"
          checked={formData.enabled}
          onCheckedChange={(checked) =>
            setFormData((prev) => ({ ...prev, enabled: checked }))
          }
        />
        <Label htmlFor="enabled">Enable endpoint</Label>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!formData.name}>
          {endpoint ? "Update" : "Create"} Endpoint
        </Button>
      </DialogFooter>
    </form>
  );
}
