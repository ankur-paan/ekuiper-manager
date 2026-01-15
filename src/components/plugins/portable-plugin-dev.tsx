"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Code2,
  Play,
  Download,
  Upload,
  FileCode,
  Package,
  Settings,
  Terminal,
  Copy,
  Check,
  Sparkles,
  Book,
  FolderOpen,
  FileJson,
  Layers,
  Zap,
  Info,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw
} from "lucide-react";
import { EKuiperClient } from "@/lib/ekuiper";

// =============================================================================
// Types
// =============================================================================

type PluginLanguage = "python" | "go";
type PluginKind = "source" | "sink" | "function";

interface PluginConfig {
  name: string;
  version: string;
  language: PluginLanguage;
  kind: PluginKind;
  author?: string;
  description?: string;
}

interface SourceConfig {
  interval?: number;
  bufferLength?: number;
}

interface SinkConfig {
  sendSingle?: boolean;
  bufferLength?: number;
}

interface FunctionConfig {
  args?: { name: string; type: string }[];
  returnType?: string;
  aggregate?: boolean;
}

interface PortablePluginDevProps {
  client: EKuiperClient;
}

// =============================================================================
// Code Templates
// =============================================================================

const PYTHON_TEMPLATES = {
  source: (config: PluginConfig) => `#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
${config.name} - eKuiper Portable Source Plugin
Author: ${config.author || "Developer"}
Version: ${config.version}
Description: ${config.description || "Custom source plugin"}
"""

import json
import time
from typing import Any, Dict, List, Optional
from ekuiper import Source, SourceContext, SourceConfig

class ${toPascalCase(config.name)}Source(Source):
    """
    ${config.description || "Custom portable source for eKuiper"}
    
    This source demonstrates how to create a portable plugin
    that can stream data into eKuiper rules.
    """
    
    def __init__(self):
        self.running = False
        self.interval = 1000  # ms
        self.config = {}
    
    def configure(self, datasource: str, config: Dict[str, Any]) -> None:
        """
        Configure the source with the provided options.
        
        Args:
            datasource: The datasource name from WITH clause
            config: Configuration from confKey or inline options
        """
        self.datasource = datasource
        self.config = config
        self.interval = config.get("interval", 1000)
        print(f"[${config.name}] Configured with datasource: {datasource}")
    
    def open(self, ctx: SourceContext) -> None:
        """
        Open the source and start producing data.
        Called when a rule using this source starts.
        """
        self.running = True
        self.ctx = ctx
        print(f"[${config.name}] Source opened")
        
        while self.running:
            try:
                # Generate or fetch your data here
                data = self.fetch_data()
                
                if data:
                    # Emit data to the stream
                    ctx.emit(data, None)
                
                time.sleep(self.interval / 1000.0)
            except Exception as e:
                ctx.emit(None, str(e))
    
    def fetch_data(self) -> Optional[Dict[str, Any]]:
        """
        Implement your data fetching logic here.
        This is called periodically based on the interval.
        
        Returns:
            Dict containing the data to emit, or None to skip
        """
        # TODO: Implement your data source logic
        return {
            "timestamp": int(time.time() * 1000),
            "value": 42.0,
            "source": "${config.name}"
        }
    
    def close(self, ctx: SourceContext) -> None:
        """
        Close the source when the rule stops.
        Clean up any resources here.
        """
        self.running = False
        print(f"[${config.name}] Source closed")


# Plugin entry point - required for eKuiper to load the plugin
def ${config.name}():
    return ${toPascalCase(config.name)}Source()
`,

  sink: (config: PluginConfig) => `#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
${config.name} - eKuiper Portable Sink Plugin
Author: ${config.author || "Developer"}
Version: ${config.version}
Description: ${config.description || "Custom sink plugin"}
"""

import json
from typing import Any, Dict, List, Optional
from ekuiper import Sink, SinkContext, SinkConfig

class ${toPascalCase(config.name)}Sink(Sink):
    """
    ${config.description || "Custom portable sink for eKuiper"}
    
    This sink demonstrates how to create a portable plugin
    that can receive data from eKuiper rules.
    """
    
    def __init__(self):
        self.config = {}
        self.send_single = True
    
    def configure(self, config: Dict[str, Any]) -> None:
        """
        Configure the sink with the provided options.
        
        Args:
            config: Configuration from the rule action definition
        """
        self.config = config
        self.send_single = config.get("sendSingle", True)
        print(f"[${config.name}] Configured with: {config}")
    
    def open(self, ctx: SinkContext) -> None:
        """
        Open the sink when the rule starts.
        Initialize connections or resources here.
        """
        self.ctx = ctx
        print(f"[${config.name}] Sink opened")
        
        # TODO: Initialize your connection here
        # e.g., database connection, API client, file handle
    
    def collect(self, ctx: SinkContext, data: Any) -> None:
        """
        Receive data from the rule and process it.
        
        Args:
            ctx: The sink context for logging/metrics
            data: The data received (dict if sendSingle, list otherwise)
        """
        try:
            if self.send_single:
                # Single record mode
                self.process_record(data)
            else:
                # Batch mode - data is a list of records
                for record in data:
                    self.process_record(record)
        except Exception as e:
            ctx.log_error(f"Error processing data: {e}")
            raise
    
    def process_record(self, record: Dict[str, Any]) -> None:
        """
        Process a single record.
        
        Args:
            record: The data record to process
        """
        # TODO: Implement your sink logic here
        # e.g., write to database, send to API, write to file
        print(f"[${config.name}] Received: {json.dumps(record)}")
    
    def close(self, ctx: SinkContext) -> None:
        """
        Close the sink when the rule stops.
        Clean up resources here.
        """
        print(f"[${config.name}] Sink closed")
        
        # TODO: Clean up resources
        # e.g., close database connection, flush buffers


# Plugin entry point - required for eKuiper to load the plugin
def ${config.name}():
    return ${toPascalCase(config.name)}Sink()
`,

  function: (config: PluginConfig) => `#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
${config.name} - eKuiper Portable Function Plugin
Author: ${config.author || "Developer"}
Version: ${config.version}
Description: ${config.description || "Custom function plugin"}
"""

import json
from typing import Any, Dict, List, Optional, Union
from ekuiper import Function, FunctionContext

class ${toPascalCase(config.name)}Function(Function):
    """
    ${config.description || "Custom portable function for eKuiper"}
    
    This function demonstrates how to create a portable plugin
    that can be called from eKuiper SQL.
    
    Usage in SQL:
        SELECT ${config.name}(arg1, arg2) FROM stream
    """
    
    def __init__(self):
        self.config = {}
    
    def validate(self, args: List[Any]) -> str:
        """
        Validate the function arguments.
        Called during SQL parsing to ensure correct usage.
        
        Args:
            args: The arguments passed to the function
            
        Returns:
            Empty string if valid, error message if invalid
        """
        # TODO: Add your validation logic
        # Example: require exactly 2 arguments
        # if len(args) != 2:
        #     return "Function requires exactly 2 arguments"
        return ""
    
    def exec(self, args: List[Any], ctx: FunctionContext) -> Any:
        """
        Execute the function with the given arguments.
        
        Args:
            args: The arguments passed to the function
            ctx: The function context for logging/state
            
        Returns:
            The result of the function
        """
        try:
            # TODO: Implement your function logic here
            # Example: concatenate two strings
            if len(args) >= 2:
                return f"{args[0]}_{args[1]}"
            elif len(args) == 1:
                return str(args[0])
            else:
                return None
        except Exception as e:
            ctx.log_error(f"Function error: {e}")
            return None
    
    def is_aggregate(self) -> bool:
        """
        Declare if this is an aggregate function.
        Aggregate functions accumulate state over a window.
        
        Returns:
            True if aggregate, False otherwise
        """
        return False


# Plugin entry point - required for eKuiper to load the plugin
def ${config.name}():
    return ${toPascalCase(config.name)}Function()
`
};

