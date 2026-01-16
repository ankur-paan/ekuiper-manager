"use client";

import * as React from "react";
import { useServerStore } from "@/stores/server-store";
import { ekuiperClient } from "@/lib/ekuiper/client";
import { AppLayout } from "@/components/layout";
import { EmptyState, LoadingSpinner } from "@/components/common";
import { Button } from "@/components/ui/button";
import { CodeEditor } from "@/components/ui/code-editor";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    ArrowLeft,
    Save,
    Loader2,
    FileCode,
    File,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Schema } from "@/lib/ekuiper/types";

export default function SchemaDetailPage({ params }: { params: { type: string; name: string } }) {
    const router = useRouter();
    const { type, name: encodedName } = params;
    const name = decodeURIComponent(encodedName);

    const { servers, activeServerId } = useServerStore();
    const activeServer = servers.find((s) => s.id === activeServerId);

    const [schema, setSchema] = React.useState<Schema | null>(null);
    const [content, setContent] = React.useState(""); // For text editors
    const [fileUrl, setFileUrl] = React.useState("");   // For custom schema

    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);

    const fetchData = React.useCallback(async () => {
        if (!activeServer) return;
        setLoading(true);
        ekuiperClient.setBaseUrl(activeServer.url);

        try {
            const data = await ekuiperClient.getSchema(type, name);
            setSchema(data);
            if (type === "custom") {
                setFileUrl(data.file || data.content || "");
            } else {
                setContent(data.content || "");
            }
        } catch (err) {
            toast.error(`Failed to fetch schema: ${err instanceof Error ? err.message : "Unknown error"}`);
        } finally {
            setLoading(false);
        }
    }, [activeServer, type, name]);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSave = async () => {
        if (!activeServer) return;
        setSaving(true);
        try {
            // Decide what to save
            const valueToSave = type === "custom" ? fileUrl : content;
            await ekuiperClient.updateSchema(type, name, valueToSave);
            toast.success("Schema updated successfully");
            fetchData();
        } catch (err) {
            toast.error(`Failed to update: ${err instanceof Error ? err.message : "Unknown error"}`);
        } finally {
            setSaving(false);
        }
    };

    if (!activeServer) {
        return (
            <AppLayout title={`Schema: ${name}`}>
                <EmptyState
                    title="No Server Connected"
                    description="Connect to an eKuiper server."
                />
            </AppLayout>
        );
    }

    if (loading) {
        return (
            <AppLayout title={`Schema: ${name}`}>
                <div className="h-full flex items-center justify-center">
                    <LoadingSpinner />
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout title={`Schema: ${name}`}>
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
                            <h2 className="text-2xl font-bold tracking-tight">{name}</h2>
                            <div className="flex items-center gap-2 text-muted-foreground text-sm">
                                <FileCode className="h-4 w-4" />
                                <span className="capitalize">{type} Schema</span>
                            </div>
                        </div>
                    </div>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                    </Button>
                </div>

                {/* Content */}
                <div className="flex-1 flex flex-col min-h-0 bg-card border rounded-lg overflow-hidden">
                    {type === "custom" ? (
                        <div className="p-6 space-y-4">
                            <div className="space-y-2">
                                <Label>File URL</Label>
                                <Input
                                    value={fileUrl}
                                    onChange={(e) => setFileUrl(e.target.value)}
                                    placeholder="file:///path/to/file"
                                />
                                <p className="text-sm text-muted-foreground">
                                    Location of the binary file on the server.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <CodeEditor
                            value={content}
                            onChange={setContent}
                            language={type === "protobuf" ? "proto" : "json"}
                        />
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
