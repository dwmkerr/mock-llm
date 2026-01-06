import * as path from 'path';
import * as fs from 'fs';
import * as yaml from 'js-yaml';

export interface Response {
  status: number;
  content: string;
}

export interface Rule {
  path: string;
  method?: string;  // HTTP method (GET, POST, etc). If not set, matches all methods.
  match?: string;
  sequence?: number;
  response: Response;
}

export interface StreamingConfig {
  chunkSize: number;
  chunkIntervalMs: number;
}

export interface Config {
  streaming: StreamingConfig;
  rules: Rule[];
}

export function getDefaultConfig(): Config {
  return {
    streaming: {
      chunkSize: 50,
      chunkIntervalMs: 50
    },
    rules: [
      {
        path: '/v1/chat/completions',
        method: 'POST',
        match: '@',
        response: {
          status: 200,
          content: `{
  "id": "chatcmpl-{{timestamp}}",
  "object": "chat.completion",
  "model": "{{jmes request body.model}}",
  "choices": [{
    "message": {
      "role": "assistant",
      "content": "{{jmes request body.messages[-1].content}}"
    },
    "finish_reason": "stop"
  }]
}`
        }
      },
      {
        path: '/v1/models',
        method: 'GET',
        response: {
          status: 200,
          content: `{
  "object": "list",
  "data": [
    {"id": "gpt-5.2", "object": "model", "owned_by": "openai"}
  ]
}`
        }
      }
    ]
  };
}

export function getConfigPath(): string {
  return path.join(process.cwd(), 'mock-llm.yaml');
}

export function loadConfig(configPath: string): Config {
  const defaultConfig = getDefaultConfig();

  if (!fs.existsSync(configPath)) {
    return defaultConfig;
  }

  const configContent = fs.readFileSync(configPath, 'utf8');
  const loadedConfig = yaml.load(configContent) as Config;

  return {
    ...defaultConfig,
    ...loadedConfig
  };
}
