"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  FileCode,
  Plus,
  Edit,
  Trash2,
  MoreHorizontal,
  Copy,
  Play,
  Check,
  AlertCircle,
} from "lucide-react";

export interface DataTemplate {
  id: string;
  name: string;
  description?: string;
  format: "json" | "text" | "xml" | "csv";
  template: string;
  testInput?: string;
  createdAt: string;
  updatedAt: string;
}

// Demo templates
const DEMO_TEMPLATES: DataTemplate[] = [
  {
    id: "tpl-1",
    name: "JSON Transform",
    description: "Transform sensor data to standard format",
    format: "json",
    template: `{
  "deviceId": "{{.device_id}}",
  "timestamp": "{{.ts}}",
  "readings": {
    "temperature": {{.temperature}},
    "humidity": {{.humidity}}
  },
  "metadata": {
    "source": "ekuiper",
    "version": "1.0"
  }
}`,
    testInput: `{"device_id": "sensor-001", "ts": "2024-01-15T10:30:00Z", "temperature": 25.5, "humidity": 60}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "tpl-2",
    name: "Alert Message",
    description: "Format alert notifications",
    format: "text",
    template: `[ALERT] Device {{.device_id}} - Temperature {{.temperature}}°C exceeds threshold at {{.timestamp}}`,
    testInput: `{"device_id": "sensor-002", "temperature": 45.2, "timestamp": "2024-01-15T10:35:00Z"}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "tpl-3",
    name: "CSV Export",
    description: "Export data as CSV row",
    format: "csv",
    template: `{{.device_id}},{{.temperature}},{{.humidity}},{{.timestamp}}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export function DataTemplatesEditor() {
  const [templates, setTemplates] = useState<DataTemplate[]>(DEMO_TEMPLATES);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<DataTemplate | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; output: string } | null>(null);

  const handleDeleteTemplate = (templateId: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== templateId));
  };

  const handleDuplicateTemplate = (template: DataTemplate) => {
    const newTemplate: DataTemplate = {
      ...template,
      id: `tpl-${Date.now()}`,
      name: `${template.name} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setTemplates((prev) => [...prev, newTemplate]);
  };

  const handleTestTemplate = (template: DataTemplate, input: string) => {
    try {
      const data = JSON.parse(input);
      let output = template.template;
      
      // Simple template variable replacement
      Object.entries(data).forEach(([key, value]) => {
        const regex = new RegExp(`\\{\\{\\.${key}\\}\\}`, "g");
        output = output.replace(regex, String(value));
      });
      
      setTestResult({ success: true, output });
    } catch (error) {
      setTestResult({ success: false, output: `Error: ${error}` });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FileCode className="h-6 w-6" />
            Data Templates
          </h2>
          <p className="text-muted-foreground">
            Create and manage data transformation templates for sink outputs
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Data Template</DialogTitle>
              <DialogDescription>
                Define a new data transformation template using Go template syntax
              </DialogDescription>
            </DialogHeader>
            <TemplateForm
              onSubmit={(template) => {
                setTemplates((prev) => [
                  ...prev,
                  {
                    ...template,
                    id: `tpl-${Date.now()}`,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  },
                ]);
                setIsAddDialogOpen(false);
              }}
              onCancel={() => setIsAddDialogOpen(false)}
              onTest={handleTestTemplate}
              testResult={testResult}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Templates List */}
      <Card>
        <CardHeader>
          <CardTitle>Templates</CardTitle>
          <CardDescription>
            {templates.length} template{templates.length !== 1 ? "s" : ""} defined
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell className="font-medium">{template.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{template.format.toUpperCase()}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {template.description || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(template.updatedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingTemplate(template)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicateTemplate(template)}>
                            <Copy className="mr-2 h-4 w-4" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => handleDeleteTemplate(template.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {templates.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No templates defined. Create one to get started.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Template Preview */}
      {templates.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {templates.slice(0, 2).map((template) => (
            <Card key={template.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{template.name}</CardTitle>
                  <Badge variant="outline">{template.format}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto max-h-[200px]">
                  {template.template}
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog
        open={!!editingTemplate}
        onOpenChange={(open) => !open && setEditingTemplate(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
          </DialogHeader>
          {editingTemplate && (
            <TemplateForm
              template={editingTemplate}
              onSubmit={(updated) => {
                setTemplates((prev) =>
                  prev.map((t) =>
                    t.id === editingTemplate.id
                      ? { ...t, ...updated, updatedAt: new Date().toISOString() }
                      : t
                  )
                );
                setEditingTemplate(null);
              }}
              onCancel={() => setEditingTemplate(null)}
              onTest={handleTestTemplate}
              testResult={testResult}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface TemplateFormProps {
  template?: DataTemplate;
  onSubmit: (template: Omit<DataTemplate, "id" | "createdAt" | "updatedAt">) => void;
  onCancel: () => void;
  onTest: (template: DataTemplate, input: string) => void;
  testResult: { success: boolean; output: string } | null;
}

function TemplateForm({ template, onSubmit, onCancel, onTest, testResult }: TemplateFormProps) {
  const [formData, setFormData] = useState({
    name: template?.name || "",
    description: template?.description || "",
    format: template?.format || "json",
    template: template?.template || "",
    testInput: template?.testInput || '{"key": "value"}',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name: formData.name,
      description: formData.description || undefined,
      format: formData.format as DataTemplate["format"],
      template: formData.template,
      testInput: formData.testInput || undefined,
    });
  };

  const handleTest = () => {
    const testTemplate: DataTemplate = {
      id: "test",
      name: formData.name,
      format: formData.format as DataTemplate["format"],
      template: formData.template,
      createdAt: "",
      updatedAt: "",
    };
    onTest(testTemplate, formData.testInput);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Template Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="My Template"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="format">Output Format</Label>
          <Select
            value={formData.format}
            onValueChange={(v) => setFormData((prev) => ({ ...prev, format: v as 'json' | 'text' | 'csv' | 'xml' }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="json">JSON</SelectItem>
              <SelectItem value="text">Text</SelectItem>
              <SelectItem value="xml">XML</SelectItem>
              <SelectItem value="csv">CSV</SelectItem>
            </SelectContent>
          </Select>
        </div>
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
        <Label htmlFor="template">Template</Label>
        <Textarea
          id="template"
          className="font-mono text-sm min-h-[150px]"
          value={formData.template}
          onChange={(e) => setFormData((prev) => ({ ...prev, template: e.target.value }))}
          placeholder="Enter your template using Go template syntax..."
          required
        />
        <p className="text-xs text-muted-foreground">
          Use Go template syntax: {"{{.field_name}}"} to reference data fields
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="testInput">Test Input (JSON)</Label>
          <Button type="button" variant="outline" size="sm" onClick={handleTest}>
            <Play className="h-4 w-4 mr-2" />
            Test Template
          </Button>
        </div>
        <Textarea
          id="testInput"
          className="font-mono text-sm"
          rows={3}
          value={formData.testInput}
          onChange={(e) => setFormData((prev) => ({ ...prev, testInput: e.target.value }))}
          placeholder='{"key": "value"}'
        />
      </div>

      {testResult && (
        <div
          className={`p-3 rounded-lg ${
            testResult.success ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            {testResult.success ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600" />
            )}
            <span className={`text-sm font-medium ${testResult.success ? "text-green-700" : "text-red-700"}`}>
              {testResult.success ? "Test Passed" : "Test Failed"}
            </span>
          </div>
          <pre className="text-xs font-mono overflow-x-auto whitespace-pre-wrap">
            {testResult.output}
          </pre>
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!formData.name || !formData.template}>
          {template ? "Update" : "Create"} Template
        </Button>
      </DialogFooter>
    </form>
  );
}