const GO_TEMPLATES = {
  source: (config: PluginConfig) => `// Package ${config.name} implements a portable source plugin for eKuiper
// Author: ${config.author || "Developer"}
// Version: ${config.version}
// Description: ${config.description || "Custom source plugin"}
package main

import (
	"encoding/json"
	"fmt"
	"time"
	
	"github.com/lf-edge/ekuiper/sdk/go/api"
	"github.com/lf-edge/ekuiper/sdk/go/runtime"
)

// ${toPascalCase(config.name)}Source implements the api.Source interface
type ${toPascalCase(config.name)}Source struct {
	running    bool
	interval   int
	datasource string
	config     map[string]interface{}
}

// Configure is called once during initialization
func (s *${toPascalCase(config.name)}Source) Configure(datasource string, props map[string]interface{}) error {
	s.datasource = datasource
	s.config = props
	
	// Parse interval from config (default 1000ms)
	if interval, ok := props["interval"]; ok {
		if iv, ok := interval.(float64); ok {
			s.interval = int(iv)
		}
	}
	if s.interval <= 0 {
		s.interval = 1000
	}
	
	fmt.Printf("[${config.name}] Configured with datasource: %s\\n", datasource)
	return nil
}

// Open starts the source and produces data
func (s *${toPascalCase(config.name)}Source) Open(ctx api.StreamContext, consumer chan<- api.SourceTuple, errCh chan<- error) {
	s.running = true
	logger := ctx.GetLogger()
	logger.Infof("[${config.name}] Source opened")
	
	ticker := time.NewTicker(time.Duration(s.interval) * time.Millisecond)
	defer ticker.Stop()
	
	for s.running {
		select {
		case <-ticker.C:
			data, err := s.fetchData()
			if err != nil {
				errCh <- err
				continue
			}
			if data != nil {
				consumer <- api.NewDefaultSourceTuple(data, nil)
			}
		case <-ctx.Done():
			return
		}
	}
}

// fetchData retrieves data from your source
func (s *${toPascalCase(config.name)}Source) fetchData() (map[string]interface{}, error) {
	// TODO: Implement your data fetching logic here
	return map[string]interface{}{
		"timestamp": time.Now().UnixMilli(),
		"value":     42.0,
		"source":    "${config.name}",
	}, nil
}

// Close stops the source
func (s *${toPascalCase(config.name)}Source) Close(ctx api.StreamContext) error {
	s.running = false
	ctx.GetLogger().Infof("[${config.name}] Source closed")
	return nil
}

// New${toPascalCase(config.name)}Source creates a new source instance
func New${toPascalCase(config.name)}Source() api.Source {
	return &${toPascalCase(config.name)}Source{}
}

// Main entry point for the portable plugin
func main() {
	runtime.Start(&runtime.PluginConfig{
		Sources: map[string]api.Source{
			"${config.name}": New${toPascalCase(config.name)}Source(),
		},
	})
}
`,

  sink: (config: PluginConfig) => `// Package ${config.name} implements a portable sink plugin for eKuiper
// Author: ${config.author || "Developer"}
// Version: ${config.version}
// Description: ${config.description || "Custom sink plugin"}
package main

import (
	"encoding/json"
	"fmt"
	
	"github.com/lf-edge/ekuiper/sdk/go/api"
	"github.com/lf-edge/ekuiper/sdk/go/runtime"
)

// ${toPascalCase(config.name)}Sink implements the api.Sink interface
type ${toPascalCase(config.name)}Sink struct {
	sendSingle bool
	config     map[string]interface{}
}

// Configure is called once during initialization
func (s *${toPascalCase(config.name)}Sink) Configure(props map[string]interface{}) error {
	s.config = props
	
	// Parse sendSingle from config (default true)
	if sendSingle, ok := props["sendSingle"]; ok {
		if ss, ok := sendSingle.(bool); ok {
			s.sendSingle = ss
		}
	} else {
		s.sendSingle = true
	}
	
	fmt.Printf("[${config.name}] Configured with: %v\\n", props)
	return nil
}

// Open initializes the sink when the rule starts
func (s *${toPascalCase(config.name)}Sink) Open(ctx api.StreamContext) error {
	logger := ctx.GetLogger()
	logger.Infof("[${config.name}] Sink opened")
	
	// TODO: Initialize your connection here
	// e.g., database connection, API client
	
	return nil
}

// Collect receives data from the rule
func (s *${toPascalCase(config.name)}Sink) Collect(ctx api.StreamContext, item interface{}) error {
	logger := ctx.GetLogger()
	
	switch data := item.(type) {
	case map[string]interface{}:
		// Single record mode
		return s.processRecord(logger, data)
	case []map[string]interface{}:
		// Batch mode
		for _, record := range data {
			if err := s.processRecord(logger, record); err != nil {
				return err
			}
		}
	case []interface{}:
		// Generic batch mode
		for _, record := range data {
			if r, ok := record.(map[string]interface{}); ok {
				if err := s.processRecord(logger, r); err != nil {
					return err
				}
			}
		}
	}
	
	return nil
}

// processRecord handles a single data record
func (s *${toPascalCase(config.name)}Sink) processRecord(logger api.Logger, record map[string]interface{}) error {
	// TODO: Implement your sink logic here
	// e.g., write to database, send to API
	
	jsonData, _ := json.Marshal(record)
	logger.Infof("[${config.name}] Received: %s", string(jsonData))
	
	return nil
}

// Close cleans up resources when the rule stops
func (s *${toPascalCase(config.name)}Sink) Close(ctx api.StreamContext) error {
	ctx.GetLogger().Infof("[${config.name}] Sink closed")
	
	// TODO: Clean up resources
	
	return nil
}

// New${toPascalCase(config.name)}Sink creates a new sink instance
func New${toPascalCase(config.name)}Sink() api.Sink {
	return &${toPascalCase(config.name)}Sink{}
}

// Main entry point for the portable plugin
func main() {
	runtime.Start(&runtime.PluginConfig{
		Sinks: map[string]api.Sink{
			"${config.name}": New${toPascalCase(config.name)}Sink(),
		},
	})
}
`,

  function: (config: PluginConfig) => `// Package ${config.name} implements a portable function plugin for eKuiper
// Author: ${config.author || "Developer"}
// Version: ${config.version}
// Description: ${config.description || "Custom function plugin"}
package main

import (
	"fmt"
	
	"github.com/lf-edge/ekuiper/sdk/go/api"
	"github.com/lf-edge/ekuiper/sdk/go/runtime"
)

// ${toPascalCase(config.name)}Function implements the api.Function interface
type ${toPascalCase(config.name)}Function struct{}

// Validate checks the function arguments during SQL parsing
func (f *${toPascalCase(config.name)}Function) Validate(args []interface{}) error {
	// TODO: Add your validation logic
	// Example: require exactly 2 arguments
	// if len(args) != 2 {
	//     return fmt.Errorf("function requires exactly 2 arguments")
	// }
	return nil
}

// Exec executes the function with the given arguments
func (f *${toPascalCase(config.name)}Function) Exec(args []interface{}, ctx api.FunctionContext) (interface{}, bool) {
	logger := ctx.GetLogger()
	
	// TODO: Implement your function logic here
	// Example: concatenate two strings
	if len(args) >= 2 {
		return fmt.Sprintf("%v_%v", args[0], args[1]), true
	} else if len(args) == 1 {
		return fmt.Sprintf("%v", args[0]), true
	}
	
	logger.Warnf("[${config.name}] No arguments provided")
	return nil, false
}

// IsAggregate declares if this is an aggregate function
func (f *${toPascalCase(config.name)}Function) IsAggregate() bool {
	return false
}

// New${toPascalCase(config.name)}Function creates a new function instance
func New${toPascalCase(config.name)}Function() api.Function {
	return &${toPascalCase(config.name)}Function{}
}

// Main entry point for the portable plugin
func main() {
	runtime.Start(&runtime.PluginConfig{
		Functions: map[string]api.Function{
			"${config.name}": New${toPascalCase(config.name)}Function(),
		},
	})
}
`
};

