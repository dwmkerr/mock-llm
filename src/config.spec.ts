import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { getDefaultConfig, getConfigPath, loadConfig } from './config';

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

  describe('loadConfig', () => {
    it('returns defaults when the file does not exist', () => {
      const config = loadConfig('/nonexistent/mock-llm.yaml');
      expect(config).toEqual(getDefaultConfig());
    });

    it('merges loaded YAML over the defaults, preserving the tls block', () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mock-llm-config-'));
      const file = path.join(tmp, 'mock-llm.yaml');
      fs.writeFileSync(file,
        'tls:\n' +
        '  enabled: true\n' +
        '  certPath: /etc/mock-llm/tls/tls.crt\n' +
        '  keyPath: /etc/mock-llm/tls/tls.key\n'
      );
      try {
        const config = loadConfig(file);
        expect(config.tls).toEqual({
          enabled: true,
          certPath: '/etc/mock-llm/tls/tls.crt',
          keyPath: '/etc/mock-llm/tls/tls.key'
        });
        // Defaults still present for fields not in the YAML.
        expect(config.streaming).toEqual(getDefaultConfig().streaming);
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    });
  });
});
