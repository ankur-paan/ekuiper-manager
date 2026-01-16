// =============================================================================
// eKuiper Types - Complete type definitions for eKuiper REST API
// =============================================================================

// -----------------------------------------------------------------------------
// System Types
// -----------------------------------------------------------------------------

export interface EKuiperInfo {
  version: string;
  os: string;
  arch: string;
  upTimeSeconds: number;
  cpuUsage: string;
  memoryUsed: string;
  memoryTotal: string;
}

// -----------------------------------------------------------------------------
// Stream Types
// -----------------------------------------------------------------------------

export interface StreamField {
  Name: string;
  FieldType: {
    Type: number;
  };
}

export interface StreamOptions {
  DATASOURCE: string;
  FORMAT?: "JSON" | "BINARY";
  TYPE?: "mqtt" | "edgex" | "httppull" | "memory" | "file";
  KEY?: string;
  CONF_KEY?: string;
  SHARED?: boolean;
  TIMESTAMP?: string;
  TIMESTAMP_FORMAT?: string;
  STRICT_VALIDATION?: boolean;
}

export interface Stream {
  Name: string;
  StreamFields: StreamField[] | null;
  Options: StreamOptions;
}

export interface StreamCreateRequest {
  sql: string;
}

export interface StreamListItem {
  name: string;
}

// -----------------------------------------------------------------------------
// Table Types
// -----------------------------------------------------------------------------

export interface Table {
  Name: string;
  Fields: StreamField[] | null;
  Options: StreamOptions & {
    KIND?: "scan" | "lookup";
  };
}

export interface TableCreateRequest {
  sql: string;
}

// Table detail from /tabledetails endpoint
export interface TableDetail {
  name: string;
  type: string;
  format?: string;
  kind?: "scan" | "lookup";
}

// Table schema from /tables/{name}/schema endpoint
export interface TableSchema {
  [field: string]: {
    type: string;
    optional?: boolean;
    items?: TableSchema;
    properties?: TableSchema;
  } | string;
}

// -----------------------------------------------------------------------------
// Rule Types
// -----------------------------------------------------------------------------

export type RuleStatus = "running" | "stopped" | "error";

export interface RuleOptions {
  isEventTime?: boolean;
  lateTolerance?: number;
  concurrency?: number;
  bufferLength?: number;
  sendMetaToSink?: boolean;
  sendError?: boolean;
  qos?: 0 | 1 | 2;
  checkpointInterval?: number;
  restartStrategy?: {
    attempts?: number;
    delay?: number;
    multiplier?: number;
    maxDelay?: number;
    jitterFactor?: number;
  };
}

export interface SinkConfig {
  // Common sink properties
  sendSingle?: boolean;
  dataTemplate?: string;
  concurrency?: number;
  bufferLength?: number;
  retryInterval?: number;
  retryCount?: number;
  cacheLength?: number;
  cacheSaveInterval?: number;
  omitIfEmpty?: boolean;
  [key: string]: any;
}

export interface LogSink extends SinkConfig {
  log?: {};
}

export interface MqttSink extends SinkConfig {
  mqtt: {
    server: string;
    topic: string;
    qos?: 0 | 1 | 2;
    clientId?: string;
    username?: string;
    password?: string;
    certificationPath?: string;
    privateKeyPath?: string;
    insecureSkipVerify?: boolean;
    retained?: boolean;
    connectionSelector?: string;
  };
}

export interface RestSink extends SinkConfig {
  rest: {
    url: string;
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    bodyType?: "json" | "text" | "form";
    timeout?: number;
    headers?: Record<string, string>;
    insecureSkipVerify?: boolean;
  };
}

export interface MemorySink extends SinkConfig {
  memory: {
    topic: string;
  };
}

export interface NopSink extends SinkConfig {
  nop: {
    log?: boolean;
  };
}

export type Sink = LogSink | MqttSink | RestSink | MemorySink | NopSink | Record<string, SinkConfig>;

export interface Rule {
  id: string;
  sql: string;
  actions: Sink[];
  options?: RuleOptions;
}

export interface RuleListItem {
  id: string;
  status: RuleStatus;
}

export interface RuleMetrics {
  status: RuleStatus;
  lastStartTimestamp?: number;
  lastStopTimestamp?: number;
  nextStopTimestamp?: number;
  source_demo_0_records_in_total?: number;
  source_demo_0_records_out_total?: number;
  source_demo_0_exceptions_total?: number;
  source_demo_0_last_invocation?: number;
  source_demo_0_process_latency_us?: number;
  source_demo_0_buffer_length?: number;
  [key: string]: number | string | undefined;
}

export interface RuleTopology {
  sources: string[];
  edges: Record<string, string[]>;
  // Extended topology info from API
  topo?: {
    sources?: string[];
    edges?: [string, string][];
  };
  sinks?: Record<string, any>;
}

// Rule validation result
export interface RuleValidationResult {
  valid: boolean;
  error?: string;
  message?: string;
}

// Rule explain/query plan
export interface RuleExplainResult {
  plan: string;
  [key: string]: any;
}

// Bulk status for all rules
export interface RuleBulkStatus {
  [ruleId: string]: RuleMetrics;
}

// CPU usage for all rules
export interface RuleCPUUsage {
  [ruleId: string]: number;
}

// Rule tags
export interface RuleTags {
  tags: string[];
}

// Tag match query
export interface TagMatchQuery {
  keys: string[];
}

// -----------------------------------------------------------------------------
// Tracing Types (Phase 5)
// -----------------------------------------------------------------------------

export type TraceStrategy = "always" | "head";

export interface TraceStartRequest {
  strategy: TraceStrategy;
}

