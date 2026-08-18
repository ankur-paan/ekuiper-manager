'use client';

import type { ComponentType } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  Blocks,
  ChevronLeft,
  Database,
  FileArchive,
  FileJson,
  FolderCog,
  FunctionSquare,
  HardDriveUpload,
  Network,
  Plug,
  Server,
  Settings,
  Table2,
  Upload,
  Users,
  Workflow,
  WandSparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface NavItem {
  title: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
}

interface NavGroup {
  title: string;
  icon: ComponentType<{ className?: string }>;
  items: NavItem[];
}

export const navigationGroups: NavGroup[] = [
  {
    title: 'Workspace',
    icon: Activity,
    items: [{ title: 'Overview', href: '/dashboard', icon: Activity }],
  },
  {
    title: 'Data',
    icon: Database,
    items: [
      { title: 'Streams', href: '/streams', icon: Database },
      { title: 'Tables', href: '/tables', icon: Table2 },
    ],
  },
  {
    title: 'Rules',
    icon: Workflow,
    items: [
      { title: 'Rules', href: '/rules', icon: Workflow },
      { title: 'Designer', href: '/rules/new', icon: WandSparkles },
    ],
  },
  {
    title: 'Resources',
    icon: FolderCog,
    items: [
      { title: 'Connections', href: '/connections', icon: Network },
      { title: 'Schemas', href: '/schemas', icon: FileJson },
      { title: 'Files', href: '/uploads', icon: HardDriveUpload },
    ],
  },
  {
    title: 'Extensions',
    icon: Blocks,
    items: [
      { title: 'Plugins', href: '/plugins', icon: Plug },
      { title: 'Functions', href: '/functions', icon: FunctionSquare },
      { title: 'Services', href: '/services', icon: Network },
    ],
  },
  {
    title: 'Operations',
    icon: FileArchive,
    items: [
      { title: 'Import', href: '/data/import', icon: Upload },
      { title: 'Export', href: '/data/export', icon: FileArchive },
    ],
  },
  {
    title: 'Manager',
    icon: Settings,
    items: [
      { title: 'Nodes', href: '/nodes', icon: Server },
      { title: 'Users', href: '/users', icon: Users },
      { title: 'Settings', href: '/settings', icon: Settings },
    ],
  },
];

interface SidebarProps {
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

function active(pathname: string, href: string): boolean {
  if (pathname === '/rules/new') return href === '/rules/new';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ collapsed = false, onCollapsedChange }: SidebarProps) {
  const pathname = usePathname();
  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r bg-background transition-[width]',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      <div className="flex h-14 items-center border-b px-3">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-2" aria-label="eKuiper Manager">
          <Workflow className="h-6 w-6 shrink-0 text-primary" />
          {!collapsed && <span className="truncate font-semibold">eKuiper Manager</span>}
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className={cn('ml-auto h-8 w-8', collapsed && 'mx-auto')}
          onClick={() => onCollapsedChange?.(!collapsed)}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
        >
          <ChevronLeft className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} />
        </Button>
      </div>
      <ScrollArea className="flex-1 py-3">
        <nav className="space-y-4 px-2" aria-label="Primary navigation">
          {navigationGroups.map((group) => (
            <div key={group.title}>
              {!collapsed && (
                <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.title}
                </p>
              )}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const itemButton = (
                    <Button
                      variant={active(pathname, item.href) ? 'secondary' : 'ghost'}
                      size={collapsed ? 'icon' : 'default'}
                      className={cn('h-9', !collapsed && 'w-full justify-start gap-3')}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && item.title}
                    </Button>
                  );
                  return collapsed ? (
                    <Tooltip key={item.href} delayDuration={0}>
                      <TooltipTrigger asChild>
                        <Link href={item.href}>{itemButton}</Link>
                      </TooltipTrigger>
                      <TooltipContent side="right">{item.title}</TooltipContent>
                    </Tooltip>
                  ) : (
                    <Link key={item.href} href={item.href}>
                      {itemButton}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </ScrollArea>
    </aside>
  );
}
