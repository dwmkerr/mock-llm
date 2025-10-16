#!/usr/bin/env bash
set -eo pipefail

# Returns the system message (messages[0]) to validate agent configuration.
# Useful for testing parameter resolution in agent prompts.

# Configure mock-llm to return the first message (system message).
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
            "message": {{jmes request body.messages[0]}},
            "finish_reason": "stop"
          }]
        }' > /dev/null

# Send a conversation with system message, user message, and assistant response.
response=$(curl -fsSL -X POST http://localhost:6556/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant. Always respond in French."},
      {"role": "user", "content": "Hello"},
      {"role": "assistant", "content": "Bonjour!"}
    ]
  }')

# Expected response with system message.
expected='{
  "object": "chat.completion",
  "model": "gpt-4",
  "choices": [{
    "message": {
      "role": "system",
      "content": "You are a helpful assistant. Always respond in French."
    },
    "finish_reason": "stop"
  }]
}'

# Fail if response doesn't match expected.
diff_output=$(diff <(echo "$expected" | jq -S .) <(echo "$response" | jq -S .) 2>&1) && echo "passed" || { echo -e "failed:\n${diff_output}"; exit 1; }
