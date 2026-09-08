import type { FlowDiagnostic } from '../model/diagnostic';
import { FLOW_EXPRESSION_NOT_A_CALL } from '../model/diagnostic';
import type { FlowDocument } from '../model/flow-document';

/**
 * Single-function-call validation for the `aggregate` and `func` nodes (AC-D002).
 *
 * Both compile straight into eKuiper graph operators whose `expr` prop the engine parses as
 * ONE `ast.Call`. Anything else is rejected at deploy time:
 *
 *   parse aggfunc ... with map[expr:device, avg(temperature) AS avg_t, count(*) AS n]
 *   error: expr ... is not ast.Call
 *
 *   parse function fn with map[expr:temperature * 9 / 5 + 32 AS temp_f]
 *   error: expr ... is not ast.Call
 *
 * Both messages were reproduced against a live eKuiper 2.4.1. The editor advertises these
 * properties as free expressions - `aggregate`'s is even labelled "Fields", plural - so it
 * actively invites input the engine will refuse. Catching it here turns a deploy-time engine
 * error into an authoring-time diagnostic that names the problem.
 *
 * This deliberately validates SHAPE only. It does not know which functions exist, and never
 * rejects on function name: an unknown name is the engine's business, not the editor's.
 */

/** Node types whose configured expression must be exactly one function call. */
const SINGLE_CALL_PROPERTIES: ReadonlyArray<{ type: string; property: string }> = [
  { type: 'aggregate', property: 'fields' },
  { type: 'func', property: 'expression' },
];

/** Strip one trailing `AS alias`, which eKuiper accepts alongside the call. */
function stripAlias(text: string): string {
  const match = /\s+as\s+[A-Za-z_][A-Za-z0-9_]*\s*$/i.exec(text);
  return match ? text.slice(0, match.index).trim() : text;
}

/**
 * Does `text` consist of exactly one function call?
 *
 * Quote-aware so a comma or parenthesis inside a string literal - `concat(a, ')')` - is not
 * mistaken for structure.
 */
export function isSingleFunctionCall(text: string): boolean {
  const trimmed = stripAlias(text.trim());
  if (trimmed.length === 0) return false;

  const open = trimmed.indexOf('(');
  if (open <= 0) return false;

  // Everything before the first parenthesis must be one plain identifier.
  const name = trimmed.slice(0, open).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) return false;

  let depth = 0;
  let quote: string | null = null;
  for (let i = open; i < trimmed.length; i += 1) {
    const char = trimmed[i];
    if (quote !== null) {
      if (char === '\\') i += 1;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      continue;
    }
    if (char === '(') depth += 1;
    else if (char === ')') {
      depth -= 1;
      // The call closed before the end of the text, so something follows it - another
      // expression, an operator, or a second call after a comma.
      if (depth === 0) return trimmed.slice(i + 1).trim().length === 0;
      if (depth < 0) return false;
    }
  }
  return false;
}

/**
 * Flag `aggregate`/`func` nodes whose expression is not a single call.
 *
 * Empty values are left alone: a missing required property is already reported by
 * property validation, and two diagnostics for one mistake reads as noise.
 */
export function validateExpressionShape(document: FlowDocument): FlowDiagnostic[] {
  const diagnostics: FlowDiagnostic[] = [];
  const nodes = document.spec?.nodes;
  if (!Array.isArray(nodes)) return diagnostics;

  for (const node of nodes) {
    const rule = SINGLE_CALL_PROPERTIES.find((entry) => entry.type === node?.type);
    if (!rule) continue;

    const config = node.config as Record<string, unknown> | undefined;
    const value = config?.[rule.property];
    if (typeof value !== 'string' || value.trim().length === 0) continue;
    if (isSingleFunctionCall(value)) continue;

    diagnostics.push({
      code: FLOW_EXPRESSION_NOT_A_CALL,
      severity: 'error',
      message:
        `Node "${node.name ?? node.id}" needs exactly one function call, such as ` +
        `avg(temperature) or upper(device), optionally with AS alias. eKuiper rejects ` +
        `anything else - a list of several calls, or arithmetic like temperature * 2 - ` +
        `when the rule is deployed.`,
      nodeId: node.id,
      propertyPath: rule.property,
    });
  }
  return diagnostics;
}
