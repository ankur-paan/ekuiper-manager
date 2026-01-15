"use client";

import { useState, useMemo } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { MetricsDashboard } from "@/components/dashboard";
import { PipelineCanvas, RulePipelineChaining, DataTemplatesEditor } from "@/components/pipeline";
import { MqttSimulator } from "@/components/simulator";
import { 
  StreamsManager, 
  RulesManager,
  EdgeXMetaFunctions,
  LookupTablesUI,
  RuleDebuggingPanel,
  ZeroMQConfig
} from "@/components/management";
import { 
  PluginsManager,
  PortablePluginDev,
  ExternalFunctions,
  CrossCompilationTools,
  CustomFunctionDev
} from "@/components/plugins";
import {
  ManagerOverview,
  ConfigurationsManager,
  ImportExportManager,
  LogsViewer,
  SchemaRegistry,
  BatchRulesManager,
  ConnectionsManager,
  ServerSettings,
} from "@/components/manager";
// Visualization components
import { DependencyGraph } from "@/components/visualization/dependency-graph";
import { LiveDataViewer } from "@/components/visualization/live-data-viewer";
// Scheduling components
import { ScheduleManager } from "@/components/scheduling";
import { useServerStore } from "@/stores/server-store";
import { EKuiperClient } from "@/lib/ekuiper";
import { EKuiperManagerClient } from "@/lib/ekuiper/manager-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  GitBranch,
  Database,
  Workflow,
  Radio,
  Package,
  BarChart3,
  Zap,
  ArrowRight,
  BookOpen,
  ExternalLink,
  Gauge,
  Settings,
  Layers,
  FileCode2,
  Table2,
  Bug,
  Boxes,
  Plug,
  FunctionSquare,
  Hammer
} from "lucide-react";

