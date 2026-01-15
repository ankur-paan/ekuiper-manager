"use client";

import { useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Cpu,
  Download,
  Copy,
  Check,
  RefreshCw,
  Terminal,
  Settings,
  Package,
  Code2,
  Layers,
  Info,
  CheckCircle2,
  Server,
  Box,
  Hammer,
  FileCode,
  FolderOpen
} from "lucide-react";

// =============================================================================
// Types
// =============================================================================

type Architecture = "amd64" | "arm64" | "arm" | "386";
type OperatingSystem = "linux" | "darwin" | "windows";
type PluginType = "source" | "sink" | "function";

interface BuildTarget {
  os: OperatingSystem;
  arch: Architecture;
  label: string;
  icon: string;
  supported: boolean;
}

interface BuildConfig {
  pluginName: string;
  pluginType: PluginType;
  sourceFile: string;
  goVersion: string;
  ekuiperVersion: string;
  targets: BuildTarget[];
  enableCGO: boolean;
  staticLink: boolean;
  stripDebug: boolean;
  additionalLdflags: string;
  additionalTags: string;
}

// =============================================================================
// Constants
// =============================================================================

const BUILD_TARGETS: BuildTarget[] = [
  { os: "linux", arch: "amd64", label: "Linux x64", icon: "🐧", supported: true },
  { os: "linux", arch: "arm64", label: "Linux ARM64", icon: "🐧", supported: true },
  { os: "linux", arch: "arm", label: "Linux ARM", icon: "🐧", supported: true },
  { os: "linux", arch: "386", label: "Linux x86", icon: "🐧", supported: true },
  { os: "darwin", arch: "amd64", label: "macOS x64", icon: "🍎", supported: true },
  { os: "darwin", arch: "arm64", label: "macOS M1/M2", icon: "🍎", supported: true },
  { os: "windows", arch: "amd64", label: "Windows x64", icon: "🪟", supported: false },
];

const GO_VERSIONS = ["1.21", "1.20", "1.19", "1.18"];
const EKUIPER_VERSIONS = ["1.12.0", "1.11.0", "1.10.0", "1.9.0"];

// =============================================================================
// Build Script Generators
// =============================================================================

function generateMakefile(config: BuildConfig): string {
  const selectedTargets = config.targets.filter(t => t.supported);
  
  return `# eKuiper Plugin Makefile
# Plugin: ${config.pluginName}
# Type: ${config.pluginType}

PLUGIN_NAME := ${config.pluginName}
PLUGIN_TYPE := ${config.pluginType}s
GO_VERSION := ${config.goVersion}
EKUIPER_VERSION := ${config.ekuiperVersion}

# Build flags
CGO_ENABLED := ${config.enableCGO ? "1" : "0"}
LDFLAGS := -s -w${config.additionalLdflags ? ` ${config.additionalLdflags}` : ""}
${config.additionalTags ? `BUILD_TAGS := -tags "${config.additionalTags}"` : ""}

# Output directory
OUT_DIR := ./build

.PHONY: all clean ${selectedTargets.map(t => `build-${t.os}-${t.arch}`).join(" ")}

all: ${selectedTargets.map(t => `build-${t.os}-${t.arch}`).join(" ")}

${selectedTargets.map(t => `
build-${t.os}-${t.arch}:
	@echo "Building for ${t.label}..."
	@mkdir -p $(OUT_DIR)/${t.os}_${t.arch}
	CGO_ENABLED=$(CGO_ENABLED) GOOS=${t.os} GOARCH=${t.arch} \\
		go build -ldflags="$(LDFLAGS)" $(BUILD_TAGS) \\
		-o $(OUT_DIR)/${t.os}_${t.arch}/$(PLUGIN_NAME).so \\
		-buildmode=plugin ./${config.sourceFile}
	@echo "Built: $(OUT_DIR)/${t.os}_${t.arch}/$(PLUGIN_NAME).so"
`).join("")}

clean:
	rm -rf $(OUT_DIR)

# Package plugins for distribution
package:
	@echo "Packaging plugins..."
	@for dir in $(OUT_DIR)/*/; do \\
		platform=$$(basename $$dir); \\
		tar -czf $(OUT_DIR)/$(PLUGIN_NAME)_$$platform.tar.gz -C $$dir .; \\
	done
	@echo "Packages created in $(OUT_DIR)/"
`;
}

