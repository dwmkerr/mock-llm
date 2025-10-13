# mock-llm

[![npm version](https://badge.fury.io/js/@dwmkerr%2Fmock-llm.svg)](https://badge.fury.io/js/@dwmkerr%2Fmock-llm)
[![codecov](https://codecov.io/gh/dwmkerr/mock-llm/graph/badge.svg?token=0GvcoTYVY4)](https://codecov.io/gh/dwmkerr/mock-llm)

Simple OpenAI compatible Mock API server. Useful for deterministic testing of AI applications.

## Introduction

Creating integration tests for AI applications that rely on LLMs can be challenging due to costs, the complexity of response structures and the non-deterministic nature of LLMs. Mock LLM runs as a simple 'echo' server that responses to a user message.

The server can be configured to provide different responses based on the input, which can be useful for testing error scenarios, different payloads, etc. It is currently designed to mock the [OpenAI Completions API](https://platform.openai.com/docs/api-reference/completions) but could be extended to mock the list models APIs, responses APIs, A2A apis and so on in the future.

<!-- vim-markdown-toc GFM -->

- [Quickstart](#quickstart)
- [Configuration](#configuration)
    - [Customising Responses](#customising-responses)
    - [Loading Configuration Files](#loading-configuration-files)
    - [Updating Configuration](#updating-configuration)
    - [Health & Readiness Checks](#health--readiness-checks)
    - [Template Variables](#template-variables)
- [Examples](#examples)
- [Developer Guide](#developer-guide)

<!-- vim-markdown-toc -->

## Quickstart

Install and run:

```bash
npm install -g mock-llm
mock-llm
```

Or use Docker:

```bash
docker run -p 8080:8080 ghcr.io/dwmkerr/mock-llm
```

Test with curl. The default rule for incoming requests is to reply with the user's exact message:

```bash
curl -X POST http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

Response:

```json
{
  "id": "chatcmpl-1234567890",
  "object": "chat.completion",
  "model": "gpt-4",
  "choices": [{
    "message": {
      "role": "assistant",
      "content": "Hello"
    },
    "finish_reason": "stop"
  }]
}
```

## Configuration

Responses are configured using a `yaml` file loaded from `mock-llm.yaml` in the current working directory. Rules are evaluated in order - last match wins.

The default configuration echoes the last user message:

```yaml
rules:
  # Default echo rule
  - path: "/v1/chat/completions"
    # The JMESPath expression '@' always matches.
    match: "@"
    response:
      status: 200
      content: |
        {
          "id": "chatcmpl-{{timestamp}}",
          "object": "chat.completion",
          "model": "{{jmes request 'model'}}",
          "choices": [{
            "message": {
              "role": "assistant",
              "content": "{{jmes request 'messages[-1].content'}}"
            },
            "finish_reason": "stop"
          }]
        }
```

### Customising Responses

[JMESPath](https://jmespath.org/) is a query language for JSON used to match incoming requests and extract values for responses.

This returns a fixed message for `hello` and simulates a `401` error for `error-401`, and simulates `v1/models`:

```yaml
rules:
  # Fixed message when input contains 'hello':
  - path: "/v1/chat/completions"
    match: "contains(messages[-1].content, 'hello')"
    response:
      status: 200
      content: |
        {
          "choices": [{
            "message": {
              "role": "assistant",
              "content": "Hi there! How can I help you today?"
            },
            "finish_reason": "stop"
          }]
        }
  # Realistic OpenAI 401 if the input contains `error-401`:
  - path: "/v1/chat/completions"
    match: "contains(messages[-1].content, 'error-401')"
    response:
      status: 401
      content: |
        {
          "error": {
            "message": "Incorrect API key provided.",
            "type": "invalid_request_error",
            "param": null,
            "code": "invalid_api_key"
          }
        }

  # List models endpoint
  - path: "/v1/models"
    # The JMESPath expression '@' always matches.
    match: "@"
    response:
      status: 200
      # Return a set of models.
      content: |
        {
          "data": [
            {"id": "gpt-4", "object": "model"},
            {"id": "gpt-3.5-turbo", "object": "model"}
          ]
        }
```

### Loading Configuration Files

The `--config` parameter can be used for a non-default location:

```bash
# Use the '--config' parameter directly...
mock-llm --config /tmp/myconfig.yaml

# ...mount a config file from the working directory for mock-llm in docker.
docker run -v $(pwd)/mock-llm.yaml:/app/mock-llm.yaml -p 8080:8080 ghcr.io/dwmkerr/mock-llm
```

### Updating Configuration

Configuration can be updated at runtime via the `/config` endpoint: `GET` returns current config (JSON by default, YAML with `Accept: application/x-yaml`), `POST` replaces it, `PATCH` merges updates, `DELETE` resets to default. Both `POST` and `PATCH` accept JSON (`Content-Type: application/json`) or YAML (`Content-Type: application/x-yaml`).

### Health & Readiness Checks

```bash
curl http://localhost:8080/health
# {"status":"healthy"}

curl http://localhost:8080/ready
# {"status":"ready"}
```

### Template Variables

Available in response content templates:

- `{{jmes request path}}` - Query the request body using JMESPath. Primitives (strings, numbers, booleans) are returned as-is. Objects and arrays are automatically JSON-stringified.
- `{{timestamp}}` - Current time in milliseconds

```yaml
"model": "{{jmes request model}}"              // outputs: "model": "gpt-4"
"message": {{jmes request messages[0]}}        // outputs: "message": {"role":"system","content":"..."}
```

## Examples

Any OpenAI API compatible SDKs can be used with Mock LLM. For Node.js:

```javascript
const OpenAI = require('openai');

const client = new OpenAI({
  apiKey: 'mock-key',
  baseURL: 'http://localhost:8080/v1'
});

const response = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello' }]
});

console.log(response.choices[0].message.content);
// "Hello"
```

And for Python:

```python
from openai import OpenAI

client = OpenAI(
    api_key='mock-key',
    base_url='http://localhost:8080/v1'
)

response = client.chat.completions.create(
    model='gpt-4',
    messages=[{'role': 'user', 'content': 'Hello'}]
)

print(response.choices[0].message.content)
# "Hello"
```

## Developer Guide

Install dependencies and start with live-reload:

```bash
npm install
npm run dev
```

Lint or run tests:

```bash
npm run lint
npm run test
```
