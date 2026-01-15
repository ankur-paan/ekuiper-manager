"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Play,
  Pause,
  Trash2,
  Download,
  Settings,
  Activity,
  Table,
  BarChart3,
  Code,
  RefreshCw,
  Wifi,
  WifiOff,
  Filter,
  Maximize2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { DataStreamChart } from "./DataStreamChart";
import { DataTable } from "./DataTable";
import { RawJsonViewer } from "./RawJsonViewer";
import { DataFilterBar } from "./DataFilterBar";

// Types
export interface StreamDataPoint {
  id: string;
  timestamp: Date;
  data: Record<string, any>;
  ruleName?: string;
  streamName?: string;
}

export interface LiveDataViewerProps {
  connectionId: string;
  streamName?: string;
  ruleName?: string;
  maxDataPoints?: number;
}

type ViewMode = "chart" | "table" | "json";

export function LiveDataViewer({
  connectionId,
  streamName,
  ruleName,
  maxDataPoints = 1000,
}: LiveDataViewerProps) {
  // State
  const [isConnected, setIsConnected] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [dataPoints, setDataPoints] = useState<StreamDataPoint[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("chart");
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [availableFields, setAvailableFields] = useState<string[]>([]);
  const [filterExpression, setFilterExpression] = useState("");
  const [refreshRate, setRefreshRate] = useState(1000);
  const [showSettings, setShowSettings] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [stats, setStats] = useState({
    totalReceived: 0,
    recordsPerSecond: 0,
    lastUpdate: null as Date | null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const dataBufferRef = useRef<StreamDataPoint[]>([]);
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const wsUrl = `ws://${window.location.host}/api/connections/${connectionId}/ekuiper/ws`;
    const params = new URLSearchParams();
    if (streamName) params.set("stream", streamName);
    if (ruleName) params.set("rule", ruleName);

    const ws = new WebSocket(`${wsUrl}?${params.toString()}`);

    ws.onopen = () => {
      setIsConnected(true);
      console.log("WebSocket connected");
    };

    ws.onmessage = (event) => {
      if (isPaused) return;

      try {
        const message = JSON.parse(event.data);
        const newPoint: StreamDataPoint = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date(),
          data: message.data || message,
          ruleName: message.rule || ruleName,
          streamName: message.stream || streamName,
        };

        // Update available fields
        const fields = Object.keys(newPoint.data);
        setAvailableFields((prev) => {
          const newFields = fields.filter((f) => !prev.includes(f));
          return newFields.length > 0 ? [...prev, ...newFields] : prev;
        });

        // Add to buffer
        dataBufferRef.current.push(newPoint);

        // Update stats
        setStats((prev) => ({
          ...prev,
          totalReceived: prev.totalReceived + 1,
          lastUpdate: new Date(),
        }));
      } catch (error) {
        console.error("Failed to parse message:", error);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      console.log("WebSocket disconnected");
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      setIsConnected(false);
    };

    wsRef.current = ws;
  }, [connectionId, streamName, ruleName, isPaused]);

  // Disconnect WebSocket
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  // Flush buffer to state at refresh rate
  useEffect(() => {
    const interval = setInterval(() => {
      if (dataBufferRef.current.length > 0) {
        setDataPoints((prev) => {
          const combined = [...prev, ...dataBufferRef.current];
          dataBufferRef.current = [];
          // Keep only last maxDataPoints
          return combined.slice(-maxDataPoints);
        });
      }
    }, refreshRate);

    return () => clearInterval(interval);
  }, [refreshRate, maxDataPoints]);

  // Calculate records per second
  useEffect(() => {
    let lastCount = stats.totalReceived;

    statsIntervalRef.current = setInterval(() => {
      const currentCount = stats.totalReceived;
      const rps = currentCount - lastCount;
      lastCount = currentCount;
      setStats((prev) => ({ ...prev, recordsPerSecond: rps }));
    }, 1000);

    return () => {
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
      }
    };
  }, [stats.totalReceived]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  // Auto-select first few fields for chart
  useEffect(() => {
    if (selectedFields.length === 0 && availableFields.length > 0) {
      // Select first 3 numeric fields
      const numericFields = availableFields.filter((field) => {
        const sample = dataPoints[0]?.data[field];
        return typeof sample === "number";
      });
      setSelectedFields(numericFields.slice(0, 3));
    }
  }, [availableFields, dataPoints, selectedFields.length]);

  // Filter data points
  const filteredData = dataPoints.filter((point) => {
    if (!filterExpression) return true;
    try {
      // Simple field:value filter
      const [field, value] = filterExpression.split(":");
      if (field && value) {
        const fieldValue = String(point.data[field] || "").toLowerCase();
        return fieldValue.includes(value.toLowerCase());
      }
      return true;
    } catch {
      return true;
    }
  });

  // Clear data
  const clearData = () => {
    setDataPoints([]);
    dataBufferRef.current = [];
    setStats({
      totalReceived: 0,
      recordsPerSecond: 0,
      lastUpdate: null,
    });
  };

  // Export data
  const exportData = () => {
    const exportObj = {
      exportedAt: new Date().toISOString(),
      stream: streamName,
      rule: ruleName,
      totalRecords: filteredData.length,
      data: filteredData,
    };
    const blob = new Blob([JSON.stringify(exportObj, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stream-data-${streamName || ruleName || "export"}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Simulate data for demo (remove in production)
  const simulateData = useCallback(() => {
    const interval = setInterval(() => {
      if (isPaused) return;

      const newPoint: StreamDataPoint = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        data: {
          temperature: 20 + Math.random() * 15,
          humidity: 40 + Math.random() * 40,
          pressure: 1000 + Math.random() * 50,
          value: Math.floor(Math.random() * 100),
          status: Math.random() > 0.5 ? "active" : "idle",
        },
        streamName: streamName || "demo",
      };

      dataBufferRef.current.push(newPoint);
      setStats((prev) => ({
        ...prev,
        totalReceived: prev.totalReceived + 1,
        lastUpdate: new Date(),
      }));

      // Set available fields
      setAvailableFields(Object.keys(newPoint.data));
    }, 500);

    return () => clearInterval(interval);
  }, [isPaused, streamName]);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5 text-sota-blue" />
              Live Data Preview
            </CardTitle>
            <Badge variant={isConnected ? "default" : "secondary"}>
              {isConnected ? (
                <>
                  <Wifi className="h-3 w-3 mr-1" />
                  Connected
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3 mr-1" />
                  Disconnected
                </>
              )}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            {/* Stats */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground mr-4">
              <span>
                <strong>{stats.totalReceived.toLocaleString()}</strong> total
              </span>
              <span>
                <strong>{stats.recordsPerSecond}</strong> rec/s
              </span>
              <span>
                <strong>{filteredData.length.toLocaleString()}</strong> buffered
              </span>
            </div>

            {/* Controls */}
            {isConnected || dataPoints.length > 0 ? (
              <>
                <Button
                  variant={isPaused ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsPaused(!isPaused)}
                >
                  {isPaused ? (
                    <Play className="h-4 w-4" />
                  ) : (
                    <Pause className="h-4 w-4" />
                  )}
                </Button>
                <Button variant="outline" size="sm" onClick={clearData}>
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={exportData}>
                  <Download className="h-4 w-4" />
                </Button>
              </>
            ) : null}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="h-4 w-4" />
            </Button>

            {!isConnected ? (
              <Button size="sm" onClick={simulateData}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Demo Mode
              </Button>
            ) : (
              <Button variant="destructive" size="sm" onClick={disconnect}>
                Disconnect
              </Button>
            )}
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="mt-4 p-4 border rounded-lg bg-muted/30 space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Refresh Rate (ms)</Label>
                <Select
                  value={String(refreshRate)}
                  onValueChange={(v) => setRefreshRate(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="100">100ms (Fast)</SelectItem>
                    <SelectItem value="500">500ms</SelectItem>
                    <SelectItem value="1000">1s (Default)</SelectItem>
                    <SelectItem value="2000">2s</SelectItem>
                    <SelectItem value="5000">5s (Slow)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Max Buffer Size</Label>
                <Input
                  type="number"
                  value={maxDataPoints}
                  disabled
                  className="bg-muted"
                />
              </div>

              <div className="flex items-center space-x-2 pt-6">
                <Switch
                  id="autoscroll"
                  checked={autoScroll}
                  onCheckedChange={setAutoScroll}
                />
                <Label htmlFor="autoscroll">Auto-scroll</Label>
              </div>
            </div>

            {availableFields.length > 0 && (
              <div className="space-y-2">
                <Label>Chart Fields</Label>
                <div className="flex flex-wrap gap-2">
                  {availableFields.map((field) => (
                    <Badge
                      key={field}
                      variant={
                        selectedFields.includes(field) ? "default" : "outline"
                      }
                      className="cursor-pointer"
                      onClick={() => {
                        setSelectedFields((prev) =>
                          prev.includes(field)
                            ? prev.filter((f) => f !== field)
                            : [...prev, field]
                        );
                      }}
                    >
                      {field}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 flex flex-col min-h-0">
        {/* Filter Bar */}
        <DataFilterBar
          value={filterExpression}
          onChange={setFilterExpression}
          availableFields={availableFields}
        />

        {/* View Tabs */}
        <Tabs
          value={viewMode}
          onValueChange={(v) => setViewMode(v as ViewMode)}
          className="flex-1 flex flex-col min-h-0"
        >
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="chart" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Chart
            </TabsTrigger>
            <TabsTrigger value="table" className="flex items-center gap-2">
              <Table className="h-4 w-4" />
              Table
            </TabsTrigger>
            <TabsTrigger value="json" className="flex items-center gap-2">
              <Code className="h-4 w-4" />
              Raw JSON
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0">
            <TabsContent value="chart" className="h-full m-0">
              <DataStreamChart
                data={filteredData}
                fields={selectedFields}
                autoScroll={autoScroll}
              />
            </TabsContent>

            <TabsContent value="table" className="h-full m-0">
              <DataTable
                data={filteredData}
                autoScroll={autoScroll}
              />
            </TabsContent>

            <TabsContent value="json" className="h-full m-0">
              <RawJsonViewer
                data={filteredData}
                autoScroll={autoScroll}
              />
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}
