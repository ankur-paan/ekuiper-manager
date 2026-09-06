import type { FlowPropertyDefinition } from '@/lib/flows/registry/node-definition';
import { validateFlowPropertyBounds } from '@/lib/flows/registry/node-definition';

function buildProperty(
  overrides: Partial<FlowPropertyDefinition> & { key: string },
): FlowPropertyDefinition {
  return {
    label: overrides.key,
    type: 'number',
    ...overrides,
  };
}

describe('FlowPropertyTypeOptions (FS-0146)', () => {
  it('returns null when no typeOptions are declared', () => {
    const property = buildProperty({ key: 'count' });

    expect(validateFlowPropertyBounds('node-1', property, 5)).toBeNull();
    expect(validateFlowPropertyBounds('node-1', property, -100)).toBeNull();
  });

  it('rejects a value below min with a diagnostic', () => {
    const property = buildProperty({
      key: 'count',
      typeOptions: { min: 1, max: 10 },
    });

    const diagnostic = validateFlowPropertyBounds('node-1', property, 0);

    expect(diagnostic).not.toBeNull();
    expect(diagnostic?.code).toBe('FLOW_INVALID_PROPERTY_VALUE');
    expect(diagnostic?.severity).toBe('error');
    expect(diagnostic?.nodeId).toBe('node-1');
    expect(diagnostic?.propertyPath).toBe('config.count');
    expect(diagnostic?.message).toContain('1');
  });

  it('rejects a value above max with a diagnostic', () => {
    const property = buildProperty({
      key: 'count',
      typeOptions: { min: 1, max: 10 },
    });

    const diagnostic = validateFlowPropertyBounds('node-1', property, 11);

    expect(diagnostic).not.toBeNull();
    expect(diagnostic?.code).toBe('FLOW_INVALID_PROPERTY_VALUE');
    expect(diagnostic?.severity).toBe('error');
    expect(diagnostic?.nodeId).toBe('node-1');
    expect(diagnostic?.propertyPath).toBe('config.count');
    expect(diagnostic?.message).toContain('10');
  });

  it('accepts boundary and in-range values', () => {
    const property = buildProperty({
      key: 'count',
      typeOptions: { min: 1, max: 10 },
    });

    expect(validateFlowPropertyBounds('node-1', property, 1)).toBeNull();
    expect(validateFlowPropertyBounds('node-1', property, 10)).toBeNull();
    expect(validateFlowPropertyBounds('node-1', property, 5)).toBeNull();
  });

  it('skips absent values and leaves them to required validation', () => {
    const property = buildProperty({
      key: 'count',
      typeOptions: { min: 1, max: 10 },
    });

    expect(
      validateFlowPropertyBounds('node-1', property, undefined),
    ).toBeNull();
    expect(validateFlowPropertyBounds('node-1', property, null)).toBeNull();
    expect(validateFlowPropertyBounds('node-1', property, '')).toBeNull();
  });

  it('skips non-number values and leaves them to type validation', () => {
    const property = buildProperty({
      key: 'count',
      typeOptions: { min: 1, max: 10 },
    });

    expect(validateFlowPropertyBounds('node-1', property, '3')).toBeNull();
    expect(validateFlowPropertyBounds('node-1', property, NaN)).toBeNull();
    expect(
      validateFlowPropertyBounds('node-1', property, Infinity),
    ).toBeNull();
  });

  it('ignores min/max on non-number property types', () => {
    const stringProperty = buildProperty({
      key: 'nickname',
      type: 'string',
      typeOptions: { min: 1, max: 10 },
    });

    expect(
      validateFlowPropertyBounds('node-1', stringProperty, 0),
    ).toBeNull();
    expect(
      validateFlowPropertyBounds('node-1', stringProperty, 'anything'),
    ).toBeNull();
  });

  it('treats password as display-only without changing storage semantics', () => {
    const property = buildProperty({
      key: 'token',
      type: 'string',
      typeOptions: { password: true, placeholder: 'Enter a value' },
    });

    // Range validation never applies to strings, so a password-masked
    // value is never rejected and never transformed here; the stored
    // config value passes through untouched.
    expect(
      validateFlowPropertyBounds('node-1', property, 's3cret'),
    ).toBeNull();

    const roundTripped = JSON.parse(
      JSON.stringify(property),
    ) as FlowPropertyDefinition;
    expect(roundTripped).toEqual(property);
    expect(roundTripped.typeOptions?.password).toBe(true);
  });

  it('treats multiline, step and placeholder as display-only hints', () => {
    const multiline = buildProperty({
      key: 'notes',
      type: 'string',
      typeOptions: { multiline: true, placeholder: 'One per line' },
    });
    const stepped = buildProperty({
      key: 'count',
      type: 'number',
      typeOptions: { min: 0, max: 100, step: 5 },
    });

    expect(
      validateFlowPropertyBounds('node-1', multiline, 'a\nb'),
    ).toBeNull();
    expect(validateFlowPropertyBounds('node-1', stepped, 50)).toBeNull();
    expect(
      validateFlowPropertyBounds('node-1', stepped, 101)?.code,
    ).toBe('FLOW_INVALID_PROPERTY_VALUE');

    expect(JSON.parse(JSON.stringify(multiline))).toEqual(multiline);
    expect(JSON.parse(JSON.stringify(stepped))).toEqual(stepped);
  });

  it('keeps the full typeOptions shape JSON-serialisable', () => {
    const property = buildProperty({
      key: 'count',
      typeOptions: {
        multiline: false,
        min: 0,
        max: 100,
        step: 1,
        password: false,
        placeholder: 'Enter a count',
      },
    });

    const roundTripped = JSON.parse(
      JSON.stringify(property),
    ) as FlowPropertyDefinition;

    expect(roundTripped).toEqual(property);
  });

  it('never mutates its inputs', () => {
    const property = buildProperty({
      key: 'count',
      typeOptions: { min: 1, max: 10 },
    });
    const propertySnapshot = JSON.stringify(property);

    validateFlowPropertyBounds('node-1', property, 0);
    validateFlowPropertyBounds('node-1', property, 5);

    expect(JSON.stringify(property)).toBe(propertySnapshot);
  });
});
