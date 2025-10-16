#!/usr/bin/env bash
set -eo pipefail

# Validate that specific headers are sent with requests.
# Useful for testing authentication, API keys, or custom headers.

# Configure mock-llm to echo back the Authorization header.
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
          "object": "chat.completion",
          "model": "{{jmes request body.model}}",
          "choices": [{
            "message": {
              "role": "assistant",
              "content": "Auth: {{jmes request headers.authorization}}"
            },
            "finish_reason": "stop"
          }]
        }' > /dev/null

# Send request with Authorization header.
response=$(curl -fsSL -X POST http://localhost:6556/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-key-123" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello"}]
  }')

# Expected response with auth header echoed.
expected='{
  "object": "chat.completion",
  "model": "gpt-4",
  "choices": [{
    "message": {
      "role": "assistant",
      "content": "Auth: Bearer test-key-123"
    },
    "finish_reason": "stop"
  }]
}'

# Fail if response doesn't match expected.
diff_output=$(diff <(echo "$expected" | jq -S .) <(echo "$response" | jq -S .) 2>&1) && echo "passed" || { echo -e "failed:\n${diff_output}"; exit 1; }
