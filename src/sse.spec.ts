import http from 'http';
import fetch from 'node-fetch';
import { createServer } from './server';
import { Config } from './config';

async function* readSSE(body: NodeJS.ReadableStream) {
  let buffer = '';
  for await (const chunk of body) {
    buffer += chunk.toString();
    let sepIndex;
    while ((sepIndex = buffer.indexOf('\n\n')) !== -1) {
      const event = buffer.slice(0, sepIndex).trim();
      buffer = buffer.slice(sepIndex + 2);
      if (event.startsWith('data:')) {
        yield event.slice(5).trim();
      }
    }
  }
}

describe('Mock SSE provider', () => {
  let server: http.Server;
  const host = '127.0.0.1';
  const port = 0; // random

  beforeAll(async () => {
    const app = createServer({ rules: [], streaming: { chunkSize: 5, chunkIntervalMs: 10 } } as Config, host, 0);
    await new Promise<void>((resolve) => {
      server = app.listen(0, host, () => resolve());
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  function baseUrl() {
    const address = server.address();
    if (typeof address === 'string' || address == null) throw new Error('no address');
    return `http://${host}:${address.port}`;
  }

  it('streams N chunks and then [DONE]', async () => {
    const res = await fetch(`${baseUrl()}/sse/mock?count=3&intervalMs=5&prefix=test`);
    expect(res.ok).toBe(true);
    expect(res.headers.get('content-type')).toContain('text/event-stream');

    const lines: string[] = [];
    for await (const data of readSSE(res.body as unknown as NodeJS.ReadableStream)) {
      lines.push(data);
    }

    // Expect 4 SSE data events: 3 chunks + [DONE]
    expect(lines.length).toBe(4);
    const payloads = lines.slice(0, 3).map((l) => JSON.parse(l));
    expect(payloads.map(p => p.data)).toEqual(['test-0', 'test-1', 'test-2']);
    expect(lines[3]).toBe('[DONE]');
  });

  it('can inject an error and close early', async () => {
    const res = await fetch(`${baseUrl()}/sse/mock?count=5&intervalMs=5&errorAfter=2`);
    expect(res.ok).toBe(true);
    const lines: string[] = [];
    for await (const data of readSSE(res.body as unknown as NodeJS.ReadableStream)) {
      lines.push(data);
    }
    const error = JSON.parse(lines[2]);
    expect(error.error).toBe('MockError');
  });
});


