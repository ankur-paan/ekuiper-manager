"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PythonEditor } from "@/components/editor/python-editor";
import { JsonEditor } from "@/components/editor/json-editor";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Plus,
  Trash2,
  Edit,
  RefreshCw,
  Package,
  Search,
  FileCode,
  Download,
  Upload,
  Info,
  Code,
  Terminal
} from "lucide-react";
import { EKuiperClient, Plugin, Service } from "@/lib/ekuiper";

interface PluginsManagerProps {
  client: EKuiperClient;
}

const PYTHON_TEMPLATES = {
  function: `"""
eKuiper Portable Python Function Plugin
This function can be called from eKuiper SQL queries.
"""

from typing import Any, List
from ekuiper import Function, Context

class MyFunction(Function):
    """
    Custom function that can be used in eKuiper SQL.
    Example usage: SELECT my_function(field1, field2) FROM stream
    """

    def __init__(self):
        pass

    def validate(self, args: List[Any]) -> str:
        """Validate the arguments. Return empty string if valid."""
        if len(args) < 1:
            return "At least one argument is required"
        return ""

    def exec(self, args: List[Any], ctx: Context) -> Any:
        """
        Execute the function.
        
        Args:
            args: List of arguments passed to the function
            ctx: Context object with logging and state access
        
        Returns:
            The function result
        """
        ctx.logger.info(f"MyFunction called with args: {args}")
        
        # Your logic here
        result = sum(args) if all(isinstance(a, (int, float)) for a in args) else str(args)
        
        return result

    def is_aggregate(self) -> bool:
        """Return True if this is an aggregate function."""
        return False

# Entry point - must be named the same as the function you want to export
my_function = MyFunction()
`,
  aggregate: `"""
eKuiper Portable Python Aggregate Function Plugin
This function aggregates values over a window.
"""

from typing import Any, List
from ekuiper import Function, Context

class AggregateStats(Function):
    """
    Custom aggregate function that calculates statistics over a window.
    Example: SELECT aggregate_stats(temperature) FROM stream GROUP BY TUMBLINGWINDOW(ss, 10)
    """

    def __init__(self):
        self.values: List[float] = []

    def validate(self, args: List[Any]) -> str:
        if len(args) != 1:
            return "Exactly one argument is required"
        return ""

    def exec(self, args: List[Any], ctx: Context) -> Any:
        """Collect values for aggregation."""
        if args[0] is not None:
            self.values.append(float(args[0]))
        
        # Return intermediate result
        if not self.values:
            return {"min": 0, "max": 0, "avg": 0, "count": 0}
        
        return {
            "min": min(self.values),
            "max": max(self.values),
            "avg": sum(self.values) / len(self.values),
            "count": len(self.values)
        }

    def is_aggregate(self) -> bool:
        return True

aggregate_stats = AggregateStats()
`,
  sink: `"""
eKuiper Portable Python Sink Plugin
This sink receives data from rules and outputs to external systems.
"""

from typing import Any, Dict
from ekuiper import Sink, Context

class CustomSink(Sink):
    """
    Custom sink that outputs data to an external system.
    """

    def __init__(self):
        self.config: Dict[str, Any] = {}

    def configure(self, props: Dict[str, Any]) -> str:
        """
        Configure the sink with properties from the rule action.
        Return empty string if successful, error message otherwise.
        """
        self.config = props
        # Validate required properties
        if "endpoint" not in props:
            return "endpoint is required"
        return ""

    def open(self, ctx: Context) -> str:
        """
        Initialize resources (connections, files, etc).
        Called once when the rule starts.
        """
        ctx.logger.info(f"Opening CustomSink with config: {self.config}")
        # Initialize your connection here
        return ""

    def collect(self, ctx: Context, data: Any) -> str:
        """
        Process incoming data.
        Called for each message from the rule.
        """
        ctx.logger.info(f"Received data: {data}")
        
        # Your output logic here
        # e.g., send to API, write to file, etc.
        
        return ""  # Return empty string on success

    def close(self, ctx: Context) -> str:
        """
        Cleanup resources.
        Called when the rule stops.
        """
        ctx.logger.info("Closing CustomSink")
        return ""

# Entry point
custom_sink = CustomSink()
`,
  source: `"""
eKuiper Portable Python Source Plugin  
This source pulls data from external systems into eKuiper.
"""

from typing import Any, Dict, List
from ekuiper import Source, Context
import time

class CustomSource(Source):
    """
    Custom source that fetches data from an external system.
    """

    def __init__(self):
        self.config: Dict[str, Any] = {}
        self.running: bool = False

    def configure(self, datasource: str, props: Dict[str, Any]) -> str:
        """
        Configure the source with properties from the stream definition.
        """
        self.datasource = datasource
        self.config = props
        return ""

    def open(self, ctx: Context) -> str:
        """
        Initialize resources and start data collection.
        """
        ctx.logger.info(f"Opening CustomSource for {self.datasource}")
        self.running = True
        return ""

    def pull(self, ctx: Context) -> List[Dict[str, Any]]:
        """
        Pull data from the source.
        Called periodically based on the interval configuration.
        """
        if not self.running:
            return []
        
        # Your data fetching logic here
        data = {
            "timestamp": int(time.time() * 1000),
            "source": self.datasource,
            "value": 42.0  # Replace with actual data
        }
        
        return [data]

    def close(self, ctx: Context) -> str:
        """
        Cleanup resources.
        """
        self.running = False
        ctx.logger.info("Closing CustomSource")
        return ""

# Entry point
custom_source = CustomSource()
`,
};

