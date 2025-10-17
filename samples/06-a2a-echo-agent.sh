#!/usr/bin/env bash
set -eo pipefail

# Ensure 'mock-llm' is running first, e.g:
# npm install -g @dwmkerr/mock-llm
# mock-llm

# Send a message to echo-agent.
# Echo agent responds with a Message directly.

response=$(curl -fsSL -X POST http://localhost:6556/a2a/agents/echo-agent/ \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "message/send",
    "params": {
      "message": {
        "messageId": "msg-1",
        "kind": "message",
        "role": "user",
        "parts": [
          {
            "kind": "text",
            "text": "Hello, world!"
          }
        ]
      }
    },
    "id": 1
  }')

# Verify the response contains the echoed message
message_kind=$(echo "$response" | jq -r '.result.kind')
if [ "$message_kind" != "message" ]; then
  echo "failed: expected kind 'message', got '$message_kind'"
  exit 1
fi

# Verify the message role is 'agent'
message_role=$(echo "$response" | jq -r '.result.role')
if [ "$message_role" != "agent" ]; then
  echo "failed: expected role 'agent', got '$message_role'"
  exit 1
fi

# Verify the echoed text matches
echoed_text=$(echo "$response" | jq -r '.result.parts[0].text')
if [ "$echoed_text" != "Hello, world!" ]; then
  echo "failed: expected echoed text 'Hello, world!', got '$echoed_text'"
  exit 1
fi

echo "passed"
