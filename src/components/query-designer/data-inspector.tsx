"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, Database, Table, FileJson, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabaseClient } from "@/lib/supabase/client";
import { ekuiperClient } from "@/lib/ekuiper/client";
import { useEmqxStore } from "@/stores/emqx-store";

interface DataInspectorProps {
    type: "streams" | "tables" | "topics" | "history";
    name: string;
    liveMessages?: any[];
}

export function DataInspector({ type, name, liveMessages = [] }: DataInspectorProps) {
    const [activeTab, setActiveTab] = React.useState("preview");
    const [schema, setSchema] = React.useState<any[]>([]);
    const [previewData, setPreviewData] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(false);

    // Fetch Schema & Static Data
    React.useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            setSchema([]);
            setPreviewData([]);

            try {
                if (type === 'history') { // Supabase
                    const cols = await supabaseClient.getTableSchema(name);
                    setSchema(cols);
                    const data = await supabaseClient.getSampleData(name, 15);
                    setPreviewData(data);
                } else if (type === 'streams' || type === 'tables') { // eKuiper
                    // Note: eKuiper client needs strict typing implementation for this
                    // For now we mock or use what's available
                    // current eKuiper client might not have full schema fetch implemented in this project context
                    // We will implement basic preview if possible
                    // setPreviewData([{info: "Preview not implemented for eKuiper yet in this demo"}]);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };

        if (name && type !== 'topics') {
            loadData();
        }
    }, [type, name]);

    // Infer Schema from Live Messages for Topics
    const inferredSchema = React.useMemo(() => {
        if (type !== 'topics' || liveMessages.length === 0) return [];
        const latest = liveMessages[0];
        if (typeof latest === 'object') {
            return Object.keys(latest).map(k => ({ name: k, type: typeof latest[k] }));
        }
        return [{ name: 'payload', type: typeof latest }];
    }, [type, liveMessages]);

    return (
        <div className="flex flex-col h-full bg-card border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between p-2 border-b bg-muted/30">
                <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold text-sm">{name}</span>
                    <Badge variant="secondary" className="text-[10px] uppercase">{type}</Badge>
                </div>
                {type === 'topics' && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-[10px]"
                        onClick={() => {
                            import("@/lib/emqx/live-client").then(({ emqxLiveClient }) => {
                                emqxLiveClient.publish(name, {
                                    simulator: true,
                                    value: Math.round(Math.random() * 100),
                                    timestamp: Date.now()
                                });
                            });
                        }}
                    >
                        <Play className="h-3 w-3 mr-1" /> Simulate Data
                    </Button>
                )}
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                <div className="border-b px-2">
                    <TabsList className="h-8">
                        <TabsTrigger value="preview" className="text-xs">Data Preview</TabsTrigger>
                        <TabsTrigger value="schema" className="text-xs">Schema</TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="preview" className="flex-1 overflow-hidden p-0 m-0 relative">
                    <ScrollArea className="h-full">
                        <div className="p-4 space-y-2">
                            {type === 'topics' ? (
                                <div className="space-y-2 font-mono text-xs">
                                    {liveMessages.length === 0 ? (
                                        <div className="text-center text-muted-foreground py-8">
                                            <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                                            Waiting for live messages...
                                        </div>
                                    ) : (
                                        liveMessages.map((msg, i) => (
                                            <div key={i} className="p-2 bg-muted/50 rounded border flex flex-col gap-1">
                                                <span className="text-[10px] text-muted-foreground">{new Date().toLocaleTimeString()}</span>
                                                <pre className="whitespace-pre-wrap">{JSON.stringify(msg, null, 2)}</pre>
                                            </div>
                                        ))
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {loading ? (
                                        <div className="flex justify-center p-4"><Loader2 className="animate-spin h-5 w-5" /></div>
                                    ) : previewData.length > 0 ? (
                                        <div className="border rounded-md overflow-hidden text-xs">
                                            <table className="w-full">
                                                <thead className="bg-muted">
                                                    <tr>
                                                        {Object.keys(previewData[0]).map(k => (
                                                            <th key={k} className="p-2 text-left font-medium text-muted-foreground">{k}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {previewData.map((row, i) => (
                                                        <tr key={i} className="border-t hover:bg-muted/50">
                                                            {Object.values(row).map((v: any, j) => (
                                                                <td key={j} className="p-2 font-mono">{String(v)}</td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <p className="text-muted-foreground text-center py-8">No preview data available</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </TabsContent>

                <TabsContent value="schema" className="flex-1 overflow-auto p-4 m-0">
                    <h4 className="text-xs font-semibold mb-3 text-muted-foreground uppercase">Fields</h4>
                    <div className="grid gap-2">
                        {(type === 'topics' ? inferredSchema : schema).map((col: any, i) => (
                            <div key={i} className="flex items-center justify-between p-2 border rounded bg-card/50">
                                <div className="flex items-center gap-2">
                                    <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                                    <span className="font-mono text-xs font-medium">{col.name}</span>
                                </div>
                                <span className="text-[10px] text-muted-foreground font-mono">{col.type}</span>
                            </div>
                        ))}
                        {(type === 'topics' && inferredSchema.length === 0) && (
                            <p className="text-xs text-muted-foreground">Waiting for data to infer schema...</p>
                        )}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
