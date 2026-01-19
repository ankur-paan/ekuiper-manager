"use client";

import * as React from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ekuiperClient } from "@/lib/ekuiper/client";
import { useServerStore } from "@/stores/server-store";

interface MetricPoint {
    timestamp: string;
    rateIn: number;
    rateOut: number;
}

export function MetricsSection() {
    const { activeServerId, servers } = useServerStore();
    const activeServer = servers.find(s => s.id === activeServerId);

    const [history, setHistory] = React.useState<MetricPoint[]>([]);
    const [totals, setTotals] = React.useState({ in: 0, out: 0 });
    // const [logs, setLogs] = React.useState<string[]>([]);
    const lastTotals = React.useRef<Record<string, { in: number, out: number, time: number }>>({});
    const MAX_POINTS = 20;

    // const addLog = (msg: string) => {
    //     const time = new Date().toISOString().split('T')[1].slice(0, 12); // HH:MM:SS.mmm
    //     setLogs(prev => [`[${time}] ${msg}`, ...prev].slice(0, 100));
    // };

    React.useEffect(() => {
        if (!activeServer) return;
        ekuiperClient.setBaseUrl(activeServer.url);

        const fetchData = async () => {
            try {
                // Log request start
                // addLog(`Requesting metrics from: ${activeServer.url} => Proxy`);

                const status = await ekuiperClient.getAllRulesStatus();

                // Debug Probe
                /*
                try {
                    const direct = await ekuiperClient.getRuleStatus('send_to_n8n');
                    addLog(`Direct send_to_n8n: ${JSON.stringify(direct).substring(0, 100)}...`);
                } catch (err: any) {
                    addLog(`Direct Probe Error: ${err.message}`);
                }
                */

                // Log response
                // addLog(`Response data: ${JSON.stringify(status)}`);

                const nowTime = Date.now();
                const newTotals: Record<string, { in: number, out: number, time: number }> = {};

                let sumRateIn = 0;
                let sumRateOut = 0;
                let sumCumIn = 0;
                let sumCumOut = 0;

                if (status && typeof status === 'object') {
                    Object.entries(status).forEach(([ruleId, m]: [string, any]) => {
                        const hasExplicitSpeed = typeof m.source_speed === 'number';
                        let currentRuleCumIn = 0;
                        let currentRuleCumOut = 0;

                        if (hasExplicitSpeed) {
                            sumRateIn += (m.source_speed || 0);
                            sumRateOut += (m.sink_speed || 0);
                        }

                        // Calculate Cumulative Totals
                        Object.keys(m).forEach(k => {
                            if (typeof m[k] === 'number') {
                                // Input: Check Source Ingestion first (records_in_total), then Output
                                if (k.includes('source_') && k.endsWith('records_in_total')) {
                                    currentRuleCumIn = Math.max(currentRuleCumIn, m[k]);
                                } else if (currentRuleCumIn === 0 && k.includes('source_') && k.endsWith('records_out_total')) {
                                    currentRuleCumIn = Math.max(currentRuleCumIn, m[k]);
                                }

                                // Output: Check Sink Ingestion (records_in_total)
                                if (k.includes('sink_') && k.endsWith('records_in_total')) {
                                    currentRuleCumOut += m[k];
                                }

                                // Fallback: simple matching
                                if (currentRuleCumIn === 0 && k.endsWith('records_in_total') && !k.includes('op_') && !k.includes('sink_')) currentRuleCumIn = m[k];
                            }
                        });

                        sumCumIn += currentRuleCumIn;
                        sumCumOut += currentRuleCumOut;

                        if (!hasExplicitSpeed) {
                            const prev = lastTotals.current[ruleId];
                            if (prev) {
                                const dt = (nowTime - prev.time) / 1000;
                                if (dt > 0) {
                                    const rIn = Math.max(0, (currentRuleCumIn - prev.in) / dt);
                                    const rOut = Math.max(0, (currentRuleCumOut - prev.out) / dt);
                                    sumRateIn += rIn;
                                    sumRateOut += rOut;
                                }
                            }
                            newTotals[ruleId] = { in: currentRuleCumIn, out: currentRuleCumOut, time: nowTime };
                        }
                    });

                    lastTotals.current = { ...lastTotals.current, ...newTotals };
                }

                setTotals({ in: sumCumIn, out: sumCumOut });

                const now = new Date().toLocaleTimeString();
                setHistory(prev => {
                    const pIn = Number(sumRateIn.toFixed(2));
                    const pOut = Number(sumRateOut.toFixed(2));

                    const newH = [...prev, { timestamp: now, rateIn: pIn, rateOut: pOut }];
                    if (newH.length > MAX_POINTS) return newH.slice(newH.length - MAX_POINTS);
                    return newH;
                });
            } catch (e) {
                // const errMsg = e instanceof Error ? e.message : String(e);
                console.error("Failed to fetch metrics", e);
                // addLog(`ERROR: ${errMsg}`);
            }
        };

        const interval = setInterval(fetchData, 500);
        return () => clearInterval(interval);
    }, [activeServer?.url]);

    if (!activeServer) return null;

    const lastPoint = history[history.length - 1] || { rateIn: 0, rateOut: 0 };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex justify-between">
                            Input Throughput
                            <div className="flex flex-col items-end">
                                <span className="text-2xl font-bold">{totals.in.toLocaleString()}</span>
                                <span className="text-xs font-normal text-muted-foreground font-mono">
                                    {lastPoint.rateIn}/s
                                </span>
                            </div>
                        </CardTitle>
                        <CardDescription>Messages / second</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[200px] w-full" style={{ minHeight: '200px' }}>
                            <ResponsiveContainer width="99%" height="100%" minWidth={0}>
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
                                    <Area type="monotone" dataKey="rateIn" stroke="#8884d8" fillOpacity={1} fill="url(#colorIn)" isAnimationActive={false} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex justify-between">
                            Output Throughput
                            <div className="flex flex-col items-end">
                                <span className="text-2xl font-bold">{totals.out.toLocaleString()}</span>
                                <span className="text-xs font-normal text-muted-foreground font-mono">
                                    {lastPoint.rateOut}/s
                                </span>
                            </div>
                        </CardTitle>
                        <CardDescription>Messages / second</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[200px] w-full" style={{ minHeight: '200px' }}>
                            <ResponsiveContainer width="99%" height="100%" minWidth={0}>
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
                                    <Area type="monotone" dataKey="rateOut" stroke="#82ca9d" fillOpacity={1} fill="url(#colorOut)" isAnimationActive={false} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* API Log Stream (Commented Out)
            <Card>
                <CardHeader className="py-3">
                    <CardTitle className="text-xs font-mono uppercase text-muted-foreground">API Log Stream (500ms poll)</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md bg-muted p-4 h-64 overflow-auto font-mono text-xs">
                        {logs.length === 0 && <span className="text-muted-foreground">Initializing stream...</span>}
                        {logs.map((log, i) => (
                            <div key={i} className="mb-1 whitespace-pre-wrap break-all border-b border-border/50 pb-1 last:border-0 last:pb-0">
                                {log}
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
            */}
        </div>
    );
}
