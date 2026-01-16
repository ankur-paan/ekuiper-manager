"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  Database,
  Workflow,
  Plug,
  Settings,
  Server,
  Activity,
  Upload,
  Download,
  Code2,
  Layers,
  Network,
  FileJson,
  BookOpen,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
}

export const navigationGroups: NavGroup[] = [
  {
    title: "System",
    icon: Server,
    items: [
      { title: "Dashboard", href: "/dashboard", icon: Activity },
      { title: "System Info", href: "/system", icon: Server },
    ],
  },
  {
    title: "Data Sources",
    icon: Database,
    items: [
      { title: "Streams", href: "/streams", icon: Database },
      { title: "Tables", href: "/tables", icon: Layers },
    ],
  },
  {
    title: "Processing",
    icon: Workflow,
    items: [
      { title: "Rules", href: "/rules", icon: Workflow },
      { title: "Functions", href: "/functions", icon: Code2 },
      { title: "Dependency Graph", href: "/graph", icon: Network },
    ],
  },
  {
    title: "Extensions",
    icon: Plug,
    items: [
      { title: "Plugins", href: "/plugins", icon: Plug },
    ],
  },
  {
    title: "Services",
    icon: Network,
    items: [
      { title: "External Services", href: "/services", icon: Network },
    ],
  },
  {
    title: "Configuration",
    icon: Settings,
    items: [
      { title: "Schemas", href: "/schemas", icon: FileJson },
      { title: "Connections", href: "/connections", icon: Network },
      { title: "File Uploads", href: "/uploads", icon: Upload },
    ],
  },
  {
    title: "Data Management",
    icon: Database,
    items: [
      { title: "Import Data", href: "/data/import", icon: Upload },
      { title: "Export Data", href: "/data/export", icon: Download },
    ],
  },
  {
    title: "Development",
    icon: BookOpen,
    items: [
      { title: "API Playground", href: "/api-docs", icon: BookOpen },
    ],
  },
];

interface SidebarProps {
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export function Sidebar({ collapsed = false, onCollapsedChange }: SidebarProps) {
  const pathname = usePathname();
  const [openGroups, setOpenGroups] = React.useState<string[]>(["System", "Data Sources", "Processing", "Configuration", "Data Management"]);

  const toggleGroup = (group: string) => {
    setOpenGroups((prev) =>
      prev.includes(group)
        ? prev.filter((g) => g !== group)
        : [...prev, group]
    );
  };

  if (collapsed) {
    return (
      <div className="flex h-full w-16 flex-col border-r bg-background">
        <div className="flex h-14 items-center justify-center border-b">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onCollapsedChange?.(false)}
          >
            <Workflow className="h-6 w-6 text-primary" />
          </Button>
        </div>
        <ScrollArea className="flex-1 py-2">
          <nav className="flex flex-col items-center gap-2 px-2">
            {navigationGroups.flatMap((group) =>
              group.items.map((item) => (
                <Tooltip key={item.href} delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Link href={item.href}>
                      <Button
                        variant={pathname === item.href ? "secondary" : "ghost"}
                        size="icon"
                        className="h-9 w-9"
                      >
                        <item.icon className="h-4 w-4" />
                      </Button>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {item.title}
                  </TooltipContent>
                </Tooltip>
              ))
            )}
          </nav>
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="flex h-full w-64 flex-col border-r bg-background">
      {/* Logo/Brand */}
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <Workflow className="h-6 w-6 text-primary" />
        <span className="font-semibold">eKuiper Manager</span>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto h-8 w-8"
          onClick={() => onCollapsedChange?.(true)}
        >
          <ChevronDown className="h-4 w-4 rotate-90" />
        </Button>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-2">
        <nav className="space-y-1 px-2">
          {navigationGroups.map((group) => (
            <Collapsible
              key={group.title}
              open={openGroups.includes(group.title)}
              onOpenChange={() => toggleGroup(group.title)}
            >
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-between px-3 py-2"
                >
                  <span className="flex items-center gap-2">
                    <group.icon className="h-4 w-4" />
                    {group.title}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform",
                      openGroups.includes(group.title) && "rotate-180"
                    )}
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1 pl-4 pt-1">
                {group.items.map((item) => (
                  <Link key={item.href} href={item.href}>
                    <Button
                      variant={pathname === item.href ? "secondary" : "ghost"}
                      className="w-full justify-start gap-2 px-3 py-1.5 text-sm"
                    >
                      <item.icon className="h-4 w-4" />
                      {item.title}
                    </Button>
                  </Link>
                ))}
              </CollapsibleContent>
            </Collapsible>
          ))}
        </nav>
      </ScrollArea>
    </div>
  );
}
