"use client";

import { useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  HelpCircle,
  Info,
  Lightbulb,
  ExternalLink,
  Book,
  Copy,
  Check,
  ChevronRight
} from "lucide-react";

// =============================================================================
// Help Tooltip - Simple hover tooltip
// =============================================================================

interface HelpTooltipProps {
  children?: React.ReactNode;
  content: string;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
}

export function HelpTooltip({ children, content, side = "top", className }: HelpTooltipProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          {children || (
            <HelpCircle className={cn("h-4 w-4 text-muted-foreground hover:text-foreground cursor-help", className)} />
          )}
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs">
          <p className="text-sm">{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// =============================================================================
// Info Popover - Detailed information panel
// =============================================================================

interface InfoPopoverProps {
  title: string;
  content: string | React.ReactNode;
  learnMoreUrl?: string;
  examples?: { label: string; code: string }[];
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
}

export function InfoPopover({ 
  title, 
  content, 
  learnMoreUrl, 
  examples,
  side = "right",
  className 
}: InfoPopoverProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (code: string, label: string) => {
    navigator.clipboard.writeText(code);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className={cn("h-5 w-5 p-0", className)}>
          <Info className="h-4 w-4 text-muted-foreground hover:text-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent side={side} className="w-80">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Book className="h-4 w-4 text-sota-blue" />
            <h4 className="font-semibold">{title}</h4>
          </div>
          
          <div className="text-sm text-muted-foreground">
            {typeof content === "string" ? <p>{content}</p> : content}
          </div>

          {examples && examples.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Examples:</p>
              {examples.map((example) => (
                <div 
                  key={example.label} 
                  className="flex items-center justify-between bg-muted p-2 rounded text-xs font-mono"
                >
                  <code>{example.code}</code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => copyToClipboard(example.code, example.label)}
                  >
                    {copied === example.label ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}

          {learnMoreUrl && (
            <Button variant="link" size="sm" className="p-0 h-auto" asChild>
              <a href={learnMoreUrl} target="_blank" rel="noopener noreferrer">
                Learn more <ExternalLink className="h-3 w-3 ml-1" />
              </a>
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// =============================================================================
// Contextual Help Panel - Expandable help section
// =============================================================================

interface HelpSection {
  title: string;
  content: string;
  code?: string;
}

interface ContextualHelpProps {
  title: string;
  description?: string;
  sections: HelpSection[];
  defaultExpanded?: boolean;
  className?: string;
}

export function ContextualHelp({ 
  title, 
  description, 
  sections, 
  defaultExpanded = false,
  className 
}: ContextualHelpProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (code: string, label: string) => {
    navigator.clipboard.writeText(code);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className={cn("border rounded-lg bg-muted/30", className)}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-yellow-500" />
          <span className="font-medium text-sm">{title}</span>
        </div>
        <ChevronRight className={cn("h-4 w-4 transition-transform", expanded && "rotate-90")} />
      </button>
      
      {expanded && (
        <div className="px-3 pb-3 space-y-3">
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
          
          <ScrollArea className="max-h-64">
            <div className="space-y-3">
              {sections.map((section, index) => (
                <div key={index} className="space-y-1">
                  <h5 className="text-xs font-medium">{section.title}</h5>
                  <p className="text-xs text-muted-foreground">{section.content}</p>
                  {section.code && (
                    <div className="flex items-center justify-between bg-muted p-2 rounded text-xs font-mono">
                      <code className="truncate">{section.code}</code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 flex-shrink-0"
                        onClick={() => copyToClipboard(section.code!, section.title)}
                      >
                        {copied === section.title ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Feature Badge with Tooltip
// =============================================================================

interface FeatureBadgeProps {
  feature: string;
  description: string;
  status?: "stable" | "beta" | "experimental";
  docsUrl?: string;
}

export function FeatureBadge({ feature, description, status = "stable", docsUrl }: FeatureBadgeProps) {
  const statusColors = {
    stable: "bg-green-500/10 text-green-500 border-green-500/30",
    beta: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
    experimental: "bg-red-500/10 text-red-500 border-red-500/30",
  };

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={cn("cursor-help", statusColors[status])}>
            {feature}
            {status !== "stable" && (
              <span className="ml-1 text-[10px] uppercase">{status}</span>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-2">
            <p className="text-sm">{description}</p>
            {docsUrl && (
              <a 
                href={docsUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                Documentation <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// =============================================================================
// Quick Tip Banner
// =============================================================================

interface QuickTipProps {
  tip: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  dismissible?: boolean;
  onDismiss?: () => void;
  variant?: "info" | "success" | "warning";
  className?: string;
}

export function QuickTip({ 
  tip, 
  action, 
  dismissible = false, 
  onDismiss,
  variant = "info",
  className 
}: QuickTipProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const variantStyles = {
    info: "bg-blue-500/10 border-blue-500/30 text-blue-500",
    success: "bg-green-500/10 border-green-500/30 text-green-500",
    warning: "bg-yellow-500/10 border-yellow-500/30 text-yellow-500",
  };

  return (
    <div className={cn("flex items-center gap-3 p-3 rounded-lg border", variantStyles[variant], className)}>
      <Lightbulb className="h-4 w-4 flex-shrink-0" />
      <p className="text-sm flex-1">{tip}</p>
      {action && (
        <Button variant="ghost" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
      {dismissible && (
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => {
            setDismissed(true);
            onDismiss?.();
          }}
        >
          Dismiss
        </Button>
      )}
    </div>
  );
}

// =============================================================================
// Keyboard Shortcut Display
// =============================================================================

interface KeyboardShortcutProps {
  keys: string[];
  description: string;
}

export function KeyboardShortcut({ keys, description }: KeyboardShortcutProps) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-muted-foreground">{description}</span>
      <div className="flex items-center gap-1">
        {keys.map((key, index) => (
          <kbd 
            key={index}
            className="px-2 py-0.5 text-xs rounded border bg-muted font-mono"
          >
            {key}
          </kbd>
        ))}
      </div>
    </div>
  );
}
