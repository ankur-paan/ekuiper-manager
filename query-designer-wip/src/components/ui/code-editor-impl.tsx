"use client";

import * as React from "react";
import Editor, { OnMount } from "@monaco-editor/react";

interface CodeEditorProps {
    value: string;
    onChange?: (value: string) => void;
    language?: string;
    readOnly?: boolean;
}

export function CodeEditorImpl({ value, onChange, language = "javascript", readOnly = false }: CodeEditorProps) {
    const handleEditorChange = (value: string | undefined) => {
        onChange?.(value || "");
    };

    const handleEditorDidMount: OnMount = (editor, monaco) => {
        // Disable diagnostics for json/javascript/typescript to avoid validation errors in snippets
        monaco.languages.json.jsonDefaults.setDiagnosticsOptions({ validate: false });
        monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({ noSemanticValidation: true, noSyntaxValidation: true });
        monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({ noSemanticValidation: true, noSyntaxValidation: true });
    };

    return (
        <div className="h-full min-h-[400px] w-full border rounded-md overflow-hidden bg-[#1e1e1e]">
            <Editor
                height="100%"
                defaultLanguage={language}
                language={language}
                value={value}
                onChange={handleEditorChange}
                onMount={handleEditorDidMount}
                theme="vs-dark"
                options={{
                    readOnly,
                    minimap: { enabled: false },
                    automaticLayout: true,
                    scrollBeyondLastLine: false,
                    fontSize: 14,
                    padding: { top: 16 },
                    quickSuggestions: false,
                    renderValidationDecorations: "off",
                    hover: { enabled: false },
                }}
            />
        </div>
    );
}
