"use client";

import * as React from "react";
import { ekuiperClient } from "@/lib/ekuiper/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { UploadFileModal } from "./upload-file-modal";
import { ChevronDown, File, Plus, UploadCloud, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FileAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  prefix?: string;
  placeholder?: string;
  disabled?: boolean;
  accept?: string;
  modalTitle?: string;
  className?: string;
}

export function FileAutocomplete({
  value,
  onChange,
  prefix = "file://",
  placeholder = "file:///etc/taos/config.json or http://...",
  disabled = false,
  accept,
  modalTitle = "Upload File",
  className,
}: FileAutocompleteProps) {
  const [uploads, setUploads] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [uploadModalOpen, setUploadModalOpen] = React.useState(false);

  const fetchUploads = React.useCallback(async () => {
    setLoading(true);
    try {
      const list = await ekuiperClient.listUploads();
      setUploads(Array.isArray(list) ? list : []);
    } catch {
      setUploads([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchUploads();
  }, [fetchUploads]);

  const handleSelect = (fileName: string) => {
    // If prefix is specified and file doesn't already have it, format as prefix + fileName
    const formatted = fileName.startsWith("file://") || fileName.startsWith("http://") || fileName.startsWith("https://")
      ? fileName
      : `${prefix}${fileName}`;
    onChange(formatted);
  };

  const handleUploadSuccess = (newFileName: string) => {
    void fetchUploads();
    handleSelect(newFileName);
  };

  return (
    <div className={cn("flex items-center gap-1.5 w-full", className)}>
      <div className="relative flex-1">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="font-mono text-xs pr-8 h-8 bg-background border-border"
        />
        {uploads.length > 0 && !disabled && (
          <div className="absolute right-1 top-1/2 -translate-y-1/2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 text-muted-foreground hover:text-foreground"
                  aria-label="Select uploaded file"
                >
                  <ChevronDown className="size-3.5" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 max-h-64 overflow-y-auto">
                <DropdownMenuLabel className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                  <span>Uploaded Files</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-4"
                    onClick={(e) => {
                      e.stopPropagation();
                      void fetchUploads();
                    }}
                    aria-label="Refresh uploaded files list"
                  >
                    <RefreshCw className={cn("size-3", loading && "animate-spin")} aria-hidden="true" />
                  </Button>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  {uploads.map((file) => (
                    <DropdownMenuItem
                      key={file}
                      onClick={() => handleSelect(file)}
                      className="font-mono text-xs flex items-center gap-2 cursor-pointer"
                    >
                      <File className="size-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate" title={file}>{file}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => setUploadModalOpen(true)}
              className="h-8 px-2.5 text-xs font-mono shrink-0 gap-1 border-border hover:bg-muted/50"
            >
              <UploadCloud className="h-3.5 w-3.5 text-muted-foreground" />
              Upload
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            Upload file or paste content directly to server
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <UploadFileModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        onSuccess={handleUploadSuccess}
        accept={accept}
        title={modalTitle}
      />
    </div>
  );
}
