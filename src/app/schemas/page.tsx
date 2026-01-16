"use client";

import * as React from "react";
import { useServerStore } from "@/stores/server-store";
import { ekuiperClient } from "@/lib/ekuiper/client";
import { AppLayout } from "@/components/layout";
import { DataTable } from "@/components/common/data-table";
import { EmptyState, ErrorState, ConfirmDialog } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  FileJson,
  Trash2,
  FileCode,
  ArrowUpDown,
  FileType,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface SchemaItem {
  name: string;
}

export default function SchemasPage() {
  const router = useRouter();
  const { servers, activeServerId } = useServerStore();
  const activeServer = servers.find((s) => s.id === activeServerId);

  const [activeTab, setActiveTab] = React.useState<"protobuf" | "avro" | "custom">("protobuf");
  const [data, setData] = React.useState<SchemaItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [deleteParams, setDeleteParams] = React.useState<{ type: string, name: string } | null>(null);

  const fetchData = React.useCallback(async () => {
    if (!activeServer) return;

    setLoading(true);
    setError(null);
    ekuiperClient.setBaseUrl(activeServer.url);

    try {
      const list = await ekuiperClient.listSchemas(activeTab);
      const items = Array.isArray(list) ? list.map(name => ({ name })) : [];
      setData(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch schemas");
    } finally {
      setLoading(false);
    }
  }, [activeServer, activeTab]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async () => {
    if (!deleteParams || !activeServer) return;

    try {
      await ekuiperClient.deleteSchema(deleteParams.type, deleteParams.name);
      toast.success(`Schema "${deleteParams.name}" deleted successfully`);
      setDeleteParams(null);
      fetchData();
    } catch (err) {
      toast.error(`Failed to delete schema: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  const columns: ColumnDef<SchemaItem>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Schema Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <FileCode className="h-4 w-4 text-blue-500" />
          <span className="font-medium font-mono">{row.getValue("name")}</span>
        </div>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => router.push(`/schemas/${activeTab}/${row.original.name}`)}
            >
              <FileType className="mr-2 h-4 w-4" />
              View / Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => setDeleteParams({ type: activeTab, name: row.original.name })}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  if (!activeServer) {
    return (
      <AppLayout title="Schemas">
        <EmptyState title="No Server Connected" description="Connect to an eKuiper server to manage schemas." />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Schemas">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Schemas</h2>
            <p className="text-muted-foreground">
              Manage data schemas (Protobuf, Avro)
            </p>
          </div>
          <Button onClick={() => router.push(`/schemas/new?type=${activeTab}`)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Schema
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList>
            <TabsTrigger value="protobuf">Protobuf</TabsTrigger>
            <TabsTrigger value="avro">Avro</TabsTrigger>
            <TabsTrigger value="custom">Custom</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            {error ? (
              <ErrorState title="Error" description={error} onRetry={fetchData} />
            ) : (
              <DataTable
                columns={columns}
                data={data}
                searchKey="name"
                searchPlaceholder={`Search ${activeTab} schemas...`}
                loading={loading}
                emptyMessage={`No ${activeTab} schemas found`}
              />
            )}
          </TabsContent>
        </Tabs>

        <ConfirmDialog
          open={!!deleteParams}
          onOpenChange={(open) => !open && setDeleteParams(null)}
          title="Delete Schema"
          description={`Are you sure you want to delete schema "${deleteParams?.name}"? Streams using this schema may fail.`}
          onConfirm={handleDelete}
          variant="danger"
        />
      </div>
    </AppLayout>
  );
}
