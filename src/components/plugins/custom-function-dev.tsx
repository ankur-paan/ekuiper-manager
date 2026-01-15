"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { EKuiperClient } from "@/lib/ekuiper/client";
import {
  FunctionSquare,
  Plus,
  Trash2,
  Copy,
  Check,
  Code2,
  Play,
  Save,
  Download,
  Upload,
  BookOpen,
  Wand2,
  AlertCircle,
  CheckCircle,
  Loader2,
  FileCode,
  Settings,
  TestTube,
  Lightbulb
} from "lucide-react";

// =============================================================================
// Types
// =============================================================================

interface CustomFunction {
  name: string;
  language: "javascript" | "go" | "python";
  returnType: string;
  parameters: FunctionParameter[];
  code: string;
  description: string;
}

interface FunctionParameter {
  name: string;
  type: string;
  description?: string;
}

// =============================================================================
// Function Templates
// =============================================================================

const FUNCTION_TEMPLATES = {
  javascript: {
    basic: {
      name: "Basic Function",
      code: `// Custom function implementation
// Parameters are passed as arguments
// Return the computed result

function customFunc(arg1, arg2) {
  return arg1 + arg2;
}`,
    },
    transform: {
      name: "Data Transform",
      code: `// Transform input data
function transform(data) {
  return {
    value: data.value * 1.8 + 32,
    unit: "fahrenheit",
    timestamp: Date.now()
  };
}`,
    },
    validate: {
      name: "Validation",
      code: `// Validate input and return boolean
function validate(value, min, max) {
  if (typeof value !== 'number') return false;
  return value >= min && value <= max;
}`,
    },
    aggregate: {
      name: "Custom Aggregate",
      code: `// Custom aggregation function
let state = { sum: 0, count: 0 };

function aggregate(value) {
  state.sum += value;
  state.count++;
  return state.sum / state.count;
}`,
    },
  },
  go: {
    basic: {
      name: "Basic Function",
      code: `package main

import (
	"github.com/lf-edge/ekuiper/pkg/api"
)

// CustomFunc implements a simple function
func CustomFunc(ctx api.FunctionContext, args []interface{}) (interface{}, bool) {
	// args[0] and args[1] are the function arguments
	if len(args) < 2 {
		return nil, false
	}
	
	a, ok1 := args[0].(float64)
	b, ok2 := args[1].(float64)
	if !ok1 || !ok2 {
		return nil, false
	}
	
	return a + b, true
}`,
    },
    transform: {
      name: "Data Transform",
      code: `package main

import (
	"github.com/lf-edge/ekuiper/pkg/api"
	"time"
)

// Transform converts celsius to fahrenheit
func Transform(ctx api.FunctionContext, args []interface{}) (interface{}, bool) {
	if len(args) < 1 {
		return nil, false
	}
	
	celsius, ok := args[0].(float64)
	if !ok {
		return nil, false
	}
	
	result := map[string]interface{}{
		"value":     celsius*1.8 + 32,
		"unit":      "fahrenheit",
		"timestamp": time.Now().Unix(),
	}
	
	return result, true
}`,
    },
    aggregate: {
      name: "Stateful Aggregate",
      code: `package main

import (
	"github.com/lf-edge/ekuiper/pkg/api"
	"sync"
)

var (
	state = struct {
		sync.Mutex
		sum   float64
		count int
	}{}
)

// MovingAvg calculates moving average
func MovingAvg(ctx api.FunctionContext, args []interface{}) (interface{}, bool) {
	if len(args) < 1 {
		return nil, false
	}
	
	value, ok := args[0].(float64)
	if !ok {
		return nil, false
	}
	
	state.Lock()
	defer state.Unlock()
	
	state.sum += value
	state.count++
	
	return state.sum / float64(state.count), true
}`,
    },
  },
  python: {
    basic: {
      name: "Basic Function",
      code: `# Custom function implementation
# Parameters are passed as arguments
# Return the computed result

def custom_func(arg1, arg2):
    return arg1 + arg2`,
    },
    transform: {
      name: "Data Transform",
      code: `import time

# Transform input data
def transform(data):
    return {
        "value": data["value"] * 1.8 + 32,
        "unit": "fahrenheit",
        "timestamp": int(time.time() * 1000)
    }`,
    },
    validate: {
      name: "Validation",
      code: `# Validate input and return boolean
def validate(value, min_val, max_val):
    if not isinstance(value, (int, float)):
        return False
    return min_val <= value <= max_val`,
    },
    ml_inference: {
      name: "ML Inference",
      code: `import numpy as np
# Note: Ensure numpy is available in the runtime

def predict(features):
    """
    Simple linear prediction
    In production, load a trained model
    """
    # Coefficients for a simple linear model
    weights = [0.5, 0.3, 0.2]
    
    if len(features) != len(weights):
        return None
    
    prediction = sum(f * w for f, w in zip(features, weights))
    return round(prediction, 4)`,
    },
  },
};

