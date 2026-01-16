"use client";

import * as React from "react";
import { useServerStore } from "@/stores/server-store";
import { AppLayout } from "@/components/layout";
import { DataTable } from "@/components/common/data-table";
import { StatusBadge, EmptyState, ErrorState, ConfirmDialog } from "@/components/common";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface Rule {
  id: string;
  status?: string;
  name?: string;
}

export default function RulesPage() {
  const router = useRouter();
  const { servers, activeServerId } = useServerStore();
  const activeServer = servers.find((s) => s.id === activeServerId);

  const [rules, setRules] = React.useState<Rule[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [deleteRule, setDeleteRule] = React.useState<string | null>(null);

  const fetchRules = React.useCallback(async () => {
    if (!activeServer) {
      setError("No server selected");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/ekuiper/rules", {
        headers: {
          "X-EKuiper-URL": activeServer.url,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch rules: ${response.status}`);
      }

      const data = await response.json();
      // eKuiper can return:
      // 1. Direct array: [{ id, status }, ...]
      // 2. Wrapped object: { value: [{ id, status }, ...], Count: n }
      let ruleList: Rule[] = [];
      if (Array.isArray(data)) {
        ruleList = data;
      } else if (data && Array.isArray(data.value)) {
        ruleList = data.value;
      }
      setRules(ruleList);
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
      const response = await fetch(`/api/ekuiper/rules/${deleteRule}`, {
        method: "DELETE",
        headers: {
          "X-EKuiper-URL": activeServer.url,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to delete rule: ${response.status}`);
      }

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
      const response = await fetch(`/api/ekuiper/rules/${ruleId}/${action}`, {
        method: "POST",
        headers: {
          "X-EKuiper-URL": activeServer.url,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to ${action} rule: ${response.status}`);
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

  const columns: ColumnDef<Rule>[] = [
    {
      accessorKey: "id",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Rule ID
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Workflow className="h-4 w-4 text-green-500" />
          <span className="font-medium">{row.getValue("id")}</span>
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        return (
          <StatusBadge
            status={getStatusVariant(status)}
            label={status || "Unknown"}
          />
        );
      },
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
              <DropdownMenuItem
                onClick={() => router.push(`/rules/${rule.id}`)}
              >
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push(`/rules/${rule.id}/status`)}
              >
                <Activity className="mr-2 h-4 w-4" />
                View Metrics
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push(`/rules/${rule.id}/topology`)}
              >
                <GitBranch className="mr-2 h-4 w-4" />
                View Topology
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push(`/rules/${rule.id}/explain`)}
              >
                <FileCode className="mr-2 h-4 w-4" />
                Query Plan
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push(`/rules/${rule.id}/tracing`)}
              >
                <Radio className="mr-2 h-4 w-4" />
                Tracing
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push(`/rules/${rule.id}/edit`)}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {isRunning ? (
                <DropdownMenuItem onClick={() => handleRuleAction(rule.id, "stop")}>
                  <Square className="mr-2 h-4 w-4" />
                  Stop
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => handleRuleAction(rule.id, "start")}>
                  <Play className="mr-2 h-4 w-4" />
                  Start
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => handleRuleAction(rule.id, "restart")}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Restart
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setDeleteRule(rule.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
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

        {/* Data Table */}
        <DataTable
          columns={columns}
          data={rules}
          searchKey="id"
          searchPlaceholder="Search rules..."
          loading={loading}
          emptyMessage="No rules found"
          emptyDescription="Create your first rule to start processing stream data."
          onRefresh={fetchRules}
        />
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
