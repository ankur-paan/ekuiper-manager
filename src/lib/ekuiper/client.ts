import {
  EKuiperInfo,
  BatchRequestItem,
  BatchResponseItem,
  DynamicConfig,
  PortablePluginStatus,
  ImportStatus,
  ConnectionTestResult,
  Stream,
  StreamCreateRequest,
  StreamListItem,
  StreamDetail,
  StreamSchema,
  Table,
  TableCreateRequest,
  TableDetail,
  TableSchema,
  Rule,
  RuleListItem,
  RuleMetrics,
  RuleTopology,
  RuleValidationResult,
  RuleExplainResult,
  RuleBulkStatus,
  RuleCPUUsage,
  RuleSchema,
  RuleTags,
  TraceStrategy,
  TraceSpan,
  JSUDF,
  RuleTestRequest,
  RuleTestResponse,
  MetadataItem,
  MetadataDetail,
  Plugin,
  PluginType,
  PluginCreateRequest,
  Service,
  ServiceCreateRequest,
  ExternalFunction,
  ApiError,
  UserDefinedFunction,
  Schema,
  UploadFile,
  ConfKey,
} from "./types";

// =============================================================================
// eKuiper API Client - Complete REST API wrapper
// =============================================================================

export class EKuiperClient {
  protected baseUrl: string;
  private ekuiperUrl: string | null;
  private timeout: number;

  /**
   * Create an eKuiper client.
   * @param baseUrlOrConnectionId - Either:
   *   - A connection ID (e.g., "local") - will use /api/connections/{id}/ekuiper
   *   - A path starting with "/" (e.g., "/api/ekuiper") - will be used directly with X-EKuiper-URL header
   *   - A full eKuiper URL (e.g., "http://localhost:9081") - will proxy through /api/ekuiper
   * @param ekuiperUrl - Optional direct eKuiper URL when using /api/ekuiper proxy
   * @param timeout - Optional timeout
   * @param isDirect - If true, use baseUrlOrConnectionId as the direct URL (no proxy)
   */
  constructor(baseUrlOrConnectionId?: string, ekuiperUrl?: string, timeout?: number, isDirect: boolean = false) {
    // Determine how to route requests
    if (isDirect && baseUrlOrConnectionId) {
      this.baseUrl = baseUrlOrConnectionId;
      this.ekuiperUrl = null;
    } else if (!baseUrlOrConnectionId) {
      // Default: use local API proxy
      this.baseUrl = "/api/ekuiper";
      this.ekuiperUrl = process.env.NEXT_PUBLIC_EKUIPER_URL || "http://localhost:9081";
    } else if (baseUrlOrConnectionId.startsWith("/")) {
      // Already a proxy path (e.g., /api/connections/xxx/ekuiper)
      this.baseUrl = baseUrlOrConnectionId;
      this.ekuiperUrl = ekuiperUrl || null;
    } else if (baseUrlOrConnectionId.startsWith("http")) {
      // Direct eKuiper URL - proxy through our API
      this.baseUrl = "/api/ekuiper";
      this.ekuiperUrl = baseUrlOrConnectionId;
    } else {
      // Connection ID - use connection-specific proxy
      this.baseUrl = `/api/connections/${baseUrlOrConnectionId}/ekuiper`;
      this.ekuiperUrl = null;
    }

    this.timeout = timeout || parseInt(process.env.EKUIPER_API_TIMEOUT || "30000");
  }

  setBaseUrl(url: string) {
    this.ekuiperUrl = url;
  }

  // ---------------------------------------------------------------------------
  // HTTP Helper Methods
  // ---------------------------------------------------------------------------

  public async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      // Build headers with optional eKuiper URL
      const headers: Record<string, string> = {
        ...((options.headers as Record<string, string>) || {}),
      };

      if (!(options.body instanceof FormData)) {
        headers["Content-Type"] = "application/json";
      }

