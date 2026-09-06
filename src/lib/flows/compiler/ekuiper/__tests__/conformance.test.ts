import { createBuiltinNodeRegistry } from '../../../registry/builtin-registry';
import { compileFlowToEkuiperGraph } from '../compile-graph';
import {
  assertEngineReachable,
  getConformanceUrl,
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
 * The engine base URL comes from `EKUIPER_CONFORMANCE_URL`.
 *
 * - When it is unset or blank the suite is not applicable and is skipped
 *   via `describe.skip`, so environments without an engine (including the
 *   CI quality job) report SKIPPED, never passed.
 * - When it is set, reachability is asserted: an unreachable engine (or a
 *   validation request that cannot be completed) fails loudly, naming the
 *   URL and the underlying error. A configured run must never pass while
 *   asserting nothing.
 *
 * This file changes no compiler or registry code: node types that fail
 * official validation fail here by name so a later ticket can fix the
 * mapping.
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
  beforeAll(async () => {
    await assertEngineReachable(engineBaseUrl);
    const caseCount = listConformanceCases().length;
    console.log(
      `[conformance] validating ${caseCount} node types against "${engineBaseUrl}".`,
    );
  }, 15000);

  it('covers every built-in node type currently in the registry', () => {
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
            `[conformance] ${entry.nodeType} rejected by official validation at "${engineBaseUrl}": ` +
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
