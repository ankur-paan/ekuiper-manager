import { NextRequest } from 'next/server';
import { GET } from '@/app/api/flows/options/[provider]/route';
import {
  UNKNOWN_OPTION_PROVIDER_CODE,
  resolveFlowOptionsUpstreamPath,
  toFlowOptionItems,
} from '@/lib/flows/options';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { assertSafeNodeDestination } from '@/lib/network';
import { getNodeWithAuthorization } from '@/lib/nodes';
import {
  FLOW_OPTION_PROVIDER_IDS,
  buildFlowOptionsUrl,
  isFlowOptionProviderId,
  mergeFlowPropertyOptions,
  type FlowPropertyDefinition,
} from '@/lib/flows/registry/node-definition';

jest.mock('@/lib/auth/session', () => ({ getAuthenticatedUser: jest.fn() }));
jest.mock('@/lib/nodes', () => {
  const actual = jest.requireActual('@/lib/nodes');
  return { ...actual, getNodeWithAuthorization: jest.fn() };
});
jest.mock('@/lib/network', () => {
  const actual = jest.requireActual('@/lib/network');
  return { ...actual, assertSafeNodeDestination: jest.fn() };
});

const mockedGetUser = jest.mocked(getAuthenticatedUser);
const mockedGetNodeWithAuth = jest.mocked(getNodeWithAuthorization);
const mockedAssertDestination = jest.mocked(assertSafeNodeDestination);
const fetchMock = jest.spyOn(globalThis, 'fetch');

const actor = {
  id: 'user-1',
  username: 'operator',
  role: 'USER' as const,
  mustChangePassword: false,
};