function generateDockerfile(config: BuildConfig): string {
  return `# Multi-stage build for eKuiper plugin
# Plugin: ${config.pluginName}
# Type: ${config.pluginType}

# Stage 1: Build environment
FROM golang:${config.goVersion}-alpine AS builder

# Install build dependencies
RUN apk add --no-cache git make gcc musl-dev

# Set working directory
WORKDIR /plugin

# Copy source files
COPY . .

# Download dependencies
RUN go mod download

# Build the plugin
ARG TARGETOS=linux
ARG TARGETARCH=amd64

RUN CGO_ENABLED=${config.enableCGO ? "1" : "0"} GOOS=\${TARGETOS} GOARCH=\${TARGETARCH} \\
    go build \\
    -ldflags="-s -w${config.staticLink ? " -extldflags=-static" : ""}${config.additionalLdflags ? ` ${config.additionalLdflags}` : ""}" \\
    ${config.additionalTags ? `-tags "${config.additionalTags}" ` : ""}\\
    -o /plugin/${config.pluginName}.so \\
    -buildmode=plugin \\
    ./${config.sourceFile}

# Stage 2: Package for distribution
FROM alpine:latest

WORKDIR /plugins

# Copy built plugin
COPY --from=builder /plugin/${config.pluginName}.so .
COPY --from=builder /plugin/${config.pluginName}.json .

# Create archive
RUN tar -czf ${config.pluginName}.tar.gz ${config.pluginName}.so ${config.pluginName}.json

# Output location for extraction
VOLUME /output

CMD ["sh", "-c", "cp /plugins/${config.pluginName}.tar.gz /output/"]
`;
}

function generateBuildScript(config: BuildConfig): string {
  const selectedTargets = config.targets.filter(t => t.supported);
  
  return `#!/bin/bash
# eKuiper Plugin Cross-Compilation Script
# Plugin: ${config.pluginName}
# Type: ${config.pluginType}

set -e

PLUGIN_NAME="${config.pluginName}"
PLUGIN_TYPE="${config.pluginType}s"
SOURCE_FILE="${config.sourceFile}"
OUTPUT_DIR="./build"

# Build flags
export CGO_ENABLED=${config.enableCGO ? "1" : "0"}
LDFLAGS="-s -w${config.additionalLdflags ? ` ${config.additionalLdflags}` : ""}"
${config.additionalTags ? `BUILD_TAGS="-tags \\"${config.additionalTags}\\""` : "BUILD_TAGS="}

echo "🔨 Building eKuiper Plugin: $PLUGIN_NAME"
echo "================================================"

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Build targets
${selectedTargets.map(t => `
echo ""
echo "📦 Building for ${t.label}..."
export GOOS=${t.os}
export GOARCH=${t.arch}
OUTPUT_PATH="$OUTPUT_DIR/${t.os}_${t.arch}"
mkdir -p "$OUTPUT_PATH"

go build \\
    -ldflags="$LDFLAGS" \\
    $BUILD_TAGS \\
    -o "$OUTPUT_PATH/$PLUGIN_NAME.so" \\
    -buildmode=plugin \\
    "./$SOURCE_FILE"

echo "✅ Built: $OUTPUT_PATH/$PLUGIN_NAME.so"
`).join("")}

echo ""
echo "================================================"
echo "🎉 Build complete! Plugins are in $OUTPUT_DIR/"
echo ""
echo "📋 Built artifacts:"
find "$OUTPUT_DIR" -name "*.so" -type f

# Create distribution packages
echo ""
echo "📦 Creating distribution packages..."
for dir in "$OUTPUT_DIR"/*/; do
    platform=$(basename "$dir")
    tar -czf "$OUTPUT_DIR/\${PLUGIN_NAME}_\$platform.tar.gz" -C "$dir" .
    echo "   Created: \${PLUGIN_NAME}_\$platform.tar.gz"
done

echo ""
echo "🚀 Ready to deploy!"
`;
}

