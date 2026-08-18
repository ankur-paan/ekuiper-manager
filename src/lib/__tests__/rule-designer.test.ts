import {
  buildSql,
  coerceFieldValue,
  decodeActions,
  duplicateRule,
  encodeActions,
  parseSimpleSql,
  redactSensitive,
  sinkFields,
} from '@/lib/ekuiper/rule-designer';
import type { Rule, Sink } from '@/lib/ekuiper/types';

describe('rule designer codecs', () => {
  test('round-trips typed and unknown action properties without loss', () => {
    const source = [{
      sql: {
        dburl: 'postgres://db',
        table: 'measurements',
        fields: ['device_id', 'value'],
        sendSingle: true,
        batchSize: 25,
        futureOption: { mode: 'strict' },
      },
      customOuterOption: 'kept',
    }] as unknown as Sink[];

    expect(encodeActions(decodeActions(source))).toEqual(source);
  });

  test('coerces downstream fork fields to official wire types', () => {
    expect(coerceFieldValue('number', '1883')).toBe(1883);
    expect(coerceFieldValue('boolean', 'true')).toBe(true);
    expect(coerceFieldValue('boolean', 'false')).toBe(false);
    expect(coerceFieldValue('string-list', 'id, value\nts')).toEqual(['id', 'value', 'ts']);
    expect(sinkFields('sql').find((field) => field.key === 'sendSingle')?.kind).toBe('boolean');
  });

  test('generates and parses the supported visual SQL shape', () => {
    const query = {
      fields: 'deviceId, avg(power) AS mean_power',
      source: 'meter_stream',
      where: 'power > 10',
      groupBy: 'deviceId, TUMBLINGWINDOW(ss, 10)',
      having: 'count(*) > 2',
      orderBy: 'mean_power DESC',
      limit: '25',
    };
    const sql = buildSql(query);
    expect(sql).toBe('SELECT deviceId, avg(power) AS mean_power FROM meter_stream WHERE power > 10 GROUP BY deviceId, TUMBLINGWINDOW(ss, 10) HAVING count(*) > 2 ORDER BY mean_power DESC LIMIT 25');
    expect(parseSimpleSql(sql)).toEqual(query);
  });

  test('masks nested secrets in previews', () => {
    expect(redactSensitive({ mqtt: { username: 'operator', password: 'secret', token: 'abc' } })).toEqual({
      mqtt: { username: 'operator', password: '••••••••', token: '••••••••' },
    });
  });

  test('duplicates only definition fields and always creates the clone stopped', () => {
    const source: Rule = {
      id: 'source_rule',
      name: 'Runtime display name',
      version: 9,
      triggered: true,
      sql: 'SELECT * FROM source_stream',
      actions: [{ log: {} }],
      options: { concurrency: 2 },
      tags: ['production'],
    };

    expect(duplicateRule(source, 'copy_rule')).toEqual({
      id: 'copy_rule',
      triggered: false,
      sql: 'SELECT * FROM source_stream',
      actions: [{ log: {} }],
      options: { concurrency: 2 },
      tags: ['production'],
    });
  });
});
