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
