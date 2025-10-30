import type { Express, Response, Request } from 'express';
import { randomUUID } from 'crypto';

type SseMessage = { id: string; data: unknown };

type Session = {
  id: string;
  messages: SseMessage[];
  listeners: Set<Response>;
  closed: boolean;
};

const sessions = new Map<string, Session>();

function ensureSession(id?: string): Session {
  const sid = id ?? randomUUID();
  let session = sessions.get(sid);
  if (!session) {
    session = { id: sid, messages: [], listeners: new Set(), closed: false };
    sessions.set(sid, session);
  }
  return session;
}

function writeSSE(res: Response, msg: SseMessage) {
  const payload = typeof msg.data === 'string' ? msg.data : JSON.stringify(msg.data);
  res.write(`id: ${msg.id}\n`);
  for (const line of payload.split(/\r?\n/)) {
    res.write(`data: ${line}\n`);
  }
  res.write(`\n`);
}

function endSSE(res: Response) {
  if (!res.writableEnded) res.end();
}

export function setupMcpSseTransport(app: Express) {
  // Initialize session: returns { sessionId }
  app.post('/mcp/sse/init', (_req, res) => {
    const session = ensureSession();
    res.json({ sessionId: session.id });
  });

  // Stream with optional fromId (exclusive)
  app.get('/mcp/sse/stream', (req, res) => {
    const sessionId = (req.query.sessionId as string) || '';
    const fromId = (req.query.fromId as string) || '';
    const session = sessions.get(sessionId);
    if (!session || session.closed) return res.status(404).json({ error: 'SessionNotFound' });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.status(200);

    let startIdx = 0;
    if (fromId) {
      const idx = session.messages.findIndex(m => m.id === fromId);
      startIdx = idx >= 0 ? idx + 1 : 0;
    }
    for (let i = startIdx; i < session.messages.length; i++) {
      writeSSE(res, session.messages[i]);
    }

    session.listeners.add(res);
    req.on('close', () => {
      session.listeners.delete(res);
      endSSE(res);
    });
  });

  // Send JSON-RPC-like message; here we simply echo back as an SSE payload
  app.post('/mcp/sse/send', (req: Request, res: Response) => {
    const sessionId = (req.query.sessionId as string) || '';
    const session = sessions.get(sessionId);
    if (!session || session.closed) return res.status(404).json({ error: 'SessionNotFound' });

    const message: SseMessage = {
      id: (req.body?.id as string) || randomUUID(),
      data: req.body ?? {},
    };
    session.messages.push(message);
    for (const listener of session.listeners) writeSSE(listener, message);
    res.status(202).json({ id: message.id });
  });

  // Close session
  app.delete('/mcp/sse', (req, res) => {
    const sessionId = (req.query.sessionId as string) || '';
    const session = sessions.get(sessionId);
    if (!session || session.closed) return res.status(404).json({ error: 'SessionNotFound' });

    session.closed = true;
    for (const listener of session.listeners) endSSE(listener);
    session.listeners.clear();
    res.status(204).end();
  });
}


