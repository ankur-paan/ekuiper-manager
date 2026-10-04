"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, Workflow } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { navigationGroups } from "./sidebar";

function isActive(pathname: string, href: string): boolean {
  if (pathname === '/rules/new') return href === '/rules/new';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileNav() {
    const [open, setOpen] = React.useState(false);
    const pathname = usePathname();

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden size-9" aria-expanded={open} aria-label="Toggle Menu">
                    <Menu className="size-5" aria-hidden="true" />
                    <span className="sr-only">Toggle Menu</span>
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72">
                <SheetTitle className="sr-only">Primary navigation</SheetTitle>
                <SheetDescription className="sr-only">Primary navigation links</SheetDescription>
                <div className="flex flex-col h-full bg-background">
                    <div className="h-14 flex items-center border-b px-4 gap-2">
                        <Workflow className="size-6 text-primary" aria-hidden="true" />
                        <span className="font-semibold">eKuiper Manager</span>
                    </div>
                    <ScrollArea className="flex-1 py-2">
                      <nav aria-label="Primary navigation">
                        {navigationGroups.map(group => (
                            <div key={group.title} className="px-2 py-2">
                                <h4 className="mb-1 rounded-md px-2 py-1 text-xs font-semibold text-muted-foreground flex items-center gap-2">
                                    <group.icon className="size-4" aria-hidden="true" />
                                    {group.title}
                                </h4>
                                <div className="flex flex-col gap-1">
                                    {group.items.map(item => {
                                        const current = isActive(pathname, item.href);
                                        return (
                                            <Link
                                                key={item.href}
                                                href={item.href}
                                                onClick={() => setOpen(false)}
                                                aria-current={current ? 'page' : undefined}
                                            >
                                                <Button
                                                    variant={current ? 'secondary' : 'ghost'}
                                                    className="w-full justify-start gap-3 h-10 px-3 text-sm font-medium touch-manipulation"
                                                >
                                                    <item.icon className="size-4 shrink-0" aria-hidden="true" />
                                                    {item.title}
                                                </Button>
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                      </nav>
                    </ScrollArea>
                </div>
            </SheetContent>
        </Sheet>
    );
}
