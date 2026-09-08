import type { FlowNodeDefinition } from '../node-definition';

/**
 * Function transform editor-semantic definition (v1).
 *
 * Audited repository metadata:
 * - `src/lib/ekuiper/formatters.ts` OP_TYPE_MAP confirms the eKuiper graph
 *   operator name `func` (displayed as Function), with the `op_func_*`
 *   node-id prefix handled by the shared `op_` operator parsing.
 * - `src/lib/ekuiper/functions.ts` confirms the eKuiper SQL function catalog
 *   concept used inside function expressions.
 * - `src/lib/ekuiper/types.ts` JSUDF confirms a script concept (`script`)
 *   exists for managed JavaScript UDFs, but the exact eKuiper graph `func`
 *   node property shape was not confirmed in the audited metadata.
 *
 * The Flow node keeps the engine-semantic type name `func` (not Node-RED
 * `function` terminology) and exposes only the confirmed editor-semantic
 * `expression` property. The value is stored as opaque text: it is never
 * parsed and never executed in Manager or the browser. Compiler mapping
 * (`runtimeKind`/`operation`) is intentionally omitted and lands in a later
 * compiler ticket. No compiler code and no code execution live here, and
 * Monaco is intentionally not loaded for this property yet.
 */
export const funcDefinition: FlowNodeDefinition = {
  type: 'func',
  version: 1,
  displayName: 'Function',
  description: 'Compute output fields with a function expression.',
  category: 'transform',
  icon: 'function',
  accent: 'transform',
  subtitleKey: 'expression',
  inputs: [{ id: 'in', label: 'Stream', kind: 'stream' }],
  outputs: [{ id: 'out', label: 'Stream', kind: 'stream' }],
  properties: [
    {
      key: 'expression',
      // AC-D002: "Expression" invited arithmetic such as `temperature * 9 / 5 + 32`, which
      // eKuiper rejects at deploy time - the function operator parses `expr` as one ast.Call.
      label: 'Function call',
      type: 'expression',
      required: true,
      description:
        'One function call evaluated per event, for example round(temperature) or upper(device). eKuiper accepts a single function call here, not arithmetic or a list. Stored as opaque text and never executed in Manager.',
    },
  ],
};
