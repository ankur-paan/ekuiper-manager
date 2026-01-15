/**
 * eKuiper Manager Types
 * Open-source alternative to EMQ's proprietary eKuiper Manager
 * Similar to Neuron's management interface
 */

// System Information
export interface SystemInfo {
  version: string;
  os: string;
  arch: string;
  uptime: number; // in seconds
  cpuUsage: string | number; // e.g. "0.29%" or -1
  memoryUsed: string | number; // e.g. "60420096" or -1
  memoryTotal: string | number; // e.g. "33582968832" or -1
  goroutines: number;
}

export interface ServerMetrics {
  ruleCount: number;
  runningRules: number;
  streamCount: number;
  tableCount: number;
  pluginCount: number;
  serviceCount: number;
  totalMessagesIn: number;
  totalMessagesOut: number;
  totalExceptions: number;
}

// SQL Validation Types
export interface SQLValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

export interface SQLExplainResult {
  plan: string;
  sources: string[];
  sinks: string[];
  operators: SQLOperator[];
}

export interface SQLOperator {
  type: string;
  info: Record<string, any>;
}

export interface SQLTestResult {
  success: boolean;
  output?: any[];
  error?: string;
  executionTime?: number;
}

// Configuration Types
export interface SourceConfig {
  type: string;
  confKey: string;
  config: Record<string, any>;
}

export interface SinkConfig {
  type: string;
  confKey: string;
  config: Record<string, any>;
}

export interface ConnectionConfig {
  id: string;
  type: "mqtt" | "edgex" | "httppull" | "httppush" | "sql" | "redis" | "influx";
  name: string;
  config: Record<string, any>;
  status: "connected" | "disconnected" | "error";
  lastError?: string;
}

// Schema Registry
export interface SchemaDefinition {
  name: string;
  type: "protobuf" | "json" | "avro";
  content: string;
  createdAt: string;
  updatedAt: string;
}

// Log Entry
export interface LogEntry {
  timestamp: string;
  level: "DEBUG" | "INFO" | "WARN" | "ERROR";
  message: string;
  ruleId?: string;
  component?: string;
}

// Rule Graph Node
export interface RuleGraphNode {
  id: string;
  type: "source" | "operator" | "sink";
  name: string;
  metrics?: {
    messagesIn: number;
    messagesOut: number;
    exceptions: number;
    latency: number;
  };
}

export interface RuleGraphEdge {
  source: string;
  target: string;
}

export interface RuleGraph {
  nodes: RuleGraphNode[];
  edges: RuleGraphEdge[];
}

// Import/Export
export interface ExportData {
  version: string;
  exportedAt: string;
  streams: any[];
  tables: any[];
  rules: any[];
  plugins?: any[];
  configs?: any[];
}

// Template Types
export interface StreamTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  sql: string;
  variables: TemplateVariable[];
}

export interface RuleTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  rule: {
    sql: string;
    actions: any[];
    options?: any;
  };
  variables: TemplateVariable[];
}

export interface TemplateVariable {
  name: string;
  type: "string" | "number" | "boolean" | "select";
  label: string;
  description?: string;
  default?: any;
  options?: { label: string; value: any }[];
  required?: boolean;
}

// Alerts
export interface Alert {
  id: string;
  severity: "info" | "warning" | "error" | "critical";
  title: string;
  message: string;
  ruleId?: string;
  timestamp: string;
  acknowledged: boolean;
}

// Shared Resources (Connections)
// eKuiper API returns: { id, typ, props, status }
export interface SharedConnection {
  id: string;
  type: string;          // Connection type: mqtt, sql, websocket, etc.
  props: Record<string, any>;  // Connection properties (server, username, etc.)
  status?: string;       // Connection status
}
