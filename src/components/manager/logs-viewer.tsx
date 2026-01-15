"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  FileText, 
  Search, 
  RefreshCw, 
  Download,
  AlertTriangle,
  Info,
  AlertCircle,
  Bug,
  Filter,
  Pause,
  Play,
  Trash2,
  ChevronDown,
  Loader2,
  Wifi,
  WifiOff
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { LogEntry } from "@/lib/ekuiper/manager-types";
import { EKuiperManagerClient } from "@/lib/ekuiper/manager-client";
import { useServerStore } from "@/stores/server-store";

interface LogsViewerProps {
  serverUrl?: string;
}

// Parse log line from eKuiper API response
function parseLogLine(line: string): LogEntry | null {
  // Format: time="2024-01-14 10:30:45" level=info msg="message" rule=ruleId
  const timeMatch = line.match(/time="([^"]+)"/);
  const levelMatch = line.match(/level=(\w+)/);
  const msgMatch = line.match(/msg="([^"]+)"/);
  const ruleMatch = line.match(/rule=(\w+)/);
  const componentMatch = line.match(/file="([^"]+)"/);

  if (!msgMatch) return null;

  const levelMap: Record<string, LogEntry["level"]> = {
    debug: "DEBUG",
    info: "INFO",
    warn: "WARN",
    warning: "WARN",
    error: "ERROR",
  };

  return {
    timestamp: timeMatch ? timeMatch[1] : new Date().toISOString(),
    level: levelMatch ? (levelMap[levelMatch[1].toLowerCase()] || "INFO") : "INFO",
    message: msgMatch[1],
    ruleId: ruleMatch ? ruleMatch[1] : undefined,
    component: componentMatch ? componentMatch[1].split("/").pop() : undefined,
  };
}

// Fetch logs from rule status which contains recent activity
async function fetchRuleLogs(client: EKuiperManagerClient): Promise<LogEntry[]> {
  const logs: LogEntry[] = [];
  
  try {
    const rules = await client.listRules();
    
    for (const rule of rules) {
      try {
        const status = await client.getRuleStatus(rule.id);
        const statusStr = JSON.stringify(status, null, 2);
        
        // Parse status info into log entries
        if (status) {
          // Check for errors
          const lastError = (status as any).lastException;
          if (lastError) {
            logs.push({
              timestamp: new Date().toISOString(),
              level: "ERROR",
              message: lastError,
              ruleId: rule.id,
              component: "rule_engine",
            });
          }

          // Add status info
          logs.push({
            timestamp: new Date().toISOString(),
            level: "INFO",
            message: `Rule ${rule.id}: status=${(status as any).status || "unknown"}`,
            ruleId: rule.id,
            component: "rule_engine",
          });
        }
      } catch (err) {
        // Rule might not be accessible
      }
    }
  } catch (err) {
    logs.push({
      timestamp: new Date().toISOString(),
      level: "WARN",
      message: "Unable to fetch rule logs - eKuiper server may be unavailable",
      component: "logs_viewer",
    });
  }

  return logs;
}

function LogLevelBadge({ level }: { level: LogEntry["level"] }) {
  const variants: Record<LogEntry["level"], { class: string; icon: React.ReactNode }> = {
    DEBUG: { class: "bg-gray-500/10 text-gray-500", icon: <Bug className="h-3 w-3" /> },
    INFO: { class: "bg-blue-500/10 text-blue-500", icon: <Info className="h-3 w-3" /> },
    WARN: { class: "bg-yellow-500/10 text-yellow-500", icon: <AlertTriangle className="h-3 w-3" /> },
    ERROR: { class: "bg-red-500/10 text-red-500", icon: <AlertCircle className="h-3 w-3" /> },
  };

  const { class: className, icon } = variants[level];

  return (
    <Badge variant="outline" className={cn("gap-1 font-mono text-xs", className)}>
      {icon}
      {level}
    </Badge>
  );
}