function generateGitHubAction(config: BuildConfig): string {
  const selectedTargets = config.targets.filter(t => t.supported);
  
  return `# GitHub Actions workflow for eKuiper Plugin
# Plugin: ${config.pluginName}

name: Build eKuiper Plugin

on:
  push:
    branches: [ main ]
    tags: [ 'v*' ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        include:
${selectedTargets.map(t => `          - os: ${t.os}
            arch: ${t.arch}
            name: ${t.label}`).join("\n")}

    steps:
      - uses: actions/checkout@v4

      - name: Set up Go
        uses: actions/setup-go@v5
        with:
          go-version: '${config.goVersion}'

      - name: Build Plugin
        env:
          CGO_ENABLED: ${config.enableCGO ? "1" : "0"}
          GOOS: \${{ matrix.os }}
          GOARCH: \${{ matrix.arch }}
        run: |
          mkdir -p build/\${{ matrix.os }}_\${{ matrix.arch }}
          go build \\
            -ldflags="-s -w${config.additionalLdflags ? ` ${config.additionalLdflags}` : ""}" \\
            ${config.additionalTags ? `-tags "${config.additionalTags}" ` : ""}\\
            -o build/\${{ matrix.os }}_\${{ matrix.arch }}/${config.pluginName}.so \\
            -buildmode=plugin \\
            ./${config.sourceFile}

      - name: Create Archive
        run: |
          cd build/\${{ matrix.os }}_\${{ matrix.arch }}
          tar -czf ../${config.pluginName}_\${{ matrix.os }}_\${{ matrix.arch }}.tar.gz .

      - name: Upload Artifact
        uses: actions/upload-artifact@v4
        with:
          name: ${config.pluginName}-\${{ matrix.os }}-\${{ matrix.arch }}
          path: build/${config.pluginName}_\${{ matrix.os }}_\${{ matrix.arch }}.tar.gz

  release:
    needs: build
    if: startsWith(github.ref, 'refs/tags/')
    runs-on: ubuntu-latest
    
    steps:
      - name: Download all artifacts
        uses: actions/download-artifact@v4
        with:
          path: artifacts

      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          files: artifacts/**/*.tar.gz
          generate_release_notes: true
`;
}

// =============================================================================
// Main Component
// =============================================================================

