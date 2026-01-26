"use client";

import * as React from "react";
import { useQueryWizardStore } from "@/stores/wizard-store";
import { FilterConfig, FilterExpression } from "@/lib/wizard/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Plus, X, Filter, RotateCcw, Info } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { motion } from "framer-motion";
import { Separator } from "@/components/ui/separator";

export function Step2Filter() {
    const { filters, addFilter, removeFilter, updateFilter, sources, sourceSchemas, setTourFocus } = useQueryWizardStore();
    const streamName = sources[0]?.resourceName;
    const schema = sourceSchemas[streamName] || {};
    const schemaFields = Object.keys(schema);

    const [datasource, setDatasource] = React.useState<string>("");

    // Discovery State
    const [discovery, setDiscovery] = React.useState<{
        topics: Set<string>;
        fields: Set<string>;
        values: Map<string, any>;
    }>({ topics: new Set(), fields: new Set(), values: new Map() });

    const [topicSearch, setTopicSearch] = React.useState("");

    // Buffer for high-frequency updates
    const bufferRef = React.useRef<{ topic: string, payload: any }[]>([]);

    const [focusedInput, setFocusedInputLocal] = React.useState<{ filterId: string, index: number, field: 'field' | 'value' } | null>(null);

    const setFocusedInput = (focus: { filterId: string, index: number, field: 'field' | 'value' } | null) => {
        setFocusedInputLocal(focus);
        if (focus) {
            setTourFocus(`step2-${focus.field}-${focus.index}`);
        } else {
            setTourFocus(null);
        }
    };

    // 1. Resolve Datasource
    React.useEffect(() => {
        if (!streamName) return;
        if (streamName === 'sdm120_stream') {
            setDatasource('esp81b14a0256552a3731378c1974ce/#');
        } else {
            setDatasource(streamName);
        }
    }, [streamName]);

    // 2. SSE Data Collection
    React.useEffect(() => {
        if (!datasource) return;
        const url = `/api/debug/sse?topic=${encodeURIComponent(datasource)}`;
        const evt = new EventSource(url);
        evt.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data);
                if (data.type === 'message') bufferRef.current.push({ topic: data.topic, payload: data.payload });
            } catch { }
        };
        const timer = setInterval(() => {
            if (bufferRef.current.length === 0) return;
            const batch = [...bufferRef.current];
            bufferRef.current = [];
            setDiscovery(prev => {
                const nextTopics = new Set(prev.topics);
                const nextFields = new Set(prev.fields);
                const nextValues = new Map(prev.values);
                batch.forEach(item => {
                    nextTopics.add(item.topic);
                    nextValues.set(item.topic, item.payload);
                    nextValues.set('meta(topic)', item.topic);
                    if (item.payload && typeof item.payload === 'object') {
                        Object.keys(item.payload).forEach(k => {
                            nextFields.add(k);
                            nextValues.set(k, item.payload[k]);
                        });
                    }
                });
                return { topics: nextTopics, fields: nextFields, values: nextValues };
            });
        }, 500);
        return () => { evt.close(); clearInterval(timer); };
    }, [datasource]);

    const handleAddFilterGroup = () => {
        addFilter({
            logic: "AND",
            expressions: [{ id: uuidv4(), field: "", operator: "=", value: "" }]
        } as any);
    };

    const updateExpression = (filterId: string, exprIndex: number, field: keyof FilterExpression, value: string) => {
        const group = filters.find(f => f.id === filterId);
        if (!group) return;
        const newExprs = [...group.expressions];
        newExprs[exprIndex] = { ...newExprs[exprIndex], [field]: value || "" };
        updateFilter(filterId, { expressions: newExprs });
    };

    // 3. Auto-lock fields to 'payload' if device is already filtered
    React.useEffect(() => {
        filters.forEach(group => {
            group.expressions.forEach((expr, i) => {
                const isDeviceAlreadyLocked = group.expressions.slice(0, i).some(e => e.field === 'meta(topic)');
                if (isDeviceAlreadyLocked && expr.field !== 'payload') {
                    updateExpression(group.id, i, 'field', 'payload');
                }
            });
        });
    }, [filters, updateExpression]);

    const addExpressionToGroup = (filterId: string) => {
        const group = filters.find(f => f.id === filterId);
        if (!group) return;
        updateFilter(filterId, {
            expressions: [...group.expressions, { id: uuidv4(), field: "", operator: "=", value: "" }]
        });
    };

    const removeExpressionFromGroup = (filterId: string, exprIndex: number) => {
        const group = filters.find(f => f.id === filterId);
        if (!group) return;
        if (group.expressions.length === 1) {
            removeFilter(filterId);
        } else {
            const newExprs = group.expressions.filter((_, i) => i !== exprIndex);
            updateFilter(filterId, { expressions: newExprs });
        }
    };

    const formatValue = (val: any) => {
        if (val === undefined || val === null) return '...';
        if (typeof val === 'object') return JSON.stringify(val);
        return String(val);
    };

    const injectValue = (val: string, fieldType: 'telemetry' | 'device' = 'telemetry') => {
        if (!focusedInput) return;
        if (fieldType === 'device') {
            const group = filters.find(f => f.id === focusedInput.filterId);
            if (group) {
                const newExprs = [...group.expressions];
                newExprs[focusedInput.index] = { ...newExprs[focusedInput.index], field: 'meta(topic)', value: val };
                updateFilter(focusedInput.filterId, { expressions: newExprs });
            }
            return;
        }
        updateExpression(focusedInput.filterId, focusedInput.index, focusedInput.field, val);
    };

    const FRIENDLY_OPS = [
        { label: "is", value: "=" },
        { label: "is not", value: "!=" },
        { label: "is more than", value: ">" },
        { label: "is less than", value: "<" },
        { label: "contains", value: "LIKE" },
    ];

    const filteredTopics = Array.from(discovery.topics)
        .filter(t => !topicSearch || t.toLowerCase().includes(topicSearch.toLowerCase()))
        .reverse();

    return (
        <div className="grid grid-cols-[1fr,300px] gap-8 items-start h-full pb-20">
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <h3 className="text-xl font-semibold flex items-center gap-2">
                            <Filter className="h-5 w-5 text-orange-500" />
                            Rule Conditions
                        </h3>
                        <p className="text-xs text-muted-foreground">Define when this rule should trigger.</p>
                    </div>
                    <Button size="sm" variant="outline" className="gap-2 border-orange-500/20 hover:bg-orange-500/5" onClick={handleAddFilterGroup}>
                        <Plus className="h-4 w-4" /> Add Group
                    </Button>
                </div>

                {filters.length === 0 ? (
                    <div className="flex flex-col items-center justify-center space-y-4 p-10 py-16 border-2 border-dashed rounded-2xl bg-slate-50/50 dark:bg-slate-950/50 h-[350px]">
                        <div className="p-4 rounded-full bg-orange-500/10 text-orange-600 animate-pulse">
                            <Filter className="h-8 w-8" />
                        </div>
                        <div className="text-center space-y-1">
                            <h3 className="text-lg font-semibold">No Conditions Set</h3>
                            <p className="text-sm text-muted-foreground max-w-xs">The rule will run for every single message. Add a condition to specify a device or value.</p>
                        </div>
                        <Button id="tour-step2-add-first-condition" onClick={handleAddFilterGroup} className="mt-4 gap-2 bg-orange-600 hover:bg-orange-700">
                            <Plus className="h-4 w-4" /> Add My First Condition
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {filters.map((group, groupIndex) => (
                            <div key={group.id} className="relative">
                                {groupIndex > 0 && (
                                    <div className="absolute -top-4 left-10 z-10 px-3 py-0.5 bg-background border rounded-full text-[10px] font-bold shadow-sm uppercase tracking-wider text-muted-foreground">
                                        {group.logic}
                                    </div>
                                )}

                                <Card id="tour-step2-condition-row" className="border-l-4 border-l-orange-500 shadow-sm overflow-hidden bg-background/50 backdrop-blur-sm">
                                    <CardContent className="p-6 space-y-4">
                                        {group.expressions.map((expr, i) => (
                                            <div key={expr.id || i} className="relative space-y-4">
                                                {i > 0 && (
                                                    <div className="absolute -top-8 left-5 w-px h-8 bg-slate-200 dark:bg-slate-800" />
                                                )}

                                                <div className="flex items-center gap-3">
                                                    <div className={`flex-none w-10 h-10 rounded-full flex items-center justify-center text-[10px] font-bold ${i === 0 ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-400 border'}`}>
                                                        {i === 0 ? 'IF' : 'AND'}
                                                    </div>

                                                    <div className="flex-1 grid grid-cols-[1.5fr,1fr,1.5fr] gap-3 items-center">
                                                        <div className="relative">
                                                            {(() => {
                                                                const isDeviceAlreadyLocked = group.expressions.slice(0, i).some(e => e.field === 'meta(topic)');
                                                                if (isDeviceAlreadyLocked) {
                                                                    return (
                                                                        <div className="h-10 px-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20 flex items-center gap-2">
                                                                            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest italic">The Message Value</span>
                                                                        </div>
                                                                    );
                                                                }
                                                                return (
                                                                    <Select
                                                                        value={expr.field === 'meta(topic)' ? 'meta(topic)' : (expr.field === 'payload' ? 'payload' : (discovery.fields.has(expr.field) ? expr.field : "")) || ""}
                                                                        onValueChange={(v) => updateExpression(group.id, i, 'field', v)}
                                                                    >
                                                                        <SelectTrigger className={`h-10 text-sm ${expr.field === 'meta(topic)' ? 'font-bold text-blue-600 bg-blue-50/50' : ''}`}>
                                                                            <SelectValue placeholder="Identify device..." />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            {expr.field === 'meta(topic)' ? (
                                                                                <SelectItem value="meta(topic)" className="font-bold text-blue-600">
                                                                                    1. Pick Source Topic (Identity)
                                                                                </SelectItem>
                                                                            ) : (
                                                                                <SelectItem value="meta(topic)" className="text-blue-600">
                                                                                    1. Pick Source Topic (Identity)
                                                                                </SelectItem>
                                                                            )}
                                                                            <Separator className="my-1" />
                                                                            <SelectItem value="payload" className="font-bold">
                                                                                2. Check the raw Value (Direct)
                                                                            </SelectItem>

                                                                            {schemaFields.length > 0 && (
                                                                                <>
                                                                                    <Separator className="my-1" />
                                                                                    <Label className="px-2 py-1 text-[10px] font-bold opacity-50 uppercase">Known Fields (Schema)</Label>
                                                                                    {schemaFields.sort().map(f => (
                                                                                        <SelectItem key={`schema-${f}`} value={f}>{f}</SelectItem>
                                                                                    ))}
                                                                                </>
                                                                            )}

                                                                            {Array.from(discovery.fields).filter(f => !schemaFields.includes(f)).length > 0 && (
                                                                                <>
                                                                                    <Separator className="my-1" />
                                                                                    <Label className="px-2 py-1 text-[10px] font-bold opacity-50 uppercase">Discovered Fields (Live)</Label>
                                                                                    {Array.from(discovery.fields).filter(f => !schemaFields.includes(f)).sort().map(f => (
                                                                                        <SelectItem key={`live-${f}`} value={f}>{f}</SelectItem>
                                                                                    ))}
                                                                                </>
                                                                            )}
                                                                        </SelectContent>
                                                                    </Select>
                                                                );
                                                            })()}
                                                        </div>

                                                        <Select value={expr.operator} onValueChange={v => updateExpression(group.id, i, 'operator', v)}>
                                                            <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                {FRIENDLY_OPS.map(op => <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>

                                                        <div className="relative">
                                                            {expr.field === 'meta(topic)' ? (
                                                                <Select value={expr.value} onValueChange={v => updateExpression(group.id, i, 'value', v)}>
                                                                    <SelectTrigger className="h-10 text-xs font-mono bg-blue-500/5 border-blue-200"><SelectValue placeholder="Select device..." /></SelectTrigger>
                                                                    <SelectContent>
                                                                        {Array.from(discovery.topics).sort().map(topic => (
                                                                            <SelectItem key={topic} value={topic} className="text-[10px] font-mono">{topic}</SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            ) : (
                                                                <div className="flex gap-2">
                                                                    <Input
                                                                        placeholder="Value..."
                                                                        className="h-10 text-sm flex-1"
                                                                        value={expr.value}
                                                                        onChange={e => updateExpression(group.id, i, 'value', e.target.value)}
                                                                    />
                                                                    <Select value={expr.castType || "auto"} onValueChange={v => updateExpression(group.id, i, 'castType', v)}>
                                                                        <SelectTrigger className="w-[80px] h-10 text-xs">
                                                                            <SelectValue placeholder="Auto" />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem value="auto">Auto</SelectItem>
                                                                            <SelectItem value="number">Num</SelectItem>
                                                                            <SelectItem value="string">Text</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive" onClick={() => removeExpressionFromGroup(group.id, i)}>
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </div>

                                                {/* Smart Guidance for locked devices */}
                                                {expr.field === 'meta(topic)' && i === 0 && group.expressions.length === 1 && (
                                                    <div className="ml-14 space-y-3">
                                                        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="bg-blue-600/5 border border-blue-600/10 rounded-xl p-3 flex flex-col gap-3">
                                                            <div className="flex items-center gap-2">
                                                                <div className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded">QUICK ACTION</div>
                                                                <span className="text-[11px] text-blue-800 font-bold uppercase tracking-tight">Add a value check for this device:</span>
                                                            </div>
                                                            <div className="flex flex-wrap gap-2">
                                                                {Array.from(discovery.fields).slice(0, 3).map(f => {
                                                                    const val = discovery.values.get(f);
                                                                    const isNumeric = !isNaN(Number(val));
                                                                    return (
                                                                        <Button key={f} variant="outline" size="sm" className="h-8 text-xs bg-white border-blue-100 hover:border-blue-300" onClick={() => {
                                                                            updateFilter(group.id, { expressions: [...group.expressions, { id: uuidv4(), field: "payload", operator: "=", value: String(val), castType: isNumeric ? 'number' : 'string' }] });
                                                                        }}>
                                                                            <Plus className="h-3 w-3 mr-1" /> Is value {formatValue(val)}?
                                                                        </Button>
                                                                    );
                                                                })}
                                                                <Button variant="outline" size="sm" className="h-8 text-xs bg-white border-dashed" onClick={() => addExpressionToGroup(group.id)}>
                                                                    <Plus className="h-3 w-3 mr-1" /> Add Custom Check
                                                                </Button>
                                                            </div>
                                                        </motion.div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </CardContent>
                                </Card>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="sticky top-0 bg-slate-50/50 dark:bg-slate-900/50 p-6 rounded-2xl border min-h-[500px] border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2 mb-6">
                    <Info className="h-4 w-4 text-primary" />
                    <h4 className="text-sm font-bold uppercase tracking-widest text-slate-500">Live Feed</h4>
                </div>
                <div className="space-y-4 max-h-[700px] overflow-y-auto pr-2 custom-scrollbar">
                    {filteredTopics.map(topic => (
                        <div key={topic} className="group relative bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-primary/50 transition-all cursor-pointer shadow-sm" onClick={() => {
                            // Inject into first empty expression
                            const emptyIdx = filters[0]?.expressions.findIndex(e => e.field === "");
                            if (emptyIdx !== -1) injectValue(topic, 'device');
                        }}>
                            <div className="flex justify-between items-start mb-2">
                                <Badge variant="outline" className="text-[10px] font-mono py-0 px-1 bg-slate-50">{topic.split('/').slice(-1)[0]}</Badge>
                                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono truncate mb-2">{topic}</div>
                            <div className="text-xs font-bold text-primary truncate">{formatValue(discovery.values.get(topic))}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
