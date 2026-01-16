"use client";

import * as React from "react";
import { useServerStore } from "@/stores/server-store";
import { ekuiperClient } from "@/lib/ekuiper/client";
import { AppLayout } from "@/components/layout";
import { EmptyState, LoadingSpinner } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Loader2,
    Download,
    Archive,
    CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { RuleListItem } from "@/lib/ekuiper/types";

export default function DataExportPage() {
    const { servers, activeServerId } = useServerStore();
    const activeServer = servers.find((s) => s.id === activeServerId);

    const [loading, setLoading] = React.useState(false);
    const [exportingFull, setExportingFull] = React.useState(false);
    const [exportingPartial, setExportingPartial] = React.useState(false);

    const [rules, setRules] = React.useState<RuleListItem[]>([]);
    const [selectedRules, setSelectedRules] = React.useState<string[]>([]);

    const fetchRules = React.useCallback(async () => {
        if (!activeServer) return;
        setLoading(true);
        ekuiperClient.setBaseUrl(activeServer.url);
        try {
            const list = await ekuiperClient.listRules();
            setRules(list);
        } catch (err) {
            toast.error("Failed to fetch rules for selection");
        } finally {
            setLoading(false);
        }
    }, [activeServer]);

    React.useEffect(() => {
        if (activeServer) fetchRules();
    }, [fetchRules, activeServer]);

    const handleFullExport = async () => {
        if (!activeServer) return;
        setExportingFull(true);
        ekuiperClient.setBaseUrl(activeServer.url);
        try {
            const blob = await ekuiperClient.exportData();
            downloadBlob(blob, `ekuiper-data-${new Date().toISOString().slice(0, 10)}.json`);
            toast.success("Full export completed");
        } catch (err) {
            toast.error(`Export failed: ${err instanceof Error ? err.message : "Error"}`);
        } finally {
            setExportingFull(false);
        }
    };

    const handlePartialExport = async () => {
        if (!activeServer) return;
        if (selectedRules.length === 0) {
            toast.error("Select at least one rule");
            return;
        }
        setExportingPartial(true);
        ekuiperClient.setBaseUrl(activeServer.url);
        try {
            const blob = await ekuiperClient.exportRuleset(selectedRules);
            downloadBlob(blob, `ekuiper-ruleset-${new Date().toISOString().slice(0, 10)}.json`);
            toast.success("Ruleset export completed");
        } catch (err) {
            toast.error(`Export failed: ${err instanceof Error ? err.message : "Error"}`);
        } finally {
            setExportingPartial(false);
        }
    };

    const downloadBlob = (blob: Blob, filename: string) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };

    const toggleRule = (id: string) => {
        setSelectedRules(prev =>
            prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
        );
    };

    const toggleAll = () => {
        if (selectedRules.length === rules.length) {
            setSelectedRules([]);
        } else {
            setSelectedRules(rules.map(r => r.id));
        }
    };

    if (!activeServer) {
        return (
            <AppLayout title="Data Export">
                <EmptyState
                    title="No Server Connected"
                    description="Connect to an eKuiper server to export data."
                />
            </AppLayout>
        );
    }

    return (
        <AppLayout title="Data Export">
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Data Export</h2>
                    <p className="text-muted-foreground">Backup your configuration or export specific rulesets.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Full Export */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Archive className="h-5 w-5" />
                                Full System Backup
                            </CardTitle>
                            <CardDescription>
                                Export all streams, tables, rules, plugins, and settings into a single file.
                                Use this for disaster recovery or migration.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="h-32 flex items-center justify-center bg-muted/20 rounded-md border border-dashed">
                                <div className="text-center text-sm text-muted-foreground">
                                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500/50" />
                                    Includes all configuration
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button className="w-full" onClick={handleFullExport} disabled={exportingFull}>
                                {exportingFull && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                <Download className="mr-2 h-4 w-4" />
                                Download Full Backup
                            </Button>
                        </CardFooter>
                    </Card>

                    {/* Partial Export */}
                    <Card className="flex flex-col">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <CheckCircle2 className="h-5 w-5" />
                                Selective Ruleset Export
                            </CardTitle>
                            <CardDescription>
                                Export specific rules along with their dependent streams and tables.
                                Useful for sharing specific logic.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 min-h-0 flex flex-col">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium">{selectedRules.length} selected</span>
                                <Button variant="ghost" size="sm" onClick={toggleAll} className="h-8 text-xs">
                                    {selectedRules.length === rules.length ? "Deselect All" : "Select All"}
                                </Button>
                            </div>
                            {loading ? (
                                <div className="h-32 flex items-center justify-center"><LoadingSpinner /></div>
                            ) : (
                                <div className="border rounded-md flex-1 min-h-[12rem] bg-card">
                                    <ScrollArea className="h-48">
                                        <div className="p-4 space-y-2">
                                            {rules.length === 0 && <div className="text-sm text-muted-foreground text-center">No rules found</div>}
                                            {rules.map(rule => (
                                                <div key={rule.id} className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id={`rule-${rule.id}`}
                                                        checked={selectedRules.includes(rule.id)}
                                                        onCheckedChange={() => toggleRule(rule.id)}
                                                    />
                                                    <label
                                                        htmlFor={`rule-${rule.id}`}
                                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                                    >
                                                        {rule.id}
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                </div>
                            )}
                        </CardContent>
                        <CardFooter>
                            <Button className="w-full" variant="outline" onClick={handlePartialExport} disabled={exportingPartial || selectedRules.length === 0}>
                                {exportingPartial && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                <Download className="mr-2 h-4 w-4" />
                                Export Ruleset
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            </div>
        </AppLayout>
    );
}
