"use client";

import * as React from "react";
import { useServerStore } from "@/stores/server-store";
import { ekuiperClient } from "@/lib/ekuiper/client";
import { AppLayout } from "@/components/layout";
import { EmptyState, LoadingSpinner } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    ArrowLeft,
    Loader2,
    Save,
    Code2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CodeEditor } from "@/components/ui/code-editor";

interface PageProps {
    params: {
        id: string;
    };
}

const DEFAULT_SCRIPT = `/**
 * Custom JavaScript UDF
 * @param {any[]} args - The arguments passed to the function
 * @returns {any} - The result of the function
 */
function main(...args) {
    if (args.length === 0) return null;
    return args[0];
}
`;

export default function JSUDFEditorPage({ params }: PageProps) {
    const router = useRouter();
    const { servers, activeServerId } = useServerStore();
    const activeServer = servers.find((s) => s.id === activeServerId);

    const isNew = params.id === "new";
    const [funcId, setFuncId] = React.useState("");
    const [script, setScript] = React.useState(DEFAULT_SCRIPT);
    const [isAgg, setIsAgg] = React.useState(false);

    const [loading, setLoading] = React.useState(!isNew);
    const [saving, setSaving] = React.useState(false);

    React.useEffect(() => {
        const fetchFunction = async () => {
            if (!activeServer || isNew) return;

            const id = decodeURIComponent(params.id);
            setFuncId(id);
            setLoading(true);
            ekuiperClient.setBaseUrl(activeServer.url);

            try {
                const data = await ekuiperClient.getJSUDF(id);
                // If API returns plain text, wrap it (defensive coding)
                if (typeof data === 'string') {
                    setScript(data);
                    setIsAgg(false); // Default if metadata missing
                } else {
                    setScript(data.script || "");
                    setIsAgg(!!data.isAgg);
                }
            } catch (err) {
                toast.error(`Failed to load function: ${err instanceof Error ? err.message : "Unknown error"}`);
            } finally {
                setLoading(false);
            }
        };

        fetchFunction();
    }, [activeServer, isNew, params.id]);

    const handleSave = async () => {
        if (!activeServer) return;

        if (!funcId.trim()) {
            toast.error("Function ID is required");
            return;
        }

        if (!script.trim()) {
            toast.error("Script content is required");
            return;
        }

        setSaving(true);
        ekuiperClient.setBaseUrl(activeServer.url);

        try {
            const payload = {
                id: funcId,
                script,
                isAgg
            };

            if (isNew) {
                await ekuiperClient.createJSUDF(payload);
                toast.success(`Function "${funcId}" created successfully`);
                router.push("/functions");
            } else {
                await ekuiperClient.updateJSUDF(payload);
                toast.success(`Function "${funcId}" updated successfully`);
            }
        } catch (err) {
            toast.error(`Failed to save function: ${err instanceof Error ? err.message : "Unknown error"}`);
        } finally {
            setSaving(false);
        }
    };

    if (!activeServer) {
        return (
            <AppLayout title={isNew ? "Create Function" : "Edit Function"}>
                <EmptyState
                    title="No Server Connected"
                    description="Connect to an eKuiper server to manage functions."
                />
            </AppLayout>
        );
    }

    if (loading) {
        return <LoadingSpinner />;
    }

    return (
        <AppLayout title={isNew ? "Create Function" : "Edit Function"}>
            <div className="flex flex-col h-[calc(100vh-140px)] gap-6">
                {/* Header */}
                <div className="flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => router.push("/functions")}
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div className="flex items-center gap-3">
                            <Code2 className="h-6 w-6 text-yellow-500" />
                            <div>
                                <h2 className="text-2xl font-bold tracking-tight">
                                    {isNew ? "Create JavaScript UDF" : funcId}
                                </h2>
                                <p className="text-muted-foreground">
                                    {isNew ? "Define a new custom function using JavaScript" : "Edit function logic"}
                                </p>
                            </div>
                        </div>
                    </div>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <Save className="mr-2 h-4 w-4" />
                        Save Function
                    </Button>
                </div>

                {/* Editor Layout */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 h-full min-h-0">
                    {/* Sidebar / Config */}
                    <Card className="h-fit">
                        <CardHeader>
                            <CardTitle>Configuration</CardTitle>
                            <CardDescription>Function metadata</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="funcId">Function ID</Label>
                                <Input
                                    id="funcId"
                                    value={funcId}
                                    onChange={(e) => setFuncId(e.target.value)}
                                    disabled={!isNew}
                                    placeholder="myCustomFunc"
                                />
                                {!isNew && <p className="text-xs text-muted-foreground">ID cannot be changed after creation</p>}
                            </div>

                            <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                                <div className="space-y-0.5">
                                    <Label htmlFor="isAgg">Aggregate Function</Label>
                                    <p className="text-xs text-muted-foreground">
                                        Enable if this function performs aggregation
                                    </p>
                                </div>
                                <Switch
                                    id="isAgg"
                                    checked={isAgg}
                                    onCheckedChange={setIsAgg}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Editor Area */}
                    <div className="md:col-span-3 h-full flex flex-col min-h-0">
                        <div className="flex-1 border rounded-lg overflow-hidden bg-[#1e1e1e]">
                            <CodeEditor
                                value={script}
                                onChange={setScript}
                                language="javascript"
                            />
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                            Write your JavaScript logic above. The function must return a value.
                        </p>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
