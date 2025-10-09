import express from 'express';
import * as jmespath from 'jmespath';
import * as yaml from 'js-yaml';
import Handlebars from 'handlebars';
import type { ChatCompletionCreateParamsBase } from 'openai/resources/chat/completions';
import { Config, Rule } from './config';

export function createServer(initialConfig: Config) {
  //  Track the current config, which can be changed via '/config' endpoints.
  let currentConfig = { ...initialConfig };

  // Register Handlebars helpers - 'jmes' runs a JSON JMES expression and
  // 'timestamp' returns the current time.
  Handlebars.registerHelper('jmes', (obj: unknown, path: string) => {
    return jmespath.search(obj, path);
  });
  Handlebars.registerHelper('timestamp', () => {
    return Date.now().toString();
  });

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
    console.log(`config replaced - ${currentConfig.rules.length} rule(s)`);
    res.json(currentConfig);
  });
  app.patch('/config', (req, res) => {
    const update = typeof req.body === 'string'
      ? yaml.load(req.body) as Config
      : req.body;
    currentConfig = { ...currentConfig, ...update };
    console.log(`config updated - ${currentConfig.rules.length} rule(s)`);
    res.json(currentConfig);
  });
  app.delete('/config', (req, res) => {
    currentConfig = { ...initialConfig };
    console.log(`config reset - ${currentConfig.rules.length} rule(s)`);
    res.json(currentConfig);
  });

  //  Handle chat completion requests.
  app.post(/.*/, (req, res) => {
    const request: ChatCompletionCreateParamsBase = req.body;

    //  Filter rules by path (typically 'v1/completions').
    //  If no rules for this path we fail.
    const matchingPathRules = currentConfig.rules.filter(rule =>
      new RegExp(rule.path).test(req.path)
    );
    if (matchingPathRules.length === 0) {
      return res.status(500).json({ error: `No matching rule found for path: ${req.path}` });
    }

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
        return res.status(500).json({
          error: `Error evaluating match expression: ${rule.match}\n${error}`
        });
      }
    }
    if (matchingRules.length === 0) {
      return res.status(500).json({ error: 'No matching rule found for request' });
    }

    //  Render the response, expanding any expressions from the matched rule.
    const matchedRule = matchingRules[matchingRules.length - 1];
    const template = Handlebars.compile(matchedRule.response.content);
    const body = template({ request });
    return res.status(matchedRule.response.status).json(JSON.parse(body));
  });

  return app;
}