// =============================================================================
// Built-in Functions Reference
// =============================================================================

const BUILTIN_FUNCTIONS = [
  { name: "abs", signature: "abs(x)", description: "Returns absolute value", category: "math" },
  { name: "ceil", signature: "ceil(x)", description: "Rounds up to nearest integer", category: "math" },
  { name: "floor", signature: "floor(x)", description: "Rounds down to nearest integer", category: "math" },
  { name: "round", signature: "round(x)", description: "Rounds to nearest integer", category: "math" },
  { name: "sqrt", signature: "sqrt(x)", description: "Returns square root", category: "math" },
  { name: "power", signature: "power(x, y)", description: "Returns x to the power y", category: "math" },
  { name: "concat", signature: "concat(s1, s2, ...)", description: "Concatenates strings", category: "string" },
  { name: "upper", signature: "upper(s)", description: "Converts to uppercase", category: "string" },
  { name: "lower", signature: "lower(s)", description: "Converts to lowercase", category: "string" },
  { name: "substring", signature: "substring(s, start, len)", description: "Extracts substring", category: "string" },
  { name: "length", signature: "length(s)", description: "Returns string length", category: "string" },
  { name: "now", signature: "now()", description: "Returns current timestamp", category: "datetime" },
  { name: "format_time", signature: "format_time(t, fmt)", description: "Formats timestamp", category: "datetime" },
  { name: "json_path_query", signature: "json_path_query(j, path)", description: "JSON path query", category: "json" },
  { name: "encode", signature: "encode(s, enc)", description: "Encodes string (base64, etc.)", category: "encoding" },
  { name: "decode", signature: "decode(s, enc)", description: "Decodes string", category: "encoding" },
];

// =============================================================================
// Props
// =============================================================================

interface CustomFunctionDevProps {
  connectionId: string;
}

// =============================================================================
// Main Component
// =============================================================================

