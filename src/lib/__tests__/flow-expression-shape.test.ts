import { FLOW_EXPRESSION_NOT_A_CALL } from '@/lib/flows/model/diagnostic';
import type { FlowDocument } from '@/lib/flows/model/flow-document';
import {
  isSingleFunctionCall,
  validateExpressionShape,
} from '@/lib/flows/validation/expression-shape';

/**
 * AC-D002. Every accepted/rejected case below mirrors what a live eKuiper 2.4.1 does with the
 * same text: the engine parses the `aggfunc`/`function` operator's `expr` as one `ast.Call`
 * and rejects anything else at deploy time.
 */
describe('isSingleFunctionCall', () => {
  it.each([
    ['count(*)', true],
    ['avg(temperature)', true],
    ['avg(temperature) AS avg_t', true],
    ['avg(temperature) as avg_t', true],
    ['  upper(device)  ', true],
    ['round(temperature, 2)', true],
    ['round(avg(temperature))', true],
    ["concat(device, ')')", true],
  ])('accepts %p', (input, expected) => {
    expect(isSingleFunctionCall(input as string)).toBe(expected);
  });

  it.each([
    // Two calls: what the "Fields" (plural) label invites, and what the engine refused.
    ['avg(temperature) AS avg_t, count(*) AS n', false],
    ['device, avg(temperature) AS avg_t, count(*) AS n', false],
    // Arithmetic: rejected as "is not ast.Call" when deployed.
    ['temperature * 9 / 5 + 32 AS temp_f', false],
    ['temperature * 2', false],
    // A bare column is not a call.
    ['temperature', false],
    // Something trailing the call.
    ['avg(temperature) + 1', false],
    // Malformed.
    ['avg(temperature', false],
    ['(temperature)', false],
    ['', false],
    ['   ', false],
  ])('rejects %p', (input, expected) => {
    expect(isSingleFunctionCall(input as string)).toBe(expected);
  });
});

function documentWith(nodes: FlowDocument['spec']['nodes']): FlowDocument {
  return {
    apiVersion: 'flow.ekuiper-manager.io/v1alpha1',
    metadata: { id: 'flow-1', name: 'Flow' },
    spec: { nodes, edges: [] },
    layout: { nodes: {}, viewport: { x: 0, y: 0, zoom: 1 } },
  } as FlowDocument;
}

describe('validateExpressionShape', () => {
  it('accepts a single aggregate call', () => {
    const diagnostics = validateExpressionShape(
      documentWith([
        { id: 'agg', type: 'aggregate', typeVersion: 1, name: 'Aggregate', config: { fields: 'avg(temperature) AS avg_t' } },
      ] as FlowDocument['spec']['nodes']),
    );
    expect(diagnostics).toEqual([]);
  });

  it('rejects a comma-separated aggregate list and names the node and property', () => {
    const diagnostics = validateExpressionShape(
      documentWith([
        { id: 'agg', type: 'aggregate', typeVersion: 1, name: 'Per-device stats', config: { fields: 'avg(temperature) AS avg_t, count(*) AS n' } },
      ] as FlowDocument['spec']['nodes']),
    );
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      code: FLOW_EXPRESSION_NOT_A_CALL,
      severity: 'error',
      nodeId: 'agg',
      propertyPath: 'fields',
    });
    expect(diagnostics[0].message).toContain('Per-device stats');
  });

  it('rejects arithmetic in a func node', () => {
    const diagnostics = validateExpressionShape(
      documentWith([
        { id: 'fn', type: 'func', typeVersion: 1, name: 'To Fahrenheit', config: { expression: 'temperature * 9 / 5 + 32 AS temp_f' } },
      ] as FlowDocument['spec']['nodes']),
    );
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({ nodeId: 'fn', propertyPath: 'expression' });
  });

  it('leaves an empty value to required-property validation', () => {
    const diagnostics = validateExpressionShape(
      documentWith([
        { id: 'fn', type: 'func', typeVersion: 1, name: 'Empty', config: { expression: '' } },
        { id: 'agg', type: 'aggregate', typeVersion: 1, name: 'Empty', config: {} },
      ] as FlowDocument['spec']['nodes']),
    );
    expect(diagnostics).toEqual([]);
  });

  it('ignores node types that carry free expressions', () => {
    // filter takes a boolean predicate, not a call; it must never be flagged.
    const diagnostics = validateExpressionShape(
      documentWith([
        { id: 'flt', type: 'filter', typeVersion: 1, name: 'Hot', config: { expression: 'temperature > 50 AND valve = \'open\'' } },
      ] as FlowDocument['spec']['nodes']),
    );
    expect(diagnostics).toEqual([]);
  });

  it('reports each offending node once', () => {
    const diagnostics = validateExpressionShape(
      documentWith([
        { id: 'a', type: 'aggregate', typeVersion: 1, name: 'A', config: { fields: 'a, b' } },
        { id: 'b', type: 'func', typeVersion: 1, name: 'B', config: { expression: 'x * 2' } },
        { id: 'c', type: 'aggregate', typeVersion: 1, name: 'C', config: { fields: 'sum(x)' } },
      ] as FlowDocument['spec']['nodes']),
    );
    expect(diagnostics.map((d) => d.nodeId)).toEqual(['a', 'b']);
  });

  it('tolerates a malformed document without throwing', () => {
    expect(validateExpressionShape({} as FlowDocument)).toEqual([]);
    expect(
      validateExpressionShape({ spec: { nodes: null } } as unknown as FlowDocument),
    ).toEqual([]);
  });
});
