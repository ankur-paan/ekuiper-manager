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

    // Use refs to avoid stale closures
    const onChangeRef = React.useRef(onChange);
    const valueRef = React.useRef(value);
    const languageRef = React.useRef(language);
    const readOnlyRef = React.useRef(readOnly);

    React.useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    React.useEffect(() => {
        valueRef.current = value;
    }, [value]);

    React.useEffect(() => {
        languageRef.current = language;
    }, [language]);

    React.useEffect(() => {
        readOnlyRef.current = readOnly;
    }, [readOnly]);

    React.useEffect(() => {
        let editor: monaco.editor.IStandaloneCodeEditor | null = null;

        if (containerRef.current) {
            // Check if editor already exists
            if (editorRef.current) {
                return;
            }

            editor = monaco.editor.create(containerRef.current, {
                value: valueRef.current,
                language: languageRef.current,
                theme: "vs-dark",
                readOnly: readOnlyRef.current,
                minimap: { enabled: false },
                automaticLayout: true,
                scrollBeyondLastLine: false,
                fontSize: 14,
                padding: { top: 16 },
            });

            editorRef.current = editor;

            editor.onDidChangeModelContent(() => {
                onChangeRef.current?.(editor!.getValue());
            });
        }

        return () => {
            editor?.dispose();
            editorRef.current = null;
        };
    }, []); // Only mount once - props are handled via refs

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

    // Update readOnly option
    React.useEffect(() => {
        if (editorRef.current) {
            editorRef.current.updateOptions({ readOnly: readOnlyRef.current });
        }
    }, [readOnly]);

    return <div ref={containerRef} className="h-full min-h-[400px] w-full border rounded-md overflow-hidden bg-[#1e1e1e]" />;
}
