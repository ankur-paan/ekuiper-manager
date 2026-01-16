"use client";

import * as React from "react";
import Link from "next/link";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, Workflow } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { navigationGroups } from "./sidebar";

export function MobileNav() {
    const [open, setOpen] = React.useState(false);

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">Toggle Menu</span>
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72">
                <div className="flex flex-col h-full bg-background">
                    <div className="h-14 flex items-center border-b px-4 gap-2">
                        <Workflow className="h-6 w-6 text-primary" />
                        <span className="font-semibold">eKuiper Manager</span>
                    </div>
                    <ScrollArea className="flex-1 py-2">
                        {navigationGroups.map(group => (
                            <div key={group.title} className="px-2 py-2">
                                <h4 className="mb-1 rounded-md px-2 py-1 text-sm font-semibold text-muted-foreground flex items-center gap-2">
                                    <group.icon className="h-4 w-4" />
                                    {group.title}
                                </h4>
                                <div className="space-y-1">
                                    {group.items.map(item => (
                                        <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
                                            <Button variant="ghost" className="w-full justify-start gap-2 h-9">
                                                <item.icon className="h-4 w-4" />
                                                {item.title}
                                            </Button>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </ScrollArea>
                </div>
            </SheetContent>
        </Sheet>
    );
}
