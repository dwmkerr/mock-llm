import type { Express, Response } from 'express';

function writeSSE(res: Response, data: unknown) {
  res.write(`data: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`);
}

export function setupSSERoutes(app: Express) {
  // Simple mock SSE provider for testing generic SSE behavior.
  // GET /sse/mock?count=5&intervalMs=50&prefix=hello&errorAfter=0
  app.get('/sse/mock', (req, res) => {
    const count = Math.max(1, parseInt((req.query.count as string) || '5', 10));
    const intervalMs = Math.max(1, parseInt((req.query.intervalMs as string) || '50', 10));
    const prefix = (req.query.prefix as string) || 'chunk';
    const errorAfter = parseInt((req.query.errorAfter as string) || '-1', 10);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.status(200);

    let index = 0;
    const timer = setInterval(() => {
      if (errorAfter >= 0 && index === errorAfter) {
        writeSSE(res, { error: 'MockError', message: 'Injected error', status: 500 });
        res.end();
        clearInterval(timer);
        return;
      }
      if (index < count) {
        writeSSE(res, { index, data: `${prefix}-${index}` });
        index += 1;
      } else {
        writeSSE(res, '[DONE]');
        res.end();
        clearInterval(timer);
      }
    }, intervalMs);
  });
}


