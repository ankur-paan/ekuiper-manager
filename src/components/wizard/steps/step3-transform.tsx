
"use client";

import * as React from "react";
import { useQueryWizardStore } from "@/stores/wizard-store";
import { SelectionConfig } from "@/lib/wizard/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, X, Wand2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export function Step3Transform() {
    const { selections, aggregation, setSelections, updateAggregation, sources, sourceSchemas } = useQueryWizardStore();
    const streamName = sources[0]?.resourceName;
    const schema = sourceSchemas[streamName] || {};
    const schemaFields = Object.keys(schema);

    const [datasource, setDatasource] = React.useState<string>("");
    const [topicSearch, setTopicSearch] = React.useState("");
    const [focusedInput, setFocusedInput] = React.useState<{ type: 'selection' | 'groupby', index: number, field: 'field' | 'alias' | 'value' } | null>(null);

    // Discovery State (Static sets for autocomplete)
    const [discovery, setDiscovery] = React.useState<{
        topics: Set<string>;
        fields: Set<string>;
    }>({ topics: new Set(), fields: new Set() });

    // Snapshot Mode (Stable preview to prevent "Haywire" flickering)
    const [sampleData, setSampleData] = React.useState<{ topic: string, payload: any } | null>(null);
    const [isLiveMode, setIsLiveMode] = React.useState(true);

    const bufferRef = React.useRef<{ topic: string, payload: any }[]>([]);

    // -------------------------------------------------------------------------
    // 1. Resolve Datasource
    // -------------------------------------------------------------------------
    React.useEffect(() => {
        if (!streamName) return;
        if (streamName === 'sdm120_stream') {
            setDatasource('esp81b14a0256552a3731378c1974ce/#');
        } else {
            setDatasource(streamName);
        }
    }, [streamName]);

    // -------------------------------------------------------------------------
    // 2. Data Collection (SSE)
    // -------------------------------------------------------------------------
    React.useEffect(() => {
        if (!datasource) return;

        const url = `/api/debug/sse?topic=${encodeURIComponent(datasource)}`;
        const evt = new EventSource(url);

        evt.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data);
                if (data.type === 'message') {
                    bufferRef.current.push({ topic: data.topic, payload: data.payload });
                }
            } catch { }
        };

        const timer = setInterval(() => {
            if (bufferRef.current.length === 0) return;
            const batch = [...bufferRef.current];
            bufferRef.current = [];

            setDiscovery(prev => {
                const nextTopics = new Set(prev.topics);
                const nextFields = new Set(prev.fields);

                batch.forEach(item => {
                    nextTopics.add(item.topic);
                    if (item.payload && typeof item.payload === 'object') {
                        Object.keys(item.payload).forEach(k => nextFields.add(k));
                    }
                });
                return { topics: nextTopics, fields: nextFields };
            });

            // Stabilize Preview: Update sample only in Live Mode
            if (isLiveMode && batch.length > 0) {
                setSampleData(batch[batch.length - 1]);
            }
        }, 500);

        return () => {
            evt.close();
            clearInterval(timer);
        };
    }, [datasource, isLiveMode]);

    const injectValue = (val: string) => {
        if (!focusedInput) return;

        // Auto-freeze for stability
        setIsLiveMode(false);

        // Compiler handles technicalities now.
        if (focusedInput.type === 'selection') {
            updateSelection(focusedInput.index, focusedInput.field as any, val);
        } else if (focusedInput.type === 'groupby') {
            updateGroupBy(focusedInput.index, val);
        }
    };

    const isSelectAll = selections.length === 0;

    const toggleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelections([]);
        } else {
            // Pick the first discovered field as a starting point if available
            const firstField = Array.from(discovery.fields)[0] || "";
            setSelections([{ field: firstField, alias: '' }]);
        }
    };

    const toggleField = (field: string) => {
        const index = selections.findIndex(s => s.field === field);
        if (index >= 0) {
            // Remove
            const newSel = selections.filter((_, i) => i !== index);
            setSelections(newSel);
        } else {
            // Add
            setSelections([...selections, { field, alias: '' }]);
        }
    };

    const updateSelection = (idx: number, field: keyof SelectionConfig, value: string) => {
        const newSel = [...selections];
        if (!newSel[idx]) return;
        newSel[idx] = { ...newSel[idx], [field]: value };
        setSelections(newSel);
    };

    const updateWindow = (key: string, value: any) => {
        updateAggregation({ [key]: value });
    };

    const updateGroupBy = (idx: number, val: string) => {
        const newGroups = [...(aggregation.groupByFields || [])];
        newGroups[idx] = val;
        updateAggregation({ groupByFields: newGroups });
    };

    const getSampleValue = (field: string) => {
        if (!sampleData) return undefined;
        if (field === 'meta(topic)' || field === 'Device ID') return sampleData.topic;
        const cleanField = field.startsWith('`') && field.endsWith('`') ? field.slice(1, -1) : field;
        if (sampleData.payload && typeof sampleData.payload === 'object') {
            return (sampleData.payload as any)[cleanField];
        }
        return undefined;
    };

    const formatValue = (val: any) => {
        if (val === undefined || val === null) return '...';
        if (typeof val === 'object') return JSON.stringify(val);
        return String(val);
    };

    const filteredTopics = Array.from(discovery.topics)
        .reverse();

    return (
        <div className="grid grid-cols-[1fr,300px] gap-8 items-start h-full">
            <div className="space-y-8">
                {/* Outbound Selection Section */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <h3 className="text-xl font-semibold flex items-center gap-2">
                                <Wand2 className="h-5 w-5 text-emerald-500" />
                                Outbound Data
                            </h3>
                            <p className="text-xs text-muted-foreground">Select what information you want to include in the result.</p>
                        </div>
                        <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-full border" id="tour-step3-keep-all-toggle">
                            <Switch id="select-all" checked={isSelectAll} onCheckedChange={toggleSelectAll} />
                            <Label htmlFor="select-all" className="text-xs font-bold uppercase tracking-tight">Keep Everything</Label>
                        </div>
                    </div>

                    {!isSelectAll && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Discovered Fields as Toggles */}
                            <Card className="col-span-1" id="tour-step3-available-fields">
                                <CardContent className="p-4 space-y-4">
                                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Available Fields</Label>
                                    <div className="flex flex-wrap gap-2">
                                        {schemaFields.map(field => {
                                            const isActive = selections.some(s => s.field === field);
                                            return (
                                                <Badge
                                                    key={`schema-${field}`}
                                                    variant={isActive ? "default" : "outline"}
                                                    className={`cursor-pointer h-8 px-3 transition-all ${isActive ? 'bg-emerald-600 hover:bg-emerald-700' : 'hover:bg-slate-100'}`}
                                                    onClick={() => toggleField(field)}
                                                >
                                                    <span className="opacity-50 mr-1">S </span> {field}
                                                    {isActive && <X className="ml-2 h-3 w-3" />}
                                                </Badge>
                                            );
                                        })}

                                        {Array.from(discovery.fields).filter(f => !schemaFields.includes(f)).map(field => {
                                            const isActive = selections.some(s => s.field === field);
                                            return (
                                                <Badge
                                                    key={`live-${field}`}
                                                    variant={isActive ? "default" : "outline"}
                                                    className={`cursor-pointer h-8 px-3 transition-all ${isActive ? 'bg-emerald-600 hover:bg-emerald-700' : 'hover:bg-slate-100'}`}
                                                    onClick={() => toggleField(field)}
                                                >
                                                    <span className="opacity-50 mr-1">L </span> {field}
                                                    {isActive && <X className="ml-2 h-3 w-3" />}
                                                </Badge>
                                            );
                                        })}
                                        {schemaFields.length === 0 && discovery.fields.size === 0 && <span className="text-xs text-muted-foreground italic">Waiting for telemetry...</span>}
                                    </div>
                                    <Separator className="my-2" />
                                    <Badge
                                        variant={selections.some(s => s.field === 'meta(topic)') ? "default" : "outline"}
                                        className="cursor-pointer h-8 border-blue-500/30 text-blue-500"
                                        onClick={() => toggleField('meta(topic)')}
                                    >
                                        Origin Device ID
                                    </Badge>
                                </CardContent>
                            </Card>

                            {/* Active Selection Details (Renaming) */}
                            <Card className="col-span-1 bg-slate-50/50 dark:bg-slate-950/50 border-dashed">
                                <CardContent className="p-4 space-y-4">
                                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Active Data (Rename if needed)</Label>
                                    <div className="space-y-2">
                                        {selections.map((sel, i) => (
                                            <div key={sel.field} className="flex items-center gap-2 group">
                                                <div className="flex-1 bg-background border rounded px-2 py-1.5 text-xs font-medium truncate">
                                                    {sel.field === 'meta(topic)' ? 'Device ID' : sel.field}
                                                </div>
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Input
                                                        placeholder="New Name..."
                                                        className="h-7 text-[10px] w-24"
                                                        value={sel.alias || ''}
                                                        onChange={e => updateSelection(i, 'alias', e.target.value)}
                                                    />
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => toggleField(sel.field)}>
                                                        <X className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                        {selections.length === 0 && <span className="text-xs text-muted-foreground block text-center py-4 italic">Select data from the left</span>}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </div>

                <Separator />

                {/* Aggregation Section */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <h3 className="text-xl font-semibold flex items-center gap-2">
                                <Plus className="h-5 w-5 text-pink-500" />
                                Summaries & Averages
                            </h3>
                            <p className="text-xs text-muted-foreground">Automatically calculate statistics over a period of time.</p>
                        </div>
                        <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-full border" id="tour-step3-summaries-toggle">
                            <Switch checked={aggregation.enabled} onCheckedChange={v => updateAggregation({ enabled: v })} />
                            <Label className="text-xs font-bold uppercase tracking-tight">Enable Summaries</Label>
                        </div>
                    </div>

                    {aggregation.enabled && (
                        <Card className="border-pink-500/20 bg-pink-50/[0.02]">
                            <CardContent className="p-6 space-y-8">
                                <div className="flex flex-wrap items-center gap-3 text-sm font-medium text-slate-600">
                                    <span>Calculate statistics every</span>
                                    <Input
                                        type="number"
                                        className="h-10 w-20 text-center font-bold"
                                        value={aggregation.windowLength || ''}
                                        onChange={e => updateWindow('windowLength', parseInt(e.target.value))}
                                    />
                                    <Select value={aggregation.windowUnit || 's'} onValueChange={v => updateWindow('windowUnit', v)}>
                                        <SelectTrigger className="h-10 w-28"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="s">Seconds</SelectItem>
                                            <SelectItem value="m">Minutes</SelectItem>
                                            <SelectItem value="h">Hours</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <span>and group them by</span>
                                    <Badge variant="outline" className="h-8 border-pink-500/30 text-pink-600">Device ID</Badge>
                                </div>

                                <div className="space-y-3 pt-6 border-t border-dashed border-pink-500/20">
                                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Advanced: Group by additional data</Label>
                                    <div className="flex flex-wrap gap-2">
                                        {(aggregation.groupByFields || []).map((grp, i) => (
                                            <Badge key={i} className="h-8 bg-slate-200 text-slate-700 hover:bg-slate-300 gap-1 pr-1">
                                                {grp}
                                                <X className="h-3 w-3 cursor-pointer" onClick={() => {
                                                    const next = (aggregation.groupByFields || []).filter((_, idx) => idx !== i);
                                                    updateAggregation({ groupByFields: next });
                                                }} />
                                            </Badge>
                                        ))}
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 border-dashed text-[10px] uppercase font-bold"
                                            onClick={() => updateAggregation({ groupByFields: [...(aggregation.groupByFields || []), ""] })}
                                        >
                                            <Plus className="h-3 w-3 mr-1" /> Add Group
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            {/* Live Data Explorer Sidebar */}
            <div className="bg-slate-900 rounded-2xl p-4 border border-slate-700 h-[700px] flex flex-col shadow-2xl overflow-hidden relative">
                <div className="flex flex-col gap-4 mb-6">
                    <div className="flex items-center justify-between">
                        <h4 className="font-bold text-slate-100 uppercase tracking-tighter">Live Insight</h4>
                        <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700">
                            <Button
                                variant={isLiveMode ? "secondary" : "ghost"}
                                className="h-6 px-2 text-[10px] rounded"
                                onClick={() => setIsLiveMode(true)}
                            >
                                Live
                            </Button>
                            <Button
                                variant={!isLiveMode ? "secondary" : "ghost"}
                                className="h-6 px-2 text-[10px] rounded"
                                onClick={() => setIsLiveMode(false)}
                            >
                                Frozen
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="flex-1 flex flex-col min-h-0 space-y-6">
                    <div className="space-y-2">
                        <h5 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest pl-1">Data Stream</h5>
                        <div className="overflow-auto space-y-2 custom-scrollbar pr-1">
                            {Array.from(discovery.fields).sort().map(field => {
                                const val = getSampleValue(field);
                                const isSelected = selections.some(s => s.field === field);
                                return (
                                    <div
                                        key={field}
                                        className={`group p-3 rounded-xl transition-all cursor-pointer border ${isSelected ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-800/30 border-slate-700/50 hover:bg-slate-800'}`}
                                        onClick={() => toggleField(field)}
                                    >
                                        <div className="flex justify-between items-center mb-1">
                                            <span className={`text-xs font-bold ${isSelected ? 'text-emerald-400' : 'text-slate-300'}`}>{field}</span>
                                            {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,1)]" />}
                                        </div>
                                        <div className="flex justify-between items-center text-[10px]">
                                            <span className="text-slate-500 font-mono tracking-tighter">{formatValue(val)}</span>
                                            <span className="text-slate-600 font-black uppercase opacity-0 group-hover:opacity-100 transition-opacity">
                                                {isSelected ? 'Remove' : 'Keep'}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Topic Selection */}
                    <div className="space-y-2 pt-4 border-t border-slate-800">
                        <h5 className="text-[10px] font-black text-blue-400 uppercase tracking-widest pl-1">Origin Identification</h5>
                        <div className="overflow-auto space-y-1 custom-scrollbar max-h-[200px]">
                            {filteredTopics.map(topic => (
                                <div
                                    key={topic}
                                    className={`p-2 px-3 rounded-lg text-[10px] font-medium transition-all cursor-pointer border ${sampleData?.topic === topic ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'text-slate-500 border-transparent hover:bg-slate-800/30'}`}
                                    onClick={() => {
                                        setIsLiveMode(false);
                                        setSampleData({ topic, payload: sampleData?.topic === topic ? sampleData.payload : '...' });
                                    }}
                                >
                                    {topic}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-800 text-[10px] text-slate-500 leading-snug">
                    💡 <b>Live Insight</b> lets you pick a specific device to see what data it sends before you decide to keep it.
                </div>
            </div>
        </div>
    );
}

function Badge({ children, variant, className, onClick }: any) {
    const variants: any = {
        default: "bg-primary text-primary-foreground hover:bg-primary/80 border-transparent",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 border-transparent",
        outline: "text-foreground border-border hover:bg-accent hover:text-accent-foreground",
    };
    return (
        <span
            onClick={onClick}
            className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${variants[variant || "default"]} ${className}`}
        >
            {children}
        </span>
    );
}
