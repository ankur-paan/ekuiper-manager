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
import { ArrowLeft, Zap, Server, Code, FileCode } from "lucide-react";
import { useRouter } from "next/navigation";
import { EKuiperClient } from "@/lib/ekuiper/client";
import { Service } from "@/lib/ekuiper/types";

interface FunctionDetailPageProps {
    params: {
        name: string;
    };
}

interface FunctionDetails {
    name: string;
    serviceName: string;
    interfaceName: string;
    protocol: string;
    address: string;
    schemaType: string;
}

export default function FunctionDetailPage({ params }: FunctionDetailPageProps) {
    const router = useRouter();
    const name = decodeURIComponent(params.name);
    const { servers, activeServerId } = useServerStore();
    const activeServer = servers.find((s) => s.id === activeServerId);

    const [details, setDetails] = React.useState<FunctionDetails | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    const fetchFunctionDetails = React.useCallback(async () => {
        if (!activeServer) return;

        setLoading(true);
        setError(null);

        try {
            const client = new EKuiperClient(activeServer.url);

            // Since there's no direct API to get function details, we fetch all services
            // and search for the function definition.
            const serviceNames = await client.listServices();
            const services = await Promise.all(
                serviceNames.map((svcName) => client.getService(svcName))
            );

            let found: FunctionDetails | null = null;

            for (const svc of services) {
                if (!svc.interfaces) continue;

                for (const [ifaceName, iface] of Object.entries(svc.interfaces)) {
                    if (iface.functions) {
                        const funcDef = iface.functions.find(f => f.name === name);
                        if (funcDef) {
                            found = {
                                name: funcDef.name,
                                serviceName: svc.name,
                                interfaceName: ifaceName,
                                protocol: iface.protocol,
                                address: iface.address,
                                schemaType: iface.schemaType,
                            };
                            break;
                        }
                    }
                }
                if (found) break;
            }

            if (found) {
                setDetails(found);
            } else {
                // If not found in services, it might be a built-in or plugin function not exposed via services map
                // But for "External Services", it should be here.
                setError("Function definition not found in any registered service.");
            }

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
                        description={error || "Could not locate this function in any registered service."}
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

                                <span className="text-muted-foreground">Protocol:</span>
                                <Badge variant="outline">{details.protocol}</Badge>

                                <span className="text-muted-foreground">Schema Type:</span>
                                <Badge variant="secondary">{details.schemaType}</Badge>
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
                                <Button variant="link" className="p-0 h-auto font-medium justify-start" onClick={() => router.push(`/services/${details.serviceName}`)}>
                                    {details.serviceName}
                                </Button>

                                <span className="text-muted-foreground">Interface:</span>
                                <span className="font-medium">{details.interfaceName}</span>

                                <span className="text-muted-foreground">Address:</span>
                                <span className="font-mono text-xs bg-muted p-1 rounded">{details.address}</span>
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
