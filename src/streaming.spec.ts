import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import OpenAI from 'openai';
import { createServer } from './server';
import { getDefaultConfig } from './config';
import type { Server } from 'http';

describe('streaming', () => {
  let server: Server;
  let client: OpenAI;
  const port = 6557;

  beforeAll((done) => {
    const config = getDefaultConfig();
    const app = createServer(config, '0.0.0.0', port);
    server = app.listen(port, () => {
      client = new OpenAI({
        apiKey: 'mock-key',
        baseURL: `http://localhost:${port}/v1`
      });
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  it('should stream with correct first and last chunk shape', async () => {
    const stream = await client.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'This is a longer message to ensure multiple chunks are generated during streaming' }],
      stream: true
    });

    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBeGreaterThan(1);

    // First chunk shape
    expect(chunks[0]).toMatchObject({
      object: 'chat.completion.chunk',
      choices: [{
        delta: { role: 'assistant' },
        finish_reason: null
      }]
    });

    // Last chunk shape
    expect(chunks[chunks.length - 1]).toMatchObject({
      choices: [{
        finish_reason: 'stop'
      }]
    });
  }, 10000);

  it('should handle errors in streaming mode', async () => {
    const config = {
      streaming: { chunkSize: 50, chunkIntervalMs: 50 },
      rules: [
        {
          path: '/v1/chat/completions',
          match: 'contains(body.messages[-1].content, `error`)',
          response: {
            status: 401,
            content: JSON.stringify({
              error: {
                message: 'Incorrect API key provided.',
                type: 'invalid_request_error',
                code: 'invalid_api_key'
              }
            })
          }
        }
      ]
    };

    const app = createServer(config, '0.0.0.0', port + 1);
    const errorServer = app.listen(port + 1);

    const errorClient = new OpenAI({
      apiKey: 'mock-key',
      baseURL: `http://localhost:${port + 1}/v1`
    });

    try {
      const stream = await errorClient.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'trigger error' }],
        stream: true
      });

      for await (const _chunk of stream) {
        // Should not reach here
      }

      expect(true).toBe(false);
    } catch (error: any) {
      expect(error).toMatchObject({
        error: {
          code: 'invalid_api_key',
          type: 'invalid_request_error',
          message: 'Incorrect API key provided.'
        }
      });
    } finally {
      errorServer.close();
    }
  }, 10000);
});
