import { describe, it, expect } from '@jest/globals';
import { getDefaultConfig, getConfigPath } from './config';

describe('config', () => {
  describe('getDefaultConfig', () => {
    it('should return default configuration', () => {
      const config = getDefaultConfig();

      expect(config).toEqual({
        rules: [
          {
            path: '/v1/chat/completions',
            match: '@',
            response: {
              status: 200,
              content: expect.stringContaining('chatcmpl-{{timestamp}}')
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
