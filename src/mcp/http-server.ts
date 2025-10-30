import { randomUUID } from 'node:crypto';
import express, { Request, Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { ErrorCode, isInitializeRequest, JSONRPCError } from '@modelcontextprotocol/sdk/types.js';

import { getMCPServer } from './server';

const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

export function setupHttpMcpServer(app: express.Express, host: string, port: number): void {
  console.log('Loaded MCP server:');
  console.log(`  - echo-mcp: http://${host}:${port}/mcp`);
  console.log('    - echo: this tool echoes back the provided request');
  console.log(`  - mcp-sse: http://${host}:${port}/mcp/sse`);
  console.log('    - init: POST /mcp/sse/init');
  console.log('    - stream: GET /mcp/sse/stream');
  console.log('    - send: POST /mcp/sse/send');
  console.log('    - close: DELETE /mcp/sse');

  app.use('/mcp', getMcpRouter());
}

export function getMcpRouter(): express.Router {
  const router = express.Router();

  // Standard MCP endpoints
  router.post('/', mcpPostHandler);
  router.get('/', mcpGetHandler);
  router.delete('/', mcpDeleteHandler);

  // SSE transport endpoints
  router.post('/sse/init', sseInitHandler);
  router.get('/sse/stream', sseStreamHandler);
  router.post('/sse/send', sseSendHandler);
  router.delete('/sse', sseCloseHandler);

  return router;
}

const mcpPostHandler = async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (sessionId) {
      console.log(`Received MCP request for session: ${sessionId}`);
  } else {
      console.log('Received MCP request without session ID');
  }

  try {
    let transport: StreamableHTTPServerTransport
    if (sessionId && transports[sessionId]) {
      transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: sessionId => {
          // Store the transport by session ID when session is initialized
          // This avoids race conditions where requests might come in before the session is stored
          console.log(`Session initialized with ID: ${sessionId}`);
          transports[sessionId] = transport;
        }
      })

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && transports[sid]) {
          console.log(`Transport closed for session ${sid}, removing from transports map`);
          delete transports[sid];
        }
      }

      const mcpServer = getMCPServer();
      await mcpServer.connect(transport);
    } else {
      res.status(400).json({
        jsonrpc: "2.0",
        id: null,
        error: {
          code: ErrorCode.InvalidParams,
          message: `Bad Request: No valid session ID provided`,
        }
      });

      return;
    }

    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('Error handling MCP request:', error);

    const response: JSONRPCError = {
      jsonrpc: "2.0",
      id: req.body.id || null,
      error: {
        code: ErrorCode.InternalError,
        message: 'Internal server error',
      }
    }

    res.status(500).send(JSON.stringify(response));
  }
};

const mcpGetHandler = async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string;
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send('Invalid or missing Session ID');
  }

  const transport = transports[sessionId];
  await transport.handleRequest(req, res);
};

const mcpDeleteHandler = async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string;
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send('Invalid or missing Session ID');
  }

  console.log(`Received session termination request session with ID: ${sessionId}`);

  try {
    const transport = transports[sessionId];
    await transport.handleRequest(req, res);
  } catch (error) {
    console.error('Error handling session termination:', error);
    if (!res.headersSent) {
      res.status(500).send('Error processing session termination');
    }
  }
}

// SSE Transport Handlers
const sseSessions: { [sessionId: string]: { messages: any[], isActive: boolean } } = {};

const sseInitHandler = async (req: Request, res: Response) => {
  const sessionId = randomUUID();
  sseSessions[sessionId] = { messages: [], isActive: true };
  
  res.json({ sessionId });
  console.log(`SSE session initialized: ${sessionId}`);
};

const sseStreamHandler = async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  
  if (!sessionId || !sseSessions[sessionId]) {
    return res.status(400).json({ error: 'Invalid session ID' });
  }

  const session = sseSessions[sessionId];
  
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Send replay messages
  for (const message of session.messages) {
    res.write(`data: ${JSON.stringify(message)}\n\n`);
  }

  // Keep connection alive and send new messages as they arrive
  const keepAlive = setInterval(() => {
    if (!session.isActive) {
      clearInterval(keepAlive);
      res.end();
      return;
    }
    res.write(`data: ${JSON.stringify({ type: 'ping', timestamp: Date.now() })}\n\n`);
  }, 30000);

  req.on('close', () => {
    clearInterval(keepAlive);
    session.isActive = false;
  });
};

const sseSendHandler = async (req: Request, res: Response) => {
  const sessionId = req.body.sessionId;
  const message = req.body.message;
  
  if (!sessionId || !sseSessions[sessionId]) {
    return res.status(400).json({ error: 'Invalid session ID' });
  }

  const session = sseSessions[sessionId];
  session.messages.push({ ...message, timestamp: Date.now() });
  
  res.json({ success: true });
};

const sseCloseHandler = async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  
  if (!sessionId || !sseSessions[sessionId]) {
    return res.status(400).json({ error: 'Invalid session ID' });
  }

  sseSessions[sessionId].isActive = false;
  delete sseSessions[sessionId];
  
  res.json({ success: true });
  console.log(`SSE session closed: ${sessionId}`);
};
