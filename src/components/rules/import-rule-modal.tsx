'use client';

import * as React from 'react';
import { Upload, FileText, Link2, Check, AlertCircle, FileCode, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { CodeEditor } from '@/components/ui/code-editor';
import { FileAutocomplete } from '@/components/uploads/file-autocomplete';
import { ekuiperClient } from '@/lib/ekuiper/client';

interface ImportRuleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ImportRuleModal({ open, onOpenChange, onSuccess }: ImportRuleModalProps) {
  const [tab, setTab] = React.useState<'editor' | 'file'>('editor');
  const [jsonContent, setJsonContent] = React.useState('');
  const [filePath, setFilePath] = React.useState('');
  const [partial, setPartial] = React.useState(true);
  const [stopOnError, setStopOnError] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void readJsonFile(file);
    }
  };

  const readJsonFile = async (file: File) => {
    try {
      const text = await file.text();
      // Test parse
      JSON.parse(text);
      setJsonContent(text);
      toast.success(`Loaded "${file.name}"`);
    } catch {
      toast.error('Selected file is not valid JSON');
    }
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      if (tab === 'editor') {
        const trimmed = jsonContent.trim();
        if (!trimmed) {
          toast.error('Please enter or drop rules JSON content');
          return;
        }
        // Validate JSON
        try {
          JSON.parse(trimmed);
        } catch {
          toast.error('Content is not valid JSON');
          return;
        }
        await ekuiperClient.importData(trimmed, { partial, stop: stopOnError });
      } else {
        const trimmedPath = filePath.trim();
        if (!trimmedPath) {
          toast.error('Please select or enter a file URL');
          return;
        }
        await ekuiperClient.importData({ file: trimmedPath } as any, { partial, stop: stopOnError });
      }

      toast.success('Rules imported successfully');
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to import rules');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Upload className="size-5" aria-hidden="true" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold tracking-tight">Import Ruleset</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Import exported rule definitions, streams, and configurations into the current node.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Tab switch */}
        <div className="flex items-center gap-1 p-1 bg-muted/60 rounded-lg text-xs font-medium w-fit border border-border/50 select-none" role="tablist" aria-label="Import format">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'editor'}
            onClick={() => setTab('editor')}
            className={`px-3 py-1.5 rounded-md transition-[background-color,color,box-shadow,transform] duration-150 ease-out active:scale-[0.98] flex items-center gap-1.5 ${
              tab === 'editor'
                ? 'bg-background text-foreground shadow-beautiful-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
            }`}
          >
            <FileCode className="size-3.5" aria-hidden="true" />
            JSON Content / Drop
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'file'}
            onClick={() => setTab('file')}
            className={`px-3 py-1.5 rounded-md transition-[background-color,color,box-shadow,transform] duration-150 ease-out active:scale-[0.98] flex items-center gap-1.5 ${
              tab === 'file'
                ? 'bg-background text-foreground shadow-beautiful-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
            }`}
          >
            <Link2 className="size-3.5" aria-hidden="true" />
            Uploaded File (`file://`)
          </button>
        </div>

        {tab === 'editor' ? (
          <div className="flex flex-col gap-3">
            <div
              role="button"
              tabIndex={0}
              aria-label="Drop ruleset JSON file or browse"
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-border/70 hover:border-border hover:bg-muted/30'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                aria-label="Choose ruleset JSON file"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void readJsonFile(f);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Drop your <span className="font-mono text-foreground">.json</span> ruleset file here or click to browse
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <Label className="text-xs font-medium">JSON Definition</Label>
                {jsonContent && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] text-muted-foreground hover:text-foreground px-2"
                    onClick={() => setJsonContent('')}
                    aria-label="Clear JSON definition"
                  >
                    Clear
                  </Button>
                )}
              </div>
              <div className="h-[220px] rounded-md border border-border/80 overflow-hidden font-mono text-xs">
                <CodeEditor
                  value={jsonContent}
                  onChange={setJsonContent}
                  language="json"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label className="text-xs font-medium">File Path or URL</Label>
              <FileAutocomplete
                value={filePath}
                onChange={setFilePath}
                accept=".json,.txt"
                prefix="file://"
                placeholder="file://rules-export.json or http://..."
              />
              <p className="text-[11px] text-muted-foreground">
                Select an uploaded file from <span className="font-mono text-xs">/config/uploads</span> or specify a direct HTTP endpoint.
              </p>
            </div>
          </div>
        )}

        {/* Options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/50 text-xs">
          <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/50 bg-muted/20">
            <div>
              <span className="font-medium text-foreground block">Partial Import</span>
              <span className="text-[11px] text-muted-foreground">Skip failed entries and continue</span>
            </div>
            <Switch checked={partial} onCheckedChange={setPartial} aria-label="Partial Import" />
          </div>
          <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/50 bg-muted/20">
            <div>
              <span className="font-medium text-foreground block">Stop on Error</span>
              <span className="text-[11px] text-muted-foreground">Halt on first rule failure</span>
            </div>
            <Switch checked={stopOnError} onCheckedChange={setStopOnError} aria-label="Stop on Error" />
          </div>
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing} className="touch-manipulation">
            Cancel
          </Button>
          <Button onClick={() => void handleImport()} disabled={importing} className="touch-manipulation">
            {importing && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />}
            {importing ? 'Importing…' : 'Import Rules'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
