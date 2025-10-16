import { printConfigSummary } from './config-logger';
import { Config } from './config';

describe('printConfigSummary', () => {
  it('logs config summary with rules', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    const config: Config = {
      rules: [
        { path: '/v1/chat/completions', match: '@', response: { status: 200, content: '{}' } },
        { path: '/v1/models', match: 'contains(path, "models")', response: { status: 200, content: '{}' } }
      ]
    };

    printConfigSummary(config, 'Test config loaded');

    expect(consoleSpy).toHaveBeenCalledWith('Test config loaded');
    expect(consoleSpy).toHaveBeenCalledWith('  - rule 1, match: @');
    expect(consoleSpy).toHaveBeenCalledWith('  - rule 2, match: contains(path, "models")');

    consoleSpy.mockRestore();
  });
});
