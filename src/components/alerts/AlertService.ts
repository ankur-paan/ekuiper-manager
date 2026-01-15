/**
 * Alert Service - Core alert engine for evaluating conditions and triggering notifications
 * 
 * This service handles:
 * - Alert condition evaluation
 * - Webhook delivery with retry logic
 * - Alert state management
 * - File-based persistence (JSON/SQLite)
 */

import type { AlertRule, AlertCondition, AlertMetric, AlertOperator } from "./AlertManager";
import type { WebhookEndpoint } from "./WebhookConfig";
import type { AlertEvent, AlertStatus } from "./AlertHistory";

// Metric snapshot for evaluation
export interface MetricSnapshot {
  timestamp: string;
  ruleId?: string;
  metrics: {
    latency: number;
    throughput: number;
    errorCount: number;
    memoryUsage: number;
    cpuUsage: number;
    ruleStatus: 0 | 1; // 0 = stopped, 1 = running
  };
}

// Alert evaluation result
export interface EvaluationResult {
  alertRule: AlertRule;
  triggered: boolean;
  conditions: {
    condition: AlertCondition;
    currentValue: number;
    passed: boolean;
  }[];
  timestamp: string;
}

// Webhook delivery result
export interface DeliveryResult {
  webhookId: string;
  success: boolean;
  statusCode?: number;
  error?: string;
  retries: number;
  duration: number;
}

// Alert service configuration
export interface AlertServiceConfig {
  evaluationInterval: number; // ms between evaluations
  maxRetries: number;
  retryBackoff: number; // ms
  storageType: "json" | "sqlite";
  storagePath: string;
}

const DEFAULT_CONFIG: AlertServiceConfig = {
  evaluationInterval: 10000, // 10 seconds
  maxRetries: 3,
  retryBackoff: 1000,
  storageType: "json",
  storagePath: "./data/alerts.json",
};

class AlertService {
  private config: AlertServiceConfig;
  private alertRules: Map<string, AlertRule> = new Map();
  private webhooks: Map<string, WebhookEndpoint> = new Map();
  private alertHistory: AlertEvent[] = [];
  private lastTriggered: Map<string, Date> = new Map(); // For cooldown tracking
  private evaluationTimer: NodeJS.Timeout | null = null;
  private listeners: Set<(event: AlertEvent) => void> = new Set();

  constructor(config: Partial<AlertServiceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the alert service
   */
  async initialize(): Promise<void> {
    // Load persisted data
    await this.loadFromStorage();
    console.log("[AlertService] Initialized with", this.alertRules.size, "rules");
  }

  /**
   * Start the evaluation loop
   */
  start(): void {
    if (this.evaluationTimer) return;
    
    this.evaluationTimer = setInterval(
      () => this.evaluateAll(),
      this.config.evaluationInterval
    );
    console.log("[AlertService] Started evaluation loop");
  }

  /**
   * Stop the evaluation loop
   */
  stop(): void {
    if (this.evaluationTimer) {
      clearInterval(this.evaluationTimer);
      this.evaluationTimer = null;
      console.log("[AlertService] Stopped evaluation loop");
    }
  }

  /**
   * Register an alert rule
   */
  registerAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
    this.persistToStorage();
  }

  /**
   * Unregister an alert rule
   */
  unregisterAlertRule(ruleId: string): void {
    this.alertRules.delete(ruleId);
    this.lastTriggered.delete(ruleId);
    this.persistToStorage();
  }

  /**
   * Register a webhook endpoint
   */
  registerWebhook(webhook: WebhookEndpoint): void {
    this.webhooks.set(webhook.id, webhook);
    this.persistToStorage();
  }

  /**
   * Unregister a webhook
   */
  unregisterWebhook(webhookId: string): void {
    this.webhooks.delete(webhookId);
    this.persistToStorage();
  }

