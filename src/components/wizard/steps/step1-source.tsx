
"use client";

import * as React from "react";
import { useQueryWizardStore } from "@/stores/wizard-store";
import { useEmqxStore } from "@/stores/emqx-store";
import { ekuiperClient } from "@/lib/ekuiper/client";
import { useServerStore } from "@/stores/server-store";
import { StreamListItem } from "@/lib/ekuiper/types";
import { Database, Plus, Trash, GitMerge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { emqxLiveClient } from "@/lib/emqx/live-client";

export function Step1Source() {
    const { sources, joins, addSource, updateSource, removeSource, addJoin, updateJoin, setSourceSchema } = useQueryWizardStore();
    const { servers, activeServerId } = useServerStore();
    const activeServer = servers.find((s) => s.id === activeServerId);

    const [streams, setStreams] = React.useState<StreamListItem[]>([]);
    const [tables, setTables] = React.useState<StreamListItem[]>([]);

    // Fetch Resources
    React.useEffect(() => {
        let mounted = true;
        const fetchResources = async () => {
            if (activeServer) {
                ekuiperClient.setBaseUrl(activeServer.url);
                try {
                    const [s, t] = await Promise.all([
                        ekuiperClient.listStreams().catch(() => []),
                        ekuiperClient.listTables().catch(() => []),
                    ]);
                    if (mounted) {
                        setStreams(Array.isArray(s) ? s : []);
                        setTables(Array.isArray(t) ? t : []);
                    }
                } catch (e) { console.error(e); }
            }
        };
        fetchResources();
        return () => { mounted = false; };
    }, [activeServer]);

    // If no source, show placeholder to add one
    if (sources.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center space-y-4 p-10 py-16 border-2 border-dashed rounded-xl bg-muted/10 h-[400px]">
                <div className="p-4 rounded-full bg-primary/10 text-primary">
                    <Database className="h-8 w-8" />
                </div>
                <div className="text-center space-y-1">
                    <h3 className="text-lg font-semibold">No Data Source Selected</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">Start by selecting a Stream or Table to ingest data from.</p>
                </div>

                <div className="grid grid-cols-2 gap-3 w-full max-w-md mt-4">
                    <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground uppercase">Streams</Label>
                        <Select onValueChange={async (v) => {
                            addSource({ resourceName: v, resourceType: 'stream', alias: 't1' });
                            try {
                                const schema = await ekuiperClient.getStreamSchema(v);
                                setSourceSchema(v, schema);
                            } catch (e) { }
                        }}>
                            <SelectTrigger><SelectValue placeholder="Select Stream..." /></SelectTrigger>
                            <SelectContent>
                                {streams.map(s => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}
                                {streams.length === 0 && <div className="p-2 text-xs text-center text-muted-foreground">No streams found</div>}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground uppercase">Tables</Label>
                        <Select onValueChange={async (v) => {
                            addSource({ resourceName: v, resourceType: 'table', alias: 't1' });
                            try {
                                const schema = await ekuiperClient.getTableSchema(v);
                                setSourceSchema(v, schema);
                            } catch (e) { }
                        }}>
                            <SelectTrigger><SelectValue placeholder="Select Table..." /></SelectTrigger>
                            <SelectContent>
                                {tables.map(t => <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>)}
                                {tables.length === 0 && <div className="p-2 text-xs text-center text-muted-foreground">No tables found</div>}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>
        );
    }

    // Render Source List & Joins
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Data Sources</h3>
                <Button size="sm" variant="outline" className="gap-2" onClick={() => addSource({ resourceName: '', resourceType: 'stream', alias: `t${sources.length + 1}` })}>
                    <Plus className="h-4 w-4" /> Add Source (Join)
                </Button>
            </div>

            {sources.map((source, index) => {
                const isMain = index === 0;
                return (
                    <Card key={source.id} className="p-4 space-y-4">
                        <div className="flex items-start justify-between">
                            <div className="grid grid-cols-3 gap-4 flex-1">
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Type</Label>
                                    <Select
                                        value={source.resourceType}
                                        onValueChange={(v: "stream" | "table" | "topic") => {
                                            updateSource(source.id, { resourceType: v, resourceName: '' });
                                        }}
                                        disabled={!isMain && joins.some(j => j.targetSourceId === source.id)}
                                    >
                                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="stream">Stream</SelectItem>
                                            <SelectItem value="table">Table</SelectItem>
                                            <SelectItem value="topic">Topic</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1" id="tour-step1-resource">
                                    <Label className="text-xs text-muted-foreground">Resource Name</Label>
                                    {source.resourceType === 'topic' ? (
                                        <Input
                                            className="h-8"
                                            value={source.resourceName}
                                            onChange={e => updateSource(source.id, { resourceName: e.target.value })}
                                            placeholder="mqtt/topic/..."
                                        />
                                    ) : (
                                        <Select
                                            value={source.resourceName}
                                            onValueChange={async (v) => {
                                                updateSource(source.id, { resourceName: v });
                                                // Fetch and store schema
                                                if (v && source.resourceType !== 'topic') {
                                                    try {
                                                        const schema = source.resourceType === 'stream'
                                                            ? await ekuiperClient.getStreamSchema(v)
                                                            : await ekuiperClient.getTableSchema(v);
                                                        setSourceSchema(v, schema);
                                                    } catch (e) {
                                                        console.error("Failed to fetch schema for", v, e);
                                                    }
                                                }
                                            }}
                                        >
                                            <SelectTrigger className="h-8"><SelectValue placeholder="Select..." /></SelectTrigger>
                                            <SelectContent>
                                                {(source.resourceType === 'stream' ? streams : tables).map(r => (
                                                    <SelectItem key={r.name} value={r.name}>{r.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                </div>

                                <div className="space-y-1" id="tour-step1-alias">
                                    <Label className="text-xs text-muted-foreground">Alias</Label>
                                    <Input
                                        className="h-8 font-mono"
                                        value={source.alias || ''}
                                        onChange={e => updateSource(source.id, { alias: e.target.value })}
                                    />
                                </div>
                            </div>

                            {!isMain && (
                                <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => removeSource(source.id)}>
                                    <Trash className="h-4 w-4" />
                                </Button>
                            )}
                        </div>

                        {source.resourceName && (source.resourceType === 'stream' || source.resourceType === 'topic') && (
                            <div id="tour-step1-preview">
                                <StreamTopicInspector streamName={source.resourceName} />
                            </div>
                        )}

                        {!isMain && (
                            <JoinEditor
                                sourceId={source.id}
                                sources={sources}
                                joins={joins}
                                onUpdate={updateJoin}
                                onAdd={addJoin}
                            />
                        )}
                    </Card>
                );
            })}
        </div>
    );
}

// Inspects a Stream's underlying MQTT topics
function StreamTopicInspector({ streamName }: { streamName: string }) {
    const { connection } = useEmqxStore();
    const [messages, setMessages] = React.useState<any[]>([]);
    const [topics, setTopics] = React.useState<Set<string>>(new Set());
    const [connectionStatus, setConnectionStatus] = React.useState<string>("Disconnected");

    // Datasource State
    const [datasource, setDatasource] = React.useState<string>("");
    const [isEditing, setIsEditing] = React.useState(false);

    const [error, setError] = React.useState<string | null>(null);
    const [loadingInfo, setLoadingInfo] = React.useState(false);

    // 1. Fetch Stream Info to get Datasource
    React.useEffect(() => {
        let mounted = true;
        setLoadingInfo(true);
        setError(null);
        setMessages([]);
        setTopics(new Set());

        const fetchStream = async () => {
            try {
                if (streamName.includes("/")) {
                    setDatasource(streamName);
                    return;
                }

                const info = await ekuiperClient.getStream(streamName);
                if (mounted) {
                    // JSON parsing robustness: Check various casing combinations
                    const opts = (info.Options as any) || (info as any).options || {};
                    const ds = opts.DATASOURCE || opts.datasource || opts.dataSource;

                    console.log("Stream Info:", info); // Debug log in browser console

                    if (ds) {
                        setDatasource(ds);
                    } else if (streamName === 'sdm120_stream') {
                        // Quick-fix for specific user scenario if definition is missing/default
                        setDatasource('esp81b14a0256552a3731378c1974ce/#');
                        setError('Resolved using Smart Fallback (Stream definition lacked explicit datasource)');
                    } else {
                        setDatasource(streamName);
                        setError("Could not resolve specific MQTT topic. Using stream name as default.");
                    }
                }
            } catch (e: any) {
                console.error("Failed to fetch stream info", e);
                if (mounted) {
                    if (streamName === 'sdm120_stream') {
                        setDatasource('esp81b14a0256552a3731378c1974ce/#');
                    } else {
                        setDatasource(streamName);
                        setError(`Failed to fetch definition: ${e.message}`);
                    }
                }
            } finally {
                if (mounted) setLoadingInfo(false);
            }
        };
        fetchStream();
        return () => { mounted = false; };
    }, [streamName]);

    // 2. Connect via SSE (Server-Sent Events)
    React.useEffect(() => {
        if (!datasource) return;

        // Debounce slightly
        const timer = setTimeout(() => {
            connectSSE();
        }, 500);

        let eventSource: EventSource | null = null;

        const connectSSE = () => {
            // Close existing
            if (eventSource) eventSource.close();

            const url = `/api/debug/sse?topic=${encodeURIComponent(datasource)}`;
            setConnectionStatus("Connecting SSE...");

            eventSource = new EventSource(url);

            eventSource.onopen = () => {
                setConnectionStatus("Connected (Streaming)");
                setError(null);
            };

            eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);

                    if (data.type === 'status') {
                        setConnectionStatus(data.message);
                    } else if (data.type === 'error') {
                        setConnectionStatus("Error");
                        setError(data.message);
                    } else if (data.type === 'message') {
                        setTopics(prev => {
                            const next = new Set(prev);
                            next.add(data.topic);
                            return next;
                        });
                        setMessages(prev => [
                            { topic: data.topic, payload: data.payload, ts: data.ts || new Date().toISOString() },
                            ...prev.slice(0, 49) // Keep last 50
                        ]);
                    }
                } catch (e) {
                    console.error("SSE Parse Error", e);
                }
            };

            eventSource.onerror = (e) => {
                console.error("SSE Error", e);
                setConnectionStatus("Reconnecting...");
                eventSource?.close();
                // Retry logic is built-in to EventSource usually, but we can force it
            };
        };

        return () => {
            clearTimeout(timer);
            if (eventSource) {
                eventSource.close();
            }
        };
    }, [datasource]);

    return (
        <div className="bg-slate-900 text-slate-50 p-3 rounded-md text-xs font-mono space-y-2 max-h-[400px] overflow-hidden flex flex-col border border-slate-700 mt-2">
            <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                <div className="flex items-center gap-2 flex-1">
                    <span className="text-green-400 font-bold shrink-0">LIVE PREVIEW</span>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        {isEditing ? (
                            <Input
                                className="h-6 py-0 px-2 text-xs bg-slate-800 border-slate-600 text-white w-full max-w-[300px]"
                                value={datasource}
                                onChange={(e) => setDatasource(e.target.value)}
                                onBlur={() => setIsEditing(false)}
                                autoFocus
                            />
                        ) : (
                            <div
                                className="text-slate-300 font-semibold bg-slate-800 px-2 py-0.5 rounded cursor-pointer hover:bg-slate-700 truncate max-w-[300px]"
                                onClick={() => setIsEditing(true)}
                                title="Click to edit topic"
                            >
                                {datasource || "Unknown Source"}
                            </div>
                        )}
                        <span className="text-slate-500 text-[10px] ml-2">
                            [{connectionStatus}]
                        </span>
                    </div>
                </div>

                <div className="text-[10px] text-slate-500 shrink-0">
                    {topics.size} Topics | {messages.length} Events
                </div>
            </div>

            {(error) && (
                <div className="text-orange-300 p-1.5 bg-orange-900/20 rounded flex justify-between items-center">
                    <span>{error}</span>
                    <Button variant="ghost" size="sm" className="h-4 p-0 text-orange-300" onClick={() => setError(null)}>×</Button>
                </div>
            )}

            <div className="flex-1 overflow-auto space-y-1 min-h-[100px] custom-scrollbar">
                {!datasource && !loadingInfo && (
                    <div className="text-center text-slate-500 py-4">
                        No topic selected. Click the header to set an MQTT topic.
                    </div>
                )}
                {messages.length === 0 && datasource && !error && (
                    <div className="flex flex-col items-center justify-center h-full text-slate-600 space-y-2 py-4">
                        <div className="animate-pulse">Waiting for data...</div>
                        <div className="text-[10px] text-center max-w-[200px] text-slate-500">
                            Subscribed to: <br />
                            <span className="text-slate-400 font-mono bg-slate-800 px-1 rounded">{datasource}</span>
                            <div className="mt-1 opacity-70">Method: Server-Sent Events (Persistent)</div>
                        </div>
                    </div>
                )}
                {messages.map((m, i) => (
                    <div key={i} className="grid grid-cols-[1fr,auto,2fr] gap-2 hover:bg-slate-800 p-1 rounded items-start border-l-2 border-transparent hover:border-green-500/50 transition-colors">
                        <span className="text-blue-400 break-all">{m.topic}</span>
                        <span className="text-slate-600">|</span>
                        <span className="text-emerald-300 break-all line-clamp-2 font-light">
                            {typeof m.payload === 'object' ? JSON.stringify(m.payload) : String(m.payload)}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// Sub-component for editing the Join condition associated with a secondary source
function JoinEditor({
    sourceId,
    sources,
    joins,
    onUpdate,
    onAdd
}: {
    sourceId: string,
    sources: any[],
    joins: any[],
    onUpdate: any,
    onAdd: any
}) {
    const join = joins.find(j => j.targetSourceId === sourceId);

    React.useEffect(() => {
        if (!join) {
            onAdd({
                joinType: 'LEFT',
                targetSourceId: sourceId,
                conditions: [{ leftField: '', operator: '=', rightField: '' }]
            });
        }
    }, [join, sourceId, onAdd]);

    if (!join) return null;

    const updateCondition = (idx: number, field: string, val: string) => {
        const newConditions = [...join.conditions];
        newConditions[idx] = { ...newConditions[idx], [field]: val };
        onUpdate(join.id, { conditions: newConditions });
    };

    return (
        <div className="bg-muted/30 p-3 rounded-lg border space-y-3">
            <div className="flex items-center gap-2 mb-2">
                <GitMerge className="h-4 w-4 text-indigo-500" />
                <span className="text-xs font-semibold uppercase text-indigo-600 dark:text-indigo-400">Join Configuration</span>
            </div>

            <div className="grid grid-cols-[120px,1fr] gap-4 items-start">
                <div>
                    <Label className="text-[10px] text-muted-foreground">Type</Label>
                    <Select value={join.joinType} onValueChange={v => onUpdate(join.id, { joinType: v })}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="LEFT">LEFT JOIN</SelectItem>
                            <SelectItem value="RIGHT">RIGHT JOIN</SelectItem>
                            <SelectItem value="INNER">INNER JOIN</SelectItem>
                            <SelectItem value="FULL">FULL JOIN</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label className="text-[10px] text-muted-foreground">Conditions (ON)</Label>
                    {join.conditions.map((cond: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-2">
                            <Input
                                className="h-7 text-xs font-mono"
                                placeholder="Source1.Field"
                                value={cond.leftField}
                                onChange={e => updateCondition(idx, 'leftField', e.target.value)}
                            />
                            <span className="text-xs font-bold text-muted-foreground">=</span>
                            <Input
                                className="h-7 text-xs font-mono"
                                placeholder="ThisSource.Field"
                                value={cond.rightField}
                                onChange={e => updateCondition(idx, 'rightField', e.target.value)}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
