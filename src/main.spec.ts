import { getConfigPath, loadConfig } from './config';
import { printConfigSummary } from './config-logger';
import { createServer } from './server';
import { loadTLSCredentials } from './tls';
import * as http from 'http';
import * as https from 'https';

jest.mock('./config');
jest.mock('./config-logger');
jest.mock('./server');
jest.mock('./tls');
jest.mock('http');
jest.mock('https');

describe('main', () => {
  let mockHttpListen: jest.Mock;
  let mockHttpsListen: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    (createServer as jest.Mock).mockReturnValue({});

    mockHttpListen = jest.fn().mockImplementation((_port, _host, cb) => {
      if (cb) cb();
      return { on: jest.fn() };
    });
    mockHttpsListen = jest.fn().mockImplementation((_port, _host, cb) => {
      if (cb) cb();
      return { on: jest.fn() };
    });
    (http.createServer as jest.Mock).mockReturnValue({ listen: mockHttpListen });
    (https.createServer as jest.Mock).mockReturnValue({ listen: mockHttpsListen });

    delete process.env.MOCK_LLM_TLS_ENABLED;
    delete process.env.MOCK_LLM_TLS_CERT;
    delete process.env.MOCK_LLM_TLS_KEY;
  });

  it('loads config, prints summary, and starts HTTP server', async () => {
    const mockConfig = {
      rules: [
        { path: '/v1/chat/completions', match: '@', response: { status: 200, content: '{}' } }
      ]
    };

    (getConfigPath as jest.Mock).mockReturnValue('/app/mock-llm.yaml');
    (loadConfig as jest.Mock).mockReturnValue(mockConfig);
    (loadTLSCredentials as jest.Mock).mockReturnValue(undefined);

    await jest.isolateModulesAsync(async () => {
      await import('./main');
    });

    expect(getConfigPath).toHaveBeenCalled();
    expect(loadConfig).toHaveBeenCalledWith('/app/mock-llm.yaml');
    expect(printConfigSummary).toHaveBeenCalledWith(mockConfig, 'Loaded configuration from /app/mock-llm.yaml');
    expect(createServer).toHaveBeenCalledWith(mockConfig, '0.0.0.0', 6556);
    expect(http.createServer).toHaveBeenCalled();
    expect(https.createServer).not.toHaveBeenCalled();
    expect(mockHttpListen).toHaveBeenCalledWith(6556, '0.0.0.0', expect.any(Function));
  });

  it('starts HTTPS server when TLS credentials load successfully', async () => {
    const mockConfig = { rules: [], tls: { enabled: true, certPath: '/c', keyPath: '/k' } };
    const creds = { cert: Buffer.from('cert'), key: Buffer.from('key') };

    (getConfigPath as jest.Mock).mockReturnValue('/app/mock-llm.yaml');
    (loadConfig as jest.Mock).mockReturnValue(mockConfig);
    (loadTLSCredentials as jest.Mock).mockReturnValue(creds);

    await jest.isolateModulesAsync(async () => {
      await import('./main');
    });

    expect(https.createServer).toHaveBeenCalledWith(creds, {});
    expect(http.createServer).not.toHaveBeenCalled();
    expect(mockHttpsListen).toHaveBeenCalledWith(6556, '0.0.0.0', expect.any(Function));
  });

  it('overrides config.tls with MOCK_LLM_TLS_* env vars', async () => {
    const mockConfig = { rules: [] };
    (getConfigPath as jest.Mock).mockReturnValue('/app/mock-llm.yaml');
    (loadConfig as jest.Mock).mockReturnValue(mockConfig);
    (loadTLSCredentials as jest.Mock).mockReturnValue(undefined);

    process.env.MOCK_LLM_TLS_ENABLED = 'true';
    process.env.MOCK_LLM_TLS_CERT = '/env/cert';
    process.env.MOCK_LLM_TLS_KEY = '/env/key';

    await jest.isolateModulesAsync(async () => {
      await import('./main');
    });

    expect(loadTLSCredentials).toHaveBeenCalledWith({
      enabled: true,
      certPath: '/env/cert',
      keyPath: '/env/key'
    });
  });

  it('falls back to config.tls paths when MOCK_LLM_TLS_ENABLED is set but CERT/KEY env vars are not', async () => {
    // Covers the nullish-coalescing branch: enable via env, but keep the
    // cert/key paths that were already in the mounted config file.
    const mockConfig = {
      rules: [],
      tls: { enabled: false, certPath: '/file/cert', keyPath: '/file/key' }
    };
    (getConfigPath as jest.Mock).mockReturnValue('/app/mock-llm.yaml');
    (loadConfig as jest.Mock).mockReturnValue(mockConfig);
    (loadTLSCredentials as jest.Mock).mockReturnValue(undefined);

    process.env.MOCK_LLM_TLS_ENABLED = 'true';

    await jest.isolateModulesAsync(async () => {
      await import('./main');
    });

    expect(loadTLSCredentials).toHaveBeenCalledWith({
      enabled: true,
      certPath: '/file/cert',
      keyPath: '/file/key'
    });
  });

  it('leaves config.tls untouched when MOCK_LLM_TLS_ENABLED is not "true"', async () => {
    const mockConfig = {
      rules: [],
      tls: { enabled: true, certPath: '/file/cert', keyPath: '/file/key' }
    };
    (getConfigPath as jest.Mock).mockReturnValue('/app/mock-llm.yaml');
    (loadConfig as jest.Mock).mockReturnValue(mockConfig);
    (loadTLSCredentials as jest.Mock).mockReturnValue(undefined);

    // Anything other than the literal "true" leaves config alone.
    process.env.MOCK_LLM_TLS_ENABLED = 'false';
    process.env.MOCK_LLM_TLS_CERT = '/env/cert';
    process.env.MOCK_LLM_TLS_KEY = '/env/key';

    await jest.isolateModulesAsync(async () => {
      await import('./main');
    });

    expect(loadTLSCredentials).toHaveBeenCalledWith({
      enabled: true,
      certPath: '/file/cert',
      keyPath: '/file/key'
    });
  });
});
