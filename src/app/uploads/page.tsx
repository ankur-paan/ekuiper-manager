"use client";

import * as React from "react";
import { useServerStore } from "@/stores/server-store";
import { ekuiperClient } from "@/lib/ekuiper/client";
import { AppLayout } from "@/components/layout";
import { DataTable } from "@/components/common/data-table";
import { EmptyState, ErrorState, ConfirmDialog } from "@/components/common";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type ColumnDef } from "@tanstack/react-table";
import {
  MoreHorizontal,
  File,
  Trash2,
  UploadCloud,
  ArrowUpDown,
  Download,
  Copy,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface UploadItem {
  name: string;
}

export default function UploadsPage() {
  const { servers, activeServerId } = useServerStore();
  const activeServer = servers.find((s) => s.id === activeServerId);

  const [data, setData] = React.useState<UploadItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [deleteName, setDeleteName] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const fetchData = React.useCallback(async () => {
    if (!activeServer) return;

    setLoading(true);
    setError(null);
    ekuiperClient.setBaseUrl(activeServer.url);

    try {
      const list = await ekuiperClient.listUploads();
      const items = Array.isArray(list) ? list.map(name => ({ name })) : [];
      setData(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch uploads");
    } finally {
      setLoading(false);
    }
  }, [activeServer]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async () => {
    if (!deleteName || !activeServer) return;

    try {
      await ekuiperClient.deleteUpload(deleteName);
      toast.success(`File "${deleteName}" deleted successfully`);
      setDeleteName(null);
      fetchData();
    } catch (err) {
      toast.error(`Failed to delete file: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  const uploadFile = async (file: File) => {
    if (!activeServer) return;
    setUploading(true);
    ekuiperClient.setBaseUrl(activeServer.url);

    const formData = new FormData();
    formData.append("file", file);

    try {
      await ekuiperClient.uploadFile(formData);
      toast.success(`File "${file.name}" uploaded successfully`);
      fetchData();
    } catch (err) {
      toast.error(`Upload failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadFile(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      uploadFile(file);
    }
  };

  const handleDownload = (name: string) => {
    if (!activeServer) return;
    // Using window.open to trigger download from generic endpoint
    // Adjust path if eKuiper exposes static files differently
    const url = `${activeServer.url}/data/uploads/${name}`;
    window.open(url, '_blank');
  };

  const handleCopyPath = (name: string) => {
    const path = `data/uploads/${name}`;
    navigator.clipboard.writeText(path);
    toast.success("Path copied to clipboard", {
      description: path,
      icon: <CheckCircle2 className="h-4 w-4 text-green-500" />
    });
  };

  const columns: ColumnDef<UploadItem>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          File Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <File className="h-4 w-4 text-blue-500" />
          <span className="font-medium">{row.getValue("name")}</span>
        </div>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" onClick={() => handleCopyPath(row.original.name)} title="Copy Path">
            <Copy className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleDownload(row.original.name)} title="Download">
            <Download className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setDeleteName(row.original.name)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  if (!activeServer) {
    return (
      <AppLayout title="File Uploads">
        <EmptyState title="No Server Connected" description="Connect to an eKuiper server to manage uploads." />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="File Uploads">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">File Uploads</h2>
          <p className="text-muted-foreground">Manage static assets, lookup tables, and custom plugins/schemas.</p>
        </div>

        {/* Drag & Drop Zone */}
        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center transition-colors cursor-pointer bg-muted/20",
            isDragging ? "border-primary bg-primary/10" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30",
            uploading && "opacity-50 cursor-not-allowed"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileChange}
            disabled={uploading}
          />
          <div className={`p-4 rounded-full ${isDragging ? 'bg-primary/20' : 'bg-muted'} mb-4`}>
            <UploadCloud className={cn("h-8 w-8", isDragging ? "text-primary" : "text-muted-foreground")} />
          </div>
          <h3 className="font-semibold text-lg mb-1">
            {uploading ? "Uploading..." : "Click or drag file to upload"}
          </h3>
          <p className="text-sm text-muted-foreground">
            Supports all file types (JSON, CSV, JAR, SO)
          </p>
        </div>

        {error ? (
          <ErrorState title="Error" description={error} onRetry={fetchData} />
        ) : (
          <DataTable
            columns={columns}
            data={data}
            searchKey="name"
            searchPlaceholder="Search files..."
            loading={loading}
            emptyMessage="No files found"
          />
        )}

        <ConfirmDialog
          open={!!deleteName}
          onOpenChange={(open) => !open && setDeleteName(null)}
          title="Delete File"
          description={`Are you sure you want to delete "${deleteName}"? Configurations relying on this file path will break.`}
          onConfirm={handleDelete}
          variant="danger"
        />
      </div>
    </AppLayout>
  );
}
