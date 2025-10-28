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

  app.use('/mcp', getMcpRouter());
}

export function getMcpRouter(): express.Router {
  const router = express.Router();

  router.post('/', mcpPostHandler);
  router.get('/', mcpGetHandler);
  router.delete('/', mcpDeleteHandler);

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
