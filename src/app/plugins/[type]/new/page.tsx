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
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileAutocomplete } from "@/components/uploads/file-autocomplete";
import {
  ArrowLeft,
  Upload,
  Download,
  Loader2,
  Plug,
  Code2,
  Box,
  ExternalLink,
  HelpCircle,
  Sparkles,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

  const [installMethod, setInstallMethod] = React.useState<"prebuild" | "custom">("prebuild");
  const [pluginName, setPluginName] = React.useState("");
  const [fileUrl, setFileUrl] = React.useState("");
  const [shellParasText, setShellParasText] = React.useState("");
  const [functionsText, setFunctionsText] = React.useState("");
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
          const plugins = Object.entries(data).map(([name, file]) => ({ name, file: String(file) }));
          setPrebuildPlugins(plugins);
          if (plugins.length > 0 && !selectedPrebuild) {
            setSelectedPrebuild(plugins[0].name);
            setFileUrl(plugins[0].file);
            setPluginName(plugins[0].name);
          }
        }
      } catch (err) {
        console.error("Failed to fetch prebuild plugins:", err);
      } finally {
        setLoadingPrebuild(false);
      }
    };

    void fetchPrebuild();
  }, [activeServer, type]);

  const handlePrebuildChange = (name: string) => {
    setSelectedPrebuild(name);
    setPluginName(name);
    const found = prebuildPlugins.find((p) => p.name === name);
    if (found) {
      setFileUrl(found.file);
    }
    // Auto-suggest known TDengine shell parameters
    if (name.toLowerCase().includes("tdengine")) {
      setShellParasText("-c, /etc/taos");
    }
  };

  const handleInstall = async () => {
    if (!activeServer || !type) return;

    const method = type === "portables" ? "custom" : installMethod;
    const name = (method === "prebuild" ? selectedPrebuild : pluginName).trim();
    const url = (method === "prebuild"
      ? prebuildPlugins.find((p) => p.name === selectedPrebuild)?.file || fileUrl
      : fileUrl).trim();

    if (!name) {
      toast.error("Plugin name is required");
      return;
    }

    if (!url) {
      toast.error("Plugin file or URL is required");
      return;
    }

    setInstalling(true);

    try {
      const shellParas = shellParasText
        ? shellParasText.split(",").map((v) => v.trim()).filter(Boolean)
        : undefined;

      const functions = (type === "functions" && functionsText)
        ? functionsText.split(",").map((v) => v.trim()).filter(Boolean)
        : undefined;

      const body = {
        name,
        file: url,
        ...(shellParas && shellParas.length > 0 ? { shellParas } : {}),
        ...(functions && functions.length > 0 ? { functions } : {}),
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
        return <Plug className="size-5 text-blue-500" />;
      case "sinks":
        return <Plug className="size-5 text-green-500" />;
      case "functions":
        return <Code2 className="size-5 text-purple-500" />;
      case "portables":
        return <Box className="size-5 text-orange-500" />;
      default:
        return <Plug className="size-5 text-muted-foreground" />;
    }
  };

  if (!type) {
    return (
      <AppLayout title="Install Plugin">
        <EmptyState
          title="Unsupported plugin type"
          description="Install source, sink, function, or portable plugins here."
          actionLabel="Back to plugins"
          onAction={() => router.push("/plugins")}
        />
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

  const docUrl = `https://ekuiper.org/docs/en/latest/plugins/${type}/${(pluginName || selectedPrebuild).toLowerCase()}.html`;

  return (
    <AppLayout title="Install Plugin">
      <div className="flex flex-col gap-6 max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/plugins")}
            aria-label="Back to plugins"
          >
            <ArrowLeft className="size-5" />
          </Button>
          <div className="flex items-center gap-3">
            {getPluginIcon()}
            <div>
              <h2 className="text-2xl font-bold tracking-tight capitalize">
                Install {type.slice(0, -1)} Plugin
              </h2>
              <p className="text-muted-foreground text-xs">
                Install a prebuilt extension or local package into the eKuiper edge runtime.
              </p>
            </div>
          </div>
        </div>

        {/* Install Form */}
        <Card className="border-border">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Plugin Parameters</CardTitle>
                <CardDescription className="text-xs">
                  Configure package source, execution arguments, and exposed symbols.
                </CardDescription>
              </div>
              {(pluginName || selectedPrebuild) && (
                <a
                  href={docUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
                >
                  <ExternalLink className="size-3.5" />
                  Documentation
                </a>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {/* Installation Method */}
            {type === "portables" && (
              <div className="flex items-center justify-between p-3 rounded-lg border border-border/70 bg-muted/30 text-xs">
                <div className="flex flex-col gap-0.5">
                  <div className="font-medium text-foreground">Portable Plugin Template</div>
                  <div className="text-[11px] text-muted-foreground">Download reference portable plugin structure (.zip) with sample JSON manifest and runtime.</div>
                </div>
                <a
                  href="/template/portable-sample.zip"
                  download="portable-sample.zip"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-background border border-border rounded shadow-beautiful-sm hover:bg-accent active:scale-[0.97] transition-all shrink-0"
                >
                  <Download className="size-3.5" />
                  Sample .zip
                </a>
              </div>
            )}
            {type !== "portables" && (
              <Tabs
                value={installMethod}
                onValueChange={(v) => setInstallMethod(v as "prebuild" | "custom")}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-2 h-8 bg-muted/60 p-0.5">
                  <TabsTrigger
                    value="prebuild"
                    className="text-xs font-medium data-[state=active]:bg-background flex items-center gap-1.5"
                  >
                    <Download className="size-3.5" />
                    Prebuilt Catalog
                  </TabsTrigger>
                  <TabsTrigger
                    value="custom"
                    className="text-xs font-medium data-[state=active]:bg-background flex items-center gap-1.5"
                  >
                    <Upload className="size-3.5" />
                    Custom File / URL
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="prebuild" className="flex flex-col gap-4 mt-4 m-0 focus-visible:outline-none">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium">Select Prebuilt Plugin</Label>
                    <Select value={selectedPrebuild} onValueChange={handlePrebuildChange}>
                      <SelectTrigger className="h-8 text-xs font-mono">
                        <SelectValue
                          placeholder={loadingPrebuild ? "Loading prebuilts..." : "Select a plugin"}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {prebuildPlugins.map((plugin) => (
                            <SelectItem key={plugin.name} value={plugin.name} className="text-xs font-mono">
                              {plugin.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    {prebuildPlugins.length === 0 && !loadingPrebuild && (
                      <p className="text-xs text-muted-foreground">
                        No official prebuild binaries listed by this eKuiper version.
                      </p>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            )}

            {/* Plugin Name & URL */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="plugin-name" className="text-xs font-medium">
                  Plugin Name *
                </Label>
                <Input
                  id="plugin-name"
                  value={pluginName}
                  onChange={(e) => setPluginName(e.target.value)}
                  placeholder="e.g. tdengine, echo, zmq"
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="plugin-url" className="text-xs font-medium">
                  Package File (.zip) or Remote URL *
                </Label>
                <FileAutocomplete
                  value={fileUrl}
                  onChange={setFileUrl}
                  placeholder="file:///tmp/plugins/my_plugin.zip or http://..."
                  accept=".zip"
                  modalTitle="Upload Plugin Zip Package"
                />
                <p className="text-[11px] text-muted-foreground">
                  Reference an uploaded file with <code className="font-mono text-foreground">file://</code> or a downloadable HTTP link.
                </p>
              </div>
            </div>

            {/* Function symbols (only for function plugins) */}
            {type === "functions" && (
              <div className="flex flex-col gap-1.5 pt-2 border-t border-border">
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="plugin-functions" className="text-xs font-medium">
                    Exported Functions (comma-separated)
                  </Label>
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="size-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs max-w-xs">
                        Names of function symbols exported by the binary.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Input
                  id="plugin-functions"
                  value={functionsText}
                  onChange={(e) => setFunctionsText(e.target.value)}
                  placeholder="e.g. echo, reverse, countElements"
                  className="h-8 text-xs font-mono"
                />
              </div>
            )}

            {/* Shell Parameters */}
            <div className="flex flex-col gap-1.5 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="plugin-shell-paras" className="text-xs font-medium">
                    Shell Parameters (shellParas)
                  </Label>
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="size-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs max-w-xs">
                        Extra CLI arguments passed to the install script (e.g. configuration path flags).
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                {pluginName.toLowerCase().includes("tdengine") && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-5 text-[11px] font-mono text-primary p-0 hover:bg-transparent"
                    onClick={() => setShellParasText("-c, /etc/taos")}
                  >
                    <Sparkles className="size-3 mr-1" />
                    Preset TDengine: -c, /etc/taos
                  </Button>
                )}
              </div>
              <Input
                id="plugin-shell-paras"
                value={shellParasText}
                onChange={(e) => setShellParasText(e.target.value)}
                placeholder="e.g. -c, /etc/taos"
                className="h-8 text-xs font-mono"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/plugins")}
                disabled={installing}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={handleInstall} disabled={installing} className="gap-1.5">
                {installing ? <Loader2 className="size-3.5 animate-spin" /> : <Plug className="size-3.5" />}
                {installing ? "Installing..." : "Install Plugin"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