function buildNode(auth: string | null = 'Bearer stored-credential') {
  return {
    node: {
      id: 'node-1',
      name: 'edge-node',
      baseUrl: 'http://edge-node:9081',
      description: null,
      hasAuthorization: auth !== null,
      isDefault: true,
      status: 'ONLINE',
      version: '2.4.1',
      capabilities: {},
      lastCheckedAt: null,
      lastError: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
    authorization: auth,
  } as unknown as Awaited<ReturnType<typeof getNodeWithAuthorization>>;
}

function getRequest(
  provider: string,
  query = '',
  init?: { origin?: string; cookie?: string },
) {
  const headers = new Headers();
  if (init?.origin !== undefined) headers.set('origin', init.origin);
  if (init?.cookie !== undefined) headers.set('cookie', init.cookie);
  return new NextRequest(
    `http://localhost/api/flows/options/${provider}${query}`,
    { headers },
  );
}

function routeParams(provider: string) {
  return { params: Promise.resolve({ provider }) };
}

beforeEach(() => {
  mockedGetUser.mockReset();
  mockedGetNodeWithAuth.mockReset();
  mockedAssertDestination.mockReset();
  fetchMock.mockReset();
  mockedAssertDestination.mockResolvedValue(undefined);
});

describe('optionsProvider definition shape (FS-0147)', () => {
  it('exposes exactly the streams, tables and mqtt-confkeys providers', () => {
    expect([...FLOW_OPTION_PROVIDER_IDS]).toEqual([
      'streams',
      'tables',
      'mqtt-confkeys',
    ]);
  });

  it('accepts allowlisted ids and rejects URLs, paths and unknown ids', () => {
    expect(isFlowOptionProviderId('streams')).toBe(true);
    expect(isFlowOptionProviderId('tables')).toBe(true);
    expect(isFlowOptionProviderId('mqtt-confkeys')).toBe(true);
    expect(isFlowOptionProviderId('connections')).toBe(false);
    expect(isFlowOptionProviderId('')).toBe(false);
    expect(isFlowOptionProviderId('https://evil.example/streams')).toBe(false);
    expect(isFlowOptionProviderId('/streams')).toBe(false);
    expect(isFlowOptionProviderId('../streams')).toBe(false);
    expect(isFlowOptionProviderId(undefined)).toBe(false);
    expect(isFlowOptionProviderId(null)).toBe(false);
    expect(isFlowOptionProviderId(42)).toBe(false);
  });

  it('stays optional and JSON-serialisable on a select property', () => {
    const property: FlowPropertyDefinition = {
      key: 'stream',
      label: 'Stream',
      type: 'select',
      optionsProvider: 'streams',
      options: [{ label: 'Manual', value: 'manual' }],
    };

    const roundTripped = JSON.parse(
      JSON.stringify(property),
    ) as FlowPropertyDefinition;

    expect(roundTripped).toEqual(property);
    expect(roundTripped.optionsProvider).toBe('streams');
  });

  it('builds a provider URL with no caller-supplied URL parameter', () => {
    expect(buildFlowOptionsUrl('streams')).toBe('/api/flows/options/streams');
    expect(buildFlowOptionsUrl('tables', 'node-1')).toBe(
      '/api/flows/options/tables?targetNodeId=node-1',
    );
    expect(buildFlowOptionsUrl('streams', '  ')).toBe(
      '/api/flows/options/streams',
    );
    // The target travels as an opaque registered id, never as a URL.
    const url = buildFlowOptionsUrl('mqtt-confkeys', 'node-1');
    expect(url).not.toContain('baseUrl');
    expect(url).not.toContain('http');
  });
});

describe('mergeFlowPropertyOptions (FS-0147)', () => {
  it('populates the select with provider results after static options', () => {
    const merged = mergeFlowPropertyOptions(
      [{ label: 'Manual', value: 'manual' }],
      [
        { label: 's1', value: 's1' },
        { label: 's2', value: 's2' },
      ],
    );

    expect(merged).toEqual([
      { label: 'Manual', value: 'manual' },
      { label: 's1', value: 's1' },
      { label: 's2', value: 's2' },
    ]);
  });

  it('skips provider rows that duplicate a static value', () => {
    const merged = mergeFlowPropertyOptions(
      [{ label: 'S1', value: 's1' }],
      [
        { label: 's1-alias', value: 's1' },
        { label: 's2', value: 's2' },
      ],
    );

    expect(merged).toEqual([
      { label: 'S1', value: 's1' },
      { label: 's2', value: 's2' },
    ]);
  });

  it('drops malformed rows and never mutates its inputs', () => {
    const staticOptions = [{ label: 'Manual', value: 'manual' }];
    const providerOptions = [
      { label: 's1', value: 's1' },
      { label: '', value: '' },
    ] as Array<{ label: string; value: string }>;
    const staticSnapshot = JSON.stringify(staticOptions);
    const providerSnapshot = JSON.stringify(providerOptions);

    const merged = mergeFlowPropertyOptions(staticOptions, providerOptions);

    expect(merged).toEqual([
      { label: 'Manual', value: 'manual' },
      { label: 's1', value: 's1' },
    ]);
    expect(JSON.stringify(staticOptions)).toBe(staticSnapshot);
    expect(JSON.stringify(providerOptions)).toBe(providerSnapshot);
  });
});

describe('toFlowOptionItems (FS-0147)', () => {
  it('maps upstream paths per provider without caller input', () => {
    expect(resolveFlowOptionsUpstreamPath('streams')).toBe('/streams');
    expect(resolveFlowOptionsUpstreamPath('tables')).toBe('/tables');
    expect(resolveFlowOptionsUpstreamPath('mqtt-confkeys')).toBe(
      '/metadata/sources/yaml/mqtt',
    );
  });

  it('maps stream/table name arrays to option rows', () => {
    expect(toFlowOptionItems('streams', ['s1', 's2'])).toEqual([
      { label: 's1', value: 's1' },
      { label: 's2', value: 's2' },
    ]);
    expect(toFlowOptionItems('tables', [{ name: 't1' }, 't2'])).toEqual([
      { label: 't1', value: 't1' },
      { label: 't2', value: 't2' },
    ]);
  });

  it('returns confKey names only, discarding bodies that may hold secrets', () => {
    const payload = {
      edgeConf: { servers: ['tcp://broker:1883'], password: 's3cret' },
      cloudConf: { servers: ['tcp://cloud:1883'] },
    };

    const items = toFlowOptionItems('mqtt-confkeys', payload);

    expect(items).toEqual([
      { label: 'edgeConf', value: 'edgeConf' },
      { label: 'cloudConf', value: 'cloudConf' },
    ]);
    expect(JSON.stringify(items)).not.toContain('s3cret');
  });
});

describe('GET /api/flows/options/[provider] (FS-0147)', () => {
  it('returns 401 for unauthenticated requests without fetching', async () => {
    mockedGetUser.mockResolvedValueOnce(null);

    const response = await GET(
      getRequest('streams'),
      routeParams('streams'),
    );

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockedGetNodeWithAuth).not.toHaveBeenCalled();
  });

  it('rejects an unknown provider id without touching eKuiper', async () => {
    mockedGetUser.mockResolvedValueOnce(actor);

    const response = await GET(
      getRequest('https://evil.example'),
      routeParams('https://evil.example'),
    );
    const body = (await response.json()) as {
      error: { code: string };
    };

    expect(response.status).toBe(404);
    expect(body.error.code).toBe(UNKNOWN_OPTION_PROVIDER_CODE);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockedGetNodeWithAuth).not.toHaveBeenCalled();
  });

  it('rejects a mismatched origin via the shared same-origin helper', async () => {
    mockedGetUser.mockResolvedValueOnce(actor);

    const response = await GET(
      getRequest('streams', '', { origin: 'https://evil.example' }),
      routeParams('streams'),
    );
    const body = (await response.json()) as {
      error: { code: string };
    };

    expect(response.status).toBe(403);
    expect(body.error.code).toBe('ORIGIN_REJECTED');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('serves stream names from the registered node transport', async () => {
    mockedGetUser.mockResolvedValueOnce(actor);
    mockedGetNodeWithAuth.mockResolvedValueOnce(buildNode());
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(['s1', 's2']), { status: 200 }),
    );

    const response = await GET(
      getRequest('streams', '?targetNodeId=node-1'),
      routeParams('streams'),
    );
    const body = (await response.json()) as {
      provider: string;
      options: Array<{ label: string; value: string }>;
    };

    expect(response.status).toBe(200);
    expect(body).toEqual({
      provider: 'streams',
      options: [
        { label: 's1', value: 's1' },
        { label: 's2', value: 's2' },
      ],
    });
    expect(mockedGetNodeWithAuth).toHaveBeenCalledWith('node-1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [target, init] = fetchMock.mock.calls[0];
    expect(String(target)).toBe('http://edge-node:9081/streams');
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      'Bearer stored-credential',
    );
  });

  it('never returns confKey bodies and ignores caller-supplied URL params', async () => {
    mockedGetUser.mockResolvedValueOnce(actor);
    mockedGetNodeWithAuth.mockResolvedValueOnce(buildNode());
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          edgeConf: { servers: ['tcp://broker:1883'], password: 's3cret' },
        }),
        { status: 200 },
      ),
    );

    const response = await GET(
      getRequest(
        'mqtt-confkeys',
        '?targetNodeId=node-1&baseUrl=https://evil.example&url=https://evil.example',
      ),
      routeParams('mqtt-confkeys'),
    );
    const raw = await response.text();

    expect(response.status).toBe(200);
    expect(raw).toContain('edgeConf');
    expect(raw).not.toContain('s3cret');
    expect(raw).not.toContain('evil.example');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      'http://edge-node:9081/metadata/sources/yaml/mqtt',
    );
  });

  it('maps an upstream failure to a 502 without leaking the body', async () => {
    mockedGetUser.mockResolvedValueOnce(actor);
    mockedGetNodeWithAuth.mockResolvedValueOnce(buildNode());
    fetchMock.mockResolvedValueOnce(new Response('boom', { status: 500 }));

    const response = await GET(
      getRequest('tables'),
      routeParams('tables'),
    );

    expect(response.status).toBe(502);
  });
});
