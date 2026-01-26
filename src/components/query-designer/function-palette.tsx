"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FUNCTION_CATEGORIES, type EKuiperFunction } from "@/lib/ekuiper/functions";

export function FunctionPalette({
    onInsert,
}: {
    onInsert: (fn: EKuiperFunction) => void;
}) {
    const [activeTab, setActiveTab] = React.useState(FUNCTION_CATEGORIES[0]?.id ?? "aggregate");
    const [search, setSearch] = React.useState("");

    const categories = FUNCTION_CATEGORIES.filter((c) =>
        c.functions.some((fn) =>
            fn.name.toLowerCase().includes(search.toLowerCase()) ||
            fn.description.toLowerCase().includes(search.toLowerCase())
        )
    );

    return (
        <div className="space-y-4">
            <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search functions..."
                className="h-8"
            />
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <ScrollArea className="w-full whitespace-nowrap pb-2">
                    <TabsList className="bg-transparent p-0 gap-1 inline-flex">
                        {(search ? categories : FUNCTION_CATEGORIES).map((cat) => (
                            <TabsTrigger key={cat.id} value={cat.id} className="text-xs h-7 px-2 data-[state=active]:bg-primary/10">
                                {cat.name}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </ScrollArea>

                <ScrollArea className="h-[220px]">
                    {(search ? categories : FUNCTION_CATEGORIES).map((cat) => (
                        <TabsContent key={cat.id} value={cat.id} className="mt-0">
                            <div className="grid gap-1">
                                {cat.functions
                                    .filter((fn) =>
                                        fn.name.toLowerCase().includes(search.toLowerCase()) ||
                                        fn.description.toLowerCase().includes(search.toLowerCase())
                                    )
                                    .map((fn) => (
                                        <Button
                                            key={fn.name}
                                            variant="ghost"
                                            className="justify-start px-2 py-1 h-auto w-full"
                                            onClick={() => onInsert(fn)}
                                        >
                                            <div className="flex flex-col items-start w-full overflow-hidden">
                                                <div className="flex items-center justify-between w-full">
                                                    <span className="font-mono text-xs font-semibold text-primary">{fn.name}</span>
                                                    {fn.returnType && (
                                                        <span className="text-[10px] text-muted-foreground opacity-50 ml-1 shrink-0">
                                                            {fn.returnType}
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-[10px] text-muted-foreground truncate w-full text-left opacity-80" title={fn.description}>
                                                    {fn.description}
                                                </span>
                                            </div>
                                        </Button>
                                    ))}
                            </div>
                        </TabsContent>
                    ))}
                </ScrollArea>
            </Tabs>
        </div>
    );
}
