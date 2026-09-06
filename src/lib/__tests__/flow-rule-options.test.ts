import { compileFlowToEkuiperGraph } from '@/lib/flows/compiler/ekuiper/compile-graph';
import {
  assertEngineReachable,
  buildRuleOptionsConformanceDocument,
  getConformanceUrl,
  postRuleForValidation,
  readValidFlag,
} from '@/lib/flows/compiler/ekuiper/__tests__/conformance-helpers';
import { canonicalJson } from '@/lib/flows/hashing/canonical-json';
import { hashFlowSemantic } from '@/lib/flows/hashing/flow-hash';
import {
  FLOW_DOCUMENT_VERSION,
  type FlowDocument,
  type FlowRuleOptions,
} from '@/lib/flows/model/flow-document';
import { validateFlowDocumentShape } from '@/lib/flows/validation/document-shape';
import { FLOW_INVALID_PROPERTY_VALUE } from '@/lib/flows/validation/property-validation';

const SOURCE_FLOW_ID = 'node-source-1';
const SINK_FLOW_ID = 'node-sink-1';

function buildMemoryFlow(options?: FlowRuleOptions): FlowDocument {
  return {
    apiVersion: FLOW_DOCUMENT_VERSION,
    metadata: { id: 'flow-rule-options-demo', name: 'Rule Options Demo' },
    spec: {
      nodes: [
        {
          id: SOURCE_FLOW_ID,
          type: 'memory-source',
          typeVersion: 1,
          name: 'Source',
          config: { topic: 'devices/result' },
        },
        {
          id: SINK_FLOW_ID,
          type: 'memory-sink',
          typeVersion: 1,
          name: 'Sink',
          config: { topic: 'analysis/result' },
        },
      ],
      edges: [
        {
          id: 'edge-1',
          sourceNodeId: SOURCE_FLOW_ID,
          sourcePortId: 'out',
          targetNodeId: SINK_FLOW_ID,
          targetPortId: 'in',
        },
      ],
      ...(options === undefined ? {} : { options }),
    },
    layout: {
      nodes: {
        [SOURCE_FLOW_ID]: { x: 0, y: 0 },
        [SINK_FLOW_ID]: { x: 320, y: 120 },
      },
      viewport: { x: 0, y: 0, zoom: 1 },
    },
  };
}

const FULL_OPTIONS: FlowRuleOptions = {
  concurrency: 2,
  bufferLength: 1024,
  qos: 1,
  checkpointInterval: 5000,
  isEventTime: false,
  lateTolerance: 1000,
  sendMetaToSink: false,
  sendError: true,
};

