"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
    Calculator,
    Calendar,
    CreditCard,
    Settings,
    Smile,
    User,
    Database,
    Workflow,
    Server,
    Plug,
    FileJson,
    Upload,
} from "lucide-react";

import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
    CommandShortcut,
} from "@/components/ui/command";
import { ekuiperClient } from "@/lib/ekuiper/client";
import { useServerStore } from "@/stores/server-store";
import { toast } from "sonner";

interface SearchItem {
    id: string;
    title: string;
    type: "stream" | "table" | "rule" | "page" | "plugin";
    href: string;
}

export function UnifiedSearch() {
    const [open, setOpen] = React.useState(false);
    const router = useRouter();
    const { activeServerId, servers } = useServerStore();
    const activeServer = servers.find(s => s.id === activeServerId);

    const [items, setItems] = React.useState<SearchItem[]>([]);
    const [loading, setLoading] = React.useState(false);

    React.useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen((open) => !open);
            }
        };

        document.addEventListener("keydown", down);
        return () => document.removeEventListener("keydown", down);
    }, []);

    const fetchData = React.useCallback(async () => {
        if (!activeServer) return;
        setLoading(true);
        ekuiperClient.setBaseUrl(activeServer.url);

        const newItems: SearchItem[] = [];

        try {
            // Parallel fetch
            const [streams, tables, rules, plugins] = await Promise.allSettled([
                ekuiperClient.listStreams(),
                ekuiperClient.listTables(),
                ekuiperClient.listRules(),
                ekuiperClient.listPlugins("portable"), // Just one type for now or add native too
            ]);

            if (streams.status === "fulfilled") {
                streams.value.forEach(s => newItems.push({ id: `stream-${s.name}`, title: s.name, type: "stream", href: `/streams/${s.name}` }));
            }
            if (tables.status === "fulfilled") {
                tables.value.forEach(t => newItems.push({ id: `table-${t.name}`, title: t.name, type: "table", href: `/tables/${t.name}` }));
            }
            if (rules.status === "fulfilled") {
                rules.value.forEach(r => newItems.push({ id: `rule-${r.id}`, title: r.id, type: "rule", href: `/rules/${r.id}/topo` })); // Jump to topo
            }
            if (plugins.status === "fulfilled") {
                plugins.value.forEach(p => newItems.push({ id: `plugin-${p}`, title: p, type: "plugin", href: `/plugins` }));
            }

        } catch (err) {
            console.error("Search fetch error", err);
        } finally {
            setItems(newItems);
            setLoading(false);
        }
    }, [activeServer]);

    React.useEffect(() => {
        if (open) {
            fetchData();
        }
    }, [open, fetchData]);

    const runCommand = React.useCallback((command: () => unknown) => {
        setOpen(false);
        command();
    }, []);

    return (
        <>
            <p className="fixed bottom-0 left-0 right-0 hidden"></p>
            <CommandDialog open={open} onOpenChange={setOpen}>
                <CommandInput placeholder="Type a command or search..." />
                <CommandList>
                    <CommandEmpty>No results found.</CommandEmpty>

                    <CommandGroup heading="Suggestions">
                        <CommandItem onSelect={() => runCommand(() => router.push("/dashboard"))}>
                            <Server className="mr-2 h-4 w-4" />
                            <span>Dashboard</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => router.push("/streams"))}>
                            <Database className="mr-2 h-4 w-4" />
                            <span>Streams</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => router.push("/rules"))}>
                            <Workflow className="mr-2 h-4 w-4" />
                            <span>Rules</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => router.push("/data/import"))}>
                            <Upload className="mr-2 h-4 w-4" />
                            <span>Import Data</span>
                        </CommandItem>
                    </CommandGroup>

                    <CommandSeparator />

                    {/* Dynamic Groups */}
                    {items.filter(i => i.type === "rule").length > 0 && (
                        <CommandGroup heading="Rules">
                            {items.filter(i => i.type === "rule").slice(0, 5).map(item => (
                                <CommandItem key={item.id} onSelect={() => runCommand(() => router.push(item.href))}>
                                    <Workflow className="mr-2 h-4 w-4" />
                                    <span>{item.title}</span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    )}

                    {items.filter(i => i.type === "stream").length > 0 && (
                        <CommandGroup heading="Streams">
                            {items.filter(i => i.type === "stream").slice(0, 5).map(item => (
                                <CommandItem key={item.id} onSelect={() => runCommand(() => router.push(item.href))}>
                                    <Database className="mr-2 h-4 w-4" />
                                    <span>{item.title}</span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    )}

                    {items.filter(i => i.type === "table").length > 0 && (
                        <CommandGroup heading="Tables">
                            {items.filter(i => i.type === "table").slice(0, 5).map(item => (
                                <CommandItem key={item.id} onSelect={() => runCommand(() => router.push(item.href))}>
                                    <Database className="mr-2 h-4 w-4" />
                                    <span>{item.title}</span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    )}

                </CommandList>
            </CommandDialog>
        </>
    );
}
