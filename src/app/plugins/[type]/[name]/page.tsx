"use client";

import * as React from "react";
import { useServerStore } from "@/stores/server-store";
import { AppLayout } from "@/components/layout";
import { EmptyState, LoadingSpinner, ConfirmDialog } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Trash2,
  Plug,
  Code2,
  Box,
  RefreshCw,
  Upload,
  Activity,
  AlertTriangle,
  CheckCircle2,
  ListTree,
  Loader2,
} from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";

interface PluginDetails {
  name: string;
  version?: string;
  about?: Record<string, unknown>;
  refCount?: Record<string, number>;
  status?: string;
  errMsg?: string;
  pid?: number;
  functions?: string[];
  [key: string]: unknown;
}

type PluginType = "sources" | "sinks" | "functions" | "portables" | "udfs";

export default function PluginDetailPage() {
  const router = useRouter();
  const params = useParams();
  const type = params.type as PluginType;
  const name = params.name as string;

  const { servers, activeServerId } = useServerStore();
  const activeServer = servers.find((s) => s.id === activeServerId);

  const [plugin, setPlugin] = React.useState<PluginDetails | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  const [stopRulesOnDelete, setStopRulesOnDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  // Update dialog state
  const [showUpdateDialog, setShowUpdateDialog] = React.useState(false);
  const [updateUrl, setUpdateUrl] = React.useState("");
  const [updating, setUpdating] = React.useState(false);

  // Register functions state
  const [showRegisterDialog, setShowRegisterDialog] = React.useState(false);
  const [functionsToRegister, setFunctionsToRegister] = React.useState("");
  const [registering, setRegistering] = React.useState(false);

  const fetchPluginDetails = React.useCallback(async () => {
    if (!activeServer) {
      setError("No server selected");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/ekuiper/plugins/${type}/${name}`, {
        headers: {
          "X-EKuiper-URL": activeServer.url,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch plugin details: ${response.status}`);
      }

      if (type === "udfs") {
        // UDF endpoint returns the script content as text
        const content = await response.text();
        setPlugin({ name, content });
      } else {
        const data = await response.json();
        setPlugin(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch plugin details");
    } finally {
      setLoading(false);
    }
  }, [activeServer, type, name]);

  React.useEffect(() => {
    fetchPluginDetails();
  }, [fetchPluginDetails]);

  const handleDelete = async () => {
    if (!activeServer) return;
    setDeleting(true);

    try {
      const stopParam = stopRulesOnDelete ? "?stop=1" : "";
      const response = await fetch(`/api/ekuiper/plugins/${type}/${name}${stopParam}`, {
        method: "DELETE",
        headers: {
          "X-EKuiper-URL": activeServer.url,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to delete plugin: ${response.status}`);
      }

      toast.success(`Plugin "${name}" deleted successfully`);
      router.push("/plugins");
    } catch (err) {
      toast.error(`Failed to delete plugin: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleUpdate = async () => {
    if (!activeServer || !updateUrl) {
      toast.error("Please provide a plugin URL");
      return;
    }
    setUpdating(true);

    try {
      const response = await fetch(`/api/ekuiper/plugins/${type}/${name}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-EKuiper-URL": activeServer.url,
        },
        body: JSON.stringify({ name, file: updateUrl }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update plugin: ${response.status}`);
      }

      toast.success(`Plugin "${name}" updated successfully. Restart eKuiper for native plugins.`);
      setShowUpdateDialog(false);
      setUpdateUrl("");
      fetchPluginDetails();
    } catch (err) {
      toast.error(`Failed to update plugin: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setUpdating(false);
    }
  };

  const handleRegisterFunctions = async () => {
    if (!activeServer || !functionsToRegister.trim()) {
      toast.error("Please provide function names");
      return;
    }
    setRegistering(true);

    try {
      const functions = functionsToRegister.split(",").map((f) => f.trim()).filter(Boolean);
      const response = await fetch(`/api/ekuiper/plugins/functions/${name}/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-EKuiper-URL": activeServer.url,
        },
        body: JSON.stringify({ functions }),
      });

      if (!response.ok) {
        throw new Error(`Failed to register functions: ${response.status}`);
      }

      toast.success(`Functions registered for plugin "${name}"`);
      setShowRegisterDialog(false);
      setFunctionsToRegister("");
      fetchPluginDetails();
    } catch (err) {
      toast.error(`Failed to register functions: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setRegistering(false);
    }
  };

  const getPluginIcon = () => {
    switch (type) {
      case "sources":
        return <Plug className="h-6 w-6 text-blue-500" />;
      case "sinks":
        return <Plug className="h-6 w-6 text-green-500" />;
      case "functions":
        return <Code2 className="h-6 w-6 text-purple-500" />;
      case "portables":
        return <Box className="h-6 w-6 text-orange-500" />;
      case "udfs":
        return <Code2 className="h-6 w-6 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status?: string) => {
    if (!status) return null;
    const isRunning = status === "running";
    return (
      <Badge variant={isRunning ? "default" : "secondary"} className="ml-2">
        {isRunning ? (
          <><CheckCircle2 className="mr-1 h-3 w-3" /> Running</>
        ) : (
          <><AlertTriangle className="mr-1 h-3 w-3" /> {status}</>
        )}
      </Badge>
    );
  };

  if (!activeServer) {
    return (
      <AppLayout title={`Plugin: ${name}`}>
        <EmptyState
          title="No Server Connected"
          description="Connect to an eKuiper server to view plugin details."
        />
      </AppLayout>
    );
  }

  if (loading) {
    return (
      <AppLayout title={`Plugin: ${name}`}>
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout title={`Plugin: ${name}`}>
        <EmptyState
          title="Error Loading Plugin"
          description={error}
          actionLabel="Retry"
          onAction={fetchPluginDetails}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout title={`Plugin: ${name}`}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/plugins")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              {getPluginIcon()}
              <div>
                <div className="flex items-center">
                  <h2 className="text-2xl font-bold tracking-tight">{name}</h2>
                  {plugin?.version && (
                    <Badge variant="outline" className="ml-2">
                      v{plugin.version}
                    </Badge>
                  )}
                  {getStatusBadge(plugin?.status)}
                </div>
                <p className="text-muted-foreground capitalize">
                  {type.slice(0, -1)} Plugin
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={fetchPluginDetails}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={() => setShowUpdateDialog(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Update
            </Button>
            <Button
              variant="destructive"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>

        {/* Portable Status (if applicable) */}
        {type === "portables" && plugin?.status && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Runtime Status
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <p className="font-medium flex items-center gap-2">
                  {plugin.status === "running" ? (
                    <><CheckCircle2 className="h-4 w-4 text-green-500" /> Running</>
                  ) : (
                    <><AlertTriangle className="h-4 w-4 text-amber-500" /> {plugin.status}</>
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Process ID</p>
                <p className="font-medium">{plugin.pid || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Error</p>
                <p className="font-medium">{plugin.errMsg || "None"}</p>
              </div>
              {plugin.refCount && Object.keys(plugin.refCount).length > 0 && (
                <div className="col-span-3">
                  <p className="text-sm text-muted-foreground mb-2">Rule References</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(plugin.refCount).map(([rule, count]) => (
                      <Badge key={rule} variant="secondary">
                        {rule}: {count}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Function Registration (for function plugins) */}
        {type === "functions" && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ListTree className="h-5 w-5" />
                    Functions
                  </CardTitle>
                  <CardDescription>
                    Register exported functions from this plugin
                  </CardDescription>
                </div>
                <Button size="sm" onClick={() => setShowRegisterDialog(true)}>
                  <Code2 className="mr-2 h-4 w-4" />
                  Register Functions
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {plugin?.functions && Array.isArray(plugin.functions) && plugin.functions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {plugin.functions.map((func) => (
                    <Badge key={func} variant="outline">
                      {func}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  No functions registered. Click &quot;Register Functions&quot; to add exported functions.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Plugin Details */}
        <Card>
          <CardHeader>
            <CardTitle>Plugin Details</CardTitle>
            <CardDescription>
              Raw plugin information from eKuiper
            </CardDescription>
          </CardHeader>
          <CardContent>
            {type === "udfs" ? (
              <pre className="bg-muted rounded-lg p-4 overflow-x-auto text-sm font-mono whitespace-pre-wrap">
                {plugin?.content as string}
              </pre>
            ) : (
              <pre className="bg-muted rounded-lg p-4 overflow-x-auto text-sm">
                {JSON.stringify(plugin, null, 2)}
              </pre>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Plugin"
        description={
          <div className="space-y-4">
            <p>Are you sure you want to delete the plugin &quot;{name}&quot;? This action cannot be undone.</p>
            {type !== "portables" && (
              <div className="flex items-center space-x-2 p-3 bg-amber-500/10 rounded-lg">
                <Checkbox
                  id="stopRules"
                  checked={stopRulesOnDelete}
                  onCheckedChange={(checked) => setStopRulesOnDelete(checked as boolean)}
                />
                <label htmlFor="stopRules" className="text-sm">
                  Stop eKuiper after deletion (required for native plugins to take effect)
                </label>
              </div>
            )}
          </div>
        }
        confirmLabel={deleting ? "Deleting..." : "Delete"}
        variant="danger"
        onConfirm={handleDelete}
      />

      {/* Update Dialog */}
      <Dialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Plugin</DialogTitle>
            <DialogDescription>
              Provide a URL to the new version of the plugin zip file
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Plugin URL</Label>
              <Input
                value={updateUrl}
                onChange={(e) => setUpdateUrl(e.target.value)}
                placeholder="https://example.com/plugin-v2.0.zip"
              />
            </div>
            {type !== "portables" && (
              <div className="p-3 bg-amber-500/10 rounded-lg text-sm">
                <AlertTriangle className="inline h-4 w-4 mr-1" />
                Native plugins require an eKuiper restart to take effect.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpdateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={updating || !updateUrl}>
              {updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Plugin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Register Functions Dialog */}
      <Dialog open={showRegisterDialog} onOpenChange={setShowRegisterDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Register Functions</DialogTitle>
            <DialogDescription>
              Register exported functions from the plugin &quot;{name}&quot;
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Function Names (comma-separated)</Label>
              <Input
                value={functionsToRegister}
                onChange={(e) => setFunctionsToRegister(e.target.value)}
                placeholder="func1, func2, func3"
              />
              <p className="text-sm text-muted-foreground">
                Enter the names of functions exported by this plugin
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRegisterDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleRegisterFunctions} disabled={registering || !functionsToRegister.trim()}>
              {registering && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Register
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
