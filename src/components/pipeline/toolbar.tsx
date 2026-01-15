"use client";

import { useState, useEffect } from "react";
import { usePipelineStore } from "@/stores/pipeline-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Save,
  FolderOpen,
  FileDown,
  Play,
  Square,
  RotateCcw,
  Code,
  Settings,
  Undo2,
  Redo2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";

export function PipelineToolbar() {
  const {
    pipelineName,
    pipelineDescription,
    isDirty,
    nodes,
    canUndo,
    canRedo,
    undo,
    redo,
    setPipelineInfo,
    generateRules,
    generateStreams,
    exportPipeline,
  } = usePipelineStore();

  const [showExport, setShowExport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editName, setEditName] = useState(pipelineName);
  const [editDescription, setEditDescription] = useState(pipelineDescription);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        if (e.shiftKey) {
          e.preventDefault();
          redo();
        } else {
          e.preventDefault();
          undo();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  const handleSaveSettings = () => {
    setPipelineInfo(editName, editDescription);
    setShowSettings(false);
    toast({
      title: "Pipeline saved",
      description: "Pipeline settings have been updated",
    });
  };

  const handleExport = () => {
    const pipeline = exportPipeline();
    const json = JSON.stringify(pipeline, null, 2);
    
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${pipelineName.replace(/\s+/g, "_").toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: "Exported",
      description: "Pipeline exported as JSON",
    });
  };

  const handleDeploy = () => {
    const rules = generateRules();
    const streams = generateStreams();
    
    console.log("Generated Streams:", streams);
    console.log("Generated Rules:", rules);
    
    toast({
      title: "Deploy Preview",
      description: `Would create ${streams.length} streams and ${rules.length} rules`,
    });
  };

  return (
    <div className="flex items-center gap-2 bg-card p-2 rounded-lg border border-border">
      {/* Pipeline Name */}
      <div className="flex items-center gap-2 px-2">
        <span className="text-sm font-medium">{pipelineName}</span>
        {isDirty && (
          <Badge variant="warning" className="text-xs">
            Unsaved
          </Badge>
        )}
      </div>

      <div className="h-6 w-px bg-border" />

      {/* Undo/Redo */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={undo}
            disabled={!canUndo}
            className="gap-1"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Undo (Ctrl+Z)</p>
        </TooltipContent>
      </Tooltip>
      
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={redo}
            disabled={!canRedo}
            className="gap-1"
          >
            <Redo2 className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Redo (Ctrl+Shift+Z)</p>
        </TooltipContent>
      </Tooltip>

      <div className="h-6 w-px bg-border" />

      {/* Settings */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1">
            <Settings className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pipeline Settings</DialogTitle>
            <DialogDescription>
              Configure your decision tree pipeline
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Pipeline name"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Describe your pipeline..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettings(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSettings}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export */}
      <Button variant="ghost" size="sm" className="gap-1" onClick={handleExport}>
        <FileDown className="h-4 w-4" />
        Export
      </Button>

      {/* View Generated Code */}
      <Dialog open={showExport} onOpenChange={setShowExport}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1">
            <Code className="h-4 w-4" />
            Preview
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Generated eKuiper Configuration</DialogTitle>
            <DialogDescription>
              Preview the streams and rules that will be created
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="streams" className="flex-1 overflow-hidden">
            <TabsList>
              <TabsTrigger value="streams">
                Streams ({generateStreams().length})
              </TabsTrigger>
              <TabsTrigger value="rules">
                Rules ({generateRules().length})
              </TabsTrigger>
              <TabsTrigger value="json">
                Pipeline JSON
              </TabsTrigger>
            </TabsList>
            <TabsContent value="streams" className="h-[400px] overflow-auto">
              <pre className="text-sm bg-muted p-4 rounded-lg overflow-x-auto">
                {generateStreams().join("\n\n") || "No streams defined"}
              </pre>
            </TabsContent>
            <TabsContent value="rules" className="h-[400px] overflow-auto">
              <pre className="text-sm bg-muted p-4 rounded-lg overflow-x-auto">
                {JSON.stringify(generateRules(), null, 2) || "No rules defined"}
              </pre>
            </TabsContent>
            <TabsContent value="json" className="h-[400px] overflow-auto">
              <pre className="text-sm bg-muted p-4 rounded-lg overflow-x-auto">
                {JSON.stringify(exportPipeline(), null, 2)}
              </pre>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <div className="h-6 w-px bg-border" />

      {/* Deploy Actions */}
      <Button
        variant="default"
        size="sm"
        className="gap-1"
        onClick={handleDeploy}
        disabled={nodes.length === 0}
      >
        <Play className="h-4 w-4" />
        Deploy
      </Button>
    </div>
  );
}
