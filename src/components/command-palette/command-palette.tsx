"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { 
  Dialog, 
  DialogContent,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  Search,
  Play,
  Square,
  Plus,
  FileText,
  Settings,
  Database,
  GitBranch,
  Download,
  Upload,
  RefreshCw,
  Trash2,
  Edit,
  Eye,
  Keyboard,
  Zap,
  Radio,
  LayoutDashboard,
  Workflow,
  Box,
  Monitor,
  FileCode,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  shortcut?: string[];
  category: string;
  action: () => void;
  keywords?: string[];
}

interface CommandPaletteProps {
  commands: CommandItem[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

// Default commands for eKuiper Playground
export function getDefaultCommands(actions: {
  navigateTo: (view: string) => void;
  createStream: () => void;
  createRule: () => void;
  refreshData: () => void;
  openSettings: () => void;
  exportConfig: () => void;
  importConfig: () => void;
}): CommandItem[] {
  return [
    // Navigation
    {
      id: "nav-dashboard",
      label: "Go to Dashboard",
      description: "View system overview",
      icon: <LayoutDashboard className="h-4 w-4" />,
      category: "Navigation",
      shortcut: ["G", "D"],
      action: () => actions.navigateTo("dashboard"),
      keywords: ["home", "overview", "main"],
    },
    {
      id: "nav-streams",
      label: "Go to Streams",
      description: "Manage data streams",
      icon: <Database className="h-4 w-4" />,
      category: "Navigation",
      shortcut: ["G", "S"],
      action: () => actions.navigateTo("streams"),
      keywords: ["data", "source", "input"],
    },
    {
      id: "nav-rules",
      label: "Go to Rules",
      description: "Manage processing rules",
      icon: <GitBranch className="h-4 w-4" />,
      category: "Navigation",
      shortcut: ["G", "R"],
      action: () => actions.navigateTo("rules"),
      keywords: ["processing", "query", "sql"],
    },
    {
      id: "nav-pipeline",
      label: "Go to Pipeline Builder",
      description: "Visual rule builder",
      icon: <Workflow className="h-4 w-4" />,
      category: "Navigation",
      shortcut: ["G", "P"],
      action: () => actions.navigateTo("pipeline"),
      keywords: ["visual", "flow", "diagram", "builder"],
    },
    {
      id: "nav-simulator",
      label: "Go to MQTT Simulator",
      description: "Test MQTT messages",
      icon: <Radio className="h-4 w-4" />,
      category: "Navigation",
      shortcut: ["G", "M"],
      action: () => actions.navigateTo("simulator"),
      keywords: ["mqtt", "test", "message", "publish"],
    },
    {
      id: "nav-plugins",
      label: "Go to Plugins",
      description: "Manage plugins",
      icon: <Box className="h-4 w-4" />,
      category: "Navigation",
      action: () => actions.navigateTo("plugins"),
      keywords: ["extensions", "custom"],
    },
    {
      id: "nav-logs",
      label: "Go to Logs",
      description: "View system logs",
      icon: <FileText className="h-4 w-4" />,
      category: "Navigation",
      action: () => actions.navigateTo("logs"),
      keywords: ["debug", "trace", "error"],
    },

    // Actions
    {
      id: "action-create-stream",
      label: "Create New Stream",
      description: "Define a new data stream",
      icon: <Plus className="h-4 w-4" />,
      category: "Actions",
      shortcut: ["Ctrl", "Shift", "S"],
      action: actions.createStream,
      keywords: ["new", "add", "stream"],
    },
    {
      id: "action-create-rule",
      label: "Create New Rule",
      description: "Create a new processing rule",
      icon: <Plus className="h-4 w-4" />,
      category: "Actions",
      shortcut: ["Ctrl", "Shift", "R"],
      action: actions.createRule,
      keywords: ["new", "add", "rule", "sql"],
    },
    {
      id: "action-refresh",
      label: "Refresh Data",
      description: "Reload streams and rules",
      icon: <RefreshCw className="h-4 w-4" />,
      category: "Actions",
      shortcut: ["Ctrl", "R"],
      action: actions.refreshData,
      keywords: ["reload", "sync", "update"],
    },
    {
      id: "action-export",
      label: "Export Configuration",
      description: "Export all streams, rules, and settings",
      icon: <Download className="h-4 w-4" />,
      category: "Actions",
      action: actions.exportConfig,
      keywords: ["backup", "save", "download"],
    },
    {
      id: "action-import",
      label: "Import Configuration",
      description: "Import configuration from file",
      icon: <Upload className="h-4 w-4" />,
      category: "Actions",
      action: actions.importConfig,
      keywords: ["restore", "load", "upload"],
    },

    // Settings
    {
      id: "settings-open",
      label: "Open Settings",
      description: "Configure playground settings",
      icon: <Settings className="h-4 w-4" />,
      category: "Settings",
      shortcut: ["Ctrl", ","],
      action: actions.openSettings,
      keywords: ["preferences", "config", "options"],
    },
  ];
}

function fuzzySearch(items: CommandItem[], query: string): CommandItem[] {
  if (!query.trim()) return items;

  const lowerQuery = query.toLowerCase();
  const words = lowerQuery.split(/\s+/);

  return items
    .map((item) => {
      const searchText = [
        item.label,
        item.description,
        item.category,
        ...(item.keywords || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      // Score based on matches
      let score = 0;
      for (const word of words) {
        if (item.label.toLowerCase().includes(word)) score += 10;
        if (item.description?.toLowerCase().includes(word)) score += 5;
        if (item.keywords?.some((k) => k.toLowerCase().includes(word))) score += 7;
        if (searchText.includes(word)) score += 1;
      }

      return { item, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item);
}

export function CommandPalette({ commands, isOpen, onOpenChange }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredCommands = useMemo(() => fuzzySearch(commands, query), [commands, query]);

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    for (const cmd of filteredCommands) {
      if (!groups[cmd.category]) {
        groups[cmd.category] = [];
      }
      groups[cmd.category].push(cmd);
    }
    return groups;
  }, [filteredCommands]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Reset query when dialog opens
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const executeCommand = useCallback((command: CommandItem) => {
    onOpenChange(false);
    // Small delay to allow dialog to close smoothly
    setTimeout(() => {
      command.action();
    }, 100);
  }, [onOpenChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const totalItems = filteredCommands.length;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % totalItems);
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + totalItems) % totalItems);
          break;
        case "Enter":
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            executeCommand(filteredCommands[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          onOpenChange(false);
          break;
      }
    },
    [filteredCommands, selectedIndex, executeCommand, onOpenChange]
  );

  let currentIndex = 0;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 max-w-lg overflow-hidden">
        <div className="flex items-center border-b px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            autoFocus
          />
          <Badge variant="outline" className="ml-2 text-xs shrink-0">
            <Keyboard className="h-3 w-3 mr-1" />
            ↑↓ to navigate
          </Badge>
        </div>

        <div className="max-h-[400px] overflow-y-auto p-2">
          {filteredCommands.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <HelpCircle className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No commands found</p>
              <p className="text-xs">Try a different search term</p>
            </div>
          ) : (
            Object.entries(groupedCommands).map(([category, items]) => (
              <div key={category} className="mb-2">
                <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                  {category}
                </div>
                {items.map((command) => {
                  const itemIndex = currentIndex++;
                  const isSelected = itemIndex === selectedIndex;

                  return (
                    <button
                      key={command.id}
                      onClick={() => executeCommand(command)}
                      onMouseEnter={() => setSelectedIndex(itemIndex)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      )}
                    >
                      <div className={cn(
                        "shrink-0",
                        isSelected ? "text-primary-foreground" : "text-muted-foreground"
                      )}>
                        {command.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{command.label}</div>
                        {command.description && (
                          <div className={cn(
                            "text-xs truncate",
                            isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
                          )}>
                            {command.description}
                          </div>
                        )}
                      </div>
                      {command.shortcut && (
                        <div className="flex gap-1 shrink-0">
                          {command.shortcut.map((key, i) => (
                            <kbd
                              key={i}
                              className={cn(
                                "px-1.5 py-0.5 text-xs rounded border font-mono",
                                isSelected
                                  ? "bg-primary-foreground/20 border-primary-foreground/30 text-primary-foreground"
                                  : "bg-muted border-border"
                              )}
                            >
                              {key}
                            </kbd>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1 py-0.5 rounded border bg-muted mr-1">↵</kbd>
              to select
            </span>
            <span>
              <kbd className="px-1 py-0.5 rounded border bg-muted mr-1">esc</kbd>
              to close
            </span>
          </div>
          <span>{filteredCommands.length} commands</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Hook for global keyboard shortcut
export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K or Cmd+K to open command palette
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return { isOpen, setIsOpen };
}
