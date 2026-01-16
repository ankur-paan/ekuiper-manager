"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Database,
  FileJson,
  Plus,
  Edit,
  Trash2,
  MoreHorizontal,
  RefreshCw,
  Search,
  Upload,
  Download,
  FolderOpen,
  Table as TableIcon,
} from "lucide-react";

export type LookupTableType = "sqlite" | "json" | "csv";

export interface LookupTableConfig {
  id: string;
  name: string;
  description?: string;
  type: LookupTableType;
  filePath: string;
  tableName?: string; // For SQLite
  keyColumn: string;
  valueColumns: string[];
  cacheEnabled: boolean;
  cacheTtl: number; // seconds
  reloadInterval?: number; // seconds, for automatic reload
  lastReloaded?: string;
  rowCount: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LookupTablePreview {
  columns: string[];
  rows: Record<string, unknown>[];
  totalRows: number;
}

// Demo lookup tables
const DEMO_TABLES: LookupTableConfig[] = [
  {
    id: "lookup-1",
    name: "Device Registry",
    description: "Device metadata and configuration lookup",
    type: "sqlite",
    filePath: "/data/lookups/devices.db",
    tableName: "devices",
    keyColumn: "device_id",
    valueColumns: ["device_name", "location", "type", "firmware_version"],
    cacheEnabled: true,
    cacheTtl: 300,
    reloadInterval: 3600,
    lastReloaded: new Date(Date.now() - 1800000).toISOString(),
    rowCount: 1542,
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "lookup-2",
    name: "Sensor Thresholds",
    description: "Threshold values for sensor alerts",
    type: "json",
    filePath: "/data/lookups/thresholds.json",
    keyColumn: "sensor_type",
    valueColumns: ["min_value", "max_value", "warning_threshold", "critical_threshold"],
    cacheEnabled: true,
    cacheTtl: 600,
    lastReloaded: new Date(Date.now() - 3600000).toISOString(),
    rowCount: 25,
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "lookup-3",
    name: "Location Mapping",
    description: "Location codes to descriptions",
    type: "csv",
    filePath: "/data/lookups/locations.csv",
    keyColumn: "location_code",
    valueColumns: ["location_name", "timezone", "region"],
    cacheEnabled: false,
    cacheTtl: 0,
    rowCount: 156,
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "lookup-4",
    name: "User Permissions",
    description: "User access level mapping",
    type: "sqlite",
    filePath: "/data/lookups/users.db",
    tableName: "permissions",
    keyColumn: "user_id",
    valueColumns: ["role", "access_level", "department"],
    cacheEnabled: true,
    cacheTtl: 120,
    rowCount: 450,
    enabled: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export function SQLiteLookupTables() {
  const [tables, setTables] = useState<LookupTableConfig[]>(DEMO_TABLES);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<LookupTableConfig | null>(null);
  const [previewTable, setPreviewTable] = useState<LookupTableConfig | null>(null);
  const [reloadingId, setReloadingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const handleToggleEnabled = (tableId: string) => {
    setTables((prev) =>
      prev.map((t) =>
        t.id === tableId
          ? { ...t, enabled: !t.enabled, updatedAt: new Date().toISOString() }
          : t
      )
    );
  };

  const handleDeleteTable = (tableId: string) => {
    setTables((prev) => prev.filter((t) => t.id !== tableId));
  };

  const handleReloadTable = async (tableId: string) => {
    setReloadingId(tableId);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setTables((prev) =>
      prev.map((t) =>
        t.id === tableId
          ? { ...t, lastReloaded: new Date().toISOString() }
          : t
      )
    );
    setReloadingId(null);
  };

  const getTypeIcon = (type: LookupTableType) => {
    switch (type) {
      case "sqlite":
        return <Database className="h-4 w-4 text-blue-500" />;
      case "json":
        return <FileJson className="h-4 w-4 text-amber-500" />;
      case "csv":
        return <TableIcon className="h-4 w-4 text-green-500" />;
    }
  };

  const getTypeBadge = (type: LookupTableType) => {
    switch (type) {
      case "sqlite":
        return <Badge className="bg-blue-500">SQLite</Badge>;
      case "json":
        return <Badge className="bg-amber-500">JSON</Badge>;
      case "csv":
        return <Badge className="bg-green-500">CSV</Badge>;
    }
  };

  const formatLastReloaded = (isoString?: string) => {
    if (!isoString) return "Never";
    const date = new Date(isoString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  const filteredTables = tables.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeCount = tables.filter((t) => t.enabled).length;
  const totalRows = tables.reduce((sum, t) => sum + t.rowCount, 0);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Lookup Tables
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tables.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Rows
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {totalRows.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Cached
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {tables.filter((t) => t.cacheEnabled).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tables List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5" />
                Lookup Tables
              </CardTitle>
              <CardDescription>
                File-based lookup tables for data enrichment
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tables..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-[200px]"
                />
              </div>
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Table
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Add Lookup Table</DialogTitle>
                    <DialogDescription>
                      Configure a file-based lookup table
                    </DialogDescription>
                  </DialogHeader>
                  <LookupTableForm
                    onSubmit={(table) => {
                      setTables((prev) => [
                        ...prev,
                        {
                          ...table,
                          id: `lookup-${Date.now()}`,
                          rowCount: 0,
                          createdAt: new Date().toISOString(),
                          updatedAt: new Date().toISOString(),
                        },
                      ]);
                      setIsAddDialogOpen(false);
                    }}
                    onCancel={() => setIsAddDialogOpen(false)}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Key Column</TableHead>
                  <TableHead>Rows</TableHead>
                  <TableHead>Cache</TableHead>
                  <TableHead>Last Reload</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTables.map((table) => (
                  <TableRow key={table.id}>
                    <TableCell>{getTypeIcon(table.type)}</TableCell>
                    <TableCell>
                      <div className="font-medium">{table.name}</div>
                      {table.description && (
                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {table.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{getTypeBadge(table.type)}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1 rounded">
                        {table.keyColumn}
                      </code>
                    </TableCell>
                    <TableCell>{table.rowCount.toLocaleString()}</TableCell>
                    <TableCell>
                      {table.cacheEnabled ? (
                        <Badge variant="outline" className="text-xs">
                          TTL: {table.cacheTtl}s
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Disabled</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {formatLastReloaded(table.lastReloaded)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={table.enabled}
                        onCheckedChange={() => handleToggleEnabled(table.id)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => setPreviewTable(table)}
                          >
                            <Search className="mr-2 h-4 w-4" />
                            Preview Data
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setEditingTable(table)}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleReloadTable(table.id)}
                            disabled={reloadingId === table.id}
                          >
                            {reloadingId === table.id ? (
                              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="mr-2 h-4 w-4" />
                            )}
                            Reload Data
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Download className="mr-2 h-4 w-4" />
                            Export
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => handleDeleteTable(table.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog
        open={!!editingTable}
        onOpenChange={(open) => !open && setEditingTable(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Lookup Table</DialogTitle>
          </DialogHeader>
          {editingTable && (
            <LookupTableForm
              table={editingTable}
              onSubmit={(updated) => {
                setTables((prev) =>
                  prev.map((t) =>
                    t.id === editingTable.id
                      ? { ...t, ...updated, updatedAt: new Date().toISOString() }
                      : t
                  )
                );
                setEditingTable(null);
              }}
              onCancel={() => setEditingTable(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog
        open={!!previewTable}
        onOpenChange={(open) => !open && setPreviewTable(null)}
      >
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {previewTable && getTypeIcon(previewTable.type)}
              {previewTable?.name}
            </DialogTitle>
            <DialogDescription>
              Preview lookup table data
            </DialogDescription>
          </DialogHeader>
          {previewTable && <TablePreview table={previewTable} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface LookupTableFormProps {
  table?: LookupTableConfig;
  onSubmit: (table: Omit<LookupTableConfig, "id" | "createdAt" | "updatedAt" | "rowCount">) => void;
  onCancel: () => void;
}

function LookupTableForm({ table, onSubmit, onCancel }: LookupTableFormProps) {
  const [formData, setFormData] = useState({
    name: table?.name || "",
    description: table?.description || "",
    type: table?.type || "sqlite" as LookupTableType,
    filePath: table?.filePath || "",
    tableName: table?.tableName || "",
    keyColumn: table?.keyColumn || "",
    valueColumns: table?.valueColumns.join(", ") || "",
    cacheEnabled: table?.cacheEnabled ?? true,
    cacheTtl: table?.cacheTtl || 300,
    reloadInterval: table?.reloadInterval,
    enabled: table?.enabled ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name: formData.name,
      description: formData.description || undefined,
      type: formData.type,
      filePath: formData.filePath,
      tableName: formData.type === "sqlite" ? formData.tableName : undefined,
      keyColumn: formData.keyColumn,
      valueColumns: formData.valueColumns.split(",").map((s) => s.trim()).filter(Boolean),
      cacheEnabled: formData.cacheEnabled,
      cacheTtl: formData.cacheTtl,
      reloadInterval: formData.reloadInterval,
      enabled: formData.enabled,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Table Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="Device Registry"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          value={formData.description}
          onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
          placeholder="Optional description"
        />
      </div>

      <div className="space-y-2">
        <Label>Table Type</Label>
        <Select
          value={formData.type}
          onValueChange={(v: LookupTableType) =>
            setFormData((prev) => ({ ...prev, type: v }))
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sqlite">SQLite Database</SelectItem>
            <SelectItem value="json">JSON File</SelectItem>
            <SelectItem value="csv">CSV File</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="filePath">File Path</Label>
        <div className="flex gap-2">
          <Input
            id="filePath"
            value={formData.filePath}
            onChange={(e) => setFormData((prev) => ({ ...prev, filePath: e.target.value }))}
            placeholder={
              formData.type === "sqlite"
                ? "/data/lookups/database.db"
                : formData.type === "json"
                ? "/data/lookups/data.json"
                : "/data/lookups/data.csv"
            }
            required
          />
          <Button type="button" variant="outline">
            <Upload className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {formData.type === "sqlite" && (
        <div className="space-y-2">
          <Label htmlFor="tableName">Table Name (in SQLite)</Label>
          <Input
            id="tableName"
            value={formData.tableName}
            onChange={(e) => setFormData((prev) => ({ ...prev, tableName: e.target.value }))}
            placeholder="devices"
            required
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="keyColumn">Key Column</Label>
        <Input
          id="keyColumn"
          value={formData.keyColumn}
          onChange={(e) => setFormData((prev) => ({ ...prev, keyColumn: e.target.value }))}
          placeholder="id"
          required
        />
        <p className="text-xs text-muted-foreground">
          Column used for lookups
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="valueColumns">Value Columns</Label>
        <Textarea
          id="valueColumns"
          value={formData.valueColumns}
          onChange={(e) => setFormData((prev) => ({ ...prev, valueColumns: e.target.value }))}
          placeholder="name, location, type"
          rows={2}
        />
        <p className="text-xs text-muted-foreground">
          Comma-separated list of columns to return
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Switch
            id="cacheEnabled"
            checked={formData.cacheEnabled}
            onCheckedChange={(checked) =>
              setFormData((prev) => ({ ...prev, cacheEnabled: checked }))
            }
          />
          <Label htmlFor="cacheEnabled">Enable caching</Label>
        </div>

        {formData.cacheEnabled && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cacheTtl">Cache TTL (seconds)</Label>
              <Input
                id="cacheTtl"
                type="number"
                min={1}
                value={formData.cacheTtl}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, cacheTtl: parseInt(e.target.value) || 300 }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reloadInterval">Auto-reload Interval (sec)</Label>
              <Input
                id="reloadInterval"
                type="number"
                min={0}
                value={formData.reloadInterval || ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    reloadInterval: e.target.value ? parseInt(e.target.value) : undefined,
                  }))
                }
                placeholder="Optional"
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="enabled"
          checked={formData.enabled}
          onCheckedChange={(checked) =>
            setFormData((prev) => ({ ...prev, enabled: checked }))
          }
        />
        <Label htmlFor="enabled">Enable table</Label>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!formData.name || !formData.filePath || !formData.keyColumn}>
          {table ? "Update" : "Create"} Table
        </Button>
      </DialogFooter>
    </form>
  );
}

function TablePreview({ table }: { table: LookupTableConfig }) {
  // Generate demo preview data
  const demoData = generateDemoPreview(table);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {demoData.rows.length} of {table.rowCount} rows
        </div>
        <Input placeholder="Filter..." className="w-[200px]" />
      </div>

      <div className="border rounded-lg overflow-auto max-h-[400px]">
        <Table>
          <TableHeader>
            <TableRow>
              {demoData.columns.map((col) => (
                <TableHead key={col} className="whitespace-nowrap">
                  {col}
                  {col === table.keyColumn && (
                    <Badge variant="outline" className="ml-2 text-xs">
                      KEY
                    </Badge>
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {demoData.rows.map((row, idx) => (
              <TableRow key={idx}>
                {demoData.columns.map((col) => (
                  <TableCell key={col} className="font-mono text-xs">
                    {String(row[col] ?? "")}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>File: <code className="bg-muted px-1 rounded">{table.filePath}</code></span>
        {table.tableName && (
          <span>Table: <code className="bg-muted px-1 rounded">{table.tableName}</code></span>
        )}
      </div>
    </div>
  );
}

function generateDemoPreview(table: LookupTableConfig): LookupTablePreview {
  const columns = [table.keyColumn, ...table.valueColumns];
  const rows: Record<string, unknown>[] = [];

  for (let i = 0; i < Math.min(10, table.rowCount); i++) {
    const row: Record<string, unknown> = {};
    columns.forEach((col) => {
      if (col === table.keyColumn) {
        row[col] = `${col}_${i + 1}`;
      } else if (col.includes("name")) {
        row[col] = `Sample ${col} ${i + 1}`;
      } else if (col.includes("value") || col.includes("threshold")) {
        row[col] = Math.round(Math.random() * 100);
      } else {
        row[col] = `Value ${i + 1}`;
      }
    });
    rows.push(row);
  }

  return { columns, rows, totalRows: table.rowCount };
}
