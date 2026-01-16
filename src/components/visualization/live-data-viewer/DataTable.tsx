"use client";

import { useRef, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StreamDataPoint } from "./LiveDataViewer";

interface DataTableProps {
  data: StreamDataPoint[];
  autoScroll?: boolean;
  maxRows?: number;
}

export function DataTable({
  data,
  autoScroll = true,
  maxRows = 100,
}: DataTableProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Get all unique columns from data
  const columns = useMemo(() => {
    const columnSet = new Set<string>();
    data.forEach((point) => {
      Object.keys(point.data).forEach((key) => columnSet.add(key));
    });
    return Array.from(columnSet);
  }, [data]);

  // Display data (limited and reversed for newest first)
  const displayData = useMemo(() => {
    return autoScroll
      ? data.slice(-maxRows).reverse()
      : data.slice(0, maxRows);
  }, [data, autoScroll, maxRows]);

  // Auto-scroll to top when new data arrives (since newest is at top)
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [displayData.length, autoScroll]);

  // Format cell value for display
  const formatValue = (value: any): React.ReactNode => {
    if (value === null || value === undefined) {
      return <span className="text-muted-foreground">null</span>;
    }
    if (typeof value === "boolean") {
      return (
        <Badge variant={value ? "default" : "secondary"}>
          {value ? "true" : "false"}
        </Badge>
      );
    }
    if (typeof value === "number") {
      return (
        <span className="font-mono text-sota-blue">
          {Number.isInteger(value) ? value : value.toFixed(2)}
        </span>
      );
    }
    if (typeof value === "object") {
      return (
        <code className="text-xs bg-muted px-1 py-0.5 rounded">
          {JSON.stringify(value)}
        </code>
      );
    }
    return String(value);
  };

  if (data.length === 0) {
    return (
      <Card className="h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p>No data yet</p>
          <p className="text-sm">Data will appear here when received</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <ScrollArea className="flex-1" ref={scrollRef}>
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              <TableHead className="w-[100px]">Time</TableHead>
              {columns.map((col) => (
                <TableHead key={col} className="min-w-[100px]">
                  {col}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayData.map((point) => (
              <TableRow key={point.id} className="hover:bg-muted/50">
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {point.timestamp.toLocaleTimeString()}
                </TableCell>
                {columns.map((col) => (
                  <TableCell key={col}>{formatValue(point.data[col])}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
      
      <div className="p-2 border-t bg-muted/30 text-xs text-muted-foreground flex justify-between">
        <span>Showing {displayData.length} of {data.length} records</span>
        <span>{columns.length} columns</span>
      </div>
    </Card>
  );
}
