"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

export type AuditAction = 
  | "create" | "update" | "delete" | "read"
  | "start" | "stop" | "restart"
  | "login" | "logout"
  | "export" | "import"
  | "execute";

export type AuditResource = 
  | "stream" | "rule" | "table" | "plugin" | "service"
  | "config" | "user" | "session" | "backup";

export type AuditSeverity = "info" | "warning" | "critical";

export interface AuditEntry {
  id: string;
  timestamp: string;
  userId: string;
  username: string;
  userRole: string;
  action: AuditAction;
  resource: AuditResource;
  resourceId?: string;
  resourceName?: string;
  details?: Record<string, unknown>;
  previousValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
  userAgent?: string;
  severity: AuditSeverity;
  success: boolean;
  errorMessage?: string;
}

export interface AuditFilter {
  userId?: string;
  action?: AuditAction;
  resource?: AuditResource;
  severity?: AuditSeverity;
  success?: boolean;
  startDate?: string;
  endDate?: string;
  searchQuery?: string;
}

interface AuditContextType {
  entries: AuditEntry[];
  log: (entry: Omit<AuditEntry, "id" | "timestamp">) => void;
  getEntries: (filter?: AuditFilter) => AuditEntry[];
  exportEntries: (filter?: AuditFilter, format?: "json" | "csv") => string;
  clearEntries: () => void;
}

const AuditContext = createContext<AuditContextType | null>(null);

// Generate demo audit entries
const generateDemoEntries = (): AuditEntry[] => {
  const entries: AuditEntry[] = [];
  const users = [
    { id: "1", username: "admin", role: "admin" },
    { id: "2", username: "editor", role: "editor" },
    { id: "3", username: "operator", role: "operator" },
    { id: "4", username: "viewer", role: "viewer" },
  ];
  
  const actions: Array<{ action: AuditAction; resource: AuditResource; severity: AuditSeverity }> = [
    { action: "login", resource: "session", severity: "info" },
    { action: "create", resource: "stream", severity: "info" },
    { action: "create", resource: "rule", severity: "info" },
    { action: "update", resource: "rule", severity: "info" },
    { action: "start", resource: "rule", severity: "info" },
    { action: "stop", resource: "rule", severity: "warning" },
    { action: "delete", resource: "stream", severity: "warning" },
    { action: "delete", resource: "rule", severity: "critical" },
    { action: "update", resource: "config", severity: "warning" },
    { action: "export", resource: "backup", severity: "info" },
    { action: "logout", resource: "session", severity: "info" },
  ];

  // Generate 50 random entries
  for (let i = 0; i < 50; i++) {
    const user = users[Math.floor(Math.random() * users.length)];
    const actionInfo = actions[Math.floor(Math.random() * actions.length)];
    const timestamp = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);
    
    entries.push({
      id: `audit-${i + 1}`,
      timestamp: timestamp.toISOString(),
      userId: user.id,
      username: user.username,
      userRole: user.role,
      action: actionInfo.action,
      resource: actionInfo.resource,
      resourceId: `${actionInfo.resource}-${Math.floor(Math.random() * 10)}`,
      resourceName: `demo_${actionInfo.resource}_${Math.floor(Math.random() * 10)}`,
      severity: actionInfo.severity,
      success: Math.random() > 0.1,
      ipAddress: `192.168.1.${Math.floor(Math.random() * 255)}`,
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      details: actionInfo.action === "update" ? {
        field: "sql",
        changed: true,
      } : undefined,
    });
  }

  // Sort by timestamp descending
  return entries.sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
};

