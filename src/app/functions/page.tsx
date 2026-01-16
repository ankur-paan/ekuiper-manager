"use client";

import * as React from "react";
import { useServerStore } from "@/stores/server-store";
import { ekuiperClient } from "@/lib/ekuiper/client";
import { AppLayout } from "@/components/layout";
import { DataTable } from "@/components/common/data-table";
import { StatusBadge, EmptyState, ErrorState, ConfirmDialog } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    Code2,
    Network,
    ArrowUpDown,
    FileCode,
    BookOpen,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ExternalFunction } from "@/lib/ekuiper/types";

// Helper type for JSUDF list items
interface JSUDFListItem {
    id: string;
}

export default function FunctionsPage() {
    const router = useRouter();
    const { servers, activeServerId } = useServerStore();
    const activeServer = servers.find((s) => s.id === activeServerId);

    const [activeTab, setActiveTab] = React.useState("javascript");
    const [jsUdfs, setJsUdfs] = React.useState<JSUDFListItem[]>([]);
    const [externalFuncs, setExternalFuncs] = React.useState<ExternalFunction[]>([]);
    const [builtinFuncs, setBuiltinFuncs] = React.useState<Record<string, string[]>>({});
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [deleteId, setDeleteId] = React.useState<string | null>(null);

    const fetchData = React.useCallback(async () => {
        if (!activeServer) return;

        setLoading(true);
        setError(null);
        ekuiperClient.setBaseUrl(activeServer.url);

        try {
            if (activeTab === "javascript") {
                const data = await ekuiperClient.listJSUDFs();
                // Handle if API returns null/undefined
                const list = Array.isArray(data) ? data.map(id => ({ id })) : [];
                setJsUdfs(list);
            } else if (activeTab === "services") {
                const data = await ekuiperClient.listExternalFunctions();
                setExternalFuncs(data || []);
            } else if (activeTab === "reference") {
                const data = await ekuiperClient.listBuiltinFunctions();
                setBuiltinFuncs(data || {});
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to fetch functions");
        } finally {
            setLoading(false);
        }
    }, [activeServer, activeTab]);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleDeleteJSUDF = async () => {
        if (!deleteId || !activeServer) return;

        try {
            await ekuiperClient.deleteJSUDF(deleteId);
            toast.success(`Function "${deleteId}" deleted successfully`);
            setDeleteId(null);
            fetchData();
        } catch (err) {
            toast.error(`Failed to delete function: ${err instanceof Error ? err.message : "Unknown error"}`);
        }
    };

    const jsColumns: ColumnDef<JSUDFListItem>[] = [
        {
            accessorKey: "id",
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                >
                    Function ID
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <Code2 className="h-4 w-4 text-yellow-500" />
                    <span className="font-medium font-mono">{row.getValue("id")}</span>
                </div>
            ),
        },
        {
            id: "actions",
            header: "Actions",
            cell: ({ row }) => {
                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem
                                onClick={() => router.push(`/functions/javascript/${row.original.id}`)}
                            >
                                <FileCode className="mr-2 h-4 w-4" />
                                Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setDeleteId(row.original.id)}
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

    const extColumns: ColumnDef<ExternalFunction>[] = [
        {
            accessorKey: "name",
            header: "Function Name",
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <Network className="h-4 w-4 text-blue-500" />
                    <span className="font-medium">{row.getValue("name")}</span>
                </div>
            ),
        },
        {
            accessorKey: "serviceName",
            header: "Service",
            cell: ({ row }) => (
                <StatusBadge status="default" label={row.getValue("serviceName")} showIcon={false} />
            ),
        },
        {
            accessorKey: "interfaceName",
            header: "Interface",
        },
        {
            id: "actions",
            cell: ({ row }) => (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push(`/services/functions/${row.original.name}`)}
                >
                    <Eye className="h-4 w-4" />
                </Button>
            )
        }
    ];

    if (!activeServer) {
        return (
            <AppLayout title="Functions">
                <EmptyState
                    title="No Server Connected"
                    description="Connect to an eKuiper server to manage functions."
                />
            </AppLayout>
        );
    }

    return (
        <AppLayout title="Functions">
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">Functions</h2>
                        <p className="text-muted-foreground">
                            Manage custom and built-in functions
                        </p>
                    </div>
                    {activeTab === "javascript" && (
                        <Button onClick={() => router.push("/functions/javascript/new")}>
                            <Plus className="mr-2 h-4 w-4" />
                            Create Function
                        </Button>
                    )}
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList>
                        <TabsTrigger value="javascript">
                            <Code2 className="mr-2 h-4 w-4" />
                            JavaScript UDFs
                        </TabsTrigger>
                        <TabsTrigger value="services">
                            <Network className="mr-2 h-4 w-4" />
                            Service Functions
                        </TabsTrigger>
                        <TabsTrigger value="reference">
                            <BookOpen className="mr-2 h-4 w-4" />
                            Built-in Reference
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="javascript">
                        {error ? (
                            <ErrorState title="Error" description={error} onRetry={fetchData} />
                        ) : (
                            <DataTable
                                columns={jsColumns}
                                data={jsUdfs}
                                searchKey="id"
                                searchPlaceholder="Search UDFs..."
                                loading={loading}
                                emptyMessage="No JavaScript UDFs found"
                            />
                        )}
                    </TabsContent>

                    <TabsContent value="services">
                        {error ? (
                            <ErrorState title="Error" description={error} onRetry={fetchData} />
                        ) : (
                            <DataTable
                                columns={extColumns}
                                data={externalFuncs}
                                searchKey="name"
                                searchPlaceholder="Search service functions..."
                                loading={loading}
                                emptyMessage="No external functions found"
                            />
                        )}
                    </TabsContent>

                    <TabsContent value="reference">
                        {error ? (
                            <ErrorState title="Error" description={error} onRetry={fetchData} />
                        ) : (
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {Object.entries(builtinFuncs).map(([category, funcs]) => (
                                    <Card key={category}>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="capitalize text-lg">{category}</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="flex flex-wrap gap-2">
                                                {Array.isArray(funcs) && funcs.map(f => (
                                                    <Badge key={f} variant="secondary" className="font-mono">{f}</Badge>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                                {Object.keys(builtinFuncs).length === 0 && !loading && (
                                    <div className="col-span-full">
                                        <EmptyState title="No Built-in Functions Found" description="Could not load built-in function reference." />
                                    </div>
                                )}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>

                <ConfirmDialog
                    open={!!deleteId}
                    onOpenChange={(open) => !open && setDeleteId(null)}
                    title="Delete Function"
                    description={`Are you sure you want to delete function "${deleteId}"? Rules using this function may stop working.`}
                    onConfirm={handleDeleteJSUDF}
                    variant="danger"
                />
            </div>
        </AppLayout>
    );
}