describe('flow rule options (FS-0152)', () => {
  it('compiles a flow without options to a rule with NO options key', () => {
    const result = compileFlowToEkuiperGraph(buildMemoryFlow());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect('options' in result.artifact.ruleDefinition).toBe(false);
    expect(Object.keys(result.artifact.ruleDefinition).sort()).toEqual(['graph']);
  });

  it('treats an empty options object as absent (no options key)', () => {
    const document = buildMemoryFlow({});

    expect(validateFlowDocumentShape(document)).toEqual([]);

    const result = compileFlowToEkuiperGraph(document);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect('options' in result.artifact.ruleDefinition).toBe(false);
  });

  it('emits present options alongside graph, verbatim and deterministically', () => {
    const document = buildMemoryFlow({ ...FULL_OPTIONS });

    expect(validateFlowDocumentShape(document)).toEqual([]);

    const first = compileFlowToEkuiperGraph(document);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.artifact.ruleDefinition.options).toEqual(FULL_OPTIONS);
    expect('graph' in first.artifact.ruleDefinition).toBe(true);

    const second = compileFlowToEkuiperGraph(buildMemoryFlow({ ...FULL_OPTIONS }));
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(canonicalJson(second.artifact.ruleDefinition)).toBe(
      canonicalJson(first.artifact.ruleDefinition),
    );
  });

  it('includes options in the semantic hash but not layout moves', () => {
    const without = buildMemoryFlow();
    const withOptions = buildMemoryFlow({ ...FULL_OPTIONS });

    expect(hashFlowSemantic(withOptions.spec)).not.toBe(hashFlowSemantic(without.spec));

    const changed = buildMemoryFlow({ ...FULL_OPTIONS, concurrency: 4 });
    expect(hashFlowSemantic(changed.spec)).not.toBe(hashFlowSemantic(withOptions.spec));

    const baseline = compileFlowToEkuiperGraph(withOptions);
    const moved = buildMemoryFlow({ ...FULL_OPTIONS });
    moved.layout = {
      nodes: {
        [SOURCE_FLOW_ID]: { x: 999, y: 888 },
        [SINK_FLOW_ID]: { x: -12, y: 34 },
      },
      viewport: { x: 5, y: 5, zoom: 2 },
    };
    expect(hashFlowSemantic(moved.spec)).toBe(hashFlowSemantic(withOptions.spec));

    const recompiled = compileFlowToEkuiperGraph(moved);
    expect(baseline.ok).toBe(true);
    expect(recompiled.ok).toBe(true);
    if (!baseline.ok || !recompiled.ok) return;
    expect(canonicalJson(recompiled.artifact.ruleDefinition)).toBe(
      canonicalJson(baseline.artifact.ruleDefinition),
    );
    expect(recompiled.artifact.semanticHash).toBe(baseline.artifact.semanticHash);
  });

  it.each([
    ['concurrency', { concurrency: 0 }],
    ['concurrency', { concurrency: 1.5 }],
    ['bufferLength', { bufferLength: 0 }],
    ['qos', { qos: 3 as FlowRuleOptions['qos'] }],
    ['qos', { qos: '1' as unknown as FlowRuleOptions['qos'] }],
    ['checkpointInterval', { checkpointInterval: -1 }],
    ['checkpointInterval', { checkpointInterval: '' }],
    ['isEventTime', { isEventTime: 'true' as unknown as FlowRuleOptions['isEventTime'] }],
    ['lateTolerance', { lateTolerance: -5 }],
    ['sendMetaToSink', { sendMetaToSink: 1 as unknown as FlowRuleOptions['sendMetaToSink'] }],
    ['sendError', { sendError: null as unknown as FlowRuleOptions['sendError'] }],
    ['debug', { debug: true } as unknown as FlowRuleOptions],
    ['cron', { cron: '* * * * *' } as unknown as FlowRuleOptions],
  ])('rejects out-of-range option %s with a structured diagnostic', (key, options) => {
    const document = buildMemoryFlow(options as FlowRuleOptions);

    const shapeDiagnostics = validateFlowDocumentShape(document);
    expect(shapeDiagnostics.length).toBeGreaterThan(0);
    expect(
      shapeDiagnostics.some(
        (diagnostic) =>
          diagnostic.code === FLOW_INVALID_PROPERTY_VALUE &&
          diagnostic.severity === 'error' &&
          diagnostic.propertyPath === `spec.options.${key}`,
      ),
    ).toBe(true);

    const compiled = compileFlowToEkuiperGraph(document);
    expect(compiled.ok).toBe(false);
    if (compiled.ok) return;
    expect(
      compiled.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === FLOW_INVALID_PROPERTY_VALUE &&
          diagnostic.severity === 'error',
      ),
    ).toBe(true);
  });

  it('rejects a non-object options value with a structured diagnostic', () => {
    const document = buildMemoryFlow(
      'fast' as unknown as FlowRuleOptions,
    );

    const shapeDiagnostics = validateFlowDocumentShape(document);
    expect(shapeDiagnostics.length).toBeGreaterThan(0);
    expect(
      shapeDiagnostics.some(
        (diagnostic) =>
          diagnostic.code === FLOW_INVALID_PROPERTY_VALUE &&
          diagnostic.propertyPath === 'spec.options',
      ),
    ).toBe(true);

    const compiled = compileFlowToEkuiperGraph(document);
    expect(compiled.ok).toBe(false);
  });
});

const conformanceUrl = getConformanceUrl();
const describeLiveOptions =
  conformanceUrl === undefined ? describe.skip : describe;

describeLiveOptions(
  conformanceUrl === undefined
    ? 'flow rule options live validation (SKIPPED: set EKUIPER_CONFORMANCE_URL to run)'
    : 'flow rule options live validation',
  () => {
    const engineBaseUrl = conformanceUrl ?? '';

    beforeAll(async () => {
      await assertEngineReachable(engineBaseUrl);
    }, 15000);

    it(
      'official validation accepts a flow WITH options (valid: true)',
      async () => {
        const compiled = compileFlowToEkuiperGraph(
          buildRuleOptionsConformanceDocument(),
        );
        if (!compiled.ok) {
          throw new Error(
            `[conformance] rule-options failed before live validation: ` +
              `compilation returned diagnostics ${JSON.stringify(compiled.diagnostics)}`,
          );
        }
        const outcome = await postRuleForValidation(engineBaseUrl, {
          ruleId: compiled.artifact.ruleId,
          ruleDefinition: compiled.artifact.ruleDefinition,
        });
        if (outcome.httpStatus !== 200 || !readValidFlag(outcome.parsed)) {
          throw new Error(
            `[conformance] rule-options rejected by official validation at "${engineBaseUrl}": ` +
              `HTTP ${outcome.httpStatus} body ${outcome.bodyText.slice(0, 2000)}`,
          );
        }
        expect(outcome.httpStatus).toBe(200);
        expect(readValidFlag(outcome.parsed)).toBe(true);
      },
      30000,
    );
  },
);
