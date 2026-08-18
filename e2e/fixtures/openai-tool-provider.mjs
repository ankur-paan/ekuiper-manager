import { createServer } from 'node:http';

const port = Number(process.env.PORT ?? 8080);

function respond(response, status, payload) {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(payload));
}

const server = createServer((request, response) => {
  if (request.method !== 'POST' || request.url !== '/v1/chat/completions') {
    respond(response, 404, { error: { message: 'Not found' } });
    return;
  }
  let body = '';
  request.setEncoding('utf8');
  request.on('data', (chunk) => {
    body += chunk;
    if (body.length > 512 * 1024) request.destroy();
  });
  request.on('end', () => {
    let payload;
    try {
      payload = JSON.parse(body);
    } catch {
      respond(response, 400, { error: { message: 'Invalid JSON' } });
      return;
    }
    const messages = Array.isArray(payload.messages) ? payload.messages : [];
    const toolMessages = messages.filter((message) => message?.role === 'tool');
    if (toolMessages.length === 0) {
      respond(response, 200, {
        model: 'local-agent-integration-stub',
        choices: [{
          finish_reason: 'tool_calls',
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              { id: 'local-overview', type: 'function', function: { name: 'manager_overview', arguments: '{}' } },
              { id: 'local-version', type: 'function', function: { name: 'ekuiper_read', arguments: '{"path":"/"}' } },
              { id: 'local-rules', type: 'function', function: { name: 'ekuiper_read', arguments: '{"path":"/rules"}' } },
            ],
          },
        }],
      });
      return;
    }

    const failed = toolMessages.filter((message) => {
      try {
        return JSON.parse(message.content)?.ok === false;
      } catch {
        return true;
      }
    });
    respond(response, 200, {
      model: 'local-agent-integration-stub',
      choices: [{
        finish_reason: 'stop',
        message: {
          role: 'assistant',
          content: failed.length > 0
            ? `## Local integration result\n\n${failed.length} of ${toolMessages.length} read-only tools failed.\n\n<!-- follow-ups: ["Show the failed reads"] -->`
            : `## Local integration result\n\nManager/PostgreSQL overview, eKuiper system information, and the live rule inventory were read successfully through ${toolMessages.length} tool calls.\n\n<!-- follow-ups: ["Inspect rule status next"] -->`,
        },
      }],
    });
  });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Local OpenAI-compatible tool provider listening on ${port}`);
});
