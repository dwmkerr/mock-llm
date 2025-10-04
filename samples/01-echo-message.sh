#!/usr/bin/env bash
set -eo pipefail

# Ensure 'mock-llm' is running first, e.g:
# npm install -g @dwmkerr/mock-llm
# mock-llm

# Default config is used. Any message sent should have the model and message
# echoed back to the caller.

# Send a request.
response=$(curl -fsSL -X POST http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello, world!"}]
  }')

# Expect a completion response with an assistant message that echos the input
# and the model.
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

# Print the response, the expected, and the diff if they do not match. We ignore
# the 'id' field in the response as it is auto-generated.
echo -e "response:\n$(echo "$response" | jq -S)"
echo -e "expected:\n$(echo "$expected" | jq -S)"
diff_output=$(diff <(echo "$expected" | jq -S .) <(echo "$response" | jq -S 'del(.id)') 2>&1) && echo "passed" || { echo -e "failed - diff:\n${diff_output}"; exit 1; }
