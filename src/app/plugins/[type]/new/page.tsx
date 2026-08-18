"use client";

import * as React from "react";
import { useServerStore } from "@/stores/server-store";
import { ekuiperClient } from "@/lib/ekuiper/client";
import type { PluginType } from "@/lib/ekuiper/types";
import { AppLayout } from "@/components/layout";
import { EmptyState } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Upload,
  Download,
  Loader2,
  Plug,
  Code2,
  Box,
} from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";

type InstallablePluginType = Exclude<PluginType, "udfs">;

const installablePluginTypes: InstallablePluginType[] = ["sources", "sinks", "functions", "portables"];

function isInstallablePluginType(value: string): value is InstallablePluginType {
  return installablePluginTypes.includes(value as InstallablePluginType);
}

interface PrebuildPlugin {
  name: string;
  file: string;
}

export default function InstallPluginPage() {
  const router = useRouter();
  const params = useParams();
  const typeParam = String(params.type);
  const type = isInstallablePluginType(typeParam) ? typeParam : null;

  const { servers, activeServerId } = useServerStore();
  const activeServer = servers.find((s) => s.id === activeServerId);

  const [installMethod, setInstallMethod] = React.useState<"url" | "prebuild">("prebuild");
  const [pluginName, setPluginName] = React.useState("");
  const [fileUrl, setFileUrl] = React.useState("");
  const [shellPaths, setShellPaths] = React.useState("");
  const [installing, setInstalling] = React.useState(false);

  const [prebuildPlugins, setPrebuildPlugins] = React.useState<PrebuildPlugin[]>([]);
  const [selectedPrebuild, setSelectedPrebuild] = React.useState("");
  const [loadingPrebuild, setLoadingPrebuild] = React.useState(false);

  // Fetch prebuild plugins
  React.useEffect(() => {
    const fetchPrebuild = async () => {
      if (!activeServer || !type || type === "portables") return;

      setLoadingPrebuild(true);
      try {
        const data = await ekuiperClient.getPrebuiltPlugins(type);
        if (data && typeof data === "object") {
          const plugins = Object.entries(data).map(([name, file]) => ({ name, file }));
          setPrebuildPlugins(plugins);
        }
      } catch (err) {
        console.error("Failed to fetch prebuild plugins:", err);
      } finally {
        setLoadingPrebuild(false);
      }
    };

    void fetchPrebuild();
  }, [activeServer, type]);

  const handleInstall = async () => {
    if (!activeServer || !type) return;

    const method = type === "portables" ? "url" : installMethod;
    const name = method === "prebuild" ? selectedPrebuild : pluginName;
    const url = method === "prebuild"
      ? prebuildPlugins.find((p) => p.name === selectedPrebuild)?.file
      : fileUrl;

    if (!name) {
      toast.error("Plugin name is required");
      return;
    }

    if (!url) {
      toast.error("Plugin URL is required");
      return;
    }

    setInstalling(true);

    try {
      const body = {
        name,
        file: url,
        ...(shellPaths ? { shellParas: shellPaths.split(",").map((value) => value.trim()).filter(Boolean) } : {}),
      };
      await ekuiperClient.createPlugin(type, body);

      toast.success(`Plugin "${name}" installed successfully`);
      router.push("/plugins");
    } catch (err) {
      toast.error(`Failed to install plugin: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setInstalling(false);
    }
  };

  const getPluginIcon = () => {
    switch (type) {
      case "sources":
        return <Plug className="h-5 w-5 text-blue-500" />;
      case "sinks":
        return <Plug className="h-5 w-5 text-green-500" />;
      case "functions":
        return <Code2 className="h-5 w-5 text-purple-500" />;
      case "portables":
        return <Box className="h-5 w-5 text-orange-500" />;
    }
  };

  if (!type) {
    return (
      <AppLayout title="Install Plugin">
        <EmptyState title="Unsupported plugin type" description="Install source, sink, function, or portable plugins here. JavaScript UDFs are managed under Functions." actionLabel="Back to plugins" onAction={() => router.push("/plugins")} />
      </AppLayout>
    );
  }

  if (!activeServer) {
    return (
      <AppLayout title="Install Plugin">
        <EmptyState
          title="No Server Connected"
          description="Connect to an eKuiper server to install plugins."
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Install Plugin">
      <div className="space-y-6 max-w-2xl">
        {/* Header */}
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
              <h2 className="text-2xl font-bold tracking-tight capitalize">
                Install {type.slice(0, -1)} Plugin
              </h2>
              <p className="text-muted-foreground">
                Add a new {type.slice(0, -1)} plugin to eKuiper
              </p>
            </div>
          </div>
        </div>

        {/* Install Form */}
        <Card>
          <CardHeader>
            <CardTitle>Plugin Installation</CardTitle>
            <CardDescription>
              Install a plugin from a prebuild repository or custom URL
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Installation Method */}
            {type !== "portables" && (
              <Tabs value={installMethod} onValueChange={(v) => setInstallMethod(v as "url" | "prebuild")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="prebuild">
                    <Download className="mr-2 h-4 w-4" />
                    Prebuild
                  </TabsTrigger>
                  <TabsTrigger value="url">
                    <Upload className="mr-2 h-4 w-4" />
                    Custom URL
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="prebuild" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Select Plugin</Label>
                    <Select value={selectedPrebuild} onValueChange={setSelectedPrebuild}>
                      <SelectTrigger>
                        <SelectValue placeholder={loadingPrebuild ? "Loading..." : "Select a plugin"} />
                      </SelectTrigger>
                      <SelectContent>
                        {prebuildPlugins.map((plugin) => (
                          <SelectItem key={plugin.name} value={plugin.name}>
                            {plugin.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {prebuildPlugins.length === 0 && !loadingPrebuild && (
                      <p className="text-sm text-muted-foreground">
                        No prebuild plugins available for this type.
                      </p>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="url" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Plugin Name</Label>
                    <Input
                      id="name"
                      value={pluginName}
                      onChange={(e) => setPluginName(e.target.value)}
                      placeholder="myPlugin"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="url">Plugin URL</Label>
                    <Input
                      id="url"
                      value={fileUrl}
                      onChange={(e) => setFileUrl(e.target.value)}
                      placeholder="https://example.com/myPlugin.zip"
                    />
                    <p className="text-sm text-muted-foreground">
                      URL to the plugin zip file
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
            )}

            {/* Portable plugin form */}
            {type === "portables" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Plugin Name</Label>
                  <Input
                    id="name"
                    value={pluginName}
                    onChange={(e) => setPluginName(e.target.value)}
                    placeholder="myPortablePlugin"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="url">Plugin package URL</Label>
                  <Input
                    id="url"
                    value={fileUrl}
                    onChange={(e) => setFileUrl(e.target.value)}
                    placeholder="https://example.com/myPlugin.zip"
                  />
                  <p className="text-sm text-muted-foreground">
                    URL to the plugin zip file
                  </p>
                </div>
              </div>
            )}

            {/* Advanced Options */}
            <div className="space-y-2">
                <Label htmlFor="shell">Shell Parameters (optional)</Label>
                <Input
                  id="shell"
                  value={shellPaths}
                  onChange={(e) => setShellPaths(e.target.value)}
                  placeholder="--param1=value1, --param2=value2"
                />
                <p className="text-sm text-muted-foreground">
                  Additional shell parameters for plugin installation
                </p>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => router.push("/plugins")}
              >
                Cancel
              </Button>
              <Button onClick={handleInstall} disabled={installing}>
                {installing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Install Plugin
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
