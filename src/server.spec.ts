import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import * as yaml from 'js-yaml';
import { createServer } from './server';
import { getDefaultConfig } from './config';

describe('server config API', () => {
  const app = createServer(getDefaultConfig());
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
  const app = createServer(getDefaultConfig());
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
  const app = createServer(getDefaultConfig());
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

describe('server match expressions', () => {
  const app = createServer(getDefaultConfig());
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