export function CrossCompilationTools() {
  const [activeTab, setActiveTab] = useState<"config" | "makefile" | "docker" | "script" | "github">("config");
  const [copied, setCopied] = useState<string | null>(null);
  
  const [config, setConfig] = useState<BuildConfig>({
    pluginName: "my_plugin",
    pluginType: "source",
    sourceFile: "main.go",
    goVersion: "1.21",
    ekuiperVersion: "1.12.0",
    targets: BUILD_TARGETS.filter(t => t.os === "linux" && t.arch === "amd64"),
    enableCGO: false,
    staticLink: true,
    stripDebug: true,
    additionalLdflags: "",
    additionalTags: "",
  });

  const toggleTarget = (target: BuildTarget) => {
    setConfig(prev => {
      const exists = prev.targets.some(t => t.os === target.os && t.arch === target.arch);
      if (exists) {
        return {
          ...prev,
          targets: prev.targets.filter(t => !(t.os === target.os && t.arch === target.arch))
        };
      } else {
        return {
          ...prev,
          targets: [...prev.targets, target]
        };
      }
    });
  };

  const isTargetSelected = (target: BuildTarget) => {
    return config.targets.some(t => t.os === target.os && t.arch === target.arch);
  };

  const copyToClipboard = (content: string, label: string) => {
    navigator.clipboard.writeText(content);
    setCopied(label);
    toast({ title: "Copied", description: `${label} copied to clipboard` });
    setTimeout(() => setCopied(null), 2000);
  };

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Downloaded", description: filename });
  };

  const makefile = generateMakefile(config);
  const dockerfile = generateDockerfile(config);
  const buildScript = generateBuildScript(config);
  const githubAction = generateGitHubAction(config);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Cpu className="h-6 w-6 text-sota-green" />
            Cross-Compilation Tools
          </h2>
          <p className="text-muted-foreground">
            Build plugins for multiple architectures and platforms
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="config" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configure
          </TabsTrigger>
          <TabsTrigger value="makefile" className="flex items-center gap-2">
            <Hammer className="h-4 w-4" />
            Makefile
          </TabsTrigger>
          <TabsTrigger value="docker" className="flex items-center gap-2">
            <Box className="h-4 w-4" />
            Docker
          </TabsTrigger>
          <TabsTrigger value="script" className="flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            Script
          </TabsTrigger>
          <TabsTrigger value="github" className="flex items-center gap-2">
            <Code2 className="h-4 w-4" />
            GitHub
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Plugin Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Plugin Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Plugin Name</Label>
                    <Input
                      value={config.pluginName}
                      onChange={(e) => setConfig({ ...config, pluginName: e.target.value })}
                      placeholder="my_plugin"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Plugin Type</Label>
                    <Select
                      value={config.pluginType}
                      onValueChange={(v) => setConfig({ ...config, pluginType: v as PluginType })}
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
                  <Label>Source File</Label>
                  <Input
                    value={config.sourceFile}
                    onChange={(e) => setConfig({ ...config, sourceFile: e.target.value })}
                    placeholder="main.go"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Go Version</Label>
                    <Select
                      value={config.goVersion}
                      onValueChange={(v) => setConfig({ ...config, goVersion: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {GO_VERSIONS.map(v => (
                          <SelectItem key={v} value={v}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>eKuiper Version</Label>
                    <Select
                      value={config.ekuiperVersion}
                      onValueChange={(v) => setConfig({ ...config, ekuiperVersion: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EKUIPER_VERSIONS.map(v => (
                          <SelectItem key={v} value={v}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label>Build Options</Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={config.enableCGO}
                        onCheckedChange={(checked) => 
                          setConfig({ ...config, enableCGO: checked as boolean })
                        }
                      />
                      <Label className="font-normal">Enable CGO</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={config.staticLink}
                        onCheckedChange={(checked) => 
                          setConfig({ ...config, staticLink: checked as boolean })
                        }
                      />
                      <Label className="font-normal">Static linking</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={config.stripDebug}
                        onCheckedChange={(checked) => 
                          setConfig({ ...config, stripDebug: checked as boolean })
                        }
                      />
                      <Label className="font-normal">Strip debug symbols</Label>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Additional LDFLAGS</Label>
                  <Input
                    value={config.additionalLdflags}
                    onChange={(e) => setConfig({ ...config, additionalLdflags: e.target.value })}
                    placeholder="-X main.version=1.0.0"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Build Tags</Label>
                  <Input
                    value={config.additionalTags}
                    onChange={(e) => setConfig({ ...config, additionalTags: e.target.value })}
                    placeholder="netgo osusergo"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Target Platforms */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  Target Platforms
                </CardTitle>
                <CardDescription>
                  Select platforms to build for
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-2">
                  {BUILD_TARGETS.map((target) => (
                    <div
                      key={`${target.os}-${target.arch}`}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer",
                        !target.supported && "opacity-50 cursor-not-allowed",
                        isTargetSelected(target) && target.supported && "border-primary bg-primary/5"
                      )}
                      onClick={() => target.supported && toggleTarget(target)}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={isTargetSelected(target)}
                          disabled={!target.supported}
                        />
                        <span className="text-xl">{target.icon}</span>
                        <div>
                          <p className="font-medium">{target.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {target.os}/{target.arch}
                          </p>
                        </div>
                      </div>
                      {!target.supported && (
                        <Badge variant="outline" className="text-xs">
                          Not Supported
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-4 p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>
                      {config.targets.length} platform{config.targets.length !== 1 ? "s" : ""} selected
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="makefile" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Makefile</CardTitle>
                  <CardDescription>
                    Build automation with make
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(makefile, "Makefile")}
                  >
                    {copied === "Makefile" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadFile(makefile, "Makefile")}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <pre className="p-4 bg-muted rounded-lg font-mono text-sm">
                  {makefile}
                </pre>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="docker" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Dockerfile</CardTitle>
                  <CardDescription>
                    Multi-stage Docker build for plugins
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(dockerfile, "Dockerfile")}
                  >
                    {copied === "Dockerfile" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadFile(dockerfile, "Dockerfile")}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <pre className="p-4 bg-muted rounded-lg font-mono text-sm">
                  {dockerfile}
                </pre>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="script" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Build Script</CardTitle>
                  <CardDescription>
                    Bash script for local builds
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(buildScript, "build.sh")}
                  >
                    {copied === "build.sh" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadFile(buildScript, "build.sh")}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <pre className="p-4 bg-muted rounded-lg font-mono text-sm">
                  {buildScript}
                </pre>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="github" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>GitHub Actions</CardTitle>
                  <CardDescription>
                    CI/CD workflow for automated builds
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(githubAction, "build.yml")}
                  >
                    {copied === "build.yml" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadFile(githubAction, "build.yml")}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <pre className="p-4 bg-muted rounded-lg font-mono text-sm">
                  {githubAction}
                </pre>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Instructions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <Info className="h-5 w-5 text-sota-blue mt-0.5" />
            <div className="space-y-2 text-sm text-muted-foreground">
              <p><strong>Quick Start:</strong></p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Configure your plugin settings above</li>
                <li>Select target platforms for cross-compilation</li>
                <li>Download the build files (Makefile, Dockerfile, or script)</li>
                <li>Run <code className="bg-muted px-1 rounded">make all</code> to build all targets</li>
                <li>Find built plugins in the <code className="bg-muted px-1 rounded">./build</code> directory</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default CrossCompilationTools;
