"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { EKuiperClient } from "@/lib/ekuiper/client";
import {
  Bug,
  Play,
  Pause,
  StepForward,
  Square,
  RotateCcw,
  Code2,
  Activity,
  Layers,
  ChevronRight,
  ChevronDown,
  Clock,
  Zap,
  AlertCircle,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Copy,
  Download,
  Loader2,
  ArrowRight,
  Database,
  Filter,
  BarChart3
} from "lucide-react";

// =============================================================================
// Types
// =============================================================================

interface DebugEvent {
  id: string;
  timestamp: number;
  phase: "source" | "decode" | "filter" | "project" | "sink";
  data: Record<string, any>;
  duration?: number;
  error?: string;
}

interface Breakpoint {
  id: string;
  phase: DebugEvent["phase"];
  condition?: string;
  enabled: boolean;
}

interface RuleMetrics {
  recordsIn: number;
  recordsOut: number;
  exceptions: number;
  processLatencyMs: number;
  bufferLength: number;
  lastInvocation: number;
}

interface DebugSession {
  ruleId: string;
  status: "stopped" | "running" | "paused" | "stepping";
  events: DebugEvent[];
  breakpoints: Breakpoint[];
  currentPhase: DebugEvent["phase"] | null;
}

// =============================================================================
// Phase Configuration
// =============================================================================

const PHASES: { id: DebugEvent["phase"]; label: string; icon: React.ReactNode; description: string }[] = [
  { id: "source", label: "Source", icon: <Database className="h-4 w-4" />, description: "Data ingestion from source" },
  { id: "decode", label: "Decode", icon: <Code2 className="h-4 w-4" />, description: "Message decoding (JSON, etc.)" },
  { id: "filter", label: "Filter", icon: <Filter className="h-4 w-4" />, description: "WHERE clause evaluation" },
  { id: "project", label: "Project", icon: <BarChart3 className="h-4 w-4" />, description: "SELECT/aggregation processing" },
  { id: "sink", label: "Sink", icon: <ArrowRight className="h-4 w-4" />, description: "Output to sink(s)" },
];

// =============================================================================
// Props
// =============================================================================

interface RuleDebuggingPanelProps {
  connectionId: string;
  ruleId: string;
}

// =============================================================================
// Main Component
// =============================================================================

