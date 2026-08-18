"use client";

import * as React from "react";
import { useServerStore } from "@/stores/server-store";
import { ekuiperClient } from "@/lib/ekuiper/client";
import { AppLayout } from "@/components/layout";
import { EmptyState, LoadingSpinner } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CodeEditor } from "@/components/ui/code-editor";
import {
    ArrowLeft,
    Loader2,
    Plus,
    File,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

function CreateSchemaContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialType = searchParams.get("type") === "custom" ? "custom" : "protobuf";

    const { servers, activeServerId } = useServerStore();
    const activeServer = servers.find((s) => s.id === activeServerId);

    const [type, setType] = React.useState<"protobuf" | "custom">(initialType);
    const [name, setName] = React.useState("");
    const [content, setContent] = React.useState("");
    const [saving, setSaving] = React.useState(false);

    const handleSave = async () => {
        if (!activeServer) return;

        if (!name.trim()) {
            toast.error("Schema name is required");
            return;
        }

        if (!content.trim()) {
            toast.error("Schema content is required");
            return;
        }

        setSaving(true);
        try {
            await ekuiperClient.createSchema(type, name, content);
            toast.success(`Schema "${name}" created successfully`);
            router.push("/schemas");
        } catch (err) {
            toast.error(`Failed to create schema: ${err instanceof Error ? err.message : "Unknown error"}`);
        } finally {
            setSaving(false);
        }
    };

    if (!activeServer) {
        return (
            <AppLayout title="Create Schema">
                <EmptyState
                    title="No Server Connected"
                    description="Connect to an eKuiper server to manage schemas."
                />
            </AppLayout>
        );
    }

    return (
        <AppLayout title="Create Schema">
            <div className="flex flex-col h-[calc(100vh-140px)] gap-6">
                {/* Header */}
                <div className="flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => router.push("/schemas")}
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div>
                            <h2 className="text-2xl font-bold tracking-tight">Create Schema</h2>
                            <p className="text-muted-foreground">
                                Define a new data schema
                            </p>
                        </div>
                    </div>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <Plus className="mr-2 h-4 w-4" />
                        Create
                    </Button>
                </div>

                {/* Editor Layout */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 h-full min-h-0">
                    {/* Sidebar / Config */}
                    <Card className="h-fit">
                        <CardHeader>
                            <CardTitle>Configuration</CardTitle>
                            <CardDescription>Schema metadata</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="type">Schema Type</Label>
                                <Select value={type} onValueChange={(v) => { setType(v as "protobuf" | "custom"); setContent(""); }}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="protobuf">Protobuf</SelectItem>
                                        <SelectItem value="custom">Custom</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="name">Schema Name</Label>
                                <Input
                                    id="name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="my_schema"
                                />
                            </div>

                        </CardContent>
                    </Card>

                    {/* Editor Area */}
                    <div className="md:col-span-3 h-full flex flex-col min-h-0">
                        {type === "custom" ? (
                            <div className="flex-1 border rounded-lg p-6 bg-card flex flex-col gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="schema-file-uri">Shared-library URI</Label>
                                    <Input
                                        id="schema-file-uri"
                                        value={content}
                                        onChange={(e) => setContent(e.target.value)}
                                        placeholder="file:///path/to/schema.file"
                                    />
                                    <p className="text-sm text-muted-foreground">
                                        Enter the absolute path of the shared-library schema file on the eKuiper server.
                                        This must be a URI the selected eKuiper node can access.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 text-muted-foreground bg-muted/20 p-4 rounded-md">
                                    <File className="h-5 w-5" />
                                    <span className="text-sm">Custom schemas require a shared-library file accessible by eKuiper.</span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 border rounded-lg overflow-hidden bg-[#1e1e1e]">
                                <CodeEditor
                                    value={content}
                                    onChange={setContent}
                                    language={type === "protobuf" ? "proto" : "json"}
                                />
                            </div>
                        )}

                        <p className="text-xs text-muted-foreground mt-2">
                            {type === "custom" ? "Specify the file location." : "Define your schema structure here."}
                        </p>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

export default function CreateSchemaPage() {
    return (
        <React.Suspense fallback={<LoadingSpinner />}>
            <CreateSchemaContent />
        </React.Suspense>
    );
}
