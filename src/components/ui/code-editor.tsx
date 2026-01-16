"use client";

import dynamic from "next/dynamic";

export const CodeEditor = dynamic(
    () => import("./code-editor-impl").then((mod) => mod.CodeEditorImpl),
    {
        ssr: false,
        loading: () => (
            <div className="h-full min-h-[400px] w-full border rounded-md overflow-hidden bg-[#1e1e1e] flex items-center justify-center text-muted-foreground">
                Loading Editor...
            </div>
        ),
    }
);
