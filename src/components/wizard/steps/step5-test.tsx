"use client";

import * as React from "react";
import { useQueryWizardStore } from "@/stores/wizard-store";
import { useServerStore } from "@/stores/server-store";
import { ekuiperClient } from "@/lib/ekuiper/client";
import { generateSqlFromWizard } from "@/lib/wizard/generator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { LoadingSpinner } from "@/components/common";
import { CheckCircle2, AlertTriangle, Play, Terminal, Rocket, StopCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

export function Step5Test() {
    const {
        ruleId,
        testStatus,
        setTestStatus,
        testOutput,
        setTestOutput
    } = useQueryWizardStore();

    // We need the full state to generate SQL
    const fullState = useQueryWizardStore();

    const { servers, activeServerId } = useServerStore();
    const activeServer = servers.find(s => s.id === activeServerId);

    const [validationState, setValidationState] = React.useState<'pending' | 'valid' | 'invalid'>('pending');
    const [validationError, setValidationError] = React.useState<string | null>(null);
    const [metrics, setMetrics] = React.useState<{ in: number, out: number }>({ in: 0, out: 0 });

    const testRuleId = React.useMemo(() => `${ruleId}_test_sample`, [ruleId]);
    const pollingRef = React.useRef<NodeJS.Timeout | null>(null);

    // 1. Auto-Validate on Mount
    React.useEffect(() => {
        const validate = async () => {
            if (!activeServer) return;
            setValidationState('pending');

            try {
                const sql = generateSqlFromWizard(fullState);
                const rulePayload = {
                    id: testRuleId, // ID doesn't matter for validation logic, but good for context
                    sql,
                    actions: [{ log: {} }] // Dummy action for validation
                };

                const res = await ekuiperClient.validateRule(rulePayload as any);
                if (res.valid) {
                    setValidationState('valid');
                } else {
                    setValidationState('invalid');
                    setValidationError(res.error || "Unknown validation error");
                }
            } catch (err: any) {
                setValidationState('invalid');
                setValidationError(err.message);
            }
        };

        validate();
    }, [fullState, activeServer, testRuleId]);

    // Cleanup polling on unmount
    React.useEffect(() => {
        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
            // Optional: Auto-stop test rule on unmount? 
            // Better to leave it explicitly controlled by user or let them navigate away (which implies stop?)
            // We'll leave it running unless user stops it, but we stop polling.
            // Actually, for "Live Sample", we should probably clean up if they leave the page.
            // But doing it synchronously on unmount often fails. 
        };
    }, []);

    const handleStartTest = async () => {
        if (!activeServer || validationState !== 'valid') return;

        setTestStatus('running');
        setTestOutput([]);
        setMetrics({ in: 0, out: 0 });

        try {
            // Generate SQL (Generator now handles strict casting)
            const sql = generateSqlFromWizard(fullState);

            // Create Test Rule
            // We use 'memory' sink to capture output internally if possible, 
            // OR just rely on metrics if we can't easily read memory topic.
            // Let's use 'memory' sink aiming at a topic named after the test ID.
            // Note: Reading from memory topic requires another client connected via WebSocket or similar.
            // For simplicity in this iteration, we rely on METRICS to show activity, 
            // and maybe 'log' sink if we can fetch logs (which we can't easily via API).
            // Better: Use a 'memory' sink + a parallel polling query? No.
            // User requested: "live sample can be rule in the background but with a different tag"

            const rulePayload = {
                id: testRuleId,
                sql,
                actions: [{ memory: { topic: `test/${testRuleId}` } }],
                tags: ["__test_sample__"],
                options: {
                    qos: 0,
                    sendMetaToSink: false
                }
            };

            // Cleanup potential leftover
            try { await ekuiperClient.deleteRule(testRuleId); } catch { }

            await ekuiperClient.createRule(rulePayload as any);
            await ekuiperClient.startRule(testRuleId);

            toast.success("Test Rule Started (Background)");

            // Start Polling Metrics
            pollingRef.current = setInterval(async () => {
                try {
                    const status = await ekuiperClient.getRuleStatus(testRuleId);
                    if (status) {
                        let totalIn = 0;
                        let totalOut = 0;
                        const m = status as any; // Typed loosely

                        // Parse flexible metrics keys
                        Object.keys(m).forEach(k => {
                            if (k.endsWith("records_in_total")) totalIn += Number(m[k]);
                            if (k.endsWith("records_out_total")) totalOut += Number(m[k]);
                        });

                        setMetrics({ in: totalIn, out: totalOut });

                        if (totalOut > 0) {
                            // We have some success!
                            // Unlike "mock" testing, we don't have the actual content unless we subscribe.
                            // But proving it triggers is usually 90% of the battle for non-tech users.
                            // We can simulate "Output" by saying "Triggered X times".
                        }
                    }
                } catch (e) {
                    console.warn("Polling failed", e);
                }
            }, 1000);

        } catch (err: any) {
            toast.error("Failed to start test: " + err.message);
            setTestStatus('failed');
        }
    };

    const handleStopTest = async () => {
        if (pollingRef.current) clearInterval(pollingRef.current);
        setTestStatus('idle');

        try {
            await ekuiperClient.stopRule(testRuleId);
            await ekuiperClient.deleteRule(testRuleId);
            toast.success("Test Stopped & Cleaned up");
        } catch (err) {
            console.error(err); // Ignore cleanup errors
        }
    };

    return (
        <div className="space-y-6">
            <div className="grid gap-4">
                <div className="flex flex-col gap-1">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Validation & Testing</Label>
                    <h2 className="text-lg font-bold">Validate Logic & Real-World Test</h2>
                    <p className="text-sm text-muted-foreground">Ensure your rule logic is sound and verify it against live data before deploying.</p>
                </div>
            </div>

            <Separator />

            {/* 1. Static Validation */}
            <Card className={validationState === 'valid' ? "border-green-500/20 bg-green-50/10" : "border-red-500/20 bg-red-50/10"}>
                <CardHeader className="p-4 py-3 flex flex-row items-center gap-4">
                    {validationState === 'pending' && <LoadingSpinner size="sm" />}
                    {validationState === 'valid' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                    {validationState === 'invalid' && <AlertTriangle className="h-5 w-5 text-red-500" />}

                    <div className="space-y-0.5">
                        <CardTitle className="text-sm font-medium">
                            {validationState === 'pending' ? "Validating Logic..." : validationState === 'valid' ? "Logic Validated" : "Validation Failed"}
                        </CardTitle>
                        {validationState === 'invalid' && (
                            <CardDescription className="text-xs text-red-600 font-mono">
                                {validationError}
                            </CardDescription>
                        )}
                        {validationState === 'valid' && (
                            <CardDescription className="text-xs text-green-600">
                                SQL syntax and stream references are correct.
                            </CardDescription>
                        )}
                    </div>
                </CardHeader>
            </Card>

            {/* 2. Live Testing */}
            <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Live Sample Test</Label>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                        <CardContent className="p-4 space-y-4">
                            <div className="flex items-center justify-between">
                                <Label>Test Control</Label>
                                <Badge variant={testStatus === 'running' ? "default" : "outline"} className={testStatus === 'running' ? "animate-pulse bg-green-500" : ""}>
                                    {testStatus === 'running' ? "LIVE MONITORING" : "READY"}
                                </Badge>
                            </div>

                            <div className="text-xs text-muted-foreground">
                                Verify against live stream data without sending to real outputs.
                                This runs a temporary rule tagged <code>__test_sample__</code>.
                            </div>

                            <div className="flex gap-2">
                                {testStatus !== 'running' ? (
                                    <Button
                                        onClick={handleStartTest}
                                        disabled={validationState !== 'valid'}
                                        className="w-full bg-purple-600 hover:bg-purple-700"
                                    >
                                        <Play className="mr-2 h-4 w-4" /> Start Live Test
                                    </Button>
                                ) : (
                                    <Button
                                        onClick={handleStopTest}
                                        variant="destructive"
                                        className="w-full"
                                    >
                                        <StopCircle className="mr-2 h-4 w-4" /> Stop Test
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-slate-950 text-slate-200 font-mono text-xs">
                        <CardHeader className="p-3 border-b border-slate-800">
                            <CardTitle className="text-xs flex items-center gap-2">
                                <Terminal className="h-3 w-3" /> Live Metrics
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-slate-500">Events In:</span>
                                <span className="text-blue-400 font-bold text-lg">{metrics.in}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-500">Actions Triggered:</span>
                                <span className="text-green-400 font-bold text-lg">{metrics.out}</span>
                            </div>

                            {metrics.out > 0 && (
                                <div className="p-2 rounded bg-green-900/20 border border-green-500/20 text-green-400 text-center animate-in fade-in">
                                    <CheckCircle2 className="h-3 w-3 mx-auto mb-1" />
                                    Rule is triggering!
                                </div>
                            )}

                            {testStatus === 'running' && metrics.in === 0 && (
                                <div className="p-2 rounded bg-yellow-900/20 border border-yellow-500/20 text-yellow-500 text-center animate-pulse">
                                    Waiting for data...
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            <div className="text-[10px] text-muted-foreground italic pt-2">
                Note: "Actions Triggered" confirms that your logic (Where Clauses) matched incoming data.
                Since this is a test, the output is discarded safely.
            </div>
        </div>
    );
}