  /**
   * Subscribe to alert events
   */
  subscribe(listener: (event: AlertEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Evaluate all enabled alert rules against current metrics
   */
  async evaluateAll(metrics?: MetricSnapshot): Promise<EvaluationResult[]> {
    const snapshot = metrics || await this.fetchMetrics();
    const results: EvaluationResult[] = [];

    for (const rule of this.alertRules.values()) {
      if (!rule.enabled) continue;
      
      const result = this.evaluateRule(rule, snapshot);
      results.push(result);

      if (result.triggered) {
        await this.handleTriggeredAlert(rule, result, snapshot);
      }
    }

    return results;
  }

  /**
   * Evaluate a single alert rule
   */
  evaluateRule(rule: AlertRule, snapshot: MetricSnapshot): EvaluationResult {
    const conditionResults = rule.conditions.map((condition) => {
      const currentValue = this.getMetricValue(condition.metric, snapshot);
      const passed = this.evaluateCondition(condition, currentValue);
      return { condition, currentValue, passed };
    });

    // All conditions must pass for alert to trigger (AND logic)
    const triggered = conditionResults.every((r) => r.passed);

    return {
      alertRule: rule,
      triggered,
      conditions: conditionResults,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get metric value from snapshot
   */
  private getMetricValue(metric: AlertMetric, snapshot: MetricSnapshot): number {
    switch (metric) {
      case "latency":
        return snapshot.metrics.latency;
      case "throughput":
        return snapshot.metrics.throughput;
      case "error_count":
        return snapshot.metrics.errorCount;
      case "memory_usage":
        return snapshot.metrics.memoryUsage;
      case "cpu_usage":
        return snapshot.metrics.cpuUsage;
      case "rule_status":
        return snapshot.metrics.ruleStatus;
      default:
        return 0;
    }
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(condition: AlertCondition, value: number): boolean {
    const ops: Record<AlertOperator, (a: number, b: number) => boolean> = {
      ">": (a, b) => a > b,
      "<": (a, b) => a < b,
      "==": (a, b) => a === b,
      "!=": (a, b) => a !== b,
      ">=": (a, b) => a >= b,
      "<=": (a, b) => a <= b,
    };
    return ops[condition.operator](value, condition.threshold);
  }

  /**
   * Handle a triggered alert
   */
  private async handleTriggeredAlert(
    rule: AlertRule,
    result: EvaluationResult,
    snapshot: MetricSnapshot
  ): Promise<void> {
    // Check cooldown
    const lastTrigger = this.lastTriggered.get(rule.id);
    if (lastTrigger) {
      const cooldownMs = rule.cooldown * 60 * 1000;
      if (Date.now() - lastTrigger.getTime() < cooldownMs) {
        console.log(`[AlertService] Alert ${rule.name} in cooldown, skipping`);
        return;
      }
    }

    // Create alert event
    const event: AlertEvent = {
      id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      alertRuleId: rule.id,
      alertRuleName: rule.name,
      severity: rule.severity,
      status: "triggered",
      message: this.buildAlertMessage(rule, result),
      ruleId: snapshot.ruleId,
      metricValue: result.conditions[0]?.currentValue || 0,
      threshold: result.conditions[0]?.condition.threshold || 0,
      triggeredAt: result.timestamp,
      webhooksSent: 0,
      webhooksSucceeded: 0,
      webhooksFailed: 0,
    };

    // Send webhooks
    const deliveryResults = await this.sendWebhooks(rule, event);
    event.webhooksSent = deliveryResults.length;
    event.webhooksSucceeded = deliveryResults.filter((r) => r.success).length;
    event.webhooksFailed = deliveryResults.filter((r) => !r.success).length;

    // Update state
    this.lastTriggered.set(rule.id, new Date());
    this.alertHistory.push(event);

    // Notify listeners
    this.notifyListeners(event);

    // Persist
    await this.persistToStorage();

    console.log(`[AlertService] Alert triggered: ${rule.name}`);
  }

  /**
   * Build alert message
   */
  private buildAlertMessage(rule: AlertRule, result: EvaluationResult): string {
    const conditions = result.conditions
      .map((c) => `${c.condition.metric} ${c.condition.operator} ${c.condition.threshold} (current: ${c.currentValue})`)
      .join(", ");
    return `${rule.name}: ${conditions}`;
  }

  /**
   * Send webhooks for an alert
   */
  private async sendWebhooks(
    rule: AlertRule,
    event: AlertEvent
  ): Promise<DeliveryResult[]> {
    const results: DeliveryResult[] = [];

    for (const webhookId of rule.channels) {
      const webhook = this.webhooks.get(webhookId);
      if (!webhook || !webhook.enabled) continue;

      const result = await this.deliverWebhook(webhook, event);
      results.push(result);
    }

    return results;
  }

  /**
   * Deliver a single webhook with retry logic
   */
  private async deliverWebhook(
    webhook: WebhookEndpoint,
    event: AlertEvent
  ): Promise<DeliveryResult> {
    const startTime = Date.now();
    let lastError: string | undefined;
    let statusCode: number | undefined;

    for (let attempt = 0; attempt <= webhook.retryCount; attempt++) {
      try {
        // Build payload from template
        const payload = this.buildWebhookPayload(webhook, event);

        // Build headers
        const headers: Record<string, string> = {};
        for (const h of webhook.headers) {
          headers[h.key] = h.value;
        }

        // Add auth headers
        if (webhook.authType === "bearer" && webhook.authCredentials?.token) {
          headers["Authorization"] = `Bearer ${webhook.authCredentials.token}`;
        } else if (webhook.authType === "api_key" && webhook.authCredentials?.apiKey) {
          const headerName = webhook.authCredentials.apiKeyHeader || "X-API-Key";
          headers[headerName] = webhook.authCredentials.apiKey;
        } else if (webhook.authType === "basic") {
          const { username, password } = webhook.authCredentials || {};
          if (username && password) {
            headers["Authorization"] = `Basic ${btoa(`${username}:${password}`)}`;
          }
        }

        // Make request (in production, use actual fetch)
        // For demo purposes, simulate the request
        const response = await this.simulateWebhookRequest(webhook.url, {
          method: webhook.method,
          headers,
          body: payload,
          timeout: webhook.timeout * 1000,
        });

        statusCode = response.status;

        if (response.ok) {
          return {
            webhookId: webhook.id,
            success: true,
            statusCode,
            retries: attempt,
            duration: Date.now() - startTime,
          };
        }

        lastError = `HTTP ${response.status}`;
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Unknown error";
      }

      // Wait before retry
      if (attempt < webhook.retryCount) {
        await this.delay(webhook.retryDelay * 1000 * (attempt + 1));
      }
    }

    return {
      webhookId: webhook.id,
      success: false,
      statusCode,
      error: lastError,
      retries: webhook.retryCount,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Build webhook payload from template
   */
  private buildWebhookPayload(webhook: WebhookEndpoint, event: AlertEvent): string {
    let template = webhook.payloadTemplate || JSON.stringify({
      alert: {
        name: "{{alert.name}}",
        severity: "{{alert.severity}}",
        message: "{{alert.message}}",
        triggeredAt: "{{alert.triggeredAt}}",
      },
    });

    // Replace template variables
    const replacements: Record<string, string> = {
      "{{alert.name}}": event.alertRuleName,
      "{{alert.severity}}": event.severity,
      "{{alert.message}}": event.message,
      "{{alert.triggeredAt}}": event.triggeredAt,
      "{{alert.ruleId}}": event.ruleId || "",
      "{{alert.metricValue}}": String(event.metricValue),
      "{{alert.threshold}}": String(event.threshold),
    };

    for (const [key, value] of Object.entries(replacements)) {
      template = template.replace(new RegExp(key.replace(/[{}]/g, "\\$&"), "g"), value);
    }

    return template;
  }

  /**
   * Simulate webhook request (for demo/testing)
   */
  private async simulateWebhookRequest(
    _url: string,
    _options: { method: string; headers: Record<string, string>; body: string; timeout: number }
  ): Promise<{ ok: boolean; status: number }> {
    // Simulate network delay
    await this.delay(100 + Math.random() * 200);
    
    // Simulate 95% success rate
    const success = Math.random() > 0.05;
    return {
      ok: success,
      status: success ? 200 : 500,
    };
  }

  /**
   * Fetch current metrics from eKuiper
   */
  private async fetchMetrics(): Promise<MetricSnapshot> {
    // In production, fetch from eKuiper API
    // For demo, return simulated metrics
    return {
      timestamp: new Date().toISOString(),
      metrics: {
        latency: Math.random() * 200 + 50,
        throughput: Math.random() * 1000 + 100,
        errorCount: Math.floor(Math.random() * 10),
        memoryUsage: Math.random() * 30 + 40,
        cpuUsage: Math.random() * 40 + 20,
        ruleStatus: Math.random() > 0.1 ? 1 : 0,
      },
    };
  }

  /**
   * Notify all listeners of an alert event
   */
  private notifyListeners(event: AlertEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error("[AlertService] Listener error:", error);
      }
    }
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(eventId: string, acknowledgedBy: string): Promise<void> {
    const event = this.alertHistory.find((e) => e.id === eventId);
    if (event && event.status === "triggered") {
      event.status = "acknowledged";
      event.acknowledgedAt = new Date().toISOString();
      event.acknowledgedBy = acknowledgedBy;
      await this.persistToStorage();
      this.notifyListeners(event);
    }
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(eventId: string): Promise<void> {
    const event = this.alertHistory.find((e) => e.id === eventId);
    if (event && (event.status === "triggered" || event.status === "acknowledged")) {
      event.status = "resolved";
      event.resolvedAt = new Date().toISOString();
      await this.persistToStorage();
      this.notifyListeners(event);
    }
  }

  /**
   * Silence an alert
   */
  async silenceAlert(eventId: string): Promise<void> {
    const event = this.alertHistory.find((e) => e.id === eventId);
    if (event) {
      event.status = "silenced";
      await this.persistToStorage();
      this.notifyListeners(event);
    }
  }

  /**
   * Get alert history
   */
  getHistory(options?: {
    limit?: number;
    severity?: string;
    status?: AlertStatus;
    since?: Date;
  }): AlertEvent[] {
    let result = [...this.alertHistory];

    if (options?.severity) {
      result = result.filter((e) => e.severity === options.severity);
    }
    if (options?.status) {
      result = result.filter((e) => e.status === options.status);
    }
    if (options?.since) {
      result = result.filter((e) => new Date(e.triggeredAt) >= options.since!);
    }

    result.sort((a, b) => 
      new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime()
    );

    if (options?.limit) {
      result = result.slice(0, options.limit);
    }

    return result;
  }

  /**
   * Persist data to storage
   */
  private async persistToStorage(): Promise<void> {
    const data = {
      alertRules: Array.from(this.alertRules.values()),
      webhooks: Array.from(this.webhooks.values()),
      alertHistory: this.alertHistory.slice(-1000), // Keep last 1000 events
      lastTriggered: Object.fromEntries(
        Array.from(this.lastTriggered.entries()).map(([k, v]) => [k, v.toISOString()])
      ),
    };

    // In production, write to file or SQLite
    if (typeof window !== "undefined") {
      localStorage.setItem("alertService", JSON.stringify(data));
    }
    console.log("[AlertService] Persisted to storage");
  }

  /**
   * Load data from storage
   */
  private async loadFromStorage(): Promise<void> {
    try {
      let data: string | null = null;
      
      if (typeof window !== "undefined") {
        data = localStorage.getItem("alertService");
      }

      if (data) {
        const parsed = JSON.parse(data);
        
        for (const rule of parsed.alertRules || []) {
          this.alertRules.set(rule.id, rule);
        }
        for (const webhook of parsed.webhooks || []) {
          this.webhooks.set(webhook.id, webhook);
        }
        this.alertHistory = parsed.alertHistory || [];
        
        for (const [k, v] of Object.entries(parsed.lastTriggered || {})) {
          this.lastTriggered.set(k, new Date(v as string));
        }

        console.log("[AlertService] Loaded from storage");
      }
    } catch (error) {
      console.error("[AlertService] Failed to load from storage:", error);
    }
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const alertService = new AlertService();

// Export class for testing
export { AlertService };
