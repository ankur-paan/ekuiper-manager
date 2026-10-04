"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CodeEditor } from "@/components/ui/code-editor";
import { ekuiperClient } from "@/lib/ekuiper/client";
import { UploadCloud, FileCode2, File, Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface UploadFileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (fileName: string) => void;
  accept?: string;
  defaultMode?: "file" | "text";
  defaultFileName?: string;
  defaultContent?: string;
  title?: string;
}

function detectLanguage(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "proto":
      return "proto";
    case "json":
      return "json";
    case "yaml":
    case "yml":
      return "yaml";
    case "sql":
      return "sql";
    case "js":
      return "javascript";
    default:
      return "plaintext";
  }
}

export function UploadFileModal({
  open,
  onOpenChange,
  onSuccess,
  accept,
  defaultMode = "file",
  defaultFileName = "",
  defaultContent = "",
  title = "Create or Upload File",
}: UploadFileModalProps) {
  const [mode, setMode] = React.useState<"file" | "text">(defaultMode);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [textFileName, setTextFileName] = React.useState(defaultFileName);
  const [textContent, setTextContent] = React.useState(defaultContent);
  const [isDragging, setIsDragging] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      setMode(defaultMode);
      setSelectedFile(null);
      setTextFileName(defaultFileName);
      setTextContent(defaultContent);
      setIsDragging(false);
      setSubmitting(false);
    }
  }, [open, defaultMode, defaultFileName, defaultContent]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      let fileToUpload: File;
      let finalName = "";

      if (mode === "file") {
        if (!selectedFile) {
          toast.error("Please select a file to upload");
          setSubmitting(false);
          return;
        }
        fileToUpload = selectedFile;
        finalName = selectedFile.name;
      } else {
        const trimmedName = textFileName.trim();
        if (!trimmedName) {
          toast.error("File name is required");
          setSubmitting(false);
          return;
        }
        if (!textContent.trim()) {
          toast.error("File content cannot be empty");
          setSubmitting(false);
          return;
        }
        fileToUpload = new (window.File || globalThis.File)([textContent], trimmedName, {
          type: "text/plain",
        });
        finalName = trimmedName;
      }

      const formData = new FormData();
      formData.append("file", fileToUpload);

      await ekuiperClient.uploadFile(formData);
      toast.success(`File "${finalName}" uploaded successfully`);
      onSuccess?.(finalName);
      onOpenChange(false);
    } catch (err) {
      toast.error(
        `Upload failed: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      setSubmitting(false);
    }
  };

  const currentLang = detectLanguage(textFileName);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card border-border shadow-beautiful-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold tracking-tight">
            {title}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Upload a file or create configuration content directly on the eKuiper
            node.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={mode}
          onValueChange={(val) => setMode(val as "file" | "text")}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2 bg-muted/60 p-1 mb-4 h-9">
            <TabsTrigger
              value="file"
              className="text-xs font-medium data-[state=active]:bg-background data-[state=active]:text-foreground transition-all flex items-center gap-1.5"
            >
              <UploadCloud className="size-3.5" aria-hidden="true" />
              File Upload
            </TabsTrigger>
            <TabsTrigger
              value="text"
              className="text-xs font-medium data-[state=active]:bg-background data-[state=active]:text-foreground transition-all flex items-center gap-1.5"
            >
              <FileCode2 className="size-3.5" aria-hidden="true" />
              Text / Code Editor
            </TabsTrigger>
          </TabsList>

          <TabsContent value="file" className="flex flex-col gap-4 m-0 focus-visible:outline-none">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept={accept}
              className="hidden"
              aria-label="Select file to upload"
            />

            {!selectedFile ? (
              <div
                role="button"
                tabIndex={0}
                aria-label="Upload file by dropping or browsing"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                className={cn(
                  "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors duration-150 flex flex-col items-center justify-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-muted/30"
                )}
              >
                <div className="size-12 rounded-full bg-muted/70 flex items-center justify-center text-muted-foreground">
                  <UploadCloud className="size-6" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Click to browse or drop file here
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                    {accept ? `Accepted: ${accept}` : "All file types supported (.proto, .so, .zip, .json, .yaml)"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3.5 rounded-lg border border-border bg-muted/20">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                    <File className="size-5 text-primary" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-mono font-medium text-foreground truncate" title={selectedFile.name}>
                      {selectedFile.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-foreground shrink-0 touch-manipulation"
                  onClick={() => setSelectedFile(null)}
                  aria-label="Remove selected file"
                >
                  <X className="size-4" aria-hidden="true" />
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="text" className="flex flex-col gap-3 m-0 focus-visible:outline-none">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="upload-text-filename" className="text-xs font-medium">
                  File Name
                </Label>
                <span className="text-[11px] font-mono text-muted-foreground">
                  Format: {currentLang}
                </span>
              </div>
              <Input
                id="upload-text-filename"
                value={textFileName}
                onChange={(e) => setTextFileName(e.target.value)}
                placeholder="e.g. schema.proto, config.yaml, or payload.json"
                className="font-mono text-base md:text-xs h-9"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">File Content</Label>
              <div className="h-[280px] w-full border rounded-md overflow-hidden bg-background">
                <CodeEditor
                  value={textContent}
                  onChange={setTextContent}
                  language={currentLang}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-2 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={submitting || (mode === "file" && !selectedFile)}
            className="gap-1.5"
          >
            {submitting ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="size-3.5" aria-hidden="true" />
            )}
            {submitting ? "Uploading..." : "Save to Server"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
