import { lookup } from 'node:dns/promises';
import { assertSafeNodeDestination, normalizeNodeUrl } from '@/lib/network';

jest.mock('node:dns/promises', () => ({ lookup: jest.fn() }));
const mockedLookup = lookup as unknown as jest.MockedFunction<
  (
    hostname: string,
    options: { all: true; verbatim?: boolean },
  ) => Promise<Array<{ address: string; family: 4 | 6 }>>
>;

describe('node URL validation', () => {
  it('normalizes an eKuiper origin', () => {
    expect(normalizeNodeUrl(' https://ekuiper.example.test:9081/ ')).toBe(
      'https://ekuiper.example.test:9081',
    );
  });

  it.each([
    'file:///tmp/ekuiper',
    'https://user:password@ekuiper.example.test',
    'https://ekuiper.example.test/api',
    'https://ekuiper.example.test?target=other',
    'not a url',
  ])('rejects unsafe or non-origin URL %s', (value) => {
    expect(() => normalizeNodeUrl(value)).toThrow();
  });

  it('permits loopback and private destinations used by self-hosted eKuiper', async () => {
    mockedLookup.mockResolvedValueOnce([
      { address: '127.0.0.1', family: 4 },
      { address: '10.2.3.4', family: 4 },
    ]);
    await expect(assertSafeNodeDestination(new URL('http://ekuiper.test:9081'))).resolves.toBeUndefined();
  });

  it.each(['0.0.0.1', '169.254.169.254', '224.0.0.1', '::', 'fe80::1', 'ff02::1'])(
    'rejects non-routable destination %s',
    async (address) => {
      mockedLookup.mockResolvedValueOnce([{ address, family: address.includes(':') ? 6 : 4 }]);
      await expect(assertSafeNodeDestination(new URL('http://ekuiper.test:9081'))).rejects.toThrow();
    },
  );

  it('fails closed when DNS resolution fails or returns no addresses', async () => {
    mockedLookup.mockRejectedValueOnce(new Error('dns failed'));
    await expect(assertSafeNodeDestination(new URL('http://ekuiper.test:9081'))).rejects.toThrow();
    mockedLookup.mockResolvedValueOnce([]);
    await expect(assertSafeNodeDestination(new URL('http://ekuiper.test:9081'))).rejects.toThrow();
  });
});
