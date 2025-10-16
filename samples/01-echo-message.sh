#!/usr/bin/env bash
set -eo pipefail

# Ensure 'mock-llm' is running first, e.g:
# npm install -g @dwmkerr/mock-llm
# mock-llm

# Default config is used. Any message sent should have the model and message
# echoed back to the caller.

# Send a request.
response=$(curl -fsSL -X POST http://localhost:6556/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello, world!"}]
  }')

# Expect a completion response containing the message.
expected='{
  "object": "chat.completion",
  "model": "gpt-4",
  "choices": [{
    "message": {
      "role": "assistant",
      "content": "Hello, world!"
    },
    "finish_reason": "stop"
  }]
}'

# Fail if response doesn't match expected (ignoring generated 'id' field).
diff_output=$(diff <(echo "$expected" | jq -S .) <(echo "$response" | jq -S 'del(.id)') 2>&1) && echo "passed" || { echo -e "failed:\n${diff_output}"; exit 1; }
