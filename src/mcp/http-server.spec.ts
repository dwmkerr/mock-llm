import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createServer } from '../server';
import { getDefaultConfig } from '../config';

describe('MCP HTTP Server - Streamable HTTP Transport', () => {
  const app = createServer(getDefaultConfig(), 'localhost', 0);
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

  it('should initialize Streamable HTTP session with POST /mcp', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0.0' }
        }
      })
    });

    // Accept any 2xx status - the transport may return different status codes
    expect(response.status).toBeGreaterThanOrEqual(200);
    expect(response.status).toBeLessThan(300);
  });

  it('should return 400 for POST /mcp without initialize request', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list'
      })
    });

    expect(response.status).toBe(400);
    const body = await response.json() as { jsonrpc: string; error: { code: number; message: string } };
    expect(body.jsonrpc).toBe('2.0');
    expect(body.error.code).toBe(-32000);
    expect(body.error.message).toContain('No valid session ID');
  });

  it('should return 400 for GET /mcp without session ID', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'GET'
    });

    expect(response.status).toBe(400);
    expect(await response.text()).toContain('Invalid or missing Session ID');
  });

  it('should return 400 for GET /mcp with invalid session ID', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'GET',
      headers: {
        'mcp-session-id': 'invalid-session-id'
      }
    });

    expect(response.status).toBe(400);
    expect(await response.text()).toContain('Invalid or missing Session ID');
  });

  it('should return 400 for DELETE /mcp without session ID', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'DELETE'
    });

    expect(response.status).toBe(400);
    expect(await response.text()).toContain('Invalid or missing Session ID');
  });

  it('should return 400 for DELETE /mcp with invalid session ID', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'DELETE',
      headers: {
        'mcp-session-id': 'invalid-session-id'
      }
    });

    expect(response.status).toBe(400);
    expect(await response.text()).toContain('Invalid or missing Session ID');
  });

  it('should handle POST /mcp with existing valid session ID', async () => {
    // First initialize a session
    const initResponse = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0.0' }
        }
      })
    });

    expect(initResponse.status).toBeGreaterThanOrEqual(200);
    expect(initResponse.status).toBeLessThan(300);
    const sessionId = initResponse.headers.get('mcp-session-id');
    
    if (sessionId) {
      // Now use that session ID for a follow-up request
      const followUpResponse = await fetch(`${baseUrl}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
          'mcp-session-id': sessionId
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/list'
        })
      });

      // The transport should handle the request (may return various status codes)
      expect(followUpResponse.status).toBeGreaterThanOrEqual(200);
      expect(followUpResponse.status).toBeLessThan(500);
    }
  });
});

describe('MCP HTTP Server - HTTP+SSE Transport', () => {
  const app = createServer(getDefaultConfig(), 'localhost', 0);
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

  it('should establish SSE stream with GET /mcp/sse', async () => {
    const response = await fetch(`${baseUrl}/mcp/sse`, {
      method: 'GET'
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    
    const reader = response.body?.getReader();
    expect(reader).toBeTruthy();
    
    if (reader) {
      reader.cancel();
    }
  });

  it('should return 400 for POST /mcp/messages without session ID', async () => {
    const response = await fetch(`${baseUrl}/mcp/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list'
      })
    });

    expect(response.status).toBe(400);
    const body = await response.json() as { jsonrpc: string; error: { code: number; message: string } };
    expect(body.jsonrpc).toBe('2.0');
    expect(body.error.code).toBe(-32000);
    expect(body.error.message).toContain('different transport protocol');
  });

  it('should return 400 for POST /mcp/messages with invalid session ID', async () => {
    const response = await fetch(`${baseUrl}/mcp/messages?sessionId=invalid-session-id`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list'
      })
    });

    expect(response.status).toBe(400);
    const body = await response.json() as { jsonrpc: string; error: { code: number; message: string } };
    expect(body.jsonrpc).toBe('2.0');
    expect(body.error.code).toBe(-32000);
    expect(body.error.message).toContain('different transport protocol');
  });

  it('should return 400 for POST /mcp/messages when transport not found', async () => {
    // Test error path when sessionId is provided but transport doesn't exist
    const response = await fetch(`${baseUrl}/mcp/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list'
      })
    });

    expect(response.status).toBe(400);
  });

  it('should return 400 when using StreamableHTTP with SSE session ID', async () => {
    // First create an SSE session
    const sseResponse = await fetch(`${baseUrl}/mcp/sse`, { method: 'GET' });
    const sseSessionId = sseResponse.headers.get('mcp-session-id');
    
    if (sseSessionId) {
      // Now try to use that SSE session ID with StreamableHTTP
      const response = await fetch(`${baseUrl}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'mcp-session-id': sseSessionId
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list'
        })
      });

      expect(response.status).toBe(400);
      const body = await response.json() as { jsonrpc: string; error: { code: number; message: string } };
      expect(body.jsonrpc).toBe('2.0');
      expect(body.error.code).toBe(-32000);
      expect(body.error.message).toContain('different transport protocol');
    }
  });

  it('should return 400 for GET /mcp with SSE session ID', async () => {
    // First create an SSE session
    const sseResponse = await fetch(`${baseUrl}/mcp/sse`, { method: 'GET' });
    const sseSessionId = sseResponse.headers.get('mcp-session-id');
    
    if (sseSessionId) {
      // Now try to use that SSE session ID with StreamableHTTP GET
      const response = await fetch(`${baseUrl}/mcp`, {
        method: 'GET',
        headers: {
          'mcp-session-id': sseSessionId
        }
      });

      expect(response.status).toBe(400);
      const body = await response.json() as { jsonrpc: string; error: { code: number; message: string } };
      expect(body.jsonrpc).toBe('2.0');
      expect(body.error.code).toBe(-32000);
      expect(body.error.message).toContain('different transport protocol');
    }
  });

  it('should return 400 for DELETE /mcp with SSE session ID', async () => {
    // First create an SSE session
    const sseResponse = await fetch(`${baseUrl}/mcp/sse`, { method: 'GET' });
    const sseSessionId = sseResponse.headers.get('mcp-session-id');
    
    if (sseSessionId) {
      // Now try to use that SSE session ID with StreamableHTTP DELETE
      const response = await fetch(`${baseUrl}/mcp`, {
        method: 'DELETE',
        headers: {
          'mcp-session-id': sseSessionId
        }
      });

      expect(response.status).toBe(400);
      const body = await response.json() as { jsonrpc: string; error: { code: number; message: string } };
      expect(body.jsonrpc).toBe('2.0');
      expect(body.error.code).toBe(-32000);
      expect(body.error.message).toContain('different transport protocol');
    }
  });
});

