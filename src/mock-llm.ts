import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import * as jmespath from 'jmespath';
import Handlebars from 'handlebars';
import type { ChatCompletionCreateParamsBase } from 'openai/resources/chat/completions';

export type ChatRequest = ChatCompletionCreateParamsBase;

export interface Response {
  status: number;
  content: string;
}

export interface Rule {
  path: string;
  match: string;
  response: Response;
}

export interface Config {
  rules: Rule[];
}

// Register Handlebars helper for JMESPath queries
Handlebars.registerHelper('jmes', (obj: any, path: string) => {
  return jmespath.search(obj, path);
});

// Register timestamp helper
Handlebars.registerHelper('timestamp', () => {
  return Date.now().toString();
});

export function loadConfig(configPath?: string): Config {
  const defaultConfig: Config = {
    rules: [
      {
        path: '/v1/chat/completions',
        match: '@',
        response: {
          status: 200,
          content: `{
  "id": "chatcmpl-{{timestamp}}",
  "object": "chat.completion",
  "model": "{{jmes request 'model'}}",
  "choices": [{
    "message": {
      "role": "assistant",
      "content": "{{jmes request 'messages[-1].content'}}"
    },
    "finish_reason": "stop"
  }]
}`
        }
      }
    ]
  };

  if (!configPath) {
    configPath = path.join(process.cwd(), 'mock-llm.yaml');
  }

  if (!fs.existsSync(configPath)) {
    return defaultConfig;
  }

  const configContent = fs.readFileSync(configPath, 'utf8');
  return yaml.load(configContent) as Config;
}

export function findMatchingRule(config: Config, request: ChatRequest, urlPath: string): Rule | null {
  let matchedRule: Rule | null = null;

  for (const rule of config.rules) {
    // Check path match
    if (!new RegExp(rule.path).test(urlPath)) {
      continue;
    }

    // Check JMESPath match
    try {
      const result = jmespath.search(request, rule.match);
      if (result) {
        matchedRule = rule;
      }
    } catch (error) {
      console.error(`Error evaluating match expression: ${rule.match}`, error);
    }
  }

  return matchedRule;
}

export function renderResponse(rule: Rule, request: ChatRequest): string {
  const template = Handlebars.compile(rule.response.content);
  return template({ request });
}

export function handleRequest(config: Config, request: ChatRequest, urlPath: string): { status: number; body: string } {
  const rule = findMatchingRule(config, request, urlPath);

  if (!rule) {
    return {
      status: 404,
      body: JSON.stringify({ error: 'No matching rule found' })
    };
  }

  const body = renderResponse(rule, request);

  return {
    status: rule.response.status,
    body
  };
}
