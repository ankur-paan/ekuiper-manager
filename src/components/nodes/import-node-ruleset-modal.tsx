'use client';

import * as React from 'react';
import { Upload, FileCode, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
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
import { CodeEditor } from '@/components/ui/code-editor';

interface ImportNodeRulesetModalProps {
  node: { id: string; name: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ImportNodeRulesetModal({
  node,
  open,
  onOpenChange,
  onSuccess,
}: ImportNodeRulesetModalProps) {
  const [content, setContent] = React.useState('');
  const [importing, setImporting] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void readJsonFile(file);
  };

  const readJsonFile = async (file: File) => {
    try {
      const text = await file.text();
      JSON.parse(text);
      setContent(text);
      toast.success(`Loaded ruleset "${file.name}"`);
    } catch {
      toast.error('Selected file is not valid JSON');
    }
  };

  const handleImport = async () => {
    if (!node) return;
    const trimmed = content.trim();
    if (!trimmed) {
      toast.error('Please enter or select a ruleset JSON file');
      return;
    }

    try {
      JSON.parse(trimmed);
    } catch {
      toast.error('Content is not valid JSON');
      return;
    }

    setImporting(true);
    try {
      const res = await fetch(`/api/nodes/${encodeURIComponent(node.id)}/ruleset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: trimmed }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Import failed (${res.status})`);
      }

      toast.success(`Ruleset successfully restored to ${node.name}`);
      onOpenChange(false);
      setContent('');
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to import ruleset');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader className="pr-8 sm:pr-0">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Upload className="size-5" aria-hidden="true" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold tracking-tight">
                Import Ruleset to {node?.name}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Restore or migrate complete streams, tables, rules, and configurations into this node.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2">
          {/* Dropzone */}
          <div
            role="button"
            tabIndex={0}
            aria-label="Upload ruleset JSON file"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
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
              Drop ruleset <span className="font-mono text-foreground">.json</span> file here or click to browse
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <Label className="text-xs font-medium">Ruleset JSON Content</Label>
              {content && (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Clear JSON ruleset content"
                  className="h-6 text-[10px] text-muted-foreground hover:text-foreground px-2"
                  onClick={() => setContent('')}
                >
                  Clear
                </Button>
              )}
            </div>
            <div className="h-[200px] rounded-md border border-border/80 overflow-hidden font-mono text-xs">
              <CodeEditor
                value={content}
                onChange={setContent}
                language="json"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing} className="touch-manipulation">
            Cancel
          </Button>
          <Button onClick={() => void handleImport()} disabled={importing || !content.trim()} className="touch-manipulation">
            {importing && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />}
            {importing ? 'Importing…' : 'Restore Ruleset'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