export function CustomFunctionDev({ connectionId }: CustomFunctionDevProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"editor" | "templates" | "reference">("editor");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<"javascript" | "go" | "python">("javascript");
  
  // Function State
  const [currentFunction, setCurrentFunction] = useState<CustomFunction>({
    name: "myFunction",
    language: "javascript",
    returnType: "any",
    parameters: [],
    code: FUNCTION_TEMPLATES.javascript.basic.code,
    description: "",
  });

  // Test State
  const [testArgs, setTestArgs] = useState("10, 20");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  // Parameter State
  const [newParamName, setNewParamName] = useState("");
  const [newParamType, setNewParamType] = useState("any");

  const client = new EKuiperClient(`/api/connections/${connectionId}/ekuiper`);

  // Fetch registered functions
  const { data: functions, isLoading } = useQuery({
    queryKey: ["functions", connectionId],
    queryFn: async () => {
      // In real implementation, fetch from API
      return [] as string[];
    },
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast({ title: "Copied", description: `${label} copied to clipboard` });
    setTimeout(() => setCopied(null), 2000);
  };

  const addParameter = () => {
    if (!newParamName) return;
    setCurrentFunction(prev => ({
      ...prev,
      parameters: [...prev.parameters, { name: newParamName, type: newParamType }],
    }));
    setNewParamName("");
  };

  const removeParameter = (name: string) => {
    setCurrentFunction(prev => ({
      ...prev,
      parameters: prev.parameters.filter(p => p.name !== name),
    }));
  };

  const loadTemplate = (templateKey: string) => {
    const templates = FUNCTION_TEMPLATES[selectedLanguage] as Record<string, { name: string; code: string }>;
    const template = templates[templateKey];
    if (template) {
      setCurrentFunction(prev => ({
        ...prev,
        language: selectedLanguage,
        code: template.code,
      }));
      toast({ title: "Template Loaded", description: template.name });
    }
  };

  const testFunction = () => {
    setTestError(null);
    setTestResult(null);

    try {
      // Parse test arguments
      const args = testArgs.split(",").map(arg => {
        const trimmed = arg.trim();
        // Try to parse as JSON/number/boolean
        try {
          return JSON.parse(trimmed);
        } catch {
          return trimmed;
        }
      });

      // For JavaScript, we can actually test it
      if (currentFunction.language === "javascript") {
        // Create function from code
        const fnBody = currentFunction.code;
        // Extract function name from code
        const fnMatch = fnBody.match(/function\s+(\w+)/);
        const fnName = fnMatch ? fnMatch[1] : "test";
        
        // Create and run function
        const evalCode = `
          ${fnBody}
          ${fnName}(${args.map(a => JSON.stringify(a)).join(", ")})
        `;
        
        const result = eval(evalCode);
        setTestResult(JSON.stringify(result, null, 2));
      } else {
        // For Go/Python, show what would be tested
        setTestResult(`Function would be called with: ${JSON.stringify(args)}\n\n(Actual testing requires plugin deployment)`);
      }
    } catch (error: any) {
      setTestError(error.message);
    }
  };

  const generatePluginManifest = () => {
    const manifest = {
      name: currentFunction.name,
      version: "1.0.0",
      language: currentFunction.language,
      functions: [{
        name: currentFunction.name,
        returnType: currentFunction.returnType,
        args: currentFunction.parameters.map(p => ({
          name: p.name,
          type: p.type,
        })),
      }],
    };
    return JSON.stringify(manifest, null, 2);
  };

  const downloadPlugin = () => {
    const manifest = generatePluginManifest();
    const files = {
      "manifest.json": manifest,
      [`${currentFunction.name}.${currentFunction.language === "go" ? "go" : currentFunction.language === "python" ? "py" : "js"}`]: currentFunction.code,
    };

    // Create zip-like download (simplified - single file)
    const content = `// manifest.json\n${manifest}\n\n// Source Code\n${currentFunction.code}`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentFunction.name}-plugin.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FunctionSquare className="h-6 w-6 text-purple-500" />
            Custom Function Development
          </h2>
          <p className="text-muted-foreground">
            Create custom SQL functions for eKuiper
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={downloadPlugin}>
            <Download className="h-4 w-4 mr-2" />
            Export Plugin
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList>
          <TabsTrigger value="editor" className="flex items-center gap-2">
            <Code2 className="h-4 w-4" />
            Editor
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <FileCode className="h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="reference" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Built-in Reference
          </TabsTrigger>
        </TabsList>

        <TabsContent value="editor" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Function Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Function Name</Label>
                  <Input
                    value={currentFunction.name}
                    onChange={(e) => setCurrentFunction({ ...currentFunction, name: e.target.value })}
                    placeholder="myFunction"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Language</Label>
                  <Select
                    value={currentFunction.language}
                    onValueChange={(v) => {
                      setCurrentFunction({ 
                        ...currentFunction, 
                        language: v as any,
                        code: FUNCTION_TEMPLATES[v as keyof typeof FUNCTION_TEMPLATES].basic.code
                      });
                      setSelectedLanguage(v as any);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="javascript">JavaScript</SelectItem>
                      <SelectItem value="go">Go</SelectItem>
                      <SelectItem value="python">Python</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Return Type</Label>
                  <Select
                    value={currentFunction.returnType}
                    onValueChange={(v) => setCurrentFunction({ ...currentFunction, returnType: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">any</SelectItem>
                      <SelectItem value="string">string</SelectItem>
                      <SelectItem value="int">int</SelectItem>
                      <SelectItem value="float">float</SelectItem>
                      <SelectItem value="bool">bool</SelectItem>
                      <SelectItem value="array">array</SelectItem>
                      <SelectItem value="object">object</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Parameters</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="name"
                      value={newParamName}
                      onChange={(e) => setNewParamName(e.target.value)}
                      className="flex-1"
                    />
                    <Select value={newParamType} onValueChange={setNewParamType}>
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">any</SelectItem>
                        <SelectItem value="string">string</SelectItem>
                        <SelectItem value="int">int</SelectItem>
                        <SelectItem value="float">float</SelectItem>
                        <SelectItem value="bool">bool</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="icon" onClick={addParameter}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {currentFunction.parameters.map((param) => (
                      <Badge key={param.name} variant="secondary" className="gap-1">
                        {param.name}: {param.type}
                        <button onClick={() => removeParameter(param.name)}>
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={currentFunction.description}
                    onChange={(e) => setCurrentFunction({ ...currentFunction, description: e.target.value })}
                    placeholder="What does this function do?"
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Code Editor */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Code2 className="h-5 w-5" />
                    Function Code
                    <Badge variant="outline">{currentFunction.language}</Badge>
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(currentFunction.code, "Code")}
                  >
                    {copied === "Code" ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={currentFunction.code}
                  onChange={(e) => setCurrentFunction({ ...currentFunction, code: e.target.value })}
                  className="font-mono text-sm min-h-[300px]"
                  spellCheck={false}
                />
              </CardContent>
            </Card>
          </div>

          {/* Testing Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TestTube className="h-5 w-5" />
                Test Function
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Test Arguments (comma-separated)</Label>
                  <div className="flex gap-2">
                    <Input
                      value={testArgs}
                      onChange={(e) => setTestArgs(e.target.value)}
                      placeholder="arg1, arg2, ..."
                      className="flex-1"
                    />
                    <Button onClick={testFunction}>
                      <Play className="h-4 w-4 mr-2" />
                      Run Test
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Tip: Use JSON format for objects/arrays: {`{"key": "value"}`}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Result</Label>
                  {testError ? (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                      <div className="flex items-center gap-2 text-red-500">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-sm font-medium">Error</span>
                      </div>
                      <pre className="text-xs mt-2 text-red-400">{testError}</pre>
                    </div>
                  ) : testResult ? (
                    <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                      <div className="flex items-center gap-2 text-green-500">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-sm font-medium">Success</span>
                      </div>
                      <pre className="text-xs mt-2 font-mono">{testResult}</pre>
                    </div>
                  ) : (
                    <div className="p-3 bg-muted rounded-lg text-muted-foreground text-sm">
                      Run test to see result
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Generated Manifest */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCode className="h-5 w-5" />
                Plugin Manifest (manifest.json)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="p-4 bg-muted rounded-lg font-mono text-xs whitespace-pre-wrap">
                {generatePluginManifest()}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <div className="flex gap-2 mb-4">
            {(["javascript", "go", "python"] as const).map((lang) => (
              <Badge
                key={lang}
                variant={selectedLanguage === lang ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setSelectedLanguage(lang)}
              >
                {lang}
              </Badge>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(FUNCTION_TEMPLATES[selectedLanguage]).map(([key, template]) => (
              <Card
                key={key}
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => loadTemplate(key)}
              >
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-yellow-500" />
                    {(template as any).name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs bg-muted p-3 rounded-lg font-mono overflow-hidden max-h-40">
                    {(template as any).code}
                  </pre>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="reference" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Built-in Functions Reference</CardTitle>
              <CardDescription>
                These functions are available by default in eKuiper SQL
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-6">
                  {["math", "string", "datetime", "json", "encoding"].map((category) => (
                    <div key={category}>
                      <h3 className="text-lg font-semibold mb-3 capitalize">{category} Functions</h3>
                      <div className="grid gap-2">
                        {BUILTIN_FUNCTIONS.filter(f => f.category === category).map((func) => (
                          <div
                            key={func.name}
                            className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                          >
                            <div>
                              <code className="font-mono font-bold text-purple-500">
                                {func.signature}
                              </code>
                              <p className="text-sm text-muted-foreground mt-1">
                                {func.description}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(func.name, func.name)}
                            >
                              {copied === func.name ? (
                                <Check className="h-4 w-4" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default CustomFunctionDev;
