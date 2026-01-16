"use client";

import { useMemo } from "react";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import type { DebugEvent } from "./RecordingStorage";

interface TimelineSliderProps {
  events: DebugEvent[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
}

export function TimelineSlider({
  events,
  currentIndex,
  onIndexChange,
}: TimelineSliderProps) {
  // Calculate event type distribution for visualization
  const eventMarkers = useMemo(() => {
    if (events.length === 0) return [];

    return events.map((event, index) => {
      const position = (index / (events.length - 1)) * 100;
      return {
        position,
        type: event.type,
        index,
      };
    });
  }, [events]);

  // Current event info
  const currentEvent = events[currentIndex];

  // Time range
  const timeRange = useMemo(() => {
    if (events.length === 0) return null;
    const start = new Date(events[0].timestamp);
    const end = new Date(events[events.length - 1].timestamp);
    return {
      start,
      end,
      duration: end.getTime() - start.getTime(),
    };
  }, [events]);

  if (events.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        No events recorded yet
      </div>
    );
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case "input":
        return "bg-blue-500";
      case "processing":
        return "bg-amber-500";
      case "output":
        return "bg-green-500";
      case "error":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <div className="space-y-4">
      {/* Event markers visualization */}
      <div className="relative h-8 bg-muted rounded">
        {/* Event type markers */}
        {eventMarkers.map((marker, i) => (
          <div
            key={i}
            className={`absolute top-0 w-1 h-full cursor-pointer transition-opacity ${
              marker.index === currentIndex ? "opacity-100" : "opacity-30"
            } ${getTypeColor(marker.type)}`}
            style={{ left: `${marker.position}%` }}
            onClick={() => onIndexChange(marker.index)}
            title={`Event #${marker.index + 1}: ${marker.type}`}
          />
        ))}

        {/* Current position indicator */}
        <div
          className="absolute top-0 w-0.5 h-full bg-white shadow-lg z-10"
          style={{
            left: `${(currentIndex / (events.length - 1)) * 100}%`,
          }}
        >
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-sota-blue rounded-full" />
        </div>
      </div>

      {/* Slider control */}
      <Slider
        value={[currentIndex]}
        max={events.length - 1}
        step={1}
        onValueChange={([value]) => onIndexChange(value)}
        className="w-full"
      />

      {/* Time and position info */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {timeRange && new Date(timeRange.start).toLocaleTimeString()}
        </span>
        <div className="flex items-center gap-3">
          <span>
            Event {currentIndex + 1} of {events.length}
          </span>
          {currentEvent && (
            <Badge variant="outline" className="text-xs">
              {currentEvent.type}
            </Badge>
          )}
          {currentEvent && (
            <span>
              {new Date(currentEvent.timestamp).toLocaleTimeString()}
            </span>
          )}
        </div>
        <span>
          {timeRange && new Date(timeRange.end).toLocaleTimeString()}
        </span>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-blue-500" />
          <span>Input</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-amber-500" />
          <span>Processing</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-green-500" />
          <span>Output</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-red-500" />
          <span>Error</span>
        </div>
      </div>
    </div>
  );
}
