# @ekuiper-manager/flow-sdk (FS-0119, FS-0120)

Public-safe declarative Flow node definition subset for authoring eKuiper
Manager extension descriptors. **Types and data constants only.**

## What this package is

The canonical source for the data shapes an extension author needs to write
a declarative node descriptor:

- node identity (`type`, `version`) and display metadata (`displayName`,
  `description`);
- `category` (`source` | `transform` | `streaming` | `routing` | `sink`);
- `inputs` / `outputs` ports (`FlowPortDefinition`, `FlowPortKind`);
- `properties` (`FlowPropertyDefinition`, including `typeOptions`,
  `showWhen`, and named `optionsProvider` ids);
- canvas presentation tokens (`icon`, `accent`, `subtitleKey`, with
  `FLOW_NODE_ICON_TOKENS` / `FLOW_NODE_ACCENT_TOKENS`);
- the declarative eKuiper runtime mapping (`FlowEkuiperRuntimeMapping`:
  `kind` / `nodeType` plus a direct `configKey -> propsKey` allowlist, with
  `FLOW_EKUIPER_RUNTIME_MAPPING_KEYS`).

The Manager app re-exports these names from
`src/lib/flows/registry/node-definition.ts`, so there is exactly one
`FlowNodeDefinition` contract and no divergent duplicate. The app's
`FlowNodeDefinition` extends the SDK type with the internal-only
`runtimeKind` / `operation` fields, which are intentionally absent here.

## What this package is not

- No validation (manifest/descriptor/mapping validation lives in the
  Manager app: `src/lib/flows/extensions/validate-extension.ts` and
  `validateFlowEkuiperRuntimeMapping` in
  `src/lib/flows/registry/node-definition.ts`).
- No compiler, no editor implementation, no React.
- No filesystem access, no network access.
- No validation CLI. A future `validate` command for extension packages is
  a **roadmap idea only** (see `docs/FLOW_EXTENSIONS.md`); it is not
  implemented in this ticket, so do not treat it as available.
- Not published (FS-0119). It is consumed via npm workspaces by the Manager
  app in this repository.

## Usage

This repository uses npm workspaces (`"workspaces": ["packages/*"]` in the
root `package.json`), so the Manager app imports the SDK directly:

```ts
import type {
  FlowEkuiperRuntimeMapping,
  FlowNodeDefinition,
} from '@ekuiper-manager/flow-sdk';
import { FLOW_NODE_ICON_TOKENS } from '@ekuiper-manager/flow-sdk';
```

Node descriptors stay plain JSON: every exported shape is
JSON-serialisable. Never put functions, expressions, templates, component
hooks, or executable asset references into a descriptor; the Manager
validators reject them with structured diagnostics and never execute them.

## Author guide

To write an extension package (directory layout, `extension.json` manifest
reference, descriptor reference, security limitations, size caps, and a
worked example that matches the validated test fixture exactly), read:

- `docs/FLOW_EXTENSIONS.md`

Security summary: declarative extensions may not ship arbitrary React,
arbitrary JavaScript execution, shell commands, npm installs into Manager,
remote scripts/styles, iframes, plaintext secrets, or arbitrary eKuiper
target URLs.
