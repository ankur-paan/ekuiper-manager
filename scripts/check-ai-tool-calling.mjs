import 'dotenv/config';

function endpointFromEnvironment() {
  const value = process.env.AI_API_URL?.trim();
  if (!value) throw new Error('AI_API_URL is not configured');
  const endpoint = new URL(value);
  if (!['http:', 'https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password) {
    throw new Error('AI_API_URL is invalid');
  }
  const pathname = endpoint.pathname.replace(/\/+$/, '');
  if (/\/v1$/i.test(pathname)) endpoint.pathname = `${pathname}/chat/completions`;
  return endpoint;
}

async function providerTurn(endpoint, messages, tools) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(process.env.AI_API_KEY?.trim()
        ? { Authorization: `Bearer ${process.env.AI_API_KEY.trim()}` }
        : {}),
    },
    body: JSON.stringify({
      model: process.env.AI_MODEL,
      messages,
      max_tokens: 250,
      temperature: 0,
      stream: false,
      ...(tools ? { tools, tool_choice: 'required' } : {}),
    }),
    redirect: 'error',
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}`);
  const payload = await response.json();
  const message = payload?.choices?.[0]?.message;
  if (!message || typeof message !== 'object') throw new Error('Provider response was invalid');
  return { message, model: typeof payload.model === 'string' ? payload.model : process.env.AI_MODEL };
}

async function main() {
  if (!process.env.AI_MODEL?.trim()) throw new Error('AI_MODEL is not configured');
  const endpoint = endpointFromEnvironment();
  const tools = [{
    type: 'function',
    function: {
      name: 'synthetic_stack_read',
      description: 'Read a synthetic, non-production stack fixture for a provider compatibility test.',
      parameters: {
        type: 'object',
        properties: { section: { type: 'string', enum: ['overview'] } },
        required: ['section'],
        additionalProperties: false,
      },
    },
  }];
  const messages = [
    { role: 'system', content: 'This is a provider tool-calling compatibility test. Call the supplied synthetic read tool once, then summarize its result.' },
    { role: 'user', content: 'Inspect the synthetic stack.' },
  ];
  const first = await providerTurn(endpoint, messages, tools);
  const calls = Array.isArray(first.message.tool_calls) ? first.message.tool_calls : [];
  const call = calls.find((candidate) => candidate?.function?.name === 'synthetic_stack_read');
  if (!call?.id) throw new Error('Provider did not return the required tool call');

  messages.push({ role: 'assistant', content: first.message.content ?? null, tool_calls: calls });
  messages.push({
    role: 'tool',
    tool_call_id: call.id,
    name: 'synthetic_stack_read',
    content: JSON.stringify({
      ok: true,
      source: 'synthetic fixture',
      data: { manager: 'test-manager', ekuiperVersion: 'test-version', ruleCount: 2 },
    }),
  });
  const second = await providerTurn(endpoint, messages);
  if (typeof second.message.content !== 'string' || !second.message.content.trim()) {
    throw new Error('Provider did not answer after the synthetic tool result');
  }
  console.log(JSON.stringify({
    providerReachable: true,
    model: second.model,
    toolCalling: true,
    continuationAfterToolResult: true,
    calls: calls.map((candidate) => candidate?.function?.name).filter(Boolean),
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Provider compatibility check failed');
  process.exitCode = 1;
});
