import { mapRuleStatusToSnapshot } from '@/lib/flows/runtime/map-metrics';

const FLOW_ID = 'flow-1';
const CAPTURED_AT = '2026-02-01T00:00:00.000Z';

function buildMap(): Record<string, string> {
  return {
    'node-source-1': 'source_mqtt_abc123',
    'node-sink-1': 'sink_log_def456',
  };
}

describe('mapRuleStatusToSnapshot', () => {
  it('maps known runtime operator counters back to Flow node IDs', () => {
    const snapshot = mapRuleStatusToSnapshot({
      flowId: FLOW_ID,
      runtimeNodeMap: buildMap(),
      capturedAt: CAPTURED_AT,
      ruleStatus: {
        status: 'running',
        message: '',
        lastStartTimestamp: 0,
        lastStopTimestamp: 0,
        nextStartTimestamp: 0,
        source_mqtt_abc123_records_in_total: 120,
        source_mqtt_abc123_records_out_total: 118,
        source_mqtt_abc123_exceptions_total: 2,
        sink_log_def456_records_in_total: 118,
        sink_log_def456_records_out_total: 118,
      },
    });

    expect(snapshot.flowId).toBe(FLOW_ID);
    expect(snapshot.capturedAt).toBe(CAPTURED_AT);
    expect(snapshot.nodes['node-source-1']).toEqual({
      inputTotal: 120,
      outputTotal: 118,
      errorTotal: 2,
    });
    expect(snapshot.nodes['node-sink-1']).toEqual({
      inputTotal: 118,
      outputTotal: 118,
    });
  });

  it('ignores unknown runtime operators without crashing', () => {
    const snapshot = mapRuleStatusToSnapshot({
      flowId: FLOW_ID,
      runtimeNodeMap: buildMap(),
      capturedAt: CAPTURED_AT,
      ruleStatus: {
        status: 'running',
        message: '',
        unknown_op_9_records_in_total: 999,
        source_mqtt_abc123_records_in_total: 7,
      },
    });

    expect(snapshot.nodes['node-source-1']).toEqual({ inputTotal: 7 });
    expect(Object.keys(snapshot.nodes)).toEqual(['node-source-1']);
  });

  it('does not mutate the persisted deployment map', () => {
    const runtimeNodeMap = buildMap();
    const before = JSON.stringify(runtimeNodeMap);
    Object.freeze(runtimeNodeMap);

    expect(() =>
      mapRuleStatusToSnapshot({
        flowId: FLOW_ID,
        runtimeNodeMap,
        ruleStatus: {
          status: 'running',
          source_mqtt_abc123_records_in_total: 3,
        },
      }),
    ).not.toThrow();
    expect(JSON.stringify(runtimeNodeMap)).toBe(before);
  });

  it('returns an empty snapshot for non-object status bodies', () => {
    for (const ruleStatus of [null, undefined, 'running', 42, []]) {
      const snapshot = mapRuleStatusToSnapshot({
        flowId: FLOW_ID,
        runtimeNodeMap: buildMap(),
        capturedAt: CAPTURED_AT,
        ruleStatus,
      });
      expect(snapshot).toEqual({
        flowId: FLOW_ID,
        capturedAt: CAPTURED_AT,
        nodes: {},
      });
    }
  });

  it('ignores non-counter gauges and non-numeric values without fabricating rates', () => {
    const snapshot = mapRuleStatusToSnapshot({
      flowId: FLOW_ID,
      runtimeNodeMap: buildMap(),
      capturedAt: CAPTURED_AT,
      ruleStatus: {
        status: 'running',
        source_mqtt_abc123_records_in_total: 10,
        source_mqtt_abc123_process_latency_us: 250,
        source_mqtt_abc123_buffer_length: 4,
        source_mqtt_abc123_last_invocation: 1735689600000,
        source_mqtt_abc123_last_exception: 'dial tcp: connection refused',
        source_mqtt_abc123_connection_status: 0,
        // String/NaN counter values must not leak into the snapshot.
        sink_log_def456_records_in_total: '118',
      },
    });

    expect(snapshot.nodes['node-source-1']).toEqual({ inputTotal: 10 });
    expect(snapshot.nodes['node-source-1']).not.toHaveProperty(
      'inputRatePerSec',
    );
    expect(snapshot.nodes['node-source-1']).not.toHaveProperty(
      'outputRatePerSec',
    );
    expect(snapshot.nodes['node-source-1']).not.toHaveProperty('latencyMsAvg');
    expect(snapshot.nodes).not.toHaveProperty('node-sink-1');
  });

  it('resolves nested operator IDs to the most specific operator', () => {
    const snapshot = mapRuleStatusToSnapshot({
      flowId: FLOW_ID,
      runtimeNodeMap: {
        'node-a': 'op',
        'node-b': 'op_x',
      },
      capturedAt: CAPTURED_AT,
      ruleStatus: {
        status: 'running',
        op_records_in_total: 1,
        op_x_records_in_total: 2,
      },
    });

    expect(snapshot.nodes['node-a']).toEqual({ inputTotal: 1 });
    expect(snapshot.nodes['node-b']).toEqual({ inputTotal: 2 });
  });

  it('skips malformed deployment map entries safely', () => {
    const snapshot = mapRuleStatusToSnapshot({
      flowId: FLOW_ID,
      runtimeNodeMap: {
        'node-source-1': 'source_mqtt_abc123',
        '': 'empty_flow_id',
        'node-broken': '',
      } as Record<string, string>,
      capturedAt: CAPTURED_AT,
      ruleStatus: {
        status: 'running',
        source_mqtt_abc123_records_in_total: 5,
        empty_flow_id_records_in_total: 100,
      },
    });

    expect(snapshot.nodes).toEqual({
      'node-source-1': { inputTotal: 5 },
    });
  });
});
