import { ApiError } from '@/lib/api';
import { assertSafeNodeDestination } from '@/lib/network';
import { getNodeWithAuthorization } from '@/lib/nodes';
import {
  FLOW_EKUIPER_VALIDATION_FAILED,
  MAX_EKUIPER_VALIDATION_ERROR_CHARS,
  sanitizeEkuiperValidationDetail,
  validateCompiledArtifactWithEkuiper,
} from '@/lib/flows/deployments/ekuiper-validation';

jest.mock('@/lib/nodes', () => ({ getNodeWithAuthorization: jest.fn() }));
jest.mock('@/lib/network', () => ({ assertSafeNodeDestination: jest.fn() }));

const mockedGetNodeWithAuthorization = jest.mocked(getNodeWithAuthorization);
const mockedAssertDestination = jest.mocked(assertSafeNodeDestination);

function registeredNode(authorization: string | null = 'Bearer stored-token') {
  return {
    node: {
      id: 'node-1',
      name: 'edge-node',
      baseUrl: 'http://edge-node:9081',
      description: null,
      hasAuthorization: authorization !== null,
      isDefault: true,
      status: 'ONLINE' as const,
      version: '2.4.1',
      capabilities: {},
      lastCheckedAt: null,
      lastError: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
    authorization,
  };
}

function ruleDefinition() {
  return {
    graph: {
      nodes: {
        source_memory_abc: { type: 'source', nodeType: 'memory', props: { datasource: 'raw-events' } },
        sink_memory_def: { type: 'sink', nodeType: 'memory', props: { topic: 'processed-events' } },
      },
      topo: { sources: ['source_memory_abc'], edges: { source_memory_abc: ['sink_memory_def'] } },
    },
  };
}

function jsonResponse(status: number, payload: unknown): Response {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return new Response(text, {
    status,
    headers: { 'Content-Type': 'text/plain' },
  });
}

beforeEach(() => {
  mockedGetNodeWithAuthorization.mockReset();
  mockedAssertDestination.mockReset();
  mockedAssertDestination.mockResolvedValue(undefined);
  mockedGetNodeWithAuthorization.mockResolvedValue(registeredNode());
  jest.restoreAllMocks();
});

describe('validateCompiledArtifactWithEkuiper', () => {
  it('uses the registered-node authorization boundary and never a caller URL', async () => {
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(200, { sources: ['raw-events'], valid: true }));

    const input = {
      targetNodeId: 'node-1',
      ruleId: 'flow-1',
      ruleDefinition: ruleDefinition(),
      // A caller-supplied URL must be ignored: the adapter has no such
      // parameter and always derives the destination from the registry.
      url: 'https://evil.test/rules/validate',
    } as unknown as { targetNodeId: string; ruleId: string; ruleDefinition: Record<string, unknown> };

    const result = await validateCompiledArtifactWithEkuiper(input);

    expect(mockedGetNodeWithAuthorization).toHaveBeenCalledTimes(1);
    expect(mockedGetNodeWithAuthorization).toHaveBeenCalledWith('node-1');
    expect(mockedAssertDestination).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [target, init] = fetchSpy.mock.calls[0] as [URL, RequestInit];
    expect(String(target)).toBe('http://edge-node:9081/rules/validate');
    expect(String(target)).not.toContain('evil.test');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer stored-token');
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body.id).toBe('flow-1');
    expect(body.graph).toEqual(ruleDefinition().graph);
    expect(result).toEqual({ valid: true, diagnostics: [], sources: ['raw-events'] });
  });

  it('returns valid=false with a structured diagnostic on eKuiper rejection', async () => {
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(422, 'missing server property'));
    const definition = ruleDefinition();
    const snapshot = JSON.parse(JSON.stringify(definition)) as unknown;

    const result = await validateCompiledArtifactWithEkuiper({
      targetNodeId: 'node-1',
      ruleId: 'flow-1',
      ruleDefinition: definition,
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]?.code).toBe(FLOW_EKUIPER_VALIDATION_FAILED);
      expect(result.diagnostics[0]?.severity).toBe('error');
      expect(result.diagnostics[0]?.message).toContain('missing server property');
    }
    // The compiled artifact is never mutated by validation.
    expect(definition).toEqual(snapshot);
    // Rejection path never touches rule create/update endpoints.
    expect(String((fetchSpy.mock.calls[0] as [URL, RequestInit])[0])).toBe(
      'http://edge-node:9081/rules/validate',
    );
  });

  it('treats HTTP 400 as a validation rejection without throwing', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse(400, JSON.stringify({ error: 'invalid rule payload' })),
      );

    const result = await validateCompiledArtifactWithEkuiper({
      targetNodeId: 'node-1',
      ruleId: 'flow-1',
      ruleDefinition: ruleDefinition(),
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.diagnostics[0]?.code).toBe(FLOW_EKUIPER_VALIDATION_FAILED);
      expect(result.diagnostics[0]?.message).toContain('invalid rule payload');
    }
  });

  it('bounds and redacts rejection detail instead of echoing secrets', async () => {
    const raw = `422 invalid: {"password":"hunter2"} Authorization: Bearer abc.def ${'x'.repeat(5000)}`;
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse(422, raw));

    const result = await validateCompiledArtifactWithEkuiper({
      targetNodeId: 'node-1',
      ruleId: 'flow-1',
      ruleDefinition: ruleDefinition(),
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      const message = result.diagnostics[0]?.message ?? '';
      expect(message.length).toBeLessThanOrEqual(
        MAX_EKUIPER_VALIDATION_ERROR_CHARS + 'eKuiper rejected the compiled rule: '.length,
      );
      expect(message).not.toContain('hunter2');
      expect(message).not.toContain('Bearer abc.def');
      expect(message).toContain('[redacted]');
    }
  });

  it('throws a server-safe error on unexpected upstream status', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse(500, 'boom'));

    await expect(
      validateCompiledArtifactWithEkuiper({
        targetNodeId: 'node-1',
        ruleId: 'flow-1',
        ruleDefinition: ruleDefinition(),
      }),
    ).rejects.toMatchObject({ name: 'Error', status: 502 });
  });

  it('maps transport failures to server-safe errors', async () => {
    jest.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('fetch failed'));

    const error = await validateCompiledArtifactWithEkuiper({
      targetNodeId: 'node-1',
      ruleId: 'flow-1',
      ruleDefinition: ruleDefinition(),
    }).catch((failure: unknown) => failure);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(502);
  });

  it('rejects invalid input without contacting eKuiper', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');

    await expect(
      validateCompiledArtifactWithEkuiper({ targetNodeId: '   ', ruleId: 'flow-1', ruleDefinition: ruleDefinition() }),
    ).rejects.toThrow('targetNodeId is required');
    await expect(
      validateCompiledArtifactWithEkuiper({ targetNodeId: 'node-1', ruleId: '', ruleDefinition: ruleDefinition() }),
    ).rejects.toThrow('ruleId is required');
    await expect(
      validateCompiledArtifactWithEkuiper({ targetNodeId: 'node-1', ruleId: 'flow-1', ruleDefinition: [] }),
    ).rejects.toThrow('ruleDefinition must be an object');

    expect(mockedGetNodeWithAuthorization).not.toHaveBeenCalled();
    expect(mockedAssertDestination).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sanitizes non-string failures with a bound', () => {
    expect(sanitizeEkuiperValidationDetail(new Error('boom'))).toContain('boom');
    expect(sanitizeEkuiperValidationDetail('   ')).toBe('eKuiper rejected the compiled rule');
    expect(sanitizeEkuiperValidationDetail('y'.repeat(MAX_EKUIPER_VALIDATION_ERROR_CHARS + 100))).toHaveLength(
      MAX_EKUIPER_VALIDATION_ERROR_CHARS,
    );
  });
});
