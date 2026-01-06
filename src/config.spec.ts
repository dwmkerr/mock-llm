import { describe, it, expect } from '@jest/globals';
import { getDefaultConfig, getConfigPath } from './config';

describe('config', () => {
  describe('getDefaultConfig', () => {
    it('should return default configuration', () => {
      const config = getDefaultConfig();

      expect(config).toEqual({
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
              content: expect.stringContaining('chatcmpl-{{timestamp}}')
            }
          },
          {
            path: '/v1/models',
            method: 'GET',
            response: {
              status: 200,
              content: expect.stringContaining('gpt-5.2')
            }
          }
        ]
      });
    });
  });

  describe('getConfigPath', () => {
    it('should return default config path', () => {
      const configPath = getConfigPath();

      expect(configPath).toMatch(/mock-llm\.yaml$/);
    });
  });
});