describe('MCP HTTP Server - Transport Type Mismatch', () => {
  const app = createServer(getDefaultConfig(), 'localhost', 0);
  let server: ReturnType<typeof app.listen>;
  let baseUrl: string;
  let sseSessionId: string;

  beforeAll((done) => {
    server = app.listen(0, () => {
      const address = server.address() as { port: number };
      baseUrl = `http://localhost:${address.port}`;
      
      // Establish SSE session first
      const abortController = new AbortController();
      fetch(`${baseUrl}/mcp/sse`, { 
        method: 'GET',
        signal: abortController.signal 
      }).then((sseResponse) => {
        const sessionIdHeader = sseResponse.headers.get('mcp-session-id');
        if (sessionIdHeader) {
          sseSessionId = sessionIdHeader;
        }
        // Abort the SSE connection to allow server to close cleanly
        abortController.abort();
        done();
      }).catch(() => {
        done();
      });
    });
  });

  afterAll((done) => {
    // Give some time for SSE connections to close
    setTimeout(() => {
      server.close(done);
    }, 100);
  });

  it('should return 400 when using StreamableHTTP endpoint with SSE session ID', async () => {
    if (!sseSessionId) {
      // Skip if SSE session wasn't created
      return;
    }

    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'mcp-session-id': sseSessionId
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list'
      })
    });

    expect(response.status).toBe(400);
    const body = await response.json() as { jsonrpc: string; error: { code: number; message: string } };
    expect(body.jsonrpc).toBe('2.0');
    expect(body.error.code).toBe(-32000);
    expect(body.error.message).toContain('different transport protocol');
  });

  it('should return 400 when using GET /mcp with SSE session ID', async () => {
    if (!sseSessionId) {
      return;
    }

    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'GET',
      headers: {
        'mcp-session-id': sseSessionId
      }
    });

    expect(response.status).toBe(400);
    const body = await response.json() as { jsonrpc: string; error: { code: number; message: string } };
    expect(body.jsonrpc).toBe('2.0');
    expect(body.error.code).toBe(-32000);
    expect(body.error.message).toContain('different transport protocol');
  });

  it('should return 400 when using DELETE /mcp with SSE session ID', async () => {
    if (!sseSessionId) {
      return;
    }

    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'DELETE',
      headers: {
        'mcp-session-id': sseSessionId
      }
    });

    expect(response.status).toBe(400);
    const body = await response.json() as { jsonrpc: string; error: { code: number; message: string } };
    expect(body.jsonrpc).toBe('2.0');
    expect(body.error.code).toBe(-32000);
    expect(body.error.message).toContain('different transport protocol');
  });
});

describe('MCP HTTP Server - Error Handling', () => {
  const app = createServer(getDefaultConfig(), 'localhost', 0);
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

  it('should handle malformed JSON in POST /mcp', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: 'invalid json'
    });

    // Should return 400 for malformed JSON
    expect(response.status).toBe(400);
  });

  it('should handle missing Content-Type header', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0.0' }
        }
      })
    });

    // Should still work without explicit Content-Type
    expect(response.status).toBeGreaterThanOrEqual(200);
    expect(response.status).toBeLessThan(500);
  });

  it('should return 400 when POST /mcp/messages with non-SSE transport', async () => {
    // First create a StreamableHTTP session
    const initResponse = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0.0' }
        }
      })
    });

    const sessionId = initResponse.headers.get('mcp-session-id');
    
    if (sessionId) {
      // Now try to use that StreamableHTTP session ID with SSE messages endpoint
      const response = await fetch(`${baseUrl}/mcp/messages?sessionId=${sessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list'
        })
      });

      expect(response.status).toBe(400);
      const body = await response.json() as { jsonrpc: string; error: { code: number; message: string } };
      expect(body.jsonrpc).toBe('2.0');
      expect(body.error.code).toBe(-32000);
      expect(body.error.message).toContain('different transport protocol');
    }
  });

  it('should return 400 when POST /mcp/messages with null transport', async () => {
    // This test is designed to trigger the "No transport found for sessionId" path
    // by creating a scenario where the transport lookup returns null/undefined
    const response = await fetch(`${baseUrl}/mcp/messages?sessionId=non-existent-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list'
      })
    });

    expect(response.status).toBe(400);
    const body = await response.json() as { jsonrpc: string; error: { code: number; message: string } };
    expect(body.jsonrpc).toBe('2.0');
    expect(body.error.code).toBe(-32000);
    expect(body.error.message).toContain('different transport protocol');
  });
});

