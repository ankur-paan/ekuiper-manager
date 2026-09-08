"use client";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FlowDiagnostic } from "@/lib/flows/model/diagnostic";
import { useFlowEditorStore } from "@/stores/flow-editor-store";
import { NodeInspector } from "./node-inspector";

export interface NodeFocusDialogProps {
  open: boolean;
  nodeId: string | null;
  /**
   * FS-0129: pre-filtered diagnostics for the focused node, computed by
   * the page from the same editor pipeline as the side inspector.
   * Passed through untouched so config values and validation match the
   * side inspector exactly.
   */
  diagnostics?: FlowDiagnostic[];
  documentDiagnostics?: FlowDiagnostic[];
  onClose: () => void;
}

/**
 * FS-0129: focus mode for complex node editing.
 *
 * Double-clicking an existing canvas node opens this large dialog with
 * the same generic `NodeInspector` renderer (same property controls,
 * same diagnostics) — never a duplicate configuration implementation
 * and never a node-specific custom React path. The canvas stays mounted
 * behind the Radix portal overlay. Closing only flips local open state;
 * config edits are already committed to the editor store (and autosaved
 * by the existing FS-0047 hook), so close creates no extra save.
 */
export function NodeFocusDialog({
  open,
  nodeId,
  diagnostics,
  documentDiagnostics,
  onClose,
}: NodeFocusDialogProps) {
  const document = useFlowEditorStore((state) => state.document);
  const focusedName = React.useMemo(() => {
    if (!document || !nodeId) return null;
    return document.spec.nodes.find((node) => node.id === nodeId)?.name ?? null;
  }, [document, nodeId]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        className="max-h-[85vh] max-w-2xl overflow-y-auto"
        data-testid="flow-node-focus-dialog"
      >
        <DialogHeader>
          <DialogTitle data-testid="flow-node-focus-dialog-title">
            {focusedName ? `Edit node — ${focusedName}` : "Edit node"}
          </DialogTitle>
          <DialogDescription>
            Same editor as the side inspector. Changes save through the
            existing draft autosave; closing this dialog saves nothing extra.
          </DialogDescription>
        </DialogHeader>
        {nodeId ? (
          <NodeInspector
            selectedNodeId={nodeId}
            diagnostics={diagnostics}
            documentDiagnostics={documentDiagnostics}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
