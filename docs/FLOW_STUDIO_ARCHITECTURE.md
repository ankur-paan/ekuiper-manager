# Flow Studio Architecture Guardrails

This document records the locked architecture boundaries for Flow Studio.
It is a guardrail summary derived from the Flow Studio build pack, which is maintained
outside this repository. Normative details live in those specs; this file states what
must not be violated.

## 1. Control-plane / data-plane separation

- Manager is control plane only; it is never part of normal production message processing.
- Allowed: `Browser -> Manager API -> eKuiper management API`.
- Allowed for bounded diagnostics: `eKuiper test/metrics API -> Manager -> Browser`.
- Forbidden: `device event -> Manager -> transformation -> eKuiper/sink`.
- Manager persists drafts/revisions/deployments, validates, compiles, calls eKuiper
  management APIs, and exposes bounded diagnostics. eKuiper owns ingestion,
  stream processing, windows/aggregates/joins, state, and sink delivery.
- Production processing overhead from Manager is zero.

## 2. One Flow = one graph rule

- The initial Flow runtime target is eKuiper Graph Rules.
- The initial mapping is one Flow = one eKuiper Graph Rule.
- Layout is never sent to eKuiper; only the semantic Flow Document compiles.
- If eKuiper cannot execute a node and no approved eKuiper plugin/extension
  provides execution, the node is marked unsupported. Manager does not
  execute it as a workaround.

## 3. Semantic / layout separation

- Flow semantic state (nodes, edges, config) and visual layout state
  (coordinates, viewport) are separate.
- Semantic and layout hashes are computed and stored separately.
- Moving a node is a layout-only edit and must not mark runtime as needing deployment.
- Changing node behavior/configuration is a semantic edit and does mark runtime
  as needing deployment.
- Runtime metrics/debug state is separate from the Flow document/editor state
  and must never be stored inside semantic Flow Node objects.

## 4. Declarative extensions

- Built-in nodes and future third-party nodes use the same Node Definition contract
  (identity, ports, properties, capabilities, docs/icon metadata, runtime mapping).
- Declarative extensions are the default; advanced compiler hooks are deferred
  until the declarative model is proven insufficient.
- Third-party arbitrary React injection into the editor is not supported.
- Third-party arbitrary JavaScript execution inside Manager is not supported.
- Extension packages must not execute shell commands, install npm dependencies,
  load remote scripts/styles, embed iframes, receive plaintext secrets,
  or choose arbitrary eKuiper target URLs.

## 5. No custom Manager runtime

- There is no custom Manager workflow runtime, no WASM runtime execution,
  and no arbitrary plugin JavaScript execution.
- Manager never becomes a production event processor; execution belongs to eKuiper.
- Compiler output must be deterministic for the same Flow document plus target
  capabilities plus extension versions (no random IDs or timestamps at compile time).
- Stable Flow node IDs are immutable UUID-like identifiers; runtime operator IDs
  are deterministic compiler output mapped back to Flow node IDs.

## 6. Layering and state ownership

- Logical layering: Flow UI -> Flow Document -> normalization/validation ->
  Flow IR -> target adapter -> eKuiper Graph Rule deployment artifact.
- Forbidden coupling: UI importing raw PostgreSQL helpers, compiler importing React,
  model importing the eKuiper HTTP client, or database records becoming the
  canonical in-memory Flow type.
- TanStack Query owns server state; Zustand/editor state owns unsaved editor/canvas
  state; runtime metrics/debug state is separate. Autosave is not deployment.
- Initial implementation stays in current app paths; no monorepo rewrite and no
  public SDK/package extraction until built-ins dogfood the internal contract.

## Changes require owner ADR

- These boundaries are locked. Implementation tickets may not change them.
- Any change requires a human-owner architecture decision record (ADR) issued
  outside the ticket flow, plus updates to the build pack specs first.
- If a ticket appears to require violating a boundary, stop and report instead
  of guessing or self-authorizing a larger change.
