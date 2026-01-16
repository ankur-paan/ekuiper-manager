import {
  EKuiperInfo,
  Stream,
  StreamCreateRequest,
  StreamListItem,
  Table,
  TableCreateRequest,
  Rule,
  RuleListItem,
  RuleMetrics,
  RuleTopology,
  Plugin,
  PluginType,
  PluginCreateRequest,
  Service,
  ServiceCreateRequest,
  ExternalFunction,
  ApiError,
  UserDefinedFunction,
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

  // ---------------------------------------------------------------------------
  // HTTP Helper Methods
  // ---------------------------------------------------------------------------

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      // Build headers with optional eKuiper URL
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...((options.headers as Record<string, string>) || {}),
      };

      if (this.ekuiperUrl) {
        headers["X-EKuiper-URL"] = this.ekuiperUrl;
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        signal: controller.signal,
        headers,
      });

      clearTimeout(timeoutId);

      // Check for proxy error (502)
      if (response.status === 502) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Cannot connect to eKuiper server`);
      }

      if (!response.ok) {
        const error: ApiError = await response.json().catch(() => ({
          error: `HTTP ${response.status}: ${response.statusText}`,
        }));
        throw new Error(error.error || error.message || "Unknown error");
      }

      // Handle empty responses
      const text = await response.text();
      if (!text) return {} as T;

      return JSON.parse(text) as T;
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

  async listUDFs(): Promise<string[]> {
    return this.request<string[]>("/plugins/udfs");
  }

  async getUDF(name: string): Promise<UserDefinedFunction> {
    return this.request<UserDefinedFunction>(`/plugins/udfs/${encodeURIComponent(name)}`);
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
}

// Export singleton instance for easy use
export const ekuiperClient = new EKuiperClient();
