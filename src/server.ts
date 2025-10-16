import express from 'express';
import * as jmespath from 'jmespath';
import * as yaml from 'js-yaml';
import type { ChatCompletionCreateParamsBase } from 'openai/resources/chat/completions';
import { Config, Rule } from './config';
import { renderTemplate } from './template';
import { printConfigSummary } from './config-logger';

export function createServer(initialConfig: Config) {
  //  Track the current config, which can be changed via '/config' endpoints.
  let currentConfig = { ...initialConfig };

  //  Create the app, log requests.
  const app = express();
  app.use(express.json());
  app.use(express.text({ type: 'application/x-yaml' }));
  app.use((req, _, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
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
    printConfigSummary(currentConfig, 'config reset');
    res.json(currentConfig);
  });

  //  Handle chat completion requests.
  app.post(/.*/, (req, res) => {
    const requestBody: ChatCompletionCreateParamsBase = req.body;

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

    //  Find all rules that match the JMESPath expression. If no rules match
    //  then we fail.
    const matchingRules: Rule[] = [];
    for (const rule of matchingPathRules) {
      try {
        const result = jmespath.search(request, rule.match);
        if (result) {
          matchingRules.push(rule);
        }
      } catch (error) {
        throw new Error(`Error evaluating match expression: ${rule.match}\n${error}`);
      }
    }
    if (matchingRules.length === 0) {
      throw new Error('No matching rule found for request');
    }

    //  Render the response, expanding any expressions from the matched rule.
    const matchedRule = matchingRules[matchingRules.length - 1];
    const body = renderTemplate(matchedRule.response.content, { request });
    return res.status(matchedRule.response.status).json(JSON.parse(body));
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