export interface TraceSpan {
  Name: string;
  TraceID: string;
  SpanID: string;
  ParentSpanID: string;
  Attribute?: Record<string, string>;
  Links?: any[];
  StartTime: string;
  EndTime: string;
  ChildSpan: TraceSpan[];
}

// -----------------------------------------------------------------------------
// Rule Test Types (Phase 5)
// -----------------------------------------------------------------------------

export interface MockSourceData {
  data: Record<string, any>[];
  interval?: number;
  loop?: boolean;
}

export interface RuleTestRequest {
  id: string;
  sql: string;
  mockSource?: Record<string, MockSourceData>;
  sinkProps?: Record<string, any>;
}

export interface RuleTestResponse {
  id: string;
  port: number;
}

// -----------------------------------------------------------------------------
// Metadata Types (Phase 5)
// -----------------------------------------------------------------------------

export interface MetadataAbout {
  trial: boolean;
  installed: boolean;
  author?: string;
  helpUrl?: string;
  description?: string;
}

export interface MetadataItem {
  name: string;
  about: MetadataAbout;
  type: "internal" | "plugin";
}

export interface MetadataProperty {
  name: string;
  default?: any;
  type: string;
  control: string;
  optional: boolean;
  values?: string[];
  hint?: string;
  label?: string;
  connection_related?: boolean;
}

export interface MetadataDetail {
  about: MetadataAbout;
  libs?: string[];
  properties: MetadataProperty[];
  node?: {
    category: string;
    icon?: string;
    label?: string;
  };
  type: "internal" | "plugin";
}

// -----------------------------------------------------------------------------
// Plugin Types
// -----------------------------------------------------------------------------

export type PluginType = "sources" | "sinks" | "functions" | "portables" | "udfs";

export interface Plugin {
  name: string;
  version?: string;
  file?: string;
  functions?: string[];
}

export interface PluginCreateRequest {
  name: string;
  file: string;
  shellParas?: string[];
  functions?: string[];
}

// -----------------------------------------------------------------------------
// Service Types (External Functions)
// -----------------------------------------------------------------------------

export interface ServiceInterface {
  address: string;
  protocol: "grpc" | "rest" | "msgpack-rpc";
  schemaType: "protobuf";
  schemaFile: string;
  options?: {
    headers?: Record<string, string>;
    insecureSkipVerify?: boolean;
  };
  functions?: Array<{
    name: string;
    serviceName: string;
  }>;
}

export interface Service {
  name: string;
  about?: {
    author?: {
      name?: string;
      email?: string;
      company?: string;
      website?: string;
    };
    description?: {
      en_US?: string;
      zh_CN?: string;
    };
    helpUrl?: {
      en_US?: string;
      zh_CN?: string;
    };
  };
  interfaces: Record<string, ServiceInterface>;
}

export interface ServiceCreateRequest {
  name: string;
  file: string;
}

export interface ExternalFunction {
  name: string;
  serviceName: string;
  interfaceName: string;
}

export interface JSUDF {
  id: string;
  script: string;
  isAgg?: boolean;
}

// -----------------------------------------------------------------------------
// Configuration Types
// -----------------------------------------------------------------------------

export interface Schema {
  name: string;
  content?: string;
  file?: string;
}

export interface UploadFile {
  name: string;
}

export interface ConfKey {
  name: string;
  content: Record<string, any>;
}

// -----------------------------------------------------------------------------

export interface MqttSourceConfig {
  qos?: 0 | 1 | 2;
  servers: string[];
  username?: string;
  password?: string;
  protocolVersion?: string;
  clientid?: string;
  certificationPath?: string;
  privateKeyPath?: string;
  insecureSkipVerify?: boolean;
  connectionSelector?: string;
}

export interface EdgeXSourceConfig {
  protocol: "tcp" | "redis";
  server: string;
  port: number;
  topic: string;
  messageType?: "event" | "request";
  serviceServer?: string;
}

export interface HttpPullSourceConfig {
  url: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  interval?: number;
  timeout?: number;
  incremental?: boolean;
  body?: string;
  bodyType?: "json" | "text" | "form";
  headers?: Record<string, string>;
}

// -----------------------------------------------------------------------------
// Decision Tree / Pipeline Types (Custom for SOTA Playground)
// -----------------------------------------------------------------------------

export interface DecisionTreeNode {
  id: string;
  type: "source" | "processor" | "sink";
  position: { x: number; y: number };
  data: {
    label: string;
    ruleId?: string;
    sql?: string;
    sinks?: Sink[];
    streamName?: string;
    memoryTopic?: string;
    config?: Record<string, any>;
  };
}

export interface DecisionTreeEdge {
  id: string;
  source: string;
  target: string;
  animated?: boolean;
  label?: string;
}

export interface DecisionTree {
  id: string;
  name: string;
  description?: string;
  nodes: DecisionTreeNode[];
  edges: DecisionTreeEdge[];
  createdAt: string;
  updatedAt: string;
}

// -----------------------------------------------------------------------------
// MQTT Simulator Types
// -----------------------------------------------------------------------------

export interface MqttMessage {
  topic: string;
  payload: Record<string, any>;
  qos?: 0 | 1 | 2;
  retain?: boolean;
}

export interface MqttSimulatorConfig {
  broker: string;
  clientId: string;
  username?: string;
  password?: string;
  topics: string[];
  payloadTemplate: Record<string, any>;
  interval: number;
  count?: number;
}

// -----------------------------------------------------------------------------
// API Response Types
// -----------------------------------------------------------------------------

export interface ApiError {
  error: string;
  message?: string;
}

export interface ApiSuccess {
  message: string;
}

export interface UserDefinedFunction {
  name: string;
  plugin: string;
}
