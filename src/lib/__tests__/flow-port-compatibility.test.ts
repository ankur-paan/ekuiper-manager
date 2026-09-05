import type { FlowPortKind } from '@/lib/flows/registry/node-definition';
import { canConnect } from '@/lib/flows/validation/port-compatibility';

describe('canConnect port compatibility', () => {
  it.each([
    ['stream', 'stream', true],
    ['stream', 'collection', false],
    ['stream', 'table', false],
    ['stream', 'any', true],
    ['collection', 'stream', false],
    ['collection', 'collection', true],
    ['collection', 'table', false],
    ['collection', 'any', true],
    ['table', 'stream', false],
    ['table', 'collection', false],
    ['table', 'table', true],
    ['table', 'any', true],
    ['any', 'stream', true],
    ['any', 'collection', true],
    ['any', 'table', true],
    ['any', 'any', true],
  ] as Array<[FlowPortKind, FlowPortKind, boolean]>)(
    'source=%s target=%s returns %s',
    (sourceKind, targetKind, expected) => {
      expect(canConnect(sourceKind, targetKind)).toBe(expected);
    },
  );

  it('never connects stream to collection in either direction', () => {
    expect(canConnect('stream', 'collection')).toBe(false);
    expect(canConnect('collection', 'stream')).toBe(false);
  });

  it('only connects table to table or any', () => {
    expect(canConnect('table', 'table')).toBe(true);
    expect(canConnect('table', 'any')).toBe(true);
    expect(canConnect('any', 'table')).toBe(true);
    expect(canConnect('table', 'stream')).toBe(false);
    expect(canConnect('table', 'collection')).toBe(false);
    expect(canConnect('stream', 'table')).toBe(false);
    expect(canConnect('collection', 'table')).toBe(false);
  });
});
