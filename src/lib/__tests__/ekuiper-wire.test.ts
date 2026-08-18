import {
  isSensitiveEKuiperPath,
  parseEKuiperJsonObject,
  redactEKuiperSecrets,
} from '@/lib/ekuiper/wire';

describe('eKuiper wire responses', () => {
  it('parses JSON even when eKuiper labels it as text/plain', () => {
    expect(parseEKuiperJsonObject('{"version":"2.4.1"}')).toEqual({ version: '2.4.1' });
  });

  it('rejects malformed and non-object system responses', () => {
    expect(() => parseEKuiperJsonObject('not-json')).toThrow();
    expect(() => parseEKuiperJsonObject('[]')).toThrow();
  });

  it.each([
    'connections',
    'connections/mqtt-main',
    'metadata/sources/yaml/mqtt',
    'metadata/sinks/yaml/rest',
    'metadata/connections/yaml/mqtt',
    'metadata/resource',
  ])('classifies %s as sensitive independently of media type', (path) => {
    expect(isSensitiveEKuiperPath(path)).toBe(true);
  });

  it('redacts nested and array-held credentials', () => {
    expect(
      redactEKuiperSecrets({
        id: 'mqtt-main',
        props: { username: 'operator', password: 'secret', nested: [{ privateKey: 'key' }] },
      }),
    ).toEqual({
      id: 'mqtt-main',
      props: { username: 'operator', password: '[redacted]', nested: [{ privateKey: '[redacted]' }] },
    });
  });
});
