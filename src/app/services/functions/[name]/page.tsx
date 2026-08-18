"use client";

import * as React from "react";
import { useServerStore } from "@/stores/server-store";
import { AppLayout } from "@/components/layout";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, ErrorState, LoadingPage } from "@/components/common";
import { ArrowLeft, Zap, Server, FileCode } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { ekuiperClient } from "@/lib/ekuiper/client";
import type { ExternalFunction } from "@/lib/ekuiper/types";

export default function FunctionDetailPage() {
    const router = useRouter();
    const params = useParams() as { name: string };
    const name = decodeURIComponent(params.name);
    const { servers, activeServerId } = useServerStore();
    const activeServer = servers.find((s) => s.id === activeServerId);

    const [details, setDetails] = React.useState<ExternalFunction | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    const fetchFunctionDetails = React.useCallback(async () => {
        if (!activeServer) return;

        setLoading(true);
        setError(null);

        try {
            setDetails(await ekuiperClient.getExternalFunction(name));

        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to fetch function details");
        } finally {
            setLoading(false);
        }
    }, [activeServer, name]);

    React.useEffect(() => {
        fetchFunctionDetails();
    }, [fetchFunctionDetails]);

    if (!activeServer) {
        return (
            <AppLayout title={`Function: ${name}`}>
                <ErrorState
                    title="No Server Connected"
                    description="Please connect to an eKuiper server to view function details."
                />
            </AppLayout>
        );
    }

    if (loading) {
        return (
            <AppLayout title={`Function: ${name}`}>
                <LoadingPage label="Finding function details..." />
            </AppLayout>
        );
    }

    if (error || !details) {
        return (
            <AppLayout title={`Function: ${name}`}>
                <div className="space-y-6">
                    <div className="flex items-center gap-4">
                        <Button variant="outline" size="icon" onClick={() => router.back()}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <h2 className="text-3xl font-bold tracking-tight">{name}</h2>
                    </div>
                    <ErrorState
                        title="Function Not Found"
                        description={error || "Could not load this external function."}
                        onRetry={fetchFunctionDetails}
                    />
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout title={`Function: ${name}`}>
            <div className="space-y-6">
                {/* Header Information */}
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                        <div className="flex items-center gap-4">
                            <Button variant="outline" size="icon" onClick={() => router.back()}>
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                            <h2 className="text-3xl font-bold tracking-tight">{name}</h2>
                        </div>
                        <p className="text-muted-foreground ml-12">
                            External service function
                        </p>
                    </div>
                    <StatusBadge status="available" label="Available" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Zap className="h-5 w-5 text-yellow-500" />
                                Function Info
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <span className="text-muted-foreground">Name:</span>
                                <span className="font-medium">{details.name}</span>

                                <span className="text-muted-foreground">Method:</span>
                                <Badge variant="outline">{details.methodName || "Not reported"}</Badge>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Server className="h-5 w-5 text-blue-500" />
                                Service Provider
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <span className="text-muted-foreground">Service:</span>
                                <Button variant="link" className="p-0 h-auto font-medium justify-start" onClick={() => router.push(`/services/${encodeURIComponent(details.serviceName)}`)}>
                                    {details.serviceName}
                                </Button>

                                <span className="text-muted-foreground">Interface:</span>
                                <span className="font-medium">{details.interfaceName}</span>

                                <span className="text-muted-foreground">Address:</span>
                                <span className="font-mono text-xs bg-muted p-1 rounded">{details.address || "Not reported"}</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileCode className="h-5 w-5 text-purple-500" />
                            Usage Example
                        </CardTitle>
                        <CardDescription>
                            How to call this function in SQL
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm font-mono">
                            {`SELECT ${details.name}(col1) FROM stream1`}
                        </pre>
                        <p className="text-sm text-muted-foreground mt-4">
                            Note: The actual arguments depend on the function definition in the schema file.
                        </p>
                    </CardContent>
                </Card>

            </div>
        </AppLayout>
    );
}
