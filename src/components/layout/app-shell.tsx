"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useServerStore } from "@/stores/server-store";
import { CommandPalette, useCommandPalette, getDefaultCommands } from "@/components/command-palette";
import {
  LayoutDashboard,
  GitBranch,
  Database,
  Workflow,
  Radio,
  Package,
  BarChart3,
  Settings,
  Server,
  ChevronLeft,
  ChevronRight,
  Plus,
  Check,
  Trash2,
  Zap,
  Gauge,
  FileCode,
  FileJson,
  Link2,
  FileText,
  Download,
  Command,
  Loader2,
  // New feature icons
  Boxes,
  FunctionSquare,
  Plug,
  Bug,
  Table2,
  Layers,
  FileCode2,
  Hammer,
  // Visualization & Scheduling icons
  Network,
  Activity,
  Calendar
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface AppShellProps {
  children: React.ReactNode;
  activeView: string;
  onViewChange: (view: string) => void;
}

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "pipeline", label: "Pipeline Builder", icon: GitBranch },
  { id: "streams", label: "Streams & Tables", icon: Database },
  { id: "rules", label: "Rules", icon: Workflow },
  { id: "simulator", label: "MQTT Simulator", icon: Radio },
  { id: "plugins", label: "Plugins", icon: Package },
  { id: "metrics", label: "Metrics", icon: BarChart3 },
];

const ADVANCED_ITEMS = [
  { id: "rule-pipeline", label: "Rule Pipeline Chaining", icon: Layers },
  { id: "data-templates", label: "Data Templates", icon: FileCode2 },
  { id: "lookup-tables", label: "Lookup Tables", icon: Table2 },
  { id: "rule-debugging", label: "Rule Debugger", icon: Bug },
  { id: "edgex-meta", label: "EdgeX Meta Functions", icon: Boxes },
  { id: "zeromq", label: "ZeroMQ Config", icon: Plug },
  { id: "dependency-graph", label: "Dependency Graph", icon: Network },
  { id: "live-data", label: "Live Data Viewer", icon: Activity },
  { id: "scheduling", label: "Rule Scheduling", icon: Calendar },
];

const PLUGIN_DEV_ITEMS = [
  { id: "portable-sdk", label: "Portable SDK", icon: Package },
  { id: "external-functions", label: "External Functions", icon: FunctionSquare },
  { id: "custom-functions", label: "Custom Functions", icon: FileCode },
  { id: "cross-compile", label: "Cross-Compilation", icon: Hammer },
];

const MANAGER_ITEMS = [
  { id: "manager-overview", label: "Manager Overview", icon: Gauge },
  { id: "manager-batch-rules", label: "Batch Rules", icon: Workflow },
  { id: "manager-connections", label: "Connections", icon: Link2 },
  { id: "manager-configurations", label: "Configurations", icon: FileJson },
  { id: "manager-schemas", label: "Schema Registry", icon: FileCode },
  { id: "manager-import-export", label: "Import / Export", icon: Download },
  { id: "manager-logs", label: "Logs", icon: FileText },
  { id: "manager-settings", label: "Server Settings", icon: Settings },
];

