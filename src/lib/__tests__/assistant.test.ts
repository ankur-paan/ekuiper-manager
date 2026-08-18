import { ApiError } from '@/lib/api';
import { assistantPageGuidance, assistantPageSuggestions } from '@/lib/assistant/page-guidance';
import { redactAssistantText, redactAssistantValue } from '@/lib/assistant/redaction';
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
      maxTokens: 600,
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
        maxTokens: 300,
      },
      [{ role: 'user', content: 'Explain the filter' }],
      {
        path: '/rules/new',
        title: 'Rule designer',
        snapshot: 'Filter (WHERE): temperature > 80',
      },
      provider,
    );

    expect(result).toEqual({
      content: '## Review\n\nReview the `WHERE` field.',
      model: 'provider/model:resolved',
      suggestions: ['Explain the SQL', 'What should I validate next?'],
    });
    expect(provider).toHaveBeenCalledTimes(1);
  });

  test('maps matching product areas to focused guidance', () => {
    expect(assistantPageGuidance('/users')).toMatch(/reset a password/i);
    expect(assistantPageGuidance('/data/import')).toMatch(/conflicts/i);
    expect(assistantPageGuidance('/unknown')).toMatch(/visible/i);
    expect(assistantPageSuggestions('/rules/new')).toContain('Review the generated SQL and JSON');
    expect(assistantPageSuggestions('/unknown')).toHaveLength(3);
  });
});
