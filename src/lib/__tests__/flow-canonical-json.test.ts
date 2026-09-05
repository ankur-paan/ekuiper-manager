import { canonicalJson } from '@/lib/flows/hashing/canonical-json';

describe('canonicalJson', () => {
  it('serializes objects identically regardless of key insertion order', () => {
    const first = { b: 2, a: 1 };
    const second = { a: 1, b: 2 };
    expect(canonicalJson(first)).toBe(canonicalJson(second));
    expect(canonicalJson(first)).toBe('{"a":1,"b":2}');
  });

  it('keeps array order significant', () => {
    expect(canonicalJson([1, 2, 3])).not.toBe(canonicalJson([3, 2, 1]));
    expect(canonicalJson([1, 2, 3])).toBe('[1,2,3]');
  });

  it('canonicalizes nested objects recursively', () => {
    const first = {
      z: { d: 4, c: 3 },
      a: [{ y: 2, x: 1 }],
    };
    const second = {
      a: [{ x: 1, y: 2 }],
      z: { c: 3, d: 4 },
    };
    expect(canonicalJson(first)).toBe(canonicalJson(second));
    expect(canonicalJson(first)).toBe('{"a":[{"x":1,"y":2}],"z":{"c":3,"d":4}}');
  });

  it('follows JSON.stringify semantics for primitives', () => {
    expect(canonicalJson(null)).toBe('null');
    expect(canonicalJson(true)).toBe('true');
    expect(canonicalJson(false)).toBe('false');
    expect(canonicalJson(42)).toBe('42');
    expect(canonicalJson('a"b\n')).toBe(JSON.stringify('a"b\n'));
    expect(canonicalJson({})).toBe('{}');
    expect(canonicalJson([])).toBe('[]');
  });

  it('rejects functions, symbols, bigints, and undefined', () => {
    expect(() => canonicalJson(() => 1)).toThrow(/unsupported/);
    expect(() => canonicalJson(Symbol('s'))).toThrow(/unsupported/);
    expect(() => canonicalJson(10n)).toThrow(/unsupported/);
    expect(() => canonicalJson(undefined)).toThrow(/unsupported/);
    expect(() => canonicalJson({ a: undefined })).toThrow(/unsupported/);
    expect(() => canonicalJson([1, undefined])).toThrow(/unsupported/);
  });

  it('rejects cyclic objects and arrays', () => {
    const cyclicObject: Record<string, unknown> = { a: 1 };
    cyclicObject.self = cyclicObject;
    expect(() => canonicalJson(cyclicObject)).toThrow(/cyclic/);

    const cyclicArray: unknown[] = [1];
    cyclicArray.push(cyclicArray);
    expect(() => canonicalJson(cyclicArray)).toThrow(/cyclic/);

    const nested: { child?: unknown } = {};
    nested.child = { parent: nested };
    expect(() => canonicalJson(nested)).toThrow(/cyclic/);
  });

  it('rejects non-plain objects instead of coercing them', () => {
    expect(() => canonicalJson(new Date())).toThrow(/unsupported/);
    expect(() => canonicalJson(new Map())).toThrow(/unsupported/);
  });
});
