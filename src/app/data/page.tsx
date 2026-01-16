"use client";

import * as React from "react";
import { useServerStore } from "@/stores/server-store";
import { AppLayout } from "@/components/layout";
import { EmptyState, LoadingSpinner } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Download,
  Upload,
  FileJson,
  Loader2,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";

interface ExportOptions {
  streams: boolean;
  tables: boolean;
  rules: boolean;
  plugins: boolean;
  services: boolean;
  schemas: boolean;
  connections: boolean;
}

export default function RulesetPage() {
  const { servers, activeServerId } = useServerStore();
  const activeServer = servers.find((s) => s.id === activeServerId);

  const [activeTab, setActiveTab] = React.useState<"export" | "import">("export");
  const [exportOptions, setExportOptions] = React.useState<ExportOptions>({
    streams: true,
    tables: true,
    rules: true,
    plugins: false,
    services: false,
    schemas: false,
    connections: false,
  });
  const [exportData, setExportData] = React.useState<string>("");
  const [importData, setImportData] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const handleExport = async () => {
    if (!activeServer) return;

    setLoading(true);
    setExportData("");

    try {
      const response = await fetch(`/api/ekuiper/data/export`, {
        headers: {
          "X-EKuiper-URL": activeServer.url,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to export data: ${response.status}`);
      }

      const data = await response.json();
      
      // Filter based on options
      const filteredData: Record<string, unknown> = {};
      if (exportOptions.streams && data.streams) filteredData.streams = data.streams;
      if (exportOptions.tables && data.tables) filteredData.tables = data.tables;
      if (exportOptions.rules && data.rules) filteredData.rules = data.rules;
      if (exportOptions.plugins && data.plugins) filteredData.plugins = data.plugins;
      if (exportOptions.services && data.services) filteredData.services = data.services;
      if (exportOptions.schemas && data.schemas) filteredData.schemas = data.schemas;
      if (exportOptions.connections && data.connections) filteredData.connections = data.connections;

      setExportData(JSON.stringify(filteredData, null, 2));
      toast.success("Data exported successfully");
    } catch (err) {
      toast.error(`Failed to export: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!activeServer) return;

    if (!importData.trim()) {
      toast.error("Please enter data to import");
      return;
    }

    let parsedData;
    try {
      parsedData = JSON.parse(importData);
    } catch {
      toast.error("Invalid JSON format");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/ekuiper/data/import`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-EKuiper-URL": activeServer.url,
        },
        body: JSON.stringify(parsedData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to import data: ${response.status}`);
      }

      toast.success("Data imported successfully");
      setImportData("");
    } catch (err) {
      toast.error(`Failed to import: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(exportData);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([exportData], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ekuiper-export-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setImportData(content);
    };
    reader.readAsText(file);
  };

  if (!activeServer) {
    return (
      <AppLayout title="Import / Export">
        <EmptyState
          title="No Server Connected"
          description="Connect to an eKuiper server to import or export data."
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Import / Export">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Import / Export</h2>
          <p className="text-muted-foreground">
            Export and import eKuiper configuration and rulesets
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "export" | "import")}>
          <TabsList>
            <TabsTrigger value="export">
              <Download className="mr-2 h-4 w-4" />
              Export
            </TabsTrigger>
            <TabsTrigger value="import">
              <Upload className="mr-2 h-4 w-4" />
              Import
            </TabsTrigger>
          </TabsList>

          <TabsContent value="export" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Export Options</CardTitle>
                <CardDescription>
                  Select what to include in the export
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {(Object.keys(exportOptions) as (keyof ExportOptions)[]).map((key) => (
                    <div key={key} className="flex items-center space-x-2">
                      <Checkbox
                        id={key}
                        checked={exportOptions[key]}
                        onCheckedChange={(checked) =>
                          setExportOptions({ ...exportOptions, [key]: !!checked })
                        }
                      />
                      <Label htmlFor={key} className="capitalize cursor-pointer">
                        {key}
                      </Label>
                    </div>
                  ))}
                </div>

                <Button onClick={handleExport} disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Export Data
                </Button>
              </CardContent>
            </Card>

            {exportData && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Export Result</CardTitle>
                      <CardDescription>
                        Copy or download the exported configuration
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleCopy}>
                        {copied ? (
                          <Check className="mr-2 h-4 w-4" />
                        ) : (
                          <Copy className="mr-2 h-4 w-4" />
                        )}
                        {copied ? "Copied" : "Copy"}
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleDownload}>
                        <Download className="mr-2 h-4 w-4" />
                        Download
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <pre className="bg-muted rounded-lg p-4 overflow-x-auto text-sm max-h-96">
                    {exportData}
                  </pre>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="import" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Import Data</CardTitle>
                <CardDescription>
                  Import configuration from a JSON file or paste directly
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Upload File</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="file-upload"
                    />
                    <Button variant="outline" asChild>
                      <label htmlFor="file-upload" className="cursor-pointer">
                        <FileJson className="mr-2 h-4 w-4" />
                        Choose File
                      </label>
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="import-data">Or Paste JSON</Label>
                  <Textarea
                    id="import-data"
                    value={importData}
                    onChange={(e) => setImportData(e.target.value)}
                    placeholder='{"streams": [...], "rules": [...]}'
                    rows={15}
                    className="font-mono text-sm"
                  />
                </div>

                <Button onClick={handleImport} disabled={loading || !importData.trim()}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Import Data
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
