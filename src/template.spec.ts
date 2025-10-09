import { describe, it, expect } from '@jest/globals';
import { renderTemplate } from './template';

describe('template', () => {
  it('should replace timestamp', () => {
    const result = renderTemplate('{"time":"{{timestamp}}"}', {});
    const parsed = JSON.parse(result);

    expect(typeof parsed.time).toBe('string');
    expect(parseInt(parsed.time)).toBeGreaterThan(0);
  });

  it('should replace jmes with primitive', () => {
    const result = renderTemplate(
      '{"model":"{{jmes request model}}"}',
      { request: { model: 'gpt-4' } }
    );

    expect(JSON.parse(result)).toEqual({ model: 'gpt-4' });
  });

  it('should replace jmes with object', () => {
    const result = renderTemplate(
      '{"message":{{jmes request messages[0]}}}',
      { request: { messages: [{ role: 'system', content: 'Test' }] } }
    );

    expect(JSON.parse(result)).toEqual({
      message: { role: 'system', content: 'Test' }
    });
  });

  it('should handle multiple replacements', () => {
    const result = renderTemplate(
      '{"time":"{{timestamp}}","model":"{{jmes request model}}"}',
      { request: { model: 'gpt-4' } }
    );

    const parsed = JSON.parse(result);
    expect(parsed.model).toBe('gpt-4');
    expect(typeof parsed.time).toBe('string');
  });
});
