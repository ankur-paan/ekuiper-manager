"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
import { ArrowLeft, Plus, Trash2, Save, Layers, Code, Search, Scan, Info } from "lucide-react";
import { LoadingSpinner, EmptyState } from "@/components/common";

interface TableField {
    name: string;
    type: string;
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
    { value: "file", label: "File", description: "Read from local file" },
    { value: "memory", label: "Memory", description: "In-memory table" },
    { value: "redis", label: "Redis", description: "Redis key-value store" },
    { value: "sql", label: "SQL", description: "External SQL database" },
    { value: "mqtt", label: "MQTT", description: "MQTT message broker" },
];

export default function NewTablePage() {
    const router = useRouter();
    const { servers, activeServerId } = useServerStore();
    const activeServer = servers.find((s) => s.id === activeServerId);

    const [step, setStep] = React.useState<"wizard" | "form">("wizard");
    const [mode, setMode] = React.useState<"form" | "sql">("form");
    const [tableKind, setTableKind] = React.useState<"lookup" | "scan">("lookup");
    const [name, setName] = React.useState("");
    const [sourceType, setSourceType] = React.useState("file");
    const [fields, setFields] = React.useState<TableField[]>([]);
    const [datasource, setDatasource] = React.useState("");
    const [format, setFormat] = React.useState("json");
    const [key, setKey] = React.useState("");
    const [sqlStatement, setSqlStatement] = React.useState("");
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const addField = () => {
        setFields([...fields, { name: "", type: "string" }]);
    };

    const removeField = (index: number) => {
        setFields(fields.filter((_, i) => i !== index));
    };

    const updateField = (index: number, key: keyof TableField, value: string) => {
        const newFields = [...fields];
        newFields[index] = { ...newFields[index], [key]: value };
        setFields(newFields);
    };

    const generateSQL = (): string => {
        // eKuiper REQUIRES parentheses even for schemaless tables
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
            setError("No server connected");
            return;
        }

        const sql = mode === "sql" ? sqlStatement : generateSQL();

        if (!sql.trim()) {
            setError("Please provide a valid SQL statement");
            return;
        }

        setSaving(true);
        setError(null);

        try {
            const response = await fetch("/api/ekuiper/tables", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-EKuiper-URL": activeServer.url,
                },
                body: JSON.stringify({ sql }),
            });

            if (!response.ok) {
                const errData = await response.text();
                throw new Error(errData || `Failed to create table: ${response.status}`);
            }

            router.push("/tables");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create table");
        } finally {
            setSaving(false);
        }
    };

    if (!activeServer) {
        return (
            <AppLayout title="Create Table">
                <EmptyState
                    title="No Server Connected"
                    description="Connect to an eKuiper server to create tables."
                />
            </AppLayout>
        );
    }

    // Wizard step for choosing table type
    if (step === "wizard") {
        return (
            <AppLayout title="Create Table">
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => router.push("/tables")}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                                <Layers className="h-5 w-5 text-purple-500" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold">Create Table</h1>
                                <p className="text-sm text-muted-foreground">
                                    Step 1: Choose table type
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Table Type Selection */}
                    <div className="grid gap-6 md:grid-cols-2">
                        <Card
                            className={`cursor-pointer transition-all hover:border-primary ${tableKind === "lookup" ? "border-primary ring-2 ring-primary" : ""}`}
                            onClick={() => setTableKind("lookup")}
                        >
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Search className="h-5 w-5 text-blue-500" />
                                    Lookup Table
                                </CardTitle>
                                <CardDescription>
                                    Reference external data for JOIN operations
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                <p className="text-muted-foreground">Best for:</p>
                                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                                    <li>Static or slowly changing data</li>
                                    <li>Reference data enrichment</li>
                                    <li>Configuration lookups</li>
                                    <li>Large datasets stored externally</li>
                                </ul>
                                <div className="pt-2 flex items-center gap-2">
                                    <Info className="h-4 w-4 text-blue-500" />
                                    <span className="text-xs">Supports: File, Memory, Redis, SQL</span>
                                </div>
                            </CardContent>
                        </Card>

                        <Card
                            className={`cursor-pointer transition-all hover:border-primary ${tableKind === "scan" ? "border-primary ring-2 ring-primary" : ""}`}
                            onClick={() => setTableKind("scan")}
                        >
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Scan className="h-5 w-5 text-green-500" />
                                    Scan Table
                                </CardTitle>
                                <CardDescription>
                                    Accumulate streaming data in memory
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                <p className="text-muted-foreground">Best for:</p>
                                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                                    <li>Dynamic, frequently updating data</li>
                                    <li>State accumulation</li>
                                    <li>Changelog-style updates</li>
                                    <li>Smaller datasets in memory</li>
                                </ul>
                                <div className="pt-2 flex items-center gap-2">
                                    <Info className="h-4 w-4 text-green-500" />
                                    <span className="text-xs">Data stored in eKuiper memory</span>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" onClick={() => router.push("/tables")}>
                            Cancel
                        </Button>
                        <Button onClick={() => setStep("form")}>
                            Continue
                            <ArrowLeft className="ml-2 h-4 w-4 rotate-180" />
                        </Button>
                    </div>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout title="Create Table">
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => setStep("wizard")}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                            <Layers className="h-5 w-5 text-purple-500" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-bold">Create Table</h1>
                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${tableKind === "lookup" ? "bg-blue-500/10 text-blue-500" : "bg-green-500/10 text-green-500"}`}>
                                    {tableKind === "lookup" ? <Search className="h-3 w-3" /> : <Scan className="h-3 w-3" />}
                                    {tableKind === "lookup" ? "Lookup" : "Scan"}
                                </span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Define your {tableKind} table
                            </p>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
                        {error}
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
                                        />
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
                            </CardContent>
                        </Card>

                        {/* Schema Definition */}
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Schema Definition</CardTitle>
                                    <CardDescription>
                                        Define the fields in your table (optional for schemaless)
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
                                            placeholder={sourceType === "file" ? "lookup.json" : "source/path"}
                                            value={datasource}
                                            onChange={(e) => setDatasource(e.target.value)}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            {sourceType === "file" && "Path to the file relative to data directory"}
                                            {sourceType === "memory" && "Memory topic name"}
                                            {sourceType === "redis" && "Redis key pattern"}
                                            {sourceType === "sql" && "Table name in the database"}
                                        </p>
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
                                    Write your CREATE TABLE SQL statement directly
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
                    <Button variant="outline" onClick={() => router.push("/tables")}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={saving}>
                        {saving ? (
                            <LoadingSpinner size="sm" className="mr-2" />
                        ) : (
                            <Save className="mr-2 h-4 w-4" />
                        )}
                        Create Table
                    </Button>
                </div>
            </div>
        </AppLayout>
    );
}
