"use client";

import { useState } from "react";
import Editor from "@monaco-editor/react";

interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: string | number;
  readOnly?: boolean;
  schema?: object;
}

export function JsonEditor({
  value,
  onChange,
  height = "300px",
  readOnly = false,
}: JsonEditorProps) {
  const [isValid, setIsValid] = useState(true);

  const handleChange = (newValue: string | undefined) => {
    const val = newValue || "";
    onChange(val);
    
    try {
      if (val.trim()) {
        JSON.parse(val);
        setIsValid(true);
      } else {
        setIsValid(true);
      }
    } catch {
      setIsValid(false);
    }
  };

  return (
    <div className="relative rounded-lg overflow-hidden border border-border">
      <Editor
        height={height}
        language="json"
        theme="vs-dark"
        value={value}
        onChange={handleChange}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
          lineNumbers: "on",
          folding: true,
          automaticLayout: true,
          scrollBeyondLastLine: false,
          wordWrap: "on",
          readOnly,
          tabSize: 2,
          renderLineHighlight: "all",
          padding: { top: 16, bottom: 16 },
          formatOnPaste: true,
          formatOnType: true,
        }}
      />
      {!isValid && (
        <div className="absolute bottom-2 right-2 px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded">
          Invalid JSON
        </div>
      )}
    </div>
  );
}
