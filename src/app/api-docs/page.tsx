"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { ekuiperManagerClient } from "@/lib/ekuiper/manager-client";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2, Server, Globe } from "lucide-react";
import "swagger-ui-react/swagger-ui.css";

// Dynamically import SwaggerUI to avoid SSR issues
const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false });

export default function ApiDocsPage() {
    const [servers, setServers] = useState<{ name: string; url: string }[]>([
        { name: "Localhost", url: "http://localhost:9081" },
    ]);
    const [selectedServer, setSelectedServer] = useState<string>("http://localhost:9081");
    const [customUrl, setCustomUrl] = useState("");
    const [spec, setSpec] = useState<object | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch configured connections on mount
    useEffect(() => {
        const fetchConnections = async () => {
            try {
                const connections = await ekuiperManagerClient.listConnections();
                const serverList = [
                    { name: "Localhost", url: "http://localhost:9081" },
                    { name: "External (ruler1)", url: "https://ruler1.i-dacs.com" }, // Default useful one
                    ...connections.map((c: any) => ({
                        name: `${c.id} (${c.type})`,
                        // Assuming props.server or similar exists, fallback to ID for proxy lookup
                        url: c.props?.server || c.props?.url || c.id
                    }))
                ];
                setServers(serverList);
            } catch (e) {
                console.warn("Failed to fetch connections", e);
            }
        };
        fetchConnections();
    }, []);

    const fetchSpec = async (serverUrl: string) => {
        setLoading(true);
        setError(null);
        setSpec(null);

        // Try common paths for swagger.json from the server
        const paths = [
            "/static/swagger/swagger.json",
            "/swagger/swagger.json",
            "/swagger.json"
        ];

        let fetchedSpec: any = null;

        for (const path of paths) {
            try {
                const proxyUrl = `/api/ekuiper${path}?ekuiper_url=${encodeURIComponent(serverUrl)}`;
                const res = await fetch(proxyUrl);
                if (res.ok) {
                    fetchedSpec = await res.json();
                    break;
                }
            } catch (e) {
                // continue
            }
        }

        // Fallback to static spec if server doesn't expose one
        if (!fetchedSpec) {
            try {
                const res = await fetch("/ekuiper-openapi.json");
                if (res.ok) {
                    fetchedSpec = await res.json();
                }
            } catch (e) {
                // Static spec also failed
            }
        }

        if (fetchedSpec) {
            // Modify servers in spec to point to our proxy
            fetchedSpec.servers = [{ url: "/api/ekuiper", description: `Proxied to ${serverUrl}` }];
            setSpec(fetchedSpec);
        } else {
            setError("Could not load API specification.");
        }
        setLoading(false);
    };

    const handleLoad = () => {
        const url = selectedServer === "custom" ? customUrl : selectedServer;
        if (!url) return;
        fetchSpec(url);
    };

    // Add X-EKuiper-URL header to all Swagger requests
    const requestInterceptor = (req: any) => {
        const targetServer = selectedServer === "custom" ? customUrl : selectedServer;
        req.headers["X-EKuiper-URL"] = targetServer;
        return req;
    };

    return (
        <div className="min-h-screen p-6 space-y-6 bg-background">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                    <Globe className="h-8 w-8 text-primary" />
                    API Documentation
                </h1>
                <p className="text-muted-foreground">
                    Interactive API reference for the connected eKuiper instance.
                </p>
            </div>

            <GlassCard className="p-6">
                <div className="flex flex-col md:flex-row gap-4 items-end md:items-center bg-muted/30 p-4 rounded-lg border border-border/50">
                    <div className="flex-1 space-y-2 w-full md:w-auto">
                        <label className="text-sm font-medium flex items-center gap-2">
                            <Server className="h-4 w-4" /> Target Server
                        </label>
                        <Select value={selectedServer} onValueChange={setSelectedServer}>
                            <SelectTrigger className="w-full bg-background">
                                <SelectValue placeholder="Select server" />
                            </SelectTrigger>
                            <SelectContent>
                                {servers.map((s) => (
                                    <SelectItem key={s.url} value={s.url}>
                                        {s.name} <span className="text-xs text-muted-foreground ml-2">({s.url})</span>
                                    </SelectItem>
                                ))}
                                <SelectItem value="custom">Custom URL...</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {selectedServer === "custom" && (
                        <div className="flex-1 space-y-2 w-full md:w-auto">
                            <label className="text-sm font-medium">Server URL</label>
                            <Input
                                value={customUrl}
                                onChange={(e) => setCustomUrl(e.target.value)}
                                placeholder="http://localhost:9081"
                                className="bg-background"
                            />
                        </div>
                    )}

                    <Button onClick={handleLoad} disabled={loading} className="w-full md:w-auto min-w-[120px]">
                        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Load API Docs"}
                    </Button>
                </div>

                <div className="mt-8 min-h-[500px] border rounded-lg bg-white overflow-hidden">
                    {error ? (
                        <div className="flex flex-col items-center justify-center h-[400px] text-red-500 gap-4">
                            <Server className="h-12 w-12 opacity-50" />
                            <p>{error}</p>
                            <p className="text-sm text-muted-foreground">Make sure the server is reachable and swagger.json exists.</p>
                        </div>
                    ) : spec ? (
                        <div className="swagger-container">
                            <SwaggerUI
                                spec={spec}
                                requestInterceptor={requestInterceptor}
                                displayOperationId={true}
                                docExpansion="list"
                            />
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground gap-4">
                            <Globe className="h-12 w-12 opacity-20" />
                            <p>Select a server and click load to view documentation.</p>
                        </div>
                    )}
                </div>
            </GlassCard>
        </div>
    );
}
