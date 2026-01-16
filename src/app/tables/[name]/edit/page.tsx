"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import { useServerStore } from "@/stores/server-store";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2, Save, Layers, Code, RefreshCw, Search, Scan } from "lucide-react";
import { LoadingSpinner, ErrorState, EmptyState } from "@/components/common";

interface TableField {
    name: string;
    type: string;
}

interface TableDetails {
    Name: string;
    StreamFields?: Array<{ Name: string; FieldType: string | { Type: number } }>;
    Options?: Record<string, unknown>;
    Statement?: string;
}

const DATA_TYPES = [
    "bigint",
    "float",
    "string",
    "boolean",
    "datetime",
    "bytea",
    "array",
    "struct",
];

const SOURCE_TYPES = [
    { value: "file", label: "File" },
    { value: "memory", label: "Memory" },
    { value: "redis", label: "Redis" },
    { value: "sql", label: "SQL" },
    { value: "mqtt", label: "MQTT" },
];

// Map numeric type codes to type names
const TYPE_MAP: Record<number, string> = {
    1: "bigint",
    2: "float",
    3: "string",
    4: "datetime",
    5: "boolean",
    6: "bytea",
};

export default function EditTablePage() {
    const router = useRouter();
    const params = useParams();
    const tableName = params.name as string;
    const { servers, activeServerId } = useServerStore();
    const activeServer = servers.find((s) => s.id === activeServerId);

    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [table, setTable] = React.useState<TableDetails | null>(null);

    const [mode, setMode] = React.useState<"form" | "sql">("sql");
    const [name, setName] = React.useState("");
    const [tableKind, setTableKind] = React.useState<"lookup" | "scan">("lookup");
    const [sourceType, setSourceType] = React.useState("file");
    const [fields, setFields] = React.useState<TableField[]>([]);
    const [datasource, setDatasource] = React.useState("");
    const [format, setFormat] = React.useState("json");
    const [key, setKey] = React.useState("");
    const [sqlStatement, setSqlStatement] = React.useState("");
    const [saving, setSaving] = React.useState(false);
    const [saveError, setSaveError] = React.useState<string | null>(null);

    // Helper to reconstruct SQL from table data
    const reconstructSQL = React.useCallback((data: TableDetails, parsedFields: TableField[], opts: Record<string, unknown>): string => {
        const tblName = data.Name;

        // Build schema part
        let schemaStr = "()";
        if (parsedFields.length > 0) {
            schemaStr = `(\n  ${parsedFields.map(f => `${f.name} ${f.type}`).join(",\n  ")}\n)`;
        }

        // Build WITH options
        const withParts: string[] = [];

        // Extract all option values
        const typeVal = opts.TYPE || opts.type || opts.Type;
        const dsVal = opts.DATASOURCE || opts.datasource || opts.Datasource;
        const fmtVal = opts.FORMAT || opts.format || opts.Format;
        const kindVal = opts.KIND || opts.kind || opts.Kind;
        const keyVal = opts.KEY || opts.key || opts.Key;
        const confKeyVal = opts.CONF_KEY || opts.confKey || opts.ConfKey;

        // Add options in standard order
        if (typeVal) withParts.push(`TYPE = "${typeVal}"`);
        if (dsVal) withParts.push(`DATASOURCE = "${dsVal}"`);
        if (fmtVal) withParts.push(`FORMAT = "${fmtVal}"`);
        if (kindVal) withParts.push(`KIND = "${kindVal}"`);
        if (keyVal) withParts.push(`KEY = "${keyVal}"`);
        if (confKeyVal) withParts.push(`CONF_KEY = "${confKeyVal}"`);

        const withStr = withParts.length > 0 ? `WITH (\n  ${withParts.join(",\n  ")}\n)` : "";

        return `CREATE TABLE ${tblName} ${schemaStr} ${withStr};`;
    }, []);

    const fetchTable = React.useCallback(async () => {
        if (!activeServer) return;

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
            console.log("Table data received:", JSON.stringify(data, null, 2));
            setTable(data);

            // Initialize form fields from table data
            setName(data.Name || tableName);

            // Parse fields from StreamFields
            let parsedFields: TableField[] = [];
            if (data.StreamFields && Array.isArray(data.StreamFields) && data.StreamFields.length > 0) {
                parsedFields = data.StreamFields.map((f: { Name: string; FieldType: string | { Type: number } }) => {
                    let fieldType = "string";
                    if (typeof f.FieldType === "string") {
                        fieldType = f.FieldType.toLowerCase();
                    } else if (f.FieldType && typeof f.FieldType === "object" && "Type" in f.FieldType) {
                        fieldType = TYPE_MAP[f.FieldType.Type] || "string";
                    }
                    return { name: f.Name || "", type: fieldType };
                });
                setFields(parsedFields);
            } else {
                setFields([]);
            }

            // Parse options
            const opts = data.Options || {};
            console.log("Options received:", opts);

            // TYPE
            const typeVal = opts.TYPE || opts.type || opts.Type;
            if (typeVal) setSourceType(String(typeVal).toLowerCase());

            // DATASOURCE
            const dsVal = opts.DATASOURCE || opts.datasource || opts.Datasource;
            if (dsVal) setDatasource(String(dsVal));

            // FORMAT
            const fmtVal = opts.FORMAT || opts.format || opts.Format;
            if (fmtVal) setFormat(String(fmtVal).toLowerCase());

            // KIND
            const kindVal = opts.KIND || opts.kind || opts.Kind;
            if (kindVal) setTableKind(String(kindVal).toLowerCase() as "lookup" | "scan");

            // KEY
            const keyVal = opts.KEY || opts.key || opts.Key;
            if (keyVal) setKey(String(keyVal));

            // Reconstruct SQL
            const reconstructedSQL = reconstructSQL(data, parsedFields, opts);
            console.log("Reconstructed SQL:", reconstructedSQL);
            setSqlStatement(reconstructedSQL);

        } catch (err) {
            console.error("Error fetching table:", err);
            setError(err instanceof Error ? err.message : "Failed to load table");
        } finally {
            setLoading(false);
        }
    }, [activeServer, tableName, reconstructSQL]);

    React.useEffect(() => {
        fetchTable();
    }, [fetchTable]);

    const addField = () => {
        setFields([...fields, { name: "", type: "string" }]);
    };

    const removeField = (index: number) => {
        setFields(fields.filter((_, i) => i !== index));
    };

    const updateField = (index: number, fieldKey: keyof TableField, value: string) => {
        const newFields = [...fields];
        newFields[index] = { ...newFields[index], [fieldKey]: value };
        setFields(newFields);
    };

    const generateSQL = (): string => {
        const schemaStr = fields.length > 0
            ? `(${fields.map((f) => `${f.name} ${f.type}`).join(", ")})`
            : "()";

        const optionsArr = [];
        optionsArr.push(`TYPE = "${sourceType}"`);
        if (datasource) optionsArr.push(`DATASOURCE = "${datasource}"`);
        if (format) optionsArr.push(`FORMAT = "${format}"`);
        optionsArr.push(`KIND = "${tableKind}"`);
        if (key && tableKind === "lookup") optionsArr.push(`KEY = "${key}"`);

        return `CREATE TABLE ${name} ${schemaStr} WITH (${optionsArr.join(", ")});`;
    };

    const handleSubmit = async () => {
        if (!activeServer) {
            setSaveError("No server connected");
            return;
        }

        const sql = mode === "sql" ? sqlStatement : generateSQL();

        if (!sql.trim()) {
            setSaveError("Please provide a valid SQL statement");
            return;
        }

        setSaving(true);
        setSaveError(null);

        try {
            // eKuiper uses PUT to update a table
            const response = await fetch(`/api/ekuiper/tables/${encodeURIComponent(tableName)}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "X-EKuiper-URL": activeServer.url,
                },
                body: JSON.stringify({ sql }),
            });

            if (!response.ok) {
                const errData = await response.text();
                throw new Error(errData || `Failed to update table: ${response.status}`);
            }

            router.push(`/tables/${encodeURIComponent(tableName)}`);
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : "Failed to update table");
        } finally {
            setSaving(false);
        }
    };

    if (!activeServer) {
        return (
            <AppLayout title={`Edit Table: ${tableName}`}>
                <EmptyState
                    title="No Server Connected"
                    description="Connect to an eKuiper server to edit tables."
                />
            </AppLayout>
        );
    }

    if (loading) {
        return (
            <AppLayout title={`Edit Table: ${tableName}`}>
                <div className="flex items-center justify-center py-12">
                    <LoadingSpinner size="lg" />
                </div>
            </AppLayout>
        );
    }

    if (error || !table) {
        return (
            <AppLayout title={`Edit Table: ${tableName}`}>
                <ErrorState
                    title="Error Loading Table"
                    description={error || "Table not found"}
                    onRetry={fetchTable}
                />
            </AppLayout>
        );
    }

    return (
        <AppLayout title={`Edit Table: ${tableName}`}>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => router.push(`/tables/${encodeURIComponent(tableName)}`)}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                                <Layers className="h-5 w-5 text-purple-500" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h1 className="text-2xl font-bold">Edit Table</h1>
                                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${tableKind === "lookup" ? "bg-blue-500/10 text-blue-500" : "bg-green-500/10 text-green-500"}`}>
                                        {tableKind === "lookup" ? <Search className="h-3 w-3" /> : <Scan className="h-3 w-3" />}
                                        {tableKind === "lookup" ? "Lookup" : "Scan"}
                                    </span>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    Modify table: {tableName}
                                </p>
                            </div>
                        </div>
                    </div>
                    <Button variant="outline" size="icon" onClick={fetchTable}>
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                </div>

                {saveError && (
                    <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
                        {saveError}
                    </div>
                )}

                <Tabs value={mode} onValueChange={(v) => setMode(v as "form" | "sql")}>
                    <TabsList>
                        <TabsTrigger value="form">
                            <Layers className="mr-2 h-4 w-4" />
                            Form Builder
                        </TabsTrigger>
                        <TabsTrigger value="sql">
                            <Code className="mr-2 h-4 w-4" />
                            SQL Editor
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="form" className="space-y-4">
                        {/* Basic Info */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Basic Information</CardTitle>
                                <CardDescription>Table name and source type</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="name">Table Name</Label>
                                        <Input
                                            id="name"
                                            placeholder="my_table"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            disabled
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Table name cannot be changed. Create a new table if you need a different name.
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Source Type</Label>
                                        <Select value={sourceType} onValueChange={setSourceType}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {SOURCE_TYPES.map((type) => (
                                                    <SelectItem key={type.value} value={type.value}>
                                                        {type.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Table Kind</Label>
                                    <Select value={tableKind} onValueChange={(v) => setTableKind(v as "lookup" | "scan")}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="lookup">Lookup Table</SelectItem>
                                            <SelectItem value="scan">Scan Table</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Schema Definition */}
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Schema Definition</CardTitle>
                                    <CardDescription>
                                        Define the fields in your table
                                    </CardDescription>
                                </div>
                                <Button variant="outline" size="sm" onClick={addField}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Field
                                </Button>
                            </CardHeader>
                            <CardContent>
                                {fields.length === 0 ? (
                                    <p className="text-sm text-muted-foreground py-4 text-center">
                                        No fields defined. Click &quot;Add Field&quot; to define a schema.
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {fields.map((field, index) => (
                                            <div key={index} className="flex items-center gap-2">
                                                <Input
                                                    placeholder="Field name"
                                                    value={field.name}
                                                    onChange={(e) => updateField(index, "name", e.target.value)}
                                                    className="flex-1"
                                                />
                                                <Select
                                                    value={field.type}
                                                    onValueChange={(v) => updateField(index, "type", v)}
                                                >
                                                    <SelectTrigger className="w-40">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {DATA_TYPES.map((type) => (
                                                            <SelectItem key={type} value={type}>
                                                                {type}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => removeField(index)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Options */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Table Options</CardTitle>
                                <CardDescription>Configure table source options</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="datasource">Data Source</Label>
                                        <Input
                                            id="datasource"
                                            placeholder="lookup.json"
                                            value={datasource}
                                            onChange={(e) => setDatasource(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Format</Label>
                                        <Select value={format} onValueChange={setFormat}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="json">JSON</SelectItem>
                                                <SelectItem value="binary">Binary</SelectItem>
                                                <SelectItem value="delimited">Delimited</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                {tableKind === "lookup" && (
                                    <div className="space-y-2">
                                        <Label htmlFor="key">Lookup Key</Label>
                                        <Input
                                            id="key"
                                            placeholder="id"
                                            value={key}
                                            onChange={(e) => setKey(e.target.value)}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            The field used as the lookup key for JOIN operations
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Preview SQL */}
                        {name && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Generated SQL</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <pre className="rounded-lg bg-muted p-4 text-sm overflow-x-auto">
                                        <code>{generateSQL()}</code>
                                    </pre>
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>

                    <TabsContent value="sql" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>SQL Statement</CardTitle>
                                <CardDescription>
                                    Edit the CREATE TABLE SQL statement directly
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <textarea
                                    className="w-full h-48 rounded-lg border bg-muted p-4 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                    placeholder={`CREATE TABLE my_table (
  id bigint,
  name string,
  value float
) WITH (
  TYPE="file",
  DATASOURCE="lookup.json",
  FORMAT="json",
  KIND="lookup",
  KEY="id"
);`}
                                    value={sqlStatement}
                                    onChange={(e) => setSqlStatement(e.target.value)}
                                />
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2">
                    <Button variant="outline" onClick={() => router.push(`/tables/${encodeURIComponent(tableName)}`)}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={saving}>
                        {saving ? (
                            <LoadingSpinner size="sm" className="mr-2" />
                        ) : (
                            <Save className="mr-2 h-4 w-4" />
                        )}
                        Update Table
                    </Button>
                </div>
            </div>
        </AppLayout>
    );
}