export function AuditProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<AuditEntry[]>(generateDemoEntries);

  const log = (entry: Omit<AuditEntry, "id" | "timestamp">) => {
    const newEntry: AuditEntry = {
      ...entry,
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
    };
    setEntries((prev) => [newEntry, ...prev]);
  };

  const getEntries = (filter?: AuditFilter): AuditEntry[] => {
    if (!filter) return entries;

    return entries.filter((entry) => {
      if (filter.userId && entry.userId !== filter.userId) return false;
      if (filter.action && entry.action !== filter.action) return false;
      if (filter.resource && entry.resource !== filter.resource) return false;
      if (filter.severity && entry.severity !== filter.severity) return false;
      if (filter.success !== undefined && entry.success !== filter.success) return false;
      
      if (filter.startDate) {
        const startDate = new Date(filter.startDate);
        if (new Date(entry.timestamp) < startDate) return false;
      }
      
      if (filter.endDate) {
        const endDate = new Date(filter.endDate);
        if (new Date(entry.timestamp) > endDate) return false;
      }
      
      if (filter.searchQuery) {
        const query = filter.searchQuery.toLowerCase();
        const searchableText = [
          entry.username,
          entry.action,
          entry.resource,
          entry.resourceName,
          entry.resourceId,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!searchableText.includes(query)) return false;
      }

      return true;
    });
  };

  const exportEntries = (filter?: AuditFilter, format: "json" | "csv" = "json"): string => {
    const filtered = getEntries(filter);

    if (format === "json") {
      return JSON.stringify(filtered, null, 2);
    }

    // CSV format
    const headers = [
      "id", "timestamp", "userId", "username", "userRole",
      "action", "resource", "resourceId", "resourceName",
      "severity", "success", "ipAddress", "errorMessage"
    ];
    
    const rows = filtered.map((entry) =>
      headers.map((h) => {
        const value = entry[h as keyof AuditEntry];
        if (value === undefined || value === null) return "";
        if (typeof value === "object") return JSON.stringify(value);
        return String(value);
      }).join(",")
    );

    return [headers.join(","), ...rows].join("\n");
  };

  const clearEntries = () => {
    setEntries([]);
  };

  return (
    <AuditContext.Provider value={{ entries, log, getEntries, exportEntries, clearEntries }}>
      {children}
    </AuditContext.Provider>
  );
}

export function useAudit() {
  const context = useContext(AuditContext);
  if (!context) {
    throw new Error("useAudit must be used within an AuditProvider");
  }
  return context;
}

// Helper hook for logging common actions
export function useAuditLogger() {
  const { log } = useAudit();
  const userStr = typeof window !== "undefined" ? localStorage.getItem("ekuiper_user") : null;
  const user = userStr ? JSON.parse(userStr) : null;

  const createAuditEntry = (
    action: AuditAction,
    resource: AuditResource,
    options?: {
      resourceId?: string;
      resourceName?: string;
      details?: Record<string, unknown>;
      previousValue?: unknown;
      newValue?: unknown;
      success?: boolean;
      errorMessage?: string;
    }
  ) => {
    const severity: AuditSeverity = 
      action === "delete" ? "critical" :
      ["stop", "update"].includes(action) ? "warning" : "info";

    log({
      userId: user?.id || "anonymous",
      username: user?.username || "anonymous",
      userRole: user?.role || "viewer",
      action,
      resource,
      resourceId: options?.resourceId,
      resourceName: options?.resourceName,
      details: options?.details,
      previousValue: options?.previousValue,
      newValue: options?.newValue,
      severity,
      success: options?.success ?? true,
      errorMessage: options?.errorMessage,
      ipAddress: "127.0.0.1", // Would be determined server-side
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    });
  };

  return {
    logCreate: (resource: AuditResource, resourceId: string, resourceName: string, details?: Record<string, unknown>) =>
      createAuditEntry("create", resource, { resourceId, resourceName, details }),
    logUpdate: (resource: AuditResource, resourceId: string, resourceName: string, previousValue?: unknown, newValue?: unknown) =>
      createAuditEntry("update", resource, { resourceId, resourceName, previousValue, newValue }),
    logDelete: (resource: AuditResource, resourceId: string, resourceName: string) =>
      createAuditEntry("delete", resource, { resourceId, resourceName }),
    logStart: (resource: AuditResource, resourceId: string, resourceName: string) =>
      createAuditEntry("start", resource, { resourceId, resourceName }),
    logStop: (resource: AuditResource, resourceId: string, resourceName: string) =>
      createAuditEntry("stop", resource, { resourceId, resourceName }),
    logLogin: (userId: string, username: string) =>
      log({ userId, username, userRole: "unknown", action: "login", resource: "session", severity: "info", success: true }),
    logLogout: () =>
      createAuditEntry("logout", "session"),
    logExport: (resource: AuditResource, details?: Record<string, unknown>) =>
      createAuditEntry("export", resource, { details }),
    logError: (action: AuditAction, resource: AuditResource, errorMessage: string, details?: Record<string, unknown>) =>
      createAuditEntry(action, resource, { details, success: false, errorMessage }),
  };
}
