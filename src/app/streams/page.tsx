"use client";

import * as React from "react";
import { useServerStore } from "@/stores/server-store";
import { AppLayout } from "@/components/layout";
import { DataTable } from "@/components/common/data-table";
import { StatusBadge, EmptyState, ErrorState, ConfirmDialog } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Share2,
  Wifi,
  FileJson,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// StreamDetail type matching /streamdetails endpoint response
interface StreamDetail {
  name: string;
  type: string;
  format?: string;
  datasource?: string;
  confKey?: string;
  shared?: boolean;
}

export default function StreamsPage() {
  const router = useRouter();
  const { servers, activeServerId } = useServerStore();
  const activeServer = servers.find((s) => s.id === activeServerId);

  const [streams, setStreams] = React.useState<StreamDetail[]>([]);
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
      // Use /streamdetails for rich information (type, format, datasource)
      const response = await fetch("/api/ekuiper/streamdetails", {
        headers: {
          "X-EKuiper-URL": activeServer.url,
        },
      });

      if (!response.ok) {
        // Fallback to basic /streams endpoint
        const basicResponse = await fetch("/api/ekuiper/streams", {
          headers: {
            "X-EKuiper-URL": activeServer.url,
          },
        });
        if (!basicResponse.ok) {
          throw new Error(`Failed to fetch streams: ${basicResponse.status}`);
        }
        const basicData = await basicResponse.json();
        const streamList = Array.isArray(basicData)
          ? basicData.map((name: string) => ({ name, type: "unknown" }))
          : [];
        setStreams(streamList);
        return;
      }

      const data = await response.json();
      setStreams(Array.isArray(data) ? data : []);
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

  // Map source types to icons and colors
  const getTypeStyle = (type: string) => {
    const typeMap: Record<string, { color: string; label: string }> = {
      mqtt: { color: "bg-purple-500/10 text-purple-500 border-purple-500/20", label: "MQTT" },
      httppull: { color: "bg-blue-500/10 text-blue-500 border-blue-500/20", label: "HTTP Pull" },
      httppush: { color: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20", label: "HTTP Push" },
      memory: { color: "bg-amber-500/10 text-amber-500 border-amber-500/20", label: "Memory" },
      file: { color: "bg-green-500/10 text-green-500 border-green-500/20", label: "File" },
      edgex: { color: "bg-orange-500/10 text-orange-500 border-orange-500/20", label: "EdgeX" },
      simulator: { color: "bg-pink-500/10 text-pink-500 border-pink-500/20", label: "Simulator" },
      redis: { color: "bg-red-500/10 text-red-500 border-red-500/20", label: "Redis" },
      neuron: { color: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20", label: "Neuron" },
    };
    return typeMap[type?.toLowerCase()] || { color: "bg-gray-500/10 text-gray-500 border-gray-500/20", label: type || "Unknown" };
  };

  const getFormatStyle = (format: string) => {
    const formatMap: Record<string, { color: string; icon: React.ReactNode }> = {
      json: { color: "text-emerald-500", icon: <FileJson className="h-3.5 w-3.5" /> },
      binary: { color: "text-amber-500", icon: <Wifi className="h-3.5 w-3.5" /> },
      protobuf: { color: "text-blue-500", icon: <Database className="h-3.5 w-3.5" /> },
      delimited: { color: "text-purple-500", icon: <FileJson className="h-3.5 w-3.5" /> },
    };
    return formatMap[format?.toLowerCase()] || { color: "text-muted-foreground", icon: null };
  };

  const columns: ColumnDef<StreamDetail>[] = [
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
          {row.original.shared && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Share2 className="h-3.5 w-3.5 text-green-500" />
                </TooltipTrigger>
                <TooltipContent>Shared Stream</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      ),
    },
    {
      accessorKey: "type",
      header: "Source Type",
      cell: ({ row }) => {
        const style = getTypeStyle(row.original.type);
        return (
          <Badge variant="outline" className={`${style.color} font-medium`}>
            {style.label}
          </Badge>
        );
      },
    },
    {
      accessorKey: "format",
      header: "Format",
      cell: ({ row }) => {
        const format = row.original.format;
        if (!format) return <span className="text-muted-foreground text-sm">-</span>;
        const style = getFormatStyle(format);
        return (
          <div className={`flex items-center gap-1.5 ${style.color}`}>
            {style.icon}
            <span className="text-sm font-medium uppercase">{format}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "datasource",
      header: "Datasource",
      cell: ({ row }) => {
        const datasource = row.original.datasource;
        if (!datasource) return <span className="text-muted-foreground text-sm">-</span>;
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <code className="text-xs bg-muted px-2 py-1 rounded font-mono max-w-[200px] truncate block">
                  {datasource}
                </code>
              </TooltipTrigger>
              <TooltipContent className="max-w-[400px]">
                <code className="text-xs">{datasource}</code>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      },
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
