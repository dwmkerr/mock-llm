import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import * as yaml from 'js-yaml';

import { createServer } from './server';
import { getDefaultConfig } from './config';

describe('server config API', () => {
  const app = createServer(getDefaultConfig(), 'localhost', 6556);
  let server: ReturnType<typeof app.listen>;
  let baseUrl: string;

  beforeAll((done) => {
    server = app.listen(0, () => {
      const address = server.address() as { port: number };
      baseUrl = `http://localhost:${address.port}`;
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  it('should GET /health', async () => {
    const response = await fetch(`${baseUrl}/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'healthy' });
  });

  it('should GET /ready', async () => {
    const response = await fetch(`${baseUrl}/ready`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ready' });
  });

  it('should GET current config as JSON by default', async () => {
    const response = await fetch(`${baseUrl}/config`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual(getDefaultConfig());
  });

  it('should GET current config as YAML when requested', async () => {
    const response = await fetch(`${baseUrl}/config`, {
      headers: { 'Accept': 'application/x-yaml' }
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/x-yaml');
    const yamlText = await response.text();
    expect(yaml.load(yamlText)).toEqual(getDefaultConfig());
  });

  it('should POST to replace config', async () => {
    const newConfig = {
      rules: [
        {
          path: '/test',
          match: '@',
          response: { status: 200, content: '{"test": true}' }
        }
      ]
    };

    const response = await fetch(`${baseUrl}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newConfig)
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(newConfig);
  });

  it('should PATCH to update config', async () => {
    const update = {
      rules: [
        {
          path: '/updated',
          match: '@',
          response: { status: 200, content: '{"updated": true}' }
        }
      ]
    };

    const response = await fetch(`${baseUrl}/config`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update)
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(update);
  });

  it('should DELETE to reset config', async () => {
    // First update config
    const newConfig = {
      rules: [
        {
          path: '/custom',
          match: '@',
          response: { status: 200, content: '{"custom": true}' }
        }
      ]
    };

    await fetch(`${baseUrl}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newConfig)
    });

    // Then reset
    const response = await fetch(`${baseUrl}/config`, {
      method: 'DELETE'
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(getDefaultConfig());
  });
});

describe('server error handling', () => {
  const app = createServer(getDefaultConfig(), 'localhost', 6556);
  let server: ReturnType<typeof app.listen>;
  let baseUrl: string;

  beforeAll((done) => {
    server = app.listen(0, () => {
      const address = server.address() as { port: number };
      baseUrl = `http://localhost:${address.port}`;
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  it('should return JSON 404 for unmatched routes', async () => {
    const response = await fetch(`${baseUrl}/nonexistent`);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: 'Not Found',
      message: 'Cannot GET /nonexistent',
      status: 404
    });
  });

  it('should return AgentNotFound for missing A2A agents', async () => {
    const response = await fetch(`${baseUrl}/a2a/agents/nonexistent-agent`);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: 'AgentNotFound',
      message: 'Agent not found at path: /agents/nonexistent-agent',
      status: 404
    });
  });

  it('should return JSON 400 for malformed JSON input', async () => {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not valid json'
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: 'SyntaxError',
      status: 400,
      message: expect.stringContaining('not valid JSON')
    });
  });

  it('should return JSON 500 for template parsing errors', async () => {
    const badConfig = {
      rules: [
        {
          path: '/v1/chat/completions',
          match: '@',
          response: {
            status: 200,
            content: '{"invalid": {{unclosed}}'
          }
        }
      ]
    };

    await fetch(`${baseUrl}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(badConfig)
    });

    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'test', messages: [] })
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      error: expect.any(String),
      message: expect.any(String),
      status: 500
    });
  });
});

describe('server jmes helper', () => {
  const app = createServer(getDefaultConfig(), 'localhost', 6556);
  let server: ReturnType<typeof app.listen>;
  let baseUrl: string;

  beforeAll((done) => {
    server = app.listen(0, () => {
      const address = server.address() as { port: number };
      baseUrl = `http://localhost:${address.port}`;
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  it('should return primitives as-is from jmes helper', async () => {
    const config = {
      rules: [{
        path: '/v1/chat/completions',
        match: '@',
        response: {
          status: 200,
          content: '{"model":"{{jmes request body.model}}"}'
        }
      }]
    };

    await fetch(`${baseUrl}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });

    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4', messages: [] })
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ model: 'gpt-4' });
  });

  it('should JSON-stringify objects from jmes helper', async () => {
    const config = {
      rules: [{
        path: '/v1/chat/completions',
        match: '@',
        response: {
          status: 200,
          content: '{"message":{{jmes request body.messages[0]}}}'
        }
      }]
    };

    await fetch(`${baseUrl}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });

    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [{ role: 'system', content: 'Test' }]
      })
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      message: { role: 'system', content: 'Test' }
    });
  });

  it('should access request object properties (body, headers, method, path)', async () => {
    const config = {
      rules: [{
        path: '/v1/chat/completions',
        match: '@',
        response: {
          status: 200,
          content: '{"model":"{{jmes request body.model}}","auth":"{{jmes request headers.authorization}}","method":"{{jmes request method}}","path":"{{jmes request path}}"}'
        }
      }]
    };

    await fetch(`${baseUrl}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });

    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-key-123'
      },
      body: JSON.stringify({ model: 'gpt-4', messages: [] })
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      model: 'gpt-4',
      auth: 'Bearer test-key-123',
      method: 'POST',
      path: '/v1/chat/completions'
    });
  });

  it('should handle missing headers gracefully', async () => {
    const config = {
      rules: [{
        path: '/v1/chat/completions',
        match: '@',
        response: {
          status: 200,
          content: '{"missing":"{{jmes request headers.nonexistent}}"}'
        }
      }]
    };

    await fetch(`${baseUrl}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });

    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4', messages: [] })
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ missing: 'null' });
  });

  it('should access query parameters', async () => {
    const config = {
      rules: [{
        path: '/v1/chat/completions',
        match: '@',
        response: {
          status: 200,
          content: '{"apikey":"{{jmes request query.apikey}}"}'
        }
      }]
    };

    await fetch(`${baseUrl}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });

    const response = await fetch(`${baseUrl}/v1/chat/completions?apikey=test-123`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4', messages: [] })
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ apikey: 'test-123' });
  });
});

describe('server sequence matching', () => {
  const app = createServer(getDefaultConfig(), 'localhost', 6556);
  let server: ReturnType<typeof app.listen>;
  let baseUrl: string;

  beforeAll((done) => {
    server = app.listen(0, () => {
      const address = server.address() as { port: number };
      baseUrl = `http://localhost:${address.port}`;
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  beforeEach(async () => {
    // Reset config and sequence counters before each test
    await fetch(`${baseUrl}/config`, { method: 'DELETE' });
  });

  it('should return different responses based on sequence number', async () => {
    const config = {
      rules: [
        {
          path: '/v1/chat/completions',
          sequence: 0,
          response: { status: 200, content: '{"response":"first"}' }
        },
        {
          path: '/v1/chat/completions',
          sequence: 1,
          response: { status: 200, content: '{"response":"second"}' }
        }
      ]
    };

    await fetch(`${baseUrl}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });

    const response1 = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4', messages: [] })
    });
    expect(await response1.json()).toEqual({ response: 'first' });

    const response2 = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4', messages: [] })
    });
    expect(await response2.json()).toEqual({ response: 'second' });
  });

  it('should reset sequence counter on DELETE /config', async () => {
    const config = {
      rules: [
        {
          path: '/v1/chat/completions',
          sequence: 0,
          response: { status: 200, content: '{"response":"first"}' }
        }
      ]
    };

    await fetch(`${baseUrl}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });

    await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4', messages: [] })
    });

    await fetch(`${baseUrl}/config`, { method: 'DELETE' });
    await fetch(`${baseUrl}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });

    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4', messages: [] })
    });
    expect(await response.json()).toEqual({ response: 'first' });
  });

  it('should allow rules without sequence to match any request', async () => {
    const config = {
      rules: [
        {
          path: '/v1/chat/completions',
          response: { status: 200, content: '{"response":"fallback"}' }
        }
      ]
    };

    await fetch(`${baseUrl}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });

    for (let i = 0; i < 3; i++) {
      const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-4', messages: [] })
      });
      expect(await response.json()).toEqual({ response: 'fallback' });
    }
  });

  it('should combine sequence with match expression', async () => {
    const config = {
      rules: [
        {
          path: '/v1/chat/completions',
          match: "contains(body.messages[-1].content, 'weather')",
          sequence: 0,
          response: { status: 200, content: '{"response":"weather-first"}' }
        },
        {
          path: '/v1/chat/completions',
          match: "contains(body.messages[-1].content, 'weather')",
          sequence: 1,
          response: { status: 200, content: '{"response":"weather-second"}' }
        }
      ]
    };

    await fetch(`${baseUrl}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });

    const response1 = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4', messages: [{ role: 'user', content: 'weather in NYC' }] })
    });
    expect(await response1.json()).toEqual({ response: 'weather-first' });

    const response2 = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4', messages: [{ role: 'user', content: 'weather in LA' }] })
    });
    expect(await response2.json()).toEqual({ response: 'weather-second' });
  });

  it('should return error when no sequence matches', async () => {
    const config = {
      rules: [
        {
          path: '/v1/chat/completions',
          sequence: 0,
          response: { status: 200, content: '{"response":"first"}' }
        }
      ]
    };

    await fetch(`${baseUrl}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });

    // First request matches
    await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4', messages: [] })
    });

    // Second request has no matching sequence
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4', messages: [] })
    });

    expect(response.status).toBe(500);
    const json = await response.json() as { message: string };
    expect(json.message).toContain('No matching rule found for request (sequence: 1)');
  });

  it('should not increment sequence counter for fallback rules (model liveness probes)', async () => {
    // This test verifies that fallback rules (without sequence) do not consume
    // sequence numbers. This is important for model liveness probes which hit
    // the same endpoint but should not affect the sequence for actual requests.
    //
    // Scenario: Sequence rules have specific match patterns (like agent system prompts),
    // fallback has no match. Probes don't match sequence rules, so only fallback handles them.
    const config = {
      rules: [
        // Fallback rule first (no sequence, no match) - handles probes and unmatched requests
        {
          path: '/v1/chat/completions',
          response: { status: 200, content: '{"response":"fallback"}' }
        },
        // Sequence rules with specific match patterns (like agent system prompts)
        {
          path: '/v1/chat/completions',
          match: "contains(body.messages[0].content || '', 'agent-a')",
          sequence: 0,
          response: { status: 200, content: '{"response":"first"}' }
        },
        {
          path: '/v1/chat/completions',
          match: "contains(body.messages[0].content || '', 'agent-b')",
          sequence: 1,
          response: { status: 200, content: '{"response":"second"}' }
        }
      ]
    };

    await fetch(`${baseUrl}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });

    // Simulate liveness probes (no agent identifier) - should hit fallback, NOT consume sequences
    const probe1 = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4', messages: [{ role: 'system', content: 'You are a helpful assistant' }] })
    });
    expect(await probe1.json()).toEqual({ response: 'fallback' });

    const probe2 = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4', messages: [{ role: 'user', content: 'ping' }] })
    });
    expect(await probe2.json()).toEqual({ response: 'fallback' });

    // Now make actual agent calls - sequence should still be at 0
    const response1 = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4', messages: [{ role: 'system', content: 'You are agent-a' }] })
    });
    expect(await response1.json()).toEqual({ response: 'first' });

    // Another probe after sequence 0 was consumed - should still NOT consume sequences
    const probe3 = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4', messages: [{ role: 'user', content: 'health check' }] })
    });
    expect(await probe3.json()).toEqual({ response: 'fallback' });

    // Sequence should still be at 1
    const response2 = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4', messages: [{ role: 'system', content: 'You are agent-b' }] })
    });
    expect(await response2.json()).toEqual({ response: 'second' });
  });
});

describe('server match expressions', () => {
  const app = createServer(getDefaultConfig(), 'localhost', 6556);
  let server: ReturnType<typeof app.listen>;
  let baseUrl: string;

  beforeAll((done) => {
    server = app.listen(0, () => {
      const address = server.address() as { port: number };
      baseUrl = `http://localhost:${address.port}`;
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  it('should match on body content', async () => {
    const config = {
      rules: [
        {
          path: '/v1/chat/completions',
          match: 'body.model',
          response: {
            status: 200,
            content: '{"result":"matched","model":"{{jmes request body.model}}"}'
          }
        }
      ]
    };

    await fetch(`${baseUrl}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });

    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4', messages: [] })
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ result: 'matched', model: 'gpt-4' });
  });

  it('should match on request method', async () => {
    const config = {
      rules: [
        {
          path: '/v1/chat/completions',
          match: 'method',
          response: {
            status: 200,
            content: '{"method":"{{jmes request method}}"}'
          }
        }
      ]
    };

    await fetch(`${baseUrl}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });

    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4', messages: [] })
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ method: 'POST' });
  });
});
