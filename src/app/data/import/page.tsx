"use client";

import * as React from "react";
import { useServerStore } from "@/stores/server-store";
import { ekuiperClient } from "@/lib/ekuiper/client";
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
import {
    UploadCloud,
    FileJson,
    AlertTriangle,
    Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function DataImportPage() {
    const { servers, activeServerId } = useServerStore();
    const activeServer = servers.find((s) => s.id === activeServerId);

    const [uploading, setUploading] = React.useState(false);
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
        ekuiperClient.setBaseUrl(activeServer.url);

        const formData = new FormData();
        // key is 'data' usually for /data/import? or 'file'?
        // eKuiper docs: POST /data/import -> usually file content in body or file upload. 
        // If client uses FormData, usually field name is 'file' or 'data'.
        // client.ts assumes standard FormData behavior. I'll use 'file'.
        formData.append("file", file); // Standard convention

        try {
            if (activeTab === "data") {
                await ekuiperClient.importData(formData, { stop: optionStop, partial: optionPartial });
                toast.success("System data restored successfully");
            } else {
                await ekuiperClient.importRuleset(formData);
                toast.success("Ruleset imported successfully");
            }
        } catch (err) {
            toast.error(`Import failed: ${err instanceof Error ? err.message : "Structure mismatch or server error"}`);
        } finally {
            setUploading(false);
        }
    };

    if (!activeServer) {
        return (
            <AppLayout title="Data Import">
                <EmptyState
                    title="No Server Connected"
                    description="Connect to an eKuiper server to import data."
                />
            </AppLayout>
        );
    }

    return (
        <AppLayout title="Data Import">
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Data Import</h2>
                    <p className="text-muted-foreground">Restore backup or import configuration files.</p>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                    <TabsList>
                        <TabsTrigger value="data">System Restore</TabsTrigger>
                        <TabsTrigger value="ruleset">Import Ruleset</TabsTrigger>
                    </TabsList>

                    <TabsContent value="data" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>System Data Restore</CardTitle>
                                <CardDescription>
                                    Import a full system backup. This action may overwrite existing configurations.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div
                                    className={cn(
                                        "border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center transition-colors cursor-pointer bg-muted/20",
                                        isDragging ? "border-primary bg-primary/10" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30",
                                        uploading && "opacity-50 cursor-not-allowed"
                                    )}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    onClick={() => !uploading && fileInputRef.current?.click()}
                                >
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        className="hidden"
                                        accept=".json"
                                        onChange={handleFileSelect}
                                        disabled={uploading}
                                    />
                                    {uploading ? (
                                        <div className="flex flex-col items-center">
                                            <Loader2 className="h-10 w-10 animate-spin text-primary mb-2" />
                                            <p className="text-sm font-medium">Restoring system...</p>
                                        </div>
                                    ) : (
                                        <>
                                            <UploadCloud className="h-10 w-10 text-muted-foreground mb-4" />
                                            <h3 className="font-semibold text-lg">Click or drag backup file</h3>
                                            <p className="text-sm text-muted-foreground">Accepts .json files</p>
                                        </>
                                    )}
                                </div>

                                <div className="space-y-3 pt-4 border-t">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox id="stop" checked={optionStop} onCheckedChange={(c) => setOptionStop(!!c)} />
                                        <Label htmlFor="stop">Stop all running rules before import (Recommended)</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox id="partial" checked={optionPartial} onCheckedChange={(c) => setOptionPartial(!!c)} />
                                        <Label htmlFor="partial">Partial Import (Skip overlapping items)</Label>
                                    </div>
                                </div>

                                {(!optionPartial && activeTab === "data") && (
                                    <div className="flex items-center gap-2 p-3 bg-yellow-500/10 text-yellow-500 rounded-md text-sm border border-yellow-500/20">
                                        <AlertTriangle className="h-4 w-4" />
                                        Warning: This will overwrite existing configurations unless Partial Import is selected.
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="ruleset">
                        <Card>
                            <CardHeader>
                                <CardTitle>Import Ruleset</CardTitle>
                                <CardDescription>Import specific rules and dependencies from a ruleset file.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div
                                    className={cn(
                                        "border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center transition-colors cursor-pointer bg-muted/20",
                                        isDragging ? "border-primary bg-primary/10" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30",
                                        uploading && "opacity-50 cursor-not-allowed"
                                    )}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    onClick={() => !uploading && fileInputRef.current?.click()}
                                >
                                    {uploading ? (
                                        <div className="flex flex-col items-center">
                                            <Loader2 className="h-10 w-10 animate-spin text-primary mb-2" />
                                            <p className="text-sm font-medium">Importing ruleset...</p>
                                        </div>
                                    ) : (
                                        <>
                                            <FileJson className="h-10 w-10 text-muted-foreground mb-4" />
                                            <h3 className="font-semibold text-lg">Click or drag ruleset file</h3>
                                            <p className="text-sm text-muted-foreground">Accepts .json files</p>
                                        </>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </AppLayout>
    );
}
