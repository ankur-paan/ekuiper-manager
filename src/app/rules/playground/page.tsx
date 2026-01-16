"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useServerStore } from "@/stores/server-store";
import { AppLayout } from "@/components/layout";
import { EmptyState, LoadingSpinner } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
    Play,
    Square,
    Trash2,
    Code,
    Database,
    Send,
    Plus,
    Terminal,
    FlaskConical,
    RefreshCw,
    AlertCircle,
    CheckCircle,
} from "lucide-react";
import { toast } from "sonner";

interface MockSource {
    name: string;
    data: string;
    interval: number;
    loop: boolean;
}

interface TestOutput {
    timestamp: Date;
    data: string;
    type: "result" | "error";
}

export default function RulePlaygroundPage() {
    const router = useRouter();
    const { servers, activeServerId } = useServerStore();
    const activeServer = servers.find((s) => s.id === activeServerId);

    const [testId, setTestId] = React.useState(`test_${Date.now()}`);
    const [sql, setSql] = React.useState("SELECT * FROM demo");
    const [mockSources, setMockSources] = React.useState<MockSource[]>([
        { name: "demo", data: '[\n  { "a": 1, "b": "hello" },\n  { "a": 2, "b": "world" }\n]', interval: 1000, loop: true }
    ]);
    const [isRunning, setIsRunning] = React.useState(false);
    const [isCreating, setIsCreating] = React.useState(false);
    const [outputs, setOutputs] = React.useState<TestOutput[]>([]);
    const [wsPort, setWsPort] = React.useState<number | null>(null);
    const [wsConnection, setWsConnection] = React.useState<WebSocket | null>(null);

    const outputRef = React.useRef<HTMLDivElement>(null);

    // Auto-scroll output
    React.useEffect(() => {
        if (outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight;
        }
    }, [outputs]);

    // Cleanup WebSocket on unmount
    React.useEffect(() => {
        return () => {
            if (wsConnection) {
                wsConnection.close();
            }
        };
    }, [wsConnection]);

    const addMockSource = () => {
        setMockSources([
            ...mockSources,
            { name: `source_${mockSources.length}`, data: '[\n  { "value": 1 }\n]', interval: 1000, loop: true }
        ]);
    };

    const removeMockSource = (index: number) => {
        setMockSources(mockSources.filter((_, i) => i !== index));
    };

    const updateMockSource = (index: number, field: keyof MockSource, value: any) => {
        const updated = [...mockSources];
        updated[index] = { ...updated[index], [field]: value };
        setMockSources(updated);
    };

    const handleCreateTest = async () => {
        if (!activeServer) return;

        setIsCreating(true);
        setOutputs([]);

        try {
            // Build mock source data
            const mockSourceData: Record<string, { data: any[]; interval: number; loop: boolean }> = {};
            for (const source of mockSources) {
                try {
                    mockSourceData[source.name] = {
                        data: JSON.parse(source.data),
                        interval: source.interval,
                        loop: source.loop,
                    };
                } catch (e) {
                    toast.error(`Invalid JSON in mock source "${source.name}"`);
                    setIsCreating(false);
                    return;
                }
            }

            const response = await fetch("/api/ekuiper/ruletest", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-EKuiper-URL": activeServer.url,
                },
                body: JSON.stringify({
                    id: testId,
                    sql,
                    mockSource: mockSourceData,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || "Failed to create test rule");
            }

            const data = await response.json();
            setWsPort(data.port);

            toast.success("Test rule created successfully");
            addOutput("Test rule created. Connect to WebSocket to see output.", "result");

        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to create test");
            addOutput(err instanceof Error ? err.message : "Failed to create test", "error");
        } finally {
            setIsCreating(false);
        }
    };

    const handleStartTest = async () => {
        if (!activeServer || !wsPort) return;

        try {
            // Start the test rule
            const response = await fetch(`/api/ekuiper/ruletest/${testId}/start`, {
                method: "POST",
                headers: { "X-EKuiper-URL": activeServer.url },
            });

            if (!response.ok) {
                throw new Error("Failed to start test rule");
            }

            setIsRunning(true);
            toast.success("Test rule started");
            addOutput("Test rule started. Waiting for output...", "result");

            // Connect to WebSocket for results
            // Note: The WebSocket URL would be based on the eKuiper server
            // For now, we'll simulate the connection
            addOutput("Note: WebSocket connection requires direct access to eKuiper server", "result");

        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to start test");
            addOutput(err instanceof Error ? err.message : "Failed to start test", "error");
        }
    };

    const handleStopTest = async () => {
        if (!activeServer) return;

        try {
            const response = await fetch(`/api/ekuiper/ruletest/${testId}`, {
                method: "DELETE",
                headers: { "X-EKuiper-URL": activeServer.url },
            });

            if (wsConnection) {
                wsConnection.close();
                setWsConnection(null);
            }

            setIsRunning(false);
            setWsPort(null);
            toast.success("Test rule stopped and cleaned up");
            addOutput("Test rule stopped and deleted.", "result");

        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to stop test");
        }
    };

    const addOutput = (data: string, type: "result" | "error") => {
        setOutputs((prev) => [...prev, { timestamp: new Date(), data, type }]);
    };

    if (!activeServer) {
        return (
            <AppLayout title="Rule Playground">
                <EmptyState
                    title="No Server Connected"
                    description="Connect to an eKuiper server to test rules."
                />
            </AppLayout>
        );
    }

    return (
        <AppLayout title="Rule Playground">
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10">
                            <FlaskConical className="h-5 w-5 text-orange-500" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold">Rule Testing Playground</h1>
                            <p className="text-sm text-muted-foreground">
                                Test SQL rules with mock data without affecting production
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {!isRunning && !wsPort && (
                            <Button onClick={handleCreateTest} disabled={isCreating}>
                                {isCreating ? (
                                    <LoadingSpinner size="sm" className="mr-2" />
                                ) : (
                                    <FlaskConical className="mr-2 h-4 w-4" />
                                )}
                                Create Test
                            </Button>
                        )}
                        {wsPort && !isRunning && (
                            <Button onClick={handleStartTest}>
                                <Play className="mr-2 h-4 w-4" />
                                Start Test
                            </Button>
                        )}
                        {(isRunning || wsPort) && (
                            <Button variant="destructive" onClick={handleStopTest}>
                                <Square className="mr-2 h-4 w-4" />
                                Stop & Cleanup
                            </Button>
                        )}
                    </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                    {/* Left Panel - SQL & Mock Data */}
                    <div className="space-y-4">
                        {/* Test ID */}
                        <Card>
                            <CardHeader className="py-3">
                                <CardTitle className="text-sm">Test Configuration</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="testId">Test ID</Label>
                                    <Input
                                        id="testId"
                                        value={testId}
                                        onChange={(e) => setTestId(e.target.value)}
                                        placeholder="unique_test_id"
                                        disabled={isRunning || !!wsPort}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* SQL Editor */}
                        <Card>
                            <CardHeader className="py-3">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-sm flex items-center gap-2">
                                        <Code className="h-4 w-4" />
                                        SQL Statement
                                    </CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <textarea
                                    className="w-full h-32 rounded-lg border bg-muted p-4 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                                    placeholder="SELECT * FROM demo WHERE a > 0"
                                    value={sql}
                                    onChange={(e) => setSql(e.target.value)}
                                    disabled={isRunning || !!wsPort}
                                />
                            </CardContent>
                        </Card>

                        {/* Mock Sources */}
                        <Card>
                            <CardHeader className="py-3">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-sm flex items-center gap-2">
                                        <Database className="h-4 w-4" />
                                        Mock Data Sources
                                    </CardTitle>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={addMockSource}
                                        disabled={isRunning || !!wsPort}
                                    >
                                        <Plus className="mr-1 h-3 w-3" />
                                        Add Source
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {mockSources.map((source, index) => (
                                    <div key={index} className="space-y-3 p-3 border rounded-lg">
                                        <div className="flex items-center justify-between">
                                            <Input
                                                value={source.name}
                                                onChange={(e) => updateMockSource(index, "name", e.target.value)}
                                                placeholder="source_name"
                                                className="w-40"
                                                disabled={isRunning || !!wsPort}
                                            />
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removeMockSource(index)}
                                                disabled={isRunning || !!wsPort || mockSources.length === 1}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        <textarea
                                            className="w-full h-24 rounded-lg border bg-muted p-3 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                                            placeholder='[{ "field": "value" }]'
                                            value={source.data}
                                            onChange={(e) => updateMockSource(index, "data", e.target.value)}
                                            disabled={isRunning || !!wsPort}
                                        />
                                        <div className="flex items-center gap-4 text-sm">
                                            <div className="flex items-center gap-2">
                                                <Label className="text-xs">Interval (ms):</Label>
                                                <Input
                                                    type="number"
                                                    value={source.interval}
                                                    onChange={(e) => updateMockSource(index, "interval", parseInt(e.target.value))}
                                                    className="w-20 h-8 text-xs"
                                                    disabled={isRunning || !!wsPort}
                                                />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Switch
                                                    checked={source.loop}
                                                    onCheckedChange={(v) => updateMockSource(index, "loop", v)}
                                                    disabled={isRunning || !!wsPort}
                                                />
                                                <Label className="text-xs">Loop</Label>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right Panel - Output */}
                    <div className="space-y-4">
                        <Card className="h-full">
                            <CardHeader className="py-3">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-sm flex items-center gap-2">
                                        <Terminal className="h-4 w-4" />
                                        Output
                                        {isRunning && (
                                            <Badge variant="default" className="ml-2 animate-pulse">
                                                Running
                                            </Badge>
                                        )}
                                    </CardTitle>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setOutputs([])}
                                        disabled={outputs.length === 0}
                                    >
                                        <Trash2 className="mr-1 h-3 w-3" />
                                        Clear
                                    </Button>
                                </div>
                                {wsPort && (
                                    <CardDescription className="text-xs">
                                        WebSocket port: {wsPort}
                                    </CardDescription>
                                )}
                            </CardHeader>
                            <CardContent>
                                <div
                                    ref={outputRef}
                                    className="h-[400px] overflow-y-auto rounded-lg border bg-black p-4 font-mono text-sm"
                                >
                                    {outputs.length === 0 ? (
                                        <div className="text-gray-500 text-center mt-20">
                                            <Send className="h-12 w-12 mx-auto mb-4 opacity-30" />
                                            <p>Output will appear here when the test runs</p>
                                        </div>
                                    ) : (
                                        outputs.map((output, index) => (
                                            <div key={index} className="mb-2">
                                                <span className="text-gray-500 text-xs">
                                                    [{output.timestamp.toLocaleTimeString()}]
                                                </span>
                                                {output.type === "error" ? (
                                                    <div className="flex items-start gap-1 text-red-400">
                                                        <AlertCircle className="h-3 w-3 mt-1 flex-shrink-0" />
                                                        <span>{output.data}</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-start gap-1 text-green-400">
                                                        <CheckCircle className="h-3 w-3 mt-1 flex-shrink-0" />
                                                        <span>{output.data}</span>
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
