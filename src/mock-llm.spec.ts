import { loadConfig, handleRequest, ChatRequest } from './mock-llm';

describe('mock-llm', () => {
  describe('default configuration', () => {
    it('should echo the user message', () => {
      const config = loadConfig();
      const request: ChatRequest = {
        model: 'gpt-4',
        messages: [
          { role: 'user', content: 'Hello world' }
        ]
      };

      const response = handleRequest(config, request, '/v1/chat/completions');
      expect(response.status).toBe(200);

      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        id: expect.stringMatching(/^chatcmpl-/),
        object: 'chat.completion',
        model: 'gpt-4',
        choices: [{
          message: {
            role: 'assistant',
            content: 'Hello world'
          },
          finish_reason: 'stop'
        }]
      });
    });

    it('should echo the last user message when multiple messages present', () => {
      const config = loadConfig();
      const request: ChatRequest = {
        model: 'gpt-4',
        messages: [
          { role: 'user', content: 'First message' },
          { role: 'assistant', content: 'Response' },
          { role: 'user', content: 'Second message' }
        ]
      };

      const response = handleRequest(config, request, '/v1/chat/completions');
      expect(response.status).toBe(200);

      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        choices: [{
          message: {
            content: 'Second message'
          }
        }]
      });
    });
  });

  describe('custom configuration', () => {
    it('should return greeting when message contains hello', () => {
      const config = {
        rules: [
          {
            path: '/v1/chat/completions',
            match: '@',
            response: {
              status: 200,
              content: '{"choices": [{"message": {"content": "OK"}}]}'
            }
          },
          {
            path: '/v1/chat/completions',
            match: "contains(messages[-1].content, 'hello')",
            response: {
              status: 200,
              content: '{"choices": [{"message": {"role": "assistant", "content": "Hi there! How can I help you today?"}, "finish_reason": "stop"}]}'
            }
          }
        ]
      };

      const request: ChatRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'hello there' }]
      };

      const response = handleRequest(config, request, '/v1/chat/completions');
      expect(response.status).toBe(200);

      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        choices: [{
          message: {
            role: 'assistant',
            content: 'Hi there! How can I help you today?'
          },
          finish_reason: 'stop'
        }]
      });
    });

    it('should return 401 error when message contains error-401', () => {
      const config = {
        rules: [
          {
            path: '/v1/chat/completions',
            match: '@',
            response: {
              status: 200,
              content: '{"choices": [{"message": {"content": "OK"}}]}'
            }
          },
          {
            path: '/v1/chat/completions',
            match: "contains(messages[-1].content, 'error-401')",
            response: {
              status: 401,
              content: '{"error": {"message": "Incorrect API key provided.", "type": "invalid_request_error", "param": null, "code": "invalid_api_key"}}'
            }
          }
        ]
      };

      const request: ChatRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'trigger error-401' }]
      };

      const response = handleRequest(config, request, '/v1/chat/completions');
      expect(response.status).toBe(401);

      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        error: {
          message: 'Incorrect API key provided.',
          type: 'invalid_request_error',
          param: null,
          code: 'invalid_api_key'
        }
      });
    });

    it('should fall back to catch-all rule when no match', () => {
      const config = {
        rules: [
          {
            path: '/v1/chat/completions',
            match: '@',
            response: {
              status: 200,
              content: '{"special": false}'
            }
          },
          {
            path: '/v1/chat/completions',
            match: "contains(messages[-1].content, 'special')",
            response: {
              status: 200,
              content: '{"special": true}'
            }
          }
        ]
      };

      const request: ChatRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'normal message' }]
      };

      const response = handleRequest(config, request, '/v1/chat/completions');
      expect(response.status).toBe(200);

      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        special: false
      });
    });

    it('should match different paths', () => {
      const config = {
        rules: [
          {
            path: '/v1/models',
            match: '@',
            response: {
              status: 200,
              content: '{"data": [{"id": "gpt-4"}]}'
            }
          }
        ]
      };

      const request: ChatRequest = {
        model: 'gpt-4',
        messages: []
      };

      const response = handleRequest(config, request, '/v1/models');
      expect(response.status).toBe(200);

      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        data: [{ id: 'gpt-4' }]
      });
    });
  });
});
