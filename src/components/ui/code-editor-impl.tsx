"use client";

import * as React from "react";
import * as monaco from "monaco-editor";

interface CodeEditorProps {
    value: string;
    onChange?: (value: string) => void;
    language?: string;
    readOnly?: boolean;
}

export function CodeEditorImpl({ value, onChange, language = "javascript", readOnly = false }: CodeEditorProps) {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const editorRef = React.useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

    const onChangeRef = React.useRef(onChange);
    React.useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    React.useEffect(() => {
        let editor: monaco.editor.IStandaloneCodeEditor | null = null;

        if (containerRef.current) {
            // Check if editor already exists
            if (editorRef.current) {
                return;
            }

            editor = monaco.editor.create(containerRef.current, {
                value,
                language,
                theme: "vs-dark",
                readOnly,
                minimap: { enabled: false },
                automaticLayout: true,
                scrollBeyondLastLine: false,
                fontSize: 14,
                padding: { top: 16 },
                // Disable workers to prevent "Unexpected usage" errors in Next.js/Turbopack
                quickSuggestions: false,
                renderValidationDecorations: "off",
                hover: { enabled: false },
            });

            // Disable diagnostics for json/javascript/typescript
            monaco.languages.json.jsonDefaults.setDiagnosticsOptions({ validate: false });
            monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({ noSemanticValidation: true, noSyntaxValidation: true });
            monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({ noSemanticValidation: true, noSyntaxValidation: true });

            editorRef.current = editor;

            editor.onDidChangeModelContent(() => {
                onChangeRef.current?.(editor!.getValue());
            });
        }

        return () => {
            editor?.dispose();
            editorRef.current = null;
        };
    }, []); // Only mount once - value, language, readOnly are handled by other effects

    // Update value if changed externally
    React.useEffect(() => {
        if (editorRef.current) {
            const currentValue = editorRef.current.getValue();
            if (currentValue !== value) {
                editorRef.current.setValue(value);
            }
        }
    }, [value]);

    // Update language
    React.useEffect(() => {
        if (editorRef.current) {
            const model = editorRef.current.getModel();
            if (model) {
                monaco.editor.setModelLanguage(model, language);
            }
        }
    }, [language]);

    return <div ref={containerRef} className="h-full min-h-[400px] w-full border rounded-md overflow-hidden bg-[#1e1e1e]" />;
}
