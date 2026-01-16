"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useServerStore } from "@/stores/server-store";
import { AppLayout } from "@/components/layout";
import { LoadingPage, ErrorState, EmptyState } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import {
    RefreshCw,
    Send,
    Database,
    Info,
    Settings,
    CheckCircle2,
    XCircle,
    Plug,
    Search,
    ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

interface MetadataAbout {
    trial: boolean;
    installed: boolean;
    author?: string;
    helpUrl?: string;
    description?: string;
}

interface MetadataItem {
    name: string;
    about: MetadataAbout;
    type: "internal" | "plugin";
}

interface MetadataProperty {
    name: string;
    default?: any;
    type: string;
    control: string;
    optional: boolean;
    values?: string[];
    hint?: string;
    label?: string;
    connection_related?: boolean;
}

interface MetadataDetail {
    about: MetadataAbout;
    properties: MetadataProperty[];
    type: "internal" | "plugin";
}

export default function MetadataPage() {
    const router = useRouter();
    const { servers, activeServerId } = useServerStore();
    const activeServer = servers.find((s) => s.id === activeServerId);

    const [sinks, setSinks] = React.useState<MetadataItem[]>([]);
    const [sources, setSources] = React.useState<MetadataItem[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [selectedItem, setSelectedItem] = React.useState<{ type: "sink" | "source"; name: string } | null>(null);
    const [selectedDetail, setSelectedDetail] = React.useState<MetadataDetail | null>(null);
    const [detailLoading, setDetailLoading] = React.useState(false);
    const [testConfig, setTestConfig] = React.useState<Record<string, string>>({});
    const [testResult, setTestResult] = React.useState<{ success: boolean; error?: string } | null>(null);
    const [testing, setTesting] = React.useState(false);

    const fetchMetadata = React.useCallback(async () => {
        if (!activeServer) return;

        setLoading(true);
        setError(null);

        try {
            const [sinksRes, sourcesRes] = await Promise.all([
                fetch("/api/ekuiper/metadata/sinks", {
                    headers: { "X-EKuiper-URL": activeServer.url },
                }),
                fetch("/api/ekuiper/metadata/sources", {
                    headers: { "X-EKuiper-URL": activeServer.url },
                }),
            ]);

            if (sinksRes.ok) {
                const sinksData = await sinksRes.json();
                setSinks(Array.isArray(sinksData) ? sinksData : []);
            }

            if (sourcesRes.ok) {
                const sourcesData = await sourcesRes.json();
                setSources(Array.isArray(sourcesData) ? sourcesData : []);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to fetch metadata");
        } finally {
            setLoading(false);
        }
    }, [activeServer]);

    React.useEffect(() => {
        fetchMetadata();
    }, [fetchMetadata]);

    const fetchDetail = async (type: "sink" | "source", name: string) => {
        if (!activeServer) return;

        setDetailLoading(true);
        setSelectedItem({ type, name });
        setSelectedDetail(null);
        setTestConfig({});
        setTestResult(null);

        try {
            const endpoint = type === "sink" ? "sinks" : "sources";
            const response = await fetch(`/api/ekuiper/metadata/${endpoint}/${encodeURIComponent(name)}`, {
                headers: { "X-EKuiper-URL": activeServer.url },
            });

            if (response.ok) {
                const data = await response.json();
                setSelectedDetail(data);

                // Initialize test config with defaults
                const defaults: Record<string, string> = {};
                data.properties?.forEach((prop: MetadataProperty) => {
                    if (prop.default !== undefined && prop.default !== "") {
                        defaults[prop.name] = String(prop.default);
                    }
                });
                setTestConfig(defaults);
            }
        } catch (err) {
            toast.error("Failed to fetch details");
        } finally {
            setDetailLoading(false);
        }
    };

    const handleTestConnection = async () => {
        if (!activeServer || !selectedItem || selectedItem.type !== "sink") return;

        setTesting(true);
        setTestResult(null);

        try {
            const response = await fetch(`/api/ekuiper/metadata/sinks/connection/${encodeURIComponent(selectedItem.name)}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-EKuiper-URL": activeServer.url,
                },
                body: JSON.stringify(testConfig),
            });

            if (response.ok) {
                setTestResult({ success: true });
                toast.success("Connection test successful!");
            } else {
                const errorText = await response.text();
                setTestResult({ success: false, error: errorText || "Connection test failed" });
                toast.error("Connection test failed");
            }
        } catch (err) {
            setTestResult({ success: false, error: err instanceof Error ? err.message : "Connection test failed" });
            toast.error("Connection test failed");
        } finally {
            setTesting(false);
        }
    };

    const renderMetadataCard = (item: MetadataItem, type: "sink" | "source") => (
        <Card
            key={item.name}
            className="cursor-pointer hover:border-primary/50 transition-all"
            onClick={() => fetchDetail(type, item.name)}
        >
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        {type === "sink" ? (
                            <Send className="h-4 w-4 text-green-500" />
                        ) : (
                            <Database className="h-4 w-4 text-blue-500" />
                        )}
                        {item.name}
                    </CardTitle>
                    <div className="flex gap-1">
                        {item.about.installed ? (
                            <Badge variant="default" className="text-xs">Installed</Badge>
                        ) : (
                            <Badge variant="secondary" className="text-xs">Not Installed</Badge>
                        )}
                        {item.about.trial && (
                            <Badge variant="outline" className="text-xs">Trial</Badge>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <p className="text-xs text-muted-foreground">
                    {item.about.description || `${item.type} ${type}`}
                </p>
                <Badge variant="outline" className="mt-2 text-xs">
                    {item.type}
                </Badge>
            </CardContent>
        </Card>
    );

    if (!activeServer) {
        return (
            <AppLayout title="Metadata Browser">
                <EmptyState
                    title="No Server Connected"
                    description="Connect to an eKuiper server to browse metadata."
                />
            </AppLayout>
        );
    }

    if (loading) {
        return (
            <AppLayout title="Metadata Browser">
                <LoadingPage label="Loading metadata..." />
            </AppLayout>
        );
    }

    if (error) {
        return (
            <AppLayout title="Metadata Browser">
                <ErrorState title="Error Loading Metadata" description={error} onRetry={fetchMetadata} />
            </AppLayout>
        );
    }

    return (
        <AppLayout title="Metadata Browser">
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                            <Settings className="h-5 w-5 text-purple-500" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold">Connector Metadata</h1>
                            <p className="text-sm text-muted-foreground">
                                Browse available sources and sinks with their properties
                            </p>
                        </div>
                    </div>
                    <Button variant="outline" size="icon" onClick={fetchMetadata}>
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                </div>

                {/* Tabs */}
                <Tabs defaultValue="sinks">
                    <TabsList>
                        <TabsTrigger value="sinks">
                            <Send className="mr-2 h-4 w-4" />
                            Sinks ({sinks.length})
                        </TabsTrigger>
                        <TabsTrigger value="sources">
                            <Database className="mr-2 h-4 w-4" />
                            Sources ({sources.length})
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="sinks" className="mt-4">
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {sinks.map((sink) => renderMetadataCard(sink, "sink"))}
                        </div>
                    </TabsContent>

                    <TabsContent value="sources" className="mt-4">
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {sources.map((source) => renderMetadataCard(source, "source"))}
                        </div>
                    </TabsContent>
                </Tabs>
            </div>

            {/* Detail Sheet */}
            <Sheet open={!!selectedItem} onOpenChange={(open: boolean) => !open && setSelectedItem(null)}>
                <SheetContent className="w-[500px] sm:max-w-[500px] overflow-y-auto">
                    <SheetHeader>
                        <SheetTitle className="flex items-center gap-2">
                            {selectedItem?.type === "sink" ? (
                                <Send className="h-5 w-5 text-green-500" />
                            ) : (
                                <Database className="h-5 w-5 text-blue-500" />
                            )}
                            {selectedItem?.name}
                        </SheetTitle>
                        <SheetDescription>
                            {selectedItem?.type === "sink" ? "Sink" : "Source"} configuration
                        </SheetDescription>
                    </SheetHeader>

                    {detailLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : selectedDetail ? (
                        <div className="space-y-6 mt-6">
                            {/* Properties */}
                            <div className="space-y-4">
                                <h3 className="font-semibold flex items-center gap-2">
                                    <Settings className="h-4 w-4" />
                                    Properties ({selectedDetail.properties?.length || 0})
                                </h3>

                                {selectedDetail.properties?.map((prop) => (
                                    <div key={prop.name} className="space-y-2 p-3 border rounded-lg">
                                        <div className="flex items-center justify-between">
                                            <Label className="font-medium">{prop.name}</Label>
                                            <div className="flex gap-1">
                                                {prop.optional ? (
                                                    <Badge variant="secondary" className="text-xs">Optional</Badge>
                                                ) : (
                                                    <Badge variant="destructive" className="text-xs">Required</Badge>
                                                )}
                                                {prop.connection_related && (
                                                    <Badge variant="outline" className="text-xs">Connection</Badge>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            Type: {prop.type} | Control: {prop.control}
                                        </div>
                                        {prop.hint && (
                                            <div className="text-xs text-muted-foreground">{prop.hint}</div>
                                        )}
                                        <Input
                                            placeholder={prop.default !== undefined ? String(prop.default) : `Enter ${prop.name}`}
                                            value={testConfig[prop.name] || ""}
                                            onChange={(e) => setTestConfig({ ...testConfig, [prop.name]: e.target.value })}
                                        />
                                        {prop.values && prop.values.length > 0 && (
                                            <div className="text-xs text-muted-foreground">
                                                Options: {prop.values.join(", ")}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Connection Test (Sinks only) */}
                            {selectedItem?.type === "sink" && (
                                <div className="space-y-4 pt-4 border-t">
                                    <h3 className="font-semibold flex items-center gap-2">
                                        <Plug className="h-4 w-4" />
                                        Connection Test
                                    </h3>
                                    <Button
                                        className="w-full"
                                        onClick={handleTestConnection}
                                        disabled={testing}
                                    >
                                        {testing ? (
                                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <Plug className="mr-2 h-4 w-4" />
                                        )}
                                        Test Connection
                                    </Button>

                                    {testResult && (
                                        <div className={`flex items-center gap-2 p-3 rounded-lg ${testResult.success
                                            ? "bg-green-500/10 text-green-600"
                                            : "bg-red-500/10 text-red-600"
                                            }`}>
                                            {testResult.success ? (
                                                <CheckCircle2 className="h-5 w-5" />
                                            ) : (
                                                <XCircle className="h-5 w-5" />
                                            )}
                                            <span className="text-sm">
                                                {testResult.success ? "Connection successful!" : testResult.error}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* About */}
                            {selectedDetail.about.helpUrl && (
                                <div className="pt-4 border-t">
                                    <Button variant="outline" className="w-full" asChild>
                                        <a href={selectedDetail.about.helpUrl} target="_blank" rel="noopener noreferrer">
                                            <ExternalLink className="mr-2 h-4 w-4" />
                                            View Documentation
                                        </a>
                                    </Button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-muted-foreground">
                            Failed to load details
                        </div>
                    )}
                </SheetContent>
            </Sheet>
        </AppLayout>
    );
}
