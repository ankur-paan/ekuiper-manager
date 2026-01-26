
"use client";

import * as React from "react";
import { useQueryWizardStore } from "@/stores/wizard-store";
import { SinkConfig } from "@/lib/wizard/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ArrowRightCircle, Plus, Trash2, Save, MoreHorizontal } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

export function Step4Sink() {
    const { sinks, addSink, removeSink, updateSink, ruleId, setRuleId, sharedConfigs, setSharedConfigs } = useQueryWizardStore();

    // Manage expanded state for each sink card? Or just always expand.
    // Let's use simple list.

    // Fetch shared configs and connections on mount
    React.useEffect(() => {
        const fetchAll = async () => {
            try {
                // 1. Fetch Source-style configs (confKey)
                const resConfigs = await fetch('/api/ekuiper/metadata/sources/yaml/mqtt');
                if (resConfigs.ok) setSharedConfigs('mqtt', await resConfigs.json());

                // 2. Fetch Named Connections (connectionSelector)
                const resConn = await fetch('/api/ekuiper/connections');
                if (resConn.ok) {
                    const conns = await resConn.json();
                    const mqttConns = conns.filter((c: any) => c.typ === 'mqtt');
                    // Store connection IDs as virtual "configs" with a prefix
                    const connMap = mqttConns.reduce((acc: any, c: any) => {
                        acc[`conn:${c.id}`] = { server: c.props?.server, isConnection: true };
                        return acc;
                    }, {});
                    setSharedConfigs('mqtt', { ...sharedConfigs.mqtt, ...connMap });
                }
            } catch (err) {
                console.error("Failed to fetch connectivity info:", err);
            }
        };
        fetchAll();
    }, []);

    // Initial Sink if empty
    React.useEffect(() => {
        if (sinks.length === 0) {
            addSink({ targetType: 'mqtt', properties: {} });
        }
    }, [sinks.length, addSink]);

    const handleUpdateType = (id: string, type: SinkConfig["targetType"]) => {
        updateSink(id, { targetType: type, properties: {} });
    };

    const handleUpdateProp = (id: string, key: string, value: any) => {
        const current = sinks.find(s => s.id === id);
        if (!current) return;
        updateSink(id, {
            properties: { ...current.properties, [key]: value }
        });
    };

    const handleToggleShared = (id: string, val: boolean) => {
        const current = sinks.find(s => s.id === id);
        if (!current) return;

        if (val) {
            // Default select best option
            const best = Object.keys(sharedConfigs.mqtt).find(k => k.includes('emqx_cloud_auth')) || 'default';
            handleSharedSelection(id, best);
        } else {
            const { confKey, connectionSelector, ...rest } = current.properties;
            updateSink(id, { properties: { topic: rest.topic } });
        }
    };

    const handleSharedSelection = (id: string, key: string) => {
        const current = sinks.find(s => s.id === id);
        if (!current) return;

        const { connectionSelector, confKey, ...rest } = current.properties;
        let newProperties: Record<string, any> = { ...rest };

        // Force Unique Client ID based on Rule Name if possible
        if (ruleId) {
            newProperties.clientid = `${ruleId}_${id.substring(0, 4)}`; // Suffix to be safe
        }

        if (key.startsWith('conn:')) {
            newProperties.connectionSelector = key.replace('conn:', '');
            delete newProperties.confKey;
        } else {
            newProperties.confKey = key;
            delete newProperties.connectionSelector;
        }
        updateSink(id, { properties: newProperties });
    };

    const getActiveSharedValue = (sink: SinkConfig) => {
        return sink.properties.connectionSelector ? `conn:${sink.properties.connectionSelector}` : (sink.properties.confKey || '');
    };

    const isSharedEnabled = (sink: SinkConfig) => {
        return !!(sink.properties.confKey || sink.properties.connectionSelector);
    };

    return (
        <div className="space-y-8">
            {/* Rule Identity Section (Global) */}
            <div className="grid gap-4">
                <div className="flex flex-col gap-1">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Rule Identity</Label>
                    <div className="flex gap-2">
                        <Input
                            placeholder="e.g., pump_monitor_rule"
                            value={ruleId}
                            onChange={e => setRuleId(e.target.value)}
                            className="font-mono bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                        />
                        {!ruleId && (
                            <Button variant="outline" size="sm" onClick={() => setRuleId(`rule_${Math.floor(Math.random() * 10000)}`)}>
                                Generate ID
                            </Button>
                        )}
                    </div>
                    <p className="text-[10px] text-muted-foreground italic px-1">Unique identifier for this rule.</p>
                </div>
            </div>

            <Separator />

            {/* Sinks List */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Output Destinations</Label>
                    <Button size="sm" variant="outline" onClick={() => addSink({ targetType: 'mqtt', properties: {} })}>
                        <Plus className="h-4 w-4 mr-2" /> Add Destination
                    </Button>
                </div>

                <div className="grid gap-6">
                    {sinks.map((sink, index) => {
                        const useShared = isSharedEnabled(sink);
                        const activeValue = getActiveSharedValue(sink);

                        return (
                            <Card key={sink.id} className="border-emerald-500/20 bg-emerald-50/5 dark:bg-emerald-900/10 backdrop-blur-sm relative group">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute top-2 right-2 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500 hover:bg-red-50"
                                    onClick={() => removeSink(sink.id)}
                                // Prevent removing the last one if you want at least one? Or allow empty?
                                // Allowing empty is weird for wizard. Let's rely on validation in submission.
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>

                                <CardHeader className="p-4 flex flex-row items-center gap-4 space-y-0">
                                    <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 font-bold font-mono text-xs">
                                        {index + 1}
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <div className="flex items-center gap-2">
                                            <Select value={sink.targetType} onValueChange={(v: any) => handleUpdateType(sink.id, v)}>
                                                <SelectTrigger className="w-[200px] h-9 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                                                    <SelectValue placeholder="Select Type" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="mqtt">MQTT Broker</SelectItem>
                                                    <SelectItem value="rest">REST API</SelectItem>
                                                    <SelectItem value="log">Log (Debug)</SelectItem>
                                                    <SelectItem value="nop">No Op</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
                                                {sink.targetType === 'mqtt' ? 'Industrial Bus' :
                                                    sink.targetType === 'rest' ? 'Webhook' :
                                                        sink.targetType === 'log' ? 'System Log' : 'Discard'}
                                            </Badge>
                                        </div>
                                    </div>
                                </CardHeader>

                                <CardContent className="p-4 pt-1 space-y-6">
                                    {sink.targetType === 'mqtt' && (
                                        <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
                                            <div className="flex items-center space-x-3 bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
                                                <Checkbox
                                                    id={`use-shared-${sink.id}`}
                                                    checked={useShared}
                                                    onCheckedChange={(checked) => handleToggleShared(sink.id, !!checked)}
                                                    className="h-4 w-4 data-[state=checked]:bg-emerald-500"
                                                />
                                                <Label htmlFor={`use-shared-${sink.id}`} className="text-xs font-semibold cursor-pointer">Re-use Dashboard Connection</Label>
                                            </div>

                                            {useShared ? (
                                                <div className="space-y-2">
                                                    <Select value={activeValue} onValueChange={(v) => handleSharedSelection(sink.id, v)}>
                                                        <SelectTrigger className="bg-white dark:bg-slate-950 border-slate-200 text-xs h-9">
                                                            <SelectValue placeholder="Select shared config..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {Object.entries(sharedConfigs.mqtt).map(([key, config]: [string, any]) => (
                                                                <SelectItem key={key} value={key} className="text-xs">
                                                                    {config.isConnection ? `Named Conn: ${key.replace('conn:', '')}` : (key === 'default' ? 'Global Default' : `Source Config: ${key}`)}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            ) : (
                                                <div className="grid gap-3 p-3 rounded-xl border border-dashed border-slate-200">
                                                    <div className="space-y-2">
                                                        <Label className="text-xs">Broker Address (TCP)</Label>
                                                        <Input
                                                            className="h-8 text-xs bg-white dark:bg-slate-950"
                                                            value={sink.properties.server || ''}
                                                            onChange={e => handleUpdateProp(sink.id, 'server', e.target.value)}
                                                            placeholder="tcp://broker:1883"
                                                        />
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="space-y-2">
                                                            <Label className="text-xs">Username</Label>
                                                            <Input
                                                                className="h-8 text-xs bg-white dark:bg-slate-950"
                                                                value={sink.properties.username || ''}
                                                                onChange={e => handleUpdateProp(sink.id, 'username', e.target.value)}
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="text-xs">Password</Label>
                                                            <Input
                                                                className="h-8 text-xs bg-white dark:bg-slate-950"
                                                                type="password"
                                                                value={sink.properties.password || ''}
                                                                onChange={e => handleUpdateProp(sink.id, 'password', e.target.value)}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="space-y-2">
                                                <Label className="text-xs">Output Topic</Label>
                                                <Input
                                                    placeholder="e.g., alerts/pump_overheat"
                                                    value={sink.properties.topic || ''}
                                                    onChange={e => handleUpdateProp(sink.id, 'topic', e.target.value)}
                                                    className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 font-mono text-xs h-9"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {sink.targetType === 'rest' && (
                                        <div className="grid gap-4 animate-in fade-in slide-in-from-top-2">
                                            <div className="space-y-2">
                                                <Label className="text-xs">API Endpoint URL</Label>
                                                <Input
                                                    placeholder="https://api.dashboard.com/v1/ingest"
                                                    value={sink.properties.url || ''}
                                                    onChange={e => handleUpdateProp(sink.id, 'url', e.target.value)}
                                                    className="bg-white text-xs h-9"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs">HTTP Method</Label>
                                                <Select value={sink.properties.method || 'POST'} onValueChange={v => handleUpdateProp(sink.id, 'method', v)}>
                                                    <SelectTrigger className="bg-white text-xs h-9"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="POST">POST</SelectItem>
                                                        <SelectItem value="PUT">PUT</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    )}

                                    {(sink.targetType === 'log' || sink.targetType === 'nop') && (
                                        <div className="text-xs text-muted-foreground p-3 bg-white dark:bg-slate-950 rounded-lg border italic">
                                            {sink.targetType === 'log' ? 'Results will be written to server logs.' : 'Results will be discarded (No Operation).'}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
