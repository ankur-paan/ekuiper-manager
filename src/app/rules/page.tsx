"use client";

import * as React from "react";
import { useServerStore } from "@/stores/server-store";
import { AppLayout } from "@/components/layout";
import { DataTable } from "@/components/common/data-table";
import { StatusBadge, EmptyState, ErrorState, ConfirmDialog } from "@/components/common";
import { ekuiperClient } from "@/lib/ekuiper/client";
import { BatchRequestItem } from "@/lib/ekuiper/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type ColumnDef } from "@tanstack/react-table";
import {
  Plus,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  Workflow,
  ArrowUpDown,
  Play,
  Square,
  RotateCcw,
  Activity,
  Gauge,
  GitBranch,
  FileCode,
  FlaskConical,
  Radio,
  ArrowRight,
  Code2,
  MessageSquare,
  Tag,
  Filter,
  LayoutGrid,
  List,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

interface Rule {
  id: string;
  status?: string;
  name?: string;
  sql?: string;
  actions?: Array<Record<string, unknown>>;
  metrics?: Record<string, any>;
  tags?: string[];
}

export default function RulesPage() {
  const router = useRouter();
  const { servers, activeServerId } = useServerStore();
  const activeServer = servers.find((s) => s.id === activeServerId);

  const [rules, setRules] = React.useState<Rule[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [deleteRule, setDeleteRule] = React.useState<string | null>(null);
  const [activeTag, setActiveTag] = React.useState<string | null>(null);
  const [viewMode, setViewMode] = React.useState<'list' | 'grid'>('grid');

  const fetchRules = React.useCallback(async () => {
    if (!activeServer) {
      setError("No server selected");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      ekuiperClient.setBaseUrl(activeServer.url);

      // 1. Get List of Rules (IDs & Status)
      const basicList = await ekuiperClient.listRules();

      if (basicList.length === 0) {
        setRules([]);
        setLoading(false);
        return;
      }

      // 2. Batch Request for Details (SQL, Actions) AND Status Metrics
      // We want: GET /rules/{id} and GET /rules/{id}/status for each rule
      const defRequests = basicList.map(r => ({ method: "GET" as const, path: `/rules/${r.id}` }));
      const statRequests = basicList.map(r => ({ method: "GET" as const, path: `/rules/${r.id}/status` }));

      const requests: BatchRequestItem[] = [...defRequests, ...statRequests];

      try {
        const responses = await ekuiperClient.batchRequest(requests);
        const count = basicList.length;

        // 3. Merge Data
        const mergedRules: Rule[] = basicList.map((basicRule, index) => {
          const defRes = responses[index];
          const statRes = responses[index + count];

          let detail: any = {};
          let metrics: any = {};

          if (defRes.code === 200) {
            try { detail = JSON.parse(defRes.response); } catch { /* ignore */ }
          }
          if (statRes.code === 200) {
            try { metrics = JSON.parse(statRes.response); } catch { /* ignore */ }
          }

          return {
            ...basicRule,
            sql: detail.sql || "",
            actions: detail.actions || [],
            metrics,
            tags: detail.tags || []
          };
        });

        setRules(mergedRules.filter(r => !r.tags?.includes("__test_sample__")));

      } catch (batchError) {
        console.warn("Batch request failed, falling back to basic list", batchError);
        setRules(basicList);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch rules");
    } finally {
      setLoading(false);
    }
  }, [activeServer]);

  React.useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const handleDeleteRule = async () => {
    if (!deleteRule || !activeServer) return;

    try {
      ekuiperClient.setBaseUrl(activeServer.url);
      await ekuiperClient.deleteRule(deleteRule);

      toast.success(`Rule "${deleteRule}" deleted successfully`);
      setDeleteRule(null);
      fetchRules();
    } catch (err) {
      toast.error(`Failed to delete rule: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  const handleRuleAction = async (ruleId: string, action: "start" | "stop" | "restart") => {
    if (!activeServer) return;

    try {
      ekuiperClient.setBaseUrl(activeServer.url);

      if (action === "start") {
        await ekuiperClient.startRule(ruleId);
      } else if (action === "stop") {
        await ekuiperClient.stopRule(ruleId);
      } else if (action === "restart") {
        await ekuiperClient.restartRule(ruleId);
      }

      toast.success(`Rule "${ruleId}" ${action}ed successfully`);
      fetchRules();
    } catch (err) {
      toast.error(`Failed to ${action} rule: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  const getStatusVariant = (status?: string): "running" | "stopped" | "error" | "info" => {
    if (!status) return "info";
    const s = status.toLowerCase();
    if (s.includes("running")) return "running";
    if (s.includes("stopped") || s.includes("stop")) return "stopped";
    if (s.includes("error") || s.includes("fail")) return "error";
    return "info";
  };

  const getPipelineInfo = (rule: Rule) => {
    const sources = [];
    if (rule.sql) {
      // Simple regex to find FROM table/stream
      const fromMatch = rule.sql.match(/FROM\s+([a-zA-Z0-9_]+)/i);
      if (fromMatch) sources.push(fromMatch[1]);
    }
    const sinks = rule.actions ? rule.actions.flatMap(a => Object.keys(a)) : [];
    return { sources, sinks };
  };

  const columns: ColumnDef<Rule>[] = [
    {
      accessorKey: "id",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Rule Details
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const rule = row.original;
        return (
          <div className="flex flex-col gap-1 max-w-[200px]">
            <div className="flex items-center gap-2 font-medium">
              <Workflow className="h-4 w-4 text-primary" />
              <span>{rule.id}</span>
            </div>
            {rule.sql && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground truncate" title={rule.sql}>
                <Code2 className="h-3 w-3 inline" />
                <span className="truncate font-mono">{rule.sql}</span>
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: "pipeline",
      header: "Pipeline Flow",
      cell: ({ row }) => {
        const { sources, sinks } = getPipelineInfo(row.original);
        if (sources.length === 0 && sinks.length === 0) return <span className="text-muted-foreground">-</span>;

        return (
          <div className="flex items-center gap-2 text-sm">
            <div className="flex gap-1">
              {sources.map(s => (
                <Badge key={s} variant="outline" className="bg-blue-50/50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                  {s}
                </Badge>
              ))}
            </div>
            {(sources.length > 0 || sinks.length > 0) && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
            <div className="flex gap-1 flex-wrap">
              {sinks.map((s, i) => (
                <Badge key={i} variant="outline" className="bg-orange-50/50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800">
                  {s}
                </Badge>
              ))}
            </div>
          </div>
        );
      }
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        const isRunning = status?.toLowerCase().includes("running");
        const ruleId = row.original.id;

        return (
          <div className="flex items-center gap-3">
            <Switch
              checked={isRunning}
              onCheckedChange={(checked) => handleRuleAction(ruleId, checked ? "start" : "stop")}
            />
            <StatusBadge
              status={getStatusVariant(status)}
              label={status || "Unknown"}
            />
          </div>
        );
      },
    },
    {
      accessorKey: "metrics",
      header: "Metrics",
      cell: ({ row }) => {
        const m = row.original.metrics;
        if (!m || Object.keys(m).length === 0) return <span className="text-muted-foreground text-xs">-</span>;

        // Find throughput
        let inCount = 0;
        let outCount = 0;

        Object.keys(m).forEach(k => {
          if (k.endsWith("records_in_total")) inCount = m[k];
          if (k.endsWith("records_out_total")) outCount = m[k];
        });

        return (
          <div className="flex flex-col text-xs font-mono">
            <div className="flex items-center gap-1 text-blue-600">
              <span className="font-bold">In:</span> {inCount}
            </div>
            <div className="flex items-center gap-1 text-green-600">
              <span className="font-bold">Out:</span> {outCount}
            </div>
          </div>
        )
      }
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const rule = row.original;
        const isRunning = rule.status?.toLowerCase().includes("running");

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push(`/rules/${rule.id}`)}>
                <Eye className="mr-2 h-4 w-4" /> View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(`/rules/${rule.id}/status`)}>
                <Activity className="mr-2 h-4 w-4" /> Metrics
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(`/rules/${rule.id}/topology`)}>
                <GitBranch className="mr-2 h-4 w-4" /> Topology
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleRuleAction(rule.id, "restart")}>
                <RotateCcw className="mr-2 h-4 w-4" /> Restart
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={() => setDeleteRule(rule.id)}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  if (!activeServer) {
    return (
      <AppLayout title="Rules">
        <EmptyState
          title="No Server Connected"
          description="Connect to an eKuiper server to manage rules."
        />
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout title="Rules">
        <ErrorState title="Error Loading Rules" description={error} onRetry={fetchRules} />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Rules">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Rules</h2>
            <p className="text-muted-foreground">
              Manage stream processing rules and their execution
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => router.push("/rules/playground")}>
              <FlaskConical className="mr-2 h-4 w-4" />
              Playground
            </Button>
            <Button variant="outline" onClick={() => router.push("/rules/dashboard")}>
              <Gauge className="mr-2 h-4 w-4" />
              Dashboard
            </Button>
            <Button onClick={() => router.push("/rules/new")}>
              <Plus className="mr-2 h-4 w-4" />
              Create Rule
            </Button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex items-center justify-end gap-2">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={activeTag || "all"} onValueChange={(v) => setActiveTag(v === "all" ? null : v)}>
              <SelectTrigger className="w-[180px] h-8 bg-background">
                <SelectValue placeholder="All Tags" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tags</SelectItem>
                {Array.from(new Set(rules.flatMap(r => r.tags || []))).sort().map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex bg-muted rounded-lg p-1 h-8 items-center">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* List View */}
        {viewMode === 'list' ? (
          <DataTable
            columns={columns}
            data={activeTag ? rules.filter(r => r.tags?.includes(activeTag)) : rules}
            searchKey="id"
            searchPlaceholder="Search rules..."
            loading={loading}
            emptyMessage="No rules found"
            emptyDescription="Create your first rule to start processing stream data."
            onRefresh={fetchRules}
          />
        ) : (
          /* Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-in fade-in">
            {(activeTag ? rules.filter(r => r.tags?.includes(activeTag)) : rules).map(rule => (
              <div key={rule.id} className="group relative bg-card rounded-xl border shadow-sm hover:shadow-md hover:border-primary/20 transition-all overflow-hidden flex flex-col">
                {/* Status Border */}
                <div className={`absolute top-0 left-0 w-1 h-full ${(rule.status?.toLowerCase().includes("running")) ? "bg-green-500" :
                  (rule.status?.toLowerCase().includes("fail")) ? "bg-red-500" : "bg-slate-300"
                  }`} />

                <div className="p-4 pl-5 space-y-3 flex-1">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <h3 className="font-bold text-sm truncate pr-2 max-w-[150px]" title={rule.id}>{rule.id}</h3>
                      <div className="text-[10px] text-muted-foreground font-mono truncate max-w-[150px]">
                        {getPipelineInfo(rule).sources[0] || "Unknown Source"}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6 -mt-1 -mr-2 text-muted-foreground">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/rules/${rule.id}`)}>Edit Rule</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push(`/rules/${rule.id}/status`)}>View Metrics</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push(`/rules/${rule.id}/topology`)}>View Topology</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteRule(rule.id)}>Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="flex gap-2 flex-wrap min-h-[24px]">
                    {rule.tags && rule.tags.length > 0 ? rule.tags.map(t => (
                      <Badge key={t} variant="secondary" className="text-[10px] px-1 h-5 font-normal">{t}</Badge>
                    )) : (
                      <span className="text-[10px] text-muted-foreground/50 italic">No tags</span>
                    )}
                  </div>

                  {/* Mini Sparkline Visualization (Fake for now, but placeholder for real metrics) */}
                  <div className="h-10 w-full bg-slate-50 dark:bg-slate-900 rounded-md flex items-end gap-0.5 p-1 overflow-hidden opacity-80">
                    {[...Array(20)].map((_, i) => (
                      <div key={i} className="flex-1 bg-green-500/20 hover:bg-green-500/40 transition-colors rounded-t-sm"
                        style={{ height: `${Math.random() * 100}%` }} />
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-2 border-t">
                    <div className="flex flex-col">
                      <span className="text-muted-foreground text-[10px]">IN</span>
                      <span className="font-bold">{rule.metrics ? Object.values(rule.metrics).find((v, i, arr) => Object.keys(rule.metrics!)[i].includes("records_in")) || 0 : 0}</span>
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-muted-foreground text-[10px]">OUT</span>
                      <span className="font-bold text-green-600">{rule.metrics ? Object.values(rule.metrics).find((v, i, arr) => Object.keys(rule.metrics!)[i].includes("records_out")) || 0 : 0}</span>
                    </div>
                  </div>
                </div>

                <div className="p-2 bg-muted/30 border-t flex justify-between items-center pl-5">
                  <span className={`text-[10px] uppercase font-bold tracking-wider ${(rule.status?.toLowerCase().includes("running")) ? "text-green-600" : "text-muted-foreground"
                    }`}>
                    {rule.status?.split(':')[0] || "STOPPED"}
                  </span>
                  <Switch
                    checked={rule.status?.toLowerCase().includes("running")}
                    onCheckedChange={(c) => handleRuleAction(rule.id, c ? "start" : "stop")}
                    className="scale-75"
                  />
                </div>
              </div>
            ))}

            {/* Add New Card */}
            <div
              className="group relative bg-muted/20 rounded-xl border border-dashed hover:border-primary/50 hover:bg-muted/40 transition-all flex flex-col items-center justify-center cursor-pointer min-h-[220px] gap-3"
              onClick={() => router.push("/rules/new")}
            >
              <div className="h-10 w-10 rounded-full bg-background border shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                <Plus className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
              </div>
              <span className="text-sm font-medium text-muted-foreground">Create New Rule</span>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteRule}
        onOpenChange={(open) => !open && setDeleteRule(null)}
        title="Delete Rule"
        description={`Are you sure you want to delete the rule "${deleteRule}"? This will stop any running processing and cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDeleteRule}
      />
    </AppLayout>
  );
}