const PLUGIN_JSON_TEMPLATE: {
  version: string;
  language: string;
  executable: string;
  functions: string[];
  sources: string[];
  sinks: string[];
} = {
  version: "v1.0.0",
  language: "python",
  executable: "main.py",
  functions: ["my_function"],
  sources: [],
  sinks: [],
};

export function PluginsManager({ client }: PluginsManagerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<"function" | "aggregate" | "sink" | "source">("function");
  const [pluginName, setPluginName] = useState("my_plugin");
  const [pythonCode, setPythonCode] = useState(PYTHON_TEMPLATES.function);
  const [pluginJson, setPluginJson] = useState(JSON.stringify(PLUGIN_JSON_TEMPLATE, null, 2));

  const queryClient = useQueryClient();

  // Define plugins data type
  type PluginsData = { functions: string[]; sources: string[]; sinks: string[] };

  // Fetch plugins
  const { data: plugins, isLoading: loadingPlugins, refetch: refetchPlugins } = useQuery<PluginsData>({
    queryKey: ["plugins"],
    queryFn: async () => {
      const [functions, sources, sinks] = await Promise.all([
        client.listPlugins("functions"),
        client.listPlugins("sources"),
        client.listPlugins("sinks"),
      ]);
      return { functions, sources, sinks };
    },
    initialData: { functions: [], sources: [], sinks: [] },
  });

  // Fetch UDFs
  const { data: udfs = [], isLoading: loadingUdfs, refetch: refetchUdfs } = useQuery({
    queryKey: ["udfs"],
    queryFn: () => client.listUDFs(),
  });

  // Fetch services
  const { data: services = [], isLoading: loadingServices, refetch: refetchServices } = useQuery({
    queryKey: ["services"],
    queryFn: () => client.listServices(),
  });

  // Delete plugin mutation
  const deletePlugin = useMutation({
    mutationFn: ({ type, name }: { type: "functions" | "sources" | "sinks"; name: string }) =>
      client.deletePlugin(type, name),
    onSuccess: () => {
      toast({ title: "Plugin deleted" });
      queryClient.invalidateQueries({ queryKey: ["plugins"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete plugin",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleTypeChange = (type: "function" | "aggregate" | "sink" | "source") => {
    setSelectedType(type);
    setPythonCode(PYTHON_TEMPLATES[type]);

    const jsonTemplate = { ...PLUGIN_JSON_TEMPLATE };
    if (type === "sink") {
      jsonTemplate.functions = [];
      jsonTemplate.sinks = ["custom_sink"];
    } else if (type === "source") {
      jsonTemplate.functions = [];
      jsonTemplate.sources = ["custom_source"];
    } else if (type === "aggregate") {
      jsonTemplate.functions = ["aggregate_stats"];
    }
    setPluginJson(JSON.stringify(jsonTemplate, null, 2));
  };

  const handleExport = () => {
    // Create a zip file with the plugin
    const zip = new Blob([
      `# Plugin: ${pluginName}\n# main.py\n\n${pythonCode}`,
    ], { type: "text/plain" });

    const url = URL.createObjectURL(zip);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${pluginName}_main.py`;
    a.click();
    URL.revokeObjectURL(url);

    // Also export the JSON
    const jsonBlob = new Blob([pluginJson], { type: "application/json" });
    const jsonUrl = URL.createObjectURL(jsonBlob);
    const jsonLink = document.createElement("a");
    jsonLink.href = jsonUrl;
    jsonLink.download = `${pluginName}.json`;
    jsonLink.click();
    URL.revokeObjectURL(jsonUrl);

    toast({ title: "Plugin files exported" });
  };

  const allPlugins = [
    ...(plugins.functions || []).map((name: string) => ({ name, type: "functions" as const })),
    ...(plugins.sources || []).map((name: string) => ({ name, type: "sources" as const })),
    ...(plugins.sinks || []).map((name: string) => ({ name, type: "sinks" as const })),
    ...(udfs || []).map((name: string) => ({ name, type: "udf" as const })),
  ];

  const filteredPlugins = allPlugins.filter((p) =>
    p.type !== 'udf' && p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Plugins & Extensions</h2>
          <p className="text-sm text-muted-foreground">
            Create and manage Python portable plugins
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => {
            refetchPlugins();
            refetchServices();
            refetchUdfs();
          }}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            New Plugin
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search plugins..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Content */}
      <Tabs defaultValue="plugins" className="flex-1">
        <TabsList>
          <TabsTrigger value="plugins" className="gap-2">
            <Package className="h-4 w-4" />
            Plugins ({allPlugins.length - (udfs?.length || 0)})
          </TabsTrigger>
          <TabsTrigger value="udfs" className="gap-2">
            <Code className="h-4 w-4" />
            UDFs ({udfs?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="services" className="gap-2">
            <Terminal className="h-4 w-4" />
            Services ({services.length})
          </TabsTrigger>
          <TabsTrigger value="editor" className="gap-2">
            <Code className="h-4 w-4" />
            Editor
          </TabsTrigger>
        </TabsList>

        <TabsContent value="plugins" className="flex-1 overflow-auto">
          {loadingPlugins ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredPlugins.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? "No plugins match your search" : "No plugins installed yet"}
            </div>
          ) : (
            <div className="grid gap-2 mt-4">
              {filteredPlugins.map((plugin) => (
                <Card key={`${plugin.type}-${plugin.name}`} className="group hover:border-primary/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Package className="h-5 w-5 text-sota-purple" />
                        <div>
                          <span className="font-medium">{plugin.name}</span>
                          <Badge variant="outline" className="ml-2 text-xs">
                            {plugin.type}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deletePlugin.mutate(plugin)}
                          className="text-red-500 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="udfs" className="flex-1 overflow-auto">
          {loadingUdfs ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : udfs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? "No UDFs match your search" : "No UDFs registered"}
            </div>
          ) : (
            <div className="grid gap-2 mt-4">
              {udfs.filter((name: string) => name.toLowerCase().includes(searchTerm.toLowerCase())).map((name: string) => (
                <Card key={`udf-${name}`} className="hover:border-primary/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Code className="h-5 w-5 text-sota-blue" />
                        <div>
                          <span className="font-medium">{name}</span>
                          <Badge variant="outline" className="ml-2 text-xs">UDF</Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="services" className="flex-1 overflow-auto">
          {loadingServices ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : services.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No external services registered
            </div>
          ) : (
            <div className="grid gap-2 mt-4">
              {services.map((serviceName: string) => (
                <Card key={serviceName} className="hover:border-primary/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Terminal className="h-5 w-5 text-sota-blue" />
                      <span className="font-medium">{serviceName}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="editor" className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Plugin type and name */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-1 block">Plugin Name</label>
              <Input
                value={pluginName}
                onChange={(e) => setPluginName(e.target.value)}
                placeholder="my_plugin"
              />
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium mb-1 block">Plugin Type</label>
              <div className="flex gap-2">
                {(["function", "aggregate", "sink", "source"] as const).map((type) => (
                  <Button
                    key={type}
                    variant={selectedType === type ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleTypeChange(type)}
                    className="capitalize"
                  >
                    {type}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Code editors */}
          <Tabs defaultValue="code" className="flex-1 flex flex-col overflow-hidden">
            <TabsList>
              <TabsTrigger value="code">Python Code</TabsTrigger>
              <TabsTrigger value="json">Plugin JSON</TabsTrigger>
            </TabsList>

            <TabsContent value="code" className="flex-1 min-h-0">
              <PythonEditor
                value={pythonCode}
                onChange={setPythonCode}
                height="100%"
              />
            </TabsContent>

            <TabsContent value="json" className="flex-1 min-h-0">
              <JsonEditor
                value={pluginJson}
                onChange={setPluginJson}
                height="100%"
              />
            </TabsContent>
          </Tabs>

          {/* Actions */}
          <div className="flex gap-2">
            <Button onClick={handleExport} className="gap-2">
              <Download className="h-4 w-4" />
              Export Plugin Files
            </Button>
            <Button variant="outline" className="gap-2" disabled>
              <Upload className="h-4 w-4" />
              Deploy to eKuiper
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Plugin</DialogTitle>
            <DialogDescription>
              Choose a plugin type to get started with a template
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            {[
              { type: "function" as const, title: "Function", desc: "Custom SQL function" },
              { type: "aggregate" as const, title: "Aggregate", desc: "Window aggregate function" },
              { type: "sink" as const, title: "Sink", desc: "Output to external system" },
              { type: "source" as const, title: "Source", desc: "Pull data from external system" },
            ].map((item) => (
              <Card
                key={item.type}
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => {
                  handleTypeChange(item.type);
                  setCreateDialogOpen(false);
                }}
              >
                <CardHeader className="p-4">
                  <CardTitle className="text-sm">{item.title}</CardTitle>
                  <CardDescription className="text-xs">{item.desc}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
