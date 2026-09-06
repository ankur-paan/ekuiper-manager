import { createBuiltinNodeRegistry } from '../../../registry/builtin-registry';
import { compileFlowToEkuiperGraph } from '../compile-graph';
import {
  getConformanceUrl,
  isEngineReachable,
  listConformanceCases,
  postRuleForValidation,
  readValidFlag,
} from './conformance-helpers';

/**
 * Live-engine node conformance harness (FS-0141).
 *
 * For every built-in node type: compile a minimal valid flow with the
 * real compiler, POST the artifact to
 * `POST {EKUIPER_URL}/rules/validate`, and assert HTTP 200 with
 * `valid: true` per the audited `public/ekuiper-openapi.json`
 * (eKuiper 2.4.1) contract.
 *
 * The engine base URL comes from `EKUIPER_CONFORMANCE_URL`. When it is
 * unset — or the engine is unreachable — the suite skips/passes without
 * asserting so environments without an engine (including the CI quality
 * job) never fail. This file changes no compiler or registry code: node
 * types that fail official validation fail here by name so a later
 * ticket can fix the mapping.
 */

const conformanceUrl = getConformanceUrl();
const engineBaseUrl = conformanceUrl ?? '';
const describeConformance =
  conformanceUrl === undefined ? describe.skip : describe;
const suiteLabel =
  conformanceUrl === undefined
    ? 'eKuiper live-engine node conformance (SKIPPED: set EKUIPER_CONFORMANCE_URL to run)'
    : 'eKuiper live-engine node conformance';

describeConformance(suiteLabel, () => {
  let engineReachable = false;

  beforeAll(async () => {
    engineReachable = await isEngineReachable(engineBaseUrl);
    if (!engineReachable) {
      console.warn(
        `[conformance] eKuiper engine at "${engineBaseUrl}" is unreachable; ` +
          'conformance assertions will pass without contacting the engine.',
      );
    }
  }, 15000);

  it('covers every built-in node type currently in the registry', () => {
    if (!engineReachable) {
      console.warn(
        '[conformance] skipping registry-coverage check: engine unreachable.',
      );
      return;
    }
    const registered = createBuiltinNodeRegistry()
      .list()
      .map((definition) => definition.type)
      .sort();
    const covered = listConformanceCases()
      .map((entry) => entry.nodeType)
      .sort();
    expect(covered).toEqual(registered);
  });

  for (const entry of listConformanceCases()) {
    it(
      `official validation accepts the ${entry.nodeType} flow (valid: true)`,
      async () => {
        if (!engineReachable) {
          console.warn(
            `[conformance] skipping ${entry.nodeType}: engine unreachable.`,
          );
          return;
        }
        const document = entry.buildDocument();
        const compiled = compileFlowToEkuiperGraph(document);
        if (!compiled.ok) {
          throw new Error(
            `[conformance] ${entry.nodeType} failed before live validation: ` +
              `compilation returned diagnostics ${JSON.stringify(compiled.diagnostics)}`,
          );
        }
        const outcome = await postRuleForValidation(engineBaseUrl, {
          ruleId: compiled.artifact.ruleId,
          ruleDefinition: compiled.artifact.ruleDefinition,
        });
        if (
          outcome.httpStatus !== 200 ||
          !readValidFlag(outcome.parsed)
        ) {
          throw new Error(
            `[conformance] ${entry.nodeType} rejected by official validation: ` +
              `HTTP ${outcome.httpStatus} body ${outcome.bodyText.slice(0, 2000)}`,
          );
        }
        expect(outcome.httpStatus).toBe(200);
        expect(readValidFlag(outcome.parsed)).toBe(true);
      },
      30000,
    );
  }
});
