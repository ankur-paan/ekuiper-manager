import type { FlowNode } from '@/lib/flows/model/flow-document';
import {
  createRuntimeId,
  isSafeRuntimeId,
} from '@/lib/flows/compiler/runtime-id';

function buildNode(overrides: Partial<FlowNode>): FlowNode {
  return {
    id: 'node-source-1',
    type: 'memory-source',
    typeVersion: 1,
    name: 'Source',
    config: { topic: 'sensors/temperature' },
    ...overrides,
  };
}

describe('flow runtime id', () => {
  it('produces the same output for the same input', () => {
    const first = createRuntimeId('src', 'node-source-1');
    const second = createRuntimeId('src', 'node-source-1');

    expect(first).toBe(second);
  });

  it('is unaffected by rename/display config changes', () => {
    const before = buildNode({ name: 'Source', config: { topic: 'a' } });
    const after = buildNode({
      name: 'Renamed source',
      config: { topic: 'b', threshold: 42 },
    });

    expect(createRuntimeId('src', after.id)).toBe(
      createRuntimeId('src', before.id),
    );
  });

  it('matches the safe charset pattern', () => {
    expect(createRuntimeId('src', 'node-source-1')).toMatch(
      /^[A-Za-z][A-Za-z0-9_]*$/,
    );
    expect(isSafeRuntimeId(createRuntimeId('filter', 'node-filter-9'))).toBe(
      true,
    );
  });

  it('produces distinct IDs for distinct node IDs', () => {
    const first = createRuntimeId('src', 'node-source-1');
    const second = createRuntimeId('src', 'node-source-2');

    expect(first).not.toBe(second);
    expect(isSafeRuntimeId(first)).toBe(true);
    expect(isSafeRuntimeId(second)).toBe(true);
  });

  it('includes the caller-supplied kind prefix deterministically', () => {
    const source = createRuntimeId('src', 'node-1');
    const sink = createRuntimeId('sink', 'node-1');

    expect(source).not.toBe(sink);
    expect(source.startsWith('src_')).toBe(true);
    expect(sink.startsWith('sink_')).toBe(true);
  });

  it('sanitizes unsafe kind characters into the safe charset', () => {
    const id = createRuntimeId('memory-source!', 'node-1');

    expect(isSafeRuntimeId(id)).toBe(true);
    expect(id.startsWith('memory_source__')).toBe(true);
  });
});
