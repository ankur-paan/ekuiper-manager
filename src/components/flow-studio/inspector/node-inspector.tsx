"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { createBuiltinNodeRegistry } from "@/lib/flows/registry/builtin-registry";
import { useFlowEditorStore } from "@/stores/flow-editor-store";
import { PropertyField } from "./property-field";

export interface NodeInspectorProps {
  selectedNodeId?: string | null;
  children?: React.ReactNode;
  className?: string;
}

/**
 * Shared built-in definition source for the inspector.
 *
 * The registry clones definitions on retrieval, so one module-level
 * instance is safe to share across renders without leaking mutable state.
 */
const builtinRegistry = createBuiltinNodeRegistry();

export function NodeInspector({
  selectedNodeId,
  children,
  className,
}: NodeInspectorProps) {
  const document = useFlowEditorStore((state) => state.document);
  const storeSelectedNodeIds = useFlowEditorStore((state) => state.selectedNodeIds);
  const updateNodeConfig = useFlowEditorStore((state) => state.updateNodeConfig);

  // Prop-driven when provided; otherwise mirror the canvas selection
  // (FS-0045) so the inspector follows the selected node.
  const effectiveNodeId = selectedNodeId ?? storeSelectedNodeIds[0] ?? null;

  const selectedNode = React.useMemo(() => {
    if (!document || !effectiveNodeId) return null;
    return document.spec.nodes.find((node) => node.id === effectiveNodeId) ?? null;
  }, [document, effectiveNodeId]);

  const definition = React.useMemo(() => {
    if (!selectedNode) return null;
    return builtinRegistry.get(selectedNode.type, selectedNode.typeVersion) ?? null;
  }, [selectedNode]);

  let body: React.ReactNode;
  if (children !== undefined) {
    body = children;
  } else if (!effectiveNodeId) {
    body = (
      <p className="text-xs text-muted-foreground">
        Select a node to inspect.
      </p>
    );
  } else if (!selectedNode) {
    body = (
      <p className="text-xs text-muted-foreground">
        Selected node is no longer in the document.
      </p>
    );
  } else if (!definition) {
    body = (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">{selectedNode.name || "Unnamed node"}</p>
        <p className="text-xs text-muted-foreground" data-testid="node-inspector-unsupported">
          {`Unknown node type "${selectedNode.type}@${selectedNode.typeVersion}". Configuration editing is unavailable. The saved node is preserved.`}
        </p>
      </div>
    );
  } else {
    body = (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">{selectedNode.name || definition.displayName}</p>
          <p className="text-xs text-muted-foreground">
            {definition.displayName} · {definition.type}@v{definition.version}
          </p>
          {definition.description ? (
            <p className="text-xs text-muted-foreground">{definition.description}</p>
          ) : null}
        </div>
        {definition.properties.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            This node has no configurable properties.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {definition.properties.map((property) => (
              <PropertyField
                key={property.key}
                definition={property}
                // Pass the raw config value through untouched so false/0
                // survive; absent keys arrive as undefined.
                value={selectedNode.config[property.key]}
                onChange={(next) => {
                  updateNodeConfig(selectedNode.id, { [property.key]: next });
                }}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <section
      aria-label="Node inspector panel"
      className={cn("flex h-full min-h-0 flex-col", className)}
      data-testid="node-inspector"
    >
      <div className="shrink-0 border-b px-4 py-3">
        <h2 className="text-sm font-semibold leading-tight">Inspector</h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{body}</div>
    </section>
  );
}