export function RuleDebuggingPanel({ connectionId, ruleId }: RuleDebuggingPanelProps) {
  const [activeTab, setActiveTab] = useState<"timeline" | "data" | "metrics" | "logs">("timeline");
  const [session, setSession] = useState<DebugSession>({
    ruleId,
    status: "stopped",
    events: [],
    breakpoints: [],
    currentPhase: null,
  });
  const [selectedEvent, setSelectedEvent] = useState<DebugEvent | null>(null);
  const [testInput, setTestInput] = useState(`{
  "temperature": 25.5,
  "humidity": 60,
  "device_id": "sensor_001",
  "timestamp": ${Date.now()}
}`);
  const [showRawData, setShowRawData] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  
  const client = new EKuiperClient(`/api/connections/${connectionId}/ekuiper`);

  // Fetch rule status
  const { data: ruleStatus, refetch: refetchStatus } = useQuery({
    queryKey: ["ruleStatus", connectionId, ruleId],
    queryFn: async () => {
      return client.getRuleStatus(ruleId);
    },
    refetchInterval: session.status === "running" ? 1000 : false,
  });

  // Simulate debug events (in real implementation, this would come from WebSocket or API)
  const simulateDebugEvent = useCallback((phase: DebugEvent["phase"], data: Record<string, any>) => {
    const event: DebugEvent = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      phase,
      data,
      duration: Math.floor(Math.random() * 50) + 5,
    };

    setSession(prev => ({
      ...prev,
      events: [...prev.events.slice(-99), event],
      currentPhase: phase,
    }));

    // Check breakpoints
    const breakpoint = session.breakpoints.find(bp => bp.phase === phase && bp.enabled);
    if (breakpoint) {
      if (!breakpoint.condition || evaluateCondition(breakpoint.condition, data)) {
        setSession(prev => ({ ...prev, status: "paused" }));
        setSelectedEvent(event);
        toast({
          title: "Breakpoint Hit",
          description: `Paused at ${phase} phase`,
        });
      }
    }
  }, [session.breakpoints]);

  const evaluateCondition = (condition: string, data: Record<string, any>): boolean => {
    try {
      // Simple condition evaluation (in production, use a proper parser)
      const fn = new Function("data", `with(data) { return ${condition}; }`);
      return fn(data);
    } catch {
      return true;
    }
  };

  // Control functions
  const startDebugging = () => {
    setSession(prev => ({ ...prev, status: "running", events: [] }));
    toast({ title: "Debug Session Started", description: `Debugging rule: ${ruleId}` });
    
    // Simulate data flow through phases
    simulateDataFlow();
  };

  const pauseDebugging = () => {
    setSession(prev => ({ ...prev, status: "paused" }));
    toast({ title: "Paused", description: "Debug session paused" });
  };

  const resumeDebugging = () => {
    setSession(prev => ({ ...prev, status: "running" }));
    simulateDataFlow();
  };

  const stepForward = () => {
    const currentIdx = PHASES.findIndex(p => p.id === session.currentPhase);
    const nextPhase = PHASES[(currentIdx + 1) % PHASES.length];
    
    const mockData = { 
      temperature: 25.5 + Math.random() * 10,
      humidity: 60 + Math.random() * 20,
      device_id: "sensor_001",
    };
    
    simulateDebugEvent(nextPhase.id, mockData);
    setSession(prev => ({ ...prev, status: "stepping" }));
  };

  const stopDebugging = () => {
    setSession(prev => ({ ...prev, status: "stopped", currentPhase: null }));
    toast({ title: "Stopped", description: "Debug session ended" });
  };

  const resetSession = () => {
    setSession(prev => ({
      ...prev,
      events: [],
      currentPhase: null,
    }));
    setSelectedEvent(null);
  };

  // Simulate data flow through all phases
  const simulateDataFlow = () => {
    let inputData;
    try {
      inputData = JSON.parse(testInput);
    } catch {
      toast({ title: "Invalid JSON", description: "Please fix the test input", variant: "destructive" });
      return;
    }

    let currentData = { ...inputData };
    let delay = 0;

    PHASES.forEach((phase, index) => {
      setTimeout(() => {
        // Transform data based on phase
        let phaseData = { ...currentData };
        if (phase.id === "filter") {
          phaseData._filtered = currentData.temperature > 20;
        } else if (phase.id === "project") {
          phaseData = {
            device: currentData.device_id,
            temp: currentData.temperature,
            processed_at: Date.now(),
          };
        }
        
        simulateDebugEvent(phase.id, phaseData);
        currentData = phaseData;
      }, delay);
      delay += 200;
    });
  };

  // Breakpoint management
  const addBreakpoint = (phase: DebugEvent["phase"]) => {
    const bp: Breakpoint = {
      id: `bp-${Date.now()}`,
      phase,
      enabled: true,
    };
    setSession(prev => ({
      ...prev,
      breakpoints: [...prev.breakpoints, bp],
    }));
    toast({ title: "Breakpoint Added", description: `At ${phase} phase` });
  };

  const removeBreakpoint = (id: string) => {
    setSession(prev => ({
      ...prev,
      breakpoints: prev.breakpoints.filter(bp => bp.id !== id),
    }));
  };

  const toggleBreakpoint = (id: string) => {
    setSession(prev => ({
      ...prev,
      breakpoints: prev.breakpoints.map(bp =>
        bp.id === id ? { ...bp, enabled: !bp.enabled } : bp
      ),
    }));
  };

  const updateBreakpointCondition = (id: string, condition: string) => {
    setSession(prev => ({
      ...prev,
      breakpoints: prev.breakpoints.map(bp =>
        bp.id === id ? { ...bp, condition } : bp
      ),
    }));
  };

  // Export events
  const exportEvents = () => {
    const data = JSON.stringify(session.events, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `debug-${ruleId}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Header & Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-500/10 rounded-lg">
            <Bug className="h-6 w-6 text-orange-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Rule Debugger</h2>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{ruleId}</Badge>
              <Badge
                variant={
                  session.status === "running" ? "default" :
                  session.status === "paused" ? "secondary" :
                  "outline"
                }
              >
                {session.status}
              </Badge>
            </div>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center gap-2">
          {session.status === "stopped" ? (
            <Button onClick={startDebugging} className="bg-green-600 hover:bg-green-700">
              <Play className="h-4 w-4 mr-2" />
              Start Debug
            </Button>
          ) : (
            <>
              {session.status === "paused" ? (
                <Button onClick={resumeDebugging} variant="outline">
                  <Play className="h-4 w-4 mr-2" />
                  Resume
                </Button>
              ) : (
                <Button onClick={pauseDebugging} variant="outline">
                  <Pause className="h-4 w-4 mr-2" />
                  Pause
                </Button>
              )}
              <Button onClick={stepForward} variant="outline">
                <StepForward className="h-4 w-4 mr-2" />
                Step
              </Button>
              <Button onClick={stopDebugging} variant="destructive">
                <Square className="h-4 w-4 mr-2" />
                Stop
              </Button>
            </>
          )}
          <Button onClick={resetSession} variant="ghost" size="icon">
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button onClick={exportEvents} variant="ghost" size="icon">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Pipeline Visualization */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            {PHASES.map((phase, index) => (
              <div key={phase.id} className="flex items-center">
                <div
                  className={cn(
                    "flex flex-col items-center gap-2 cursor-pointer transition-all p-3 rounded-lg",
                    session.currentPhase === phase.id && "bg-primary/10 ring-2 ring-primary",
                    session.breakpoints.some(bp => bp.phase === phase.id && bp.enabled) && "bg-red-500/10"
                  )}
                  onClick={() => addBreakpoint(phase.id)}
                >
                  <div className={cn(
                    "p-3 rounded-full transition-colors",
                    session.currentPhase === phase.id ? "bg-primary text-primary-foreground" : "bg-muted"
                  )}>
                    {phase.icon}
                  </div>
                  <span className="text-sm font-medium">{phase.label}</span>
                  {session.breakpoints.some(bp => bp.phase === phase.id && bp.enabled) && (
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                  )}
                </div>
                {index < PHASES.length - 1 && (
                  <ChevronRight className="h-5 w-5 text-muted-foreground mx-2" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Test Input */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Test Input</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              className="font-mono text-xs min-h-[150px]"
              placeholder="Enter JSON test data..."
            />
            <Button
              onClick={simulateDataFlow}
              className="w-full mt-2"
              disabled={session.status !== "running"}
            >
              <Zap className="h-4 w-4 mr-2" />
              Inject Data
            </Button>
          </CardContent>
        </Card>

        {/* Breakpoints */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Breakpoints</CardTitle>
              <Badge variant="outline">{session.breakpoints.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[180px]">
              {session.breakpoints.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Click on a phase to add breakpoint
                </p>
              ) : (
                <div className="space-y-2">
                  {session.breakpoints.map((bp) => (
                    <div
                      key={bp.id}
                      className="flex items-center justify-between p-2 bg-muted/50 rounded"
                    >
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={bp.enabled}
                          onCheckedChange={() => toggleBreakpoint(bp.id)}
                        />
                        <Badge variant={bp.enabled ? "default" : "outline"}>
                          {bp.phase}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <Input
                          placeholder="condition"
                          className="h-6 text-xs w-24"
                          value={bp.condition || ""}
                          onChange={(e) => updateBreakpointCondition(bp.id, e.target.value)}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => removeBreakpoint(bp.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Current Data View */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Data Inspector</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowRawData(!showRawData)}
              >
                {showRawData ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[180px]">
              {selectedEvent ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{new Date(selectedEvent.timestamp).toLocaleTimeString()}</span>
                    {selectedEvent.duration && (
                      <>
                        <span>•</span>
                        <span>{selectedEvent.duration}ms</span>
                      </>
                    )}
                  </div>
                  <pre className="text-xs bg-muted p-2 rounded font-mono whitespace-pre-wrap">
                    {JSON.stringify(selectedEvent.data, null, 2)}
                  </pre>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Select an event to inspect
                </p>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Event Timeline */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Event Timeline
            </CardTitle>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={autoScroll}
                  onCheckedChange={setAutoScroll}
                />
                Auto-scroll
              </label>
              <Badge variant="outline">
                {session.events.length} events
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            {session.events.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No events captured yet</p>
                <p className="text-sm">Start debugging and inject data to see events</p>
              </div>
            ) : (
              <div className="space-y-1">
                {session.events.map((event, index) => (
                  <div
                    key={event.id}
                    className={cn(
                      "flex items-center gap-3 p-2 rounded cursor-pointer transition-colors",
                      selectedEvent?.id === event.id ? "bg-primary/10 ring-1 ring-primary" : "hover:bg-muted",
                      event.error && "bg-red-500/10"
                    )}
                    onClick={() => setSelectedEvent(event)}
                  >
                    <span className="text-xs text-muted-foreground w-16">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "w-16 justify-center",
                        event.phase === "source" && "bg-blue-500/10 text-blue-500 border-blue-500/30",
                        event.phase === "decode" && "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
                        event.phase === "filter" && "bg-green-500/10 text-green-500 border-green-500/30",
                        event.phase === "project" && "bg-purple-500/10 text-purple-500 border-purple-500/30",
                        event.phase === "sink" && "bg-orange-500/10 text-orange-500 border-orange-500/30"
                      )}
                    >
                      {event.phase}
                    </Badge>
                    <span className="text-xs font-mono flex-1 truncate text-muted-foreground">
                      {JSON.stringify(event.data).slice(0, 60)}...
                    </span>
                    {event.duration && (
                      <span className="text-xs text-muted-foreground">
                        {event.duration}ms
                      </span>
                    )}
                    {event.error ? (
                      <XCircle className="h-4 w-4 text-red-500" />
                    ) : (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Rule Status Metrics */}
      {ruleStatus && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: "Records In", value: (ruleStatus as any).source_demo_0_records_in_total || 0, icon: <Database className="h-4 w-4" /> },
            { label: "Records Out", value: (ruleStatus as any).sink_mqtt_0_0_records_out_total || 0, icon: <ArrowRight className="h-4 w-4" /> },
            { label: "Exceptions", value: (ruleStatus as any).source_demo_0_exceptions_total || 0, icon: <AlertCircle className="h-4 w-4" /> },
            { label: "Latency (ms)", value: Math.round((ruleStatus as any).sink_mqtt_0_0_process_latency_us / 1000) || 0, icon: <Clock className="h-4 w-4" /> },
            { label: "Buffer", value: (ruleStatus as any).source_demo_0_buffer_length || 0, icon: <Layers className="h-4 w-4" /> },
          ].map((metric) => (
            <Card key={metric.label}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{metric.icon}</span>
                  <span className="text-2xl font-bold">{metric.value}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{metric.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default RuleDebuggingPanel;
