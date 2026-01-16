"use client";

import * as React from "react";
import { useServerStore } from "@/stores/server-store";
import { AppLayout } from "@/components/layout";
import { DataTable } from "@/components/common/data-table";
import { EmptyState, ErrorState } from "@/components/common";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type ColumnDef } from "@tanstack/react-table";
import {
  MoreHorizontal,
  Eye,
  ArrowUpDown,
  Code2,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface UDF {
  name: string;
  plugin?: string;
  [key: string]: unknown;
}

export default function UDFsPage() {
  const router = useRouter();
  const { servers, activeServerId } = useServerStore();
  const activeServer = servers.find((s) => s.id === activeServerId);

  const [udfs, setUdfs] = React.useState<UDF[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchUDFs = React.useCallback(async () => {
    if (!activeServer) {
      setError("No server selected");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/ekuiper/plugins/udfs", {
        headers: {
          "X-EKuiper-URL": activeServer.url,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch UDFs: " + response.status);
      }

      const data = await response.json();
      // Response can be an array of names or objects
      const udfList = Array.isArray(data)
        ? data.map((item: string | UDF) =>
            typeof item === "string" ? { name: item } : item
          )
        : [];
      setUdfs(udfList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch UDFs");
    } finally {
      setLoading(false);
    }
  }, [activeServer]);

  React.useEffect(() => {
    fetchUDFs();
  }, [fetchUDFs]);

  const columns: ColumnDef<UDF>[] = [
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
          <Code2 className="h-4 w-4 text-purple-500" />
          <span className="font-medium font-mono">{row.getValue("name")}</span>
        </div>
      ),
    },
    {
      accessorKey: "plugin",
      header: "Plugin",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.plugin || "-"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const udf = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => router.push("/plugins/udfs/" + udf.name)}
              >
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  if (!activeServer) {
    return (
      <AppLayout title="User-Defined Functions">
        <EmptyState
          title="No Server Connected"
          description="Connect to an eKuiper server to view user-defined functions."
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="User-Defined Functions">
      <div className="space-y-4">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold tracking-tight">User-Defined Functions</h2>
          <p className="text-muted-foreground">
            Custom functions available in eKuiper SQL queries
          </p>
        </div>

        {/* Table */}
        {error ? (
          <ErrorState
            title="Error Loading UDFs"
            description={error}
            onRetry={fetchUDFs}
          />
        ) : (
          <DataTable
            columns={columns}
            data={udfs}
            searchKey="name"
            searchPlaceholder="Search functions..."
            loading={loading}
            emptyMessage="No user-defined functions"
            emptyDescription="Install function plugins or register external services to add custom functions."
            onRefresh={fetchUDFs}
          />
        )}
      </div>
    </AppLayout>
  );
}
