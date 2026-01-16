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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type ColumnDef } from "@tanstack/react-table";
import {
  Plus,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  Database,
  ArrowUpDown,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface Stream {
  name: string;
  streamType?: string;
  statement?: string;
}

export default function StreamsPage() {
  const router = useRouter();
  const { servers, activeServerId } = useServerStore();
  const activeServer = servers.find((s) => s.id === activeServerId);

  const [streams, setStreams] = React.useState<Stream[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [deleteStream, setDeleteStream] = React.useState<string | null>(null);

  const fetchStreams = React.useCallback(async () => {
    if (!activeServer) {
      setError("No server selected");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/ekuiper/streams", {
        headers: {
          "X-EKuiper-URL": activeServer.url,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch streams: ${response.status}`);
      }

      const data = await response.json();
      // eKuiper returns array of stream names
      const streamList = Array.isArray(data)
        ? data.map((name: string) => ({ name }))
        : [];
      setStreams(streamList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch streams");
    } finally {
      setLoading(false);
    }
  }, [activeServer]);

  React.useEffect(() => {
    fetchStreams();
  }, [fetchStreams]);

  const handleDeleteStream = async () => {
    if (!deleteStream || !activeServer) return;

    try {
      const response = await fetch(`/api/ekuiper/streams/${deleteStream}`, {
        method: "DELETE",
        headers: {
          "X-EKuiper-URL": activeServer.url,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to delete stream: ${response.status}`);
      }

      setDeleteStream(null);
      fetchStreams();
    } catch (err) {
      console.error("Failed to delete stream:", err);
    }
  };

  const columns: ColumnDef<Stream>[] = [
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
          <Database className="h-4 w-4 text-blue-500" />
          <span className="font-medium">{row.getValue("name")}</span>
        </div>
      ),
    },
    {
      accessorKey: "streamType",
      header: "Type",
      cell: ({ row }) => (
        <StatusBadge
          status="info"
          label={row.getValue("streamType") || "stream"}
          showIcon={false}
        />
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const stream = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => router.push(`/streams/${stream.name}`)}
              >
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push(`/streams/${stream.name}/edit`)}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setDeleteStream(stream.name)}
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
      <AppLayout title="Streams">
        <EmptyState
          title="No Server Connected"
          description="Connect to an eKuiper server to manage streams."
        />
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout title="Streams">
        <ErrorState title="Error Loading Streams" description={error} onRetry={fetchStreams} />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Streams">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Streams</h2>
            <p className="text-muted-foreground">
              Manage your eKuiper data streams and sources
            </p>
          </div>
          <Button onClick={() => router.push("/streams/new")}>
            <Plus className="mr-2 h-4 w-4" />
            Create Stream
          </Button>
        </div>

        {/* Data Table */}
        <DataTable
          columns={columns}
          data={streams}
          searchKey="name"
          searchPlaceholder="Search streams..."
          loading={loading}
          emptyMessage="No streams found"
          emptyDescription="Create your first stream to start processing data."
          onRefresh={fetchStreams}
        />
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteStream}
        onOpenChange={(open) => !open && setDeleteStream(null)}
        title="Delete Stream"
        description={`Are you sure you want to delete the stream "${deleteStream}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDeleteStream}
      />
    </AppLayout>
  );
}
