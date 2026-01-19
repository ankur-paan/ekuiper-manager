"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useServerStore } from "@/stores/server-store";
import { AppLayout } from "@/components/layout";
import { ekuiperClient } from "@/lib/ekuiper/client";
import { LoadingPage, ErrorState, StatusBadge, ConfirmDialog } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Send, MessageSquare, Sparkles, User, Loader2, RefreshCw, CheckCircle2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  ArrowLeft,
  Workflow,
  Pencil,
  Trash2,
  Copy,
  Code,
  Play,
  Square,
  RotateCcw,
  Clock,
  AlertCircle,
  GitBranch,
  Tag,
  X,
  Plus,
  Activity,
  TrendingUp,
} from "lucide-react";

interface RuleDetails {
  id: string;
  sql: string;
  actions: Array<Record<string, unknown>>;
  options?: Record<string, unknown>;
  tags?: string[];
}

interface RuleStatus {
  status: string;
  source_?: string;
  op_?: Array<Record<string, unknown>>;
  lastStartTimestamp?: number;
  lastStopTimestamp?: number;
  [key: string]: unknown;
}

// Rule output schema field type
interface RuleSchemaField {
  type?: string;
  hasIndex?: boolean;
  index?: number;
  optional?: boolean;
  properties?: Record<string, RuleSchemaField>;
  items?: RuleSchemaField;
}

