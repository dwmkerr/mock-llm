import { randomUUID } from 'node:crypto';
import express, { Request, Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';

import { getMCPServer } from './server';
import { setCurrentRequestHeaders } from './request-context';

const transports: { [sessionId: string]: StreamableHTTPServerTransport | SSEServerTransport } = {};

export function setupHttpMcpServer(app: express.Express, host: string, port: number): void {
  const mcpInfo = getMCPServer();

  console.log('Loaded MCP server:');
  console.log(`  - ${mcpInfo.name}: http://${host}:${port}/mcp`);
  for (const tool of mcpInfo.tools) {
    console.log(`    - ${tool.name}: ${tool.description}`);
  }

  // Streamable HTTP Transport (Protocol 2025-03-26)
  app.use('/mcp', getStreamableHTTPRouter());

  // HTTP+SSE Transport (Protocol 2024-11-05)
  app.get('/sse', sseGetHandler);
  app.post('/messages', sseMessagesHandler);
}

export function getStreamableHTTPRouter(): express.Router {
  const router = express.Router();

  router.post('/', mcpPostHandler);
  router.get('/', mcpGetHandler);
  router.delete('/', mcpDeleteHandler);

  return router;
}

const mcpPostHandler = async (req: Request, res: Response) => {
  console.log(`Received ${req.method} request to /mcp`);

  // Store headers for echo_headers tool
  setCurrentRequestHeaders(req.headers as Record<string, string>);

  try {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports[sessionId]) {
      const existingTransport = transports[sessionId];
      if (existingTransport instanceof StreamableHTTPServerTransport) {
        transport = existingTransport;
      } else {
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: Session exists but uses a different transport protocol'
          },
          id: null
        });
        return;
      }
    } else if (!sessionId && isInitializeRequest(req.body)) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: sessionId => {
          console.log(`StreamableHTTP session initialized with ID: ${sessionId}`);
          transports[sessionId] = transport;
        }
      });

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && transports[sid]) {
          console.log(`Transport closed for session ${sid}, removing from transports map`);
          delete transports[sid];
        }
      };

      const mcpServerInfo = getMCPServer();
      await mcpServerInfo.server.connect(transport);
    } else {
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: No valid session ID provided'
        },
        id: null
      });
      return;
    }

    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('Error handling MCP request:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error'
        },
        id: null
      });
    }
  }
};

const mcpGetHandler = async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string;
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send('Invalid or missing Session ID');
    return;
  }

  const transport = transports[sessionId];
  if (!(transport instanceof StreamableHTTPServerTransport)) {
    res.status(400).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Bad Request: Session exists but uses a different transport protocol'
      },
      id: null
    });
    return;
  }

  await transport.handleRequest(req, res);
};

const mcpDeleteHandler = async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string;
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send('Invalid or missing Session ID');
    return;
  }

  const transport = transports[sessionId];
  if (!(transport instanceof StreamableHTTPServerTransport)) {
    res.status(400).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Bad Request: Session exists but uses a different transport protocol'
      },
      id: null
    });
    return;
  }

  console.log(`Received session termination request session with ID: ${sessionId}`);

  try {
    await transport.handleRequest(req, res);
  } catch (error) {
    console.error('Error handling session termination:', error);
    if (!res.headersSent) {
      res.status(500).send('Error processing session termination');
    }
    /* istanbul ignore next 3 - Headers already sent error path is hard to test */
  }
};

// HTTP+SSE Transport Handlers (Protocol 2024-11-05)
const sseGetHandler = async (req: Request, res: Response) => {
  console.log('Received GET request to /sse (HTTP+SSE transport)');
  const transport = new SSEServerTransport('/messages', res);
  transports[transport.sessionId] = transport;
  
  // Set session ID in headers for client access
  res.setHeader('mcp-session-id', transport.sessionId);

  res.on('close', () => {
    delete transports[transport.sessionId];
  });

  const serverInfo = getMCPServer();
  await serverInfo.server.connect(transport);
};

const sseMessagesHandler = async (req: Request, res: Response) => {
  // Store headers for echo_headers tool
  setCurrentRequestHeaders(req.headers as Record<string, string>);

  const sessionId = req.query.sessionId as string;
  let transport: SSEServerTransport;

  const existingTransport = transports[sessionId];
  if (existingTransport instanceof SSEServerTransport) {
    transport = existingTransport;
  } else {
    res.status(400).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Bad Request: Session exists but uses a different transport protocol'
      },
      id: null
    });
    return;
  }

  if (transport) {
    await transport.handlePostMessage(req, res, req.body);
  } else {
    /* istanbul ignore next 1 - Unreachable else branch after instanceof check */
    res.status(400).send('No transport found for sessionId');
  }
};