export function AppShell({ children, activeView, onViewChange }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [serverDialogOpen, setServerDialogOpen] = useState(false);
  const [newServerName, setNewServerName] = useState("");
  const [newServerUrl, setNewServerUrl] = useState("");
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const { isOpen: commandPaletteOpen, setIsOpen: setCommandPaletteOpen } = useCommandPalette();

  const { servers, activeServerId, setActiveServer, addServer, removeServer } = useServerStore();
  const activeServer = servers.find((s) => s.id === activeServerId);

  const handleTestConnection = async () => {
    if (!newServerUrl) {
      toast({
        title: "Invalid input",
        description: "Please provide a URL to test",
        variant: "destructive",
      });
      return;
    }

    setTestingConnection(true);
    setConnectionTestResult(null);

    try {
      const response = await fetch("/api/ekuiper/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: newServerUrl }),
      });

      const result = await response.json();
      setConnectionTestResult(result);

      if (result.success) {
        toast({
          title: "Connection successful",
          description: result.message,
        });
      } else {
        toast({
          title: "Connection failed",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Connection test failed";
      setConnectionTestResult({ success: false, message });
      toast({
        title: "Connection test failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleAddServer = () => {
    if (!newServerName || !newServerUrl) {
      toast({
        title: "Invalid input",
        description: "Please provide both name and URL",
        variant: "destructive",
      });
      return;
    }

    addServer({
      name: newServerName,
      url: newServerUrl,
      isDefault: false,
    });

    setNewServerName("");
    setNewServerUrl("");
    toast({ title: "Server added" });
  };

  // Command palette actions
  const commands = getDefaultCommands({
    navigateTo: (view) => onViewChange(view),
    createStream: () => onViewChange("streams"),
    createRule: () => onViewChange("rules"),
    refreshData: () => {
      toast({ title: "Refreshing data..." });
      // Trigger a refresh - this would be connected to a global refresh mechanism
    },
    openSettings: () => onViewChange("manager-settings"),
    exportConfig: () => onViewChange("manager-import-export"),
    importConfig: () => onViewChange("manager-import-export"),
  });

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col border-r bg-card transition-all duration-300",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 p-4 border-b">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sota-blue to-sota-purple flex items-center justify-center">
            <Zap className="h-5 w-5 text-white" />
          </div>
          {!collapsed && (
            <div>
              <h1 className="font-bold text-lg">eKuiper</h1>
              <p className="text-xs text-muted-foreground">Playground</p>
            </div>
          )}
        </div>

        {/* Command Palette Button */}
        <div className="p-2">
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start gap-2 text-muted-foreground",
              collapsed && "justify-center px-2"
            )}
            onClick={() => setCommandPaletteOpen(true)}
          >
            <Command className="h-4 w-4" />
            {!collapsed && (
              <>
                <span className="flex-1 text-left">Command...</span>
                <kbd className="px-1.5 py-0.5 text-xs rounded border bg-muted font-mono">
                  Ctrl+K
                </kbd>
              </>
            )}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {/* Playground Section */}
          {!collapsed && (
            <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Playground
            </div>
          )}
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;

            return (
              <Button
                key={item.id}
                variant={isActive ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start gap-3",
                  collapsed && "justify-center px-2"
                )}
                onClick={() => onViewChange(item.id)}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Button>
            );
          })}

          {/* Advanced Features Section */}
          {!collapsed && (
            <div className="px-3 py-2 mt-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Advanced Features
            </div>
          )}
          {collapsed && <div className="my-2 border-t" />}
          {ADVANCED_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;

            return (
              <Button
                key={item.id}
                variant={isActive ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start gap-3",
                  collapsed && "justify-center px-2"
                )}
                onClick={() => onViewChange(item.id)}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Button>
            );
          })}

          {/* Plugin Development Section */}
          {!collapsed && (
            <div className="px-3 py-2 mt-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Plugin Development
            </div>
          )}
          {collapsed && <div className="my-2 border-t" />}
          {PLUGIN_DEV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;

            return (
              <Button
                key={item.id}
                variant={isActive ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start gap-3",
                  collapsed && "justify-center px-2"
                )}
                onClick={() => onViewChange(item.id)}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Button>
            );
          })}

          {/* Manager Section */}
          {!collapsed && (
            <div className="px-3 py-2 mt-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Manager
            </div>
          )}
          {collapsed && <div className="my-2 border-t" />}
          {MANAGER_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;

            return (
              <Button
                key={item.id}
                variant={isActive ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start gap-3",
                  collapsed && "justify-center px-2"
                )}
                onClick={() => onViewChange(item.id)}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Button>
            );
          })}
        </nav>

        {/* Server Selector */}
        <div className="p-2 border-t">
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start gap-3",
              collapsed && "justify-center px-2"
            )}
            onClick={() => setServerDialogOpen(true)}
          >
            <Server className="h-5 w-5 flex-shrink-0" />
            {!collapsed && (
              <div className="flex-1 text-left truncate">
                <div className="text-sm truncate">{activeServer?.name || "No server"}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {activeServer?.url}
                </div>
              </div>
            )}
          </Button>
        </div>

        {/* Collapse Toggle */}
        <div className="p-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        {children}
      </main>

      {/* Server Configuration Dialog */}
      <Dialog open={serverDialogOpen} onOpenChange={setServerDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>eKuiper Servers</DialogTitle>
            <DialogDescription>
              Configure your eKuiper server connections
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Server List */}
            <div className="space-y-2">
              {servers.map((server) => (
                <div
                  key={server.id}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors",
                    server.id === activeServerId
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted"
                  )}
                  onClick={() => setActiveServer(server.id)}
                >
                  <div className="flex items-center gap-3">
                    <Server className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium">{server.name}</div>
                      <div className="text-sm text-muted-foreground">{server.url}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {server.id === activeServerId && (
                      <Badge variant="secondary">Active</Badge>
                    )}
                    {!server.isDefault && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeServer(server.id);
                        }}
                        className="text-red-500 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Add Server */}
            <div className="pt-4 border-t space-y-3">
              <h4 className="font-medium">Add New Server</h4>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-sm text-muted-foreground">Name</label>
                  <Input
                    value={newServerName}
                    onChange={(e) => setNewServerName(e.target.value)}
                    placeholder="Production"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">URL</label>
                  <Input
                    value={newServerUrl}
                    onChange={(e) => {
                      setNewServerUrl(e.target.value);
                      setConnectionTestResult(null);
                    }}
                    placeholder="http://localhost:9081"
                  />
                </div>
              </div>
              
              {/* Connection test result */}
              {connectionTestResult && (
                <div className={cn(
                  "text-sm px-3 py-2 rounded-md",
                  connectionTestResult.success 
                    ? "bg-green-500/10 text-green-600" 
                    : "bg-red-500/10 text-red-600"
                )}>
                  {connectionTestResult.success ? "✓ " : "✗ "}
                  {connectionTestResult.message}
                </div>
              )}

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={handleTestConnection} 
                  disabled={testingConnection || !newServerUrl}
                  className="flex-1"
                >
                  {testingConnection ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-2" />
                      Test Connection
                    </>
                  )}
                </Button>
                <Button onClick={handleAddServer} className="flex-1 gap-2">
                  <Plus className="h-4 w-4" />
                  Add Server
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Command Palette */}
      <CommandPalette 
        commands={commands}
        isOpen={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
      />
    </div>
  );
}
