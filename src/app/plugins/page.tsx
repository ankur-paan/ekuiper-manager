"use client";

import * as React from "react";
import { useServerStore } from "@/stores/server-store";
import { AppLayout } from "@/components/layout";
import { DataTable } from "@/components/common/data-table";
import { StatusBadge, EmptyState, ErrorState, ConfirmDialog } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  Eye,
  Trash2,
  Plug,
  ArrowUpDown,
  Code2,
  Box,
  Download,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface Plugin {
  name: string;
  version?: string;
}

type PluginType = "sources" | "sinks" | "functions" | "portables" | "udfs";

export default function PluginsPage() {
  const router = useRouter();
  const { servers, activeServerId } = useServerStore();
  const activeServer = servers.find((s) => s.id === activeServerId);

  const [activeTab, setActiveTab] = React.useState<PluginType>("sources");
  const [plugins, setPlugins] = React.useState<Plugin[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [deletePlugin, setDeletePlugin] = React.useState<{ name: string; type: PluginType } | null>(null);

  const fetchPlugins = React.useCallback(async (type: PluginType) => {
    if (!activeServer) {
      setError("No server selected");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/ekuiper/plugins/${type}`, {
        headers: {
          "X-EKuiper-URL": activeServer.url,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch plugins: ${response.status}`);
      }

      const data = await response.json();
      const pluginList = Array.isArray(data)
        ? data.map((name: string) => ({ name }))
        : [];
      setPlugins(pluginList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch plugins");
    } finally {
      setLoading(false);
    }
  }, [activeServer]);

  React.useEffect(() => {
    fetchPlugins(activeTab);
  }, [fetchPlugins, activeTab]);

  const handleDeletePlugin = async () => {
    if (!deletePlugin || !activeServer) return;

    try {
      const response = await fetch(`/api/ekuiper/plugins/${deletePlugin.type}/${deletePlugin.name}`, {
        method: "DELETE",
        headers: {
          "X-EKuiper-URL": activeServer.url,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to delete plugin: ${response.status}`);
      }

      toast.success(`Plugin "${deletePlugin.name}" deleted successfully`);
      setDeletePlugin(null);
      fetchPlugins(activeTab);
    } catch (err) {
      toast.error(`Failed to delete plugin: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  const getPluginIcon = (type: PluginType) => {
    switch (type) {
      case "sources":
        return <Plug className="h-4 w-4 text-blue-500" />;
      case "sinks":
        return <Plug className="h-4 w-4 text-green-500" />;
      case "functions":
        return <Code2 className="h-4 w-4 text-purple-500" />;
      case "portables":
        return <Box className="h-4 w-4 text-orange-500" />;
      case "udfs":
        return <Code2 className="h-4 w-4 text-yellow-500" />;
    }
  };

  const columns: ColumnDef<Plugin>[] = [
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
          {getPluginIcon(activeTab)}
          <span className="font-medium">{row.getValue("name")}</span>
        </div>
      ),
    },
    {
      id: "type",
      header: "Type",
      cell: () => (
        <StatusBadge status="info" label={activeTab.slice(0, -1)} showIcon={false} />
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const plugin = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => router.push(`/plugins/${activeTab}/${plugin.name}`)}
              >
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setDeletePlugin({ name: plugin.name, type: activeTab })}
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
      <AppLayout title="Plugins">
        <EmptyState
          title="No Server Connected"
          description="Connect to an eKuiper server to manage plugins."
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Plugins">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Plugins</h2>
            <p className="text-muted-foreground">
              Manage eKuiper source, sink, function, and portable plugins
            </p>
          </div>
          <Button onClick={() => router.push(`/plugins/${activeTab}/new`)}>
            <Plus className="mr-2 h-4 w-4" />
            Install Plugin
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as PluginType)}>
          <TabsList>
            <TabsTrigger value="sources">
              <Plug className="mr-2 h-4 w-4" />
              Sources
            </TabsTrigger>
            <TabsTrigger value="sinks">
              <Plug className="mr-2 h-4 w-4" />
              Sinks
            </TabsTrigger>
            <TabsTrigger value="functions">
              <Code2 className="mr-2 h-4 w-4" />
              Functions
            </TabsTrigger>
            <TabsTrigger value="portables">
              <Box className="mr-2 h-4 w-4" />
              Portables
            </TabsTrigger>
            <TabsTrigger value="udfs">
              <Code2 className="mr-2 h-4 w-4" />
              JS UDFs
            </TabsTrigger>
          </TabsList>

          {["sources", "sinks", "functions", "portables", "udfs"].map((type) => (
            <TabsContent key={type} value={type}>
              {error ? (
                <ErrorState
                  title="Error Loading Plugins"
                  description={error}
                  onRetry={() => fetchPlugins(activeTab)}
                />
              ) : (
                <DataTable
                  columns={columns}
                  data={plugins}
                  searchKey="name"
                  searchPlaceholder={`Search ${type}...`}
                  loading={loading}
                  emptyMessage={`No ${type} plugins found`}
                  emptyDescription={`Install a ${type.slice(0, -1)} plugin to extend eKuiper functionality.`}
                  onRefresh={() => fetchPlugins(activeTab)}
                />
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deletePlugin}
        onOpenChange={(open) => !open && setDeletePlugin(null)}
        title="Delete Plugin"
        description={`Are you sure you want to delete the plugin "${deletePlugin?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDeletePlugin}
      />
    </AppLayout>
  );
}
