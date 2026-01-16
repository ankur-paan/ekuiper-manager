"use client";

import * as React from "react";
import { useServerStore } from "@/stores/server-store";
import { AppLayout } from "@/components/layout";
import { DataTable } from "@/components/common/data-table";
import { StatusBadge, EmptyState, ErrorState, ConfirmDialog } from "@/components/common";
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
  Eye,
  Edit,
  Trash2,
  Server,
  ArrowUpDown,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface Service {
  name: string;
  interfaces?: Record<string, unknown>;
  [key: string]: unknown;
}

interface ExternalFunction {
  name: string;
  serviceName?: string;
  [key: string]: unknown;
}

export default function ServicesPage() {
  const router = useRouter();
  const { servers, activeServerId } = useServerStore();
  const activeServer = servers.find((s) => s.id === activeServerId);

  const [activeTab, setActiveTab] = React.useState<"services" | "functions">("services");
  const [services, setServices] = React.useState<Service[]>([]);
  const [functions, setFunctions] = React.useState<ExternalFunction[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [deleteService, setDeleteService] = React.useState<string | null>(null);

  const fetchServices = React.useCallback(async () => {
    if (!activeServer) {
      setError("No server selected");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/ekuiper/services`, {
        headers: {
          "X-EKuiper-URL": activeServer.url,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch services: ${response.status}`);
      }

      const data = await response.json();
      const serviceList = Array.isArray(data)
        ? data.map((name: string) => ({ name }))
        : [];
      setServices(serviceList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch services");
    } finally {
      setLoading(false);
    }
  }, [activeServer]);

  const fetchFunctions = React.useCallback(async () => {
    if (!activeServer) {
      setError("No server selected");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/ekuiper/services/functions`, {
        headers: {
          "X-EKuiper-URL": activeServer.url,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch functions: ${response.status}`);
      }

      const data = await response.json();
      // Response can be an array of names or objects
      const functionList = Array.isArray(data)
        ? data.map((item: string | ExternalFunction) =>
            typeof item === "string" ? { name: item } : item
          )
        : [];
      setFunctions(functionList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch functions");
    } finally {
      setLoading(false);
    }
  }, [activeServer]);

  React.useEffect(() => {
    if (activeTab === "services") {
      fetchServices();
    } else {
      fetchFunctions();
    }
  }, [fetchServices, fetchFunctions, activeTab]);

  const handleDeleteService = async () => {
    if (!deleteService || !activeServer) return;

    try {
      const response = await fetch(`/api/ekuiper/services/${deleteService}`, {
        method: "DELETE",
        headers: {
          "X-EKuiper-URL": activeServer.url,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to delete service: ${response.status}`);
      }

      toast.success(`Service "${deleteService}" deleted successfully`);
      setDeleteService(null);
      fetchServices();
    } catch (err) {
      toast.error(`Failed to delete service: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  const serviceColumns: ColumnDef<Service>[] = [
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
          <Server className="h-4 w-4 text-blue-500" />
          <span className="font-medium">{row.getValue("name")}</span>
        </div>
      ),
    },
    {
      id: "type",
      header: "Type",
      cell: () => (
        <StatusBadge status="info" label="External Service" showIcon={false} />
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const service = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => router.push(`/services/${service.name}`)}
              >
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push(`/services/${service.name}/edit`)}
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setDeleteService(service.name)}
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

  const functionColumns: ColumnDef<ExternalFunction>[] = [
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
          <Zap className="h-4 w-4 text-yellow-500" />
          <span className="font-medium">{row.getValue("name")}</span>
        </div>
      ),
    },
    {
      accessorKey: "serviceName",
      header: "Service",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.serviceName || "-"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const func = row.original;
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/services/functions/${func.name}`)}
          >
            <Eye className="mr-2 h-4 w-4" />
            View
          </Button>
        );
      },
    },
  ];

  if (!activeServer) {
    return (
      <AppLayout title="Services">
        <EmptyState
          title="No Server Connected"
          description="Connect to an eKuiper server to manage external services."
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Services">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">External Services</h2>
            <p className="text-muted-foreground">
              Manage external services and their functions (gRPC, REST, msgpack-rpc)
            </p>
          </div>
          <Button onClick={() => router.push("/services/new")}>
            <Plus className="mr-2 h-4 w-4" />
            Register Service
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "services" | "functions")}>
          <TabsList>
            <TabsTrigger value="services">
              <Server className="mr-2 h-4 w-4" />
              Services
            </TabsTrigger>
            <TabsTrigger value="functions">
              <Zap className="mr-2 h-4 w-4" />
              Functions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="services">
            {error ? (
              <ErrorState
                title="Error Loading Services"
                description={error}
                onRetry={fetchServices}
              />
            ) : (
              <DataTable
                columns={serviceColumns}
                data={services}
                searchKey="name"
                searchPlaceholder="Search services..."
                loading={loading}
                emptyMessage="No services registered"
                emptyDescription="Register an external service to use its functions in eKuiper rules."
                onRefresh={fetchServices}
              />
            )}
          </TabsContent>

          <TabsContent value="functions">
            {error ? (
              <ErrorState
                title="Error Loading Functions"
                description={error}
                onRetry={fetchFunctions}
              />
            ) : (
              <DataTable
                columns={functionColumns}
                data={functions}
                searchKey="name"
                searchPlaceholder="Search functions..."
                loading={loading}
                emptyMessage="No external functions"
                emptyDescription="External functions are provided by registered services."
                onRefresh={fetchFunctions}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteService}
        onOpenChange={(open) => !open && setDeleteService(null)}
        title="Delete Service"
        description={`Are you sure you want to delete the service "${deleteService}"? All functions provided by this service will be unavailable.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDeleteService}
      />
    </AppLayout>
  );
}