      if (this.ekuiperUrl) {
        headers["X-EKuiper-URL"] = this.ekuiperUrl;
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        signal: controller.signal,
        headers,
        cache: "no-store",
      });

      clearTimeout(timeoutId);

      // Check for proxy error (502)
      if (response.status === 502) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Cannot connect to eKuiper server`);
      }

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

        try {
          const errorJson = JSON.parse(text);
          if (typeof errorJson === 'string') {
            errorMessage = errorJson;
          } else {
            errorMessage = errorJson.error || errorJson.message || errorMessage;
          }
        } catch {
          if (text) errorMessage = text;
        }

        throw new Error(errorMessage);
      }

      // Handle empty responses
      const text = await response.text();
      if (!text) return {} as T;

      try {
        return JSON.parse(text) as T;
      } catch {
        // If response is not JSON but status is ok (e.g. "ok" string), return as is
        // This prevents errors on endpoints that return plain text success messages
        return text as unknown as T;
      }
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Connection timeout - eKuiper server not responding");
      }
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // System APIs
  // ---------------------------------------------------------------------------

  async getInfo(): Promise<EKuiperInfo> {
    return this.request<EKuiperInfo>("/");
  }

  async ping(): Promise<boolean> {
    try {
      await this.request("/ping");
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Execute multiple API requests in a single call
   * Useful for batch operations to reduce network overhead
   * @param requests - Array of request items
   */
  async batchRequest(requests: BatchRequestItem[]): Promise<BatchResponseItem[]> {
    return this.request<BatchResponseItem[]>("/batch/req", {
      method: "POST",
      body: JSON.stringify(requests),
    });
  }

  /**
   * Dynamically reload configuration without restarting eKuiper
   * Supports: debug, consoleLog, fileLog, timezone
   * @param config - Configuration options to update
   */
  async reloadConfigs(config: DynamicConfig): Promise<void> {
    await this.request<void>("/configs", {
      method: "PATCH",
      body: JSON.stringify(config),
    });
  }

  /**
   * Shutdown eKuiper server gracefully
   * WARNING: This will stop the eKuiper instance
   */
  async shutdown(): Promise<void> {
    await this.request<void>("/stop", {
      method: "POST",
    });
  }

  // ---------------------------------------------------------------------------
  // Streams APIs
  // ---------------------------------------------------------------------------

  async listStreams(): Promise<StreamListItem[]> {
    // eKuiper API returns an array of stream names (strings)
    const result = await this.request<string[]>("/streams");
    // Transform to StreamListItem format
    if (Array.isArray(result)) {
      return result.map(name => typeof name === 'string' ? { name } : name);
    }
    return [];
  }

  async getStream(name: string): Promise<Stream> {
    return this.request<Stream>(`/streams/${encodeURIComponent(name)}`);
  }

  async createStream(sql: string): Promise<void> {
    await this.request<void>("/streams", {
      method: "POST",
      body: JSON.stringify({ sql } as StreamCreateRequest),
    });
  }

  async updateStream(name: string, sql: string): Promise<void> {
    await this.request<void>(`/streams/${encodeURIComponent(name)}`, {
      method: "PUT",
      body: JSON.stringify({ sql } as StreamCreateRequest),
    });
  }

  async deleteStream(name: string): Promise<void> {
    await this.request<void>(`/streams/${encodeURIComponent(name)}`, {
      method: "DELETE",
    });
  }

  /**
   * List all streams with detailed information (type, format, datasource, etc.)
   * Uses the /streamdetails endpoint
   */
  async listStreamDetails(): Promise<StreamDetail[]> {
    return this.request<StreamDetail[]>("/streamdetails");
  }

  /**
   * Get the inferred schema of a stream
   * Returns JSON Schema-like format derived from physical and logical schema definitions
   * @param name - Stream name
   */
  async getStreamSchema(name: string): Promise<StreamSchema> {
    return this.request<StreamSchema>(`/streams/${encodeURIComponent(name)}/schema`);
  }

  // ---------------------------------------------------------------------------
  // Tables APIs
  // ---------------------------------------------------------------------------

  async listTables(): Promise<StreamListItem[]> {
    // eKuiper API returns an array of table names (strings)
    const result = await this.request<string[]>("/tables");
    // Transform to StreamListItem format
    if (Array.isArray(result)) {
      return result.map(name => typeof name === 'string' ? { name } : name);
    }
    return [];
  }

  async getTable(name: string): Promise<Table> {
    return this.request<Table>(`/tables/${encodeURIComponent(name)}`);
  }

  async createTable(sql: string): Promise<void> {
    await this.request<void>("/tables", {
      method: "POST",
      body: JSON.stringify({ sql } as TableCreateRequest),
    });
  }

  async updateTable(name: string, sql: string): Promise<void> {
    await this.request<void>(`/tables/${encodeURIComponent(name)}`, {
      method: "PUT",
      body: JSON.stringify({ sql } as TableCreateRequest),
    });
  }

  async deleteTable(name: string): Promise<void> {
    await this.request<void>(`/tables/${encodeURIComponent(name)}`, {
      method: "DELETE",
    });
  }

  /**
   * List table details with optional kind filter
   * @param kind - Optional filter: 'scan' or 'lookup'
   */
  async listTableDetails(kind?: 'scan' | 'lookup'): Promise<TableDetail[]> {
    const query = kind ? `?kind=${kind}` : '';
    return this.request<TableDetail[]>(`/tabledetails${query}`);
  }

  /**
   * Get table schema (inferred from physical and logical definitions)
   * @param name - Table name
   */
  async getTableSchema(name: string): Promise<TableSchema> {
    return this.request<TableSchema>(`/tables/${encodeURIComponent(name)}/schema`);
  }

  // ---------------------------------------------------------------------------
  // Rules APIs
  // ---------------------------------------------------------------------------

  async listRules(): Promise<RuleListItem[]> {
    return this.request<RuleListItem[]>("/rules");
  }

  async getRule(id: string): Promise<Rule> {
    return this.request<Rule>(`/rules/${encodeURIComponent(id)}`);
  }

  async createRule(rule: Rule): Promise<void> {
    await this.request<void>("/rules", {
      method: "POST",
      body: JSON.stringify(rule),
    });
  }

  async updateRule(id: string, rule: Omit<Rule, "id">): Promise<void> {
    await this.request<void>(`/rules/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(rule),
    });
  }

  async deleteRule(id: string): Promise<void> {
    await this.request<void>(`/rules/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }

  async startRule(id: string): Promise<void> {
    await this.request<void>(`/rules/${encodeURIComponent(id)}/start`, {
      method: "POST",
    });
  }

  async stopRule(id: string): Promise<void> {
    await this.request<void>(`/rules/${encodeURIComponent(id)}/stop`, {
      method: "POST",
    });
  }

  async restartRule(id: string): Promise<void> {
    await this.request<void>(`/rules/${encodeURIComponent(id)}/restart`, {
      method: "POST",
    });
  }

  async getRuleStatus(id: string): Promise<RuleMetrics> {
    return this.request<RuleMetrics>(`/rules/${encodeURIComponent(id)}/status`);
  }

  async getRuleTopology(id: string): Promise<RuleTopology> {
    return this.request<RuleTopology>(`/rules/${encodeURIComponent(id)}/topo`);
  }

  /**
   * Get the output schema of a rule
   * Returns the fields and properties produced by the rule's SELECT statement
   * Useful for understanding the data structure a rule outputs
   * @param id - Rule ID
   */
  async getRuleSchema(id: string): Promise<RuleSchema> {
    return this.request<RuleSchema>(`/rules/${encodeURIComponent(id)}/schema`);
  }

  /**
   * Validate a rule before creating
   * Returns 200 for valid, 400 for bad request, 422 for invalid rule
   */
  async validateRule(rule: Rule): Promise<RuleValidationResult> {
    try {
      await this.request<void>("/rules/validate", {
        method: "POST",
        body: JSON.stringify(rule),
      });
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : "Validation failed",
      };
    }
  }

  /**
   * Get rule execution plan (explain)
   */
  async getRuleExplain(id: string): Promise<RuleExplainResult> {
    return this.request<RuleExplainResult>(`/rules/${encodeURIComponent(id)}/explain`);
  }

  /**
   * Get status of all rules in bulk
   */
  async getAllRulesStatus(): Promise<RuleBulkStatus> {
    // Force iteration to get full metrics, as /rules/status/all only gives summary
    try {
      let rules: any = await this.listRules();
      // Handle potential response wrappers (e.g. { rules: [...] } vs [...])
      if (!Array.isArray(rules)) {
        if (rules && Array.isArray(rules.rules)) {
          rules = rules.rules;
        } else if (rules && Array.isArray(rules.data)) {
          rules = rules.data;
        } else {
          // Try to find any array property
          const arr = Object.values(rules).find(v => Array.isArray(v));
          if (arr) rules = arr;
          else rules = [];
        }
      }
      const statuses: RuleBulkStatus = {};
      await Promise.all((rules as any[]).map(async (r) => {
        try {
          // Handle both object and string formats just in case
          const ruleId = typeof r === 'string' ? r : r.id;
          if (ruleId) {
            const s = await this.getRuleStatus(ruleId);
            statuses[ruleId] = s;
          }
        } catch { /* ignore individual failures */ }
      }));
      return statuses;
    } catch {
      return {};
    }
  }

  /**
   * Get CPU usage for all rules
   */
  async getRulesCPUUsage(): Promise<RuleCPUUsage> {
    return this.request<RuleCPUUsage>("/rules/usage/cpu");
  }

  /**
   * Add tags to a rule (PATCH - append)
   */
  async addRuleTags(id: string, tags: string[]): Promise<void> {
    await this.request<void>(`/rules/${encodeURIComponent(id)}/tags`, {
      method: "PATCH",
      body: JSON.stringify({ tags }),
    });
  }

  /**
   * Reset (replace) all tags on a rule (PUT)
   */
  async setRuleTags(id: string, tags: string[]): Promise<void> {
    await this.request<void>(`/rules/${encodeURIComponent(id)}/tags`, {
      method: "PUT",
      body: JSON.stringify({ tags }),
    });
  }

  /**
   * Delete specific tags from a rule
   */
  async deleteRuleTags(id: string, keys: string[]): Promise<void> {
    await this.request<void>(`/rules/${encodeURIComponent(id)}/tags`, {
      method: "DELETE",
      body: JSON.stringify({ keys }),
    });
  }

  /**
   * Query rules by tags
   */
  async getRulesByTags(tags: string[]): Promise<string[]> {
    return this.request<string[]>("/rules/tags/match", {
      method: "GET",
      body: JSON.stringify({ keys: tags }),
    });
  }

  // ---------------------------------------------------------------------------
  // Tracing APIs (Phase 5)
  // ---------------------------------------------------------------------------

  /**
   * Start tracing for a rule
   * @param ruleId - Rule ID
   * @param strategy - 'always' traces every message, 'head' only traces with context
   */
  async startRuleTrace(ruleId: string, strategy: TraceStrategy = "always"): Promise<void> {
    await this.request<void>(`/rules/${encodeURIComponent(ruleId)}/trace/start`, {
      method: "POST",
      body: JSON.stringify({ strategy }),
    });
  }

  /**
   * Stop tracing for a rule
   */
  async stopRuleTrace(ruleId: string): Promise<void> {
    await this.request<void>(`/rules/${encodeURIComponent(ruleId)}/trace/stop`, {
      method: "POST",
    });
  }

  /**
   * Get trace IDs for a rule
   */
  async getRuleTraceIds(ruleId: string): Promise<string[]> {
    return this.request<string[]>(`/trace/rule/${encodeURIComponent(ruleId)}`);
  }

  /**
   * Get trace details by trace ID
   */
  async getTraceDetail(traceId: string): Promise<TraceSpan> {
    return this.request<TraceSpan>(`/trace/${encodeURIComponent(traceId)}`);
  }

  // ---------------------------------------------------------------------------
  // Rule Test APIs (Phase 5)
  // ---------------------------------------------------------------------------

  /**
   * Create a test rule
   * Returns the WebSocket port for receiving results
   */
  async createRuleTest(request: RuleTestRequest): Promise<RuleTestResponse> {
    return this.request<RuleTestResponse>("/ruletest", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  /**
   * Start a test rule
   */
  async startRuleTest(testId: string): Promise<void> {
    await this.request<void>(`/ruletest/${encodeURIComponent(testId)}/start`, {
      method: "POST",
    });
  }

  /**
   * Delete a test rule
   */
  async deleteRuleTest(testId: string): Promise<void> {
    await this.request<void>(`/ruletest/${encodeURIComponent(testId)}`, {
      method: "DELETE",
    });
  }

  // ---------------------------------------------------------------------------
  // Metadata APIs (Phase 5)
  // ---------------------------------------------------------------------------

  /**
   * List available sinks with metadata
   */
  async listSinkMetadata(): Promise<MetadataItem[]> {
    return this.request<MetadataItem[]>("/metadata/sinks");
  }

  /**
   * Get detailed sink metadata including properties
   */
  async getSinkMetadata(sinkType: string): Promise<MetadataDetail> {
    return this.request<MetadataDetail>(`/metadata/sinks/${encodeURIComponent(sinkType)}`);
  }

  /**
   * List available sources with metadata
   */
  async listSourceMetadata(): Promise<MetadataItem[]> {
    return this.request<MetadataItem[]>("/metadata/sources");
  }

  /**
   * Get detailed source metadata including properties
   */
  async getSourceMetadata(sourceType: string): Promise<MetadataDetail> {
    return this.request<MetadataDetail>(`/metadata/sources/${encodeURIComponent(sourceType)}`);
  }

  async getSourceConfig(type: string): Promise<Record<string, any>> {
    return this.request<Record<string, any>>(`/metadata/sources/yaml/${encodeURIComponent(type)}`);
  }

  async getSinkConfig(type: string): Promise<Record<string, any>> {
    return this.request<Record<string, any>>(`/metadata/sinks/yaml/${encodeURIComponent(type)}`);
  }

  /**
   * Test sink connection
   */
  async testSinkConnection(sinkType: string, config: Record<string, any>): Promise<{ success: boolean; error?: string }> {
    try {
      await this.request<void>(`/metadata/sinks/connection/${encodeURIComponent(sinkType)}`, {
        method: "POST",
        body: JSON.stringify(config),
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Connection test failed" };
    }
  }

  /**
   * Test source connection
   */
  async testSourceConnection(sourceType: string, config: Record<string, any>): Promise<ConnectionTestResult> {
    try {
      await this.request<void>(`/metadata/sources/connection/${encodeURIComponent(sourceType)}`, {
        method: "POST",
        body: JSON.stringify(config),
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Connection test failed" };
    }
  }

  // ---------------------------------------------------------------------------
  // Plugins APIs
  // ---------------------------------------------------------------------------

  async listPlugins(type: PluginType): Promise<string[]> {
    return this.request<string[]>(`/plugins/${type}`);
  }

  async getPlugin(type: PluginType, name: string): Promise<Plugin> {
    return this.request<Plugin>(`/plugins/${type}/${encodeURIComponent(name)}`);
  }

  async createPlugin(type: PluginType, plugin: PluginCreateRequest): Promise<void> {
    await this.request<void>(`/plugins/${type}`, {
      method: "POST",
      body: JSON.stringify(plugin),
    });
  }

  async deletePlugin(type: PluginType, name: string, stop: boolean = false): Promise<void> {
    const query = stop ? "?stop=1" : "";
    await this.request<void>(`/plugins/${type}/${encodeURIComponent(name)}${query}`, {
      method: "DELETE",
    });
  }

  /**
   * Get status of a portable plugin (running, error, instances)
   * Only applicable for 'portables' type
   */
  async getPortablePluginStatus(name: string): Promise<PortablePluginStatus> {
    return this.request<PortablePluginStatus>(`/plugins/portables/${encodeURIComponent(name)}/status`);
  }

  /**
   * Update a plugin with a new version
   * Note: Native plugins require eKuiper restart
   */
  async updatePlugin(type: PluginType, name: string, file: string): Promise<void> {
    await this.request<void>(`/plugins/${type}/${encodeURIComponent(name)}`, {
      method: "PUT",
      body: JSON.stringify({ name, file }),
    });
  }

  async listUDFs(): Promise<string[]> {
    return this.request<string[]>("/plugins/udfs");
  }

  async getUDF(name: string): Promise<UserDefinedFunction> {
    return this.request<UserDefinedFunction>("/plugins/udfs/" + encodeURIComponent(name));
  }

  async getPrebuiltPlugins(type: PluginType): Promise<string[]> {
    return this.request<string[]>(`/plugins/${type}/prebuild`);
  }

  async registerFunctions(pluginName: string, functions: string[]): Promise<void> {
    await this.request<void>(`/plugins/functions/${encodeURIComponent(pluginName)}/register`, {
      method: "POST",
      body: JSON.stringify({ functions }),
    });
  }

  // ---------------------------------------------------------------------------
  // Services APIs (External Functions)
  // ---------------------------------------------------------------------------

  async listServices(): Promise<string[]> {
    return this.request<string[]>("/services");
  }

  async getService(name: string): Promise<Service> {
    return this.request<Service>(`/services/${encodeURIComponent(name)}`);
  }

  async listServiceFunctions(): Promise<string[]> {
    return this.request<string[]>("/services/functions");
  }

  async createService(service: ServiceCreateRequest): Promise<void> {
    await this.request<void>("/services", {
      method: "POST",
      body: JSON.stringify(service),
    });
  }

  async updateService(name: string, service: ServiceCreateRequest): Promise<void> {
    await this.request<void>(`/services/${encodeURIComponent(name)}`, {
      method: "PUT",
      body: JSON.stringify(service),
    });
  }

  async deleteService(name: string): Promise<void> {
    await this.request<void>(`/services/${encodeURIComponent(name)}`, {
      method: "DELETE",
    });
  }

  async listExternalFunctions(): Promise<ExternalFunction[]> {
    return this.request<ExternalFunction[]>("/services/functions");
  }

  async getExternalFunction(name: string): Promise<ExternalFunction> {
    return this.request<ExternalFunction>(`/services/functions/${encodeURIComponent(name)}`);
  }

  // ---------------------------------------------------------------------------
  // JavaScript UDF APIs (Phase 7)
  // ---------------------------------------------------------------------------

  async listJSUDFs(): Promise<string[]> {
    return this.request<string[]>("/udf/javascript");
  }

  async getJSUDF(id: string): Promise<JSUDF> {
    return this.request<JSUDF>(`/udf/javascript/${encodeURIComponent(id)}`);
  }

  async createJSUDF(udf: JSUDF): Promise<void> {
    await this.request<void>("/udf/javascript", {
      method: "POST",
      body: JSON.stringify(udf),
    });
  }

  async updateJSUDF(udf: JSUDF): Promise<void> {
    await this.request<void>(`/udf/javascript/${encodeURIComponent(udf.id)}`, {
      method: "PUT",
      body: JSON.stringify(udf),
    });
  }

  async deleteJSUDF(id: string): Promise<void> {
    await this.request<void>(`/udf/javascript/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }
  async listBuiltinFunctions(): Promise<any> {
    return this.request<any>("/metadata/functions");
  }

  // ---------------------------------------------------------------------------
  // Configuration APIs (Phase 8)
  // ---------------------------------------------------------------------------

  async listSchemas(type: "protobuf" | "avro" | "custom"): Promise<string[]> {
    return this.request<string[]>(`/schemas/${type}`);
  }

  async getSchema(type: string, name: string): Promise<Schema> {
    return this.request<Schema>(`/schemas/${type}/${encodeURIComponent(name)}`);
  }

  async createSchema(type: string, name: string, content: string): Promise<void> {
    const payload: any = { name };
    if (type === "custom") {
      payload.file = content;
    } else {
      payload.content = content;
    }
    await this.request<void>(`/schemas/${type}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updateSchema(type: string, name: string, content: string): Promise<void> {
    const payload: any = {};
    if (type === "custom") {
      payload.file = content;
    } else {
      payload.content = content;
    }
    await this.request<void>(`/schemas/${type}/${encodeURIComponent(name)}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  async deleteSchema(type: string, name: string): Promise<void> {
    await this.request<void>(`/schemas/${type}/${encodeURIComponent(name)}`, {
      method: "DELETE",
    });
  }

  async listUploads(): Promise<string[]> {
    return this.request<string[]>("/uploads");
  }

  async uploadFile(formData: FormData): Promise<void> {
    await this.request<void>("/uploads", {
      method: "POST",
      body: formData
    });
  }

  async deleteUpload(name: string): Promise<void> {
    await this.request<void>(`/uploads/${encodeURIComponent(name)}`, { method: "DELETE" });
  }

  async listConfKeys(category: "sources" | "sinks" | "connections", type: string): Promise<string[]> {
    try {
      // Try standard endpoint first
      return await this.request<string[]>(`/metadata/${category}/${type}/confKeys`);
    } catch {
      // Fallback to YAML endpoint (returns dict of keys)
      // /metadata/sources/yaml/{type}
      const data = await this.request<any>(`/metadata/${category}/yaml/${type}`);
      return data ? Object.keys(data) : [];
    }
  }

  async getConfKey(category: string, type: string, key: string): Promise<ConfKey> {
    try {
      const content = await this.request<any>(`/metadata/${category}/${type}/confKeys/${encodeURIComponent(key)}`);
      return { name: key, content };
    } catch {
      // Fallback: fetch full yaml and pick key
      const data = await this.request<any>(`/metadata/${category}/yaml/${type}`);
      return { name: key, content: data?.[key] || {} };
    }
  }

  /**
   * Helper to canonicalize object for comparison (sort keys)
   */
  private canonicalize(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map((k: any) => this.canonicalize(k));
    }
    const keys = Object.keys(obj).sort();
    const sortedObj: Record<string, any> = {};
    for (const key of keys) {
      sortedObj[key] = this.canonicalize(obj[key]);
    }
    return sortedObj;
  }

  async upsertConfKey(category: string, type: string, key: string, content: any): Promise<void> {
    // Strategy: 
    // 1. Try PUT to item resource (Standard Update/Upsert)
    //    - If 400/404, verify if it was actually created
    // 2. If verify fails, try POST to collection resource (Standard Create)
    // 3. Verify again

    const itemUrl = `/metadata/${category}/${type}/confKeys/${encodeURIComponent(key)}`;
    const collectionUrl = `/metadata/${category}/${type}/confKeys`;

    try {
      await this.request<void>(itemUrl, {
        method: "PUT",
        body: JSON.stringify(content)
      });
    } catch (putError) {
      // First Verification: Check if it succeeded despite the error (common in eKuiper for creation via PUT)
      try {
        const current = await this.getConfKey(category, type, key);
        // Canonical comparison (ignoring key order)
        if (JSON.stringify(this.canonicalize(current.content)) === JSON.stringify(this.canonicalize(content))) {
          return;
        }
      } catch { /* ignore verification error */ }

      // Try POST creation if PUT failed and verify failed
      try {
        await this.request<void>(collectionUrl, {
          method: "POST",
          body: JSON.stringify({
            name: key,
            content: content
          })
        });
      } catch (postError) {
        // Final Verification
        try {
          const current = await this.getConfKey(category, type, key);
          if (JSON.stringify(this.canonicalize(current.content)) === JSON.stringify(this.canonicalize(content))) {
            return;
          }
        } catch { /* ignore verification error */ }

        throw putError;
      }
    }
  }

  async deleteConfKey(category: string, type: string, key: string): Promise<void> {
    try {
      await this.request<void>(`/metadata/${category}/${type}/confKeys/${encodeURIComponent(key)}`, {
        method: "DELETE"
      });
    } catch (granularError) {
      // Verification: Check if gone
      try {
        const current = await this.getConfKey(category, type, key);
        // If content is empty/undefined, it means deleted
        if (!current.content || Object.keys(current.content).length === 0) {
          return;
        }
      } catch {
        // If getConfKey throws, assume it's gone
        return;
      }

      throw granularError;
    }
  }

  async listMetadata(category: string): Promise<any> {
    return this.request<any>(`/metadata/${category}`);
  }

  // ---------------------------------------------------------------------------
  // Data Import/Export APIs (Phase 9)
  // ---------------------------------------------------------------------------

  async exportData(): Promise<Blob> {
    const headers: Record<string, string> = {};
    if (this.ekuiperUrl) headers["X-EKuiper-URL"] = this.ekuiperUrl;

    const response = await fetch(`${this.baseUrl}/data/export`, { headers });
    if (!response.ok) throw new Error("Failed to export data");
    return response.blob();
  }

  async importData(content: string, options?: { stop?: boolean, partial?: boolean }): Promise<void> {
    const params = new URLSearchParams();
    if (options?.stop) params.append("stop", "1");
    if (options?.partial) params.append("partial", "1");

    // eKuiper expects JSON body: { "content": "<stringified ruleset json>" }
    await this.request<void>(`/data/import?${params.toString()}`, {
      method: "POST",
      body: JSON.stringify({ content })
    });
  }

  /**
   * Get status of data import
   */
  async getImportStatus(): Promise<ImportStatus> {
    return this.request<ImportStatus>("/data/import/status");
  }

  async exportRuleset(rules: string[]): Promise<Blob> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.ekuiperUrl) headers["X-EKuiper-URL"] = this.ekuiperUrl;

    // eKuiper expects POST /data/export with array body like ["rule1", "rule2"]
    const response = await fetch(`${this.baseUrl}/data/export`, {
      method: "POST",
      headers,
      body: JSON.stringify(rules)
    });
    if (!response.ok) throw new Error("Failed to export ruleset");
    return response.blob();
  }

  async importRuleset(content: string): Promise<void> {
    // Ruleset import uses the same endpoint as data import
    await this.request<void>("/data/import?partial=1", {
      method: "POST",
      body: JSON.stringify({ content })
    });
  }

  async importDataAsync(formData: FormData): Promise<string> {
    // Assuming response has request_id or similar
    const res = await this.request<{ request_id: string }>("/async/data/import", {
      method: "POST",
      body: formData
    });
    return res.request_id;
  }

  async getAsyncTask(id: string): Promise<any> {
    return this.request<any>(`/async/task/${encodeURIComponent(id)}`);
  }

  // ---------------------------------------------------------------------------
  // Shared Connections APIs (Phase 9)
  // ---------------------------------------------------------------------------

  async listConnections(): Promise<any[]> {
    return this.request<any[]>("/connections");
  }

  async getConnection(id: string): Promise<any> {
    return this.request<any>(`/connections/${encodeURIComponent(id)}`);
  }

  async createConnection(connection: any): Promise<void> {
    await this.request<void>("/connections", {
      method: "POST",
      body: JSON.stringify(connection)
    });
  }

  async updateConnection(id: string, connection: any): Promise<void> {
    await this.request<void>(`/connections/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(connection)
    });
  }

  async deleteConnection(id: string): Promise<void> {
    await this.request<void>(`/connections/${encodeURIComponent(id)}`, {
      method: "DELETE"
    });
  }
}

// Export singleton instance for easy use
export const ekuiperClient = new EKuiperClient();
