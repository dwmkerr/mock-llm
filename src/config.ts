import * as path from 'path';
import * as fs from 'fs';
import * as yaml from 'js-yaml';

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

export function getDefaultConfig(): Config {
  return {
    rules: [
      {
        path: '/v1/chat/completions',
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