const JSON_MANIFEST_TEMPLATE = (config: PluginConfig) => `{
  "version": "${config.version}",
  "language": "${config.language}",
  "executable": "${config.language === 'python' ? `${config.name}.py` : config.name}",
  "sources": ${config.kind === 'source' ? `["${config.name}"]` : '[]'},
  "sinks": ${config.kind === 'sink' ? `["${config.name}"]` : '[]'},
  "functions": ${config.kind === 'function' ? `["${config.name}"]` : '[]'}
}
`;

// =============================================================================
// Helper Functions
// =============================================================================

function toPascalCase(str: string): string {
  return str
    .split(/[-_\s]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("");
}

function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, "_$1")
    .toLowerCase()
    .replace(/^_/, "")
    .replace(/-/g, "_");
}

// =============================================================================
// Components
// =============================================================================

function CodePreview({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="absolute right-2 top-2 z-10"
        onClick={copyCode}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>
      <ScrollArea className="h-[400px] w-full rounded-md border">
        <pre className="p-4 text-sm font-mono">
          <code className={`language-${language}`}>{code}</code>
        </pre>
      </ScrollArea>
    </div>
  );
}

function ValidationResult({ 
  isValid, 
  message 
}: { 
  isValid: boolean; 
  message: string;
}) {
  return (
    <div className={cn(
      "flex items-center gap-2 p-3 rounded-lg text-sm",
      isValid ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
    )}>
      {isValid ? (
        <CheckCircle2 className="h-4 w-4" />
      ) : (
        <XCircle className="h-4 w-4" />
      )}
      {message}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function PortablePluginDev({ client }: PortablePluginDevProps) {
  const [activeTab, setActiveTab] = useState<"create" | "templates" | "docs">("create");
  const [config, setConfig] = useState<PluginConfig>({
    name: "my_plugin",
    version: "1.0.0",
    language: "python",
    kind: "source",
    author: "",
    description: "",
  });
  const [generatedCode, setGeneratedCode] = useState<string>("");
  const [manifestJson, setManifestJson] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [validationResult, setValidationResult] = useState<{ isValid: boolean; message: string } | null>(null);

  const generatePlugin = useCallback(() => {
    setIsGenerating(true);
    setValidationResult(null);

    // Validate name
    const namePattern = /^[a-z][a-z0-9_]*$/;
    if (!namePattern.test(config.name)) {
      setValidationResult({
        isValid: false,
        message: "Plugin name must start with lowercase letter and contain only lowercase letters, numbers, and underscores"
      });
      setIsGenerating(false);
      return;
    }

    try {
      const templates = config.language === "python" ? PYTHON_TEMPLATES : GO_TEMPLATES;
      const code = templates[config.kind](config);
      const manifest = JSON_MANIFEST_TEMPLATE(config);

      setGeneratedCode(code);
      setManifestJson(manifest);
      setValidationResult({
        isValid: true,
        message: `${config.language === "python" ? "Python" : "Go"} ${config.kind} plugin generated successfully!`
      });
    } catch (error) {
      setValidationResult({
        isValid: false,
        message: `Failed to generate plugin: ${error}`
      });
    }

    setIsGenerating(false);
  }, [config]);

  const downloadPlugin = () => {
    const extension = config.language === "python" ? "py" : "go";
    const filename = `${config.name}.${extension}`;
    const blob = new Blob([generatedCode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Plugin Downloaded",
      description: `${filename} has been downloaded`,
    });
  };

  const downloadManifest = () => {
    const filename = `${config.name}.json`;
    const blob = new Blob([manifestJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Manifest Downloaded",
      description: `${filename} has been downloaded`,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6 text-sota-purple" />
            Portable Plugin SDK
          </h2>
          <p className="text-muted-foreground">
            Create custom sources, sinks, and functions with Python or Go
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="create" className="flex items-center gap-2">
            <Code2 className="h-4 w-4" />
            Create Plugin
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="docs" className="flex items-center gap-2">
            <Book className="h-4 w-4" />
            Documentation
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Configuration Panel */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Plugin Configuration
                </CardTitle>
                <CardDescription>
                  Configure your portable plugin settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="language">Language</Label>
                    <Select
                      value={config.language}
                      onValueChange={(v) => setConfig({ ...config, language: v as PluginLanguage })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="python">
                          <div className="flex items-center gap-2">
                            <span className="text-yellow-500">🐍</span> Python
                          </div>
                        </SelectItem>
                        <SelectItem value="go">
                          <div className="flex items-center gap-2">
                            <span className="text-cyan-500">🔷</span> Go
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="kind">Plugin Type</Label>
                    <Select
                      value={config.kind}
                      onValueChange={(v) => setConfig({ ...config, kind: v as PluginKind })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="source">Source</SelectItem>
                        <SelectItem value="sink">Sink</SelectItem>
                        <SelectItem value="function">Function</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Plugin Name</Label>
                  <Input
                    id="name"
                    placeholder="my_custom_plugin"
                    value={config.name}
                    onChange={(e) => setConfig({ ...config, name: toSnakeCase(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Use snake_case (lowercase with underscores)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="version">Version</Label>
                  <Input
                    id="version"
                    placeholder="1.0.0"
                    value={config.version}
                    onChange={(e) => setConfig({ ...config, version: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="author">Author (optional)</Label>
                  <Input
                    id="author"
                    placeholder="Your Name"
                    value={config.author || ""}
                    onChange={(e) => setConfig({ ...config, author: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe what your plugin does..."
                    value={config.description || ""}
                    onChange={(e) => setConfig({ ...config, description: e.target.value })}
                    rows={3}
                  />
                </div>

                <Separator />

                {validationResult && (
                  <ValidationResult
                    isValid={validationResult.isValid}
                    message={validationResult.message}
                  />
                )}

                <Button
                  onClick={generatePlugin}
                  className="w-full"
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate Plugin
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Preview Panel */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileCode className="h-5 w-5" />
                      Generated Code
                    </CardTitle>
                    <CardDescription>
                      Preview and download your plugin
                    </CardDescription>
                  </div>
                  {generatedCode && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={downloadPlugin}>
                        <Download className="h-4 w-4 mr-2" />
                        {config.language === "python" ? ".py" : ".go"}
                      </Button>
                      <Button variant="outline" size="sm" onClick={downloadManifest}>
                        <FileJson className="h-4 w-4 mr-2" />
                        .json
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {generatedCode ? (
                  <Tabs defaultValue="code">
                    <TabsList className="mb-4">
                      <TabsTrigger value="code">
                        {config.language === "python" ? "Python" : "Go"} Code
                      </TabsTrigger>
                      <TabsTrigger value="manifest">Manifest JSON</TabsTrigger>
                    </TabsList>
                    <TabsContent value="code">
                      <CodePreview
                        code={generatedCode}
                        language={config.language}
                      />
                    </TabsContent>
                    <TabsContent value="manifest">
                      <CodePreview code={manifestJson} language="json" />
                    </TabsContent>
                  </Tabs>
                ) : (
                  <div className="h-[400px] flex items-center justify-center text-muted-foreground border rounded-lg">
                    <div className="text-center">
                      <Code2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Configure your plugin and click Generate</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                name: "MQTT Source",
                kind: "source" as PluginKind,
                description: "Subscribe to MQTT topics with custom parsing",
                icon: "📡"
              },
              {
                name: "Database Sink",
                kind: "sink" as PluginKind,
                description: "Write data to PostgreSQL, MySQL, or MongoDB",
                icon: "🗄️"
              },
              {
                name: "Custom Aggregation",
                kind: "function" as PluginKind,
                description: "Custom aggregate function for complex calculations",
                icon: "📊"
              },
              {
                name: "HTTP API Source",
                kind: "source" as PluginKind,
                description: "Poll REST APIs with authentication",
                icon: "🌐"
              },
              {
                name: "Webhook Sink",
                kind: "sink" as PluginKind,
                description: "Send data to webhooks with retry logic",
                icon: "🔗"
              },
              {
                name: "ML Inference",
                kind: "function" as PluginKind,
                description: "Run ML model inference on streaming data",
                icon: "🤖"
              },
            ].map((template) => (
              <Card
                key={template.name}
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => {
                  setConfig({
                    ...config,
                    name: toSnakeCase(template.name),
                    kind: template.kind,
                    description: template.description,
                  });
                  setActiveTab("create");
                }}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <span className="text-2xl">{template.icon}</span>
                    {template.name}
                  </CardTitle>
                  <CardDescription>{template.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Badge variant="outline">{template.kind}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="docs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Portable Plugin Development Guide</CardTitle>
              <CardDescription>
                Learn how to create, build, and deploy portable plugins
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">1. Plugin Structure</h3>
                <p className="text-muted-foreground">
                  A portable plugin consists of two files:
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                  <li><code className="bg-muted px-1 rounded">plugin_name.py</code> or <code className="bg-muted px-1 rounded">plugin_name.go</code> - The main plugin code</li>
                  <li><code className="bg-muted px-1 rounded">plugin_name.json</code> - The manifest file describing the plugin</li>
                </ul>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">2. Python SDK Installation</h3>
                <div className="bg-muted p-4 rounded-lg font-mono text-sm">
                  pip install ekuiper
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">3. Go SDK Installation</h3>
                <div className="bg-muted p-4 rounded-lg font-mono text-sm">
                  go get github.com/lf-edge/ekuiper/sdk/go
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">4. Deployment</h3>
                <p className="text-muted-foreground">
                  Deploy your plugin using the REST API or CLI:
                </p>
                <div className="bg-muted p-4 rounded-lg font-mono text-sm space-y-2">
                  <p># REST API</p>
                  <p>POST /plugins/portables</p>
                  <p>{'{"name": "my_plugin", "file": "file:///path/to/plugin.zip"}'}</p>
                  <br />
                  <p># CLI</p>
                  <p>bin/kuiper create plugin portable my_plugin /path/to/plugin.zip</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">5. Usage in SQL</h3>
                <div className="bg-muted p-4 rounded-lg font-mono text-sm space-y-2">
                  <p># Source Plugin</p>
                  <p>{'CREATE STREAM s () WITH (TYPE="my_source", ...)'}</p>
                  <br />
                  <p># Sink Plugin</p>
                  <p>{'{"my_sink": {"prop1": "value"}}'}</p>
                  <br />
                  <p># Function Plugin</p>
                  <p>SELECT my_function(col1, col2) FROM stream</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default PortablePluginDev;
