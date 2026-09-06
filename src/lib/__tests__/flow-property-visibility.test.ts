import type { FlowPropertyDefinition } from '@/lib/flows/registry/node-definition';
import { isFlowPropertyVisible } from '@/lib/flows/registry/node-definition';

function buildProperty(
  overrides: Partial<FlowPropertyDefinition> & { key: string },
): FlowPropertyDefinition {
  return {
    label: overrides.key,
    type: 'string',
    ...overrides,
  };
}

describe('isFlowPropertyVisible (FS-0145)', () => {
  it('is visible when no showWhen is declared', () => {
    const property = buildProperty({ key: 'size' });

    expect(isFlowPropertyVisible(property, {})).toBe(true);
    expect(isFlowPropertyVisible(property, { windowType: 'tumbling' })).toBe(
      true,
    );
  });

  it('matches equals strictly', () => {
    const property = buildProperty({
      key: 'size',
      showWhen: { property: 'windowType', equals: 'tumbling' },
    });

    expect(isFlowPropertyVisible(property, { windowType: 'tumbling' })).toBe(
      true,
    );
    expect(isFlowPropertyVisible(property, { windowType: 'sliding' })).toBe(
      false,
    );
    expect(isFlowPropertyVisible(property, {})).toBe(false);
  });

  it('matches oneOf membership strictly', () => {
    const property = buildProperty({
      key: 'interval',
      showWhen: { property: 'windowType', oneOf: ['sliding', 'session'] },
    });

    expect(isFlowPropertyVisible(property, { windowType: 'sliding' })).toBe(
      true,
    );
    expect(isFlowPropertyVisible(property, { windowType: 'session' })).toBe(
      true,
    );
    expect(isFlowPropertyVisible(property, { windowType: 'tumbling' })).toBe(
      false,
    );
    expect(isFlowPropertyVisible(property, {})).toBe(false);
  });

  it('requires both equals and oneOf when both are present', () => {
    const property = buildProperty({
      key: 'size',
      showWhen: {
        property: 'windowType',
        equals: 'sliding',
        oneOf: ['sliding', 'session'],
      },
    });

    expect(isFlowPropertyVisible(property, { windowType: 'sliding' })).toBe(
      true,
    );
    expect(isFlowPropertyVisible(property, { windowType: 'session' })).toBe(
      false,
    );
  });

  it('stays visible when showWhen declares no constraint (fail-open)', () => {
    const property = buildProperty({
      key: 'size',
      showWhen: { property: 'windowType' },
    });

    expect(isFlowPropertyVisible(property, {})).toBe(true);
    expect(isFlowPropertyVisible(property, { windowType: 'sliding' })).toBe(
      true,
    );
  });

  it('does not collapse false and 0 into absent', () => {
    const flag = buildProperty({
      key: 'detail',
      showWhen: { property: 'enabled', equals: false },
    });
    const count = buildProperty({
      key: 'detail',
      showWhen: { property: 'retries', oneOf: [0] },
    });

    expect(isFlowPropertyVisible(flag, { enabled: false })).toBe(true);
    expect(isFlowPropertyVisible(flag, { enabled: true })).toBe(false);
    expect(isFlowPropertyVisible(flag, {})).toBe(false);
    expect(isFlowPropertyVisible(count, { retries: 0 })).toBe(true);
    expect(isFlowPropertyVisible(count, { retries: 1 })).toBe(false);
  });

  it('treats a hidden required property as not applicable', () => {
    const size = buildProperty({
      key: 'size',
      type: 'number',
      required: true,
      showWhen: { property: 'windowType', equals: 'tumbling' },
    });
    const config = { windowType: 'sliding' };

    // Visibility-aware required checking skips hidden properties, so no
    // FLOW_REQUIRED_PROPERTY_MISSING applies to `size` here.
    const missing = [size].filter(
      (property) =>
        property.required === true &&
        isFlowPropertyVisible(property, config) &&
        (config as Record<string, unknown>)[property.key] === undefined,
    );

    expect(isFlowPropertyVisible(size, config)).toBe(false);
    expect(missing).toEqual([]);
  });

  it('keeps the definition shape JSON-serialisable', () => {
    const property = buildProperty({
      key: 'size',
      type: 'number',
      required: true,
      showWhen: { property: 'windowType', oneOf: ['tumbling', 'sliding'] },
    });

    const roundTripped = JSON.parse(
      JSON.stringify(property),
    ) as FlowPropertyDefinition;

    expect(roundTripped).toEqual(property);
    expect(isFlowPropertyVisible(roundTripped, { windowType: 'sliding' })).toBe(
      true,
    );
    expect(isFlowPropertyVisible(roundTripped, { windowType: 'count' })).toBe(
      false,
    );
  });

  it('never mutates its inputs', () => {
    const property = buildProperty({
      key: 'size',
      showWhen: { property: 'windowType', equals: 'tumbling' },
    });
    const config = { windowType: 'sliding' };
    const propertySnapshot = JSON.stringify(property);
    const configSnapshot = JSON.stringify(config);

    isFlowPropertyVisible(property, config);

    expect(JSON.stringify(property)).toBe(propertySnapshot);
    expect(JSON.stringify(config)).toBe(configSnapshot);
  });
});
