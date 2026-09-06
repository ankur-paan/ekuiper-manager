import {
  BASELINE_CAPABILITY_OPERATORS,
  BASELINE_CAPABILITY_SINKS,
  BASELINE_CAPABILITY_SOURCES,
} from '@/lib/flows/capabilities/types';
import { resolveTargetCapabilities } from '@/lib/flows/capabilities/resolve-capabilities';

describe('flow target capabilities', () => {
  it('resolves the audited 2.4.1 baseline', () => {
    const profile = resolveTargetCapabilities({
      version: '2.4.1',
      reachable: true,
    });

    expect(profile.ekuiperVersion).toBe('2.4.1');
    expect(profile.reachable).toBe(true);
    expect(profile.graphRules).toBe(true);
    expect(profile.sources).toEqual([...BASELINE_CAPABILITY_SOURCES]);
    expect(profile.operators).toEqual([...BASELINE_CAPABILITY_OPERATORS]);
    expect(profile.sinks).toEqual([...BASELINE_CAPABILITY_SINKS]);
    expect(profile.sources).toContain('memory');
    expect(profile.sources).toContain('mqtt');
    expect(profile.operators).toEqual(
      expect.arrayContaining([
        'filter',
        'pick',
        'window',
        'aggfunc',
        'groupby',
        'switch',
        'orderby',
        'join',
      ]),
    );
    expect(profile.sinks).toEqual(
      expect.arrayContaining(['memory', 'mqtt', 'rest', 'log']),
    );
  });

  it('accepts newer versions while staying deterministic', () => {
    const first = resolveTargetCapabilities({
      version: '2.5.0',
      reachable: true,
    });
    const second = resolveTargetCapabilities({
      version: '2.5.0',
      reachable: true,
    });

    expect(first.graphRules).toBe(true);
    expect(first).toEqual(second);
    expect(first.sources).toEqual([...first.sources].sort());
    expect(first.operators).toEqual([...first.operators].sort());
    expect(first.sinks).toEqual([...first.sinks].sort());
  });

  it('does not enable capabilities for unknown versions', () => {
    for (const input of [
      {},
      { version: null, reachable: true },
      { version: '', reachable: true },
      { version: 'not-a-version', reachable: true },
      { version: '2.4.1', reachable: false },
      { version: '2.4.1' },
    ]) {
      const profile = resolveTargetCapabilities(input);
      expect(profile.graphRules).toBe(false);
      expect(profile.sources).toEqual([]);
      expect(profile.operators).toEqual([]);
      expect(profile.sinks).toEqual([]);
    }
  });

  it('does not enable capabilities below the audited baseline', () => {
    const profile = resolveTargetCapabilities({
      version: '2.3.0',
      reachable: true,
    });

    expect(profile.graphRules).toBe(false);
    expect(profile.sources).toEqual([]);
    expect(profile.operators).toEqual([]);
    expect(profile.sinks).toEqual([]);
  });

  it('narrows the baseline when metadata cannot prove support', () => {
    const profile = resolveTargetCapabilities({
      version: '2.4.1',
      reachable: true,
      sourceNames: ['memory'],
      sinkNames: ['memory', 'unknown-sink'],
    });

    expect(profile.graphRules).toBe(true);
    expect(profile.sources).toEqual(['memory']);
    expect(profile.sinks).toEqual(['memory']);
    expect(profile.operators).toEqual([...BASELINE_CAPABILITY_OPERATORS]);
  });
});
