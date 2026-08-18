'use client';

import Link from 'next/link';
import { Check, ChevronDown, Plus, Server } from 'lucide-react';
import { useServerStore } from '@/stores/server-store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function ServerSelector() {
  const { servers, activeServerId, setActiveServer } = useServerStore();
  const active = servers.find((node) => node.id === activeServerId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="max-w-[260px] gap-2" aria-label="Select eKuiper node">
          <Server className="h-4 w-4 shrink-0" />
          <span className="truncate">{active?.name ?? 'Select node'}</span>
          {active?.version && (
            <Badge variant="secondary" className="hidden font-normal lg:inline-flex">
              {active.version}
            </Badge>
          )}
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>eKuiper node</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {servers.map((node) => (
          <DropdownMenuItem
            key={node.id}
            onSelect={() => setActiveServer(node.id)}
            className="flex items-start gap-3 py-2"
          >
            <span
              aria-hidden="true"
              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                node.status === 'connected'
                  ? 'bg-emerald-500'
                  : node.status === 'error'
                    ? 'bg-amber-500'
                    : 'bg-slate-400'
              }`}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{node.name}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {node.version ? `eKuiper ${node.version}` : 'Version not detected'}
              </span>
            </span>
            {node.id === activeServerId && <Check className="mt-1 h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
        {!servers.length && (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            No eKuiper node is configured.
          </div>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/nodes">
            <Plus className="mr-2 h-4 w-4" />
            Manage nodes
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
