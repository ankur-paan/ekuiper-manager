"use client";

import * as React from "react";
import { useServerStore } from "@/stores/server-store";
import { AppLayout } from "@/components/layout";
import { DataTable } from "@/components/common/data-table";
import { StatusBadge, EmptyState, ErrorState, ConfirmDialog } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type ColumnDef } from "@tanstack/react-table";
import {
  Plus,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  Layers,
  ArrowUpDown,
  Search,
  Scan,
  RefreshCw,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface TableDetail {
  name: string;
  type: string;
  format?: string;
  kind?: "scan" | "lookup";
}

type FilterKind = "all" | "scan" | "lookup";

export default function TablesPage() {
  const router = useRouter();
  const { servers, activeServerId } = useServerStore();
  const activeServer = servers.find((s) => s.id === activeServerId);

  const [tables, setTables] = React.useState<TableDetail[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [deleteTable, setDeleteTable] = React.useState<string | null>(null);
  const [filterKind, setFilterKind] = React.useState<FilterKind>("all");

  const fetchTables = React.useCallback(async () => {
    if (!activeServer) {
      setError("No server selected");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Use /tabledetails endpoint to get kind information
      const kindParam = filterKind !== "all" ? `?kind=${filterKind}` : "";
      const response = await fetch(`/api/ekuiper/tabledetails${kindParam}`, {
        headers: {
          "X-EKuiper-URL": activeServer.url,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch tables: ${response.status}`);
      }

      const data = await response.json();
      // The /tabledetails endpoint returns an array of objects with name, type, format
      const tableList: TableDetail[] = Array.isArray(data)
        ? data.map((item: any) => ({
          name: item.name || "",
          type: item.type || "unknown",
          format: item.format || "json",
          kind: item.kind || undefined,
        }))
        : [];
      setTables(tableList);
    } catch (err) {
      // Fallback to simple /tables endpoint if /tabledetails fails
      try {
        const response = await fetch("/api/ekuiper/tables", {
          headers: {
            "X-EKuiper-URL": activeServer.url,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch tables: ${response.status}`);
        }

        const data = await response.json();
        const tableList: TableDetail[] = Array.isArray(data)
          ? data.map((name: string) => ({
            name: typeof name === "string" ? name : String(name),
            type: "unknown",
            format: "unknown",
          }))
          : [];
        setTables(tableList);
      } catch (fallbackErr) {
        setError(fallbackErr instanceof Error ? fallbackErr.message : "Failed to fetch tables");
      }
    } finally {
      setLoading(false);
    }
  }, [activeServer, filterKind]);

  React.useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  const handleDeleteTable = async () => {
    if (!deleteTable || !activeServer) return;

    try {
      const response = await fetch(`/api/ekuiper/tables/${encodeURIComponent(deleteTable)}`, {
        method: "DELETE",
        headers: {
          "X-EKuiper-URL": activeServer.url,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to delete table: ${response.status}`);
      }

      setDeleteTable(null);
      fetchTables();
    } catch (err) {
      console.error("Failed to delete table:", err);
    }
  };

  const columns: ColumnDef<TableDetail>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-purple-500" />
          <span className="font-medium">{row.getValue("name")}</span>
        </div>
      ),
    },
    {
      accessorKey: "kind",
      header: "Kind",
      cell: ({ row }) => {
        const kind = row.original.kind;
        if (kind === "lookup") {
          return (
            <div className="flex items-center gap-1.5">
              <Search className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-sm text-blue-600 dark:text-blue-400">Lookup</span>
            </div>
          );
        } else if (kind === "scan") {
          return (
            <div className="flex items-center gap-1.5">
              <Scan className="h-3.5 w-3.5 text-green-500" />
              <span className="text-sm text-green-600 dark:text-green-400">Scan</span>
            </div>
          );
        }
        return <span className="text-sm text-muted-foreground">—</span>;
      },
    },
    {
      accessorKey: "type",
      header: "Source Type",
      cell: ({ row }) => (
        <StatusBadge status="info" label={row.getValue("type") || "unknown"} showIcon={false} />
      ),
    },
    {
      accessorKey: "format",
      header: "Format",
      cell: ({ row }) => (
        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
          {row.original.format || "—"}
        </code>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const table = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => router.push(`/tables/${encodeURIComponent(table.name)}`)}
              >
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push(`/tables/${encodeURIComponent(table.name)}/edit`)}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setDeleteTable(table.name)}
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
      <AppLayout title="Tables">
        <EmptyState
          title="No Server Connected"
          description="Connect to an eKuiper server to manage tables."
        />
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout title="Tables">
        <ErrorState title="Error Loading Tables" description={error} onRetry={fetchTables} />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Tables">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Tables</h2>
            <p className="text-muted-foreground">
              Manage lookup and scan tables for JOIN operations
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={fetchTables}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={() => router.push("/tables/new")}>
              <Plus className="mr-2 h-4 w-4" />
              Create Table
            </Button>
          </div>
        </div>

        {/* Kind Filter Tabs */}
        <Tabs value={filterKind} onValueChange={(v) => setFilterKind(v as FilterKind)}>
          <TabsList>
            <TabsTrigger value="all">
              <Layers className="mr-2 h-4 w-4" />
              All Tables
            </TabsTrigger>
            <TabsTrigger value="lookup">
              <Search className="mr-2 h-4 w-4" />
              Lookup
            </TabsTrigger>
            <TabsTrigger value="scan">
              <Scan className="mr-2 h-4 w-4" />
              Scan
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Data Table */}
        <DataTable
          columns={columns}
          data={tables}
          searchKey="name"
          searchPlaceholder="Search tables..."
          loading={loading}
          emptyMessage={filterKind !== "all" ? `No ${filterKind} tables found` : "No tables found"}
          emptyDescription={filterKind !== "all"
            ? `Create a ${filterKind} table to get started.`
            : "Create your first table for lookup operations."}
          onRefresh={fetchTables}
        />

        {/* Table Type Info Cards */}
        {tables.length === 0 && !loading && (
          <div className="grid gap-4 md:grid-cols-2 mt-6">
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Search className="h-5 w-5 text-blue-500" />
                <h3 className="font-semibold">Lookup Tables</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Reference external data (file, memory, Redis, SQL) for point queries and JOIN operations.
                Ideal for static reference data and configuration lookups.
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Scan className="h-5 w-5 text-green-500" />
                <h3 className="font-semibold">Scan Tables</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Accumulate streaming data in memory like a snapshot.
                Good for smaller datasets, state accumulation, and changelog-style updates.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTable}
        onOpenChange={(open) => !open && setDeleteTable(null)}
        title="Delete Table"
        description={`Are you sure you want to delete the table "${deleteTable}"? This action cannot be undone. Any rules using this table will fail.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDeleteTable}
      />
    </AppLayout>
  );
}
