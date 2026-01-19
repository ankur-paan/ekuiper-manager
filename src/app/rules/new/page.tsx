"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useServerStore } from "@/stores/server-store";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Plus, Trash2, Save, Workflow, Code, Settings, Bot, Send, MessageSquare, Sparkles, User, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { LoadingSpinner } from "@/components/common";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { ekuiperClient } from "@/lib/ekuiper/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface SinkAction {
  type: string;
  config: Record<string, any>;
}

const SINK_TYPES = [
  { value: "mqtt", label: "MQTT", fields: ["server", "topic", "username", "password", "clientid"] },
  { value: "rest", label: "REST/HTTP", fields: ["url", "method", "bodyType"] },
  { value: "memory", label: "Memory", fields: ["topic", "keyFieldName"] },
  { value: "log", label: "Log", fields: [] },
  { value: "file", label: "File", fields: ["path", "fileType", "hasHeader"] },
  { value: "nop", label: "Nop (No-op)", fields: [] },
];

export default function NewRulePage() {
  const router = useRouter();
  const { servers, activeServerId } = useServerStore();
  const activeServer = servers.find((s) => s.id === activeServerId);

  const [ruleId, setRuleId] = React.useState("");
  const [sql, setSql] = React.useState("");
  const [actions, setActions] = React.useState<SinkAction[]>([{ type: "log", config: {} }]);
  const [sendMetaToSink, setSendMetaToSink] = React.useState(false);
  const [isEventTime, setIsEventTime] = React.useState(false);
  const [qos, setQos] = React.useState("0");
  const [saving, setSaving] = React.useState(false);
  const [validating, setValidating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // AI & Context State
  const [streams, setStreams] = React.useState<any[]>([]);
  const [connections, setConnections] = React.useState<any[]>([]);
  const [sourceMetadata, setSourceMetadata] = React.useState<any[]>([]);
  const [sinkMetadata, setSinkMetadata] = React.useState<any[]>([]);
  const [isChatOpen, setIsChatOpen] = React.useState(false);
  const [chatInput, setChatInput] = React.useState("");
  const [messages, setMessages] = React.useState<any[]>([]);
  const [isThinking, setIsThinking] = React.useState(false);
  const [proposedRule, setProposedRule] = React.useState<any>(null);
  const [aiModels, setAiModels] = React.useState<{ id: string, name: string }[]>([]);
  const [selectedModel, setSelectedModel] = React.useState("gemini-1.5-flash");

  // Fetch UI Models and Context
  React.useEffect(() => {
    fetch('/api/ai/models')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setAiModels(data);
          const flash = data.find(m => m.id.includes('flash')) || data[0];
          if (flash) setSelectedModel(flash.id);
        }
      });
  }, []);

  React.useEffect(() => {
    if (!activeServer) return;
    const fetchContext = async () => {
      try {
        ekuiperClient.setBaseUrl(activeServer.url);
        const sNames = await ekuiperClient.listStreams();
        const fullStreams = await Promise.all(sNames.map(async (item: any) => {
          try { return await ekuiperClient.getStream(item.name); }
          catch { return item; }
        }));
        setStreams(fullStreams);

        const c = await ekuiperClient.listConnections();
        setConnections(Array.isArray(c) ? c : []);

        const sources = await ekuiperClient.listSourceMetadata();
        const fullSourceMeta = await Promise.all((Array.isArray(sources) ? sources : []).map(async (s: any) => {
          try {
            const keys = await ekuiperClient.listConfKeys("sources", s.name);
            // Deep fetch content for each key
            const detailedKeys = await Promise.all(keys.map(async (k) => {
              try { return await ekuiperClient.getConfKey("sources", s.name, k); }
              catch { return { name: k, content: {} }; }
            }));
            return { ...s, confKeys: detailedKeys };
          } catch { return s; }
        }));
        // Filter: Keep only types that have at least one configuration OR are being used
        setSourceMetadata(fullSourceMeta.filter(s => s.confKeys && s.confKeys.length > 0));

        const sinks = await ekuiperClient.listSinkMetadata();
        const fullSinkMeta = await Promise.all((Array.isArray(sinks) ? sinks : []).map(async (s: any) => {
          try {
            const keys = await ekuiperClient.listConfKeys("sinks", s.name);
            const detailedKeys = await Promise.all(keys.map(async (k) => {
              try { return await ekuiperClient.getConfKey("sinks", s.name, k); }
              catch { return { name: k, content: {} }; }
            }));
            return { ...s, confKeys: detailedKeys };
          } catch { return s; }
        }));
        setSinkMetadata(fullSinkMeta.filter(s => s.confKeys && s.confKeys.length > 0));
      } catch (e) {
        console.error("Failed to fetch context for AI", e);
      }
    };
    fetchContext();
  }, [activeServer]);

  const handleChatSubmit = async () => {
    if (!chatInput.trim()) return;

    const userMsg = { role: 'user', content: chatInput };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setChatInput("");
    setIsThinking(true);

    try {
      const res = await fetch('/api/ai/rule-gen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          context: { streams, connections, sourceMetadata, sinkMetadata },
          modelName: selectedModel
        })
      });

      if (!res.ok) throw new Error("AI failed to respond");
      const data = await res.json();

      setMessages([...newMessages, { role: 'assistant', content: data.message }]);
      if (data.sql || data.actions) {
        setProposedRule(data);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsThinking(false);
    }
  };

  const applyProposedRule = () => {
    if (!proposedRule) return;
    if (proposedRule.ruleId) setRuleId(proposedRule.ruleId);
    if (proposedRule.sql) setSql(proposedRule.sql);
    if (proposedRule.actions) {
      setActions(proposedRule.actions.map((a: any) => ({
        type: a.type,
        config: a.config || {}
      })));
    }
    if (proposedRule.options) {
      if (proposedRule.options.qos !== undefined) setQos(String(proposedRule.options.qos));
      if (proposedRule.options.isEventTime !== undefined) setIsEventTime(!!proposedRule.options.isEventTime);
      if (proposedRule.options.sendMetaToSink !== undefined) setSendMetaToSink(!!proposedRule.options.sendMetaToSink);
    }
    setIsChatOpen(false);
    toast.success("AI Configuration Applied!");
  };

  const addAction = () => {
    setActions([...actions, { type: "log", config: {} }]);
  };

  const removeAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  const updateActionType = (index: number, type: string) => {
    const newActions = [...actions];
    newActions[index] = { type, config: {} };
    setActions(newActions);
  };

  const updateActionConfig = (index: number, key: string, value: any) => {
    const newActions = [...actions];
    newActions[index] = {
      ...newActions[index],
      config: { ...newActions[index].config, [key]: value },
    };
    setActions(newActions);
  };

  const removeActionConfig = (index: number, key: string) => {
    const newActions = [...actions];
    const newConfig = { ...newActions[index].config };
    delete newConfig[key];
    newActions[index] = { ...newActions[index], config: newConfig };
    setActions(newActions);
  };

  const renameActionConfigKey = (index: number, oldKey: string, newKey: string) => {
    if (!newKey.trim() || oldKey === newKey) return;
    const newActions = [...actions];
    const newConfig = { ...newActions[index].config };
    const val = newConfig[oldKey];
    delete newConfig[oldKey];
    newConfig[newKey] = val;
    newActions[index] = { ...newActions[index], config: newConfig };
    setActions(newActions);
  };

  const buildRuleJson = () => {
    const rule: Record<string, unknown> = {
      id: ruleId,
      sql,
      actions: actions.map((action) => {
        if (action.type === "log" || action.type === "nop") {
          return { [action.type]: {} };
        }
        return { [action.type]: action.config };
      }),
    };

    const options: Record<string, unknown> = {};
    if (sendMetaToSink) options.sendMetaToSink = true;
    if (isEventTime) options.isEventTime = true;
    if (qos !== "0") options.qos = parseInt(qos);

    if (Object.keys(options).length > 0) {
      rule.options = options;
    }

    return rule;
  };

  const handleValidate = async () => {
    if (!activeServer) return;
    if (!sql.trim()) {
      setError("SQL query is required");
      return;
    }

    setValidating(true);
    setError(null);
    try {
      ekuiperClient.setBaseUrl(activeServer.url);
      const ruleData = buildRuleJson();
      const res = await ekuiperClient.validateRule(ruleData as any);

      if (res.valid) {
        toast.success("Validation Passed: Rule logic is valid");
      } else {
        setError(res.error || "Validation failed");
        toast.error("Validation Failed");
      }
    } catch (e: any) {
      setError(e.message || "Validation check failed");
    } finally {
      setValidating(false);
    }
  };

  const handleSubmit = async () => {
    if (!activeServer) {
      setError("No server connected");
      return;
    }

    if (!ruleId.trim()) {
      setError("Rule ID is required");
      return;
    }

    if (!sql.trim()) {
      setError("SQL query is required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      ekuiperClient.setBaseUrl(activeServer.url);
      const ruleData = buildRuleJson();
      await ekuiperClient.createRule(ruleData as any);

      toast.success(`Rule "${ruleId}" created successfully`);
      router.push("/rules");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create rule");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout title="Create Rule">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push("/rules")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                <Workflow className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Create Rule</h1>
                <p className="text-sm text-muted-foreground">
                  Define a new stream processing rule
                </p>
              </div>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={() => setIsChatOpen(true)}
            className="gap-2 border-purple-500/50 hover:bg-purple-50 text-purple-700 transition-all font-semibold shadow-sm"
          >
            <Sparkles className="h-4 w-4 text-purple-600" />
            AI Rule Assistant
          </Button>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
            {error}
          </div>
        )}

        <Tabs defaultValue="basic">
          <TabsList>
            <TabsTrigger value="basic">
              <Workflow className="mr-2 h-4 w-4" />
              Basic Info
            </TabsTrigger>
            <TabsTrigger value="actions">
              <Settings className="mr-2 h-4 w-4" />
              Actions
            </TabsTrigger>
            <TabsTrigger value="preview">
              <Code className="mr-2 h-4 w-4" />
              Preview JSON
            </TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4">
            {/* Rule ID */}
            <Card>
              <CardHeader>
                <CardTitle>Rule Configuration</CardTitle>
                <CardDescription>Basic rule information and SQL query</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ruleId">Rule ID</Label>
                  <Input
                    id="ruleId"
                    placeholder="my_rule"
                    value={ruleId}
                    onChange={(e) => setRuleId(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sql">SQL Query</Label>
                  <textarea
                    id="sql"
                    className="w-full h-32 rounded-lg border bg-muted p-4 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="SELECT * FROM my_stream WHERE temperature > 30"
                    value={sql}
                    onChange={(e) => setSql(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Use eKuiper SQL syntax. Reference your streams and apply transformations.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Options */}
            <Card>
              <CardHeader>
                <CardTitle>Rule Options</CardTitle>
                <CardDescription>Advanced processing options</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Send Metadata to Sink</Label>
                    <p className="text-xs text-muted-foreground">
                      Include message metadata in sink output
                    </p>
                  </div>
                  <Switch
                    checked={sendMetaToSink}
                    onCheckedChange={setSendMetaToSink}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Event Time Processing</Label>
                    <p className="text-xs text-muted-foreground">
                      Use event timestamps instead of processing time
                    </p>
                  </div>
                  <Switch
                    checked={isEventTime}
                    onCheckedChange={setIsEventTime}
                  />
                </div>
                <div className="space-y-2">
                  <Label>QoS Level</Label>
                  <Select value={qos} onValueChange={setQos}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">At most once (0)</SelectItem>
                      <SelectItem value="1">At least once (1)</SelectItem>
                      <SelectItem value="2">Exactly once (2)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="actions" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Sink Actions</CardTitle>
                  <CardDescription>
                    Define where processed data should be sent
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={addAction}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Action
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {actions.map((action, index) => {
                  const sinkDef = SINK_TYPES.find((s) => s.value === action.type);
                  return (
                    <div key={index} className="rounded-lg border p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <Label>Action {index + 1}</Label>
                        {actions.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeAction(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Sink Type</Label>
                          <Select
                            value={action.type}
                            onValueChange={(v) => updateActionType(index, v)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {SINK_TYPES.map((type) => (
                                <SelectItem key={type.value} value={type.value}>
                                  {type.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {sinkDef?.fields.map((field) => (
                          <div key={field} className="space-y-2">
                            <Label className="capitalize">{field}</Label>
                            <Input
                              placeholder={`Enter ${field}...`}
                              value={action.config[field] || ""}
                              onChange={(e) =>
                                updateActionConfig(index, field, e.target.value)
                              }
                            />
                          </div>
                        ))}
                      </div>

                      <div className="space-y-2 pt-2 border-t">
                        <Label className="text-xs font-semibold uppercase text-muted-foreground">Advanced Properties</Label>
                        {Object.entries(action.config).filter(([k]) => !sinkDef?.fields.includes(k)).map(([k, v], i) => (
                          <div key={i} className="flex items-center gap-2">
                            <Input
                              className="flex-1 h-8 font-mono text-xs"
                              value={k}
                              onChange={(e) => renameActionConfigKey(index, k, e.target.value)}
                              placeholder="Key"
                            />
                            <Input
                              className="flex-1 h-8"
                              value={String(v)}
                              onChange={(e) => updateActionConfig(index, k, e.target.value)}
                              placeholder="Value"
                            />
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeActionConfig(index, k)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        <Button variant="outline" size="sm" onClick={() => updateActionConfig(index, "new_property", "")} className="w-full border-dashed">
                          <Plus className="mr-2 h-3 w-3" /> Add Property
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Rule JSON Preview</CardTitle>
                <CardDescription>
                  The JSON that will be sent to eKuiper
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="rounded-lg bg-muted p-4 text-sm overflow-x-auto">
                  <code>{JSON.stringify(buildRuleJson(), null, 2)}</code>
                </pre>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={() => router.push("/rules")}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={handleValidate} disabled={saving || validating} className="border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100">
            {validating ? <LoadingSpinner size="sm" className="mr-2" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            Validate
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? (
              <LoadingSpinner size="sm" className="mr-2" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Create Rule
          </Button>
        </div>
      </div>

      {/* AI Assistant Side Panel (Copilot UX) */}
      <Sheet open={isChatOpen} onOpenChange={setIsChatOpen}>
        <SheetContent side="right" className="sm:max-w-[500px] w-full p-0 flex flex-col border-l-purple-500/20 shadow-2xl overflow-hidden glass-morphism">
          <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] -z-10 pointer-events-none opacity-20" />

          <SheetHeader className="p-6 bg-gradient-to-br from-purple-600 to-indigo-700 text-white border-b border-white/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl opacity-50" />
            <div className="flex items-center gap-4 relative z-10">
              <div className="p-3 rounded-2xl bg-white/20 backdrop-blur-md ring-1 ring-white/30 shadow-inner">
                <Bot className="h-6 w-6 text-white animate-pulse" />
              </div>
              <div className="flex-1 text-left">
                <SheetTitle className="text-2xl font-black tracking-tight text-white leading-tight">Copilot <span className="text-purple-200">Architect</span></SheetTitle>
                <SheetDescription className="text-purple-100/80 font-medium text-xs uppercase tracking-widest mt-0.5">Industrial AI Assistant</SheetDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => { setMessages([]); setProposedRule(null) }} className="text-white/60 hover:text-white hover:bg-white/10">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </SheetHeader>

          {/* Chat Content */}
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-100/30 backdrop-blur-sm">
            <ScrollArea className="flex-1 px-6 pt-6">
              <div className="space-y-6 pb-6">
                <AnimatePresence initial={false}>
                  {messages.length === 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-center py-16 px-4"
                    >
                      <div className="bg-white/80 backdrop-blur-sm p-8 rounded-3xl ring-1 ring-slate-200 shadow-sm space-y-4 max-w-[320px] mx-auto">
                        <div className="bg-purple-600/10 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto ring-1 ring-purple-600/20">
                          <Sparkles className="h-8 w-8 text-purple-600" />
                        </div>
                        <div className="space-y-2">
                          <p className="text-lg font-bold text-slate-800 tracking-tight">Machine Intelligence ready.</p>
                          <p className="text-xs text-slate-500 italic leading-relaxed font-medium">
                            &quot;I can help you build complex filters, aggregations, and high-frequency alerts.&quot;
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                  {messages.map((m, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0.95, y: 10, x: m.role === 'user' ? 20 : -20 }}
                      animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
                      transition={{ type: "spring", stiffness: 300, damping: 25 }}
                      className={cn("flex gap-3 min-w-0 w-full", m.role === 'user' ? "flex-row-reverse" : "flex-row")}
                    >
                      <div className={cn("mt-1 p-2 rounded-xl flex-shrink-0 ring-1 shadow-sm h-fit",
                        m.role === 'user' ? "bg-white ring-slate-200" : "bg-purple-600 ring-purple-500")}>
                        {m.role === 'user' ? <User className="h-4 w-4 text-slate-600" /> : <Bot className="h-4 w-4 text-white" />}
                      </div>
                      <div className={cn("max-w-[85%] min-w-0 rounded-[2rem] px-5 py-4 text-sm leading-relaxed shadow-sm break-words overflow-hidden",
                        m.role === 'user'
                          ? "bg-slate-800 text-white rounded-tr-none shadow-md font-medium"
                          : "bg-white text-slate-700 rounded-tl-none ring-1 ring-slate-100")}>
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: ({ node, ...props }) => <p className="mb-2 last:mb-0 break-words" {...props} />,
                            ul: ({ node, ...props }) => <ul className="list-disc pl-4 mb-2 space-y-1" {...props} />,
                            ol: ({ node, ...props }) => <ol className="list-decimal pl-4 mb-2 space-y-1" {...props} />,
                            li: ({ node, ...props }) => <li className="mb-1 leading-normal" {...props} />,
                            h1: ({ node, ...props }) => <h1 className="text-lg font-black mb-2" {...props} />,
                            h2: ({ node, ...props }) => <h2 className="text-md font-black mb-2" {...props} />,
                            h3: ({ node, ...props }) => <h3 className="text-sm font-black mb-1" {...props} />,
                            code: ({ node, className, children, ...props }: any) => {
                              const match = /language-(\w+)/.exec(className || '');
                              const isBlock = match || String(children).includes('\n');

                              if (isBlock) {
                                return (
                                  <div className="relative w-full overflow-hidden my-3">
                                    <pre className="bg-slate-950 text-slate-300 p-4 rounded-xl overflow-x-auto text-[13px] font-mono border border-slate-800 shadow-2xl custom-scrollbar" style={{ maxWidth: '100%' }}>
                                      <code className={className} {...props}>
                                        {children}
                                      </code>
                                    </pre>
                                  </div>
                                );
                              }

                              return (
                                <code className="bg-purple-100/80 text-purple-700 px-1.5 py-0.5 rounded-md text-[13px] font-bold border border-purple-200/50" {...props}>
                                  {children}
                                </code>
                              );
                            },
                            strong: ({ node, ...props }) => <strong className="font-extrabold text-slate-900" {...props} />,
                          }}
                        >
                          {m.content}
                        </ReactMarkdown>
                      </div>
                    </motion.div>
                  ))}

                  {isThinking && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex gap-3 px-2"
                    >
                      <div className="mt-1 p-2 rounded-xl bg-purple-100 ring-1 ring-purple-200">
                        <Loader2 className="h-4 w-4 text-purple-600 animate-spin" />
                      </div>
                      <div className="bg-white rounded-full px-4 py-2 text-[10px] font-bold text-purple-400 uppercase tracking-widest flex items-center justify-center">
                        Synthesizing Engine Logic...
                      </div>
                    </motion.div>
                  )}

                  {proposedRule && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      className="mt-8 relative"
                    >
                      <div className="absolute inset-0 bg-purple-600 blur-2xl opacity-10 -z-10 rounded-3xl" />
                      <div className="rounded-3xl bg-slate-900 text-slate-100 shadow-2xl overflow-hidden ring-1 ring-white/10">
                        <div className="bg-gradient-to-r from-purple-500/30 to-blue-500/30 p-5 flex items-center justify-between border-b border-white/5 backdrop-blur-md">
                          <div className="flex items-center gap-3">
                            <div className="bg-purple-500 p-1.5 rounded-lg shadow-lg">
                              <Workflow className="h-4 w-4 text-white" />
                            </div>
                            <span className="font-black text-xs uppercase tracking-widest">Neural Blueprint</span>
                          </div>
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px] font-bold">READY</Badge>
                        </div>
                        <div className="p-6 space-y-5">
                          <div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-3">Logic Execution (SQL)</p>
                            <div className="bg-slate-950 p-5 rounded-2xl font-mono text-[13px] text-blue-300 border border-white/5 relative group cursor-text">
                              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Code className="h-4 w-4 text-slate-500" />
                              </div>
                              <span className="leading-relaxed whitespace-pre-wrap">{proposedRule.sql}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="flex-1">
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-2">Target Interface</p>
                              <div className="flex items-center gap-2">
                                <div className="p-1 px-3 rounded-md bg-white/5 border border-white/10 text-[11px] font-bold text-white flex items-center gap-2">
                                  <Settings className="h-3 w-3 text-purple-400" />
                                  {proposedRule.actions?.[0]?.type?.toUpperCase() || "LOG"}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 pt-4">
                              <div className="flex flex-col items-center">
                                <span className="text-[9px] text-slate-500 font-bold uppercase mb-1">QoS</span>
                                <span className="text-xs font-black text-purple-400">{proposedRule.options?.qos ?? 0}</span>
                              </div>
                              <div className="w-px h-6 bg-white/10 mx-1" />
                              <div className="flex flex-col items-center">
                                <span className="text-[9px] text-slate-500 font-bold uppercase mb-1">E_Time</span>
                                <span className={cn("text-xs font-black", proposedRule.options?.isEventTime ? "text-green-400" : "text-slate-600")}>{proposedRule.options?.isEventTime ? "ON" : "OFF"}</span>
                              </div>
                            </div>
                          </div>
                          <Button
                            onClick={applyProposedRule}
                            className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:from-purple-600 hover:to-indigo-700 font-black gap-3 py-6 rounded-2xl shadow-xl shadow-purple-500/20 group transition-all"
                          >
                            <CheckCircle2 className="h-5 w-5 group-hover:scale-110 transition-transform" />
                            DEPLOY TO SCHEMATIC
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </ScrollArea>
          </div>

          <div className="p-6 bg-slate-100/90 backdrop-blur-md border-t border-slate-300 flex flex-col gap-4 relative shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.1)]">
            <div className="flex items-center gap-3 w-full">
              <Textarea
                placeholder="Talk to your assistant..."
                className="flex-1 min-h-[60px] max-h-[120px] resize-none border-slate-400 focus-visible:ring-purple-500 transition-all rounded-2xl bg-white p-4 shadow-sm text-slate-900 placeholder:text-slate-500 font-medium"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleChatSubmit();
                  }
                }}
              />
              <Button
                onClick={handleChatSubmit}
                className="h-[60px] w-[60px] rounded-2xl bg-purple-600 hover:bg-purple-700 text-white shadow-xl transition-all active:scale-95 flex-shrink-0"
                disabled={isThinking || !chatInput.trim()}
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex items-center justify-between px-1">
              {aiModels.length > 0 && (
                <div className="flex items-center gap-3 bg-white/50 p-1 px-3 rounded-full border border-slate-300">
                  <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest leading-none">AI Model</span>
                  <Select value={selectedModel} onValueChange={setSelectedModel}>
                    <SelectTrigger className="h-7 w-[140px] text-[10px] border-slate-400 bg-white hover:bg-slate-50 transition-colors uppercase font-black tracking-wider shadow-none rounded-full px-4 text-purple-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-slate-200 shadow-2xl">
                      {aiModels.map(m => (
                        <SelectItem key={m.id} value={m.id} className="text-[10px] font-bold uppercase py-2">
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <p className="text-[9px] text-slate-600 font-extrabold uppercase tracking-[0.2em] bg-white/40 px-3 py-1.5 rounded-full border border-slate-300/50">Industrial Copilot</p>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </AppLayout >
  );
}
