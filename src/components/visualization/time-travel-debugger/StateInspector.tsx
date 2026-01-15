"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Database,
  FileJson,
  Activity,
  Clock,
  Cpu,
  HardDrive,
} from "lucide-react";
import type { DebugEvent } from "./RecordingStorage";

interface StateInspectorProps {
  event?: DebugEvent;
}

export function StateInspector({ event }: StateInspectorProps) {
  if (!event) {
    return (
      <Card className="h-full flex items-center justify-center">
        <p className="text-muted-foreground">Select an event to inspect</p>
      </Card>
    );
  }

  const renderValue = (value: any, depth = 0): React.ReactNode => {
    if (value === null) return <span className="text-gray-500">null</span>;
    if (value === undefined) return <span className="text-gray-500">undefined</span>;

    if (typeof value === "boolean") {
      return (
        <Badge variant={value ? "default" : "secondary"} className="text-xs">
          {String(value)}
        </Badge>
      );
    }

    if (typeof value === "number") {
      return (
        <span className="text-sota-blue font-mono">
          {Number.isInteger(value) ? value : value.toFixed(4)}
        </span>
      );
    }

    if (typeof value === "string") {
      return <span className="text-green-400">"{value}"</span>;
    }

    if (Array.isArray(value)) {
      if (depth > 2) return <span className="text-muted-foreground">[...]</span>;
      return (
        <div className="pl-4 border-l border-muted">
          {value.map((item, i) => (
            <div key={i} className="py-0.5">
              <span className="text-muted-foreground text-xs">[{i}]:</span>{" "}
              {renderValue(item, depth + 1)}
            </div>
          ))}
        </div>
      );
    }

    if (typeof value === "object") {
      if (depth > 2) return <span className="text-muted-foreground">{"{...}"}</span>;
      return (
        <div className="pl-4 border-l border-muted">
          {Object.entries(value).map(([key, val]) => (
            <div key={key} className="py-0.5">
              <span className="text-purple-400">{key}:</span>{" "}
              {renderValue(val, depth + 1)}
            </div>
          ))}
        </div>
      );
    }

    return String(value);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "input":
        return <Database className="h-4 w-4 text-blue-500" />;
      case "processing":
        return <Cpu className="h-4 w-4 text-amber-500" />;
      case "output":
        return <FileJson className="h-4 w-4 text-green-500" />;
      case "error":
        return <Activity className="h-4 w-4 text-red-500" />;
      default:
        return <FileJson className="h-4 w-4" />;
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Activity className="h-4 w-4 text-sota-blue" />
          State Inspector
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        <ScrollArea className="h-full">
          <div className="space-y-4">
            {/* Event info */}
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground uppercase">
                Event Info
              </h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  {getTypeIcon(event.type)}
                  <span>Type:</span>
                  <Badge variant="outline">{event.type}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Data payload */}
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground uppercase">
                Data Payload
              </h4>
              <div className="bg-muted/50 p-3 rounded font-mono text-xs">
                {renderValue(event.data)}
              </div>
            </div>

            <Separator />

            {/* State snapshot */}
            {event.state && Object.keys(event.state).length > 0 && (
              <>
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase">
                    State Snapshot
                  </h4>
                  <div className="bg-muted/50 p-3 rounded font-mono text-xs">
                    {renderValue(event.state)}
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Metadata */}
            {event.metadata && Object.keys(event.metadata).length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase">
                  Metadata
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {event.metadata.processingTime !== undefined && (
                    <div className="flex items-center gap-2 p-2 bg-muted/30 rounded">
                      <Cpu className="h-4 w-4 text-amber-500" />
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Processing Time
                        </p>
                        <p className="text-sm font-mono">
                          {event.metadata.processingTime.toFixed(2)} ms
                        </p>
                      </div>
                    </div>
                  )}
                  {event.metadata.memoryUsage !== undefined && (
                    <div className="flex items-center gap-2 p-2 bg-muted/30 rounded">
                      <HardDrive className="h-4 w-4 text-blue-500" />
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Memory Usage
                        </p>
                        <p className="text-sm font-mono">
                          {event.metadata.memoryUsage.toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