function DashboardHome({ onNavigate }: { onNavigate: (view: string) => void }) {
  return (
    <div className="h-full overflow-auto p-6">
      {/* Hero */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sota-blue to-sota-purple flex items-center justify-center">
            <Zap className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">eKuiper Playground</h1>
            <p className="text-muted-foreground">
              SOTA IIoT Rule Engine Development Environment
            </p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <Card className="group cursor-pointer hover:border-primary transition-colors" onClick={() => onNavigate("pipeline")}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <GitBranch className="h-8 w-8 text-sota-blue" />
              <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <CardTitle className="mt-3">Pipeline Builder</CardTitle>
            <CardDescription>
              Visual drag-and-drop editor for building multi-stage decision trees
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="group cursor-pointer hover:border-primary transition-colors" onClick={() => onNavigate("streams")}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <Database className="h-8 w-8 text-green-500" />
              <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <CardTitle className="mt-3">Streams & Tables</CardTitle>
            <CardDescription>
              Configure MQTT, EdgeX, HTTP and memory data sources
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="group cursor-pointer hover:border-primary transition-colors" onClick={() => onNavigate("rules")}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <Workflow className="h-8 w-8 text-yellow-500" />
              <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <CardTitle className="mt-3">Rules</CardTitle>
            <CardDescription>
              Create and manage SQL-based streaming rules with actions
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="group cursor-pointer hover:border-primary transition-colors" onClick={() => onNavigate("simulator")}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <Radio className="h-8 w-8 text-purple-500" />
              <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <CardTitle className="mt-3">MQTT Simulator</CardTitle>
            <CardDescription>
              Generate test messages to validate your rules
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="group cursor-pointer hover:border-primary transition-colors" onClick={() => onNavigate("plugins")}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <Package className="h-8 w-8 text-red-500" />
              <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <CardTitle className="mt-3">Python Plugins</CardTitle>
            <CardDescription>
              Extend eKuiper with custom functions, sources, and sinks
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="group cursor-pointer hover:border-primary transition-colors" onClick={() => onNavigate("metrics")}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <BarChart3 className="h-8 w-8 text-cyan-500" />
              <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <CardTitle className="mt-3">Metrics Dashboard</CardTitle>
            <CardDescription>
              Monitor rule performance, throughput, and errors in real-time
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Features */}
      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4">Features</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            "Visual Pipeline Builder",
            "Monaco SQL Editor",
            "eKuiper IntelliSense",
            "50+ Built-in Functions",
            "MQTT Simulator",
            "Real-time Metrics",
            "Python Plugin Editor",
            "Multi-server Support",
          ].map((feature) => (
            <div key={feature} className="flex items-center gap-2 p-3 rounded-lg bg-muted">
              <Zap className="h-4 w-4 text-sota-blue" />
              <span className="text-sm">{feature}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Manager Section */}
      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Gauge className="h-5 w-5" />
          eKuiper Manager
        </h2>
        <p className="text-muted-foreground mb-4">
          Full-featured management interface • Open Source alternative to EMQ's proprietary manager
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { name: "System Overview", action: () => onNavigate("manager-overview") },
            { name: "Batch Rule Operations", action: () => onNavigate("manager-batch-rules") },
            { name: "Connection Management", action: () => onNavigate("manager-connections") },
            { name: "Configuration Templates", action: () => onNavigate("manager-configurations") },
            { name: "Schema Registry", action: () => onNavigate("manager-schemas") },
            { name: "Import / Export", action: () => onNavigate("manager-import-export") },
            { name: "Log Viewer", action: () => onNavigate("manager-logs") },
            { name: "Server Settings", action: () => onNavigate("manager-settings") },
          ].map((item) => (
            <div 
              key={item.name} 
              className="flex items-center gap-2 p-3 rounded-lg bg-muted cursor-pointer hover:bg-muted/80 transition-colors"
              onClick={item.action}
            >
              <Settings className="h-4 w-4 text-sota-purple" />
              <span className="text-sm">{item.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Advanced Features Section */}
      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Layers className="h-5 w-5" />
          Advanced Features
        </h2>
        <p className="text-muted-foreground mb-4">
          Extended functionality from eKuiper documentation
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { name: "Rule Pipeline Chaining", icon: Layers, action: () => onNavigate("rule-pipeline") },
            { name: "Data Templates Editor", icon: FileCode2, action: () => onNavigate("data-templates") },
            { name: "Lookup Tables", icon: Table2, action: () => onNavigate("lookup-tables") },
            { name: "Rule Debugger", icon: Bug, action: () => onNavigate("rule-debugging") },
            { name: "EdgeX Meta Functions", icon: Boxes, action: () => onNavigate("edgex-meta") },
            { name: "ZeroMQ Config", icon: Plug, action: () => onNavigate("zeromq") },
          ].map((item) => (
            <div 
              key={item.name} 
              className="flex items-center gap-2 p-3 rounded-lg bg-muted cursor-pointer hover:bg-muted/80 transition-colors"
              onClick={item.action}
            >
              <item.icon className="h-4 w-4 text-sota-blue" />
              <span className="text-sm">{item.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Plugin Development Section */}
      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Package className="h-5 w-5" />
          Plugin Development
        </h2>
        <p className="text-muted-foreground mb-4">
          Build custom plugins for eKuiper
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { name: "Portable SDK", icon: Package, action: () => onNavigate("portable-sdk") },
            { name: "External Functions", icon: FunctionSquare, action: () => onNavigate("external-functions") },
            { name: "Custom Functions", icon: FileCode2, action: () => onNavigate("custom-functions") },
            { name: "Cross-Compilation", icon: Hammer, action: () => onNavigate("cross-compile") },
          ].map((item) => (
            <div 
              key={item.name} 
              className="flex items-center gap-2 p-3 rounded-lg bg-muted cursor-pointer hover:bg-muted/80 transition-colors"
              onClick={item.action}
            >
              <item.icon className="h-4 w-4 text-red-500" />
              <span className="text-sm">{item.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Resources */}
      <div>
        <h2 className="text-xl font-bold mb-4">Resources</h2>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" className="gap-2" asChild>
            <a href="https://ekuiper.org/docs/en/latest/" target="_blank" rel="noopener noreferrer">
              <BookOpen className="h-4 w-4" />
              eKuiper Documentation
              <ExternalLink className="h-3 w-3" />
            </a>
          </Button>
          <Button variant="outline" className="gap-2" asChild>
            <a href="https://github.com/lf-edge/ekuiper" target="_blank" rel="noopener noreferrer">
              GitHub Repository
              <ExternalLink className="h-3 w-3" />
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [activeView, setActiveView] = useState("dashboard");
  const { getActiveServer, activeServerId } = useServerStore();

  const client = useMemo(() => {
    const server = getActiveServer();
    console.log('[Home] Creating client - activeServerId:', activeServerId, 'server:', server);
    if (!server) return null;
    // Use proxy URL with the eKuiper URL passed via header
    return new EKuiperClient("/api/ekuiper", server.url);
  }, [getActiveServer, activeServerId]);

  const managerClient = useMemo(() => {
    const server = getActiveServer();
    if (!server) return null;
    // Use proxy URL with the eKuiper URL passed via header
    return new EKuiperManagerClient("/api/ekuiper", server.url);
  }, [getActiveServer]);

  const renderContent = () => {
    if (!client && activeView !== "dashboard" && activeView !== "simulator" && activeView !== "pipeline") {
      return (
        <div className="h-full flex items-center justify-center">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>No Server Connected</CardTitle>
              <CardDescription>
                Please configure an eKuiper server to access this feature.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      );
    }

    switch (activeView) {
      case "dashboard":
        return <DashboardHome onNavigate={setActiveView} />;
      case "pipeline":
        return <PipelineCanvas />;
      case "streams":
        return client ? <StreamsManager client={client} /> : null;
      case "rules":
        return client ? <RulesManager client={client} /> : null;
      case "simulator":
        return <MqttSimulator />;
      case "plugins":
        return client ? <PluginsManager client={client} /> : null;
      case "metrics":
        return client ? <MetricsDashboard client={client} /> : null;
      
      // Advanced Features Views
      case "rule-pipeline":
        return client ? <RulePipelineChaining client={client} /> : null;
      case "data-templates":
        return <DataTemplatesEditor />;
      case "lookup-tables":
        return <LookupTablesUI connectionId={activeServerId || "default"} />;
      case "rule-debugging":
        return <RuleDebuggingPanel connectionId={activeServerId || "default"} ruleId="demo-rule" />;
      case "edgex-meta":
        return <EdgeXMetaFunctions />;
      case "zeromq":
        return <ZeroMQConfig connectionId={activeServerId || "default"} />;

      // Plugin Development Views
      case "portable-sdk":
        return client ? <PortablePluginDev client={client} /> : null;
      case "external-functions":
        return client ? <ExternalFunctions client={client} /> : null;
      case "custom-functions":
        return <CustomFunctionDev connectionId={activeServerId || "default"} />;
      case "cross-compile":
        return <CrossCompilationTools />;
      
      // Manager Views
      case "manager-overview":
        return managerClient ? <ManagerOverview client={managerClient} onNavigate={setActiveView} /> : null;
      case "manager-batch-rules":
        return managerClient ? <BatchRulesManager client={managerClient} /> : null;
      case "manager-connections":
        return managerClient ? <ConnectionsManager client={managerClient} /> : null;
      case "manager-configurations":
        return managerClient ? <ConfigurationsManager client={managerClient} /> : null;
      case "manager-schemas":
        return managerClient ? <SchemaRegistry client={managerClient} /> : null;
      case "manager-import-export":
        return managerClient ? <ImportExportManager client={managerClient} /> : null;
      case "manager-logs":
        return <LogsViewer />;
      case "manager-settings":
        return <ServerSettings />;

      // Visualization Views
      case "dependency-graph":
        return <DependencyGraph connectionId={activeServerId || "default"} />;
      case "live-data":
        return <LiveDataViewer connectionId={activeServerId || "default"} />;
      
      // Scheduling Views
      case "scheduling":
        return <ScheduleManager />;

      default:
        return <DashboardHome onNavigate={setActiveView} />;
    }
  };

  return (
    <AppShell activeView={activeView} onViewChange={setActiveView}>
      {renderContent()}
    </AppShell>
  );
}
