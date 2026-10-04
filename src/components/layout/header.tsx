'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, Moon, Settings, Sun, UserRound } from 'lucide-react';
import { ServerSelector } from './server-selector';
import { MobileNav } from './mobile-nav';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface HeaderProps {
  title?: string;
}

interface SessionUser {
  username: string;
  role: 'OWNER' | 'USER';
}

export function Header({ title }: HeaderProps) {
  const router = useRouter();
  const [isDark, setIsDark] = React.useState(true);
  const [user, setUser] = React.useState<SessionUser | null>(null);

  React.useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
    fetch('/api/auth/session', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => setUser(payload?.user ?? null));
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/welcome');
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-border/80 bg-background/80 backdrop-blur-md px-4">
      <div className="flex min-w-0 items-center gap-3">
        <MobileNav />
        <h1 className="truncate text-base font-semibold md:text-lg" title={title ?? 'eKuiper Manager'}>{title ?? 'eKuiper Manager'}</h1>
      </div>
      <div className="flex items-center gap-1.5">
        <ServerSelector />
        <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle colour theme">
          {isDark ? <Sun className="size-4" aria-hidden="true" /> : <Moon className="size-4" aria-hidden="true" />}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Account menu">
              <UserRound className="size-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <span className="block truncate" title={user?.username ?? 'Account'}>{user?.username ?? 'Account'}</span>
              {user && (
                <span className="text-xs font-normal text-muted-foreground">
                  {user.role === 'OWNER' ? 'Owner' : 'User'}
                </span>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <Settings className="mr-2 size-4" aria-hidden="true" /> Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={logout}>
                <LogOut className="mr-2 size-4" aria-hidden="true" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
