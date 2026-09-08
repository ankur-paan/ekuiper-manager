"use client";

import * as React from "react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export interface FlowCommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * FS-0127: availability flags mirror the underlying actions. A command is
   * disabled whenever its action is currently unavailable (e.g. Deploy while
   * the draft has unsaved edits or client errors, panel commands before the
   * canvas has loaded).
   */
  canAddNode: boolean;
  onAddNode: () => void;
  canDeploy: boolean;
  onDeploy: () => void;
  panelsAvailable: boolean;
  onShowValidation: () => void;
  onShowDefinition: () => void;
  onShowTestOutput: () => void;
  historyOpen: boolean;
  onToggleHistory: () => void;
  canFitView: boolean;
  onFitView: () => void;
  className?: string;
}

/**
 * FS-0127: command palette for existing Flow Studio actions only.
 *
 * Commands delegate to the same handlers as the visible UI (palette picker,
 * Deploy dialog, bottom-panel tabs, history toggle, canvas fit-view
 * control), so no action is invented here. Node search/add reuses the
 * existing QuickNodePicker catalog via `onAddNode`; this palette lists
 * command rows only and takes no node definitions, so there is no duplicate
 * node catalog source.
 *
 * Opened with Cmd/Ctrl+K (wired by the caller); Escape closes via the
 * underlying dialog.
 */
export function FlowCommandPalette({
  open,
  onOpenChange,
  canAddNode,
  onAddNode,
  canDeploy,
  onDeploy,
  panelsAvailable,
  onShowValidation,
  onShowDefinition,
  onShowTestOutput,
  historyOpen,
  onToggleHistory,
  canFitView,
  onFitView,
}: FlowCommandPaletteProps) {
  const run = React.useCallback(
    (command: () => void) => {
      onOpenChange(false);
      command();
    },
    [onOpenChange],
  );

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Type a command…"
        aria-label="Flow command palette"
        data-testid="flow-command-palette-input"
      />
      <CommandList aria-label="Flow commands">
        <CommandEmpty>No commands found.</CommandEmpty>
        <CommandGroup heading="Flow">
          <CommandItem
            disabled={!canAddNode}
            onSelect={() => run(onAddNode)}
            data-testid="flow-command-add-node"
          >
            <span>Add node…</span>
          </CommandItem>
          <CommandItem
            disabled={!canDeploy}
            onSelect={() => run(onDeploy)}
            data-testid="flow-command-deploy"
          >
            <span>Deploy flow</span>
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Panels">
          <CommandItem
            disabled={!panelsAvailable}
            onSelect={() => run(onShowValidation)}
            data-testid="flow-command-show-validation"
          >
            <span>Show validation panel</span>
          </CommandItem>
          <CommandItem
            disabled={!panelsAvailable}
            onSelect={() => run(onShowDefinition)}
            data-testid="flow-command-show-definition"
          >
            <span>Show definition panel</span>
          </CommandItem>
          <CommandItem
            disabled={!panelsAvailable}
            onSelect={() => run(onShowTestOutput)}
            data-testid="flow-command-show-test-output"
          >
            <span>Show test output panel</span>
          </CommandItem>
          <CommandItem
            disabled={!panelsAvailable}
            onSelect={() => run(onToggleHistory)}
            data-testid="flow-command-toggle-history"
          >
            <span>{historyOpen ? "Hide history" : "Show history"}</span>
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="View">
          <CommandItem
            disabled={!canFitView}
            onSelect={() => run(onFitView)}
            data-testid="flow-command-fit-view"
          >
            <span>Fit view</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
