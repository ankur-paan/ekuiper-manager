"use client";

import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JsonEditor } from "@/components/editor/json-editor";
import { toast } from "@/hooks/use-toast";
import { 
  Upload, 
  Download, 
  FileJson, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  FileUp,
  FileDown,
  Package,
  Database,
  Workflow,
  Table,
  RefreshCw
} from "lucide-react";
import { EKuiperManagerClient } from "@/lib/ekuiper/manager-client";
import type { ExportData } from "@/lib/ekuiper/manager-types";

interface ImportExportManagerProps {
  client: EKuiperManagerClient;
}

export function ImportExportManager({ client }: ImportExportManagerProps) {
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importData, setImportData] = useState<ExportData | null>(null);
  const [importJson, setImportJson] = useState("");
  const [importResults, setImportResults] = useState<{
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Export mutation
  const exportMutation = useMutation({
    mutationFn: () => client.exportAll(),
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ekuiper-export-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast({
        title: "Export successful",
        description: `Exported ${data.streams.length} streams, ${data.tables.length} tables, ${data.rules.length} rules`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Export failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Import mutation
  const importMutation = useMutation({
    mutationFn: (data: ExportData) => client.importAll(data),
    onSuccess: (results) => {
      setImportResults(results);
      toast({
        title: "Import completed",
        description: `${results.success} successful, ${results.failed} failed`,
        variant: results.failed > 0 ? "destructive" : "default",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content) as ExportData;
        setImportData(data);
        setImportJson(content);
        setImportDialogOpen(true);
        setImportResults(null);
      } catch (error) {
        toast({
          title: "Invalid file",
          description: "The selected file is not a valid JSON export",
          variant: "destructive",
        });
      }
    };
    reader.readAsText(file);
    
    // Reset input
    event.target.value = "";
  };

  const handleImport = () => {
    if (!importData) return;
    importMutation.mutate(importData);
  };

  const handleJsonChange = (json: string) => {
    setImportJson(json);
    try {
      const data = JSON.parse(json) as ExportData;
      setImportData(data);
    } catch {
      setImportData(null);
    }
  };

  return (
    <div className="h-full overflow-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Package className="h-5 w-5" />
          Import / Export
        </h2>
        <p className="text-sm text-muted-foreground">
          Backup and restore your eKuiper configurations
        </p>
      </div>

      {/* Main Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Export Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-green-500/10">
                <FileDown className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <CardTitle>Export Configuration</CardTitle>
                <CardDescription>
                  Download all streams, tables, and rules as JSON
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>This will export:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>All stream definitions</li>
                <li>All table definitions</li>
                <li>All rule configurations</li>
                <li>Metadata and timestamps</li>
              </ul>
            </div>
            <Button 
              className="w-full gap-2"
              onClick={() => exportMutation.mutate()}
              disabled={exportMutation.isPending}
            >
              {exportMutation.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Export All Configurations
            </Button>
          </CardContent>
        </Card>

        {/* Import Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-blue-500/10">
                <FileUp className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <CardTitle>Import Configuration</CardTitle>
                <CardDescription>
                  Restore configurations from a JSON backup
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Import will:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Create streams from definitions</li>
                <li>Create tables from definitions</li>
                <li>Create and start rules</li>
                <li>Skip existing items with same names</li>
              </ul>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".json"
              className="hidden"
            />
            <Button 
              className="w-full gap-2"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              Select JSON File
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Export Format Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Export Format</CardTitle>
          <CardDescription>
            The export file follows a structured JSON format
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="text-sm bg-muted p-4 rounded-lg overflow-auto max-h-64">
{`{
  "version": "1.0",
  "exportedAt": "2024-01-14T12:00:00Z",
  "streams": [
    {
      "name": "demo_stream",
      "sql": "CREATE STREAM demo_stream (...) WITH (...)"
    }
  ],
  "tables": [
    {
      "name": "lookup_table",
      "sql": "CREATE TABLE lookup_table (...) WITH (...)"
    }
  ],
  "rules": [
    {
      "id": "rule_1",
      "sql": "SELECT * FROM demo_stream",
      "actions": [{ "log": {} }]
    }
  ]
}`}
          </pre>
        </CardContent>
      </Card>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-3xl h-[80vh]">
          <DialogHeader>
            <DialogTitle>Import Configuration</DialogTitle>
            <DialogDescription>
              Review the import data before proceeding
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="preview" className="flex-1 flex flex-col overflow-hidden">
            <TabsList>
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="json">JSON</TabsTrigger>
              {importResults && <TabsTrigger value="results">Results</TabsTrigger>}
            </TabsList>

            <TabsContent value="preview" className="flex-1 overflow-auto">
              {importData && (
                <div className="space-y-4">
                  {/* Summary */}
                  <div className="grid grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                          <Database className="h-5 w-5 text-blue-500" />
                          <div>
                            <p className="text-2xl font-bold">{importData.streams?.length || 0}</p>
                            <p className="text-sm text-muted-foreground">Streams</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                          <Table className="h-5 w-5 text-purple-500" />
                          <div>
                            <p className="text-2xl font-bold">{importData.tables?.length || 0}</p>
                            <p className="text-sm text-muted-foreground">Tables</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                          <Workflow className="h-5 w-5 text-green-500" />
                          <div>
                            <p className="text-2xl font-bold">{importData.rules?.length || 0}</p>
                            <p className="text-sm text-muted-foreground">Rules</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Items */}
                  {importData.streams?.length > 0 && (
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm">Streams</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-2">
                          {importData.streams.map((stream: any, i: number) => (
                            <div key={i} className="flex items-center gap-2 text-sm">
                              <Database className="h-4 w-4 text-muted-foreground" />
                              <span>{stream.name || `Stream ${i + 1}`}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {importData.rules?.length > 0 && (
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm">Rules</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-2">
                          {importData.rules.map((rule: any, i: number) => (
                            <div key={i} className="flex items-center gap-2 text-sm">
                              <Workflow className="h-4 w-4 text-muted-foreground" />
                              <span>{rule.id}</span>
                              <span className="text-muted-foreground text-xs truncate flex-1">
                                {rule.sql?.slice(0, 50)}...
                              </span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Metadata */}
                  <div className="text-xs text-muted-foreground">
                    <p>Version: {importData.version}</p>
                    <p>Exported: {importData.exportedAt}</p>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="json" className="flex-1 min-h-0">
              <JsonEditor
                value={importJson}
                onChange={handleJsonChange}
                height="100%"
              />
            </TabsContent>

            {importResults && (
              <TabsContent value="results" className="flex-1 overflow-auto">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Card className="border-green-500/30 bg-green-500/5">
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="h-6 w-6 text-green-500" />
                          <div>
                            <p className="text-2xl font-bold">{importResults.success}</p>
                            <p className="text-sm text-muted-foreground">Successful</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="border-red-500/30 bg-red-500/5">
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                          <XCircle className="h-6 w-6 text-red-500" />
                          <div>
                            <p className="text-2xl font-bold">{importResults.failed}</p>
                            <p className="text-sm text-muted-foreground">Failed</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {importResults.errors.length > 0 && (
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                          Errors
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-2">
                          {importResults.errors.map((error, i) => (
                            <div key={i} className="text-sm text-red-500">
                              {error}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>
            )}
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
              {importResults ? "Close" : "Cancel"}
            </Button>
            {!importResults && (
              <Button 
                onClick={handleImport}
                disabled={!importData || importMutation.isPending}
              >
                {importMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-1" />
                )}
                Import
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
