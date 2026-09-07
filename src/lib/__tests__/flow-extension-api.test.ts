import { NextRequest } from 'next/server';
import * as routeModule from '@/app/api/flow-extensions/route';
import { GET } from '@/app/api/flow-extensions/route';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { loadAllLocalExtensions } from '@/lib/flows/extensions/load-local-extensions';
import type { FlowExtensionPackage } from '@/lib/flows/extensions/types';
import type { FlowDiagnostic } from '@/lib/flows/model/diagnostic';
import type { FlowNodeDefinition } from '@/lib/flows/registry/node-definition';

jest.mock('@/lib/auth/session', () => ({ getAuthenticatedUser: jest.fn() }));
jest.mock('@/lib/flows/extensions/load-local-extensions', () => ({
  loadAllLocalExtensions: jest.fn(),
}));

const mockedGetUser = jest.mocked(getAuthenticatedUser);
const mockedLoadAll = jest.mocked(loadAllLocalExtensions);

const actor = {
  id: 'user-1',
  username: 'operator',
  role: 'USER' as const,
  mustChangePassword: false,
};

function buildDescriptor(
  overrides: Partial<FlowNodeDefinition> = {},
): FlowNodeDefinition {
  return {
    type: 'example-source',
    version: 1,
    displayName: 'Example Source',
    description: 'Declarative test source.',
    category: 'source',
    inputs: [],
    outputs: [{ id: 'out', kind: 'stream' }],
    properties: [{ key: 'topic', label: 'Topic', type: 'string' }],
    ...overrides,
  };
}

function buildPackage(
  id = 'com.example.telemetry',
  nodes: FlowNodeDefinition[] = [buildDescriptor()],
): FlowExtensionPackage {
  return {
    manifest: {
      apiVersion: 'flow.extensions.ekuiper-manager.io/v1alpha1',
      id,
      name: 'Example Telemetry',
      version: '1.0.0',
      manager: '>=2.0.0',
      nodes: ['nodes/example-source.json'],
    },
    nodes,
  };
}

function loadAllResult(
  extensions: FlowExtensionPackage[] = [],
  failures: Array<{
    extensionName: string;
    diagnostics: FlowDiagnostic[];
  }> = [],
) {
  return {
    extensions,
    failures: failures.map((failure) => ({
      extensionName: failure.extensionName,
      ok: false as const,
      diagnostics: failure.diagnostics,
    })),
    diagnostics: failures.flatMap((failure) => failure.diagnostics),
  };
}

function getRequest(url = 'http://localhost/api/flow-extensions') {
  return new NextRequest(url);
}

beforeEach(() => {
  mockedGetUser.mockReset();
  mockedLoadAll.mockReset();
  mockedGetUser.mockResolvedValue(actor);
});

describe('GET /api/flow-extensions', () => {
  it('returns 401 for unauthenticated requests without loading extensions', async () => {
    mockedGetUser.mockReset();
    mockedGetUser.mockResolvedValueOnce(null);

    const response = await GET(getRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'AUTH_REQUIRED', message: 'Sign in required' },
    });
    expect(mockedLoadAll).not.toHaveBeenCalled();
  });

  it('rejects cross-origin reads when an Origin header is present', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/flow-extensions', {
        headers: { origin: 'https://evil.test' },
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'ORIGIN_REJECTED', message: 'Request origin is not allowed' },
    });
    expect(mockedLoadAll).not.toHaveBeenCalled();
  });

  it('returns safe extension metadata and node definitions without filesystem paths', async () => {
    mockedLoadAll.mockResolvedValueOnce(loadAllResult([buildPackage()]));

    const response = await GET(getRequest());

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      extensions: Array<Record<string, unknown>>;
      diagnostics: FlowDiagnostic[];
    };
    expect(payload.diagnostics).toEqual([]);
    expect(payload.extensions).toHaveLength(1);
    expect(payload.extensions[0]).toEqual({
      id: 'com.example.telemetry',
      name: 'Example Telemetry',
      version: '1.0.0',
      nodes: [buildDescriptor()],
    });
    // No manifest descriptor paths and no server filesystem paths leak.
    expect(JSON.stringify(payload)).not.toContain('extension.json');
    expect(JSON.stringify(payload)).not.toContain('nodes/example-source.json');
    expect(payload.extensions[0]).not.toHaveProperty('manifest');
    expect(payload.extensions[0]).not.toHaveProperty('path');
  });

  it('omits a colliding extension with a safe diagnostic instead of failing', async () => {
    mockedLoadAll.mockResolvedValueOnce(
      loadAllResult([
        buildPackage(),
        buildPackage('com.example.colliding', [buildDescriptor({ type: 'filter' })]),
      ]),
    );

    const response = await GET(getRequest());

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      extensions: Array<{ id: string }>;
      diagnostics: FlowDiagnostic[];
    };
    expect(payload.extensions.map((entry) => entry.id)).toEqual([
      'com.example.telemetry',
    ]);
    expect(payload.diagnostics).toHaveLength(1);
    expect(payload.diagnostics[0]).toMatchObject({
      code: 'FLOW_EXTENSION_NODE_COLLISION',
      severity: 'error',
    });
  });

  it('surfaces loader failures as diagnostics with an empty extension list', async () => {
    const failure: FlowDiagnostic = {
      code: 'FLOW_EXTENSION_LOAD_INVALID_JSON',
      message: 'Extension manifest "broken/extension.json" is not valid JSON.',
      severity: 'error',
      propertyPath: 'broken/extension.json',
    };
    mockedLoadAll.mockResolvedValueOnce(
      loadAllResult([], [{ extensionName: 'broken', diagnostics: [failure] }]),
    );

    const response = await GET(getRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      extensions: [],
      diagnostics: [failure],
    });
  });

  it('exposes no install or delete endpoints', () => {
    const record = routeModule as unknown as Record<string, unknown>;
    expect(typeof record['GET']).toBe('function');
    expect(record['POST']).toBeUndefined();
    expect(record['PUT']).toBeUndefined();
    expect(record['PATCH']).toBeUndefined();
    expect(record['DELETE']).toBeUndefined();
  });
});
