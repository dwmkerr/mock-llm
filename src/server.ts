import express from 'express';
import * as jmespath from 'jmespath';
import * as yaml from 'js-yaml';
import type { ChatCompletionCreateParamsBase } from 'openai/resources/chat/completions';

import { Config, Rule } from './config';
import { renderTemplate } from './template';
import { printConfigSummary } from './config-logger';
import { setupA2ARoutes } from './a2a/routes';
import { setupHttpMcpServer } from './mcp/http-server';
import { streamResponse } from './streaming';

export function createServer(initialConfig: Config, host: string, port: number) {
  //  Track the current config, which can be changed via '/config' endpoints.
  let currentConfig = { ...initialConfig };

  //  Track request sequence counters per path for sequential matching.
  const sequenceCounters: Record<string, number> = {};

  //  Create the app, log requests.
  const app = express();
  app.use(express.json());
  app.use(express.text({ type: 'application/x-yaml' }));
  app.use((req, _, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });

  // Setup A2A and MCP routes
  setupA2ARoutes(app, host, port);
  setupHttpMcpServer(app, host, port);

  // Catch-all for missing A2A agents
  app.use('/a2a/', (req, res, _next) => {
    res.status(404).json({
      error: 'AgentNotFound',
      message: `Agent not found at path: ${req.path}`,
      status: 404
    });
  });

  //  Health and readiness checks
  app.get('/health', (_, res) => {
    res.json({ status: 'healthy' });
  });
  app.get('/ready', (_, res) => {
    res.json({ status: 'ready' });
  });

  //  Handle config requests (get/replace/update/delete).
  app.get('/config', (req, res) => {
    // Return YAML if Accept header requests it, otherwise JSON
    if (req.get('Accept') === 'application/x-yaml') {
      res.type('application/x-yaml').send(yaml.dump(currentConfig));
    } else {
      res.json(currentConfig);
    }
  });
  app.post('/config', (req, res) => {
    currentConfig = typeof req.body === 'string'
      ? yaml.load(req.body) as Config
      : req.body;
    printConfigSummary(currentConfig, 'config replaced');
    res.json(currentConfig);
  });
  app.patch('/config', (req, res) => {
    const update = typeof req.body === 'string'
      ? yaml.load(req.body) as Config
      : req.body;
    currentConfig = { ...currentConfig, ...update };
    printConfigSummary(currentConfig, 'config updated');
    res.json(currentConfig);
  });
  app.delete('/config', (req, res) => {
    currentConfig = { ...initialConfig };
    // Reset sequence counters when config is reset
    Object.keys(sequenceCounters).forEach(key => delete sequenceCounters[key]);
    printConfigSummary(currentConfig, 'config reset');
    res.json(currentConfig);
  });

  //  Handle chat completion requests.
  app.all(/.*/, (req, res) => {
    // For GET requests, use empty object; for others, use actual body
    const requestBody: ChatCompletionCreateParamsBase = req.method === 'GET' ? {} : (req.body || {});
    const isStreaming = requestBody.stream === true;

    //  Get the current sequence counter for this path.
    const currentSequence = sequenceCounters[req.path] || 0;

    //  Filter rules by path (typically 'v1/completions').
    //  If no rules for this path we fail.
    const matchingPathRules = currentConfig.rules.filter(rule =>
      new RegExp(rule.path).test(req.path)
    );
    if (matchingPathRules.length === 0) {
      throw new Error(`No matching rule found for path: ${req.path}`);
    }

    //  Build the request object that will be available to match and template.
    const request = {
      body: requestBody,
      headers: req.headers,
      method: req.method,
      path: req.path,
      query: req.query
    };

    //  Find all rules that match sequence and JMESPath expression.
    //  Rules with sequence must match the current request number.
    //  Rules without sequence match any request number.
    //  If no rules match then we fail.
    const matchingRules: Rule[] = [];
    for (const rule of matchingPathRules) {
      // Check sequence match (if specified)
      if (rule.sequence !== undefined && rule.sequence !== currentSequence) {
        continue;
      }

      // Check JMESPath match (default to '@' which always matches)
      try {
        const matchExpression = rule.match || '@';
        const result = jmespath.search(request, matchExpression);
        if (result) {
          matchingRules.push(rule);
        }
      } catch (error) {
        throw new Error(`Error evaluating match expression: ${rule.match}\n${error}`);
      }
    }
    if (matchingRules.length === 0) {
      throw new Error(`No matching rule found for request (sequence: ${currentSequence})`);
    }

    //  Render the response, expanding any expressions from the matched rule.
    //  Only increment the sequence counter if the winning rule has a sequence.
    //  This allows fallback rules (without sequence) to handle requests like model
    //  liveness probes without consuming sequence numbers meant for actual calls.
    const matchedRule = matchingRules[matchingRules.length - 1];
    if (matchedRule.sequence !== undefined) {
      sequenceCounters[req.path] = currentSequence + 1;
    }
    const body = renderTemplate(matchedRule.response.content, { request });
    const parsed = JSON.parse(body);

    // Handle streaming or regular response
    if (isStreaming) {
      return streamResponse(res, parsed, matchedRule.response.status, currentConfig.streaming);
    } else {
      return res.status(matchedRule.response.status).json(parsed);
    }
  });

  // Catch-all 404 handler
  app.use((req: express.Request, res: express.Response) => {
    res.status(404).json({
      error: 'Not Found',
      message: `Cannot ${req.method} ${req.path}`,
      status: 404
    });
  });

  // Return JSON errors instead of HTML
  app.use((err: Error & { status?: number; statusCode?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(`Error ${err.status || err.statusCode || 500}: ${err.message}`);
    const status = err.status || err.statusCode || 500;
    res.status(status).json({
      error: err.name || 'Error',
      message: err.message,
      status
    });
  });

  return app;
}