export function LogsViewer({ serverUrl }: LogsViewerProps) {
  const { getActiveServer } = useServerStore();
  const activeServer = getActiveServer();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [levelFilter, setLevelFilter] = useState<LogEntry["level"] | "ALL">("ALL");
  const [isPaused, setIsPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [pollInterval, setPollInterval] = useState(5000);

  const scrollRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const clientRef = useRef<EKuiperManagerClient | null>(null);

  // Initialize client - use activeServer from store
  useEffect(() => {
    const targetUrl = serverUrl || activeServer?.url;
    if (!targetUrl) {
      setIsConnected(false);
      return;
    }
    
    // Create client with proxy URL and target eKuiper URL
    clientRef.current = new EKuiperManagerClient("/api/ekuiper", targetUrl);
    
    // Test connection
    clientRef.current.testConnection().then((result) => {
      setIsConnected(result.success);
      if (result.success) {
        // Fetch initial logs
        fetchLogs();
      }
    });
  }, [serverUrl, activeServer?.url]);

  const fetchLogs = useCallback(async () => {
    if (!clientRef.current || isPaused) return;
    
    setIsLoading(true);
    try {
      const newLogs = await fetchRuleLogs(clientRef.current);
      setLogs((prev) => {
        // Merge and deduplicate logs
        const allLogs = [...newLogs, ...prev];
        const seen = new Set<string>();
        const unique = allLogs.filter((log) => {
          const key = `${log.timestamp}-${log.message}-${log.ruleId}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        return unique.slice(0, 500); // Keep last 500
      });
      setIsConnected(true);
    } catch (error) {
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, [isPaused]);

  // Poll for logs
  useEffect(() => {
    if (!isPaused && isConnected) {
      intervalRef.current = setInterval(fetchLogs, pollInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPaused, isConnected, pollInterval, fetchLogs]);

  // Filter logs
  useEffect(() => {
    let filtered = logs;

    if (levelFilter !== "ALL") {
      filtered = filtered.filter((log) => log.level === levelFilter);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (log) =>
          log.message.toLowerCase().includes(term) ||
          log.component?.toLowerCase().includes(term) ||
          log.ruleId?.toLowerCase().includes(term)
      );
    }

    setFilteredLogs(filtered);
  }, [logs, levelFilter, searchTerm]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredLogs, autoScroll]);

  const handleClear = () => {
    setLogs([]);
  };

  const handleExport = () => {
    const content = filteredLogs
      .map((log) => `[${log.timestamp}] [${log.level}] [${log.component || "-"}] ${log.message}`)
      .join("\n");

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ekuiper-logs-${new Date().toISOString().split("T")[0]}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const levelCounts = {
    DEBUG: logs.filter((l) => l.level === "DEBUG").length,
    INFO: logs.filter((l) => l.level === "INFO").length,
    WARN: logs.filter((l) => l.level === "WARN").length,
    ERROR: logs.filter((l) => l.level === "ERROR").length,
  };

  return (
    <div className="h-full flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Logs
          </h2>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            {isConnected ? (
              <>
                <Wifi className="h-3 w-3 text-green-500" />
                Connected • {logs.length} entries
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3 text-red-500" />
                Disconnected - unable to reach eKuiper
              </>
            )}
            {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLogs}
            disabled={isLoading}
          >
            <RefreshCw className={cn("h-4 w-4 mr-1", isLoading && "animate-spin")} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPaused(!isPaused)}
          >
            {isPaused ? (
              <>
                <Play className="h-4 w-4 mr-1" />
                Resume
              </>
            ) : (
              <>
                <Pause className="h-4 w-4 mr-1" />
                Pause
              </>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={handleClear}>
            <Trash2 className="h-4 w-4 mr-1" />
            Clear
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
        </div>
      </div>

      {/* Level Summary */}
      <div className="flex gap-2">
        {(["ALL", "DEBUG", "INFO", "WARN", "ERROR"] as const).map((level) => (
          <Button
            key={level}
            variant={levelFilter === level ? "default" : "outline"}
            size="sm"
            onClick={() => setLevelFilter(level)}
            className="gap-2"
          >
            {level === "ALL" ? (
              "All"
            ) : (
              <>
                {level}
                <Badge variant="secondary" className="ml-1">
                  {levelCounts[level]}
                </Badge>
              </>
            )}
          </Button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search logs..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Logs Display */}
      <Card className="flex-1 overflow-hidden">
        <div
          ref={scrollRef}
          className="h-full overflow-auto p-4 font-mono text-sm"
          onScroll={(e) => {
            const el = e.currentTarget;
            const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
            setAutoScroll(isAtBottom);
          }}
        >
          {filteredLogs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No logs to display</p>
                {searchTerm && <p className="text-sm mt-1">Try adjusting your search</p>}
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredLogs.map((log, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-start gap-3 p-2 rounded hover:bg-muted/50 transition-colors",
                    log.level === "ERROR" && "bg-red-500/5",
                    log.level === "WARN" && "bg-yellow-500/5"
                  )}
                >
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <LogLevelBadge level={log.level} />
                  {log.component && (
                    <Badge variant="outline" className="text-xs">
                      {log.component}
                    </Badge>
                  )}
                  {log.ruleId && (
                    <Badge variant="secondary" className="text-xs">
                      {log.ruleId}
                    </Badge>
                  )}
                  <span className={cn(
                    "flex-1",
                    log.level === "ERROR" && "text-red-500",
                    log.level === "WARN" && "text-yellow-500"
                  )}>
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Auto-scroll indicator */}
      {!autoScroll && (
        <Button
          variant="secondary"
          size="sm"
          className="absolute bottom-20 right-8 shadow-lg"
          onClick={() => {
            setAutoScroll(true);
            if (scrollRef.current) {
              scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
          }}
        >
          <ChevronDown className="h-4 w-4 mr-1" />
          Scroll to bottom
        </Button>
      )}
    </div>
  );
}
