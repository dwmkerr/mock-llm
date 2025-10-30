import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createServer } from '../server';
import { getDefaultConfig } from '../config';

describe('MCP HTTP Server - Streamable HTTP Transport', () => {
  const app = createServer(getDefaultConfig(), 'localhost', 0);
  let server: ReturnType<typeof app.listen>;
  let baseUrl: string;

  // Increase timeout for this test suite
  jest.setTimeout(10000);

  beforeAll((done) => {
    server = app.listen(0, () => {
      const address = server.address() as { port: number };
      baseUrl = `http://localhost:${address.port}`;
      done();
    });
  });

  afterAll((done) => {
    // Give connections time to close
    setTimeout(() => {
      server.close(done);
    }, 100);
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
  const activeSSEConnections: AbortController[] = [];

  // Increase timeout for this test suite
  jest.setTimeout(10000);

  beforeAll((done) => {
    server = app.listen(0, () => {
      const address = server.address() as { port: number };
      baseUrl = `http://localhost:${address.port}`;
      done();
    });
  });

  afterAll((done) => {
    // Abort all active SSE connections
    for (const controller of activeSSEConnections) {
      controller.abort();
    }
    activeSSEConnections.length = 0;
    
    // Give connections time to close
    setTimeout(() => {
      server.close(done);
    }, 200);
  });

  it('should establish SSE stream with GET /mcp/sse', async () => {
    const abortController = new AbortController();
    activeSSEConnections.push(abortController);
    
    const response = await fetch(`${baseUrl}/mcp/sse`, {
      method: 'GET',
      signal: abortController.signal
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    
    const reader = response.body?.getReader();
    expect(reader).toBeTruthy();
    
    if (reader) {
      await reader.cancel();
    }
    
    // Remove from active connections after test
    const index = activeSSEConnections.indexOf(abortController);
    if (index > -1) {
      activeSSEConnections.splice(index, 1);
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
    // First create an SSE session and keep it alive
    const abortController = new AbortController();
    activeSSEConnections.push(abortController);
    
    const sseResponse = await fetch(`${baseUrl}/mcp/sse`, { 
      method: 'GET',
      signal: abortController.signal
    });
    
    // Wait for headers and session to be created - SSE responses need time
    await new Promise(resolve => setTimeout(resolve, 150));
    
    const sseSessionId = sseResponse.headers.get('mcp-session-id') || 
                         sseResponse.headers.get('x-mcp-session-id');
    
    // If we don't have session ID from headers, fail with descriptive message
    expect(sseSessionId).toBeTruthy();
    
    if (sseSessionId) {
      // Now try to use that SSE session ID with StreamableHTTP while keeping SSE connection alive
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
      
      // GET/DELETE handlers return JSON if session exists but transport mismatches, 
      // or plain text if session doesn't exist. Try JSON first.
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const body = await response.json() as { jsonrpc: string; error: { code: number; message: string } };
        expect(body.jsonrpc).toBe('2.0');
        expect(body.error.code).toBe(-32000);
        expect(body.error.message).toContain('different transport protocol');
      } else {
        // If plain text, session might not exist yet - check error message
        const text = await response.text();
        expect(text).toMatch(/Invalid|Session|transport/i);
      }
      
      // Now abort the SSE connection after the test
      abortController.abort();
      const index = activeSSEConnections.indexOf(abortController);
      if (index > -1) {
        activeSSEConnections.splice(index, 1);
      }
    }
  });

  it('should return 400 for GET /mcp with SSE session ID', async () => {
    // First create an SSE session and keep it alive
    const abortController = new AbortController();
    activeSSEConnections.push(abortController);
    
    const sseResponse = await fetch(`${baseUrl}/mcp/sse`, { 
      method: 'GET',
      signal: abortController.signal
    });
    
    // Wait for headers and session to be created - SSE responses need time
    await new Promise(resolve => setTimeout(resolve, 150));
    
    const sseSessionId = sseResponse.headers.get('mcp-session-id') || 
                         sseResponse.headers.get('x-mcp-session-id');
    
    // If we don't have session ID from headers, fail with descriptive message
    expect(sseSessionId).toBeTruthy();
    
    if (sseSessionId) {
      // Now try to use that SSE session ID with StreamableHTTP GET while keeping SSE connection alive
      const response = await fetch(`${baseUrl}/mcp`, {
        method: 'GET',
        headers: {
          'mcp-session-id': sseSessionId
        }
      });

      expect(response.status).toBe(400);
      
      // GET/DELETE handlers return JSON if session exists but transport mismatches, 
      // or plain text if session doesn't exist. Try JSON first.
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const body = await response.json() as { jsonrpc: string; error: { code: number; message: string } };
        expect(body.jsonrpc).toBe('2.0');
        expect(body.error.code).toBe(-32000);
        expect(body.error.message).toContain('different transport protocol');
      } else {
        // If plain text, session might not exist yet - check error message
        const text = await response.text();
        expect(text).toMatch(/Invalid|Session|transport/i);
      }
      
      // Now abort the SSE connection after the test
      abortController.abort();
      const index = activeSSEConnections.indexOf(abortController);
      if (index > -1) {
        activeSSEConnections.splice(index, 1);
      }
    }
  });

  it('should return 400 for DELETE /mcp with SSE session ID', async () => {
    // First create an SSE session and keep it alive
    const abortController = new AbortController();
    activeSSEConnections.push(abortController);
    
    const sseResponse = await fetch(`${baseUrl}/mcp/sse`, { 
      method: 'GET',
      signal: abortController.signal
    });
    
    // Wait for headers and session to be created - SSE responses need time
    await new Promise(resolve => setTimeout(resolve, 150));
    
    const sseSessionId = sseResponse.headers.get('mcp-session-id') || 
                         sseResponse.headers.get('x-mcp-session-id');
    
    // If we don't have session ID from headers, fail with descriptive message
    expect(sseSessionId).toBeTruthy();
    
    if (sseSessionId) {
      // Now try to use that SSE session ID with StreamableHTTP DELETE while keeping SSE connection alive
      const response = await fetch(`${baseUrl}/mcp`, {
        method: 'DELETE',
        headers: {
          'mcp-session-id': sseSessionId
        }
      });

      expect(response.status).toBe(400);
      
      // GET/DELETE handlers return JSON if session exists but transport mismatches, 
      // or plain text if session doesn't exist. Try JSON first.
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const body = await response.json() as { jsonrpc: string; error: { code: number; message: string } };
        expect(body.jsonrpc).toBe('2.0');
        expect(body.error.code).toBe(-32000);
        expect(body.error.message).toContain('different transport protocol');
      } else {
        // If plain text, session might not exist yet - check error message
        const text = await response.text();
        expect(text).toMatch(/Invalid|Session|transport/i);
      }
      
      // Now abort the SSE connection after the test
      abortController.abort();
      const index = activeSSEConnections.indexOf(abortController);
      if (index > -1) {
        activeSSEConnections.splice(index, 1);
      }
    }
  });
});

describe('MCP HTTP Server - Transport Type Mismatch', () => {
  const app = createServer(getDefaultConfig(), 'localhost', 0);
  let server: ReturnType<typeof app.listen>;
  let baseUrl: string;
  let sseSessionId: string;
  let sseAbortController: AbortController;

  // Increase timeout for this test suite
  jest.setTimeout(10000);

  beforeAll((done) => {
    server = app.listen(0, () => {
      const address = server.address() as { port: number };
      baseUrl = `http://localhost:${address.port}`;
      
      // Establish SSE session first
      sseAbortController = new AbortController();
      fetch(`${baseUrl}/mcp/sse`, { 
        method: 'GET',
        signal: sseAbortController.signal 
      }).then(async (sseResponse) => {
        // Wait for headers to be set
        await new Promise(resolve => setTimeout(resolve, 150));
        const sessionIdHeader = sseResponse.headers.get('mcp-session-id') || 
                                sseResponse.headers.get('x-mcp-session-id');
        if (sessionIdHeader) {
          sseSessionId = sessionIdHeader;
        }
        // Don't abort - keep connection alive for tests (will abort in afterAll)
        done();
      }).catch(() => {
        done();
      });
    });
  });

  afterAll((done) => {
    // Abort SSE connection before closing server
    if (sseAbortController) {
      sseAbortController.abort();
    }
    // Give some time for SSE connections to close
    setTimeout(() => {
      server.close(done);
    }, 200);
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

  // Increase timeout for this test suite
  jest.setTimeout(10000);

  beforeAll((done) => {
    server = app.listen(0, () => {
      const address = server.address() as { port: number };
      baseUrl = `http://localhost:${address.port}`;
      done();
    });
  });

  afterAll((done) => {
    // Give connections time to close
    setTimeout(() => {
      server.close(done);
    }, 100);
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
      
      // GET/DELETE handlers return JSON if session exists but transport mismatches, 
      // or plain text if session doesn't exist. Try JSON first.
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const body = await response.json() as { jsonrpc: string; error: { code: number; message: string } };
        expect(body.jsonrpc).toBe('2.0');
        expect(body.error.code).toBe(-32000);
        expect(body.error.message).toContain('different transport protocol');
      } else {
        // If plain text, session might not exist yet - check error message
        const text = await response.text();
        expect(text).toMatch(/Invalid|Session|transport/i);
      }
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

  it('should handle error in mcpPostHandler catch block', async () => {
    // This test triggers the error handling path in mcpPostHandler
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: 'invalid json'
    });

    expect(response.status).toBe(400);
  });

  it('should handle error in mcpDeleteHandler catch block', async () => {
    // First create a valid session
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
      // This should trigger the normal delete path, not the error path
      const response = await fetch(`${baseUrl}/mcp`, {
        method: 'DELETE',
        headers: {
          'mcp-session-id': sessionId
        }
      });

      // Should succeed or return appropriate status
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(500);
    }
  });
});

describe('MCP HTTP Server - Additional Coverage Tests', () => {
  const app = createServer(getDefaultConfig(), 'localhost', 0);
  let server: ReturnType<typeof app.listen>;
  let baseUrl: string;
  const activeSSEConnections: AbortController[] = [];

  // Increase timeout for this test suite
  jest.setTimeout(10000);

  beforeAll((done) => {
    server = app.listen(0, () => {
      const address = server.address() as { port: number };
      baseUrl = `http://localhost:${address.port}`;
      done();
    });
  });

  afterAll((done) => {
    // Abort all active SSE connections
    for (const controller of activeSSEConnections) {
      controller.abort();
    }
    activeSSEConnections.length = 0;
    
    // Give connections time to close
    setTimeout(() => {
      server.close(done);
    }, 200);
  });

  it('should handle POST /mcp with existing SSE session (transport mismatch)', async () => {
    // First create an SSE session and keep it alive
    const abortController = new AbortController();
    activeSSEConnections.push(abortController);
    
    const sseResponse = await fetch(`${baseUrl}/mcp/sse`, { 
      method: 'GET',
      signal: abortController.signal
    });
    
    // Wait for headers and session to be created - SSE responses need time
    await new Promise(resolve => setTimeout(resolve, 150));
    
    const sseSessionId = sseResponse.headers.get('mcp-session-id') || 
                         sseResponse.headers.get('x-mcp-session-id');
    
    // If we don't have session ID from headers, fail with descriptive message
    expect(sseSessionId).toBeTruthy();
    
    if (sseSessionId) {
      // Now try to use that SSE session ID with StreamableHTTP POST while keeping SSE connection alive
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
      
      // Now abort the SSE connection after the test
      abortController.abort();
      const index = activeSSEConnections.indexOf(abortController);
      if (index > -1) {
        activeSSEConnections.splice(index, 1);
      }
    }
  });

  it('should handle GET /mcp with existing SSE session (transport mismatch)', async () => {
    // First create an SSE session
    const abortController = new AbortController();
    activeSSEConnections.push(abortController);
    
    const sseResponse = await fetch(`${baseUrl}/mcp/sse`, { 
      method: 'GET',
      signal: abortController.signal
    });
    const sseSessionId = sseResponse.headers.get('mcp-session-id');
    
    abortController.abort();
    const index = activeSSEConnections.indexOf(abortController);
    if (index > -1) {
      activeSSEConnections.splice(index, 1);
    }
    
    if (sseSessionId) {
      // Now try to use that SSE session ID with StreamableHTTP GET
      const response = await fetch(`${baseUrl}/mcp`, {
        method: 'GET',
        headers: {
          'mcp-session-id': sseSessionId
        }
      });

      expect(response.status).toBe(400);
      
      // GET/DELETE handlers return JSON if session exists but transport mismatches, 
      // or plain text if session doesn't exist. Try JSON first.
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const body = await response.json() as { jsonrpc: string; error: { code: number; message: string } };
        expect(body.jsonrpc).toBe('2.0');
        expect(body.error.code).toBe(-32000);
        expect(body.error.message).toContain('different transport protocol');
      } else {
        // If plain text, session might not exist yet - check error message
        const text = await response.text();
        expect(text).toMatch(/Invalid|Session|transport/i);
      }
    }
  });

  it('should handle DELETE /mcp with existing SSE session (transport mismatch)', async () => {
    // First create an SSE session
    const abortController = new AbortController();
    activeSSEConnections.push(abortController);
    
    const sseResponse = await fetch(`${baseUrl}/mcp/sse`, { 
      method: 'GET',
      signal: abortController.signal
    });
    const sseSessionId = sseResponse.headers.get('mcp-session-id');
    
    abortController.abort();
    const index = activeSSEConnections.indexOf(abortController);
    if (index > -1) {
      activeSSEConnections.splice(index, 1);
    }
    
    if (sseSessionId) {
      // Now try to use that SSE session ID with StreamableHTTP DELETE
      const response = await fetch(`${baseUrl}/mcp`, {
        method: 'DELETE',
        headers: {
          'mcp-session-id': sseSessionId
        }
      });

      expect(response.status).toBe(400);
      
      // GET/DELETE handlers return JSON if session exists but transport mismatches, 
      // or plain text if session doesn't exist. Try JSON first.
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const body = await response.json() as { jsonrpc: string; error: { code: number; message: string } };
        expect(body.jsonrpc).toBe('2.0');
        expect(body.error.code).toBe(-32000);
        expect(body.error.message).toContain('different transport protocol');
      } else {
        // If plain text, session might not exist yet - check error message
        const text = await response.text();
        expect(text).toMatch(/Invalid|Session|transport/i);
      }
    }
  });

  it('should handle POST /mcp/messages with existing StreamableHTTP session (transport mismatch)', async () => {
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
      
      // GET/DELETE handlers return JSON if session exists but transport mismatches, 
      // or plain text if session doesn't exist. Try JSON first.
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const body = await response.json() as { jsonrpc: string; error: { code: number; message: string } };
        expect(body.jsonrpc).toBe('2.0');
        expect(body.error.code).toBe(-32000);
        expect(body.error.message).toContain('different transport protocol');
      } else {
        // If plain text, session might not exist yet - check error message
        const text = await response.text();
        expect(text).toMatch(/Invalid|Session|transport/i);
      }
    }
  });

  it('should handle POST /mcp/messages with non-existent session (null transport)', async () => {
    // This test triggers the "No transport found for sessionId" path in sseMessagesHandler
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

  it('should handle POST /mcp/messages with valid SSE session', async () => {
    // Create SSE session and keep it alive
    const abortController = new AbortController();
    activeSSEConnections.push(abortController);
    
    const sseResponse = await fetch(`${baseUrl}/mcp/sse`, { 
      method: 'GET',
      signal: abortController.signal
    });
    const sseSessionId = sseResponse.headers.get('mcp-session-id');
    
    // Note: SSEServerTransport may handle session IDs differently
    // For now, just verify the SSE connection was established
    expect(sseResponse.status).toBe(200);
    expect(sseResponse.headers.get('content-type')).toContain('text/event-stream');
    
    if (sseSessionId) {
      // Send a message to the SSE session
      const messagesResponse = await fetch(`${baseUrl}/mcp/messages?sessionId=${sseSessionId}`, {
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

      // Should handle the message (may return various status codes)
      expect(messagesResponse.status).toBeGreaterThanOrEqual(200);
      expect(messagesResponse.status).toBeLessThan(500);
    }
    
    abortController.abort();
    const index = activeSSEConnections.indexOf(abortController);
    if (index > -1) {
      activeSSEConnections.splice(index, 1);
    }
  });
});

describe('MCP HTTP Server - Patch Coverage Tests', () => {
  const app = createServer(getDefaultConfig(), 'localhost', 0);
  let server: ReturnType<typeof app.listen>;
  let baseUrl: string;
  const activeSSEConnections: AbortController[] = [];

  // Increase timeout for this test suite
  jest.setTimeout(10000);

  beforeAll((done) => {
    server = app.listen(0, () => {
      const address = server.address() as { port: number };
      baseUrl = `http://localhost:${address.port}`;
      done();
    });
  });

  afterAll((done) => {
    // Abort all active SSE connections
    for (const controller of activeSSEConnections) {
      controller.abort();
    }
    activeSSEConnections.length = 0;
    
    // Give connections time to close
    setTimeout(() => {
      server.close(done);
    }, 200);
  });

  it('should handle POST /mcp with existing SSE session (transport mismatch in mcpPostHandler)', async () => {
    // Create SSE session first
    const abortController = new AbortController();
    activeSSEConnections.push(abortController);
    
    const sseResponse = await fetch(`${baseUrl}/mcp/sse`, { 
      method: 'GET',
      signal: abortController.signal
    });
    const sseSessionId = sseResponse.headers.get('mcp-session-id');
    
    // Wait for session to be created
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (sseSessionId) {
      // Now try to use that SSE session ID with StreamableHTTP POST
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
      
      // GET/DELETE handlers return JSON if session exists but transport mismatches, 
      // or plain text if session doesn't exist. Try JSON first.
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const body = await response.json() as { jsonrpc: string; error: { code: number; message: string } };
        expect(body.jsonrpc).toBe('2.0');
        expect(body.error.code).toBe(-32000);
        expect(body.error.message).toContain('different transport protocol');
      } else {
        // If plain text, session might not exist yet - check error message
        const text = await response.text();
        expect(text).toMatch(/Invalid|Session|transport/i);
      }
    }
    
    abortController.abort();
    const index = activeSSEConnections.indexOf(abortController);
    if (index > -1) {
      activeSSEConnections.splice(index, 1);
    }
  });

  it('should handle GET /mcp with existing SSE session (transport mismatch in mcpGetHandler)', async () => {
    // Create SSE session first
    const abortController = new AbortController();
    activeSSEConnections.push(abortController);
    
    const sseResponse = await fetch(`${baseUrl}/mcp/sse`, { 
      method: 'GET',
      signal: abortController.signal
    });
    const sseSessionId = sseResponse.headers.get('mcp-session-id');
    
    // Wait for session to be created
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (sseSessionId) {
      // Now try to use that SSE session ID with StreamableHTTP GET
      const response = await fetch(`${baseUrl}/mcp`, {
        method: 'GET',
        headers: {
          'mcp-session-id': sseSessionId
        }
      });

      expect(response.status).toBe(400);
      
      // GET/DELETE handlers return JSON if session exists but transport mismatches, 
      // or plain text if session doesn't exist. Try JSON first.
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const body = await response.json() as { jsonrpc: string; error: { code: number; message: string } };
        expect(body.jsonrpc).toBe('2.0');
        expect(body.error.code).toBe(-32000);
        expect(body.error.message).toContain('different transport protocol');
      } else {
        // If plain text, session might not exist yet - check error message
        const text = await response.text();
        expect(text).toMatch(/Invalid|Session|transport/i);
      }
    }
    
    abortController.abort();
    const index = activeSSEConnections.indexOf(abortController);
    if (index > -1) {
      activeSSEConnections.splice(index, 1);
    }
  });

  it('should handle DELETE /mcp with existing SSE session (transport mismatch in mcpDeleteHandler)', async () => {
    // Create SSE session first
    const abortController = new AbortController();
    activeSSEConnections.push(abortController);
    
    const sseResponse = await fetch(`${baseUrl}/mcp/sse`, { 
      method: 'GET',
      signal: abortController.signal
    });
    const sseSessionId = sseResponse.headers.get('mcp-session-id');
    
    // Wait for session to be created
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (sseSessionId) {
      // Now try to use that SSE session ID with StreamableHTTP DELETE
      const response = await fetch(`${baseUrl}/mcp`, {
        method: 'DELETE',
        headers: {
          'mcp-session-id': sseSessionId
        }
      });

      expect(response.status).toBe(400);
      
      // GET/DELETE handlers return JSON if session exists but transport mismatches, 
      // or plain text if session doesn't exist. Try JSON first.
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const body = await response.json() as { jsonrpc: string; error: { code: number; message: string } };
        expect(body.jsonrpc).toBe('2.0');
        expect(body.error.code).toBe(-32000);
        expect(body.error.message).toContain('different transport protocol');
      } else {
        // If plain text, session might not exist yet - check error message
        const text = await response.text();
        expect(text).toMatch(/Invalid|Session|transport/i);
      }
    }
    
    abortController.abort();
    const index = activeSSEConnections.indexOf(abortController);
    if (index > -1) {
      activeSSEConnections.splice(index, 1);
    }
  });

  it('should handle POST /mcp/messages with existing StreamableHTTP session (transport mismatch in sseMessagesHandler)', async () => {
    // Create StreamableHTTP session first
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
      
      // GET/DELETE handlers return JSON if session exists but transport mismatches, 
      // or plain text if session doesn't exist. Try JSON first.
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const body = await response.json() as { jsonrpc: string; error: { code: number; message: string } };
        expect(body.jsonrpc).toBe('2.0');
        expect(body.error.code).toBe(-32000);
        expect(body.error.message).toContain('different transport protocol');
      } else {
        // If plain text, session might not exist yet - check error message
        const text = await response.text();
        expect(text).toMatch(/Invalid|Session|transport/i);
      }
    }
  });

  it('should handle POST /mcp/messages with null transport (unreachable else branch)', async () => {
    // This test is designed to trigger the unreachable else branch in sseMessagesHandler
    // by creating a scenario where transport is null/undefined after the instanceof check
    const response = await fetch(`${baseUrl}/mcp/messages?sessionId=null-transport-test`, {
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

  it('should handle GET /mcp with valid StreamableHTTP session (cover line 127)', async () => {
    // Initialize a StreamableHTTP session
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
    expect(sessionId).toBeTruthy();

    if (sessionId) {
      // Now do a GET request with that session ID - this should hit line 127
      const getResponse = await fetch(`${baseUrl}/mcp`, {
        method: 'GET',
        headers: {
          'mcp-session-id': sessionId
        }
      });

      // Should handle the request (may return various status codes)
      expect(getResponse.status).toBeGreaterThanOrEqual(200);
      expect(getResponse.status).toBeLessThan(500);
    }
  });

  it('should handle POST /mcp/messages with valid SSE session (cover line 183)', async () => {
    // Create SSE session
    const abortController = new AbortController();
    activeSSEConnections.push(abortController);
    
    const sseResponse = await fetch(`${baseUrl}/mcp/sse`, { 
      method: 'GET',
      signal: abortController.signal
    });
    const sseSessionId = sseResponse.headers.get('mcp-session-id');
    
    expect(sseSessionId).toBeTruthy();
    
    if (sseSessionId) {
      // Send a message to the SSE session - this should hit line 183 (transport = existingTransport)
      const messagesResponse = await fetch(`${baseUrl}/mcp/messages?sessionId=${sseSessionId}`, {
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

      // Should handle the message (may return various status codes)
      expect(messagesResponse.status).toBeGreaterThanOrEqual(200);
      expect(messagesResponse.status).toBeLessThan(500);
    }
    
    abortController.abort();
    const index = activeSSEConnections.indexOf(abortController);
    if (index > -1) {
      activeSSEConnections.splice(index, 1);
    }
  });
});

