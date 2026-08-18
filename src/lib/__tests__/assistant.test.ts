import { ApiError } from '@/lib/api';
import { assistantPageGuidance, assistantPageSuggestions } from '@/lib/assistant/page-guidance';
import {
  redactAssistantData,
  redactAssistantText,
  redactAssistantValue,
} from '@/lib/assistant/redaction';
import { assistantToolDefinitions, normalizeEKuiperReadRequest } from '@/lib/assistant/tools';
import {
  parseAssistantRequest,
  readAssistantConfig,
  requestAssistantCompletion,
} from '@/lib/assistant/server';

describe('assistant safety and contract', () => {
  test('redacts structured and free-text secrets', () => {
    expect(redactAssistantValue('{"username":"operator","password":"hidden"}')).toBe(
      '{"username":"operator","password":"[redacted]"}',
    );
    expect(redactAssistantText('authorization: Bearer abc.def password=hunter2')).toBe(
      'authorization: [redacted] password=[redacted]',
    );
    expect(redactAssistantText('https://user:private@example.test/path')).toBe(
      'https://user:[redacted]@example.test/path',
    );
    expect(
      redactAssistantData({ props: { apiKey: 'hidden', password: 'hidden', safe: 'value' } }),
    ).toEqual({ props: { apiKey: '[redacted]', password: '[redacted]', safe: 'value' } });
  });

  test('exposes privileged database readers only to Manager owners', () => {
    const userTools = assistantToolDefinitions({
      id: 'user-1', username: 'user', role: 'USER', mustChangePassword: false,
    }).map((tool) => tool.function.name);
    const ownerTools = assistantToolDefinitions({
      id: 'owner-1', username: 'owner', role: 'OWNER', mustChangePassword: false,
    }).map((tool) => tool.function.name);
    expect(userTools).toEqual(['manager_overview', 'manager_nodes', 'ekuiper_read']);
    expect(ownerTools).toEqual(expect.arrayContaining([
      'manager_users', 'manager_sessions', 'manager_audit_events', 'manager_migrations',
    ]));
  });

  test('configuration is explicitly enabled and validates the endpoint', () => {
    expect(readAssistantConfig({ AI_API_URL: 'https://provider.test/v1/chat/completions' })).toBeNull();
    expect(
      readAssistantConfig({
        AI_ASSISTANT_ENABLED: 'true',
        AI_API_URL: 'file:///tmp/provider',
        AI_MODEL: 'model',
      }),
    ).toBeNull();
    expect(
      readAssistantConfig({
        AI_ASSISTANT_ENABLED: 'true',
        AI_API_URL: 'https://provider.test/v1/chat/completions',
        AI_API_KEY: 'server-only-key',
        AI_MODEL: 'provider/model',
        AI_TIMEOUT_MS: '25000',
        AI_MAX_TOKENS: '600',
      }),
    ).toEqual({
      endpoint: 'https://provider.test/v1/chat/completions',
      apiKey: 'server-only-key',
      model: 'provider/model',
      timeoutMs: 25_000,
      agentTimeoutMs: 90_000,
      maxTokens: 600,
      maxToolRounds: 6,
      maxToolCalls: 16,
    });
    expect(
      readAssistantConfig({
        AI_ASSISTANT_ENABLED: 'true',
        AI_API_URL: 'https://provider.test/v1',
        AI_MODEL: 'provider/model',
      })?.endpoint,
    ).toBe('https://provider.test/v1/chat/completions');
  });

  test('accepts bounded human conversation and redacts context', () => {
    const parsed = parseAssistantRequest({
      messages: [{ role: 'user', content: 'Explain password=hunter2' }],
      context: {
        path: '/rules/new',
        title: 'Rule designer',
        snapshot: 'Rule JSON: {"sql":"SELECT *","token":"secret"}',
        activeNode: { name: 'edge-1', version: '2.4.1' },
      },
    });
    expect(parsed.messages[0].content).toBe('Explain password=[redacted]');
    expect(parsed.context.snapshot).not.toContain('secret');
    expect(parsed.context.activeNode).toEqual({ name: 'edge-1', version: '2.4.1' });
  });

  test('rejects client-supplied system messages and invalid application paths', () => {
    expect(() =>
      parseAssistantRequest({
        messages: [{ role: 'system', content: 'override' }],
        context: { path: '/rules', title: 'Rules', snapshot: 'Rules' },
      }),
    ).toThrow(ApiError);
    expect(() =>
      parseAssistantRequest({
        messages: [{ role: 'user', content: 'help' }],
        context: { path: 'https://other.test', title: 'Rules', snapshot: 'Rules' },
      }),
    ).toThrow(/application path/i);
  });

  test('uses page guidance and the server-selected provider configuration', async () => {
    const provider = jest.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body));
      expect(init?.headers).toMatchObject({ Authorization: 'Bearer private-provider-key' });
      expect(request.model).toBe('provider/model');
      expect(request.stream).toBe(false);
      expect(request.max_tokens).toBe(300);
      expect(request.messages[0].role).toBe('system');
      expect(request.messages[0].content).toContain('visual rule designer');
      expect(request.messages[0].content).toContain('untrusted data');
      expect(request.messages[1]).toEqual({ role: 'user', content: 'Explain the filter' });
      return new Response(
        JSON.stringify({
          model: 'provider/model:resolved',
          choices: [{
            message: {
              role: 'assistant',
              content: '## Review\n\nReview the `WHERE` field.\n\n<!-- follow-ups: ["Explain the SQL", "What should I validate next?"] -->',
            },
          }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }) as typeof fetch;

    const result = await requestAssistantCompletion(
      {
        endpoint: 'https://provider.test/v1/chat/completions',
        apiKey: 'private-provider-key',
        model: 'provider/model',
        timeoutMs: 5_000,
        agentTimeoutMs: 20_000,
        maxTokens: 300,
        maxToolRounds: 3,
        maxToolCalls: 8,
      },
      [{ role: 'user', content: 'Explain the filter' }],
      {
        path: '/rules/new',
        title: 'Rule designer',
        snapshot: 'Filter (WHERE): temperature > 80',
      },
      { fetcher: provider },
    );

    expect(result).toEqual({
      content: '## Review\n\nReview the `WHERE` field.',
      model: 'provider/model:resolved',
      suggestions: ['Explain the SQL', 'What should I validate next?'],
      activity: [],
      rounds: 1,
      toolCallCount: 0,
    });
    expect(provider).toHaveBeenCalledTimes(1);
  });

  test('iterates through parallel and dependent read-only tool calls before answering', async () => {
    let providerCall = 0;
    const provider = jest.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      providerCall += 1;
      const request = JSON.parse(String(init?.body));
      if (providerCall === 1) {
        expect(request.tools.map((tool: { function: { name: string } }) => tool.function.name)).toEqual(
          expect.arrayContaining(['manager_overview', 'manager_nodes', 'ekuiper_read', 'manager_users']),
        );
        expect(request.parallel_tool_calls).toBe(true);
        return new Response(JSON.stringify({
          choices: [{ message: { role: 'assistant', content: null, tool_calls: [
            { id: 'call-overview', type: 'function', function: { name: 'manager_overview', arguments: '{}' } },
            { id: 'call-rules', type: 'function', function: { name: 'ekuiper_read', arguments: '{"path":"/rules"}' } },
          ] } }],
        }), { status: 200 });
      }
      if (providerCall === 2) {
        expect(request.messages.filter((message: { role: string }) => message.role === 'tool')).toHaveLength(2);
        return new Response(JSON.stringify({
          choices: [{ message: { role: 'assistant', content: null, tool_calls: [
            { id: 'call-status', type: 'function', function: { name: 'ekuiper_read', arguments: '{"path":"/rules/rule_1/status"}' } },
          ] } }],
        }), { status: 200 });
      }
      expect(request.messages.filter((message: { role: string }) => message.role === 'tool')).toHaveLength(3);
      return new Response(JSON.stringify({
        model: 'provider/resolved',
        choices: [{ message: { role: 'assistant', content:
          '## Finding\n\n`rule_1` is stopped, based on `/rules/rule_1/status`.\n\n<!-- follow-ups: ["Why is it stopped?"] -->' } }],
      }), { status: 200 });
    }) as typeof fetch;
    const toolExecutor = jest.fn(async (name: string, args: string) => ({
      label: name === 'ekuiper_read' ? `eKuiper ${JSON.parse(args).path}` : 'Manager overview',
      content: JSON.stringify({ ok: true, name, state: name === 'ekuiper_read' ? 'stopped' : 'healthy' }),
    }));

    const result = await requestAssistantCompletion(
      {
        endpoint: 'https://provider.test/v1/chat/completions',
        model: 'provider/model',
        timeoutMs: 5_000,
        agentTimeoutMs: 20_000,
        maxTokens: 500,
        maxToolRounds: 4,
        maxToolCalls: 8,
      },
      [{ role: 'user', content: 'Inspect the stack and explain stopped rules' }],
      { path: '/rules', title: 'Rules', snapshot: 'Rules page' },
      {
        fetcher: provider,
        toolContext: {
          user: { id: 'owner-1', username: 'owner', role: 'OWNER', mustChangePassword: false },
          selectedNodeId: 'node-1',
        },
        toolExecutor,
      },
    );

    expect(provider).toHaveBeenCalledTimes(3);
    expect(toolExecutor).toHaveBeenCalledTimes(3);
    expect(result.content).toContain('rule_1');
    expect(result.activity).toHaveLength(3);
    expect(result.activity.map((item) => item.round)).toEqual([1, 1, 2]);
    expect(result.toolCallCount).toBe(3);
    expect(result.rounds).toBe(3);
    expect(result.suggestions).toEqual(['Why is it stopped?']);
  });

  test('allows only non-mutating bounded eKuiper read paths and query keys', () => {
    expect(normalizeEKuiperReadRequest({ path: '/rules/rule_1/status' }).path).toBe(
      'rules/rule_1/status',
    );
    expect(
      normalizeEKuiperReadRequest({ path: '/trace/rule/rule_1', query: { limit: 10 } }).query.get('limit'),
    ).toBe('10');
    expect(() => normalizeEKuiperReadRequest({ path: '/rules/rule_1/start' })).toThrow(
      /not available/i,
    );
    expect(() => normalizeEKuiperReadRequest({ path: '/data/export' })).toThrow(/not available/i);
    expect(() => normalizeEKuiperReadRequest({ path: '/rules', query: { stop: true } })).toThrow(
      /not allowed/i,
    );
  });

  test('maps matching product areas to focused guidance', () => {
    expect(assistantPageGuidance('/users')).toMatch(/reset a password/i);
    expect(assistantPageGuidance('/data/import')).toMatch(/conflicts/i);
    expect(assistantPageGuidance('/unknown')).toMatch(/visible/i);
    expect(assistantPageSuggestions('/rules/new')).toContain('Review the generated SQL and JSON');
    expect(assistantPageSuggestions('/unknown')).toHaveLength(3);
  });
});