// Component to display rule output schema
function RuleOutputSchemaCard({ ruleId, activeServer }: { ruleId: string; activeServer: { url: string } | undefined }) {
  const [schema, setSchema] = React.useState<Record<string, RuleSchemaField> | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fetchSchema = React.useCallback(async () => {
    if (!activeServer || !ruleId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/ekuiper/rules/${encodeURIComponent(ruleId)}/schema`, {
        headers: { "X-EKuiper-URL": activeServer.url },
      });
      if (!response.ok) {
        if (response.status === 404) {
          setError("Schema endpoint not available");
          return;
        }
        throw new Error(`Status ${response.status}`);
      }
      const data = await response.json();
      setSchema(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch schema");
    } finally {
      setLoading(false);
    }
  }, [activeServer, ruleId]);

  React.useEffect(() => {
    fetchSchema();
  }, [fetchSchema]);

  // Get color for type
  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      string: "bg-green-500/10 text-green-600 border-green-500/20",
      bigint: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      float: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
      boolean: "bg-amber-500/10 text-amber-600 border-amber-500/20",
      datetime: "bg-purple-500/10 text-purple-600 border-purple-500/20",
      array: "bg-pink-500/10 text-pink-600 border-pink-500/20",
      struct: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
    };
    return colors[type?.toLowerCase()] || "bg-gray-500/10 text-gray-600 border-gray-500/20";
  };

  // Render a schema field
  const renderField = (name: string, field: RuleSchemaField, depth = 0) => (
    <div key={name} className={cn("rounded-lg border p-3", depth > 0 && "ml-4 mt-2 border-dashed")}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {field.hasIndex && typeof field.index === "number" && (
            <span className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono text-muted-foreground">
              [{field.index}]
            </span>
          )}
          <span className="font-medium">{name}</span>
          {field.optional && <span className="text-xs text-muted-foreground">(optional)</span>}
        </div>
        {field.type && (
          <Badge variant="outline" className={getTypeColor(field.type)}>
            {field.type}
          </Badge>
        )}
      </div>
      {field.properties && (
        <div className="mt-2 space-y-2">
          {Object.entries(field.properties).map(([k, v]) => renderField(k, v, depth + 1))}
        </div>
      )}
      {field.items && (
        <div className="mt-2 pl-4 border-l-2 border-dashed border-muted-foreground/30">
          <span className="text-xs text-muted-foreground mb-1 block">Array items:</span>
          {renderField("[]", field.items, depth + 1)}
        </div>
      )}
    </div>
  );

  if (error || !schema || Object.keys(schema).length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Output Schema
          <Badge variant="secondary" className="text-xs font-normal">Inferred</Badge>
        </CardTitle>
        <CardDescription>
          Fields produced by this rule&apos;s SELECT statement
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading schema...</span>
          </div>
        ) : (
          <div className="space-y-2">
            {Object.entries(schema).map(([name, field]) => renderField(name, field))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RuleExplainView({ ruleId, activeServer, sql, aiModels }: { ruleId: string; activeServer: { url: string } | undefined; sql?: string; aiModels?: { id: string, name: string }[] }) {
  const [plan, setPlan] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [explanation, setExplanation] = React.useState<string | null>(null);
  const [explaining, setExplaining] = React.useState(false);
  const [modelId, setModelId] = React.useState("gemini-1.5-flash");

  const generateExplanation = async () => {
    if (!plan) return;
    setExplaining(true);
    try {
      const res = await fetch("/api/ai/explain-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, sql, modelName: modelId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setExplanation(data.explanation);
    } catch (e: any) {
      toast.error("Failed to generate explanation: " + e.message);
    } finally {
      setExplaining(false);
    }
  };

  React.useEffect(() => {
    if (!activeServer || !ruleId) return;
    setLoading(true);
    setError(null);
    ekuiperClient.setBaseUrl(activeServer.url);
    ekuiperClient.getRuleExplain(ruleId)
      .then((data) => {
        if (typeof data === 'string') {
          try {
            setPlan(JSON.parse(data));
          } catch {
            setPlan({ type: 'Raw', info: data });
          }
        } else {
          setPlan(data);
        }
      })
      .catch(e => setError("Plan unavailable: " + (e.message || "Unknown error")))
      .finally(() => setLoading(false));
  }, [activeServer, ruleId]);

  const renderNode = (node: any) => {
    if (!node) return null;
    const type = node.Type || node.type || "Unknown";
    const children = node.Children || node.children || [];

    return (
      <div className="flex flex-col">
        <div className="flex items-center gap-2 p-2 border rounded-lg bg-slate-50 w-fit mb-4 shadow-sm">
          <Badge variant="outline" className="bg-white text-blue-600 border-blue-200">{type}</Badge>
          {Object.entries(node).map(([k, v]) => {
            if (k === 'Type' || k === 'type' || k === 'Children' || k === 'children') return null;
            if (typeof v === 'object') return null;
            return <span key={k} className="text-xs text-slate-500 font-mono"><span className="font-bold">{k}:</span> {String(v)}</span>
          })}
        </div>
        {children.length > 0 && (
          <div className="pl-6 ml-4 border-l-2 border-slate-200 space-y-2">
            {children.map((child: any, i: number) => (
              <div key={i} className="relative">
                <div className="absolute top-4 -left-6 w-6 h-px bg-slate-200"></div>
                {renderNode(child)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />Analyzing Execution Logic...</div>;
  if (error) return <div className="p-4 border border-red-200 bg-red-50 text-red-600 rounded-lg">{error}</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><GitBranch className="h-5 w-5 text-purple-600" /> Execution Plan</CardTitle>
        <CardDescription>Logical operator tree for this rule</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {plan ? renderNode(plan) : <p className="text-muted-foreground">No plan data returned.</p>}
        {plan && (
          <div className="mt-6 pt-4 border-t space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-600" />
                AI Analysis
              </h4>
              {!explanation && (
                <div className="flex items-center gap-2">
                  {aiModels && aiModels.length > 0 && (
                    <Select value={modelId} onValueChange={setModelId}>
                      <SelectTrigger className="h-8 w-[180px] text-xs">
                        <SelectValue placeholder="Select Model" />
                      </SelectTrigger>
                      <SelectContent>
                        {aiModels.map(m => (
                          <SelectItem key={m.id} value={m.id} className="text-xs">
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Button variant="outline" size="sm" onClick={generateExplanation} disabled={explaining}>
                    {explaining ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Bot className="h-3 w-3 mr-2" />}
                    {explaining ? "Analyzing..." : "Explain Plan"}
                  </Button>
                </div>
              )}
            </div>
            {explanation && (
              <div className="rounded-lg bg-slate-50 p-4 text-sm leading-relaxed border border-slate-200 prose prose-sm prose-slate max-w-none text-slate-900">
                <ReactMarkdown>
                  {explanation}
                </ReactMarkdown>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TagsManager({ ruleId, activeServer, initialTags, onUpdate }: { ruleId: string, activeServer: any, initialTags: string[], onUpdate: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [tags, setTags] = React.useState<string[]>([]);
  const [newTag, setNewTag] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) setTags(initialTags || []);
  }, [open, initialTags]);

  const handleSave = async () => {
    if (!activeServer) return;
    setSaving(true);
    try {
      ekuiperClient.setBaseUrl(activeServer.url);
      await ekuiperClient.setRuleTags(ruleId, tags);
      toast.success("Tags updated");
      setOpen(false);
      onUpdate();
    } catch (e: any) {
      toast.error(e.message || "Failed to update tags");
    } finally {
      setSaving(false);
    }
  };

  const addTag = () => {
    const t = newTag.trim();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
      setNewTag("");
    }
  };

  const removeTag = (t: string) => {
    setTags(tags.filter(tag => tag !== t));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 gap-1 text-xs text-muted-foreground hover:text-foreground">
          <Tag className="h-3 w-3" />
          Manage Tags
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage Tags</DialogTitle>
          <DialogDescription>Add or remove tags for rule {ruleId}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex gap-2">
            <Input
              placeholder="New tag..."
              value={newTag}
              onChange={e => setNewTag(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTag()}
            />
            <Button onClick={addTag} size="icon"><Plus className="h-4 w-4" /></Button>
          </div>
          <div className="flex flex-wrap gap-2 min-h-[100px] border rounded-md p-4 bg-slate-50">
            {tags.length === 0 && <span className="text-sm text-muted-foreground italic">No tags assigned</span>}
            {tags.map(t => (
              <Badge key={t} variant="secondary" className="gap-1 pr-1">
                {t}
                <button onClick={() => removeTag(t)} className="hover:bg-slate-200 rounded-full p-0.5"><X className="h-3 w-3" /></button>
              </Badge>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function RuleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ruleId = params.id as string;
  const { servers, activeServerId } = useServerStore();
  const activeServer = servers.find((s) => s.id === activeServerId);

  const [rule, setRule] = React.useState<RuleDetails | null>(null);
  const [status, setStatus] = React.useState<RuleStatus | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [showDelete, setShowDelete] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);

  // AI State
  const [isChatOpen, setIsChatOpen] = React.useState(false);
  const [chatInput, setChatInput] = React.useState("");
  const [messages, setMessages] = React.useState<any[]>([]);
  const [isThinking, setIsThinking] = React.useState(false);
  const [aiModels, setAiModels] = React.useState<{ id: string, name: string }[]>([]);
  const [selectedModel, setSelectedModel] = React.useState("gemini-1.5-flash");

  React.useEffect(() => {
    fetch('/api/ai/models')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setAiModels(data);
          const flash = data.find(m => m.id.includes('1.5-flash')) || data.find(m => m.id.includes('flash')) || data[0];
          if (flash) setSelectedModel(flash.id);
        }
      });
  }, []);

  const handleChatSubmit = async () => {
    if (!chatInput.trim()) return;

    const userMsg = { role: 'user', content: chatInput };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setChatInput("");
    setIsThinking(true);

    try {
      const res = await fetch('/api/ai/rule-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          context: { rule, status },
          modelName: selectedModel
        })
      });

      if (!res.ok) throw new Error("AI failed to respond");
      const data = await res.json();
      setMessages([...newMessages, { role: 'assistant', content: data.message }]);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsThinking(false);
    }
  };

  const fetchRule = React.useCallback(async () => {
    if (!activeServer || !ruleId) return;

    setLoading(true);
    setError(null);

    try {
      const [ruleRes, statusRes] = await Promise.all([
        fetch(`/api/ekuiper/rules/${ruleId}`, {
          headers: { "X-EKuiper-URL": activeServer.url },
        }),
        fetch(`/api/ekuiper/rules/${ruleId}/status`, {
          headers: { "X-EKuiper-URL": activeServer.url },
        }),
      ]);

      if (!ruleRes.ok) {
        throw new Error(`Failed to fetch rule: ${ruleRes.status}`);
      }

      const ruleData = await ruleRes.json();
      setRule(ruleData);

      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setStatus(statusData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch rule");
    } finally {
      setLoading(false);
    }
  }, [activeServer, ruleId]);

  const refreshStatus = async () => {
    if (!activeServer) return;
    setRefreshing(true);
    try {
      const res = await fetch(`/api/ekuiper/rules/${ruleId}/status`, {
        headers: { "X-EKuiper-URL": activeServer.url },
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } finally {
      setRefreshing(false);
    }
  };

  React.useEffect(() => {
    fetchRule();
  }, [fetchRule]);

  const handleRuleAction = async (action: "start" | "stop" | "restart") => {
    if (!activeServer) return;

    try {
      const response = await fetch(`/api/ekuiper/rules/${ruleId}/${action}`, {
        method: "POST",
        headers: { "X-EKuiper-URL": activeServer.url },
      });

      if (!response.ok) {
        throw new Error(`Failed to ${action} rule`);
      }

      toast.success(`Rule ${action}ed successfully`);
      refreshStatus();
    } catch (err) {
      toast.error(`Failed to ${action} rule`);
    }
  };

  const handleDelete = async () => {
    if (!activeServer) return;

    try {
      const response = await fetch(`/api/ekuiper/rules/${ruleId}`, {
        method: "DELETE",
        headers: { "X-EKuiper-URL": activeServer.url },
      });

      if (!response.ok) {
        throw new Error("Failed to delete rule");
      }

      toast.success("Rule deleted successfully");
      router.push("/rules");
    } catch (err) {
      toast.error("Failed to delete rule");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const isRunning = status?.status?.toLowerCase().includes("running");

  if (loading) {
    return (
      <AppLayout title={`Rule: ${ruleId}`}>
        <LoadingPage label="Loading rule details..." />
      </AppLayout>
    );
  }

  if (error || !rule) {
    return (
      <AppLayout title={`Rule: ${ruleId}`}>
        <ErrorState
          title="Error Loading Rule"
          description={error || "Rule not found"}
          onRetry={fetchRule}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout title={`Rule: ${ruleId}`}>
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
                <h1 className="text-2xl font-bold">{rule.id}</h1>
                <div className="flex items-center gap-2">
                  <StatusBadge
                    status={isRunning ? "running" : "stopped"}
                    label={status?.status || "Unknown"}
                  />
                  <div className="flex items-center gap-1 ml-2">
                    {rule.tags && rule.tags.map(t => <Badge key={t} variant="outline" className="text-xs py-0 h-5 px-2">{t}</Badge>)}
                    <TagsManager ruleId={ruleId} activeServer={activeServer} initialTags={rule.tags || []} onUpdate={fetchRule} />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setIsChatOpen(true)}
              className="gap-2 border-purple-500/50 hover:bg-purple-50 text-purple-700 transition-all font-semibold shadow-sm mr-2"
            >
              <Sparkles className="h-4 w-4 text-purple-600" />
              Live AI Analysis
            </Button>
            {isRunning ? (
              <Button variant="outline" onClick={() => handleRuleAction("stop")}>
                <Square className="mr-2 h-4 w-4" />
                Stop
              </Button>
            ) : (
              <Button variant="outline" onClick={() => handleRuleAction("start")}>
                <Play className="mr-2 h-4 w-4" />
                Start
              </Button>
            )}
            <Button variant="outline" onClick={() => handleRuleAction("restart")}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Restart
            </Button>
            <Button variant="outline" onClick={() => router.push(`/rules/${ruleId}/tracing`)}>
              <Activity className="mr-2 h-4 w-4" />
              Tracing
            </Button>
            <Button variant="outline" onClick={() => router.push(`/rules/${ruleId}/edit`)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
            <Button variant="destructive" onClick={() => setShowDelete(true)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
            <TabsTrigger value="plan">Plan</TabsTrigger>
            <TabsTrigger value="actions">Actions</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {/* SQL Query */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Code className="h-4 w-4" />
                    SQL Query
                  </CardTitle>
                  <CardDescription>The rule&apos;s processing query</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(rule.sql)}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy
                </Button>
              </CardHeader>
              <CardContent>
                <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm">
                  <code>{rule.sql}</code>
                </pre>
              </CardContent>
            </Card>

            {/* Output Schema */}
            <RuleOutputSchemaCard ruleId={ruleId} activeServer={activeServer} />

            {/* Options */}
            {rule.options && Object.keys(rule.options).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Options</CardTitle>
                  <CardDescription>Rule configuration options</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(rule.options).map(([key, value]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <span className="font-medium">{key}</span>
                        <code className="text-sm bg-muted px-2 py-1 rounded">
                          {JSON.stringify(value)}
                        </code>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="metrics" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Runtime Metrics
                  </CardTitle>
                  <CardDescription>Real-time rule execution statistics</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refreshStatus}
                  disabled={refreshing}
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </CardHeader>
              <CardContent>
                {status ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <div className="flex items-center gap-3 rounded-lg border p-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                        <TrendingUp className="h-5 w-5 text-green-500" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Status</p>
                        <p className="font-semibold">{status.status}</p>
                      </div>
                    </div>
                    {status.lastStartTimestamp && (
                      <div className="flex items-center gap-3 rounded-lg border p-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                          <Clock className="h-5 w-5 text-blue-500" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Last Started</p>
                          <p className="font-semibold">
                            {new Date(status.lastStartTimestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    )}
                    {Object.entries(status).map(([key, value]) => {
                      if (["status", "lastStartTimestamp", "lastStopTimestamp"].includes(key)) return null;
                      if (typeof value === "object") return null;
                      return (
                        <div key={key} className="flex items-center gap-3 rounded-lg border p-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                            <AlertCircle className="h-5 w-5 text-purple-500" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">{key}</p>
                            <p className="font-semibold">{String(value)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No metrics available</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="actions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Sink Actions</CardTitle>
                <CardDescription>Output destinations for processed data</CardDescription>
              </CardHeader>
              <CardContent>
                {rule.actions && rule.actions.length > 0 ? (
                  <div className="space-y-4">
                    {rule.actions.map((action, index) => (
                      <div key={index} className="rounded-lg border p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">Action {index + 1}</Badge>
                          {Object.keys(action).map((sinkType) => (
                            <Badge key={sinkType}>{sinkType}</Badge>
                          ))}
                        </div>
                        <pre className="text-sm bg-muted p-3 rounded-lg overflow-x-auto">
                          <code>{JSON.stringify(action, null, 2)}</code>
                        </pre>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No actions configured</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="plan" className="space-y-4">
            <RuleExplainView ruleId={ruleId} activeServer={activeServer} sql={rule?.sql} aiModels={aiModels} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        title="Delete Rule"
        description={`Are you sure you want to delete the rule "${ruleId}"? This will stop any running processing and cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
      />
      {/* AI Assistant Copilot Side Panel */}
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
                <SheetTitle className="text-2xl font-black tracking-tight text-white leading-tight">Insight <span className="text-purple-200">Engineer</span></SheetTitle>
                <SheetDescription className="text-purple-100/80 font-medium text-xs uppercase tracking-widest mt-0.5">Rule Performance Copilot</SheetDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => { setMessages([]); }} className="text-white/60 hover:text-white hover:bg-white/10">
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
                          <Activity className="h-8 w-8 text-purple-600" />
                        </div>
                        <div className="space-y-2">
                          <p className="text-lg font-bold text-slate-800 tracking-tight">System Analysis Active.</p>
                          <p className="text-xs text-slate-500 italic leading-relaxed font-medium text-center">
                            I have full access to rule <b>&quot;{ruleId}&quot;</b>. Ask me to explain the logic, check for bottlenecking, or analyze error rates.
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
                      <div className="bg-white rounded-full px-4 py-2 text-[10px] font-bold text-purple-400 uppercase tracking-widest flex items-center justify-center border border-purple-100 shadow-sm">
                        Analyzing Rule Telemetry...
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
                placeholder="Ask about performance or logic..."
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
              <p className="text-[9px] text-slate-600 font-extrabold uppercase tracking-[0.2em] bg-white/40 px-3 py-1.5 rounded-full border border-slate-300/50">Live Analysis Mode</p>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
