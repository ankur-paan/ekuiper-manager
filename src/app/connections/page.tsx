"use client";

import * as React from "react";
import { useServerStore } from "@/stores/server-store";
import { ekuiperClient } from "@/lib/ekuiper/client";
import { AppLayout } from "@/components/layout";
import { DataTable } from "@/components/common/data-table";
import { EmptyState, ConfirmDialog } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type ColumnDef } from "@tanstack/react-table";
import {
  Plus,
  Trash2,
  Edit,
  BookTemplate,
  Loader2,
  CheckCircle2,
  XCircle,
  Wifi,
  Database,
  Globe,
  Server,
  Radio,
  Zap,
  TestTube2,
  Eye,
  EyeOff,
  ChevronRight,
  RefreshCw,
  Settings2,
  Link2,
  AlertCircle,
  Info,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { CodeEditor } from "@/components/ui/code-editor";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";

// =============================================================================
// Types & Interfaces
// =============================================================================

interface ConfKeyItem {
  name: string;
}

interface ConnectionItem {
  id: string;
  typ: string;
  props?: Record<string, any>;
  status?: string;
}

type ConnectionType = "mqtt" | "sql" | "redis" | "http" | "influx" | "influx2" | "edgex" | "nng" | "websocket";

interface ConnectionTypeConfig {
  id: ConnectionType;
  name: string;
  description: string;
  Icon: React.ComponentType<{ className?: string }>;
  color: string;
  fields: FieldConfig[];
}

interface FieldConfig {
  key: string;
  label: string;
  type: "text" | "number" | "password" | "select" | "switch" | "textarea";
  placeholder?: string;
  description?: string;
  required?: boolean;
  default?: any;
  options?: { value: string; label: string }[];
  group?: string;
  advanced?: boolean;
}

// =============================================================================
// Connection Type Configurations - Based on eKuiper Official Documentation
// =============================================================================

const CONNECTION_TYPES: ConnectionTypeConfig[] = [
  {
    id: "mqtt",
    name: "MQTT",
    description: "Connect to MQTT brokers for pub/sub messaging",
    Icon: Radio,
    color: "from-emerald-500 to-teal-600",
    fields: [
      { key: "server", label: "Broker Address", type: "text", placeholder: "tcp://localhost:1883", required: true, description: "MQTT broker URL (tcp:// or ssl://)" },
      { key: "protocolVersion", label: "Protocol Version", type: "select", default: "3.1.1", options: [{ value: "3.1", label: "MQTT 3.1" }, { value: "3.1.1", label: "MQTT 3.1.1" }] },
      { key: "clientid", label: "Client ID", type: "text", placeholder: "ekuiper-client", description: "Unique client identifier (auto-generated if empty)" },
      { key: "username", label: "Username", type: "text", placeholder: "Enter username", group: "Authentication" },
      { key: "password", label: "Password", type: "password", placeholder: "Enter password", group: "Authentication" },
      { key: "qos", label: "QoS Level", type: "select", default: "1", options: [{ value: "0", label: "0 - At most once" }, { value: "1", label: "1 - At least once" }, { value: "2", label: "2 - Exactly once" }] },
      { key: "retained", label: "Retained", type: "switch", default: false, description: "Retain last message" },
      { key: "certificationPath", label: "Certificate Path", type: "text", placeholder: "/path/to/cert.pem", group: "TLS/SSL", advanced: true },
      { key: "privateKeyPath", label: "Private Key Path", type: "text", placeholder: "/path/to/key.pem", group: "TLS/SSL", advanced: true },
      { key: "rootCaPath", label: "Root CA Path", type: "text", placeholder: "/path/to/ca.pem", group: "TLS/SSL", advanced: true },
      { key: "insecureSkipVerify", label: "Skip TLS Verification", type: "switch", default: false, group: "TLS/SSL", advanced: true },
    ],
  },
  {
    id: "sql",
    name: "SQL Database",
    description: "Connect to SQL databases (MySQL, PostgreSQL, SQLite)",
    Icon: Database,
    color: "from-blue-500 to-indigo-600",
    fields: [
      { key: "url", label: "Connection URL", type: "text", placeholder: "mysql://user:pass@localhost:3306/dbname", required: true, description: "Database connection string" },
      { key: "table", label: "Table Name", type: "text", placeholder: "my_table", description: "Target table for operations" },
      { key: "fields", label: "Fields", type: "text", placeholder: "id, name, value", description: "Comma-separated field list" },
      { key: "rowkindField", label: "Row Kind Field", type: "text", placeholder: "action", advanced: true },
      { key: "keyField", label: "Key Field", type: "text", placeholder: "id", advanced: true },
    ],
  },
  {
    id: "redis",
    name: "Redis",
    description: "Connect to Redis for caching and pub/sub",
    Icon: Zap,
    color: "from-red-500 to-rose-600",
    fields: [
      { key: "addr", label: "Redis Address", type: "text", placeholder: "localhost:6379", required: true },
      { key: "password", label: "Password", type: "password", placeholder: "Enter password" },
      { key: "db", label: "Database Index", type: "number", placeholder: "0", default: 0 },
      { key: "dataType", label: "Data Type", type: "select", default: "string", options: [{ value: "string", label: "String" }, { value: "list", label: "List" }, { value: "hash", label: "Hash" }] },
      { key: "keyType", label: "Key Type", type: "select", default: "single", options: [{ value: "single", label: "Single Key" }, { value: "multiple", label: "Multiple Keys" }], advanced: true },
    ],
  },
  {
    id: "http",
    name: "HTTP/REST",
    description: "Connect to REST APIs and HTTP endpoints",
    Icon: Globe,
    color: "from-orange-500 to-amber-600",
    fields: [
      { key: "url", label: "Endpoint URL", type: "text", placeholder: "https://api.example.com/data", required: true },
      { key: "method", label: "HTTP Method", type: "select", default: "POST", options: [{ value: "GET", label: "GET" }, { value: "POST", label: "POST" }, { value: "PUT", label: "PUT" }, { value: "DELETE", label: "DELETE" }] },
      { key: "headers", label: "Headers (JSON)", type: "textarea", placeholder: '{"Content-Type": "application/json"}', description: "Custom HTTP headers as JSON" },
      { key: "bodyType", label: "Body Type", type: "select", default: "json", options: [{ value: "json", label: "JSON" }, { value: "text", label: "Plain Text" }, { value: "form", label: "Form Data" }] },
      { key: "timeout", label: "Timeout (ms)", type: "number", placeholder: "5000", default: 5000, advanced: true },
      { key: "insecureSkipVerify", label: "Skip TLS Verification", type: "switch", default: false, advanced: true },
    ],
  },
  {
    id: "influx",
    name: "InfluxDB v1",
    description: "Time-series database InfluxDB 1.x",
    Icon: Server,
    color: "from-purple-500 to-violet-600",
    fields: [
      { key: "addr", label: "InfluxDB Address", type: "text", placeholder: "http://localhost:8086", required: true },
      { key: "database", label: "Database", type: "text", placeholder: "mydb", required: true },
      { key: "measurement", label: "Measurement", type: "text", placeholder: "sensor_data" },
      { key: "username", label: "Username", type: "text", placeholder: "admin", group: "Authentication" },
      { key: "password", label: "Password", type: "password", placeholder: "Enter password", group: "Authentication" },
      { key: "precision", label: "Precision", type: "select", default: "ms", options: [{ value: "s", label: "Seconds" }, { value: "ms", label: "Milliseconds" }, { value: "ns", label: "Nanoseconds" }], advanced: true },
    ],
  },
  {
    id: "influx2",
    name: "InfluxDB v2",
    description: "Time-series database InfluxDB 2.x",
    Icon: Server,
    color: "from-fuchsia-500 to-pink-600",
    fields: [
      { key: "addr", label: "InfluxDB Address", type: "text", placeholder: "http://localhost:8086", required: true },
      { key: "bucket", label: "Bucket", type: "text", placeholder: "my-bucket", required: true },
      { key: "org", label: "Organization", type: "text", placeholder: "my-org", required: true },
      { key: "token", label: "API Token", type: "password", placeholder: "Enter token", required: true },
      { key: "measurement", label: "Measurement", type: "text", placeholder: "sensor_data" },
      { key: "precision", label: "Precision", type: "select", default: "ms", options: [{ value: "s", label: "Seconds" }, { value: "ms", label: "Milliseconds" }, { value: "ns", label: "Nanoseconds" }], advanced: true },
    ],
  },
  {
    id: "edgex",
    name: "EdgeX Foundry",
    description: "Connect to EdgeX Foundry message bus",
    Icon: Link2,
    color: "from-cyan-500 to-sky-600",
    fields: [
      { key: "protocol", label: "Protocol", type: "select", default: "redis", options: [{ value: "redis", label: "Redis" }, { value: "mqtt", label: "MQTT" }, { value: "zeromq", label: "ZeroMQ" }], required: true },
      { key: "server", label: "Server Address", type: "text", placeholder: "localhost", required: true },
      { key: "port", label: "Port", type: "number", placeholder: "6379", required: true },
      { key: "topic", label: "Topic", type: "text", placeholder: "rules-events" },
      { key: "deviceName", label: "Device Name", type: "text", placeholder: "device-001" },
      { key: "profileName", label: "Profile Name", type: "text", placeholder: "sensor-profile" },
    ],
  },
];

// Quick-start templates
const TEMPLATES: Record<string, { type: ConnectionType; name: string; config: Record<string, any> }> = {
  "mqtt-emqx": {
    type: "mqtt",
    name: "EMQX Cloud",
    config: { server: "tcp://broker.emqx.io:1883", qos: 1, protocolVersion: "3.1.1" },
  },
  "mqtt-mosquitto": {
    type: "mqtt",
    name: "Mosquitto Local",
    config: { server: "tcp://localhost:1883", qos: 1, protocolVersion: "3.1.1" },
  },
  "mqtt-hivemq": {
    type: "mqtt",
    name: "HiveMQ Public",
    config: { server: "tcp://broker.hivemq.com:1883", qos: 1, protocolVersion: "3.1.1" },
  },
  "influx-local": {
    type: "influx",
    name: "InfluxDB Local",
    config: { addr: "http://localhost:8086", database: "ekuiper", precision: "ms" },
  },
  "redis-local": {
    type: "redis",
    name: "Redis Local",
    config: { addr: "localhost:6379", db: 0, dataType: "string" },
  },
};

// =============================================================================
// Main Component
// =============================================================================

export default function ConnectionsPage() {
  const { servers, activeServerId } = useServerStore();
  const activeServer = servers.find((s) => s.id === activeServerId);

  // Main view tabs
  const [viewTab, setViewTab] = React.useState("instances");

  // --- Connection Instances State ---
  const [connections, setConnections] = React.useState<ConnectionItem[]>([]);
  const [loadingConns, setLoadingConns] = React.useState(false);
  const [connDialogOpen, setConnDialogOpen] = React.useState(false);
  const [wizardStep, setWizardStep] = React.useState<"select" | "configure">("select");
  const [editingConnId, setEditingConnId] = React.useState<string | null>(null);
  const [selectedConnType, setSelectedConnType] = React.useState<ConnectionType | null>(null);
  const [connForm, setConnForm] = React.useState<Record<string, any>>({ id: "" });
  const [connSaving, setConnSaving] = React.useState(false);
  const [connTesting, setConnTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<{ success: boolean; message: string } | null>(null);
  const [deleteConnId, setDeleteConnId] = React.useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [showPasswords, setShowPasswords] = React.useState<Record<string, boolean>>({});
  const [editorMode, setEditorMode] = React.useState(false);
  const [rawJson, setRawJson] = React.useState("{}");

  // --- Configuration Keys State (Templates) ---
  const [activeResTab, setActiveResTab] = React.useState<"sources" | "sinks" | "connections">("sources");
  const [types, setTypes] = React.useState<string[]>([]);
  const [selectedType, setSelectedType] = React.useState<string | null>(null);
  const [keys, setKeys] = React.useState<ConfKeyItem[]>([]);
  const [loadingTypes, setLoadingTypes] = React.useState(false);
  const [loadingKeys, setLoadingKeys] = React.useState(false);
  const [keyDialogOpen, setKeyDialogOpen] = React.useState(false);
  const [editingKey, setEditingKey] = React.useState<string | null>(null);
  const [keyName, setKeyName] = React.useState("");
  const [keyContent, setKeyContent] = React.useState("{}");
  const [keySaving, setKeySaving] = React.useState(false);
  const [deleteKey, setDeleteKey] = React.useState<string | null>(null);
  const [keyForm, setKeyForm] = React.useState<Record<string, any>>({});
  const [keyFormMode, setKeyFormMode] = React.useState(true);
  const [showKeyAdvanced, setShowKeyAdvanced] = React.useState(false);

  const activeServerUrl = activeServer?.url;

  // =============================================================================
  // Connections CRUD
  // =============================================================================

  const fetchConnections = React.useCallback(async (showErrorToast = false) => {
    if (!activeServerUrl) return;
    setLoadingConns(true);
    ekuiperClient.setBaseUrl(activeServerUrl);
    try {
      const list = await ekuiperClient.listConnections();
      setConnections(Array.isArray(list) ? list : []);
    } catch (err) {
      // Only show error toast for user-triggered refreshes, not automatic fetches
      if (showErrorToast) {
        toast.error("Failed to fetch connections. Check server connection.");
      }
      console.warn("Failed to fetch connections:", err);
      setConnections([]);
    } finally {
      setLoadingConns(false);
    }
  }, [activeServerUrl]);

  React.useEffect(() => {
    if (viewTab === "instances") fetchConnections(false); // Don't show error on auto-fetch
  }, [fetchConnections, viewTab]);

  // Auto-refresh connection status every 5 seconds when viewing Active Connections
  React.useEffect(() => {
    if (viewTab !== "instances" || !activeServerUrl) return;

    const intervalId = setInterval(() => {
      // Silent refresh - don't show loading spinner for background updates
      ekuiperClient.setBaseUrl(activeServerUrl);
      ekuiperClient.listConnections()
        .then((list) => {
          if (Array.isArray(list)) {
            setConnections(list);
          }
        })
        .catch((err) => {
          console.warn("Background connection status refresh failed:", err);
        });
    }, 5000); // Refresh every 5 seconds

    return () => clearInterval(intervalId);
  }, [viewTab, activeServerUrl]);

  const openNewConnectionDialog = () => {
    setEditingConnId(null);
    setSelectedConnType(null);
    setConnForm({ id: "" });
    setWizardStep("select");
    setShowAdvanced(false);
    setTestResult(null);
    setEditorMode(false);
    setRawJson("{}");
    setConnDialogOpen(true);
  };

  const openEditConnectionDialog = async (conn: ConnectionItem) => {
    setEditingConnId(conn.id);
    setSelectedConnType(conn.typ as ConnectionType);

    // Load connection details
    try {
      const details = await ekuiperClient.getConnection(conn.id);
      const props = details.props || conn.props || {};
      setConnForm({ id: conn.id, ...props });
      setRawJson(JSON.stringify(props, null, 2));
    } catch {
      setConnForm({ id: conn.id, ...conn.props });
      setRawJson(JSON.stringify(conn.props || {}, null, 2));
    }

    setWizardStep("configure");
    setShowAdvanced(false);
    setTestResult(null);
    setEditorMode(false);
    setConnDialogOpen(true);
  };

  const selectConnectionType = (type: ConnectionType) => {
    setSelectedConnType(type);
    const typeConfig = CONNECTION_TYPES.find((t) => t.id === type);
    const defaults: Record<string, any> = { id: connForm.id || "" };
    typeConfig?.fields.forEach((f) => {
      if (f.default !== undefined) defaults[f.key] = f.default;
    });
    setConnForm(defaults);
    setRawJson(JSON.stringify(defaults, null, 2));
    setWizardStep("configure");
  };

  const applyTemplate = (templateId: string) => {
    const template = TEMPLATES[templateId];
    if (!template) return;
    setSelectedConnType(template.type);
    const newForm = { id: connForm.id || `${template.type}-${Date.now()}`, ...template.config };
    setConnForm(newForm);
    setRawJson(JSON.stringify(template.config, null, 2));
    setWizardStep("configure");
    toast.info(`Applied template: ${template.name}`);
  };

  const handleFieldChange = (key: string, value: any) => {
    const newForm = { ...connForm, [key]: value };
    setConnForm(newForm);
    const { id, ...props } = newForm;
    setRawJson(JSON.stringify(props, null, 2));
  };

  const handleRawJsonChange = (value: string) => {
    setRawJson(value);
    try {
      const parsed = JSON.parse(value);
      setConnForm({ id: connForm.id, ...parsed });
    } catch {
      // Invalid JSON, just update the raw value
    }
  };

  const testConnection = async () => {
    if (!selectedConnType) return;
    setConnTesting(true);
    setTestResult(null);

    try {
      const { id, ...props } = connForm;
      const result = await ekuiperClient.testSinkConnection(selectedConnType, props);
      setTestResult({
        success: result.success,
        message: result.success ? "Connection successful!" : result.error || "Connection failed",
      });
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : "Connection test failed",
      });
    } finally {
      setConnTesting(false);
    }
  };

  const handleSaveConnection = async () => {
    if (!selectedConnType) return;
    if (!connForm.id) {
      toast.error("Connection ID is required");
      return;
    }

    let props: Record<string, any>;
    if (editorMode) {
      try {
        props = JSON.parse(rawJson);
      } catch {
        toast.error("Invalid JSON in editor");
        return;
      }
    } else {
      const { id, ...rest } = connForm;
      props = rest;
    }

    setConnSaving(true);
    const payload = { id: connForm.id, typ: selectedConnType, props };

    try {
      if (editingConnId) {
        await ekuiperClient.updateConnection(connForm.id, payload);
        toast.success("Connection updated successfully");
      } else {
        await ekuiperClient.createConnection(payload);
        toast.success("Connection created successfully");
      }
      setConnDialogOpen(false);
      fetchConnections();
    } catch (err) {
      toast.error(`Failed to save: ${err instanceof Error ? err.message : "Error"}`);
    } finally {
      setConnSaving(false);
    }
  };

  const handleDeleteConnection = async () => {
    if (!deleteConnId) return;
    try {
      await ekuiperClient.deleteConnection(deleteConnId);
      toast.success("Connection deleted");
      setDeleteConnId(null);
      fetchConnections();
    } catch (err) {
      toast.error("Failed to delete connection");
    }
  };

  // =============================================================================
  // Configuration Keys (Templates)
  // =============================================================================

  const fetchTypes = React.useCallback(async (showErrorToast = false) => {
    if (!activeServerUrl) return;
    setLoadingTypes(true);
    setTypes([]);
    setSelectedType(null);
    setKeys([]);
    ekuiperClient.setBaseUrl(activeServerUrl);

    try {
      const meta = await ekuiperClient.listMetadata(activeResTab);
      let typeList: string[] = [];
      if (Array.isArray(meta)) {
        typeList = meta.map((m: any) => m.name || m);
      } else if (typeof meta === "object") {
        typeList = Object.keys(meta);
      }
      setTypes(typeList);
      if (typeList.length > 0) setSelectedType(typeList[0]);
    } catch (err) {
      // Only show error toast for user-triggered refreshes
      if (showErrorToast) {
        toast.error("Failed to fetch types");
      }
      console.warn("Failed to fetch types:", err);
    } finally {
      setLoadingTypes(false);
    }
  }, [activeServerUrl, activeResTab]);

  React.useEffect(() => {
    if (viewTab === "keys") fetchTypes(false); // Don't show error on auto-fetch
  }, [viewTab, activeServerUrl, activeResTab, fetchTypes]);

  const fetchKeys = React.useCallback(async () => {
    if (!activeServerId || !activeServerUrl || !selectedType) return;
    setLoadingKeys(true);
    ekuiperClient.setBaseUrl(activeServerUrl);
    try {
      const list = await ekuiperClient.listConfKeys(activeResTab, selectedType);
      const items = Array.isArray(list) ? list.map((name) => ({ name })) : [];
      setKeys(items);
    } catch {
      setKeys([]);
    } finally {
      setLoadingKeys(false);
    }
  }, [activeServerId, activeServerUrl, activeResTab, selectedType]);

  React.useEffect(() => {
    if (viewTab === "keys") fetchKeys();
  }, [viewTab, activeServerId, activeServerUrl, activeResTab, selectedType, fetchKeys]);

  const handleSaveKey = async () => {
    if (!selectedType) return;
    let parsed;

    if (keyFormMode) {
      parsed = keyForm;
    } else {
      try {
        parsed = JSON.parse(keyContent);
      } catch {
        toast.error("Invalid JSON");
        return;
      }
    }

    setKeySaving(true);
    try {
      await ekuiperClient.upsertConfKey(activeResTab, selectedType, keyName, parsed);
      toast.success("Configuration saved");
      setKeyDialogOpen(false);
      fetchKeys();
    } catch {
      toast.error("Failed to save configuration");
    } finally {
      setKeySaving(false);
    }
  };

  const handleDeleteKey = async () => {
    if (!deleteKey || !selectedType) return;
    try {
      await ekuiperClient.deleteConfKey(activeResTab, selectedType, deleteKey);
      toast.success("Configuration deleted");
      setDeleteKey(null);
      fetchKeys();
    } catch {
      toast.error("Delete failed");
    }
  };

  const handleKeyFieldChange = (key: string, value: any) => {
    setKeyForm((prev) => {
      const next = { ...prev, [key]: value };
      setKeyContent(JSON.stringify(next, null, 2));
      return next;
    });
  };

  // =============================================================================
  // Render Helpers
  // =============================================================================

  const getCurrentTypeConfig = () => CONNECTION_TYPES.find((t) => t.id === selectedConnType);

  const groupFields = (fields: FieldConfig[]) => {
    const groups: Record<string, FieldConfig[]> = { _main: [] };
    fields.forEach((f) => {
      if (showAdvanced || !f.advanced) {
        const group = f.group || "_main";
        if (!groups[group]) groups[group] = [];
        groups[group].push(f);
      }
    });
    return groups;
  };

  const renderField = (field: FieldConfig) => {
    const value = connForm[field.key] ?? field.default ?? "";
    const showPassword = showPasswords[field.key];

    return (
      <div key={field.key} className="space-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor={field.key} className="text-sm font-medium">
            {field.label}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          {field.description && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs text-xs">{field.description}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {field.type === "text" && (
          <Input
            id={field.key}
            value={value}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            className="bg-background"
          />
        )}

        {field.type === "number" && (
          <Input
            id={field.key}
            type="number"
            value={value}
            onChange={(e) => handleFieldChange(field.key, parseInt(e.target.value) || 0)}
            placeholder={field.placeholder}
            className="bg-background"
          />
        )}

        {field.type === "password" && (
          <div className="relative">
            <Input
              id={field.key}
              type={showPassword ? "text" : "password"}
              value={value}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
              placeholder={field.placeholder}
              className="bg-background pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPasswords({ ...showPasswords, [field.key]: !showPassword })}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        )}

        {field.type === "select" && (
          <Select value={String(value)} onValueChange={(v) => handleFieldChange(field.key, v)}>
            <SelectTrigger className="bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {field.type === "switch" && (
          <div className="flex items-center gap-2">
            <Switch
              id={field.key}
              checked={Boolean(value)}
              onCheckedChange={(checked) => handleFieldChange(field.key, checked)}
            />
            <Label htmlFor={field.key} className="text-sm text-muted-foreground cursor-pointer">
              {value ? "Enabled" : "Disabled"}
            </Label>
          </div>
        )}

        {field.type === "textarea" && (
          <Textarea
            id={field.key}
            value={value}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            rows={3}
            className="bg-background font-mono text-sm"
          />
        )}
      </div>
    );
  };

  // =============================================================================
  // Table Columns
  // =============================================================================

  const connColumns: ColumnDef<ConnectionItem>[] = [
    {
      accessorKey: "id",
      header: "Connection ID",
      cell: ({ row }) => {
        const typeConfig = CONNECTION_TYPES.find((t) => t.id === row.original.typ);
        const IconComponent = typeConfig?.Icon || Wifi;
        return (
          <div className="flex items-center gap-2">
            <div className={cn("p-1.5 rounded-md bg-gradient-to-br", typeConfig?.color || "from-gray-500 to-gray-600")}>
              <IconComponent className="h-4 w-4 text-white" />
            </div>
            <span className="font-medium">{row.getValue("id")}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "typ",
      header: "Type",
      cell: ({ row }) => {
        const typeConfig = CONNECTION_TYPES.find((t) => t.id === row.getValue("typ"));
        return (
          <Badge variant="secondary" className="gap-1">
            {typeConfig?.name || row.getValue("typ")}
          </Badge>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.status?.toLowerCase() || "";
        if (!status) return <span className="text-muted-foreground text-sm">-</span>;

        const isConnected = status === "connected" || status === "running";
        const isConnecting = status === "connecting" || status === "reconnecting";
        const isDisconnected = status === "disconnected" || status === "stopped" || status === "failed";

        return (
          <div className="flex items-center gap-1.5">
            <div className={cn(
              "h-2 w-2 rounded-full",
              isConnected && "bg-emerald-500",
              isConnecting && "bg-amber-500 animate-pulse",
              isDisconnected && "bg-destructive",
              !isConnected && !isConnecting && !isDisconnected && "bg-gray-400"
            )} />
            <span className={cn(
              "text-sm capitalize",
              isConnected && "text-emerald-600",
              isConnecting && "text-amber-600",
              isDisconnected && "text-destructive"
            )}>{status}</span>
          </div>
        );
      },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => openEditConnectionDialog(row.original)}>
                  <Edit className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit connection</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteConnId(row.original.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete connection</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      ),
    },
  ];

  const keyColumns: ColumnDef<ConfKeyItem>[] = [
    {
      accessorKey: "name",
      header: "Configuration Key",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          <Badge variant="outline">{row.getValue("name")}</Badge>
        </div>
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setEditingKey(row.original.name);
              setKeyName(row.original.name);
              ekuiperClient
                .getConfKey(activeResTab, selectedType!, row.original.name)
                .then((d) => {
                  const content = d.content || {};
                  setKeyContent(JSON.stringify(content, null, 2));
                  setKeyForm(content);
                  setKeyFormMode(true);
                  setShowKeyAdvanced(false);
                })
                .catch(() => {
                  setKeyContent("{}");
                  setKeyForm({});
                  setKeyFormMode(true);
                });
              setKeyDialogOpen(true);
            }}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleteKey(row.original.name)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  // =============================================================================
  // Render
  // =============================================================================

  if (!activeServer) {
    return (
      <AppLayout title="Connections">
        <EmptyState title="No Server Connected" description="Please connect to an eKuiper server first." />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Connections">
      <div className="space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-xl md:text-2xl font-bold tracking-tight">Connections</h2>
            <p className="text-sm text-muted-foreground">Manage shared connections and configuration templates</p>
          </div>
          <Button onClick={() => fetchConnections(true)} variant="outline" size="sm" className="shrink-0 gap-2 self-start sm:self-center">
            <RefreshCw className={cn("h-4 w-4", loadingConns && "animate-spin")} />
            <span className="sm:hidden">Refresh</span>
          </Button>
        </div>

        {/* Main Tabs */}
        <Tabs value={viewTab} onValueChange={setViewTab} className="space-y-4">
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <TabsList className="w-full sm:w-auto inline-flex">
              <TabsTrigger value="instances" className="gap-1.5 text-xs sm:text-sm flex-1 sm:flex-none">
                <Wifi className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden xs:inline">Connection</span> Status
              </TabsTrigger>
              <TabsTrigger value="keys" className="gap-1.5 text-xs sm:text-sm flex-1 sm:flex-none">
                <BookTemplate className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Configurations
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Active Connections Tab */}
          <TabsContent value="instances" className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Badge variant="outline" className="gap-1.5 text-xs font-normal w-fit">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Auto-refresh: 5s
              </Badge>
              <Button onClick={openNewConnectionDialog} className="gap-2" size="sm">
                <Plus className="h-4 w-4" />
                New Connection
              </Button>
            </div>

            <div className="border rounded-lg bg-card overflow-hidden">
              <DataTable
                columns={connColumns}
                data={connections}
                loading={loadingConns}
                searchKey="id"
                emptyMessage="No active connections. Create a connection or use a Shared Config in a Stream."
              />
            </div>
          </TabsContent>

          {/* Configuration Templates Tab */}
          <TabsContent value="keys" className="flex-1 min-h-0 flex flex-col pt-4">
            <Tabs value={activeResTab} onValueChange={(v) => setActiveResTab(v as any)} className="flex-1 flex flex-col min-h-0">
              <TabsList className="w-fit">
                <TabsTrigger value="sources">Sources</TabsTrigger>
                <TabsTrigger value="sinks">Sinks</TabsTrigger>
                <TabsTrigger value="connections">Global Configs</TabsTrigger>
              </TabsList>

              <div className="flex-1 flex gap-6 mt-4 min-h-0">
                {/* Left: Types List */}
                <div className="w-64 flex flex-col border rounded-lg bg-card overflow-hidden">
                  <div className="p-3 border-b bg-muted/50 text-sm font-medium flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Connector Types
                  </div>
                  <ScrollArea className="flex-1">
                    <div className="p-2 space-y-1">
                      {loadingTypes ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : types.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-sm">No types available</div>
                      ) : (
                        types.map((t) => (
                          <button
                            key={t}
                            onClick={() => setSelectedType(t)}
                            className={cn(
                              "w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center justify-between",
                              selectedType === t ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                            )}
                          >
                            <span>{t}</span>
                            {selectedType === t && <ChevronRight className="h-4 w-4" />}
                          </button>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </div>

                {/* Right: Keys List */}
                <div className="flex-1 flex flex-col min-h-0 bg-card border rounded-lg overflow-hidden">
                  {selectedType ? (
                    <>
                      <div className="flex justify-between items-center p-4 border-b bg-muted/30">
                        <h3 className="font-semibold flex items-center gap-2">
                          <Settings2 className="h-4 w-4" />
                          {selectedType} Configurations
                        </h3>
                        <Button
                          size="sm"
                          onClick={() => {
                            setEditingKey(null);
                            setKeyName("");
                            setKeyContent("{}");
                            setKeyForm({});
                            setKeyFormMode(true);
                            setShowKeyAdvanced(false);
                            setKeyDialogOpen(true);
                          }}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add Config
                        </Button>
                      </div>
                      <div className="flex-1 overflow-auto">
                        <DataTable columns={keyColumns} data={keys} loading={loadingKeys} searchKey="name" emptyMessage="No configurations found for this type." />
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <div className="text-center">
                        <Settings2 className="h-12 w-12 mx-auto mb-4 opacity-20" />
                        <p>Select a connector type to view configurations</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>

      {/* Connection Dialog - Wizard Style */}
      <Dialog open={connDialogOpen} onOpenChange={setConnDialogOpen}>
        <DialogContent className="w-[95vw] max-w-3xl max-h-[95vh] sm:max-h-[90vh] p-0 gap-0 overflow-hidden">
          <DialogHeader className="p-4 md:p-6 pb-3 md:pb-4 border-b bg-muted/30">
            <DialogTitle className="text-lg md:text-xl">
              {editingConnId ? "Edit Connection" : wizardStep === "select" ? "Create New Connection" : "Configure Connection"}
            </DialogTitle>
            <DialogDescription className="text-sm">
              {wizardStep === "select" ? "Select a connection type or start from a template" : "Configure your connection settings"}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 max-h-[calc(95vh-180px)] sm:max-h-[calc(90vh-200px)]">
            <div className="p-4 md:p-6">
              {/* Step 1: Select Connection Type */}
              {wizardStep === "select" && (
                <div className="space-y-6">
                  {/* Templates */}
                  <div>
                    <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                      <Zap className="h-4 w-4 text-amber-500" />
                      Quick Start Templates
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {Object.entries(TEMPLATES).map(([id, template]) => {
                        const typeConfig = CONNECTION_TYPES.find((t) => t.id === template.type);
                        const IconComponent = typeConfig?.Icon || Wifi;
                        return (
                          <button
                            key={id}
                            onClick={() => applyTemplate(id)}
                            className="group relative p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors text-left"
                          >
                            <div className={cn("absolute top-3 right-3 p-1.5 rounded-md bg-gradient-to-br opacity-80 group-hover:opacity-100", typeConfig?.color)}>
                              <IconComponent className="h-4 w-4 text-white" />
                            </div>
                            <p className="font-medium text-sm">{template.name}</p>
                            <p className="text-xs text-muted-foreground mt-1">{typeConfig?.name}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Connection Types */}
                  <div>
                    <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                      <Link2 className="h-4 w-4" />
                      Connection Types
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {CONNECTION_TYPES.map((type) => {
                        const IconComponent = type.Icon;
                        return (
                          <button
                            key={type.id}
                            onClick={() => selectConnectionType(type.id)}
                            className="group p-3 md:p-4 rounded-lg border bg-card hover:bg-muted/50 transition-all text-left flex items-start gap-3 md:gap-4"
                          >
                            <div className={cn("p-3 rounded-xl bg-gradient-to-br shadow-sm group-hover:shadow-md transition-shadow", type.color)}>
                              <IconComponent className="h-6 w-6 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold">{type.name}</p>
                              <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{type.description}</p>
                            </div>
                            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0 mt-1" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Configure Connection */}
              {wizardStep === "configure" && selectedConnType && (
                <div className="space-y-6">
                  {/* Connection Type Header */}
                  {(() => {
                    const typeConfig = getCurrentTypeConfig();
                    const IconComponent = typeConfig?.Icon || Wifi;
                    return (
                      <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 border">
                        <div className={cn("p-3 rounded-xl bg-gradient-to-br shadow-sm", typeConfig?.color)}>
                          <IconComponent className="h-6 w-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold">{typeConfig?.name} Connection</p>
                          <p className="text-sm text-muted-foreground">{typeConfig?.description}</p>
                        </div>
                        {!editingConnId && (
                          <Button variant="ghost" size="sm" onClick={() => setWizardStep("select")}>
                            Change
                          </Button>
                        )}
                      </div>
                    );
                  })()}

                  {/* Connection ID */}
                  <div className="space-y-2">
                    <Label htmlFor="conn-id" className="text-sm font-medium">
                      Connection ID <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="conn-id"
                      value={connForm.id}
                      onChange={(e) => setConnForm({ ...connForm, id: e.target.value })}
                      placeholder={`my-${selectedConnType}-connection`}
                      disabled={!!editingConnId}
                      className="bg-background"
                    />
                    <p className="text-xs text-muted-foreground">Unique identifier for this connection. Used to reference it in streams and rules.</p>
                  </div>

                  {/* Mode Toggle */}
                  <div className="flex items-center justify-between border-b pb-4">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm font-medium">Configuration Mode</Label>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className={cn(!editorMode && "font-medium")}>Form</span>
                      <Switch checked={editorMode} onCheckedChange={setEditorMode} />
                      <span className={cn(editorMode && "font-medium")}>JSON Editor</span>
                    </div>
                  </div>

                  {/* Form or JSON Editor */}
                  {editorMode ? (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Connection Properties (JSON)</Label>
                      <div className="h-64 border rounded-lg overflow-hidden">
                        <CodeEditor value={rawJson} onChange={handleRawJsonChange} language="json" />
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Dynamic Form Fields */}
                      {(() => {
                        const typeConfig = getCurrentTypeConfig();
                        if (!typeConfig) return null;
                        const grouped = groupFields(typeConfig.fields);
                        const advancedFields = typeConfig.fields.filter((f) => f.advanced);

                        return (
                          <div className="space-y-6">
                            {/* Main Fields */}
                            <div className="grid grid-cols-2 gap-4">
                              {grouped._main.map(renderField)}
                            </div>

                            {/* Grouped Fields */}
                            {Object.entries(grouped)
                              .filter(([key]) => key !== "_main")
                              .map(([group, fields]) => (
                                <Collapsible key={group} defaultOpen className="space-y-3">
                                  <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium hover:text-foreground transition-colors">
                                    <ChevronRight className="h-4 w-4 transition-transform ui-expanded:rotate-90" />
                                    {group}
                                  </CollapsibleTrigger>
                                  <CollapsibleContent>
                                    <div className="grid grid-cols-2 gap-4 pl-6 pt-2">{fields.map(renderField)}</div>
                                  </CollapsibleContent>
                                </Collapsible>
                              ))}

                            {/* Advanced Fields Toggle */}
                            {advancedFields.length > 0 && (
                              <div className="pt-2 border-t">
                                <button
                                  type="button"
                                  onClick={() => setShowAdvanced(!showAdvanced)}
                                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  <Settings2 className="h-4 w-4" />
                                  {showAdvanced ? "Hide" : "Show"} Advanced Settings
                                  <Badge variant="secondary" className="ml-1">
                                    {advancedFields.length}
                                  </Badge>
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </>
                  )}

                  {/* Test Result */}
                  {testResult && (
                    <div
                      className={cn(
                        "flex items-center gap-3 p-4 rounded-lg",
                        testResult.success ? "bg-emerald-500/10 border border-emerald-500/30" : "bg-destructive/10 border border-destructive/30"
                      )}
                    >
                      {testResult.success ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                      ) : (
                        <XCircle className="h-5 w-5 text-destructive shrink-0" />
                      )}
                      <span className={cn("text-sm font-medium", testResult.success ? "text-emerald-600" : "text-destructive")}>{testResult.message}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Footer */}
          <DialogFooter className="p-6 pt-4 border-t bg-muted/30">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                {wizardStep === "configure" && (
                  <Button variant="outline" onClick={testConnection} disabled={connTesting} className="gap-2">
                    {connTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube2 className="h-4 w-4" />}
                    Test Connection
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setConnDialogOpen(false)}>
                  Cancel
                </Button>
                {wizardStep === "configure" && (
                  <Button onClick={handleSaveConnection} disabled={connSaving} className="gap-2">
                    {connSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    {editingConnId ? "Update" : "Create"} Connection
                  </Button>
                )}
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Configuration Key Dialog */}
      <Dialog open={keyDialogOpen} onOpenChange={setKeyDialogOpen}>
        <DialogContent className="max-w-2xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingKey ? "Edit Configuration" : "New Configuration"}</DialogTitle>
            <DialogDescription>Configure settings for {selectedType}</DialogDescription>
          </DialogHeader>
          <div className="flex-1 flex flex-col min-h-0">
            <div className="px-6 pt-6 pb-4 space-y-4">
              <div className="space-y-2">
                <Label>Configuration Key</Label>
                <Input value={keyName} onChange={(e) => setKeyName(e.target.value)} disabled={!!editingKey} placeholder="my-config" />
              </div>

              {/* Mode Toggle */}
              <div className="flex items-center justify-between border-b pb-4">
                <Label className="text-sm font-medium">Configuration Mode</Label>
                <div className="flex items-center gap-2 text-sm">
                  <span className={cn(keyFormMode && "font-medium")}>Form</span>
                  <Switch checked={!keyFormMode} onCheckedChange={(c) => setKeyFormMode(!c)} />
                  <span className={cn(!keyFormMode && "font-medium")}>JSON Editor</span>
                </div>
              </div>
            </div>

            {keyFormMode ? (
              <ScrollArea className="flex-1">
                <div className="px-6 pb-6">
                  {(() => {
                    let typeId = selectedType || "";
                    if (typeId === "httppull" || typeId === "httppush") typeId = "http";

                    const typeConfig = CONNECTION_TYPES.find((t) => t.id === typeId);

                    if (!typeConfig) {
                      return (
                        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-4">
                          <p>No form template available for {selectedType}</p>
                          <Button variant="outline" onClick={() => setKeyFormMode(false)}>
                            Switch to JSON Editor
                          </Button>
                        </div>
                      );
                    }

                    const grouped = groupFields(typeConfig.fields);

                    const renderInput = (f: FieldConfig) => {
                      const val = keyForm[f.key] ?? f.default ?? "";
                      return (
                        <div key={f.key} className="space-y-2">
                          <Label className="text-xs">{f.label}</Label>
                          {f.type === "select" ? (
                            <Select value={String(val)} onValueChange={(v) => handleKeyFieldChange(f.key, v)}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {f.options?.map((o) => (
                                  <SelectItem key={o.value} value={o.value}>
                                    {o.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : f.type === "switch" ? (
                            <div className="flex items-center gap-2 h-10">
                              <Switch checked={!!val} onCheckedChange={(c) => handleKeyFieldChange(f.key, c)} />
                              <span className="text-xs text-muted-foreground">{val ? "Enabled" : "Disabled"}</span>
                            </div>
                          ) : (
                            <Input
                              type={f.type === "number" ? "number" : f.type === "password" ? (showPasswords[f.key] ? "text" : "password") : "text"}
                              value={val}
                              onChange={(e) => handleKeyFieldChange(f.key, f.type === "number" ? parseFloat(e.target.value) : e.target.value)}
                              placeholder={f.placeholder}
                            />
                          )}
                          {f.description && <p className="text-[10px] text-muted-foreground">{f.description}</p>}
                        </div>
                      );
                    };

                    return (
                      <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">{grouped._main.map(renderInput)}</div>

                        {/* Advanced Fields */}
                        {Object.entries(grouped)
                          .filter(([k]) => k !== "_main")
                          .map(([g, fs]) => (
                            <Collapsible key={g} defaultOpen className="space-y-3">
                              <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium hover:text-primary">
                                <ChevronRight className="h-4 w-4" /> {g}
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="grid grid-cols-2 gap-4 pl-4 border-l ml-2">{fs.map(renderInput)}</div>
                              </CollapsibleContent>
                            </Collapsible>
                          ))}
                      </div>
                    );
                  })()}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex-1 flex flex-col min-h-0 px-6 pb-6 space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Content (JSON)</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <BookTemplate className="mr-2 h-4 w-4" />
                        Templates
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem
                        onClick={() => {
                          const c = JSON.stringify({ server: "tcp://localhost:1883", qos: 1 }, null, 2);
                          setKeyContent(c);
                          try {
                            setKeyForm(JSON.parse(c));
                          } catch { }
                        }}
                      >
                        MQTT Default
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          const c = JSON.stringify({ addr: "localhost:6379", db: 0 }, null, 2);
                          setKeyContent(c);
                          try {
                            setKeyForm(JSON.parse(c));
                          } catch { }
                        }}
                      >
                        Redis Default
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="flex-1 border rounded-md overflow-hidden">
                  <CodeEditor value={keyContent} onChange={setKeyContent} language="json" />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKeyDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveKey} disabled={keySaving}>
              {keySaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Dialogs */}
      <ConfirmDialog
        open={!!deleteConnId}
        onOpenChange={(o) => !o && setDeleteConnId(null)}
        title="Delete Connection"
        description="Are you sure you want to delete this connection? This action cannot be undone."
        onConfirm={handleDeleteConnection}
        variant="danger"
      />
      <ConfirmDialog
        open={!!deleteKey}
        onOpenChange={(o) => !o && setDeleteKey(null)}
        title="Delete Configuration"
        description="Are you sure you want to delete this configuration?"
        onConfirm={handleDeleteKey}
        variant="danger"
      />
    </AppLayout>
  );
}
