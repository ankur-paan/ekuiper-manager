"use client";

import { useRef, useEffect } from "react";
import Editor, { OnMount, BeforeMount } from "@monaco-editor/react";
import type { editor, languages, IDisposable } from "monaco-editor";
import {
  EKUIPER_KEYWORDS,
  EKUIPER_DATA_TYPES,
  EKUIPER_STREAM_OPTIONS,
  ALL_EKUIPER_FUNCTIONS,
  EKUIPER_WINDOW_FUNCTIONS,
} from "@/lib/ekuiper/language";

interface SQLEditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: string | number;
  readOnly?: boolean;
  onValidate?: (markers: editor.IMarkerData[]) => void;
  placeholder?: string;
}

export function SQLEditor({
  value,
  onChange,
  height = "300px",
  readOnly = false,
  onValidate,
  placeholder = "-- Enter your eKuiper SQL query here\nSELECT * FROM stream_name",
}: SQLEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import("monaco-editor") | null>(null);
  const disposablesRef = useRef<IDisposable[]>([]);

  const handleEditorWillMount: BeforeMount = (monaco) => {
    // Register eKuiper SQL language
    monaco.languages.register({ id: "ekuiper-sql" });

    // Define syntax highlighting
    monaco.languages.setMonarchTokensProvider("ekuiper-sql", {
      defaultToken: "",
      tokenPostfix: ".sql",
      ignoreCase: true,

      keywords: EKUIPER_KEYWORDS,
      typeKeywords: EKUIPER_DATA_TYPES,
      streamOptions: EKUIPER_STREAM_OPTIONS,
      
      functions: ALL_EKUIPER_FUNCTIONS.map((f) => f.name),
      windowFunctions: EKUIPER_WINDOW_FUNCTIONS.map((f) => f.name),

      operators: [
        "=", ">", "<", "!", "~", "?", ":", "==", "<=", ">=", "!=",
        "&&", "||", "++", "--", "+", "-", "*", "/", "&", "|", "^", "%",
        "<<", ">>", ">>>", "+=", "-=", "*=", "/=", "&=", "|=", "^=",
        "%=", "<<=", ">>=", ">>>="
      ],

      symbols: /[=><!~?:&|+\-*\/\^%]+/,
      escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,

      tokenizer: {
        root: [
          // Comments
          [/--.*$/, "comment"],
          [/\/\*/, "comment", "@comment"],

          // Whitespace
          { include: "@whitespace" },

          // Strings
          [/"([^"\\]|\\.)*$/, "string.invalid"],
          [/'([^'\\]|\\.)*$/, "string.invalid"],
          [/"/, "string", "@string_double"],
          [/'/, "string", "@string_single"],

          // Numbers
          [/\d*\.\d+([eE][\-+]?\d+)?/, "number.float"],
          [/\d+/, "number"],

          // Keywords and identifiers
          [/[a-zA-Z_]\w*/, {
            cases: {
              "@keywords": "keyword",
              "@typeKeywords": "type",
              "@streamOptions": "type.identifier",
              "@functions": "function",
              "@windowFunctions": "function.window",
              "@default": "identifier"
            }
          }],

          // Operators
          [/@symbols/, {
            cases: {
              "@operators": "operator",
              "@default": ""
            }
          }],

          // Delimiters
          [/[{}()\[\]]/, "@brackets"],
          [/[;,.]/, "delimiter"],
        ],

        comment: [
          [/[^\/*]+/, "comment"],
          [/\*\//, "comment", "@pop"],
          [/[\/*]/, "comment"]
        ],

        whitespace: [
          [/[ \t\r\n]+/, "white"]
        ],

        string_double: [
          [/[^\\"]+/, "string"],
          [/@escapes/, "string.escape"],
          [/\\./, "string.escape.invalid"],
          [/"/, "string", "@pop"]
        ],

        string_single: [
          [/[^\\']+/, "string"],
          [/@escapes/, "string.escape"],
          [/\\./, "string.escape.invalid"],
          [/'/, "string", "@pop"]
        ],
      },
    });

    // Define theme
    monaco.editor.defineTheme("ekuiper-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "keyword", foreground: "569CD6", fontStyle: "bold" },
        { token: "type", foreground: "4EC9B0" },
        { token: "type.identifier", foreground: "9CDCFE" },
        { token: "function", foreground: "DCDCAA" },
        { token: "function.window", foreground: "C586C0" },
        { token: "string", foreground: "CE9178" },
        { token: "number", foreground: "B5CEA8" },
        { token: "comment", foreground: "6A9955" },
        { token: "operator", foreground: "D4D4D4" },
        { token: "identifier", foreground: "9CDCFE" },
      ],
      colors: {
        "editor.background": "#0d1117",
        "editor.foreground": "#c9d1d9",
        "editor.lineHighlightBackground": "#161b22",
        "editorLineNumber.foreground": "#484f58",
        "editorCursor.foreground": "#58a6ff",
        "editor.selectionBackground": "#264f78",
      },
    });
  };

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Register completion provider
    const completionDisposable = monaco.languages.registerCompletionItemProvider("ekuiper-sql", {
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        const suggestions: languages.CompletionItem[] = [];

        // Add keywords
        EKUIPER_KEYWORDS.forEach((keyword) => {
          suggestions.push({
            label: keyword,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: keyword,
            range,
          });
        });

        // Add data types
        EKUIPER_DATA_TYPES.forEach((type) => {
          suggestions.push({
            label: type,
            kind: monaco.languages.CompletionItemKind.TypeParameter,
            insertText: type,
            range,
          });
        });

        // Add stream options
        EKUIPER_STREAM_OPTIONS.forEach((opt) => {
          suggestions.push({
            label: opt,
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: `${opt} = `,
            range,
          });
        });

        // Add functions with documentation
        ALL_EKUIPER_FUNCTIONS.forEach((func) => {
          suggestions.push({
            label: func.name,
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: func.name + "(${1})",
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: {
              value: `**${func.signature}**\n\n${func.description}`,
            },
            range,
          });
        });

        // Add window functions with documentation
        EKUIPER_WINDOW_FUNCTIONS.forEach((func) => {
          suggestions.push({
            label: func.name,
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: func.name + "(${1})",
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: {
              value: `**${func.signature}**\n\n${func.description}\n\nExample: \`${func.example}\``,
            },
            range,
          });
        });

        return { suggestions };
      },
    });

    disposablesRef.current.push(completionDisposable);

    // Register hover provider
    const hoverDisposable = monaco.languages.registerHoverProvider("ekuiper-sql", {
      provideHover: (model, position) => {
        const word = model.getWordAtPosition(position);
        if (!word) return null;

        const funcName = word.word.toLowerCase();
        
        // Check functions
        const func = ALL_EKUIPER_FUNCTIONS.find(
          (f) => f.name.toLowerCase() === funcName
        );
        if (func) {
          return {
            contents: [
              { value: `**${func.signature}**` },
              { value: func.description },
            ],
          };
        }

        // Check window functions
        const windowFunc = EKUIPER_WINDOW_FUNCTIONS.find(
          (f) => f.name.toLowerCase() === funcName
        );
        if (windowFunc) {
          return {
            contents: [
              { value: `**${windowFunc.signature}**` },
              { value: windowFunc.description },
              { value: `Example: \`${windowFunc.example}\`` },
            ],
          };
        }

        return null;
      },
    });

    disposablesRef.current.push(hoverDisposable);

    // Handle validation
    if (onValidate) {
      const modelDisposable = editor.onDidChangeModelContent(() => {
        const model = editor.getModel();
        if (model) {
          const markers = monaco.editor.getModelMarkers({ resource: model.uri });
          onValidate(markers);
        }
      });
      disposablesRef.current.push(modelDisposable);
    }
  };

  useEffect(() => {
    return () => {
      disposablesRef.current.forEach((d) => d.dispose());
    };
  }, []);

  return (
    <div className="relative rounded-lg overflow-hidden border border-border">
      <Editor
        height={height}
        language="ekuiper-sql"
        theme="ekuiper-dark"
        value={value || ""}
        onChange={(v) => onChange(v || "")}
        beforeMount={handleEditorWillMount}
        onMount={handleEditorDidMount}
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
          cursorBlinking: "smooth",
          cursorSmoothCaretAnimation: "on",
          smoothScrolling: true,
          padding: { top: 16, bottom: 16 },
          suggest: {
            showKeywords: true,
            showFunctions: true,
            showSnippets: true,
          },
        }}
      />
      {!value && (
        <div className="absolute top-4 left-14 text-muted-foreground pointer-events-none opacity-50 font-mono text-sm whitespace-pre">
          {placeholder}
        </div>
      )}
    </div>
  );
}
