"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useServerStore } from "@/stores/server-store";
import { AppLayout } from "@/components/layout";
import { LoadingPage, ErrorState, ConfirmDialog } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    ArrowLeft,
    Layers,
    Pencil,
    Trash2,
    Copy,
    Code,
    Scan,
    Search,
} from "lucide-react";

interface TableDetails {
    Name: string;
    StreamFields: Array<{ Name: string; FieldType: string | { Type: number } }> | null;
    Options: Record<string, unknown>;
    Statement?: string;
}

// Map numeric type codes to type names
const TYPE_MAP: Record<number, string> = {
    1: "bigint",
    2: "float",
    3: "string",
    4: "datetime",
    5: "boolean",
    6: "bytea",
};

function getFieldTypeName(fieldType: string | { Type: number }): string {
    if (typeof fieldType === "string") {
        return fieldType;
    }
    if (fieldType && typeof fieldType === "object" && "Type" in fieldType) {
        return TYPE_MAP[fieldType.Type] || `type(${fieldType.Type})`;
    }
    return "unknown";
}

export default function TableDetailPage() {
    const params = useParams();
    const router = useRouter();
    const tableName = params.name as string;
    const { servers, activeServerId } = useServerStore();
    const activeServer = servers.find((s) => s.id === activeServerId);

    const [table, setTable] = React.useState<TableDetails | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [showDelete, setShowDelete] = React.useState(false);

    const fetchTable = React.useCallback(async () => {
        if (!activeServer || !tableName) return;

        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/ekuiper/tables/${encodeURIComponent(tableName)}`, {
                headers: {
                    "X-EKuiper-URL": activeServer.url,
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch table: ${response.status}`);
            }

            const data = await response.json();
            setTable(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to fetch table");
        } finally {
            setLoading(false);
        }
    }, [activeServer, tableName]);

    React.useEffect(() => {
        fetchTable();
    }, [fetchTable]);

    const handleDelete = async () => {
        if (!activeServer) return;

        try {
            const response = await fetch(`/api/ekuiper/tables/${encodeURIComponent(tableName)}`, {
                method: "DELETE",
                headers: {
                    "X-EKuiper-URL": activeServer.url,
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to delete table: ${response.status}`);
            }

            router.push("/tables");
        } catch (err) {
            console.error("Failed to delete table:", err);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    // Determine table kind from options
    const tableKind = table?.Options?.KIND || table?.Options?.kind || "unknown";

    if (loading) {
        return (
            <AppLayout title={`Table: ${tableName}`}>
                <LoadingPage label="Loading table details..." />
            </AppLayout>
        );
    }

    if (error || !table) {
        return (
            <AppLayout title={`Table: ${tableName}`}>
                <ErrorState
                    title="Error Loading Table"
                    description={error || "Table not found"}
                    onRetry={fetchTable}
                />
            </AppLayout>
        );
    }

    return (
        <AppLayout title={`Table: ${tableName}`}>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => router.push("/tables")}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                                <Layers className="h-5 w-5 text-purple-500" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h1 className="text-2xl font-bold">{table.Name}</h1>
                                    <Badge variant={tableKind === "lookup" ? "default" : "secondary"}>
                                        {tableKind === "lookup" ? (
                                            <><Search className="mr-1 h-3 w-3" /> Lookup</>
                                        ) : tableKind === "scan" ? (
                                            <><Scan className="mr-1 h-3 w-3" /> Scan</>
                                        ) : (
                                            "Table"
                                        )}
                                    </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">Table Details</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={() => router.push(`/tables/${encodeURIComponent(tableName)}/edit`)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                        </Button>
                        <Button variant="destructive" onClick={() => setShowDelete(true)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                        </Button>
                    </div>
                </div>

                {/* Table Schema */}
                <Card>
                    <CardHeader>
                        <CardTitle>Schema</CardTitle>
                        <CardDescription>Table field definitions</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {table.StreamFields && table.StreamFields.length > 0 ? (
                            <div className="space-y-2">
                                {table.StreamFields.map((field, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center justify-between rounded-lg border p-3"
                                    >
                                        <span className="font-medium">{field.Name}</span>
                                        <Badge variant="outline">{getFieldTypeName(field.FieldType)}</Badge>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-muted-foreground">
                                Schema-less table (dynamic schema)
                            </p>
                        )}
                    </CardContent>
                </Card>

                {/* Table Options */}
                <Card>
                    <CardHeader>
                        <CardTitle>Options</CardTitle>
                        <CardDescription>Table configuration options</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {table.Options && Object.keys(table.Options).length > 0 ? (
                            <div className="space-y-2">
                                {Object.entries(table.Options).map(([key, value]) => (
                                    <div
                                        key={key}
                                        className="flex items-center justify-between rounded-lg border p-3"
                                    >
                                        <span className="font-medium">{key}</span>
                                        <code className="text-sm bg-muted px-2 py-1 rounded">
                                            {JSON.stringify(value)}
                                        </code>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-muted-foreground">No options configured</p>
                        )}
                    </CardContent>
                </Card>

                {/* SQL Statement */}
                {table.Statement && (
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <Code className="h-4 w-4" />
                                    SQL Statement
                                </CardTitle>
                                <CardDescription>Table definition SQL</CardDescription>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => copyToClipboard(table.Statement || "")}
                            >
                                <Copy className="mr-2 h-4 w-4" />
                                Copy
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm">
                                <code>{table.Statement}</code>
                            </pre>
                        </CardContent>
                    </Card>
                )}

                {/* Table Type Info */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            {tableKind === "lookup" ? (
                                <Search className="h-4 w-4" />
                            ) : (
                                <Scan className="h-4 w-4" />
                            )}
                            Table Type: {tableKind === "lookup" ? "Lookup Table" : tableKind === "scan" ? "Scan Table" : "Unknown"}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {tableKind === "lookup" ? (
                            <div className="space-y-2 text-sm text-muted-foreground">
                                <p><strong>Lookup Tables</strong> are designed for point queries and JOIN operations.</p>
                                <ul className="list-disc list-inside space-y-1">
                                    <li>Data is stored externally (file, memory, Redis, SQL)</li>
                                    <li>Queried on-demand during rule execution</li>
                                    <li>Ideal for reference data, configuration, or enrichment</li>
                                    <li>Content can be shared across multiple rules</li>
                                </ul>
                            </div>
                        ) : tableKind === "scan" ? (
                            <div className="space-y-2 text-sm text-muted-foreground">
                                <p><strong>Scan Tables</strong> accumulate data in memory like a snapshot.</p>
                                <ul className="list-disc list-inside space-y-1">
                                    <li>Data is stored in memory</li>
                                    <li>Can consume stream data as a changelog</li>
                                    <li>Updates continuously as data arrives</li>
                                    <li>Good for smaller datasets or temporary state</li>
                                </ul>
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                Table type is not specified. Tables can be either scan (in-memory) or lookup (external reference).
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Delete Confirmation */}
            <ConfirmDialog
                open={showDelete}
                onOpenChange={setShowDelete}
                title="Delete Table"
                description={`Are you sure you want to delete the table "${tableName}"? This action cannot be undone. Any rules using this table will fail.`}
                confirmLabel="Delete"
                variant="danger"
                onConfirm={handleDelete}
            />
        </AppLayout>
    );
}
