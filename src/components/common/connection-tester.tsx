"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, Zap, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  details?: Record<string, any>;
  warnings?: string[];
}

export interface ConnectionConfig {
  type: string;
  properties: Record<string, any>;
}

// Required fields for each source/sink type
const SOURCE_REQUIRED_FIELDS: Record<string, string[]> = {
  mqtt: ["server"],
  redis: ["address"],
  sql: ["url"],
  edgex: [],
  httppull: ["url"],
  httppush: [],
  file: ["path"],
  memory: ["topic"],
  kafka: ["brokers"],
  neuron: [],
  zmq: ["server"],
  video: ["url"],
};

const SINK_REQUIRED_FIELDS: Record<string, string[]> = {
  mqtt: ["server", "topic"],
  rest: ["url"],
  redis: ["address"],
  influx: ["addr", "measurement"],
  tdengine: ["host", "port", "database"],
  file: ["path"],
  memory: ["topic"],
  log: [],
  nop: [],
  edgex: [],
  kafka: ["brokers", "topic"],
  sql: ["url"],
  image: ["path"],
  zmq: ["server"],
};

// Connection validation utilities
export function validateSourceConfig(type: string, config: Record<string, any>): ConnectionTestResult {
  const required = SOURCE_REQUIRED_FIELDS[type.toLowerCase()] || [];
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const field of required) {
    if (!config[field] && config[field] !== 0 && config[field] !== false) {
      missing.push(field);
    }
  }

  if (missing.length > 0) {
    return {
      success: false,
      message: `Missing required fields: ${missing.join(", ")}`,
    };
  }

  // Type-specific validation
  switch (type.toLowerCase()) {
    case "mqtt":
      if (config.server && !config.server.startsWith("tcp://") && !config.server.startsWith("ssl://")) {
        warnings.push("MQTT server should start with tcp:// or ssl://");
      }
      break;
    case "httppull":
      if (config.url && !config.url.startsWith("http://") && !config.url.startsWith("https://")) {
        return { success: false, message: "URL must start with http:// or https://" };
      }
      if (config.interval && config.interval < 100) {
        warnings.push("Polling interval less than 100ms may cause performance issues");
      }
      break;
    case "kafka":
      if (config.brokers && !Array.isArray(config.brokers) && typeof config.brokers === "string") {
        warnings.push("Consider using an array for multiple brokers");
      }
      break;
    case "sql":
      if (!config.driver) {
        warnings.push("No database driver specified, will use default");
      }
      break;
    case "file":
      if (config.path && !config.path.startsWith("/")) {
        warnings.push("File path should be absolute");
      }
      break;
  }

  return {
    success: true,
    message: "Configuration is valid",
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

export function validateSinkConfig(type: string, config: Record<string, any>): ConnectionTestResult {
  const required = SINK_REQUIRED_FIELDS[type.toLowerCase()] || [];
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const field of required) {
    if (!config[field] && config[field] !== 0 && config[field] !== false) {
      missing.push(field);
    }
  }

  if (missing.length > 0) {
    return {
      success: false,
      message: `Missing required fields: ${missing.join(", ")}`,
    };
  }

  // Type-specific validation
  switch (type.toLowerCase()) {
    case "mqtt":
      if (config.server && !config.server.startsWith("tcp://") && !config.server.startsWith("ssl://")) {
        warnings.push("MQTT server should start with tcp:// or ssl://");
      }
      if (config.qos !== undefined && (config.qos < 0 || config.qos > 2)) {
        return { success: false, message: "QoS must be 0, 1, or 2" };
      }
      break;
    case "rest":
      if (config.url && !config.url.startsWith("http://") && !config.url.startsWith("https://")) {
        return { success: false, message: "URL must start with http:// or https://" };
      }
      if (config.method && !["GET", "POST", "PUT", "PATCH", "DELETE"].includes(config.method.toUpperCase())) {
        return { success: false, message: "Invalid HTTP method" };
      }
      break;
    case "influx":
      if (config.addr && !config.addr.startsWith("http://") && !config.addr.startsWith("https://")) {
        warnings.push("InfluxDB address should include protocol (http:// or https://)");
      }
      if (!config.database && !config.bucket) {
        warnings.push("No database/bucket specified");
      }
      break;
    case "file":
      if (config.path && !config.path.startsWith("/")) {
        warnings.push("File path should be absolute");
      }
      break;
    case "kafka":
      if (!config.brokers) {
        return { success: false, message: "Kafka brokers not specified" };
      }
      break;
  }

  return {
    success: true,
    message: "Configuration is valid",
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

// Parse SQL CREATE STREAM/TABLE to extract source configuration
export function parseStreamSQL(sql: string): { type: string; config: Record<string, any> } | null {
  try {
    const normalized = sql.replace(/\s+/g, " ").trim();
    
    // Extract WITH clause
    const withMatch = normalized.match(/WITH\s*\((.*)\)\s*;?\s*$/i);
    if (!withMatch) {
      return null;
    }

    const withClause = withMatch[1];
    const config: Record<string, any> = {};
    let type = "unknown";

    // Parse key-value pairs
    const pairs = withClause.split(",").map(s => s.trim());
    for (const pair of pairs) {
      const match = pair.match(/(\w+)\s*=\s*"([^"]*)"/i) || pair.match(/(\w+)\s*=\s*'([^']*)'/i);
      if (match) {
        const key = match[1].toLowerCase();
        const value = match[2];
        
        if (key === "type") {
          type = value.toLowerCase();
        } else if (key === "datasource") {
          config.datasource = value;
          // Map datasource to expected field based on type
        } else if (key === "conf_key") {
          config.confKey = value;
        } else {
          config[key] = value;
        }
      }
    }

    // Map datasource to type-specific fields
    if (config.datasource) {
      switch (type) {
        case "mqtt":
          config.topic = config.datasource;
          break;
        case "httppull":
        case "httppush":
          config.url = config.datasource;
          break;
        case "file":
          config.path = config.datasource;
          break;
        case "memory":
          config.topic = config.datasource;
          break;
        case "kafka":
          config.topic = config.datasource;
          break;
        case "redis":
          config.channel = config.datasource;
          break;
        case "zmq":
          config.server = config.datasource;
          break;
      }
    }

    return { type, config };
  } catch {
    return null;
  }
}

// Parse action/sink configuration from rule actions
export function parseSinkConfig(action: Record<string, any>): { type: string; config: Record<string, any> } | null {
  const types = Object.keys(action);
  if (types.length === 0) return null;
  
  const type = types[0];
  const config = action[type] || {};
  
  return { type, config };
}

interface ConnectionTesterProps {
  type: "source" | "sink";
  configType: string;
  config: Record<string, any>;
  onTest?: (result: ConnectionTestResult) => void;
  className?: string;
  compact?: boolean;
}

export function ConnectionTester({
  type,
  configType,
  config,
  onTest,
  className,
  compact = false,
}: ConnectionTesterProps) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<ConnectionTestResult | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setResult(null);

    // Simulate a small delay for UX
    await new Promise(resolve => setTimeout(resolve, 500));

    const testResult = type === "source" 
      ? validateSourceConfig(configType, config)
      : validateSinkConfig(configType, config);

    setResult(testResult);
    onTest?.(testResult);
    setTesting(false);
  };

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleTest}
          disabled={testing}
        >
          {testing ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <Zap className="h-4 w-4 mr-1" />
          )}
          Test
        </Button>
        {result && (
          <Badge variant={result.success ? "default" : "destructive"} className={result.success ? "bg-green-500/20 text-green-500" : ""}>
            {result.success ? (
              <CheckCircle2 className="h-3 w-3 mr-1" />
            ) : (
              <XCircle className="h-3 w-3 mr-1" />
            )}
            {result.success ? "Valid" : "Invalid"}
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={handleTest}
          disabled={testing}
          className="flex-1"
        >
          {testing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Testing Configuration...
            </>
          ) : (
            <>
              <Zap className="h-4 w-4 mr-2" />
              Test Configuration
            </>
          )}
        </Button>
      </div>

      {result && (
        <div
          className={cn(
            "p-3 rounded-lg border",
            result.success 
              ? "bg-green-500/10 border-green-500/30" 
              : "bg-red-500/10 border-red-500/30"
          )}
        >
          <div className="flex items-start gap-2">
            {result.success ? (
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
            )}
            <div className="flex-1">
              <p className={cn("font-medium", result.success ? "text-green-500" : "text-red-500")}>
                {result.success ? "Configuration Valid" : "Configuration Invalid"}
              </p>
              <p className="text-sm text-muted-foreground">{result.message}</p>
              
              {result.warnings && result.warnings.length > 0 && (
                <div className="mt-2 space-y-1">
                  {result.warnings.map((warning, i) => (
                    <div key={i} className="flex items-center gap-1 text-sm text-yellow-500">
                      <AlertTriangle className="h-3 w-3" />
                      {warning}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Inline SQL tester for stream creation
interface StreamSQLTesterProps {
  sql: string;
  onResult?: (result: ConnectionTestResult | null) => void;
  className?: string;
}

export function StreamSQLTester({ sql, onResult, className }: StreamSQLTesterProps) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<ConnectionTestResult | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setResult(null);

    await new Promise(resolve => setTimeout(resolve, 500));

    const parsed = parseStreamSQL(sql);
    if (!parsed) {
      const errorResult: ConnectionTestResult = {
        success: false,
        message: "Could not parse SQL. Make sure it includes a valid WITH clause.",
      };
      setResult(errorResult);
      onResult?.(errorResult);
      setTesting(false);
      return;
    }

    const testResult = validateSourceConfig(parsed.type, parsed.config);
    setResult(testResult);
    onResult?.(testResult);
    setTesting(false);
  };

  const parsed = parseStreamSQL(sql);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={testing}
          >
            {testing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                Testing...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-1" />
                Test Configuration
              </>
            )}
          </Button>
          {parsed && (
            <Badge variant="outline" className="font-mono text-xs">
              {parsed.type.toUpperCase()}
            </Badge>
          )}
        </div>

        {result && (
          <Badge 
            variant={result.success ? "default" : "destructive"} 
            className={result.success ? "bg-green-500/20 text-green-500" : ""}
          >
            {result.success ? (
              <CheckCircle2 className="h-3 w-3 mr-1" />
            ) : (
              <XCircle className="h-3 w-3 mr-1" />
            )}
            {result.success ? "Valid" : "Invalid"}
          </Badge>
        )}
      </div>

      {result && !result.success && (
        <div className="p-2 rounded bg-red-500/10 border border-red-500/30">
          <p className="text-sm text-red-500">{result.message}</p>
        </div>
      )}

      {result?.warnings && result.warnings.length > 0 && (
        <div className="p-2 rounded bg-yellow-500/10 border border-yellow-500/30">
          {result.warnings.map((warning, i) => (
            <div key={i} className="flex items-center gap-1 text-sm text-yellow-500">
              <AlertTriangle className="h-3 w-3" />
              {warning}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Sink action tester for rule creation
interface SinkActionTesterProps {
  action: Record<string, any>;
  onResult?: (result: ConnectionTestResult | null) => void;
  className?: string;
}

export function SinkActionTester({ action, onResult, className }: SinkActionTesterProps) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<ConnectionTestResult | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setResult(null);

    await new Promise(resolve => setTimeout(resolve, 500));

    const parsed = parseSinkConfig(action);
    if (!parsed) {
      const errorResult: ConnectionTestResult = {
        success: false,
        message: "Could not parse sink configuration",
      };
      setResult(errorResult);
      onResult?.(errorResult);
      setTesting(false);
      return;
    }

    const testResult = validateSinkConfig(parsed.type, parsed.config);
    setResult(testResult);
    onResult?.(testResult);
    setTesting(false);
  };

  const parsed = parseSinkConfig(action);
  const sinkType = parsed?.type || "unknown";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleTest}
        disabled={testing}
      >
        {testing ? (
          <Loader2 className="h-4 w-4 animate-spin mr-1" />
        ) : (
          <Zap className="h-4 w-4 mr-1" />
        )}
        Test {sinkType}
      </Button>
      
      {result && (
        <Badge 
          variant={result.success ? "default" : "destructive"} 
          className={result.success ? "bg-green-500/20 text-green-500" : ""}
        >
          {result.success ? (
            <CheckCircle2 className="h-3 w-3 mr-1" />
          ) : (
            <XCircle className="h-3 w-3 mr-1" />
          )}
          {result.success ? "OK" : result.message}
        </Badge>
      )}
    </div>
  );
}
