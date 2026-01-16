"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { Card } from "@/components/ui/card";
import { StreamDataPoint } from "./LiveDataViewer";

interface DataStreamChartProps {
  data: StreamDataPoint[];
  fields: string[];
  autoScroll?: boolean;
  chartType?: "line" | "area";
  maxPoints?: number;
}

// Color palette for chart lines
const CHART_COLORS = [
  "#3b82f6", // blue
  "#10b981", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#f97316", // orange
  "#ec4899", // pink
];

export function DataStreamChart({
  data,
  fields,
  autoScroll = true,
  chartType = "line",
  maxPoints = 100,
}: DataStreamChartProps) {
  // Transform data for recharts
  const chartData = useMemo(() => {
    const displayData = autoScroll ? data.slice(-maxPoints) : data;
    
    return displayData.map((point, index) => {
      const entry: Record<string, any> = {
        time: point.timestamp.toLocaleTimeString(),
        timestamp: point.timestamp.getTime(),
        index,
      };

      fields.forEach((field) => {
        const value = point.data[field];
        if (typeof value === "number") {
          entry[field] = value;
        } else if (typeof value === "boolean") {
          entry[field] = value ? 1 : 0;
        } else if (!isNaN(Number(value))) {
          entry[field] = Number(value);
        }
      });

      return entry;
    });
  }, [data, fields, autoScroll, maxPoints]);

  // Calculate Y-axis domain
  const yDomain = useMemo(() => {
    if (chartData.length === 0) return [0, 100];

    let min = Infinity;
    let max = -Infinity;

    chartData.forEach((point) => {
      fields.forEach((field) => {
        const value = point[field];
        if (typeof value === "number") {
          min = Math.min(min, value);
          max = Math.max(max, value);
        }
      });
    });

    const padding = (max - min) * 0.1;
    return [Math.floor(min - padding), Math.ceil(max + padding)];
  }, [chartData, fields]);

  if (fields.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p>No numeric fields selected</p>
          <p className="text-sm">Select fields in settings to visualize</p>
        </div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p>Waiting for data...</p>
          <p className="text-sm">Data will appear here when received</p>
        </div>
      </div>
    );
  }

  const ChartComponent = chartType === "area" ? AreaChart : LineChart;
  const DataComponent = chartType === "area" ? Area : Line;

  return (
    <Card className="h-full p-4">
      <ResponsiveContainer width="100%" height="100%">
        <ChartComponent
          data={chartData}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
          <XAxis
            dataKey="time"
            stroke="#9ca3af"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={yDomain}
            stroke="#9ca3af"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={60}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1f2937",
              border: "1px solid #374151",
              borderRadius: "8px",
              color: "#f9fafb",
            }}
            labelStyle={{ color: "#9ca3af" }}
          />
          <Legend
            wrapperStyle={{ paddingTop: "10px" }}
            iconType="line"
          />
          {fields.map((field, index) => (
            chartType === "area" ? (
              <Area
                key={field}
                type="monotone"
                dataKey={field}
                stroke={CHART_COLORS[index % CHART_COLORS.length]}
                fill={CHART_COLORS[index % CHART_COLORS.length]}
                fillOpacity={0.2}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            ) : (
              <Line
                key={field}
                type="monotone"
                dataKey={field}
                stroke={CHART_COLORS[index % CHART_COLORS.length]}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            )
          ))}
        </ChartComponent>
      </ResponsiveContainer>
    </Card>
  );
}
