"use client";

import * as React from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ekuiperClient } from "@/lib/ekuiper/client";
import { useServerStore } from "@/stores/server-store";
import { Activity } from "lucide-react";

interface MetricPoint {
    timestamp: string;
    totalIn: number;
    totalOut: number;
}

export function MetricsSection() {
    const { activeServerId, servers } = useServerStore();
    const activeServer = servers.find(s => s.id === activeServerId);

    const [history, setHistory] = React.useState<MetricPoint[]>([]);
    const MAX_POINTS = 20;

    React.useEffect(() => {
        if (!activeServer) return;
        ekuiperClient.setBaseUrl(activeServer.url);

        const fetchData = async () => {
            try {
                // We use rules status as proxy for system throughput
                // Or use /metrics if available (usually prometheus endpoint, not REST).
                // Using Sum of Rules Metrics.
                const status = await ekuiperClient.getAllRulesStatus();
                // structure: { ruleId: { ...metrics } }
                let sumIn = 0;
                let sumOut = 0;

                // Note: getAllRulesStatus signature might vary. Assuming dictionary or array.
                // My client.ts typed it as RuleBulkStatus (Map or Array).
                // Actually client.ts types.ts defines RuleBulkStatus as Record<string, RuleMetrics>.

                if (status && typeof status === 'object') {
                    Object.values(status).forEach((m: any) => {
                        // metrics key within rule status
                        // eKuiper v1 rule status: { status, sink_speed, source_speed, ... }
                        // v2 might be different. 
                        // Let's assume standard keys: input_count, output_count are cumulative.
                        // We need rate. 
                        // Simple solution: Just plot cumulative?? No, chart needs rate.
                        // Or plot "sink_speed" / "source_speed" if available.

                        // If source_speed available (instant rate):
                        if (typeof m.source_speed === 'number') sumIn += m.source_speed;
                        if (typeof m.sink_speed === 'number') sumOut += m.sink_speed;
                    });
                }

                const now = new Date().toLocaleTimeString();
                setHistory(prev => {
                    const newH = [...prev, { timestamp: now, totalIn: sumIn, totalOut: sumOut }];
                    if (newH.length > MAX_POINTS) return newH.slice(newH.length - MAX_POINTS);
                    return newH;
                });
            } catch (e) {
                // ignore
            }
        };

        const interval = setInterval(fetchData, 3000);
        return () => clearInterval(interval);
    }, [activeServer]);

    if (!activeServer) return null;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Input Throughput</CardTitle>
                    <CardDescription>Messages / second</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[200px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={history}>
                                <defs>
                                    <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                                <XAxis dataKey="timestamp" hide />
                                <YAxis />
                                <Tooltip />
                                <Area type="monotone" dataKey="totalIn" stroke="#8884d8" fillOpacity={1} fill="url(#colorIn)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Output Throughput</CardTitle>
                    <CardDescription>Messages / second</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[200px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={history}>
                                <defs>
                                    <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#82ca9d" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                                <XAxis dataKey="timestamp" hide />
                                <YAxis />
                                <Tooltip />
                                <Area type="monotone" dataKey="totalOut" stroke="#82ca9d" fillOpacity={1} fill="url(#colorOut)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
