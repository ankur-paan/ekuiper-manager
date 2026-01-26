"use client";

import * as React from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Radio, Eye } from "lucide-react";

export function ResourceList({
    title,
    icon: Icon,
    items,
    emptyLabel,
    onSelect,
    onPreview,
    onDragStart,
}: {
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    items: { name: string; desc?: string }[];
    emptyLabel: string;
    onSelect: (name: string) => void;
    onPreview?: (name: string) => void;
    onDragStart?: (e: React.DragEvent, name: string) => void;
}) {
    const [search, setSearch] = React.useState("");
    const filtered = React.useMemo(
        () =>
            search
                ? items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
                : items,
        [items, search]
    );

    return (
        <Card className="h-full border-none shadow-none bg-transparent flex flex-col">
            <CardHeader className="pb-3 px-0 pt-0 shrink-0">
                <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={`Filter ${title.toLowerCase()}...`}
                    className="h-8 text-xs"
                />
            </CardHeader>
            <ScrollArea className="flex-1">
                {filtered.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-2">{emptyLabel}</p>
                ) : (
                    <div className="space-y-1">
                        {filtered.map((item) => (
                            <div
                                key={item.name}
                                className="group flex items-center justify-between rounded-md hover:bg-muted/50 pr-2 cursor-grab active:cursor-grabbing"
                                draggable={!!onDragStart}
                                onDragStart={(e) => onDragStart && onDragStart(e, item.name)}
                            >
                                <Button
                                    variant="ghost"
                                    className="h-7 justify-start text-left flex-1 font-mono text-xs pointer-events-none" // pointer-events-none ensures drag works on container? No, that breaks click.
                                    // Actually, keep click for select. Dragging usually works if target is draggable. 
                                    // Let's NOT make button pointer-events-none, but dragging might need to be initiated carefully.
                                    // If we drag the div, it should work.
                                    onClick={(e) => {
                                        e.stopPropagation(); // Prevent drag if needed? No.
                                        onSelect(item.name);
                                    }}
                                >
                                    <Icon className="h-3 w-3 mr-2 text-muted-foreground" />
                                    <span className="truncate" title={item.name}>{item.name}</span>
                                </Button>
                                {onPreview && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 opacity-0 group-hover:opacity-100"
                                        onClick={(e) => { e.stopPropagation(); onPreview(item.name); }}
                                        title="Inspect Data"
                                    >
                                        <Eye className="h-3 w-3" />
                                    </Button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </ScrollArea>
        </Card>
    );
}
