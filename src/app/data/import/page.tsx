"use client";

import * as React from "react";
import { useServerStore } from "@/stores/server-store";
import { ekuiperClient } from "@/lib/ekuiper/client";
import { ImportStatus } from "@/lib/ekuiper/types";
import { AppLayout } from "@/components/layout";
import { EmptyState, LoadingSpinner } from "@/components/common";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
    UploadCloud,
    FileJson,
    AlertTriangle,
    Loader2,
    CheckCircle2,
    XCircle
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function DataImportPage() {
    const { servers, activeServerId } = useServerStore();
    const activeServer = servers.find((s) => s.id === activeServerId);

    const [uploading, setUploading] = React.useState(false);
    const [importStatus, setImportStatus] = React.useState<ImportStatus | null>(null);
    const [optionStop, setOptionStop] = React.useState(false);
    const [optionPartial, setOptionPartial] = React.useState(false);

    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = React.useState(false);
    const [activeTab, setActiveTab] = React.useState("data");

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) await processImport(file);
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) await processImport(file);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const processImport = async (file: File) => {
        if (!activeServer) return;

        // Basic validation
        if (!file.name.endsWith(".json")) {
            toast.error("Please upload a JSON file");
            return;
        }

        setUploading(true);
        setImportStatus({ status: "running", message: "Starting upload...", progress: 0 });
        ekuiperClient.setBaseUrl(activeServer.url);

        const pollInterval = setInterval(async () => {
            try {
                const status = await ekuiperClient.getImportStatus();
                setImportStatus(status);
            } catch { /* ignore poll errors */ }
        }, 1000);

        try {
            const fileContent = await file.text();

            // Validate JSON
            try {
                JSON.parse(fileContent);
            } catch (parseErr) {
                clearInterval(pollInterval);
                toast.error("Invalid JSON file");
                setUploading(false);
                setImportStatus(null);
                return;
            }

            if (activeTab === "data") {
                await ekuiperClient.importData(fileContent, { stop: optionStop, partial: optionPartial });
                toast.success("System data restored successfully");
            } else {
                await ekuiperClient.importRuleset(fileContent);
                toast.success("Ruleset imported successfully");
            }
        } catch (err: any) {
            const errorMsg = err?.message || err?.error || "Structure mismatch or server error";
            console.error("Import error details:", err);
            toast.error(`Import failed: ${errorMsg}`);
            setImportStatus({ status: "failed", message: errorMsg, errors: [errorMsg] });
        } finally {
            clearInterval(pollInterval);
            setUploading(false);
            // Keep status visible for a moment if desired, but we reset for now or keep it if failed
            if (activeTab === "data") {
                // Try one last fetch to see final state
                const final = await ekuiperClient.getImportStatus().catch(() => null);
                if (final) setImportStatus(final);
            }
        }
    };

    if (!activeServer) {
        return (
            <AppLayout title="Data Import">
                <EmptyState title="No Server Connected" description="Connect to an eKuiper server to import data." />
            </AppLayout>
        );
    }

    return (
        <AppLayout title="Data Import">
            <div className="max-w-3xl mx-auto space-y-6">
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold">Import Data</h1>
                    <p className="text-muted-foreground">Restore system data or import rulesets from JSON files.</p>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="data">System Data (Backup)</TabsTrigger>
                        <TabsTrigger value="rules">Ruleset Only</TabsTrigger>
                    </TabsList>

                    <Card className="mt-6 border-dashed border-2">
                        <CardContent className="pt-6">
                            {uploading ? (
                                <div className="flex flex-col items-center justify-center py-10 space-y-4">
                                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                                    <div className="space-y-2 text-center w-full max-w-md">
                                        <h3 className="font-semibold text-lg">Importing...</h3>
                                        <p className="text-sm text-muted-foreground">{importStatus?.message || "Processing..."}</p>
                                        {importStatus && (
                                            <Progress value={(importStatus.progress || 0) * 100} className="w-full h-2" />
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div
                                    className={cn(
                                        "flex flex-col items-center justify-center py-12 text-center cursor-pointer rounded-lg transition-colors hover:bg-muted/50",
                                        isDragging && "bg-primary/10 border-primary"
                                    )}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <div className="p-4 rounded-full bg-primary/10 mb-4">
                                        {activeTab === 'data' ? <UploadCloud className="h-8 w-8 text-primary" /> : <FileJson className="h-8 w-8 text-primary" />}
                                    </div>
                                    <h3 className="text-lg font-semibold mb-1">
                                        Drag & drop {activeTab === 'data' ? 'backup' : 'ruleset'} file
                                    </h3>
                                    <p className="text-muted-foreground text-sm mb-4">
                                        or click to browse from your computer
                                    </p>
                                    <p className="text-xs text-muted-foreground/70">
                                        Accepts .json files
                                    </p>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".json"
                                        className="hidden"
                                        onChange={handleFileSelect}
                                    />
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <TabsContent value="data" className="mt-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Import Options</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center space-x-2">
                                    <Checkbox id="stop" checked={optionStop} onCheckedChange={(c) => setOptionStop(!!c)} />
                                    <Label htmlFor="stop" className="cursor-pointer">Stop eKuiper before import</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox id="partial" checked={optionPartial} onCheckedChange={(c) => setOptionPartial(!!c)} />
                                    <Label htmlFor="partial" className="cursor-pointer">Partial import (skip existing items)</Label>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="rules" className="mt-4">
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg flex items-start gap-3 text-sm text-blue-700 dark:text-blue-300">
                            <AlertTriangle className="h-5 w-5 shrink-0" />
                            <p>Ruleset import expects a specific JSON structure containing only rules. This is useful for migrating logic between instances.</p>
                        </div>
                    </TabsContent>
                </Tabs>

                {importStatus?.errors && importStatus.errors.length > 0 && (
                    <Card className="border-destructive/50 bg-destructive/10">
                        <CardHeader>
                            <CardTitle className="text-destructive flex items-center gap-2">
                                <XCircle className="h-5 w-5" /> Import Errors
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ul className="list-disc list-inside text-sm text-destructive font-medium">
                                {importStatus.errors.map((err, i) => <li key={i}>{err}</li>)}
                            </ul>
                        </CardContent>
                    </Card>
                )}
            </div>
        </AppLayout>
    );
}
