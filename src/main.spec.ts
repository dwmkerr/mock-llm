import { getConfigPath, loadConfig } from './config';
import { printConfigSummary } from './config-logger';
import { createServer } from './server';

jest.mock('./config');
jest.mock('./config-logger');
jest.mock('./server');

describe('main', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    const mockApp = {
      listen: jest.fn().mockImplementation((port, host, callback) => {
        if (callback) callback();
        return { on: jest.fn() };
      })
    };
    (createServer as jest.Mock).mockReturnValue(mockApp);
  });

  it('loads config, prints summary, and starts server', async () => {
    const mockConfig = {
      rules: [
        { path: '/v1/chat/completions', match: '@', response: { status: 200, content: '{}' } }
      ]
    };

    (getConfigPath as jest.Mock).mockReturnValue('/app/mock-llm.yaml');
    (loadConfig as jest.Mock).mockReturnValue(mockConfig);

    // Import main to execute it
    await jest.isolateModulesAsync(async () => {
      await import('./main');
    });

    expect(getConfigPath).toHaveBeenCalled();
    expect(loadConfig).toHaveBeenCalledWith('/app/mock-llm.yaml');
    expect(printConfigSummary).toHaveBeenCalledWith(mockConfig, 'Loaded configuration from /app/mock-llm.yaml');
    expect(createServer).toHaveBeenCalledWith(mockConfig);
  });
});
