import http from 'http';
import fetch from 'node-fetch';
import { createServer } from '../server';
import { Config } from '../config';

async function* readSSE(body: NodeJS.ReadableStream) {
  let buffer = '';
  for await (const chunk of body) {
    buffer += chunk.toString();
    let idx;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const event = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const lines = event.split(/\r?\n/);
      const idLine = lines.find(l => l.startsWith('id:')) || '';
      const dataLines = lines.filter(l => l.startsWith('data:')).map(l => l.slice(5).trim());
      const id = idLine ? idLine.slice(3).trim() : '';
      const payload = dataLines.join('\n');
      yield { id, data: payload };
    }
  }
}

describe('MCP SSE transport', () => {
  jest.setTimeout(20000);
  let server: http.Server;
  const host = '127.0.0.1';

  beforeAll(async () => {
    const app = createServer({ rules: [], streaming: { chunkSize: 5, chunkIntervalMs: 5 } } as Config, host, 0);
    await new Promise<void>((resolve) => {
      server = app.listen(0, host, () => resolve());
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  function baseUrl() {
    const addr = server.address();
    if (addr == null || typeof addr === 'string') throw new Error('no address');
    return `http://${host}:${addr.port}`;
  }

  it('initializes session, streams messages, and supports replay', async () => {
    // init
    const initRes = await fetch(`${baseUrl()}/mcp/sse/init`, { method: 'POST' });
    expect(initRes.ok).toBe(true);
    const { sessionId } = await initRes.json() as any;
    expect(sessionId).toBeTruthy();

    // send 2 messages first (so replay can validate)
    const send1 = await fetch(`${baseUrl()}/mcp/sse/send?sessionId=${sessionId}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'm1', jsonrpc: '2.0', method: 'ping' })
    });
    expect(send1.status).toBe(202);
    const send2 = await fetch(`${baseUrl()}/mcp/sse/send?sessionId=${sessionId}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'm2', jsonrpc: '2.0', result: 'ok' })
    });
    expect(send2.status).toBe(202);

    // start stream and expect immediate replay of both
    const ctrl1 = new AbortController();
    const streamRes = await fetch(`${baseUrl()}/mcp/sse/stream?sessionId=${sessionId}` , { signal: ctrl1.signal });
    expect(streamRes.ok).toBe(true);
    expect(streamRes.headers.get('content-type')).toContain('text/event-stream');

    const got: any[] = [];
    const reader = streamRes.body as unknown as NodeJS.ReadableStream;
    for await (const evt of readSSE(reader)) {
      got.push(evt);
      if (got.length >= 2) break;
    }
    // stop the stream to avoid leaking
    ctrl1.abort();
    expect(got.map(g => g.id)).toEqual(['m1', 'm2']);

    // replay from m1 (should get m2 only)
    const ctrl2 = new AbortController();
    const replay = await fetch(`${baseUrl()}/mcp/sse/stream?sessionId=${sessionId}&fromId=m1`, { signal: ctrl2.signal });
    const replayLines: any[] = [];
    for await (const evt of readSSE(replay.body as unknown as NodeJS.ReadableStream)) {
      replayLines.push(evt);
      break;
    }
    expect(replayLines[0].id).toBe('m2');
    ctrl2.abort();
  });
});


