"use client";

import { useRef, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { StreamDataPoint } from "./LiveDataViewer";

interface RawJsonViewerProps {
  data: StreamDataPoint[];
  autoScroll?: boolean;
  maxLines?: number;
}

export function RawJsonViewer({
  data,
  autoScroll = true,
  maxLines = 100,
}: RawJsonViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Display data (limited)
  const displayData = useMemo(() => {
    return autoScroll
      ? data.slice(-maxLines).reverse()
      : data.slice(0, maxLines);
  }, [data, autoScroll, maxLines]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [displayData.length, autoScroll]);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const copyAll = () => {
    const jsonStr = JSON.stringify(displayData.map((d) => d.data), null, 2);
    navigator.clipboard.writeText(jsonStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyOne = (point: StreamDataPoint) => {
    navigator.clipboard.writeText(JSON.stringify(point.data, null, 2));
  };

  // Syntax highlight JSON
  const highlightJson = (obj: any): React.ReactNode => {
    const jsonStr = JSON.stringify(obj, null, 2);
    
    // Simple syntax highlighting
    const highlighted = jsonStr
      .replace(/"([^"]+)":/g, '<span class="text-purple-400">"$1"</span>:')
      .replace(/: "([^"]+)"/g, ': <span class="text-green-400">"$1"</span>')
      .replace(/: (\d+\.?\d*)/g, ': <span class="text-sota-blue">$1</span>')
      .replace(/: (true|false)/g, ': <span class="text-amber-400">$1</span>')
      .replace(/: (null)/g, ': <span class="text-gray-500">$1</span>');

    return <span dangerouslySetInnerHTML={{ __html: highlighted }} />;
  };

  if (data.length === 0) {
    return (
      <Card className="h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p>No data yet</p>
          <p className="text-sm">Raw JSON will appear here when received</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <div className="p-2 border-b flex items-center justify-between bg-muted/30">
        <span className="text-sm text-muted-foreground">
          {displayData.length} records
        </span>
        <Button variant="ghost" size="sm" onClick={copyAll}>
          {copied ? (
            <Check className="h-4 w-4 mr-1" />
          ) : (
            <Copy className="h-4 w-4 mr-1" />
          )}
          Copy All
        </Button>
      </div>
      
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-2 space-y-1">
          {displayData.map((point) => {
            const isExpanded = expandedIds.has(point.id);
            const jsonStr = isExpanded
              ? JSON.stringify(point.data, null, 2)
              : JSON.stringify(point.data);
            
            return (
              <div
                key={point.id}
                className="group flex items-start gap-2 p-2 rounded hover:bg-muted/50 font-mono text-xs"
              >
                <span className="text-muted-foreground whitespace-nowrap flex-shrink-0">
                  {point.timestamp.toLocaleTimeString()}
                </span>
                
                <pre
                  className={`flex-1 overflow-hidden ${isExpanded ? "" : "truncate"} cursor-pointer`}
                  onClick={() => toggleExpanded(point.id)}
                >
                  {isExpanded ? highlightJson(point.data) : (
                    <code className="text-foreground">{jsonStr}</code>
                  )}
                </pre>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  onClick={() => copyOne(point)}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </Card>
  );
}
