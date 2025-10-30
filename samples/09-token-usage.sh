#!/usr/bin/env bash
set -eo pipefail

# Ensure 'mock-llm' is running first, e.g:
# npm install -g @dwmkerr/mock-llm
# mock-llm

# Configure mock-llm to return token usage in responses.
curl -fsSL -X POST http://localhost:6556/config \
  -H "Content-Type: application/x-yaml" \
  -d '
rules:
  - path: "/v1/chat/completions"
    match: "@"
    response:
      status: 200
      content: |
        {
          "id": "mock-{{timestamp}}",
          "object": "chat.completion",
          "model": "{{jmes request body.model}}",
          "choices": [{
            "message": {{jmes request body.messages[-1]}},
            "finish_reason": "stop"
          }],
          "usage": {
            "prompt_tokens": 10,
            "completion_tokens": 20,
            "total_tokens": 30
          }
        }' > /dev/null

# Send a request.
response=$(curl -fsSL -X POST http://localhost:6556/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello"}]
  }')

# Expect completion with token usage field.
expected='{
  "object": "chat.completion",
  "model": "gpt-4",
  "choices": [{
    "message": {
      "role": "user",
      "content": "Hello"
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 20,
    "total_tokens": 30
  }
}'

# Fail if response doesn't match expected (ignoring generated 'id' field).
diff_output=$(diff <(echo "$expected" | jq -S .) <(echo "$response" | jq -S 'del(.id)') 2>&1) && echo "passed" || { echo -e "failed:\n${diff_output}"; exit 1; }
