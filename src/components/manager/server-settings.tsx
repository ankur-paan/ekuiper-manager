"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Settings, 
  Search, 
  RefreshCw, 
  Server,
  Shield,
  Clock,
  Database,
  Zap,
  Save,
  RotateCcw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

interface ServerSettingsProps {
  serverUrl?: string;
}

interface SettingCategory {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const SETTING_CATEGORIES: SettingCategory[] = [
  { id: "general", name: "General", icon: Settings, description: "Basic server configuration" },
  { id: "performance", name: "Performance", icon: Zap, description: "Performance tuning options" },
  { id: "storage", name: "Storage", icon: Database, description: "Data persistence settings" },
  { id: "security", name: "Security", icon: Shield, description: "Authentication and authorization" },
  { id: "scheduler", name: "Scheduler", icon: Clock, description: "Rule scheduling settings" },
];

export function ServerSettings({ serverUrl }: ServerSettingsProps) {
  const [activeCategory, setActiveCategory] = useState("general");
  const [hasChanges, setHasChanges] = useState(false);

  // Settings state (would normally come from API)
  const [settings, setSettings] = useState({
    // General
    port: 9081,
    restPort: 9090,
    prometheusEnabled: true,
    prometheusPort: 20499,
    logLevel: "info",
    
    // Performance
    concurrency: 4,
    bufferLength: 1024,
    sendError: true,
    cacheWindow: 10,
    cacheMissingKey: true,
    
    // Storage
    storageType: "sqlite",
    storagePath: "data",
    maxHistory: 1000,
    cleanupInterval: 3600,
    
    // Security
    authEnabled: false,
    jwtSecret: "",
    tokenExpiry: 3600,
    
    // Scheduler
    queueLength: 100,
    checkpointInterval: 300,
    restartDelay: 1000,
  });

  const updateSetting = (key: string, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    // Would call API here
    toast({ title: "Settings saved successfully" });
    setHasChanges(false);
  };

  const handleReset = () => {
    // Would reload from API
    setHasChanges(false);
    toast({ title: "Settings reset to saved values" });
  };

  return (
    <div className="h-full flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Server Settings
          </h2>
          <p className="text-sm text-muted-foreground">
            Configure eKuiper server parameters
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500">
              Unsaved changes
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={handleReset} disabled={!hasChanges}>
            <RotateCcw className="h-4 w-4 mr-1" />
            Reset
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!hasChanges}>
            <Save className="h-4 w-4 mr-1" />
            Save Changes
          </Button>
        </div>
      </div>

      {/* Settings Layout */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Category Sidebar */}
        <Card className="w-64 shrink-0">
          <CardContent className="p-2">
            <nav className="space-y-1">
              {SETTING_CATEGORIES.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors",
                    activeCategory === category.id
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  )}
                >
                  <category.icon className="h-4 w-4" />
                  <div>
                    <p className="font-medium text-sm">{category.name}</p>
                    <p className={cn(
                      "text-xs",
                      activeCategory === category.id
                        ? "text-primary-foreground/70"
                        : "text-muted-foreground"
                    )}>
                      {category.description}
                    </p>
                  </div>
                </button>
              ))}
            </nav>
          </CardContent>
        </Card>

        {/* Settings Panel */}
        <Card className="flex-1 overflow-auto">
          <CardContent className="p-6 space-y-6">
            {/* General Settings */}
            {activeCategory === "general" && (
              <>
                <div>
                  <h3 className="text-lg font-semibold mb-4">General Settings</h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    Configure basic server parameters
                  </p>
                </div>

                <div className="grid gap-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>REST API Port</Label>
                      <Input
                        type="number"
                        value={settings.port}
                        onChange={(e) => updateSetting("port", parseInt(e.target.value))}
                      />
                      <p className="text-xs text-muted-foreground">
                        Port for REST API endpoint
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Prometheus Port</Label>
                      <Input
                        type="number"
                        value={settings.prometheusPort}
                        onChange={(e) => updateSetting("prometheusPort", parseInt(e.target.value))}
                        disabled={!settings.prometheusEnabled}
                      />
                      <p className="text-xs text-muted-foreground">
                        Port for metrics scraping
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable Prometheus Metrics</Label>
                      <p className="text-xs text-muted-foreground">
                        Expose metrics for Prometheus scraping
                      </p>
                    </div>
                    <Switch
                      checked={settings.prometheusEnabled}
                      onCheckedChange={(checked: boolean) => updateSetting("prometheusEnabled", checked)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Log Level</Label>
                    <Select
                      value={settings.logLevel}
                      onValueChange={(value) => updateSetting("logLevel", value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="debug">Debug</SelectItem>
                        <SelectItem value="info">Info</SelectItem>
                        <SelectItem value="warn">Warning</SelectItem>
                        <SelectItem value="error">Error</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}

            {/* Performance Settings */}
            {activeCategory === "performance" && (
              <>
                <div>
                  <h3 className="text-lg font-semibold mb-4">Performance Settings</h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    Fine-tune performance parameters
                  </p>
                </div>

                <div className="grid gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Concurrency Level: {settings.concurrency}</Label>
                    </div>
                    <Slider
                      value={[settings.concurrency]}
                      onValueChange={([value]: number[]) => updateSetting("concurrency", value)}
                      min={1}
                      max={16}
                      step={1}
                    />
                    <p className="text-xs text-muted-foreground">
                      Number of concurrent processors for rule execution
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Buffer Length: {settings.bufferLength}</Label>
                    </div>
                    <Slider
                      value={[settings.bufferLength]}
                      onValueChange={([value]: number[]) => updateSetting("bufferLength", value)}
                      min={256}
                      max={4096}
                      step={256}
                    />
                    <p className="text-xs text-muted-foreground">
                      Internal buffer size for message processing
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Cache Window: {settings.cacheWindow}s</Label>
                    </div>
                    <Slider
                      value={[settings.cacheWindow]}
                      onValueChange={([value]: number[]) => updateSetting("cacheWindow", value)}
                      min={1}
                      max={60}
                      step={1}
                    />
                    <p className="text-xs text-muted-foreground">
                      Time window for caching intermediate results
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Send Error to Sink</Label>
                      <p className="text-xs text-muted-foreground">
                        Forward processing errors to sink
                      </p>
                    </div>
                    <Switch
                      checked={settings.sendError}
                      onCheckedChange={(checked: boolean) => updateSetting("sendError", checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Cache Missing Keys</Label>
                      <p className="text-xs text-muted-foreground">
                        Cache results for missing lookup keys
                      </p>
                    </div>
                    <Switch
                      checked={settings.cacheMissingKey}
                      onCheckedChange={(checked: boolean) => updateSetting("cacheMissingKey", checked)}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Storage Settings */}
            {activeCategory === "storage" && (
              <>
                <div>
                  <h3 className="text-lg font-semibold mb-4">Storage Settings</h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    Configure data persistence options
                  </p>
                </div>

                <div className="grid gap-6">
                  <div className="space-y-2">
                    <Label>Storage Type</Label>
                    <Select
                      value={settings.storageType}
                      onValueChange={(value) => updateSetting("storageType", value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sqlite">SQLite</SelectItem>
                        <SelectItem value="redis">Redis</SelectItem>
                        <SelectItem value="memory">Memory (No Persistence)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Storage Path</Label>
                    <Input
                      value={settings.storagePath}
                      onChange={(e) => updateSetting("storagePath", e.target.value)}
                      disabled={settings.storageType === "memory"}
                    />
                    <p className="text-xs text-muted-foreground">
                      Directory for persistent data storage
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Max History Records</Label>
                      <Input
                        type="number"
                        value={settings.maxHistory}
                        onChange={(e) => updateSetting("maxHistory", parseInt(e.target.value))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Cleanup Interval (seconds)</Label>
                      <Input
                        type="number"
                        value={settings.cleanupInterval}
                        onChange={(e) => updateSetting("cleanupInterval", parseInt(e.target.value))}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Security Settings */}
            {activeCategory === "security" && (
              <>
                <div>
                  <h3 className="text-lg font-semibold mb-4">Security Settings</h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    Configure authentication and authorization
                  </p>
                </div>

                <div className="grid gap-6">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-0.5">
                      <Label>Enable Authentication</Label>
                      <p className="text-xs text-muted-foreground">
                        Require JWT tokens for API access
                      </p>
                    </div>
                    <Switch
                      checked={settings.authEnabled}
                      onCheckedChange={(checked: boolean) => updateSetting("authEnabled", checked)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>JWT Secret</Label>
                    <Input
                      type="password"
                      value={settings.jwtSecret}
                      onChange={(e) => updateSetting("jwtSecret", e.target.value)}
                      disabled={!settings.authEnabled}
                      placeholder="Enter a secure secret key"
                    />
                    <p className="text-xs text-muted-foreground">
                      Secret key for JWT token signing
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Token Expiry (seconds)</Label>
                    <Input
                      type="number"
                      value={settings.tokenExpiry}
                      onChange={(e) => updateSetting("tokenExpiry", parseInt(e.target.value))}
                      disabled={!settings.authEnabled}
                    />
                    <p className="text-xs text-muted-foreground">
                      How long tokens remain valid
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* Scheduler Settings */}
            {activeCategory === "scheduler" && (
              <>
                <div>
                  <h3 className="text-lg font-semibold mb-4">Scheduler Settings</h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    Configure rule scheduling behavior
                  </p>
                </div>

                <div className="grid gap-6">
                  <div className="space-y-2">
                    <Label>Queue Length</Label>
                    <Input
                      type="number"
                      value={settings.queueLength}
                      onChange={(e) => updateSetting("queueLength", parseInt(e.target.value))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Maximum number of pending rule executions
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Checkpoint Interval (seconds)</Label>
                    <Input
                      type="number"
                      value={settings.checkpointInterval}
                      onChange={(e) => updateSetting("checkpointInterval", parseInt(e.target.value))}
                    />
                    <p className="text-xs text-muted-foreground">
                      How often to save rule state for recovery
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Restart Delay (milliseconds)</Label>
                    <Input
                      type="number"
                      value={settings.restartDelay}
                      onChange={(e) => updateSetting("restartDelay", parseInt(e.target.value))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Delay before restarting a failed rule
                    </p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
